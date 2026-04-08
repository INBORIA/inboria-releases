import { google } from "googleapis";
import { ImapFlow, type MailboxLockObject } from "imapflow";
import OpenAI from "openai";
import { simpleParser } from "mailparser";
import { supabaseAdmin } from "../lib/supabase";
import { logger } from "../lib/logger";
import * as net from "net";
import { sendSlackNotification, createNotionTask } from "./integrations";

interface AttachmentMeta {
  filename: string;
  contentType: string;
  size: number;
  providerAttachmentId: string;
}

function extractGmailAttachments(payload: any): AttachmentMeta[] {
  const attachments: AttachmentMeta[] = [];
  if (!payload) return attachments;

  function walk(parts: any[]) {
    for (const part of parts) {
      if (part.filename && part.filename.length > 0 && part.body) {
        attachments.push({
          filename: part.filename,
          contentType: part.mimeType || "application/octet-stream",
          size: part.body.size || 0,
          providerAttachmentId: part.body.attachmentId || "",
        });
      }
      if (part.parts) {
        walk(part.parts);
      }
    }
  }

  if (payload.parts) {
    walk(payload.parts);
  }

  return attachments;
}

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

const openai = new OpenAI({
  apiKey: process.env["OPENAI_API_KEY"],
});

const SYNC_INTERVAL_MS = 5 * 60 * 1000;
const GOOGLE_CLIENT_ID = process.env["GOOGLE_CLIENT_ID"] || "";
const GOOGLE_CLIENT_SECRET = process.env["GOOGLE_CLIENT_SECRET"] || "";

const ALLOWED_IMAP_HOSTS = [
  "imap.gmail.com",
  "imap.mail.yahoo.com",
  "imap.mail.me.com",
  "imap.orange.fr",
  "imap.free.fr",
  "imap.sfr.fr",
  "outlook.office365.com",
  "imap-mail.outlook.com",
  "imap.gmx.com",
  "imap.zoho.com",
  "imap.fastmail.com",
  "imap.protonmail.ch",
  "mail.infomaniak.com",
  "imap.ionos.fr",
  "ssl0.ovh.net",
  "pro1.mail.ovh.net",
  "pro2.mail.ovh.net",
];

let syncRunning = false;

function isPrivateIP(host: string): boolean {
  try {
    if (net.isIP(host)) {
      return (
        host.startsWith("10.") ||
        host.startsWith("172.") ||
        host.startsWith("192.168.") ||
        host.startsWith("127.") ||
        host === "0.0.0.0" ||
        host === "::1" ||
        host === "localhost"
      );
    }
    return host === "localhost" || host.endsWith(".local") || host.endsWith(".internal");
  } catch {
    return true;
  }
}

function isValidImapHost(host: string): boolean {
  if (!host || typeof host !== "string") return false;
  if (isPrivateIP(host)) return false;
  if (ALLOWED_IMAP_HOSTS.includes(host.toLowerCase())) return true;
  const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
  return domainRegex.test(host);
}

function getGoogleOAuth2Client() {
  const domain = process.env["REPLIT_DEV_DOMAIN"] || process.env["REPLIT_DOMAINS"] || "localhost";
  const protocol = domain.includes("localhost") ? "http" : "https";
  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    `${protocol}://${domain}/api/email/callback/gmail`
  );
}

