import { Router, type IRouter, type Request } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth } from "../middlewares/auth";
import { createHmac, randomBytes } from "crypto";
import {
  verifyHubspotV3Signature,
  verifyHubspotSignature,
  verifyPipedriveSignature,
} from "../lib/webhook-signatures";

type RawBodyRequest = Request & { rawBody?: Buffer };
import { getFrontendUrl as frontendUrl, getIntegrationsOAuthRedirectUri } from "../lib/urls";
import {
  exchangeHubspotCode,
  syncHubspotContacts,
  syncHubspotDeals,
  HUBSPOT_SCOPES,
  createHubspotNote,
  findHubspotContactIdByEmail,
} from "../services/hubspot";
import {
  exchangePipedriveCode,
  syncPipedriveContacts,
  syncPipedriveDeals,
  PIPEDRIVE_SCOPES,
  createPipedriveActivity,
  findPipedrivePersonIdByEmail,
} from "../services/pipedrive";

const router: IRouter = Router();

const SLACK_CLIENT_ID = process.env["SLACK_CLIENT_ID"] || "";
const SLACK_CLIENT_SECRET = process.env["SLACK_CLIENT_SECRET"] || "";
const NOTION_CLIENT_ID = process.env["NOTION_CLIENT_ID"] || "";
const NOTION_CLIENT_SECRET = process.env["NOTION_CLIENT_SECRET"] || "";
const HUBSPOT_CLIENT_ID = process.env["HUBSPOT_CLIENT_ID"] || "";
const PIPEDRIVE_CLIENT_ID = process.env["PIPEDRIVE_CLIENT_ID"] || "";

function getStateSecret(): string {
  const secret = process.env["SESSION_SECRET"] || process.env["SUPABASE_SECRET_KEY"];
  if (!secret) {
    throw new Error("SESSION_SECRET or SUPABASE_SECRET_KEY must be set for OAuth state signing");
  }
  return secret;
}

function createSignedState(userId: string): string {
  const nonce = randomBytes(16).toString("hex");
  const payload = JSON.stringify({ userId, nonce, ts: Date.now() });
  const signature = createHmac("sha256", getStateSecret()).update(payload).digest("hex");
  return Buffer.from(JSON.stringify({ payload, signature })).toString("base64url");
}

function verifySignedState(state: string): string | null {
  try {
    const { payload, signature } = JSON.parse(Buffer.from(state, "base64url").toString());
    const expected = createHmac("sha256", getStateSecret()).update(payload).digest("hex");
    if (signature !== expected) return null;
    const data = JSON.parse(payload);
    const age = Date.now() - data.ts;
    if (age > 10 * 60 * 1000) return null;
    return data.userId;
  } catch {
    return null;
  }
}

function getFrontendUrl(): string {
  return frontendUrl();
}

function getRedirectUri(provider: string): string {
  return getIntegrationsOAuthRedirectUri(provider);
}

function toCamelCase(row: any) {
  return {
    id: row.id,
    provider: row.provider,
    workspaceName: row.workspace_name ?? null,
    channelId: row.channel_id ?? null,
    databaseId: row.database_id ?? null,
    enabled: row.enabled,
    createdAt: row.created_at,
    lastSyncedAt: row.last_synced_at ?? null,
    lastError: row.last_error ?? null,
    settings: row.settings ?? {},
  };
}

async function requireProPlan(userId: string): Promise<boolean> {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("plan")
    .eq("id", userId)
    .single();
  if (!profile) return false;
  return ["pro", "business", "plus"].includes(profile.plan);
}

router.get("/integrations", requireAuth, async (req, res): Promise<void> => {
  try {
    const { data } = await supabaseAdmin
      .from("integrations")
      .select(
        "id, provider, workspace_name, channel_id, database_id, enabled, created_at, last_synced_at, last_error, settings",
      )
      .eq("user_id", req.userId!);

    res.json((data || []).map(toCamelCase));
  } catch {
    res.status(500).json({ error: "Failed to fetch integrations" });
  }
});

