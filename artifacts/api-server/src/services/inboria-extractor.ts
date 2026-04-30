import OpenAI from "openai";
import { z } from "zod";
import { supabaseAdmin } from "../lib/supabase";
import { logger } from "../lib/logger";

const EXTRACT_INTERVAL_MS = 15 * 60 * 1000;
const BATCH_SIZE = 20;
const MIN_BODY_CHARS = 50;
const MAX_BODY_CHARS = 6000;
const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMS = 1536;
const EXTRACTION_MODEL = "gpt-4o-mini";

const FACT_KINDS = ["preference", "topic", "role"] as const;
const EPISODE_KINDS = ["decision", "commitment"] as const;

const FactSchema = z.object({
  kind: z.enum(FACT_KINDS),
  statement: z.string().min(3).max(280),
  confidence: z.number().min(0).max(1),
});

const EpisodeSchema = z.object({
  kind: z.enum(EPISODE_KINDS),
  summary: z.string().min(3).max(280),
  event_date: z.string().nullable().optional(),
});

const ExtractionRawSchema = z.object({
  facts: z.array(z.unknown()).default([]),
  episodes: z.array(z.unknown()).default([]),
});

interface ParsedExtraction {
  facts: z.infer<typeof FactSchema>[];
  episodes: z.infer<typeof EpisodeSchema>[];
}

let extractRunning = false;

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

function parseAddressEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  const m = s.match(/<\s*([^<>]+)\s*>/);
  const addr = (m ? m[1] : s).trim().toLowerCase();
  if (!addr.includes("@")) return null;
  return addr;
}

function stripHtml(s: string): string {
  return s
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isValidIsoDate(d: string | null | undefined): string | null {
  if (!d) return null;
  const m = String(d).match(/^\d{4}-\d{2}-\d{2}$/);
  if (!m) return null;
  const t = Date.parse(`${d}T00:00:00Z`);
  if (Number.isNaN(t)) return null;
  return d;
}

async function userExists(userId: string | null, cache: Map<string, boolean>): Promise<boolean> {
  if (!userId) return false;
  const key = `userExists:${userId}`;
  if (cache.has(key)) return cache.get(key)!;
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  const exists = !!data;
  cache.set(key, exists);
  return exists;
}

async function isMailboxInboriaEnabled(
  email: EmailRow,
  cache: Map<string, boolean>,
): Promise<boolean> {
  if (email.shared_mailbox_id) {
    const cacheKey = `smbx:${email.shared_mailbox_id}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey)!;
    const { data } = await supabaseAdmin
      .from("shared_mailboxes")
      .select("inboria_enabled")
      .eq("id", email.shared_mailbox_id)
      .maybeSingle();
    const enabled = (data as any)?.inboria_enabled !== false;
    cache.set(cacheKey, enabled);
    return enabled;
  }
  if (!email.user_id) return false;
  const cacheKey = `user:${email.user_id}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey)!;
  // Personal: enabled if at least one of the user's email_connections has inboria_enabled=true
  // (the column defaults to true; only an explicit opt-out turns it off across all connections).
  const { data } = await supabaseAdmin
    .from("email_connections")
    .select("inboria_enabled")
    .eq("user_id", email.user_id);
  const rows = (data || []) as Array<{ inboria_enabled: boolean | null }>;
  const enabled = rows.length === 0 ? true : rows.some((r) => r.inboria_enabled !== false);
  cache.set(cacheKey, enabled);
  return enabled;
}

type ExtractionResult =
  | { ok: true; data: ParsedExtraction }
  | { ok: false; transient: boolean };

function isTransientError(err: any): boolean {
  const status = err?.status ?? err?.statusCode;
  if (typeof status === "number") {
    return status === 408 || status === 429 || status >= 500;
  }
  // No HTTP status (network/timeout) → treat as transient.
  return true;
}

async function extractStructured(
  openai: OpenAI,
  contactEmail: string,
  subject: string,
  cleanBody: string,
): Promise<ExtractionResult> {
  try {
    const completion = await openai.chat.completions.create({
      model: EXTRACTION_MODEL,
      temperature: 0.1,
      max_completion_tokens: 700,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Tu es Inboria, la mémoire contextuelle d'un assistant email B2B. Tu lis un email et tu extrais STRICTEMENT ce qui est explicitement écrit, jamais d'inférence ni de devinette. Ne JAMAIS inventer. Si rien d'extractible: renvoie des tableaux vides.\n\nFAIT (kind):\n- preference: une préférence du contact (ex: 'préfère être contacté par email', 'aime les rendez-vous le matin')\n- topic: un sujet d'intérêt récurrent du contact (ex: 'travaille sur la migration ERP', 'cherche un fournisseur logistique')\n- role: la fonction ou le rôle du contact (ex: 'directrice marketing chez Acme', 'fondateur de XYZ')\n\nÉPISODE (kind):\n- decision: une décision actée par le contact (ex: 'décide de reporter le projet à Q3')\n- commitment: un engagement pris par le contact (ex: 'envoie le devis avant vendredi')\n\nRéponds en JSON strict: {\"facts\":[{\"kind\":\"preference|topic|role\",\"statement\":\"phrase courte factuelle\",\"confidence\":0.0-1.0}],\"episodes\":[{\"kind\":\"decision|commitment\",\"summary\":\"phrase courte\",\"event_date\":\"YYYY-MM-DD ou null\"}]}.\n\nMaximum 6 facts et 3 épisodes. Statements en français, courts (<140 caractères), sans pronom de première personne. Confidence reflète à quel point la phrase est explicitement écrite (>=0.8 = formulé tel quel, 0.5 = clairement implicite, <0.5 = à éviter).",
        },
        {
          role: "user",
          content: `Contact: ${contactEmail}\nSujet: ${subject}\nCorps: ${cleanBody}`,
        },
      ],
    });
    const raw = completion.choices[0]?.message?.content ?? "{}";
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      // Model returned malformed JSON despite response_format. Permanent for this email.
      return { ok: true, data: { facts: [], episodes: [] } };
    }
    const wrapper = ExtractionRawSchema.safeParse(json);
    if (!wrapper.success) return { ok: true, data: { facts: [], episodes: [] } };
    const facts: z.infer<typeof FactSchema>[] = [];
    for (const item of wrapper.data.facts.slice(0, 8)) {
      const r = FactSchema.safeParse(item);
      if (r.success) facts.push(r.data);
    }
    const episodes: z.infer<typeof EpisodeSchema>[] = [];
    for (const item of wrapper.data.episodes.slice(0, 3)) {
      const r = EpisodeSchema.safeParse(item);
      if (r.success) episodes.push(r.data);
    }
    return { ok: true, data: { facts, episodes } };
  } catch (err: any) {
    const transient = isTransientError(err);
    logger.warn(
      { err: err?.message, status: err?.status ?? err?.statusCode, transient },
      "[inboria-extractor] extraction call failed",
    );
    return { ok: false, transient };
  }
}

