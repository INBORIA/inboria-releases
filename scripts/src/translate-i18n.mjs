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
          : targetLang === "sv"
            ? "Swedish (Swedish from Sweden, modern professional B2B SaaS tone using 'du' which is standard polite form in Swedish business context — NOT the archaic 'ni')"
            : targetLang === "da"
              ? "Danish (Danish from Denmark, modern professional B2B SaaS tone using 'du' which is standard polite form in Danish business context — NOT the archaic 'De')"
              : targetLang === "fi"
                ? "Finnish (Finnish from Finland, polite B2B SaaS tone using 'te' formal address (teitittely) and verb in 2nd person plural — never informal 'sinä')"
                : targetLang === "hu"
                  ? "Hungarian (Hungarian from Hungary, formal B2B SaaS tone using 'Ön' (önözés) with verb in 3rd person singular — never informal 'te')"
                  : targetLang === "cs"
                    ? "Czech (Czech from Czech Republic, formal B2B SaaS tone using vykání: 'vy' with verb in 2nd person plural, capitalized Vy/Vás/Vám/Váš in formal correspondence — never informal 'ty')"
                    : targetLang === "tr"
                      ? "Turkish (Turkish from Turkey, formal B2B SaaS tone using 'siz' formal address with verb in 2nd person plural — never informal 'sen')"
                      : targetLang === "ja"
                        ? "Japanese (Japanese from Japan, formal B2B SaaS tone using です/ます調 (desu/masu polite form) and 敬語 (keigo) where appropriate — never plain/casual form 'だ/である')"
                        : targetLang === "ko"
                          ? "Korean (Korean from South Korea, formal B2B SaaS tone using 합쇼체 / 하십시오체 (hapsyo-che, formal polite endings -ㅂ니다/-습니다, -십시오) — never informal 반말 or casual 해요체 in UI labels)"
                          : targetLang === "vi"
                            ? "Vietnamese (Vietnamese from Vietnam, formal B2B SaaS tone using 'Quý khách' / 'Quý vị' as polite address with 'xin vui lòng' for requests — never informal 'bạn' or familiar pronouns in user-facing copy)"
                            : targetLang === "th"
                              ? "Thai (Thai from Thailand, formal B2B SaaS tone using 'ท่าน' as polite address and formal vocabulary; use 'โปรด' / 'กรุณา' for polite requests — avoid casual particles 'จ้า/จ๊ะ' and informal 'คุณ' familiarity in UI labels; do not insert ครับ/ค่ะ in short UI button labels)"
                              : targetLang === "id"
                                ? "Indonesian (Bahasa Indonesia, formal B2B SaaS tone using 'Anda' (capitalized) as polite address and Bahasa baku/standard formal vocabulary; use 'silakan' / 'mohon' for polite requests — never informal 'kamu/lu/lo' or colloquial slang in UI labels)"
                                : targetLang === "ms"
                                  ? "Malay (Bahasa Melayu from Malaysia, formal B2B SaaS tone using 'anda' as polite address and Bahasa Melayu baku/standard formal vocabulary; use 'sila' / 'mohon' for polite requests — never informal 'kau/awak' familiarity or colloquial bahasa pasar in UI labels)"
                                  : targetLang === "el"
                                    ? "Greek (Modern Greek from Greece, formal B2B SaaS tone using plural-of-politeness πληθυντικός ευγενείας: 'εσείς' / 'σας' / 2nd person plural verbs (κάντε/επιλέξτε/συνδεθείτε) — never informal singular 'εσύ/σου' or 2nd person singular verbs in UI labels)"
                                    : targetLang === "uk"
                                      ? "Ukrainian (Ukrainian from Ukraine, formal B2B SaaS tone using polite address 'Ви' / 'Вас' / 'Вам' (capitalized) and 2nd person plural verbs — never informal 'ти/тебе/тобі' in UI labels; use modern Ukrainian orthography with apostrophe ' not Russian ъ; avoid russisms)"
                                      : targetLang === "et"
                                        ? "Estonian (Estonian from Estonia, formal B2B SaaS tone using polite address 'Teie' / 'Teid' / 'Teile' (capitalized) and 'Te' for verb agreement — never informal 'sina/sinu' in UI labels; use 'Palun' for polite requests; modern standard Estonian (kirjakeel) with proper õ/ä/ö/ü diacritics; avoid germanisms and russisms)"
                                        : targetLang === "zh"
                                          ? "Simplified Chinese (简体中文, Mainland China Mandarin, formal B2B SaaS tone using polite address '您' (nín) — never informal '你' (nǐ); use '请' for polite requests; use Simplified Chinese characters only (NOT Traditional 繁體); use mainland conventions for technical terms (e.g. '邮件' not '電郵', '设置' not '設定', '登录' not '登入', '账户' not '帳戶', '软件' not '軟件'); use Chinese full-width punctuation (,。:;!?) in narrative text but keep ASCII punctuation inside placeholders/code/URLs)"
                                          : targetLang === "zh-TW"
                                            ? "Traditional Chinese (繁體中文, Taiwan Mandarin 國語, formal B2B SaaS tone using polite address '您' (nín) — never informal '你' (nǐ); use '請' for polite requests; use Traditional Chinese characters ONLY (NEVER Simplified 简体 — e.g. write 設定 not 设置, 電子郵件/郵件 not 邮件, 登入 not 登录, 帳戶 not 账户, 軟體 not 软件, 資訊 not 信息, 檔案 not 文件, 連線 not 连接, 點擊 not 点击, 確認 not 确认, 應用程式 not 应用程序); use Taiwan terminology conventions (軟體 not 軟件, 網路 not 網絡, 滑鼠 not 鼠標, 印表機 not 打印機, 視訊 not 視頻, 解析度 not 分辨率, 程式 not 程序, 資料庫 not 數據庫, 預設 not 默認); use Chinese full-width punctuation (,。:;!?「」『』) in narrative text but keep ASCII punctuation inside placeholders/code/URLs; use 「」 for quotes not '\"'; do NOT use Hong Kong colloquialisms)"
                                            : targetLang === "lt"
                                              ? "Lithuanian (lietuvių kalba, Lithuanian from Lithuania, formal B2B SaaS tone using polite address 'Jūs' / 'Jus' / 'Jūsų' / 'Jums' (always capitalized in formal address) and 2nd person plural verbs — never informal 'tu/tave/tavo' in UI labels; use 'prašome' for polite requests; modern standard Lithuanian (bendrinė lietuvių kalba) with proper diacritics ą/č/ę/ė/į/š/ų/ū/ž; use Lithuanian quotation marks „...“ for quotes; avoid russisms and germanisms; use native terminology where established (e.g. 'el. paštas' for email, 'nustatymai' for settings, 'prisijungti' for log in, 'paskyra' for account, 'slaptažodis' for password, 'pašto dėžutė' for mailbox))"
                                              : targetLang === "sr"
                                                ? "Serbian (српски језик, Serbian from Serbia in CYRILLIC SCRIPT ONLY — never Latin script; formal B2B SaaS tone using polite address 'Ви' / 'Вас' / 'Вам' / 'Ваш' / 'Вашу' (always CAPITALIZED in formal address) and 2nd person plural verbs — never informal 'ти/тебе/теби' in UI labels; use 'молимо' for polite requests; standard Serbian (стандардни српски) following Matica srpska orthography; use Serbian quotation marks „...“ for quotes; do NOT use Croatian/Bosnian variants (write нема not nema, време not vrijeme, хлеб not хљеб); use native terminology where established (e.g. 'е-пошта' or 'имејл' for email, 'подешавања' for settings, 'пријава' for log in, 'налог' for account, 'лозинка' for password, 'сандуче' for mailbox))"
                                                : targetLang === "ru"
                                                  ? "Russian (русский язык, Russian from Russia, formal B2B SaaS tone using polite address 'Вы' / 'Вас' / 'Вам' / 'Ваш' / 'Вашу' (always CAPITALIZED in formal address) and 2nd person plural verbs — never informal 'ты/тебя/тебе' in UI labels; use 'пожалуйста' for polite requests; standard modern Russian following современная орфография; use ё where applicable (e.g. подключён, отключён); use Russian quotation marks «...» for quotes (NOT „...“ which are German/Serbian); use Russian em-dash with spaces — like this; use native terminology where established (e.g. 'электронная почта' or 'email' for email, 'настройки' for settings, 'войти' for log in, 'аккаунт' or 'учётная запись' for account, 'пароль' for password, 'почтовый ящик' for mailbox, 'входящие' for inbox))"
                                                  : targetLang === "he"
                                                    ? "Hebrew (עברית, Modern Israeli Hebrew, formal B2B SaaS tone — Hebrew has no T-V distinction so use standard direct address with respectful professional register as customary in Israeli business communication; use 'אנא' or 'נא' for polite requests; standard modern Hebrew (עברית תקנית) following Academy of the Hebrew Language conventions; write WITHOUT vowel points (ניקוד) — UI text is unpointed; do NOT add nikud; use Hebrew geresh ׳ and gershayim ״ for abbreviations (not ASCII '/\"); use Hebrew quotation marks \"...\" (standard double quotes are fine); RTL text — keep ASCII placeholders/code/URLs/numbers as-is, the rendering layer handles direction; use native terminology where established (e.g. 'דוא״ל' or 'אימייל' for email, 'הגדרות' for settings, 'התחבר/התחברות' for log in, 'חשבון' for account, 'סיסמה' for password, 'תיבת דואר' for mailbox, 'דואר נכנס' for inbox, 'אפליקציה' for app); use feminine/masculine forms appropriately — default to masculine generic form as standard in Hebrew UI unless context implies otherwise; avoid English loanwords when good Hebrew equivalents exist)"
                                                    : targetLang === "ar"
                                                      ? "Arabic (العربية, Modern Standard Arabic / اللغة العربية الفصحى — NEVER use dialectal Arabic such as Egyptian, Levantine, Gulf, Moroccan; formal B2B SaaS tone using respectful 2nd person plural forms (أنتم/كم) for polite address as customary in formal Arabic business writing — never informal singular أنت/ك in UI labels addressing the user; use 'يرجى' or 'الرجاء' for polite requests; standard MSA following Academy of the Arabic Language conventions; write WITHOUT diacritics (تشكيل/حركات) — UI text is unvowelized; do NOT add tashkeel/harakat except for strictly necessary disambiguation; use Arabic punctuation: Arabic comma ، (NOT ASCII ,), Arabic semicolon ؛, Arabic question mark ؟ (NOT ASCII ?); use Arabic-Indic digits only when the rest of the string is fully Arabic prose — keep ASCII Western digits (0-9) for placeholders/codes/numbers/dates that interpolate with code; RTL text — keep ASCII placeholders/code/URLs/{{vars}}/numbers as-is, the rendering layer handles direction; use native MSA terminology where established (e.g. 'البريد الإلكتروني' for email — avoid 'إيميل'; 'الإعدادات' for settings; 'تسجيل الدخول' for log in; 'الحساب' for account; 'كلمة المرور' for password; 'صندوق البريد' for mailbox; 'البريد الوارد' for inbox; 'التطبيق' for app; 'الاشتراك' for subscription); avoid English loanwords when good Arabic equivalents exist; use masculine generic form as standard in Arabic UI unless context implies otherwise)"
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

