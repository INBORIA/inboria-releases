import OpenAI from "openai";
import { supabaseAdmin } from "../lib/supabase";
import { logger } from "../lib/logger";
import { isNoiseEmail } from "./auto-sync";

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMS = 1536;
const BATCH_SIZE = 50;
const CHUNK_TARGET_CHARS = 2000;
const CHUNK_OVERLAP_CHARS = 200;
const MIN_USEFUL_CHARS = 100;
const MAX_CHUNKS_PER_EMAIL = 12;
const EMBED_API_BATCH = 96;

const DAILY_BUDGET_USD = Number(process.env["EMAIL_EMBED_DAILY_BUDGET_USD"] || "1");
const COST_PER_1K_TOKENS_USD = 0.00002;
const APPROX_CHARS_PER_TOKEN = 4;

let embedRunning = false;
let chunksTableMissingWarned = false;
let chunksColumnMissingWarned = false;

let dailyTokenCounter = { dayKey: "", tokensUsed: 0 };

export function dailyEmbeddingBudgetRemainingUsd(): number {
  return dailyBudgetRemainingUsd();
}

function todayKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
}

function dailyBudgetRemainingUsd(): number {
  const k = todayKey();
  if (dailyTokenCounter.dayKey !== k) {
    dailyTokenCounter = { dayKey: k, tokensUsed: 0 };
  }
  const usedUsd = (dailyTokenCounter.tokensUsed / 1000) * COST_PER_1K_TOKENS_USD;
  return DAILY_BUDGET_USD - usedUsd;
}

function recordTokens(approxTokens: number): void {
  const k = todayKey();
  if (dailyTokenCounter.dayKey !== k) {
    dailyTokenCounter = { dayKey: k, tokensUsed: 0 };
  }
  dailyTokenCounter.tokensUsed += approxTokens;
}

interface EmailRow {
  id: number;
  user_id: string | null;
  shared_mailbox_id: string | null;
  sender: string | null;
  recipient: string | null;
  subject: string | null;
  body: string | null;
  status: string | null;
  sent_at: string | null;
  created_at: string | null;
}

function stripHtml(s: string): string {
  return s
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Découpe un texte long en chunks ~CHUNK_TARGET_CHARS avec overlap, en
 * essayant de couper sur une frontière de phrase (`. `, `\n`, `? `, `! `).
 * Préfixe chaque chunk d'un en-tête `Sujet: … / De: … / Date: …` pour
 * ancrer le contexte lors de la recherche sémantique.
 */
export function chunkEmailBody(params: {
  subject: string | null;
  sender: string | null;
  date: string | null;
  bodyText: string;
}): string[] {
  const header =
    `Sujet: ${(params.subject || "(sans objet)").slice(0, 200)}\n` +
    `De: ${(params.sender || "(inconnu)").slice(0, 120)}\n` +
    `Date: ${(params.date || "").slice(0, 32)}\n\n`;

  const text = params.bodyText.trim();
  if (text.length <= CHUNK_TARGET_CHARS) {
    return [header + text];
  }

  const chunks: string[] = [];
  let pos = 0;
  while (pos < text.length && chunks.length < MAX_CHUNKS_PER_EMAIL) {
    let end = Math.min(pos + CHUNK_TARGET_CHARS, text.length);
    if (end < text.length) {
      const window = text.slice(pos, end);
      const breakers = [". ", "\n", "? ", "! ", "; "];
      let bestBreak = -1;
      for (const b of breakers) {
        const idx = window.lastIndexOf(b);
        if (idx > bestBreak) bestBreak = idx;
      }
      if (bestBreak > CHUNK_TARGET_CHARS * 0.6) {
        end = pos + bestBreak + 1;
      }
    }
    const chunk = text.slice(pos, end).trim();
    if (chunk.length >= 20) chunks.push(header + chunk);
    if (end >= text.length) break;
    pos = Math.max(pos + 1, end - CHUNK_OVERLAP_CHARS);
  }
  return chunks;
}

async function embedTexts(
  openai: OpenAI,
  texts: string[],
): Promise<(number[] | null)[]> {
  if (texts.length === 0) return [];
  const out: (number[] | null)[] = [];
  for (let i = 0; i < texts.length; i += EMBED_API_BATCH) {
    const slice = texts.slice(i, i + EMBED_API_BATCH);
    try {
      const res = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: slice,
      });
      const approxTokens = slice.reduce(
        (acc, s) => acc + Math.ceil(s.length / APPROX_CHARS_PER_TOKEN),
        0,
      );
      recordTokens(approxTokens);
      for (const d of res.data) {
        if (Array.isArray(d.embedding) && d.embedding.length === EMBEDDING_DIMS) {
          out.push(d.embedding as number[]);
        } else {
          out.push(null);
        }
      }
    } catch (err: any) {
      logger.warn(
        { err: err?.message },
        "[email-embedder] embeddings call failed",
      );
      for (let j = 0; j < slice.length; j += 1) out.push(null);
    }
  }
  return out;
}