async function embedStatements(openai: OpenAI, statements: string[]): Promise<(number[] | null)[]> {
  if (statements.length === 0) return [];
  try {
    const res = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: statements,
    });
    return res.data.map((d) => {
      if (!Array.isArray(d.embedding) || d.embedding.length !== EMBEDDING_DIMS) return null;
      return d.embedding as number[];
    });
  } catch (err: any) {
    logger.warn({ err: err?.message }, "[inboria-extractor] embeddings call failed");
    return statements.map(() => null);
  }
}

type ProcessOutcome = "processed" | "skipped" | "transient_error";

async function processEmail(
  openai: OpenAI,
  email: EmailRow,
  cache: Map<string, boolean>,
): Promise<ProcessOutcome> {
  // Skip orphan emails (user deleted) — would FK-fail on insert anyway.
  if (email.user_id && !email.shared_mailbox_id) {
    const exists = await userExists(email.user_id, cache);
    if (!exists) return "skipped";
  }
  const enabled = await isMailboxInboriaEnabled(email, cache);
  if (!enabled) return "skipped";

  const contactEmail = parseAddressEmail(email.sender);
  const isOutgoing = !!email.sent_at;
  const subject = (email.subject || "").trim();
  const rawBody = (email.body || "").trim();
  if (!contactEmail || isOutgoing || rawBody.length < MIN_BODY_CHARS) return "skipped";

  const cleanBody = stripHtml(rawBody).slice(0, MAX_BODY_CHARS);
  if (cleanBody.length < MIN_BODY_CHARS) return "skipped";

  const extraction = await extractStructured(openai, contactEmail, subject, cleanBody);
  if (!extraction.ok) return extraction.transient ? "transient_error" : "skipped";
  const parsed = extraction.data;

  if (parsed.facts.length > 0) {
    const embeddings = await embedStatements(openai, parsed.facts.map((f) => f.statement));
    const factRows = parsed.facts.map((f, i) => {
      const row: Record<string, any> = {
        contact_email: contactEmail,
        user_id: email.user_id,
        shared_mailbox_id: email.shared_mailbox_id,
        source_email_id: email.id,
        kind: f.kind,
        statement: f.statement,
        confidence: f.confidence,
      };
      const vec = embeddings[i];
      if (vec) row.embedding = vec as any;
      return row;
    });
    const { error } = await supabaseAdmin.from("inboria_facts").insert(factRows);
    if (error) {
      logger.warn({ err: error.message, emailId: email.id }, "[inboria-extractor] facts insert failed");
    }
  }

  if (parsed.episodes.length > 0) {
    const episodeRows = parsed.episodes.map((e) => ({
      contact_email: contactEmail,
      user_id: email.user_id,
      shared_mailbox_id: email.shared_mailbox_id,
      source_email_id: email.id,
      kind: e.kind,
      summary: e.summary,
      event_date: isValidIsoDate(e.event_date),
    }));
    const { error } = await supabaseAdmin.from("inboria_episodes").insert(episodeRows);
    if (error) {
      logger.warn({ err: error.message, emailId: email.id }, "[inboria-extractor] episodes insert failed");
    }
  }

  return "processed";
}

