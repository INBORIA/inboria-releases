import { Router, type IRouter } from "express";
import { google } from "googleapis";
import nodemailer from "nodemailer";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth } from "../middlewares/auth";
import { resolveUploadedFiles, cleanupUploadIds } from "./attachments";
import { getMemberMailboxIds, buildInboxScopeOrFilter } from "../lib/inbox-scope";
import { moveImapMessage, moveOutlookMessage, discoverImapJunkFolder, isValidImapHost } from "../services/junk-sync";
import { hasJunkColumns, hasWaveOneColumns, hasTrackingProfileColumn } from "../lib/schema-flags";
import { ImapFlow } from "imapflow";

function parseSender(raw: string) {
  const match = raw.match(/^(.+?)\s*<(.+?)>$/);
  return {
    name: match ? match[1].trim().replace(/^"|"$/g, "") : raw,
    email: match ? match[2].trim() : raw,
  };
}

async function moveProviderMessage(
  emailRowId: string | number,
  userId: string,
  externalId: string,
  destination: "INBOX" | "JUNK" | "TRASH",
): Promise<void> {
  if (!externalId) return;

  if (externalId.startsWith("outlook:")) {
    const messageId = externalId.slice("outlook:".length);
    if (!messageId) return;
    const { data: conns } = await supabaseAdmin
      .from("email_connections")
      .select("access_token")
      .eq("user_id", userId)
      .eq("provider", "outlook");
    if (!conns || conns.length === 0) return;
    const graphDest = destination === "JUNK" ? "junkemail" : destination === "TRASH" ? "deleteditems" : "inbox";
    for (const c of conns) {
      const access = (c as any).access_token;
      if (!access) continue;
      const result = await moveOutlookMessage(access, messageId, graphDest);
      if (result.ok) {
        if (result.newId && result.newId !== messageId) {
          await supabaseAdmin
            .from("emails")
            .update({ external_id: `outlook:${result.newId}` })
            .eq("id", emailRowId);
        }
        return;
      }
    }
    return;
  }

  const isImapInbox = externalId.startsWith("imap:");
  const isImapJunk = externalId.startsWith("imap-junk:");
  if (!isImapInbox && !isImapJunk) return;

  const parts = externalId.split(":");
  if (parts.length < 3) return;
  const emailAddress = parts.slice(1, -1).join(":");
  const uidStr = parts[parts.length - 1];
  const uid = parseInt(uidStr, 10);
  if (!uid || !emailAddress) return;

  const { data: conn } = await supabaseAdmin
    .from("email_connections")
    .select("id, email_address, access_token, refresh_token, junk_folder_path")
    .eq("user_id", userId)
    .eq("provider", "imap")
    .eq("email_address", emailAddress)
    .maybeSingle();
  if (!conn) return;

  let fromFolder: string;
  if (isImapJunk) {
    fromFolder = (conn as any).junk_folder_path || "";
    if (!fromFolder) {
      let cfg: { host: string; port: number };
      try {
        cfg = JSON.parse((conn as any).refresh_token);
      } catch {
        return;
      }
      if (!isValidImapHost(cfg.host)) return;
      try {
        const probe = new ImapFlow({
          host: cfg.host,
          port: Number(cfg.port) || 993,
          secure: true,
          auth: { user: (conn as any).email_address, pass: (conn as any).access_token },
          logger: false,
        });
        await probe.connect();
        const discovered = await discoverImapJunkFolder(probe, null);
        await probe.logout().catch(() => {});
        if (!discovered) return;
        fromFolder = discovered;
      } catch {
        return;
      }
    }
  } else {
    fromFolder = "INBOX";
  }

  const moveResult = await moveImapMessage(conn as any, uid, fromFolder, destination);
  if (moveResult.ok && moveResult.newUid) {
    const newPrefix = destination === "JUNK" ? "imap-junk:" : "imap:";
    await supabaseAdmin
      .from("emails")
      .update({ external_id: `${newPrefix}${emailAddress}:${moveResult.newUid}` })
      .eq("id", emailRowId);
  }
}

const router: IRouter = Router();

