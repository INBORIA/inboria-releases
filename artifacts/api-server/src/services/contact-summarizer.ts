import OpenAI from "openai";
import { supabaseAdmin } from "../lib/supabase";
import { logger } from "../lib/logger";
import { getMemberMailboxIds } from "../lib/inbox-scope";

const SUMMARY_MODEL = "gpt-4o-mini";
const EMBEDDING_MODEL = "text-embedding-3-small";
const SUMMARY_TTL_MS = 24 * 60 * 60 * 1000;
const SUMMARY_MAX_TOKENS = 450;
const RAG_LIMIT = 5;
const FACT_LIMIT = 8;
const EPISODE_LIMIT = 8;
const DECISION_LIMIT = 8;

export interface ContactSummaryResult {
  content: string;
  generatedAt: string;
}

interface MemoryRow {
  count: number;
  hasAny: boolean;
}

let summariesTableMissingWarned = false;
let decisionsTableMissingWarned = false;

function buildScopeFilter(userId: string, memberMailboxIds: string[]): string {
  const personal = `and(user_id.eq.${userId},shared_mailbox_id.is.null)`;
  const parts = [personal];
  if (memberMailboxIds.length > 0) {
    parts.push(`shared_mailbox_id.in.(${memberMailboxIds.join(",")})`);
  }
  return parts.join(",");
}

function isMissing(err: any, table: string): boolean {
  const msg = String(err?.message || "");
  return (
    new RegExp(`relation .*${table}.* does not exist`, "i").test(msg) ||
    new RegExp(`could not find the table.*${table}`, "i").test(msg)
  );
}

async function loadMemory(
  userId: string,
  memberMailboxIds: string[],
  contactEmail: string,
): Promise<{
  facts: Array<{ kind: string; statement: string; source_email_id: number | null }>;
  episodes: Array<{
    kind: string;
    summary: string;
    event_date: string | null;
    source_email_id: number | null;
  }>;
  decisions: Array<{
    decision: string;
    decided_at: string | null;
    amount_eur: number | null;
    source_email_id: number | null;
  }>;
  totals: { facts: number; episodes: number; decisions: number };
}> {
  const scopeFilter = buildScopeFilter(userId, memberMailboxIds);
  const [factsRes, episodesRes, decisionsRes] = await Promise.all([
    supabaseAdmin
      .from("inboria_facts")
      .select("kind, statement, source_email_id, extracted_at")
      .eq("contact_email", contactEmail)
      .or(scopeFilter)
      .order("extracted_at", { ascending: false })
      .limit(FACT_LIMIT),
    supabaseAdmin
      .from("inboria_episodes")
      .select("kind, summary, event_date, source_email_id, extracted_at")
      .eq("contact_email", contactEmail)
      .or(scopeFilter)
      .order("extracted_at", { ascending: false })
      .limit(EPISODE_LIMIT),
    supabaseAdmin
      .from("inboria_decisions")
      .select("decision, decided_at, amount_eur, source_email_id, created_at")
      .eq("contact_email", contactEmail)
      .or(scopeFilter)
      .order("created_at", { ascending: false })
      .limit(DECISION_LIMIT),
  ]);

  const facts = (factsRes.data || []) as any[];
  const episodes = (episodesRes.data || []) as any[];
  let decisions: any[] = [];
  if (decisionsRes.error && isMissing(decisionsRes.error, "inboria_decisions")) {
    if (!decisionsTableMissingWarned) {
      decisionsTableMissingWarned = true;
      logger.warn(
        "[contact-summarizer] inboria_decisions missing — apply migrations/2026_05_05_inboria_decisions_projects.sql",
      );
    }
  } else {
    decisions = (decisionsRes.data || []) as any[];
  }

  return {
    facts,
    episodes,
    decisions,
    totals: { facts: facts.length, episodes: episodes.length, decisions: decisions.length },
  };
}

async function loadRagSnippets(
  openai: OpenAI,
  userId: string,
  memberMailboxIds: string[],
  contactEmail: string,
): Promise<
  Array<{ email_id: number; subject: string; sender: string; sent_at: string; content: string }>
