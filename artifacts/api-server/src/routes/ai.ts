import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, emailsTable, categoriesTable } from "@workspace/db";
import { GenerateDailySummaryBody, TriageEmailBody } from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.post("/ai/daily-summary", requireAuth, async (req, res): Promise<void> => {
  const parsed = GenerateDailySummaryBody.safeParse(req.body);
  const language = parsed.success && parsed.data.language ? parsed.data.language : "fr";

  const emails = await db
    .select({
      id: emailsTable.id,
      sender: emailsTable.sender,
      subject: emailsTable.subject,
      priority: emailsTable.priority,
      summary: emailsTable.summary,
      status: emailsTable.status,
    })
    .from(emailsTable)
    .where(eq(emailsTable.userId, req.userId!))
    .orderBy(desc(emailsTable.createdAt))
    .limit(50);

  const urgent = emails.filter(e => e.priority === "urgent").length;
  const moyen = emails.filter(e => e.priority === "moyen").length;
  const faible = emails.filter(e => e.priority === "faible").length;
  const pending = emails.filter(e => e.status === "classe").length;

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
        content: `Voici les ${emails.length} derniers emails de l'utilisateur:
${emails.map(e => `- [${e.priority}] ${e.sender}: ${e.subject} ${e.summary ? `(${e.summary})` : ""}`).join("\n")}

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

  let aiResponse: { summary: string; advice: string; keyEmailIds: number[] };
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

  const keyEmails = emails
    .filter(e => aiResponse.keyEmailIds?.includes(e.id) || e.priority === "urgent")
    .slice(0, 5)
    .map(e => ({
      id: e.id,
      sender: e.sender,
      subject: e.subject,
      priority: e.priority,
      summary: e.summary ?? e.subject,
    }));

  const score = Math.max(0, Math.round(100 - (urgent / Math.max(emails.length, 1)) * 40 - (pending / Math.max(emails.length, 1)) * 30));

  res.json({
    score,
    summary: aiResponse.summary || "Aucun email a analyser.",
    keyEmails,
    stats: {
      total: emails.length,
      urgent,
      moyen,
      faible,
      pending,
    },
    advice: aiResponse.advice || "Continuez a bien gerer vos emails.",
  });
});

router.post("/ai/triage", requireAuth, async (req, res): Promise<void> => {
  const parsed = TriageEmailBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const categories = await db
    .select({ name: categoriesTable.name })
    .from(categoriesTable)
    .where(eq(categoriesTable.userId, req.userId!));

  const categoryNames = categories.map(c => c.name);

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
});

export default router;
