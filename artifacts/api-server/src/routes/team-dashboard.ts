import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

async function getOrgIdForMember(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("organisation_members")
    .select("organisation_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .single();
  return data?.organisation_id || null;
}

router.get("/team/dashboard", requireAuth, async (req, res): Promise<void> => {
  try {
    const orgId = await getOrgIdForMember(req.userId!);
    if (!orgId) {
      res.json({ members: [], recentActivity: [] });
      return;
    }

    const { data: members } = await supabaseAdmin
      .from("organisation_members")
      .select("user_id, role")
      .eq("organisation_id", orgId)
      .eq("status", "active");

    if (!members || members.length === 0) {
      res.json({ members: [], recentActivity: [] });
      return;
    }

    const memberUserIds = members.map((m: any) => m.user_id);

    const { data: sharedMailboxes } = await supabaseAdmin
      .from("shared_mailboxes")
      .select("id")
      .eq("organisation_id", orgId);
    const sharedMailboxIds = (sharedMailboxes || []).map((sm: any) => sm.id);

    const memberStats = [];
    for (const m of members) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("full_name")
        .eq("id", m.user_id)
        .single();

      let email = "";
      try {
        const { data: u } = await supabaseAdmin.auth.admin.getUserById(m.user_id);
        email = u.user?.email || "";
      } catch {}

      let assignedQuery = supabaseAdmin
        .from("emails")
        .select("id", { count: "exact", head: true })
        .eq("assigned_to", m.user_id)
        .neq("status", "supprime")
        .in("user_id", memberUserIds);

      const { count: assignedCount } = await assignedQuery;

      let archivedQuery = supabaseAdmin
        .from("emails")
        .select("id", { count: "exact", head: true })
        .eq("assigned_to", m.user_id)
        .eq("status", "archived")
        .in("user_id", memberUserIds);

      const { count: assignedDoneCount } = await archivedQuery;

      const { count: commentCount } = await supabaseAdmin
        .from("email_comments")
        .select("id", { count: "exact", head: true })
        .eq("user_id", m.user_id);

      memberStats.push({
        userId: m.user_id,
        fullName: profile?.full_name || "",
        email,
        role: m.role,
        assignedEmails: assignedCount || 0,
        archivedEmails: assignedDoneCount || 0,
        commentsCount: commentCount || 0,
      });
    }

    const { data: recentActivity } = await supabaseAdmin
      .from("activity_logs")
      .select("id, user_id, action, entity_type, entity_id, details, created_at")
      .eq("organisation_id", orgId)
      .order("created_at", { ascending: false })
      .limit(30);

    const activityUserIds = [...new Set((recentActivity || []).map(a => a.user_id))];
    const activityProfileMap = new Map<string, string>();

    for (const uid of activityUserIds) {
      const { data: p } = await supabaseAdmin
        .from("profiles")
        .select("full_name")
        .eq("id", uid)
        .single();
      if (p) activityProfileMap.set(uid, p.full_name || "");
    }

    const enrichedActivity = (recentActivity || []).map(a => ({
      id: a.id,
      userId: a.user_id,
      userName: activityProfileMap.get(a.user_id) || "",
      action: a.action,
      entityType: a.entity_type,
      entityId: a.entity_id,
      details: a.details,
      createdAt: a.created_at,
    }));

    res.json({ members: memberStats, recentActivity: enrichedActivity });
  } catch {
    res.status(500).json({ error: "Erreur lors de la récupération du tableau de bord équipe" });
  }
});

router.get("/team/activity", requireAuth, async (req, res): Promise<void> => {
  try {
    const orgId = await getOrgIdForMember(req.userId!);
    if (!orgId) {
      res.json([]);
      return;
    }

    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 50, 1), 100);

    const { data: activity } = await supabaseAdmin
      .from("activity_logs")
      .select("id, user_id, action, entity_type, entity_id, details, created_at")
      .eq("organisation_id", orgId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (!activity || activity.length === 0) {
      res.json([]);
      return;
    }

    const userIds = [...new Set(activity.map(a => a.user_id))];
    const profileMap = new Map<string, string>();

    for (const uid of userIds) {
      const { data: p } = await supabaseAdmin
        .from("profiles")
        .select("full_name")
        .eq("id", uid)
        .single();
      if (p) profileMap.set(uid, p.full_name || "");
    }

    res.json(activity.map(a => ({
      id: a.id,
      userId: a.user_id,
      userName: profileMap.get(a.user_id) || "",
      action: a.action,
      entityType: a.entity_type,
      entityId: a.entity_id,
      details: a.details,
      createdAt: a.created_at,
    })));
  } catch {
    res.status(500).json({ error: "Erreur lors de la récupération de l'historique" });
  }
});

export default router;
