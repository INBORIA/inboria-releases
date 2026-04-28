import { supabaseAdmin } from "../lib/supabase";
import { logger } from "../lib/logger";
import { recordAutopilotEvent } from "./autopilot-events";

const DEFAULT_DELAY_DAYS = 5;
const MAX_PER_USER_PER_RUN = 25;
const LOOKBACK_DAYS = 90;

export interface SentEmailRow {
  id: number;
  sender: string | null;
  recipient: string | null;
  subject: string | null;
  created_at: string;
  external_id: string | null;
}

export interface FollowupSuggestionInsert {
  user_id: string;
  email_id: number;
  title: string;
  status: "en_attente";
  ai_suggestion: true;
  due_date: string;
  notes: null;
}

function normalizeEmail(addr: string | null | undefined): string | null {
  if (!addr) return null;
  const m = addr.match(/<([^>]+)>/);
  const raw = (m ? m[1] : addr).trim().toLowerCase();
  return raw || null;
}

function buildSuggestionTitle(recipient: string | null, subject: string | null): string {
  const cleanRecipient = normalizeEmail(recipient) || recipient || "destinataire";
  const cleanSubject = (subject || "").replace(/^\s*(re|fwd|tr|fw)\s*:\s*/i, "").trim();
  if (!cleanSubject) return `Relancer ${cleanRecipient}`;
  return `Relancer ${cleanRecipient} — ${cleanSubject}`;
}

interface DetectionContext {
  now: Date;
  delayDays: number;
}

export async function detectForUser(
  userId: string,
  ctx?: Partial<DetectionContext>,
): Promise<{ created: number; scanned: number }> {
  const now = ctx?.now ?? new Date();

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("follow_up_delay_days")
    .eq("id", userId)
    .maybeSingle();

  const delayDays =
    typeof ctx?.delayDays === "number"
      ? ctx.delayDays
      : Math.max(1, Math.min(60, (profile as any)?.follow_up_delay_days ?? DEFAULT_DELAY_DAYS));

  const cutoffSent = new Date(now.getTime() - delayDays * 86_400_000).toISOString();
  const lookbackStart = new Date(now.getTime() - LOOKBACK_DAYS * 86_400_000).toISOString();

  // Mails envoyés DEPUIS Inboria (status="sent" + external_id IS NULL)
  // entre lookback et cutoff (assez vieux pour relance).
  //
  // Pourquoi external_id IS NULL : la route POST /emails/send insère
  // external_id=null pour tout mail envoye via Inboria. A l'inverse, la
  // synchro Gmail/Outlook/IMAP ecrit un external_id non-null (ex.
  // "gmail:<msgid>", "imap:<addr>:<uid>", etc.). Sans ce filtre, la
  // detection proposait des relances pour TOUS les mails sortants
  // synchronises depuis Gmail/Outlook (mails perso, automatiques, deja
  // gérés ailleurs), generant un volume enorme de faux positifs.
  const { data: sentEmails, error: sentErr } = await supabaseAdmin
    .from("emails")
    .select("id, sender, recipient, subject, created_at, external_id")
    .eq("user_id", userId)
    .eq("status", "sent")
    .is("external_id", null)
    .not("recipient", "is", null)
    .gte("created_at", lookbackStart)
    .lte("created_at", cutoffSent)
    .order("created_at", { ascending: false })
    .limit(200);

  if (sentErr) {
    logger.warn({ err: sentErr.message, userId }, "[follow-up-detector] sent fetch failed");
    return { created: 0, scanned: 0 };
  }

  const candidates = (sentEmails || []) as SentEmailRow[];
  if (candidates.length === 0) return { created: 0, scanned: 0 };

  // Mails entrants reçus depuis lookback (pour vérifier les réponses)
  const { data: inbound } = await supabaseAdmin
    .from("emails")
    .select("sender, subject, created_at")
    .eq("user_id", userId)
    .is("recipient", null)
    .gte("created_at", lookbackStart);

  const inboundList = (inbound || []) as Array<{ sender: string | null; subject: string | null; created_at: string }>;
  // Plus récent timestamp d'inbound par expéditeur normalisé. Une "réponse"
  // ne compte que si elle est postérieure au mail envoyé (sans cela, un
  // ancien mail entrant du même contact masque toujours une vraie absence
  // de réponse aux mails ultérieurs).
  const lastInboundBySender = new Map<string, number>();
  for (const inb of inboundList) {
    const fromAddr = normalizeEmail(inb.sender);
    if (!fromAddr) continue;
    const ts = new Date(inb.created_at).getTime();
    if (!Number.isFinite(ts)) continue;
    const prev = lastInboundBySender.get(fromAddr);
    if (prev === undefined || ts > prev) lastInboundBySender.set(fromAddr, ts);
  }

  // Suggestions déjà existantes / ignorées (par email_id) pour éviter les doublons
  const candidateIds = candidates.map((c) => c.id);
  const { data: existing } = await supabaseAdmin
    .from("followups")
    .select("email_id")
    .eq("user_id", userId)
    .eq("ai_suggestion", true)
    .in("email_id", candidateIds);

  const alreadySuggested = new Set<number>();
  for (const row of existing || []) {
    if (typeof (row as any).email_id === "number") alreadySuggested.add((row as any).email_id);
  }

  const inserts: FollowupSuggestionInsert[] = [];
  for (const mail of candidates) {
    if (inserts.length >= MAX_PER_USER_PER_RUN) break;
    if (alreadySuggested.has(mail.id)) continue;

    const recipientNorm = normalizeEmail(mail.recipient);
    if (!recipientNorm) continue;
    const sentTs = new Date(mail.created_at).getTime();
    const lastReplyTs = lastInboundBySender.get(recipientNorm);
    if (lastReplyTs !== undefined && Number.isFinite(sentTs) && lastReplyTs > sentTs) continue;

    const dueDate = new Date(now.getTime() + 86_400_000).toISOString().split("T")[0];

    inserts.push({
      user_id: userId,
      email_id: mail.id,
      title: buildSuggestionTitle(mail.recipient, mail.subject),
      status: "en_attente",
      ai_suggestion: true,
      due_date: dueDate,
      notes: null,
    });
  }

  if (inserts.length === 0) return { created: 0, scanned: candidates.length };

  const { error: insertErr } = await supabaseAdmin.from("followups").insert(inserts);
  if (insertErr) {
    logger.warn({ err: insertErr.message, userId }, "[follow-up-detector] insert failed");
    return { created: 0, scanned: candidates.length };
  }

  recordAutopilotEvent({
    userId,
    eventType: "follow_up_detected",
    title: `${inserts.length} relance(s) suggérée(s)`,
    metadata: { count: inserts.length, delayDays },
  }).catch(() => {});

  return { created: inserts.length, scanned: candidates.length };
}

export async function runFollowupDetectionForAllUsers(): Promise<void> {
  try {
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .limit(2000);
    const ids = (profiles || []).map((p: any) => p.id).filter(Boolean);
    let totalCreated = 0;
    for (const userId of ids) {
      try {
        const r = await detectForUser(userId);
        totalCreated += r.created;
      } catch (err: any) {
        logger.warn({ userId, err: err?.message }, "[follow-up-detector] per-user failure");
      }
    }
    if (totalCreated > 0) {
      logger.info({ totalCreated, users: ids.length }, "[follow-up-detector] cycle complete");
    }
  } catch (err: any) {
    logger.warn({ err: err?.message }, "[follow-up-detector] cycle failed");
  }
}
