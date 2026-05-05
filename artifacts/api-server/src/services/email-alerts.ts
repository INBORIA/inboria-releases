import nodemailer, { type Transporter } from "nodemailer";
import { supabaseAdmin } from "../lib/supabase";
import { logger } from "../lib/logger";
import { sanitizeErrorMessage } from "./connection-health";

const FAILURE_THRESHOLD = 3;
const ALERT_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

type Lang = "fr" | "en" | "nl" | "de" | "es" | "it" | "pt" | "pl" | "ro" | "sv" | "da" | "fi" | "hu" | "cs" | "tr" | "ja" | "ko" | "vi" | "th" | "id";

const TEMPLATES: Record<Lang, { subject: (email: string) => string; intro: string; reasonLabel: string; cta: string; ctaUrl: string; footer: string; notifTitle: (email: string) => string; notifMessage: string }> = {
  fr: {
    subject: (email) => `Inboria — Boite ${email} deconnectee`,
    intro: "Inboria n'arrive plus a synchroniser cette boite mail depuis plusieurs essais. Vos nouveaux mails ne sont donc plus traites tant que la connexion n'est pas retablie.",
    reasonLabel: "Derniere erreur",
    cta: "Reconnecter cette boite",
    ctaUrl: "/dashboard/parametres",
    footer: "Cet email est envoye au plus une fois par semaine et par boite. Si la reconnexion reussit, vous ne recevrez plus d'alerte.",
    notifTitle: (email) => `Boite ${email} deconnectee`,
    notifMessage: "Cliquez pour reconnecter cette boite dans Parametres.",
  },
  en: {
    subject: (email) => `Inboria — Mailbox ${email} disconnected`,
    intro: "Inboria has been unable to sync this mailbox for several attempts. Your new emails are no longer being processed until the connection is restored.",
    reasonLabel: "Last error",
    cta: "Reconnect this mailbox",
    ctaUrl: "/dashboard/parametres",
    footer: "This email is sent at most once per week per mailbox. If reconnection succeeds, you will stop receiving alerts.",
    notifTitle: (email) => `Mailbox ${email} disconnected`,
    notifMessage: "Click to reconnect this mailbox in Settings.",
  },
  nl: {
    subject: (email) => `Inboria — Mailbox ${email} losgekoppeld`,
    intro: "Inboria kan deze mailbox al meerdere keren niet synchroniseren. Uw nieuwe e-mails worden niet meer verwerkt totdat de verbinding hersteld is.",
    reasonLabel: "Laatste fout",
    cta: "Deze mailbox opnieuw verbinden",
    ctaUrl: "/dashboard/parametres",
    footer: "Deze e-mail wordt maximaal eenmaal per week per mailbox verzonden. Zodra de verbinding hersteld is, stoppen de meldingen.",
    notifTitle: (email) => `Mailbox ${email} losgekoppeld`,
    notifMessage: "Klik om deze mailbox opnieuw te verbinden in Instellingen.",
  },
  de: {
    subject: (email) => `Inboria — Postfach ${email} getrennt`,
    intro: "Inboria konnte dieses Postfach mehrfach nicht synchronisieren. Ihre neuen E-Mails werden nicht mehr verarbeitet, solange die Verbindung nicht wiederhergestellt ist.",
    reasonLabel: "Letzter Fehler",
    cta: "Dieses Postfach erneut verbinden",
    ctaUrl: "/dashboard/parametres",
    footer: "Diese E-Mail wird hochstens einmal pro Woche und Postfach gesendet. Sobald die Verbindung wiederhergestellt ist, erhalten Sie keine Benachrichtigungen mehr.",
    notifTitle: (email) => `Postfach ${email} getrennt`,
    notifMessage: "Klicken Sie, um dieses Postfach in den Einstellungen erneut zu verbinden.",
  },
  es: {
    subject: (email) => `Inboria — Buzon ${email} desconectado`,
    intro: "Inboria no consigue sincronizar este buzon desde hace varios intentos. Sus nuevos correos ya no se procesan hasta que se restablezca la conexion.",
    reasonLabel: "Ultimo error",
    cta: "Reconectar este buzon",
    ctaUrl: "/dashboard/parametres",
    footer: "Este correo se envia como maximo una vez por semana y por buzon. Si la reconexion tiene exito, dejara de recibir alertas.",
    notifTitle: (email) => `Buzon ${email} desconectado`,
    notifMessage: "Haga clic para reconectar este buzon en Configuracion.",
  },
  it: {
    subject: (email) => `Inboria — Casella ${email} disconnessa`,
    intro: "Inboria non riesce piu a sincronizzare questa casella di posta da diversi tentativi. Le sue nuove email non vengono piu elaborate finche la connessione non viene ripristinata.",
    reasonLabel: "Ultimo errore",
    cta: "Riconnettere questa casella",
    ctaUrl: "/dashboard/parametres",
    footer: "Questa email viene inviata al massimo una volta a settimana per casella. Se la riconnessione ha esito positivo, non ricevera piu avvisi.",
    notifTitle: (email) => `Casella ${email} disconnessa`,
    notifMessage: "Clicchi per riconnettere questa casella in Impostazioni.",
  },
  pt: {
    subject: (email) => `Inboria — Caixa ${email} desligada`,
    intro: "O Inboria nao consegue sincronizar esta caixa de correio ha varias tentativas. Os seus novos emails deixaram de ser processados ate a ligacao ser restabelecida.",
    reasonLabel: "Ultimo erro",
    cta: "Reconectar esta caixa",
    ctaUrl: "/dashboard/parametres",
    footer: "Este email e enviado no maximo uma vez por semana por caixa. Se a reconexao for bem-sucedida, deixara de receber alertas.",
    notifTitle: (email) => `Caixa ${email} desligada`,
    notifMessage: "Clique para reconectar esta caixa nas Definicoes.",
  },
  pl: {
    subject: (email) => `Inboria — Skrzynka ${email} odlaczona`,
    intro: "Inboria nie moze juz zsynchronizowac tej skrzynki pocztowej od kilku prob. Nowe wiadomosci nie sa przetwarzane do momentu przywrocenia polaczenia.",
    reasonLabel: "Ostatni blad",
    cta: "Polacz ponownie te skrzynke",
    ctaUrl: "/dashboard/parametres",
    footer: "Ten email jest wysylany maksymalnie raz w tygodniu dla kazdej skrzynki. Po pomyslnym ponownym polaczeniu nie beda Panstwo otrzymywac powiadomien.",
    notifTitle: (email) => `Skrzynka ${email} odlaczona`,
    notifMessage: "Prosze kliknac, aby ponownie polaczyc te skrzynke w Ustawieniach.",
  },
  ro: {
    subject: (email) => `Inboria — Casuta ${email} deconectata`,
    intro: "Inboria nu mai reuseste sa sincronizeze aceasta casuta de email de mai multe incercari. Noile dumneavoastra emailuri nu mai sunt procesate pana la restabilirea conexiunii.",
    reasonLabel: "Ultima eroare",
    cta: "Reconectati aceasta casuta",
    ctaUrl: "/dashboard/parametres",
    footer: "Acest email este trimis cel mult o data pe saptamana per casuta. Daca reconectarea reuseste, nu veti mai primi alerte.",
    notifTitle: (email) => `Casuta ${email} deconectata`,
    notifMessage: "Faceti clic pentru a reconecta aceasta casuta in Setari.",
  },
  sv: {
    subject: (email) => `Inboria — Brevladan ${email} fran kopplad`,
    intro: "Inboria kan inte langre synkronisera denna brevlada efter flera forsok. Dina nya mejl behandlas inte forran anslutningen ar aterstalld.",
    reasonLabel: "Senaste fel",
    cta: "Aterans lut denna brevlada",
    ctaUrl: "/dashboard/parametres",
    footer: "Detta mejl skickas hogst en gang per vecka och brevlada. Om aterans lutningen lyckas slutar du fa varningar.",
    notifTitle: (email) => `Brevladan ${email} frankopplad`,
    notifMessage: "Klicka for att ateransluta denna brevlada i Installningar.",
  },
  da: {
    subject: (email) => `Inboria — Postkassen ${email} afbrudt`,
    intro: "Inboria kan ikke laengere synkronisere denne postkasse efter flere forsog. Dine nye mails behandles ikke laengere, indtil forbindelsen er genoprettet.",
    reasonLabel: "Seneste fejl",
    cta: "Tilslut denne postkasse igen",
    ctaUrl: "/dashboard/parametres",
    footer: "Denne mail sendes hojst en gang om ugen pr. postkasse. Hvis genoprettelsen lykkes, modtager du ikke flere advarsler.",
    notifTitle: (email) => `Postkassen ${email} afbrudt`,
    notifMessage: "Klik for at tilslutte denne postkasse igen i Indstillinger.",
  },
  fi: {
    subject: (email) => `Inboria — Postilaatikko ${email} katkaistu`,
    intro: "Inboria ei pysty enaa synkronoimaan tata postilaatikkoa useiden yritysten jalkeen. Uusia sahkoposteja ei kasitella ennen yhteyden palauttamista.",
    reasonLabel: "Viimeisin virhe",
    cta: "Yhdista tama postilaatikko uudelleen",
    ctaUrl: "/dashboard/parametres",
    footer: "Tama sahkoposti lahetetaan korkeintaan kerran viikossa postilaatikkoa kohden. Jos uudelleenyhdistaminen onnistuu, et saa enaa varoituksia.",
    notifTitle: (email) => `Postilaatikko ${email} katkaistu`,
    notifMessage: "Klikatkaa yhdistaaksenne taman postilaatikon uudelleen Asetuksissa.",
  },
  hu: {
    subject: (email) => `Inboria — A(z) ${email} postafiok lecsatlakozott`,
    intro: "Az Inboria tobb probalkozas utan sem tudja szinkronizalni ezt a postafiokot. Az uj emailek nem kerulnek feldolgozasra, amig a kapcsolat helyre nem all.",
    reasonLabel: "Utolso hiba",
    cta: "Postafiok ujracsatlakoztatasa",
    ctaUrl: "/dashboard/parametres",
    footer: "Ezt az emailt postafiokonkent legfeljebb hetente egyszer kuldjuk. Ha az ujracsatlakozas sikeres, tobbe nem kap riasztast.",
    notifTitle: (email) => `A(z) ${email} postafiok lecsatlakozott`,
    notifMessage: "Kattintson a postafiok ujracsatlakoztatasahoz a Beallitasokban.",
  },
  cs: {
    subject: (email) => `Inboria — Schranka ${email} odpojena`,
    intro: "Inboria po nekolika pokusech nedokaze synchronizovat tuto postovni schranku. Vase nove emaily se nezpracovavaji, dokud nebude spojeni obnoveno.",
    reasonLabel: "Posledni chyba",
    cta: "Znovu pripojit tuto schranku",
    ctaUrl: "/dashboard/parametres",
    footer: "Tento email je odesilan nejvyse jednou tydne na schranku. Pokud bude pripojeni obnoveno, prestanete dostavat upozorneni.",
    notifTitle: (email) => `Schranka ${email} odpojena`,
    notifMessage: "Kliknete pro znovupripojeni teto schranky v Nastaveni.",
  },
  tr: {
    subject: (email) => `Inboria — ${email} posta kutusunun baglantisi kesildi`,
    intro: "Inboria, bu posta kutusunu birkac denemeden sonra senkronize edemiyor. Baglanti yeniden kurulana kadar yeni e-postalariniz islenmeyecektir.",
    reasonLabel: "Son hata",
    cta: "Bu posta kutusunu yeniden baglayin",
    ctaUrl: "/dashboard/parametres",
    footer: "Bu e-posta, posta kutusu basina haftada en fazla bir kez gonderilir. Yeniden baglanti basarili olursa artik uyari almazsiniz.",
    notifTitle: (email) => `${email} posta kutusunun baglantisi kesildi`,
    notifMessage: "Bu posta kutusunu Ayarlar bolumunden yeniden baglamak icin tiklayin.",
  },
  ja: {
    subject: (email) => `Inboria — メールボックス ${email} の接続が切断されました`,
    intro: "Inboria は数回の試行の後、このメールボックスを同期できませんでした。接続が復旧するまで、新しいメールは処理されません。",
    reasonLabel: "最後のエラー",
    cta: "このメールボックスを再接続する",
    ctaUrl: "/dashboard/parametres",
    footer: "このメールはメールボックスごとに週に1回まで送信されます。再接続が成功すると、通知は届かなくなります。",
    notifTitle: (email) => `メールボックス ${email} の接続が切断されました`,
    notifMessage: "設定からこのメールボックスを再接続するにはクリックしてください。",
  },
  ko: {
    subject: (email) => `Inboria — 메일함 ${email} 연결이 끊어졌습니다`,
    intro: "Inboria가 여러 번의 시도 후에도 이 메일함을 동기화할 수 없습니다. 연결이 복원될 때까지 새 이메일은 처리되지 않습니다.",
    reasonLabel: "최근 오류",
    cta: "이 메일함 다시 연결하기",
    ctaUrl: "/dashboard/parametres",
    footer: "이 이메일은 메일함당 주 1회까지만 발송됩니다. 다시 연결이 성공하면 더 이상 알림을 받지 않으십니다.",
    notifTitle: (email) => `메일함 ${email} 연결이 끊어졌습니다`,
    notifMessage: "설정에서 이 메일함을 다시 연결하려면 클릭하십시오.",
  },
  vi: {
    subject: (email) => `Inboria — Hop thu ${email} bi ngat ket noi`,
    intro: "Inboria khong the dong bo hop thu nay sau nhieu lan thu. Email moi cua Quy khach se khong duoc xu ly cho den khi ket noi duoc khoi phuc.",
    reasonLabel: "Loi gan day nhat",
    cta: "Ket noi lai hop thu nay",
    ctaUrl: "/dashboard/parametres",
    footer: "Email nay duoc gui toi da mot lan moi tuan cho moi hop thu. Sau khi ket noi lai thanh cong, Quy khach se khong nhan thong bao nua.",
    notifTitle: (email) => `Hop thu ${email} bi ngat ket noi`,
    notifMessage: "Nhan vao day de ket noi lai hop thu nay trong Cai dat.",
  },
  th: {
    subject: (email) => `Inboria — กล่องจดหมาย ${email} ถูกตัดการเชื่อมต่อ`,
    intro: "Inboria ไม่สามารถซิงค์กล่องจดหมายนี้ได้หลังจากพยายามหลายครั้ง อีเมลใหม่ของท่านจะไม่ถูกประมวลผลจนกว่าการเชื่อมต่อจะกลับมาใช้งานได้",
    reasonLabel: "ข้อผิดพลาดล่าสุด",
    cta: "เชื่อมต่อกล่องจดหมายนี้อีกครั้ง",
    ctaUrl: "/dashboard/parametres",
    footer: "อีเมลนี้จะถูกส่งไม่เกินสัปดาห์ละหนึ่งครั้งต่อกล่องจดหมายแต่ละกล่อง เมื่อเชื่อมต่อใหม่สำเร็จ ท่านจะไม่ได้รับการแจ้งเตือนอีก",
    notifTitle: (email) => `กล่องจดหมาย ${email} ถูกตัดการเชื่อมต่อ`,
    notifMessage: "โปรดคลิกเพื่อเชื่อมต่อกล่องจดหมายนี้อีกครั้งในการตั้งค่า",
  },
  id: {
    subject: (email) => `Inboria — Kotak surat ${email} terputus`,
    intro: "Inboria tidak dapat menyinkronkan kotak surat ini setelah beberapa kali percobaan. Email baru Anda tidak akan diproses hingga koneksi dipulihkan.",
    reasonLabel: "Kesalahan terakhir",
    cta: "Hubungkan kembali kotak surat ini",
    ctaUrl: "/dashboard/parametres",
    footer: "Email ini dikirim maksimal satu kali per minggu untuk setiap kotak surat. Setelah koneksi berhasil dipulihkan, Anda tidak akan menerima pemberitahuan lagi.",
    notifTitle: (email) => `Kotak surat ${email} terputus`,
    notifMessage: "Silakan klik untuk menghubungkan kembali kotak surat ini di Pengaturan.",
  },
};

