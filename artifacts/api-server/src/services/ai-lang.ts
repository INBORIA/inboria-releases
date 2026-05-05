import { supabaseAdmin } from "../lib/supabase";

export type AiLang = "fr" | "en" | "nl" | "de" | "es" | "it" | "pt" | "pl" | "ro" | "sv" | "da" | "fi" | "hu" | "cs" | "tr" | "ja" | "ko" | "vi" | "th" | "id" | "ms" | "el" | "uk";

const SUPPORTED: AiLang[] = ["fr", "en", "nl", "de", "es", "it", "pt", "pl", "ro", "sv", "da", "fi", "hu", "cs", "tr", "ja", "ko", "vi", "th", "id", "ms", "el", "uk"];

export function normalizeLang(input: unknown): AiLang {
  if (typeof input !== "string") return "fr";
  const code = input.substring(0, 2).toLowerCase() as AiLang;
  return SUPPORTED.includes(code) ? code : "fr";
}

const cache = new Map<string, { lang: AiLang; expiresAt: number }>();
const TTL_MS = 5 * 60 * 1000;

export async function getUserAiLang(userId: string): Promise<AiLang> {
  const now = Date.now();
  const hit = cache.get(userId);
  if (hit && hit.expiresAt > now) return hit.lang;

  const { data } = await supabaseAdmin
    .from("profiles")
    .select("ai_language")
    .eq("id", userId)
    .maybeSingle();

  const lang = normalizeLang((data as any)?.ai_language);
  cache.set(userId, { lang, expiresAt: now + TTL_MS });
  return lang;
}

export function invalidateUserAiLang(userId: string): void {
  cache.delete(userId);
}

const NAMES: Record<AiLang, string> = {
  fr: "FRANÇAIS",
  en: "ENGLISH",
  nl: "NEDERLANDS",
  de: "DEUTSCH",
  es: "ESPAÑOL",
  it: "ITALIANO",
  pt: "PORTUGUÊS",
  pl: "POLSKI",
  ro: "ROMÂNĂ",
  sv: "SVENSKA",
  da: "DANSK",
  fi: "SUOMI",
  hu: "MAGYAR",
  cs: "ČEŠTINA",
  tr: "TÜRKÇE",
  ja: "日本語",
  ko: "한국어",
  vi: "TIẾNG VIỆT",
  th: "ไทย",
  id: "BAHASA INDONESIA",
  ms: "BAHASA MELAYU",
  el: "ΕΛΛΗΝΙΚΑ",
  uk: "УКРАЇНСЬКА",
};

const SHORT_INSTRUCTION: Record<AiLang, string> = {
  fr: "Réponds en français.",
  en: "Respond in English.",
  nl: "Antwoord in het Nederlands.",
  de: "Antworte auf Deutsch.",
  es: "Responde en español.",
  it: "Rispondi in italiano.",
  pt: "Responda em português.",
  pl: "Odpowiadaj po polsku.",
  ro: "Răspundeți în limba română.",
  sv: "Svara på svenska.",
  da: "Svar på dansk.",
  fi: "Vastatkaa suomeksi.",
  hu: "Kérjük, válaszoljon magyarul.",
  cs: "Odpovězte prosím česky, použijte vykání.",
  tr: "Lütfen Türkçe yanıtlayın, resmi 'siz' formunu kullanın.",
  ja: "日本語で、です・ます調の丁寧な敬語で回答してください。",
  ko: "한국어로, 합쇼체(하십시오체)의 격식 있는 존댓말로 답변해 주십시오.",
  vi: "Vui lòng trả lời bằng tiếng Việt, sử dụng giọng điệu trang trọng (Quý khách / Quý vị).",
  th: "โปรดตอบเป็นภาษาไทยด้วยน้ำเสียงสุภาพและเป็นทางการ ใช้คำว่า 'ท่าน' เมื่อเรียกผู้ใช้",
  id: "Mohon jawab dalam Bahasa Indonesia formal dan baku, gunakan sapaan 'Anda'.",
  ms: "Sila jawab dalam Bahasa Melayu formal dan baku, gunakan sapaan 'anda'.",
  el: "Παρακαλώ απαντήστε στα ελληνικά, χρησιμοποιώντας τον πληθυντικό ευγενείας (εσείς/σας).",
  uk: "Будь ласка, відповідайте українською мовою, використовуючи ввічливу форму (Ви/Вас з великої літери).",
};

export function langName(lang: AiLang): string {
  return NAMES[lang];
}

export function langInstruction(lang: AiLang): string {
  return SHORT_INSTRUCTION[lang];
}

export function summaryLangInstruction(lang: AiLang): string {
  const name = NAMES[lang];
  return `IMPORTANT LANGUAGE: The "summary" and "tasks" fields MUST be written in ${name}, regardless of the email's original language. Do not translate proper nouns, brand names, or quoted text.`;
}
