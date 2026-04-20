import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

function mapTask(t: any) {
  const senderRaw = t.emails?.sender || "";
  const senderMatch = senderRaw.match(/^(.+?)\s*<(.+?)>$/);
  const senderName = senderMatch ? senderMatch[1].trim().replace(/^"|"$/g, "") : senderRaw;
  const senderEmail = senderMatch ? senderMatch[2].trim() : senderRaw;

  const source = t.email_id ? "ai" : "manual";

  return {
    id: t.id,
    title: t.title,
    done: t.done,
    status: t.done ? "done" : "todo",
    source,
    dueDate: t.due_date,
    emailId: t.email_id,
    emailSubject: t.emails?.subject || null,
    emailSender: senderName || null,
    emailSenderEmail: senderEmail || null,
    emailBody: t.emails?.body || null,
    emailSummary: t.emails?.summary || null,
    emailPriority: t.emails?.priority || null,
    emailStatus: t.emails?.status || null,
    emailCategoryName: t.emails?.categories?.name || null,
    emailCreatedAt: t.emails?.created_at || null,
    projectId: t.project_id,
    projectName: t.projects?.name || null,
    projectReference: t.projects?.reference || null,
    createdAt: t.created_at,
    userId: t.user_id,
    assignedToUserId: t.assigned_to_user_id || null,
    assignedAt: t.assigned_at || null,
    assignedByUserId: t.assigned_by_user_id || null,
  };
}

async function getActorOrganisationId(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("organisation_members")
    .select("organisation_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  return data?.organisation_id || null;
}

async function isSameOrganisation(actorId: string, targetUserId: string): Promise<boolean> {
  if (actorId === targetUserId) return true;
  const orgId = await getActorOrganisationId(actorId);
  if (!orgId) return false;
  const { data } = await supabaseAdmin
    .from("organisation_members")
    .select("user_id")
    .eq("organisation_id", orgId)
    .eq("user_id", targetUserId)
    .eq("status", "active")
    .maybeSingle();
  return !!data;
}

router.get("/tasks", requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = req.userId!;
    const scope = (req.query.scope as string | undefined) || "mine";
    const projectId = req.query.projectId as string | undefined;
    const status = req.query.status as string | undefined;

    let query = supabaseAdmin
      .from("tasks")
      .select(
        "*, emails(subject, sender, body, summary, priority, status, created_at, category_id, categories:categories(name)), projects(name, reference)"
      )
      .order("created_at", { ascending: false });

    if (scope === "assigned_to_me") {
      query = query.eq("assigned_to_user_id", userId);
    } else if (scope === "created_by_me") {
      query = query.eq("user_id", userId);
    } else if (scope === "team") {
      const orgId = await getActorOrganisationId(userId);
      if (!orgId) {
        res.json([]);
        return;
      }
      const { data: members } = await supabaseAdmin
        .from("organisation_members")
        .select("user_id")
        .eq("organisation_id", orgId)
        .eq("status", "active");
      const memberIds = (members || []).map((m: any) => m.user_id);
      if (memberIds.length === 0) {
        res.json([]);
        return;
      }
      query = query.in("user_id", memberIds);
    } else {
      query = query.or(`user_id.eq.${userId},assigned_to_user_id.eq.${userId}`);
    }

    if (projectId) {
      query = query.eq("project_id", projectId);
    }

    if (status && status !== "all") {
      if (status === "done") {
        query = query.eq("done", true);
      } else if (status === "pending" || status === "todo") {
        query = query.eq("done", false);
      }
    }

    const { data: tasks, error } = await query;

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json((tasks || []).map(mapTask));
  } catch {
    res.status(500).json({ error: "Failed to list tasks" });
  }
});

router.post("/tasks", requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = req.userId!;
    const { title, emailId, projectId, assignedToUserId } = req.body;

    if (!title || typeof title !== "string" || title.trim().length < 2) {
      res.status(400).json({ error: "Le titre de la tache doit contenir au moins 2 caracteres" });
      return;
    }

    const insertData: Record<string, unknown> = {
      user_id: userId,
      title: title.trim(),
    };

    if (emailId) {
      const { data: email } = await supabaseAdmin
        .from("emails")
        .select("id")
        .eq("id", emailId)
        .eq("user_id", userId)
        .single();
      if (email) insertData.email_id = emailId;
    }

    if (projectId) {
      const { data: project } = await supabaseAdmin
        .from("projects")
        .select("id")
        .eq("id", projectId)
        .eq("user_id", userId)
        .single();
      if (project) insertData.project_id = projectId;
    }

    if (assignedToUserId && typeof assignedToUserId === "string") {
      const allowed = await isSameOrganisation(userId, assignedToUserId);
      if (!allowed) {
        res.status(403).json({ error: "L'utilisateur n'appartient pas à votre organisation" });
        return;
      }
      insertData.assigned_to_user_id = assignedToUserId;
      insertData.assigned_at = new Date().toISOString();
      insertData.assigned_by_user_id = userId;
    }

    const { data: task, error } = await supabaseAdmin
      .from("tasks")
      .insert(insertData)
      .select(
        "*, emails(subject, sender, body, summary, priority, status, created_at, category_id, categories:categories(name)), projects(name, reference)"
      )
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(201).json(mapTask(task));
  } catch {
    res.status(500).json({ error: "Failed to create task" });
  }
});

router.patch("/tasks/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = req.userId!;
    const updates: Record<string, unknown> = {};
    if (req.body.done !== undefined) updates.done = req.body.done;
    if (req.body.title !== undefined) updates.title = req.body.title;
    if (req.body.projectId !== undefined) updates.project_id = req.body.projectId;

    if (req.body.assignedToUserId !== undefined) {
      if (req.body.assignedToUserId === null) {
        updates.assigned_to_user_id = null;
        updates.assigned_at = null;
        updates.assigned_by_user_id = null;
      } else if (typeof req.body.assignedToUserId === "string") {
        const allowed = await isSameOrganisation(userId, req.body.assignedToUserId);
        if (!allowed) {
          res.status(403).json({ error: "L'utilisateur n'appartient pas à votre organisation" });
          return;
        }
        updates.assigned_to_user_id = req.body.assignedToUserId;
        updates.assigned_at = new Date().toISOString();
        updates.assigned_by_user_id = userId;
      }
    }

    // Allow update if user is creator OR current assignee
    const { data: existing } = await supabaseAdmin
      .from("tasks")
      .select("user_id, assigned_to_user_id")
      .eq("id", req.params.id)
      .maybeSingle();

    if (!existing) {
      res.status(404).json({ error: "Task not found" });
      return;
    }
    if (existing.user_id !== userId && existing.assigned_to_user_id !== userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    // Only the creator can change the assignee
    if (
      req.body.assignedToUserId !== undefined &&
      existing.user_id !== userId
    ) {
      res.status(403).json({ error: "Seul le créateur de la tâche peut changer l'assignation" });
      return;
    }

    const { data: task, error } = await supabaseAdmin
      .from("tasks")
      .update(updates)
      .eq("id", req.params.id)
      .select(
        "*, emails(subject, sender, body, summary, priority, status, created_at, category_id, categories:categories(name)), projects(name, reference)"
      )
      .single();

    if (error || !task) {
      res.status(404).json({ error: "Task not found" });
      return;
    }

    res.json(mapTask(task));
  } catch {
    res.status(500).json({ error: "Failed to update task" });
  }
});

router.delete("/tasks/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const { error } = await supabaseAdmin
      .from("tasks")
      .delete()
      .eq("id", req.params.id)
      .eq("user_id", req.userId!);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete task" });
  }
});

export default router;