router.get("/emails", requireAuth, async (req, res): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit as string, 10) || 50));
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const memberMailboxIds = await getMemberMailboxIds(req.userId!);
    const scopeOr = buildInboxScopeOrFilter(req.userId!, memberMailboxIds);

    let countQuery = supabaseAdmin
      .from("emails")
      .select("id", { count: "exact", head: true })
      .or(scopeOr);

    // Note: on n'inclut PAS `body` ici — il peut peser plusieurs Mo par mail
    // (HTML de newsletters) et n'est jamais affiche dans la liste.
    // Le body est recupere par /emails/:id quand l'utilisateur ouvre un mail.
    const wave1 = await hasWaveOneColumns();
    const wave1Cols = wave1 ? ", snoozed_until, sent_at, opened_at, opened_count" : "";
    let query = supabaseAdmin
      .from("emails")
      .select(
        `id, sender, subject, status, priority, summary, category_id, project_id, reply_to_email_id, recipient, assigned_to, assigned_at, created_at, shared_mailbox_id${wave1Cols}${(await hasJunkColumns()) ? ", spam_source" : ""}, categories(name), projects(name, reference)`
      )
      .or(scopeOr)
      .order("created_at", { ascending: false });

    if (req.query.priority) {
      query = query.eq("priority", req.query.priority as string);
      countQuery = countQuery.eq("priority", req.query.priority as string);
    }
    if (req.query.categoryId) {
      query = query.eq("category_id", req.query.categoryId as string);
      countQuery = countQuery.eq("category_id", req.query.categoryId as string);
    }
    const wantsSnoozed = req.query.snoozed === "1" || req.query.snoozed === "true";
    if (req.query.status) {
      query = query.eq("status", req.query.status as string);
      countQuery = countQuery.eq("status", req.query.status as string);
    } else {
      query = query
        .neq("status", "archived")
        .neq("status", "trashed")
        .neq("status", "spam")
        .neq("status", "sent")
        .neq("status", "scheduled")
        .neq("status", "scheduled_failed");
      countQuery = countQuery
        .neq("status", "archived")
        .neq("status", "trashed")
        .neq("status", "spam")
        .neq("status", "sent")
        .neq("status", "scheduled")
        .neq("status", "scheduled_failed");
    }
    if (wave1) {
      if (wantsSnoozed) {
        const nowIso = new Date().toISOString();
        query = query.not("snoozed_until", "is", null).gt("snoozed_until", nowIso);
        countQuery = countQuery.not("snoozed_until", "is", null).gt("snoozed_until", nowIso);
      } else {
        const nowIso = new Date().toISOString();
        query = query.or(`snoozed_until.is.null,snoozed_until.lte.${nowIso}`);
        countQuery = countQuery.or(`snoozed_until.is.null,snoozed_until.lte.${nowIso}`);
      }
    }
    if (req.query.projectId) {
      query = query.eq("project_id", req.query.projectId as string);
      countQuery = countQuery.eq("project_id", req.query.projectId as string);
    }
    if (req.query.q) {
      const raw = (req.query.q as string).trim();
      if (raw) {
        const escaped = raw.replace(/[%_\\,()."']/g, (c) => `\\${c}`);
        const term = `%${escaped}%`;
        const orFilter = `subject.ilike.${term},sender.ilike.${term},summary.ilike.${term}`;
        query = query.or(orFilter);
        countQuery = countQuery.or(orFilter);
      }
    }

    query = query.range(from, to);

    const [{ count: total }, { data: emails, error }] = await Promise.all([
      countQuery,
      query,
    ]);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    const emailIds = (emails || []).map((e: any) => e.id);
    let taskCountMap: Record<number, number> = {};
    let attachmentCountMap: Record<number, number> = {};
    if (emailIds.length > 0) {
      const [{ data: taskRows }, { data: attachRows }] = await Promise.all([
        supabaseAdmin
          .from("tasks")
          .select("email_id")
          .in("email_id", emailIds)
          .eq("user_id", req.userId!),
        supabaseAdmin
          .from("email_attachments")
          .select("email_id")
          .in("email_id", emailIds),
      ]);
      (taskRows || []).forEach((t: any) => {
        taskCountMap[t.email_id] = (taskCountMap[t.email_id] || 0) + 1;
      });
      (attachRows || []).forEach((a: any) => {
        attachmentCountMap[a.email_id] = (attachmentCountMap[a.email_id] || 0) + 1;
      });
    }

    const totalCount = total || 0;

    res.json({
      emails: (emails || []).map((e: any) => {
        const s = parseSender(e.sender || "");
        return {
          id: e.id,
          sender: s.name,
          senderEmail: s.email,
          subject: e.subject,
          status: e.status,
          priority: e.priority || "faible",
          summary: e.summary,
          categoryId: e.category_id,
          categoryName: e.categories?.name || null,
          projectId: e.project_id,
          projectName: e.projects?.name || null,
          projectReference: e.projects?.reference || null,
          replyToEmailId: e.reply_to_email_id || null,
          recipient: e.recipient || null,
          assignedTo: e.assigned_to || null,
          assignedAt: e.assigned_at || null,
          spamSource: e.spam_source || null,
          snoozedUntil: e.snoozed_until || null,
          sentAt: e.sent_at || null,
          openedAt: e.opened_at || null,
          openedCount: e.opened_count || 0,
          taskCount: taskCountMap[e.id] || 0,
          attachmentCount: attachmentCountMap[e.id] || 0,
          createdAt: e.created_at,
        };
      }),
      total: totalCount,
      page,
      totalPages: Math.ceil(totalCount / limit),
    });
  } catch {
    res.status(500).json({ error: "Failed to list emails" });
  }
});

router.get("/emails/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const { data: email, error } = await supabaseAdmin
      .from("emails")
      .select("*, categories(name), projects(name, reference)")
      .eq("id", req.params.id)
      .eq("user_id", req.userId!)
      .single();

    if (error || !email) {
      res.status(404).json({ error: "Email not found" });
      return;
    }

    const s = parseSender(email.sender || "");

    let assignedToName: string | null = null;
    if (email.assigned_to) {
      const { data: ap } = await supabaseAdmin
        .from("profiles")
        .select("full_name")
        .eq("id", email.assigned_to)
        .single();
      assignedToName = ap?.full_name || null;
    }

    const { data: attachments } = await supabaseAdmin
      .from("email_attachments")
      .select("id, filename, content_type, size, created_at")
      .eq("email_id", email.id);

    res.json({
      id: email.id,
      sender: s.name,
      senderEmail: s.email,
      subject: email.subject,
      body: email.body,
      status: email.status,
      priority: email.priority || "faible",
      summary: email.summary,
      categoryId: email.category_id,
      categoryName: email.categories?.name || null,
      projectId: email.project_id,
      projectName: email.projects?.name || null,
      projectReference: email.projects?.reference || null,
      assignedTo: email.assigned_to || null,
      assignedToName,
      assignedAt: email.assigned_at || null,
      spamSource: email.spam_source || null,
      snoozedUntil: (email as any).snoozed_until || null,
      sentAt: (email as any).sent_at || null,
      openedAt: (email as any).opened_at || null,
      openedCount: (email as any).opened_count || 0,
      attachments: attachments || [],
      attachmentCount: (attachments || []).length,
      createdAt: email.created_at,
    });
  } catch {
    res.status(500).json({ error: "Failed to get email" });
  }
});

