import { logger } from "../lib/logger";
import { supabaseAdmin } from "../lib/supabase";
import { createNotification } from "../lib/activity";

const SWEEP_INTERVAL_MS = 5 * 60 * 1000;
const WINDOW_MIN = 15;
const DEDUP_WINDOW_HOURS = 6;

let timer: NodeJS.Timeout | null = null;

async function sweep(): Promise<number> {
  const now = new Date();
  const upper = new Date(now.getTime() + WINDOW_MIN * 60_000);
  const dedupSince = new Date(now.getTime() - DEDUP_WINDOW_HOURS * 3600_000).toISOString();

  const { data: apts, error } = await supabaseAdmin
    .from("appointments")
    .select("id, user_id, title, start_at, location, status")
    .gte("start_at", now.toISOString())
    .lte("start_at", upper.toISOString())
    .neq("status", "cancelled");

  if (error) {
    logger.warn({ err: error.message }, "[appointment-reminder] fetch failed");
    return 0;
  }
  if (!apts || apts.length === 0) return 0;

  let sent = 0;
  for (const apt of apts) {
    try {
      const tag = `[apt:${(apt as any).id}]`;
      const { data: existing } = await supabaseAdmin
        .from("notifications")
        .select("id")
        .eq("user_id", (apt as any).user_id)
        .eq("type", "appointment_imminent")
        .ilike("title", `${tag}%`)
        .gte("created_at", dedupSince)
        .limit(1)
        .maybeSingle();
      if (existing) continue;

      const startAt = new Date((apt as any).start_at);
      const minutesLeft = Math.max(1, Math.round((startAt.getTime() - now.getTime()) / 60_000));
      const hh = String(startAt.getHours()).padStart(2, "0");
      const mm = String(startAt.getMinutes()).padStart(2, "0");
      const aptTitle = ((apt as any).title || "Rendez-vous").slice(0, 60);
      const loc = (apt as any).location ? ` — ${String((apt as any).location).slice(0, 80)}` : "";

      await createNotification({
        userId: (apt as any).user_id,
        type: "appointment_imminent",
        title: `${tag} ${aptTitle} à ${hh}:${mm} (dans ${minutesLeft} min)`,
        message: `Démarre à ${hh}:${mm}${loc}`,
      });
      sent++;
    } catch (e: any) {
      logger.warn({ err: e?.message, aptId: (apt as any).id }, "[appointment-reminder] per-apt failed");
    }
  }
  return sent;
}

export function startAppointmentReminderWorker(): void {
  if (timer) return;
  const tick = async () => {
    try {
      const sent = await sweep();
      if (sent > 0) logger.info({ sent }, "[appointment-reminder] reminders sent");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ err: msg }, "[appointment-reminder] sweep crashed");
    }
  };
  setTimeout(tick, 45_000);
  timer = setInterval(tick, SWEEP_INTERVAL_MS);
  logger.info({ intervalMs: SWEEP_INTERVAL_MS, windowMin: WINDOW_MIN }, "[appointment-reminder] started");
}
