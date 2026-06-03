import { Router, type IRouter } from "express";
import { z } from "zod";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth } from "../middlewares/auth";
import { getOrgIdForUser } from "../lib/activity";

const router: IRouter = Router();

// La table shared_drafts est créée via une migration appliquée manuellement
// (artifacts/api-server/migrations/2026_06_03_shared_drafts.sql). Tant qu'elle
// n'existe pas, on répond en mode dégradé. Cache 60s pour éviter de tester à
// chaque requête.
let draftsTableChecked = 0;
let draftsTableOk = false;
async function hasDraftsTable(): Promise<boolean> {
  const now = Date.now();
  if (draftsTableOk && now - draftsTableChecked < 60_000) return true;
  if (now - draftsTableChecked < 60_000) return draftsTableOk;
  draftsTableChecked = now;
  const { error } = await supabaseAdmin.from("shared_drafts").select("id").limit(1);
  draftsTableOk = !error;
  return draftsTableOk;
}

async function checkEmailAccess(emailId: number, userId: string): Promise<boolean> {
  const { data: email } = await supabaseAdmin
    .from("emails")
    .select("user_id, shared_mailbox_id, assigned_to")
    .eq("id", emailId)
    .single();
  if (!email) return false;
  if (email.user_id === userId) return true;
  if (email.assigned_to && email.assigned_to === userId) return true;
  if (email.shared_mailbox_id) {
    const { data: member } = await supabaseAdmin
      .from("shared_mailbox_members")
      .select("id")
      .eq("shared_mailbox_id", email.shared_mailbox_id)
      .eq("user_id", userId)
      .single();
    if (member) return true;
  }
  return false;
}

// Un brouillon est accessible si l'utilisateur est dans la même organisation ET
// (le brouillon n'est lié à aucun email -> niveau orga) OU (il a accès à l'email
// rattaché : propriétaire / assigné / membre de la boîte partagée).
async function canAccessDraft(
  draft: { organisation_id: string; email_id: number | null },
  orgId: string,
  userId: string,
): Promise<boolean> {
  if (draft.organisation_id !== orgId) return false;
  if (draft.email_id == null) return true;
  return checkEmailAccess(draft.email_id, userId);
}

function serialize(d: Record<string, unknown>) {
  return {
    id: d.id,
    organisationId: d.organisation_id,
    sharedMailboxId: d.shared_mailbox_id,
    emailId: d.email_id,
    createdBy: d.created_by,
    updatedBy: d.updated_by,
    to: d.to_addr ?? "",
    cc: d.cc_addr ?? "",
    subject: d.subject ?? "",
    body: d.body ?? "",
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  };
}

const createSchema = z.object({
  emailId: z.number().int().nullable().optional(),
  sharedMailboxId: z.string().uuid().nullable().optional(),
  to: z.string().optional(),
  cc: z.string().optional(),
  subject: z.string().optional(),
  body: z.string().optional(),
});

const updateSchema = z.object({
  to: z.string().optional(),
  cc: z.string().optional(),
  subject: z.string().optional(),
  body: z.string().optional(),
});

// GET /api/drafts?emailId=123 — brouillons accessibles de l'organisation.
router.get("/drafts", requireAuth, async (req, res): Promise<void> => {
  try {
    if (!(await hasDraftsTable())) {
      res.json([]);
      return;
    }
    const orgId = await getOrgIdForUser(req.userId!);
    if (!orgId) {
      res.json([]);
      return;
    }
    let q = supabaseAdmin
      .from("shared_drafts")
      .select("*")
      .eq("organisation_id", orgId);
    const emailIdRaw = req.query.emailId;
    if (emailIdRaw !== undefined) {
      const emailId = parseInt(String(emailIdRaw), 10);
      if (!isNaN(emailId)) q = q.eq("email_id", emailId);
    }
    const { data, error } = await q.order("updated_at", { ascending: false });
    if (error) throw error;
    // Filtrage par accès email (on ne renvoie jamais un brouillon dont l'email
    // n'est pas accessible à l'utilisateur).
    const accessible = [];
    for (const d of data || []) {
      if (await canAccessDraft(d, orgId, req.userId!)) accessible.push(serialize(d));
    }
    res.json(accessible);
  } catch (err) {
    req.log.error({ err }, "drafts:list failed");
    res.status(500).json({ error: "Erreur lors de la récupération des brouillons" });
  }
});

// GET /api/drafts/:id
router.get("/drafts/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    if (!(await hasDraftsTable())) {
      res.status(404).json({ error: "Brouillon introuvable" });
      return;
    }
    const orgId = await getOrgIdForUser(req.userId!);
    const { data, error } = await supabaseAdmin
      .from("shared_drafts")
      .select("*")
      .eq("id", req.params.id)
      .single();
    if (error || !data) {
      res.status(404).json({ error: "Brouillon introuvable" });
      return;
    }
    if (!orgId || !(await canAccessDraft(data, orgId, req.userId!))) {
      res.status(403).json({ error: "Accès refusé" });
      return;
    }
    res.json(serialize(data));
  } catch (err) {
    req.log.error({ err }, "drafts:get failed");
    res.status(500).json({ error: "Erreur lors de la récupération du brouillon" });
  }
});

