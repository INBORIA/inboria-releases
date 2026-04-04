import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { CreateCategoryBody, UpdateCategoryBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/categories", requireAuth, async (req, res): Promise<void> => {
  try {
    const { data: categories, error } = await supabaseAdmin
      .from("categories")
      .select("*, emails(count)")
      .eq("user_id", req.userId!)
      .order("name");

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json((categories || []).map((c: any) => ({
      id: c.id,
      name: c.name,
      description: c.description || "",
      emailCount: c.emails?.[0]?.count || 0,
      createdAt: c.created_at,
    })));
  } catch {
    res.status(500).json({ error: "Failed to list categories" });
  }
});

router.post("/categories", requireAuth, async (req, res): Promise<void> => {
  try {
    const parsed = CreateCategoryBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { data: category, error } = await supabaseAdmin
      .from("categories")
      .insert({
        user_id: req.userId!,
        name: parsed.data.name,
        description: parsed.data.description || "",
      })
      .select()
      .single();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.status(201).json({
      id: category.id,
      name: category.name,
      description: category.description,
      emailCount: 0,
      createdAt: category.created_at,
    });
  } catch {
    res.status(500).json({ error: "Failed to create category" });
  }
});

router.patch("/categories/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const parsed = UpdateCategoryBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const updates: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) updates.name = parsed.data.name;
    if (parsed.data.description !== undefined) updates.description = parsed.data.description;

    const { data: category, error } = await supabaseAdmin
      .from("categories")
      .update(updates)
      .eq("id", req.params.id)
      .eq("user_id", req.userId!)
      .select()
      .single();

    if (error || !category) {
      res.status(404).json({ error: "Category not found" });
      return;
    }

    res.json({
      id: category.id,
      name: category.name,
      description: category.description,
      emailCount: 0,
      createdAt: category.created_at,
    });
  } catch {
    res.status(500).json({ error: "Failed to update category" });
  }
});

router.delete("/categories/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const { error } = await supabaseAdmin
      .from("categories")
      .delete()
      .eq("id", req.params.id)
      .eq("user_id", req.userId!);

    if (error) {
      res.status(404).json({ error: "Category not found" });
      return;
    }

    res.sendStatus(204);
  } catch {
    res.status(500).json({ error: "Failed to delete category" });
  }
});

export default router;
