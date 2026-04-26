import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { CreateCategoryBody, UpdateCategoryBody, ApplyPackBody, GeneratePackBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import OpenAI from "openai";
import { AI_COST, checkEntitlement, consumeAiCredits } from "../services/credits";
import { findSimilarCategories, findDuplicatePairs } from "../lib/similarity";
import { ensureSystemCategory } from "../lib/system-categories";

// Headers/query params autorisant le bypass volontaire de la détection
// de quasi-doublons ("Créer quand même" côté UI).
function isForceCreate(req: { query: any; headers: any; body: any }): boolean {
  const q = String(req.query?.["force"] ?? "").toLowerCase();
  if (q === "1" || q === "true" || q === "yes") return true;
  const h = String(req.headers?.["x-force-create"] ?? "").toLowerCase();
  if (h === "1" || h === "true" || h === "yes") return true;
  if (req.body && req.body.force === true) return true;
  return false;
}

const openai = new OpenAI({
  apiKey: process.env["OPENAI_API_KEY"],
});

const router: IRouter = Router();

router.get("/categories", requireAuth, async (req, res): Promise<void> => {
  try {
    // Garantit qu'on retourne TOUJOURS la catégorie système "Non classé".
    // Idempotent : ne crée rien si elle existe déjà. Au premier passage,
    // elle réaffecte aussi les emails orphelins (category_id IS NULL).
    await ensureSystemCategory(req.userId!);

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
      isSystem: c.is_system === true,
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

    // Détection des quasi-doublons : on ne bloque pas un utilisateur qui veut
    // explicitement créer "Factures" alors qu'il a déjà "Facturation", mais on
    // l'avertit pour éviter les disperseurs. Bypass via ?force=1 ou header.
    if (!isForceCreate(req)) {
      const { data: existing } = await supabaseAdmin
        .from("categories")
        .select("id, name")
        .eq("user_id", req.userId!);

      const similar = findSimilarCategories(parsed.data.name, existing || []);
      if (similar.length > 0) {
        res.status(409).json({
          error: "near_duplicate_category",
          similar: similar.slice(0, 3),
        });
        return;
      }
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

    // Lecture de la cible AVANT update pour vérifier le drapeau is_system.
    const { data: existing } = await supabaseAdmin
      .from("categories")
      .select("id, is_system")
      .eq("id", req.params.id)
      .eq("user_id", req.userId!)
      .maybeSingle();

    if (!existing) {
      res.status(404).json({ error: "Category not found" });
      return;
    }

    if ((existing as any).is_system === true) {
      res.status(400).json({ error: "system_category_protected" });
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
      isSystem: category.is_system === true,
      createdAt: category.created_at,
    });
  } catch {
    res.status(500).json({ error: "Failed to update category" });
  }
});

router.delete("/categories/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const catId = parseInt(req.params.id as string, 10);
    if (isNaN(catId)) {
      res.status(400).json({ error: "ID invalide" });
      return;
    }

    const { data: existing } = await supabaseAdmin
      .from("categories")
      .select("id, is_system")
      .eq("id", catId)
      .eq("user_id", req.userId!)
      .maybeSingle();

    if (!existing) {
      res.status(404).json({ error: "Catégorie introuvable" });
      return;
    }

    if ((existing as any).is_system === true) {
      res.status(400).json({ error: "system_category_protected" });
      return;
    }

    // Réaffecte les emails de la catégorie supprimée vers la catégorie
    // système "Non classé" plutôt que vers NULL : l'utilisateur retrouve
    // ainsi ses emails dans le bac "à trier" au lieu de les voir disparaître.
    const systemCat = await ensureSystemCategory(req.userId!);
    await supabaseAdmin
      .from("emails")
      .update({ category_id: systemCat ? systemCat.id : null })
      .eq("category_id", catId)
      .eq("user_id", req.userId!);

    const { error } = await supabaseAdmin
      .from("categories")
      .delete()
      .eq("id", catId)
      .eq("user_id", req.userId!);

    if (error) {
      res.status(500).json({ error: "Impossible de supprimer cette catégorie: " + error.message });
      return;
    }

    res.sendStatus(204);
  } catch {
    res.status(500).json({ error: "Failed to delete category" });
  }
});