async function triageEmailAI(
  sender: string,
  subject: string,
  body: string,
  userId: string
): Promise<{ priority: string; summary: string; category: string; tasks: string[] }> {
  try {
    const { data: categories } = await supabaseAdmin
      .from("categories")
      .select("name")
      .eq("user_id", userId);
    const JUNK_CATS = ["non classé", "non classe", "uncategorized", "niet geclassificeerd"];
    const categoryNames = (categories || []).map((c: any) => c.name).filter((n: string) => !JUNK_CATS.includes(n.toLowerCase()));

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

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 512,
      messages: [
        {
          role: "system",
          content: "Tu es un assistant de tri d'emails professionnel pour une PME. Reponds uniquement en JSON valide. Classe TOUJOURS les emails dans une categorie pertinente. Exemples: LinkedIn/reseaux sociaux → 'Reseaux sociaux', newsletters → 'Newsletters', codes de verification/securite → 'Notifications', factures/paiements → 'Facturation', hebergement/domaines → 'Hebergement'. N'utilise JAMAIS 'Non classe'.",
        },
        {
          role: "user",
          content: `Email:\nDe: ${sender}\nSujet: ${subject}\nCorps: ${(body || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 800)}\n\nCategories existantes: ${categoryNames.join(", ") || "Aucune"}${rulesContext}\n\nReponds en JSON:\n{"priority":"urgent|moyen|faible","summary":"resume 1 phrase","category":"nom de categorie existante OU propose un nouveau nom pertinent (court, professionnel). Utilise 'Non classe' uniquement si vraiment inclassable.","tasks":["tache 1","tache 2"]}\n\nIMPORTANT pour les taches: Chaque tache doit etre explicite et auto-suffisante. Inclus toujours QUI (expediteur/service) et QUOI. Exemples: au lieu de "Verifier l'adresse email" → "Confirmer l'inscription sur Replit (email de verification)", au lieu de "Utiliser le code" → "Saisir le code de verification LinkedIn dans les 15 min". Ne genere PAS de tache pour les emails purement informatifs (newsletters, notifications automatiques, confirmations de lecture). Genere des taches uniquement quand une ACTION concrete est requise.`,
        },
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
    };
  } catch (err: any) {
    console.error("[auto-sync] triageEmailAI error:", err.message);
    return { priority: "faible", summary: "", category: "Non classe", tasks: [] };
  }
}

async function saveEmailWithTriage(
  userId: string,
  externalId: string,
  sender: string,
  subject: string,
  body: string,
  createdAt: string,
  sharedMailboxId?: string | null
): Promise<number | null> {
  const { data: existing } = await supabaseAdmin
    .from("emails")
    .select("id")
    .eq("user_id", userId)
    .eq("external_id", externalId)
    .maybeSingle();

  if (existing) return null;

  const { data: profile, error: profileErr } = await supabaseAdmin
    .from("profiles")
    .select("emails_used, emails_quota")
    .eq("id", userId)
    .single();

  if (profileErr || !profile) {
    console.error("[auto-sync] Profile fetch error:", profileErr?.message);
    return null;
  }

  if (profile.emails_used >= profile.emails_quota) {
    return null;
  }

  const triage = await triageEmailAI(sender, subject, body, userId);

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
        console.log(`[auto-sync] Auto-created category "${triage.category}" for user ${userId}`);
      } else if (newCatErr?.code === "23505") {
        const { data: existing } = await supabaseAdmin
          .from("categories")
          .select("id")
          .eq("user_id", userId)
          .eq("name", triage.category)
          .maybeSingle();
        categoryId = existing?.id || null;
      }
    }
  }

  const insertPayload: Record<string, any> = {
    user_id: userId,
    external_id: externalId,
    sender,
    subject,
    body,
    status: "non_lu",
    priority: triage.priority,
    summary: triage.summary,
    category_id: categoryId,
    created_at: createdAt,
  };
  if (sharedMailboxId) {
    insertPayload.shared_mailbox_id = sharedMailboxId;
  }

  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from("emails")
    .insert(insertPayload)
    .select("id")
    .single();

  if (insertErr) {
    if (insertErr.code === "23505") return null;
    console.error("[auto-sync] insert error:", insertErr.message);
    return null;
  }

  if (!inserted) return null;

  if (triage.priority === "urgent") {
    sendSlackNotification(userId, sender, subject, triage.summary).catch(() => {});
  }

  if (triage.tasks.length > 0) {
    const { error: taskErr } = await supabaseAdmin.from("tasks").insert(
      triage.tasks.map((title) => ({
        user_id: userId,
        email_id: inserted.id,
        title,
        done: false,
      }))
    );
    if (taskErr) {
      console.error("[auto-sync] task insert error:", taskErr.message);
    }

    for (const title of triage.tasks) {
      createNotionTask(userId, title, subject, sender).catch(() => {});
    }
  }

  const { error: quotaErr } = await supabaseAdmin.rpc("increment_emails_used", {
    user_id_input: userId,
  });

  if (quotaErr) {
    const { error: fallbackErr } = await supabaseAdmin
      .from("profiles")
      .update({ emails_used: profile.emails_used + 1 })
      .eq("id", userId);
    if (fallbackErr) {
      console.error("[auto-sync] quota update error:", fallbackErr.message);
    }
  }

  return inserted.id;
}

