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
  logEmailEngagement,
  createHubspotDeal,
  createHubspotTask,
  getHubspotDealPipelines,
  updateHubspotDealStage,
  updateHubspotContactProps,
} from "../services/hubspot";
import {
  exchangePipedriveCode,
  syncPipedriveContacts,
  syncPipedriveDeals,
  PIPEDRIVE_SCOPES,
  createPipedriveActivity,
  findPipedrivePersonIdByEmail,
  getPipedriveContactContext,
  getPipedrivePipelines,
  createPipedriveDeal,
  createPipedriveTask,
  updatePipedriveDealStage,
  updatePipedrivePerson,
  logEmailEngagementPipedrive,
} from "../services/pipedrive";
import {
  exchangeSalesforceCode,
  syncSalesforceContacts,
  syncSalesforceDeals,
  SALESFORCE_SCOPES,
  getSalesforceContactContext,
  getSalesforcePipelines,
  createSalesforceOpportunity,
  createSalesforceTask,
  updateSalesforceOpportunityStage,
  updateSalesforceContact,
  logEmailEngagementSalesforce,
} from "../services/salesforce";
import {
  connectOdoo,
  disconnectOdoo,
  syncOdooContacts,
  syncOdooDeals,
  getOdooContactContext,
  logEmailEngagementOdoo,
  listOdooActivityTypes,
  createOdooDeal,
  createOdooActivity,
} from "../services/odoo";

const router: IRouter = Router();

const SLACK_CLIENT_ID = process.env["SLACK_CLIENT_ID"] || "";
const SLACK_CLIENT_SECRET = process.env["SLACK_CLIENT_SECRET"] || "";
const NOTION_CLIENT_ID = process.env["NOTION_CLIENT_ID"] || "";
const NOTION_CLIENT_SECRET = process.env["NOTION_CLIENT_SECRET"] || "";
const HUBSPOT_CLIENT_ID = process.env["HUBSPOT_CLIENT_ID"] || "";
const PIPEDRIVE_CLIENT_ID = process.env["PIPEDRIVE_CLIENT_ID"] || "";
const SALESFORCE_CLIENT_ID = process.env["SALESFORCE_CLIENT_ID"] || "";

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

// Variante du state HMAC qui transporte des flags additionnels (ex. Salesforce
// sandbox vs prod). Même TTL 10 min, même secret.
function createSignedStateWithFlags(userId: string, flags: Record<string, string | boolean>): string {
  const nonce = randomBytes(16).toString("hex");
  const payload = JSON.stringify({ userId, nonce, ts: Date.now(), flags });
  const signature = createHmac("sha256", getStateSecret()).update(payload).digest("hex");
  return Buffer.from(JSON.stringify({ payload, signature })).toString("base64url");
}

function verifySignedStateWithFlags(
  state: string,
): { userId: string; flags: Record<string, string | boolean> } | null {
  try {
    const { payload, signature } = JSON.parse(Buffer.from(state, "base64url").toString());
    const expected = createHmac("sha256", getStateSecret()).update(payload).digest("hex");
    if (signature !== expected) return null;
    const data = JSON.parse(payload);
    const age = Date.now() - data.ts;
    if (age > 10 * 60 * 1000) return null;
    return { userId: data.userId, flags: (data.flags as Record<string, string | boolean>) || {} };
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
    salesforce: !!SALESFORCE_CLIENT_ID,
    // Odoo : toujours disponible. Pas d'OAuth central côté Inboria —
    // chaque utilisateur fournit son URL + base + login + clé API perso.
    odoo: true,
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
  // CRM accessible a tous les plans (Free, Solo, Pro, Business, Plus)
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
  const contacts = await syncHubspotContacts(req.userId!, 100);
  const deals = await syncHubspotDeals(req.userId!, 100);
  res.json({ contacts, deals });
});

// Wave HubSpot — petit endpoint utilisé par le panneau "Contexte HubSpot"
// affiché à droite de la Réception lorsque le filtre CRM HubSpot est actif.
router.get("/integrations/hubspot/stats", requireAuth, async (req, res): Promise<void> => {
  try {
    const [{ data: integ }, { count: contactsCount }, { count: dealsCount }] = await Promise.all([
      supabaseAdmin
        .from("integrations")
        .select("last_synced_at, last_error, enabled")
        .eq("user_id", req.userId!)
        .eq("provider", "hubspot")
        .maybeSingle(),
      supabaseAdmin
        .from("crm_contacts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", req.userId!)
        .eq("provider", "hubspot"),
      supabaseAdmin
        .from("crm_deals")
        .select("id", { count: "exact", head: true })
        .eq("user_id", req.userId!)
        .eq("provider", "hubspot"),
    ]);
    res.json({
      connected: !!integ?.enabled,
      contactsCount: contactsCount || 0,
      dealsCount: dealsCount || 0,
      lastSyncedAt: integ?.last_synced_at || null,
      lastError: integ?.last_error || null,
    });
  } catch (err) {
    console.error("[integrations] hubspot stats error:", (err as Error).message);
    res.status(500).json({ error: "Failed to fetch HubSpot stats" });
  }
});

