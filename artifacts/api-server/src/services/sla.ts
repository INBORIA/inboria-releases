import { supabaseAdmin } from "../lib/supabase";
import { logger } from "../lib/logger";
import { createNotification } from "../lib/activity";

const TICK_INTERVAL_MS = 5 * 60_000;
let started = false;

interface BusinessHours {
  timezone: string;
  days: number[]; // 0=Sun..6=Sat
  start: string; // "HH:MM"
  end: string;   // "HH:MM"
}

interface Escalation {
  email?: boolean; // in-app notification fallback
}

function parseHHMM(s: string): { h: number; m: number } {
  const [h, m] = (s || "09:00").split(":").map((x) => parseInt(x, 10));
  return { h: isNaN(h) ? 9 : h, m: isNaN(m) ? 0 : m };
}

function tzPartsForDate(date: Date, timezone: string): { y: number; mo: number; d: number; h: number; mi: number; weekday: number } {
  // Use Intl to extract parts in the given timezone
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
  });
  const parts = fmt.formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    y: parseInt(map.year, 10),
    mo: parseInt(map.month, 10),
    d: parseInt(map.day, 10),
    h: parseInt(map.hour, 10),
    mi: parseInt(map.minute, 10),
    weekday: weekdayMap[map.weekday] ?? 0,
  };
}

/**
 * Compute elapsed minutes between `start` and `end`, counting only minutes
 * inside business hours / business days in the given timezone.
 * Approximation in 15-minute chunks (sufficient for SLA tracking).
 */
export function businessMinutesBetween(start: Date, end: Date, bh: BusinessHours): number {
  if (end.getTime() <= start.getTime()) return 0;
  const startHM = parseHHMM(bh.start);
  const endHM = parseHHMM(bh.end);
  const startMinOfDay = startHM.h * 60 + startHM.m;
  const endMinOfDay = endHM.h * 60 + endHM.m;
  if (endMinOfDay <= startMinOfDay) return 0;

  const allowedDays = new Set(Array.isArray(bh.days) && bh.days.length ? bh.days : [1, 2, 3, 4, 5]);

  const stepMs = 15 * 60_000;
  let cursor = start.getTime();
  const stop = end.getTime();
  let minutes = 0;
  // Cap iterations at ~2 weeks of 15-min steps to bound cost
  let safety = 0;
  const SAFETY_MAX = (14 * 24 * 60) / 15;
  while (cursor < stop && safety < SAFETY_MAX) {
    const probe = new Date(cursor);
    const tp = tzPartsForDate(probe, bh.timezone);
    const minOfDay = tp.h * 60 + tp.mi;
    if (allowedDays.has(tp.weekday) && minOfDay >= startMinOfDay && minOfDay < endMinOfDay) {
      const delta = Math.min(stepMs, stop - cursor) / 60_000;
      minutes += delta;
    }
    cursor += stepMs;
    safety++;
  }
  return Math.round(minutes);
}

