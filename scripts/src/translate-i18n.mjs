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
                                                    : targetLang === "bg"
                                                      ? "Bulgarian (български език, Bulgarian from Bulgaria, formal B2B SaaS tone using polite address 'Вие' / 'Вас' / 'Ви' / 'Ваш' / 'Вашата' (always CAPITALIZED in formal address) and 2nd person plural verbs — never informal 'ти/теб/тебе' in UI labels; use 'моля' for polite requests; standard modern Bulgarian following Институт за български език conventions; Cyrillic script ONLY (NEVER Latin transliteration); use Bulgarian quotation marks „...\" for quotes; use native terminology where established (e.g. 'имейл' or 'електронна поща' for email, 'настройки' for settings, 'вход/влизане' for log in, 'акаунт' or 'профил' for account, 'парола' for password, 'пощенска кутия' for mailbox, 'входящи' for inbox, 'приложение' for app); avoid Russian/Serbian variants — Bulgarian is South Slavic and distinct, no case system in modern Bulgarian, uses definite article suffixes -ът/-та/-то/-те)"
                                                      : targetLang === "nb"
                                                        ? "Norwegian Bokmål (norsk bokmål, Norway, formal B2B SaaS tone — Norwegian has no T-V distinction so use standard 'du'/'deg'/'din'/'ditt'/'dine' (LOWERCASE — modern Norwegian does NOT capitalize 2nd person pronouns, unlike Danish/German); use 'vennligst' for polite requests; standard modern Bokmål following Språkrådet conventions; use Norwegian å/æ/ø characters; use Norwegian quotation marks «...» for quotes; use native terminology where established (e.g. 'e-post' for email NEVER 'epost' as one word in formal text, 'innstillinger' for settings, 'logg inn'/'innlogging' for log in, 'konto' for account, 'passord' for password, 'postkasse' for mailbox, 'innboks' for inbox, 'app'/'applikasjon' for app, 'bruker' for user, 'lagre' for save, 'avbryt' for cancel, 'slett' for delete); avoid Danish-specific spellings (use 'noen' not 'nogen', 'mye' not 'meget', '-er' plural endings not '-e') and avoid Nynorsk forms (use 'jeg' not 'eg', 'ikke' not 'ikkje', 'hva' not 'kva'); modern Bokmål prefers '-a' or '-en' for feminine nouns — use moderate '-en' forms typical of business communication)"
                                                        : targetLang === "ca"
                                                          ? "Catalan (català, Catalonia/Spain, formal B2B SaaS tone using polite address 'Vostè'/'vostè' (3rd person singular formal — Catalan's primary politeness register, equivalent to Spanish 'usted') with 3rd person singular verbs in formal contexts; for instructions to the user use 2nd person plural 'vosaltres' forms (-eu endings: feu/escriviu/seleccioneu/configureu) which is standard polite Catalan UI register; use 'si us plau' for polite requests; standard modern Catalan following Institut d'Estudis Catalans (IEC) conventions, Central Catalan/Barcelona standard; use Catalan diacritics à/è/é/í/ï/ò/ó/ú/ü, ny digraph, l·l (geminated L with middle dot — IMPORTANT, NEVER 'll' or 'l.l'), ç; use Catalan quotation marks «...» for quotes; use native terminology where established (e.g. 'correu electrònic' for email NEVER 'email' in formal text, 'configuració' for settings, 'inicia sessió'/'iniciar sessió' for log in, 'compte' for account, 'contrasenya' for password, 'bústia' for mailbox, 'safata d'entrada' for inbox, 'aplicació' for app, 'usuari' for user, 'desa'/'desar' for save, 'cancel·la' for cancel, 'suprimeix' for delete, 'tanca'/'tancar' for close); avoid Spanish/Castilian forms (use 'i' not 'y' for and, 'amb' not 'con', 'però' not 'pero', 'també' not 'también'); avoid Valencian-specific spellings — use Central Catalan (this/aquest not este, eight/vuit not huit); proper apostrophes l'/d'/n' before vowels and h)"
                                                          : targetLang === "ga"
                                                            ? "Irish (Gaeilge, Ireland, formal B2B SaaS tone using polite address 'sibh' (2nd person plural used as polite/respectful form, similar to French vous) with 'bhur' for possessive 'your' — never informal singular 'tú/do' in formal UI labels for end users; use 'le do thoil' or 'le bhur dtoil' for polite requests; standard modern Irish following An Caighdeán Oifigiúil (Official Standard) conventions; use Irish síneadh fada accents á/é/í/ó/ú; use Irish quotation marks ‘...' for quotes; use native terminology where established (e.g. 'ríomhphost' for email, 'socruithe' for settings, 'logáil isteach'/'logann isteach' for log in, 'cuntas' for account, 'pasfhocal' for password, 'bosca poist' for mailbox, 'bosca isteach' for inbox, 'feidhmchlár'/'aip' for app, 'úsáideoir' for user, 'sábháil' for save, 'cealaigh' for cancel, 'scrios' for delete, 'dún' for close, 'oscail' for open); apply correct Irish initial mutations (séimhiú h after possessives like 'a phasfhocal', urú n- after plurals like 'ár n-úsáideoirí'); avoid Scottish Gaelic forms (Irish: tá/níl/agus/leis NOT tha/chan eil/agus/le); avoid English loanwords when good Irish equivalents exist; use proper Irish word order Verb-Subject-Object)"
                                                            : targetLang === "ur"
                                                              ? "Urdu (اردو, Pakistan/India, formal B2B SaaS tone using polite address آپ (aap, 2nd person plural used as polite/respectful form for both singular and plural — Urdu's standard formal register, equivalent to French vous) with corresponding plural verb conjugations and -یں/-ئیں imperative endings (کریں, کلک کریں, درج کریں); never informal تو/تم in formal UI labels for end users; use براہ کرم (barah-e-karam) for polite requests; standard modern Urdu following Pakistan/India literary conventions; Perso-Arabic Nastaliq script written RTL (right-to-left) — never Devanagari (Hindi script) and never Roman Urdu transliteration; use Urdu punctuation: ۔ (Arabic full stop) for periods, ، (Arabic comma) for commas, ؟ (Arabic question mark); use Urdu numerals or Western depending on context (Western 0-9 are common in tech/UI); use native terminology where established (e.g. ای میل for email, ترتیبات for settings, لاگ ان for log in, اکاؤنٹ for account, پاس ورڈ for password, میل باکس for mailbox, ان باکس for inbox, ایپلیکیشن/ایپ for app, صارف for user, محفوظ کریں for save, منسوخ کریں for cancel, حذف کریں for delete, بند کریں for close, کھولیں for open); Persian/Arabic loanwords are normal and prestigious in formal Urdu; avoid Hindi-specific Sanskrit-derived terms (use پاس ورڈ not कूटशब्द, use سرور not सर्वर); preserve English technical terms in Nastaliq transliteration when no Urdu equivalent exists)"
                                                              : targetLang === "hi"
                                                                ? "Hindi (हिन्दी, India, formal B2B SaaS tone using polite address आप (aap, 2nd person plural used as polite/respectful form for both singular and plural — Hindi's standard formal register, equivalent to French vous) with corresponding plural verb conjugations and -इए/-इये polite imperative endings (कीजिए, क्लिक कीजिए, दर्ज कीजिए) or -एँ subjunctive endings (करें, क्लिक करें); never informal तू/तुम in formal UI labels for end users; use कृपया (kripya) for polite requests; standard modern Hindi following Mānak Hindi (मानक हिन्दी) literary conventions of India; Devanagari script ONLY (देवनागरी) — never Perso-Arabic (Urdu script) and never Roman Hindi/Hinglish transliteration; use Devanagari punctuation: । (danda) for periods OR Western full stop . (both acceptable in modern Hindi UI), , for commas, ? for questions; use Western numerals 0-9 (standard in tech/UI, though Devanagari numerals ०-९ exist); use native Sanskrit-derived terminology where established (e.g. ईमेल for email, सेटिंग्स/सेटिंग for settings, लॉग इन/साइन इन for log in, खाता/अकाउंट for account, पासवर्ड for password, मेलबॉक्स for mailbox, इनबॉक्स for inbox, ऐप/ऐप्लिकेशन for app, उपयोगकर्ता for user, सहेजें for save, रद्द करें for cancel, हटाएँ/डिलीट करें for delete, बंद करें for close, खोलें for open); use proper conjuncts and matras (ि/ी/ु/ू/े/ै/ो/ौ/ं/ः); avoid Urdu-specific Persian/Arabic terms when good Hindi/Sanskrit equivalents exist (use धन्यवाद not شكریہ, use पुष्टि not تصدیق); preserve common English technical loanwords in Devanagari (कंप्यूटर, सर्वर, ब्राउज़र) — these are standard in modern Indian tech Hindi)"
                                                                : targetLang === "km"
                                                                  ? "Khmer (ភាសាខ្មែរ, Cambodia, formal B2B SaaS tone using polite address លោក (lok, M) / លោកស្រី (lok srei, F) — Khmer's standard formal/respectful 2nd person register, equivalent to French vous; for gender-neutral UI prefer លោកអ្នក (lok neak) when addressing the user generically — never informal ឯង/អ្នក alone in formal UI labels for end users; use សូម (som) for polite requests/imperatives (សូមចុច, សូមបញ្ចូល); standard modern Khmer following Chuon Nath dictionary conventions of the Royal Academy of Cambodia; Khmer script ONLY (អក្សរខ្មែរ) — never Romanized Khmer transliteration; Khmer script has NO spaces between words within a phrase but uses spaces between phrases/clauses — preserve this convention; use Khmer punctuation: ។ (khan, full stop) for periods, , for commas, ? for questions (Western punctuation acceptable in modern UI), ៖ (camnuc pii kuuh, colon); use Western numerals 0-9 (standard in tech/UI, though Khmer numerals ០-៩ exist); use native Khmer terminology where established (e.g. អ៊ីមែល for email, ការកំណត់ for settings, ចូល/ចុះឈ្មោះចូល for log in, គណនី for account, ពាក្យសម្ងាត់ for password, ប្រអប់សំបុត្រ for mailbox, សារចូល for inbox, កម្មវិធី for app, អ្នកប្រើប្រាស់ for user, រក្សាទុក for save, បោះបង់ for cancel, លុប for delete, បិទ for close, បើក for open); Khmer is non-tonal Mon-Khmer with Indic-derived script — preserve subscript consonants (ជើង) and vowel signs correctly; Pali/Sanskrit loanwords are normal and prestigious in formal Khmer; preserve common English technical terms in Khmer transliteration (កុំព្យូទ័រ, សឺវឺរ, ប្រូហ្គ្រាម) when no native equivalent exists)"
                                                                  : targetLang === "mt"
                                                                    ? "Maltese (Malti, Maltese from Malta — the only Semitic language written in Latin script and the only Semitic official language of the EU; formal B2B SaaS tone using respectful 2nd person address — 'Inti' (singular, capitalized for politeness) and possessive 'Tagħkom' (yours plural-formal) and 2nd person plural verb forms (intom/tweġbu/tagħmlu); use 'jekk jogħġobkom' for polite requests; standard Maltese following Il-Kunsill Nazzjonali tal-Ilsien Malti orthographic conventions; use Maltese diacritics ċ/ġ/ħ/ż and the digraph għ — write 'jekk jogħġobkom' for please, 'grazzi' for thank you, 'ġimgħa' for week, 'xahar' for month; use Maltese apostrophe ' (e.g. m'għandniex, ma' for with); use Maltese definite article il-/l-/it-/id-/in-/etc. with consonant assimilation; use native terminology where established (e.g. 'email' or 'posta elettronika' for email, 'issettjar' or 'settings' for settings, 'idħol/illoggja' for log in, 'kont' for account, 'password' for password, 'kaxxa tal-posta' for mailbox, 'inbox' or 'messaġġi mdaħħla' for inbox, 'applikazzjoni' or 'app' for app); Maltese freely uses Romance/Italian and English loanwords integrated into Semitic morphology — this is normal, not anglicisation; avoid Arabic-script forms — Maltese is ALWAYS in Latin script)"
                                                      : targetLang === "lv"
                                                        ? "Latvian (latviešu valoda, Latvian from Latvia, formal B2B SaaS tone using polite address — 'Jūs' / 'Jums' / 'Jūsu' / 'Jūsos' (always CAPITALIZED in formal address) and 2nd person plural verbs — never informal 'tu/tev/tevi' in UI labels; use 'lūdzu' for polite requests; standard Latvian following Latviešu valodas aģentūra / Valsts valodas centrs Latvia conventions; use Latvian orthography with long vowel macrons ā/ē/ī/ū and palatalised consonants č/ģ/ķ/ļ/ņ/š/ž — write 'nedēļa' for week, 'mēnesis' for month, 'lūdzu' for please, 'paldies' for thank you; use Latvian quotation marks „...\" for quotes; use native terminology where established (e.g. 'e-pasts' for email, 'iestatījumi' for settings, 'pieteikties' for log in, 'konts' for account, 'parole' for password, 'pastkaste' for mailbox, 'iesūtne' for inbox, 'lietotne' or 'aplikācija' for app); avoid Lithuanian/Russian variants — Latvian is Baltic but distinct from Lithuanian)"
                                                      : targetLang === "sl"
                                                        ? "Slovenian (slovenščina, Slovenian from Slovenia, formal B2B SaaS tone using polite address 'vikanje' — 'Vi' / 'Vas' / 'Vam' / 'Vaš' / 'Vašo' (always CAPITALIZED in formal address) and 2nd person plural verbs — never informal 'ti/tebe/tebi' in UI labels; use 'prosimo' for polite requests; standard Slovenian (knjižna slovenščina) following Slovenski pravopis / Inštitut za slovenski jezik Frana Ramovša ZRC SAZU; use Slovenian orthography with diacritics č/š/ž — write 'teden' for week, 'mesec' for month, 'lahko' for can, 'prosim/prosimo' for please, 'hvala' for thank you; use Slovenian quotation marks „...\" for quotes; use native terminology where established (e.g. 'e-pošta' for email, 'nastavitve' for settings, 'prijava' for log in, 'račun' for account, 'geslo' for password, 'poštni predal' for mailbox, 'prejeto' for inbox, 'aplikacija' for app); avoid Croatian/Serbian variants — Slovenian uses dual number for two items but for UI labels treat as standard plural)"
                                                      : targetLang === "sk"
                                                        ? "Slovak (slovenčina, Slovak from Slovakia, formal B2B SaaS tone using polite address 'vykanie' — 'Vy' / 'Vás' / 'Vám' / 'Váš' / 'Vašu' (always CAPITALIZED in formal address) and 2nd person plural verbs — never informal 'ty/teba/tebe' in UI labels; use 'prosím' for polite requests; standard Slovak (spisovná slovenčina) following Pravidlá slovenského pravopisu / Jazykovedný ústav Ľudovíta Štúra — NEVER Czech variants; use Slovak orthography with diacritics ä/ô/ľ/ŕ/ĺ — write 'týždeň' NOT 'týden', 'mesto' NOT 'město', 'dnes' NOT 'dnes' (same), 'prosím' NOT 'prosim', 'môže' NOT 'může', 'je' NOT 'je' (same), 'lebo'/'pretože' NOT 'protože', 'iba'/'len' NOT 'jen'; use Slovak quotation marks „...\" for quotes; use native terminology where established (e.g. 'e-mail' for email, 'nastavenia' for settings, 'prihlásenie' for log in, 'účet' for account, 'heslo' for password, 'poštová schránka' for mailbox, 'doručená pošta' for inbox, 'aplikácia' for app))"
                                                      : targetLang === "hr"
                                                        ? "Croatian (hrvatski jezik, Croatian from Croatia, formal B2B SaaS tone using polite address 'Vi' / 'Vas' / 'Vam' / 'Vaš' / 'Vašu' (always CAPITALIZED in formal address) and 2nd person plural verbs — never informal 'ti/tebe/tebi' in UI labels; use 'molimo' for polite requests; standard Croatian (standardni hrvatski) following Hrvatski pravopis (Institut za hrvatski jezik) — NEVER Serbian or Bosnian variants; use Latin script ONLY (NEVER Cyrillic); use Croatian forms — write 'tjedan' NOT 'nedjelja' for week, 'tisuća' NOT 'hiljada', 'vlak' NOT 'voz', 'kruh' NOT 'hljeb', 'tisak' NOT 'štampa', 'mlijeko' NOT 'mleko', 'vrijeme' NOT 'vreme', 'lijep' NOT 'lep' (ijekavica only); use Croatian quotation marks „...\" for quotes; use native terminology where established (e.g. 'e-pošta' or 'e-mail' for email, 'postavke' for settings, 'prijava' for log in, 'račun' for account, 'lozinka' for password, 'poštanski sandučić' for mailbox, 'pristigla pošta' for inbox, 'aplikacija' for app))"
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
  "web-it":    { src: "artifacts/ncv-mail/src/i18n/locales/fr.json",    out: "artifacts/ncv-mail/src/i18n/locales/it.json",    lang: "it" },
  "web-pt":    { src: "artifacts/ncv-mail/src/i18n/locales/fr.json",    out: "artifacts/ncv-mail/src/i18n/locales/pt.json",    lang: "pt" },
  "web-pl":    { src: "artifacts/ncv-mail/src/i18n/locales/fr.json",    out: "artifacts/ncv-mail/src/i18n/locales/pl.json",    lang: "pl" },
  "web-ro":    { src: "artifacts/ncv-mail/src/i18n/locales/fr.json",    out: "artifacts/ncv-mail/src/i18n/locales/ro.json",    lang: "ro" },
  "web-sv":    { src: "artifacts/ncv-mail/src/i18n/locales/fr.json",    out: "artifacts/ncv-mail/src/i18n/locales/sv.json",    lang: "sv" },
  "web-da":    { src: "artifacts/ncv-mail/src/i18n/locales/fr.json",    out: "artifacts/ncv-mail/src/i18n/locales/da.json",    lang: "da" },
  "web-fi":    { src: "artifacts/ncv-mail/src/i18n/locales/fr.json",    out: "artifacts/ncv-mail/src/i18n/locales/fi.json",    lang: "fi" },
  "web-hu":    { src: "artifacts/ncv-mail/src/i18n/locales/fr.json",    out: "artifacts/ncv-mail/src/i18n/locales/hu.json",    lang: "hu" },
  "web-cs":    { src: "artifacts/ncv-mail/src/i18n/locales/fr.json",    out: "artifacts/ncv-mail/src/i18n/locales/cs.json",    lang: "cs" },
  "web-tr":    { src: "artifacts/ncv-mail/src/i18n/locales/fr.json",    out: "artifacts/ncv-mail/src/i18n/locales/tr.json",    lang: "tr" },
  "web-ja":    { src: "artifacts/ncv-mail/src/i18n/locales/fr.json",    out: "artifacts/ncv-mail/src/i18n/locales/ja.json",    lang: "ja" },
  "web-ko":    { src: "artifacts/ncv-mail/src/i18n/locales/fr.json",    out: "artifacts/ncv-mail/src/i18n/locales/ko.json",    lang: "ko" },
  "web-vi":    { src: "artifacts/ncv-mail/src/i18n/locales/fr.json",    out: "artifacts/ncv-mail/src/i18n/locales/vi.json",    lang: "vi" },
  "web-th":    { src: "artifacts/ncv-mail/src/i18n/locales/fr.json",    out: "artifacts/ncv-mail/src/i18n/locales/th.json",    lang: "th" },
  "web-id":    { src: "artifacts/ncv-mail/src/i18n/locales/fr.json",    out: "artifacts/ncv-mail/src/i18n/locales/id.json",    lang: "id" },
  "web-ms":    { src: "artifacts/ncv-mail/src/i18n/locales/fr.json",    out: "artifacts/ncv-mail/src/i18n/locales/ms.json",    lang: "ms" },
  "web-el":    { src: "artifacts/ncv-mail/src/i18n/locales/fr.json",    out: "artifacts/ncv-mail/src/i18n/locales/el.json",    lang: "el" },
  "web-uk":    { src: "artifacts/ncv-mail/src/i18n/locales/fr.json",    out: "artifacts/ncv-mail/src/i18n/locales/uk.json",    lang: "uk" },
  "web-et":    { src: "artifacts/ncv-mail/src/i18n/locales/fr.json",    out: "artifacts/ncv-mail/src/i18n/locales/et.json",    lang: "et" },
  "web-zh":    { src: "artifacts/ncv-mail/src/i18n/locales/fr.json",    out: "artifacts/ncv-mail/src/i18n/locales/zh.json",    lang: "zh" },
  "web-zh-TW":    { src: "artifacts/ncv-mail/src/i18n/locales/fr.json",    out: "artifacts/ncv-mail/src/i18n/locales/zh-TW.json",    lang: "zh-TW" },
  "web-lt":    { src: "artifacts/ncv-mail/src/i18n/locales/fr.json",    out: "artifacts/ncv-mail/src/i18n/locales/lt.json",    lang: "lt" },
  "web-sr":    { src: "artifacts/ncv-mail/src/i18n/locales/fr.json",    out: "artifacts/ncv-mail/src/i18n/locales/sr.json",    lang: "sr" },
  "web-ru":    { src: "artifacts/ncv-mail/src/i18n/locales/fr.json",    out: "artifacts/ncv-mail/src/i18n/locales/ru.json",    lang: "ru" },
  "web-he":    { src: "artifacts/ncv-mail/src/i18n/locales/fr.json",    out: "artifacts/ncv-mail/src/i18n/locales/he.json",    lang: "he" },
  "web-ar":    { src: "artifacts/ncv-mail/src/i18n/locales/fr.json",    out: "artifacts/ncv-mail/src/i18n/locales/ar.json",    lang: "ar" },
  "web-hr":    { src: "artifacts/ncv-mail/src/i18n/locales/fr.json",    out: "artifacts/ncv-mail/src/i18n/locales/hr.json",    lang: "hr" },
  "web-sk":    { src: "artifacts/ncv-mail/src/i18n/locales/fr.json",    out: "artifacts/ncv-mail/src/i18n/locales/sk.json",    lang: "sk" },
  "web-sl":    { src: "artifacts/ncv-mail/src/i18n/locales/fr.json",    out: "artifacts/ncv-mail/src/i18n/locales/sl.json",    lang: "sl" },
  "web-lv":    { src: "artifacts/ncv-mail/src/i18n/locales/fr.json",    out: "artifacts/ncv-mail/src/i18n/locales/lv.json",    lang: "lv" },
  "web-mt":    { src: "artifacts/ncv-mail/src/i18n/locales/fr.json",    out: "artifacts/ncv-mail/src/i18n/locales/mt.json",    lang: "mt" },
  "web-bg":    { src: "artifacts/ncv-mail/src/i18n/locales/fr.json",    out: "artifacts/ncv-mail/src/i18n/locales/bg.json",    lang: "bg" },
  "web-nb":    { src: "artifacts/ncv-mail/src/i18n/locales/fr.json",    out: "artifacts/ncv-mail/src/i18n/locales/nb.json",    lang: "nb" },
  "web-ca":    { src: "artifacts/ncv-mail/src/i18n/locales/fr.json",    out: "artifacts/ncv-mail/src/i18n/locales/ca.json",    lang: "ca" },
  "web-ga":    { src: "artifacts/ncv-mail/src/i18n/locales/fr.json",    out: "artifacts/ncv-mail/src/i18n/locales/ga.json",    lang: "ga" },
  "web-ur":    { src: "artifacts/ncv-mail/src/i18n/locales/fr.json",    out: "artifacts/ncv-mail/src/i18n/locales/ur.json",    lang: "ur" },
  "web-hi":    { src: "artifacts/ncv-mail/src/i18n/locales/fr.json",    out: "artifacts/ncv-mail/src/i18n/locales/hi.json",    lang: "hi" },
  "web-km":    { src: "artifacts/ncv-mail/src/i18n/locales/fr.json",    out: "artifacts/ncv-mail/src/i18n/locales/km.json",    lang: "km" },
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
