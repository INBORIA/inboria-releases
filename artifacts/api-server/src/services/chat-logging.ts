import { supabaseAdmin } from "../lib/supabase";
import { logger } from "../lib/logger";

let _hasTableCache: boolean | null = null;
let _lastCheckedAt = 0;
const CACHE_TTL_MS = 60_000;

export async function hasChatLogsTable(): Promise<boolean> {
  const now = Date.now();
  if (_hasTableCache !== null && now - _lastCheckedAt < CACHE_TTL_MS) {
    return _hasTableCache;
  }
  try {
    const { error } = await supabaseAdmin
      .from("inboria_chat_logs")
      .select("id", { head: true, count: "exact" })
      .limit(1);
    _hasTableCache = !error;
  } catch {
    _hasTableCache = false;
  }
  _lastCheckedAt = now;
  if (!_hasTableCache) {
    logger.warn(
      "[chat-logging] inboria_chat_logs table missing — apply migrations/2026_05_18_inboria_chat_logs.sql in Supabase",
    );
  }
  return _hasTableCache;
}

export interface ChatLogEntry {
  userId: string;
  organisationId: string | null;
  questionText: string;
  questionLang: string | null;
  modelUsed: string;
  iterCount: number;
  toolCallsCount: number;
  responseLength: number;
  containsMailId: boolean;
  containsNotFoundMarker: boolean;
  fallbackTriggered: boolean;
  fallbackReason: string | null;
  fallbackWon: boolean;
  latencyMs: number;
  mode: "personal" | "shared" | "admin_team";
}

const NOT_FOUND_MARKERS_RE = [
  /\bje\s+n['e]ai\s+pas\s+trouv[ée]/i,
  /\bje\s+ne\s+trouve\s+pas/i,
  /\baucun\s+(mail|message|r[ée]sultat|[ée]l[ée]ment|contact|projet|dossier)/i,
  /\bpas\s+d['e]\s*(mail|message|r[ée]sultat|[ée]l[ée]ment)/i,
  /\brien\s+trouv[ée]/i,
  /\bi\s+(?:couldn['t]?|could not|did not|didn['t]?)\s+find/i,
  /\bno\s+(results?|emails?|messages?|matching)/i,
  /\bich\s+habe\s+(?:keine|nichts)\s+gefunden/i,
];

export function detectNotFoundMarker(reply: string): boolean {
  return NOT_FOUND_MARKERS_RE.some((re) => re.test(reply));
}

export function detectMailIdCitation(reply: string): boolean {
  return /\[mail#\d+\]/.test(reply);
}

const REFORMULATION_WINDOW_MS = 30_000;

/**
 * Logue une interaction chat. Avant l'insert, vérifie si la précédente
 * question du même user date de moins de 30s : si oui, c'est une
 * REFORMULATION → on flag rétroactivement la précédente comme
 * `was_reformulated = true` (signal implicite d'insatisfaction).
 *
 * Fire-and-forget : ne lève jamais d'exception côté caller.
 */
export async function logChatInteraction(entry: ChatLogEntry): Promise<void> {
  try {
    if (!(await hasChatLogsTable())) return;

    // 1) Détection reformulation : la précédente question est-elle récente ?
    const cutoff = new Date(
      Date.now() - REFORMULATION_WINDOW_MS,
    ).toISOString();
    const { data: prev } = await supabaseAdmin
      .from("inboria_chat_logs")
      .select("id, created_at")
      .eq("user_id", entry.userId)
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(1);

    let reformulationWithinMs: number | null = null;
    if (prev && prev.length > 0) {
      const prevRow = prev[0] as { id: string; created_at: string };
      const elapsed = Date.now() - new Date(prevRow.created_at).getTime();
      reformulationWithinMs = elapsed;
      // Flag rétroactif sur la précédente
      await supabaseAdmin
        .from("inboria_chat_logs")
        .update({
          was_reformulated: true,
          reformulation_within_ms: elapsed,
        })
        .eq("id", prevRow.id);
    }

    // 2) Insert de la nouvelle entrée
    const { error } = await supabaseAdmin.from("inboria_chat_logs").insert({
      user_id: entry.userId,
      organisation_id: entry.organisationId,
      question_text: entry.questionText.slice(0, 2000),
      question_lang: entry.questionLang,
      question_length: entry.questionText.length,
      model_used: entry.modelUsed,
      iter_count: entry.iterCount,
      tool_calls_count: entry.toolCallsCount,
      response_length: entry.responseLength,
      contains_mail_id: entry.containsMailId,
      contains_not_found_marker: entry.containsNotFoundMarker,
      fallback_triggered: entry.fallbackTriggered,
      fallback_reason: entry.fallbackReason,
      fallback_won: entry.fallbackWon,
      latency_ms: entry.latencyMs,
      mode: entry.mode,
      reformulation_within_ms: reformulationWithinMs,
    });
    if (error) {
      logger.warn(
        { err: error.message },
        "[chat-logging] insert failed (non-fatal)",
      );
    }
  } catch (err: any) {
    logger.warn(
      { err: err?.message },
      "[chat-logging] unexpected logging error (non-fatal)",
    );
  }
}
