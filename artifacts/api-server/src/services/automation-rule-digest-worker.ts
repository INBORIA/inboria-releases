import { logger } from "../lib/logger";
import { supabaseAdmin } from "../lib/supabase";
import { createNotification } from "../lib/activity";

// Sweep every hour, send at most one digest per 23h per user.
const SWEEP_INTERVAL_MS = 60 * 60 * 1000;
const DEDUP_WINDOW_HOURS = 23;
const MIN_ACTIONS = 1;

let timer: NodeJS.Timeout | null = null;

async function sweep(): Promise<number> {
  const now = new Date();
  const since = new Date(now.getTime() - 24 * 3600_000).toISOString();
  const dedupSince = new Date(now.getTime() - DEDUP_WINDOW_HOURS * 3600_000).toISOString();

  const { data: execs, error } = await supabaseAdmin
    .from("rule_executions_audit")
    .select("user_id, rule_id, action_type, occurred_at")
    .gte("occurred_at", since);

  if (error) {
    // Cache 60s : si la table n'existe pas (migration jamais appliquée), no-op silencieux.
    logger.warn({ err: error.message }, "[rule-digest] fetch failed");
    return 0;
  }
  if (!execs || execs.length === 0) return 0;

  const byUser = new Map<string, { total: number; rules: Set<string> }>();
  for (const e of execs as any[]) {
    if (!e.user_id) continue;
    const slot = byUser.get(e.user_id) || { total: 0, rules: new Set<string>() };
    slot.total++;
    if (e.rule_id) slot.rules.add(String(e.rule_id));
    byUser.set(e.user_id, slot);
  }

  let sent = 0;
  for (const [userId, agg] of byUser.entries()) {
    if (agg.total < MIN_ACTIONS) continue;
    try {
      const { data: existing } = await supabaseAdmin
        .from("notifications")
        .select("id")
        .eq("user_id", userId)
        .eq("type", "automation_rule_digest")
        .gte("created_at", dedupSince)
        .limit(1)
        .maybeSingle();
      if (existing) continue;

      const actionsStr = `${agg.total} action${agg.total > 1 ? "s" : ""}`;
      const rulesStr = `${agg.rules.size} règle${agg.rules.size > 1 ? "s" : ""}`;

      await createNotification({
        userId,
        type: "automation_rule_digest",
        title: `${actionsStr} de règle automatique sur 24h`,
        message: `${rulesStr} active${agg.rules.size > 1 ? "s" : ""} — voir le détail`,
      });
      sent++;
    } catch (e: any) {
      logger.warn({ err: e?.message, userId }, "[rule-digest] per-user failed");
    }
  }
  return sent;
}

export function startAutomationRuleDigestWorker(): void {
  if (timer) return;
  const tick = async () => {
    try {
      const sent = await sweep();
      if (sent > 0) logger.info({ sent }, "[rule-digest] digests sent");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ err: msg }, "[rule-digest] sweep crashed");
    }
  };
  setTimeout(tick, 90_000);
  timer = setInterval(tick, SWEEP_INTERVAL_MS);
  logger.info({ intervalMs: SWEEP_INTERVAL_MS }, "[rule-digest] started");
}
