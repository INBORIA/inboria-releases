import { supabaseAdmin } from "../lib/supabase";
import { logger } from "../lib/logger";
import { syncHubspotContacts, syncHubspotDeals } from "./hubspot";
import { syncPipedriveContacts, syncPipedriveDeals } from "./pipedrive";

const CRM_SYNC_INTERVAL_MS = 15 * 60 * 1000;

let running = false;

async function runCycle(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const { data: rows, error } = await supabaseAdmin
      .from("integrations")
      .select("user_id, provider")
      .in("provider", ["hubspot", "pipedrive"])
      .eq("enabled", true);
    if (error) {
      logger.warn({ service: "crm-sync", err: error.message }, "Failed to load CRM integrations");
      return;
    }
    if (!rows || rows.length === 0) return;

    let hubspotCount = 0;
    let pipedriveCount = 0;
    for (const row of rows) {
      const userId = String(row.user_id);
      try {
        if (row.provider === "hubspot") {
          await syncHubspotContacts(userId, 100);
          await syncHubspotDeals(userId, 100);
          hubspotCount += 1;
        } else if (row.provider === "pipedrive") {
          await syncPipedriveContacts(userId, 100);
          await syncPipedriveDeals(userId, 100);
          pipedriveCount += 1;
        }
      } catch (err: any) {
        logger.warn(
          { service: "crm-sync", provider: row.provider, userId, err: err?.message },
          "CRM sync iteration failed",
        );
      }
    }
    logger.info(
      { service: "crm-sync", hubspot: hubspotCount, pipedrive: pipedriveCount },
      "CRM sync cycle done",
    );
  } catch (err: any) {
    logger.error({ service: "crm-sync", err: err?.message }, "CRM sync fatal");
  } finally {
    running = false;
  }
}

export function startCrmSyncScheduler(): void {
  console.log(`[crm-sync] Started — every ${CRM_SYNC_INTERVAL_MS / 1000}s`);
  setTimeout(() => {
    runCycle();
  }, 30_000);
  setInterval(() => {
    runCycle();
  }, CRM_SYNC_INTERVAL_MS);
}