router.get("/integrations/availability", async (_req, res): Promise<void> => {
  res.json({
    slack: !!SLACK_CLIENT_ID,
    notion: !!NOTION_CLIENT_ID,
    hubspot: !!HUBSPOT_CLIENT_ID,
    pipedrive: !!PIPEDRIVE_CLIENT_ID,
    whatsapp: true,
    sms_twilio: true,
    sms_brevo: true,
  });
});

router.get("/integrations/slack/connect", requireAuth, async (req, res): Promise<void> => {
  if (!SLACK_CLIENT_ID) {
    res.status(400).json({ error: "Slack integration not configured" });
    return;
  }

  const isPro = await requireProPlan(req.userId!);
  if (!isPro) {
    res.status(403).json({ error: "Integration reservee au plan Pro ou superieur" });
    return;
  }

  const state = createSignedState(req.userId!);
  const params = new URLSearchParams({
    client_id: SLACK_CLIENT_ID,
    scope: "chat:write,channels:read",
    redirect_uri: getRedirectUri("slack"),
    state,
  });

  res.json({ url: `https://slack.com/oauth/v2/authorize?${params}` });
});

router.get("/integrations/slack/callback", async (req, res): Promise<void> => {
  try {
    const { code, state } = req.query;
    if (!code || !state) {
      res.status(400).send("Missing code or state");
      return;
    }

    const userId = verifySignedState(state as string);
    if (!userId) {
      res.status(400).send("Invalid or expired state");
      return;
    }

    const tokenResponse = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: SLACK_CLIENT_ID,
        client_secret: SLACK_CLIENT_SECRET,
        code: code as string,
        redirect_uri: getRedirectUri("slack"),
      }),
    });

    const tokenData = await tokenResponse.json() as {
      ok: boolean;
      access_token?: string;
      team?: { name?: string };
      incoming_webhook?: { channel_id?: string };
      error?: string;
    };

    if (!tokenData.ok || !tokenData.access_token) {
      res.status(400).send(`Slack OAuth error: ${tokenData.error || "unknown"}`);
      return;
    }

    let channelId = tokenData.incoming_webhook?.channel_id || null;

    if (!channelId) {
      const channelsRes = await fetch("https://slack.com/api/conversations.list?types=public_channel&limit=5", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const channelsData = await channelsRes.json() as { ok: boolean; channels?: Array<{ id: string; name: string }> };
      if (channelsData.ok && channelsData.channels?.length) {
        const general = channelsData.channels.find(c => c.name === "general");
        channelId = general?.id || channelsData.channels[0].id;
      }
    }

    await supabaseAdmin
      .from("integrations")
      .upsert({
        user_id: userId,
        provider: "slack",
        access_token: tokenData.access_token,
        workspace_name: tokenData.team?.name || "Slack",
        channel_id: channelId,
        enabled: true,
      }, { onConflict: "user_id,provider" });

    const frontendUrl = getFrontendUrl();
    res.send(`<html><body><script>
      window.opener?.postMessage({ type: "integration-connected", provider: "slack" }, "*");
      window.location.href = "${frontendUrl}/dashboard/parametres?integration=slack&status=success";
    </script><p>Slack connecte ! Redirection...</p></body></html>`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[integrations] Slack callback error:", message);
    res.status(500).send("Erreur de connexion Slack");
  }
});

router.get("/integrations/notion/connect", requireAuth, async (req, res): Promise<void> => {
  if (!NOTION_CLIENT_ID) {
    res.status(400).json({ error: "Notion integration not configured" });
    return;
  }

  const isPro = await requireProPlan(req.userId!);
  if (!isPro) {
    res.status(403).json({ error: "Integration reservee au plan Pro ou superieur" });
    return;
  }

  const state = createSignedState(req.userId!);
  const params = new URLSearchParams({
    client_id: NOTION_CLIENT_ID,
    redirect_uri: getRedirectUri("notion"),
    response_type: "code",
    owner: "user",
    state,
  });

  res.json({ url: `https://api.notion.com/v1/oauth/authorize?${params}` });
});

