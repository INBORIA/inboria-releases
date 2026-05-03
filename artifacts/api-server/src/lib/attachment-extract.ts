import { google } from "googleapis";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { convert as htmlToText } from "html-to-text";
import { supabaseAdmin } from "./supabase";

const TEXT_LIMIT = 4000;
const MAX_BYTES = 1_500_000;

export interface AttachmentRow {
  id: string;
  email_id: number;
  filename: string;
  content_type: string | null;
  size: number | null;
  provider: string | null;
  provider_attachment_id: string | null;
  message_uid: string | null;
  connection_id: string | null;
}

export function isExtractableAttachment(att: { filename: string | null; content_type: string | null; size: number | null }): boolean {
  const name = (att.filename || "").toLowerCase();
  const ct = (att.content_type || "").toLowerCase();
  if (att.size && att.size > MAX_BYTES) return false;
  if (ct.startsWith("text/")) return true;
  if (ct === "application/pdf") return true;
  if (ct === "application/json" || ct === "application/xml") return true;
  if (/\.(html?|txt|md|csv|tsv|json|xml|log|pdf)$/i.test(name)) return true;
  return false;
}

async function downloadAttachmentBuffer(att: AttachmentRow): Promise<Buffer | null> {
  if (!att.connection_id) return null;
  const { data: conn } = await supabaseAdmin
    .from("email_connections")
    .select("*")
    .eq("id", att.connection_id)
    .single();
  if (!conn) return null;

  if (att.provider === "gmail") {
    if (!att.provider_attachment_id || !att.message_uid) return null;
    try {
      const oauth = new google.auth.OAuth2(
        process.env["GOOGLE_CLIENT_ID"],
        process.env["GOOGLE_CLIENT_SECRET"],
      );
      oauth.setCredentials({
        access_token: conn.access_token,
        refresh_token: conn.refresh_token,
      });
      const gmail = google.gmail({ version: "v1", auth: oauth });
      const { data } = await gmail.users.messages.attachments.get({
        userId: "me",
        messageId: att.message_uid,
        id: att.provider_attachment_id,
      });
      if (!data?.data) return null;
      return Buffer.from(data.data, "base64url");
    } catch {
      return null;
    }
  }

  if (att.provider === "imap") {
    let cfg: { host: string; port: number } = { host: "", port: 993 };
    try { cfg = JSON.parse(conn.refresh_token); } catch {}
    if (!cfg.host) return null;
    const client = new ImapFlow({
      host: cfg.host,
      port: cfg.port,
      secure: true,
      auth: { user: conn.email_address, pass: conn.access_token },
      logger: false as any,
    });
    client.on("error", () => {});
    try {
      await client.connect();
      const lock = await client.getMailboxLock("INBOX");
      try {
        const uid = parseInt(att.message_uid || "0", 10);
        if (!uid) return null;
        const msg = await client.fetchOne(String(uid), { source: true }, { uid: true }) as any;
        if (!msg?.source) return null;
        const parsed = await simpleParser(msg.source as any);
        const cid = att.provider_attachment_id;
        const found = parsed.attachments?.find(
          (a) =>
            (cid && (a.contentId === cid || a.checksum === cid)) ||
            (a.filename || "attachment") === att.filename,
        );
        if (!found) return null;
        return Buffer.isBuffer(found.content) ? found.content : Buffer.from(found.content as any);
      } finally {
        lock.release();
      }
    } catch {
      return null;
    } finally {
      await client.logout().catch(() => {});
    }
  }

  return null;
}

function bufferToText(buf: Buffer, contentType: string | null, filename: string): string {
  const ct = (contentType || "").toLowerCase();
  const name = (filename || "").toLowerCase();
  if (ct.startsWith("text/html") || /\.html?$/.test(name)) {
    const html = buf.toString("utf8");
    return htmlToText(html, {
      wordwrap: false,
      selectors: [
        { selector: "img", format: "skip" },
        { selector: "a", options: { ignoreHref: true } },
        { selector: "style", format: "skip" },
        { selector: "script", format: "skip" },
      ],
    });
  }
  if (ct.startsWith("text/") || /\.(txt|md|csv|tsv|log|json|xml)$/.test(name)) {
    return buf.toString("utf8");
  }
  if (ct === "application/pdf" || /\.pdf$/.test(name)) {
    return "";
  }
  return "";
}

export async function extractAttachmentText(att: AttachmentRow): Promise<string | null> {
  if (!isExtractableAttachment(att)) return null;
  try {
    const buf = await downloadAttachmentBuffer(att);
    if (!buf || buf.length === 0) return null;

    const ct = (att.content_type || "").toLowerCase();
    const name = (att.filename || "").toLowerCase();

    let text = "";
    if (ct === "application/pdf" || /\.pdf$/.test(name)) {
      try {
        const pdfModule: any = await import("pdf-parse");
        const pdfFn: any = pdfModule?.default || pdfModule;
        const result = await pdfFn(buf);
        text = String(result?.text || "");
      } catch {
        return null;
      }
    } else {
      text = bufferToText(buf, att.content_type, att.filename);
    }

    text = text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
    if (!text) return null;
    if (text.length > TEXT_LIMIT) {
      text = text.slice(0, TEXT_LIMIT) + " […tronqué]";
    }
    return text;
  } catch {
    return null;
  }
}

const CONTENT_KEYWORDS = [
  "contenu", "contient", "que dit", "que disent", "résumé de la pj", "resume de la pj",
  "resume des pj", "résumé des pj", "résume la pj", "resume la pj",
  "détails de la pj", "details de la pj", "lis", "lit", "lire", "ouvre",
  "ouvrir", "affiche", "affiches", "afficher", "montre la pj", "montre-moi la pj",
  "extrait", "extraire", "texte de la pj", "texte des pj", "que contient",
  "qu'est-ce que contient", "qu'y a-t-il dans", "qu'y-a-t-il dans",
  "donne-moi le contenu", "résume le", "resume le", "explique la pj",
  "what does", "what's in", "what is in", "summarize", "read the attachment",
  "show the attachment", "content of the attachment", "extract", "open the attachment",
];

export function shouldExtractAttachmentContent(userMsg: string): boolean {
  const m = (userMsg || "").toLowerCase();
  if (!m) return false;
  return CONTENT_KEYWORDS.some((k) => m.includes(k));
}
