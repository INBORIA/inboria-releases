import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { GenerateDailySummaryBody, GenerateDraftBody } from "@workspace/api-zod";
import OpenAI from "openai";
import { requireAuth } from "../middlewares/auth";
import { logger } from "../lib/logger";
import { getKnowledgeBase, getSystemPrompt } from "../services/knowledge-base";
import { AI_COST, checkEntitlement, consumeAiCredits, type AiEventType } from "../services/credits";
import { recordAutopilotEvent } from "../services/autopilot-events";
import { getMemberMailboxIds, buildInboxScopeOrFilter } from "../lib/inbox-scope";
import { ensureSystemCategory } from "../lib/system-categories";
import { buildInboriaContextBlock } from "../lib/inboria-prompt";
import { generateHandoverBrief, type Language as BriefLanguage } from "../services/handover-brief";
import { getUserAiLang } from "../services/ai-lang";

const openai = new OpenAI({
  apiKey: process.env["OPENAI_API_KEY"],
});

const router: IRouter = Router();

// Type union covering all column subsets used across this file's call sites.
// Each call passes a comma-separated `columns` string; the row shape returned
// is a subset of these fields. Generic-ifying allows callers to pin a stricter
// type when needed without losing access to the listed fields.
type AccessibleEmailRow = {
  id: number;
  sender: string | null;
  recipient: string | null;
  subject: string | null;
  body: string | null;
  summary: string | null;
  category_id: string | null;
  project_id: string | null;
  created_at: string;
};

