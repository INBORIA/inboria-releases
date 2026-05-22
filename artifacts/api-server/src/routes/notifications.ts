import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/notifications", requireAuth, async (req, res): Promise<void> => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 30, 1), 100);

    const { data: notifications } = await supabaseAdmin
      .from("notifications")
      .select("id, type, title, message, email_id, triggered_by, read, created_at")
      .eq("user_id", req.userId!)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (!notifications || notifications.length === 0) {
      res.json([]);
      return;
    }

    const triggerIds = [...new Set(notifications.filter(n => n.triggered_by).map(n => n.triggered_by!))];
    const profileMap = new Map<string, string>();

    for (const uid of triggerIds) {
      const { data: p } = await supabaseAdmin
        .from("profiles")
        .select("full_name")
        .eq("id", uid)
        .single();
      if (p) profileMap.set(uid, p.full_name || "");
    }

    res.json(notifications.map(n => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      emailId: n.email_id,
      triggeredBy: n.triggered_by,
      triggeredByName: n.triggered_by ? profileMap.get(n.triggered_by) || "" : null,
      read: n.read,
      createdAt: n.created_at,
    })));
  } catch {
    res.status(500).json({ error: "Erreur lors de la récupération des notifications" });
  }
});

router.get("/notifications/unread-count", requireAuth, async (req, res): Promise<void> => {
  try {
    const { count } = await supabaseAdmin
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", req.userId!)
      .eq("read", false);

    res.json({ count: count || 0 });
  } catch {
    res.status(500).json({ error: "Erreur" });
  }
});

router.patch("/notifications/:id/read", requireAuth, async (req, res): Promise<void> => {
  try {
    const { error } = await supabaseAdmin
      .from("notifications")
      .update({ read: true })
      .eq("id", req.params.id)
      .eq("user_id", req.userId!);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Erreur" });
  }
});

router.post("/notifications/mark-all-read", requireAuth, async (req, res): Promise<void> => {
  try {
    await supabaseAdmin
      .from("notifications")
      .update({ read: true })
      .eq("user_id", req.userId!)
      .eq("read", false);

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Erreur" });
  }
});

export default router;
