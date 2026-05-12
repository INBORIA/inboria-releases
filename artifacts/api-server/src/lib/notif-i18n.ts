// Localisation des notifications in-app pour le Chat équipe (#286).
// Le serveur ne connaît pas la locale du navigateur du destinataire,
// on utilise donc profiles.ai_language (déjà existante, défaut "fr").
// Couvre les 43 langues supportées par le produit (cf. replit.md).

export type NotifLang = string;

interface AssignCopy {
  title: string;
  message: (actor: string, subject: string) => string;
}
interface UnassignCopy {
  title: string;
  message: (actor: string, subject: string) => string;
}

const ASSIGN: Record<string, AssignCopy> = {
  fr: { title: "Email assigné · Chat équipe ouvert", message: (a, s) => `${a} vous a assigné « ${s} » · cliquer pour ouvrir le chat équipe` },
  en: { title: "Email assigned · Team chat opened", message: (a, s) => `${a} assigned you "${s}" · click to open the team chat` },
  nl: { title: "E-mail toegewezen · Teamchat geopend", message: (a, s) => `${a} heeft u "${s}" toegewezen · klik om de teamchat te openen` },
  de: { title: "E-Mail zugewiesen · Team-Chat geöffnet", message: (a, s) => `${a} hat Ihnen „${s}" zugewiesen · klicken Sie, um den Team-Chat zu öffnen` },
  es: { title: "Correo asignado · Chat de equipo abierto", message: (a, s) => `${a} le ha asignado «${s}» · haga clic para abrir el chat de equipo` },
  it: { title: "Email assegnata · Chat del team aperta", message: (a, s) => `${a} le ha assegnato «${s}» · clicchi per aprire la chat del team` },
  pt: { title: "E-mail atribuído · Chat de equipa aberto", message: (a, s) => `${a} atribuiu-lhe "${s}" · clique para abrir o chat de equipa` },
  pl: { title: "E-mail przypisany · Otwarty czat zespołu", message: (a, s) => `${a} przypisał(a) Państwu "${s}" · kliknij, aby otworzyć czat zespołu` },
  ro: { title: "E-mail atribuit · Chat de echipă deschis", message: (a, s) => `${a} v-a atribuit „${s}" · faceți clic pentru a deschide chatul echipei` },
  sv: { title: "E-post tilldelad · Teamchatten öppen", message: (a, s) => `${a} tilldelade dig "${s}" · klicka för att öppna teamchatten` },
  da: { title: "E-mail tildelt · Teamchat åbnet", message: (a, s) => `${a} tildelte dig "${s}" · klik for at åbne teamchatten` },
  fi: { title: "Sähköposti osoitettu · Tiimichat avattu", message: (a, s) => `${a} osoitti teille "${s}" · avaa tiimichat klikkaamalla` },
  hu: { title: "E-mail hozzárendelve · Csapatcsevegés megnyitva", message: (a, s) => `${a} Önhöz rendelte: „${s}" · kattintson a csapatcsevegés megnyitásához` },
  cs: { title: "E-mail přidělen · Týmový chat otevřen", message: (a, s) => `${a} Vám přidělil(a) „${s}" · klikněte pro otevření týmového chatu` },
  tr: { title: "E-posta atandı · Ekip sohbeti açıldı", message: (a, s) => `${a}, size "${s}" e-postasını atadı · ekip sohbetini açmak için tıklayın` },
  ja: { title: "メール割り当て · チームチャット開設", message: (a, s) => `${a}さんが「${s}」をあなたに割り当てました · クリックしてチームチャットを開いてください` },
  ko: { title: "메일 배정 · 팀 채팅 열림", message: (a, s) => `${a}님이 "${s}" 메일을 배정하였습니다 · 클릭하여 팀 채팅을 여십시오` },
  vi: { title: "Email đã giao · Mở trò chuyện nhóm", message: (a, s) => `${a} đã giao "${s}" cho Quý vị · nhấp để mở trò chuyện nhóm` },
  th: { title: "มอบหมายอีเมลแล้ว · เปิดแชทของทีม", message: (a, s) => `${a} ได้มอบหมาย "${s}" ให้ท่าน · โปรดคลิกเพื่อเปิดแชทของทีม` },
  id: { title: "Email ditugaskan · Obrolan tim dibuka", message: (a, s) => `${a} menugaskan "${s}" kepada Anda · silakan klik untuk membuka obrolan tim` },
  ms: { title: "E-mel ditugaskan · Sembang pasukan dibuka", message: (a, s) => `${a} telah menugaskan "${s}" kepada anda · sila klik untuk membuka sembang pasukan` },
  el: { title: "Ανάθεση email · Άνοιγμα ομαδικής συνομιλίας", message: (a, s) => `Ο/Η ${a} σας ανέθεσε «${s}» · κάντε κλικ για να ανοίξετε την ομαδική συνομιλία` },
  uk: { title: "Лист призначено · Командний чат відкрито", message: (a, s) => `${a} призначив(-ла) Вам «${s}» · натисніть, щоб відкрити командний чат` },
  et: { title: "E-kiri määratud · Meeskonnavestlus avatud", message: (a, s) => `${a} määras Teile „${s}" · klõpsake meeskonnavestluse avamiseks` },
  zh: { title: "邮件已分配 · 团队聊天已开启", message: (a, s) => `${a} 已将"${s}"分配给您 · 请点击打开团队聊天` },
  "zh-TW": { title: "電郵已指派 · 團隊聊天已開啟", message: (a, s) => `${a} 已將「${s}」指派給您 · 請點擊開啟團隊聊天` },
  lt: { title: "El. laiškas priskirtas · Komandos pokalbis atvertas", message: (a, s) => `${a} priskyrė Jums „${s}" · prašome spustelėti, kad atvertumėte komandos pokalbį` },
  sr: { title: "Имејл додељен · Тимски ћаскање отворен", message: (a, s) => `${a} Вам је доделио(ла) „${s}" · молимо кликните да отворите тимски ћаскање` },
  ru: { title: "Письмо назначено · Командный чат открыт", message: (a, s) => `${a} назначил(а) Вам «${s}» · пожалуйста, нажмите, чтобы открыть командный чат` },
  he: { title: "דוא״ל הוקצה · צ׳אט הצוות נפתח", message: (a, s) => `${a} הקצה לך "${s}" · אנא לחץ לפתיחת צ׳אט הצוות` },
  ar: { title: "تم إسناد البريد الإلكتروني · فتح محادثة الفريق", message: (a, s) => `قام ${a} بإسناد "${s}" إليكم · يرجى النقر لفتح محادثة الفريق` },
  hr: { title: "E-pošta dodijeljena · Timski razgovor otvoren", message: (a, s) => `${a} Vam je dodijelio(la) „${s}" · molimo kliknite za otvaranje timskog razgovora` },
  sk: { title: "E-mail pridelený · Tímový chat otvorený", message: (a, s) => `${a} Vám pridelil(a) „${s}" · prosím kliknite pre otvorenie tímového chatu` },
  sl: { title: "E-pošta dodeljena · Klepet ekipe odprt", message: (a, s) => `${a} Vam je dodelil(a) „${s}" · prosimo kliknite za odpiranje klepeta ekipe` },
  lv: { title: "E-pasts piešķirts · Komandas tērzēšana atvērta", message: (a, s) => `${a} piešķīra Jums „${s}" · lūdzu noklikšķiniet, lai atvērtu komandas tērzēšanu` },
  mt: { title: "Email assenjat · Chat tat-tim miftuħ", message: (a, s) => `${a} assenjalek "${s}" · jekk jogħġobkom ikklikkja biex tiftaħ il-chat tat-tim` },
  bg: { title: "Имейл възложен · Чат на екипа отворен", message: (a, s) => `${a} Ви възложи „${s}" · моля, щракнете, за да отворите чата на екипа` },
  nb: { title: "E-post tildelt · Teamchat åpnet", message: (a, s) => `${a} tildelte deg "${s}" · vennligst klikk for å åpne teamchatten` },
  ca: { title: "Correu assignat · Xat d'equip obert", message: (a, s) => `${a} us ha assignat «${s}» · si us plau, feu clic per obrir el xat d'equip` },
  ga: { title: "Ríomhphost sannta · Comhrá foirne oscailte", message: (a, s) => `Shann ${a} duit "${s}" · le do thoil cliceáil chun an comhrá foirne a oscailt` },
  ur: { title: "ای میل تفویض · ٹیم چیٹ کھل گئی", message: (a, s) => `${a} نے آپ کو "${s}" تفویض کی · براہ کرم ٹیم چیٹ کھولنے کے لیے کلک کریں` },
  hi: { title: "ईमेल सौंपा गया · टीम चैट खुली", message: (a, s) => `${a} ने आपको "${s}" सौंपा · कृपया टीम चैट खोलने के लिए क्लिक करें` },
  km: { title: "បានចាត់តាំងអ៊ីមែល · បើកការជជែករបស់ក្រុម", message: (a, s) => `${a} បានចាត់តាំង "${s}" ទៅលោក/លោកស្រី · សូមចុចដើម្បីបើកការជជែករបស់ក្រុម` },
};

