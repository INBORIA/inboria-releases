import { Router, type IRouter } from "express";
import { google } from "googleapis";
import nodemailer from "nodemailer";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth } from "../middlewares/auth";
import { resolveUploadedFiles, cleanupUploadIds } from "./attachments";

function parseSender(raw: string) {
  const match = raw.match(/^(.+?)\s*<(.+?)>$/);
  return {
    name: match ? match[1].trim().replace(/^"|"$/g, "") : raw,
    email: match ? match[2].trim() : raw,
  };
}

const router: IRouter = Router();

router.get("/emails", requireAuth, async (req, res): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 50));
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let countQuery = supabaseAdmin
      .from("emails")
      .select("id", { count: "exact", head: true })
      .eq("user_id", req.userId!)
      .is("shared_mailbox_id", null);

    let query = supabaseAdmin
      .from("emails")
      .select("*, categories(name), projects(name, reference)")
      .eq("user_id", req.userId!)
      .is("shared_mailbox_id", null)
      .order("created_at", { ascending: false });

    if (req.query.priority) {
      query = query.eq("priority", req.query.priority as string);
      countQuery = countQuery.eq("priority", req.query.priority as string);
    }
    if (req.query.categoryId) {
      query = query.eq("category_id", req.query.categoryId as string);
      countQuery = countQuery.eq("category_id", req.query.categoryId as string);
    }
    if (req.query.status) {
      query = query.eq("status", req.query.status as string);
      countQuery = countQuery.eq("status", req.query.status as string);
    } else {
      query = query.neq("status", "archived").neq("status", "trashed").neq("status", "spam");
      countQuery = countQuery.neq("status", "archived").neq("status", "trashed").neq("status", "spam");
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
          recipient: e.recipient || null,
          assignedTo: e.assigned_to || null,
          assignedAt: e.assigned_at || null,
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
      .select("sender, priority, category_id")
      .eq("id", req.params.id)
      .eq("user_id", req.userId!)
      .single();

    const updates: Record<string, unknown> = {};
    if (req.body.categoryId !== undefined) updates.category_id = req.body.categoryId;
    if (req.body.status !== undefined) updates.status = req.body.status;
    if (req.body.priority !== undefined) updates.priority = req.body.priority;
    if (req.body.projectId !== undefined) updates.project_id = req.body.projectId;

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

router.post("/emails/send", requireAuth, async (req, res): Promise<void> => {
  const uploadIds: string[] = [];
  try {
    const { to, subject, body, replyToEmailId, attachments: rawUploadIds } = req.body;

    const ids: string[] = Array.isArray(rawUploadIds) ? rawUploadIds.filter((x: any) => typeof x === "string") : [];
    uploadIds.push(...ids);

    if (!to || !subject || !body) {
      res.status(400).json({ error: "Destinataire, sujet et corps requis" });
      return;
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

    const conn = connections[0];
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
          `Content-Type: text/plain; charset=utf-8`,
          "",
          body,
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
          body: { contentType: "Text", content: body },
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
        text: body,
        attachments: attachments.map((att) => ({
          filename: att.filename,
          path: att.serverPath,
          contentType: att.contentType,
        })),
      });
    }

    const { data: sentEmail, error: insertError } = await supabaseAdmin.from("emails").insert({
      user_id: req.userId!,
      sender: fromAddress,
      recipient: to,
      subject,
      body,
      status: "sent",
      priority: "faible",
      external_id: null,
      reply_to_email_id: replyToEmailId || null,
    }).select("id").single();

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

    res.json({ success: true, emailId: sentEmail?.id });
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
    const emailId = parseInt(req.params.id, 10);
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
    if (!Array.isArray(ids) || ids.length === 0 || !["delete", "archive", "read", "unread"].includes(action)) {
      res.status(400).json({ error: "ids (array) et action (delete|archive|read|unread) requis" });
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

router.delete("/emails/spam/empty", requireAuth, async (req, res): Promise<void> => {
  try {
    const { data: spamEmails } = await supabaseAdmin
      .from("emails")
      .select("id")
      .eq("user_id", req.userId!)
      .eq("status", "spam");

    if (spamEmails && spamEmails.length > 0) {
      const spamIds = spamEmails.map((e: any) => e.id);

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

export default router;