> {
  try {
    const query = `Synthèse de la relation avec ${contactEmail} : projets, décisions, engagements, sujets récurrents.`;
    const embedRes = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: query,
    });
    const queryVec = embedRes.data[0]?.embedding as number[] | undefined;
    if (!Array.isArray(queryVec) || queryVec.length !== 1536) return [];
    const { data, error } = await supabaseAdmin.rpc("search_email_chunks", {
      query_vec: queryVec as any,
      scope_user_ids: [userId],
      scope_mailbox_ids: memberMailboxIds,
      exclude_private: false,
      match_limit: 16,
    });
    if (error) {
      const msg = String(error.message || "");
      if (
        !/relation .*email_chunks.* does not exist/i.test(msg) &&
        !/function .*search_email_chunks.* does not exist/i.test(msg)
      ) {
        logger.warn({ err: msg }, "[contact-summarizer] RAG RPC failed");
      }
      return [];
    }
    const hits = ((data as any[]) || [])
      .filter((h) => typeof h.distance === "number" && h.distance < 0.78)
      .slice(0, RAG_LIMIT);
    const seen = new Set<number>();
    const out: any[] = [];
    for (const h of hits) {
      const eid = Number(h.email_id);
      if (seen.has(eid)) continue;
      seen.add(eid);
      out.push({
        email_id: eid,
        subject: String(h.subject || ""),
        sender: String(h.sender || ""),
        sent_at: String(h.sent_at || h.created_at || ""),
        content: String(h.content || "").slice(0, 220).replace(/\s+/g, " "),
      });
    }
    return out;
  } catch (err: any) {
    logger.warn({ err: err?.message }, "[contact-summarizer] RAG failed");
    return [];
  }
}

function buildMemoryBlock(
  facts: Array<{ kind: string; statement: string; source_email_id: number | null }>,
  episodes: Array<{
    kind: string;
    summary: string;
    event_date: string | null;
    source_email_id: number | null;
  }>,
  decisions: Array<{
    decision: string;
    decided_at: string | null;
    amount_eur: number | null;
    source_email_id: number | null;
  }>,
  rag: Array<{
    email_id: number;
    subject: string;
    sender: string;
    sent_at: string;
    content: string;
  }>,
): string {
  const lines: string[] = [];
  if (facts.length > 0) {
    lines.push("FAITS EXTRAITS :");
    for (const f of facts) {
      const tag = f.source_email_id ? ` [mail#${f.source_email_id}]` : "";
      lines.push(`- (${f.kind}) ${f.statement}${tag}`);
    }
  }
  if (episodes.length > 0) {
    lines.push("\nÉPISODES :");
    for (const e of episodes) {
      const date = e.event_date ? ` (${e.event_date})` : "";
      const tag = e.source_email_id ? ` [mail#${e.source_email_id}]` : "";
      lines.push(`- (${e.kind})${date} ${e.summary}${tag}`);
    }
  }
  if (decisions.length > 0) {
    lines.push("\nDÉCISIONS ACTÉES :");
    for (const d of decisions) {
      const date = d.decided_at ? ` (${d.decided_at})` : "";
      const amount =
        typeof d.amount_eur === "number" ? ` — ${d.amount_eur.toLocaleString("fr-FR")} €` : "";
      const tag = d.source_email_id ? ` [mail#${d.source_email_id}]` : "";
      lines.push(`-${date} ${d.decision}${amount}${tag}`);
    }
  }
  if (rag.length > 0) {
    lines.push("\nEXTRAITS DE MAILS PERTINENTS :");
    for (const h of rag) {
      const date = (h.sent_at || "").slice(0, 10);
      lines.push(
        `- [mail#${h.email_id}] ${date} ${h.subject || "(sans objet)"} — "${h.content}"`,
      );
    }
  }
  return lines.join("\n");
}

