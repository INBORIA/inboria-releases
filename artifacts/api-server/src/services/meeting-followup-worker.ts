import { logger } from "../lib/logger";
import { runMeetingFollowupSweep } from "./meeting-proposals";

const SWEEP_INTERVAL_MS = 10 * 60 * 1000;

let timer: NodeJS.Timeout | null = null;

export function startMeetingFollowupWorker(): void {
  if (timer) return;
  const tick = async () => {
    try {
      const sent = await runMeetingFollowupSweep();
      if (sent > 0) logger.info({ sent }, "[meeting-followup-worker] reminders sent");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ err: msg }, "[meeting-followup-worker] sweep crashed");
    }
  };
  // First sweep after 30s to let the rest of the boot finish.
  setTimeout(tick, 30_000);
  timer = setInterval(tick, SWEEP_INTERVAL_MS);
  logger.info({ intervalMs: SWEEP_INTERVAL_MS }, "[meeting-followup-worker] started");
}
