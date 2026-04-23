import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { supabaseAdmin } from "../lib/supabase";
import { logger } from "../lib/logger";
import { fetchWithTimeout, withTimeout } from "./connection-health";

const IMAP_BODY_MAX_BYTES = 200_000;
const JUNK_BACKFILL_DAYS = 30;
const JUNK_PER_SYNC_LIMIT = 30;
const JUNK_LOCK_TIMEOUT_MS = 10_000;
const JUNK_SEARCH_TIMEOUT_MS = 30_000;
const JUNK_FETCH_STEP_TIMEOUT_MS = 30_000;
const IMAP_MOVE_LOCK_TIMEOUT_MS = 10_000;
const IMAP_MOVE_TIMEOUT_MS = 30_000;
const HTTP_TIMEOUT_MS = 20_000;

const IMAP_JUNK_FALLBACK_NAMES = [
  "Junk",
  "Junk Email",
  "JunkEmail",
  "Spam",
  "INBOX.Junk",
  "INBOX.Spam",
  "INBOX.Junk Email",
  "Bulk Mail",
  "INBOX.Bulk Mail",
  "Courrier indésirable",
  "Indésirables",
  "Pourriel",
  "Pourriels",
  "Ongewenste e-mail",
];

const IMAP_TRASH_FALLBACK_NAMES = [
  "Trash",
  "Deleted",
  "Deleted Items",
  "Deleted Messages",
  "INBOX.Trash",
  "INBOX.Deleted",
  "INBOX.Deleted Items",
  "Corbeille",
  "INBOX.Corbeille",
  "Éléments supprimés",
  "Elements supprimes",
  "Prullenbak",
  "Verwijderde items",
  "Papierkorb",
  "Gelöschte Elemente",
  "Geloeschte Elemente",
  "Elementos eliminados",
];

export async function discoverImapTrashFolder(client: ImapFlow): Promise<string | null> {
  const log = logger.child({ service: "trash-discover" });
  try {
    const list = await client.list();
    const flagged = list.find((m) => {
      const flags = m.flags as unknown;
      if (flags instanceof Set) return flags.has("\\Trash");
      if (Array.isArray(flags)) return flags.includes("\\Trash");
      return false;
    });
    if (flagged?.path) {
      log.info({ path: flagged.path }, "IMAP Trash discovered via SPECIAL-USE \\Trash");
      return flagged.path;
    }
    const lowerMap = new Map(list.map((m) => [m.path.toLowerCase(), m.path]));
    for (const candidate of IMAP_TRASH_FALLBACK_NAMES) {
      const hit = lowerMap.get(candidate.toLowerCase());
      if (hit) {
        log.info({ path: hit }, "IMAP Trash discovered via fallback name");
        return hit;
      }
    }
  } catch (err: any) {
    log.warn({ err: err.message }, "IMAP Trash discovery failed");
  }
  return null;
}

export interface JunkEmailPayload {
  externalId: string;
  sender: string;
  subject: string;
  body: string;
  createdAt: string;
  recipient: string;
  headers: Record<string, string>;
  providerMessageId: string | null;
}

export type SaveJunkFn = (
  payload: JunkEmailPayload,
  userId: string,
  sharedMailboxId: string | null,
) => Promise<number | null>;

export async function discoverImapJunkFolder(
  client: ImapFlow,
  cachedPath: string | null | undefined,
): Promise<string | null> {
  const log = logger.child({ service: "junk-discover" });

  if (cachedPath) {
    try {
      const exists = await client.mailboxOpen(cachedPath, { readOnly: true });
      if (exists) {
        await client.mailboxClose();
        return cachedPath;
      }
    } catch {
      // cache invalide — re-decouverte
    }
  }

  try {
    const list = await client.list();
    const flagged = list.find((m) => {
      const flags = m.flags as unknown;
      if (flags instanceof Set) return flags.has("\\Junk");
      if (Array.isArray(flags)) return flags.includes("\\Junk");
      return false;
    });
    if (flagged?.path) {
      log.info({ path: flagged.path }, "IMAP Junk discovered via SPECIAL-USE \\Junk");
      return flagged.path;
    }

    const lowerMap = new Map(list.map((m) => [m.path.toLowerCase(), m.path]));
    for (const candidate of IMAP_JUNK_FALLBACK_NAMES) {
      const hit = lowerMap.get(candidate.toLowerCase());
      if (hit) {
        log.info({ path: hit }, "IMAP Junk discovered via fallback name");
        return hit;
      }
    }
  } catch (err: any) {
    log.warn({ err: err.message }, "IMAP Junk discovery failed");
  }
  return null;
}