export async function summarizeContact(
  userId: string,
  rawContactEmail: string,
): Promise<ContactSummaryResult | null> {
  const contactEmail = rawContactEmail.trim().toLowerCase();
  if (!contactEmail.includes("@")) return null;
  if (!process.env["OPENAI_API_KEY"]) return null;

  let memberMailboxIds: string[] = [];
  try {
    memberMailboxIds = await getMemberMailboxIds(userId);
  } catch {
    memberMailboxIds = [];
  }

  // 1. Cache lookup (24h TTL).
  try {
    const { data: cached, error: cacheErr } = await supabaseAdmin
      .from("inboria_contact_summaries")
      .select("summary_md, generated_at, expires_at")
      .eq("user_id", userId)
      .eq("contact_email", contactEmail)
      .maybeSingle();
    if (cacheErr && isMissing(cacheErr, "inboria_contact_summaries")) {
      if (!summariesTableMissingWarned) {
        summariesTableMissingWarned = true;
        logger.warn(
          "[contact-summarizer] inboria_contact_summaries missing — apply migrations/2026_05_05_inboria_decisions_projects.sql",
        );
      }
    } else if (cached) {
      const expiresAt = Date.parse((cached as any).expires_at || "");
      if (Number.isFinite(expiresAt) && expiresAt > Date.now()) {
        return {
          content: (cached as any).summary_md,
          generatedAt: (cached as any).generated_at,
        };
      }
    }
  } catch (err: any) {
    logger.warn({ err: err?.message }, "[contact-summarizer] cache lookup failed");
  }

  // 2. Charge mémoire structurée.
  const memory = await loadMemory(userId, memberMailboxIds, contactEmail);
  if (
    memory.totals.facts === 0 &&
    memory.totals.episodes === 0 &&
    memory.totals.decisions === 0
  ) {
    // Pas de données extraites → pas de synthèse (le front n'affichera rien).
    return null;
  }

  // 3. Charge extraits RAG (best-effort).
  const openai = new OpenAI({ apiKey: process.env["OPENAI_API_KEY"]! });
  const rag = await loadRagSnippets(openai, userId, memberMailboxIds, contactEmail);

  const memoryBlock = buildMemoryBlock(memory.facts, memory.episodes, memory.decisions, rag);

  // 4. Génération de la synthèse.
  let content = "";
  try {
    const completion = await openai.chat.completions.create({
      model: SUMMARY_MODEL,
      temperature: 0.3,
      max_completion_tokens: SUMMARY_MAX_TOKENS,
      messages: [
        {
          role: "system",
          content:
            "Tu es Inboria, l'assistant qui synthétise la relation avec un contact professionnel pour un utilisateur PME francophone. Tu écris en français, vouvoiement, ton factuel et concis. Tu n'inventes RIEN : chaque affirmation DOIT être ancrée dans les données fournies (facts/episodes/decisions/extraits). Si une affirmation n'a pas de source, ne la mets pas. Cite toujours la source au format [mail#ID] à la fin de chaque ligne.\n\nProduis EXACTEMENT 4 sections au format Markdown, dans cet ordre, en omettant une section si elle est vide :\n\n**Projets actifs**\n- Liste 1 à 3 projets/sujets récurrents en cours (depuis topics, episodes, decisions).\n\n**Engagements en cours**\n- Liste 1 à 3 engagements/commitments non clos.\n\n**Dernières décisions**\n- Liste 1 à 3 décisions actées (montant, date si disponible).\n\n**Sujets récurrents**\n- Liste 1 à 3 sujets d'intérêt du contact.\n\nRègles strictes :\n- Maximum 12 lignes au total.\n- Chaque ligne ≤ 140 caractères.\n- Toute ligne SANS [mail#ID] est interdite.\n- Pas de préambule, pas de conclusion, pas de phrases génériques.",
        },
        {
          role: "user",
          content: `Contact : ${contactEmail}\n\nDonnées disponibles :\n${memoryBlock}`,
        },
      ],
    });
    content = completion.choices[0]?.message?.content?.trim() || "";
  } catch (err: any) {
    logger.warn(
      { err: err?.message, contactEmail },
      "[contact-summarizer] OpenAI call failed",
    );
    return null;
  }

  if (!content) return null;

  const generatedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + SUMMARY_TTL_MS).toISOString();

  // 5. Upsert cache.
  try {
    await supabaseAdmin
      .from("inboria_contact_summaries")
      .upsert(
        {
          user_id: userId,
          shared_mailbox_id: null,
          contact_email: contactEmail,
          summary_md: content,
          generated_at: generatedAt,
          expires_at: expiresAt,
        },
        { onConflict: "user_id,contact_email" },
      );
  } catch (err: any) {
    logger.warn({ err: err?.message }, "[contact-summarizer] cache upsert failed");
  }

  return { content, generatedAt };
}

// Suppress unused interface warning for symmetry placeholder.
export type { MemoryRow };
