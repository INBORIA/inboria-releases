import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { UpdateProfileBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { hasTrackingProfileColumn } from "../lib/schema-flags";

const router: IRouter = Router();

router.get("/profile", requireAuth, async (req, res): Promise<void> => {
  try {
    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", req.userId!)
      .single();

    if (error || !profile) {
      console.error("Profile GET error:", { userId: req.userId, error: error?.message, code: error?.code, details: error?.details });
      res.status(404).json({ error: "Profile not found" });
      return;
    }

    const token = req.headers.authorization!.slice(7);
    const { data: userData } = await supabaseAdmin.auth.getUser(token);

    let organisationId = profile.organisation_id || null;
    let organisationName = null;
    let organisationRole = null;

    if (organisationId) {
      const { data: membership } = await supabaseAdmin
        .from("organisation_members")
        .select("role")
        .eq("user_id", req.userId!)
        .eq("organisation_id", organisationId)
        .eq("status", "active")
        .single();

      if (membership) {
        organisationRole = membership.role;
        const { data: org } = await supabaseAdmin
          .from("organisations")
          .select("name")
          .eq("id", organisationId)
          .single();
        organisationName = org?.name || null;
      } else {
        organisationId = null;
      }
    }

    res.json({
      id: profile.id,
      email: userData.user?.email || "",
      fullName: profile.full_name || "",
      plan: profile.plan ?? "essai",
      seats: profile.seats ?? 1,
      emailsUsed: profile.emails_used ?? 0,
      aiCreditsUsed: profile.ai_credits_used ?? 0,
      emailsQuota: profile.emails_quota ?? 100,
      quotaPeriodStart: profile.quota_period_start || null,
      aiLanguage: profile.ai_language || "fr",
      signature: "",
      timezone: profile.timezone || "Europe/Brussels",
      followUpDelayDays: profile.follow_up_delay_days ?? 5,
      trackingEnabled: !!profile.tracking_enabled,
      meetingRemindersEnabled: profile.meeting_reminders_enabled !== false,
      createdAt: profile.created_at,
      organisationId,
      organisationName,
      organisationRole,
      isAdmin: !!profile.is_admin,
    });
  } catch {
    res.status(500).json({ error: "Failed to get profile" });
  }
});

router.patch("/profile", requireAuth, async (req, res): Promise<void> => {
  try {
    const parsed = UpdateProfileBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const updates: Record<string, unknown> = {};
    if (parsed.data.fullName !== undefined) updates.full_name = parsed.data.fullName;
    if (parsed.data.aiLanguage !== undefined) updates.ai_language = parsed.data.aiLanguage;
    if ((parsed.data as any).timezone !== undefined) updates.timezone = (parsed.data as any).timezone;
    if (parsed.data.plan !== undefined) {
      if (parsed.data.plan === "essai") {
        res.status(403).json({ error: "Impossible de revenir au plan Essai" });
        return;
      }
      updates.plan = parsed.data.plan;
      const quotaMap: Record<string, number> = {
        essai: 100,
        solo: 3000,
        pro: 10000,
        business: 10000,
      };
      updates.emails_quota = quotaMap[parsed.data.plan] ?? 100;
    }
    if (parsed.data.seats !== undefined) updates.seats = parsed.data.seats;
    if ((parsed.data as any).followUpDelayDays !== undefined) {
      const v = Number((parsed.data as any).followUpDelayDays);
      if (Number.isFinite(v) && v >= 1 && v <= 60) {
        updates.follow_up_delay_days = Math.round(v);
      }
    }
    if ((parsed.data as any).trackingEnabled !== undefined) {
      if (await hasTrackingProfileColumn()) {
        updates.tracking_enabled = !!(parsed.data as any).trackingEnabled;
      }
    }
    if ((parsed.data as any).meetingRemindersEnabled !== undefined) {
      updates.meeting_reminders_enabled = !!(parsed.data as any).meetingRemindersEnabled;
    }

    const query = Object.keys(updates).length === 0
      ? supabaseAdmin.from("profiles").select().eq("id", req.userId!).single()
      : supabaseAdmin.from("profiles").update(updates).eq("id", req.userId!).select().single();
    const { data: profile, error } = await query;

    if (error || !profile) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }

    const token = req.headers.authorization!.slice(7);
    const { data: userData } = await supabaseAdmin.auth.getUser(token);

    res.json({
      id: profile.id,
      email: userData.user?.email || "",
      fullName: profile.full_name || "",
      plan: profile.plan ?? "essai",
      seats: profile.seats ?? 1,
      emailsUsed: profile.emails_used ?? 0,
      aiCreditsUsed: profile.ai_credits_used ?? 0,
      emailsQuota: profile.emails_quota ?? 100,
      quotaPeriodStart: profile.quota_period_start || null,
      aiLanguage: profile.ai_language || "fr",
      signature: "",
      timezone: profile.timezone || "Europe/Brussels",
      followUpDelayDays: profile.follow_up_delay_days ?? 5,
      trackingEnabled: !!profile.tracking_enabled,
      meetingRemindersEnabled: profile.meeting_reminders_enabled !== false,
      createdAt: profile.created_at,
    });
  } catch {
    res.status(500).json({ error: "Failed to update profile" });
  }
});

