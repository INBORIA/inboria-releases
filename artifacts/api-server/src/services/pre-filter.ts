import { supabaseAdmin } from "../lib/supabase";
import { logger } from "../lib/logger";
import { SYSTEM_CATEGORY_NAME } from "../lib/system-categories";

// Noms qui désignent la catégorie "fourre-tout" (système ou héritée d'anciens
// utilisateurs anglais/néerlandais). On ne veut JAMAIS apprendre du cache
// pour ces classifications : ce sont précisément les emails qui restent à
// trier, et les utiliser comme signal récurrent renforcerait la cellule
// fourre-tout au lieu de l'éclaircir.
const UNCLASSIFIED_NAMES = new Set<string>(
  [SYSTEM_CATEGORY_NAME, "Non classe", "Uncategorized", "Niet geclassificeerd"].map(
    (n) => n.toLowerCase(),
  ),
);

export interface PreFilterClassification {
  priority: "urgent" | "moyen" | "faible";
  summary: string;
  category: string;
  tasks: string[];
  is_spam: boolean;
}

export type PreFilterReason =
  | "list-unsubscribe"
  | "auto-submitted"
  | "precedence-bulk"
  | "noreply-pattern"
  | "sender-cache";

export interface PreFilterResult {
  hit: boolean;
  reason?: PreFilterReason;
  classification?: PreFilterClassification;
}

const FEATURE_ENABLED = process.env["PREFILTER_ENABLED"] !== "false";
const CACHE_THRESHOLD = 3;
const CACHE_TTL_DAYS = 60;

// Local-parts strictement automatiques (pas d'humains derriere). On exclut "support/hello/team"
// qui peuvent etre des boites humaines legitimes.
const NOREPLY_LOCAL_RE = /^(noreply|no-reply|no\.reply|donotreply|do-not-reply|notification|notifications|alerts?|alert|info-noreply|mailer-daemon|postmaster|automated|news|newsletter|team-noreply|bounce|bounces|return|returns|email|mailing|broadcast|digest)$/i;
const URGENT_KEYWORDS_RE = /(urgent|facture|invoice|payment|paiement|impaye|impay[ée]|password|mot de passe|verification|verif|code|otp|2fa|alert|alerte|securit|fraud|suspicious|bloqu[eé])/i;

function lowerHeaders(headers?: Record<string, string | string[] | undefined>): Map<string, string> {
  const m = new Map<string, string>();
  if (!headers) return m;
  for (const [k, v] of Object.entries(headers)) {
    if (v === undefined || v === null) continue;
    const val = Array.isArray(v) ? v.join(", ") : String(v);
    m.set(k.toLowerCase(), val);
  }
  return m;
}

function extractEmailAddress(sender: string): string {
  if (!sender) return "";
  const m = sender.match(/<([^>]+)>/);
  if (m && m[1]) return m[1].trim().toLowerCase();
  const trimmed = sender.trim().toLowerCase();
  if (trimmed.includes("@")) return trimmed;
  return "";
}

/**
 * Etage 1 — Headers / sender deterministes (zero appel IA)
 */
function classifyByHeaders(
  sender: string,
  subject: string,
  headers: Map<string, string>
): { reason: PreFilterReason; category: string } | null {
  if (headers.has("list-unsubscribe") || headers.has("list-unsubscribe-post")) {
    return { reason: "list-unsubscribe", category: "Newsletters" };
  }

  const autoSub = headers.get("auto-submitted");
  if (autoSub && /auto-(generated|replied)/i.test(autoSub)) {
    return { reason: "auto-submitted", category: "Notifications" };
  }

  const precedence = headers.get("precedence");
  if (precedence && /(bulk|list|junk)/i.test(precedence)) {
    return { reason: "precedence-bulk", category: "Newsletters" };
  }

  // Match noreply pattern sur le local-part de l'adresse uniquement (pas sur le display name)
  const senderEmail = extractEmailAddress(sender || "");
  const localPart = senderEmail.split("@")[0] || "";
  if (NOREPLY_LOCAL_RE.test(localPart) && !URGENT_KEYWORDS_RE.test(subject || "")) {
    return { reason: "noreply-pattern", category: "Notifications" };
  }

  return null;
}

/**
 * Etage 2 — Cache d'expediteur recurrent (lookup Supabase)
 */