function pickLang(raw: string | null | undefined): Lang {
  const v = (raw || "fr").slice(0, 2).toLowerCase();
  if (v === "en" || v === "nl" || v === "de" || v === "es" || v === "it" || v === "pt" || v === "pl" || v === "ro" || v === "sv" || v === "da" || v === "fi" || v === "hu" || v === "cs" || v === "tr" || v === "ja" || v === "ko" || v === "vi" || v === "th" || v === "id") return v;
  return "fr";
}

function renderHtml(tpl: typeof TEMPLATES["fr"], mailboxEmail: string, errorMsg: string, frontendUrl: string): string {
  const safeErr = errorMsg.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] || c));
  const link = `${frontendUrl.replace(/\/$/, "")}${tpl.ctaUrl}`;
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #0d1117; color: #ffffff; border-radius: 8px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #2d7dd2; margin: 0;">Inboria</h1>
      </div>
      <h2 style="color: #ef4444; text-align: center; font-size: 18px;">${tpl.subject(mailboxEmail)}</h2>
      <p style="color: #c9d1d9; line-height: 1.6;">${tpl.intro}</p>
      <p style="color: #8b9cb3; font-size: 13px;"><strong>${tpl.reasonLabel} :</strong> ${safeErr || "—"}</p>
      <div style="text-align: center; margin: 28px 0;">
        <a href="${link}" style="background: #2d7dd2; color: #ffffff; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">${tpl.cta}</a>
      </div>
      <hr style="border: none; border-top: 1px solid #1f2937; margin: 20px 0;" />
      <p style="color: #6e7681; font-size: 12px; text-align: center;">${tpl.footer}</p>
    </div>
  `;
}

export interface MaybeSendDeps {
  transporter?: Transporter;
  fetchConnection?: (connId: string) => Promise<any | null>;
  fetchUserEmail?: (userId: string) => Promise<string | null>;
  fetchUserLang?: (userId: string) => Promise<Lang>;
  claimAlertSlot?: (connId: string, params: { nowIso: string; cutoffIso: string }) => Promise<boolean>;
  revertAlertSlot?: (connId: string, previousSentAt: string | null) => Promise<void>;
  createNotification?: (params: { userId: string; title: string; message: string }) => Promise<void>;
  now?: () => number;
  frontendUrl?: string;
}

let cachedTransporter: Transporter | null = null;
function defaultTransporter(): Transporter {
  if (cachedTransporter) return cachedTransporter;
  cachedTransporter = nodemailer.createTransport({
    host: "smtp-relay.brevo.com",
    port: 587,
    secure: false,
    auth: {
      user: "a74939001@smtp-brevo.com",
      pass: process.env["BREVO_SMTP_PASSWORD"] || "",
    },
  });
  return cachedTransporter;
}

async function defaultFetchConnection(connId: string) {
  const { data } = await supabaseAdmin
    .from("email_connections")
    .select("id, user_id, email_address, consecutive_failures, last_error_message, last_alert_sent_at")
    .eq("id", connId)
    .single();
  return data || null;
}

async function defaultFetchUserEmail(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
  return data?.user?.email || null;
}

async function defaultFetchUserLang(userId: string): Promise<Lang> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("ai_language")
    .eq("id", userId)
    .single();
  return pickLang(data?.ai_language ?? null);
}

async function defaultClaimAlertSlot(
  connId: string,
  params: { nowIso: string; cutoffIso: string },
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("email_connections")
    .update({ last_alert_sent_at: params.nowIso })
    .eq("id", connId)
    .or(`last_alert_sent_at.is.null,last_alert_sent_at.lt.${params.cutoffIso}`)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return data !== null;
}

async function defaultRevertAlertSlot(connId: string, previousSentAt: string | null): Promise<void> {
  const { error } = await supabaseAdmin
    .from("email_connections")
    .update({ last_alert_sent_at: previousSentAt })
    .eq("id", connId);
  if (error) throw error;
}

async function defaultCreateNotification(params: { userId: string; title: string; message: string }): Promise<void> {
  await supabaseAdmin.from("notifications").insert({
    user_id: params.userId,
    type: "connection_disconnected",
    title: params.title,
    message: params.message,
    email_id: null,
    triggered_by: null,
  });
}

export async function maybeSendDisconnectedAlert(
  connId: string,
  deps: MaybeSendDeps = {},
): Promise<{ sent: boolean; reason?: string }> {
  const log = logger.child({ service: "email-alerts", connId });
  try {
    const fetchConnection = deps.fetchConnection ?? defaultFetchConnection;
    const conn = await fetchConnection(connId);
    if (!conn) return { sent: false, reason: "no-conn" };

    const failures = Number(conn.consecutive_failures || 0);
    if (failures < FAILURE_THRESHOLD) return { sent: false, reason: "below-threshold" };

    const now = (deps.now ?? Date.now)();
    if (conn.last_alert_sent_at) {
      const lastMs = new Date(conn.last_alert_sent_at).getTime();
      if (now - lastMs < ALERT_COOLDOWN_MS) {
        return { sent: false, reason: "cooldown" };
      }
    }

    const fetchUserEmail = deps.fetchUserEmail ?? defaultFetchUserEmail;
    const fetchUserLang = deps.fetchUserLang ?? defaultFetchUserLang;
    const userEmail = await fetchUserEmail(conn.user_id);
    if (!userEmail) {
      log.warn("No user email found, skipping alert");
      return { sent: false, reason: "no-user-email" };
    }
    const lang = pickLang(await fetchUserLang(conn.user_id));
    const tpl = TEMPLATES[lang];
    const errorMsg = sanitizeErrorMessage(String(conn.last_error_message || ""));

    const transporter = deps.transporter ?? defaultTransporter();
    const frontendUrl = deps.frontendUrl ?? process.env["FRONTEND_URL"] ?? "https://inboria.com";

    const claimAlertSlot = deps.claimAlertSlot ?? defaultClaimAlertSlot;
    const nowIso = new Date(now).toISOString();
    const cutoffIso = new Date(now - ALERT_COOLDOWN_MS).toISOString();
    const claimed = await claimAlertSlot(connId, { nowIso, cutoffIso });
    if (!claimed) {
      return { sent: false, reason: "cooldown" };
    }

    const previousSentAt: string | null = conn.last_alert_sent_at ?? null;

    try {
      await transporter.sendMail({
        from: '"Inboria" <noreply@inboria.com>',
        to: userEmail,
        subject: tpl.subject(conn.email_address),
        html: renderHtml(tpl, conn.email_address, errorMsg, frontendUrl),
      });
    } catch (sendErr: any) {
      const revertAlertSlot = deps.revertAlertSlot ?? defaultRevertAlertSlot;
      try {
        await revertAlertSlot(connId, previousSentAt);
      } catch (revertErr: any) {
        log.warn({ err: sanitizeErrorMessage(revertErr?.message || String(revertErr)) }, "Failed to revert alert slot after send failure");
      }
      throw sendErr;
    }

    try {
      const createNotif = deps.createNotification ?? defaultCreateNotification;
      await createNotif({
        userId: conn.user_id,
        title: tpl.notifTitle(conn.email_address),
        message: tpl.notifMessage,
      });
    } catch (notifErr: any) {
      log.warn({ err: sanitizeErrorMessage(notifErr?.message || String(notifErr)) }, "Failed to insert in-app notification (alert mail still sent)");
    }

    log.info({ email: userEmail, mailbox: conn.email_address, lang }, "Disconnected alert sent");
    return { sent: true };
  } catch (err: any) {
    log.error({ err: sanitizeErrorMessage(err?.message || String(err)) }, "Failed to send disconnected alert");
    return { sent: false, reason: "error" };
  }
}
