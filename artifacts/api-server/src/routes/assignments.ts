import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth } from "../middlewares/auth";
import { createNotification, logActivity, getUserName } from "../lib/activity";

const router: IRouter = Router();

// Préfixe-sentinelle pour les "bulles système" du chat équipe.
// Le body d'un email_comment commence par ce préfixe + un JSON sérialisé
// décrivant l'événement. Le frontend reconnaît ce marqueur et rend
// la bulle d'une manière distincte (centrée, sans avatar). Permet
// d'ajouter ce nouveau type de message sans migrer le schéma.
const SYS_PREFIX = "__SYS__:";

type SysEvent =
  | { event: "assign"; actor: string; actorName: string; target: string; targetName: string; selfAssign?: boolean }
  | { event: "reassign"; actor: string; actorName: string; previous: string; previousName: string; target: string; targetName: string }
  | { event: "unassign"; actor: string; actorName: string; previous: string; previousName: string };

async function insertSystemComment(emailId: number, actorUserId: string, payload: SysEvent) {
  try {
    await supabaseAdmin.from("email_comments").insert({
      email_id: emailId,
      user_id: actorUserId,
      body: SYS_PREFIX + JSON.stringify(payload),
      mentions: [],
    });
  } catch (e) {
    console.error("Failed to insert system comment:", e);
  }
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

router.post("/emails/:emailId/assign", requireAuth, async (req, res): Promise<void> => {
  try {
    const emailId = parseInt(req.params.emailId as string, 10);
    if (isNaN(emailId)) {
      res.status(400).json({ error: "ID email invalide" });
      return;
    }

    const { assignTo } = req.body;
    if (!assignTo) {
      res.status(400).json({ error: "assignTo requis" });
      return;
    }

    const orgId = await getOrgIdForMember(req.userId!);
    if (!orgId) {
      res.status(403).json({ error: "Vous devez faire partie d'une organisation" });
      return;
    }

    const { data: targetMember } = await supabaseAdmin
      .from("organisation_members")
      .select("id")
      .eq("organisation_id", orgId)
      .eq("user_id", assignTo)
      .eq("status", "active")
      .single();

    if (!targetMember) {
      res.status(400).json({ error: "L'utilisateur cible ne fait pas partie de votre organisation" });
      return;
    }

    const { data: email } = await supabaseAdmin
      .from("emails")
      .select("id, user_id, shared_mailbox_id, assigned_to")
      .eq("id", emailId)
      .single();

    if (!email) {
      res.status(404).json({ error: "Email introuvable" });
      return;
    }

    const previousAssignee: string | null = (email as any).assigned_to || null;

    const { data: emailOwnerOrg } = await supabaseAdmin
      .from("organisation_members")
      .select("id")
      .eq("organisation_id", orgId)
      .eq("user_id", email.user_id)
      .eq("status", "active")
      .single();

    if (!emailOwnerOrg && email.user_id !== req.userId!) {
      res.status(403).json({ error: "Vous n'avez pas acces a cet email" });
      return;
    }

    // For shared mailbox emails, only an admin of the owning org can
    // assign to a different user (manager-assign). Self-assign is allowed.
    if (email.shared_mailbox_id && assignTo !== req.userId!) {
      const { data: requesterMember } = await supabaseAdmin
        .from("organisation_members")
        .select("id")
        .eq("organisation_id", orgId)
        .eq("user_id", req.userId!)
        .eq("role", "admin")
        .eq("status", "active")
        .single();
      if (!requesterMember) {
        res.status(403).json({ error: "Seul un administrateur peut assigner un email partagé à un collègue" });
        return;
      }
    }

    const updates: Record<string, unknown> = {
      assigned_to: assignTo,
      assigned_at: new Date().toISOString(),
    };
    // For shared mailbox emails, manager-assign auto-claims for the assignee:
    // the assignee becomes the active owner so the email leaves the
    // "unclaimed" pool and appears in their inbox as taken-care-of.
    if (email.shared_mailbox_id) {
      updates.claimed_by = assignTo;
      updates.claimed_at = new Date().toISOString();
    }

    const { error } = await supabaseAdmin
      .from("emails")
      .update(updates)
      .eq("id", emailId);

    if (error) {
      console.error("Failed to assign email:", error);
      res.status(500).json({ error: "Erreur lors de l'assignation" });
      return;
    }

    const { data: assigneeProfile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", assignTo)
      .single();

    const assignerName = await getUserName(req.userId!);
    const assigneeName = assigneeProfile?.full_name || (await getUserName(assignTo));
    const { data: emailSubject } = await supabaseAdmin
      .from("emails")
      .select("subject")
      .eq("id", emailId)
      .single();

    // Bulle système dans le Chat équipe : assignation ou réassignation.
    if (previousAssignee && previousAssignee !== assignTo) {
      const previousName = await getUserName(previousAssignee);
      await insertSystemComment(emailId, req.userId!, {
        event: "reassign",
        actor: req.userId!,
        actorName: assignerName,
        previous: previousAssignee,
        previousName,
        target: assignTo,
        targetName: assigneeName,
      });
    } else if (!previousAssignee) {
      await insertSystemComment(emailId, req.userId!, {
        event: "assign",
        actor: req.userId!,
        actorName: assignerName,
        target: assignTo,
        targetName: assigneeName,
        selfAssign: assignTo === req.userId!,
      });
    }

    // Notification in-app enrichie : on invite explicitement à ouvrir le
    // chat équipe (au lieu de la simple "vous a assigné: ...").
    createNotification({
      userId: assignTo,
      type: "email_assigned",
      title: "Email assigné · Chat équipe ouvert",
      message: `${assignerName} vous a assigné « ${emailSubject?.subject || "Sans sujet"} » · cliquer pour ouvrir le chat équipe`,
      emailId,
      triggeredBy: req.userId!,
    });

    logActivity({
      organisationId: orgId,
      userId: req.userId!,
      action: "assign_email",
      entityType: "email",
      entityId: String(emailId),
      details: { assignedTo: assignTo, assignedToName: assigneeProfile?.full_name || "" },
    });

    res.json({
      success: true,
      assignedTo: assignTo,
      assignedToName: assigneeProfile?.full_name || "",
      assignedAt: new Date().toISOString(),
    });
  } catch {
    res.status(500).json({ error: "Erreur lors de l'assignation" });
  }
});

router.post("/emails/:emailId/unassign", requireAuth, async (req, res): Promise<void> => {
  try {
    const emailId = parseInt(req.params.emailId as string, 10);
    if (isNaN(emailId)) {
      res.status(400).json({ error: "ID email invalide" });
      return;
    }

    const orgId = await getOrgIdForMember(req.userId!);
    if (!orgId) {
      res.status(403).json({ error: "Vous devez faire partie d'une organisation" });
      return;
    }

    const { data: email } = await supabaseAdmin
      .from("emails")
      .select("id, user_id, assigned_to, shared_mailbox_id, claimed_by")
      .eq("id", emailId)
      .single();

    if (!email) {
      res.status(404).json({ error: "Email introuvable" });
      return;
    }

    const { data: emailOwnerOrg } = await supabaseAdmin
      .from("organisation_members")
      .select("organisation_id")
      .eq("user_id", email.user_id)
      .eq("status", "active")
      .single();

    if (!emailOwnerOrg || emailOwnerOrg.organisation_id !== orgId) {
      res.status(403).json({ error: "Vous n'avez pas accès à cet email" });
      return;
    }

    if (email.assigned_to !== req.userId! && email.user_id !== req.userId!) {
      const { data: isAdmin } = await supabaseAdmin
        .from("organisation_members")
        .select("id")
        .eq("organisation_id", orgId)
        .eq("user_id", req.userId!)
        .eq("role", "admin")
        .single();

      if (!isAdmin) {
        res.status(403).json({ error: "Seul l'assigné, le propriétaire ou un admin peut retirer l'assignation" });
        return;
      }
    }

    const previousAssignee: string | null = email.assigned_to || null;

    const unassignUpdates: Record<string, unknown> = { assigned_to: null, assigned_at: null };
    // For shared mailbox emails, releasing assignment also releases the
    // implicit claim, so the email returns to the "unclaimed" pool.
    if (email.shared_mailbox_id && email.claimed_by === email.assigned_to) {
      unassignUpdates.claimed_by = null;
      unassignUpdates.claimed_at = null;
    }

    const { error } = await supabaseAdmin
      .from("emails")
      .update(unassignUpdates)
      .eq("id", emailId);

    if (error) {
      res.status(500).json({ error: "Erreur lors du retrait de l'assignation" });
      return;
    }

    if (previousAssignee) {
      const actorName = await getUserName(req.userId!);
      const previousName = await getUserName(previousAssignee);
      await insertSystemComment(emailId, req.userId!, {
        event: "unassign",
        actor: req.userId!,
        actorName,
        previous: previousAssignee,
        previousName,
      });
    }

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Erreur lors du retrait de l'assignation" });
  }
});

router.get("/emails/assigned-to-me", requireAuth, async (req, res): Promise<void> => {
  try {
    const { data: emails, error } = await supabaseAdmin
      .from("emails")
      .select("id, sender, subject, body, status, priority, summary, category_id, project_id, assigned_to, assigned_at, created_at, categories(name), projects(name, reference)")
      .eq("assigned_to", req.userId!)
      .neq("status", "supprime")
      .order("assigned_at", { ascending: false });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    const enriched = (emails || []).map((e: any) => {
      const senderRaw = e.sender || "";
      const match = senderRaw.match(/^(.+?)\s*<(.+?)>$/);
      const senderName = match ? match[1].trim().replace(/^"|"$/g, "") : senderRaw;
      const senderEmail = match ? match[2].trim() : senderRaw;

      return {
        id: e.id,
        sender: senderName,
        senderEmail,
        subject: e.subject,
        body: e.body,
        status: e.status,
        priority: e.priority || "faible",
        summary: e.summary,
        categoryId: e.category_id,
        categoryName: e.categories?.name || null,
        projectId: e.project_id,
        projectName: e.projects?.name || null,
        projectReference: e.projects?.reference || null,
        assignedTo: e.assigned_to,
        assignedAt: e.assigned_at,
        createdAt: e.created_at,
      };
    });

    res.json(enriched);
  } catch {
    res.status(500).json({ error: "Erreur lors de la récupération des emails assignés" });
  }
});

export default router;
