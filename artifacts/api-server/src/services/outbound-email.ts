import { google } from "googleapis";
import nodemailer from "nodemailer";
import { supabaseAdmin } from "../lib/supabase";
import { emitEvent } from "./webhook-emitter";
import { logEmailToHubspot } from "./hubspot";
import { logEmailToPipedrive } from "./pipedrive";

/**
 * Send a plain-text email on behalf of a user using their first connected
 * email account (Gmail / Outlook / IMAP+SMTP). Used by the public automation
 * API (`POST /v1/actions/email`) to expose a "send email" action to Zapier /
 * Make / n8n.
 *
 * This is intentionally simpler than the dashboard `/emails/send` route — no
 * attachments, no project linking, no in-reply-to threading — because external
 * automations only need basic transactional sends. The dashboard route remains
 * the canonical path for rich human-authored sends.
 */
export async function sendEmailFromUser(
  userId: string,
  to: string,
  subject: string,
  body: string,
): Promise<{ ok: boolean; emailId?: number | string; error?: string }> {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!to || !emailRegex.test(to.trim())) return { ok: false, error: "invalid recipient" };
  if (!subject || typeof subject !== "string") return { ok: false, error: "subject required" };
  if (!body || typeof body !== "string") return { ok: false, error: "body required" };

  const { data: connections } = await supabaseAdmin
    .from("email_connections")
    .select("*")
    .eq("user_id", userId);
  if (!connections || connections.length === 0) return { ok: false, error: "no email connection" };
  const conn = connections[0];

  try {
    if (conn.provider === "gmail") {
      const oauth2 = new google.auth.OAuth2(
        process.env["GOOGLE_CLIENT_ID"],
        process.env["GOOGLE_CLIENT_SECRET"],
      );
      oauth2.setCredentials({ access_token: conn.access_token, refresh_token: conn.refresh_token });
      const gmail = google.gmail({ version: "v1", auth: oauth2 });
      const raw = Buffer.from(
        [
          `To: ${to}`,
          `From: ${conn.email_address}`,
          `Subject: ${subject}`,
          `Content-Type: text/plain; charset=utf-8`,
          "",
          body,
        ].join("\r\n"),
      )
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
      const graphResp = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: {
            subject,
            body: { contentType: "Text", content: body },
            toRecipients: [{ emailAddress: { address: to } }],
          },
          saveToSentItems: true,
        }),
      });
      if (!graphResp.ok) {
        const err = await graphResp.text();
        return { ok: false, error: `outlook: ${err.slice(0, 200)}` };
      }
    } else {
      let imapConfig: { host: string; port: number } = { host: "", port: 993 };
      try {
        imapConfig = JSON.parse(conn.refresh_token);
      } catch {
        // ignore — fallthrough produces a clear "smtp host missing" error below
      }
      if (!imapConfig.host) return { ok: false, error: "smtp configuration missing" };
      const transporter = nodemailer.createTransport({
        host: imapConfig.host.replace(/^imap\./, "smtp."),
        port: 587,
        secure: false,
        auth: { user: conn.email_address, pass: conn.access_token },
        tls: { rejectUnauthorized: true },
      });
      await transporter.sendMail({ from: conn.email_address, to, subject, text: body });
    }
  } catch (err: any) {
    return { ok: false, error: err?.message || "send failed" };
  }

  // Persist the sent email and fan out the standard side-effects.
  const { data: sentEmail } = await supabaseAdmin
    .from("emails")
    .insert({
      user_id: userId,
      sender: conn.email_address,
      recipient: to,
      subject,
      body,
      status: "sent",
      priority: "faible",
    })
    .select("id")
    .single();

  if (sentEmail?.id) {
    logEmailToHubspot(userId, sentEmail.id, to, subject, body, "outbound").catch(() => {});
    logEmailToPipedrive(userId, sentEmail.id, to, subject, body).catch(() => {});
    emitEvent(userId, "email.sent", {
      id: sentEmail.id,
      to,
      from: conn.email_address,
      subject,
      source: "public-api",
    }).catch(() => {});
  }

  return { ok: true, emailId: sentEmail?.id };
}
