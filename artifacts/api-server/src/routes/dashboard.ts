import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/dashboard/summary", requireAuth, async (req, res): Promise<void> => {
  try {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", req.userId!)
      .single();

    const { data: emails } = await supabaseAdmin
      .from("emails")
      .select("priority, status")
      .eq("user_id", req.userId!)
      .is("shared_mailbox_id", null);

    const allEmails = emails || [];
    const inboxEmails = allEmails.filter(e => e.status !== "archived" && e.status !== "trashed" && e.status !== "spam");
    const urgent = inboxEmails.filter(e => e.priority === "urgent").length;
    const moyen = inboxEmails.filter(e => e.priority === "moyen").length;
    const faible = inboxEmails.filter(e => e.priority === "faible").length;
    const notificationCount = 0;

    const { count: pendingTasks } = await supabaseAdmin
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("user_id", req.userId!)
      .eq("done", false);

    res.json({
      totalEmails: allEmails.length,
      urgentCount: urgent,
      moyenCount: moyen,
      faibleCount: faible,
      notificationCount,
      pendingTasks: pendingTasks || 0,
      emailsUsed: profile?.emails_used ?? 0,
      emailsQuota: profile?.emails_quota ?? 100,
      plan: profile?.plan ?? "essai",
    });
  } catch {
    res.status(500).json({ error: "Failed to get dashboard summary" });
  }
});

router.get("/dashboard/inbox-health", requireAuth, async (req, res): Promise<void> => {
  try {
    const { data: emails } = await supabaseAdmin
      .from("emails")
      .select("priority, status")
      .eq("user_id", req.userId!)
      .is("shared_mailbox_id", null);

    const allEmails = emails || [];
    const total = allEmails.length;
    const urgent = allEmails.filter(e => e.priority === "urgent").length;
    const unread = allEmails.filter(e => e.status === "classe").length;

    let score = 100;
    if (total > 0) {
      const urgentRatio = urgent / total;
      const unreadRatio = unread / total;
      score = Math.max(0, Math.round(100 - urgentRatio * 40 - unreadRatio * 30));
    }

    let label = "Excellent";
    if (score < 40) label = "Critique";
    else if (score < 60) label = "A ameliorer";
    else if (score < 80) label = "Correct";

    res.json({
      score,
      label,
      urgentUnread: urgent,
      oldestUnanswered: null,
    });
  } catch {
    res.status(500).json({ error: "Failed to get inbox health" });
  }
});

router.get("/dashboard/category-counts", requireAuth, async (req, res): Promise<void> => {
  try {
    const { data: categories } = await supabaseAdmin
      .from("categories")
      .select("id, name")
      .eq("user_id", req.userId!);

    const { data: emails } = await supabaseAdmin
      .from("emails")
      .select("category_id")
      .eq("user_id", req.userId!)
      .is("shared_mailbox_id", null)
      .neq("status", "archived")
      .neq("status", "trashed")
      .neq("status", "spam");

    const countMap: Record<number, number> = {};
    (emails || []).forEach((e: any) => {
      if (e.category_id) {
        countMap[e.category_id] = (countMap[e.category_id] || 0) + 1;
      }
    });

    res.json((categories || []).map((c: any) => ({
      categoryId: c.id,
      categoryName: c.name,
      count: countMap[c.id] || 0,
    })));
  } catch {
    res.status(500).json({ error: "Failed to get category counts" });
  }
});

export default router;
