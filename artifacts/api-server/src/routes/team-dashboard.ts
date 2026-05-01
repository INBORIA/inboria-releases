import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth } from "../middlewares/auth";
import { getMemberMailboxIds, buildInboxScopeOrFilter } from "../lib/inbox-scope";

const router: IRouter = Router();

function parseSender(raw: string) {
  const match = raw.match(/^(.+?)\s*<(.+?)>$/);
  return {
    name: match ? match[1].trim().replace(/^"|"$/g, "") : raw,
    email: match ? match[2].trim() : raw,
  };
}

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

    const requesterMailboxIds = await getMemberMailboxIds(req.userId!);

    let scopedEmailIdsForCount: number[] = [];
    if (requesterMailboxIds.length > 0) {
      const { data: scopedEmails } = await supabaseAdmin
        .from("emails")
        .select("id")
        .in("shared_mailbox_id", requesterMailboxIds);
      scopedEmailIdsForCount = (scopedEmails || []).map((e: any) => e.id);
    }

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
        .neq("status", "archived")
        .neq("status", "trashed")
        .neq("status", "spam")
        .neq("status", "sent")
        .neq("status", "scheduled")
        .neq("status", "scheduled_failed")
        .in("user_id", memberUserIds);

      const { count: assignedCount } = await assignedQuery;

      let archivedQuery = supabaseAdmin
        .from("emails")
        .select("id", { count: "exact", head: true })
        .eq("assigned_to", m.user_id)
        .eq("status", "archived")
        .in("user_id", memberUserIds);

      const { count: assignedDoneCount } = await archivedQuery;

      let commentCount = 0;
      if (scopedEmailIdsForCount.length > 0) {
        const { count } = await supabaseAdmin
          .from("email_comments")
          .select("id", { count: "exact", head: true })
          .eq("user_id", m.user_id)
          .in("email_id", scopedEmailIdsForCount);
        commentCount = count || 0;
      }

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

    const requesterMailboxIds = await getMemberMailboxIds(req.userId!);
    if (requesterMailboxIds.length === 0) {
      res.json([]);
      return;
    }

    const { data: scopedEmails, error: scopedErr } = await supabaseAdmin
      .from("emails")
      .select("id, subject")
      .in("shared_mailbox_id", requesterMailboxIds);

    if (scopedErr) {
      res.status(500).json({ error: "Erreur lors de la récupération des commentaires récents" });
      return;
    }

    const scopedEmailIds = (scopedEmails || []).map((e) => e.id);
    if (scopedEmailIds.length === 0) {
      res.json([]);
      return;
    }
    const subjectMap = new Map<number, string>();
    for (const e of scopedEmails || []) {
      subjectMap.set(e.id, e.subject || "");
    }

    const { data: comments, error: commentsErr } = await supabaseAdmin
      .from("email_comments")
      .select("id, body, created_at, user_id, email_id")
      .in("user_id", memberUserIds)
      .in("email_id", scopedEmailIds)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (commentsErr) {
      res.status(500).json({ error: "Erreur lors de la récupération des commentaires récents" });
      return;
    }

    if (!comments || comments.length === 0) {
      res.json([]);
      return;
    }

    const userIds = [...new Set(comments.map((c) => c.user_id))];

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);

    const profileMap = new Map<string, string>();
    for (const p of profiles || []) {
      profileMap.set(p.id, p.full_name || "");
    }

    const enriched = comments.map((c) => ({
      id: String(c.id),
      body: c.body || "",
      createdAt: c.created_at,
      userId: c.user_id,
      userName: profileMap.get(c.user_id) || "",
      emailId: c.email_id,
      emailSubject: subjectMap.get(c.email_id) || "",
    }));

    res.json(enriched);
  } catch {
    res.status(500).json({ error: "Erreur lors de la récupération des commentaires récents" });
  }
});