router.get("/integrations/notion/callback", async (req, res): Promise<void> => {
  try {
    const { code, state } = req.query;
    if (!code || !state) {
      res.status(400).send("Missing code or state");
      return;
    }

    const userId = verifySignedState(state as string);
    if (!userId) {
      res.status(400).send("Invalid or expired state");
      return;
    }

    const credentials = Buffer.from(`${NOTION_CLIENT_ID}:${NOTION_CLIENT_SECRET}`).toString("base64");
    const tokenResponse = await fetch("https://api.notion.com/v1/oauth/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code: code as string,
        redirect_uri: getRedirectUri("notion"),
      }),
    });

    const tokenData = await tokenResponse.json() as {
      access_token?: string;
      workspace_name?: string;
      error?: string;
    };

    if (!tokenData.access_token) {
      res.status(400).send(`Notion OAuth error: ${tokenData.error || "unknown"}`);
      return;
    }

    let databaseId: string | null = null;
    const searchRes = await fetch("https://api.notion.com/v1/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28",
      },
      body: JSON.stringify({
        filter: { property: "object", value: "database" },
        page_size: 5,
      }),
    });
    const searchData = await searchRes.json() as { results?: Array<{ id: string }> };
    if (searchData.results?.length) {
      databaseId = searchData.results[0].id;
    }

    await supabaseAdmin
      .from("integrations")
      .upsert({
        user_id: userId,
        provider: "notion",
        access_token: tokenData.access_token,
        workspace_name: tokenData.workspace_name || "Notion",
        database_id: databaseId,
        enabled: true,
      }, { onConflict: "user_id,provider" });

    const frontendUrl = getFrontendUrl();
    res.send(`<html><body><script>
      window.opener?.postMessage({ type: "integration-connected", provider: "notion" }, "*");
      window.location.href = "${frontendUrl}/dashboard/parametres?integration=notion&status=success";
    </script><p>Notion connecte ! Redirection...</p></body></html>`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[integrations] Notion callback error:", message);
    res.status(500).send("Erreur de connexion Notion");
  }
});

// ============== HubSpot ==============
router.get("/integrations/hubspot/connect", requireAuth, async (req, res): Promise<void> => {
  if (!HUBSPOT_CLIENT_ID) {
    res.status(400).json({ error: "HubSpot integration not configured" });
    return;
  }
  const isPro = await requireProPlan(req.userId!);
  if (!isPro) {
    res.status(403).json({ error: "Integration reservee au plan Pro ou superieur" });
    return;
  }
  const state = createSignedState(req.userId!);
  const params = new URLSearchParams({
    client_id: HUBSPOT_CLIENT_ID,
    redirect_uri: getRedirectUri("hubspot"),
    scope: HUBSPOT_SCOPES.join(" "),
    state,
  });
  res.json({ url: `https://app.hubspot.com/oauth/authorize?${params}` });
});

router.get("/integrations/hubspot/callback", async (req, res): Promise<void> => {
  try {
    const { code, state } = req.query;
    if (!code || !state) {
      res.status(400).send("Missing code or state");
      return;
    }
    const userId = verifySignedState(state as string);
    if (!userId) {
      res.status(400).send("Invalid or expired state");
      return;
    }
    const tokens = await exchangeHubspotCode(code as string, getRedirectUri("hubspot"));
    if (!tokens) {
      res.status(400).send("HubSpot token exchange failed");
      return;
    }
    const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000).toISOString();
    await supabaseAdmin.from("integrations").upsert(
      {
        user_id: userId,
        provider: "hubspot",
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        expires_at: expiresAt,
        scopes: HUBSPOT_SCOPES.join(" "),
        workspace_name: "HubSpot",
        // Persist the HubSpot portal/hub identifier for inbound webhook routing.
        settings: tokens.hubId ? { hubId: tokens.hubId, portalId: tokens.hubId } : {},
        enabled: true,
      },
      { onConflict: "user_id,provider" },
    );

    syncHubspotContacts(userId, 50).catch(() => {});

    const frontendUrl = getFrontendUrl();
    res.send(`<html><body style="font-family:system-ui;padding:24px;text-align:center"><script>
      try { window.opener?.postMessage({ type: "integration-connected", provider: "hubspot" }, "*"); } catch (e) {}
      if (window.opener) { window.close(); }
      setTimeout(function(){ window.location.href = "${frontendUrl}/dashboard/parametres/crm?integration=hubspot&status=success"; }, 600);
    </script><p>HubSpot connecté ! Vous pouvez fermer cette fenêtre.</p></body></html>`);
  } catch (err) {
    console.error("[integrations] HubSpot callback error:", (err as Error).message);
    res.status(500).send("Erreur de connexion HubSpot");
  }
});

