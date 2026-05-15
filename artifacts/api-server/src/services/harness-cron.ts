/**
 * Task #306 phase 3b — Cron hebdomadaire d'auto-enrichissement du harness.
 *
 * Au démarrage du serveur :
 *   - 1ère exécution 5 minutes après boot (laisse le serveur stabilité),
 *   - puis toutes les 7 jours.
 *
 * Lookback aligné sur l'intervalle (7j) pour ne jamais perdre de signal.
 */

import { logger } from "../lib/logger";
import { enrichHarnessFromLogs } from "./harness-enrichment";

const HARNESS_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours
const HARNESS_FIRST_RUN_DELAY_MS = 5 * 60 * 1000; // 5 min après boot
const HARNESS_LOOKBACK_HOURS = 7 * 24; // 7 jours

let running = false;

async function runCycle(): Promise<void> {
  if (running) {
    logger.info("[harness-cron] previous cycle still running, skipping");
    return;
  }
  running = true;
  try {
    await enrichHarnessFromLogs(HARNESS_LOOKBACK_HOURS);
  } catch (err: any) {
    logger.error(
      { err: err?.message },
      "[harness-cron] fatal error during cycle",
    );
  } finally {
    running = false;
  }
}

export function startHarnessCron(): void {
  logger.info(
    {
      intervalDays: HARNESS_INTERVAL_MS / (24 * 60 * 60 * 1000),
      firstRunInMinutes: HARNESS_FIRST_RUN_DELAY_MS / 60_000,
    },
    "[harness-cron] scheduled",
  );
  setTimeout(() => {
    void runCycle();
  }, HARNESS_FIRST_RUN_DELAY_MS);
  setInterval(() => {
    void runCycle();
  }, HARNESS_INTERVAL_MS);
}
