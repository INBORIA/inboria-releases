import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { GenerateDailySummaryBody, GenerateDraftBody } from "@workspace/api-zod";
import OpenAI from "openai";
import { requireAuth } from "../middlewares/auth";
import { logger } from "../lib/logger";
import { getKnowledgeBase, getSystemPrompt } from "../services/knowledge-base";
import { AI_COST, checkEntitlement, consumeAiCredits, type AiEventType } from "../services/credits";

const openai = new OpenAI({
  apiKey: process.env["OPENAI_API_KEY"],
});

const router: IRouter = Router();

router.post("/ai/daily-summary", requireAuth, async (req, res): Promise<void> => {
  try {
    const entitlement = await checkEntitlement(req.userId!, AI_COST.daily_summary);
    if (entitlement.blocked) { res.status(403).json({ error: entitlement.reason }); return; }

    const parsed = GenerateDailySummaryBody.safeParse(req.body);
    const rawLang = parsed.success && parsed.data.language ? parsed.data.language : "fr";
    const language = rawLang.substring(0, 2).toLowerCase();

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

    const briefingPrompts: Record<string, { system: string; user: string }> = {
      fr: {
        system: `Tu es un assistant de gestion d'emails et d'agenda pour Inboria.
RÈGLE ABSOLUE : Tu DOIS répondre UNIQUEMENT et ENTIÈREMENT en FRANÇAIS.
Même si les emails sont en anglais ou en néerlandais, TOUT ton texte doit être en français.
Le champ "summary" doit être en français.
Le champ "advice" doit être en français.
Aucun mot anglais ou néerlandais dans ta réponse JSON.`,
        user: `Voici les ${allEmails.length} derniers emails de l'utilisateur :
${allEmails.map(e => `- [${e.priority}] ${e.sender}: ${e.subject} ${e.summary ? `(${e.summary})` : ""}`).join("\n")}

Statistiques : ${urgent} urgents, ${moyen} moyens, ${faible} faibles, ${pending} en attente.${
          todayAppointments.length > 0 || tomorrowAppointments.length > 0
            ? `\n\nRendez-vous aujourd'hui (${todayAppointments.length}) : ${todayAppointments.map(a => `${a.title} (${a.startAt})`).join(", ") || "aucun"}\nRendez-vous demain (${tomorrowAppointments.length}) : ${tomorrowAppointments.map(a => `${a.title} (${a.startAt})`).join(", ") || "aucun"}`
            : ""
        }

IMPORTANT : Réponds UNIQUEMENT en français. Génère un objet JSON avec ces 3 champs :
{
  "summary": "(résumé général de la journée en 2-3 phrases EN FRANÇAIS, incluant les RDV si pertinent)",
  "advice": "(un conseil personnalisé EN FRANÇAIS pour améliorer la gestion des emails et de l'agenda)",
  "keyEmailIds": ["id1", "id2", ...]
}
Rappel : les valeurs de "summary" et "advice" DOIVENT être rédigées entièrement en français.`,
      },
      en: {
        system: `You are an email and calendar management assistant for Inboria.
ABSOLUTE RULE: You MUST respond ONLY and ENTIRELY in ENGLISH.
Even if emails are in French or Dutch, ALL your text must be in English.
The "summary" field must be in English.
The "advice" field must be in English.
No French or Dutch words in your JSON response.`,
        user: `Here are the user's ${allEmails.length} latest emails:
${allEmails.map(e => `- [${e.priority}] ${e.sender}: ${e.subject} ${e.summary ? `(${e.summary})` : ""}`).join("\n")}

Stats: ${urgent} urgent, ${moyen} medium, ${faible} low, ${pending} pending.${
          todayAppointments.length > 0 || tomorrowAppointments.length > 0
            ? `\n\nToday's appointments (${todayAppointments.length}): ${todayAppointments.map(a => `${a.title} (${a.startAt})`).join(", ") || "none"}\nTomorrow's appointments (${tomorrowAppointments.length}): ${tomorrowAppointments.map(a => `${a.title} (${a.startAt})`).join(", ") || "none"}`
            : ""
        }

IMPORTANT: Respond ONLY in English. Generate a JSON object with these 3 fields:
{
  "summary": "(general overview of the day in 2-3 sentences IN ENGLISH, including appointments if relevant)",
  "advice": "(a personalized tip IN ENGLISH to improve email and calendar management)",
  "keyEmailIds": ["id1", "id2", ...]
}
Reminder: the values of "summary" and "advice" MUST be written entirely in English.`,
      },
      nl: {
        system: `Je bent een e-mail- en agendabeheerassistent voor Inboria.
ABSOLUTE REGEL: Je MOET UITSLUITEND en VOLLEDIG in het NEDERLANDS antwoorden.
Zelfs als de e-mails in het Engels of Frans zijn, MOET al je tekst in het Nederlands zijn.
Het veld "summary" moet in het Nederlands zijn.
Het veld "advice" moet in het Nederlands zijn.
Geen Engelse of Franse woorden in je JSON-antwoord.`,
        user: `Hier zijn de ${allEmails.length} laatste e-mails van de gebruiker:
${allEmails.map(e => `- [${e.priority}] ${e.sender}: ${e.subject} ${e.summary ? `(${e.summary})` : ""}`).join("\n")}

Statistieken: ${urgent} urgent, ${moyen} gemiddeld, ${faible} laag, ${pending} in afwachting.${
          todayAppointments.length > 0 || tomorrowAppointments.length > 0
            ? `\n\nAfspraken vandaag (${todayAppointments.length}): ${todayAppointments.map(a => `${a.title} (${a.startAt})`).join(", ") || "geen"}\nAfspraken morgen (${tomorrowAppointments.length}): ${tomorrowAppointments.map(a => `${a.title} (${a.startAt})`).join(", ") || "geen"}`
            : ""
        }

BELANGRIJK: Antwoord UITSLUITEND in het Nederlands. Genereer een JSON-object met deze 3 velden:
{
  "summary": "(algemeen overzicht van de dag in 2-3 zinnen IN HET NEDERLANDS, inclusief afspraken indien relevant)",
  "advice": "(een gepersonaliseerd advies IN HET NEDERLANDS om e-mail- en agendabeheer te verbeteren)",
  "keyEmailIds": ["id1", "id2", ...]
}
Herinnering: de waarden van "summary" en "advice" MOETEN volledig in het Nederlands zijn geschreven.`,
      },
    };
    const prompt = briefingPrompts[language] || briefingPrompts.fr;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 2048,
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
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

    const billing = await consumeAiCredits(req.userId!, "daily_summary");
    if (!billing.ok) {
      res.status(500).json({ error: "Echec de facturation, veuillez reessayer." });
      return;
    }
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

router.post("/ai/draft", requireAuth, async (req, res): Promise<void> => {
  try {
    const entitlement = await checkEntitlement(req.userId!, AI_COST.draft);
    if (entitlement.blocked) { res.status(403).json({ error: entitlement.reason }); return; }

    const parsed = GenerateDraftBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "emailId requis (entier)" });
      return;
    }
    const { emailId } = parsed.data;

    const { data: email, error: emailErr } = await supabaseAdmin
      .from("emails")
      .select("id, sender, subject, body, category_id, project_id, connection_id")
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
      .select("full_name")
      .eq("id", req.userId!)
      .single();

    let userSignature = "";
    if (email.connection_id) {
      const { data: connection } = await supabaseAdmin
        .from("email_connections")
        .select("signature")
        .eq("id", email.connection_id)
        .single();
      userSignature = (connection?.signature || "").trim();
    }

    const userName = (profile?.full_name || "").split(" ")[0] || "Cordialement";

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

    const billing = await consumeAiCredits(req.userId!, "draft");
    if (!billing.ok) {
      res.status(500).json({ error: "Echec de facturation, veuillez reessayer." });
      return;
    }
    res.json({ draft });
  } catch (err: any) {
    console.error("AI draft error:", err);
    res.status(500).json({ error: "Echec de la generation du brouillon" });
  }
});

router.post("/ai/forward-intro", requireAuth, async (req, res): Promise<void> => {
  try {
    const entitlement = await checkEntitlement(req.userId!, AI_COST.draft);
    if (entitlement.blocked) { res.status(403).json({ error: entitlement.reason }); return; }

    const emailId = Number(req.body?.emailId);
    if (!Number.isInteger(emailId) || emailId <= 0) {
      res.status(400).json({ error: "emailId requis (entier positif)" });
      return;
    }
    const recipient = typeof req.body?.to === "string" ? req.body.to.trim() : "";
    const note = typeof req.body?.note === "string" ? req.body.note.trim().slice(0, 500) : "";

    const { data: email, error: emailErr } = await supabaseAdmin
      .from("emails")
      .select("id, sender, subject, body, connection_id")
      .eq("id", emailId)
      .eq("user_id", req.userId!)
      .single();

    if (emailErr || !email) {
      res.status(404).json({ error: "Email introuvable" });
      return;
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", req.userId!)
      .single();

    let userSignature = "";
    if (email.connection_id) {
      const { data: connection } = await supabaseAdmin
        .from("email_connections")
        .select("signature")
        .eq("id", email.connection_id)
        .single();
      userSignature = (connection?.signature || "").trim();
    }

    const userName = (profile?.full_name || "").split(" ")[0] || "Cordialement";
    const signatureInstruction = userSignature
      ? `Termine le message par la signature suivante telle quelle :\n\n${userSignature}`
      : `Signe simplement avec le prenom \"${userName}\".`;

    const recipientHint = recipient ? `Le destinataire est : ${recipient}.` : "Le destinataire n'est pas precise.";
    const noteHint = note ? `Contexte fourni par l'utilisateur a integrer : ${note}` : "";

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 400,
      messages: [
        {
          role: "system",
          content: `Tu rediges un court message d'introduction (3-5 lignes maximum) qui sera place AU-DESSUS d'un email transfere. Ton professionnel, courtois, en francais. N'inclus pas le message original cite, n'inclus pas de salutation type \"Bonjour [Prenom]\" si le prenom est inconnu - utilise une formulation neutre. ${signatureInstruction}`,
        },
        {
          role: "user",
          content: `${recipientHint} ${noteHint}\n\nVoici l'email a transferer (pour contexte uniquement, ne le recopie pas) :\n\nExpediteur original : ${email.sender}\nObjet : ${email.subject}\nCorps :\n${(email.body || "").slice(0, 2000)}\n\nRedige uniquement le court message d'introduction (3-5 lignes max) qui sera ajoute en haut du transfert. Reponds uniquement avec le texte, sans guillemets ni explication.`,
        },
      ],
    });

    const intro = completion.choices[0]?.message?.content?.trim() || "";

    const billing = await consumeAiCredits(req.userId!, "draft");
    if (!billing.ok) {
      res.status(500).json({ error: "Echec de facturation, veuillez reessayer." });
      return;
    }
    res.json({ intro });
  } catch (err: any) {
    logger.error({ err: err?.message, stack: err?.stack }, "[forward-intro] error");
    res.status(500).json({ error: "Echec de la generation du message" });
  }
});

