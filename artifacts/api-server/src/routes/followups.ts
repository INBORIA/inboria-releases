import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/followups", requireAuth, async (req, res): Promise<void> => {
  try {
    const status = req.query.status as string | undefined;
    const projectId = req.query.projectId as string | undefined;

    let query = supabaseAdmin
      .from("followups")
      .select("*, emails(id, sender, subject, summary, status, priority, created_at, recipient, reply_to_email_id), projects(id, name, reference, color)")
      .eq("user_id", req.userId!)
      .order("created_at", { ascending: false });

    if (status && status !== "all") {
      query = query.eq("status", status);
    }
    if (projectId) {
      query = query.eq("project_id", projectId);
    }

    const { data, error } = await query;
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json(data || []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/followups/stats", requireAuth, async (req, res): Promise<void> => {
  try {
    const { data, error } = await supabaseAdmin
      .from("followups")
      .select("status")
      .eq("user_id", req.userId!);

    if (error) { res.status(500).json({ error: error.message }); return; }

    const stats = { en_attente: 0, relance: 0, termine: 0, overdue: 0 };
    const today = new Date().toISOString().split("T")[0];

    for (const f of data || []) {
      if (f.status === "en_attente") stats.en_attente++;
      else if (f.status === "relance") stats.relance++;
      else if (f.status === "termine") stats.termine++;
    }

    const { count } = await supabaseAdmin
      .from("followups")
      .select("id", { count: "exact", head: true })
      .eq("user_id", req.userId!)
      .neq("status", "termine")
      .lt("due_date", today);

    stats.overdue = count || 0;

    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/followups", requireAuth, async (req, res): Promise<void> => {
  try {
    const { title, emailId, projectId, status, dueDate, notes } = req.body;
    if (!title) { res.status(400).json({ error: "Le titre est requis" }); return; }

    const { data, error } = await supabaseAdmin
      .from("followups")
      .insert({
        user_id: req.userId!,
        email_id: emailId || null,
        project_id: projectId || null,
        title,
        status: status || "en_attente",
        due_date: dueDate || null,
        notes: notes || null,
        ai_suggestion: false,
      })
      .select()
      .single();

    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/followups/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const { id } = req.params;
    const updates: Record<string, any> = {};
    if (req.body.title !== undefined) updates.title = req.body.title;
    if (req.body.status !== undefined) updates.status = req.body.status;
    if (req.body.dueDate !== undefined) updates.due_date = req.body.dueDate;
    if (req.body.notes !== undefined) updates.notes = req.body.notes;
    if (req.body.projectId !== undefined) updates.project_id = req.body.projectId || null;
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from("followups")
      .update(updates)
      .eq("id", id)
      .eq("user_id", req.userId!)
      .select()
      .single();

    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/followups/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin
      .from("followups")
      .delete()
      .eq("id", id)
      .eq("user_id", req.userId!);

    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
