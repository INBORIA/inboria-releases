import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth } from "../middlewares/auth";
import { generateWebhookSecret, assertWebhookUrlIsSafe } from "../services/webhooks";

const router: IRouter = Router();

const ALLOWED_EVENTS = [
  "email.received",
  "email.sent",
  "task.created",
  "appointment.created",
  "rule.triggered",
];

router.get("/webhook-endpoints", requireAuth, async (req, res): Promise<void> => {
  try {
    const { data } = await supabaseAdmin
      .from("webhook_endpoints")
      .select("id, url, secret, events, enabled, created_at")
      .eq("user_id", req.userId!)
      .order("created_at", { ascending: false });
    res.json((data || []).map((e: any) => ({
      id: e.id,
      url: e.url,
      // expose only first 12 chars of secret for partial verification
      secretMasked: e.secret ? e.secret.slice(0, 12) + "…" : "",
      events: e.events || [],
      enabled: e.enabled,
      createdAt: e.created_at,
    })));
  } catch {
    res.status(500).json({ error: "Erreur lors de la récupération des webhooks" });
  }
});

router.post("/webhook-endpoints", requireAuth, async (req, res): Promise<void> => {
  try {
    const { url, events } = req.body || {};
    if (!url || typeof url !== "string" || !/^https:\/\//i.test(url)) {
      res.status(400).json({ error: "url HTTPS requise" });
      return;
    }
    try {
      await assertWebhookUrlIsSafe(url);
    } catch (err: any) {
      res.status(400).json({
        error: "url_blocked",
        reason: err?.message || "blocked",
        message:
          "Cette URL n'est pas autorisée (host privé/interne ou non résolu). Utilisez un endpoint HTTPS public.",
      });
      return;
    }
    const filteredEvents = Array.isArray(events) && events.length > 0
      ? events.filter((e: string) => ALLOWED_EVENTS.includes(e))
      : ALLOWED_EVENTS;

    const secret = generateWebhookSecret();
    const { data, error } = await supabaseAdmin
      .from("webhook_endpoints")
      .insert({
        user_id: req.userId!,
        url,
        secret,
        events: filteredEvents,
        enabled: true,
      })
      .select("id, url, events, enabled, created_at")
      .single();

    if (error || !data) {
      res.status(500).json({ error: "Impossible de créer le webhook" });
      return;
    }

    res.status(201).json({
      id: data.id,
      url: data.url,
      secret, // shown only once
      events: data.events || [],
      enabled: data.enabled,
      createdAt: data.created_at,
    });
  } catch {
    res.status(500).json({ error: "Erreur lors de la création du webhook" });
  }
});

router.patch("/webhook-endpoints/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const { url, events, enabled } = req.body || {};
    const updates: Record<string, any> = {};
    if (url !== undefined) {
      if (!/^https:\/\//i.test(url)) {
        res.status(400).json({ error: "url HTTPS requise" });
        return;
      }
      try {
        await assertWebhookUrlIsSafe(url);
      } catch (err: any) {
        res.status(400).json({
          error: "url_blocked",
          reason: err?.message || "blocked",
        });
        return;
      }
      updates.url = url;
    }
    if (events !== undefined) {
      if (!Array.isArray(events)) {
        res.status(400).json({ error: "events doit être un tableau" });
        return;
      }
      updates.events = events.filter((e: string) => ALLOWED_EVENTS.includes(e));
    }
    if (enabled !== undefined) updates.enabled = !!enabled;

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "Aucun champ à mettre à jour" });
      return;
    }

    const { data, error } = await supabaseAdmin
      .from("webhook_endpoints")
      .update(updates)
      .eq("id", req.params.id)
      .eq("user_id", req.userId!)
      .select("id, url, events, enabled, created_at")
      .single();

    if (error || !data) {
      res.status(404).json({ error: "Webhook introuvable" });
      return;
    }
    res.json({
      id: data.id,
      url: data.url,
      events: data.events || [],
      enabled: data.enabled,
      createdAt: data.created_at,
    });
  } catch {
    res.status(500).json({ error: "Erreur lors de la mise à jour" });
  }
});

router.delete("/webhook-endpoints/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const { error } = await supabaseAdmin
      .from("webhook_endpoints")
      .delete()
      .eq("id", req.params.id)
      .eq("user_id", req.userId!);
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Erreur lors de la suppression" });
  }
});

router.get("/webhook-endpoints/:id/deliveries", requireAuth, async (req, res): Promise<void> => {
  try {
    const { data: ep } = await supabaseAdmin
      .from("webhook_endpoints")
      .select("id, user_id")
      .eq("id", req.params.id)
      .single();
    if (!ep || ep.user_id !== req.userId!) {
      res.status(404).json({ error: "Webhook introuvable" });
      return;
    }
    const { data } = await supabaseAdmin
      .from("webhook_deliveries")
      .select("id, event, status, attempts, last_status_code, last_error, next_attempt_at, created_at, updated_at")
      .eq("endpoint_id", ep.id)
      .order("created_at", { ascending: false })
      .limit(50);
    res.json((data || []).map((d: any) => ({
      id: d.id,
      event: d.event,
      status: d.status,
      attempts: d.attempts,
      lastStatusCode: d.last_status_code,
      lastError: d.last_error,
      nextAttemptAt: d.next_attempt_at,
      createdAt: d.created_at,
      updatedAt: d.updated_at,
    })));
  } catch {
    res.status(500).json({ error: "Erreur lors de la récupération des livraisons" });
  }
});

export default router;