export async function syncImapJunk(
  conn: { id: string; user_id: string; email_address: string; junk_folder_path?: string | null },
  client: ImapFlow,
  sharedMailboxId: string | null,
  saveJunk: SaveJunkFn,
): Promise<number> {
  const log = logger.child({ service: "junk-sync-imap", email: conn.email_address });

  const junkPath = await discoverImapJunkFolder(client, conn.junk_folder_path);
  if (!junkPath) {
    log.info("No Junk folder found, skipping junk sync");
    return 0;
  }

  if (junkPath !== conn.junk_folder_path) {
    await supabaseAdmin
      .from("email_connections")
      .update({ junk_folder_path: junkPath })
      .eq("id", conn.id);
  }

  let lock;
  try {
    lock = await withTimeout(client.getMailboxLock(junkPath), JUNK_LOCK_TIMEOUT_MS, "Junk lock");
  } catch (lockErr: any) {
    log.warn({ err: lockErr.message, junkPath }, "Could not lock Junk folder");
    return 0;
  }

  let savedCount = 0;
  try {
    const sinceDate = new Date(Date.now() - JUNK_BACKFILL_DAYS * 24 * 3600 * 1000);
    const uids = await withTimeout(
      client.search({ since: sinceDate }, { uid: true }) as Promise<number[]>,
      JUNK_SEARCH_TIMEOUT_MS,
      "Junk search",
    );
    if (!uids || uids.length === 0) {
      log.info({ junkPath }, "Junk folder empty in window");
      return 0;
    }

    const recent = uids.slice(-JUNK_PER_SYNC_LIMIT);
    log.info({ junkPath, total: uids.length, fetching: recent.length }, "Junk fetch starting");

    const iterator = client.fetch(recent, { envelope: true, uid: true, source: true }, { uid: true })[Symbol.asyncIterator]();
    while (true) {
      const step = await withTimeout(iterator.next(), JUNK_FETCH_STEP_TIMEOUT_MS, "Junk fetch step");
      if (step.done) break;
      const msg = step.value;
      const externalId = `imap-junk:${conn.email_address}:${msg.uid}`;
      const envelope = msg.envelope;
      const from = envelope?.from?.[0];
      const sender = from?.name ? `${from.name} <${from.address}>` : from?.address || "inconnu";

      let bodyText = "";
      let providerMessageId: string | null = envelope?.messageId || null;
      const headers: Record<string, string> = {};

      if (msg.source) {
        try {
          const parsed = await simpleParser(msg.source);
          bodyText = parsed.html
            ? (typeof parsed.html === "string" ? parsed.html : "")
            : parsed.text || "";
          if (bodyText.length > IMAP_BODY_MAX_BYTES) bodyText = bodyText.slice(0, IMAP_BODY_MAX_BYTES);
          if (parsed.messageId) providerMessageId = parsed.messageId;
          if (parsed.headers && typeof (parsed.headers as any).forEach === "function") {
            (parsed.headers as Map<string, any>).forEach((value, key) => {
              if (value === undefined || value === null) return;
              headers[key.toLowerCase()] = String(typeof value === "object" ? JSON.stringify(value) : value);
            });
          }
        } catch {
          // ignore parsing errors, body restera vide
        }
      }

      const toList: any[] = Array.isArray(envelope?.to) ? envelope.to : [];
      const recipientHeader = toList
        .map((r) => r?.address)
        .filter((x: any) => !!x)
        .join(", ") || conn.email_address;

      const saved = await saveJunk(
        {
          externalId,
          sender,
          subject: envelope?.subject || "(pas de sujet)",
          body: bodyText,
          createdAt: envelope?.date ? new Date(envelope.date).toISOString() : new Date().toISOString(),
          recipient: recipientHeader,
          headers,
          providerMessageId,
        },
        conn.user_id,
        sharedMailboxId,
      );
      if (saved) savedCount++;
    }
    log.info({ junkPath, saved: savedCount }, "Junk fetch complete");
  } catch (err: any) {
    log.warn({ err: err.message }, "Junk fetch error");
  } finally {
    try { lock.release(); } catch {}
  }

  return savedCount;
}

export async function syncOutlookJunk(
  conn: { id: string; user_id: string; email_address: string },
  accessToken: string,
  sharedMailboxId: string | null,
  saveJunk: SaveJunkFn,
): Promise<number> {
  const log = logger.child({ service: "junk-sync-outlook", email: conn.email_address });
  try {
    const filterDate = new Date(Date.now() - JUNK_BACKFILL_DAYS * 24 * 3600 * 1000).toISOString();
    const url =
      `https://graph.microsoft.com/v1.0/me/mailFolders/junkemail/messages` +
      `?$top=${JUNK_PER_SYNC_LIMIT}&$orderby=receivedDateTime desc` +
      `&$select=id,internetMessageId,from,toRecipients,subject,bodyPreview,receivedDateTime` +
      `&$filter=receivedDateTime ge ${filterDate}`;

    const resp = await fetchWithTimeout(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeoutMs: HTTP_TIMEOUT_MS,
    });
    if (!resp.ok) {
      log.warn({ status: resp.status }, "Outlook junk fetch error");
      return 0;
    }
    const data = (await resp.json()) as any;
    if (!data?.value || !Array.isArray(data.value)) return 0;

    let saved = 0;
    for (const msg of data.value) {
      const senderEmail = msg.from?.emailAddress?.address || "Inconnu";
      const senderName = msg.from?.emailAddress?.name || senderEmail;
      const toRecipients: any[] = Array.isArray(msg.toRecipients) ? msg.toRecipients : [];
      const recipient = toRecipients
        .map((r) => r?.emailAddress?.address)
        .filter((x: any) => !!x)
        .join(", ") || conn.email_address;

      const result = await saveJunk(
        {
          externalId: `outlook:${msg.id}`,
          sender: `${senderName} <${senderEmail}>`,
          subject: msg.subject || "(pas de sujet)",
          body: msg.bodyPreview || "",
          createdAt: msg.receivedDateTime,
          recipient,
          headers: {},
          providerMessageId: msg.internetMessageId || null,
        },
        conn.user_id,
        sharedMailboxId,
      );
      if (result) saved++;
    }
    log.info({ saved }, "Outlook junk fetch complete");
    return saved;
  } catch (err: any) {
    log.warn({ err: err.message }, "Outlook junk fetch failed");
    return 0;
  }
}

