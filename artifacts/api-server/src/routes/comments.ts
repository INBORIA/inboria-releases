import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth } from "../middlewares/auth";
import { createNotification, logActivity, getOrgIdForUser, getUserName } from "../lib/activity";

const router: IRouter = Router();

router.get("/emails/:emailId/comments", requireAuth, async (req, res): Promise<void> => {
  try {
    const emailId = parseInt(req.params.emailId, 10);
    if (isNaN(emailId)) {
      res.status(400).json({ error: "ID email invalide" });
      return;
    }

    const { data: email } = await supabaseAdmin
      .from("emails")
      .select("id, user_id, shared_mailbox_id")
      .eq("id", emailId)
      .single();

    if (!email) {
      res.status(404).json({ error: "Email introuvable" });
      return;
    }

    const hasAccess = await checkEmailAccess(email, req.userId!);
    if (!hasAccess) {
      res.status(403).json({ error: "Accès refusé" });
      return;
    }

    const { data: comments } = await supabaseAdmin
      .from("email_comments")
      .select("id, email_id, user_id, body, created_at, updated_at")
      .eq("email_id", emailId)
      .order("created_at", { ascending: true });

    if (!comments || comments.length === 0) {
      res.json([]);
      return;
    }

    const userIds = [...new Set(comments.map(c => c.user_id))];
    const profileMap = new Map<string, string>();

    for (const uid of userIds) {
      const { data: p } = await supabaseAdmin
        .from("profiles")
        .select("full_name")
        .eq("id", uid)
        .single();
      if (p) profileMap.set(uid, p.full_name || "");
    }

    const enriched = comments.map(c => ({
      id: c.id,
      emailId: c.email_id,
      userId: c.user_id,
      authorName: profileMap.get(c.user_id) || "",
      body: c.body,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    }));

    res.json(enriched);
  } catch {
    res.status(500).json({ error: "Erreur lors de la récupération des commentaires" });
  }
});

router.post("/emails/:emailId/comments", requireAuth, async (req, res): Promise<void> => {
  try {
    const emailId = parseInt(req.params.emailId, 10);
    if (isNaN(emailId)) {
      res.status(400).json({ error: "ID email invalide" });
      return;
    }

    const { body } = req.body;
    if (!body || !body.trim()) {
      res.status(400).json({ error: "Le commentaire ne peut pas être vide" });
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

    const hasAccess = await checkEmailAccess(email, req.userId!);
    if (!hasAccess) {
      res.status(403).json({ error: "Accès refusé" });
      return;
    }

    const { data: comment, error } = await supabaseAdmin
      .from("email_comments")
      .insert({
        email_id: emailId,
        user_id: req.userId!,
        body: body.trim(),
      })
      .select()
      .single();

    if (error || !comment) {
      console.error("Failed to create comment:", error);
      res.status(500).json({ error: "Erreur lors de la création du commentaire" });
      return;
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", req.userId!)
      .single();

    const commenterName = profile?.full_name || await getUserName(req.userId!);
    const orgId = await getOrgIdForUser(req.userId!);

    if (email.user_id !== req.userId!) {
      createNotification({
        userId: email.user_id,
        type: "comment_added",
        title: "Nouveau commentaire",
        message: `${commenterName} a commenté un email: "${body.trim().slice(0, 80)}"`,
        emailId,
        triggeredBy: req.userId!,
      });
    }

    if (email.assigned_to && email.assigned_to !== req.userId! && email.assigned_to !== email.user_id) {
      createNotification({
        userId: email.assigned_to,
        type: "comment_added",
        title: "Nouveau commentaire",
        message: `${commenterName} a commenté un email qui vous est assigné`,
        emailId,
        triggeredBy: req.userId!,
      });
    }

    if (orgId && (email.shared_mailbox_id || email.assigned_to)) {
      logActivity({
        organisationId: orgId,
        userId: req.userId!,
        action: "add_comment",
        entityType: "email",
        entityId: String(emailId),
        details: { commentId: comment.id },
      });
    }

    res.status(201).json({
      id: comment.id,
      emailId: comment.email_id,
      userId: comment.user_id,
      authorName: profile?.full_name || "",
      body: comment.body,
      createdAt: comment.created_at,
      updatedAt: comment.updated_at,
    });
  } catch {
    res.status(500).json({ error: "Erreur lors de la création du commentaire" });
  }
});

router.put("/emails/:emailId/comments/:commentId", requireAuth, async (req, res): Promise<void> => {
  try {
    const { body } = req.body;
    if (!body || !body.trim()) {
      res.status(400).json({ error: "Le commentaire ne peut pas être vide" });
      return;
    }

    const { data: comment } = await supabaseAdmin
      .from("email_comments")
      .select("id, user_id")
      .eq("id", req.params.commentId)
      .single();

    if (!comment) {
      res.status(404).json({ error: "Commentaire introuvable" });
      return;
    }

    if (comment.user_id !== req.userId!) {
      res.status(403).json({ error: "Vous ne pouvez modifier que vos propres commentaires" });
      return;
    }

    const { error } = await supabaseAdmin
      .from("email_comments")
      .update({ body: body.trim(), updated_at: new Date().toISOString() })
      .eq("id", comment.id);

    if (error) {
      res.status(500).json({ error: "Erreur lors de la mise à jour" });
      return;
    }

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Erreur lors de la mise à jour du commentaire" });
  }
});

router.delete("/emails/:emailId/comments/:commentId", requireAuth, async (req, res): Promise<void> => {
  try {
    const { data: comment } = await supabaseAdmin
      .from("email_comments")
      .select("id, user_id")
      .eq("id", req.params.commentId)
      .single();

    if (!comment) {
      res.status(404).json({ error: "Commentaire introuvable" });
      return;
    }

    if (comment.user_id !== req.userId!) {
      res.status(403).json({ error: "Vous ne pouvez supprimer que vos propres commentaires" });
      return;
    }

    await supabaseAdmin
      .from("email_comments")
      .delete()
      .eq("id", comment.id);

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Erreur lors de la suppression du commentaire" });
  }
});

async function checkEmailAccess(email: { user_id: string; shared_mailbox_id: string | null }, userId: string): Promise<boolean> {
  if (email.user_id === userId) return true;

  if (email.shared_mailbox_id) {
    const { data: member } = await supabaseAdmin
      .from("shared_mailbox_members")
      .select("id")
      .eq("shared_mailbox_id", email.shared_mailbox_id)
      .eq("user_id", userId)
      .single();

    if (member) return true;
  }

  const { data: orgMember } = await supabaseAdmin
    .from("organisation_members")
    .select("organisation_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .single();

  if (orgMember) {
    const { data: emailOwnerOrg } = await supabaseAdmin
      .from("organisation_members")
      .select("organisation_id")
      .eq("user_id", email.user_id)
      .eq("organisation_id", orgMember.organisation_id)
      .eq("status", "active")
      .single();

    if (emailOwnerOrg) return true;
  }

  return false;
}

export default router;
