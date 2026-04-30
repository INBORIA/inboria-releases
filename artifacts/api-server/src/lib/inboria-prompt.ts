import { supabaseAdmin } from "./supabase";
import { getMemberMailboxIds } from "./inbox-scope";

const FACT_KIND_LABELS: Record<string, string> = {
  preference: "Préférence",
  topic: "Sujet récurrent",
  role: "Rôle/contexte",
};

const EPISODE_KIND_LABELS: Record<string, string> = {
  decision: "Décision passée",
  commitment: "Engagement pris",
};

function extractEmailAddress(raw: string | null | undefined): string {
  if (!raw) return "";
  const s = String(raw);
  const m = s.match(/<([^>]+)>/);
  return (m ? m[1] : s).trim().toLowerCase();
}

function buildInboriaScopeFilter(userId: string, memberMailboxIds: string[]): string {
  const personal = `and(user_id.eq.${userId},shared_mailbox_id.is.null)`;
  const parts = [personal];
  if (memberMailboxIds.length > 0) {
    parts.push(`shared_mailbox_id.in.(${memberMailboxIds.join(",")})`);
  }
  return parts.join(",");
}

/**
 * Loads up to N most recent facts and episodes Inboria has noted for a contact,
 * formatted as a compact context block ready to inject into an OpenAI user prompt.
 * Returns "" when no observations exist (caller should not insert any header).
 */
export async function buildInboriaContextBlock(
  userId: string,
  rawContactEmail: string | null | undefined,
  options: { factLimit?: number; episodeLimit?: number } = {},
): Promise<string> {
  const contactEmail = extractEmailAddress(rawContactEmail);
  if (!contactEmail || !contactEmail.includes("@")) return "";

  const factLimit = options.factLimit ?? 8;
  const episodeLimit = options.episodeLimit ?? 5;

  let memberMailboxIds: string[] = [];
  try {
    memberMailboxIds = await getMemberMailboxIds(userId);
  } catch {
    memberMailboxIds = [];
  }
  const scopeFilter = buildInboriaScopeFilter(userId, memberMailboxIds);

  const [factsRes, episodesRes] = await Promise.all([
    supabaseAdmin
      .from("inboria_facts")
      .select("kind, statement, extracted_at")
      .eq("contact_email", contactEmail)
      .or(scopeFilter)
      .order("extracted_at", { ascending: false })
      .limit(factLimit),
    supabaseAdmin
      .from("inboria_episodes")
      .select("kind, summary, event_date, extracted_at")
      .eq("contact_email", contactEmail)
      .or(scopeFilter)
      .order("extracted_at", { ascending: false })
      .limit(episodeLimit),
  ]);

  const facts = (factsRes.data || []) as Array<{ kind: string; statement: string }>;
  const episodes = (episodesRes.data || []) as Array<{
    kind: string;
    summary: string;
    event_date: string | null;
  }>;

  if (facts.length === 0 && episodes.length === 0) return "";

  const lines: string[] = [];
  lines.push("");
  lines.push(
    "Memoire Inboria sur ce contact (a utiliser pour personnaliser le ton, respecter ses preferences et rappeler engagements/decisions le cas echeant) :",
  );
  for (const f of facts) {
    const label = FACT_KIND_LABELS[f.kind] || f.kind;
    lines.push(`- ${label} : ${f.statement}`);
  }
  for (const e of episodes) {
    const label = EPISODE_KIND_LABELS[e.kind] || e.kind;
    const date = e.event_date ? ` (le ${e.event_date})` : "";
    lines.push(`- ${label}${date} : ${e.summary}`);
  }
  return lines.join("\n");
}
