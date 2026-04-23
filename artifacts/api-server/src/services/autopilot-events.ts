import { supabaseAdmin } from "../lib/supabase";
import { logger } from "../lib/logger";

export type AutopilotEventType =
  | "email_sorted"
  | "draft_generated"
  | "task_created"
  | "appointment_extracted"
  | "forward_intro_generated"
  | "sender_blocked"
  | "summary_generated"
  | "follow_up_detected";

export interface AutopilotEventInput {
  userId: string;
  eventType: AutopilotEventType;
  title?: string | null;
  emailId?: number | null;
  metadata?: Record<string, unknown>;
}

export async function recordAutopilotEvent(input: AutopilotEventInput): Promise<void> {
  if (!input.userId) return;
  try {
    const { error } = await supabaseAdmin.from("autopilot_events").insert({
      user_id: input.userId,
      event_type: input.eventType,
      title: input.title ?? null,
      email_id: input.emailId ?? null,
      metadata: input.metadata ?? {},
    });
    if (error) {
      logger.warn(
        { service: "autopilot-events", err: error.message, eventType: input.eventType },
        "Insert failed (non-fatal)",
      );
    }
  } catch (err: any) {
    logger.warn(
      { service: "autopilot-events", err: err?.message, eventType: input.eventType },
      "Insert exception (non-fatal)",
    );
  }
}

export interface AutopilotActivitySnapshot {
  todayCounts: Record<AutopilotEventType, number> & { total: number };
  recent: Array<{
    id: string;
    eventType: AutopilotEventType;
    title: string | null;
    emailId: number | null;
    metadata: Record<string, unknown>;
    createdAt: string;
  }>;
  isActive: boolean;
  lastEventAt: string | null;
}

const ACTIVE_THRESHOLD_MS = 12 * 1000;

export async function getActivitySnapshot(userId: string): Promise<AutopilotActivitySnapshot> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [todayRes, recentRes] = await Promise.all([
    supabaseAdmin
      .from("autopilot_events")
      .select("event_type")
      .eq("user_id", userId)
      .gte("created_at", startOfDay.toISOString()),
    supabaseAdmin
      .from("autopilot_events")
      .select("id, event_type, title, email_id, metadata, created_at")
      .eq("user_id", userId)
      .gte("created_at", since24h.toISOString())
      .order("created_at", { ascending: false })
      .limit(80),
  ]);

  const todayCounts = {
    email_sorted: 0,
    draft_generated: 0,
    task_created: 0,
    appointment_extracted: 0,
    forward_intro_generated: 0,
    sender_blocked: 0,
    summary_generated: 0,
    follow_up_detected: 0,
    total: 0,
  } as AutopilotActivitySnapshot["todayCounts"];

  for (const row of todayRes.data ?? []) {
    const t = row.event_type as AutopilotEventType;
    if (t in todayCounts) {
      (todayCounts[t] as number) += 1;
      todayCounts.total += 1;
    }
  }

  const recent = (recentRes.data ?? []).map((r) => ({
    id: r.id as string,
    eventType: r.event_type as AutopilotEventType,
    title: (r.title as string | null) ?? null,
    emailId: (r.email_id as number | null) ?? null,
    metadata: (r.metadata as Record<string, unknown>) ?? {},
    createdAt: r.created_at as string,
  }));

  const lastEventAt = recent[0]?.createdAt ?? null;
  const isActive = lastEventAt
    ? Date.now() - new Date(lastEventAt).getTime() < ACTIVE_THRESHOLD_MS
    : false;

  return { todayCounts, recent, isActive, lastEventAt };
}
