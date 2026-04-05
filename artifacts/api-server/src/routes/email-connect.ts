import { Router, type IRouter } from "express";
import { google } from "googleapis";
import { ImapFlow } from "imapflow";
import OpenAI from "openai";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth } from "../middlewares/auth";
import { triggerSyncForConnection } from "../services/auto-sync";

const openai = new OpenAI({
  apiKey: process.env["OPENAI_API_KEY"],
});

function extractGmailBody(payload: any): string {
  if (!payload) return "";

  function decodeBase64(data: string): string {
    try {
      return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
    } catch {
      return "";
    }
  }

  if (payload.body?.data) {
    return decodeBase64(payload.body.data);
  }

  if (payload.parts) {
    const textPart = payload.parts.find((p: any) => p.mimeType === "text/plain");
    if (textPart?.body?.data) {
      return decodeBase64(textPart.body.data);
    }

    const htmlPart = payload.parts.find((p: any) => p.mimeType === "text/html");
    if (htmlPart?.body?.data) {
      const html = decodeBase64(htmlPart.body.data);
      return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    }

    for (const part of payload.parts) {
      if (part.parts) {
        const nested = extractGmailBody(part);
        if (nested) return nested;
      }
    }
  }

  return "";
}

async function triageEmail(sender: string, subject: string, body: string, userId: string): Promise<{ priority: string; summary: string; category: string; tasks: string[]; project: string }> {
  try {
    const { data: categories } = await supabaseAdmin
      .from("categories")
      .select("name")
      .eq("user_id", userId);
    const categoryNames = (categories || []).map((c: any) => c.name);

    const { data: userProjects } = await supabaseAdmin
      .from("projects")
      .select("name, reference")
      .eq("user_id", userId)
      .eq("status", "actif");
    const projectList = (userProjects || []).map((p: any) => `${p.reference} (${p.name})`);

    const { data: rules } = await supabaseAdmin
      .from("ai_rules")
      .select("sender_pattern, forced_priority, forced_category")
      .eq("user_id", userId);

    let rulesContext = "";
    if (rules && rules.length > 0) {
      rulesContext = "\n\nRegles apprises (respecte-les en priorite):\n" +
        rules.map((r: any) => {
          const parts = [`- Si expediteur contient "${r.sender_pattern}"`];
          if (r.forced_priority) parts.push(`alors priorite="${r.forced_priority}"`);
          if (r.forced_category) parts.push(`et categorie="${r.forced_category}"`);
          return parts.join(" ");
        }).join("\n");
    }

    let projectContext = "";
    if (projectList.length > 0) {
      projectContext = `\n\nProjets actifs: ${projectList.join(", ")}\nSi l'email semble concerner un de ces projets, indique son nom exact dans "project". Sinon, mets "Aucun".`;
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 512,
      messages: [
        { role: "system", content: "Tu es un assistant de tri d'emails professionnel pour une PME. Reponds uniquement en JSON valide." },
        { role: "user", content: `Email:\nDe: ${sender}\nSujet: ${subject}\nCorps: ${body.slice(0, 800)}\n\nCategories disponibles: ${categoryNames.join(", ") || "Aucune"}${rulesContext}${projectContext}\n\nReponds en JSON:\n{"priority":"urgent|moyen|faible","summary":"resume 1 phrase","category":"nom exact ou Non classe","tasks":["tache 1","tache 2"],"project":"nom du projet ou Aucun"}` },
      ],
    });
    const content = completion.choices[0]?.message?.content ?? "{}";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const result = JSON.parse(jsonMatch ? jsonMatch[0] : "{}");
    return {
      priority: result.priority || "faible",
      summary: result.summary || "",
      category: result.category || "Non classe",
      tasks: Array.isArray(result.tasks) ? result.tasks : [],
      project: result.project || "Aucun",
    };
  } catch (err: any) {
    console.error("triageEmail error:", err.message);
    return { priority: "faible", summary: "", category: "Non classe", tasks: [], project: "Aucun" };
  }
}

const router: IRouter = Router();

