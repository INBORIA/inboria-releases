import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth } from "../middlewares/auth";
import { createHmac, randomBytes } from "crypto";

const router: IRouter = Router();

const SLACK_CLIENT_ID = process.env["SLACK_CLIENT_ID"] || "";
const SLACK_CLIENT_SECRET = process.env["SLACK_CLIENT_SECRET"] || "";
const NOTION_CLIENT_ID = process.env["NOTION_CLIENT_ID"] || "";
const NOTION_CLIENT_SECRET = process.env["NOTION_CLIENT_SECRET"] || "";

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
  return process.env["FRONTEND_URL"] || `https://${process.env["REPLIT_DEV_DOMAIN"] || "localhost"}`;
}

function getRedirectUri(provider: string): string {
  const domain = process.env["REPLIT_DEV_DOMAIN"] || process.env["REPLIT_DOMAINS"] || "localhost";
  const protocol = domain.includes("localhost") ? "http" : "https";
  return `${protocol}://${domain}/api/integrations/${provider}/callback`;
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
  };
}

async function requireProPlan(userId: string): Promise<boolean> {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("plan")
    .eq("id", userId)
    .single();
  return !!profile && profile.plan !== "gratuit" && profile.plan !== "solo";
}

router.get("/integrations", requireAuth, async (req, res): Promise<void> => {
  try {
    const { data } = await supabaseAdmin
      .from("integrations")
      .select("id, provider, workspace_name, channel_id, database_id, enabled, created_at")
      .eq("user_id", req.userId!);

    res.json((data || []).map(toCamelCase));
  } catch {
    res.status(500).json({ error: "Failed to fetch integrations" });
  }
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
