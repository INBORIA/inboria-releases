import OpenAI from "openai";
import { supabaseAdmin } from "../lib/supabase";
import { logger } from "../lib/logger";
import { getMemberMailboxIds } from "../lib/inbox-scope";

const MODEL = "gpt-4o-mini";
const EMBEDDING_MODEL = "text-embedding-3-small";
const MAX_TOKENS = 900;

export type Language = "fr" | "en" | "nl" | "de" | "es" | "it" | "pt" | "pl" | "ro" | "sv" | "da" | "fi" | "hu" | "cs" | "tr" | "ja" | "ko";

export interface HandoverBriefResult {
  brief: string;
  generatedAt: string;
}

const SECTION_HEADERS: Record<Language, [string, string, string, string, string]> = {
  fr: [
    "Contexte de la relation",
    "Sujets en cours",
    "Décisions actées",
    "Engagements ouverts",
    "Points de vigilance",
  ],
  en: [
    "Relationship context",
    "Current topics",
    "Decisions made",
    "Open commitments",
    "Watch-outs",
  ],
  nl: [
    "Relatiecontext",
    "Lopende onderwerpen",
    "Genomen beslissingen",
    "Openstaande toezeggingen",
    "Aandachtspunten",
  ],
  de: [
    "Beziehungskontext",
    "Aktuelle Themen",
    "Getroffene Entscheidungen",
    "Offene Verpflichtungen",
    "Achtungspunkte",
  ],
  es: [
    "Contexto de la relación",
    "Temas actuales",
    "Decisiones tomadas",
    "Compromisos abiertos",
    "Puntos de atención",
  ],
  it: [
    "Contesto della relazione",
    "Argomenti in corso",
    "Decisioni prese",
    "Impegni aperti",
    "Punti di attenzione",
  ],
  pt: [
    "Contexto da relação",
    "Tópicos em curso",
    "Decisões tomadas",
    "Compromissos em aberto",
    "Pontos de atenção",
  ],
  pl: [
    "Kontekst relacji",
    "Bieżące tematy",
    "Podjęte decyzje",
    "Otwarte zobowiązania",
    "Kwestie wymagające uwagi",
  ],
  ro: [
    "Contextul relației",
    "Subiecte în curs",
    "Decizii luate",
    "Angajamente deschise",
    "Puncte de atenție",
  ],
  sv: [
    "Relationskontext",
    "Pågående ämnen",
    "Fattade beslut",
    "Öppna åtaganden",
    "Att uppmärksamma",
  ],
  da: [
    "Relationskontekst",
    "Aktuelle emner",
    "Trufne beslutninger",
    "Åbne forpligtelser",
    "Opmærksomhedspunkter",
  ],
  fi: [
    "Suhteen konteksti",
    "Käynnissä olevat aiheet",
    "Tehdyt päätökset",
    "Avoimet sitoumukset",
    "Huomioitavat seikat",
  ],
  hu: [
    "Kapcsolati háttér",
    "Folyamatban lévő témák",
    "Meghozott döntések",
    "Nyitott kötelezettségek",
    "Figyelendő pontok",
  ],
  cs: [
    "Kontext vztahu",
    "Aktuální témata",
    "Přijatá rozhodnutí",
    "Otevřené závazky",
    "Body k pozornosti",
  ],
  tr: [
    "İlişki bağlamı",
    "Devam eden konular",
    "Alınan kararlar",
    "Açık taahhütler",
    "Dikkat edilmesi gerekenler",
  ],
  ja: [
    "関係の背景",
    "進行中のトピック",
    "決定事項",
    "未完了のコミットメント",
    "注意すべき点",
  ],
  ko: [
    "관계 컨텍스트",
    "진행 중인 주제",
    "결정 사항",
    "미해결 약속",
    "주의 사항",
  ],
};

