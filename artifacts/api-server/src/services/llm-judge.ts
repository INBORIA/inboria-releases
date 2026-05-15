/**
 * Task #306 phase 5 — LLM-judge.
 *
 * Note la qualité d'une réponse Inboria via un appel gpt-4o-mini avec un
 * prompt structuré. Renvoie un score 0-100 + une raison courte.
 *
 * Async, non-bloquant côté caller : `judgeAndStore(logId, {...})` lance le
 * judge en background et update `inboria_chat_logs` par id quand fini.
 *
 * Cap : si `INBORIA_JUDGE_RATE` est < 1 (env), on skip aléatoirement pour
 * limiter le coût (par défaut 1.0 = score 100% des requêtes — gpt-4o-mini
 * coûte ~$0.0001 par scoring, négligeable).
 */

import OpenAI from "openai";
import { supabaseAdmin } from "../lib/supabase";
import { logger } from "../lib/logger";

const openai = new OpenAI({ apiKey: process.env["OPENAI_API_KEY"] });

const JUDGE_MODEL = "gpt-4o-mini";
const JUDGE_RATE = (() => {
  const n = Number(process.env["INBORIA_JUDGE_RATE"] ?? "1");
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : 1;
})();

export interface JudgeInput {
  question: string;
  reply: string;
  lang: string | null;
  /** Modèle qui a produit la réponse, pour traçabilité. */
  responseModel: string;
}

export interface JudgeOutput {
  score: number; // 0-100
  reason: string; // court (< 140 chars)
}

const JUDGE_SYSTEM_PROMPT = `Tu es un évaluateur impartial de la qualité des réponses d'un assistant IA mail (Inboria).

Note la réponse de 0 à 100 selon ces critères :
- Pertinence (la réponse répond-elle à la question ?) : 40 pts
- Citation [mail#ID] quand la question porte sur un mail spécifique : 20 pts
- Absence d'hallucination (pas d'invention de faits/dates/contacts) : 20 pts
- Clarté et concision : 10 pts
- Honnêteté (dit "je ne trouve pas" plutôt que d'inventer) : 10 pts

Réponds STRICTEMENT en JSON : {"score": <0-100>, "reason": "<une phrase < 140 chars expliquant le score>"}.

Pas d'autre texte. Pas de markdown. Juste le JSON.`;

export async function judge(input: JudgeInput): Promise<JudgeOutput | null> {
  if (Math.random() > JUDGE_RATE) return null;
  if (!input.reply || input.reply.trim().length === 0) return null;

  try {
    const userPrompt = [
      `Langue de l'échange : ${input.lang || "inconnue"}`,
      `Modèle qui a répondu : ${input.responseModel}`,
      "",
      "QUESTION DE L'UTILISATEUR :",
      input.question.slice(0, 1500),
      "",
      "RÉPONSE D'INBORIA :",
      input.reply.slice(0, 3000),
    ].join("\n");

    const completion = await openai.chat.completions.create({
      model: JUDGE_MODEL,
      max_completion_tokens: 200,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: JUDGE_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    });
    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { score?: number; reason?: string };
    const score = Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 0)));
    const reason = String(parsed.reason || "").slice(0, 200);
    return { score, reason };
  } catch (err: any) {
    logger.warn({ err: err?.message }, "[llm-judge] scoring failed (non-fatal)");
    return null;
  }
}

/**
 * Lance le judge en async et update la ligne inboria_chat_logs correspondante.
 * Fire-and-forget : ne lève jamais d'exception.
 */
export function judgeAndStore(
  logId: string,
  input: JudgeInput,
): void {
  void (async () => {
    const t0 = Date.now();
    const out = await judge(input);
    if (!out) return;
    try {
      const { error } = await supabaseAdmin
        .from("inboria_chat_logs")
        .update({
          judge_score: out.score,
          judge_reason: out.reason,
          judge_model: JUDGE_MODEL,
          judge_latency_ms: Date.now() - t0,
          judge_at: new Date().toISOString(),
        })
        .eq("id", logId);
      if (error) {
        logger.warn(
          { err: error.message, logId },
          "[llm-judge] update failed (non-fatal)",
        );
      }
    } catch (err: any) {
      logger.warn(
        { err: err?.message, logId },
        "[llm-judge] update crashed (non-fatal)",
      );
    }
  })();
}

/**
 * Stocke un résultat de shadow A/B run (réponse alternative gpt-4o) sur une
 * ligne existante. Score le shadow via le judge en parallèle.
 */
export function storeShadowAndJudge(
  logId: string,
  shadowReply: string,
  shadowModel: string,
  shadowLatencyMs: number,
  judgeInput: JudgeInput,
): void {
  void (async () => {
    try {
      // Update synchrone des métadonnées shadow (sans le score, qui suit)
      await supabaseAdmin
        .from("inboria_chat_logs")
        .update({
          ab_variant: "shadow",
          ab_shadow_model: shadowModel,
          ab_shadow_reply_len: shadowReply.length,
          ab_shadow_latency_ms: shadowLatencyMs,
        })
        .eq("id", logId);

      // Judge le shadow reply en async
      const out = await judge({ ...judgeInput, reply: shadowReply, responseModel: shadowModel });
      if (!out) return;
      await supabaseAdmin
        .from("inboria_chat_logs")
        .update({ ab_shadow_score: out.score })
        .eq("id", logId);
    } catch (err: any) {
      logger.warn(
        { err: err?.message, logId },
        "[llm-judge] shadow store crashed (non-fatal)",
      );
    }
  })();
}