type ProcessOutcome = "indexed" | "skipped" | "transient_error";

export async function processEmailEmbeddings(
  openai: OpenAI,
  email: EmailRow,
): Promise<ProcessOutcome> {
  const subject = (email.subject || "").trim();
  const rawBody = (email.body || "").trim();
  if (!email.user_id && !email.shared_mailbox_id) return "skipped";
  if (rawBody.length < MIN_USEFUL_CHARS && subject.length < 5) return "skipped";
  if (isNoiseEmail(email.sender || "", subject)) return "skipped";

  const cleanBody = stripHtml(rawBody);
  if (cleanBody.length < MIN_USEFUL_CHARS) return "skipped";

  const chunks = chunkEmailBody({
    subject,
    sender: email.sender,
    date: email.sent_at || email.created_at,
    bodyText: cleanBody,
  });
  if (chunks.length === 0) return "skipped";

  const embeddings = await embedTexts(openai, chunks);
  const rows = chunks
    .map((content, i) => {
      const vec = embeddings[i];
      if (!vec) return null;
      return {
        email_id: email.id,
        user_id: email.user_id,
        shared_mailbox_id: email.shared_mailbox_id,
        chunk_index: i,
        content,
        embedding: vec as any,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (rows.length === 0) return "transient_error";

  // Upsert idempotent : la contrainte unique (email_id, chunk_index)
  // garantit qu'un re-run ne duplique pas.
  const { error } = await supabaseAdmin
    .from("email_chunks")
    .upsert(rows, { onConflict: "email_id,chunk_index" });
  if (error) {
    const msg = String(error.message || "");
    const tableMissing =
      /relation .*email_chunks.* does not exist/i.test(msg) ||
      /could not find the table.*email_chunks/i.test(msg);
    const columnMissing =
      /column .*email_chunks\..* does not exist/i.test(msg) ||
      /column .*embedding.* does not exist/i.test(msg);
    if (tableMissing) {
      if (!chunksTableMissingWarned) {
        chunksTableMissingWarned = true;
        logger.warn(
          "[email-embedder] email_chunks table not found — pausing. Apply migrations/2026_05_03_email_chunks.sql in Supabase Dashboard.",
        );
      }
      return "transient_error";
    }
    if (columnMissing && !chunksColumnMissingWarned) {
      chunksColumnMissingWarned = true;
      logger.warn(
        { err: msg },
        "[email-embedder] email_chunks schema drift — apply migrations/2026_05_03_email_chunks.sql in Supabase Dashboard.",
      );
    }
    logger.warn(
      { err: msg, emailId: email.id },
      "[email-embedder] chunks upsert failed",
    );
    return "transient_error";
  }

  return "indexed";
}

async function markIndexed(emailId: number): Promise<void> {
  const { error } = await supabaseAdmin
    .from("emails")
    .update({ embeddings_indexed_at: new Date().toISOString() })
    .eq("id", emailId);
  if (error) {
    logger.warn(
      { err: error.message, emailId },
      "[email-embedder] mark indexed failed",
    );
  }
}

async function probeChunksTable(): Promise<"ok" | "missing"> {
  const { error } = await supabaseAdmin
    .from("email_chunks")
    .select("id", { head: true, count: "exact" })
    .limit(1);
  if (!error) {
    chunksTableMissingWarned = false;
    return "ok";
  }
  const msg = String(error.message || "");
  if (
    /relation .*email_chunks.* does not exist/i.test(msg) ||
    /could not find the table.*email_chunks/i.test(msg)
  ) {
    if (!chunksTableMissingWarned) {
      chunksTableMissingWarned = true;
      logger.warn(
        "[email-embedder] email_chunks table not found — pausing run. Apply migrations/2026_05_03_email_chunks.sql in Supabase Dashboard.",
      );
    }
    return "missing";
  }
  return "ok";
}

export async function runEmailEmbedderOnce(): Promise<{
  indexed: number;
  skipped: number;
  retried: number;
}> {
  if (embedRunning) return { indexed: 0, skipped: 0, retried: 0 };
  embedRunning = true;
  let indexed = 0;
  let skipped = 0;
  let retried = 0;
  try {
    if (!process.env["OPENAI_API_KEY"]) {
      return { indexed: 0, skipped: 0, retried: 0 };
    }
    if (dailyBudgetRemainingUsd() <= 0) {
      logger.warn(
        { budgetUsd: DAILY_BUDGET_USD },
        "[email-embedder] daily budget exhausted, skipping cycle",
      );
      return { indexed: 0, skipped: 0, retried: 0 };
    }
    const probe = await probeChunksTable();
    if (probe === "missing") return { indexed: 0, skipped: 0, retried: 0 };

    const openai = new OpenAI({ apiKey: process.env["OPENAI_API_KEY"] });

    const { data, error } = await supabaseAdmin
      .from("emails")
      .select(
        "id, user_id, shared_mailbox_id, sender, recipient, subject, body, status, sent_at, created_at",
      )
      .is("embeddings_indexed_at", null)
      .neq("status", "spam")
      .order("created_at", { ascending: false })
      .limit(BATCH_SIZE);

    if (error) {
      logger.warn(
        { err: error.message },
        "[email-embedder] batch fetch failed",
      );
      return { indexed: 0, skipped: 0, retried: 0 };
    }

    for (const row of (data || []) as EmailRow[]) {
      let outcome: ProcessOutcome = "skipped";
      try {
        outcome = await processEmailEmbeddings(openai, row);
      } catch (err: any) {
        logger.warn(
          { err: err?.message, emailId: row.id },
          "[email-embedder] processing crashed",
        );
        outcome = "skipped";
      }
      if (outcome === "indexed") indexed += 1;
      else if (outcome === "transient_error") retried += 1;
      else skipped += 1;

      // Marque indexé dès qu'on a fait une décision déterministe (succès
      // ou skip métier). On ne marque PAS sur erreur transitoire pour
      // garder l'email dans la file et retenter au prochain cycle.
      if (outcome !== "transient_error") {
        await markIndexed(row.id);
      }

      if (dailyBudgetRemainingUsd() <= 0) {
        logger.warn(
          { budgetUsd: DAILY_BUDGET_USD, indexed, skipped },
          "[email-embedder] daily budget exhausted mid-batch, stopping",
        );
        break;
      }
    }

    if ((data || []).length > 0) {
      logger.info(
        { indexed, skipped, retried, batch: (data || []).length },
        "[email-embedder] run complete",
      );
    }
    return { indexed, skipped, retried };
  } finally {
    embedRunning = false;
  }
}