const TONE: Record<Language, string> = {
  fr: "Tu rédiges en français, vouvoiement, ton factuel, professionnel, sans formules de politesse.",
  en: "Write in English, factual professional tone, no greetings.",
  nl: "Schrijf in het Nederlands, zakelijk en feitelijk, zonder begroetingen.",
  de: "Schreibe auf Deutsch, sachlich und professionell, ohne Begrüßungen.",
  es: "Redacta en español, tono profesional y factual, sin saludos.",
  it: "Scrivi in italiano, forma di cortesia (Lei), tono fattuale e professionale, senza formule di saluto.",
  pt: "Escreva em português europeu, forma formal (você), tom factual e profissional, sem saudações.",
  pl: "Pisz po polsku, forma grzecznościowa (Pan/Pani), ton rzeczowy i profesjonalny, bez powitań.",
  ro: "Scrieți în limba română, folosiți forma de politețe (dumneavoastră), ton factual și profesional, fără formule de salut.",
  sv: "Skriv på svenska, modern professionell B2B-ton (du), saklig och professionell, utan hälsningsfraser.",
  da: "Skriv på dansk, moderne professionel B2B-tone (du), saglig og professionel, uden hilsner.",
  fi: "Kirjoittakaa suomeksi, käyttäkää teitittelyä, asiallinen ja ammattimainen sävy, ilman tervehdyksiä.",
  hu: "Írjon magyarul, magázódó (Ön) formában, tárgyilagos és professzionális hangnemben, üdvözlések nélkül.",
  cs: "Pište česky, používejte vykání (Vy), věcný a profesionální tón, bez pozdravů.",
  tr: "Türkçe yazın, resmi 'siz' formunu kullanın, olgusal ve profesyonel ton, selamlama olmadan.",
  ja: "日本語で、です・ます調の丁寧な敬語で記述してください。事実に基づいた専門的なトーンで、挨拶は不要です。",
  ko: "한국어로, 합쇼체(하십시오체)의 격식 있는 존댓말로 작성해 주십시오. 사실 기반의 전문적인 톤으로, 인사말 없이 작성합니다.",
};

function buildScopeFilter(userId: string, memberMailboxIds: string[]): string {
  const personal = `and(user_id.eq.${userId},shared_mailbox_id.is.null)`;
  const parts = [personal];
  if (memberMailboxIds.length > 0) {
    parts.push(`shared_mailbox_id.in.(${memberMailboxIds.join(",")})`);
  }
  return parts.join(",");
}

function isMissing(err: any, table: string): boolean {
  const msg = String(err?.message || "");
  return new RegExp(`relation .*${table}.* does not exist`, "i").test(msg);
}