router.patch("/emails/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const { data: oldEmail } = await supabaseAdmin
      .from("emails")
      .select("sender, priority, category_id, status, external_id")
      .eq("id", req.params.id)
      .eq("user_id", req.userId!)
      .single();

    const updates: Record<string, unknown> = {};
    if (req.body.categoryId !== undefined) updates.category_id = req.body.categoryId;
    if (req.body.status !== undefined) updates.status = req.body.status;
    if (req.body.priority !== undefined) updates.priority = req.body.priority;
    if (req.body.projectId !== undefined) updates.project_id = req.body.projectId;
    if (req.body.status !== undefined && oldEmail) {
      const newStatus = req.body.status as string;
      const wasSpam = oldEmail.status === "spam";
      const isSpam = newStatus === "spam";
      if (wasSpam !== isSpam && (await hasJunkColumns())) {
        updates.spam_source = isSpam ? "user" : null;
      }
    }

    const { data: email, error } = await supabaseAdmin
      .from("emails")
      .update(updates)
      .eq("id", req.params.id)
      .eq("user_id", req.userId!)
      .select("*, categories(name)")
      .single();

    if (error || !email) {
      res.status(404).json({ error: "Email not found" });
      return;
    }

    if (oldEmail && (req.body.priority || req.body.categoryId !== undefined)) {
      const senderRaw = oldEmail.sender || "";
      const emailMatch = senderRaw.match(/<(.+?)>/);
      const senderDomain = emailMatch ? emailMatch[1].split("@")[1] : senderRaw.split("@")[1] || senderRaw;

      if (senderDomain) {
        const ruleUpdate: Record<string, unknown> = {
          user_id: req.userId!,
          sender_pattern: senderDomain,
        };
        if (req.body.priority) ruleUpdate.forced_priority = req.body.priority;
        if (req.body.categoryId !== undefined) {
          const catName = email.categories?.name || null;
          if (catName) ruleUpdate.forced_category = catName;
        }

        const { data: existingRule } = await supabaseAdmin
          .from("ai_rules")
          .select("id")
          .eq("user_id", req.userId!)
          .eq("sender_pattern", senderDomain)
          .maybeSingle();

        if (existingRule) {
          const ruleFields: Record<string, unknown> = {};
          if (ruleUpdate.forced_priority) ruleFields.forced_priority = ruleUpdate.forced_priority;
          if (ruleUpdate.forced_category) ruleFields.forced_category = ruleUpdate.forced_category;
          await supabaseAdmin.from("ai_rules").update(ruleFields).eq("id", existingRule.id);
        } else {
          await supabaseAdmin.from("ai_rules").insert(ruleUpdate);
        }
      }
    }

    if (req.body.status !== undefined && oldEmail) {
      const newStatus = req.body.status as string;
      const wasSpam = oldEmail.status === "spam";
      const isSpam = newStatus === "spam";
      if (wasSpam !== isSpam) {
        moveProviderMessage(email.id, req.userId!, oldEmail.external_id || "", isSpam ? "JUNK" : "INBOX")
          .catch((err: any) => console.error("[emails.patch] provider move error:", err?.message));
      }
    }

    const s = parseSender(email.sender || "");
    res.json({
      id: email.id,
      sender: s.name,
      senderEmail: s.email,
      subject: email.subject,
      body: email.body,
      status: email.status,
      priority: email.priority || "faible",
      summary: email.summary,
      categoryId: email.category_id,
      categoryName: email.categories?.name || null,
      assignedTo: email.assigned_to || null,
      assignedAt: email.assigned_at || null,
      spamSource: (email as any).spam_source || null,
      createdAt: email.created_at,
    });
  } catch {
    res.status(500).json({ error: "Failed to update email" });
  }
});

interface ResolvedAttachment {
  serverPath: string;
  filename: string;
  contentType: string;
  size: number;
}

function sanitizeMimeHeader(value: string): string {
  return value.replace(/[\r\n]/g, "");
}