async function saveAttachmentsMeta(
  emailId: number,
  attachments: AttachmentMeta[],
  provider: string,
  connectionId: string,
  messageUid?: string
) {
  if (attachments.length === 0) return;
  const rows = attachments.map((a) => ({
    email_id: emailId,
    filename: a.filename,
    content_type: a.contentType,
    size: a.size,
    provider,
    provider_attachment_id: a.providerAttachmentId,
    connection_id: connectionId,
    message_uid: messageUid || null,
  }));
  const { error } = await supabaseAdmin.from("email_attachments").insert(rows);
  if (error) {
    console.error("[auto-sync] attachment meta insert error:", error.message);
  }
}

async function syncGmailForUser(conn: any): Promise<number> {
  try {
    const oauth2Client = getGoogleOAuth2Client();
    oauth2Client.setCredentials({
      access_token: conn.access_token,
      refresh_token: conn.refresh_token,
    });

    oauth2Client.on("tokens", async (tokens) => {
      const updates: Record<string, any> = {};
      if (tokens.access_token) updates.access_token = tokens.access_token;
      if (tokens.refresh_token) updates.refresh_token = tokens.refresh_token;
      if (tokens.expiry_date) updates.token_expires_at = new Date(tokens.expiry_date).toISOString();

      if (Object.keys(updates).length > 0) {
        const { error } = await supabaseAdmin
          .from("email_connections")
          .update(updates)
          .eq("id", conn.id);
        if (error) console.error("[auto-sync] Gmail token update error:", error.message);
      }
    });

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    const { data: messageList } = await gmail.users.messages.list({
      userId: "me",
      maxResults: 10,
      q: "is:inbox newer_than:1d",
    });

    if (!messageList.messages) return 0;

    let synced = 0;
    for (const msg of messageList.messages) {
      const { data: fullMsg } = await gmail.users.messages.get({
        userId: "me",
        id: msg.id!,
        format: "full",
      });

      const headers = fullMsg.payload?.headers || [];
      const from = headers.find((h) => h.name === "From")?.value || "Inconnu";
      const subject = headers.find((h) => h.name === "Subject")?.value || "(pas de sujet)";
      const emailBody = extractGmailBody(fullMsg.payload) || fullMsg.snippet || "";

      const scopedExternalId = `${conn.id}:${msg.id!}`;
      const savedId = await saveEmailWithTriage(
        conn.user_id,
        scopedExternalId,
        from,
        subject,
        emailBody,
        new Date(parseInt(fullMsg.internalDate || "0")).toISOString(),
        (conn as any)._sharedMailboxId
      );

      if (savedId) {
        synced++;
        const gmailAttachments = extractGmailAttachments(fullMsg.payload);
        if (gmailAttachments.length > 0) {
          await saveAttachmentsMeta(savedId, gmailAttachments, "gmail", conn.id, msg.id!);
        }
      }
    }

    if (synced > 0) {
      await supabaseAdmin
        .from("email_connections")
        .update({ last_synced_at: new Date().toISOString() })
        .eq("id", conn.id);
    }

    return synced;
  } catch (err: any) {
    console.error(`[auto-sync] Gmail error for ${conn.email_address}:`, err.message);
    return 0;
  }
}

