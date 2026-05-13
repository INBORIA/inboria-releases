import { Router, type IRouter } from "express";
import { google } from "googleapis";
import { ImapFlow } from "imapflow";
import OpenAI from "openai";
import { simpleParser } from "mailparser";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth } from "../middlewares/auth";
import { triggerSyncForConnection, isNoiseEmail, userHasOpenTaskWithTitle } from "../services/auto-sync";
import { logTriageEvent } from "../services/credits";
import { getEmailOAuthRedirectUri } from "../lib/urls";

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
        { role: "user", content: `Email:\nDe: ${sender}\nSujet: ${subject}\nCorps: ${body.slice(0, 800)}\n\nCategories existantes: ${categoryNames.join(", ") || lang.uncategorized}${rulesContext}${projectContext}\n\nReponds en JSON:\n{"priority":"urgent|moyen|faible","summary":"${lang.summaryHint}","category":"nom de categorie existante OU propose un nouveau nom pertinent (court, professionnel). Utilise '${lang.uncategorized}' uniquement si vraiment inclassable.","tasks":["tache 1","tache 2"],"project":"nom du projet ou ${lang.noneProject}"}\n\nIMPORTANT pour les taches: Chaque tache doit etre explicite et auto-suffisante. Inclus toujours QUI (expediteur/service) et QUOI. Exemples: au lieu de "Verifier l'adresse email" → "Confirmer l'inscription au service mentionne dans le mail (email de verification)", au lieu de "Utiliser le code" → "Saisir le code de verification recu par mail dans les 15 min". Ne genere PAS de tache pour les emails purement informatifs (newsletters, notifications automatiques, confirmations de lecture). Genere des taches uniquement quand une ACTION concrete est requise.` },
      ],
    });
    logTriageEvent(userId, { source: "email-connect", sender }).catch(() => {});
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
  return getEmailOAuthRedirectUri(provider);
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
  "gmail.com": { host: "imap.gmail.com", port: 993 },
  "googlemail.com": { host: "imap.gmail.com", port: 993 },
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
      res.status(400).send(`<html><body style="font-family: -apple-system, sans-serif; background:#0d1117; color:#fff; padding: 40px; max-width: 640px; margin: 0 auto; line-height: 1.6;">
<h2 style="color:#ef4444; margin-top:0;">Une case n'a pas été cochée</h2>
<p>Sur la page Google, il y avait plusieurs cases à cocher pour autoriser Inboria. La case pour <strong>lire vos emails</strong> n'a pas été cochée, donc nous ne pouvons pas accéder à votre boîte mail.</p>
<div style="background:#141c2b; padding:16px 20px; border-radius:8px; border-left:3px solid #2d7dd2; margin: 20px 0;">
  <p style="margin:0 0 8px 0; font-weight:600;">Pour réussir, recommencez et :</p>
  <ol style="margin:0; padding-left:20px;">
    <li>Cliquez sur <strong>« Tout sélectionner »</strong> en haut de la liste, OU</li>
    <li>Cochez manuellement <strong>toutes les cases</strong>, en particulier <strong>« Voir, modifier et créer vos messages Gmail »</strong></li>
    <li>Puis cliquez sur <strong>Continuer</strong></li>
  </ol>
</div>
<div style="display:flex; gap:10px; margin-top: 24px;">
  <button id="retry" style="background:#2d7dd2; color:#fff; border:none; padding: 12px 24px; border-radius:6px; cursor:pointer; font-size: 14px; font-weight:600;">Recommencer</button>
  <button onclick="window.close()" style="background:transparent; color:#b8c5d6; border:1px solid #2a3441; padding: 12px 24px; border-radius:6px; cursor:pointer; font-size: 14px;">Fermer</button>
</div>
<p style="color:#6b7280; font-size:11px; margin-top: 24px;">Permissions accordées : <code style="background:#141c2b; padding:2px 6px; border-radius:3px;">${grantedScope || "(aucune)"}</code></p>
<script>
document.getElementById('retry').onclick = async () => {
  try {
    const r = await fetch('/api/email/connect/gmail', { credentials: 'include' });
    const d = await r.json();
    if (d.url) window.location.href = d.url;
    else alert('Erreur : ' + (d.error || 'inconnue'));
  } catch (e) { alert('Erreur réseau'); }
};
</script>
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
      // Reset disconnection state on (re)connect — sinon le badge reste
      // « Déconnectée » même après un OAuth réussi tant qu'aucune sync n'a abouti.
      consecutive_failures: 0,
      last_error_at: null,
      last_error_message: null,
      last_alert_sent_at: null,
    };
    // Guard: ne jamais écraser une ligne existante d'un AUTRE provider avec le même email.
    // Sinon un compte Microsoft dont l'email principal = adresse Gmail viendrait casser
    // la connexion Gmail (et inversement).
    const { data: existingDiff } = await supabaseAdmin
      .from("email_connections")
      .select("id, provider")
      .eq("user_id", userId)
      .eq("email_address", userInfo.email!)
      .neq("provider", "gmail")
      .maybeSingle();
    if (existingDiff) {
      res.status(409).send(`<html><body style="font-family:-apple-system,sans-serif;background:#0d1117;color:#fff;padding:40px;max-width:640px;margin:0 auto;line-height:1.6;">
<h2 style="color:#ef4444;margin-top:0;">Adresse déjà utilisée</h2>
<p>L'adresse <strong>${userInfo.email}</strong> est déjà connectée comme compte <strong>${existingDiff.provider}</strong>. Supprimez d'abord cette connexion avant de la reconnecter en Gmail.</p>
<button onclick="window.close()" style="background:#2d7dd2;color:#fff;border:none;padding:12px 24px;border-radius:6px;cursor:pointer;font-size:14px;">Fermer</button>
</body></html>`);
      return;
    }
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
          // preferred_username = alias de connexion réel (ex: neybergh.jj@hotmail.com),
          // tandis que decoded.email peut être l'email principal du compte Microsoft
          // (parfois une adresse Gmail), donc on préfère preferred_username.
          emailFromIdToken = decoded.preferred_username || decoded.email || null;
        }
      } catch (e) {
        console.warn("[email-connect] Failed to decode Outlook id_token:", (e as Error).message);
      }
    }

    // Pour les comptes Microsoft personnels (hotmail/outlook.com), profile.mail
    // peut renvoyer l'email PRINCIPAL du compte (parfois une adresse Gmail/autre)
    // au lieu de l'alias avec lequel l'utilisateur s'est connecté. preferred_username
    // (id_token) = alias de connexion réel → on le préfère.
    const resolvedEmail = emailFromIdToken || profile.userPrincipalName || profile.mail;
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
      // Reset disconnection state on (re)connect — voir commentaire Gmail.
      consecutive_failures: 0,
      last_error_at: null,
      last_error_message: null,
      last_alert_sent_at: null,
    };
    // Guard: ne jamais écraser une ligne d'un AUTRE provider avec le même email.
    const { data: existingDiffOut } = await supabaseAdmin
      .from("email_connections")
      .select("id, provider")
      .eq("user_id", userId)
      .eq("email_address", resolvedEmail)
      .neq("provider", "outlook")
      .maybeSingle();
    if (existingDiffOut) {
      res.status(409).send(`<html><body style="font-family:-apple-system,sans-serif;background:#0d1117;color:#fff;padding:40px;max-width:640px;margin:0 auto;line-height:1.6;">
<h2 style="color:#ef4444;margin-top:0;">Adresse déjà utilisée</h2>
<p>L'adresse <strong>${resolvedEmail}</strong> est déjà connectée comme compte <strong>${existingDiffOut.provider}</strong>. Supprimez d'abord cette connexion avant de la reconnecter en Outlook.</p>
<p style="color:#b8c5d6;font-size:13px;">Astuce : si vous vouliez connecter une autre adresse (ex. hotmail), Microsoft vous a peut-être reconnecté automatiquement avec un autre compte. Déconnectez-vous d'abord sur <a href="https://login.microsoftonline.com/logout" target="_blank" style="color:#2d7dd2;">login.microsoftonline.com</a>.</p>
<button onclick="window.close()" style="background:#2d7dd2;color:#fff;border:none;padding:12px 24px;border-radius:6px;cursor:pointer;font-size:14px;">Fermer</button>
</body></html>`);
      return;
    }
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
    const { email, password: rawPassword, imapHost, imapPort } = req.body;

    if (!email || !rawPassword) {
      res.status(400).json({ error: "Email et mot de passe requis" });
      return;
    }

    // Google displays app passwords as "abcd efgh ijkl mnop" — users copy
    // the spaces. Strip all whitespace so the auth attempt actually works.
    const password = String(rawPassword).replace(/\s+/g, "");

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
        res.status(408).json({ error: `Le serveur ${host} n'a pas répondu en 15s. Réessayez dans un instant — si le problème persiste, contactez le support.`, needsManualConfig: true });
      } else {
        res.status(401).json({ error: "Identifiants refusés par le serveur de messagerie. Vérifiez votre adresse et votre mot de passe d'application.", needsManualConfig: true });
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
    let { data, error } = await supabaseAdmin
      .from("email_connections")
      .select("id, provider, email_address, created_at, last_synced_at, signature, consecutive_failures, last_error_at, last_error_message")
      .eq("user_id", req.userId!)
      .order("created_at", { ascending: true });

    if (error && /consecutive_failures|last_error_at|last_error_message|schema cache/i.test(error.message || "")) {
      const fallback = await supabaseAdmin
        .from("email_connections")
        .select("id, provider, email_address, created_at, last_synced_at, signature")
        .eq("user_id", req.userId!)
        .order("created_at", { ascending: true });
      data = fallback.data as typeof data;
      error = fallback.error;
    }

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    const connections = data || [];
    let sharedByConnId: Record<string, string> = {};
    if (connections.length > 0) {
      const userOrgId = await getOrgIdForActiveMemberConn(req.userId!);
      if (userOrgId) {
        const ids = connections.map((c: any) => c.id);
        const { data: shared } = await supabaseAdmin
          .from("shared_mailboxes")
          .select("id, connection_id")
          .eq("organisation_id", userOrgId)
          .in("connection_id", ids);
        for (const sm of (shared || []) as any[]) {
          if (sm.connection_id) sharedByConnId[sm.connection_id] = sm.id;
        }
      }
    }

    const enriched = connections.map((c: any) => ({
      ...c,
      shared_mailbox_id: sharedByConnId[c.id] || null,
      is_shared: !!sharedByConnId[c.id],
    }));

    res.set("Cache-Control", "no-store");
    res.json(enriched);
  } catch {
    res.status(500).json({ error: "Erreur lors de la recuperation des connexions" });
  }
});

