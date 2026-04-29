import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth } from "../middlewares/auth";
import { getMemberMailboxIds, buildInboxScopeOrFilter } from "../lib/inbox-scope";

const router: IRouter = Router();

const JUNK_NAMES = ["non classé", "non classe", "uncategorized", "niet geclassificeerd"];

router.get("/dashboard/bootstrap", requireAuth, async (req, res): Promise<void> => {
  const userId = req.userId!;

  try {
    const [
      profileResult,
      authUserResult,
      membershipResult,
      memberMailboxIds,
      projectsResult,
      integrationsResult,
      junkCatsResult,
      pendingTasksResult,
    ] = await Promise.all([
      supabaseAdmin.from("profiles").select("*").eq("id", userId).single(),
      supabaseAdmin.auth.admin.getUserById(userId),
      supabaseAdmin
        .from("organisation_members")
        .select("organisation_id, role")
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle(),
      getMemberMailboxIds(userId),
      supabaseAdmin
        .from("projects")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("integrations")
        .select("id, provider, workspace_name, channel_id, database_id, enabled, created_at")
        .eq("user_id", userId),
      supabaseAdmin.from("categories").select("id, name, is_system").eq("user_id", userId),
      supabaseAdmin
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("done", false),
    ]);

    const profile = profileResult.data;
    if (!profile) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }

    const membership = membershipResult.data;
    let organisation: any = null;
    let members: any[] = [];
    let sharedMailboxes: any[] = [];

    if (membership) {
      const orgId = membership.organisation_id as string;
      const isAdmin = membership.role === "admin";

      const [orgResult, membersResult, mailboxesResult] = await Promise.all([
        supabaseAdmin.from("organisations").select("*").eq("id", orgId).single(),
        supabaseAdmin
          .from("organisation_members")
          .select("id, user_id, role, status, joined_at")
          .eq("organisation_id", orgId)
          .order("joined_at", { ascending: true }),
        isAdmin
          ? supabaseAdmin
              .from("shared_mailboxes")
              .select("id, name, email_address, connection_id, created_at")
              .eq("organisation_id", orgId)
              .order("created_at", { ascending: true })
          : memberMailboxIds.length > 0
            ? supabaseAdmin
                .from("shared_mailboxes")
                .select("id, name, email_address, connection_id, created_at")
                .eq("organisation_id", orgId)
                .in("id", memberMailboxIds)
                .order("created_at", { ascending: true })
            : Promise.resolve({ data: [] as any[] }),
      ]);

      const org = orgResult.data;
      if (org) {
        organisation = {
          id: org.id,
          name: org.name,
          slug: org.slug,
          plan: org.plan,
          seatsTotal: org.seats_total,
          emailsQuota: org.emails_quota,
          emailsUsed: org.emails_used,
          myRole: membership.role,
          createdAt: org.created_at,
        };
      }

      const memberRows = membersResult.data || [];
      const userIds = memberRows.map((m: any) => m.user_id);

      let profileMap = new Map<string, any>();
      if (userIds.length > 0) {
        const { data: profiles } = await supabaseAdmin
          .from("profiles")
          .select("id, full_name")
          .in("id", userIds);
        profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
      }

      const emailLookups = await Promise.all(
        memberRows.map((m: any) =>
          supabaseAdmin.auth.admin.getUserById(m.user_id).then(
            (r) => ({ id: m.user_id, email: r.data.user?.email || "" }),
            () => ({ id: m.user_id, email: "" }),
          ),
        ),
      );
      const emailMap = new Map(emailLookups.map((e) => [e.id, e.email]));

      members = memberRows.map((m: any) => ({
        id: m.id,
        userId: m.user_id,
        role: m.role,
        status: m.status,
        joinedAt: m.joined_at,
        fullName: profileMap.get(m.user_id)?.full_name || "",
        email: emailMap.get(m.user_id) || "",
      }));

      const mailboxRows = mailboxesResult.data || [];
      const enrichedMailboxes = await Promise.all(
        mailboxRows.map(async (mb: any) => {
          const [{ data: mbMembers }, { count: unclaimed }] = await Promise.all([
            supabaseAdmin
              .from("shared_mailbox_members")
              .select("id")
              .eq("shared_mailbox_id", mb.id),
            supabaseAdmin
              .from("emails")
              .select("id", { count: "exact", head: true })
              .eq("shared_mailbox_id", mb.id)
              .is("claimed_by", null)
              .neq("status", "supprime"),
          ]);
          return {
            id: mb.id,
            name: mb.name,
            emailAddress: mb.email_address,
            connectionId: mb.connection_id ?? null,
            createdAt: mb.created_at,
            memberCount: mbMembers?.length || 0,
            unclaimedCount: unclaimed || 0,
          };
        }),
      );
      sharedMailboxes = enrichedMailboxes;
    }

    const projectsRows = projectsResult.data || [];
    const projectIds = projectsRows.map((p: any) => p.id);

    const emailCounts: Record<string, number> = {};
    const taskCounts: Record<string, number> = {};
    const pendingProjectTaskCounts: Record<string, number> = {};

    if (projectIds.length > 0) {
      const [projectEmails, projectTasks] = await Promise.all([
        supabaseAdmin
          .from("emails")
          .select("project_id")
          .in("project_id", projectIds)
          .eq("user_id", userId),
        supabaseAdmin
          .from("tasks")
          .select("project_id, done")
          .in("project_id", projectIds)
          .eq("user_id", userId),
      ]);

      (projectEmails.data || []).forEach((e: any) => {
        emailCounts[e.project_id] = (emailCounts[e.project_id] || 0) + 1;
      });
      (projectTasks.data || []).forEach((t: any) => {
        taskCounts[t.project_id] = (taskCounts[t.project_id] || 0) + 1;
        if (!t.done) {
          pendingProjectTaskCounts[t.project_id] = (pendingProjectTaskCounts[t.project_id] || 0) + 1;
        }
      });
    }

    const projects = projectsRows.map((p: any) => ({
      id: p.id,
      name: p.name,
      reference: p.reference,
      description: p.description,
      status: p.status,
      color: p.color,
      emailCount: emailCounts[p.id] || 0,
      taskCount: taskCounts[p.id] || 0,
      pendingTaskCount: pendingProjectTaskCounts[p.id] || 0,
      createdAt: p.created_at,
    }));

    const integrations = (integrationsResult.data || []).map((i: any) => ({
      id: i.id,
      provider: i.provider,
      workspaceName: i.workspace_name ?? null,
      channelId: i.channel_id ?? null,
      databaseId: i.database_id ?? null,
      enabled: !!i.enabled,
      createdAt: i.created_at,
    }));

    // Inbox summary — same logic as /dashboard/summary, kept inline so the
    // bootstrap response is fully self-contained.
    const scopeOr = buildInboxScopeOrFilter(userId, memberMailboxIds);
    const { data: inboxRows } = await supabaseAdmin
      .from("emails")
      .select("priority, status, category_id")
      .or(scopeOr);

    const allEmails = inboxRows || [];
    const inboxEmails = allEmails.filter(
      (e: any) =>
        e.status !== "archived" &&
        e.status !== "trashed" &&
        e.status !== "spam" &&
        e.status !== "sent" &&
        e.status !== "scheduled" &&
        e.status !== "scheduled_failed",
    );
    const urgent = inboxEmails.filter((e: any) => e.priority === "urgent").length;
    const moyen = inboxEmails.filter((e: any) => e.priority === "moyen").length;
    const faible = inboxEmails.filter((e: any) => e.priority === "faible").length;

    const junkIds = (junkCatsResult.data || [])
      .filter(
        (c: any) =>
          c.is_system === true || JUNK_NAMES.includes((c.name || "").toLowerCase()),
      )
      .map((c: any) => c.id);
    const uncategorizedCount = inboxEmails.filter(
      (e: any) => e.category_id == null || junkIds.includes(e.category_id),
    ).length;

    const summary = {
      totalEmails: allEmails.length,
      urgentCount: urgent,
      moyenCount: moyen,
      faibleCount: faible,
      uncategorizedCount,
      notificationCount: 0,
      pendingTasks: pendingTasksResult.count || 0,
      emailsUsed: profile.emails_used ?? 0,
      emailsQuota: profile.emails_quota ?? 100,
      plan: profile.plan ?? "essai",
    };

    // Profile shape mirrors /profile.
    let organisationId: string | null = membership?.organisation_id || null;
    let organisationName: string | null = organisation?.name || null;
    const organisationRole: "admin" | "member" | null = membership?.role || null;

    res.json({
      profile: {
        id: profile.id,
        email: authUserResult.data.user?.email || "",
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
        createdAt: profile.created_at,
        organisationId,
        organisationName,
        organisationRole,
        isAdmin: !!profile.is_admin,
      },
      organisation,
      members,
      sharedMailboxes,
      projects,
      integrations,
      summary,
    });
  } catch (err) {
    req.log?.error({ err }, "dashboard.bootstrap.failed");
    res.status(500).json({ error: "Failed to load dashboard bootstrap" });
  }
});

export default router;
