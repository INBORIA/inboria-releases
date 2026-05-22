import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth } from "../middlewares/auth";
import { createNotification, logActivity, getOrgIdForUser, getUserName } from "../lib/activity";

const router: IRouter = Router();

router.get("/emails/:emailId/comments", requireAuth, async (req, res): Promise<void> => {
  try {
    const emailId = parseInt(req.params.emailId as string, 10);
    if (isNaN(emailId)) {
      res.status(400).json({ error: "ID email invalide" });
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

    const { data: comments } = await supabaseAdmin
      .from("email_comments")
      .select("id, email_id, user_id, body, mentions, created_at, updated_at")
      .eq("email_id", emailId)
      .order("created_at", { ascending: true });

    if (!comments || comments.length === 0) {
      res.json([]);
      return;
    }

    const userIds = new Set<string>();
    for (const c of comments) {
      userIds.add(c.user_id);
      const ms: string[] = Array.isArray(c.mentions) ? c.mentions : [];
      for (const m of ms) userIds.add(m);
    }
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
      mentions: (Array.isArray(c.mentions) ? c.mentions : []).map((uid: string) => ({
        userId: uid,
        name: profileMap.get(uid) || "",
      })),
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
    const emailId = parseInt(req.params.emailId as string, 10);
    if (isNaN(emailId)) {
      res.status(400).json({ error: "ID email invalide" });
      return;
    }

    const { body, mentions } = req.body;
    if (!body || !body.trim()) {
      res.status(400).json({ error: "Le commentaire ne peut pas être vide" });
      return;
    }

    if (body.trim().startsWith("__SYS__:")) {
      res.status(400).json({ error: "Format de commentaire réservé" });
      return;
    }

    const { data: email } = await supabaseAdmin
      .from("emails")
      .select("id, user_id, shared_mailbox_id, assigned_to, subject")
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

    // Validate mentions: UUIDs from the autocomplete + loose @name/@email typed manually.
    const incomingMentions: string[] = Array.isArray(mentions)
      ? mentions.filter((m: any) => typeof m === "string" && /^[0-9a-f-]{36}$/i.test(m))
      : [];
    // Loose mentions: @word patterns in body that are NOT already UUIDs.
    const looseTokens: string[] = Array.from(
      new Set(
        Array.from(body.matchAll(/(?:^|\s)@([\p{L}0-9._-]{2,40})/gu))
          .map((m) => m[1].toLowerCase())
          .filter((tok) => !/^[0-9a-f-]{36}$/i.test(tok)),
      ),
    );
    let validatedMentions: string[] = [];
    const orgIdAuthor = await getOrgIdForUser(req.userId!);
    if (orgIdAuthor && (incomingMentions.length > 0 || looseTokens.length > 0)) {
      const { data: memberRows } = await supabaseAdmin
        .from("organisation_members")
        .select("user_id, profiles:profiles!organisation_members_user_id_fkey(id, full_name, email)")
        .eq("organisation_id", orgIdAuthor)
        .eq("status", "active");
      const memberIds = new Set<string>((memberRows || []).map((r: any) => r.user_id));
      for (const uid of incomingMentions) {
        if (memberIds.has(uid)) validatedMentions.push(uid);
      }
      if (looseTokens.length > 0) {
        for (const row of memberRows || []) {
          const prof: any = (row as any).profiles;
          if (!prof) continue;
          const uid: string = (row as any).user_id;
          if (validatedMentions.includes(uid)) continue;
          if (uid === req.userId!) continue;
          const fullName = String(prof.full_name || "").toLowerCase().trim();
          const email = String(prof.email || "").toLowerCase().trim();
          const localPart = email.split("@")[0] || "";
          const firstName = fullName.split(/\s+/)[0] || "";
          const lastName = fullName.split(/\s+/).slice(-1)[0] || "";
          const initials = fullName.split(/\s+/).filter(Boolean).map((p) => p[0]).join("");
          for (const tok of looseTokens) {
            if (
              tok === firstName ||
              tok === lastName ||
              tok === localPart ||
              tok === email ||
              tok === initials ||
              (firstName && firstName.startsWith(tok) && tok.length >= 2) ||
              (lastName && lastName.startsWith(tok) && tok.length >= 3) ||
              (localPart && localPart.startsWith(tok) && tok.length >= 2)
            ) {
              validatedMentions.push(uid);
              break;
            }
          }
        }
      }
      validatedMentions = Array.from(new Set(validatedMentions));
    }

    const { data: comment, error } = await supabaseAdmin
      .from("email_comments")
      .insert({
        email_id: emailId,
        user_id: req.userId!,
        body: body.trim(),
        mentions: validatedMentions,
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

    const rawSubject = (email.subject || "").trim();
    const subjectLabel = rawSubject ? `« ${rawSubject.slice(0, 60)}${rawSubject.length > 60 ? "…" : ""} »` : "(sans objet)";
    const noteExtract = body.trim().replace(/\s+/g, " ").slice(0, 120);

    if (email.user_id !== req.userId!) {
      createNotification({
        userId: email.user_id,
        type: "comment_added",
        title: `Nouveau commentaire — ${subjectLabel}`,
        message: `${commenterName} : "${noteExtract}"`,
        emailId,
        triggeredBy: req.userId!,
      });
    }

    if (email.assigned_to && email.assigned_to !== req.userId! && email.assigned_to !== email.user_id) {
      createNotification({
        userId: email.assigned_to,
        type: "comment_added",
        title: `Nouveau commentaire — ${subjectLabel}`,
        message: `${commenterName} : "${noteExtract}"`,
        emailId,
        triggeredBy: req.userId!,
      });
    }

    // Notify mentioned users
    for (const mUid of validatedMentions) {
      if (mUid === req.userId! || mUid === email.user_id || mUid === email.assigned_to) continue;
      createNotification({
        userId: mUid,
        type: "comment_mention",
        title: `Vous avez été mentionné — ${subjectLabel}`,
        message: `${commenterName} : "${noteExtract}"`,
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
        details: { commentId: comment.id, mentions: validatedMentions },
      });
    }

    // Build mention names for the response
    const mentionNames: { userId: string; name: string }[] = [];
    if (validatedMentions.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name")
        .in("id", validatedMentions);
      for (const p of profiles || []) {
        mentionNames.push({ userId: p.id, name: p.full_name || "" });
      }
    }

    res.status(201).json({
      id: comment.id,
      emailId: comment.email_id,
      userId: comment.user_id,
      authorName: profile?.full_name || "",
      body: comment.body,
      mentions: mentionNames,
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

    if (body.trim().startsWith("__SYS__:")) {
      res.status(400).json({ error: "Format de commentaire réservé" });
      return;
    }

    const { data: comment } = await supabaseAdmin
      .from("email_comments")
      .select("id, user_id, body")
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

    if (typeof comment.body === "string" && comment.body.startsWith("__SYS__:")) {
      res.status(403).json({ error: "Ce message système ne peut pas être modifié" });
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
      .select("id, user_id, body")
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

    if (typeof comment.body === "string" && comment.body.startsWith("__SYS__:")) {
      res.status(403).json({ error: "Ce message système ne peut pas être supprimé" });
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

async function checkEmailAccess(
  email: { user_id: string; shared_mailbox_id: string | null; assigned_to?: string | null },
  userId: string,
): Promise<boolean> {
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

export default router;
