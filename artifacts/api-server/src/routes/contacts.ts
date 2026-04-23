import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth } from "../middlewares/auth";
import { getMemberMailboxIds, buildInboxScopeOrFilter } from "../lib/inbox-scope";

const router: IRouter = Router();

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

    const memberMailboxIds = await getMemberMailboxIds(req.userId!);
    const orFilter = buildInboxScopeOrFilter(req.userId!, memberMailboxIds);
    const ownAddresses = await getOwnAddresses(req.userId!, memberMailboxIds);

    const { data: rows, error } = await supabaseAdmin
      .from("emails")
      .select("id, sender, recipient, status, project_id, created_at, shared_mailbox_id")
      .or(orFilter)
      .order("created_at", { ascending: false })
      .limit(MAX_EMAILS_SCAN);
    if (error) throw error;

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
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Failed to list contacts" });
  }
});

router.get("/contacts/:email", requireAuth, async (req, res): Promise<void> => {
  try {
    const target = normalizeEmailParam(req.params.email);
    if (!target || !target.includes("@")) {
      res.status(400).json({ error: "Adresse email invalide" });
      return;
    }

    const memberMailboxIds = await getMemberMailboxIds(req.userId!);
    const orFilter = buildInboxScopeOrFilter(req.userId!, memberMailboxIds);
    const ownAddresses = await getOwnAddresses(req.userId!, memberMailboxIds);

    const { data: emails, error } = await supabaseAdmin
      .from("emails")
      .select(
        "id, sender, recipient, subject, body, status, priority, summary, project_id, created_at, shared_mailbox_id, projects(name, reference)",
      )
      .or(orFilter)
      .or(`sender.ilike.%${target}%,recipient.ilike.%${target}%`)
      .order("created_at", { ascending: false })
      .limit(MAX_EMAILS_SCAN);

    if (error) {
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
    };
    const threadMap = new Map<string, ThreadEntry>();
    const projectIds = new Set<string>();

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
        }
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
      }));

    const emailIds = matching.map((e: any) => e.id);

    const [tasksRes, apptsRes, attachRes] = await Promise.all([
      emailIds.length
        ? supabaseAdmin
            .from("tasks")
            .select("id, title, done, due_date, email_id, project_id, created_at, projects(name, reference)")
            .in("email_id", emailIds)
            .eq("user_id", req.userId!)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as any[], error: null as any }),
      emailIds.length
        ? supabaseAdmin
            .from("appointments")
            .select("id, title, location, start_at, end_at, all_day, email_id, project_id")
            .in("email_id", emailIds)
            .eq("user_id", req.userId!)
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
        .eq("user_id", req.userId!);
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
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Failed to load contact" });
  }
});

export default router;