router.post("/ai/recategorize-uncategorized", requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = req.userId!;
    const userLang = (req.body?.lang || "fr").substring(0, 2).toLowerCase();
    const lp = LANG_PROMPTS[userLang] || LANG_PROMPTS.fr;

    const entitlement = await checkEntitlement(userId, AI_COST.recategorize_uncategorized);
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

    const billing = await consumeAiCredits(req.userId!, "recategorize_uncategorized");
    if (!billing.ok) {
      res.status(500).json({ error: "Echec de facturation, veuillez reessayer." });
      return;
    }
    res.json({ recategorized, created: createdCategories });
  } catch (err: any) {
    console.error("[recategorize] Error:", err);
    res.status(500).json({ error: "Echec de la re-categorisation" });
  }
});

router.post("/ai/conversation-summary", requireAuth, async (req, res): Promise<void> => {
  try {
    const entitlement = await checkEntitlement(req.userId!, AI_COST.conversation_summary);
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

    const billing = await consumeAiCredits(req.userId!, "conversation_summary");
    if (!billing.ok) {
      res.status(500).json({ error: "Echec de facturation, veuillez reessayer." });
      return;
    }
    res.json({ summary: completion.choices[0]?.message?.content || "" });
  } catch (err: any) {
    res.status(500).json({ error: "Erreur de résumé: " + err.message });
  }
});