router.post("/email/migrate", requireAuth, async (_req, res): Promise<void> => {
  try {
    const supabaseUrl = process.env["VITE_SUPABASE_URL"];
    const serviceKey = process.env["SUPABASE_SECRET_KEY"];
    if (!supabaseUrl || !serviceKey) {
      res.status(500).json({ error: "Missing Supabase config" });
      return;
    }
    const queries = [
      "ALTER TABLE emails ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'faible'",
      "ALTER TABLE emails ADD COLUMN IF NOT EXISTS summary TEXT",
    ];
    for (const sql of queries) {
      const resp = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: "POST",
        headers: {
          "apikey": serviceKey,
          "Authorization": `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: sql }),
      });
      if (!resp.ok) {
        console.log("migrate: SQL via RPC failed, trying direct...", await resp.text());
      }
    }
    res.json({ ok: true, message: "Migration attempted. If columns don't exist yet, add them manually in Supabase SQL editor:\nALTER TABLE emails ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'faible';\nALTER TABLE emails ADD COLUMN IF NOT EXISTS summary TEXT;" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

const GOOGLE_CLIENT_ID = process.env["GOOGLE_CLIENT_ID"] || "";
const GOOGLE_CLIENT_SECRET = process.env["GOOGLE_CLIENT_SECRET"] || "";

function getRedirectUri(provider: string) {
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

const IMAP_PROVIDERS: Record<string, { host: string; port: number }> = {
  "orange.fr": { host: "imap.orange.fr", port: 993 },
  "wanadoo.fr": { host: "imap.orange.fr", port: 993 },
  "free.fr": { host: "imap.free.fr", port: 993 },
  "sfr.fr": { host: "imap.sfr.fr", port: 993 },
  "laposte.net": { host: "imap.laposte.net", port: 993 },
  "yahoo.com": { host: "imap.mail.yahoo.com", port: 993 },
  "yahoo.fr": { host: "imap.mail.yahoo.com", port: 993 },
  "icloud.com": { host: "imap.mail.me.com", port: 993 },
  "me.com": { host: "imap.mail.me.com", port: 993 },
  "ovh.net": { host: "ssl0.ovh.net", port: 993 },
};

router.get("/email/connect/gmail", requireAuth, async (req, res): Promise<void> => {
  try {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      res.status(500).json({ error: "Google OAuth non configure" });
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
    res.status(500).json({ error: "Erreur lors de la generation de l'URL Gmail" });
  }
});

router.get("/email/callback/gmail", async (req, res): Promise<void> => {
  try {
    const code = req.query.code as string;
    const userId = req.query.state as string;

    if (!code || !userId) {
      res.status(400).send("Parametres manquants");
      return;
    }

    const oauth2Client = getGoogleOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const { data: userInfo } = await oauth2.userinfo.get();

    const { data: connData } = await supabaseAdmin.from("email_connections").upsert({
      user_id: userId,
      provider: "gmail",
      email_address: userInfo.email,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
    }, { onConflict: "user_id,provider" }).select("id").single();

    if (connData?.id) {
      triggerSyncForConnection(connData.id).catch((e) =>
        console.error("[email-connect] Gmail auto-sync trigger failed:", e.message)
      );
    }

    res.send(`<html><body><script>window.opener?.postMessage({type:'email-connected',provider:'gmail'},'*');window.close();</script><p>Gmail connecte ! Synchronisation en cours...</p></body></html>`);
  } catch (err: any) {
    console.error("Gmail callback error:", err);
    res.status(500).send("Connexion Gmail echouee: " + (err.message || "Erreur inconnue"));
  }
});

router.get("/email/connect/outlook", requireAuth, async (req, res): Promise<void> => {
  try {
    const MICROSOFT_CLIENT_ID = process.env["MICROSOFT_CLIENT_ID"] || "";
    const MICROSOFT_CLIENT_SECRET = process.env["MICROSOFT_CLIENT_SECRET"] || "";

    if (!MICROSOFT_CLIENT_ID || !MICROSOFT_CLIENT_SECRET) {
      res.status(500).json({ error: "Microsoft OAuth non configure" });
      return;
    }

    const redirectUri = getRedirectUri("outlook");
    const scope = encodeURIComponent("openid email Mail.Read offline_access");
    const url = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${MICROSOFT_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&state=${req.userId}&response_mode=query`;

    res.json({ url });
  } catch {
    res.status(500).json({ error: "Erreur lors de la generation de l'URL Outlook" });
  }
});

router.get("/email/callback/outlook", async (req, res): Promise<void> => {
  try {
    const code = req.query.code as string;
    const userId = req.query.state as string;
    const MICROSOFT_CLIENT_ID = process.env["MICROSOFT_CLIENT_ID"] || "";
    const MICROSOFT_CLIENT_SECRET = process.env["MICROSOFT_CLIENT_SECRET"] || "";

    if (!code || !userId) {
      res.status(400).send("Parametres manquants");
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
      res.status(400).send("Connexion Outlook echouee: " + tokens.error_description);
      return;
    }

    const profileResponse = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = await profileResponse.json() as any;

    const { data: outlookConn } = await supabaseAdmin.from("email_connections").upsert({
      user_id: userId,
      provider: "outlook",
      email_address: profile.mail || profile.userPrincipalName,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    }, { onConflict: "user_id,provider" }).select("id").single();

    if (outlookConn?.id) {
      triggerSyncForConnection(outlookConn.id).catch((e) =>
        console.error("[email-connect] Outlook auto-sync trigger failed:", e.message)
      );
    }

    res.send(`<html><body><script>window.opener?.postMessage({type:'email-connected',provider:'outlook'},'*');window.close();</script><p>Outlook connecte ! Synchronisation en cours...</p></body></html>`);
  } catch (err: any) {
    console.error("Outlook callback error:", err);
    res.status(500).send("Connexion Outlook echouee: " + (err.message || "Erreur inconnue"));
  }
});

router.post("/email/connect/imap", requireAuth, async (req, res): Promise<void> => {
  try {
    const { email, password, imapHost, imapPort } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: "Email et mot de passe requis" });
      return;
    }

    const domain = email.split("@")[1]?.toLowerCase() || "";
    let host = imapHost;
    let port = imapPort || 993;

    if (!host) {
      const detected = IMAP_PROVIDERS[domain];
      if (!detected) {
        res.status(400).json({
          error: "Fournisseur non reconnu. Veuillez entrer le serveur IMAP manuellement.",
          needsManualConfig: true,
        });
        return;
      }
      host = detected.host;
      port = detected.port;
    }

    const client = new ImapFlow({
      host, port, secure: true,
      auth: { user: email, pass: password },
      logger: false,
    });

    try {
      await client.connect();
      await client.logout();
    } catch {
      res.status(401).json({ error: "Connexion echouee. Verifiez vos identifiants." });
      return;
    }

    const imapConfig = JSON.stringify({ host, port });

    const { data: imapConn } = await supabaseAdmin.from("email_connections").upsert({
      user_id: req.userId,
      provider: "imap",
      email_address: email,
      access_token: password,
      refresh_token: imapConfig,
      token_expires_at: null,
    }, { onConflict: "user_id,provider" }).select("id").single();

    if (imapConn?.id) {
      triggerSyncForConnection(imapConn.id).catch((e) =>
        console.error("[email-connect] IMAP auto-sync trigger failed:", e.message)
      );
    }

    res.json({ success: true, provider: "imap", email });
  } catch (err: any) {
    console.error("IMAP connect error:", err);
    res.status(500).json({ error: "Erreur lors de la connexion" });
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
    res.status(500).json({ error: "Erreur lors de la recuperation des connexions" });
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
    res.status(500).json({ error: "Erreur lors de la deconnexion" });
  }
});

