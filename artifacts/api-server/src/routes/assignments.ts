import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth } from "../middlewares/auth";
import { createNotification, logActivity, getOrgIdForUser, getUserName } from "../lib/activity";

const router: IRouter = Router();

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
    const emailId = parseInt(req.params.emailId, 10);
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
      .select("id, user_id")
      .eq("id", emailId)
      .single();

    if (!email) {
      res.status(404).json({ error: "Email introuvable" });
      return;
    }

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

    const { error } = await supabaseAdmin
      .from("emails")
      .update({
        assigned_to: assignTo,
        assigned_at: new Date().toISOString(),
      })
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
    const { data: emailSubject } = await supabaseAdmin
      .from("emails")
      .select("subject")
      .eq("id", emailId)
      .single();

    createNotification({
      userId: assignTo,
      type: "email_assigned",
      title: "Email assigné",
      message: `${assignerName} vous a assigné: "${emailSubject?.subject || "Sans sujet"}"`,
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
    const emailId = parseInt(req.params.emailId, 10);
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
      .select("id, user_id, assigned_to")
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

    const { error } = await supabaseAdmin
      .from("emails")
      .update({ assigned_to: null, assigned_at: null })
      .eq("id", emailId);

    if (error) {
      res.status(500).json({ error: "Erreur lors du retrait de l'assignation" });
      return;
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