async function syncOutlookForUser(conn: any): Promise<number> {
  try {
    let accessToken = conn.access_token;
    const MICROSOFT_CLIENT_ID = process.env["MICROSOFT_CLIENT_ID"] || "";
    const MICROSOFT_CLIENT_SECRET = process.env["MICROSOFT_CLIENT_SECRET"] || "";

    if (conn.token_expires_at && new Date(conn.token_expires_at) < new Date()) {
      if (!MICROSOFT_CLIENT_ID || !MICROSOFT_CLIENT_SECRET) {
        console.error("[auto-sync] Outlook: missing Microsoft credentials, cannot refresh token");
        return 0;
      }
      const tokenResponse = await fetch(
        "https://login.microsoftonline.com/common/oauth2/v2.0/token",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: MICROSOFT_CLIENT_ID,
            client_secret: MICROSOFT_CLIENT_SECRET,
            refresh_token: conn.refresh_token,
            grant_type: "refresh_token",
            scope: "Mail.Read offline_access",
          }),
        }
      );

      if (!tokenResponse.ok) {
        console.error(`[auto-sync] Outlook token refresh failed: ${tokenResponse.status} ${tokenResponse.statusText}`);
        return 0;
      }

      const tokens = (await tokenResponse.json()) as any;
      if (!tokens.access_token) {
        console.error("[auto-sync] Outlook token refresh: no access_token in response");
        return 0;
      }

      accessToken = tokens.access_token;
      const updates: Record<string, any> = {
        access_token: tokens.access_token,
        token_expires_at: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(),
      };
      if (tokens.refresh_token) updates.refresh_token = tokens.refresh_token;

      await supabaseAdmin
        .from("email_connections")
        .update(updates)
        .eq("id", conn.id);
    }

    const filterDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const graphUrl = `https://graph.microsoft.com/v1.0/me/messages?$top=10&$orderby=receivedDateTime desc&$select=id,from,subject,bodyPreview,receivedDateTime&$filter=receivedDateTime ge ${filterDate}`;

    const response = await fetch(graphUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      console.error(`[auto-sync] Outlook Graph API error: ${response.status} ${response.statusText}`);
      return 0;
    }

    const data = (await response.json()) as any;
    if (!data.value) return 0;

    let synced = 0;
    for (const msg of data.value) {
      const senderEmail = msg.from?.emailAddress?.address || "Inconnu";
      const senderName = msg.from?.emailAddress?.name || senderEmail;

      const scopedExternalId = `${conn.id}:${msg.id}`;
      const savedId = await saveEmailWithTriage(
        conn.user_id,
        scopedExternalId,
        `${senderName} <${senderEmail}>`,
        msg.subject || "(pas de sujet)",
        msg.bodyPreview || "",
        msg.receivedDateTime,
        (conn as any)._sharedMailboxId
      );

      if (savedId) synced++;
    }

    if (synced > 0) {
      await supabaseAdmin
        .from("email_connections")
        .update({ last_synced_at: new Date().toISOString() })
        .eq("id", conn.id);
    }

    return synced;
  } catch (err: any) {
    console.error(`[auto-sync] Outlook error for ${conn.email_address}:`, err.message);
    return 0;
  }
}