router.post("/integrations/hubspot/sync", requireAuth, async (req, res): Promise<void> => {
  const contacts = await syncHubspotContacts(req.userId!, 200);
  const deals = await syncHubspotDeals(req.userId!, 200);
  res.json({ contacts, deals });
});

router.post("/integrations/hubspot/note", requireAuth, async (req, res): Promise<void> => {
  const { contactEmail, body } = req.body || {};
  if (!contactEmail || !body) {
    res.status(400).json({ error: "contactEmail and body required" });
    return;
  }
  const contactId = await findHubspotContactIdByEmail(req.userId!, contactEmail);
  if (!contactId) {
    res.status(404).json({ error: "Contact not found in HubSpot" });
    return;
  }
  const result = await createHubspotNote(req.userId!, contactId, body);
  res.json(result);
});

// ============== Pipedrive ==============
router.get("/integrations/pipedrive/connect", requireAuth, async (req, res): Promise<void> => {
  if (!PIPEDRIVE_CLIENT_ID) {
    res.status(400).json({ error: "Pipedrive integration not configured" });
    return;
  }
  const isPro = await requireProPlan(req.userId!);
  if (!isPro) {
    res.status(403).json({ error: "Integration reservee au plan Pro ou superieur" });
    return;
  }
  const state = createSignedState(req.userId!);
  const params = new URLSearchParams({
    client_id: PIPEDRIVE_CLIENT_ID,
    redirect_uri: getRedirectUri("pipedrive"),
    state,
    scope: PIPEDRIVE_SCOPES.join(" "),
  });
  res.json({ url: `https://oauth.pipedrive.com/oauth/authorize?${params}` });
});

router.get("/integrations/pipedrive/callback", async (req, res): Promise<void> => {
  try {
    const { code, state } = req.query;
    if (!code || !state) {
      res.status(400).send("Missing code or state");
      return;
    }
    const userId = verifySignedState(state as string);
    if (!userId) {
      res.status(400).send("Invalid or expired state");
      return;
    }
    const tokens = await exchangePipedriveCode(code as string, getRedirectUri("pipedrive"));
    if (!tokens) {
      res.status(400).send("Pipedrive token exchange failed");
      return;
    }
    const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000).toISOString();

    // Resolve the Pipedrive company identifier so inbound webhooks can be routed
    // back to the right Inboria user.
    let companyId: number | null = null;
    try {
      const meRes = await fetch(`${tokens.apiDomain}/v1/users/me`, {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      });
      if (meRes.ok) {
        const meJson = (await meRes.json()) as { data?: { company_id?: number } };
        if (typeof meJson.data?.company_id === "number") companyId = meJson.data.company_id;
      }
    } catch {
      // best-effort: fall back to per-user resync if companyId is unavailable
    }

    await supabaseAdmin.from("integrations").upsert(
      {
        user_id: userId,
        provider: "pipedrive",
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        expires_at: expiresAt,
        scopes: PIPEDRIVE_SCOPES.join(" "),
        workspace_name: "Pipedrive",
        settings: companyId
          ? { apiDomain: tokens.apiDomain, companyId }
          : { apiDomain: tokens.apiDomain },
        enabled: true,
      },
      { onConflict: "user_id,provider" },
    );

    syncPipedriveContacts(userId, 50).catch(() => {});

    const frontendUrl = getFrontendUrl();
    res.send(`<html><body><script>
      window.opener?.postMessage({ type: "integration-connected", provider: "pipedrive" }, "*");
      window.location.href = "${frontendUrl}/dashboard/parametres/integrations?integration=pipedrive&status=success";
    </script><p>Pipedrive connecte ! Redirection...</p></body></html>`);
  } catch (err) {
    console.error("[integrations] Pipedrive callback error:", (err as Error).message);
    res.status(500).send("Erreur de connexion Pipedrive");
  }
});

