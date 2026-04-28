import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

async function getOrgIdForAdmin(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("organisation_members")
    .select("organisation_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .eq("role", "admin")
    .single();
  return data?.organisation_id || null;
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

router.get("/sla/policies", requireAuth, async (req, res): Promise<void> => {
  try {
    const orgId = await getOrgIdForMember(req.userId!);
    if (!orgId) { res.json([]); return; }

    const { data: mailboxes } = await supabaseAdmin
      .from("shared_mailboxes")
      .select("id, name, email_address")
      .eq("organisation_id", orgId);

    const { data: policies } = await supabaseAdmin
      .from("sla_policies")
      .select("id, shared_mailbox_id, target_minutes, business_hours, escalation, enabled, created_at, updated_at")
      .eq("organisation_id", orgId);

    const policyMap = new Map<string, any>((policies || []).map((p: any) => [p.shared_mailbox_id, p]));

    const result = (mailboxes || []).map((mb: any) => {
      const p = policyMap.get(mb.id);
      return {
        sharedMailboxId: mb.id,
        mailboxName: mb.name,
        mailboxEmail: mb.email_address,
        policy: p ? {
          id: p.id,
          targetMinutes: p.target_minutes,
          businessHours: p.business_hours,
          escalation: p.escalation,
          enabled: p.enabled,
          createdAt: p.created_at,
          updatedAt: p.updated_at,
        } : null,
      };
    });

    res.json(result);
  } catch {
    res.status(500).json({ error: "Erreur lors de la récupération des SLA" });
  }
});

router.put("/sla/policies/:mailboxId", requireAuth, async (req, res): Promise<void> => {
  try {
    const orgId = await getOrgIdForAdmin(req.userId!);
    if (!orgId) {
      res.status(403).json({ error: "Accès réservé aux administrateurs" });
      return;
    }

    const { data: mb } = await supabaseAdmin
      .from("shared_mailboxes")
      .select("id, organisation_id")
      .eq("id", req.params.mailboxId)
      .single();
    if (!mb || mb.organisation_id !== orgId) {
      res.status(404).json({ error: "Boîte introuvable" });
      return;
    }

    const { targetMinutes, businessHours, escalation, enabled } = req.body || {};
    if (targetMinutes !== undefined && (typeof targetMinutes !== "number" || targetMinutes < 5 || targetMinutes > 10080)) {
      res.status(400).json({ error: "targetMinutes doit être entre 5 et 10080" });
      return;
    }

    const payload: any = {
      shared_mailbox_id: mb.id,
      organisation_id: orgId,
      updated_at: new Date().toISOString(),
    };
    if (targetMinutes !== undefined) payload.target_minutes = targetMinutes;
    if (businessHours !== undefined) payload.business_hours = businessHours;
    if (escalation !== undefined) payload.escalation = escalation;
    if (enabled !== undefined) payload.enabled = enabled;

    const { data: existing } = await supabaseAdmin
      .from("sla_policies")
      .select("id")
      .eq("shared_mailbox_id", mb.id)
      .maybeSingle();

    if (existing) {
      const { data, error } = await supabaseAdmin
        .from("sla_policies")
        .update(payload)
        .eq("id", existing.id)
        .select()
        .single();
      if (error) { res.status(500).json({ error: error.message }); return; }
      res.json(data);
    } else {
      payload.target_minutes = payload.target_minutes ?? 240;
      payload.business_hours = payload.business_hours ?? { timezone: "Europe/Brussels", days: [1, 2, 3, 4, 5], start: "09:00", end: "18:00" };
      payload.escalation = payload.escalation ?? { email: true };
      payload.enabled = payload.enabled ?? true;
      const { data, error } = await supabaseAdmin
        .from("sla_policies")
        .insert(payload)
        .select()
        .single();
      if (error) { res.status(500).json({ error: error.message }); return; }
      res.json(data);
    }
  } catch {
    res.status(500).json({ error: "Erreur lors de la mise à jour de la SLA" });
  }
});

router.delete("/sla/policies/:mailboxId", requireAuth, async (req, res): Promise<void> => {
  try {
    const orgId = await getOrgIdForAdmin(req.userId!);
    if (!orgId) {
      res.status(403).json({ error: "Accès réservé aux administrateurs" });
      return;
    }
    await supabaseAdmin
      .from("sla_policies")
      .delete()
      .eq("shared_mailbox_id", req.params.mailboxId)
      .eq("organisation_id", orgId);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Erreur lors de la suppression" });
  }
});

router.get("/sla/breaches", requireAuth, async (req, res): Promise<void> => {
  try {
    const orgId = await getOrgIdForMember(req.userId!);
    if (!orgId) { res.json([]); return; }

    const { data: mailboxes } = await supabaseAdmin
      .from("shared_mailboxes")
      .select("id, name, email_address")
      .eq("organisation_id", orgId);
    const mbIds = (mailboxes || []).map((m: any) => m.id);
    if (mbIds.length === 0) { res.json([]); return; }

    const { data: breaches } = await supabaseAdmin
      .from("sla_breaches")
      .select("id, shared_mailbox_id, email_id, assigned_to, target_minutes, elapsed_minutes, detected_at, resolved_at")
      .in("shared_mailbox_id", mbIds)
      .order("detected_at", { ascending: false })
      .limit(200);

    const mbMap = new Map((mailboxes || []).map((m: any) => [m.id, m]));
    const emailIds = (breaches || []).map((b: any) => b.email_id);

    const { data: emailRows } = emailIds.length > 0
      ? await supabaseAdmin.from("emails").select("id, subject, sender, status").in("id", emailIds)
      : { data: [] as any[] };
    const emailMap = new Map((emailRows || []).map((e: any) => [e.id, e]));

    res.json((breaches || []).map((b: any) => {
      const mb: any = mbMap.get(b.shared_mailbox_id);
      const e: any = emailMap.get(b.email_id);
      return {
        id: b.id,
        emailId: b.email_id,
        subject: e?.subject || "",
        sender: e?.sender || "",
        emailStatus: e?.status || null,
        sharedMailboxId: b.shared_mailbox_id,
        mailboxName: mb?.name || "",
        mailboxEmail: mb?.email_address || "",
        assignedTo: b.assigned_to,
        targetMinutes: b.target_minutes,
        elapsedMinutes: b.elapsed_minutes,
        detectedAt: b.detected_at,
        resolvedAt: b.resolved_at,
      };
    }));
  } catch {
    res.status(500).json({ error: "Erreur lors de la récupération des dépassements SLA" });
  }
});

export default router;
