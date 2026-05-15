/**
 * Task #306 phase 3b — Auto-enrichissement du harness Inboria.
 *
 * Scanne `inboria_chat_logs` à la recherche de questions où Inboria a montré
 * un signal de faiblesse en prod réelle :
 *   - `fallback_triggered = true`  → mini a échoué, gpt-4o a dû reprendre
 *   - `was_reformulated = true`     → l'abonné a re-tapé sa question < 30s
 *
 * Ces questions sont des candidats à intégrer dans le harness de tests
 * `challenge-inboria.ts` pour ne plus jamais régresser dessus.
 *
 * Logique de dédupe forte :
 *   - normalisation question (lowercase, trim, strip ponctuation/diacritiques),
 *   - upsert atomique côté Postgres (RPC inboria_harness_upsert_candidate),
 *   - merge sample_log_ids (max 5) + incrément occurrences.
 *
 * Pagination : on lit l'intégralité de la fenêtre lookback en pages de 1000
 * (curseur déterministe sur created_at + id), pour ne JAMAIS perdre de signal
 * même au-delà de 5000 events / 7j.
 *
 * Pas de fuite de PII : on ne logue QUE le texte tapé par l'utilisateur lui-même
 * (déjà présent dans `inboria_chat_logs.question_text` qui ne contient jamais
 * de contenu de mail).
 */

import { supabaseAdmin } from "../lib/supabase";
import { logger } from "../lib/logger";

let _hasTableCache: boolean | null = null;
let _lastCheckedAt = 0;
const CACHE_TTL_MS = 60_000;
const PAGE_SIZE = 1000;
const MAX_PAGES = 50; // garde-fou : 50k events max par cycle

async function hasCandidatesTable(): Promise<boolean> {
  const now = Date.now();
  if (_hasTableCache !== null && now - _lastCheckedAt < CACHE_TTL_MS) {
    return _hasTableCache;
  }
  try {
    const { error } = await supabaseAdmin
      .from("inboria_harness_candidates")
      .select("id", { head: true, count: "exact" })
      .limit(1);
    _hasTableCache = !error;
  } catch {
    _hasTableCache = false;
  }
  _lastCheckedAt = now;
  if (!_hasTableCache) {
    logger.warn(
      "[harness-enrichment] inboria_harness_candidates table missing — apply migrations/2026_05_19_inboria_harness_candidates.sql in Supabase",
    );
  }
  return _hasTableCache;
}

/** Normalise une question pour la dédupe : lowercase, sans diacritiques,
 * ponctuation collapsée, espaces normalisés, max 500 chars. */
export function normalizeQuestion(q: string): string {
  return q
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

interface RunResult {
  scanned: number;
  upserted: number;
  errors: number;
  pages: number;
  truncated: boolean;
}

interface LogRow {
  id: string;
  created_at: string;
  question_text: string | null;
  question_lang: string | null;
  fallback_triggered: boolean;
  was_reformulated: boolean;
}

async function fetchLogsPage(
  sinceIso: string,
  cursorCreatedAt: string | null,
  cursorId: string | null,
): Promise<LogRow[]> {
  let q = supabaseAdmin
    .from("inboria_chat_logs")
    .select("id, created_at, question_text, question_lang, fallback_triggered, was_reformulated")
    .gte("created_at", sinceIso)
    .or("fallback_triggered.eq.true,was_reformulated.eq.true")
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(PAGE_SIZE);

  // Curseur composé (created_at, id) pour pagination déterministe sans gap
  if (cursorCreatedAt && cursorId) {
    // Pages suivantes : created_at > cursor OR (created_at = cursor AND id > cursor_id)
    q = q.or(
      `created_at.gt.${cursorCreatedAt},and(created_at.eq.${cursorCreatedAt},id.gt.${cursorId})`,
    );
  }

  const { data, error } = await q;
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []) as LogRow[];
}

/**
 * Lit les logs des `lookbackHours` dernières heures (par défaut 7 jours pour
 * un cron hebdo) et upsert atomiquement dans `inboria_harness_candidates`
 * via la RPC `inboria_harness_upsert_candidate`.
 */