// GET /team/assignments — pour chaque coéquipier, mails assignés visibles
// dans le scope du demandeur. Utilisateur courant en tête.
router.get("/team/assignments", requireAuth, async (req, res): Promise<void> => {
  try {
    const orgId = await getOrgIdForMember(req.userId!);
    if (!orgId) {
      res.json({ members: [] });
      return;
    }

    type MemberRow = { user_id: string; role: string };
    type ProfileRow = { id: string; full_name: string | null };
    type EmailRow = {
      id: number;
      subject: string | null;
      sender: string | null;
      priority: string | null;
      created_at: string;
      assigned_to: string;
      shared_mailbox_id: string | null;
    };
    type MailboxRow = { id: string; name: string | null };
    type AssignedEmail = {
      id: number;
      subject: string;
      sender: string;
      senderEmail: string;
      priority: string;
      createdAt: string;
      sharedMailboxId: string | null;
      sharedMailboxName: string | null;
    };
    type MemberAssignments = {
      userId: string;
      fullName: string;
      email: string;
      role: string;
      isCurrentUser: boolean;
      emails: AssignedEmail[];
    };

    const { data: rawMembers } = await supabaseAdmin
      .from("organisation_members")
      .select("user_id, role")
      .eq("organisation_id", orgId)
      .eq("status", "active");

    const members: MemberRow[] = (rawMembers ?? []) as MemberRow[];
    if (members.length === 0) {
      res.json({ members: [] });
      return;
    }

    const memberUserIds = members.map((m) => m.user_id);

    const { data: rawProfiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name")
      .in("id", memberUserIds);
    const profileMap = new Map<string, string>();
    for (const p of (rawProfiles ?? []) as ProfileRow[]) {
      profileMap.set(p.id, p.full_name || "");
    }

    // Lookups en parallèle pour éviter une latence O(n) séquentielle.
    const emailMap = new Map<string, string>();
    const emailLookups = await Promise.all(
      memberUserIds.map(async (uid) => {
        try {
          const { data: u } = await supabaseAdmin.auth.admin.getUserById(uid);
          return [uid, u.user?.email || ""] as const;
        } catch {
          return [uid, ""] as const;
        }
      }),
    );
    for (const [uid, email] of emailLookups) emailMap.set(uid, email);

    const requesterMailboxIds = await getMemberMailboxIds(req.userId!);
    const scopeOr = buildInboxScopeOrFilter(req.userId!, requesterMailboxIds);

    const { data: rawRows, error } = await supabaseAdmin
      .from("emails")
      .select(
        "id, subject, sender, priority, created_at, assigned_to, shared_mailbox_id",
      )
      .or(scopeOr)
      .in("assigned_to", memberUserIds)
      .neq("status", "archived")
      .neq("status", "trashed")
      .neq("status", "spam")
      .neq("status", "sent")
      .neq("status", "scheduled")
      .neq("status", "scheduled_failed")
      .neq("status", "supprime")
      .order("created_at", { ascending: false });

    if (error) {
      req.log?.warn?.({ msg: error.message }, "[team/assignments] query failed");
      res.status(500).json({ error: "Erreur lors de la récupération des assignations" });
      return;
    }

    const rows: EmailRow[] = (rawRows ?? []) as EmailRow[];

    const mailboxIds = Array.from(
      new Set(
        rows
          .map((r) => r.shared_mailbox_id)
          .filter((v): v is string => !!v),
      ),
    );
    const mailboxNameMap = new Map<string, string>();
    if (mailboxIds.length > 0) {
      const { data: rawMboxes } = await supabaseAdmin
        .from("shared_mailboxes")
        .select("id, name")
        .in("id", mailboxIds);
      for (const mb of (rawMboxes ?? []) as MailboxRow[]) {
        mailboxNameMap.set(mb.id, mb.name || "");
      }
    }

    const byMember = new Map<string, AssignedEmail[]>();
    for (const r of rows) {
      const s = parseSender(r.sender || "");
      const item: AssignedEmail = {
        id: r.id,
        subject: r.subject || "",
        sender: s.name,
        senderEmail: s.email,
        priority: r.priority || "faible",
        createdAt: r.created_at,
        sharedMailboxId: r.shared_mailbox_id,
        sharedMailboxName: r.shared_mailbox_id
          ? mailboxNameMap.get(r.shared_mailbox_id) || null
          : null,
      };
      const list = byMember.get(r.assigned_to) || [];
      list.push(item);
      byMember.set(r.assigned_to, list);
    }

    const result: MemberAssignments[] = members.map((m) => ({
      userId: m.user_id,
      fullName: profileMap.get(m.user_id) || "",
      email: emailMap.get(m.user_id) || "",
      role: m.role,
      isCurrentUser: m.user_id === req.userId,
      emails: byMember.get(m.user_id) || [],
    }));

    result.sort((a, b) => {
      if (a.isCurrentUser && !b.isCurrentUser) return -1;
      if (b.isCurrentUser && !a.isCurrentUser) return 1;
      return b.emails.length - a.emails.length;
    });

    res.json({ members: result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    req.log?.warn?.({ msg }, "[team/assignments] handler crash");
    res.status(500).json({ error: "Erreur lors de la récupération des assignations" });
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