export async function generateHandoverBrief(
  userId: string,
  rawContactEmail: string,
  options: { sinceDays?: number; language?: Language } = {},
): Promise<HandoverBriefResult | null> {
  const contactEmail = rawContactEmail.trim().toLowerCase();
  if (!contactEmail.includes("@")) return null;
  if (!process.env["OPENAI_API_KEY"]) return null;

  const sinceDays = Math.min(Math.max(options.sinceDays ?? 30, 1), 180);
  const language = (options.language ?? "fr") as Language;
  const sinceIso = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString();

  let memberMailboxIds: string[] = [];
  try {
    memberMailboxIds = await getMemberMailboxIds(userId);
  } catch {
    memberMailboxIds = [];
  }
  const scopeFilter = buildScopeFilter(userId, memberMailboxIds);

  // 1. Charge la mémoire structurée (limites élargies vs résumé court).
  const [factsRes, episodesRes, decisionsRes] = await Promise.all([
    supabaseAdmin
      .from("inboria_facts")
      .select("kind, statement, source_email_id, extracted_at")
      .eq("contact_email", contactEmail)
      .or(scopeFilter)
      .order("extracted_at", { ascending: false })
      .limit(15),
    supabaseAdmin
      .from("inboria_episodes")
      .select("kind, summary, event_date, source_email_id, extracted_at")
      .eq("contact_email", contactEmail)
      .or(scopeFilter)
      .order("extracted_at", { ascending: false })
      .limit(15),
    supabaseAdmin
      .from("inboria_decisions")
      .select("decision, decided_at, amount_eur, parties, source_email_id, created_at")
      .eq("contact_email", contactEmail)
      .or(scopeFilter)
      .order("created_at", { ascending: false })
      .limit(15),
  ]);

  const facts = (factsRes.data || []) as any[];
  const episodes = (episodesRes.data || []) as any[];
  let decisions: any[] = [];
  if (decisionsRes.error && isMissing(decisionsRes.error, "inboria_decisions")) {
    logger.warn(
      "[handover-brief] inboria_decisions missing — apply migrations/2026_05_05_inboria_decisions_projects.sql",
    );
  } else {
    decisions = (decisionsRes.data || []) as any[];
  }

  // 2. Charge mails récents avec ce contact pour donner un fil chronologique.
  let recentEmails: any[] = [];
  try {
    const { data: recRaw } = await supabaseAdmin
      .from("emails")
      .select("id, subject, sender, sent_at, body_preview")
      .or(scopeFilter)
      .or(`sender.ilike.%${contactEmail}%,recipient.ilike.%${contactEmail}%`)
      .gte("sent_at", sinceIso)
      .order("sent_at", { ascending: false })
      .limit(20);
    recentEmails = (recRaw || []) as any[];
  } catch (err: any) {
    logger.warn({ err: err?.message }, "[handover-brief] recent emails fetch failed");
  }

  if (
    facts.length === 0 &&
    episodes.length === 0 &&
    decisions.length === 0 &&
    recentEmails.length === 0
  ) {
    return null;
  }

  // 3. RAG best-effort sur tout le corpus.
  let ragLines: string[] = [];
  const openai = new OpenAI({ apiKey: process.env["OPENAI_API_KEY"]! });
  try {
    const query = `Brief de passation pour ${contactEmail} sur ${sinceDays} jours : projets, décisions, engagements, risques.`;
    const embedRes = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: query,
    });
    const queryVec = embedRes.data[0]?.embedding as number[] | undefined;
    if (Array.isArray(queryVec) && queryVec.length === 1536) {
      const { data, error } = await supabaseAdmin.rpc("search_email_chunks", {
        query_vec: queryVec as any,
        scope_user_ids: [userId],
        scope_mailbox_ids: memberMailboxIds,
        exclude_private: false,
        match_limit: 16,
      });
      if (!error) {
        const seen = new Set<number>();
        for (const h of ((data as any[]) || [])
          .filter((h) => typeof h.distance === "number" && h.distance < 0.78)
          .slice(0, 8)) {
          const eid = Number(h.email_id);
          if (seen.has(eid)) continue;
          seen.add(eid);
          const date = (h.sent_at || h.created_at || "").slice(0, 10);
          const subj = String(h.subject || "(sans objet)").slice(0, 80);
          const snippet = String(h.content || "").replace(/\s+/g, " ").slice(0, 200);
          ragLines.push(`- [mail#${eid}] ${date} ${subj} — "${snippet}"`);
        }
      }
    }
  } catch (err: any) {
    logger.warn({ err: err?.message }, "[handover-brief] RAG failed");
  }

  // 4. Construit le bloc de données.
  const dataLines: string[] = [];
  if (facts.length > 0) {
    dataLines.push("FAITS :");
    for (const f of facts) {
      const tag = f.source_email_id ? ` [mail#${f.source_email_id}]` : "";
      dataLines.push(`- (${f.kind}) ${f.statement}${tag}`);
    }
  }
  if (episodes.length > 0) {
    dataLines.push("\nÉPISODES :");
    for (const e of episodes) {
      const date = e.event_date ? ` (${e.event_date})` : "";
      const tag = e.source_email_id ? ` [mail#${e.source_email_id}]` : "";
      dataLines.push(`- (${e.kind})${date} ${e.summary}${tag}`);
    }
  }
  if (decisions.length > 0) {
    dataLines.push("\nDÉCISIONS :");
    for (const d of decisions) {
      const date = d.decided_at ? ` (${d.decided_at})` : "";
      const amt = typeof d.amount_eur === "number" ? ` — ${d.amount_eur.toLocaleString("fr-FR")} €` : "";
      const parties = Array.isArray(d.parties) && d.parties.length ? ` [parties: ${d.parties.slice(0, 4).join(", ")}]` : "";
      const tag = d.source_email_id ? ` [mail#${d.source_email_id}]` : "";
      dataLines.push(`-${date} ${d.decision}${amt}${parties}${tag}`);
    }
  }
  if (recentEmails.length > 0) {
    dataLines.push("\nMAILS RÉCENTS :");
    for (const e of recentEmails) {
      const date = (e.sent_at || "").slice(0, 10);
      const subj = String(e.subject || "(sans objet)").slice(0, 80);
      const sender = String(e.sender || "").slice(0, 50);
      dataLines.push(`- [mail#${e.id}] ${date} ${sender} — ${subj}`);
    }
  }
  if (ragLines.length > 0) {
    dataLines.push("\nEXTRAITS PERTINENTS :");
    dataLines.push(...ragLines);
  }

  const headers = SECTION_HEADERS[language];
  const sectionsBlock = headers
    .map((h, i) => `${i + 1}. **${h}** (1 à 4 puces, chaque puce ≤ 160 car., toujours [mail#ID])`)
    .join("\n");

  const completion = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0.3,
    max_completion_tokens: MAX_TOKENS,
    messages: [
      {
        role: "system",
        content: `Tu es Inboria. Tu rédiges un BRIEF DE PASSATION sur un contact professionnel pour permettre à un collègue (ou à l'utilisateur lui-même après une absence) de reprendre la relation sans perte d'information. ${TONE[language]}\n\nRègles strictes :\n- N'invente RIEN ; chaque puce doit être ancrée par [mail#ID] tiré des données fournies.\n- Si une section est vide, mets exactement la puce "- (rien à signaler)".\n- Format Markdown, EXACTEMENT 5 sections dans cet ordre :\n${sectionsBlock}\n- Maximum 20 puces au total.\n- Pas de préambule ni conclusion.`,
      },
      {
        role: "user",
        content: `Contact : ${contactEmail}\nFenêtre : ${sinceDays} derniers jours\n\nDonnées :\n${dataLines.join("\n")}`,
      },
    ],
  });

  const brief = completion.choices[0]?.message?.content?.trim() || "";
  if (!brief) return null;
  return { brief, generatedAt: new Date().toISOString() };
}
