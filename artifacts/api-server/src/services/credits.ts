import { supabaseAdmin } from "../lib/supabase";
import { logger } from "../lib/logger";

export const AI_COST = {
  triage: 1,
  draft: 2,
  daily_summary: 3,
  conversation_summary: 2,
  detect_followups: 2,
  generate_relance: 2,
  extract_appointment: 1,
  detect_appointments: 3,
  recategorize_uncategorized: 3,
  support_chat: 1,
  generate_pack: 3,
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

export async function consumeAiCredits(
  userId: string,
  eventType: AiEventType,
  metadata: Record<string, unknown> = {},
): Promise<number> {
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
      logger.warn(
        { err: insertErr.message, eventType },
        "[credits] usage_events insert failed (continuing)",
      );
    }
  } catch (e: any) {
    logger.warn({ err: e?.message }, "[credits] usage_events insert threw");
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
      await supabaseAdmin
        .from("profiles")
        .update({ ai_credits_used: next })
        .eq("id", userId);
    }
  } catch (e: any) {
    logger.error({ err: e?.message, eventType }, "[credits] increment failed");
  }

  return cost;
}