export async function runInboriaExtractorOnce(): Promise<{
  processed: number;
  skipped: number;
  retried: number;
}> {
  if (extractRunning) return { processed: 0, skipped: 0, retried: 0 };
  extractRunning = true;
  let processed = 0;
  let skipped = 0;
  let retried = 0;
  try {
    if (!process.env["OPENAI_API_KEY"]) {
      logger.warn("[inboria-extractor] OPENAI_API_KEY missing, skipping run");
      return { processed: 0, skipped: 0, retried: 0 };
    }
    const openai = new OpenAI({ apiKey: process.env["OPENAI_API_KEY"] });

    const { data, error } = await supabaseAdmin
      .from("emails")
      .select("id, user_id, shared_mailbox_id, sender, recipient, subject, body, status, sent_at, created_at")
      .is("inboria_processed_at", null)
      .neq("status", "spam")
      .is("sent_at", null)
      .order("created_at", { ascending: false })
      .limit(BATCH_SIZE);

    if (error) {
      logger.warn({ err: error.message }, "[inboria-extractor] batch fetch failed");
      return { processed: 0, skipped: 0, retried: 0 };
    }

    const cache = new Map<string, boolean>();
    for (const row of (data || []) as EmailRow[]) {
      let outcome: ProcessOutcome = "skipped";
      try {
        outcome = await processEmail(openai, row, cache);
      } catch (err: any) {
        logger.warn({ err: err?.message, emailId: row.id }, "[inboria-extractor] email processing crashed");
        outcome = "skipped";
      }
      if (outcome === "processed") processed += 1;
      else if (outcome === "transient_error") retried += 1;
      else skipped += 1;

      // Only mark processed when we either succeeded or made a deterministic
      // business decision to skip. Transient provider failures stay in the
      // queue so the next cycle can retry them.
      if (outcome !== "transient_error") {
        const { error: markErr } = await supabaseAdmin
          .from("emails")
          .update({ inboria_processed_at: new Date().toISOString() })
          .eq("id", row.id);
        if (markErr) {
          logger.warn({ err: markErr.message, emailId: row.id }, "[inboria-extractor] mark processed failed");
        }
      }
    }

    if ((data || []).length > 0) {
      logger.info(
        { processed, skipped, retried, batch: (data || []).length },
        "[inboria-extractor] run complete",
      );
    }
    return { processed, skipped, retried };
  } finally {
    extractRunning = false;
  }
}

export function startInboriaExtractor(): void {
  // First run after 60s to let server warm up; then every EXTRACT_INTERVAL_MS.
  setTimeout(() => {
    runInboriaExtractorOnce().catch((err) =>
      logger.warn({ err: err?.message }, "[inboria-extractor] initial run failed"),
    );
    setInterval(() => {
      runInboriaExtractorOnce().catch((err) =>
        logger.warn({ err: err?.message }, "[inboria-extractor] scheduled run failed"),
      );
    }, EXTRACT_INTERVAL_MS);
  }, 60_000);
  logger.info({ intervalMs: EXTRACT_INTERVAL_MS, batchSize: BATCH_SIZE }, "[inboria-extractor] scheduled");
}
