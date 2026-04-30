import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth } from "../middlewares/auth";
import { getMemberMailboxIds } from "../lib/inbox-scope";

const router: IRouter = Router();

function normalizeEmail(raw: unknown): string {
  return decodeURIComponent(String(raw || "")).trim().toLowerCase();
}

function buildInboriaScopeFilter(userId: string, memberMailboxIds: string[]): string {
  const personal = `and(user_id.eq.${userId},shared_mailbox_id.is.null)`;
  const parts = [personal];
  if (memberMailboxIds.length > 0) {
    parts.push(`shared_mailbox_id.in.(${memberMailboxIds.join(",")})`);
  }
  return parts.join(",");
}

router.get("/inboria/context", requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = req.userId!;
    const contactEmail = normalizeEmail(req.query.contactEmail);
    if (!contactEmail || !contactEmail.includes("@")) {
      res.status(400).json({ error: "Invalid contactEmail" });
      return;
    }
    const rawLimit = Number(req.query.limit ?? 10);
    const limit = Math.min(50, Math.max(1, Number.isFinite(rawLimit) ? rawLimit : 10));

    const memberMailboxIds = await getMemberMailboxIds(userId);
    const scopeFilter = buildInboriaScopeFilter(userId, memberMailboxIds);

    const [factsRes, episodesRes] = await Promise.all([
      supabaseAdmin
        .from("inboria_facts")
        .select("id, contact_email, kind, statement, confidence, extracted_at, source_email_id")
        .eq("contact_email", contactEmail)
        .or(scopeFilter)
        .order("extracted_at", { ascending: false })
        .limit(limit),
      supabaseAdmin
        .from("inboria_episodes")
        .select("id, contact_email, kind, summary, event_date, extracted_at, source_email_id")
        .eq("contact_email", contactEmail)
        .or(scopeFilter)
        .order("extracted_at", { ascending: false })
        .limit(limit),
    ]);

    if (factsRes.error) {
      req.log.error({ err: factsRes.error.message }, "[inboria-context] facts query failed");
      res.status(500).json({ error: "Failed to load Inboria context" });
      return;
    }
    if (episodesRes.error) {
      req.log.error({ err: episodesRes.error.message }, "[inboria-context] episodes query failed");
      res.status(500).json({ error: "Failed to load Inboria context" });
      return;
    }

    const sourceIds = new Set<number>();
    for (const r of factsRes.data || []) sourceIds.add(Number(r.source_email_id));
    for (const r of episodesRes.data || []) sourceIds.add(Number(r.source_email_id));

    let sourcesById = new Map<number, { subject: string | null; sentAt: string | null }>();
    if (sourceIds.size > 0) {
      const { data: emails } = await supabaseAdmin
        .from("emails")
        .select("id, subject, created_at")
        .in("id", Array.from(sourceIds));
      for (const e of emails || []) {
        sourcesById.set(Number(e.id), {
          subject: (e as any).subject ?? null,
          sentAt: (e as any).created_at ?? null,
        });
      }
    }

    const facts = (factsRes.data || []).map((r: any) => ({
      id: String(r.id),
      contactEmail: String(r.contact_email),
      kind: String(r.kind),
      statement: String(r.statement),
      confidence: Number(r.confidence),
      extractedAt: String(r.extracted_at),
      source: {
        emailId: Number(r.source_email_id),
        subject: sourcesById.get(Number(r.source_email_id))?.subject ?? null,
        sentAt: sourcesById.get(Number(r.source_email_id))?.sentAt ?? null,
      },
    }));

    const episodes = (episodesRes.data || []).map((r: any) => ({
      id: String(r.id),
      contactEmail: String(r.contact_email),
      kind: String(r.kind),
      summary: String(r.summary),
      eventDate: r.event_date ?? null,
      extractedAt: String(r.extracted_at),
      source: {
        emailId: Number(r.source_email_id),
        subject: sourcesById.get(Number(r.source_email_id))?.subject ?? null,
        sentAt: sourcesById.get(Number(r.source_email_id))?.sentAt ?? null,
      },
    }));

    res.json({ contactEmail, facts, episodes });
  } catch (err: any) {
    req.log.error({ err: err?.message }, "[inboria-context] unexpected error");
    res.status(500).json({ error: "Internal error" });
  }
});

export default router;
