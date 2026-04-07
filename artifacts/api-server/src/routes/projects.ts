import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/projects", requireAuth, async (req, res): Promise<void> => {
  try {
    const { data: projects, error } = await supabaseAdmin
      .from("projects")
      .select("*")
      .eq("user_id", req.userId!)
      .order("created_at", { ascending: false });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    const projectIds = (projects || []).map((p: any) => p.id);

    let emailCounts: Record<string, number> = {};
    let taskCounts: Record<string, number> = {};
    let pendingTaskCounts: Record<string, number> = {};

    if (projectIds.length > 0) {
      const { data: emails } = await supabaseAdmin
        .from("emails")
        .select("project_id")
        .in("project_id", projectIds)
        .eq("user_id", req.userId!);

      (emails || []).forEach((e: any) => {
        emailCounts[e.project_id] = (emailCounts[e.project_id] || 0) + 1;
      });

      const { data: tasks } = await supabaseAdmin
        .from("tasks")
        .select("project_id, done")
        .in("project_id", projectIds)
        .eq("user_id", req.userId!);

      (tasks || []).forEach((t: any) => {
        taskCounts[t.project_id] = (taskCounts[t.project_id] || 0) + 1;
        if (!t.done) {
          pendingTaskCounts[t.project_id] = (pendingTaskCounts[t.project_id] || 0) + 1;
        }
      });
    }

    res.json((projects || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      reference: p.reference,
      description: p.description,
      status: p.status,
      color: p.color,
      emailCount: emailCounts[p.id] || 0,
      taskCount: taskCounts[p.id] || 0,
      pendingTaskCount: pendingTaskCounts[p.id] || 0,
      createdAt: p.created_at,
    })));
  } catch {
    res.status(500).json({ error: "Failed to list projects" });
  }
});

router.get("/projects/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const { data: project, error } = await supabaseAdmin
      .from("projects")
      .select("*")
      .eq("id", req.params.id)
      .eq("user_id", req.userId!)
      .single();

    if (error || !project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const { data: emails } = await supabaseAdmin
      .from("emails")
      .select("*, categories(name)")
      .eq("project_id", project.id)
      .eq("user_id", req.userId!)
      .order("created_at", { ascending: false });

    const { data: tasks } = await supabaseAdmin
      .from("tasks")
      .select("*, emails(subject)")
      .eq("project_id", project.id)
      .eq("user_id", req.userId!)
      .order("created_at");

    res.json({
      id: project.id,
      name: project.name,
      reference: project.reference,
      description: project.description,
      status: project.status,
      color: project.color,
      createdAt: project.created_at,
      emails: (emails || []).map((e: any) => ({
        id: e.id,
        sender: e.sender?.match(/^(.+?)\s*</) ? e.sender.match(/^(.+?)\s*</)?.[1]?.replace(/^"|"$/g, "") : e.sender,
        senderEmail: e.sender?.match(/<(.+?)>/) ? e.sender.match(/<(.+?)>/)?.[1] : e.sender,
        subject: e.subject,
        status: e.status,
        priority: e.priority,
        summary: e.summary,
        categoryName: e.categories?.name || null,
        createdAt: e.created_at,
      })),
      tasks: (tasks || []).map((t: any) => ({
        id: t.id,
        title: t.title,
        done: t.done,
        dueDate: t.due_date,
        emailSubject: t.emails?.subject || null,
        createdAt: t.created_at,
      })),
    });
  } catch {
    res.status(500).json({ error: "Failed to get project" });
  }
});

router.post("/projects", requireAuth, async (req, res): Promise<void> => {
  try {
    const { name, reference, description, status, color } = req.body;

    if (!name || name.trim().length < 2) {
      res.status(400).json({ error: "Le nom du projet doit contenir au moins 2 caracteres" });
      return;
    }

    let finalReference = reference;
    if (!finalReference) {
      const { count } = await supabaseAdmin
        .from("projects")
        .select("*", { count: "exact", head: true })
        .eq("user_id", req.userId!);

      const nextNum = ((count || 0) + 1).toString().padStart(3, "0");
      finalReference = `PROJ-${nextNum}`;
    }

    const { data: project, error } = await supabaseAdmin
      .from("projects")
      .insert({
        user_id: req.userId,
        name: name.trim(),
        reference: finalReference,
        description: description || null,
        status: status || "actif",
        color: color || "blue",
      })
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(201).json({
      id: project.id,
      name: project.name,
      reference: project.reference,
      description: project.description,
      status: project.status,
      color: project.color,
      emailCount: 0,
      taskCount: 0,
      pendingTaskCount: 0,
      createdAt: project.created_at,
    });
  } catch {
    res.status(500).json({ error: "Failed to create project" });
  }
});

