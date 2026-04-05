import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/tasks", requireAuth, async (req, res): Promise<void> => {
  try {
    let query = supabaseAdmin
      .from("tasks")
      .select("*, emails(subject), projects(name, reference)")
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

    res.json((tasks || []).map((t: any) => ({
      id: t.id,
      title: t.title,
      done: t.done,
      dueDate: t.due_date,
      emailId: t.email_id,
      emailSubject: t.emails?.subject || null,
      projectId: t.project_id,
      projectName: t.projects?.name || null,
      projectReference: t.projects?.reference || null,
      createdAt: t.created_at,
    })));
  } catch {
    res.status(500).json({ error: "Failed to list tasks" });
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
      emailId: task.email_id,
      emailSubject: task.emails?.subject || null,
      createdAt: task.created_at,
    });
  } catch {
    res.status(500).json({ error: "Failed to update task" });
  }
});

export default router;
