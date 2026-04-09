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

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();
    const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
    const tomorrowEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 23, 59, 59).toISOString();

    const { data: todayAppts } = await supabaseAdmin
      .from("appointments")
      .select("id, title, start_at, end_at, location, all_day, confirmed, participants")
      .eq("user_id", req.userId!)
      .gte("start_at", todayStart)
      .lte("start_at", todayEnd)
      .order("start_at", { ascending: true });

    const { data: tomorrowAppts } = await supabaseAdmin
      .from("appointments")
      .select("id, title, start_at, end_at, location, all_day, confirmed, participants")
      .eq("user_id", req.userId!)
      .gte("start_at", tomorrowStart)
      .lte("start_at", tomorrowEnd)
      .order("start_at", { ascending: true });

    const mapAppt = (a: any) => ({
      id: a.id,
      title: a.title,
      startAt: a.start_at,
      endAt: a.end_at,
      location: a.location,
      allDay: a.all_day,
      confirmed: a.confirmed,
      participants: a.participants,
    });
    const todayAppointments = (todayAppts || []).map(mapAppt);
    const tomorrowAppointments = (tomorrowAppts || []).map(mapAppt);

    const langInstruction = language === "fr"
      ? "Reponds en francais."
      : "Respond in English.";

    const appointmentContext = todayAppointments.length > 0 || tomorrowAppointments.length > 0
      ? `\n\nRendez-vous aujourd'hui (${todayAppointments.length}): ${todayAppointments.map(a => `${a.title} (${a.startAt})`).join(", ") || "aucun"}\nRendez-vous demain (${tomorrowAppointments.length}): ${tomorrowAppointments.map(a => `${a.title} (${a.startAt})`).join(", ") || "aucun"}`
      : "";

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 2048,
      messages: [
        {
          role: "system",
          content: `Tu es un assistant de gestion d'emails et d'agenda. ${langInstruction} Genere un bilan quotidien structure incluant les rendez-vous.`,
        },
        {
          role: "user",
          content: `Voici les ${allEmails.length} derniers emails de l'utilisateur:
${allEmails.map(e => `- [${e.priority}] ${e.sender}: ${e.subject} ${e.summary ? `(${e.summary})` : ""}`).join("\n")}

Statistiques: ${urgent} urgents, ${moyen} moyens, ${faible} faibles, ${pending} en attente.${appointmentContext}

Genere un JSON avec:
{
  "summary": "resume general de la journee en 2-3 phrases (incluant les RDV si pertinent)",
  "advice": "un conseil personnalise pour ameliorer la gestion des emails et de l'agenda",
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
      todayAppointments,
      tomorrowAppointments,
    });
  } catch {
    res.status(500).json({ error: "Failed to generate daily summary" });
  }
});

const LANG_PROMPTS: Record<string, { system: string; uncategorized: string; noCategory: string; noProject: string; analyzing: string; projectIntro: string; projectNote: string }> = {
  fr: {
    system: "Tu es un assistant de gestion d'emails. Reponds uniquement en JSON valide.",
    uncategorized: "Non classe",
    noCategory: "Aucune categorie",
    noProject: "Aucun",
    analyzing: "Email en cours d'analyse",
    projectIntro: "Projets actifs",
    projectNote: "Si l'email semble concerner un de ces projets, indique son nom exact dans \"project\". Sinon, mets \"Aucun\".",
  },
  en: {
    system: "You are an email management assistant. Respond only in valid JSON.",
    uncategorized: "Uncategorized",
    noCategory: "No category",
    noProject: "None",
    analyzing: "Email being analyzed",
    projectIntro: "Active projects",
    projectNote: "If the email seems related to one of these projects, indicate its exact name in \"project\". Otherwise, put \"None\".",
  },
  nl: {
    system: "Je bent een e-mailbeheerassistent. Antwoord alleen in geldige JSON.",
    uncategorized: "Niet geclassificeerd",
    noCategory: "Geen categorie",
    noProject: "Geen",
    analyzing: "E-mail wordt geanalyseerd",
    projectIntro: "Actieve projecten",
    projectNote: "Als de e-mail betrekking lijkt te hebben op een van deze projecten, geef dan de exacte naam op in \"project\". Anders, vul \"Geen\" in.",
  },
};

router.post("/ai/triage", requireAuth, async (req, res): Promise<void> => {
  try {
    const entitlement = await checkEntitlement(req.userId!);
    if (entitlement.blocked) { res.status(403).json({ error: entitlement.reason }); return; }

    const parsed = TriageEmailBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const userLang = (req.body.lang || "fr").substring(0, 2).toLowerCase();
    const lp = LANG_PROMPTS[userLang] || LANG_PROMPTS.fr;

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
      projectContext = `\n\n${lp.projectIntro}: ${projectList.join(", ")}\n${lp.projectNote}`;
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 1024,
      messages: [
        {
          role: "system",
          content: lp.system,
        },
        {
          role: "user",
          content: `Email:
From: ${parsed.data.sender}
Subject: ${parsed.data.subject}
Body: ${parsed.data.body}

Available categories: ${categoryNames.join(", ") || lp.noCategory}${projectContext}

Respond in JSON:
{
  "category": "exact category name or '${lp.uncategorized}'",
  "priority": "urgent" | "moyen" | "faible",
  "summary": "1-sentence summary in ${userLang}",
  "tasks": ["task 1", "task 2"],
  "project": "project name or ${lp.noProject}"
}

IMPORTANT for tasks: Each task must be explicit and self-contained. Always include WHO (sender/service) and WHAT. Do NOT generate tasks for purely informational emails (newsletters, automatic notifications, read confirmations). Generate tasks only when a concrete ACTION is required. Write tasks in ${userLang}.`,
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
        category: lp.uncategorized,
        priority: "moyen",
        summary: lp.analyzing,
        tasks: [],
        project: lp.noProject,
      };
    }

    res.json({
      category: triageResult.category || lp.uncategorized,
      priority: triageResult.priority || "moyen",
      summary: triageResult.summary || lp.analyzing,
      tasks: triageResult.tasks || [],
      project: triageResult.project || lp.noProject,
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
    const userLang = (req.body?.lang || "fr").substring(0, 2).toLowerCase();
    const lp = LANG_PROMPTS[userLang] || LANG_PROMPTS.fr;

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

    const recatSystemPrompts: Record<string, string> = {
      fr: "Tu es un assistant de tri d'emails professionnel pour une PME. Reponds uniquement en JSON valide. Classe TOUJOURS les emails dans une categorie pertinente. N'utilise JAMAIS 'Non classe'.",
      en: "You are a professional email sorting assistant for an SME. Respond only in valid JSON. ALWAYS classify emails into a relevant category. NEVER use 'Uncategorized'.",
      nl: "Je bent een professionele e-mailsorteerassistent voor een KMO. Antwoord alleen in geldige JSON. Classificeer e-mails ALTIJD in een relevante categorie. Gebruik NOOIT 'Niet geclassificeerd'.",
    };

    for (const email of emails) {
      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          max_completion_tokens: 128,
          messages: [
            { role: "system", content: recatSystemPrompts[userLang] || recatSystemPrompts.fr },
            { role: "user", content: `Email:\nFrom: ${email.sender}\nSubject: ${email.subject}\nBody: ${(email.body || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 500)}\n\nExisting categories: ${categoryNames.join(", ") || lp.noCategory}\n\nRespond in JSON:\n{"category":"existing category name OR propose a new relevant name (short, professional, in ${userLang}). NEVER respond '${lp.uncategorized}'."}` },
          ],
        });

        const content = completion.choices[0]?.message?.content ?? "{}";
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        const result = JSON.parse(jsonMatch ? jsonMatch[0] : "{}");
        const catName = result.category || lp.uncategorized;

        if (JUNK_NAMES.includes(catName.toLowerCase())) continue;

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

router.post("/ai/conversation-summary", requireAuth, async (req, res): Promise<void> => {
  try {
    const entitlement = await checkEntitlement(req.userId!);
    if (entitlement.blocked) { res.status(403).json({ error: entitlement.reason }); return; }

    const { thread } = req.body;
    if (!thread || !Array.isArray(thread) || thread.length === 0) {
      res.status(400).json({ error: "thread (array) requis" }); return;
    }

    const conversation = thread.map((msg: any) =>
      `[${msg.role === "sent" ? "ENVOYÉ" : "REÇU"}] De: ${msg.sender || "?"} | Objet: ${msg.subject || ""}\n${(msg.body || "").substring(0, 1000)}`
    ).join("\n---\n");

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        { role: "system", content: "Tu es un assistant professionnel. Résume cette conversation email en français en 2-3 phrases. Identifie: le sujet principal, les décisions prises, et les actions en suspens." },
        { role: "user", content: conversation },
      ],
    });

    res.json({ summary: completion.choices[0]?.message?.content || "" });
  } catch (err: any) {
    res.status(500).json({ error: "Erreur de résumé: " + err.message });
  }
});

router.post("/ai/detect-followups", requireAuth, async (req, res): Promise<void> => {
  try {
    const entitlement = await checkEntitlement(req.userId!);
    if (entitlement.blocked) { res.status(403).json({ error: entitlement.reason }); return; }

    const { emails } = req.body;
    if (!emails || !Array.isArray(emails)) {
      res.status(400).json({ error: "emails (array) requis" }); return;
    }

    const emailSummaries = emails.slice(0, 20).map((e: any) =>
      `ID: ${e.id} | De: ${e.sender || "?"} | Objet: ${e.subject || ""} | Résumé: ${e.summary || (e.body || "").substring(0, 300)}`
    ).join("\n");

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        { role: "system", content: `Tu analyses des emails professionnels. Pour chaque email qui nécessite un suivi (attente de réponse, action promise, deadline mentionnée, relance nécessaire), crée une suggestion de suivi.

Réponds en JSON strict:
{
  "followups": [
    {
      "emailId": <number>,
      "title": "<titre du suivi>",
      "reason": "<pourquoi un suivi est nécessaire>",
      "suggestedDueDate": "<YYYY-MM-DD ou null>",
      "urgency": "haute" | "moyenne" | "basse"
    }
  ]
}

Si aucun suivi n'est nécessaire, retourne {"followups": []}.` },
        { role: "user", content: emailSummaries },
      ],
      response_format: { type: "json_object" },
    });

    const parsed = JSON.parse(completion.choices[0]?.message?.content || '{"followups":[]}');
    res.json(parsed);
  } catch (err: any) {
    res.status(500).json({ error: "Erreur de détection: " + err.message });
  }
});

