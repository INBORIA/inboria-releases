import fs from "node:fs";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const SRC = "/home/runner/workspace/artifacts/ncv-mail/src/lib/category-translations.ts";
const src = fs.readFileSync(SRC, "utf8");

// Parse all entries: capture key + en name + en desc
const entryRe = /^\s{2}"([^"]+)":\s*\{\s*\n\s+name:\s*\{\s*en:\s*"([^"]+)",\s*nl:\s*"([^"]*)",\s*de:\s*"([^"]*)",\s*es:\s*"([^"]*)"\s*\},\s*\n\s+desc:\s*\{\s*en:\s*"([^"]+)",\s*nl:\s*"([^"]*)",\s*de:\s*"([^"]*)",\s*es:\s*"([^"]*)"\s*\},\s*\n\s+\},/gm;
const entries = [];
let m;
while ((m = entryRe.exec(src)) !== null) {
  entries.push({
    key: m[1],
    name: { en: m[2], nl: m[3], de: m[4], es: m[5] },
    desc: { en: m[6], nl: m[7], de: m[8], es: m[9] },
  });
}
console.error(`Parsed ${entries.length} entries.`);
if (entries.length < 50) { console.error("PARSE INCOMPLETE — abort"); process.exit(1); }

// Dedupe by EN content (some keys share the same translations e.g. accent variants)
const uniqueByEn = new Map();
for (const e of entries) {
  const sig = e.name.en + "||" + e.desc.en;
  if (!uniqueByEn.has(sig)) uniqueByEn.set(sig, { name_en: e.name.en, desc_en: e.desc.en });
}
const unique = [...uniqueByEn.values()];
console.error(`Unique EN pairs: ${unique.length}`);

const TARGET_LANGS = [
  "fr","it","pt","pl","ro","sv","da","fi","hu","cs","tr","ja","ko","vi","th","id","ms","el","uk","et",
  "zh","zh-TW","lt","sr","ru","he","ar","hr","sk","sl","lv","mt","bg","nb","ca","ga","ur","hi","km",
];

const LANG_INSTRUCTIONS = {
  fr: "French (vouvoiement professionnel B2B).",
  it: "Italian (formal B2B, Lei).",
  pt: "European Portuguese (formal B2B, NEVER Brazilian).",
  pl: "Polish (formal Pan/Pani B2B).",
  ro: "Romanian (formal dumneavoastră B2B).",
  sv: "Swedish (formal B2B).",
  da: "Danish (formal B2B).",
  fi: "Finnish (formal teitittely B2B).",
  hu: "Hungarian (formal Ön B2B).",
  cs: "Czech (formal vykání Vy B2B).",
  tr: "Turkish (formal siz B2B).",
  ja: "Japanese (formal です/ます調 + 敬語 B2B).",
  ko: "Korean (formal 합쇼체 B2B).",
  vi: "Vietnamese (formal Quý khách B2B).",
  th: "Thai (formal ท่าน B2B).",
  id: "Indonesian (formal Bahasa baku Anda B2B).",
  ms: "Malay (formal Bahasa baku anda B2B).",
  el: "Greek (formal πληθυντικός ευγενείας B2B).",
  uk: "Ukrainian (formal Ви capitalized B2B).",
  et: "Estonian (formal Teie capitalized B2B).",
  zh: "Simplified Chinese (formal 您, mainland conventions, NEVER Traditional).",
  "zh-TW": "Traditional Chinese (formal 您, Taiwan conventions 設定/帳戶/軟體, NEVER Simplified).",
  lt: "Lithuanian (formal Jūs capitalized B2B).",
  sr: "Serbian (formal Ви capitalized, Cyrillic ONLY, Matica srpska Serbia).",
  ru: "Russian (formal Вы capitalized, modern orthography with ё, Russia conventions).",
  he: "Modern Israeli Hebrew (B2B, no nikud, RTL).",
  ar: "Modern Standard Arabic / الفصحى (formal أنتم, NEVER dialectal, no tashkeel, RTL).",
  hr: "Croatian (formal Vi capitalized, Latin ONLY, ijekavica, Croatia conventions).",
  sk: "Slovak (formal vykanie Vy capitalized, Slovakia conventions, NEVER Czech).",
  sl: "Slovenian (formal vikanje Vi capitalized, Slovenia conventions).",
  lv: "Latvian (formal Jūs capitalized, Latvia conventions).",
  mt: "Maltese (formal Tagħkom, Latin script).",
  bg: "Bulgarian (formal Вие capitalized, Cyrillic ONLY).",
  nb: "Norwegian Bokmål (du, Språkrådet conventions, NEVER Nynorsk NEVER Danish).",
  ca: "Catalan (formal vostè + 2pl -eu UI forms, Central Catalan, NEVER Spanish NEVER Valencian).",
  ga: "Irish (formal sibh, An Caighdeán Oifigiúil, NEVER Scottish Gaelic).",
  ur: "Urdu (formal آپ, Perso-Arabic Nastaliq RTL ONLY, NEVER Devanagari/Roman).",
  hi: "Hindi (formal आप, Devanagari ONLY, NEVER Perso-Arabic/Hinglish).",
  km: "Khmer (formal លោកអ្នក, Khmer script ONLY).",
};