function getByPath(obj, fullPath) {
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
  for (const t of tokens) {
    if (cur == null) return undefined;
    if (t.startsWith("[")) cur = cur[parseInt(t.slice(1, -1), 10)];
    else cur = cur[t];
  }
  return cur;
}

async function translateFile(srcPath, destPath, targetLang, batchSize = 50, concurrency = 6) {
  const fr = JSON.parse(await fs.readFile(srcPath, "utf-8"));
  const flat = flattenStrings(fr);

  let existing = Array.isArray(fr) ? [] : {};
  try {
    const prev = JSON.parse(await fs.readFile(destPath, "utf-8"));
    if (prev && typeof prev === "object") existing = prev;
  } catch { /* fresh */ }

  const out = existing;
  const translated = new Array(flat.length);
  const todo = [];
  for (let i = 0; i < flat.length; i++) {
    const item = flat[i];
    const cur = getByPath(out, item.key);
    if (typeof cur === "string" && cur !== item.value) {
      translated[i] = { key: item.key, value: cur };
    } else {
      todo.push(i);
    }
  }
  console.log(`[${targetLang}] ${path.basename(srcPath)}: ${flat.length} strings (${todo.length} todo, ${flat.length - todo.length} cached), batch=${batchSize}, concurrency=${concurrency}`);

  if (todo.length === 0) {
    console.log(`✓ already complete: ${destPath}`);
    return;
  }

  let cursor = 0;
  let completed = 0;
  const SAVE_EVERY = 5;
  let batchesSinceFlush = 0;

  async function flush() {
    const snapshot = Array.isArray(fr) ? [] : {};
    for (const item of translated) {
      if (item && item.key) setByPath(snapshot, item.key, item.value);
    }
    for (let i = 0; i < flat.length; i++) {
      if (translated[i]) continue;
      const cur = getByPath(out, flat[i].key);
      if (typeof cur === "string" && cur !== flat[i].value) setByPath(snapshot, flat[i].key, cur);
    }
    await fs.writeFile(destPath, JSON.stringify(snapshot, null, 2) + "\n");
  }

  async function worker(workerId) {
    while (true) {
      const ti = cursor;
      if (ti >= todo.length) return;
      cursor += batchSize;
      const indices = todo.slice(ti, Math.min(ti + batchSize, todo.length));
      const batch = indices.map(i => flat[i]);
      let attempt = 0;
      while (attempt < 5) {
        try {
          const result = await translateBatch(batch, targetLang);
          for (let j = 0; j < result.length; j++) translated[indices[j]] = result[j];
          completed += batch.length;
          process.stdout.write(`  [${targetLang} ${path.basename(destPath)}] ${completed}/${todo.length}\n`);
          batchesSinceFlush++;
          if (batchesSinceFlush >= SAVE_EVERY) {
            batchesSinceFlush = 0;
            await flush();
          }
          break;
        } catch (e) {
          attempt++;
          console.log(`  retry ${attempt} (${targetLang} batch @${ti}): ${String(e.message || e).slice(0, 100)}`);
          if (attempt >= 5) {
            for (let j = 0; j < batch.length; j++) translated[indices[j]] = batch[j];
            break;
          }
          await new Promise(r => setTimeout(r, 2000 * attempt));
        }
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, (_, i) => worker(i)));
  await flush();
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
  "mobile-sv": { src: "artifacts/ncv-mail-mobile/i18n/locales/fr.json", out: "artifacts/ncv-mail-mobile/i18n/locales/sv.json", lang: "sv" },
  "web-sv":    { src: "artifacts/ncv-mail/src/i18n/locales/fr.json",    out: "artifacts/ncv-mail/src/i18n/locales/sv.json",    lang: "sv" },
  "mobile-da": { src: "artifacts/ncv-mail-mobile/i18n/locales/fr.json", out: "artifacts/ncv-mail-mobile/i18n/locales/da.json", lang: "da" },
  "web-da":    { src: "artifacts/ncv-mail/src/i18n/locales/fr.json",    out: "artifacts/ncv-mail/src/i18n/locales/da.json",    lang: "da" },
  "mobile-fi": { src: "artifacts/ncv-mail-mobile/i18n/locales/fr.json", out: "artifacts/ncv-mail-mobile/i18n/locales/fi.json", lang: "fi" },
  "web-fi":    { src: "artifacts/ncv-mail/src/i18n/locales/fr.json",    out: "artifacts/ncv-mail/src/i18n/locales/fi.json",    lang: "fi" },
  "mobile-hu": { src: "artifacts/ncv-mail-mobile/i18n/locales/fr.json", out: "artifacts/ncv-mail-mobile/i18n/locales/hu.json", lang: "hu" },
  "web-hu":    { src: "artifacts/ncv-mail/src/i18n/locales/fr.json",    out: "artifacts/ncv-mail/src/i18n/locales/hu.json",    lang: "hu" },
  "mobile-cs": { src: "artifacts/ncv-mail-mobile/i18n/locales/fr.json", out: "artifacts/ncv-mail-mobile/i18n/locales/cs.json", lang: "cs" },
  "web-cs":    { src: "artifacts/ncv-mail/src/i18n/locales/fr.json",    out: "artifacts/ncv-mail/src/i18n/locales/cs.json",    lang: "cs" },
  "mobile-tr": { src: "artifacts/ncv-mail-mobile/i18n/locales/fr.json", out: "artifacts/ncv-mail-mobile/i18n/locales/tr.json", lang: "tr" },
  "web-tr":    { src: "artifacts/ncv-mail/src/i18n/locales/fr.json",    out: "artifacts/ncv-mail/src/i18n/locales/tr.json",    lang: "tr" },
  "mobile-ja": { src: "artifacts/ncv-mail-mobile/i18n/locales/fr.json", out: "artifacts/ncv-mail-mobile/i18n/locales/ja.json", lang: "ja" },
  "web-ja":    { src: "artifacts/ncv-mail/src/i18n/locales/fr.json",    out: "artifacts/ncv-mail/src/i18n/locales/ja.json",    lang: "ja" },
  "mobile-ko": { src: "artifacts/ncv-mail-mobile/i18n/locales/fr.json", out: "artifacts/ncv-mail-mobile/i18n/locales/ko.json", lang: "ko" },
  "web-ko":    { src: "artifacts/ncv-mail/src/i18n/locales/fr.json",    out: "artifacts/ncv-mail/src/i18n/locales/ko.json",    lang: "ko" },
  "mobile-vi": { src: "artifacts/ncv-mail-mobile/i18n/locales/fr.json", out: "artifacts/ncv-mail-mobile/i18n/locales/vi.json", lang: "vi" },
  "web-vi":    { src: "artifacts/ncv-mail/src/i18n/locales/fr.json",    out: "artifacts/ncv-mail/src/i18n/locales/vi.json",    lang: "vi" },
  "mobile-th": { src: "artifacts/ncv-mail-mobile/i18n/locales/fr.json", out: "artifacts/ncv-mail-mobile/i18n/locales/th.json", lang: "th" },
  "web-th":    { src: "artifacts/ncv-mail/src/i18n/locales/fr.json",    out: "artifacts/ncv-mail/src/i18n/locales/th.json",    lang: "th" },
  "mobile-id": { src: "artifacts/ncv-mail-mobile/i18n/locales/fr.json", out: "artifacts/ncv-mail-mobile/i18n/locales/id.json", lang: "id" },
  "web-id":    { src: "artifacts/ncv-mail/src/i18n/locales/fr.json",    out: "artifacts/ncv-mail/src/i18n/locales/id.json",    lang: "id" },
  "mobile-ms": { src: "artifacts/ncv-mail-mobile/i18n/locales/fr.json", out: "artifacts/ncv-mail-mobile/i18n/locales/ms.json", lang: "ms" },
  "web-ms":    { src: "artifacts/ncv-mail/src/i18n/locales/fr.json",    out: "artifacts/ncv-mail/src/i18n/locales/ms.json",    lang: "ms" },
  "mobile-el": { src: "artifacts/ncv-mail-mobile/i18n/locales/fr.json", out: "artifacts/ncv-mail-mobile/i18n/locales/el.json", lang: "el" },
  "web-el":    { src: "artifacts/ncv-mail/src/i18n/locales/fr.json",    out: "artifacts/ncv-mail/src/i18n/locales/el.json",    lang: "el" },
  "mobile-uk": { src: "artifacts/ncv-mail-mobile/i18n/locales/fr.json", out: "artifacts/ncv-mail-mobile/i18n/locales/uk.json", lang: "uk" },
  "web-uk":    { src: "artifacts/ncv-mail/src/i18n/locales/fr.json",    out: "artifacts/ncv-mail/src/i18n/locales/uk.json",    lang: "uk" },
  "mobile-et": { src: "artifacts/ncv-mail-mobile/i18n/locales/fr.json", out: "artifacts/ncv-mail-mobile/i18n/locales/et.json", lang: "et" },
  "web-et":    { src: "artifacts/ncv-mail/src/i18n/locales/fr.json",    out: "artifacts/ncv-mail/src/i18n/locales/et.json",    lang: "et" },
  "mobile-zh": { src: "artifacts/ncv-mail-mobile/i18n/locales/fr.json", out: "artifacts/ncv-mail-mobile/i18n/locales/zh.json", lang: "zh" },
  "web-zh":    { src: "artifacts/ncv-mail/src/i18n/locales/fr.json",    out: "artifacts/ncv-mail/src/i18n/locales/zh.json",    lang: "zh" },
  "mobile-zh-TW": { src: "artifacts/ncv-mail-mobile/i18n/locales/fr.json", out: "artifacts/ncv-mail-mobile/i18n/locales/zh-TW.json", lang: "zh-TW" },
  "web-zh-TW":    { src: "artifacts/ncv-mail/src/i18n/locales/fr.json",    out: "artifacts/ncv-mail/src/i18n/locales/zh-TW.json",    lang: "zh-TW" },
  "mobile-lt": { src: "artifacts/ncv-mail-mobile/i18n/locales/fr.json", out: "artifacts/ncv-mail-mobile/i18n/locales/lt.json", lang: "lt" },
  "web-lt":    { src: "artifacts/ncv-mail/src/i18n/locales/fr.json",    out: "artifacts/ncv-mail/src/i18n/locales/lt.json",    lang: "lt" },
  "mobile-sr": { src: "artifacts/ncv-mail-mobile/i18n/locales/fr.json", out: "artifacts/ncv-mail-mobile/i18n/locales/sr.json", lang: "sr" },
  "web-sr":    { src: "artifacts/ncv-mail/src/i18n/locales/fr.json",    out: "artifacts/ncv-mail/src/i18n/locales/sr.json",    lang: "sr" },
  "mobile-ru": { src: "artifacts/ncv-mail-mobile/i18n/locales/fr.json", out: "artifacts/ncv-mail-mobile/i18n/locales/ru.json", lang: "ru" },
  "web-ru":    { src: "artifacts/ncv-mail/src/i18n/locales/fr.json",    out: "artifacts/ncv-mail/src/i18n/locales/ru.json",    lang: "ru" },
  "mobile-he": { src: "artifacts/ncv-mail-mobile/i18n/locales/fr.json", out: "artifacts/ncv-mail-mobile/i18n/locales/he.json", lang: "he" },
  "web-he":    { src: "artifacts/ncv-mail/src/i18n/locales/fr.json",    out: "artifacts/ncv-mail/src/i18n/locales/he.json",    lang: "he" },
  "mobile-ar": { src: "artifacts/ncv-mail-mobile/i18n/locales/fr.json", out: "artifacts/ncv-mail-mobile/i18n/locales/ar.json", lang: "ar" },
  "web-ar":    { src: "artifacts/ncv-mail/src/i18n/locales/fr.json",    out: "artifacts/ncv-mail/src/i18n/locales/ar.json",    lang: "ar" },
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
