import { Router, type IRouter } from "express";
import { google } from "googleapis";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import multer from "multer";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as crypto from "crypto";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

const UPLOAD_DIR = path.join(os.tmpdir(), "inboria-uploads");
try { fs.mkdirSync(UPLOAD_DIR, { recursive: true }); } catch {}

const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 10 * 1024 * 1024 },
});

interface PendingUpload {
  serverPath: string;
  filename: string;
  contentType: string;
  size: number;
  userId: string;
  createdAt: number;
}

const pendingUploads = new Map<string, PendingUpload>();

const UPLOAD_TTL_MS = 15 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [id, up] of pendingUploads) {
    if (now - up.createdAt > UPLOAD_TTL_MS) {
      fs.unlink(up.serverPath, () => {});
      pendingUploads.delete(id);
    }
  }
}, 60_000);

export function resolveUploadedFiles(uploadIds: string[], userId: string): PendingUpload[] | null {
  const results: PendingUpload[] = [];
  for (const id of uploadIds) {
    const up = pendingUploads.get(id);
    if (!up || up.userId !== userId) return null;
    if (!fs.existsSync(up.serverPath)) return null;
    results.push(up);
  }
  return results;
}

export function cleanupUploadIds(uploadIds: string[]) {
  for (const id of uploadIds) {
    const up = pendingUploads.get(id);
    if (up) {
      fs.unlink(up.serverPath, () => {});
      pendingUploads.delete(id);
    }
  }
}

router.get("/attachments/email/:emailId", requireAuth, async (req, res): Promise<void> => {
  try {
    const emailId = parseInt(req.params.emailId as string, 10);
    if (isNaN(emailId)) { res.status(400).json({ error: "ID invalide" }); return; }

    const { data: email } = await supabaseAdmin
      .from("emails")
      .select("id")
      .eq("id", emailId)
      .eq("user_id", req.userId!)
      .single();

    if (!email) { res.status(404).json({ error: "Email non trouvé" }); return; }

    const { data: attachments, error } = await supabaseAdmin
      .from("email_attachments")
      .select("id, filename, content_type, size, created_at")
      .eq("email_id", emailId)
      .order("created_at", { ascending: true });

    if (error) { res.status(500).json({ error: error.message }); return; }

    res.json({ attachments: attachments || [] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/attachments/:id/download", requireAuth, async (req, res): Promise<void> => {
  try {
    const { data: attachment, error } = await supabaseAdmin
      .from("email_attachments")
      .select("*, emails!inner(user_id)")
      .eq("id", req.params.id)
      .single();

    if (error || !attachment) { res.status(404).json({ error: "Pièce jointe non trouvée" }); return; }
    if ((attachment as any).emails?.user_id !== req.userId) {
      res.status(403).json({ error: "Accès refusé" }); return;
    }

    const { data: conn } = await supabaseAdmin
      .from("email_connections")
      .select("*")
      .eq("id", attachment.connection_id)
      .single();

    if (!conn) { res.status(404).json({ error: "Connexion email non trouvée" }); return; }

    if (attachment.provider === "gmail") {
      if (!attachment.provider_attachment_id || !attachment.message_uid) {
        res.status(404).json({ error: "Données de pièce jointe manquantes" }); return;
      }

      const oauth2Client = new google.auth.OAuth2(
        process.env["GOOGLE_CLIENT_ID"],
        process.env["GOOGLE_CLIENT_SECRET"]
      );
      oauth2Client.setCredentials({
        access_token: conn.access_token,
        refresh_token: conn.refresh_token,
      });

      const gmail = google.gmail({ version: "v1", auth: oauth2Client });

      const { data: attachData } = await gmail.users.messages.attachments.get({
        userId: "me",
        messageId: attachment.message_uid,
        id: attachment.provider_attachment_id,
      });

      if (!attachData?.data) {
        res.status(404).json({ error: "Pièce jointe introuvable chez le fournisseur" }); return;
      }

      const buffer = Buffer.from(attachData.data, "base64url");
      res.setHeader("Content-Type", attachment.content_type || "application/octet-stream");
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(attachment.filename)}"`);
      res.setHeader("Content-Length", buffer.length.toString());
      res.send(buffer);
    } else if (attachment.provider === "imap") {
      let imapConfig: { host: string; port: number } = { host: "", port: 993 };
      try { imapConfig = JSON.parse(conn.refresh_token); } catch {}

      const client = new ImapFlow({
        host: imapConfig.host,
        port: imapConfig.port,
        secure: true,
        auth: { user: conn.email_address, pass: conn.access_token },
        logger: false as any,
      });
      client.on("error", () => {});

      try {
        await client.connect();
        const lock = await client.getMailboxLock("INBOX");
        try {
          const uid = parseInt(attachment.message_uid || "0", 10);
          if (!uid) { res.status(404).json({ error: "UID IMAP manquant" }); return; }

          const msg = await client.fetchOne(String(uid), { source: true }, { uid: true }) as any;
          if (!msg?.source) { res.status(404).json({ error: "Message IMAP introuvable" }); return; }

          const parsed = await simpleParser(msg.source as any);
          const contentId = attachment.provider_attachment_id;
          const found = parsed.attachments?.find(
            (a) =>
              (contentId && (a.contentId === contentId || a.checksum === contentId)) ||
              (a.filename || "attachment") === attachment.filename
          );

          if (!found) { res.status(404).json({ error: "Pièce jointe non trouvée dans le message" }); return; }

          res.setHeader("Content-Type", found.contentType || "application/octet-stream");
          res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(found.filename || "attachment")}"`);
          res.setHeader("Content-Length", found.size.toString());
          res.send(found.content);
        } finally {
          lock.release();
        }
      } finally {
        await client.logout().catch(() => {});
      }
    } else {
      res.status(400).json({ error: "Provider non supporté pour le téléchargement" });
    }
  } catch (err: any) {
    console.error("Attachment download error:", err);
    res.status(500).json({ error: "Erreur lors du téléchargement de la pièce jointe" });
  }
});

router.post("/attachments/upload", requireAuth, upload.array("files", 10), async (req, res): Promise<void> => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      res.status(400).json({ error: "Aucun fichier fourni" }); return;
    }

    const uploaded = files.map((f) => {
      const uploadId = crypto.randomUUID();
      const canonicalPath = fs.realpathSync(f.path);
      if (!canonicalPath.startsWith(UPLOAD_DIR)) {
        fs.unlinkSync(f.path);
        throw new Error("Invalid upload path");
      }
      pendingUploads.set(uploadId, {
        serverPath: canonicalPath,
        filename: f.originalname,
        contentType: f.mimetype,
        size: f.size,
        userId: req.userId!,
        createdAt: Date.now(),
      });
      return {
        uploadId,
        filename: f.originalname,
        contentType: f.mimetype,
        size: f.size,
      };
    });

    res.json({ files: uploaded });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