async function translateLang(lang) {
  const sys = `You translate short B2B email-category labels into ${LANG_INSTRUCTIONS[lang]} Keep terminology professional, concise, idiomatic for native business users. Translate slashes "/" naturally (keep " / " separator). Reply with JSON ONLY: {"items":[{"name":"...","desc":"..."}]} same order, same length as input.`;
  const user = JSON.stringify({ items: unique.map(u => ({ name: u.name_en, desc: u.desc_en })) });
  const r = await client.chat.completions.create({
    model: "gpt-5-mini",
    max_completion_tokens: 8192,
    response_format: { type: "json_object" },
    messages: [{ role: "system", content: sys }, { role: "user", content: user }],
  });
  const txt = r.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(txt);
  if (!Array.isArray(parsed.items) || parsed.items.length !== unique.length) {
    throw new Error(`[${lang}] bad shape: got ${parsed.items?.length} expected ${unique.length}`);
  }
  return parsed.items;
}

async function withRetry(lang, n = 3) {
  let last;
  for (let i = 0; i < n; i++) {
    try { return await translateLang(lang); }
    catch (e) { last = e; console.error(`[${lang}] retry ${i+1}: ${e.message}`); }
  }
  throw last;
}

// Run with concurrency 4
const results = {};
const queue = [...TARGET_LANGS];
async function worker() {
  while (queue.length) {
    const lang = queue.shift();
    const items = await withRetry(lang);
    results[lang] = items;
    console.error(`[${lang}] done (${items.length})`);
  }
}
await Promise.all(Array.from({length: 10}, () => worker()));

// Build output: for each unique EN sig, the per-lang translations
const sigToLangs = new Map();
[...uniqueByEn.entries()].forEach(([sig, _], i) => {
  const langMap = {};
  for (const lang of TARGET_LANGS) {
    langMap[lang] = results[lang][i];
  }
  sigToLangs.set(sig, langMap);
});

// Now for each original entry, attach per-lang name + desc
const finalEntries = entries.map(e => {
  const sig = e.name.en + "||" + e.desc.en;
  const langs = sigToLangs.get(sig);
  const name = { en: e.name.en, nl: e.name.nl, de: e.name.de, es: e.name.es };
  const desc = { en: e.desc.en, nl: e.desc.nl, de: e.desc.de, es: e.desc.es };
  for (const lang of TARGET_LANGS) {
    name[lang] = langs[lang].name;
    desc[lang] = langs[lang].desc;
  }
  return { key: e.key, name, desc };
});

fs.writeFileSync("/home/runner/workspace/.local/tmp/cat-translations.json", JSON.stringify(finalEntries, null, 2));
console.error("Wrote .local/tmp/cat-translations.json");
