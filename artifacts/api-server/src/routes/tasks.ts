import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/tasks", requireAuth, async (req, res): Promise<void> => {
  try {
    let query = supabaseAdmin
      .from("tasks")
      .select("*, emails(subject, sender, body, summary, priority, status, created_at, category_id, categories:categories(name)), projects(name, reference)")
      .eq("user_id", req.userId!)
      .order("created_at");

    const status = req.query.status as string | undefined;
    if (status && status !== "all") {
      if (status === "done") {
        query = query.eq("done", true);
      } else if (status === "pending") {
        query = query.eq("done", false);
      }
    }

    const { data: tasks, error } = await query;

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json((tasks || []).map((t: any) => {
      const senderRaw = t.emails?.sender || "";
      const senderMatch = senderRaw.match(/^(.+?)\s*<(.+?)>$/);
      const senderName = senderMatch ? senderMatch[1].trim().replace(/^"|"$/g, "") : senderRaw;
      const senderEmail = senderMatch ? senderMatch[2].trim() : senderRaw;
      return {
        id: t.id,
        title: t.title,
        done: t.done,
        dueDate: t.due_date,
        source: t.source || "manual",
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
      };
    }));
  } catch {
    res.status(500).json({ error: "Failed to list tasks" });
  }
});

router.post("/tasks", requireAuth, async (req, res): Promise<void> => {
  try {
    const { title, emailId, projectId } = req.body;

    if (!title || typeof title !== "string" || title.trim().length < 2) {
      res.status(400).json({ error: "Le titre de la tache doit contenir au moins 2 caracteres" });
      return;
    }

    const insertData: Record<string, unknown> = {
      user_id: req.userId!,
      title: title.trim(),
    };

    if (emailId) {
      const { data: email } = await supabaseAdmin
        .from("emails")
        .select("id")
        .eq("id", emailId)
        .eq("user_id", req.userId!)
        .single();
      if (email) insertData.email_id = emailId;
    }

    if (projectId) {
      const { data: project } = await supabaseAdmin
        .from("projects")
        .select("id")
        .eq("id", projectId)
        .eq("user_id", req.userId!)
        .single();
      if (project) insertData.project_id = projectId;
    }

    const { data: task, error } = await supabaseAdmin
      .from("tasks")
      .insert(insertData)
      .select("*, emails(subject, sender), projects(name, reference)")
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    const senderRaw = task.emails?.sender || "";
    const senderMatch = senderRaw.match(/^(.+?)\s*<(.+?)>$/);
    const senderName = senderMatch ? senderMatch[1].trim().replace(/^"|"$/g, "") : senderRaw;

    res.status(201).json({
      id: task.id,
      title: task.title,
      done: task.done,
      dueDate: task.due_date,
      source: task.source || "manual",
      emailId: task.email_id,
      emailSubject: task.emails?.subject || null,
      emailSender: senderName || null,
      projectId: task.project_id,
      projectName: task.projects?.name || null,
      projectReference: task.projects?.reference || null,
      createdAt: task.created_at,
    });
  } catch {
    res.status(500).json({ error: "Failed to create task" });
  }
});

router.patch("/tasks/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const updates: Record<string, unknown> = {};
    if (req.body.done !== undefined) updates.done = req.body.done;
    if (req.body.title !== undefined) updates.title = req.body.title;
    if (req.body.projectId !== undefined) updates.project_id = req.body.projectId;

    const { data: task, error } = await supabaseAdmin
      .from("tasks")
      .update(updates)
      .eq("id", req.params.id)
      .eq("user_id", req.userId!)
      .select("*, emails(subject)")
      .single();

    if (error || !task) {
      res.status(404).json({ error: "Task not found" });
      return;
    }

    res.json({
      id: task.id,
      title: task.title,
      done: task.done,
      dueDate: task.due_date,
      source: task.source || "manual",
      emailId: task.email_id,
      emailSubject: task.emails?.subject || null,
      createdAt: task.created_at,
    });
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