async function fetchAccessibleEmail<T = AccessibleEmailRow>(
  emailId: number,
  userId: string,
  columns: string,
): Promise<{ data: T | null; error: { message: string } | null }> {
  const memberMailboxIds = await getMemberMailboxIds(userId);
  const query = supabaseAdmin.from("emails").select(columns).eq("id", emailId);
  const result = memberMailboxIds.length > 0
    ? await query.or(`user_id.eq.${userId},shared_mailbox_id.in.(${memberMailboxIds.join(",")})`).single()
    : await query.eq("user_id", userId).single();
  return {
    data: (result.data as unknown as T | null),
    error: result.error ? { message: result.error.message } : null,
  };
}

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

    // Email Brain Phase 2 (#215) — enrichir le bilan avec les décisions
    // récentes, projets actifs inférés et engagements ouverts. Best-effort.
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    let recentDecisions: Array<{ decision: string; decided_at: string | null; amount_eur: number | null; source_email_id: number | null }> = [];
    let activeProjects: Array<{ name: string; email_count: number; last_seen_at: string }> = [];
    let openCommitments: Array<{ summary: string; event_date: string | null; source_email_id: number | null }> = [];
    try {
      // Scope incluant les boîtes partagées dont l'utilisateur est membre,
      // pour rester cohérent avec buildInboriaContextBlock et l'extracteur.
      let brainMemberMailboxIds: string[] = [];
      try {
        brainMemberMailboxIds = await getMemberMailboxIds(req.userId!);
      } catch {
        brainMemberMailboxIds = [];
      }
      const brainScope = `and(user_id.eq.${req.userId!},shared_mailbox_id.is.null)`;
      const brainScopeFilter = brainMemberMailboxIds.length > 0
        ? `${brainScope},shared_mailbox_id.in.(${brainMemberMailboxIds.join(",")})`
        : brainScope;
      const [decRes, projRes, commitRes] = await Promise.all([
        supabaseAdmin
          .from("inboria_decisions")
          .select("decision, decided_at, amount_eur, source_email_id, created_at")
          .or(brainScopeFilter)
          .gte("created_at", sevenDaysAgo)
          .order("created_at", { ascending: false })
          .limit(8),
        supabaseAdmin
          .from("inboria_projects_inferred")
          .select("name, email_count, last_seen_at")
          .or(brainScopeFilter)
          .eq("status", "active")
          .order("last_seen_at", { ascending: false })
          .limit(6),
        supabaseAdmin
          .from("inboria_episodes")
          .select("summary, event_date, source_email_id, extracted_at")
          .or(brainScopeFilter)
          .eq("kind", "commitment")
          .gte("extracted_at", sevenDaysAgo)
          .order("extracted_at", { ascending: false })
          .limit(6),
      ]);
      if (!decRes.error && decRes.data) recentDecisions = decRes.data as any[];
      if (!projRes.error && projRes.data) activeProjects = projRes.data as any[];
      if (!commitRes.error && commitRes.data) openCommitments = commitRes.data as any[];
    } catch (err: any) {
      logger.warn({ err: err?.message }, "[ai/daily-summary] brain context failed");
    }

    const formatBrainContext = (lang: string): string => {
      const lines: string[] = [];
      const isFr = lang === "fr";
      const isEn = lang === "en";
      const isNl = lang === "nl";
      const isDe = lang === "de";
      const isEs = lang === "es";
      const isIt = lang === "it";
      const isPt = lang === "pt";
      if (activeProjects.length > 0) {
        const header = isFr
          ? "Projets actifs (derniers 7 jours d'activité)"
          : isEn
            ? "Active projects (last 7 days of activity)"
            : isNl
              ? "Actieve projecten (laatste 7 dagen activiteit)"
              : isDe
                ? "Aktive Projekte (letzte 7 Tage Aktivität)"
                : isEs
                  ? "Proyectos activos (últimos 7 días de actividad)"
                  : isIt
                    ? "Progetti attivi (ultimi 7 giorni di attività)"
                    : isPt
                      ? "Projetos ativos (últimos 7 dias de atividade)"
                      : "Active projects";
        lines.push(`\n${header} :`);
        for (const p of activeProjects) {
          lines.push(`- ${p.name} (${p.email_count} mails)`);
        }
      }
      if (recentDecisions.length > 0) {
        const header = isFr
          ? "Décisions récentes (7 derniers jours)"
          : isEn
            ? "Recent decisions (last 7 days)"
            : isNl
              ? "Recente beslissingen (laatste 7 dagen)"
              : isDe
                ? "Aktuelle Entscheidungen (letzte 7 Tage)"
                : isEs
                  ? "Decisiones recientes (últimos 7 días)"
                  : isIt
                    ? "Decisioni recenti (ultimi 7 giorni)"
                    : isPt
                      ? "Decisões recentes (últimos 7 dias)"
                      : "Recent decisions";
        lines.push(`\n${header} :`);
        for (const d of recentDecisions) {
          const date = d.decided_at || (d as any).created_at?.slice(0, 10) || "";
          const amt = typeof d.amount_eur === "number" ? ` — ${d.amount_eur} €` : "";
          const tag = d.source_email_id ? ` [mail#${d.source_email_id}]` : "";
          lines.push(`- ${date} ${d.decision}${amt}${tag}`);
        }
      }
      if (openCommitments.length > 0) {
        const header = isFr
          ? "Engagements en cours mentionnés cette semaine"
          : isEn
            ? "Commitments mentioned this week"
            : isNl
              ? "Toezeggingen deze week"
              : isDe
                ? "Verpflichtungen diese Woche"
                : isEs
                  ? "Compromisos mencionados esta semana"
                  : isIt
                    ? "Impegni menzionati questa settimana"
                    : isPt
                      ? "Compromissos mencionados esta semana"
                      : "Commitments this week";
        lines.push(`\n${header} :`);
        for (const c of openCommitments) {
          const date = c.event_date ? ` (${c.event_date})` : "";
          const tag = c.source_email_id ? ` [mail#${c.source_email_id}]` : "";
          lines.push(`-${date} ${c.summary}${tag}`);
        }
      }
      return lines.join("\n");
    };

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
    const brainBlock = formatBrainContext(language);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 2048,
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user + brainBlock },
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
    recordAutopilotEvent({
      userId: req.userId!,
      eventType: "summary_generated",
      title: "Bilan quotidien",
      metadata: { kind: "daily_summary", score, total: allEmails.length, urgent },
    }).catch(() => {});
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

    const { data: email, error: emailErr } = await fetchAccessibleEmail(
      emailId,
      req.userId!,
      "id, sender, subject, body, category_id, project_id",
    );

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

    const signatureInstruction = `N'ajoute aucune signature ni formule de signature : termine le brouillon directement par la dernière phrase utile, sans nom ni "Cordialement".`;

    const inboriaContext = await buildInboriaContextBlock(req.userId!, email.sender).catch(
      () => "",
    );

    // Email Brain Phase 2 (#215) — RAG sur tout le corpus pour ancrer le
    // brouillon sur des mails passés réels. Best-effort, timeout 1.2s.
    let ragContext = "";
    try {
      const cleanForEmbed = (email.subject || "") + "\n" + String(email.body || "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 1500);
      const memberMailboxIds = await getMemberMailboxIds(req.userId!);
      const ragPromise = (async (): Promise<string> => {
        const embedRes = await openai.embeddings.create({
          model: "text-embedding-3-small",
          input: cleanForEmbed,
        });
        const queryVec = embedRes.data[0]?.embedding as number[] | undefined;
        if (!Array.isArray(queryVec) || queryVec.length !== 1536) return "";
        const { data, error } = await supabaseAdmin.rpc("search_email_chunks", {
          query_vec: queryVec as any,
          scope_user_ids: [req.userId!],
          scope_mailbox_ids: memberMailboxIds,
          exclude_private: false,
          match_limit: 12,
        });
        if (error) return "";
        const hits = ((data as any[]) || [])
          .filter((h) => typeof h.distance === "number" && h.distance < 0.78)
          .slice(0, 5);
        if (hits.length === 0) return "";
        const seen = new Set<number>();
        const lines: string[] = [
          "\nMails passés liés (à utiliser pour ancrer le brouillon, citer une décision/engagement passé doit toujours référencer [mail#ID]) :",
        ];
        for (const h of hits) {
          const eid = Number(h.email_id);
          if (seen.has(eid) || eid === Number(email.id)) continue;
          seen.add(eid);
          const date = (h.sent_at || h.created_at || "").slice(0, 10);
          const subj = String(h.subject || "(sans objet)").slice(0, 80);
          const snippet = String(h.content || "").replace(/\s+/g, " ").slice(0, 180);
          lines.push(`- [mail#${eid}] ${date} ${subj} — "${snippet}"`);
        }
        return lines.length > 1 ? lines.join("\n") : "";
      })();
      ragContext = await Promise.race([
        ragPromise,
        new Promise<string>((resolve) => setTimeout(() => resolve(""), 1200)),
      ]);
    } catch (err: any) {
      logger.warn({ err: err?.message }, "[ai/draft] RAG context failed");
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 1024,
      messages: [
        {
          role: "system",
          content: `Tu es un assistant de redaction d'emails professionnels. Redige la reponse en francais avec un ton professionnel. Tu rediges des reponses claires, polies et professionnelles. Si le contexte historique mentionne un fait, une décision ou un engagement passé pertinent, intègre-le naturellement dans le corps du texte ; ne mentionne jamais d'identifiant technique ou de balise [mail#ID]. ${signatureInstruction}`,
        },
        {
          role: "user",
          content: `Voici un email recu auquel il faut repondre:

Expediteur: ${email.sender}
Sujet: ${email.subject}
Corps:
${email.body}${projectContext}${categoryContext}${inboriaContext}${ragContext}

Redige une reponse professionnelle et adaptee au contexte. Reponds uniquement avec le texte du brouillon, sans explication supplementaire et sans aucun marqueur [mail#…].`,
        },
      ],
    });

    const draft = completion.choices[0]?.message?.content?.trim() || "";

    const billing = await consumeAiCredits(req.userId!, "draft");
    if (!billing.ok) {
      res.status(500).json({ error: "Echec de facturation, veuillez reessayer." });
      return;
    }
    recordAutopilotEvent({
      userId: req.userId!,
      eventType: "draft_generated",
      title: req.body?.subject || null,
      emailId: Number(req.body?.emailId) || null,
    }).catch(() => {});
    res.json({ draft });
  } catch (err: any) {
    console.error("AI draft error:", err);
    res.status(500).json({ error: "Echec de la generation du brouillon" });
  }
});