// Liste les paires de catégories de l'utilisateur dont les noms se ressemblent
// fortement. Sert au "nettoyage des doublons" côté UI : on ne supprime jamais
// rien automatiquement, on propose simplement la fusion à l'utilisateur.
router.get("/categories/duplicates", requireAuth, async (req, res): Promise<void> => {
  try {
    const { data: categories, error } = await supabaseAdmin
      .from("categories")
      .select("id, name, source_pack, emails(count)")
      .eq("user_id", req.userId!);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    const enriched = (categories || []).map((c: any) => ({
      id: c.id,
      name: c.name,
      sourcePack: c.source_pack || null,
      emailCount: c.emails?.[0]?.count || 0,
    }));

    const pairs = findDuplicatePairs(enriched);
    res.json({
      pairs: pairs.map((p) => ({
        a: p.a,
        b: p.b,
        similarity: p.similarity,
      })),
    });
  } catch {
    res.status(500).json({ error: "Failed to detect duplicates" });
  }
});

// Fusionne la catégorie source dans la cible : tous les emails liés à la
// source sont réaffectés à la cible, puis la source est supprimée. Les deux
// catégories doivent appartenir au même utilisateur. La réaffectation et la
// suppression sont faites séquentiellement (pas de transaction Postgres
// disponible via supabase-js, mais le risque est limité : si la suppression
// échoue après la réaffectation, l'utilisateur peut toujours supprimer la
// source à la main, sans perte de donnée).
router.post(
  "/categories/:id/merge-into/:targetId",
  requireAuth,
  async (req, res): Promise<void> => {
    try {
      const sourceId = parseInt(req.params.id as string, 10);
      const targetId = parseInt(req.params.targetId as string, 10);
      if (isNaN(sourceId) || isNaN(targetId)) {
        res.status(400).json({ error: "ID invalide" });
        return;
      }
      if (sourceId === targetId) {
        res.status(400).json({ error: "Source et cible identiques" });
        return;
      }

      // On vérifie que les deux catégories existent ET appartiennent à
      // l'utilisateur courant — empêche la fusion croisée entre comptes.
      const { data: cats, error: lookupError } = await supabaseAdmin
        .from("categories")
        .select("id, name, is_system")
        .eq("user_id", req.userId!)
        .in("id", [sourceId, targetId]);

      if (lookupError) {
        res.status(500).json({ error: lookupError.message });
        return;
      }
      if (!cats || cats.length !== 2) {
        res.status(404).json({ error: "Catégorie introuvable" });
        return;
      }

      const target = cats.find((c: any) => c.id === targetId);
      const source = cats.find((c: any) => c.id === sourceId);
      if (!target || !source) {
        res.status(404).json({ error: "Catégorie introuvable" });
        return;
      }

      // La catégorie système "Non classé" ne peut être ni source ni cible
      // de fusion : la supprimer (source) la ferait disparaître, et la
      // recevoir (cible) en ferait perdre l'unicité ou la spécificité.
      if ((source as any).is_system === true || (target as any).is_system === true) {
        res.status(400).json({ error: "system_category_protected" });
        return;
      }

      // Réaffectation des emails. On compte d'abord pour le retour, puis on
      // applique l'UPDATE. Le filtre user_id est redondant (les emails sont
      // déjà liés à la catégorie source qui appartient à l'utilisateur), mais
      // on le garde par défense en profondeur.
      const { count: movedEmails, error: countError } = await supabaseAdmin
        .from("emails")
        .select("id", { count: "exact", head: true })
        .eq("category_id", sourceId)
        .eq("user_id", req.userId!);

      if (countError) {
        res.status(500).json({ error: countError.message });
        return;
      }

      const { error: updateError } = await supabaseAdmin
        .from("emails")
        .update({ category_id: targetId })
        .eq("category_id", sourceId)
        .eq("user_id", req.userId!);

      if (updateError) {
        res.status(500).json({ error: updateError.message });
        return;
      }

      const { error: deleteError } = await supabaseAdmin
        .from("categories")
        .delete()
        .eq("id", sourceId)
        .eq("user_id", req.userId!);

      if (deleteError) {
        res.status(500).json({ error: deleteError.message });
        return;
      }

      res.json({
        movedEmails: movedEmails || 0,
        deletedCategoryId: sourceId,
        targetCategoryId: targetId,
        targetName: (target as any).name,
      });
    } catch {
      res.status(500).json({ error: "Failed to merge categories" });
    }
  },
);

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
      .select("id, name")
      .eq("user_id", req.userId!);

    const existingList = (existing || []) as Array<{ id: number; name: string }>;
    const existingNames = new Set(existingList.map((c) => c.name.toLowerCase()));

    // Quasi-doublon : on évite aussi les "Factures" face à "Facturation"
    // pour ne pas polluer le classement quand on applique un pack métier.
    // On accumule au fur et à mesure les noms acceptés du pack pour
    // bloquer aussi les doublons internes au même payload.
    const nearDuplicates: Array<{ name: string; matched: string }> = [];
    const seen: Array<{ id: number; name: string }> = [...existingList];
    const toInsert = dedupedCategories.filter((c) => {
      const trimmed = c.name.trim();
      if (existingNames.has(trimmed.toLowerCase())) return false;
      const sim = findSimilarCategories(trimmed, seen);
      if (sim.length > 0) {
        nearDuplicates.push({ name: trimmed, matched: sim[0]!.name });
        return false;
      }
      seen.push({ id: -1, name: trimmed });
      return true;
    });

    let added = 0;
    const addedCategories: any[] = [];

    for (const cat of toInsert) {
      let created: any = null;
      let insertError: any = null;

      const fullRow = {
        user_id: req.userId!,
        name: cat.name.trim(),
        description: (cat.description || "").trim(),
        source_pack: packName.trim(),
      };

      const result = await supabaseAdmin
        .from("categories")
        .insert(fullRow)
        .select()
        .single();

      if (result.error) {
        const fallbackResult = await supabaseAdmin
          .from("categories")
          .insert({
            user_id: req.userId!,
            name: cat.name.trim(),
            description: (cat.description || "").trim(),
          })
          .select()
          .single();
        created = fallbackResult.data;
        insertError = fallbackResult.error;
      } else {
        created = result.data;
        insertError = result.error;
      }

      if (!insertError && created) {
        added++;
        addedCategories.push({
          id: created.id,
          name: created.name,
          description: created.description,
          emailCount: 0,
          sourcePack: created.source_pack || null,
          createdAt: created.created_at,
        });
      }
    }

    res.json({
      added,
      skipped: packCategories.length - added,
      nearDuplicates,
      categories: addedCategories,
    });
  } catch {
    res.status(500).json({ error: "Failed to apply pack" });
  }
});