router.patch("/email/connections/:connectionId", requireAuth, async (req, res): Promise<void> => {
  try {
    const updates: Record<string, any> = {};
    if (req.body?.signature !== undefined) {
      updates.signature = typeof req.body.signature === "string" ? req.body.signature : null;
    }
    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "No supported fields to update" });
      return;
    }
    const { data, error } = await supabaseAdmin
      .from("email_connections")
      .update(updates)
      .eq("user_id", req.userId!)
      .eq("id", req.params.connectionId)
      .select("id, provider, email_address, signature")
      .single();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Failed to update connection" });
  }
});

router.delete("/email/connections/:connectionId", requireAuth, async (req, res): Promise<void> => {
  try {
    const userOrgIdForCheck = await getOrgIdForActiveMemberConn(req.userId!);
    let shared: { id: string; name: string } | null = null;
    if (userOrgIdForCheck) {
      const { data } = await supabaseAdmin
        .from("shared_mailboxes")
        .select("id, name")
        .eq("organisation_id", userOrgIdForCheck)
        .eq("connection_id", req.params.connectionId)
        .maybeSingle();
      shared = (data as any) || null;
    }

    if (shared) {
      res.status(409).json({
        error: "shared_mailbox_linked",
        message: "Ce compte alimente une boîte partagée. Désactivez le partage avec l'équipe avant de déconnecter.",
        sharedMailboxName: shared.name,
      });
      return;
    }

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

async function getOrgIdForAdminConn(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("organisation_members")
    .select("organisation_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .eq("role", "admin")
    .maybeSingle();
  return (data as any)?.organisation_id || null;
}

async function getOrgIdForActiveMemberConn(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("organisation_members")
    .select("organisation_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  return (data as any)?.organisation_id || null;
}

async function userHasSharingPlan(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("plan")
    .eq("id", userId)
    .maybeSingle();
  const plan = (data as any)?.plan;
  return plan === "pro" || plan === "business";
}

router.post("/email/connections/:connectionId/share", requireAuth, async (req, res): Promise<void> => {
  try {
    const orgId = await getOrgIdForAdminConn(req.userId!);
    if (!orgId) {
      res.status(403).json({ error: "Accès réservé aux administrateurs" });
      return;
    }

    if (!(await userHasSharingPlan(req.userId!))) {
      res.status(402).json({ error: "Le partage d'équipe nécessite un plan Pro ou Business." });
      return;
    }

    const { data: conn } = await supabaseAdmin
      .from("email_connections")
      .select("id, email_address, provider")
      .eq("id", req.params.connectionId)
      .eq("user_id", req.userId!)
      .maybeSingle();

    if (!conn) {
      res.status(404).json({ error: "Connexion email introuvable" });
      return;
    }

    const c = conn as { id: string; email_address: string; provider: string };

    const { data: existing } = await supabaseAdmin
      .from("shared_mailboxes")
      .select("id, name, email_address, connection_id, created_at")
      .eq("organisation_id", orgId)
      .eq("connection_id", c.id)
      .maybeSingle();

    if (existing) {
      const e = existing as any;
      res.status(409).json({
        error: "already_shared",
        message: "Ce compte est déjà partagé avec l'équipe.",
        sharedMailbox: {
          id: e.id,
          name: e.name,
          emailAddress: e.email_address,
          connectionId: e.connection_id,
          createdAt: e.created_at,
        },
      });
      return;
    }

    const requestedName = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const mailboxName = requestedName || c.email_address.split("@")[0];

    const { data: mailbox, error } = await supabaseAdmin
      .from("shared_mailboxes")
      .insert({
        organisation_id: orgId,
        name: mailboxName,
        email_address: c.email_address,
        connection_id: c.id,
        created_by: req.userId!,
      })
      .select()
      .single();

    if (error || !mailbox) {
      if ((error as any)?.code === "23505") {
        const { data: dup } = await supabaseAdmin
          .from("shared_mailboxes")
          .select("id, name, email_address, connection_id, created_at")
          .eq("organisation_id", orgId)
          .eq("connection_id", c.id)
          .maybeSingle();
        if (dup) {
          const e = dup as any;
          res.status(409).json({
            error: "already_shared",
            message: "Ce compte est déjà partagé avec l'équipe.",
            sharedMailbox: {
              id: e.id,
              name: e.name,
              emailAddress: e.email_address,
              connectionId: e.connection_id,
              createdAt: e.created_at,
            },
          });
          return;
        }
      }
      console.error("Failed to create shared mailbox from connection:", error);
      res.status(500).json({ error: "Erreur lors de la création de la boîte partagée" });
      return;
    }

    const m = mailbox as any;

    await supabaseAdmin
      .from("shared_mailbox_members")
      .insert({
        shared_mailbox_id: m.id,
        user_id: req.userId!,
        can_reply: true,
      });

    const { data: backfilledRows, error: bfErr } = await supabaseAdmin
      .from("emails")
      .update({ shared_mailbox_id: m.id })
      .eq("user_id", req.userId!)
      .like("external_id", `${c.id}:%`)
      .is("shared_mailbox_id", null)
      .select("id");

    if (bfErr) {
      console.error(`[email-connect/share] Backfill error:`, bfErr.message);
    } else if (backfilledRows && backfilledRows.length > 0) {
      console.log(`[email-connect/share] Backfilled ${backfilledRows.length} email(s) for mailbox ${m.id}`);
    }

    res.status(201).json({
      id: m.id,
      name: m.name,
      emailAddress: m.email_address,
      connectionId: m.connection_id,
      createdAt: m.created_at,
    });
  } catch (e: any) {
    console.error("share connection error", e);
    res.status(500).json({ error: "Erreur lors du partage du compte" });
  }
});

router.delete("/email/connections/:connectionId/share", requireAuth, async (req, res): Promise<void> => {
  try {
    const orgId = await getOrgIdForAdminConn(req.userId!);
    if (!orgId) {
      res.status(403).json({ error: "Accès réservé aux administrateurs" });
      return;
    }

    const { data: conn } = await supabaseAdmin
      .from("email_connections")
      .select("id")
      .eq("id", req.params.connectionId)
      .eq("user_id", req.userId!)
      .maybeSingle();

    if (!conn) {
      res.status(404).json({ error: "Connexion email introuvable" });
      return;
    }

    const { data: mailboxes } = await supabaseAdmin
      .from("shared_mailboxes")
      .select("id")
      .eq("organisation_id", orgId)
      .eq("connection_id", req.params.connectionId);

    const ids = ((mailboxes as any[]) || []).map((m: any) => m.id);
    if (ids.length === 0) {
      res.status(404).json({ error: "not_shared", message: "Ce compte n'est pas partagé." });
      return;
    }

    const { data: memberRows } = await supabaseAdmin
      .from("shared_mailbox_members")
      .select("user_id")
      .in("shared_mailbox_id", ids);

    const memberUserIds = Array.from(
      new Set(((memberRows as any[]) || []).map((m: any) => m.user_id).filter((u: any) => u && u !== req.userId!)),
    );

    let impactedMembers: { userId: string; fullName: string | null; email: string | null }[] = [];
    if (memberUserIds.length > 0) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name, email")
        .in("id", memberUserIds);
      impactedMembers = ((profs as any[]) || []).map((p: any) => ({
        userId: p.id,
        fullName: p.full_name,
        email: p.email,
      }));
    }

    await supabaseAdmin
      .from("emails")
      .update({ shared_mailbox_id: null })
      .in("shared_mailbox_id", ids);

    await supabaseAdmin
      .from("shared_mailboxes")
      .delete()
      .in("id", ids);

    res.json({ success: true, removed: ids.length, impactedMembers });
  } catch (e: any) {
    console.error("unshare connection error", e);
    res.status(500).json({ error: "Erreur lors de l'arrêt du partage" });
  }
});

router.get("/email/connections/:connectionId/share/members", requireAuth, async (req, res): Promise<void> => {
  try {
    const orgId = await getOrgIdForAdminConn(req.userId!);
    if (!orgId) {
      res.status(403).json({ error: "Accès réservé aux administrateurs" });
      return;
    }

    const { data: conn } = await supabaseAdmin
      .from("email_connections")
      .select("id")
      .eq("id", req.params.connectionId)
      .eq("user_id", req.userId!)
      .maybeSingle();

    if (!conn) {
      res.status(404).json({ error: "Connexion email introuvable" });
      return;
    }

    const { data: mb } = await supabaseAdmin
      .from("shared_mailboxes")
      .select("id")
      .eq("organisation_id", orgId)
      .eq("connection_id", req.params.connectionId)
      .maybeSingle();

    if (!mb) {
      res.status(404).json({ error: "not_shared", message: "Ce compte n'est pas partagé." });
      return;
    }

    const mailboxId = (mb as any).id;

    const { data: memberRows } = await supabaseAdmin
      .from("shared_mailbox_members")
      .select("user_id")
      .eq("shared_mailbox_id", mailboxId);

    const memberUserIds = Array.from(
      new Set(((memberRows as any[]) || []).map((m: any) => m.user_id).filter((u: any) => u && u !== req.userId!)),
    );

    if (memberUserIds.length === 0) {
      res.json({ mailboxId, members: [] });
      return;
    }

    const { data: profs } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email")
      .in("id", memberUserIds);

    const members = ((profs as any[]) || []).map((p: any) => ({
      userId: p.id,
      fullName: p.full_name,
      email: p.email,
    }));

    res.json({ mailboxId, members });
  } catch (e: any) {
    console.error("share members error", e);
    res.status(500).json({ error: "Erreur lors du chargement des membres" });
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

    res.status(202).json({ accepted: true, connections: connections.length });

    (async () => {
      let totalSynced = 0;
      for (const conn of connections) {
        try {
          const result = await triggerSyncForConnection(conn.id);
          if (result.success) totalSynced += result.synced;
        } catch (e: any) {
          req.log.warn({ connId: conn.id, err: e?.message }, "[email/sync] connection sync failed");
        }
      }
      req.log.info({ totalSynced, connections: connections.length }, "[email/sync] background sync complete");
    })().catch((e) => req.log.error({ err: e?.message }, "[email/sync] background sync error"));
  } catch (err: any) {
    req.log.error({ err: err?.message }, "Sync error");
    if (!res.headersSent) res.status(500).json({ error: "Erreur lors de la synchronisation" });
  }
});


export default router;
