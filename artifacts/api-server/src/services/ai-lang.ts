import { supabaseAdmin } from "../lib/supabase";

export type AiLang = "fr" | "en" | "nl" | "de" | "es" | "it" | "pt" | "pl" | "ro" | "sv" | "da" | "fi" | "hu" | "cs" | "tr" | "ja" | "ko" | "vi" | "th" | "id" | "ms" | "el" | "uk" | "et" | "zh" | "zh-TW" | "lt" | "sr" | "ru" | "he" | "ar" | "hr" | "sk" | "sl" | "lv" | "mt" | "bg" | "nb" | "ca" | "ga" | "ur" | "hi" | "km";

const SUPPORTED: AiLang[] = ["fr", "en", "nl", "de", "es", "it", "pt", "pl", "ro", "sv", "da", "fi", "hu", "cs", "tr", "ja", "ko", "vi", "th", "id", "ms", "el", "uk", "et", "zh", "zh-TW", "lt", "sr", "ru", "he", "ar", "hr", "sk", "sl", "lv", "mt", "bg", "nb", "ca", "ga", "ur", "hi", "km"];

export function normalizeLang(input: unknown): AiLang {
  if (typeof input !== "string") return "fr";
  const raw = input.trim();
  const lowerFull = raw.toLowerCase();
  if (lowerFull === "zh-tw" || lowerFull === "zh_tw" || lowerFull === "zh-hant" || lowerFull === "zh-hk") return "zh-TW";
  const code = raw.substring(0, 2).toLowerCase() as AiLang;
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
  et: "EESTI",
  zh: "简体中文",
  "zh-TW": "繁體中文",
  lt: "LIETUVIŲ",
  sr: "СРПСКИ",
  ru: "РУССКИЙ",
  he: "עברית",
  ar: "العربية",
  hr: "HRVATSKI",
  sk: "SLOVENČINA",
  sl: "SLOVENŠČINA",
  lv: "LATVIEŠU",
  mt: "MALTI",
  bg: "БЪЛГАРСКИ",
  nb: "NORSK BOKMÅL",
  ca: "CATALÀ",
  ga: "GAEILGE",
  ur: "اردو",
  hi: "हिन्दी",
  km: "ខ្មែរ",
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
  et: "Palun vastake eesti keeles, kasutades viisakat vormi (Teie/Teid).",
  zh: "请使用简体中文回答,使用敬称『您』。",
  "zh-TW": "請使用繁體中文回答,使用敬稱『您』。",
  lt: "Prašome atsakyti lietuvių kalba, vartojant pagarbią formą (Jūs/Jus iš didžiosios raidės).",
  sr: "Молимо одговорите на српском језику (ћирилица), користећи учтиву форму (Ви/Вас великим словом).",
  ru: "Пожалуйста, отвечайте на русском языке, используя вежливую форму (Вы/Вас с большой буквы).",
  he: "אנא השב בעברית, בסגנון מקצועי ומכובד (לשון פנייה ישירה אך מנומסת, כמקובל בעברית עסקית).",
  ar: "يرجى الرد باللغة العربية الفصحى، بأسلوب مهني ومهذب يناسب التواصل التجاري بين الشركات.",
  hr: "Molimo odgovorite na hrvatskom jeziku, koristeći učtivu formu (Vi/Vas/Vam/Vaš velikim slovom).",
  sk: "Prosím, odpovedajte v slovenčine, používajte zdvorilé vykanie (Vy/Vás/Vám/Váš s veľkým písmenom).",
  sl: "Prosimo, odgovarjajte v slovenščini, uporabljajte vikanje (Vi/Vas/Vam/Vaš z veliko začetnico).",
  lv: "Lūdzu, atbildiet latviešu valodā, izmantojot pieklājīgo uzrunas formu (Jūs/Jums/Jūsu ar lielo burtu).",
  mt: "Jekk jogħġobkom, wieġbu bil-Malti, billi tużaw il-forma rispettuża (Inti/Tagħkom b'ittra kbira).",
  bg: "Моля, отговаряйте на български език, използвайки учтивата форма (Вие/Вас/Ви/Ваш с главна буква).",
  nb: "Vennligst svar på norsk bokmål med en profesjonell, høflig B2B-tone.",
  ca: "Si us plau, responeu en català utilitzant la forma de cortesia (Vostè/vostè).",
  ga: "Le do thoil, freagair as Gaeilge ag úsáid an fhoirm bhéasach (sibh/bhur) le ton gairmiúil B2B.",
  ur: "براہ کرم اردو میں احترام والے انداز (آپ) میں جواب دیں۔",
  hi: "कृपया हिन्दी में औपचारिक/सम्मानजनक रूप (आप) का उपयोग करते हुए उत्तर दें।",
  km: "សូមឆ្លើយជាភាសាខ្មែរដោយប្រើទម្រង់គួរសម (លោក/លោកស្រី)។",
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