async function evaluatePolicy(policy: any) {
  const bh: BusinessHours = policy.business_hours || { timezone: "Europe/Brussels", days: [1, 2, 3, 4, 5], start: "09:00", end: "18:00" };
  const escalation: Escalation = policy.escalation || { email: true };
  const targetMin: number = policy.target_minutes;

  // Find emails in this mailbox not yet replied (no related sent reply tracked)
  // We approximate "first response" via the email status: if status is 'archived' or has assigned_to and any reply event exists, we consider responded.
  // To stay simple, treat an email as breaching when:
  //   - it belongs to this shared_mailbox_id
  //   - status NOT IN ('archived', 'supprime')
  //   - claimed_by IS NULL OR no reply has been logged in the last X minutes
  // We approximate by comparing now - created_at in business minutes.
  const now = new Date();
  const sinceIso = new Date(now.getTime() - 14 * 24 * 60 * 60_000).toISOString();

  const { data: emails } = await supabaseAdmin
    .from("emails")
    .select("id, sender, subject, created_at, status, assigned_to, claimed_by")
    .eq("shared_mailbox_id", policy.shared_mailbox_id)
    .gte("created_at", sinceIso)
    .not("status", "in", "(archived,supprime)")
    .order("created_at", { ascending: false })
    .limit(500);

  const breachedEmails: { id: number; sender: string; subject: string; assignedTo: string | null; elapsed: number }[] = [];

  for (const e of emails || []) {
    const created = new Date(e.created_at);
    const elapsed = businessMinutesBetween(created, now, bh);
    if (elapsed >= targetMin) {
      breachedEmails.push({
        id: e.id,
        sender: e.sender || "",
        subject: e.subject || "",
        assignedTo: e.assigned_to || e.claimed_by || null,
        elapsed,
      });
    }
  }

  if (breachedEmails.length > 0) {
    const ids = breachedEmails.map((b) => b.id);
    const { data: existing } = await supabaseAdmin
      .from("sla_breaches")
      .select("email_id, notified_at")
      .in("email_id", ids);

    const existingMap = new Map<number, any>((existing || []).map((r: any) => [r.email_id, r]));

    const newRows = breachedEmails
      .filter((b) => !existingMap.has(b.id))
      .map((b) => ({
        policy_id: policy.id,
        shared_mailbox_id: policy.shared_mailbox_id,
        email_id: b.id,
        assigned_to: b.assignedTo,
        target_minutes: targetMin,
        elapsed_minutes: b.elapsed,
        detected_at: now.toISOString(),
      }));

    if (newRows.length > 0) {
      await supabaseAdmin.from("sla_breaches").insert(newRows);
    }

    // Notify for newly inserted breaches
    for (const b of breachedEmails) {
      if (existingMap.get(b.id)?.notified_at) continue;

      const target = b.assignedTo;
      if (!target) continue;

      if (escalation.email !== false) {
        try {
          await createNotification({
            userId: target,
            type: "sla_breach",
            title: "SLA dépassé",
            message: `Email de ${b.sender} sans réponse depuis ${b.elapsed} min ouvrées (objectif ${targetMin} min)`,
            emailId: b.id,
          });
        } catch {}
      }
    }

    // Mark notified
    if (newRows.length > 0) {
      await supabaseAdmin
        .from("sla_breaches")
        .update({ notified_at: now.toISOString() })
        .in("email_id", newRows.map((r) => r.email_id))
        .is("notified_at", null);
    }
  }

  // -----------------------------------------------------------------
  // Auto-resolve breaches whose underlying email has been handled.
  //
  // IMPORTANT: this MUST run on every tick regardless of whether new
  // breaches were detected — once an email is archived it leaves the
  // breach-candidate set above, so we have to scan *all* currently-open
  // breach rows for this mailbox to find ones whose email is now handled.
  // -----------------------------------------------------------------
  const { data: openBreaches } = await supabaseAdmin
    .from("sla_breaches")
    .select("email_id")
    .eq("shared_mailbox_id", policy.shared_mailbox_id)
    .is("resolved_at", null)
    .limit(2000);

  const openIds = Array.from(new Set((openBreaches || []).map((r: any) => r.email_id))).filter(
    (id) => id != null,
  );

  if (openIds.length > 0) {
    // An email is considered "handled" when it is archived or deleted.
    // We treat statuses 'archived' and 'supprime' as resolved.
    const { data: handled } = await supabaseAdmin
      .from("emails")
      .select("id, status")
      .in("id", openIds)
      .in("status", ["archived", "supprime"]);

    const handledIds = (handled || []).map((r: any) => r.id);
    if (handledIds.length > 0) {
      await supabaseAdmin
        .from("sla_breaches")
        .update({ resolved_at: now.toISOString() })
        .in("email_id", handledIds)
        .is("resolved_at", null);
      logger.info(
        { mailboxId: policy.shared_mailbox_id, resolved: handledIds.length },
        "[sla] resolved breaches",
      );
    }
  }
}

async function tick() {
  try {
    const { data: policies } = await supabaseAdmin
      .from("sla_policies")
      .select("id, shared_mailbox_id, target_minutes, business_hours, escalation, enabled")
      .eq("enabled", true);
    if (!policies || policies.length === 0) return;
    for (const p of policies) {
      try {
        await evaluatePolicy(p);
      } catch (e: any) {
        logger.warn({ error: e?.message, policyId: p.id }, "[sla] policy evaluation failed");
      }
    }
  } catch (e: any) {
    logger.warn({ error: e?.message }, "[sla] tick failed");
  }
}

export function startSlaWorker() {
  if (started) return;
  started = true;
  setTimeout(tick, 10_000).unref?.();
  setInterval(tick, TICK_INTERVAL_MS).unref?.();
  logger.info("[sla] worker started");
}