router.post("/categories/generate-pack", requireAuth, async (req, res): Promise<void> => {
  try {
    const entitlement = await checkEntitlement(req.userId!, AI_COST.generate_pack);
    if (entitlement.blocked) { res.status(403).json({ error: entitlement.reason }); return; }

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

    // Charge les catégories déjà en place pour les passer à l'IA en
    // contexte : on évite ainsi qu'elle propose "Factures" quand l'abonné
    // a déjà "Facturation". Ceinture + bretelles : on filtre aussi côté
    // serveur après la réponse.
    const { data: existing } = await supabaseAdmin
      .from("categories")
      .select("id, name")
      .eq("user_id", req.userId!);
    const existingList = (existing || []) as Array<{ id: number; name: string }>;
    const existingNamesList = existingList.map((c) => c.name).filter(Boolean);
    const avoidBlock = existingNamesList.length > 0
      ? `\n\nCategories DEJA existantes chez l'utilisateur (NE PAS reproposer ni proposer des variantes proches comme un singulier/pluriel ou un synonyme evident) :\n- ${existingNamesList.join("\n- ")}`
      : "";

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

Genere entre 6 et 12 categories d'emails pertinentes pour ce metier. Chaque categorie doit avoir un nom court et une description claire.${avoidBlock}

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

    // Filtre côté serveur : retire toute proposition IA en quasi-doublon
    // d'une catégorie existante OU d'une autre proposition du même pack.
    const seenInPack: Array<{ id: number; name: string }> = [...existingList];
    const categories = (Array.isArray(result.categories) ? result.categories : [])
      .filter((c: any) => typeof c.name === "string" && c.name.trim().length >= 2)
      .map((c: any) => ({
        name: c.name.trim().slice(0, 100),
        description: typeof c.description === "string" ? c.description.trim().slice(0, 300) : "",
      }))
      .filter((c: { name: string; description: string }) => {
        const sim = findSimilarCategories(c.name, seenInPack);
        if (sim.length > 0) return false;
        seenInPack.push({ id: -1, name: c.name });
        return true;
      })
      .slice(0, 15);

    const billing = await consumeAiCredits(req.userId!, "generate_pack");
    if (!billing.ok) {
      res.status(500).json({ error: "Echec de facturation, veuillez reessayer." });
      return;
    }
    res.json({ packName, categories });
  } catch {
    res.status(500).json({ error: "Failed to generate pack" });
  }
});

export default router;