export function isValidImapHost(host: string): boolean {
  if (!host || typeof host !== "string") return false;
  if (/^(localhost|127\.|10\.|192\.168\.|::1)/.test(host)) return false;
  return /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)+$/.test(host);
}

export async function moveImapMessage(
  conn: { id: string; email_address: string; access_token: string; refresh_token: string; junk_folder_path?: string | null },
  uid: number,
  fromFolder: string,
  toFolder: "INBOX" | "JUNK" | "TRASH",
): Promise<{ ok: true; newUid: number | null; targetFolder: string } | { ok: false }> {
  const log = logger.child({ service: "junk-move-imap", email: conn.email_address });
  let imapConfig: { host: string; port: number };
  try {
    imapConfig = JSON.parse(conn.refresh_token);
  } catch {
    return { ok: false };
  }
  if (!isValidImapHost(imapConfig.host)) return { ok: false };

  const client = new ImapFlow({
    host: imapConfig.host,
    port: Number(imapConfig.port) || 993,
    secure: true,
    auth: { user: conn.email_address, pass: conn.access_token },
    logger: false,
  });

  try {
    await Promise.race([
      client.connect(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("connect timeout")), 15_000)),
    ]);

    let target: string;
    if (toFolder === "INBOX") {
      target = "INBOX";
    } else if (toFolder === "JUNK") {
      const junkPath = await discoverImapJunkFolder(client, conn.junk_folder_path);
      if (!junkPath) {
        log.warn("Move to JUNK aborted: no junk folder discovered");
        return { ok: false };
      }
      target = junkPath;
    } else {
      const trashPath = await discoverImapTrashFolder(client);
      if (!trashPath) {
        log.warn("Move to TRASH aborted: no trash folder discovered");
        return { ok: false };
      }
      target = trashPath;
    }

    const lock = await withTimeout(
      client.getMailboxLock(fromFolder),
      IMAP_MOVE_LOCK_TIMEOUT_MS,
      `Move lock ${fromFolder}`,
    );
    let newUid: number | null = null;
    try {
      const result: any = await withTimeout(
        client.messageMove(String(uid), target, { uid: true }),
        IMAP_MOVE_TIMEOUT_MS,
        "IMAP messageMove",
      );
      const uidMap = result?.uidMap;
      if (uidMap && typeof uidMap.get === "function") {
        const mapped = uidMap.get(uid);
        if (typeof mapped === "number") newUid = mapped;
      } else if (uidMap && typeof uidMap === "object") {
        const mapped = (uidMap as Record<string, number>)[String(uid)];
        if (typeof mapped === "number") newUid = mapped;
      }
      log.info({ uid, fromFolder, target, newUid }, "IMAP message moved");
    } finally {
      lock.release();
    }
    return { ok: true, newUid, targetFolder: target };
  } catch (err: any) {
    log.warn({ err: err.message, uid, fromFolder, toFolder }, "IMAP move failed");
    return { ok: false };
  } finally {
    try { await withTimeout(client.logout(), 5_000, "IMAP move logout"); } catch {}
  }
}

export async function moveOutlookMessage(
  accessToken: string,
  messageId: string,
  destination: "inbox" | "junkemail" | "deleteditems",
): Promise<{ ok: true; newId: string | null } | { ok: false }> {
  const log = logger.child({ service: "junk-move-outlook" });
  try {
    const resp = await fetchWithTimeout(
      `https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(messageId)}/move`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ destinationId: destination }),
        timeoutMs: HTTP_TIMEOUT_MS,
      },
    );
    if (!resp.ok) {
      log.warn({ status: resp.status, destination }, "Outlook move failed");
      return { ok: false };
    }
    const body = await resp.json().catch(() => null) as any;
    const newId = body?.id || null;
    log.info({ messageId, destination, newId }, "Outlook message moved");
    return { ok: true, newId };
  } catch (err: any) {
    log.warn({ err: err.message }, "Outlook move error");
    return { ok: false };
  }
}
