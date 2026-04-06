import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { GenerateDailySummaryBody, TriageEmailBody, GenerateDraftBody } from "@workspace/api-zod";
import OpenAI from "openai";
import { requireAuth } from "../middlewares/auth";

const openai = new OpenAI({
  apiKey: process.env["OPENAI_API_KEY"],
});

const router: IRouter = Router();

async function checkEntitlement(userId: string): Promise<{ blocked: boolean; reason?: string }> {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("plan, emails_used, emails_quota")
    .eq("id", userId)
    .single();

  if (!profile) return { blocked: true, reason: "Profil introuvable" };
  if (profile.plan === "expired") return { blocked: true, reason: "Votre abonnement a expire. Reabonnez-vous pour continuer." };
  if (profile.emails_used >= profile.emails_quota) return { blocked: true, reason: "Quota d'emails atteint. Passez a un plan superieur pour continuer." };
  return { blocked: false };
}

router.post("/ai/daily-summary", requireAuth, async (req, res): Promise<void> => {
  try {
    const entitlement = await checkEntitlement(req.userId!);
    if (entitlement.blocked) { res.status(403).json({ error: entitlement.reason }); return; }

    const parsed = GenerateDailySummaryBody.safeParse(req.body);
    const language = parsed.success && parsed.data.language ? parsed.data.language : "fr";

    const { data: emails } = await supabaseAdmin
      .from("emails")
      .select("id, sender, subject, priority, summary, status")
      .eq("user_id", req.userId!)
      .order("created_at", { ascending: false })
      .limit(50);

    const allEmails = emails || [];
    const urgent = allEmails.filter(e => e.priority === "urgent").length;
    const moyen = allEmails.filter(e => e.priority === "moyen").length;
    const faible = allEmails.filter(e => e.priority === "faible").length;
    const pending = allEmails.filter(e => e.status === "classe").length;

    const langInstruction = language === "fr"
      ? "Reponds en francais."
      : "Respond in English.";

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 2048,
      messages: [
        {
          role: "system",
          content: `Tu es un assistant de gestion d'emails. ${langInstruction} Genere un bilan quotidien structure.`,
        },
        {
          role: "user",
          content: `Voici les ${allEmails.length} derniers emails de l'utilisateur:
${allEmails.map(e => `- [${e.priority}] ${e.sender}: ${e.subject} ${e.summary ? `(${e.summary})` : ""}`).join("\n")}

Statistiques: ${urgent} urgents, ${moyen} moyens, ${faible} faibles, ${pending} en attente.

Genere un JSON avec:
{
  "summary": "resume general de la journee en 2-3 phrases",
  "advice": "un conseil personnalise pour ameliorer la gestion des emails",
  "keyEmailIds": [liste des 5 IDs les plus importants]
}`,
        },
      ],
    });

    let aiResponse: { summary: string; advice: string; keyEmailIds: string[] };
    try {
      const content = completion.choices[0]?.message?.content ?? "{}";
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      aiResponse = JSON.parse(jsonMatch ? jsonMatch[0] : "{}");
    } catch {
      aiResponse = {
        summary: "Bilan en cours de generation...",
        advice: "Traitez les emails urgents en priorite.",
        keyEmailIds: [],
      };
    }

    const keyEmails = allEmails
      .filter(e => aiResponse.keyEmailIds?.includes(e.id) || e.priority === "urgent")
      .slice(0, 5)
      .map(e => ({
        id: e.id,
        sender: e.sender,
        subject: e.subject,
        priority: e.priority,
        summary: e.summary ?? e.subject,
      }));

    const score = Math.max(0, Math.round(100 - (urgent / Math.max(allEmails.length, 1)) * 40 - (pending / Math.max(allEmails.length, 1)) * 30));

    res.json({
      score,
      summary: aiResponse.summary || "Aucun email a analyser.",
      keyEmails,
      stats: {
        total: allEmails.length,
        urgent,
        moyen,
        faible,
        pending,
      },
      advice: aiResponse.advice || "Continuez a bien gerer vos emails.",
    });
  } catch {
    res.status(500).json({ error: "Failed to generate daily summary" });
  }
});