function rfc2047Encode(value: string): string {
  if (/^[\x20-\x7E]*$/.test(value)) return sanitizeMimeHeader(value);
  return `=?UTF-8?B?${Buffer.from(value, "utf-8").toString("base64")}?=`;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[\r\n"\\]/g, "_");
}

function buildMimeWithAttachments(
  to: string,
  from: string,
  subject: string,
  bodyText: string,
  attachments: ResolvedAttachment[],
  extraHeaders: string[] = []
): string {
  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const lines: string[] = [
    `To: ${sanitizeMimeHeader(to)}`,
    `From: ${sanitizeMimeHeader(from)}`,
    `Subject: ${rfc2047Encode(subject)}`,
    `MIME-Version: 1.0`,
    ...extraHeaders.map(sanitizeMimeHeader),
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    `Content-Type: text/plain; charset=utf-8`,
    `Content-Transfer-Encoding: base64`,
    "",
    Buffer.from(bodyText, "utf-8").toString("base64"),
  ];

  for (const att of attachments) {
    const safeName = sanitizeFilename(att.filename);
    const content = fs.readFileSync(att.serverPath);
    lines.push(
      `--${boundary}`,
      `Content-Type: ${sanitizeMimeHeader(att.contentType)}; name="${safeName}"`,
      `Content-Disposition: attachment; filename="${safeName}"`,
      `Content-Transfer-Encoding: base64`,
      "",
      content.toString("base64")
    );
  }

  lines.push(`--${boundary}--`);
  return lines.join("\r\n");
}

function detectAppointmentInBody(body: string): { startAt: Date; endAt: Date; title: string } | null {
  if (!body || body.length > 20000) return null;
  const lower = body.toLowerCase();
  const keywordRx = /\b(rendez-?vous|rdv|meeting|appointment|reuni[oó]n|treffen|afspraak|call|visio|entretien|zoom|teams|google\s*meet)\b/i;
  if (!keywordRx.test(lower)) return null;

  const months: Record<string, number> = {
    janvier: 0, january: 0, januar: 0, januari: 0, enero: 0,
    fevrier: 1, "février": 1, february: 1, februar: 1, februari: 1, febrero: 1,
    mars: 2, march: 2, "märz": 2, marzo: 2, maart: 2,
    avril: 3, april: 3, abril: 3,
    mai: 4, may: 4, mei: 4, mayo: 4,
    juin: 5, june: 5, juni: 5, junio: 5,
    juillet: 6, july: 6, juli: 6, julio: 6,
    aout: 7, "août": 7, august: 7, augustus: 7, agosto: 7,
    septembre: 8, september: 8, septiembre: 8,
    octobre: 9, october: 9, oktober: 9, octubre: 9,
    novembre: 10, november: 10, noviembre: 10,
    decembre: 11, "décembre": 11, december: 11, dezember: 11, diciembre: 11,
  };

  const now = new Date();
  let date: Date | null = null;

  const buildDateStrict = (y: number, m: number, d: number): Date | null => {
    const dt = new Date(y, m, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== m || dt.getDate() !== d) return null;
    return dt;
  };

  const numericRx = /\b(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?\b/;
  const numMatch = body.match(numericRx);
  if (numMatch) {
    const d = parseInt(numMatch[1] || "0", 10);
    const m = parseInt(numMatch[2] || "0", 10) - 1;
    let y = numMatch[3] ? parseInt(numMatch[3], 10) : now.getFullYear();
    if (y < 100) y += 2000;
    if (d >= 1 && d <= 31 && m >= 0 && m <= 11) {
      date = buildDateStrict(y, m, d);
    }
  }

  if (!date) {
    const monthNames = Object.keys(months).join("|");
    const textRx = new RegExp(`\\b(\\d{1,2})\\s+(${monthNames})(?:\\s+(\\d{4}))?\\b`, "i");
    const textMatch = body.match(textRx);
    if (textMatch) {
      const d = parseInt(textMatch[1] || "0", 10);
      const monthKey = (textMatch[2] || "").toLowerCase();
      const m = months[monthKey];
      const y = textMatch[3] ? parseInt(textMatch[3], 10) : now.getFullYear();
      if (m !== undefined && d >= 1 && d <= 31) {
        date = buildDateStrict(y, m, d);
      }
    }
  }

  if (!date) return null;

  const timeRx = /\b([01]?\d|2[0-3])\s*[h:]\s*(\d{2})?\s*(am|pm)?\b/i;
  const timeMatch = body.match(timeRx);
  let hour = 9;
  let minute = 0;
  if (timeMatch) {
    hour = parseInt(timeMatch[1] || "0", 10);
    minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    const ampm = (timeMatch[3] || "").toLowerCase();
    if (ampm === "pm" && hour < 12) hour += 12;
    if (ampm === "am" && hour === 12) hour = 0;
  } else {
    return null;
  }

  date.setHours(hour, minute, 0, 0);
  if (date.getTime() < now.getTime() - 24 * 3600 * 1000) return null;

  const endAt = new Date(date.getTime() + 60 * 60 * 1000);
  return { startAt: date, endAt, title: "" };
}

router.post("/emails/send", requireAuth, async (req, res): Promise<void> => {
  const uploadIds: string[] = [];
  try {
    const { to, subject, body, replyToEmailId, attachments: rawUploadIds, connectionId, projectId } = req.body;

    const ids: string[] = Array.isArray(rawUploadIds) ? rawUploadIds.filter((x: any) => typeof x === "string") : [];
    uploadIds.push(...ids);

    if (!to || !subject || !body) {
      res.status(400).json({ error: "Destinataire, sujet et corps requis" });
      return;
    }

    const trackingProfileSupported = await hasTrackingProfileColumn();
    const wave1Supported = await hasWaveOneColumns();
    let trackingEnabled = false;
    if (trackingProfileSupported) {
      const { data: senderProfile } = await supabaseAdmin
        .from("profiles")
        .select("tracking_enabled")
        .eq("id", req.userId!)
        .maybeSingle();
      trackingEnabled = !!(senderProfile && (senderProfile as any).tracking_enabled);
    }
    let trackingPixelId: string | null = null;
    let bodyForSend: string = body;
    let useHtml: boolean = false;
    if (trackingEnabled && wave1Supported && (!ids || ids.length === 0)) {
      try {
        const { randomUUID } = await import("crypto");
        trackingPixelId = randomUUID();
        const { getBackendUrl } = await import("../lib/urls");
        const pixelUrl = `${getBackendUrl()}/api/track/open/${encodeURIComponent(trackingPixelId)}.gif`;
        const escaped = body
          .split("\n")
          .map((line: string) => line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"))
          .join("<br>");
        bodyForSend = `${escaped}<img src="${pixelUrl}" width="1" height="1" alt="" style="display:none;border:0;width:1px;height:1px" />`;
        useHtml = true;
      } catch (e: any) {
        console.warn("[tracking-pixel] failed to build pixel:", e?.message);
        trackingPixelId = null;
        bodyForSend = body;
        useHtml = false;
      }
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to.trim())) {
      res.status(400).json({ error: "Adresse email destinataire invalide. Vérifiez le format (ex: nom@domaine.com)" });
      return;
    }

    let attachments: ResolvedAttachment[] = [];
    if (ids.length > 0) {
      const resolved = resolveUploadedFiles(ids, req.userId!);
      if (!resolved) {
        res.status(400).json({ error: "Un ou plusieurs fichiers joints sont invalides ou expirés" });
        return;
      }
      attachments = resolved;
    }

    const { data: connections } = await supabaseAdmin
      .from("email_connections")
      .select("*")
      .eq("user_id", req.userId!);

    if (!connections || connections.length === 0) {
      res.status(400).json({ error: "Aucun compte email connecte" });
      return;
    }

    let conn = connections[0];
    if (connectionId) {
      const matched = connections.find((c: any) => String(c.id) === String(connectionId));
      if (!matched) {
        res.status(400).json({ error: "Invalid connectionId" });
        return;
      }
      conn = matched;
    }
    let fromAddress = conn.email_address;

    if (conn.provider === "gmail") {
      const oauth2Client = new google.auth.OAuth2(
        process.env["GOOGLE_CLIENT_ID"],
        process.env["GOOGLE_CLIENT_SECRET"]
      );
      oauth2Client.setCredentials({
        access_token: conn.access_token,
        refresh_token: conn.refresh_token,
      });

      const gmail = google.gmail({ version: "v1", auth: oauth2Client });

      const extraHeaders: string[] = [];
      if (replyToEmailId) {
        const { data: origEmail } = await supabaseAdmin
          .from("emails")
          .select("external_id")
          .eq("id", replyToEmailId)
          .eq("user_id", req.userId!)
          .single();
        if (origEmail?.external_id) {
          extraHeaders.push(`In-Reply-To: ${origEmail.external_id}`);
          extraHeaders.push(`References: ${origEmail.external_id}`);
        }
      }

      let raw: string;
      if (attachments.length > 0) {
        const mimeMessage = buildMimeWithAttachments(to, fromAddress, subject, body, attachments, extraHeaders);
        raw = Buffer.from(mimeMessage)
          .toString("base64")
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=+$/, "");
      } else {
        const messageParts = [
          `To: ${to}`,
          `From: ${fromAddress}`,
          `Subject: ${subject}`,
          ...extraHeaders,
          `Content-Type: ${useHtml ? "text/html" : "text/plain"}; charset=utf-8`,
          "",
          useHtml ? bodyForSend : body,
        ];
        raw = Buffer.from(messageParts.join("\r\n"))
          .toString("base64")
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=+$/, "");
      }

      await gmail.users.messages.send({
        userId: "me",
        requestBody: { raw },
      });
    } else if (conn.provider === "outlook") {
      let accessToken = conn.access_token;

      if (conn.token_expires_at && new Date(conn.token_expires_at) < new Date()) {
        const tokenResp = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: process.env["MICROSOFT_CLIENT_ID"] || "",
            client_secret: process.env["MICROSOFT_CLIENT_SECRET"] || "",
            refresh_token: conn.refresh_token,
            grant_type: "refresh_token",
            scope: "openid email Mail.Read Mail.Send offline_access",
          }),
        });
        const newTokens = await tokenResp.json() as any;
        if (newTokens.access_token) {
          accessToken = newTokens.access_token;
          await supabaseAdmin.from("email_connections").update({
            access_token: newTokens.access_token,
            token_expires_at: new Date(Date.now() + newTokens.expires_in * 1000).toISOString(),
          }).eq("id", conn.id);
        }
      }

      const mailBody: any = {
        message: {
          subject,
          body: { contentType: useHtml ? "HTML" : "Text", content: useHtml ? bodyForSend : body },
          toRecipients: [{ emailAddress: { address: to } }],
          attachments: attachments.map((att) => ({
            "@odata.type": "#microsoft.graph.fileAttachment",
            name: att.filename,
            contentType: att.contentType,
            contentBytes: fs.readFileSync(att.serverPath).toString("base64"),
          })),
        },
        saveToSentItems: true,
      };

      const graphResp = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(mailBody),
      });

      if (!graphResp.ok) {
        const errBody = await graphResp.text();
        console.error("Outlook send error:", errBody);
        res.status(500).json({ error: "Echec de l'envoi via Outlook" });
        return;
      }
    } else {
      let imapConfig: { host: string; port: number } = { host: "", port: 993 };
      try {
        imapConfig = JSON.parse(conn.refresh_token);
      } catch {}

      const smtpHost = imapConfig.host.replace(/^imap\./, "smtp.");
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: 587,
        secure: false,
        auth: { user: conn.email_address, pass: conn.access_token },
        tls: { rejectUnauthorized: true },
      });

      await transporter.sendMail({
        from: conn.email_address,
        to,
        subject,
        ...(useHtml ? { html: bodyForSend } : { text: body }),
        attachments: attachments.map((att) => ({
          filename: att.filename,
          path: att.serverPath,
          contentType: att.contentType,
        })),
      });
    }

    const insertPayload: Record<string, any> = {
      user_id: req.userId!,
      sender: fromAddress,
      recipient: to,
      subject,
      body,
      status: "sent",
      priority: "faible",
      external_id: null,
      reply_to_email_id: replyToEmailId || null,
    };
    if (wave1Supported) {
      insertPayload.sent_at = new Date().toISOString();
      if (trackingPixelId) {
        insertPayload.tracking_pixel_id = trackingPixelId;
      }
    }
    let validatedProjectId: string | null = null;
    if (projectId) {
      const { data: ownedProject } = await supabaseAdmin
        .from("projects")
        .select("id")
        .eq("user_id", req.userId!)
        .eq("id", projectId)
        .maybeSingle();
      if (ownedProject) {
        validatedProjectId = String(ownedProject.id);
        insertPayload.project_id = validatedProjectId;
      }
    }

    const { data: sentEmail, error: insertError } = await supabaseAdmin
      .from("emails")
      .insert(insertPayload)
      .select("id")
      .single();

    if (insertError) {
      console.error("Failed to save sent email to DB:", insertError.message);
    }

    if (sentEmail?.id && attachments.length > 0) {
      const attachRows = attachments.map((att) => ({
        email_id: sentEmail.id,
        filename: att.filename,
        content_type: att.contentType,
        size: att.size,
        provider: "sent",
        provider_attachment_id: null,
        connection_id: conn.id,
        message_uid: null,
      }));
      const { error: attErr } = await supabaseAdmin.from("email_attachments").insert(attachRows);
      if (attErr) {
        console.error("Failed to save sent attachment metadata:", attErr.message);
      }
    }

    let appointmentId: number | string | null = null;
    if (sentEmail?.id) {
      try {
        const detected = detectAppointmentInBody(body);
        if (detected) {
          const { data: appt, error: apptErr } = await supabaseAdmin
            .from("appointments")
            .insert({
              user_id: req.userId!,
              title: subject || "Rendez-vous",
              description: body.slice(0, 500),
              location: null,
              start_at: detected.startAt.toISOString(),
              end_at: detected.endAt.toISOString(),
              all_day: false,
              email_id: sentEmail.id,
              project_id: validatedProjectId,
              reminder_minutes: 30,
              participants: typeof to === "string" ? to : null,
              confirmed: false,
            })
            .select("id")
            .single();
          if (!apptErr && appt) appointmentId = appt.id;
          else if (apptErr) console.error("Failed to create proposed appointment:", apptErr.message);
        }
      } catch (e: any) {
        console.error("Appointment detection failed:", e.message);
      }
    }

    res.json({ success: true, emailId: sentEmail?.id, appointmentId });
  } catch (err: any) {
    console.error("Send email error:", err);
    res.status(500).json({ error: "Echec de l'envoi: " + (err.message || "Erreur inconnue") });
  } finally {
    if (uploadIds.length > 0) {
      cleanupUploadIds(uploadIds);
    }
  }
});