router.patch("/projects/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const updates: Record<string, unknown> = {};
    if (req.body.name !== undefined) updates.name = req.body.name;
    if (req.body.reference !== undefined) updates.reference = req.body.reference;
    if (req.body.description !== undefined) updates.description = req.body.description;
    if (req.body.status !== undefined) updates.status = req.body.status;
    if (req.body.color !== undefined) updates.color = req.body.color;

    const { data: project, error } = await supabaseAdmin
      .from("projects")
      .update(updates)
      .eq("id", req.params.id)
      .eq("user_id", req.userId!)
      .select()
      .single();

    if (error || !project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    res.json({
      id: project.id,
      name: project.name,
      reference: project.reference,
      description: project.description,
      status: project.status,
      color: project.color,
      emailCount: 0,
      taskCount: 0,
      pendingTaskCount: 0,
      createdAt: project.created_at,
    });
  } catch {
    res.status(500).json({ error: "Failed to update project" });
  }
});

router.delete("/projects/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    await supabaseAdmin
      .from("emails")
      .update({ project_id: null })
      .eq("project_id", req.params.id)
      .eq("user_id", req.userId!);

    await supabaseAdmin
      .from("tasks")
      .update({ project_id: null })
      .eq("project_id", req.params.id)
      .eq("user_id", req.userId!);

    const { error } = await supabaseAdmin
      .from("projects")
      .delete()
      .eq("id", req.params.id)
      .eq("user_id", req.userId!);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete project" });
  }
});

router.get("/projects/:id/notes", requireAuth, async (req, res): Promise<void> => {
  try {
    const { data: project } = await supabaseAdmin
      .from("projects")
      .select("id")
      .eq("id", req.params.id)
      .eq("user_id", req.userId!)
      .single();

    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const { data: notes, error } = await supabaseAdmin
      .from("project_notes")
      .select("*")
      .eq("project_id", req.params.id)
      .eq("user_id", req.userId!)
      .order("created_at", { ascending: false });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json((notes || []).map((n: any) => ({
      id: n.id,
      content: n.content,
      createdAt: n.created_at,
      updatedAt: n.updated_at,
    })));
  } catch {
    res.status(500).json({ error: "Failed to list project notes" });
  }
});

router.post("/projects/:id/notes", requireAuth, async (req, res): Promise<void> => {
  try {
    const { content } = req.body;

    if (!content || typeof content !== "string" || content.trim().length < 1) {
      res.status(400).json({ error: "Le contenu de la note est requis" });
      return;
    }

    const { data: project } = await supabaseAdmin
      .from("projects")
      .select("id")
      .eq("id", req.params.id)
      .eq("user_id", req.userId!)
      .single();

    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const { data: note, error } = await supabaseAdmin
      .from("project_notes")
      .insert({
        project_id: parseInt(req.params.id),
        user_id: req.userId!,
        content: content.trim(),
      })
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(201).json({
      id: note.id,
      content: note.content,
      createdAt: note.created_at,
      updatedAt: note.updated_at,
    });
  } catch {
    res.status(500).json({ error: "Failed to create project note" });
  }
});

router.delete("/projects/:id/notes/:noteId", requireAuth, async (req, res): Promise<void> => {
  try {
    const { data: project } = await supabaseAdmin
      .from("projects")
      .select("id")
      .eq("id", req.params.id)
      .eq("user_id", req.userId!)
      .single();

    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const { error } = await supabaseAdmin
      .from("project_notes")
      .delete()
      .eq("id", req.params.noteId)
      .eq("project_id", req.params.id)
      .eq("user_id", req.userId!);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete project note" });
  }
});

export default router;
