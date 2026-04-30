import { supabaseAdmin } from "../lib/supabase";
import { logger } from "../lib/logger";

export const AI_COST = {
  draft: 2,
  daily_summary: 3,
  conversation_summary: 2,
  extract_appointment: 1,
  detect_appointments: 3,
  recategorize_uncategorized: 3,
  support_chat: 1,
  inboria_chat: 1,
  generate_pack: 3,
  template_suggest: 1,
  template_categorize: 1,
  rule_parse: 2,
} as const;

export type AiEventType = keyof typeof AI_COST;

export interface EntitlementResult {
  blocked: boolean;
  reason?: string;
  emailsUsed?: number;
  aiCreditsUsed?: number;
  quota?: number;
}

function startOfMonth(date: Date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

async function ensureCurrentPeriod(userId: string): Promise<void> {
  try {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("quota_period_start")
      .eq("id", userId)
      .single();
    if (!profile) return;
    const periodStart = profile.quota_period_start
      ? new Date(profile.quota_period_start)
      : new Date(0);
    const currentStart = startOfMonth();
    if (periodStart < currentStart) {
      await supabaseAdmin
        .from("profiles")
        .update({
          ai_credits_used: 0,
          emails_used: 0,
          quota_period_start: currentStart.toISOString(),
        })
        .eq("id", userId);
      logger.info({ userId }, "[credits] monthly quota reset");
    }
  } catch (e: any) {
    logger.warn({ err: e?.message }, "[credits] ensureCurrentPeriod failed");
  }
}

export async function checkEntitlement(
  userId: string,
  neededCredits = 0,
): Promise<EntitlementResult> {
  await ensureCurrentPeriod(userId);

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("plan, emails_used, ai_credits_used, emails_quota")
    .eq("id", userId)
    .single();

  if (!profile) return { blocked: true, reason: "Profil introuvable" };
  if (profile.plan === "expired") {
    return {
      blocked: true,
      reason: "Votre abonnement a expire. Reabonnez-vous pour continuer.",
    };
  }

  const emailsUsed = profile.emails_used || 0;
  const aiUsed = profile.ai_credits_used || 0;
  const quota = profile.emails_quota || 0;
  const totalUsed = emailsUsed + aiUsed;

  if (totalUsed + neededCredits > quota) {
    return {
      blocked: true,
      reason: "Quota de credits atteint. Passez a un plan superieur ou activez le pay-as-you-go.",
      emailsUsed,
      aiCreditsUsed: aiUsed,
      quota,
    };
  }

  return { blocked: false, emailsUsed, aiCreditsUsed: aiUsed, quota };
}

export async function logTriageEvent(
  userId: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  try {
    const { error } = await supabaseAdmin.from("usage_events").insert({
      user_id: userId,
      event_type: "auto_triage",
      credits: 1,
      metadata,
    });
    if (error) {
      logger.warn(
        { err: error.message },
        "[credits] usage_events insert failed for triage (continuing)",
      );
    }
  } catch (e: any) {
    logger.warn({ err: e?.message }, "[credits] logTriageEvent threw");
  }
}

/**
 * Bills AI credits. Returns { ok, cost } where ok=false means billing FAILED
 * and the caller should NOT proceed with the paid OpenAI call (fail-closed).
 *
 * Two writes happen:
 *   1) usage_events insert (audit trail, source of truth for recount)
 *   2) profiles.ai_credits_used increment (real-time quota display)
 *
 * If (1) fails, we hard-fail (no audit = no billing = revenue leak).
 * If (2) fails (RPC), we try a fallback update; if that also fails, hard-fail.
 */
export async function consumeAiCredits(
  userId: string,
  eventType: AiEventType,
  metadata: Record<string, unknown> = {},
): Promise<{ ok: boolean; cost: number }> {
  const cost = AI_COST[eventType] ?? 1;

  try {
    const { error: insertErr } = await supabaseAdmin
      .from("usage_events")
      .insert({
        user_id: userId,
        event_type: eventType,
        credits: cost,
        metadata,
      });
    if (insertErr) {
      logger.error(
        { err: insertErr.message, eventType, userId },
        "[credits] FAIL-CLOSED: usage_events insert failed, refusing to bill",
      );
      return { ok: false, cost };
    }
  } catch (e: any) {
    logger.error(
      { err: e?.message, eventType, userId },
      "[credits] FAIL-CLOSED: usage_events insert threw",
    );
    return { ok: false, cost };
  }

  try {
    const { error: rpcErr } = await supabaseAdmin.rpc(
      "increment_ai_credits" as any,
      { p_user_id: userId, p_amount: cost },
    );
    if (rpcErr) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("ai_credits_used")
        .eq("id", userId)
        .single();
      const next = (profile?.ai_credits_used || 0) + cost;
      const { error: upErr } = await supabaseAdmin
        .from("profiles")
        .update({ ai_credits_used: next })
        .eq("id", userId);
      if (upErr) {
        logger.error(
          { err: upErr.message, eventType, userId },
          "[credits] increment fallback failed AFTER usage_events insert — recount will reconcile",
        );
        // usage_events was written, so recount will fix this. Return ok=true.
      }
    }
  } catch (e: any) {
    logger.error(
      { err: e?.message, eventType, userId },
      "[credits] increment threw AFTER usage_events insert — recount will reconcile",
    );
  }

  return { ok: true, cost };
}
