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
  score: number;
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

    if (tally.size === 0) {
      res.json({ suggestion: null });
      return;
    }

    // Resolve names for the candidates.
    const candidateIds = Array.from(tally.keys());
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
    for (const [userId, t] of tally.entries()) {
      const recencyBonus = t.last !== null && t.last > recentCutoff ? 2 : 0;
      const score = t.count * 3 + recencyBonus;
      scored.push({
        userId,
        fullName: nameById.get(userId) || "",
        interactionCount: t.count,
        lastInteractionAt: t.last !== null ? new Date(t.last).toISOString() : null,
        score,
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
