import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { UpdateProfileBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/profile", requireAuth, async (req, res): Promise<void> => {
  try {
    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", req.userId!)
      .single();

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
      plan: profile.plan || "essai",
      seats: profile.seats || 1,
      emailsUsed: profile.emails_used || 0,
      emailsQuota: profile.emails_quota || 100,
      aiLanguage: profile.ai_language || "fr",
      signature: profile.signature || "",
      createdAt: profile.created_at,
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
    if (parsed.data.signature !== undefined) updates.signature = parsed.data.signature;
    if (parsed.data.plan !== undefined) {
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

    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .update(updates)
      .eq("id", req.userId!)
      .select()
      .single();

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
      plan: profile.plan || "essai",
      seats: profile.seats || 1,
      emailsUsed: profile.emails_used || 0,
      emailsQuota: profile.emails_quota || 100,
      aiLanguage: profile.ai_language || "fr",
      signature: profile.signature || "",
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

export default router;
