import { supabaseAdmin } from "../lib/supabase";
import { logger } from "../lib/logger";

const POLL_INTERVAL_MS = 60_000;
const MAX_BATCH = 100;

let runningTick = false;

async function tick(): Promise<void> {
  if (runningTick) return;
  runningTick = true;
  try {
    const nowIso = new Date().toISOString();
    // Wake any due snoozed email regardless of current status — the snooze decision is
    // independent of read/archived state. snooze_woken_at IS NULL prevents repeats.
    const { data: due, error } = await supabaseAdmin
      .from("emails")
      .select("id")
      .not("snoozed_until", "is", null)
      .lte("snoozed_until", nowIso)
      .is("snooze_woken_at", null)
      .limit(MAX_BATCH);

    if (error) {
      logger.warn({ error: error.message }, "[snooze-wake] query error");
      return;
    }
    if (!due || due.length === 0) return;

    logger.info({ count: due.length }, "[snooze-wake] waking emails");
    const ids = due.map((r: any) => r.id);
    const { error: updErr } = await supabaseAdmin
      .from("emails")
      .update({ status: "received", snooze_woken_at: nowIso })
      .in("id", ids);
    if (updErr) {
      logger.warn({ error: updErr.message }, "[snooze-wake] update error");
    }
  } catch (e: any) {
    logger.warn({ error: e?.message }, "[snooze-wake] tick error");
  } finally {
    runningTick = false;
  }
}

export function startSnoozeWakeWorker(): void {
  logger.info({ intervalMs: POLL_INTERVAL_MS }, "[snooze-wake] worker started");
  setTimeout(() => {
    void tick();
  }, 7_000);
  setInterval(() => {
    void tick();
  }, POLL_INTERVAL_MS);
}
