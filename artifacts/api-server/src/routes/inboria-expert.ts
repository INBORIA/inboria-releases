import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

const RECENT_DAYS = 30;
const MIN_SCORE = 3;

interface MemberScore {
  userId: string;
  fullName: string;
  interactionCount: number;
  lastInteractionAt: string | null;
  projectInteractionCount: number;
  matchedProjects: string[];
  score: number;
  reasons: string[];
}

function extractEmailAddress(raw: string): string {
  const s = String(raw || "").trim().toLowerCase();
  if (!s) return "";
  const angle = s.match(/<([^>]+)>/);
  if (angle && angle[1]) return angle[1].trim();
  const bare = s.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  return bare ? bare[0].trim() : s;
}

router.get("/inboria/expert-suggestion", requireAuth, async (req, res): Promise<void> => {
  try {
    const requesterId = req.userId!;
    const emailIdRaw = req.query["emailId"];
    const emailId = parseInt(String(emailIdRaw || ""), 10);
    if (Number.isNaN(emailId)) {
      res.status(400).json({ error: "emailId required" });
      return;
    }

    // Load the email and verify the requester can see it.
    const { data: email, error: emailErr } = await supabaseAdmin
      .from("emails")
      .select("id, sender, shared_mailbox_id, user_id, sent_at")
      .eq("id", emailId)
      .single();

    if (emailErr || !email) {
      res.status(404).json({ error: "Email not found" });
      return;
    }

    // Access control FIRST — never leak existence of an email the requester
    // can't see. Personal emails: requester must own. Shared emails:
    // requester must be a member of the mailbox.
    let isMember = false;
    if (email.shared_mailbox_id) {
      const { data: requesterMembership } = await supabaseAdmin
        .from("shared_mailbox_members")
        .select("user_id")
        .eq("shared_mailbox_id", email.shared_mailbox_id)
        .eq("user_id", requesterId)
        .maybeSingle();
      isMember = !!requesterMembership;
    }
    const isOwner = String(email.user_id || "") === requesterId;
    if (!isOwner && !isMember) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    if (email.sent_at) {
      // Outbound emails are not assignable.
      res.json({ suggestion: null });
      return;
    }
    if (!email.shared_mailbox_id) {
      // Personal mailbox — no team routing.
      res.json({ suggestion: null });
      return;
    }

    // Cross-user assignment of shared-mailbox emails is admin-only (see
    // POST /emails/:id/assign). Suggesting someone the requester can't
    // actually assign would 403 on click — so we hide the suggestion.
    const { data: orgMember } = await supabaseAdmin
      .from("shared_mailboxes")
      .select("organisation_id")
      .eq("id", email.shared_mailbox_id)
      .single();
    const orgId = (orgMember as any)?.organisation_id;
    if (!orgId) {
      res.json({ suggestion: null });
      return;
    }
    const { data: adminRow } = await supabaseAdmin
      .from("organisation_members")
      .select("id")
      .eq("organisation_id", orgId)
      .eq("user_id", requesterId)
      .eq("role", "admin")
      .eq("status", "active")
      .maybeSingle();
    if (!adminRow) {
      res.json({ suggestion: null });
      return;
    }

    const contactEmail = extractEmailAddress(email.sender || "");
    if (!contactEmail || !contactEmail.includes("@")) {
      res.json({ suggestion: null });
      return;
    }

    // List all active members of this shared mailbox (excluding the requester
    // — no point suggesting themselves).
    const { data: memberRows, error: memErr } = await supabaseAdmin
      .from("shared_mailbox_members")
      .select("user_id")
      .eq("shared_mailbox_id", email.shared_mailbox_id);
    if (memErr) {
      req.log.warn({ err: memErr.message }, "[inboria-expert] members fetch failed");
      res.json({ suggestion: null });
      return;
    }
    const memberIds = (memberRows || [])
      .map((r: any) => String(r.user_id))
      .filter((uid) => uid && uid !== requesterId);
    if (memberIds.length === 0) {
      res.json({ suggestion: null });
      return;
    }

    // Pull past inbound emails from this contact in this shared mailbox that
    // a team member has previously taken (claimed or assigned). One row per
    // email; we then aggregate per member.
    const { data: pastRows, error: pastErr } = await supabaseAdmin
      .from("emails")
      .select("id, claimed_by, assigned_to, created_at")
      .eq("shared_mailbox_id", email.shared_mailbox_id)
      .ilike("sender", `%${contactEmail}%`)
      .neq("id", emailId)
      .or(
        `claimed_by.in.(${memberIds.join(",")}),assigned_to.in.(${memberIds.join(",")})`,
      )
      .order("created_at", { ascending: false })
      .limit(500);

    if (pastErr) {
      req.log.warn({ err: pastErr.message }, "[inboria-expert] history fetch failed");
      res.json({ suggestion: null });
      return;
    }

    const recentCutoff = Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000;
    const tally = new Map<string, { count: number; last: number | null }>();
    for (const row of pastRows || []) {
      const handler = String(row.claimed_by || row.assigned_to || "");
      if (!handler || !memberIds.includes(handler)) continue;
      const t = row.created_at ? new Date(row.created_at).getTime() : null;
      const cur = tally.get(handler) || { count: 0, last: null };
      cur.count += 1;
      if (t !== null && (cur.last === null || t > cur.last)) cur.last = t;
      tally.set(handler, cur);
    }

    // Email Brain Phase 3 (#216) — bonus expertise projet : si ce contact
    // figure dans un projet inféré actif de la boîte, on cherche qui a déjà
    // traité d'autres mails de ce projet. Best-effort, table peut manquer.
    const projectTally = new Map<string, { count: number; projects: Set<string> }>();
    try {
      const { data: projectRows, error: projErr } = await supabaseAdmin
        .from("inboria_projects_inferred")
        .select("id, name, participants")
        .eq("shared_mailbox_id", email.shared_mailbox_id)
        .eq("status", "active")
        .contains("participants", [contactEmail])
        .limit(20);
      if (!projErr && projectRows && projectRows.length > 0) {
        const projectIds = projectRows.map((p: any) => String(p.id));
        const projectNameById = new Map<string, string>(
          projectRows.map((p: any) => [String(p.id), String(p.name || "")]),
        );
        const { data: peRows } = await supabaseAdmin
          .from("inboria_project_emails")
          .select("project_id, email_id")
          .in("project_id", projectIds)
          .limit(2000);
        const projectEmailIds = (peRows || []).map((r: any) => Number(r.email_id)).filter(Number.isFinite);
        const projectIdByEmailId = new Map<number, string>();
        for (const r of peRows || []) {
          projectIdByEmailId.set(Number(r.email_id), String(r.project_id));
        }
        if (projectEmailIds.length > 0) {
          const { data: handlerRows } = await supabaseAdmin
            .from("emails")
            .select("id, claimed_by, assigned_to")
            .in("id", projectEmailIds)
            .or(
              `claimed_by.in.(${memberIds.join(",")}),assigned_to.in.(${memberIds.join(",")})`,
            )
            .limit(2000);
          for (const row of handlerRows || []) {
            const handler = String((row as any).claimed_by || (row as any).assigned_to || "");
            if (!handler || !memberIds.includes(handler)) continue;
            const pid = projectIdByEmailId.get(Number((row as any).id));
            const pname = pid ? projectNameById.get(pid) || "" : "";
            const cur = projectTally.get(handler) || { count: 0, projects: new Set<string>() };
            cur.count += 1;
            if (pname) cur.projects.add(pname);
            projectTally.set(handler, cur);
          }
        }
      }
    } catch (err: any) {
      req.log.warn({ err: err?.message }, "[inboria-expert] project bonus failed");
    }

    // Combine candidates: contact-history members + project-history members.
    const allCandidates = new Set<string>([
      ...tally.keys(),
      ...projectTally.keys(),
    ]);
    if (allCandidates.size === 0) {
      res.json({ suggestion: null });
      return;
    }

    // Resolve names for the candidates.
    const candidateIds = Array.from(allCandidates);
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email")
      .in("id", candidateIds);
    const nameById = new Map<string, string>();
    for (const p of profiles || []) {
      const id = String((p as any).id);
      const name = String((p as any).full_name || (p as any).email || "");
      nameById.set(id, name);
    }

    const scored: MemberScore[] = [];
    for (const userId of allCandidates) {
      const t = tally.get(userId) || { count: 0, last: null };
      const pt = projectTally.get(userId) || { count: 0, projects: new Set<string>() };
      const recencyBonus = t.last !== null && t.last > recentCutoff ? 2 : 0;
      // Pondérations : contact direct = 3 pts/mail, projet inféré = 2 pts/mail.
      const score = t.count * 3 + pt.count * 2 + recencyBonus;
      const reasons: string[] = [];
      if (t.count > 0) {
        reasons.push(
          t.count === 1
            ? `1 mail déjà traité avec ce contact`
            : `${t.count} mails déjà traités avec ce contact`,
        );
      }
      if (pt.count > 0 && pt.projects.size > 0) {
        const projList = Array.from(pt.projects).slice(0, 3).join(", ");
        reasons.push(
          pt.count === 1
            ? `1 mail traité sur le projet « ${projList} »`
            : `${pt.count} mails traités sur le(s) projet(s) « ${projList} »`,
        );
      }
      if (recencyBonus > 0) {
        reasons.push(`Interaction récente (< ${RECENT_DAYS} jours)`);
      }
      scored.push({
        userId,
        fullName: nameById.get(userId) || "",
        interactionCount: t.count,
        lastInteractionAt: t.last !== null ? new Date(t.last).toISOString() : null,
        projectInteractionCount: pt.count,
        matchedProjects: Array.from(pt.projects).slice(0, 5),
        score,
        reasons,
      });
    }

    scored.sort((a, b) => b.score - a.score);
    const top = scored[0];
    if (!top || top.score < MIN_SCORE) {
      res.json({ suggestion: null });
      return;
    }

    res.json({ suggestion: top });
  } catch (err: any) {
    req.log.error({ err: err?.message }, "[inboria-expert] crashed");
    res.status(500).json({ error: "Failed to compute suggestion" });
  }
});

export default router;