router.get("/emails/:id/conversation", requireAuth, async (req, res): Promise<void> => {
  try {
    const emailId = parseInt(req.params.id as string, 10);
    if (isNaN(emailId)) { res.status(400).json({ error: "ID invalide" }); return; }

    const { data: email, error } = await supabaseAdmin
      .from("emails")
      .select("*, categories(name), projects(name, reference)")
      .eq("id", emailId)
      .eq("user_id", req.userId!)
      .single();

    if (error || !email) { res.status(404).json({ error: "Email non trouve" }); return; }

    const thread: any[] = [];

    if (email.status === "sent" && email.reply_to_email_id) {
      const { data: original } = await supabaseAdmin
        .from("emails")
        .select("*, categories(name), projects(name, reference)")
        .eq("id", email.reply_to_email_id)
        .eq("user_id", req.userId!)
        .single();
      if (original) thread.push({ ...original, role: "received" });
      thread.push({ ...email, role: "sent" });
    } else {
      thread.push({ ...email, role: email.status === "sent" ? "sent" : "received" });
    }

    const { data: replies } = await supabaseAdmin
      .from("emails")
      .select("*, categories(name), projects(name, reference)")
      .eq("reply_to_email_id", emailId)
      .eq("user_id", req.userId!)
      .order("created_at", { ascending: true });

    for (const reply of replies || []) {
      if (!thread.find((t) => t.id === reply.id)) {
        thread.push({ ...reply, role: reply.status === "sent" ? "sent" : "received" });
      }
    }

    if (email.status !== "sent") {
      const { data: sentReplies } = await supabaseAdmin
        .from("emails")
        .select("*, categories(name), projects(name, reference)")
        .eq("reply_to_email_id", emailId)
        .eq("user_id", req.userId!)
        .eq("status", "sent")
        .order("created_at", { ascending: true });
      for (const r of sentReplies || []) {
        if (!thread.find((t) => t.id === r.id)) {
          thread.push({ ...r, role: "sent" });
        }
      }
    }

    thread.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    const threadIds = thread.map((t) => t.id);
    let attachmentMap: Record<number, any[]> = {};
    if (threadIds.length > 0) {
      const { data: allAttachments } = await supabaseAdmin
        .from("email_attachments")
        .select("id, email_id, filename, content_type, size, created_at")
        .in("email_id", threadIds);
      for (const att of allAttachments || []) {
        if (!attachmentMap[att.email_id]) attachmentMap[att.email_id] = [];
        attachmentMap[att.email_id].push({
          id: att.id,
          filename: att.filename,
          content_type: att.content_type,
          size: att.size,
          created_at: att.created_at,
        });
      }
    }

    const mapEmail = (e: any) => {
      const s = parseSender(e.sender || "");
      return {
        id: e.id,
        sender: s.name,
        senderEmail: s.email,
        recipient: e.recipient || null,
        subject: e.subject,
        body: e.body,
        status: e.status,
        priority: e.priority || "faible",
        summary: e.summary,
        categoryId: e.category_id,
        categoryName: e.categories?.name || null,
        projectId: e.project_id,
        projectName: e.projects?.name || null,
        projectReference: e.projects?.reference || null,
        replyToEmailId: e.reply_to_email_id || null,
        attachments: attachmentMap[e.id] || [],
        attachmentCount: (attachmentMap[e.id] || []).length,
        createdAt: e.created_at,
        role: e.role,
      };
    };

    res.json({
      email: mapEmail({ ...email, role: email.status === "sent" ? "sent" : "received" }),
      thread: thread.map(mapEmail),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/emails/bulk", requireAuth, async (req, res): Promise<void> => {
  try {
    const { ids, action } = req.body;
    if (!Array.isArray(ids) || ids.length === 0 || !["delete", "archive", "read"].includes(action)) {
      res.status(400).json({ error: "ids (array) et action (delete|archive|read) requis" });
      return;
    }

    const sanitizedIds = [...new Set(ids.map(Number).filter((n: number) => Number.isInteger(n) && n > 0))].slice(0, 500);
    if (sanitizedIds.length === 0) {
      res.status(400).json({ error: "Aucun identifiant valide fourni" });
      return;
    }

    let affected = 0;
    let error: any = null;

    if (action === "delete") {
      const result = await supabaseAdmin
        .from("emails")
        .update({ status: "trashed" })
        .in("id", sanitizedIds)
        .eq("user_id", req.userId!)
        .select("id");
      error = result.error;
      affected = result.data?.length || 0;
    } else if (action === "archive") {
      const result = await supabaseAdmin
        .from("emails")
        .update({ status: "archived" })
        .in("id", sanitizedIds)
        .eq("user_id", req.userId!)
        .select("id");
      error = result.error;
      affected = result.data?.length || 0;
    } else if (action === "read") {
      const result = await supabaseAdmin
        .from("emails")
        .update({ status: "read" })
        .in("id", sanitizedIds)
        .eq("user_id", req.userId!)
        .select("id");
      error = result.error;
      affected = result.data?.length || 0;
    }

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ success: true, affected });
  } catch {
    res.status(500).json({ error: "Erreur lors de l'action groupée" });
  }
});

router.delete("/emails/trash/empty", requireAuth, async (req, res): Promise<void> => {
  try {
    const { data: trashedEmails } = await supabaseAdmin
      .from("emails")
      .select("id")
      .eq("user_id", req.userId!)
      .eq("status", "trashed");

    if (trashedEmails && trashedEmails.length > 0) {
      const trashedIds = trashedEmails.map((e: any) => e.id);

      await supabaseAdmin
        .from("tasks")
        .delete()
        .in("email_id", trashedIds)
        .eq("user_id", req.userId!);

      await supabaseAdmin
        .from("appointments")
        .delete()
        .in("email_id", trashedIds)
        .eq("user_id", req.userId!);
    }

    const { error } = await supabaseAdmin
      .from("emails")
      .delete()
      .eq("user_id", req.userId!)
      .eq("status", "trashed");

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to empty trash" });
  }
});

router.get("/emails/spam/count", requireAuth, async (req, res): Promise<void> => {
  try {
    const { count } = await supabaseAdmin
      .from("emails")
      .select("id", { count: "exact", head: true })
      .eq("user_id", req.userId!)
      .eq("status", "spam");
    res.json({ count: count || 0 });
  } catch {
    res.status(500).json({ error: "Failed to get spam count" });
  }
});

router.delete("/emails/spam/empty", requireAuth, async (req, res): Promise<void> => {
  try {
    const { data: spamEmails } = await supabaseAdmin
      .from("emails")
      .select("id, external_id")
      .eq("user_id", req.userId!)
      .eq("status", "spam");

    if (spamEmails && spamEmails.length > 0) {
      const spamIds = spamEmails.map((e: any) => e.id);
      for (const e of spamEmails as any[]) {
        if (e.external_id) {
          await moveProviderMessage(e.id, req.userId!, e.external_id, "TRASH").catch(() => undefined);
        }
      }

      await supabaseAdmin
        .from("tasks")
        .delete()
        .in("email_id", spamIds)
        .eq("user_id", req.userId!);

      await supabaseAdmin
        .from("appointments")
        .delete()
        .in("email_id", spamIds)
        .eq("user_id", req.userId!);
    }

    const { error } = await supabaseAdmin
      .from("emails")
      .delete()
      .eq("user_id", req.userId!)
      .eq("status", "spam");

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to empty spam" });
  }
});

router.delete("/emails/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const { data: existing } = await supabaseAdmin
      .from("emails")
      .select("status, external_id")
      .eq("id", req.params.id)
      .eq("user_id", req.userId!)
      .maybeSingle();

    if (existing && (existing as any).external_id && (existing as any).status !== "trashed") {
      await moveProviderMessage(
        req.params.id as any,
        req.userId!,
        (existing as any).external_id,
        "TRASH",
      ).catch(() => undefined);
    }

    const { error } = await supabaseAdmin
      .from("emails")
      .update({ status: "trashed" })
      .eq("id", req.params.id)
      .eq("user_id", req.userId!);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to trash email" });
  }
});