router.post("/integrations/pipedrive/sync", requireAuth, async (req, res): Promise<void> => {
  const contacts = await syncPipedriveContacts(req.userId!, 200);
  const deals = await syncPipedriveDeals(req.userId!, 200);
  res.json({ contacts, deals });
});

// ============== CRM inbound webhooks (no auth — provider HMAC verification) ==============
// HubSpot signs payloads with sha256(app_secret + body) sent as X-HubSpot-Signature-256
// (we accept the standard HMAC form used by HubSpot v3 webhooks).
router.post("/integrations/hubspot/webhook", async (req: RawBodyRequest, res): Promise<void> => {
  try {
    const clientSecret = process.env["HUBSPOT_CLIENT_SECRET"] || process.env["HUBSPOT_APP_SECRET"] || "";
    if (!clientSecret) {
      res.status(401).json({ error: "hubspot webhook signing not configured" });
      return;
    }

    const v3Sig = req.get("x-hubspot-signature-v3") || req.get("X-HubSpot-Signature-v3");
    const v3Ts = req.get("x-hubspot-request-timestamp") || req.get("X-HubSpot-Request-Timestamp");
    const v2Sig = req.get("x-hubspot-signature-256") || req.get("X-HubSpot-Signature-256");

    const proto = (req.get("x-forwarded-proto") || req.protocol || "https").split(",")[0]!.trim();
    const host = req.get("x-forwarded-host") || req.get("host") || "";
    const fullUrl = `${proto}://${host}${req.originalUrl}`;

    let valid = false;
    if (v3Sig && v3Ts) {
      valid = verifyHubspotV3Signature({
        method: "POST",
        url: fullUrl,
        rawBody: req.rawBody,
        signatureHeader: v3Sig,
        timestampHeader: v3Ts,
        clientSecret,
      });
    } else if (v2Sig) {
      valid = verifyHubspotSignature(req.rawBody, v2Sig, clientSecret);
    }
    if (!valid) {
      res.status(401).json({ error: "invalid hubspot signature" });
      return;
    }

    // HubSpot sends an array of events. We trigger a re-sync per portal to refresh
    // local crm_contacts / crm_deals. This keeps Inboria's CRM mirror fresh whenever
    // a change is made in HubSpot. portalId == hubId in HubSpot's data model.
    const events = Array.isArray(req.body) ? req.body : [];
    const portalIds = new Set<number>();
    for (const evt of events) {
      const pid = evt?.portalId ?? evt?.hubId;
      if (typeof pid === "number" || (typeof pid === "string" && pid)) portalIds.add(Number(pid));
    }
    for (const portalId of portalIds) {
      // Match against either hubId or portalId in settings (we persist both for compat).
      const { data: byHub } = await supabaseAdmin
        .from("integrations")
        .select("user_id")
        .eq("provider", "hubspot")
        .contains("settings", { hubId: portalId });
      const { data: byPortal } = await supabaseAdmin
        .from("integrations")
        .select("user_id")
        .eq("provider", "hubspot")
        .contains("settings", { portalId });
      const rows = [...(byHub ?? []), ...(byPortal ?? [])];
      const seen = new Set<string>();
      for (const r of rows) {
        const uid = String(r.user_id);
        if (seen.has(uid)) continue;
        seen.add(uid);
        syncHubspotContacts(uid, 100).catch(() => {});
        syncHubspotDeals(uid, 100).catch(() => {});
      }
    }
    res.status(200).json({ ok: true, processed: events.length });
  } catch (err) {
    console.error("[integrations][hubspot] webhook error:", (err as Error).message);
    res.status(200).json({ ok: false });
  }
});