router.post("/email/sync", requireAuth, async (req, res): Promise<void> => {
  try {
    const force = req.body?.force === true;

    if (force) {
      await supabaseAdmin
        .from("emails")
        .delete()
        .eq("user_id", req.userId!);
      console.log("syncEmails: force=true, cleared all emails for user");
    }

    const { data: connections } = await supabaseAdmin
      .from("email_connections")
      .select("*")
      .eq("user_id", req.userId!);

    if (!connections || connections.length === 0) {
      res.status(400).json({ error: "Aucun compte email connecte" });
      return;
    }

    let totalSynced = 0;

    for (const conn of connections) {
      if (conn.provider === "gmail") {
        totalSynced += await syncGmail(conn, req.userId!);
      } else if (conn.provider === "outlook") {
        totalSynced += await syncOutlook(conn, req.userId!);
      } else {
        totalSynced += await syncImap(conn, req.userId!);
      }
    }

    res.json({ synced: totalSynced });
  } catch (err: any) {
    console.error("Sync error:", err);
    res.status(500).json({ error: "Erreur lors de la synchronisation" });
  }
});

async function syncGmail(conn: any, userId: string): Promise<number> {
  try {
    console.log("syncGmail: starting for", conn.email_address);
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

    console.log("syncGmail: found", messageList.messages?.length || 0, "messages");

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
        format: "full",
      });

      const headers = fullMsg.payload?.headers || [];
      const from = headers.find(h => h.name === "From")?.value || "Inconnu";
      const subject = headers.find(h => h.name === "Subject")?.value || "(pas de sujet)";
      const emailBody = extractGmailBody(fullMsg.payload) || fullMsg.snippet || "";

      const triage = await triageEmail(from, subject, emailBody, userId);

      let categoryId = null;
      if (triage.category && triage.category !== "Non classe") {
        const { data: cat } = await supabaseAdmin
          .from("categories")
          .select("id")
          .eq("user_id", userId)
          .eq("name", triage.category)
          .single();
        categoryId = cat?.id || null;
      }

      let projectId = null;
      if (triage.project && triage.project !== "Aucun") {
        const { data: proj } = await supabaseAdmin
          .from("projects")
          .select("id")
          .eq("user_id", userId)
          .eq("name", triage.project)
          .single();
        projectId = proj?.id || null;
      }

      const { error: insertError } = await supabaseAdmin.from("emails").insert({
        user_id: userId,
        external_id: msg.id,
        sender: from,
        subject,
        body: emailBody,
        status: "non_lu",
        priority: triage.priority,
        summary: triage.summary,
        category_id: categoryId,
        project_id: projectId,
        created_at: new Date(parseInt(fullMsg.internalDate || "0")).toISOString(),
      });

      if (insertError) {
        console.error("syncGmail: insert error for msg", msg.id, insertError);
        continue;
      }

      if (triage.tasks && triage.tasks.length > 0) {
        const { data: insertedEmail } = await supabaseAdmin
          .from("emails")
          .select("id")
          .eq("user_id", userId)
          .eq("external_id", msg.id!)
          .single();
        if (insertedEmail) {
          await supabaseAdmin.from("tasks").insert(
            triage.tasks.map((title: string) => ({
              user_id: userId,
              email_id: insertedEmail.id,
              title,
              done: false,
            }))
          );
        }
      }

      synced++;
    }

    console.log("syncGmail: synced", synced, "new emails");

    await supabaseAdmin.from("email_connections").update({
      last_synced_at: new Date().toISOString(),
    }).eq("id", conn.id);

    return synced;
  } catch (err: any) {
    console.error("syncGmail error:", err.message, err.response?.data || "");
    return 0;
  }
}

