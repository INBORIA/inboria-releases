import fs from "fs/promises";
import path from "path";

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) throw new Error("OPENAI_API_KEY missing");

function flattenStrings(obj, prefix = "", out = []) {
  if (typeof obj === "string") {
    out.push({ key: prefix, value: obj });
  } else if (Array.isArray(obj)) {
    obj.forEach((v, i) => flattenStrings(v, `${prefix}[${i}]`, out));
  } else if (obj && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) {
      flattenStrings(v, prefix ? `${prefix}.${k}` : k, out);
    }
  }
  return out;
}

function setByPath(obj, fullPath, value) {
  const tokens = [];
  let buf = "";
  for (let i = 0; i < fullPath.length; i++) {
    const c = fullPath[i];
    if (c === ".") { if (buf) { tokens.push(buf); buf = ""; } }
    else if (c === "[") { if (buf) { tokens.push(buf); buf = ""; } buf = "["; }
    else if (c === "]") { buf += "]"; tokens.push(buf); buf = ""; }
    else buf += c;
  }
  if (buf) tokens.push(buf);

  let cur = obj;
  for (let i = 0; i < tokens.length - 1; i++) {
    const t = tokens[i];
    const next = tokens[i + 1];
    const nextIsIdx = next.startsWith("[");
    if (t.startsWith("[")) {
      const idx = parseInt(t.slice(1, -1), 10);
      if (cur[idx] == null) cur[idx] = nextIsIdx ? [] : {};
      cur = cur[idx];
    } else {
      if (cur[t] == null) cur[t] = nextIsIdx ? [] : {};
      cur = cur[t];
    }
  }
  const last = tokens[tokens.length - 1];
  if (last.startsWith("[")) cur[parseInt(last.slice(1, -1), 10)] = value;
  else cur[last] = value;
}

