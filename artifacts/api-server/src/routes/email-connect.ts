import { Router, type IRouter } from "express";
import { ImapFlow } from "imapflow";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

const IMAP_PROVIDERS: Record<string, { host: string; port: number }> = {
  "gmail.com": { host: "imap.gmail.com", port: 993 },
  "googlemail.com": { host: "imap.gmail.com", port: 993 },
  "outlook.com": { host: "outlook.office365.com", port: 993 },
  "hotmail.com": { host: "outlook.office365.com", port: 993 },
  "hotmail.fr": { host: "outlook.office365.com", port: 993 },
  "live.com": { host: "outlook.office365.com", port: 993 },
  "live.fr": { host: "outlook.office365.com", port: 993 },
  "yahoo.com": { host: "imap.mail.yahoo.com", port: 993 },
  "yahoo.fr": { host: "imap.mail.yahoo.com", port: 993 },
  "orange.fr": { host: "imap.orange.fr", port: 993 },
  "wanadoo.fr": { host: "imap.orange.fr", port: 993 },
  "free.fr": { host: "imap.free.fr", port: 993 },
  "sfr.fr": { host: "imap.sfr.fr", port: 993 },
  "laposte.net": { host: "imap.laposte.net", port: 993 },
  "icloud.com": { host: "imap.mail.me.com", port: 993 },
  "me.com": { host: "imap.mail.me.com", port: 993 },
  "ovh.net": { host: "ssl0.ovh.net", port: 993 },
};

function detectImapSettings(email: string): { host: string; port: number } | null {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return null;
  return IMAP_PROVIDERS[domain] || null;
}

async function testImapConnection(email: string, password: string, host: string, port: number): Promise<boolean> {
  const client = new ImapFlow({
    host,
    port,
    secure: true,
    auth: { user: email, pass: password },
    logger: false,
  });

  try {
    await client.connect();
    await client.logout();
    return true;
  } catch (err: any) {
    console.error("IMAP test failed:", err.message);
    return false;
  }
}

router.post("/email/connect", requireAuth, async (req, res): Promise<void> => {
  try {
    const { email, password, imapHost, imapPort } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: "Email et mot de passe requis" });
      return;
    }

    let host = imapHost;
    let port = imapPort || 993;

    if (!host) {
      const detected = detectImapSettings(email);
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

    const connected = await testImapConnection(email, password, host, port);
    if (!connected) {
      const domain = email.split("@")[1]?.toLowerCase();
      let hint = "";
      if (domain === "gmail.com" || domain === "googlemail.com") {
        hint = " Pour Gmail, utilisez un 'Mot de passe d'application' (Compte Google > Securite > Mots de passe des applications).";
      } else if (["outlook.com", "hotmail.com", "hotmail.fr", "live.com", "live.fr"].includes(domain || "")) {
        hint = " Pour Outlook/Hotmail, activez l'acces IMAP dans les parametres et utilisez votre mot de passe habituel.";
      }
      res.status(401).json({
        error: `Connexion echouee. Verifiez vos identifiants.${hint}`,
      });
      return;
    }

    const domain = email.split("@")[1]?.toLowerCase() || "";
    const provider = domain.includes("gmail") || domain.includes("googlemail") ? "gmail"
      : ["outlook.com", "hotmail.com", "hotmail.fr", "live.com", "live.fr"].includes(domain) ? "outlook"
      : "imap";

    const imapConfig = JSON.stringify({ host, port });

    await supabaseAdmin.from("email_connections").upsert({
      user_id: req.userId,
      provider,
      email_address: email,
      access_token: password,
      refresh_token: imapConfig,
      token_expires_at: null,
    }, { onConflict: "user_id,provider" });

    res.json({ success: true, provider, email });
  } catch (err: any) {
    console.error("Email connect error:", err);
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

    res.json(data || []);
  } catch {
    res.status(500).json({ error: "Failed to list connections" });
  }
});

router.delete("/email/connections/:provider", requireAuth, async (req, res): Promise<void> => {
  try {
    await supabaseAdmin
      .from("email_connections")
      .delete()
      .eq("user_id", req.userId!)
      .eq("provider", req.params.provider);

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to disconnect" });
  }
});

router.post("/email/sync", requireAuth, async (req, res): Promise<void> => {
  try {
    const { data: connections } = await supabaseAdmin
      .from("email_connections")
      .select("*")
      .eq("user_id", req.userId!);

    if (!connections || connections.length === 0) {
      res.status(400).json({ error: "Aucun compte email connecte" });
      return;
    }

    let totalSynced = 0;

    for (const conn of connections) {
      totalSynced += await syncImap(conn, req.userId!);
    }

    res.json({ synced: totalSynced });
  } catch (err: any) {
    console.error("Sync error:", err);
    res.status(500).json({ error: "Erreur lors de la synchronisation" });
  }
});

async function syncImap(conn: any, userId: string): Promise<number> {
  let imapConfig = { host: "imap.gmail.com", port: 993 };
  try {
    if (conn.refresh_token) {
      imapConfig = JSON.parse(conn.refresh_token);
    }
  } catch {}

  const client = new ImapFlow({
    host: imapConfig.host,
    port: imapConfig.port,
    secure: true,
    auth: { user: conn.email_address, pass: conn.access_token },
    logger: false,
  });

  try {
    await client.connect();

    const lock = await client.getMailboxLock("INBOX");
    let synced = 0;

    try {
      const messages = client.fetch("1:*", {
        envelope: true,
        uid: true,
      }, { uid: true });

      const msgList: any[] = [];
      for await (const msg of messages) {
        msgList.push(msg);
      }

      const recentMessages = msgList.slice(-20);

      for (const msg of recentMessages) {
        const externalId = `${conn.provider}_${msg.uid}`;

        const { data: existing } = await supabaseAdmin
          .from("emails")
          .select("id")
          .eq("user_id", userId)
          .eq("external_id", externalId)
          .single();

        if (existing) continue;

        const envelope = msg.envelope;
        const from = envelope.from?.[0];
        const senderName = from?.name || "";
        const senderAddress = from?.address || "inconnu";
        const sender = senderName ? `${senderName} <${senderAddress}>` : senderAddress;

        await supabaseAdmin.from("emails").insert({
          user_id: userId,
          external_id: externalId,
          sender,
          subject: envelope.subject || "(pas de sujet)",
          body: "",
          status: "non_lu",
          priority: "moyen",
          created_at: envelope.date ? new Date(envelope.date).toISOString() : new Date().toISOString(),
        });

        synced++;
      }
    } finally {
      lock.release();
    }

    await client.logout();

    await supabaseAdmin.from("email_connections").update({
      last_synced_at: new Date().toISOString(),
    }).eq("id", conn.id);

    return synced;
  } catch (err: any) {
    console.error(`IMAP sync error for ${conn.email_address}:`, err.message);
    try { await client.logout(); } catch {}
    return 0;
  }
}

export default router;