async function syncOutlook(conn: any, userId: string): Promise<number> {
  let accessToken = conn.access_token;
  const MICROSOFT_CLIENT_ID = process.env["MICROSOFT_CLIENT_ID"] || "";
  const MICROSOFT_CLIENT_SECRET = process.env["MICROSOFT_CLIENT_SECRET"] || "";

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

  const response = await fetch("https://graph.microsoft.com/v1.0/me/messages?$top=20&$orderby=receivedDateTime desc&$select=id,from,subject,body,bodyPreview,receivedDateTime", {
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

    const senderEmail = msg.from?.emailAddress?.address || "Inconnu";
    const senderName = msg.from?.emailAddress?.name || senderEmail;

    await supabaseAdmin.from("emails").insert({
      user_id: userId,
      external_id: msg.id,
      sender: `${senderName} <${senderEmail}>`,
      subject: msg.subject || "(pas de sujet)",
      body: msg.body?.content ? msg.body.content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : (msg.bodyPreview || ""),
      status: "non_lu",
      created_at: msg.receivedDateTime,
    });

    synced++;
  }

  await supabaseAdmin.from("email_connections").update({
    last_synced_at: new Date().toISOString(),
  }).eq("id", conn.id);

  return synced;
}

async function syncImap(conn: any, userId: string): Promise<number> {
  let imapConfig = { host: "imap.gmail.com", port: 993 };
  try {
    if (conn.refresh_token) imapConfig = JSON.parse(conn.refresh_token);
  } catch {}

  const client = new ImapFlow({
    host: imapConfig.host,
    port: imapConfig.port,
    secure: true,
    auth: { user: conn.email_address, pass: conn.access_token },
    logger: false,
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    let synced = 0;

    try {
      const mailboxStatus = client.mailbox;
      const totalMessages = mailboxStatus?.exists || 0;
      if (totalMessages === 0) { lock.release(); await client.logout(); return 0; }
      const startSeq = Math.max(1, totalMessages - 19);
      const range = `${startSeq}:*`;

      for await (const msg of client.fetch(range, { envelope: true, uid: true, source: true })) {
        const externalId = `imap_${msg.uid}`;
        const { data: existing } = await supabaseAdmin.from("emails").select("id").eq("user_id", userId).eq("external_id", externalId).single();
        if (existing) continue;

        const envelope = msg.envelope;
        const from = envelope.from?.[0];
        const sender = from?.name ? `${from.name} <${from.address}>` : (from?.address || "inconnu");

        let bodyText = "";
        if (msg.source) {
          try {
            const raw = msg.source.toString("utf-8");
            const bodyStart = raw.indexOf("\r\n\r\n");
            if (bodyStart !== -1) {
              bodyText = raw.slice(bodyStart + 4).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 5000);
            }
          } catch {}
        }

        await supabaseAdmin.from("emails").insert({
          user_id: userId, external_id: externalId, sender,
          subject: envelope.subject || "(pas de sujet)", body: bodyText,
          status: "non_lu",
          created_at: envelope.date ? new Date(envelope.date).toISOString() : new Date().toISOString(),
        });
        synced++;
      }
    } finally { lock.release(); }

    await client.logout();
    await supabaseAdmin.from("email_connections").update({ last_synced_at: new Date().toISOString() }).eq("id", conn.id);
    return synced;
  } catch (err: any) {
    console.error(`IMAP sync error for ${conn.email_address}:`, err.message);
    try { await client.logout(); } catch {}
    return 0;
  }
}

export default router;
