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

router.get("/team/recent-comments", requireAuth, async (req, res): Promise<void> => {
  try {
    const orgId = await getOrgIdForMember(req.userId!);
    if (!orgId) {
      res.json([]);
      return;
    }

    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 && limitRaw <= 50 ? Math.floor(limitRaw) : 10;

    const { data: members } = await supabaseAdmin
      .from("organisation_members")
      .select("user_id")
      .eq("organisation_id", orgId)
      .eq("status", "active");

    const memberUserIds = (members || []).map((m) => m.user_id);
    if (memberUserIds.length === 0) {
      res.json([]);
      return;
    }

    const { data: comments } = await supabaseAdmin
      .from("email_comments")
      .select("id, body, created_at, user_id, email_id")
      .in("user_id", memberUserIds)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (!comments || comments.length === 0) {
      res.json([]);
      return;
    }

    const emailIds = [...new Set(comments.map((c) => c.email_id))];
    const userIds = [...new Set(comments.map((c) => c.user_id))];

    // Restreindre aux emails qui appartiennent à un membre de l'organisation
    // (un commentaire orphelin sur un email non visible ne devrait pas remonter ici).
    const { data: emails } = await supabaseAdmin
      .from("emails")
      .select("id, subject, user_id")
      .in("id", emailIds)
      .in("user_id", memberUserIds);

    const emailMap = new Map<number, string>();
    for (const e of emails || []) {
      emailMap.set(e.id, e.subject || "");
    }

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);

    const profileMap = new Map<string, string>();
    for (const p of profiles || []) {
      profileMap.set(p.id, p.full_name || "");
    }

    const enriched = comments
      .filter((c) => emailMap.has(c.email_id))
      .map((c) => ({
        id: String(c.id),
        body: c.body || "",
        createdAt: c.created_at,
        userId: c.user_id,
        userName: profileMap.get(c.user_id) || "",
        emailId: c.email_id,
        emailSubject: emailMap.get(c.email_id) || "",
      }));

    res.json(enriched);
  } catch {
    res.status(500).json({ error: "Erreur lors de la récupération des commentaires récents" });
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