router.post("/ai/triage", requireAuth, async (req, res): Promise<void> => {
  try {
    const entitlement = await checkEntitlement(req.userId!);
    if (entitlement.blocked) { res.status(403).json({ error: entitlement.reason }); return; }

    const parsed = TriageEmailBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { data: categories } = await supabaseAdmin
      .from("categories")
      .select("name")
      .eq("user_id", req.userId!);

    const categoryNames = (categories || []).map((c: any) => c.name);

    const { data: userProjects } = await supabaseAdmin
      .from("projects")
      .select("name, reference")
      .eq("user_id", req.userId!)
      .eq("status", "actif");
    const projectList = (userProjects || []).map((p: any) => `${p.reference} (${p.name})`);

    let projectContext = "";
    if (projectList.length > 0) {
      projectContext = `\n\nProjets actifs: ${projectList.join(", ")}\nSi l'email semble concerner un de ces projets, indique son nom exact dans "project". Sinon, mets "Aucun".`;
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 1024,
      messages: [
        {
          role: "system",
          content: "Tu es un assistant de gestion d'emails. Reponds uniquement en JSON valide.",
        },
        {
          role: "user",
          content: `Voici un email:
Expediteur: ${parsed.data.sender}
Sujet: ${parsed.data.subject}
Corps: ${parsed.data.body}

Categories disponibles: ${categoryNames.join(", ") || "Aucune categorie"}${projectContext}

Reponds en JSON:
{
  "category": "nom exact de la categorie ou 'Non classe'",
  "priority": "urgent" | "moyen" | "faible",
  "summary": "resume en 1 phrase",
  "tasks": ["tache 1", "tache 2"],
  "project": "nom du projet ou Aucun"
}`,
        },
      ],
    });

    let triageResult: { category: string; priority: string; summary: string; tasks: string[]; project: string };
    try {
      const content = completion.choices[0]?.message?.content ?? "{}";
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      triageResult = JSON.parse(jsonMatch ? jsonMatch[0] : "{}");
    } catch {
      triageResult = {
        category: "Non classe",
        priority: "moyen",
        summary: "Email en cours d'analyse",
        tasks: [],
        project: "Aucun",
      };
    }

    res.json({
      category: triageResult.category || "Non classe",
      priority: triageResult.priority || "moyen",
      summary: triageResult.summary || "Email en cours d'analyse",
      tasks: triageResult.tasks || [],
      project: triageResult.project || "Aucun",
    });
  } catch {
    res.status(500).json({ error: "Failed to triage email" });
  }
});

router.post("/ai/draft", requireAuth, async (req, res): Promise<void> => {
  try {
    const entitlement = await checkEntitlement(req.userId!);
    if (entitlement.blocked) { res.status(403).json({ error: entitlement.reason }); return; }

    const parsed = GenerateDraftBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "emailId requis (entier)" });
      return;
    }
    const { emailId } = parsed.data;

    const { data: email, error: emailErr } = await supabaseAdmin
      .from("emails")
      .select("id, sender, subject, body, category_id, project_id")
      .eq("id", emailId)
      .eq("user_id", req.userId!)
      .single();

    if (emailErr || !email) {
      res.status(404).json({ error: "Email introuvable" });
      return;
    }

    let projectContext = "";
    if (email.project_id) {
      const { data: project } = await supabaseAdmin
        .from("projects")
        .select("name, reference, description")
        .eq("id", email.project_id)
        .eq("user_id", req.userId!)
        .single();
      if (project) {
        projectContext = `\nCet email est lie au projet "${project.name}" (ref: ${project.reference})${project.description ? `. Description: ${project.description}` : ""}.`;
      }
    }

    let categoryContext = "";
    if (email.category_id) {
      const { data: category } = await supabaseAdmin
        .from("categories")
        .select("name")
        .eq("id", email.category_id)
        .eq("user_id", req.userId!)
        .single();
      if (category) {
        categoryContext = `\nCategorie de l'email: ${category.name}.`;
      }
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, signature")
      .eq("id", req.userId!)
      .single();

    const userName = (profile?.full_name || "").split(" ")[0] || "Cordialement";
    const userSignature = profile?.signature || "";

    const signatureInstruction = userSignature
      ? `Termine le brouillon avec la signature suivante (telle quelle, ne la modifie pas):\n\n${userSignature}`
      : `Signe avec le prenom "${userName}".`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 1024,
      messages: [
        {
          role: "system",
          content: `Tu es un assistant de redaction d'emails professionnels. Redige la reponse en francais avec un ton professionnel. Tu rediges des reponses claires, polies et professionnelles. ${signatureInstruction}`,
        },
        {
          role: "user",
          content: `Voici un email recu auquel il faut repondre:

Expediteur: ${email.sender}
Sujet: ${email.subject}
Corps:
${email.body}${projectContext}${categoryContext}

Redige une reponse professionnelle et adaptee au contexte. Reponds uniquement avec le texte du brouillon, sans explication supplementaire.`,
        },
      ],
    });

    const draft = completion.choices[0]?.message?.content?.trim() || "";

    res.json({ draft });
  } catch (err: any) {
    console.error("AI draft error:", err);
    res.status(500).json({ error: "Echec de la generation du brouillon" });
  }
});

