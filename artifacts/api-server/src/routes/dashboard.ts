import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth } from "../middlewares/auth";
import { getMemberMailboxIds, buildInboxScopeOrFilter } from "../lib/inbox-scope";

const router: IRouter = Router();

router.get("/dashboard/summary", requireAuth, async (req, res): Promise<void> => {
  try {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", req.userId!)
      .single();

    const memberMailboxIds = await getMemberMailboxIds(req.userId!);
    const scopeOr = buildInboxScopeOrFilter(req.userId!, memberMailboxIds);

    const { data: emails } = await supabaseAdmin
      .from("emails")
      .select("priority, status, category_id")
      .or(scopeOr);

    const allEmails = emails || [];
    // Aligne le filtre statut sur /api/emails et /dashboard/category-counts
    // (qui excluent tous les deux "sent"). Sans cette exclusion, les emails
    // envoyes avec une priorite gonflaient le total Reception et faisaient
    // apparaitre une fausse pastille "X Non classe" (ecart entre summary
    // et category-counts).
    const inboxEmails = allEmails.filter(e => e.status !== "archived" && e.status !== "trashed" && e.status !== "spam" && e.status !== "sent" && e.status !== "scheduled" && e.status !== "scheduled_failed");
    const urgent = inboxEmails.filter(e => e.priority === "urgent").length;
    const moyen = inboxEmails.filter(e => e.priority === "moyen").length;
    const faible = inboxEmails.filter(e => e.priority === "faible").length;
    const notificationCount = 0;

    // Compte server-side des emails non classes (NULL OR junk categories).
    // Source unique de verite alignee sur la branche "uncategorized" de
    // /api/emails. Remplace l'ancienne formule fragile cote frontend
    // (summary.total - sum(categoryCounts) + junk) qui produisait des
    // faux positifs lors d'arrivees d'emails entre les deux requetes
    // ou si certaines categories etaient renommees / dupliquees.
    const JUNK_NAMES = ["non classé", "non classe", "uncategorized", "niet geclassificeerd"];
    const { data: junkCats } = await supabaseAdmin
      .from("categories")
      .select("id, name, is_system")
      .eq("user_id", req.userId!);
    const junkIds = (junkCats || [])
      .filter((c: any) => c.is_system === true || JUNK_NAMES.includes((c.name || "").toLowerCase()))
      .map((c: any) => c.id);
    const uncategorizedCount = inboxEmails.filter(e =>
      e.category_id == null || junkIds.includes(e.category_id)
    ).length;

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
      uncategorizedCount,
      notificationCount,
      pendingTasks: pendingTasks || 0,
      emailsUsed: profile?.emails_used ?? 0,
      emailsQuota: profile?.emails_quota ?? 4500,
      plan: profile?.plan ?? "essai",
    });
  } catch {
    res.status(500).json({ error: "Failed to get dashboard summary" });
  }
});

router.get("/dashboard/inbox-health", requireAuth, async (req, res): Promise<void> => {
  try {
    const memberMailboxIds = await getMemberMailboxIds(req.userId!);
    const scopeOr = buildInboxScopeOrFilter(req.userId!, memberMailboxIds);

    const { data: emails } = await supabaseAdmin
      .from("emails")
      .select("priority, status")
      .or(scopeOr);

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

    const scope = (req.query.scope as string | undefined) || "all";
    const sharedMailboxId = (req.query.sharedMailboxId as string | undefined) || "";
    const accountEmail = (req.query.accountEmail as string | undefined)?.trim() || "";

    let query = supabaseAdmin
      .from("emails")
      .select("category_id")
      .neq("status", "archived")
      .neq("status", "trashed")
      .neq("status", "spam")
      .neq("status", "sent")
      .neq("status", "scheduled")
      .neq("status", "scheduled_failed");

    if (scope === "personal") {
      query = query.eq("user_id", req.userId!).is("shared_mailbox_id", null);
      if (accountEmail) {
        const escaped = accountEmail.replace(/[%_\\,()."']/g, (c) => `\\${c}`);
        query = query.ilike("recipient", `%${escaped}%`);
      }
    } else if (scope === "shared" && sharedMailboxId) {
      const memberMailboxIds = await getMemberMailboxIds(req.userId!);
      if (!memberMailboxIds.includes(sharedMailboxId)) {
        res.status(403).json({ error: "Not a member of this shared mailbox" });
        return;
      }
      query = query.eq("shared_mailbox_id", sharedMailboxId);
    } else {
      const memberMailboxIds = await getMemberMailboxIds(req.userId!);
      const scopeOr = buildInboxScopeOrFilter(req.userId!, memberMailboxIds);
      query = query.or(scopeOr);
    }

    const { data: emails } = await query;

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