async function syncImapForUser(conn: any): Promise<number> {
  const log = logger.child({ service: "imap-sync", email: conn.email_address, connId: conn.id });

  let imapConfig: { host: string; port: number } = { host: "imap.gmail.com", port: 993 };
  try {
    if (conn.refresh_token) imapConfig = JSON.parse(conn.refresh_token);
  } catch (parseErr: any) {
    log.error(`IMAP config parse failed: ${parseErr.message}`);
    return -1;
  }

  log.info({ host: imapConfig.host, port: imapConfig.port }, "Starting IMAP sync");

  if (!isValidImapHost(imapConfig.host)) {
    log.error({ host: imapConfig.host }, "IMAP blocked: invalid host");
    return -1;
  }

  const port = Number(imapConfig.port);
  if (!port || port < 1 || port > 65535) {
    log.error({ port: imapConfig.port }, "IMAP blocked: invalid port");
    return -1;
  }

  const client = new ImapFlow({
    host: imapConfig.host,
    port,
    secure: true,
    auth: { user: conn.email_address, pass: conn.access_token },
    logger: false,
  });

  try {
    let timeoutId: ReturnType<typeof setTimeout>;
    await Promise.race([
      client.connect(),
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error("IMAP connect timeout after 20s")), 20_000);
      }),
    ]);
    clearTimeout(timeoutId!);
    log.info("IMAP connected successfully");
  } catch (connErr: any) {
    log.error({ error: connErr.message }, "IMAP connection failed");
    try { await client.logout(); } catch {}
    return -1;
  }

  let lock: MailboxLockObject;
  try {
    lock = await client.getMailboxLock("INBOX");
    log.info("INBOX lock acquired");
  } catch (lockErr: any) {
    log.error({ error: lockErr.message }, "Failed to lock INBOX");
    try { await client.logout(); } catch {}
    return -1;
  }

  let synced = 0;
  let fetchSucceeded = false;
  let lockReleased = false;
  try {
    const mailboxStatus = client.mailbox;
    const totalMessages = mailboxStatus ? mailboxStatus.exists : 0;
    log.info({ totalMessages }, "Mailbox status");

    if (totalMessages === 0) {
      log.info("Mailbox empty, nothing to fetch");
      fetchSucceeded = true;
      lock.release();
      lockReleased = true;
      await client.logout();
      await supabaseAdmin
        .from("email_connections")
        .update({ last_synced_at: new Date().toISOString() })
        .eq("id", conn.id);
      return 0;
    }

    const startSeq = Math.max(1, totalMessages - 9);
    const range = `${startSeq}:*`;
    let fetchedCount = 0;

    for await (const msg of client.fetch(range, { envelope: true, uid: true, source: true })) {
      fetchedCount++;
      const externalId = `${conn.id}:imap_${msg.uid}`;
      const envelope = msg.envelope!;
      const from = envelope?.from?.[0];
      const sender = from?.name ? `${from.name} <${from.address}>` : from?.address || "inconnu";

      let bodyText = "";
      if (msg.source) {
        try {
          const parsed = await simpleParser(msg.source);
          bodyText = parsed.html
            ? (typeof parsed.html === "string" ? parsed.html : "")
            : parsed.text || "";
          bodyText = bodyText.slice(0, 10000);
        } catch (parseErr: any) {
          log.warn({ uid: msg.uid, error: parseErr.message }, "simpleParser failed, using raw fallback");
          try {
            const raw = msg.source.toString("utf-8");
            const bodyStart = raw.indexOf("\r\n\r\n");
            if (bodyStart !== -1) {
              bodyText = raw.slice(bodyStart + 4).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 5000);
            }
          } catch (rawErr: any) {
            log.warn({ uid: msg.uid, error: rawErr.message }, "Raw body extraction also failed");
          }
        }
      }

      let imapAttachments: AttachmentMeta[] = [];
      if (msg.source) {
        try {
          const parsedForAttach = await simpleParser(msg.source);
          if (parsedForAttach.attachments && parsedForAttach.attachments.length > 0) {
            imapAttachments = parsedForAttach.attachments.map((a) => ({
              filename: a.filename || "attachment",
              contentType: a.contentType || "application/octet-stream",
              size: a.size || 0,
              providerAttachmentId: a.contentId || a.checksum || "",
            }));
          }
        } catch {}
      }

      const savedId = await saveEmailWithTriage(
        conn.user_id,
        externalId,
        sender,
        envelope?.subject || "(pas de sujet)",
        bodyText,
        envelope?.date ? new Date(envelope.date).toISOString() : new Date().toISOString(),
        (conn as any)._sharedMailboxId
      );

      if (savedId) {
        synced++;
        if (imapAttachments.length > 0) {
          await saveAttachmentsMeta(savedId, imapAttachments, "imap", conn.id, String(msg.uid));
        }
      }
    }

    fetchSucceeded = true;
    log.info({ fetched: fetchedCount, newEmails: synced, duplicatesSkipped: fetchedCount - synced }, "IMAP fetch complete");
  } catch (fetchErr: any) {
    log.error({ error: fetchErr.message }, "Error during IMAP fetch/parse");
  } finally {
    if (!lockReleased) lock.release();
  }

  try {
    await client.logout();
  } catch {}

  if (fetchSucceeded) {
    await supabaseAdmin
      .from("email_connections")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("id", conn.id);
  }

  return fetchSucceeded ? synced : -1;
}

