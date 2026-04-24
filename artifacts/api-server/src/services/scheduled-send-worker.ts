import { google } from "googleapis";
import nodemailer from "nodemailer";
import { supabaseAdmin } from "../lib/supabase";
import { logger } from "../lib/logger";
import { getBackendUrl } from "../lib/urls";

const POLL_INTERVAL_MS = 60_000;
const MAX_BATCH = 25;

function buildTrackingPixelHtml(pixelId: string): string {
  const url = `${getBackendUrl()}/api/track/open/${encodeURIComponent(pixelId)}.gif`;
  return `<img src="${url}" width="1" height="1" alt="" style="display:none;border:0;width:1px;height:1px" />`;
}

function bodyAsHtml(body: string): string {
  if (body.trim().toLowerCase().startsWith("<") || body.includes("</")) return body;
  return body
    .split("\n")
    .map((line) => line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"))
    .join("<br>");
}

async function sendOneScheduled(row: any): Promise<void> {
  const userId: string = row.user_id;
  const to: string = row.recipient || "";
  const subject: string = row.subject || "";
  const body: string = row.body || "";
  const replyToEmailId: number | null = row.reply_to_email_id || null;
  const connectionId: string | null = row.scheduled_connection_id || null;
  const pixelId: string | null = row.tracking_pixel_id || null;

  if (!to || !subject || !body) {
    await supabaseAdmin
      .from("emails")
      .update({
        status: "scheduled_failed",
        scheduled_send_error: "Champs obligatoires manquants",
      })
      .eq("id", row.id);
    return;
  }

  const { data: connections } = await supabaseAdmin
    .from("email_connections")
    .select("*")
    .eq("user_id", userId);

  if (!connections || connections.length === 0) {
    await supabaseAdmin
      .from("emails")
      .update({ status: "scheduled_failed", scheduled_send_error: "Aucun compte email connecté" })
      .eq("id", row.id);
    return;
  }

  let conn = connections[0];
  if (connectionId) {
    const matched = connections.find((c: any) => String(c.id) === String(connectionId));
    if (matched) conn = matched;
  }

  const fromAddress: string = conn.email_address;
  const isHtml = pixelId !== null;
  const finalBody = pixelId ? `${bodyAsHtml(body)}${buildTrackingPixelHtml(pixelId)}` : body;

  try {
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
          .eq("user_id", userId)
          .single();
        if (origEmail?.external_id) {
          extraHeaders.push(`In-Reply-To: ${origEmail.external_id}`);
          extraHeaders.push(`References: ${origEmail.external_id}`);
        }
      }

      const ctype = isHtml ? "text/html" : "text/plain";
      const messageParts = [
        `To: ${to}`,
        `From: ${fromAddress}`,
        `Subject: ${subject}`,
        ...extraHeaders,
        `Content-Type: ${ctype}; charset=utf-8`,
        "",
        finalBody,
      ];
      const raw = Buffer.from(messageParts.join("\r\n"))
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
      await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
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
        const newTokens = (await tokenResp.json()) as any;
        if (newTokens.access_token) {
          accessToken = newTokens.access_token;
          await supabaseAdmin
            .from("email_connections")
            .update({
              access_token: newTokens.access_token,
              token_expires_at: new Date(Date.now() + newTokens.expires_in * 1000).toISOString(),
            })
            .eq("id", conn.id);
        }
      }
      const mailBody: any = {
        message: {
          subject,
          body: { contentType: isHtml ? "HTML" : "Text", content: finalBody },
          toRecipients: [{ emailAddress: { address: to } }],
        },
        saveToSentItems: true,
      };
      const graphResp = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(mailBody),
      });
      if (!graphResp.ok) {
        const errBody = await graphResp.text();
        throw new Error(`Outlook send error: ${errBody.slice(0, 200)}`);
      }
    } else {
      let imapConfig: { host: string; port: number } = { host: "", port: 993 };
      try {
        imapConfig = JSON.parse(conn.refresh_token);
      } catch {
        // ignore
      }
      const smtpHost = (imapConfig.host || "").replace(/^imap\./, "smtp.");
      if (!smtpHost) throw new Error("SMTP host introuvable");
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
        ...(isHtml ? { html: finalBody } : { text: finalBody }),
      });
    }

    await supabaseAdmin
      .from("emails")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        scheduled_send_at: null,
        scheduled_send_error: null,
      })
      .eq("id", row.id);

    logger.info({ emailId: row.id, userId }, "[scheduled-send] sent OK");
  } catch (err: any) {
    const errMsg = (err?.message || "Erreur inconnue").slice(0, 500);
    await supabaseAdmin
      .from("emails")
      .update({ status: "scheduled_failed", scheduled_send_error: errMsg })
      .eq("id", row.id);
    logger.warn({ emailId: row.id, userId, err: errMsg }, "[scheduled-send] failed");
  }
}

let runningTick = false;
async function tick(): Promise<void> {
  if (runningTick) return;
  runningTick = true;
  try {
    const nowIso = new Date().toISOString();
    const { data: due, error } = await supabaseAdmin
      .from("emails")
      .select("*")
      .eq("status", "scheduled")
      .not("scheduled_send_at", "is", null)
      .lte("scheduled_send_at", nowIso)
      .order("scheduled_send_at", { ascending: true })
      .limit(MAX_BATCH);

    if (error) {
      logger.warn({ error: error.message }, "[scheduled-send] query error");
      return;
    }
    if (!due || due.length === 0) return;

    logger.info({ count: due.length }, "[scheduled-send] processing batch");
    for (const row of due) {
      await sendOneScheduled(row);
    }
  } catch (e: any) {
    logger.warn({ error: e.message }, "[scheduled-send] tick error");
  } finally {
    runningTick = false;
  }
}

export function startScheduledSendWorker(): void {
  logger.info({ intervalMs: POLL_INTERVAL_MS }, "[scheduled-send] worker started");
  setTimeout(() => {
    void tick();
  }, 5_000);
  setInterval(() => {
    void tick();
  }, POLL_INTERVAL_MS);
}