router.post("/ai/extract-appointment", requireAuth, async (req, res): Promise<void> => {
  try {
    const entitlement = await checkEntitlement(req.userId!, AI_COST.extract_appointment);
    if (entitlement.blocked) { res.status(403).json({ error: entitlement.reason }); return; }

    const { emailId } = req.body;
    if (!emailId) { res.status(400).json({ error: "emailId requis" }); return; }

    const { data: extractProfile } = await supabaseAdmin
      .from("profiles")
      .select("timezone")
      .eq("id", req.userId!)
      .single();
    const extractTimezone = extractProfile?.timezone || "Europe/Brussels";

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
          content: `Tu analyses un email pour extraire les informations d'un rendez-vous potentiel.
La date actuelle est le ${new Date().toISOString().split("T")[0]} (année ${new Date().getFullYear()}).
Le fuseau horaire de l'utilisateur est ${extractTimezone}.
IMPORTANT: Utilise l'année ${new Date().getFullYear()} si aucune année n'est précisée. Inclus le décalage UTC correct pour le fuseau ${extractTimezone} dans les dates ISO (ex: "2026-04-10T11:00:00+02:00" pour CEST).
Réponds en JSON strict:
{
  "title": "titre du RDV (utilise le sujet de l'email si pas de titre explicite)",
  "description": "description ou contexte du RDV",
  "location": "lieu mentionné ou null",
  "startAt": "ISO datetime with offset ou null",
  "endAt": "ISO datetime with offset ou null",
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

    const billing = await consumeAiCredits(req.userId!, "extract_appointment");
    if (!billing.ok) {
      res.status(500).json({ error: "Echec de facturation, veuillez reessayer." });
      return;
    }
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
    const entitlement = await checkEntitlement(req.userId!, AI_COST.detect_appointments);
    if (entitlement.blocked) { res.status(403).json({ error: entitlement.reason }); return; }

    const lang = req.body?.lang || "fr";
    const emailId = req.body?.emailId;
    const forceRescan = req.body?.forceRescan || false;

    const { data: userProfile } = await supabaseAdmin
      .from("profiles")
      .select("timezone")
      .eq("id", req.userId!)
      .single();
    const userTimezone = userProfile?.timezone || "Europe/Brussels";

    if (forceRescan) {
      try {
        const { error: delErr } = await supabaseAdmin
          .from("appointments")
          .delete()
          .eq("user_id", req.userId!)
          .eq("confirmed", false);
        if (delErr) {
          logger.warn({ err: delErr.message }, "[detect-appointments] Purge failed (non-fatal)");
        } else {
          logger.info("[detect-appointments] Purged unconfirmed appointments for rescan");
        }
      } catch (purgeErr: any) {
        logger.warn({ err: purgeErr.message }, "[detect-appointments] Purge exception (non-fatal)");
      }
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
Le fuseau horaire de l'utilisateur est ${userTimezone}.
Analyse les emails et identifie les rendez-vous avec date, heure, lieu et description.
IMPORTANT: Utilise l'année ${new Date().getFullYear()} pour les dates si aucune année n'est précisée dans l'email.
IMPORTANT: Les heures dans les emails sont en heure locale de l'utilisateur (${userTimezone}). Tu DOIS inclure le décalage UTC correct dans les dates ISO. Par exemple pour CEST: "2026-04-10T11:00:00+02:00".
Renvoie un JSON avec le format:
{ "appointments": [{ "title": "...", "description": "...", "location": "...", "startAt": "ISO datetime with offset", "endAt": "ISO datetime with offset", "allDay": false, "emailId": email_id_number, "participants": "..." }] }
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

    const billing = await consumeAiCredits(req.userId!, "detect_appointments");
    if (!billing.ok) {
      res.status(500).json({ error: "Echec de facturation, veuillez reessayer." });
      return;
    }
    res.json({ appointments: created, count: created.length });
  } catch (err: any) {
    logger.error({ err: err.message, stack: err.stack }, "[detect-appointments] Unhandled error");
    res.status(500).json({ error: "Erreur de détection: " + err.message });
  }
});

const supportChatRateLimit = new Map<string, number[]>();

router.post("/ai/support-chat", requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = req.userId!;

    const entitlement = await checkEntitlement(userId, AI_COST.support_chat);
    if (entitlement.blocked) {
      res.status(403).json({ error: entitlement.reason });
      return;
    }

    const now = Date.now();
    const userRequests = supportChatRateLimit.get(userId) || [];
    const recentRequests = userRequests.filter((t) => now - t < 60_000);
    if (recentRequests.length >= 10) {
      res.status(429).json({ error: "Too many requests. Please wait a moment." });
      return;
    }
    recentRequests.push(now);
    supportChatRateLimit.set(userId, recentRequests);

    const { message, language, history } = req.body as {
      message?: string;
      language?: string;
      history?: Array<{ role: "user" | "assistant"; content: string }>;
    };

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      res.status(400).json({ error: "Message is required" });
      return;
    }

    if (message.trim().length > 2000) {
      res.status(400).json({ error: "Message too long (max 2000 characters)" });
      return;
    }

    const langCode = typeof language === "string" ? language.substring(0, 2).toLowerCase() : "fr";
    const lang = (langCode === "en" || langCode === "nl" ? langCode : "fr") as "fr" | "en" | "nl";
    const kb = getKnowledgeBase(lang);
    const systemPrompt = getSystemPrompt(lang);

    const conversationHistory: Array<{ role: "user" | "assistant"; content: string }> = [];
    if (Array.isArray(history)) {
      const recentHistory = history.slice(-6);
      for (const msg of recentHistory) {
        if (msg.role === "user" || msg.role === "assistant") {
          conversationHistory.push({ role: msg.role, content: String(msg.content).slice(0, 2000) });
        }
      }
    }

    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      {
        role: "system",
        content: `${systemPrompt}\n\n--- KNOWLEDGE BASE ---\n${kb}`,
      },
      ...conversationHistory,
      { role: "user", content: message.trim() },
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      max_tokens: 800,
      temperature: 0.3,
    });

    const reply = completion.choices[0]?.message?.content || "";

    logger.info({ userId, language: lang }, "[support-chat] Reply generated");

    const billing = await consumeAiCredits(req.userId!, "support_chat");
    if (!billing.ok) {
      res.status(500).json({ error: "Echec de facturation, veuillez reessayer." });
      return;
    }
    res.json({ reply });
  } catch (err: any) {
    logger.error({ err: err.message, stack: err.stack }, "[support-chat] Error");
    res.status(500).json({ error: "An error occurred. Please try again." });
  }
});

export default router;