router.post("/emails/:id/restore", requireAuth, async (req, res): Promise<void> => {
  try {
    const { data: existing } = await supabaseAdmin
      .from("emails")
      .select("status, external_id")
      .eq("id", req.params.id)
      .eq("user_id", req.userId!)
      .maybeSingle();

    if (existing && (existing as any).external_id &&
        ((existing as any).status === "spam" || (existing as any).status === "trashed")) {
      await moveProviderMessage(
        req.params.id as any,
        req.userId!,
        (existing as any).external_id,
        "INBOX",
      ).catch(() => undefined);
    }

    const { error } = await supabaseAdmin
      .from("emails")
      .update({ status: "non_lu" })
      .eq("id", req.params.id)
      .eq("user_id", req.userId!)
      .in("status", ["trashed", "spam"]);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to restore email" });
  }
});

router.delete("/emails/:id/permanent", requireAuth, async (req, res): Promise<void> => {
  try {
    const { data: existing } = await supabaseAdmin
      .from("emails")
      .select("status, external_id")
      .eq("id", req.params.id)
      .eq("user_id", req.userId!)
      .maybeSingle();

    if (existing && (existing as any).external_id) {
      await moveProviderMessage(
        req.params.id as any,
        req.userId!,
        (existing as any).external_id,
        "TRASH",
      ).catch(() => undefined);
    }

    await supabaseAdmin
      .from("tasks")
      .delete()
      .eq("email_id", req.params.id)
      .eq("user_id", req.userId!);

    await supabaseAdmin
      .from("appointments")
      .delete()
      .eq("email_id", req.params.id)
      .eq("user_id", req.userId!);

    const { error } = await supabaseAdmin
      .from("emails")
      .delete()
      .eq("id", req.params.id)
      .eq("user_id", req.userId!)
      .in("status", ["trashed", "spam"]);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to permanently delete email" });
  }
});