export async function enrichHarnessFromLogs(
  lookbackHours = 7 * 24,
): Promise<RunResult> {
  const result: RunResult = {
    scanned: 0,
    upserted: 0,
    errors: 0,
    pages: 0,
    truncated: false,
  };

  if (!(await hasCandidatesTable())) {
    logger.warn("[harness-enrichment] candidates table missing — aborting cycle");
    return result;
  }

  const since = new Date(Date.now() - lookbackHours * 3600 * 1000).toISOString();

  // 1) Pagination déterministe (curseur composé created_at + id)
  const grouped = new Map<
    string,
    {
      question_text: string;
      question_norm: string;
      question_lang: string | null;
      signal_kind: "fallback" | "reformulation" | "fallback+reformulation";
      logIds: string[];
      occurrences: number;
    }
  >();

  let cursorCreatedAt: string | null = null;
  let cursorId: string | null = null;

  for (let page = 0; page < MAX_PAGES; page++) {
    let rows: LogRow[];
    try {
      rows = await fetchLogsPage(since, cursorCreatedAt, cursorId);
    } catch (err: any) {
      logger.warn(
        { err: err?.message, page },
        "[harness-enrichment] failed to load chat logs page",
      );
      result.errors++;
      break;
    }
    if (rows.length === 0) break;

    result.pages++;
    result.scanned += rows.length;

    for (const row of rows) {
      if (!row.question_text || row.question_text.trim().length < 3) continue;
      const norm = normalizeQuestion(row.question_text);
      if (!norm) continue;

      const kind =
        row.fallback_triggered && row.was_reformulated
          ? "fallback+reformulation"
          : row.fallback_triggered
            ? "fallback"
            : "reformulation";

      const key = `${kind}::${norm}`;
      const existing = grouped.get(key);
      if (existing) {
        existing.occurrences++;
        if (existing.logIds.length < 5) existing.logIds.push(row.id);
      } else {
        grouped.set(key, {
          question_text: row.question_text.slice(0, 2000),
          question_norm: norm,
          question_lang: row.question_lang,
          signal_kind: kind,
          logIds: [row.id],
          occurrences: 1,
        });
      }
    }

    // Avance le curseur sur le DERNIER row (rows est ordonné par created_at,id)
    const last = rows[rows.length - 1];
    cursorCreatedAt = last.created_at;
    cursorId = last.id;

    // Si la page n'est pas pleine, on a tout récupéré
    if (rows.length < PAGE_SIZE) break;

    // Garde-fou : signale qu'on tronque
    if (page === MAX_PAGES - 1) {
      result.truncated = true;
      logger.warn(
        { maxPages: MAX_PAGES, scanned: result.scanned },
        "[harness-enrichment] reached MAX_PAGES — some logs may be truncated",
      );
    }
  }

  // 2) Upsert atomique via RPC pour chaque groupe (PAS de N+1 SELECT/UPDATE)
  for (const g of grouped.values()) {
    const { error: rpcErr } = await supabaseAdmin.rpc(
      "inboria_harness_upsert_candidate" as any,
      {
        p_question_text: g.question_text,
        p_question_norm: g.question_norm,
        p_question_lang: g.question_lang,
        p_signal_kind: g.signal_kind,
        p_occurrences: g.occurrences,
        p_log_ids: g.logIds,
      },
    );
    if (rpcErr) {
      result.errors++;
      logger.warn(
        { err: rpcErr.message, signalKind: g.signal_kind },
        "[harness-enrichment] RPC upsert failed",
      );
    } else {
      result.upserted++;
    }
  }

  logger.info(
    {
      scanned: result.scanned,
      upserted: result.upserted,
      uniqueCandidates: grouped.size,
      errors: result.errors,
      pages: result.pages,
      truncated: result.truncated,
      lookbackHours,
    },
    "[harness-enrichment] cycle done",
  );

  return result;
}