// Pipedrive sends an X-Pipedrive-Signature header (HMAC-SHA256 of body with the
// webhook secret configured at subscription time).
router.post("/integrations/pipedrive/webhook", async (req: RawBodyRequest, res): Promise<void> => {
  try {
    const webhookSecret = process.env["PIPEDRIVE_WEBHOOK_SECRET"] || "";
    if (!webhookSecret) {
      res.status(401).json({ error: "pipedrive webhook signing not configured" });
      return;
    }
    const sigHeader =
      req.get("x-pipedrive-signature") || req.get("X-Pipedrive-Signature");
    if (!verifyPipedriveSignature(req.rawBody, sigHeader, webhookSecret)) {
      res.status(401).json({ error: "invalid pipedrive signature" });
      return;
    }

    const body: any = req.body || {};
    const companyId = body?.meta?.company_id ? Number(body.meta.company_id) : null;
    if (companyId) {
      const { data: rows } = await supabaseAdmin
        .from("integrations")
        .select("user_id")
        .eq("provider", "pipedrive")
        .contains("settings", { companyId });
      for (const r of rows ?? []) {
        syncPipedriveContacts(String(r.user_id), 100).catch(() => {});
        syncPipedriveDeals(String(r.user_id), 100).catch(() => {});
      }
    }
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[integrations][pipedrive] webhook error:", (err as Error).message);
    res.status(200).json({ ok: false });
  }
});

router.post("/integrations/pipedrive/activity", requireAuth, async (req, res): Promise<void> => {
  const { contactEmail, subject, note } = req.body || {};
  if (!contactEmail || !subject) {
    res.status(400).json({ error: "contactEmail and subject required" });
    return;
  }
  const personId = await findPipedrivePersonIdByEmail(req.userId!, contactEmail);
  if (!personId) {
    res.status(404).json({ error: "Contact not found in Pipedrive" });
    return;
  }
  const result = await createPipedriveActivity(req.userId!, personId, subject, note || "");
  res.json(result);
});

// ============== CRM read endpoints ==============
router.get("/crm/contacts", requireAuth, async (req, res): Promise<void> => {
  const { data } = await supabaseAdmin
    .from("crm_contacts")
    .select("*")
    .eq("user_id", req.userId!)
    .order("last_synced_at", { ascending: false })
    .limit(200);
  res.json(data || []);
});

router.get("/crm/deals", requireAuth, async (req, res): Promise<void> => {
  const { data } = await supabaseAdmin
    .from("crm_deals")
    .select("*")
    .eq("user_id", req.userId!)
    .order("last_synced_at", { ascending: false })
    .limit(200);
  res.json(data || []);
});

router.patch("/integrations/:provider", requireAuth, async (req, res): Promise<void> => {
  try {
    const { provider } = req.params;
    const { enabled, channelId, databaseId } = req.body;

    if (typeof enabled === "boolean" && enabled) {
      const isPro = await requireProPlan(req.userId!);
      if (!isPro) {
        res.status(403).json({ error: "Integration reservee au plan Pro ou superieur" });
        return;
      }
    }

    const updates: Record<string, any> = {};
    if (typeof enabled === "boolean") updates.enabled = enabled;
    if (channelId !== undefined) updates.channel_id = channelId;
    if (databaseId !== undefined) updates.database_id = databaseId;

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "No fields to update" });
      return;
    }

    const { data, error } = await supabaseAdmin
      .from("integrations")
      .update(updates)
      .eq("user_id", req.userId!)
      .eq("provider", provider)
      .select("id, provider, workspace_name, channel_id, database_id, enabled, created_at")
      .single();

    if (error || !data) {
      res.status(404).json({ error: "Integration not found" });
      return;
    }

    res.json(toCamelCase(data));
  } catch {
    res.status(500).json({ error: "Failed to update integration" });
  }
});

router.delete("/integrations/:provider", requireAuth, async (req, res): Promise<void> => {
  try {
    const { provider } = req.params;

    const { error } = await supabaseAdmin
      .from("integrations")
      .delete()
      .eq("user_id", req.userId!)
      .eq("provider", provider);

    if (error) {
      res.status(500).json({ error: "Failed to disconnect integration" });
      return;
    }

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to disconnect integration" });
  }
});

export default router;