router.post("/ai/generate-relance", requireAuth, async (req, res): Promise<void> => {
  try {
    const entitlement = await checkEntitlement(req.userId!);
    if (entitlement.blocked) { res.status(403).json({ error: entitlement.reason }); return; }

    const { originalEmail, context, signature } = req.body;
    if (!originalEmail) {
      res.status(400).json({ error: "originalEmail requis" }); return;
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.5,
      messages: [
        { role: "system", content: `Tu es un assistant professionnel. Génère un email de relance poli et professionnel en français.
Le ton doit être courtois mais ferme. Mentionne le sujet original et demande une mise à jour.
${signature ? `\nSignature à utiliser:\n${signature}` : ""}` },
        { role: "user", content: `Email original:\nDe: ${originalEmail.sender || "?"}\nObjet: ${originalEmail.subject || ""}\nContenu: ${(originalEmail.body || "").substring(0, 1500)}\n${context ? `\nContexte supplémentaire: ${context}` : ""}` },
      ],
    });

    res.json({
      subject: `Relance: ${originalEmail.subject || ""}`,
      body: completion.choices[0]?.message?.content || "",
    });
  } catch (err: any) {
    res.status(500).json({ error: "Erreur de génération: " + err.message });
  }
});

router.post("/ai/extract-appointment", requireAuth, async (req, res): Promise<void> => {
  try {
    const entitlement = await checkEntitlement(req.userId!);
    if (entitlement.blocked) { res.status(403).json({ error: entitlement.reason }); return; }

    const { emailId } = req.body;
    if (!emailId) { res.status(400).json({ error: "emailId requis" }); return; }

    const { data: email, error: emailErr } = await supabaseAdmin
      .from("emails")
      .select("id, sender, subject, body, summary")
      .eq("id", emailId)
      .eq("user_id", req.userId!)
      .single();

    if (emailErr || !email) { res.status(404).json({ error: "Email introuvable" }); return; }

    const cleanBody = (email.body || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 1500);
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      max_completion_tokens: 512,
      messages: [
        {
          role: "system",
          content: `Tu analyses un email pour extraire les informations d'un rendez-vous potentiel. Réponds en JSON strict:
{
  "title": "titre du RDV (utilise le sujet de l'email si pas de titre explicite)",
  "description": "description ou contexte du RDV",
  "location": "lieu mentionné ou null",
  "startAt": "ISO datetime ou null",
  "endAt": "ISO datetime ou null",
  "participants": "noms/emails des participants",
  "hasAppointment": true/false
}
Extrais le maximum d'informations structurées même si une date exacte n'est pas mentionnée.`,
        },
        {
          role: "user",
          content: `De: ${email.sender}\nObjet: ${email.subject}\nCorps: ${cleanBody}`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content ?? "{}";
    const result = JSON.parse(content);

    res.json({
      title: result.title || email.subject || "",
      description: result.description || "",
      location: result.location || "",
      startAt: result.startAt || null,
      endAt: result.endAt || null,
      participants: result.participants || email.sender || "",
      hasAppointment: result.hasAppointment ?? false,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Erreur d'extraction: " + err.message });
  }
});

router.post("/ai/detect-appointments", requireAuth, async (req, res): Promise<void> => {
  try {
    const entitlement = await checkEntitlement(req.userId!);
    if (entitlement.blocked) { res.status(403).json({ error: entitlement.reason }); return; }

    const lang = req.body?.lang || "fr";
    const emailId = req.body?.emailId;
    const forceRescan = req.body?.forceRescan || false;

    if (forceRescan) {
      await supabaseAdmin
        .from("appointments")
        .delete()
        .eq("user_id", req.userId!)
        .eq("confirmed", false);
      logger.info("[detect-appointments] Purged unconfirmed appointments for rescan");
    }

    let emails: any[];
    if (emailId) {
      const { data: email, error: emailErr } = await supabaseAdmin
        .from("emails")
        .select("id, sender, subject, body, summary, created_at")
        .eq("id", emailId)
        .eq("user_id", req.userId!)
        .single();
      if (emailErr || !email) { res.status(404).json({ error: "Email introuvable" }); return; }
      emails = [email];
    } else {
      const { data } = await supabaseAdmin
        .from("emails")
        .select("id, sender, subject, body, summary, created_at")
        .eq("user_id", req.userId!)
        .order("created_at", { ascending: false })
        .limit(30);
      emails = data || [];
    }

    if (emails.length === 0) {
      res.json({ appointments: [], count: 0 });
      return;
    }

    const langInstruction = lang === "fr"
      ? "Réponds en français."
      : lang === "nl"
        ? "Antwoord in het Nederlands."
        : "Respond in English.";

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      max_completion_tokens: 2048,
      messages: [
        {
          role: "system",
          content: `Tu es un assistant qui détecte les rendez-vous, réunions et événements mentionnés dans des emails. ${langInstruction}
La date actuelle est le ${new Date().toISOString().split("T")[0]} (année ${new Date().getFullYear()}).
Analyse les emails et identifie les rendez-vous avec date, heure, lieu et description.
IMPORTANT: Utilise l'année ${new Date().getFullYear()} pour les dates si aucune année n'est précisée dans l'email.
Renvoie un JSON avec le format:
{ "appointments": [{ "title": "...", "description": "...", "location": "...", "startAt": "ISO datetime", "endAt": "ISO datetime", "allDay": false, "emailId": email_id_number, "participants": "..." }] }
N'invente PAS de RDV. Détecte uniquement si une date/heure concrète est mentionnée. Si pas de rendez-vous, renvoie un tableau vide.`,
        },
        {
          role: "user",
          content: `Voici ${emails.length === 1 ? "l'email" : "les derniers emails"}:\n${emails.map(e => `[ID:${e.id}] De: ${e.sender} | Objet: ${e.subject}\n${(e.body || e.summary || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().substring(0, 500)}`).join("\n---\n")}`,
        },
      ],
    });

    let detected: any[] = [];
    try {
      const content = completion.choices[0]?.message?.content ?? "{}";
      logger.info({ rawContent: content }, "[detect-appointments] OpenAI response");
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : "{}");
      detected = parsed.appointments || [];
    } catch {
      detected = [];
    }

    logger.info({ detectedCount: detected.length, detected: detected.map((a: any) => ({ title: a.title, startAt: a.startAt, emailId: a.emailId })) }, "[detect-appointments] Parsed results");

    const created: any[] = [];
    for (const apt of detected) {
      if (!apt.title || !apt.startAt) continue;

      if (apt.emailId) {
        const { data: existingApt } = await supabaseAdmin
          .from("appointments")
          .select("id")
          .eq("user_id", req.userId!)
          .eq("email_id", apt.emailId)
          .maybeSingle();
        if (existingApt) {
          logger.info({ emailId: apt.emailId, existingId: existingApt.id }, "[detect-appointments] Duplicate skipped");
          continue;
        }
      }

      const endAt = apt.endAt || new Date(new Date(apt.startAt).getTime() + 3600000).toISOString();
      const { data, error } = await supabaseAdmin
        .from("appointments")
        .insert({
          user_id: req.userId!,
          title: apt.title,
          description: apt.description || null,
          location: apt.location || null,
          start_at: apt.startAt,
          end_at: endAt,
          all_day: apt.allDay || false,
          email_id: apt.emailId || null,
          reminder_minutes: 30,
          confirmed: false,
          participants: apt.participants || null,
        })
        .select()
        .single();

      if (error) {
        logger.error({ err: error.message, code: error.code, title: apt.title, emailId: apt.emailId }, "[detect-appointments] Insert failed");
      }
      if (!error && data) created.push({
        id: data.id,
        userId: data.user_id,
        title: data.title,
        description: data.description,
        location: data.location,
        startAt: data.start_at,
        endAt: data.end_at,
        allDay: data.all_day,
        emailId: data.email_id,
        projectId: data.project_id,
        reminderMinutes: data.reminder_minutes,
        confirmed: data.confirmed,
        participants: data.participants,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      });
    }

    res.json({ appointments: created, count: created.length });
  } catch (err: any) {
    res.status(500).json({ error: "Erreur de détection: " + err.message });
  }
});

export default router;