async function translateBatch(strings, targetLang) {
  const langName = targetLang === "it"
    ? "Italian (Italian from Italy, formal Lei form for B2B SaaS)"
    : targetLang === "pt"
      ? "European Portuguese (pt-PT from Portugal, formal você/forma polida for B2B SaaS, NOT Brazilian Portuguese)"
      : targetLang === "pl"
        ? "Polish (Polish from Poland, formal Pan/Pani form for B2B SaaS — always use polite formal address, never informal ty)"
        : targetLang === "ro"
          ? "Romanian (Romanian from Romania, formal dumneavoastră form for B2B SaaS — always use polite formal address, never informal tu)"
          : targetLang;

  const sys = `You are a professional B2B SaaS translator. Translate UI strings from French to ${langName}.

CRITICAL RULES:
1. Preserve ALL placeholders intact: {{var}}, {var}, {count}, {name}, %s, etc.
2. Preserve ALL HTML/Markdown tags: <strong>, <a>, **bold**, [link]() - exactly.
3. Keep brand names in English: Inboria, Outlook, Gmail, HubSpot, Salesforce, Slack, Notion, Pipedrive, Microsoft, Apple, Google, Brevo, Paddle, Replit.
4. Use FORMAL B2B tone (vouvoiement equivalent).
5. Preserve emojis exactly.
6. Preserve newlines as \\n.
7. Keep technical terms consistent: "Boîte de réception" → "Posta in arrivo" (IT) / "Caixa de entrada" (PT) / "Skrzynka odbiorcza" (PL). "Brouillons" → "Bozze" / "Rascunhos" / "Wersje robocze". "Envoyés" → "Inviati" / "Enviados" / "Wysłane". "Tâches" → "Attività" / "Tarefas" / "Zadania". "Archives" → "Archivio" / "Arquivo" / "Archiwum". "Indésirables" → "Spam" / "Spam" / "Spam". "Paramètres" → "Impostazioni" / "Definições" / "Ustawienia". "Tableau de bord" → "Dashboard" / "Painel" / "Pulpit".
8. Output JSON object only with same keys as input. No explanations.`;

  const user = JSON.stringify(Object.fromEntries(strings.map((s, i) => [String(i), s.value])));

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
    }),
  });
  if (!resp.ok) throw new Error(`OpenAI ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
  const data = await resp.json();
  const parsed = JSON.parse(data.choices[0].message.content);
  return strings.map((s, i) => ({ key: s.key, value: parsed[String(i)] ?? s.value }));
}

async function translateFile(srcPath, destPath, targetLang, batchSize = 50, concurrency = 6) {
  const fr = JSON.parse(await fs.readFile(srcPath, "utf-8"));
  const flat = flattenStrings(fr);
  console.log(`[${targetLang}] ${path.basename(srcPath)}: ${flat.length} strings, batch=${batchSize}, concurrency=${concurrency}`);

  const translated = new Array(flat.length);
  let cursor = 0;
  let completed = 0;

  async function worker(workerId) {
    while (true) {
      const i = cursor;
      if (i >= flat.length) return;
      cursor += batchSize;
      const batch = flat.slice(i, Math.min(i + batchSize, flat.length));
      let attempt = 0;
      while (attempt < 5) {
        try {
          const result = await translateBatch(batch, targetLang);
          for (let j = 0; j < result.length; j++) translated[i + j] = result[j];
          completed += batch.length;
          process.stdout.write(`  [${targetLang} ${path.basename(destPath)}] ${completed}/${flat.length}\n`);
          break;
        } catch (e) {
          attempt++;
          console.log(`  retry ${attempt} (${targetLang} batch @${i}): ${String(e.message || e).slice(0, 100)}`);
          if (attempt >= 5) {
            for (let j = 0; j < batch.length; j++) translated[i + j] = batch[j];
            break;
          }
          await new Promise(r => setTimeout(r, 2000 * attempt));
        }
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, (_, i) => worker(i)));

  const out = Array.isArray(fr) ? [] : {};
  for (const item of translated) {
    if (item && item.key) setByPath(out, item.key, item.value);
  }
  await fs.writeFile(destPath, JSON.stringify(out, null, 2) + "\n");
  console.log(`✓ wrote ${destPath}`);
}

const target = process.argv[2];
const concurrency = parseInt(process.argv[3] || "6", 10);

const tasks = {
  "mobile-it": { src: "artifacts/ncv-mail-mobile/i18n/locales/fr.json", out: "artifacts/ncv-mail-mobile/i18n/locales/it.json", lang: "it" },
  "mobile-pt": { src: "artifacts/ncv-mail-mobile/i18n/locales/fr.json", out: "artifacts/ncv-mail-mobile/i18n/locales/pt.json", lang: "pt" },
  "mobile-pl": { src: "artifacts/ncv-mail-mobile/i18n/locales/fr.json", out: "artifacts/ncv-mail-mobile/i18n/locales/pl.json", lang: "pl" },
  "web-it":    { src: "artifacts/ncv-mail/src/i18n/locales/fr.json",    out: "artifacts/ncv-mail/src/i18n/locales/it.json",    lang: "it" },
  "web-pt":    { src: "artifacts/ncv-mail/src/i18n/locales/fr.json",    out: "artifacts/ncv-mail/src/i18n/locales/pt.json",    lang: "pt" },
  "web-pl":    { src: "artifacts/ncv-mail/src/i18n/locales/fr.json",    out: "artifacts/ncv-mail/src/i18n/locales/pl.json",    lang: "pl" },
  "mobile-ro": { src: "artifacts/ncv-mail-mobile/i18n/locales/fr.json", out: "artifacts/ncv-mail-mobile/i18n/locales/ro.json", lang: "ro" },
  "web-ro":    { src: "artifacts/ncv-mail/src/i18n/locales/fr.json",    out: "artifacts/ncv-mail/src/i18n/locales/ro.json",    lang: "ro" },
};

if (target === "all") {
  await Promise.all(["mobile-it", "mobile-pt", "web-it", "web-pt"].map(k => {
    const t = tasks[k];
    return translateFile(t.src, t.out, t.lang, 50, concurrency);
  }));
} else if (target === "mobile-all") {
  await Promise.all(["mobile-it", "mobile-pt"].map(k => {
    const t = tasks[k];
    return translateFile(t.src, t.out, t.lang, 50, concurrency);
  }));
} else if (target === "web-all") {
  await Promise.all(["web-it", "web-pt"].map(k => {
    const t = tasks[k];
    return translateFile(t.src, t.out, t.lang, 50, concurrency);
  }));
} else if (tasks[target]) {
  const t = tasks[target];
  await translateFile(t.src, t.out, t.lang, 50, concurrency);
} else {
  console.error(`Unknown target: ${target}. Use one of: ${Object.keys(tasks).join(", ")}, all`);
  process.exit(1);
}
