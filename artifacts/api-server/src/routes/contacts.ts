import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth } from "../middlewares/auth";
import { getMemberMailboxIds, buildInboxScopeOrFilter } from "../lib/inbox-scope";
import { getOrgIdForOrgAdmin, listOrgMemberIds, logAdminTeamAccess } from "../lib/org-admin";

const router: IRouter = Router();

// Task #176 — Vue dossier équipe (admin org only).
// Renvoie le contexte d'autorisation pour le scope demandé. Si scope=team
// est demandé par un non-admin, on retourne { forbidden: true }.
async function resolveScope(
  userId: string,
  rawScope: string | undefined,
): Promise<
  | { mode: "self" }
  | { mode: "team"; orgId: string; memberIds: string[]; sharedMailboxIds: string[] }
  | { mode: "forbidden" }
> {
  if (rawScope !== "team") return { mode: "self" };
  const orgId = await getOrgIdForOrgAdmin(userId);
  if (!orgId) return { mode: "forbidden" };
  const memberIds = await listOrgMemberIds(orgId);
  if (memberIds.length === 0) return { mode: "team", orgId, memberIds: [userId], sharedMailboxIds: [] };
  const { data: smbx } = await supabaseAdmin
    .from("shared_mailboxes")
    .select("id")
    .eq("organisation_id", orgId);
  const sharedMailboxIds = (smbx || []).map((m: any) => String(m.id)).filter(Boolean);
  return { mode: "team", orgId, memberIds, sharedMailboxIds };
}

function buildTeamScopeOrFilter(memberIds: string[], sharedMailboxIds: string[]): string {
  // Personal mailboxes of every active member of the org + every shared
  // mailbox owned by the org. Mirrors buildInboxScopeOrFilter shape.
  const parts: string[] = [];
  if (memberIds.length > 0) {
    parts.push(`user_id.in.(${memberIds.join(",")})`);
  }
  if (sharedMailboxIds.length > 0) {
    parts.push(`shared_mailbox_id.in.(${sharedMailboxIds.join(",")})`);
  }
  // Always include something to avoid an empty .or() filter (Supabase rejects it)
  if (parts.length === 0) parts.push("id.eq.-1");
  return parts.join(",");
}

// V1 limitation : on scanne au plus 5000 emails par requête /contacts pour borner
// le coût mémoire/CPU de l'agrégation côté API. Pour un compte avec >5000 emails,
// les compteurs (totalCount, firstSeenAt) reflètent uniquement les 5000 plus récents.
// Phase ultérieure : déléguer l'agrégation à PostgreSQL (vue matérialisée + index)
// pour une exhaustivité réelle sans cap.
const MAX_EMAILS_SCAN = 5000;

interface ParsedAddress {
  name: string;
  email: string;
}