const UNASSIGN: Record<string, UnassignCopy> = {
  fr: { title: "Assignation retirée", message: (a, s) => `${a} a retiré votre assignation sur « ${s} »` },
  en: { title: "Assignment removed", message: (a, s) => `${a} removed your assignment on "${s}"` },
  nl: { title: "Toewijzing ingetrokken", message: (a, s) => `${a} heeft uw toewijzing voor "${s}" ingetrokken` },
  de: { title: "Zuweisung aufgehoben", message: (a, s) => `${a} hat Ihre Zuweisung für „${s}" aufgehoben` },
  es: { title: "Asignación retirada", message: (a, s) => `${a} ha retirado su asignación de «${s}»` },
  it: { title: "Assegnazione rimossa", message: (a, s) => `${a} ha rimosso la sua assegnazione su «${s}»` },
  pt: { title: "Atribuição removida", message: (a, s) => `${a} retirou a sua atribuição em "${s}"` },
  pl: { title: "Przypisanie usunięte", message: (a, s) => `${a} usunął(-ęła) Państwa przypisanie do "${s}"` },
  ro: { title: "Atribuire retrasă", message: (a, s) => `${a} v-a retras atribuirea pentru „${s}"` },
  sv: { title: "Tilldelning borttagen", message: (a, s) => `${a} tog bort din tilldelning av "${s}"` },
  da: { title: "Tildeling fjernet", message: (a, s) => `${a} fjernede din tildeling af "${s}"` },
  fi: { title: "Osoitus poistettu", message: (a, s) => `${a} poisti teidän osoituksenne kohteeseen "${s}"` },
  hu: { title: "Hozzárendelés visszavonva", message: (a, s) => `${a} visszavonta az Ön hozzárendelését ehhez: „${s}"` },
  cs: { title: "Přidělení zrušeno", message: (a, s) => `${a} zrušil(a) Vaše přidělení k „${s}"` },
  tr: { title: "Atama kaldırıldı", message: (a, s) => `${a}, size yapılan "${s}" atamasını kaldırdı` },
  ja: { title: "割り当てが解除されました", message: (a, s) => `${a}さんが「${s}」のあなたへの割り当てを解除しました` },
  ko: { title: "배정이 해제되었습니다", message: (a, s) => `${a}님이 "${s}"에 대한 귀하의 배정을 해제하였습니다` },
  vi: { title: "Đã hủy giao việc", message: (a, s) => `${a} đã hủy giao "${s}" cho Quý vị` },
  th: { title: "ยกเลิกการมอบหมาย", message: (a, s) => `${a} ได้ยกเลิกการมอบหมาย "${s}" ของท่าน` },
  id: { title: "Penugasan dibatalkan", message: (a, s) => `${a} membatalkan penugasan "${s}" kepada Anda` },
  ms: { title: "Penugasan dibatalkan", message: (a, s) => `${a} telah membatalkan penugasan "${s}" kepada anda` },
  el: { title: "Η ανάθεση καταργήθηκε", message: (a, s) => `Ο/Η ${a} κατάργησε την ανάθεσή σας για «${s}»` },
  uk: { title: "Призначення знято", message: (a, s) => `${a} зняв(-ла) Ваше призначення на «${s}»` },
  et: { title: "Määrang eemaldatud", message: (a, s) => `${a} eemaldas Teie määrangu „${s}"` },
  zh: { title: "分配已取消", message: (a, s) => `${a} 已取消您对"${s}"的分配` },
  "zh-TW": { title: "指派已取消", message: (a, s) => `${a} 已取消您對「${s}」的指派` },
  lt: { title: "Priskyrimas panaikintas", message: (a, s) => `${a} panaikino Jūsų priskyrimą prie „${s}"` },
  sr: { title: "Додела уклоњена", message: (a, s) => `${a} је уклонио(ла) Вашу доделу за „${s}"` },
  ru: { title: "Назначение снято", message: (a, s) => `${a} снял(а) Ваше назначение на «${s}»` },
  he: { title: "ההקצאה הוסרה", message: (a, s) => `${a} הסיר את ההקצאה שלך אל "${s}"` },
  ar: { title: "تم إلغاء الإسناد", message: (a, s) => `قام ${a} بإلغاء إسنادكم إلى "${s}"` },
  hr: { title: "Dodjela uklonjena", message: (a, s) => `${a} je uklonio(la) Vašu dodjelu za „${s}"` },
  sk: { title: "Pridelenie zrušené", message: (a, s) => `${a} zrušil(a) Vaše pridelenie k „${s}"` },
  sl: { title: "Dodelitev odstranjena", message: (a, s) => `${a} je odstranil(a) Vašo dodelitev za „${s}"` },
  lv: { title: "Piešķiršana atcelta", message: (a, s) => `${a} atcēla Jūsu piešķiršanu pie „${s}"` },
  mt: { title: "Assenjazzjoni mneħħija", message: (a, s) => `${a} neħħa l-assenjazzjoni tiegħek ta' "${s}"` },
  bg: { title: "Възлагането е премахнато", message: (a, s) => `${a} премахна Вашето възлагане на „${s}"` },
  nb: { title: "Tildeling fjernet", message: (a, s) => `${a} fjernet tildelingen din av "${s}"` },
  ca: { title: "Assignació retirada", message: (a, s) => `${a} ha retirat la vostra assignació de «${s}»` },
  ga: { title: "Sannadh bainte", message: (a, s) => `Bhain ${a} do shannadh ar "${s}"` },
  ur: { title: "تفویض ختم", message: (a, s) => `${a} نے "${s}" پر آپ کی تفویض ختم کر دی` },
  hi: { title: "असाइनमेंट हटाया गया", message: (a, s) => `${a} ने "${s}" पर आपका असाइनमेंट हटा दिया` },
  km: { title: "បានដកការចាត់តាំង", message: (a, s) => `${a} បានដកការចាត់តាំងរបស់លោក/លោកស្រី លើ "${s}"` },
};

function pickLang(lang: string | null | undefined): string {
  if (!lang) return "fr";
  if (ASSIGN[lang]) return lang;
  const base = lang.split("-")[0];
  if (ASSIGN[base]) return base;
  return "fr";
}

export function assignNotifCopy(lang: string | null | undefined, actor: string, subject: string) {
  const k = pickLang(lang);
  const c = ASSIGN[k];
  return { title: c.title, message: c.message(actor, subject) };
}

export function unassignNotifCopy(lang: string | null | undefined, actor: string, subject: string) {
  const k = pickLang(lang);
  const c = UNASSIGN[k];
  return { title: c.title, message: c.message(actor, subject) };
}