// Wave HubSpot — contexte par contact (fiche dans le panneau "Contexte HubSpot").
// Retourne le contact enrichi (job/lifecycle/owner/last interaction) + ses deals
// (joints exactement par contact_external_id). 404 si non trouvé.
type CrmContactRow = {
  external_id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  phone: string | null;
  raw: Record<string, string | null> | null;
  last_synced_at: string;
};
type CrmDealRow = {
  external_id: string;
  title: string | null;
  amount: number | null;
  currency: string | null;
  stage: string | null;
  status: string | null;
  raw: Record<string, string | null> | null;
};
router.get("/integrations/hubspot/contact-context", requireAuth, async (req, res): Promise<void> => {
  try {
    const email = String(req.query.email || "").trim().toLowerCase();
    if (!email) {
      res.status(400).json({ error: "email required" });
      return;
    }
    const { data: contactData } = await supabaseAdmin
      .from("crm_contacts")
      .select("external_id, email, first_name, last_name, company, phone, raw, last_synced_at")
      .eq("user_id", req.userId!)
      .eq("provider", "hubspot")
      .ilike("email", email)
      .maybeSingle();
    if (!contactData) {
      res.status(404).json({ error: "contact not found" });
      return;
    }
    const contact = contactData as CrmContactRow;
    const raw = contact.raw || {};
    const { data: dealsData } = await supabaseAdmin
      .from("crm_deals")
      .select("external_id, title, amount, currency, stage, status, raw")
      .eq("user_id", req.userId!)
      .eq("provider", "hubspot")
      .eq("contact_external_id", contact.external_id);
    const deals = ((dealsData || []) as CrmDealRow[]).map((d) => ({
      externalId: d.external_id,
      title: d.title,
      amount: d.amount,
      currency: d.currency,
      stage: d.stage,
      status: d.status,
      closeDate: (d.raw && (d.raw["closedate"] as string | null)) || null,
    }));
    res.json({
      contact: {
        externalId: contact.external_id,
        email: contact.email,
        firstName: contact.first_name,
        lastName: contact.last_name,
        company: contact.company,
        phone: contact.phone,
        jobTitle: (raw["jobtitle"] as string | null) || null,
        lifecycleStage: (raw["lifecyclestage"] as string | null) || null,
        leadStatus: (raw["hs_lead_status"] as string | null) || null,
        ownerId: (raw["hubspot_owner_id"] as string | null) || null,
        lastContactedAt: (raw["notes_last_contacted"] as string | null) || null,
        lastSyncedAt: contact.last_synced_at,
      },
      deals,
    });
  } catch (err) {
    console.error("[integrations] hubspot contact-context error:", (err as Error).message);
    res.status(500).json({ error: "Failed to fetch HubSpot context" });
  }
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

// ============== Wave HubSpot — Cockpit Orientation 3 ==============
// Endpoints d'action déclenchés par les boutons du panneau "Contexte HubSpot" :
// logger l'email, créer un deal préfilled, créer une tâche, faire avancer la
// phase d'un deal, changer le lifecycle/lead status du contact.
// Tous : 404 si le contact n'est pas dans le cache crm_contacts (sync manquante).

// Résout + valide l'ID externe HubSpot à partir d'un email OU d'un externalId
// fourni par le client. Dans TOUS les cas, on confirme via crm_contacts que cet
// externalId appartient bien au user courant (filtre user_id+provider). Sans
// cette validation, un client malveillant pourrait passer un externalId d'un
// autre tenant et déclencher des actions HubSpot dans le compte connecté.
async function resolveContactExternalId(
  userId: string,
  emailParam: string | undefined,
  contactExternalIdParam: string | undefined,
): Promise<{ id: string } | { error: string; status: number }> {
  const externalId = String(contactExternalIdParam || "").trim();
  const email = String(emailParam || "").trim().toLowerCase();
  if (!externalId && !email) {
    return { error: "contactEmail or contactExternalId required", status: 400 };
  }
  let query = supabaseAdmin
    .from("crm_contacts")
    .select("external_id")
    .eq("user_id", userId)
    .eq("provider", "hubspot");
  if (externalId) {
    query = query.eq("external_id", externalId);
  } else {
    query = query.ilike("email", email);
  }
  const { data } = await query.maybeSingle();
  const id = (data as { external_id?: string } | null)?.external_id;
  if (!id) return { error: "Contact not found in HubSpot cache", status: 404 };
  return { id };
}

// Idem pour les deals : valide qu'un deal externalId appartient bien à l'user.
async function assertDealOwnedByUser(userId: string, dealExternalId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("crm_deals")
    .select("external_id")
    .eq("user_id", userId)
    .eq("provider", "hubspot")
    .eq("external_id", dealExternalId)
    .maybeSingle();
  return !!data;
}

router.post("/integrations/hubspot/log-email", requireAuth, async (req, res): Promise<void> => {
  try {
    const { contactEmail, contactExternalId, emailId, subject, body, occurredAt } = req.body || {};
    const resolved = await resolveContactExternalId(req.userId!, contactEmail, contactExternalId);
    if ("error" in resolved) {
      res.status(resolved.status).json({ error: resolved.error });
      return;
    }

    // Idempotence atomique : on s'appuie sur l'index unique
    // crm_email_logs_user_provider_email_uniq (user_id, provider, email_id)
    // posé dans 2026_04_24_v4_platform_ecosystem.sql L87. On tente d'insérer
    // une ligne "claim" AVANT l'appel HubSpot. Si conflit → déjà loggué, on
    // court-circuite. Sinon on appelle HubSpot puis on met à jour la ligne avec
    // l'external_log_id réel. Élimine la race condition entre check et insert.
    const hasEmailId = typeof emailId === "number" && Number.isFinite(emailId);
    if (hasEmailId) {
      const { data: claim, error: claimErr } = await supabaseAdmin
        .from("crm_email_logs")
        .insert({
          user_id: req.userId!,
          provider: "hubspot",
          email_id: emailId,
          external_log_id: null,
        })
        .select("id")
        .maybeSingle();
      if (claimErr) {
        // Code Postgres 23505 = unique_violation. Toute autre erreur remonte.
        if ((claimErr as { code?: string }).code === "23505") {
          res.json({ ok: true, alreadyLogged: true });
          return;
        }
        console.error("[integrations] hubspot log-email claim error:", claimErr);
        res.status(500).json({ error: "Failed to claim log row" });
        return;
      }
      const claimId = (claim as { id?: number } | null)?.id;
      const result = await logEmailEngagement(
        req.userId!,
        resolved.id,
        String(subject || ""),
        String(body || ""),
        typeof occurredAt === "string" ? occurredAt : null,
      );
      if (!result.ok) {
        // Rollback du claim pour permettre un retry ultérieur.
        if (claimId) await supabaseAdmin.from("crm_email_logs").delete().eq("id", claimId);
        res.status(502).json({ error: result.error });
        return;
      }
      if (claimId && result.data?.id) {
        await supabaseAdmin.from("crm_email_logs").update({ external_log_id: result.data.id }).eq("id", claimId);
      }
      res.json({ ok: true, id: result.data?.id || null });
      return;
    }

    // Pas d'emailId → log à la volée, sans idempotence (action manuelle libre).
    const result = await logEmailEngagement(
      req.userId!,
      resolved.id,
      String(subject || ""),
      String(body || ""),
      typeof occurredAt === "string" ? occurredAt : null,
    );
    if (!result.ok) {
      res.status(502).json({ error: result.error });
      return;
    }
    res.json({ ok: true, id: result.data?.id || null });
  } catch (err) {
    console.error("[integrations] hubspot log-email error:", (err as Error).message);
    res.status(500).json({ error: "Failed to log email" });
  }
});

router.post("/integrations/hubspot/create-deal", requireAuth, async (req, res): Promise<void> => {
  try {
    const { contactEmail, contactExternalId, dealname, amount, pipeline, dealstage, closedate } = req.body || {};
    if (!dealname || typeof dealname !== "string" || !dealname.trim()) {
      res.status(400).json({ error: "dealname required" });
      return;
    }
    const resolved = await resolveContactExternalId(req.userId!, contactEmail, contactExternalId);
    if ("error" in resolved) {
      res.status(resolved.status).json({ error: resolved.error });
      return;
    }
    const amountNum = amount != null && amount !== "" ? Number(amount) : null;
    const result = await createHubspotDeal(req.userId!, resolved.id, {
      dealname: dealname.trim().slice(0, 200),
      amount: amountNum != null && Number.isFinite(amountNum) ? amountNum : null,
      pipeline: typeof pipeline === "string" ? pipeline : null,
      dealstage: typeof dealstage === "string" ? dealstage : null,
      closedate: typeof closedate === "string" ? closedate : null,
    });
    if (!result.ok) {
      // Log détaillé pour diagnostiquer côté serveur (l'erreur HubSpot
      // contient le code + le body, ex. scope manquant, validation
      // échouée, pipeline inexistant, etc.).
      console.error("[integrations] hubspot create-deal failed:", {
        userId: req.userId,
        hubspotStatus: result.status ?? null,
        hubspotError: result.error,
        payload: { dealname: dealname.slice(0, 80), amount: amountNum, pipeline, dealstage, closedate },
      });
      // Hint utilisateur : 403 = scope manquant (l'utilisateur a connecté
      // HubSpot avant l'extension des scopes) → suggérer reconnexion.
      // 401 = token expiré/révoqué → suggérer reconnexion.
      // 400 = validation HubSpot (mauvais pipeline/stage) → afficher le
      // message brut pour que l'utilisateur corrige.
      const status = result.status ?? 0;
      const needsReconnect = status === 401 || status === 403;
      const hint = needsReconnect
        ? "reconnect_hubspot"
        : status === 400
          ? "validation"
          : "upstream";
      res.status(502).json({ error: result.error, hint, hubspotStatus: status });
      return;
    }
    res.json({ ok: true, id: result.data?.id || null });
  } catch (err) {
    console.error("[integrations] hubspot create-deal error:", (err as Error).message);
    res.status(500).json({ error: "Failed to create deal" });
  }
});

router.post("/integrations/hubspot/create-task", requireAuth, async (req, res): Promise<void> => {
  try {
    const { contactEmail, contactExternalId, subject, body, dueAt, priority } = req.body || {};
    if (!subject || typeof subject !== "string" || !subject.trim()) {
      res.status(400).json({ error: "subject required" });
      return;
    }
    const resolved = await resolveContactExternalId(req.userId!, contactEmail, contactExternalId);
    if ("error" in resolved) {
      res.status(resolved.status).json({ error: resolved.error });
      return;
    }
    const validPriority = priority === "LOW" || priority === "MEDIUM" || priority === "HIGH" ? priority : null;
    const result = await createHubspotTask(req.userId!, resolved.id, {
      subject: subject.trim().slice(0, 200),
      body: typeof body === "string" ? body.slice(0, 4000) : null,
      dueAt: typeof dueAt === "string" ? dueAt : null,
      priority: validPriority,
    });
    if (!result.ok) {
      res.status(502).json({ error: result.error });
      return;
    }
    res.json({ ok: true, id: result.data?.id || null });
  } catch (err) {
    console.error("[integrations] hubspot create-task error:", (err as Error).message);
    res.status(500).json({ error: "Failed to create task" });
  }
});

router.get("/integrations/hubspot/pipelines", requireAuth, async (req, res): Promise<void> => {
  try {
    const result = await getHubspotDealPipelines(req.userId!);
    if (!result.ok) {
      res.status(502).json({ error: result.error });
      return;
    }
    res.json(result.data);
  } catch (err) {
    console.error("[integrations] hubspot pipelines error:", (err as Error).message);
    res.status(500).json({ error: "Failed to fetch pipelines" });
  }
});

router.patch("/integrations/hubspot/deals/:dealExternalId", requireAuth, async (req, res): Promise<void> => {
  try {
    const dealExternalId = String(req.params.dealExternalId ?? "").trim();
    if (!dealExternalId) {
      res.status(400).json({ error: "dealExternalId required" });
      return;
    }
    const { dealstage } = req.body || {};
    if (!dealstage || typeof dealstage !== "string") {
      res.status(400).json({ error: "dealstage required" });
      return;
    }
    // Garde-fou multi-tenant : on ne PATCH que des deals présents dans le cache
    // de l'utilisateur. Empêche un client malveillant de modifier des deals
    // arbitraires dans le HubSpot du tenant connecté.
    const owned = await assertDealOwnedByUser(req.userId!, dealExternalId);
    if (!owned) {
      res.status(404).json({ error: "Deal not found in HubSpot cache" });
      return;
    }
    const result = await updateHubspotDealStage(req.userId!, dealExternalId, dealstage);
    if (!result.ok) {
      res.status(502).json({ error: result.error });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("[integrations] hubspot patch deal error:", (err as Error).message);
    res.status(500).json({ error: "Failed to update deal" });
  }
});

router.patch("/integrations/hubspot/contacts/:contactExternalId", requireAuth, async (req, res): Promise<void> => {
  try {
    const contactExternalId = String(req.params.contactExternalId ?? "").trim();
    if (!contactExternalId) {
      res.status(400).json({ error: "contactExternalId required" });
      return;
    }
    // Garde-fou multi-tenant : valide que ce contact externe appartient à l'user
    // (présent dans crm_contacts) avant tout PATCH HubSpot.
    const owned = await resolveContactExternalId(req.userId!, undefined, contactExternalId);
    if ("error" in owned) {
      res.status(owned.status).json({ error: owned.error });
      return;
    }
    const { lifecycleStage, leadStatus } = req.body || {};
    const result = await updateHubspotContactProps(req.userId!, contactExternalId, {
      lifecyclestage: typeof lifecycleStage === "string" ? lifecycleStage : null,
      hs_lead_status: typeof leadStatus === "string" ? leadStatus : null,
    });
    if (!result.ok) {
      res.status(result.error === "no properties to update" ? 400 : 502).json({ error: result.error });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("[integrations] hubspot patch contact error:", (err as Error).message);
    res.status(500).json({ error: "Failed to update contact" });
  }
});

// ============== Pipedrive ==============
router.get("/integrations/pipedrive/connect", requireAuth, async (req, res): Promise<void> => {
  if (!PIPEDRIVE_CLIENT_ID) {
    res.status(400).json({ error: "Pipedrive integration not configured" });
    return;
  }
  // CRM accessible a tous les plans (Free, Solo, Pro, Business, Plus)
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

// ============== Wave Pipedrive — Cockpit (parité HubSpot) ==============
// Endpoints d'action déclenchés par les boutons du panneau "Contexte Pipedrive" :
// logger l'email, créer un deal préfilled, créer une tâche (activité type=task),
// faire avancer la phase d'un deal, mettre à jour le label du contact.
// Tous : 404 si le contact n'est pas dans le cache crm_contacts (sync manquante).

async function resolvePipedrivePersonId(
  userId: string,
  emailParam: string | undefined,
  contactExternalIdParam: string | undefined,
): Promise<{ id: number; externalId: string } | { error: string; status: number }> {
  const externalId = String(contactExternalIdParam || "").trim();
  const email = String(emailParam || "").trim().toLowerCase();
  if (!externalId && !email) {
    return { error: "contactEmail or contactExternalId required", status: 400 };
  }
  let query = supabaseAdmin
    .from("crm_contacts")
    .select("external_id")
    .eq("user_id", userId)
    .eq("provider", "pipedrive");
  if (externalId) {
    query = query.eq("external_id", externalId);
  } else {
    query = query.ilike("email", email);
  }
  const { data } = await query.maybeSingle();
  const id = (data as { external_id?: string } | null)?.external_id;
  if (!id) return { error: "Contact not found in Pipedrive cache", status: 404 };
  const num = Number(id);
  if (!Number.isFinite(num)) return { error: "Invalid Pipedrive person id", status: 500 };
  return { id: num, externalId: id };
}

async function assertPipedriveDealOwnedByUser(userId: string, dealExternalId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("crm_deals")
    .select("external_id")
    .eq("user_id", userId)
    .eq("provider", "pipedrive")
    .eq("external_id", dealExternalId)
    .maybeSingle();
  return !!data;
}

// Mappe une PipedriveResult en échec vers une réponse HTTP avec le bon hint.
// Garantit la parité reconnect_pipedrive sur TOUTES les routes (et pas
// seulement create-deal) : si l'access_token est invalide ou si le scope
// deals:full n'est pas autorisé, le front affiche le toast "reconnecter".
function sendPipedriveError(
  res: import("express").Response,
  result: { ok: false; error: string; status?: number },
): void {
  const status = result.status ?? 0;
  const needsReconnect = status === 401 || status === 403;
  const hint = needsReconnect ? "reconnect_pipedrive" : status === 400 ? "validation" : "upstream";
  res.status(502).json({ error: result.error, hint, pipedriveStatus: status });
}

router.get("/integrations/pipedrive/contact-context", requireAuth, async (req, res): Promise<void> => {
  try {
    const email = String(req.query.email || "").trim().toLowerCase();
    if (!email) {
      res.status(400).json({ error: "email required" });
      return;
    }
    const ctx = await getPipedriveContactContext(req.userId!, email);
    if (!ctx) {
      res.status(404).json({ error: "contact not found" });
      return;
    }
    res.json(ctx);
  } catch (err) {
    console.error("[integrations] pipedrive contact-context error:", (err as Error).message);
    res.status(500).json({ error: "Failed to fetch Pipedrive context" });
  }
});

router.post("/integrations/pipedrive/log-email", requireAuth, async (req, res): Promise<void> => {
  try {
    const { contactEmail, contactExternalId, emailId, subject, body, occurredAt } = req.body || {};
    const resolved = await resolvePipedrivePersonId(req.userId!, contactEmail, contactExternalId);
    if ("error" in resolved) {
      res.status(resolved.status).json({ error: resolved.error });
      return;
    }
    const hasEmailId = typeof emailId === "number" && Number.isFinite(emailId);
    if (hasEmailId) {
      // Idempotence : on tente d'insérer un row claim crm_email_logs avant
      // d'appeler Pipedrive. Si l'INSERT échoue avec 23505 (unique violation),
      // l'email a déjà été loggé → on retourne alreadyLogged sans rappeler
      // l'API. Sinon, on délègue à logEmailEngagementPipedrive ; si l'appel
      // échoue, on supprime le row claim pour permettre une nouvelle tentative.
      const { data: claim, error: claimErr } = await supabaseAdmin
        .from("crm_email_logs")
        .insert({ user_id: req.userId!, provider: "pipedrive", email_id: emailId, external_log_id: null })
        .select("id")
        .maybeSingle();
      if (claimErr) {
        if ((claimErr as { code?: string }).code === "23505") {
          res.json({ ok: true, alreadyLogged: true });
          return;
        }
        console.error("[integrations] pipedrive log-email claim error:", claimErr);
        res.status(500).json({ error: "Failed to claim log row" });
        return;
      }
      const claimId = (claim as { id?: number } | null)?.id;
      const result = await logEmailEngagementPipedrive(
        req.userId!,
        resolved.id,
        String(subject || ""),
        String(body || ""),
        typeof occurredAt === "string" ? occurredAt : null,
      );
      if (!result.ok) {
        if (claimId) await supabaseAdmin.from("crm_email_logs").delete().eq("id", claimId);
        sendPipedriveError(res, result);
        return;
      }
      if (claimId && result.data?.id) {
        await supabaseAdmin
          .from("crm_email_logs")
          .update({ external_log_id: String(result.data.id) })
          .eq("id", claimId);
      }
      res.json({ ok: true, id: result.data?.id ?? null });
      return;
    }
    const result = await logEmailEngagementPipedrive(
      req.userId!,
      resolved.id,
      String(subject || ""),
      String(body || ""),
      typeof occurredAt === "string" ? occurredAt : null,
    );
    if (!result.ok) {
      sendPipedriveError(res, result);
      return;
    }
    res.json({ ok: true, id: result.data?.id ?? null });
  } catch (err) {
    console.error("[integrations] pipedrive log-email error:", (err as Error).message);
    res.status(500).json({ error: "Failed to log email" });
  }
});

router.post("/integrations/pipedrive/create-deal", requireAuth, async (req, res): Promise<void> => {
  try {
    const { contactEmail, contactExternalId, dealname, amount, dealstage, closedate, currency } = req.body || {};
    if (!dealname || typeof dealname !== "string" || !dealname.trim()) {
      res.status(400).json({ error: "dealname required" });
      return;
    }
    const resolved = await resolvePipedrivePersonId(req.userId!, contactEmail, contactExternalId);
    if ("error" in resolved) {
      res.status(resolved.status).json({ error: resolved.error });
      return;
    }
    const amountNum = amount != null && amount !== "" ? Number(amount) : null;
    const result = await createPipedriveDeal(req.userId!, resolved.id, {
      title: dealname.trim().slice(0, 200),
      value: amountNum != null && Number.isFinite(amountNum) ? amountNum : null,
      currency: typeof currency === "string" ? currency : null,
      stageId: typeof dealstage === "string" ? dealstage : null,
      expectedCloseDate: typeof closedate === "string" ? closedate : null,
    });
    if (!result.ok) {
      console.error("[integrations] pipedrive create-deal failed:", {
        userId: req.userId,
        status: result.status,
        error: result.error,
      });
      sendPipedriveError(res, result);
      return;
    }
    res.json({ ok: true, id: result.data?.id ?? null });
  } catch (err) {
    console.error("[integrations] pipedrive create-deal error:", (err as Error).message);
    res.status(500).json({ error: "Failed to create deal" });
  }
});

router.post("/integrations/pipedrive/create-task", requireAuth, async (req, res): Promise<void> => {
  try {
    const { contactEmail, contactExternalId, subject, body, dueAt } = req.body || {};
    if (!subject || typeof subject !== "string" || !subject.trim()) {
      res.status(400).json({ error: "subject required" });
      return;
    }
    const resolved = await resolvePipedrivePersonId(req.userId!, contactEmail, contactExternalId);
    if ("error" in resolved) {
      res.status(resolved.status).json({ error: resolved.error });
      return;
    }
    const result = await createPipedriveTask(req.userId!, resolved.id, {
      subject: subject.trim().slice(0, 200),
      body: typeof body === "string" ? body.slice(0, 4000) : null,
      dueAt: typeof dueAt === "string" ? dueAt : null,
    });
    if (!result.ok) {
      sendPipedriveError(res, result);
      return;
    }
    res.json({ ok: true, id: result.data?.id ?? null });
  } catch (err) {
    console.error("[integrations] pipedrive create-task error:", (err as Error).message);
    res.status(500).json({ error: "Failed to create task" });
  }
});

router.get("/integrations/pipedrive/pipelines", requireAuth, async (req, res): Promise<void> => {
  try {
    const result = await getPipedrivePipelines(req.userId!);
    if (!result.ok) {
      sendPipedriveError(res, result);
      return;
    }
    res.json(result.data);
  } catch (err) {
    console.error("[integrations] pipedrive pipelines error:", (err as Error).message);
    res.status(500).json({ error: "Failed to fetch pipelines" });
  }
});

router.patch("/integrations/pipedrive/deals/:dealExternalId", requireAuth, async (req, res): Promise<void> => {
  try {
    const dealExternalId = String(req.params.dealExternalId ?? "").trim();
    if (!dealExternalId) {
      res.status(400).json({ error: "dealExternalId required" });
      return;
    }
    const { dealstage } = req.body || {};
    if (!dealstage || typeof dealstage !== "string") {
      res.status(400).json({ error: "dealstage required" });
      return;
    }
    const owned = await assertPipedriveDealOwnedByUser(req.userId!, dealExternalId);
    if (!owned) {
      res.status(404).json({ error: "Deal not found in Pipedrive cache" });
      return;
    }
    const result = await updatePipedriveDealStage(req.userId!, dealExternalId, dealstage);
    if (!result.ok) {
      sendPipedriveError(res, result);
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("[integrations] pipedrive patch deal error:", (err as Error).message);
    res.status(500).json({ error: "Failed to update deal" });
  }
});

router.patch("/integrations/pipedrive/contacts/:contactExternalId", requireAuth, async (req, res): Promise<void> => {
  try {
    const contactExternalId = String(req.params.contactExternalId ?? "").trim();
    if (!contactExternalId) {
      res.status(400).json({ error: "contactExternalId required" });
      return;
    }
    const owned = await resolvePipedrivePersonId(req.userId!, undefined, contactExternalId);
    if ("error" in owned) {
      res.status(owned.status).json({ error: owned.error });
      return;
    }
    const { label } = req.body || {};
    if (label === undefined) {
      res.status(400).json({ error: "no properties to update" });
      return;
    }
    const result = await updatePipedrivePerson(req.userId!, contactExternalId, {
      label: typeof label === "string" ? label : null,
    });
    if (!result.ok) {
      if (result.error === "no properties to update") {
        res.status(400).json({ error: result.error });
      } else {
        sendPipedriveError(res, result);
      }
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("[integrations] pipedrive patch contact error:", (err as Error).message);
    res.status(500).json({ error: "Failed to update contact" });
  }
});

// ============== Wave Salesforce — OAuth + Cockpit (parité HubSpot/Pipedrive) ==============
// Spécificité majeure : choix Production vs Sandbox au moment du connect.
// Le flag `sandbox` est porté par le state HMAC (createSignedStateWithFlags)
// pour que le callback sache vers quel host (login.salesforce.com OU
// test.salesforce.com) faire l'échange du code et persister `isSandbox` dans
// settings. Ce flag est ensuite réutilisé par le service pour les refresh.

router.get("/integrations/salesforce/connect", requireAuth, async (req, res): Promise<void> => {
  if (!SALESFORCE_CLIENT_ID) {
    res.status(400).json({ error: "Salesforce integration not configured" });
    return;
  }
  // CRM accessible a tous les plans (parité HubSpot/Pipedrive : trancher
  // côté Salesforce ne pénaliserait pas les ETI cible).
  const sandbox = String(req.query.sandbox || "").toLowerCase() === "true";
  const state = createSignedStateWithFlags(req.userId!, { sandbox });
  const params = new URLSearchParams({
    response_type: "code",
    client_id: SALESFORCE_CLIENT_ID,
    redirect_uri: getRedirectUri("salesforce"),
    state,
    scope: SALESFORCE_SCOPES.join(" "),
  });
  const host = sandbox ? "https://test.salesforce.com" : "https://login.salesforce.com";
  res.json({ url: `${host}/services/oauth2/authorize?${params}` });
});

router.get("/integrations/salesforce/callback", async (req, res): Promise<void> => {
  try {
    const { code, state } = req.query;
    if (!code || !state) {
      res.status(400).send("Missing code or state");
      return;
    }
    const verified = verifySignedStateWithFlags(state as string);
    if (!verified) {
      res.status(400).send("Invalid or expired state");
      return;
    }
    const userId = verified.userId;
    const isSandbox = verified.flags?.sandbox === true;

    const tokens = await exchangeSalesforceCode(code as string, getRedirectUri("salesforce"), isSandbox);
    if (!tokens) {
      res.status(400).send("Salesforce token exchange failed");
      return;
    }

    // Récupère le nom de l'org pour l'afficher dans l'UI (best-effort).
    let workspaceName = isSandbox ? "Salesforce Sandbox" : "Salesforce";
    try {
      const orgRes = await fetch(
        `${tokens.instanceUrl.replace(/\/$/, "")}/services/data/v59.0/query?q=${encodeURIComponent("SELECT Name FROM Organization LIMIT 1")}`,
        { headers: { Authorization: `Bearer ${tokens.accessToken}` } },
      );
      if (orgRes.ok) {
        const json = (await orgRes.json()) as { records?: Array<{ Name?: string }> };
        const orgName = json.records?.[0]?.Name;
        if (orgName) workspaceName = isSandbox ? `${orgName} (Sandbox)` : orgName;
      }
    } catch {
      // garde le nom par défaut
    }

    await supabaseAdmin.from("integrations").upsert(
      {
        user_id: userId,
        provider: "salesforce",
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        expires_at: tokens.expiresAt,
        scopes: SALESFORCE_SCOPES.join(" "),
        workspace_name: workspaceName,
        settings: { instanceUrl: tokens.instanceUrl, isSandbox },
        enabled: true,
      },
      { onConflict: "user_id,provider" },
    );

    syncSalesforceContacts(userId, 50).catch(() => {});

    const frontendUrl = getFrontendUrl();
    res.send(`<html><body style="font-family:system-ui;padding:24px;text-align:center"><script>
      try { window.opener?.postMessage({ type: "integration-connected", provider: "salesforce" }, "*"); } catch (e) {}
      if (window.opener) { window.close(); }
      setTimeout(function(){ window.location.href = "${frontendUrl}/dashboard/parametres/crm?integration=salesforce&status=success"; }, 600);
    </script><p>Salesforce connecté ! Vous pouvez fermer cette fenêtre.</p></body></html>`);
  } catch (err) {
    console.error("[integrations] Salesforce callback error:", (err as Error).message);
    res.status(500).send("Erreur de connexion Salesforce");
  }
});

router.post("/integrations/salesforce/sync", requireAuth, async (req, res): Promise<void> => {
  const contacts = await syncSalesforceContacts(req.userId!, 200);
  const deals = await syncSalesforceDeals(req.userId!, 200);
  res.json({ contacts, deals });
});

async function resolveSalesforceContactId(
  userId: string,
  emailParam: string | undefined,
  contactExternalIdParam: string | undefined,
): Promise<{ id: string } | { error: string; status: number }> {
  const externalId = String(contactExternalIdParam || "").trim();
  const email = String(emailParam || "").trim().toLowerCase();
  if (!externalId && !email) {
    return { error: "contactEmail or contactExternalId required", status: 400 };
  }
  let query = supabaseAdmin
    .from("crm_contacts")
    .select("external_id")
    .eq("user_id", userId)
    .eq("provider", "salesforce");
  if (externalId) {
    query = query.eq("external_id", externalId);
  } else {
    query = query.ilike("email", email);
  }
  const { data } = await query.maybeSingle();
  const id = (data as { external_id?: string } | null)?.external_id;
  if (!id) return { error: "Contact not found in Salesforce cache", status: 404 };
  return { id };
}

async function assertSalesforceOpportunityOwnedByUser(userId: string, externalId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("crm_deals")
    .select("external_id")
    .eq("user_id", userId)
    .eq("provider", "salesforce")
    .eq("external_id", externalId)
    .maybeSingle();
  return !!data;
}

// Mappe une SfResult en échec vers une réponse HTTP avec le bon hint, parité
// avec sendPipedriveError : 401/403 → reconnect_salesforce, 400 → validation.
function sendSalesforceError(
  res: import("express").Response,
  result: { ok: false; error: string; status?: number },
): void {
  const status = result.status ?? 0;
  const needsReconnect = status === 401 || status === 403;
  const hint = needsReconnect ? "reconnect_salesforce" : status === 400 ? "validation" : "upstream";
  res.status(502).json({ error: result.error, hint, salesforceStatus: status });
}

router.get("/integrations/salesforce/contact-context", requireAuth, async (req, res): Promise<void> => {
  try {
    const email = String(req.query.email || "").trim().toLowerCase();
    if (!email) {
      res.status(400).json({ error: "email required" });
      return;
    }
    const ctx = await getSalesforceContactContext(req.userId!, email);
    if (!ctx) {
      res.status(404).json({ error: "contact not found" });
      return;
    }
    res.json(ctx);
  } catch (err) {
    console.error("[integrations] salesforce contact-context error:", (err as Error).message);
    res.status(500).json({ error: "Failed to fetch Salesforce context" });
  }
});

router.post("/integrations/salesforce/log-email", requireAuth, async (req, res): Promise<void> => {
  try {
    const { contactEmail, contactExternalId, emailId, subject, body, occurredAt } = req.body || {};
    const resolved = await resolveSalesforceContactId(req.userId!, contactEmail, contactExternalId);
    if ("error" in resolved) {
      res.status(resolved.status).json({ error: resolved.error });
      return;
    }
    const hasEmailId = typeof emailId === "number" && Number.isFinite(emailId);
    if (hasEmailId) {
      // Idempotence : claim row crm_email_logs avant l'appel API. Si conflit
      // unique (23505) → déjà loggé. Sinon, en cas d'échec API on supprime le
      // claim pour permettre une nouvelle tentative.
      const { data: claim, error: claimErr } = await supabaseAdmin
        .from("crm_email_logs")
        .insert({ user_id: req.userId!, provider: "salesforce", email_id: emailId, external_log_id: null })
        .select("id")
        .maybeSingle();
      if (claimErr) {
        if ((claimErr as { code?: string }).code === "23505") {
          res.json({ ok: true, alreadyLogged: true });
          return;
        }
        console.error("[integrations] salesforce log-email claim error:", claimErr);
        res.status(500).json({ error: "Failed to claim log row" });
        return;
      }
      const claimId = (claim as { id?: number } | null)?.id;
      const result = await logEmailEngagementSalesforce(
        req.userId!,
        resolved.id,
        String(subject || ""),
        String(body || ""),
        typeof occurredAt === "string" ? occurredAt : null,
      );
      if (!result.ok) {
        if (claimId) await supabaseAdmin.from("crm_email_logs").delete().eq("id", claimId);
        sendSalesforceError(res, result);
        return;
      }
      if (claimId && result.data?.id) {
        await supabaseAdmin
          .from("crm_email_logs")
          .update({ external_log_id: String(result.data.id) })
          .eq("id", claimId);
      }
      res.json({ ok: true, id: result.data?.id ?? null });
      return;
    }
    const result = await logEmailEngagementSalesforce(
      req.userId!,
      resolved.id,
      String(subject || ""),
      String(body || ""),
      typeof occurredAt === "string" ? occurredAt : null,
    );
    if (!result.ok) {
      sendSalesforceError(res, result);
      return;
    }
    res.json({ ok: true, id: result.data?.id ?? null });
  } catch (err) {
    console.error("[integrations] salesforce log-email error:", (err as Error).message);
    res.status(500).json({ error: "Failed to log email" });
  }
});

router.post("/integrations/salesforce/create-deal", requireAuth, async (req, res): Promise<void> => {
  try {
    const { contactEmail, contactExternalId, dealname, amount, currency, dealstage, closedate } = req.body || {};
    if (!dealname || typeof dealname !== "string" || !dealname.trim()) {
      res.status(400).json({ error: "dealname required" });
      return;
    }
    const resolved = await resolveSalesforceContactId(req.userId!, contactEmail, contactExternalId);
    if ("error" in resolved) {
      res.status(resolved.status).json({ error: resolved.error });
      return;
    }
    const amountNum = amount != null && amount !== "" ? Number(amount) : null;
    const currencyIso = typeof currency === "string" && /^[A-Z]{3}$/.test(currency.toUpperCase())
      ? currency.toUpperCase()
      : null;
    const result = await createSalesforceOpportunity(req.userId!, resolved.id, {
      name: dealname.trim().slice(0, 120),
      amount: amountNum != null && Number.isFinite(amountNum) ? amountNum : null,
      currency: currencyIso,
      stageName: typeof dealstage === "string" ? dealstage : null,
      closeDate: typeof closedate === "string" ? closedate : null,
    });
    if (!result.ok) {
      console.error("[integrations] salesforce create-deal failed:", {
        userId: req.userId,
        status: result.status,
        error: result.error,
      });
      sendSalesforceError(res, result);
      return;
    }
    res.json({ ok: true, id: result.data?.id ?? null });
  } catch (err) {
    console.error("[integrations] salesforce create-deal error:", (err as Error).message);
    res.status(500).json({ error: "Failed to create opportunity" });
  }
});

router.post("/integrations/salesforce/create-task", requireAuth, async (req, res): Promise<void> => {
  try {
    const { contactEmail, contactExternalId, subject, body, dueAt } = req.body || {};
    if (!subject || typeof subject !== "string" || !subject.trim()) {
      res.status(400).json({ error: "subject required" });
      return;
    }
    const resolved = await resolveSalesforceContactId(req.userId!, contactEmail, contactExternalId);
    if ("error" in resolved) {
      res.status(resolved.status).json({ error: resolved.error });
      return;
    }
    const result = await createSalesforceTask(req.userId!, resolved.id, {
      subject: subject.trim().slice(0, 255),
      body: typeof body === "string" ? body.slice(0, 32000) : null,
      dueAt: typeof dueAt === "string" ? dueAt : null,
    });
    if (!result.ok) {
      sendSalesforceError(res, result);
      return;
    }
    res.json({ ok: true, id: result.data?.id ?? null });
  } catch (err) {
    console.error("[integrations] salesforce create-task error:", (err as Error).message);
    res.status(500).json({ error: "Failed to create task" });
  }
});

router.get("/integrations/salesforce/stats", requireAuth, async (req, res): Promise<void> => {
  try {
    const [{ data: integ }, { count: contactsCount }, { count: dealsCount }] = await Promise.all([
      supabaseAdmin
        .from("integrations")
        .select("last_synced_at, last_error, enabled")
        .eq("user_id", req.userId!)
        .eq("provider", "salesforce")
        .maybeSingle(),
      supabaseAdmin
        .from("crm_contacts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", req.userId!)
        .eq("provider", "salesforce"),
      supabaseAdmin
        .from("crm_deals")
        .select("id", { count: "exact", head: true })
        .eq("user_id", req.userId!)
        .eq("provider", "salesforce"),
    ]);
    res.json({
      connected: !!integ?.enabled,
      contactsCount: contactsCount || 0,
      dealsCount: dealsCount || 0,
      lastSyncedAt: integ?.last_synced_at || null,
      lastError: integ?.last_error || null,
    });
  } catch (err) {
    console.error("[integrations] salesforce stats error:", (err as Error).message);
    res.status(500).json({ error: "Failed to fetch Salesforce stats" });
  }
});

router.get("/integrations/salesforce/pipelines", requireAuth, async (req, res): Promise<void> => {
  try {
    const result = await getSalesforcePipelines(req.userId!);
    if (!result.ok) {
      sendSalesforceError(res, result);
      return;
    }
    res.json(result.data);
  } catch (err) {
    console.error("[integrations] salesforce pipelines error:", (err as Error).message);
    res.status(500).json({ error: "Failed to fetch pipelines" });
  }
});

router.patch("/integrations/salesforce/deals/:dealExternalId", requireAuth, async (req, res): Promise<void> => {
  try {
    const dealExternalId = String(req.params.dealExternalId ?? "").trim();
    if (!dealExternalId) {
      res.status(400).json({ error: "dealExternalId required" });
      return;
    }
    const { dealstage } = req.body || {};
    if (!dealstage || typeof dealstage !== "string") {
      res.status(400).json({ error: "dealstage required" });
      return;
    }
    const owned = await assertSalesforceOpportunityOwnedByUser(req.userId!, dealExternalId);
    if (!owned) {
      res.status(404).json({ error: "Opportunity not found in Salesforce cache" });
      return;
    }
    const result = await updateSalesforceOpportunityStage(req.userId!, dealExternalId, dealstage);
    if (!result.ok) {
      sendSalesforceError(res, result);
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("[integrations] salesforce patch deal error:", (err as Error).message);
    res.status(500).json({ error: "Failed to update opportunity" });
  }
});

router.patch("/integrations/salesforce/contacts/:contactExternalId", requireAuth, async (req, res): Promise<void> => {
  try {
    const contactExternalId = String(req.params.contactExternalId ?? "").trim();
    if (!contactExternalId) {
      res.status(400).json({ error: "contactExternalId required" });
      return;
    }
    const owned = await resolveSalesforceContactId(req.userId!, undefined, contactExternalId);
    if ("error" in owned) {
      res.status(owned.status).json({ error: owned.error });
      return;
    }
    const { description } = req.body || {};
    if (description === undefined) {
      res.status(400).json({ error: "no properties to update" });
      return;
    }
    const result = await updateSalesforceContact(req.userId!, contactExternalId, {
      description: typeof description === "string" ? description : null,
    });
    if (!result.ok) {
      if (result.error === "no properties to update") {
        res.status(400).json({ error: result.error });
      } else {
        sendSalesforceError(res, result);
      }
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("[integrations] salesforce patch contact error:", (err as Error).message);
    res.status(500).json({ error: "Failed to update contact" });
  }
});

// ============================================================================
// Odoo CRM — connexion par URL + base + login + clé API (PAS d'OAuth).
// Spécificité : la route `connect` POST prend les credentials en body et
// s'authentifie immédiatement (pas de redirect, pas de popup). Si OK, la
// ligne integrations est upsertée et le front reçoit `{ok:true}` direct.
// ============================================================================

router.post("/integrations/odoo/connect", requireAuth, async (req, res): Promise<void> => {
  try {
    const isPro = await requireProPlan(req.userId!);
    if (!isPro) {
      res.status(403).json({ error: "Integration reservee au plan Pro ou superieur" });
      return;
    }
    const { url, db, login, apiKey } = req.body || {};
    const result = await connectOdoo(req.userId!, {
      url: String(url || ""),
      db: String(db || ""),
      login: String(login || ""),
      apiKey: String(apiKey || ""),
    });
    if (!result.ok) {
      res.status(400).json({ error: result.error || "Connexion Odoo refusée" });
      return;
    }
    res.json({
      ok: true,
      workspaceName: result.workspaceName ?? null,
      hasCrm: result.hasCrm === true,
    });
  } catch (err) {
    console.error("[integrations] odoo connect error:", (err as Error).message);
    res.status(500).json({ error: "Failed to connect Odoo" });
  }
});

router.post("/integrations/odoo/sync", requireAuth, async (req, res): Promise<void> => {
  const contacts = await syncOdooContacts(req.userId!, 200);
  const deals = await syncOdooDeals(req.userId!, 200);
  res.json({ contacts, deals });
});

router.delete("/integrations/odoo", requireAuth, async (req, res): Promise<void> => {
  // Override explicite avant la route générique DELETE /integrations/:provider
  // pour symétrie avec le service (cleanup éventuel + log clair).
  try {
    await disconnectOdoo(req.userId!);
    res.json({ success: true });
  } catch (err) {
    console.error("[integrations] odoo disconnect error:", (err as Error).message);
    res.status(500).json({ error: "Failed to disconnect Odoo" });
  }
});

router.get("/integrations/odoo/contact-context", requireAuth, async (req, res): Promise<void> => {
  try {
    const email = String(req.query.email || "").trim().toLowerCase();
    if (!email) {
      res.status(400).json({ error: "email required" });
      return;
    }
    const ctx = await getOdooContactContext(req.userId!, email);
    if (!ctx) {
      res.status(404).json({ error: "contact not found" });
      return;
    }
    res.json(ctx);
  } catch (err) {
    console.error("[integrations] odoo contact-context error:", (err as Error).message);
    res.status(500).json({ error: "Failed to fetch Odoo context" });
  }
});

router.get("/integrations/odoo/activity-types", requireAuth, async (req, res): Promise<void> => {
  try {
    const types = await listOdooActivityTypes(req.userId!);
    res.json({ activityTypes: types });
  } catch (err) {
    console.error("[integrations] odoo activity-types error:", (err as Error).message);
    res.status(500).json({ error: "Failed to list Odoo activity types" });
  }
});

router.post("/integrations/odoo/create-deal", requireAuth, async (req, res): Promise<void> => {
  try {
    const { contactExternalId, name, expectedRevenue, dateDeadline } = req.body || {};
    const externalId = String(contactExternalId || "").trim();
    if (!externalId) {
      res.status(400).json({ error: "contactExternalId required" });
      return;
    }
    const result = await createOdooDeal(req.userId!, {
      contactExternalId: externalId,
      name: String(name || ""),
      expectedRevenue: typeof expectedRevenue === "number" && Number.isFinite(expectedRevenue) ? expectedRevenue : null,
      dateDeadline: typeof dateDeadline === "string" && dateDeadline ? dateDeadline : null,
    });
    if (!result.ok) {
      res.status(502).json({ error: result.error });
      return;
    }
    res.json({ ok: true, id: result.id });
  } catch (err) {
    console.error("[integrations] odoo create-deal error:", (err as Error).message);
    res.status(500).json({ error: "Failed to create Odoo opportunity" });
  }
});

router.post("/integrations/odoo/create-activity", requireAuth, async (req, res): Promise<void> => {
  try {
    const { contactExternalId, summary, note, dateDeadline, activityTypeId } = req.body || {};
    const externalId = String(contactExternalId || "").trim();
    if (!externalId) {
      res.status(400).json({ error: "contactExternalId required" });
      return;
    }
    const result = await createOdooActivity(req.userId!, {
      contactExternalId: externalId,
      summary: String(summary || ""),
      note: String(note || ""),
      dateDeadline: typeof dateDeadline === "string" && dateDeadline ? dateDeadline : null,
      activityTypeId: typeof activityTypeId === "number" && Number.isFinite(activityTypeId) ? activityTypeId : null,
    });
    if (!result.ok) {
      res.status(502).json({ error: result.error });
      return;
    }
    res.json({ ok: true, id: result.id });
  } catch (err) {
    console.error("[integrations] odoo create-activity error:", (err as Error).message);
    res.status(500).json({ error: "Failed to create Odoo activity" });
  }
});

router.post("/integrations/odoo/log-email", requireAuth, async (req, res): Promise<void> => {
  try {
    const { contactEmail, contactExternalId, emailId, subject, body, occurredAt } = req.body || {};
    const externalId = String(contactExternalId || "").trim();
    const email = String(contactEmail || "").trim().toLowerCase();
    if (!externalId && !email) {
      res.status(400).json({ error: "contactEmail or contactExternalId required" });
      return;
    }
    let resolvedId = externalId;
    if (!resolvedId) {
      const { data } = await supabaseAdmin
        .from("crm_contacts")
        .select("external_id")
        .eq("user_id", req.userId!)
        .eq("provider", "odoo")
        .ilike("email", email)
        .maybeSingle();
      resolvedId = (data as { external_id?: string } | null)?.external_id || "";
      if (!resolvedId) {
        res.status(404).json({ error: "Contact not found in Odoo cache" });
        return;
      }
    }
    const hasEmailId = typeof emailId === "number" && Number.isFinite(emailId);
    if (hasEmailId) {
      // Idempotence : claim crm_email_logs avant l'appel API. En cas de
      // conflit unique → déjà loggé. En cas d'échec API → on supprime le
      // claim pour permettre une nouvelle tentative.
      const { data: claim, error: claimErr } = await supabaseAdmin
        .from("crm_email_logs")
        .insert({ user_id: req.userId!, provider: "odoo", email_id: emailId, external_log_id: null })
        .select("id")
        .maybeSingle();
      if (claimErr) {
        if ((claimErr as { code?: string }).code === "23505") {
          res.json({ ok: true, alreadyLogged: true });
          return;
        }
        console.error("[integrations] odoo log-email claim error:", claimErr);
        res.status(500).json({ error: "Failed to claim log row" });
        return;
      }
      const claimId = (claim as { id?: number } | null)?.id;
      const result = await logEmailEngagementOdoo(
        req.userId!,
        resolvedId,
        String(subject || ""),
        String(body || ""),
        typeof occurredAt === "string" ? occurredAt : null,
      );
      if (!result.ok) {
        if (claimId) await supabaseAdmin.from("crm_email_logs").delete().eq("id", claimId);
        res.status(502).json({ error: result.error });
        return;
      }
      if (claimId && result.id) {
        await supabaseAdmin
          .from("crm_email_logs")
          .update({ external_log_id: String(result.id) })
          .eq("id", claimId);
      }
      res.json({ ok: true, id: result.id ?? null });
      return;
    }
    const result = await logEmailEngagementOdoo(
      req.userId!,
      resolvedId,
      String(subject || ""),
      String(body || ""),
      typeof occurredAt === "string" ? occurredAt : null,
    );
    if (!result.ok) {
      res.status(502).json({ error: result.error });
      return;
    }
    res.json({ ok: true, id: result.id ?? null });
  } catch (err) {
    console.error("[integrations] odoo log-email error:", (err as Error).message);
    res.status(500).json({ error: "Failed to log email" });
  }
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