function parseSingleAddress(raw: string): ParsedAddress | null {
  const s = String(raw).trim();
  if (!s) return null;
  const m = s.match(/^\s*"?([^"<>]*?)"?\s*<\s*([^<>]+)\s*>\s*$/);
  if (m) {
    const name = (m[1] || "").trim();
    const email = (m[2] || "").trim().toLowerCase();
    if (!email || !email.includes("@")) return null;
    return { name: name || email, email };
  }
  const bare = s.replace(/^["'<\s]+|["'>\s]+$/g, "").toLowerCase();
  if (bare.includes("@")) return { name: bare, email: bare };
  return null;
}

function parseAddresses(raw: string | null | undefined): ParsedAddress[] {
  if (!raw) return [];
  const parts = String(raw).split(/\s*[,;]\s*/).filter(Boolean);
  const out: ParsedAddress[] = [];
  const seen = new Set<string>();
  for (const p of parts) {
    const parsed = parseSingleAddress(p);
    if (parsed && !seen.has(parsed.email)) {
      seen.add(parsed.email);
      out.push(parsed);
    }
  }
  return out;
}

function parseAddress(raw: string | null | undefined): ParsedAddress | null {
  const addrs = parseAddresses(raw);
  return addrs[0] || null;
}

function normalizeEmailParam(raw: string): string {
  return decodeURIComponent(String(raw || "")).trim().toLowerCase();
}

async function getOwnAddresses(userId: string, memberMailboxIds: string[]): Promise<Set<string>> {
  const own = new Set<string>();
  const { data: conns } = await supabaseAdmin
    .from("email_connections")
    .select("email_address")
    .eq("user_id", userId);
  for (const c of conns || []) {
    if (c.email_address) own.add(String(c.email_address).toLowerCase());
  }
  if (memberMailboxIds.length > 0) {
    const { data: smbx } = await supabaseAdmin
      .from("shared_mailboxes")
      .select("email_address")
      .in("id", memberMailboxIds);
    for (const m of smbx || []) {
      if (m.email_address) own.add(String(m.email_address).toLowerCase());
    }
  }
  return own;
}

router.get("/contacts", requireAuth, async (req, res): Promise<void> => {
  try {
    const q = (req.query.q as string | undefined)?.trim().toLowerCase() || "";
    const page = Math.max(1, parseInt((req.query.page as string) || "1", 10));
    const pageSize = Math.min(100, Math.max(10, parseInt((req.query.pageSize as string) || "30", 10)));
    const scope = await resolveScope(req.userId!, req.query.scope as string | undefined);

    if (scope.mode === "forbidden") {
      res.status(403).json({ error: "Vue équipe réservée aux administrateurs de l'organisation." });
      return;
    }

    let orFilter: string;
    let ownAddresses: Set<string>;
    let query = supabaseAdmin
      .from("emails")
      .select("id, sender, recipient, status, project_id, created_at, shared_mailbox_id, is_private, user_id");

    if (scope.mode === "team") {
      orFilter = buildTeamScopeOrFilter(scope.memberIds, scope.sharedMailboxIds);
      // For team view, "own addresses" means addresses owned by ANY member of the org.
      const { data: conns } = await supabaseAdmin
        .from("email_connections")
        .select("email_address")
        .in("user_id", scope.memberIds);
      ownAddresses = new Set<string>();
      for (const c of conns || []) {
        if (c.email_address) ownAddresses.add(String(c.email_address).toLowerCase());
      }
      if (scope.sharedMailboxIds.length > 0) {
        const { data: smbx } = await supabaseAdmin
          .from("shared_mailboxes")
          .select("email_address")
          .in("id", scope.sharedMailboxIds);
        for (const m of smbx || []) {
          if (m.email_address) ownAddresses.add(String(m.email_address).toLowerCase());
        }
      }
      // Exclude private emails from the team aggregation (RGPD safeguard).
      query = query.eq("is_private", false);
    } else {
      const memberMailboxIds = await getMemberMailboxIds(req.userId!);
      orFilter = buildInboxScopeOrFilter(req.userId!, memberMailboxIds);
      ownAddresses = await getOwnAddresses(req.userId!, memberMailboxIds);
    }

    const { data: rows, error } = await query
      .or(orFilter)
      .order("created_at", { ascending: false })
      .limit(MAX_EMAILS_SCAN);
    if (error) throw error;

    if (scope.mode === "team") {
      // Aggregate row (admin's own log).
      void logAdminTeamAccess({
        organisationId: scope.orgId,
        adminUserId: req.userId!,
        targetType: "inbox_overview",
        targetValue: null,
        emailsSeenCount: (rows || []).length,
        action: "view_contact_list_team",
      });
      // Per-impacted-member rows so each teammate sees the access in their
      // own /me/private-emails / journal vie privée. We pivot the rows by
      // owning user_id, then log one entry per teammate other than the admin.
      const perMember = new Map<string, number>();
      for (const r of rows || []) {
        const owner = String((r as any).user_id || "");
        if (!owner || owner === req.userId) continue;
        perMember.set(owner, (perMember.get(owner) || 0) + 1);
      }
      if (perMember.size > 0) {
        const ownerIds = Array.from(perMember.keys());
        const { data: ownerConns } = await supabaseAdmin
          .from("email_connections")
          .select("user_id, email_address")
          .in("user_id", ownerIds);
        const addrByOwner = new Map<string, string>();
        for (const c of ownerConns || []) {
          if (!addrByOwner.has(String((c as any).user_id))) {
            addrByOwner.set(String((c as any).user_id), String((c as any).email_address || "").toLowerCase());
          }
        }
        for (const [ownerId, count] of perMember) {
          void logAdminTeamAccess({
            organisationId: scope.orgId,
            adminUserId: req.userId!,
            targetType: "member_inbox",
            targetValue: addrByOwner.get(ownerId) || ownerId,
            emailsSeenCount: count,
            action: "view_contact_list_team",
          });
        }
      }
    }

    const map = new Map<string, { name: string; email: string; count: number; lastSeenAt: string; firstSeenAt: string }>();

    function bump(p: ParsedAddress, ts: string) {
      if (ownAddresses.has(p.email)) return;
      const cur = map.get(p.email);
      if (!cur) {
        map.set(p.email, { name: p.name, email: p.email, count: 1, lastSeenAt: ts, firstSeenAt: ts });
      } else {
        cur.count += 1;
        if (ts > cur.lastSeenAt) cur.lastSeenAt = ts;
        if (ts < cur.firstSeenAt) cur.firstSeenAt = ts;
        if (p.name && p.name !== p.email && cur.name === cur.email) cur.name = p.name;
      }
    }

    for (const r of rows || []) {
      const ts = (r.created_at as string) || new Date().toISOString();
      const senderParsed = parseAddress(r.sender as string);
      const recipientList = parseAddresses(r.recipient as string);
      const isOutbound = senderParsed ? ownAddresses.has(senderParsed.email) : false;
      if (isOutbound) {
        for (const rec of recipientList) bump(rec, ts);
      } else if (senderParsed) {
        bump(senderParsed, ts);
      }
    }

    let list = Array.from(map.values());
    if (q) {
      list = list.filter((c) => c.email.includes(q) || c.name.toLowerCase().includes(q));
    }
    list.sort((a, b) => (a.lastSeenAt < b.lastSeenAt ? 1 : -1));

    const total = list.length;
    const from = (page - 1) * pageSize;
    const items = list.slice(from, from + pageSize);

    res.json({
      contacts: items,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      access: {
        mode: scope.mode,
        privateExcluded: scope.mode === "team",
      },
    });
  } catch (err: any) {
    req.log?.error(
      { err: err?.message, code: err?.code, details: err?.details, hint: err?.hint, scope: req.query.scope },
      "[contacts] list failed",
    );
    res.status(500).json({ error: err?.message || "Failed to list contacts" });
  }
});

router.get("/contacts/:email", requireAuth, async (req, res): Promise<void> => {
  try {
    const target = normalizeEmailParam(String(req.params.email ?? ""));
    if (!target || !target.includes("@")) {
      res.status(400).json({ error: "Adresse email invalide" });
      return;
    }

    const scope = await resolveScope(req.userId!, req.query.scope as string | undefined);
    if (scope.mode === "forbidden") {
      res.status(403).json({ error: "Vue équipe réservée aux administrateurs de l'organisation." });
      return;
    }

    let orFilter: string;
    let ownAddresses: Set<string>;
    let query = supabaseAdmin
      .from("emails")
      .select(
        "id, sender, recipient, subject, body, status, priority, summary, project_id, created_at, shared_mailbox_id, user_id, assigned_to, is_private, projects(name, reference)",
      );

    if (scope.mode === "team") {
      orFilter = buildTeamScopeOrFilter(scope.memberIds, scope.sharedMailboxIds);
      const { data: conns } = await supabaseAdmin
        .from("email_connections")
        .select("email_address")
        .in("user_id", scope.memberIds);
      ownAddresses = new Set<string>();
      for (const c of conns || []) {
        if (c.email_address) ownAddresses.add(String(c.email_address).toLowerCase());
      }
      if (scope.sharedMailboxIds.length > 0) {
        const { data: smbx } = await supabaseAdmin
          .from("shared_mailboxes")
          .select("email_address")
          .in("id", scope.sharedMailboxIds);
        for (const m of smbx || []) {
          if (m.email_address) ownAddresses.add(String(m.email_address).toLowerCase());
        }
      }
      query = query.eq("is_private", false);
    } else {
      const memberMailboxIds = await getMemberMailboxIds(req.userId!);
      orFilter = buildInboxScopeOrFilter(req.userId!, memberMailboxIds);
      ownAddresses = await getOwnAddresses(req.userId!, memberMailboxIds);
    }

    const { data: emails, error } = await query
      .or(orFilter)
      .or(`sender.ilike.%${target}%,recipient.ilike.%${target}%`)
      .order("created_at", { ascending: false })
      .limit(MAX_EMAILS_SCAN);

    if (error) {
      req.log?.error(
        { err: error.message, code: (error as any).code, details: (error as any).details, hint: (error as any).hint, scope: scope.mode, target, orFilter },
        "[contacts] detail query failed",
      );
      res.status(500).json({ error: error.message });
      return;
    }

    const matching = (emails || []).filter((e: any) => {
      const s = parseAddress(e.sender)?.email;
      const recs = parseAddresses(e.recipient).map((r) => r.email);
      return s === target || recs.includes(target);
    });

    if (matching.length === 0) {
      res.status(404).json({ error: "Contact introuvable" });
      return;
    }

    let displayName = target;
    let firstSeenAt = matching[0].created_at as string;
    let lastSeenAt = matching[0].created_at as string;

    type ThreadEntry = {
      threadKey: string;
      latestEmailId: number;
      subject: string;
      latestSummary: string | null;
      latestStatus: string;
      latestPriority: string;
      latestDirection: "inbound" | "outbound";
      latestCreatedAt: string;
      messageCount: number;
      projectName: string | null;
      projectReference: string | null;
      handledByUserId: string | null;
    };
    const threadMap = new Map<string, ThreadEntry>();
    const projectIds = new Set<string>();
    const handlerUserIds = new Set<string>();

    function normalizeSubject(s: string): string {
      let v = (s || "").trim();
      // Strip leading reply/forward prefixes (Re:, Fwd:, Tr:, Fw:, Rép:, AW:, WG:, RV:) in any language
      while (true) {
        const prev = v;
        v = v.replace(/^\s*(re|ré|rép|aw|fwd|fw|tr|tr\.|wg|rv|antw|antwort|i|sv|vs)\s*[:：]\s*/i, "").trim();
        if (v === prev) break;
      }
      return v.toLowerCase().replace(/\s+/g, " ");
    }

    for (const e of matching) {
      const s = parseAddress(e.sender as string);
      const recs = parseAddresses(e.recipient as string);
      const targetRecipient = recs.find((r) => r.email === target) || recs[0];
      const senderIsOwn = s ? ownAddresses.has(s.email) : false;
      const senderIsTarget = s?.email === target;
      const direction: "inbound" | "outbound" = senderIsOwn && !senderIsTarget ? "outbound" : "inbound";
      const partner = direction === "outbound" ? targetRecipient : s;
      if (partner && partner.name && partner.name !== partner.email) displayName = partner.name;
      const ts = (e.created_at as string) || lastSeenAt;
      if (ts > lastSeenAt) lastSeenAt = ts;
      if (ts < firstSeenAt) firstSeenAt = ts;
      if (e.project_id) projectIds.add(String(e.project_id));

      const rawSubject = (e.subject as string) || "(sans objet)";
      const key = normalizeSubject(rawSubject) || `__id_${e.id}`;
      // In team mode, "handled by" is the user owning the email (assigned_to wins over user_id)
      const handlerId = scope.mode === "team"
        ? (((e as any).assigned_to as string | null) || ((e as any).user_id as string | null) || null)
        : null;
      if (handlerId) handlerUserIds.add(handlerId);
      const existing = threadMap.get(key);
      if (!existing) {
        threadMap.set(key, {
          threadKey: key,
          latestEmailId: e.id,
          subject: rawSubject,
          latestSummary: e.summary || null,
          latestStatus: e.status,
          latestPriority: e.priority || "faible",
          latestDirection: direction,
          latestCreatedAt: ts,
          messageCount: 1,
          projectName: (e as any).projects?.name || null,
          projectReference: (e as any).projects?.reference || null,
          handledByUserId: handlerId,
        });
      } else {
        existing.messageCount += 1;
        // Emails are queried desc by created_at, so first seen is already the latest
        if (ts > existing.latestCreatedAt) {
          existing.latestEmailId = e.id;
          existing.subject = rawSubject;
          existing.latestSummary = e.summary || null;
          existing.latestStatus = e.status;
          existing.latestPriority = e.priority || "faible";
          existing.latestDirection = direction;
          existing.latestCreatedAt = ts;
          existing.projectName = (e as any).projects?.name || null;
          existing.projectReference = (e as any).projects?.reference || null;
          existing.handledByUserId = handlerId;
        }
      }
    }

    // In team mode, resolve full names of email handlers
    const handlerNameMap = new Map<string, string>();
    if (scope.mode === "team" && handlerUserIds.size > 0) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name")
        .in("id", Array.from(handlerUserIds));
      for (const p of profs || []) {
        handlerNameMap.set(String(p.id), (p as any).full_name || "");
      }
    }

    const conversations = Array.from(threadMap.values())
      .sort((a, b) => (a.latestCreatedAt < b.latestCreatedAt ? 1 : -1))
      .map((t) => ({
        id: t.latestEmailId,
        threadKey: t.threadKey,
        subject: t.subject,
        summary: t.latestSummary,
        status: t.latestStatus,
        priority: t.latestPriority,
        direction: t.latestDirection,
        createdAt: t.latestCreatedAt,
        messageCount: t.messageCount,
        projectName: t.projectName,
        projectReference: t.projectReference,
        handledByName: t.handledByUserId ? handlerNameMap.get(t.handledByUserId) || null : null,
      }));

    const emailIds = matching.map((e: any) => e.id);
    const userScopeIds = scope.mode === "team" ? scope.memberIds : [req.userId!];

    const [tasksRes, apptsRes, attachRes] = await Promise.all([
      emailIds.length
        ? supabaseAdmin
            .from("tasks")
            .select("id, title, done, due_date, email_id, project_id, created_at, projects(name, reference)")
            .in("email_id", emailIds)
            .in("user_id", userScopeIds)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as any[], error: null as any }),
      emailIds.length
        ? supabaseAdmin
            .from("appointments")
            .select("id, title, location, start_at, end_at, all_day, email_id, project_id")
            .in("email_id", emailIds)
            .in("user_id", userScopeIds)
            .order("start_at", { ascending: false })
        : Promise.resolve({ data: [] as any[], error: null as any }),
      emailIds.length
        ? supabaseAdmin
            .from("email_attachments")
            .select("id, filename, content_type, size, email_id, created_at")
            .in("email_id", emailIds)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as any[], error: null as any }),
    ]);

    let projects: Array<{ id: string; name: string; reference: string | null }> = [];
    if (projectIds.size > 0) {
      const { data: projRows } = await supabaseAdmin
        .from("projects")
        .select("id, name, reference")
        .in("id", Array.from(projectIds))
        .in("user_id", userScopeIds);
      projects = (projRows || []).map((p: any) => ({ id: p.id, name: p.name, reference: p.reference }));
    }

    let comments: Array<{ id: string; emailId: number; emailSubject: string; body: string; createdAt: string; authorName: string }> = [];
    // Internal team comments are a Business-plan feature only
    const { data: profileRow } = await supabaseAdmin
      .from("profiles")
      .select("plan")
      .eq("id", req.userId!)
      .maybeSingle();
    const isBusinessPlan = (profileRow?.plan || "") === "business";
    if (emailIds.length && isBusinessPlan) {
      const { data: cmtRows } = await supabaseAdmin
        .from("email_comments")
        .select("id, email_id, user_id, body, created_at")
        .in("email_id", emailIds)
        .order("created_at", { ascending: false });
      const subjectByEmail = new Map<number, string>();
      for (const e of matching) subjectByEmail.set(e.id, e.subject || "");
      const userIds = Array.from(new Set((cmtRows || []).map((c: any) => c.user_id)));
      const nameMap = new Map<string, string>();
      if (userIds.length) {
        const { data: profs } = await supabaseAdmin
          .from("profiles")
          .select("id, full_name")
          .in("id", userIds);
        for (const p of profs || []) nameMap.set(p.id, p.full_name || "");
      }
      comments = (cmtRows || []).map((c: any) => ({
        id: c.id,
        emailId: c.email_id,
        emailSubject: subjectByEmail.get(c.email_id) || "",
        body: c.body,
        createdAt: c.created_at,
        authorName: nameMap.get(c.user_id) || "",
      }));
    }

    if (scope.mode === "team") {
      // Aggregate row about the contact being viewed.
      void logAdminTeamAccess({
        organisationId: scope.orgId,
        adminUserId: req.userId!,
        targetType: "contact",
        targetValue: target,
        emailsSeenCount: matching.length,
        action: "view_contact_team",
      });
      // Per-impacted-member rows: each teammate (other than admin) whose
      // emails appear gets their own audit entry, so they can see this
      // access in the privacy log via target_value=their address.
      const perMember = new Map<string, number>();
      for (const m of matching) {
        const owner = String((m as any).user_id || "");
        if (!owner || owner === req.userId) continue;
        perMember.set(owner, (perMember.get(owner) || 0) + 1);
      }
      if (perMember.size > 0) {
        const ownerIds = Array.from(perMember.keys());
        const { data: ownerConns } = await supabaseAdmin
          .from("email_connections")
          .select("user_id, email_address")
          .in("user_id", ownerIds);
        const addrByOwner = new Map<string, string>();
        for (const c of ownerConns || []) {
          if (!addrByOwner.has(String((c as any).user_id))) {
            addrByOwner.set(String((c as any).user_id), String((c as any).email_address || "").toLowerCase());
          }
        }
        for (const [ownerId, count] of perMember) {
          void logAdminTeamAccess({
            organisationId: scope.orgId,
            adminUserId: req.userId!,
            targetType: "member_inbox",
            targetValue: addrByOwner.get(ownerId) || ownerId,
            emailsSeenCount: count,
            action: "view_contact_team",
          });
        }
      }
    }

    res.json({
      contact: {
        name: displayName,
        email: target,
        firstSeenAt,
        lastSeenAt,
        totalCount: matching.length,
      },
      conversations,
      tasks: (tasksRes.data || []).map((t: any) => ({
        id: t.id,
        title: t.title,
        done: t.done,
        dueDate: t.due_date,
        emailId: t.email_id,
        projectName: t.projects?.name || null,
        projectReference: t.projects?.reference || null,
        createdAt: t.created_at,
      })),
      appointments: (apptsRes.data || []).map((a: any) => ({
        id: a.id,
        title: a.title,
        location: a.location,
        startAt: a.start_at,
        endAt: a.end_at,
        allDay: a.all_day,
        emailId: a.email_id,
      })),
      projects,
      comments,
      attachments: (attachRes.data || []).map((a: any) => ({
        id: a.id,
        filename: a.filename,
        contentType: a.content_type,
        size: a.size,
        emailId: a.email_id,
        createdAt: a.created_at,
      })),
      access: {
        mode: scope.mode,
        privateExcluded: scope.mode === "team",
      },
    });
  } catch (err: any) {
    req.log?.error(
      { err: err?.message, code: err?.code, details: err?.details, hint: err?.hint, stack: err?.stack, scope: req.query.scope, target: req.params.email },
      "[contacts] detail failed",
    );
    res.status(500).json({ error: err?.message || "Failed to load contact" });
  }
});

export default router;