async function runAutoSync() {
  if (syncRunning) {
    console.log("[auto-sync] Sync already in progress, skipping");
    return;
  }

  syncRunning = true;
  const startTime = Date.now();

  try {
    const { data: connections, error: connErr } = await supabaseAdmin
      .from("email_connections")
      .select("*");

    if (connErr) {
      console.error("[auto-sync] Failed to fetch connections:", connErr.message);
      return;
    }

    if (!connections || connections.length === 0) {
      return;
    }

    console.log(`[auto-sync] Starting sync for ${connections.length} connection(s)`);

    const { data: sharedMailboxes } = await supabaseAdmin
      .from("shared_mailboxes")
      .select("id, connection_id");
    const connToSharedMailbox: Record<string, string> = {};
    if (sharedMailboxes) {
      for (const sm of sharedMailboxes) {
        if (sm.connection_id) {
          connToSharedMailbox[sm.connection_id] = sm.id;
        }
      }
    }

    for (const connId of Object.keys(connToSharedMailbox)) {
      const sharedMbId = connToSharedMailbox[connId];
      const { data: backfilledRows, error: bfError } = await supabaseAdmin
        .from("emails")
        .update({ shared_mailbox_id: sharedMbId })
        .like("external_id", `${connId}:%`)
        .is("shared_mailbox_id", null)
        .select("id");
      if (bfError) {
        console.error(`[auto-sync] Backfill error for ${connId}:`, bfError.message);
      } else if (backfilledRows && backfilledRows.length > 0) {
        console.log(`[auto-sync] Backfilled ${backfilledRows.length} email(s) for shared mailbox ${sharedMbId}`);
      } else {
        console.log(`[auto-sync] Backfill check for conn ${connId}: 0 emails to update`);
      }
    }

    let totalSynced = 0;

    for (const conn of connections) {
      try {
        (conn as any)._sharedMailboxId = connToSharedMailbox[conn.id] || null;
        let synced = 0;
        if (conn.provider === "gmail") {
          synced = await syncGmailForUser(conn);
        } else if (conn.provider === "outlook") {
          synced = await syncOutlookForUser(conn);
        } else if (conn.provider === "imap") {
          synced = await syncImapForUser(conn);
        }
        if (synced < 0) {
          console.error(`[auto-sync] ${conn.email_address} (${conn.provider}): sync failed`);
        } else {
          totalSynced += synced;
          console.log(`[auto-sync] ${conn.email_address} (${conn.provider}): ${synced} new email(s)`);
        }
      } catch (err: any) {
        console.error(`[auto-sync] Error for ${conn.email_address}:`, err.message);
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[auto-sync] Done: ${totalSynced} new email(s) in ${elapsed}s`);
  } catch (err: any) {
    console.error("[auto-sync] Fatal error:", err.message);
  } finally {
    syncRunning = false;
  }
}

export async function triggerSyncForConnection(connectionId: string): Promise<{ synced: number; success: boolean; error?: string }> {
  const { data: conn, error } = await supabaseAdmin
    .from("email_connections")
    .select("*")
    .eq("id", connectionId)
    .single();

  if (error || !conn) {
    logger.error({ connectionId }, "triggerSync: connection not found");
    return { synced: 0, success: false, error: "Connection not found" };
  }

  const { data: sharedMb } = await supabaseAdmin
    .from("shared_mailboxes")
    .select("id")
    .eq("connection_id", connectionId)
    .maybeSingle();
  (conn as any)._sharedMailboxId = sharedMb?.id || null;

  logger.info({ email: conn.email_address, provider: conn.provider }, "Immediate sync triggered");

  let synced = 0;
  try {
    if (conn.provider === "gmail") {
      synced = await syncGmailForUser(conn);
    } else if (conn.provider === "outlook") {
      synced = await syncOutlookForUser(conn);
    } else if (conn.provider === "imap") {
      synced = await syncImapForUser(conn);
    }
  } catch (err: any) {
    logger.error({ email: conn.email_address, error: err.message }, "Immediate sync failed");
    return { synced: 0, success: false, error: err.message };
  }

  if (synced < 0) {
    logger.error({ email: conn.email_address }, "Immediate sync returned error status");
    return { synced: 0, success: false, error: "IMAP connection or mailbox lock failed" };
  }

  logger.info({ email: conn.email_address, synced }, "Immediate sync done");
  return { synced, success: true };
}

export function startAutoSync() {
  console.log(`[auto-sync] Started — checking every ${SYNC_INTERVAL_MS / 1000}s`);

  setTimeout(() => {
    runAutoSync();
  }, 10_000);

  setInterval(() => {
    runAutoSync();
  }, SYNC_INTERVAL_MS);
}
