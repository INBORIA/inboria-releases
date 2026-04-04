import { Router, type IRouter } from "express";
import { google } from "googleapis";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

const GOOGLE_CLIENT_ID = process.env["GOOGLE_CLIENT_ID"] || "";
const GOOGLE_CLIENT_SECRET = process.env["GOOGLE_CLIENT_SECRET"] || "";
const MICROSOFT_CLIENT_ID = process.env["MICROSOFT_CLIENT_ID"] || "";
const MICROSOFT_CLIENT_SECRET = process.env["MICROSOFT_CLIENT_SECRET"] || "";

function getRedirectUri(provider: string) {
  const customDomain = process.env["APP_DOMAIN"];
  if (customDomain) {
    return `https://${customDomain}/api/email/callback/${provider}`;
  }
  const domain = process.env["REPLIT_DEV_DOMAIN"] || process.env["REPLIT_DOMAINS"] || "localhost";
  const protocol = domain.includes("localhost") ? "http" : "https";
  return `${protocol}://${domain}/api/email/callback/${provider}`;
}

function getGoogleOAuth2Client() {
  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    getRedirectUri("gmail")
  );
}

router.get("/email/connect/gmail", requireAuth, async (req, res): Promise<void> => {
  try {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      res.status(500).json({ error: "Google OAuth not configured" });
      return;
    }

    const oauth2Client = getGoogleOAuth2Client();
    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: [
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/userinfo.email",
      ],
      state: req.userId,
    });

    res.json({ url });
  } catch {
    res.status(500).json({ error: "Failed to generate Gmail auth URL" });
  }
});

router.get("/email/callback/gmail", async (req, res): Promise<void> => {
  try {
    const code = req.query.code as string;
    const userId = req.query.state as string;

    if (!code || !userId) {
      res.status(400).send("Missing code or state");
      return;
    }

    const oauth2Client = getGoogleOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const { data: userInfo } = await oauth2.userinfo.get();

    await supabaseAdmin.from("email_connections").upsert({
      user_id: userId,
      provider: "gmail",
      email_address: userInfo.email,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
    }, { onConflict: "user_id,provider" });

    const baseUrl = process.env["REPLIT_DEV_DOMAIN"] || process.env["REPLIT_DOMAINS"] || "localhost";
    const protocol = baseUrl.includes("localhost") ? "http" : "https";
    res.redirect(`${protocol}://${baseUrl}/dashboard/parametres?connected=gmail`);
  } catch (err: any) {
    console.error("Gmail callback error:", err);
    res.status(500).send("Gmail connection failed: " + (err.message || "Unknown error"));
  }
});

