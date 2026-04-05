import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { GenerateDailySummaryBody, TriageEmailBody } from "@workspace/api-zod";
import OpenAI from "openai";
import { requireAuth } from "../middlewares/auth";

const openai = new OpenAI({
  apiKey: process.env["AI_INTEGRATIONS_OPENAI_API_KEY"] || process.env["OPENAI_API_KEY"],
  baseURL: process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"] || undefined,
});

const router: IRouter = Router();

router.post("/ai/daily-summary", requireAuth, async (req, res): Promise<void> => {
  try {
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

Categories disponibles: ${categoryNames.join(", ") || "Aucune categorie"}

Reponds en JSON:
{
  "category": "nom exact de la categorie ou 'Non classe'",
  "priority": "urgent" | "moyen" | "faible",
  "summary": "resume en 1 phrase",
  "tasks": ["tache 1", "tache 2"]
}`,
        },
      ],
    });

    let triageResult: { category: string; priority: string; summary: string; tasks: string[] };
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
      };
    }

    res.json({
      category: triageResult.category || "Non classe",
      priority: triageResult.priority || "moyen",
      summary: triageResult.summary || "Email en cours d'analyse",
      tasks: triageResult.tasks || [],
    });
  } catch {
    res.status(500).json({ error: "Failed to triage email" });
  }
});

export default router;
