import { Router, type IRouter } from "express";
import { google } from "googleapis";
import { ImapFlow } from "imapflow";
import OpenAI from "openai";
import { simpleParser } from "mailparser";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth } from "../middlewares/auth";
import { triggerSyncForConnection, isNoiseEmail, userHasOpenTaskWithTitle } from "../services/auto-sync";

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
      return decodeBase64(htmlPart.body.data);
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

async function triageEmail(sender: string, subject: string, body: string, userId: string, language: string = "fr"): Promise<{ priority: string; summary: string; category: string; tasks: string[]; project: string }> {
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

    const langInstructions: Record<string, { system: string; summaryHint: string; noneProject: string; uncategorized: string }> = {
      fr: { system: "Tu es un assistant de tri d'emails professionnel pour une PME. Reponds uniquement en JSON valide. Classe TOUJOURS les emails dans une categorie pertinente. Exemples: LinkedIn/reseaux sociaux → 'Reseaux sociaux', newsletters → 'Newsletters', codes de verification/securite → 'Notifications', factures/paiements → 'Facturation', hebergement/domaines → 'Hebergement'. N'utilise JAMAIS 'Non classe'.", summaryHint: "resume 1 phrase", noneProject: "Aucun", uncategorized: "Non classe" },
      en: { system: "You are a professional email sorting assistant for an SME. Respond only in valid JSON. ALWAYS classify emails into a relevant category. Examples: LinkedIn/social media → 'Social Media', newsletters → 'Newsletters', verification codes/security → 'Notifications', invoices/payments → 'Billing', hosting/domains → 'Hosting'. NEVER use 'Uncategorized'.", summaryHint: "1-sentence summary", noneProject: "None", uncategorized: "Uncategorized" },
      nl: { system: "Je bent een professionele e-mail sorteerassistent voor een KMO. Antwoord alleen in geldige JSON. Classificeer ALTIJD e-mails in een relevante categorie. Voorbeelden: LinkedIn/sociale media → 'Sociale media', nieuwsbrieven → 'Nieuwsbrieven', verificatiecodes/beveiliging → 'Meldingen', facturen/betalingen → 'Facturatie', hosting/domeinen → 'Hosting'. Gebruik NOOIT 'Niet geclassificeerd'.", summaryHint: "samenvatting in 1 zin", noneProject: "Geen", uncategorized: "Niet geclassificeerd" },
    };
    const lang = langInstructions[language] || langInstructions.fr;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 512,
      messages: [
        { role: "system", content: lang.system },
        { role: "user", content: `Email:\nDe: ${sender}\nSujet: ${subject}\nCorps: ${body.slice(0, 800)}\n\nCategories existantes: ${categoryNames.join(", ") || lang.uncategorized}${rulesContext}${projectContext}\n\nReponds en JSON:\n{"priority":"urgent|moyen|faible","summary":"${lang.summaryHint}","category":"nom de categorie existante OU propose un nouveau nom pertinent (court, professionnel). Utilise '${lang.uncategorized}' uniquement si vraiment inclassable.","tasks":["tache 1","tache 2"],"project":"nom du projet ou ${lang.noneProject}"}\n\nIMPORTANT pour les taches: Chaque tache doit etre explicite et auto-suffisante. Inclus toujours QUI (expediteur/service) et QUOI. Exemples: au lieu de "Verifier l'adresse email" → "Confirmer l'inscription sur Replit (email de verification)", au lieu de "Utiliser le code" → "Saisir le code de verification LinkedIn dans les 15 min". Ne genere PAS de tache pour les emails purement informatifs (newsletters, notifications automatiques, confirmations de lecture). Genere des taches uniquement quand une ACTION concrete est requise.` },
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
  const explicit = process.env["BACKEND_URL"] || process.env["FRONTEND_URL"];
  if (explicit) {
    return `${explicit.replace(/\/$/, "")}/api/email/callback/${provider}`;
  }
  const replitDomains = process.env["REPLIT_DOMAINS"];
  const firstReplitDomain = replitDomains ? replitDomains.split(",")[0]?.trim() : undefined;
  const domain = process.env["REPLIT_DEV_DOMAIN"] || firstReplitDomain || "inboria.com";
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
  "outlook.com": { host: "outlook.office365.com", port: 993 },
  "outlook.fr": { host: "outlook.office365.com", port: 993 },
  "outlook.be": { host: "outlook.office365.com", port: 993 },
  "hotmail.com": { host: "outlook.office365.com", port: 993 },
  "hotmail.fr": { host: "outlook.office365.com", port: 993 },
  "hotmail.be": { host: "outlook.office365.com", port: 993 },
  "live.com": { host: "outlook.office365.com", port: 993 },
  "live.fr": { host: "outlook.office365.com", port: 993 },
  "live.be": { host: "outlook.office365.com", port: 993 },
  "msn.com": { host: "outlook.office365.com", port: 993 },
  "orange.fr": { host: "imap.orange.fr", port: 993 },
  "wanadoo.fr": { host: "imap.orange.fr", port: 993 },
  "free.fr": { host: "imap.free.fr", port: 993 },
  "sfr.fr": { host: "imap.sfr.fr", port: 993 },
  "neuf.fr": { host: "imap.sfr.fr", port: 993 },
  "bbox.fr": { host: "imap.bbox.fr", port: 993 },
  "bouygtel.fr": { host: "imap.bbox.fr", port: 993 },
  "laposte.net": { host: "imap.laposte.net", port: 993 },
  "yahoo.com": { host: "imap.mail.yahoo.com", port: 993 },
  "yahoo.fr": { host: "imap.mail.yahoo.com", port: 993 },
  "icloud.com": { host: "imap.mail.me.com", port: 993 },
  "me.com": { host: "imap.mail.me.com", port: 993 },
  "mac.com": { host: "imap.mail.me.com", port: 993 },
  "proximus.be": { host: "imap.proximus.be", port: 993 },
  "skynet.be": { host: "imap.skynet.be", port: 993 },
  "voo.be": { host: "imap.voo.be", port: 993 },
  "telenet.be": { host: "imap.telenet.be", port: 993 },
  "ovh.net": { host: "ssl0.ovh.net", port: 993 },
  "ovh.com": { host: "ssl0.ovh.net", port: 993 },
  "xchangesuite.com": { host: "pro3.mail.ovh.net", port: 993 },
  "gmx.com": { host: "imap.gmx.com", port: 993 },
  "gmx.fr": { host: "imap.gmx.com", port: 993 },
  "infomaniak.ch": { host: "mail.infomaniak.com", port: 993 },
  "ionos.fr": { host: "imap.ionos.fr", port: 993 },
  "ionos.com": { host: "imap.ionos.com", port: 993 },
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
        "https://www.googleapis.com/auth/gmail.send",
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

    const grantedScope = (tokens.scope || "").toString();
    const hasReadScope = grantedScope.includes("gmail.readonly") || grantedScope.includes("mail.google.com");
    if (!hasReadScope) {
      console.error("[email-connect] Gmail OAuth granted scopes missing gmail.readonly:", grantedScope);
      res.status(400).send(`<html><body style="font-family: sans-serif; background:#0d1117; color:#fff; padding: 40px; max-width: 600px; margin: 0 auto;">
<h2 style="color:#ef4444;">Permission Gmail incomplète</h2>
<p>Pour qu'Inboria puisse lire vos emails, vous devez cocher <strong>"Voir, modifier et créer vos messages Gmail"</strong> sur l'écran de consentement Google.</p>
<p>Cette permission n'a pas été accordée. Veuillez recommencer la connexion et bien cocher TOUTES les cases proposées par Google.</p>
<p>Permissions accordées : <code style="background:#141c2b; padding:4px 8px; border-radius:4px;">${grantedScope || "(aucune)"}</code></p>
<button onclick="window.close()" style="background:#2d7dd2; color:#fff; border:none; padding: 10px 24px; border-radius:6px; cursor:pointer; font-size: 14px;">Fermer</button>
</body></html>`);
      return;
    }

    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const { data: userInfo } = await oauth2.userinfo.get();

    const gmailRow = {
      user_id: userId,
      provider: "gmail",
      email_address: userInfo.email,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
    };
    let { data: connData, error: connErr } = await supabaseAdmin.from("email_connections").upsert(gmailRow, { onConflict: "user_id,email_address" }).select("id").single();
    if (connErr) {
      console.error("[email-connect] Gmail upsert failed, trying insert:", connErr.message);
      const ins = await supabaseAdmin.from("email_connections").insert(gmailRow).select("id").single();
      connData = ins.data;
      if (ins.error) console.error("[email-connect] Gmail insert also failed:", ins.error.message);
    }

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
    const scope = encodeURIComponent("openid email Mail.Read Mail.Send offline_access");
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
        scope: "openid email Mail.Read Mail.Send offline_access",
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

    let emailFromIdToken: string | null = null;
    if (tokens.id_token) {
      try {
        const payloadB64 = String(tokens.id_token).split(".")[1];
        if (payloadB64) {
          const decoded = JSON.parse(Buffer.from(payloadB64.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
          emailFromIdToken = decoded.email || decoded.preferred_username || null;
        }
      } catch (e) {
        console.warn("[email-connect] Failed to decode Outlook id_token:", (e as Error).message);
      }
    }

    const resolvedEmail = profile.mail || profile.userPrincipalName || emailFromIdToken;
    if (!resolvedEmail) {
      console.error("[email-connect] Outlook: could not resolve email from profile or id_token", { profile });
      res.status(400).send("Connexion Outlook echouee: adresse email introuvable dans le profil Microsoft");
      return;
    }

    const outlookRow = {
      user_id: userId,
      provider: "outlook",
      email_address: resolvedEmail,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    };
    let { data: outlookConn, error: outlookErr } = await supabaseAdmin.from("email_connections").upsert(outlookRow, { onConflict: "user_id,email_address" }).select("id").single();
    if (outlookErr) {
      console.error("[email-connect] Outlook upsert failed, trying insert:", outlookErr.message);
      const ins = await supabaseAdmin.from("email_connections").insert(outlookRow).select("id").single();
      outlookConn = ins.data;
      if (ins.error) console.error("[email-connect] Outlook insert also failed:", ins.error.message);
    }

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
      emitLogs: false,
    });
    client.on("error", () => {});

    try {
      await Promise.race([
        client.connect(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 15000)),
      ]);
      await client.logout().catch(() => {});
    } catch (connErr: any) {
      try { await client.logout(); } catch {}
      const msg = connErr?.message || "";
      if (msg.includes("timeout")) {
        res.status(408).json({ error: "Connexion trop lente. Verifiez le serveur IMAP ou reessayez.", needsManualConfig: true });
      } else {
        res.status(401).json({ error: "Connexion echouee. Verifiez vos identifiants ou le serveur IMAP.", needsManualConfig: true });
      }
      return;
    }

    const imapConfig = JSON.stringify({ host, port });

    let savedConnId: string | null = null;

    const { data: upsertData, error: upsertError } = await supabaseAdmin.from("email_connections").upsert({
      user_id: req.userId,
      provider: "imap",
      email_address: email,
      access_token: password,
      refresh_token: imapConfig,
      token_expires_at: null,
    }, { onConflict: "user_id,email_address" }).select("id").single();

    if (upsertError) {
      console.error("[email-connect] Upsert failed, trying insert:", upsertError.message);
      const { data: insertData, error: insertError } = await supabaseAdmin.from("email_connections").insert({
        user_id: req.userId,
        provider: "imap",
        email_address: email,
        access_token: password,
        refresh_token: imapConfig,
        token_expires_at: null,
      }).select("id").single();

      if (insertError) {
        console.error("[email-connect] Insert also failed:", insertError.message);
        res.status(500).json({ error: "Connexion IMAP réussie mais impossible de sauvegarder. Contactez le support." });
        return;
      }
      savedConnId = insertData?.id || null;
    } else {
      savedConnId = upsertData?.id || null;
    }

    if (savedConnId) {
      triggerSyncForConnection(savedConnId).catch((e) =>
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

    res.set("Cache-Control", "no-store");
    res.json(data || []);
  } catch {
    res.status(500).json({ error: "Erreur lors de la recuperation des connexions" });
  }
});