// ──────────────────────── Wave 1: Snooze ────────────────────────

router.post("/emails/:id/snooze", requireAuth, async (req, res): Promise<void> => {
  try {
    if (!(await hasWaveOneColumns())) {
      res.status(503).json({ error: "Fonctionnalité non disponible : appliquez sql_wave1_quick_wins.sql dans Supabase pour activer le snooze." });
      return;
    }
    const emailId = parseInt(req.params.id as string, 10);
    if (Number.isNaN(emailId)) { res.status(400).json({ error: "ID invalide" }); return; }
    const snoozeUntilRaw = req.body?.snoozeUntil;
    if (!snoozeUntilRaw || typeof snoozeUntilRaw !== "string") {
      res.status(400).json({ error: "snoozeUntil requis (date ISO)" });
      return;
    }
    const snoozeDate = new Date(snoozeUntilRaw);
    if (Number.isNaN(snoozeDate.getTime())) {
      res.status(400).json({ error: "snoozeUntil invalide" });
      return;
    }
    if (snoozeDate.getTime() <= Date.now() + 30_000) {
      res.status(400).json({ error: "La date de réveil doit être au moins 1 minute dans le futur" });
      return;
    }

    const { error } = await supabaseAdmin
      .from("emails")
      .update({ snoozed_until: snoozeDate.toISOString() })
      .eq("id", emailId)
      .eq("user_id", req.userId!);
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json({ success: true, snoozedUntil: snoozeDate.toISOString() });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Failed to snooze" });
  }
});

router.post("/emails/:id/unsnooze", requireAuth, async (req, res): Promise<void> => {
  try {
    if (!(await hasWaveOneColumns())) {
      res.status(503).json({ error: "Fonctionnalité non disponible : appliquez sql_wave1_quick_wins.sql dans Supabase." });
      return;
    }
    const emailId = parseInt(req.params.id as string, 10);
    if (Number.isNaN(emailId)) { res.status(400).json({ error: "ID invalide" }); return; }
    const { error } = await supabaseAdmin
      .from("emails")
      .update({ snoozed_until: null })
      .eq("id", emailId)
      .eq("user_id", req.userId!);
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Failed to unsnooze" });
  }
});

// ──────────────────────── Wave 1: Scheduled send ────────────────────────