router.get("/email/connect/outlook", requireAuth, async (req, res): Promise<void> => {
  try {
    if (!MICROSOFT_CLIENT_ID || !MICROSOFT_CLIENT_SECRET) {
      res.status(500).json({ error: "Microsoft OAuth not configured" });
      return;
    }

    const redirectUri = getRedirectUri("outlook");
    const scope = encodeURIComponent("openid email Mail.Read offline_access");
    const url = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${MICROSOFT_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&state=${req.userId}&response_mode=query`;

    res.json({ url });
  } catch {
    res.status(500).json({ error: "Failed to generate Outlook auth URL" });
  }
});

router.get("/email/callback/outlook", async (req, res): Promise<void> => {
  try {
    const code = req.query.code as string;
    const userId = req.query.state as string;

    if (!code || !userId) {
      res.status(400).send("Missing code or state");
      return;
    }

    const redirectUri = getRedirectUri("outlook");
    const tokenResponse = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: MICROSOFT_CLIENT_ID,
        client_secret: MICROSOFT_CLIENT_SECRET,
        code,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        scope: "openid email Mail.Read offline_access",
      }),
    });

    const tokens = await tokenResponse.json() as any;

    if (tokens.error) {
      res.status(400).send("Outlook auth failed: " + tokens.error_description);
      return;
    }

    const profileResponse = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = await profileResponse.json() as any;

    await supabaseAdmin.from("email_connections").upsert({
      user_id: userId,
      provider: "outlook",
      email_address: profile.mail || profile.userPrincipalName,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    }, { onConflict: "user_id,provider" });

    const baseUrl = process.env["REPLIT_DEV_DOMAIN"] || process.env["REPLIT_DOMAINS"] || "localhost";
    const protocol = baseUrl.includes("localhost") ? "http" : "https";
    res.redirect(`${protocol}://${baseUrl}/dashboard/parametres?connected=outlook`);
  } catch (err: any) {
    console.error("Outlook callback error:", err);
    res.status(500).send("Outlook connection failed: " + (err.message || "Unknown error"));
  }
});

router.get("/email/connections", requireAuth, async (req, res): Promise<void> => {
  try {
    const { data, error } = await supabaseAdmin
      .from("email_connections")
      .select("id, provider, email_address, created_at, last_synced_at")
      .eq("user_id", req.userId!);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json(data || []);
  } catch {
    res.status(500).json({ error: "Failed to list connections" });
  }
});

router.delete("/email/connections/:provider", requireAuth, async (req, res): Promise<void> => {
  try {
    await supabaseAdmin
      .from("email_connections")
      .delete()
      .eq("user_id", req.userId!)
      .eq("provider", req.params.provider);

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to disconnect" });
  }
});

router.post("/email/sync", requireAuth, async (req, res): Promise<void> => {
  try {
    const { data: connections } = await supabaseAdmin
      .from("email_connections")
      .select("*")
      .eq("user_id", req.userId!);

    if (!connections || connections.length === 0) {
      res.status(400).json({ error: "No email accounts connected" });
      return;
    }

    let totalSynced = 0;

    for (const conn of connections) {
      if (conn.provider === "gmail") {
        totalSynced += await syncGmail(conn, req.userId!);
      } else if (conn.provider === "outlook") {
        totalSynced += await syncOutlook(conn, req.userId!);
      }
    }

    res.json({ synced: totalSynced });
  } catch (err: any) {
    console.error("Sync error:", err);
    res.status(500).json({ error: "Failed to sync emails" });
  }
});

async function syncGmail(conn: any, userId: string): Promise<number> {
  const oauth2Client = getGoogleOAuth2Client();
  oauth2Client.setCredentials({
    access_token: conn.access_token,
    refresh_token: conn.refresh_token,
  });

  oauth2Client.on("tokens", async (tokens) => {
    if (tokens.access_token) {
      await supabaseAdmin.from("email_connections").update({
        access_token: tokens.access_token,
        token_expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
      }).eq("id", conn.id);
    }
  });

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  const { data: messageList } = await gmail.users.messages.list({
    userId: "me",
    maxResults: 20,
    q: "is:inbox",
  });

  if (!messageList.messages) return 0;

  let synced = 0;

  for (const msg of messageList.messages) {
    const { data: existing } = await supabaseAdmin
      .from("emails")
      .select("id")
      .eq("user_id", userId)
      .eq("external_id", msg.id!)
      .single();

    if (existing) continue;

    const { data: fullMsg } = await gmail.users.messages.get({
      userId: "me",
      id: msg.id!,
      format: "metadata",
      metadataHeaders: ["From", "Subject", "Date"],
    });

    const headers = fullMsg.payload?.headers || [];
    const from = headers.find(h => h.name === "From")?.value || "Unknown";
    const subject = headers.find(h => h.name === "Subject")?.value || "(pas de sujet)";
    const snippet = fullMsg.snippet || "";

    await supabaseAdmin.from("emails").insert({
      user_id: userId,
      external_id: msg.id,
      sender: from,
      subject,
      body: snippet,
      status: "non_lu",
      priority: "moyen",
      created_at: new Date(parseInt(fullMsg.internalDate || "0")).toISOString(),
    });

    synced++;
  }

  await supabaseAdmin.from("email_connections").update({
    last_synced_at: new Date().toISOString(),
  }).eq("id", conn.id);

  return synced;
}

async function syncOutlook(conn: any, userId: string): Promise<number> {
  let accessToken = conn.access_token;

  if (conn.token_expires_at && new Date(conn.token_expires_at) < new Date()) {
    const tokenResponse = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: MICROSOFT_CLIENT_ID,
        client_secret: MICROSOFT_CLIENT_SECRET,
        refresh_token: conn.refresh_token,
        grant_type: "refresh_token",
        scope: "Mail.Read offline_access",
      }),
    });
    const tokens = await tokenResponse.json() as any;
    if (tokens.access_token) {
      accessToken = tokens.access_token;
      await supabaseAdmin.from("email_connections").update({
        access_token: tokens.access_token,
        token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      }).eq("id", conn.id);
    }
  }

  const response = await fetch("https://graph.microsoft.com/v1.0/me/messages?$top=20&$orderby=receivedDateTime desc&$select=id,from,subject,bodyPreview,receivedDateTime", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await response.json() as any;

  if (!data.value) return 0;

  let synced = 0;

  for (const msg of data.value) {
    const { data: existing } = await supabaseAdmin
      .from("emails")
      .select("id")
      .eq("user_id", userId)
      .eq("external_id", msg.id)
      .single();

    if (existing) continue;

    const senderEmail = msg.from?.emailAddress?.address || "Unknown";
    const senderName = msg.from?.emailAddress?.name || senderEmail;

    await supabaseAdmin.from("emails").insert({
      user_id: userId,
      external_id: msg.id,
      sender: `${senderName} <${senderEmail}>`,
      subject: msg.subject || "(pas de sujet)",
      body: msg.bodyPreview || "",
      status: "non_lu",
      priority: "moyen",
      created_at: msg.receivedDateTime,
    });

    synced++;
  }

  await supabaseAdmin.from("email_connections").update({
    last_synced_at: new Date().toISOString(),
  }).eq("id", conn.id);

  return synced;
}

export default router;