router.delete("/email/connections/:connectionId", requireAuth, async (req, res): Promise<void> => {
  try {
    await supabaseAdmin
      .from("email_connections")
      .delete()
      .eq("user_id", req.userId!)
      .eq("id", req.params.connectionId);

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

    const { data: sharedMailboxes } = await supabaseAdmin
      .from("shared_mailboxes")
      .select("id, connection_id");
    const connToSharedMailbox: Record<string, string> = {};
    if (sharedMailboxes) {
      for (const sm of sharedMailboxes) {
        if (sm.connection_id) connToSharedMailbox[sm.connection_id] = sm.id;
      }
    }

    let totalSynced = 0;

    for (const conn of connections) {
      (conn as any)._sharedMailboxId = connToSharedMailbox[conn.id] || null;
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

    const { data: userProfile } = await supabaseAdmin
      .from("profiles")
      .select("ai_language")
      .eq("id", userId)
      .single();
    const userLang = userProfile?.ai_language || "fr";

    const { data: messageList } = await gmail.users.messages.list({
      userId: "me",
      maxResults: 20,
      q: "is:inbox",
    });

    console.log("syncGmail: found", messageList.messages?.length || 0, "messages");

    if (!messageList.messages) return 0;

    let synced = 0;

    for (const msg of messageList.messages) {
      const scopedExternalId = `${conn.id}:${msg.id!}`;
      const { data: existing } = await supabaseAdmin
        .from("emails")
        .select("id")
        .eq("user_id", userId)
        .eq("external_id", scopedExternalId)
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

      const triage = await triageEmail(from, subject, emailBody, userId, userLang);

      let categoryId = null;
      if (triage.category && triage.category !== "Non classe") {
        const { data: cat } = await supabaseAdmin
          .from("categories")
          .select("id")
          .eq("user_id", userId)
          .eq("name", triage.category)
          .maybeSingle();
        if (cat?.id) {
          categoryId = cat.id;
        } else {
          const { data: newCat, error: newCatErr } = await supabaseAdmin
            .from("categories")
            .insert({ user_id: userId, name: triage.category })
            .select("id")
            .single();
          if (newCat?.id) {
            categoryId = newCat.id;
          } else if (newCatErr?.code === "23505") {
            const { data: existing } = await supabaseAdmin
              .from("categories").select("id")
              .eq("user_id", userId).eq("name", triage.category).maybeSingle();
            categoryId = existing?.id || null;
          }
        }
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

      const gmailInsert: Record<string, any> = {
        user_id: userId,
        external_id: scopedExternalId,
        sender: from,
        subject,
        body: emailBody,
        status: "non_lu",
        priority: triage.priority,
        summary: triage.summary,
        category_id: categoryId,
        project_id: projectId,
        created_at: new Date(parseInt(fullMsg.internalDate || "0")).toISOString(),
      };
      if ((conn as any)._sharedMailboxId) {
        gmailInsert.shared_mailbox_id = (conn as any)._sharedMailboxId;
      }
      const { error: insertError } = await supabaseAdmin
        .from("emails")
        .upsert(gmailInsert, { onConflict: "user_id,external_id", ignoreDuplicates: true });

      if (insertError) {
        if (insertError.code === "23505") continue;
        console.error("syncGmail: insert error for msg", msg.id, insertError);
        continue;
      }

      if (triage.tasks && triage.tasks.length > 0 && !isNoiseEmail(from, subject)) {
        const { data: insertedEmail } = await supabaseAdmin
          .from("emails")
          .select("id")
          .eq("user_id", userId)
          .eq("external_id", scopedExternalId)
          .single();
        if (insertedEmail) {
          const { data: existingTasks } = await supabaseAdmin
            .from("tasks")
            .select("id")
            .eq("email_id", insertedEmail.id)
            .limit(1);

          if (!existingTasks || existingTasks.length === 0) {
            const taskInserts: { user_id: string; email_id: number; title: string; done: boolean }[] = [];
            for (const title of triage.tasks as string[]) {
              if (await userHasOpenTaskWithTitle(userId, title)) continue;
              taskInserts.push({ user_id: userId, email_id: insertedEmail.id, title, done: false });
            }
            if (taskInserts.length > 0) {
              await supabaseAdmin.from("tasks").insert(taskInserts);
            }
          }
        }
      } else if (triage.tasks && triage.tasks.length > 0) {
        console.log(`[email-connect] noise email, skipping ${triage.tasks.length} task(s)`);
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
    const scopedExternalId = `${conn.id}:${msg.id}`;
    const { data: existing } = await supabaseAdmin
      .from("emails")
      .select("id")
      .eq("user_id", userId)
      .eq("external_id", scopedExternalId)
      .single();

    if (existing) continue;

    const senderEmail = msg.from?.emailAddress?.address || "Inconnu";
    const senderName = msg.from?.emailAddress?.name || senderEmail;

    const outlookInsert: Record<string, any> = {
      user_id: userId,
      external_id: scopedExternalId,
      sender: `${senderName} <${senderEmail}>`,
      subject: msg.subject || "(pas de sujet)",
      body: msg.body?.content ? msg.body.content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : (msg.bodyPreview || ""),
      status: "non_lu",
      created_at: msg.receivedDateTime,
    };
    if ((conn as any)._sharedMailboxId) {
      outlookInsert.shared_mailbox_id = (conn as any)._sharedMailboxId;
    }
    await supabaseAdmin
      .from("emails")
      .upsert(outlookInsert, { onConflict: "user_id,external_id", ignoreDuplicates: true });

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
    emitLogs: false,
  });
  client.on("error", (err: any) => {
    console.error(`IMAP client error for ${conn.email_address}:`, err.message);
  });

  try {
    await Promise.race([
      client.connect(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("IMAP connect timeout")), 20000)),
    ]);
    const lock = await client.getMailboxLock("INBOX");
    let synced = 0;

    try {
      const mailboxStatus = client.mailbox;
      const totalMessages = mailboxStatus?.exists || 0;
      if (totalMessages === 0) { lock.release(); await client.logout(); return 0; }
      const startSeq = Math.max(1, totalMessages - 19);
      const range = `${startSeq}:*`;

      for await (const msg of client.fetch(range, { envelope: true, uid: true, source: true })) {
        const externalId = `${conn.id}:imap_${msg.uid}`;
        const { data: existing } = await supabaseAdmin.from("emails").select("id").eq("user_id", userId).eq("external_id", externalId).single();
        if (existing) continue;

        const envelope = msg.envelope;
        const from = envelope.from?.[0];
        const sender = from?.name ? `${from.name} <${from.address}>` : (from?.address || "inconnu");

        let bodyText = "";
        if (msg.source) {
          try {
            const parsed = await simpleParser(msg.source);
            bodyText = parsed.html
              ? (typeof parsed.html === "string" ? parsed.html : "")
              : parsed.text || "";
            bodyText = bodyText.slice(0, 10000);
          } catch {
            try {
              const raw = msg.source.toString("utf-8");
              const bodyStart = raw.indexOf("\r\n\r\n");
              if (bodyStart !== -1) {
                bodyText = raw.slice(bodyStart + 4).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 5000);
              }
            } catch {}
          }
        }

        const imapInsert: Record<string, any> = {
          user_id: userId, external_id: externalId, sender,
          subject: envelope.subject || "(pas de sujet)", body: bodyText,
          status: "non_lu",
          created_at: envelope.date ? new Date(envelope.date).toISOString() : new Date().toISOString(),
        };
        if ((conn as any)._sharedMailboxId) {
          imapInsert.shared_mailbox_id = (conn as any)._sharedMailboxId;
        }
        await supabaseAdmin
          .from("emails")
          .upsert(imapInsert, { onConflict: "user_id,external_id", ignoreDuplicates: true });
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