router.post("/ai/follow-up-draft", requireAuth, async (req, res): Promise<void> => {
  try {
    const entitlement = await checkEntitlement(req.userId!, AI_COST.draft);
    if (entitlement.blocked) { res.status(403).json({ error: entitlement.reason }); return; }

    const followupId = typeof req.body?.followupId === "string" ? req.body.followupId.trim() : "";
    if (!followupId) {
      res.status(400).json({ error: "followupId requis" });
      return;
    }

    const { data: followup, error: fErr } = await supabaseAdmin
      .from("followups")
      .select("id, email_id, title")
      .eq("id", followupId)
      .eq("user_id", req.userId!)
      .single();

    if (fErr || !followup || !followup.email_id) {
      res.status(404).json({ error: "Relance ou email introuvable" });
      return;
    }

    const { data: email, error: emailErr } = await fetchAccessibleEmail(
      followup.email_id as number,
      req.userId!,
      "id, sender, recipient, subject, body, created_at",
    );

    if (emailErr || !email) {
      res.status(404).json({ error: "Email introuvable" });
      return;
    }

    const sentDate = email.created_at ? new Date(email.created_at).toLocaleDateString("fr-FR") : "";
    const cleanBody = (email.body || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 1500);
    const signatureInstruction = `N'ajoute aucune signature ni formule de signature : termine le brouillon directement par la dernière phrase utile, sans nom ni "Cordialement".`;

    const inboriaContext = await buildInboriaContextBlock(req.userId!, email.recipient).catch(
      () => "",
    );

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 600,
      messages: [
        {
          role: "system",
          content: `Tu rédiges un court email de relance professionnel et courtois en français. Le destinataire n'a pas répondu à un email précédent. Le ton est poli, bref (3-6 lignes), sans culpabilisation. Rappelle brièvement le contexte du mail initial et propose une suite (réponse, point téléphonique, etc.). ${signatureInstruction}`,
        },
        {
          role: "user",
          content: `Voici le mail initial que j'ai envoyé${sentDate ? ` le ${sentDate}` : ""} et qui est resté sans réponse.\n\nDestinataire : ${email.recipient || "(inconnu)"}\nObjet initial : ${email.subject || "(sans objet)"}\nCorps initial :\n${cleanBody}${inboriaContext}\n\nRédige uniquement le texte d'un mail de relance court (3-6 lignes), sans objet, sans signature, sans guillemets, prêt à coller dans le corps.`,
        },
      ],
    });

    const draft = completion.choices[0]?.message?.content?.trim() || "";
    const subject = (email.subject || "").match(/^\s*re\s*:/i)
      ? (email.subject as string)
      : `Re: ${email.subject || ""}`.trim();

    const billing = await consumeAiCredits(req.userId!, "draft");
    if (!billing.ok) {
      res.status(500).json({ error: "Echec de facturation, veuillez reessayer." });
      return;
    }
    recordAutopilotEvent({
      userId: req.userId!,
      eventType: "draft_generated",
      title: subject,
      emailId: (email.id as number) || null,
      metadata: { kind: "follow_up_draft", followupId },
    }).catch(() => {});

    res.json({
      draft,
      subject,
      to: email.recipient || "",
      emailId: email.id,
    });
  } catch (err: any) {
    logger.error({ err: err?.message, stack: err?.stack }, "[ai/follow-up-draft] error");
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

    const { data: email, error: emailErr } = await fetchAccessibleEmail(
      emailId,
      req.userId!,
      "id, sender, subject, body",
    );

    if (emailErr || !email) {
      res.status(404).json({ error: "Email introuvable" });
      return;
    }

    const signatureInstruction = `N'ajoute aucune signature ni formule de signature : termine le message directement par la dernière phrase utile, sans nom ni "Cordialement".`;

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
    recordAutopilotEvent({
      userId: req.userId!,
      eventType: "forward_intro_generated",
      title: req.body?.subject || null,
      emailId: Number(req.body?.emailId) || null,
    }).catch(() => {});
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

    // Garantit la présence de la catégorie système "Non classé" et récupère
    // son id : on s'en sert comme bucket canonique de fallback. Idempotent.
    const systemCat = await ensureSystemCategory(userId);
    const systemCatId = systemCat?.id ?? null;

    const { data: categories } = await supabaseAdmin
      .from("categories")
      .select("id, name, is_system")
      .eq("user_id", userId);

    // "Junk" = catégorie système + anciennes catégories nommées comme la
    // fourre-tout (héritées de comptes EN/NL avant la mise en place du
    // drapeau is_system). On exclut TOUTES ces catégories du jeu d'options
    // proposé à l'IA, et on récupère leurs emails comme entrée.
    const JUNK_NAMES = ["non classé", "non classe", "uncategorized", "niet geclassificeerd"];
    const allCats = categories || [];
    const junkCategoryIds = allCats
      .filter(
        (c: any) =>
          c.is_system === true || JUNK_NAMES.includes(c.name.toLowerCase()),
      )
      .map((c: any) => c.id);
    // Ids des cats héritées (NON système) : seules celles-là peuvent être
    // supprimées en fin de pipeline si elles deviennent vides.
    const legacyJunkIds = allCats
      .filter(
        (c: any) =>
          c.is_system !== true && JUNK_NAMES.includes(c.name.toLowerCase()),
      )
      .map((c: any) => c.id);

    // On élargit la portée : non seulement les emails personnels mais aussi
    // ceux des boîtes partagées dont l'utilisateur est membre — c'est la
    // même portée que celle utilisée par le compteur du tableau de bord.
    // Avant : `.eq("user_id", userId)` ignorait les non-classés des boîtes
    // partagées, et le bouton "Re-classer maintenant" tournait à vide.
    const memberMailboxIds = await getMemberMailboxIds(userId);
    const inboxScopeOr = buildInboxScopeOrFilter(userId, memberMailboxIds);

    const { data: nullEmails } = await supabaseAdmin
      .from("emails")
      .select("id, sender, subject, body")
      .or(inboxScopeOr)
      .is("category_id", null)
      .neq("status", "archived")
      .neq("status", "sent")
      .neq("status", "scheduled")
      .neq("status", "scheduled_failed")
      .order("created_at", { ascending: false })
      .limit(50);

    let junkEmails: any[] = [];
    if (junkCategoryIds.length > 0) {
      const { data } = await supabaseAdmin
        .from("emails")
        .select("id, sender, subject, body")
        .or(inboxScopeOr)
        .in("category_id", junkCategoryIds)
        .neq("status", "archived")
        .neq("status", "sent")
        .neq("status", "scheduled")
        .neq("status", "scheduled_failed")
        .order("created_at", { ascending: false })
        .limit(50);
      junkEmails = data || [];
    }

    const emails = [...(nullEmails || []), ...junkEmails].slice(0, 50);

    if (emails.length === 0) {
      res.json({ recategorized: 0, created: [] });
      return;
    }

    const realCategories = allCats.filter((c: any) => !junkCategoryIds.includes(c.id));
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
        // Normalisation : trim + collapse whitespace pour ne pas rater
        // un "Non classé " avec espace traînant.
        const rawCatName = (result.category || lp.uncategorized) as string;
        const catName = rawCatName.trim().replace(/\s+/g, " ");

        // L'IA n'a pas trouvé de catégorie pertinente : on route vers la
        // catégorie système (bucket canonique "à trier"). On ne compte pas
        // ça comme une re-catégorisation utile.
        if (JUNK_NAMES.includes(catName.toLowerCase())) {
          if (systemCatId) {
            // L'id email est déjà confirmé dans la portée par le SELECT
            // ci-dessus (personnel + boîtes partagées dont je suis membre).
            // On évite `.eq("user_id", userId)` qui bloquerait les emails
            // de boîtes partagées (user_id != userId).
            await supabaseAdmin
              .from("emails")
              .update({ category_id: systemCatId })
              .eq("id", email.id);
          }
          continue;
        }

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
          // Idem qu'au-dessus : pas de filtre user_id sur l'UPDATE — l'email
          // a déjà été validé par le SELECT scopé (perso + boîtes partagées).
          await supabaseAdmin
            .from("emails")
            .update({ category_id: categoryId })
            .eq("id", email.id);
          recategorized++;
        }
      } catch (err: any) {
        console.error(`[recategorize] Error for email ${email.id}:`, err.message);
      }
    }

    // Nettoyage post-traitement : on ne supprime QUE les anciennes
    // catégories nommées comme la fourre-tout (legacy EN/NL) qui sont
    // devenues vides. La catégorie système, elle, est intouchable —
    // garantie par le drapeau is_system côté DB et par cette boucle.
    if (recategorized > 0 && legacyJunkIds.length > 0) {
      for (const junkId of legacyJunkIds) {
        // On compte sans filtre user_id sur les emails : la catégorie peut
        // contenir des emails de boîtes partagées (user_id ≠ requesting
        // user) — il ne faut pas la supprimer si elle en héberge encore.
        const { count } = await supabaseAdmin
          .from("emails")
          .select("id", { count: "exact", head: true })
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
    if (recategorized > 0) {
      recordAutopilotEvent({
        userId,
        eventType: "email_sorted",
        title: null,
        metadata: { batch: true, count: recategorized, source: "recategorize" },
      }).catch(() => {});
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

    const lang = await getUserAiLang(req.userId!);
    const sysByLang: Record<string, string> = {
      fr: "Tu es un assistant professionnel. Résume cette conversation email EN FRANÇAIS en 2-3 phrases. Identifie : le sujet principal, les décisions prises, et les actions en suspens.",
      en: "You are a professional assistant. Summarize this email conversation IN ENGLISH in 2-3 sentences. Identify: the main topic, decisions made, and pending actions.",
      nl: "Je bent een professionele assistent. Vat deze e-mailconversatie samen IN HET NEDERLANDS in 2-3 zinnen. Identificeer: het hoofdonderwerp, genomen beslissingen en openstaande acties.",
      de: "Du bist ein professioneller Assistent. Fasse dieses E-Mail-Gespräch AUF DEUTSCH in 2-3 Sätzen zusammen. Identifiziere: das Hauptthema, getroffene Entscheidungen und offene Aktionen.",
      es: "Eres un asistente profesional. Resume esta conversación de correo EN ESPAÑOL en 2-3 frases. Identifica: el tema principal, las decisiones tomadas y las acciones pendientes.",
    };
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        { role: "system", content: sysByLang[lang] || sysByLang.fr },
        { role: "user", content: conversation },
      ],
    });

    const billing = await consumeAiCredits(req.userId!, "conversation_summary");
    if (!billing.ok) {
      res.status(500).json({ error: "Echec de facturation, veuillez reessayer." });
      return;
    }
    recordAutopilotEvent({
      userId: req.userId!,
      eventType: "summary_generated",
      title: "Résumé de conversation",
      metadata: { kind: "conversation_summary", messages: thread.length },
    }).catch(() => {});
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

    const { data: email, error: emailErr } = await fetchAccessibleEmail(
      emailId,
      req.userId!,
      "id, sender, subject, body, summary",
    );

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
    if (result.hasAppointment) {
      recordAutopilotEvent({
        userId: req.userId!,
        eventType: "appointment_extracted",
        title: result.title || email.subject || null,
        emailId: Number(req.body?.emailId) || null,
        metadata: { startAt: result.startAt ?? null },
      }).catch(() => {});
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
    if (created.length > 0) {
      recordAutopilotEvent({
        userId: req.userId!,
        eventType: "appointment_extracted",
        title: created.length === 1
          ? created[0].title
          : `${created.length} rendez-vous détectés`,
        metadata: { kind: "detect_appointments", count: created.length },
      }).catch(() => {});
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

// Email Brain Phase 3 (#216) — Brief de passation pour un contact donné.
router.post("/ai/handover-brief", requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = req.userId!;
    const body = req.body || {};
    const contactEmail = String(body.contactEmail || "").trim().toLowerCase();
    if (!contactEmail || !contactEmail.includes("@")) {
      res.status(400).json({ error: "contactEmail invalide" });
      return;
    }
    const sinceDays = Number.isFinite(body.sinceDays) ? Number(body.sinceDays) : 30;
    const allowedLangs: BriefLanguage[] = ["fr", "en", "nl", "de", "es", "it", "pt"];
    let language: BriefLanguage = "fr";
    if (typeof body.language === "string" && (allowedLangs as string[]).includes(body.language)) {
      language = body.language as BriefLanguage;
    } else {
      try {
        const userLang = await getUserAiLang(userId);
        if ((allowedLangs as string[]).includes(userLang)) {
          language = userLang as BriefLanguage;
        }
      } catch {
        /* keep fr */
      }
    }

    const entitlement = await checkEntitlement(userId, AI_COST.handover_brief);
    if (entitlement.blocked) {
      res.status(402).json({ error: entitlement.reason || "Quota IA atteint" });
      return;
    }

    const result = await generateHandoverBrief(userId, contactEmail, {
      sinceDays,
      language,
    });
    if (!result) {
      res.status(404).json({
        error:
          "Pas assez d'informations sur ce contact pour générer un brief. Attendez que quelques échanges soient analysés par Inboria.",
      });
      return;
    }

    const billing = await consumeAiCredits(userId, "handover_brief" as AiEventType);
    if (!billing.ok) {
      res.status(500).json({ error: "Echec de facturation, veuillez reessayer." });
      return;
    }
    recordAutopilotEvent({
      userId,
      eventType: "summary_generated",
      title: `Brief de passation : ${contactEmail}`,
      metadata: { kind: "handover_brief", contactEmail, sinceDays, language },
    }).catch(() => {});

    res.json(result);
  } catch (err: any) {
    logger.error({ err: err?.message, stack: err?.stack }, "[handover-brief] failed");
    res.status(500).json({ error: "Echec de génération du brief" });
  }
});

export default router;
