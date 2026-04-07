import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { CreateCategoryBody, UpdateCategoryBody, ApplyPackBody, GeneratePackBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env["OPENAI_API_KEY"],
});

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
      sourcePack: c.source_pack || null,
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
      sourcePack: category.source_pack || null,
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
      sourcePack: category.source_pack || null,
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

router.post("/categories/apply-pack", requireAuth, async (req, res): Promise<void> => {
  try {
    const parsed = ApplyPackBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { packName, categories: packCategories } = parsed.data;

    if (!packName.trim() || packCategories.length === 0 || packCategories.length > 50) {
      res.status(400).json({ error: "Pack invalide: nom requis et entre 1 et 50 categories" });
      return;
    }

    const validCategories = packCategories.filter((c) => c.name && c.name.trim().length >= 2);
    if (validCategories.length === 0) {
      res.status(400).json({ error: "Aucune categorie valide dans le pack" });
      return;
    }

    const seenNames = new Set<string>();
    const dedupedCategories = validCategories.filter((c) => {
      const key = c.name.trim().toLowerCase();
      if (seenNames.has(key)) return false;
      seenNames.add(key);
      return true;
    });

    const { data: existing } = await supabaseAdmin
      .from("categories")
      .select("name")
      .eq("user_id", req.userId!);

    const existingNames = new Set((existing || []).map((c: any) => c.name.toLowerCase()));

    const toInsert = dedupedCategories.filter(
      (c) => !existingNames.has(c.name.trim().toLowerCase())
    );

    let added = 0;
    const addedCategories: any[] = [];

    for (const cat of toInsert) {
      const { data: created, error } = await supabaseAdmin
        .from("categories")
        .insert({
          user_id: req.userId!,
          name: cat.name.trim(),
          description: (cat.description || "").trim(),
          source_pack: packName.trim(),
        })
        .select()
        .single();

      if (!error && created) {
        added++;
        addedCategories.push({
          id: created.id,
          name: created.name,
          description: created.description,
          emailCount: 0,
          sourcePack: created.source_pack,
          createdAt: created.created_at,
        });
      }
    }

    res.json({
      added,
      skipped: packCategories.length - added,
      categories: addedCategories,
    });
  } catch {
    res.status(500).json({ error: "Failed to apply pack" });
  }
});

router.post("/categories/generate-pack", requireAuth, async (req, res): Promise<void> => {
  try {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("plan, emails_used, emails_quota")
      .eq("id", req.userId!)
      .single();

    if (!profile) { res.status(403).json({ error: "Profil introuvable" }); return; }
    if (profile.plan === "expired") { res.status(403).json({ error: "Votre abonnement a expire." }); return; }
    if (profile.emails_used >= profile.emails_quota) { res.status(403).json({ error: "Quota atteint." }); return; }

    const parsed = GeneratePackBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const description = (parsed.data.description || "").trim();
    if (description.length < 3 || description.length > 500) {
      res.status(400).json({ error: "Description entre 3 et 500 caracteres requise" });
      return;
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 1024,
      messages: [
        {
          role: "system",
          content: "Tu es un expert en organisation d'emails professionnels. Genere une liste de categories d'emails adaptees au metier decrit. Reponds uniquement en JSON valide.",
        },
        {
          role: "user",
          content: `Metier/activite: ${description}

Genere entre 6 et 12 categories d'emails pertinentes pour ce metier. Chaque categorie doit avoir un nom court et une description claire.

Reponds en JSON:
{
  "packName": "nom court du pack metier",
  "categories": [
    {"name": "Nom categorie", "description": "Description de ce que contient cette categorie"}
  ]
}`,
        },
      ],
    });

    const content = completion.choices[0]?.message?.content ?? "{}";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const result = JSON.parse(jsonMatch ? jsonMatch[0] : "{}");

    const packName = typeof result.packName === "string" && result.packName.trim()
      ? result.packName.trim().slice(0, 100)
      : "Pack personnalise";

    const categories = (Array.isArray(result.categories) ? result.categories : [])
      .filter((c: any) => typeof c.name === "string" && c.name.trim().length >= 2)
      .slice(0, 15)
      .map((c: any) => ({
        name: c.name.trim().slice(0, 100),
        description: typeof c.description === "string" ? c.description.trim().slice(0, 300) : "",
      }));

    res.json({ packName, categories });
  } catch {
    res.status(500).json({ error: "Failed to generate pack" });
  }
});

export default router;