// POST /api/drafts — idempotent par (organisation, email) : renvoie le brouillon
// existant si présent (et en cas de course, retombe sur le gagnant via 23505).
router.post("/drafts", requireAuth, async (req, res): Promise<void> => {
  try {
    if (!(await hasDraftsTable())) {
      res.status(503).json({ error: "Brouillons partagés indisponibles (migration non appliquée)" });
      return;
    }
    const orgId = await getOrgIdForUser(req.userId!);
    if (!orgId) {
      res.status(403).json({ error: "Aucune organisation" });
      return;
    }
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Données invalides" });
      return;
    }
    const b = parsed.data;
    if (b.emailId != null) {
      const ok = await checkEmailAccess(b.emailId, req.userId!);
      if (!ok) {
        res.status(403).json({ error: "Accès refusé" });
        return;
      }
      // Brouillon déjà existant pour cet email → on le renvoie (co-rédaction).
      const { data: existing } = await supabaseAdmin
        .from("shared_drafts")
        .select("*")
        .eq("organisation_id", orgId)
        .eq("email_id", b.emailId)
        .maybeSingle();
      if (existing) {
        res.status(200).json(serialize(existing));
        return;
      }
    }
    const { data, error } = await supabaseAdmin
      .from("shared_drafts")
      .insert({
        organisation_id: orgId,
        shared_mailbox_id: b.sharedMailboxId ?? null,
        email_id: b.emailId ?? null,
        created_by: req.userId!,
        updated_by: req.userId!,
        to_addr: b.to ?? "",
        cc_addr: b.cc ?? "",
        subject: b.subject ?? "",
        body: b.body ?? "",
      })
      .select("*")
      .single();
    if (error) {
      // Course d'activation simultanée : l'index unique a rejeté ce doublon.
      // On récupère le brouillon gagnant pour que les deux clients convergent.
      if ((error as { code?: string }).code === "23505" && b.emailId != null) {
        const { data: again } = await supabaseAdmin
          .from("shared_drafts")
          .select("*")
          .eq("organisation_id", orgId)
          .eq("email_id", b.emailId)
          .maybeSingle();
        if (again) {
          res.status(200).json(serialize(again));
          return;
        }
      }
      throw error;
    }
    res.status(201).json(serialize(data));
  } catch (err) {
    req.log.error({ err }, "drafts:create failed");
    res.status(500).json({ error: "Erreur lors de la création du brouillon" });
  }
});

// PATCH /api/drafts/:id
router.patch("/drafts/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    if (!(await hasDraftsTable())) {
      res.status(404).json({ error: "Brouillon introuvable" });
      return;
    }
    const orgId = await getOrgIdForUser(req.userId!);
    const { data: existing } = await supabaseAdmin
      .from("shared_drafts")
      .select("organisation_id, email_id")
      .eq("id", req.params.id)
      .single();
    if (!existing) {
      res.status(404).json({ error: "Brouillon introuvable" });
      return;
    }
    if (!orgId || !(await canAccessDraft(existing, orgId, req.userId!))) {
      res.status(403).json({ error: "Accès refusé" });
      return;
    }
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Données invalides" });
      return;
    }
    const b = parsed.data;
    const patch: Record<string, unknown> = {
      updated_by: req.userId!,
      updated_at: new Date().toISOString(),
    };
    if (b.to !== undefined) patch.to_addr = b.to;
    if (b.cc !== undefined) patch.cc_addr = b.cc;
    if (b.subject !== undefined) patch.subject = b.subject;
    if (b.body !== undefined) patch.body = b.body;
    const { data, error } = await supabaseAdmin
      .from("shared_drafts")
      .update(patch)
      .eq("id", req.params.id)
      .select("*")
      .single();
    if (error) throw error;
    res.json(serialize(data));
  } catch (err) {
    req.log.error({ err }, "drafts:update failed");
    res.status(500).json({ error: "Erreur lors de la mise à jour du brouillon" });
  }
});

// DELETE /api/drafts/:id
router.delete("/drafts/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    if (!(await hasDraftsTable())) {
      res.status(204).end();
      return;
    }
    const orgId = await getOrgIdForUser(req.userId!);
    const { data: existing } = await supabaseAdmin
      .from("shared_drafts")
      .select("organisation_id, email_id")
      .eq("id", req.params.id)
      .single();
    if (!existing) {
      res.status(204).end();
      return;
    }
    if (!orgId || !(await canAccessDraft(existing, orgId, req.userId!))) {
      res.status(403).json({ error: "Accès refusé" });
      return;
    }
    await supabaseAdmin.from("shared_drafts").delete().eq("id", req.params.id);
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "drafts:delete failed");
    res.status(500).json({ error: "Erreur lors de la suppression du brouillon" });
  }
});

export default router;
