import { logger } from "../lib/logger";
import { supabaseAdmin } from "../lib/supabase";
import { createNotification } from "../lib/activity";

const SWEEP_INTERVAL_MS = 5 * 60 * 1000;
const WINDOW_MIN = 60;
const DEDUP_WINDOW_HOURS = 24;

let timer: NodeJS.Timeout | null = null;

async function sweep(): Promise<number> {
  const now = new Date();
  const upper = new Date(now.getTime() + WINDOW_MIN * 60_000);
  const dedupSince = new Date(now.getTime() - DEDUP_WINDOW_HOURS * 3600_000).toISOString();

  const { data: tasks, error } = await supabaseAdmin
    .from("tasks")
    .select("id, user_id, assigned_to_user_id, title, due_date, email_id, done")
    .gte("due_date", now.toISOString())
    .lte("due_date", upper.toISOString())
    .eq("done", false);

  if (error) {
    logger.warn({ err: error.message }, "[task-due] fetch failed");
    return 0;
  }
  if (!tasks || tasks.length === 0) return 0;

  let sent = 0;
  for (const task of tasks) {
    try {
      const recipient = (task as any).assigned_to_user_id || (task as any).user_id;
      if (!recipient) continue;

      const tag = `[task:${(task as any).id}]`;
      const { data: existing } = await supabaseAdmin
        .from("notifications")
        .select("id")
        .eq("user_id", recipient)
        .eq("type", "task_due")
        .ilike("title", `${tag}%`)
        .gte("created_at", dedupSince)
        .limit(1)
        .maybeSingle();
      if (existing) continue;

      const due = new Date((task as any).due_date);
      const minutesLeft = Math.max(1, Math.round((due.getTime() - now.getTime()) / 60_000));
      const taskTitle = String((task as any).title || "Tâche").slice(0, 60);

      await createNotification({
        userId: recipient,
        type: "task_due",
        title: `${tag} ${taskTitle} (dans ${minutesLeft} min)`,
        message: `Échéance dans ${minutesLeft} min`,
        emailId: (task as any).email_id || undefined,
      });
      sent++;
    } catch (e: any) {
      logger.warn({ err: e?.message, taskId: (task as any).id }, "[task-due] per-task failed");
    }
  }
  return sent;
}

export function startTaskDueWorker(): void {
  if (timer) return;
  const tick = async () => {
    try {
      const sent = await sweep();
      if (sent > 0) logger.info({ sent }, "[task-due] reminders sent");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ err: msg }, "[task-due] sweep crashed");
    }
  };
  setTimeout(tick, 60_000);
  timer = setInterval(tick, SWEEP_INTERVAL_MS);
  logger.info({ intervalMs: SWEEP_INTERVAL_MS, windowMin: WINDOW_MIN }, "[task-due] started");
}
