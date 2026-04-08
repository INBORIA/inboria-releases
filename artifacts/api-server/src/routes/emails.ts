import { Router, type IRouter } from "express";
import { google } from "googleapis";
import nodemailer from "nodemailer";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth } from "../middlewares/auth";

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
      query = query.neq("status", "archived");
      countQuery = countQuery.neq("status", "archived");
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
    if (emailIds.length > 0) {
      const { data: taskRows } = await supabaseAdmin
        .from("tasks")
        .select("email_id")
        .in("email_id", emailIds)
        .eq("user_id", req.userId!);
      (taskRows || []).forEach((t: any) => {
        taskCountMap[t.email_id] = (taskCountMap[t.email_id] || 0) + 1;
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

router.post("/emails/send", requireAuth, async (req, res): Promise<void> => {
  try {
    const { to, subject, body, replyToEmailId } = req.body;
    if (!to || !subject || !body) {
      res.status(400).json({ error: "Destinataire, sujet et corps requis" });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to.trim())) {
      res.status(400).json({ error: "Adresse email destinataire invalide. Vérifiez le format (ex: nom@domaine.com)" });
      return;
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

      const messageParts = [
        `To: ${to}`,
        `From: ${fromAddress}`,
        `Subject: ${subject}`,
        `Content-Type: text/plain; charset=utf-8`,
        "",
        body,
      ];

      if (replyToEmailId) {
        const { data: origEmail } = await supabaseAdmin
          .from("emails")
          .select("external_id")
          .eq("id", replyToEmailId)
          .eq("user_id", req.userId!)
          .single();
        if (origEmail?.external_id) {
          messageParts.splice(3, 0, `In-Reply-To: ${origEmail.external_id}`);
          messageParts.splice(4, 0, `References: ${origEmail.external_id}`);
        }
      }

      const raw = Buffer.from(messageParts.join("\r\n"))
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

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
      });
    }

    const { data: sentEmail } = await supabaseAdmin.from("emails").insert({
      user_id: req.userId!,
      sender: fromAddress,
      sender_email: fromAddress,
      recipient: to,
      subject,
      body,
      status: "sent",
      priority: "faible",
      external_id: null,
      reply_to_email_id: replyToEmailId || null,
    }).select("id").single();

    res.json({ success: true, emailId: sentEmail?.id });
  } catch (err: any) {
    console.error("Send email error:", err);
    res.status(500).json({ error: "Echec de l'envoi: " + (err.message || "Erreur inconnue") });
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
        .delete()
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

router.delete("/emails/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const { error } = await supabaseAdmin
      .from("emails")
      .delete()
      .eq("id", req.params.id)
      .eq("user_id", req.userId!);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete email" });
  }
});

export default router;