router.post("/emails/schedule", requireAuth, async (req, res): Promise<void> => {
  try {
    if (!(await hasWaveOneColumns())) {
      res.status(503).json({ error: "Envoi programmé indisponible : appliquez sql_wave1_quick_wins.sql dans Supabase." });
      return;
    }
    const { to, subject, body, replyToEmailId, connectionId, projectId, scheduledSendAt } = req.body || {};
    if (!to || !subject || !body || !scheduledSendAt) {
      res.status(400).json({ error: "Destinataire, sujet, corps et scheduledSendAt requis" });
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(String(to).trim())) {
      res.status(400).json({ error: "Adresse email destinataire invalide" });
      return;
    }
    const scheduledDate = new Date(scheduledSendAt);
    if (Number.isNaN(scheduledDate.getTime()) || scheduledDate.getTime() <= Date.now() + 30_000) {
      res.status(400).json({ error: "scheduledSendAt doit être une date ISO future (>1 min)" });
      return;
    }

    const { data: connections } = await supabaseAdmin
      .from("email_connections")
      .select("id, email_address")
      .eq("user_id", req.userId!);
    if (!connections || connections.length === 0) {
      res.status(400).json({ error: "Aucun compte email connecté" });
      return;
    }
    let chosen = connections[0] as any;
    if (connectionId) {
      const matched = connections.find((c: any) => String(c.id) === String(connectionId));
      if (!matched) { res.status(400).json({ error: "connectionId invalide" }); return; }
      chosen = matched as any;
    }

    let validatedProjectId: string | null = null;
    if (projectId) {
      const { data: ownedProject } = await supabaseAdmin
        .from("projects")
        .select("id")
        .eq("user_id", req.userId!)
        .eq("id", projectId)
        .maybeSingle();
      if (ownedProject) validatedProjectId = String((ownedProject as any).id);
    }

    let trackingEnabled = false;
    if (await hasTrackingProfileColumn()) {
      const { data: senderProfile } = await supabaseAdmin
        .from("profiles")
        .select("tracking_enabled")
        .eq("id", req.userId!)
        .maybeSingle();
      trackingEnabled = !!(senderProfile && (senderProfile as any).tracking_enabled);
    }
    let trackingPixelId: string | null = null;
    if (trackingEnabled) {
      const { randomUUID } = await import("crypto");
      trackingPixelId = randomUUID();
    }

    const insertPayload: Record<string, any> = {
      user_id: req.userId!,
      sender: chosen.email_address,
      recipient: to,
      subject,
      body,
      status: "scheduled",
      priority: "faible",
      scheduled_send_at: scheduledDate.toISOString(),
      scheduled_connection_id: chosen.id,
      reply_to_email_id: replyToEmailId || null,
    };
    if (validatedProjectId) insertPayload.project_id = validatedProjectId;
    if (trackingPixelId) insertPayload.tracking_pixel_id = trackingPixelId;

    const { data: row, error } = await supabaseAdmin
      .from("emails")
      .insert(insertPayload)
      .select("id")
      .single();
    if (error || !row) { res.status(500).json({ error: error?.message || "Insert failed" }); return; }

    res.json({ success: true, scheduledEmailId: (row as any).id, scheduledSendAt: scheduledDate.toISOString() });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Failed to schedule email" });
  }
});

router.get("/emails/scheduled", requireAuth, async (req, res): Promise<void> => {
  try {
    if (!(await hasWaveOneColumns())) {
      res.json({ emails: [] });
      return;
    }
    const { data: rows, error } = await supabaseAdmin
      .from("emails")
      .select("id, recipient, subject, body, scheduled_send_at, reply_to_email_id, project_id, created_at")
      .eq("user_id", req.userId!)
      .eq("status", "scheduled")
      .order("scheduled_send_at", { ascending: true });
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json({
      emails: (rows || []).map((r: any) => ({
        id: r.id,
        recipient: r.recipient || null,
        subject: r.subject || "",
        body: r.body || "",
        scheduledSendAt: r.scheduled_send_at,
        replyToEmailId: r.reply_to_email_id || null,
        projectId: r.project_id || null,
        createdAt: r.created_at,
      })),
    });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Failed to list scheduled emails" });
  }
});

router.delete("/emails/scheduled/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    if (!(await hasWaveOneColumns())) {
      res.status(503).json({ error: "Fonctionnalité indisponible : appliquez sql_wave1_quick_wins.sql dans Supabase." });
      return;
    }
    const emailId = parseInt(req.params.id as string, 10);
    if (Number.isNaN(emailId)) { res.status(400).json({ error: "ID invalide" }); return; }
    const { data, error } = await supabaseAdmin
      .from("emails")
      .delete()
      .eq("id", emailId)
      .eq("user_id", req.userId!)
      .eq("status", "scheduled")
      .select("id");
    if (error) { res.status(500).json({ error: error.message }); return; }
    if (!data || (data as any[]).length === 0) {
      res.status(404).json({ error: "Email programmé introuvable" });
      return;
    }
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Failed to cancel scheduled email" });
  }
});

// ──────────────────────── Wave 1: Tracking pixel (public, no auth) ────────────────────────

const TRANSPARENT_GIF_BASE64 = "R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==";
const TRANSPARENT_GIF = Buffer.from(TRANSPARENT_GIF_BASE64, "base64");

router.get("/track/open/:pixelId.gif", async (req, res): Promise<void> => {
  // Always serve the pixel — never leak whether the id exists.
  res.setHeader("Content-Type", "image/gif");
  res.setHeader("Content-Length", String(TRANSPARENT_GIF.length));
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  // Best-effort: record the open without blocking the response too long.
  try {
    const rawPixelId = req.params.pixelId || "";
    if (rawPixelId && /^[A-Za-z0-9_-]{8,128}$/.test(rawPixelId)) {
      const { data: row } = await supabaseAdmin
        .from("emails")
        .select("id, opened_at, opened_count")
        .eq("tracking_pixel_id", rawPixelId)
        .maybeSingle();
      if (row && (row as any).id) {
        const updates: Record<string, any> = {
          opened_count: ((row as any).opened_count || 0) + 1,
        };
        if (!(row as any).opened_at) {
          updates.opened_at = new Date().toISOString();
        }
        await supabaseAdmin.from("emails").update(updates).eq("id", (row as any).id);
      }
    }
  } catch {
    // swallow — pixel must always return 200
  }

  res.status(200).end(TRANSPARENT_GIF);
});

export default router;