async function classifyBySenderCache(
  userId: string,
  senderEmail: string
): Promise<{ category: string; priority: PreFilterClassification["priority"] } | null> {
  if (!senderEmail) return null;

  const ttlCutoff = new Date(Date.now() - CACHE_TTL_DAYS * 24 * 3600 * 1000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("sender_cache")
    .select("category_name, priority, hit_count, last_used_at")
    .eq("user_id", userId)
    .eq("sender_email", senderEmail)
    .gte("last_used_at", ttlCutoff)
    .maybeSingle();

  if (error || !data) return null;
  if ((data.hit_count || 0) < CACHE_THRESHOLD) return null;

  return {
    category: data.category_name,
    priority: data.priority as PreFilterClassification["priority"],
  };
}

export interface PreClassifyInput {
  userId: string;
  sender: string;
  subject: string;
  headers?: Record<string, string | string[] | undefined>;
}

/**
 * Pre-classifie un email entrant. Retourne hit=true si la classification
 * est deterministe ou en cache (zero appel IA), sinon hit=false (flux IA standard).
 *
 * Toujours fail-safe : en cas d'erreur, retourne {hit:false}.
 */
export async function preClassifyEmail(input: PreClassifyInput): Promise<PreFilterResult> {
  if (!FEATURE_ENABLED) return { hit: false };

  try {
    const { userId, sender, subject, headers } = input;
    const headerMap = lowerHeaders(headers);

    // Etage 1 — headers / sender pattern
    const headerHit = classifyByHeaders(sender || "", subject || "", headerMap);
    if (headerHit) {
      return {
        hit: true,
        reason: headerHit.reason,
        classification: {
          priority: "faible",
          summary: "",
          category: headerHit.category,
          tasks: [],
          is_spam: false,
        },
      };
    }

    // Etage 2 — cache expediteur
    const senderEmail = extractEmailAddress(sender || "");
    if (senderEmail) {
      const cacheHit = await classifyBySenderCache(userId, senderEmail);
      if (cacheHit) {
        return {
          hit: true,
          reason: "sender-cache",
          classification: {
            priority: cacheHit.priority,
            summary: "",
            category: cacheHit.category,
            tasks: [],
            is_spam: false,
          },
        };
      }
    }

    return { hit: false };
  } catch (err: any) {
    logger.warn({ err: err?.message }, "[pre-filter] preClassifyEmail error, falling back to IA");
    return { hit: false };
  }
}

/**
 * Met a jour le cache apres un appel IA reussi (incremente hit_count si meme classif).
 */
export async function recordAIClassification(
  userId: string,
  sender: string,
  category: string,
  priority: string
): Promise<void> {
  if (!FEATURE_ENABLED) return;
  try {
    const senderEmail = extractEmailAddress(sender || "");
    if (!senderEmail || !category) return;
    // On ne cache pas les classifications "fourre-tout" : ce sont les
    // emails qui restent à trier (catégorie système ou héritée). Les
    // mémoriser ferait croire au pré-filtre qu'il faut renvoyer
    // l'expéditeur dans la cellule "à trier" la prochaine fois.
    if (UNCLASSIFIED_NAMES.has(category.trim().toLowerCase())) return;
    if (!["urgent", "moyen", "faible"].includes(priority)) return;

    // Upsert atomique cote PostgreSQL pour eviter les race conditions
    // (la fonction RPC gere insert-ou-increment-ou-reset selon la consistance de la classif)
    const { error } = await supabaseAdmin.rpc("upsert_sender_cache", {
      user_id_input: userId,
      sender_input: senderEmail,
      category_input: category,
      priority_input: priority,
    });
    if (error) {
      logger.debug({ err: error.message }, "[pre-filter] upsert_sender_cache RPC unavailable");
    }
  } catch (err: any) {
    logger.warn({ err: err?.message }, "[pre-filter] recordAIClassification error");
  }
}

/**
 * Invalide le cache d'un expediteur (a appeler quand l'utilisateur reclasse manuellement).
 */
export async function invalidateSenderCache(userId: string, sender: string): Promise<void> {
  try {
    const senderEmail = extractEmailAddress(sender || "");
    if (!senderEmail) return;
    await supabaseAdmin
      .from("sender_cache")
      .delete()
      .eq("user_id", userId)
      .eq("sender_email", senderEmail);
  } catch (err: any) {
    logger.warn({ err: err?.message }, "[pre-filter] invalidateSenderCache error");
  }
}

/**
 * Incremente les compteurs de metriques sur le profil (fail-safe).
 */
export async function bumpMetrics(
  userId: string,
  kind: "prefilter" | "cache" | "ai"
): Promise<void> {
  try {
    const params: Record<string, number> = {
      prefilter_inc: 0,
      cache_inc: 0,
      ai_inc: 0,
    };
    if (kind === "prefilter") params.prefilter_inc = 1;
    else if (kind === "cache") params.cache_inc = 1;
    else params.ai_inc = 1;

    const { error } = await supabaseAdmin.rpc("increment_prefilter_metrics", {
      user_id_input: userId,
      ...params,
    });
    if (error) {
      // Silencieux : les compteurs sont bonus, pas critiques
      logger.debug({ err: error.message, kind }, "[pre-filter] bumpMetrics RPC unavailable");
    }
  } catch {
    // ignore
  }
}