router.post("/profile/push-token", requireAuth, async (req, res): Promise<void> => {
  try {
    const { token: pushToken, platform } = req.body as { token?: string; platform?: string };
    if (!pushToken || typeof pushToken !== "string") {
      res.status(400).json({ error: "Missing push token" });
      return;
    }

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        push_token: pushToken,
        push_platform: platform || "unknown",
      })
      .eq("id", req.userId!);

    if (error) {
      if (error.code === "PGRST204" || error.message?.includes("column")) {
        console.warn("[push-token] push_token/push_platform columns not yet added to profiles table — skipping save");
        res.json({ success: true });
        return;
      }
      res.status(500).json({ error: "Failed to save push token" });
      return;
    }

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to register push token" });
  }
});

router.post("/profile/recount-quota", requireAuth, async (req, res): Promise<void> => {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const { count: emailsCount, error: countErr } = await supabaseAdmin
      .from("emails")
      .select("id", { count: "exact", head: true })
      .eq("user_id", req.userId!)
      .gte("created_at", monthStart);
    if (countErr) { res.status(500).json({ error: countErr.message }); return; }
    const emailsUsed = emailsCount || 0;

    const { data: events, error: evErr } = await supabaseAdmin
      .from("usage_events")
      .select("credits, event_type")
      .eq("user_id", req.userId!)
      .gte("occurred_at", monthStart);
    if (evErr) { res.status(500).json({ error: evErr.message }); return; }

    // auto_triage events are emails ingested automatically — they're already
    // counted in `emails_used` via the emails table, so exclude them here
    // to avoid double-counting. All other AI event types are legitimately
    // counted in ai_credits_used.
    const aiCreditsUsed = (events || [])
      .filter((e: any) => e.event_type !== "auto_triage")
      .reduce((sum: number, e: any) => sum + (e.credits || 0), 0);

    const { error: upErr } = await supabaseAdmin
      .from("profiles")
      .update({
        emails_used: emailsUsed,
        ai_credits_used: aiCreditsUsed,
        quota_period_start: monthStart,
      })
      .eq("id", req.userId!);
    if (upErr) { res.status(500).json({ error: upErr.message }); return; }

    res.json({
      ok: true,
      emails_used: emailsUsed,
      ai_credits_used: aiCreditsUsed,
      total: emailsUsed + aiCreditsUsed,
      period_start: monthStart,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/profile/restore-spam", requireAuth, async (req, res): Promise<void> => {
  try {
    const { data, error } = await supabaseAdmin
      .from("emails")
      .update({ status: "inbox" })
      .eq("user_id", req.userId!)
      .eq("status", "spam")
      .select("id");
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json({ ok: true, restored: (data || []).length });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
