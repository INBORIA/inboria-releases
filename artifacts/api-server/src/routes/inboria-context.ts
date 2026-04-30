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

router.get("/inboria/mailbox-settings", requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = req.userId!;

    const [personalRes, memberRes] = await Promise.all([
      supabaseAdmin
        .from("email_connections")
        .select("id, email_address, provider, inboria_enabled")
        .eq("user_id", userId)
        .order("email_address", { ascending: true }),
      supabaseAdmin
        .from("shared_mailbox_members")
        .select("shared_mailbox_id")
        .eq("user_id", userId),
    ]);

    if (personalRes.error) {
      req.log.error({ err: personalRes.error.message }, "[inboria-mailbox-settings] personal query failed");
      res.status(500).json({ error: "Failed to load mailbox settings" });
      return;
    }
    if (memberRes.error) {
      req.log.error({ err: memberRes.error.message }, "[inboria-mailbox-settings] member query failed");
      res.status(500).json({ error: "Failed to load mailbox settings" });
      return;
    }

    const memberIds = (memberRes.data || []).map((r: any) => r.shared_mailbox_id).filter(Boolean);
    let sharedRows: any[] = [];
    if (memberIds.length > 0) {
      const { data, error } = await supabaseAdmin
        .from("shared_mailboxes")
        .select("id, name, email_address, inboria_enabled")
        .in("id", memberIds)
        .order("name", { ascending: true });
      if (error) {
        req.log.error({ err: error.message }, "[inboria-mailbox-settings] shared query failed");
        res.status(500).json({ error: "Failed to load mailbox settings" });
        return;
      }
      sharedRows = data || [];
    }

    const personal = (personalRes.data || []).map((r: any) => ({
      kind: "connection" as const,
      id: String(r.id),
      emailAddress: String(r.email_address || ""),
      label: String(r.email_address || ""),
      enabled: r.inboria_enabled !== false,
    }));
    const shared = sharedRows.map((r: any) => ({
      kind: "shared" as const,
      id: String(r.id),
      emailAddress: String(r.email_address || ""),
      label: String(r.name || r.email_address || ""),
      enabled: r.inboria_enabled !== false,
    }));

    res.json({ personal, shared });
  } catch (err: any) {
    req.log.error({ err: err?.message }, "[inboria-mailbox-settings] unexpected error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.patch("/inboria/mailbox-settings", requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = req.userId!;
    const kind = req.body?.kind;
    const id = String(req.body?.id || "").trim();
    const enabled = req.body?.enabled === true;
    if ((kind !== "connection" && kind !== "shared") || !id) {
      res.status(400).json({ error: "Invalid body" });
      return;
    }

    if (kind === "connection") {
      const { data: ownRow } = await supabaseAdmin
        .from("email_connections")
        .select("id, user_id, email_address")
        .eq("id", id)
        .maybeSingle();
      if (!ownRow) {
        res.status(404).json({ error: "Mailbox not found" });
        return;
      }
      if ((ownRow as any).user_id !== userId) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      const { error } = await supabaseAdmin
        .from("email_connections")
        .update({ inboria_enabled: enabled })
        .eq("id", id);
      if (error) {
        req.log.error({ err: error.message }, "[inboria-mailbox-settings] update connection failed");
        res.status(500).json({ error: "Update failed" });
        return;
      }
      res.json({
        kind: "connection",
        id,
        emailAddress: String((ownRow as any).email_address || ""),
        label: String((ownRow as any).email_address || ""),
        enabled,
      });
      return;
    }

    const { data: memberRow } = await supabaseAdmin
      .from("shared_mailbox_members")
      .select("shared_mailbox_id, role")
      .eq("user_id", userId)
      .eq("shared_mailbox_id", id)
      .maybeSingle();
    if (!memberRow) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const { data: sharedRow } = await supabaseAdmin
      .from("shared_mailboxes")
      .select("id, name, email_address")
      .eq("id", id)
      .maybeSingle();
    if (!sharedRow) {
      res.status(404).json({ error: "Mailbox not found" });
      return;
    }
    const { error } = await supabaseAdmin
      .from("shared_mailboxes")
      .update({ inboria_enabled: enabled })
      .eq("id", id);
    if (error) {
      req.log.error({ err: error.message }, "[inboria-mailbox-settings] update shared failed");
      res.status(500).json({ error: "Update failed" });
      return;
    }
    res.json({
      kind: "shared",
      id,
      emailAddress: String((sharedRow as any).email_address || ""),
      label: String((sharedRow as any).name || (sharedRow as any).email_address || ""),
      enabled,
    });
  } catch (err: any) {
    req.log.error({ err: err?.message }, "[inboria-mailbox-settings] unexpected error");
    res.status(500).json({ error: "Internal error" });
  }
});

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
