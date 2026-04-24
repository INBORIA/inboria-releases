import { Router, type IRouter } from "express";
import { randomBytes } from "crypto";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

const ALLOWED_EVENTS = [
  "email.received",
  "email.sent",
  "task.created",
  "task.completed",
  "appointment.created",
  "rule.triggered",
  "message.received",
] as const;

function toCamel(row: any) {
  return {
    id: row.id,
    eventType: row.event_type,
    targetUrl: row.target_url,
    secret: row.secret,
    description: row.description,
    enabled: row.enabled,
    failureCount: row.failure_count,
    lastTriggeredAt: row.last_triggered_at,
    lastError: row.last_error,
    createdAt: row.created_at,
  };
}

router.get("/webhook-subscriptions", requireAuth, async (req, res): Promise<void> => {
  const { data } = await supabaseAdmin
    .from("webhook_subscriptions")
    .select("*")
    .eq("user_id", req.userId!)
    .order("created_at", { ascending: false });
  res.json((data || []).map(toCamel));
});

router.post("/webhook-subscriptions", requireAuth, async (req, res): Promise<void> => {
  try {
    const { eventType, targetUrl, description } = req.body || {};
    if (!ALLOWED_EVENTS.includes(eventType)) {
      res.status(400).json({ error: "invalid eventType" });
      return;
    }
    if (!targetUrl || typeof targetUrl !== "string") {
      res.status(400).json({ error: "targetUrl required" });
      return;
    }
    try {
      const u = new URL(targetUrl);
      if (u.protocol !== "https:" && u.protocol !== "http:") {
        res.status(400).json({ error: "targetUrl must be http(s)" });
        return;
      }
    } catch {
      res.status(400).json({ error: "invalid targetUrl" });
      return;
    }

    const secret = `whsec_${randomBytes(24).toString("base64url")}`;
    const { data, error } = await supabaseAdmin
      .from("webhook_subscriptions")
      .insert({
        user_id: req.userId!,
        event_type: eventType,
        target_url: targetUrl,
        secret,
        description: description ? String(description).slice(0, 200) : null,
        enabled: true,
      })
      .select("*")
      .single();
    if (error || !data) {
      res.status(500).json({ error: "Failed to create webhook subscription" });
      return;
    }
    res.status(201).json(toCamel(data));
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.patch("/webhook-subscriptions/:id", requireAuth, async (req, res): Promise<void> => {
  const { enabled, description } = req.body || {};
  const updates: Record<string, any> = {};
  if (typeof enabled === "boolean") updates.enabled = enabled;
  if (description !== undefined) updates.description = description ? String(description).slice(0, 200) : null;
  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "no updatable fields" });
    return;
  }
  const { data, error } = await supabaseAdmin
    .from("webhook_subscriptions")
    .update(updates)
    .eq("user_id", req.userId!)
    .eq("id", req.params.id)
    .select("*")
    .single();
  if (error || !data) {
    res.status(404).json({ error: "subscription not found" });
    return;
  }
  res.json(toCamel(data));
});

router.delete("/webhook-subscriptions/:id", requireAuth, async (req, res): Promise<void> => {
  const { error } = await supabaseAdmin
    .from("webhook_subscriptions")
    .delete()
    .eq("user_id", req.userId!)
    .eq("id", req.params.id);
  if (error) {
    res.status(500).json({ error: "Failed to delete subscription" });
    return;
  }
  res.json({ success: true });
});

router.get("/webhook-subscriptions/events", requireAuth, async (_req, res): Promise<void> => {
  res.json({ events: ALLOWED_EVENTS });
});

export default router;