router.post("/ai/recategorize-uncategorized", requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = req.userId!;

    const entitlement = await checkEntitlement(userId);
    if (entitlement.blocked) { res.status(403).json({ error: entitlement.reason }); return; }

    const { data: categories } = await supabaseAdmin
      .from("categories")
      .select("id, name")
      .eq("user_id", userId);

    const JUNK_NAMES = ["non classé", "non classe", "uncategorized", "niet geclassificeerd"];
    const junkCategoryIds = (categories || [])
      .filter((c: any) => JUNK_NAMES.includes(c.name.toLowerCase()))
      .map((c: any) => c.id);

    const { data: nullEmails } = await supabaseAdmin
      .from("emails")
      .select("id, sender, subject, body")
      .eq("user_id", userId)
      .is("category_id", null)
      .neq("status", "archived")
      .order("created_at", { ascending: false })
      .limit(50);

    let junkEmails: any[] = [];
    if (junkCategoryIds.length > 0) {
      const { data } = await supabaseAdmin
        .from("emails")
        .select("id, sender, subject, body")
        .eq("user_id", userId)
        .in("category_id", junkCategoryIds)
        .neq("status", "archived")
        .order("created_at", { ascending: false })
        .limit(50);
      junkEmails = data || [];
    }

    const emails = [...(nullEmails || []), ...junkEmails].slice(0, 50);

    if (emails.length === 0) {
      res.json({ recategorized: 0, created: [] });
      return;
    }

    const realCategories = (categories || []).filter((c: any) => !JUNK_NAMES.includes(c.name.toLowerCase()));
    const categoryMap = new Map(realCategories.map((c: any) => [c.name, c.id]));
    const categoryNames = Array.from(categoryMap.keys());

    let recategorized = 0;
    const createdCategories: string[] = [];

    for (const email of emails) {
      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          max_completion_tokens: 128,
          messages: [
            { role: "system", content: "Tu es un assistant de tri d'emails professionnel pour une PME. Reponds uniquement en JSON valide. Classe TOUJOURS les emails dans une categorie pertinente. Exemples: LinkedIn/reseaux sociaux → 'Reseaux sociaux', newsletters → 'Newsletters', codes de verification/securite → 'Notifications', factures/paiements → 'Facturation', hebergement/domaines → 'Hebergement'. N'utilise JAMAIS 'Non classe'." },
            { role: "user", content: `Email:\nDe: ${email.sender}\nSujet: ${email.subject}\nCorps: ${(email.body || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 500)}\n\nCategories existantes: ${categoryNames.join(", ") || "Aucune"}\n\nReponds en JSON:\n{"category":"nom de categorie existante OU propose un nouveau nom pertinent (court, professionnel). Ne reponds JAMAIS 'Non classe'."}` },
          ],
        });

        const content = completion.choices[0]?.message?.content ?? "{}";
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        const result = JSON.parse(jsonMatch ? jsonMatch[0] : "{}");
        const catName = result.category || "Non classe";

        if (catName === "Non classe") continue;

        let categoryId = categoryMap.get(catName) || null;
        if (!categoryId) {
          const { data: newCat, error: newCatErr } = await supabaseAdmin
            .from("categories")
            .insert({ user_id: userId, name: catName })
            .select("id")
            .single();
          if (newCat?.id) {
            categoryId = newCat.id;
            categoryMap.set(catName, categoryId);
            categoryNames.push(catName);
            createdCategories.push(catName);
          } else if (newCatErr?.code === "23505") {
            const { data: existing } = await supabaseAdmin
              .from("categories").select("id")
              .eq("user_id", userId).eq("name", catName).maybeSingle();
            categoryId = existing?.id || null;
            if (categoryId) categoryMap.set(catName, categoryId);
          }
        }

        if (categoryId) {
          await supabaseAdmin
            .from("emails")
            .update({ category_id: categoryId })
            .eq("id", email.id)
            .eq("user_id", userId);
          recategorized++;
        }
      } catch (err: any) {
        console.error(`[recategorize] Error for email ${email.id}:`, err.message);
      }
    }

    if (recategorized > 0 && junkCategoryIds.length > 0) {
      for (const junkId of junkCategoryIds) {
        const { count } = await supabaseAdmin
          .from("emails")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("category_id", junkId);
        if (count === 0) {
          await supabaseAdmin.from("categories").delete().eq("id", junkId).eq("user_id", userId);
        }
      }
    }

    res.json({ recategorized, created: createdCategories });
  } catch (err: any) {
    console.error("[recategorize] Error:", err);
    res.status(500).json({ error: "Echec de la re-categorisation" });
  }
});

export default router;
