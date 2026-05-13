import { google } from "googleapis";
import { ImapFlow, type MailboxLockObject } from "imapflow";
import OpenAI from "openai";
import { simpleParser } from "mailparser";
import { supabaseAdmin } from "../lib/supabase";
import { logger } from "../lib/logger";
import * as net from "net";
import { emitEvent } from "./webhook-emitter";
import { logEmailToHubspot } from "./hubspot";
import { logEmailToPipedrive } from "./pipedrive";
import { preClassifyEmail, recordAIClassification, bumpMetrics } from "./pre-filter";
import { consumeAiCredits, logTriageEvent, checkEntitlement } from "./credits";
import { getEmailOAuthRedirectUri } from "../lib/urls";
import { syncImapJunk, syncOutlookJunk, type JunkEmailPayload } from "./junk-sync";
import { recordAutopilotEvent } from "./autopilot-events";
import { hasJunkColumns } from "../lib/schema-flags";
import { getUserAiLang, summaryLangInstruction } from "./ai-lang";
import {
  markConnectionFailure,
  markConnectionSuccess,
  fetchWithTimeout,
  withTimeout,
  runSyncLoop,
  sanitizeErrorMessage,
} from "./connection-health";
import { runFollowupDetectionForAllUsers } from "./follow-up-detector";

interface SaveEmailOptions {
  forceSpam?: boolean;
  providerMessageId?: string | null;
  nativeMessageId?: string | null;
}

const IMAP_BODY_MAX_BYTES = 200_000;

// Cache pour ne dédoublonner qu'une fois par sync par user (perf)
const dedupedUsersThisProcess = new Set<string>();

/**
 * Supprime les emails en double pour un user, basé sur le suffixe natif de external_id
 * (msg.id Gmail/Outlook ou UID IMAP). Garde l'email le plus ancien (le legitime).
 * Idempotent. À appeler une fois par cycle de sync.
 */
async function dedupeUserEmailsByNativeId(userId: string): Promise<number> {
  if (dedupedUsersThisProcess.has(userId)) return 0;
  dedupedUsersThisProcess.add(userId);
  try {
    // Paginé — Supabase limite à 1000 lignes par défaut
    const rows: any[] = [];
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      const { data: page, error } = await supabaseAdmin
        .from("emails")
        .select("id, external_id, sender, subject, created_at, shared_mailbox_id")
        .eq("user_id", userId)
        .order("created_at", { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) {
        logger.error({ userId, err: error.message }, "[dedupe] select page error");
        return 0;
      }
      if (!page || page.length === 0) break;
      rows.push(...page);
      if (page.length < PAGE) break;
    }
    if (rows.length === 0) return 0;

    const idsToDelete = new Set<number>();

    // Pass 1 — Group par suffixe natif d'external_id
    const bySuffix = new Map<string, Array<{ id: number }>>();
    for (const r of rows as any[]) {
      const ext = String(r.external_id || "");
      const idx = ext.lastIndexOf(":");
      if (idx < 0 || idx === ext.length - 1) continue;
      const suffix = ext.slice(idx + 1);
      if (!suffix || suffix.length < 4) continue;
      const arr = bySuffix.get(suffix) || [];
      arr.push({ id: r.id });
      bySuffix.set(suffix, arr);
    }
    for (const arr of bySuffix.values()) {
      if (arr.length < 2) continue;
      for (let i = 1; i < arr.length; i++) idsToDelete.add(arr[i].id);
    }

    // Pass 2 — Group par (sharedMailboxId, sender, subject, créé à la même seconde)
    // Catche les doublons issus de re-syncs où l'external_id diffère totalement.
    const byContent = new Map<string, Array<{ id: number }>>();
    for (const r of rows as any[]) {
      if (idsToDelete.has(r.id)) continue;
      const sender = String(r.sender || "").trim().toLowerCase();
      const subject = String(r.subject || "").trim().toLowerCase();
      const ts = r.created_at ? new Date(r.created_at).getTime() : 0;
      if (!sender || !subject || !ts) continue;
      // Bucket par seconde — tolère un léger décalage
      const bucket = Math.floor(ts / 1000);
      const sharedKey = r.shared_mailbox_id || "_";
      const key = `${sharedKey}|${sender}|${subject}|${bucket}`;
      const arr = byContent.get(key) || [];
      arr.push({ id: r.id });
      byContent.set(key, arr);
    }
    for (const arr of byContent.values()) {
      if (arr.length < 2) continue;
      for (let i = 1; i < arr.length; i++) idsToDelete.add(arr[i].id);
    }

    if (idsToDelete.size === 0) return 0;

    const idsArr = Array.from(idsToDelete);
    let deleted = 0;
    for (let i = 0; i < idsArr.length; i += 500) {
      const batch = idsArr.slice(i, i + 500);
      const { error: delErr } = await supabaseAdmin.from("emails").delete().in("id", batch);
      if (delErr) {
        logger.error({ userId, err: delErr.message }, "[dedupe] delete batch error");
        break;
      }
      deleted += batch.length;
    }
    if (deleted > 0) {
      logger.warn({ userId, deleted, scanned: rows.length }, "[dedupe] removed duplicate emails");
    }
    return deleted;
  } catch (err: any) {
    logger.error({ userId, err: err.message }, "[dedupe] crashed");
    return 0;
  }
}

interface AttachmentMeta {
  filename: string;
  contentType: string;
  size: number;
  providerAttachmentId: string;
}

/**
 * Construit la liste des Message-IDs candidats du thread depuis les headers
 * In-Reply-To et References du mail entrant. Inclut chaque variante avec et
 * sans chevrons, pour matcher quelle que soit la convention de stockage.
 */
function collectThreadMessageIds(headers: Record<string, unknown> | undefined | null): string[] {
  if (!headers) return [];
  const out = new Set<string>();
  const push = (raw: unknown) => {
    if (typeof raw !== "string") return;
    for (const tok of raw.split(/[\s,]+/)) {
      const t = tok.trim();
      if (!t) continue;
      out.add(t);
      if (t.startsWith("<") && t.endsWith(">")) out.add(t.slice(1, -1));
      else out.add(`<${t}>`);
    }
  };
  const inReply = (headers as any)["in-reply-to"];
  if (Array.isArray(inReply)) inReply.forEach(push);
  else push(inReply);
  const refs = (headers as any)["references"];
  if (Array.isArray(refs)) refs.forEach(push);
  else push(refs);
  return Array.from(out);
}

function extractGmailAttachments(payload: any): AttachmentMeta[] {
  const attachments: AttachmentMeta[] = [];
  if (!payload) return attachments;

  function walk(parts: any[]) {
    for (const part of parts) {
      if (part.filename && part.filename.length > 0 && part.body) {
        attachments.push({
          filename: part.filename,
          contentType: part.mimeType || "application/octet-stream",
          size: part.body.size || 0,
          providerAttachmentId: part.body.attachmentId || "",
        });
      }
      if (part.parts) {
        walk(part.parts);
      }
    }
  }

  if (payload.parts) {
    walk(payload.parts);
  }

  return attachments;
}

export function extractGmailBody(payload: any): string {
  if (!payload) return "";

  function decodeBase64(data: string): string {
    try {
      return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
    } catch {
      return "";
    }
  }

  if (payload.body?.data) {
    return decodeBase64(payload.body.data);
  }

  if (payload.parts) {
    const htmlPart = payload.parts.find((p: any) => p.mimeType === "text/html");
    if (htmlPart?.body?.data) {
      return decodeBase64(htmlPart.body.data);
    }

    const textPart = payload.parts.find((p: any) => p.mimeType === "text/plain");
    if (textPart?.body?.data) {
      return decodeBase64(textPart.body.data);
    }

    for (const part of payload.parts) {
      if (part.parts) {
        const nested = extractGmailBody(part);
        if (nested) return nested;
      }
    }
  }

  return "";
}

const openai = new OpenAI({
  apiKey: process.env["OPENAI_API_KEY"],
});

const SYNC_INTERVAL_MS = 5 * 60 * 1000;
const GOOGLE_CLIENT_ID = process.env["GOOGLE_CLIENT_ID"] || "";
const GOOGLE_CLIENT_SECRET = process.env["GOOGLE_CLIENT_SECRET"] || "";

const ALLOWED_IMAP_HOSTS = [
  "imap.gmail.com",
  "imap.mail.yahoo.com",
  "imap.mail.me.com",
  "imap.orange.fr",
  "imap.free.fr",
  "imap.sfr.fr",
  "outlook.office365.com",
  "imap-mail.outlook.com",
  "imap.gmx.com",
  "imap.zoho.com",
  "imap.fastmail.com",
  "imap.protonmail.ch",
  "mail.infomaniak.com",
  "imap.ionos.fr",
  "ssl0.ovh.net",
  "pro1.mail.ovh.net",
  "pro2.mail.ovh.net",
];

let syncRunning = false;

export const NOISE_SENDER_REGEX = /(noreply|no-reply|no\.reply|donotreply|do-not-reply|notification|notifications@|mailer-daemon|postmaster|automated@|alerts?@|info-noreply)/i;
export const NOISE_SUBJECT_REGEX = /(confirm.*sign.?up|sign.?up.*confirm|verify.*email|email.*verif|verification.*code|code.*verification|code.*confirmation|confirmation.*code|welcome to|your.*code is|your.*one.?time|one.?time.*pass|otp.*code|bienvenue|confirmez.*inscription|v[ée]rifi.*compte|code.*v[ée]rification|activate.*account|account.*activation|reset.*password|password.*reset|magic.*link|email.*confirmation|confirm your email)/i;

export function isNoiseEmail(sender: string, subject: string): boolean {
  const s = (sender || "").toLowerCase();
  const sub = (subject || "").toLowerCase();
  return NOISE_SENDER_REGEX.test(s) || NOISE_SUBJECT_REGEX.test(sub);
}

function normalizeTitle(title: string): string {
  return (title || "").trim().toLowerCase().replace(/\s+/g, " ");
}

export async function userHasOpenTaskWithTitle(userId: string, title: string): Promise<boolean> {
  const norm = normalizeTitle(title);
  if (!norm) return true;
  const { data } = await supabaseAdmin
    .from("tasks")
    .select("id, title")
    .eq("user_id", userId)
    .eq("done", false)
    .ilike("title", title)
    .limit(5);
  if (!data || data.length === 0) return false;
  return data.some((t: any) => normalizeTitle(t.title) === norm);
}

function isPrivateIP(host: string): boolean {
  try {
    if (net.isIP(host)) {
      return (
        host.startsWith("10.") ||
        host.startsWith("172.") ||
        host.startsWith("192.168.") ||
        host.startsWith("127.") ||
        host === "0.0.0.0" ||
        host === "::1" ||
        host === "localhost"
      );
    }
    return host === "localhost" || host.endsWith(".local") || host.endsWith(".internal");
  } catch {
    return true;
  }
}

function isValidImapHost(host: string): boolean {
  if (!host || typeof host !== "string") return false;
  if (isPrivateIP(host)) return false;
  if (ALLOWED_IMAP_HOSTS.includes(host.toLowerCase())) return true;
  const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
  return domainRegex.test(host);
}

function getGmailRedirectUri(): string {
  return getEmailOAuthRedirectUri("gmail");
}

function getGoogleOAuth2Client() {
  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    getGmailRedirectUri()
  );
}

async function detectAppointmentFromEmail(
  emailId: number,
  sender: string,
  subject: string,
  body: string,
  userId: string
): Promise<void> {
  try {
    const billing = await consumeAiCredits(userId, "extract_appointment", {
      source: "auto-sync",
      emailId,
      reason: "auto-detect-appointment-on-incoming",
    });
    if (!billing.ok) {
      logger.warn(
        { emailId, userId },
        "[auto-sync] skipping appointment detection: billing fail-closed",
      );
      return;
    }
    const { data: tzProfile } = await supabaseAdmin
      .from("profiles")
      .select("timezone")
      .eq("id", userId)
      .maybeSingle();
    const userTz = tzProfile?.timezone || "Europe/Brussels";
    const openai = new OpenAI({ apiKey: process.env["OPENAI_API_KEY"] });
    const cleanBody = (body || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 800);
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      max_completion_tokens: 512,
      messages: [
        {
          role: "system",
          content: `Tu analyses un email professionnel pour détecter si un rendez-vous, une réunion ou un événement est mentionné avec une date/heure concrète.
La date actuelle est le ${new Date().toISOString().split("T")[0]} (année ${new Date().getFullYear()}).
IMPORTANT: Utilise l'année ${new Date().getFullYear()} pour les dates si aucune année n'est précisée.
FUSEAU HORAIRE: Les heures mentionnées dans l'email sont dans le fuseau "${userTz}". Tu DOIS retourner les datetimes ISO avec le décalage horaire correspondant (ex pour Europe/Brussels en mai: "2026-05-14T13:00:00+02:00"). N'utilise JAMAIS le suffixe "Z" (UTC) pour les heures locales.
Réponds en JSON strict:
{ "hasAppointment": false }
OU
{ "hasAppointment": true, "title": "...", "description": "...", "location": "...", "startAt": "ISO datetime avec offset", "endAt": "ISO datetime avec offset", "allDay": false, "participants": "..." }
N'invente PAS de RDV. Détecte uniquement si une date/heure précise est mentionnée (ex: "réunion le 15 mars à 14h", "call mardi 10h").`,
        },
        {
          role: "user",
          content: `De: ${sender}\nObjet: ${subject}\nCorps: ${cleanBody}`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content ?? "{}";
    const result = JSON.parse(content);

    if (!result.hasAppointment || !result.title || !result.startAt) return;

    const { data: existing } = await supabaseAdmin
      .from("appointments")
      .select("id")
      .eq("user_id", userId)
      .eq("email_id", emailId)
      .maybeSingle();

    if (existing) return;

    const endAt = result.endAt || new Date(new Date(result.startAt).getTime() + 3600000).toISOString();
    await supabaseAdmin.from("appointments").insert({
      user_id: userId,
      title: result.title,
      description: result.description || null,
      location: result.location || null,
      start_at: result.startAt,
      end_at: endAt,
      all_day: result.allDay || false,
      email_id: emailId,
      reminder_minutes: 30,
      confirmed: false,
      participants: result.participants || sender || null,
    });

    logger.info({ emailId, title: result.title }, "[auto-sync] Appointment suggestion created");
  } catch (err: any) {
    logger.error({ err: err.message, emailId }, "[auto-sync] detectAppointmentFromEmail error");
  }
}

async function triageEmailAI(
  sender: string,
  subject: string,
  body: string,
  userId: string
): Promise<{ priority: string; summary: string; category: string; project: string; tasks: string[]; is_spam: boolean }> {
  try {
    const lang = await getUserAiLang(userId);
    const langInstr = summaryLangInstruction(lang);
    const { data: categories } = await supabaseAdmin
      .from("categories")
      .select("name")
      .eq("user_id", userId);
    const JUNK_CATS = ["non classé", "non classe", "uncategorized", "niet geclassificeerd"];
    const categoryNames = (categories || []).map((c: any) => c.name).filter((n: string) => !JUNK_CATS.includes(n.toLowerCase()));

    const { data: activeProjects } = await supabaseAdmin
      .from("projects")
      .select("name, reference, description")
      .eq("user_id", userId)
      .eq("status", "actif");
    const projectsList = (activeProjects || []).map((p: any) => {
      const parts = [`"${p.name}"`];
      if (p.reference) parts.push(`(ref: ${p.reference})`);
      if (p.description) parts.push(`— ${String(p.description).slice(0, 80)}`);
      return `- ${parts.join(" ")}`;
    }).join("\n");

    const { data: rules } = await supabaseAdmin
      .from("ai_rules")
      .select("sender_pattern, forced_priority, forced_category")
      .eq("user_id", userId);

    let rulesContext = "";
    if (rules && rules.length > 0) {
      rulesContext = "\n\nRegles apprises (respecte-les en priorite):\n" +
        rules.map((r: any) => {
          const parts = [`- Si expediteur contient "${r.sender_pattern}"`];
          if (r.forced_priority) parts.push(`alors priorite="${r.forced_priority}"`);
          if (r.forced_category) parts.push(`et categorie="${r.forced_category}"`);
          return parts.join(" ");
        }).join("\n");
    }

    const projectsContext = projectsList
      ? `\n\nProjets actifs de l'utilisateur:\n${projectsList}\n\nSi l'email concerne clairement l'un de ces projets (mention du nom, de la reference, ou contenu lie), mets le nom exact du projet dans "project". Sinon mets "Aucun".`
      : "";

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 512,
      messages: [
        {
          role: "system",
          content: "Tu es un assistant de tri d'emails professionnel pour une PME. Reponds uniquement en JSON valide. Classe TOUJOURS les emails dans une categorie pertinente. Exemples: LinkedIn/reseaux sociaux → 'Reseaux sociaux', newsletters → 'Newsletters', codes de verification/securite → 'Notifications', factures/paiements → 'Facturation', hebergement/domaines → 'Hebergement'. N'utilise JAMAIS 'Non classe'. IMPORTANT spam: Sois TRES CONSERVATEUR. Mets is_spam=true UNIQUEMENT pour les arnaques EVIDENTES (loterie, heritage nigerian, 'vous avez gagne', faux remboursements fiscaux, sextorsion). Les emails de verification, codes OTP, notifications de service, newsletters, marketing legitime, emails commerciaux NE SONT PAS du spam. En cas de doute, mets is_spam=false.",
        },
        {
          role: "user",
          content: `${langInstr}\n\nEmail:\nDe: ${sender}\nSujet: ${subject}\nCorps: ${(body || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 800)}\n\nCategories existantes: ${categoryNames.join(", ") || "Aucune"}${projectsContext}${rulesContext}\n\nReponds en JSON:\n{"priority":"urgent|moyen|faible","summary":"resume 1 phrase","category":"nom de categorie existante OU propose un nouveau nom pertinent (court, professionnel). Utilise 'Non classe' uniquement si vraiment inclassable.","project":"nom exact d'un projet actif OU 'Aucun'","tasks":["tache 1","tache 2"],"is_spam":false}\n\nIMPORTANT pour is_spam: TRES CONSERVATEUR. Mets true UNIQUEMENT pour arnaques evidentes (loterie, heritage, 'vous avez gagne', sextorsion, faux remboursement fiscal). Les emails de verification, codes OTP, alertes de securite, notifications de service, newsletters, marketing legitime, emails commerciaux NE SONT PAS du spam. En cas de doute, false.\n\nIMPORTANT pour project: ne renvoie un nom de projet QUE si l'email le mentionne explicitement (nom, reference) OU si le contenu est clairement lie au projet. En cas de doute, mets "Aucun". Ne jamais inventer un nom de projet qui ne figure pas dans la liste ci-dessus.\n\nIMPORTANT pour les taches: Sois TRES SELECTIF. Ne genere des taches QUE quand une action humaine CONCRETE et IMPORTANTE est requise (repondre a un client, payer une facture, signer un document, confirmer un rendez-vous). JAMAIS de tache pour: newsletters, notifications automatiques, confirmations d'inscription, codes de verification, emails marketing, reseaux sociaux, alertes de securite, confirmations de commande, recus, emails informatifs. Si aucune action importante n'est requise, retourne "tasks":[] (tableau vide). Maximum 1 tache par email.`,
        },
      ],
    });

    const content = completion.choices[0]?.message?.content ?? "{}";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const result = JSON.parse(jsonMatch ? jsonMatch[0] : "{}");
    return {
      priority: result.priority || "faible",
      summary: result.summary || "",
      category: result.category || "Non classe",
      project: typeof result.project === "string" ? result.project : "Aucun",
      tasks: Array.isArray(result.tasks) ? result.tasks : [],
      is_spam: result.is_spam === true,
    };
  } catch (err: any) {
    console.error("[auto-sync] triageEmailAI error:", err.message);
    return { priority: "faible", summary: "", category: "Non classe", project: "Aucun", tasks: [], is_spam: false };
  }
}

export async function saveEmailWithTriage(
  userId: string,
  externalId: string,
  sender: string,
  subject: string,
  body: string,
  createdAt: string,
  sharedMailboxId?: string | null,
  headers?: Record<string, string | string[] | undefined>,
  recipient?: string | null,
  options?: SaveEmailOptions,
): Promise<number | null> {
  const forceSpam = options?.forceSpam === true;
  const providerMessageId = options?.providerMessageId || null;
  const nativeMessageId = options?.nativeMessageId || null;

  const { data: existing } = await supabaseAdmin
    .from("emails")
    .select("id, status")
    .eq("user_id", userId)
    .eq("external_id", externalId)
    .maybeSingle();

  // Dedup robuste : si un email existe avec un external_id finissant par ":${nativeMessageId}"
  // (ancien format ${connId}:${msgId}), on le considère comme le même message — évite les
  // doublons massifs après reconnexion d'un compte (Gmail/Outlook/IMAP).
  if (!existing && nativeMessageId) {
    const escaped = nativeMessageId.replace(/[%_\\]/g, (m) => `\\${m}`);
    const { data: existingByNative } = await supabaseAdmin
      .from("emails")
      .select("id, status, external_id")
      .eq("user_id", userId)
      .like("external_id", `%:${escaped}`)
      .limit(1)
      .maybeSingle();
    if (existingByNative) {
      const update: Record<string, any> = {};
      if ((existingByNative as any).external_id !== externalId) update.external_id = externalId;
      if (forceSpam && (existingByNative as any).status !== "spam") update.status = "spam";
      if (Object.keys(update).length > 0) {
        await supabaseAdmin.from("emails").update(update).eq("id", existingByNative.id);
      }
      return null;
    }
  }

  const junkColumnsAvailable = await hasJunkColumns();

  if (existing) {
    if (forceSpam && existing.status !== "spam") {
      const update: Record<string, unknown> = { status: "spam" };
      if (junkColumnsAvailable) update.spam_source = "provider";
      await supabaseAdmin.from("emails").update(update).eq("id", existing.id);
    }
    return null;
  }

  // Dedup ULTIME via RFC 822 Message-ID — stable entre providers, comptes,
  // reconnexions et changements de UIDVALIDITY (IMAP). Activé même sans
  // colonne `provider_message_id` (la requête tolère l'absence de colonne).
  if (providerMessageId) {
    try {
      const { data: existingByMsgId, error: msgIdErr } = await supabaseAdmin
        .from("emails")
        .select("id, status, external_id")
        .eq("user_id", userId)
        .eq("provider_message_id", providerMessageId)
        .limit(1)
        .maybeSingle();
      if (!msgIdErr && existingByMsgId) {
        const update: Record<string, any> = {};
        if ((existingByMsgId as any).external_id !== externalId) {
          update.external_id = externalId;
        }
        if (junkColumnsAvailable) {
          if (forceSpam && (existingByMsgId as any).status !== "spam") {
            update.status = "spam";
            update.spam_source = "provider";
          } else if (!forceSpam && (existingByMsgId as any).status === "spam") {
            update.status = "non_lu";
            update.spam_source = "user";
          }
        }
        if (Object.keys(update).length > 0) {
          await supabaseAdmin.from("emails").update(update).eq("id", existingByMsgId.id);
        }
        return null;
      }
    } catch {
      // Colonne absente — on ignore et on poursuit avec le dedup par external_id.
    }
  }

  const { data: profile, error: profileErr } = await supabaseAdmin
    .from("profiles")
    .select("emails_used, emails_quota")
    .eq("id", userId)
    .single();

  if (profileErr || !profile) {
    console.error("[auto-sync] Profile fetch error:", profileErr?.message);
    return null;
  }

  // Junk serveur : on consomme aucun credit (pas de classification IA),
  // on inscrit directement la ligne en spam.
  if (!forceSpam) {
    const ent = await checkEntitlement(userId, 1);
    if (ent.blocked) {
      return null;
    }
  }

  // Junk fournisseur : court-circuit complet du flux IA. Aucune classif, aucun task,
  // aucun RDV, aucun credit consomme. Le mail est juste reflete dans la vue Spam.
  let pre: Awaited<ReturnType<typeof preClassifyEmail>> = { hit: false };
  let triage: { priority: string; summary: string; category: string; tasks: string[]; is_spam: boolean; project?: string };
  if (forceSpam) {
    triage = { priority: "faible", summary: "", category: "Non classe", tasks: [], is_spam: true, project: "Aucun" };
  } else {

  // Pre-filtre deterministe : evite l'appel IA sur les mails evidents (newsletters, notifs auto, expediteurs en cache)
  pre = await preClassifyEmail({ userId, sender, subject, headers });

  if (pre.hit && pre.classification) {
    triage = pre.classification;
    if (pre.reason === "sender-cache") {
      bumpMetrics(userId, "cache").catch(() => {});
      logger.info({ sender, reason: pre.reason, category: triage.category }, "[auto-sync] pre-filter hit (cache)");
    } else {
      bumpMetrics(userId, "prefilter").catch(() => {});
      logger.info({ sender, reason: pre.reason, category: triage.category }, "[auto-sync] pre-filter hit (header)");
    }
  } else {
    triage = await triageEmailAI(sender, subject, body, userId);
    bumpMetrics(userId, "ai").catch(() => {});
    recordAIClassification(userId, sender, triage.category, triage.priority).catch(() => {});
  }
  } // fin du bloc !forceSpam

  let projectId: string | null = null;
  if (triage.project && triage.project.toLowerCase() !== "aucun" && triage.project.toLowerCase() !== "none") {
    const { data: matchedProject } = await supabaseAdmin
      .from("projects")
      .select("id")
      .eq("user_id", userId)
      .eq("name", triage.project)
      .eq("status", "actif")
      .maybeSingle();
    if (matchedProject?.id) {
      projectId = matchedProject.id;
      logger.info({ userId, projectId, projectName: triage.project }, "[auto-sync] email auto-linked to project");
    }
  }

  let categoryId = null;
  if (triage.category && triage.category !== "Non classe") {
    const { data: cat } = await supabaseAdmin
      .from("categories")
      .select("id")
      .eq("user_id", userId)
      .eq("name", triage.category)
      .maybeSingle();
    if (cat?.id) {
      categoryId = cat.id;
    } else {
      const { data: newCat, error: newCatErr } = await supabaseAdmin
        .from("categories")
        .insert({ user_id: userId, name: triage.category })
        .select("id")
        .single();
      if (newCat?.id) {
        categoryId = newCat.id;
        console.log(`[auto-sync] Auto-created category "${triage.category}" for user ${userId}`);
      } else if (newCatErr?.code === "23505") {
        const { data: existing } = await supabaseAdmin
          .from("categories")
          .select("id")
          .eq("user_id", userId)
          .eq("name", triage.category)
          .maybeSingle();
        categoryId = existing?.id || null;
      }
    }
  }

  // PostgreSQL text columns reject \u0000 (NUL) bytes — strip them and other
  // invalid surrogate halves to avoid "unsupported Unicode escape sequence".
  const stripNul = (s: string | null | undefined): string =>
    (s || "")
      .replace(/\u0000/g, "")
      .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, "")
      .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "");

  const insertPayload: Record<string, any> = {
    user_id: userId,
    external_id: externalId,
    sender: stripNul(sender),
    subject: stripNul(subject),
    body: stripNul(body),
    status: forceSpam ? "spam" : (triage.is_spam ? "spam" : "non_lu"),
    priority: triage.priority,
    summary: stripNul(triage.summary),
    category_id: categoryId,
    project_id: projectId,
    created_at: createdAt,
  };
  if (junkColumnsAvailable) {
    if (forceSpam) {
      insertPayload.spam_source = "provider";
    } else if (triage.is_spam) {
      insertPayload.spam_source = "ai";
    }
  }
  // Toujours persister provider_message_id si dispo — c'est notre garde-fou
  // anti-doublons le plus fiable (RFC Message-ID, stable cross-provider).
  if (providerMessageId) {
    insertPayload.provider_message_id = providerMessageId;
  }
  if (sharedMailboxId) {
    insertPayload.shared_mailbox_id = sharedMailboxId;
  }
  if (recipient) {
    insertPayload.recipient = stripNul(recipient);
  }

  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from("emails")
    .insert(insertPayload)
    .select("id")
    .maybeSingle();

  if (insertErr) {
    if (insertErr.code === "23505") return null;
    console.error("[auto-sync] insert error:", insertErr.message);
    return null;
  }

  if (!inserted) return null;

  // Emit public webhook: email.received (B2B credibility — Vague 3)
  try {
    const { emitWebhook } = await import("./webhooks");
    emitWebhook({
      userId,
      event: "email.received",
      payload: {
        id: inserted.id,
        from: sender,
        subject,
        priority: triage.priority,
        summary: triage.summary,
        receivedAt: insertPayload.created_at || new Date().toISOString(),
        forceSpam: !!forceSpam,
      },
    }).catch(() => {});
  } catch {
    /* webhooks optional */
  }

  if (forceSpam) {
    return inserted.id;
  }

  // Task #294 — auto-classement dans les « Mes dossiers » de l'utilisateur.
  // Best-effort, jamais bloquant pour la sync. Skip pour les mails forceSpam
  // (déjà retournés plus haut). Les dossiers sont strictement privés
  // (RLS user_id), donc pas de fuite cross-utilisateurs même en boîte
  // partagée.
  try {
    const { classifyEmailIntoUserFolders } = await import("../routes/folders");
    classifyEmailIntoUserFolders({
      userId,
      emailId: inserted.id,
      sender,
      subject,
      body,
      summary: triage.summary,
    }).catch(() => {});
  } catch {
    /* folders hook optional */
  }

  // Run user automation rules (best-effort, never block the sync)
  try {
    const { runMatchingRules } = await import("../routes/automation-rules");
    let categoryNameForRules: string | null = null;
    if (categoryId) {
      const { data: catRow } = await supabaseAdmin
        .from("categories")
        .select("name")
        .eq("id", categoryId)
        .maybeSingle();
      categoryNameForRules = catRow?.name || null;
    }
    await runMatchingRules({
      userId,
      emailId: inserted.id,
      email: {
        sender,
        recipient: recipient || null,
        subject,
        body,
        category_name: categoryNameForRules,
        category_id: categoryId,
        priority: triage.priority,
        status: insertPayload.status,
      },
    });
  } catch (e: any) {
    logger.warn({ err: e?.message, emailId: inserted.id }, "[auto-sync] runMatchingRules failed (continuing)");
  }

  logger.info(
    {
      emailId: inserted.id,
      sender,
      subject: subject?.slice(0, 80),
      priority: triage.priority,
      isSpam: triage.is_spam,
    },
    "[auto-sync] triage done",
  );
  emitEvent(userId, "email.received", {
    id: inserted.id,
    sender,
    subject,
    summary: triage.summary,
    priority: triage.priority,
  }).catch(() => {});

  // RDV Phase 3 (#261) — si ce mail entrant est une réponse à une proposition
  // de RDV envoyée par Inboria (In-Reply-To OU References matche un
  // proposal_message_id pending), on classe la réponse (oui/non/contre-prop)
  // et on met à jour le statut du RDV. Best-effort, jamais bloquant pour la
  // sync. On accepte la chaîne References car certains clients (Outlook web,
  // Apple Mail) ne renvoient pas In-Reply-To sur une réponse-de-réponse.
  const candidateMessageIds = collectThreadMessageIds(headers);
  try {
    if (candidateMessageIds.length > 0) {
      const { handleIncomingEmailForMeeting } = await import("./meeting-proposals");
      handleIncomingEmailForMeeting(
        userId,
        inserted.id,
        candidateMessageIds,
        providerMessageId,
        body,
      ).catch(() => {});
    }
  } catch {
    /* meeting hook optional */
  }

  // Trace dans le tableau de bord Inboria (panneau "Activite") : chaque
  // email entrant trie automatiquement par le worker doit apparaitre comme
  // un evenement `email_sorted`, sinon les compteurs Tries/Brouillons/etc.
  // restent a 0 alors que le worker fonctionne — cf. retour utilisateur
  // 6 mai 2026.
  recordAutopilotEvent({
    userId,
    eventType: "email_sorted",
    emailId: inserted.id,
    title: subject,
    metadata: {
      priority: triage.priority,
      categoryId: categoryId || null,
      source: "auto-sync",
    },
  }).catch(() => {});

  // Push to CRMs (no-op if not connected)
  const senderEmail = (sender.match(/<(.+?)>/)?.[1] || sender).trim();
  if (senderEmail) {
    logEmailToHubspot(userId, inserted.id, senderEmail, subject, body, "inbound").catch(() => {});
    logEmailToPipedrive(userId, inserted.id, senderEmail, subject, body).catch(() => {});
  }

  // Log triage event for audit trail and accurate billing recount
  if (!pre.hit) {
    logTriageEvent(userId, { source: "auto-sync", externalId, sender }).catch(() => {});
  }

  // Skip appointment detection pour les hits pre-filtre evidents (newsletters, notifications)
  // -> ces mails ne contiennent jamais de RDV, evite un appel OpenAI inutile.
  // Skip aussi quand le mail est une reponse a une proposition Inboria existante :
  // sinon on cree un doublon en plus du RDV qui passe en confirme via le hook RDV.
  // On regarde In-Reply-To ET References (et leurs variantes avec/sans <>),
  // car certains clients ne propagent que References sur une réponse-de-réponse.
  let isReplyToProposal = false;
  if (candidateMessageIds.length > 0) {
    const { data: matchedProposal } = await supabaseAdmin
      .from("appointments")
      .select("id")
      .eq("user_id", userId)
      .in("proposal_message_id", candidateMessageIds)
      .limit(1);
    isReplyToProposal = Boolean(matchedProposal && matchedProposal.length > 0);
    if (isReplyToProposal) {
      logger.info(
        { emailId: inserted.id, userId },
        "[auto-sync] reply to RDV proposal detected — skipping appointment auto-extract",
      );
    }
  }
  if (!pre.hit && !isReplyToProposal) {
    detectAppointmentFromEmail(inserted.id, sender, subject, body, userId).catch(() => {});
  }

  if (triage.tasks.length > 0 && !isNoiseEmail(sender, subject)) {
    const { data: existingTasks } = await supabaseAdmin
      .from("tasks")
      .select("id")
      .eq("email_id", inserted.id)
      .limit(1);

    if (!existingTasks || existingTasks.length === 0) {
      const tasksToInsert: { user_id: string; email_id: number; title: string; done: boolean; ai_generated: boolean }[] = [];
      for (const title of triage.tasks) {
        const dup = await userHasOpenTaskWithTitle(userId, title);
        if (dup) {
          console.log(`[auto-sync] skip duplicate task title for user ${userId}: "${title}"`);
          continue;
        }
        tasksToInsert.push({ user_id: userId, email_id: inserted.id, title, done: false, ai_generated: true });
      }

      if (tasksToInsert.length > 0) {
        const { error: taskErr } = await supabaseAdmin.from("tasks").insert(tasksToInsert);
        if (taskErr) {
          console.error("[auto-sync] task insert error:", taskErr.message);
        }

      }
    } else {
      console.log(`[auto-sync] tasks already exist for email ${inserted.id}, skipping`);
    }
  } else if (triage.tasks.length > 0) {
    console.log(`[auto-sync] noise email detected (${sender} | ${subject.slice(0, 60)}), skipping ${triage.tasks.length} task(s)`);
  }

  if (!forceSpam) {
    const { error: quotaErr } = await supabaseAdmin.rpc("increment_emails_used", {
      user_id_input: userId,
    });

    if (quotaErr) {
      const { error: fallbackErr } = await supabaseAdmin
        .from("profiles")
        .update({ emails_used: profile.emails_used + 1 })
        .eq("id", userId);
      if (fallbackErr) {
        console.error("[auto-sync] quota update error:", fallbackErr.message);
      }
    }
  }

  return inserted.id;
}

async function saveAttachmentsMeta(
  emailId: number,
  attachments: AttachmentMeta[],
  provider: string,
  connectionId: string,
  messageUid?: string
) {
  if (attachments.length === 0) return;
  const rows = attachments.map((a) => ({
    email_id: emailId,
    filename: a.filename,
    content_type: a.contentType,
    size: a.size,
    provider,
    provider_attachment_id: a.providerAttachmentId,
    connection_id: connectionId,
    message_uid: messageUid || null,
  }));

  const { error } = await supabaseAdmin.from("email_attachments").insert(rows);
  if (error) {
    console.warn("[auto-sync] attachment meta insert via client failed, trying direct REST:", error.message);
    try {
      const supabaseUrl = process.env["VITE_SUPABASE_URL"];
      const supabaseKey = process.env["SUPABASE_SECRET_KEY"];
      const resp = await fetchWithTimeout(`${supabaseUrl}/rest/v1/email_attachments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": supabaseKey!,
          "Authorization": `Bearer ${supabaseKey}`,
          "Prefer": "return=minimal",
        },
        body: JSON.stringify(rows),
        timeoutMs: 20_000,
      });
      if (!resp.ok) {
        const errText = await resp.text();
        console.error("[auto-sync] attachment meta direct REST insert also failed:", resp.status, errText);
      } else {
        console.log(`[auto-sync] attachment meta saved via direct REST for email #${emailId}`);
      }
    } catch (restErr: any) {
      console.error("[auto-sync] attachment meta direct REST error:", restErr.message);
    }
  }
}

async function syncGmailForUser(conn: any): Promise<number> {
  try {
    // Dédoublonnage one-shot par user/process — déclenché tôt pour ne pas dépendre
    // du résultat du sync (early-return si 0 nouveau mail).
    await dedupeUserEmailsByNativeId(conn.user_id);
    const oauth2Client = getGoogleOAuth2Client();
    oauth2Client.setCredentials({
      access_token: conn.access_token,
      refresh_token: conn.refresh_token,
    });

    oauth2Client.on("tokens", async (tokens) => {
      const updates: Record<string, any> = {};
      if (tokens.access_token) updates.access_token = tokens.access_token;
      if (tokens.refresh_token) updates.refresh_token = tokens.refresh_token;
      if (tokens.expiry_date) updates.token_expires_at = new Date(tokens.expiry_date).toISOString();

      if (Object.keys(updates).length > 0) {
        const { error } = await supabaseAdmin
          .from("email_connections")
          .update(updates)
          .eq("id", conn.id);
        if (error) logger.error({ service: "gmail-sync", phase: "token-refresh", connId: conn.id, email: conn.email_address, err: sanitizeErrorMessage(error.message) }, "Gmail token update error");
      }
    });

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    // Email Brain Phase 3 (#216) — Premier sync : on remonte jusqu'à
    // 2000 mails de l'INBOX pour qu'Inboria connaisse l'historique du
    // contact dès la première utilisation. Les syncs suivants restent
    // courts (50 mails / 2 jours).
    const isFirstSync = !conn.last_synced_at;
    const FIRST_SYNC_TARGET = 2000;
    const FIRST_SYNC_PAGE = 100;

    const collectedMessages: Array<{ id?: string | null }> = [];
    if (isFirstSync) {
      let pageToken: string | undefined = undefined;
      while (collectedMessages.length < FIRST_SYNC_TARGET) {
        const { data: page }: { data: any } = await withTimeout(
          gmail.users.messages.list({
            userId: "me",
            maxResults: FIRST_SYNC_PAGE,
            q: "in:inbox",
            pageToken,
          }),
          20_000,
          "Gmail messages.list (first sync)",
        );
        const msgs = page.messages || [];
        for (const m of msgs) {
          if (collectedMessages.length >= FIRST_SYNC_TARGET) break;
          collectedMessages.push(m);
        }
        if (!page.nextPageToken || msgs.length === 0) break;
        pageToken = page.nextPageToken;
      }
      logger.info(
        { email: conn.email_address, fetched: collectedMessages.length },
        "[gmail-sync] first sync — bootstrapping history",
      );
    } else {
      const { data: messageList } = await withTimeout(
        gmail.users.messages.list({
          userId: "me",
          maxResults: 50,
          q: "is:inbox newer_than:2d",
        }),
        20_000,
        "Gmail messages.list",
      );
      for (const m of messageList.messages || []) collectedMessages.push(m);
    }

    if (collectedMessages.length === 0) {
      await markConnectionSuccess(conn.id);
      return 0;
    }

    let synced = 0;
    for (const msg of collectedMessages) {
      const { data: fullMsg } = await withTimeout(
        gmail.users.messages.get({ userId: "me", id: msg.id!, format: "full" }),
        20_000,
        "Gmail messages.get",
      );

      const headers = fullMsg.payload?.headers || [];
      const from = headers.find((h) => h.name === "From")?.value || "Inconnu";
      const subject = headers.find((h) => h.name === "Subject")?.value || "(pas de sujet)";
      const emailBody = extractGmailBody(fullMsg.payload) || fullMsg.snippet || "";

      const headerMap: Record<string, string> = {};
      for (const h of headers) {
        if (h?.name && h?.value) headerMap[h.name.toLowerCase()] = h.value;
      }

      const recipientHeader = headerMap["delivered-to"] || headerMap["to"] || conn.email_address;

      const scopedExternalId = `gmail:${msg.id!}`;
      const savedId = await saveEmailWithTriage(
        conn.user_id,
        scopedExternalId,
        from,
        subject,
        emailBody,
        new Date(parseInt(fullMsg.internalDate || "0")).toISOString(),
        (conn as any)._sharedMailboxId,
        headerMap,
        recipientHeader,
        {
          nativeMessageId: msg.id!,
          providerMessageId: headerMap["message-id"] || null,
        },
      );

      if (savedId) {
        synced++;
        const gmailAttachments = extractGmailAttachments(fullMsg.payload);
        if (gmailAttachments.length > 0) {
          await saveAttachmentsMeta(savedId, gmailAttachments, "gmail", conn.id, msg.id!);
        }
      }
    }

    await markConnectionSuccess(conn.id);
    await dedupeUserEmailsByNativeId(conn.user_id);

    try {
      const { data: allUserEmails } = await supabaseAdmin
        .from("emails")
        .select("id, body, external_id")
        .eq("user_id", conn.user_id)
        .not("status", "eq", "sent")
        .order("created_at", { ascending: false })
        .limit(50);

      const toBackfill = (allUserEmails || []).filter((e: any) => {
        const b = e.body || "";
        const extId = e.external_id || "";
        if (!extId.startsWith("gmail:") && !extId.startsWith(conn.id + ":")) return false;
        if (b.length < 30) return false;
        if (/<html/i.test(b) || /<div/i.test(b) || /<table/i.test(b)) return false;
        return true;
      });

      for (const email of toBackfill.slice(0, 15)) {
        const gmailMsgId = (email as any).external_id.split(":")[1];
        if (!gmailMsgId) continue;

        try {
          const { data: fullMsg } = await withTimeout(
            gmail.users.messages.get({ userId: "me", id: gmailMsgId, format: "full" }),
            20_000,
            "Gmail messages.get (body backfill)",
          );
          const htmlBody = extractGmailBody(fullMsg.payload) || "";
          if (htmlBody && /<[a-z][\s\S]*>/i.test(htmlBody) && htmlBody !== email.body) {
            await supabaseAdmin
              .from("emails")
              .update({ body: htmlBody })
              .eq("id", email.id);
            console.log(`[auto-sync] Backfilled HTML body for email #${email.id}`);
          }
        } catch (fetchErr: any) {
          console.error(`[auto-sync] Gmail body backfill error for #${email.id}:`, fetchErr.message);
        }
      }
    } catch (bfErr: any) {
      console.error("[auto-sync] Gmail body backfill error:", bfErr.message);
    }

    try {
      const { data: gmailEmails } = await supabaseAdmin
        .from("emails")
        .select("id, external_id")
        .eq("user_id", conn.user_id)
        .or(`external_id.like.gmail:%,external_id.like.${conn.id}:%`)
        .not("status", "eq", "sent")
        .order("created_at", { ascending: false })
        .limit(50);

      if (gmailEmails && gmailEmails.length > 0) {
        const emailIds = gmailEmails.map((e: any) => e.id);
        const { data: existingAttachments } = await supabaseAdmin
          .from("email_attachments")
          .select("email_id")
          .in("email_id", emailIds);

        const withAttachIds = new Set((existingAttachments || []).map((a: any) => a.email_id));
        const toCheck = gmailEmails.filter((e: any) => !withAttachIds.has(e.id));

        if (toCheck.length > 0) {
          console.log(`[auto-sync] Gmail attachment backfill: checking ${toCheck.length} emails`);
          for (const email of toCheck.slice(0, 15)) {
            const gmailMsgId = (email as any).external_id?.split(":")[1];
            if (!gmailMsgId || gmailMsgId.startsWith("imap_")) continue;

            try {
              const { data: fullMsg } = await withTimeout(
                gmail.users.messages.get({ userId: "me", id: gmailMsgId, format: "full" }),
                20_000,
                "Gmail messages.get (attachments backfill)",
              );
              const gmailAttachments = extractGmailAttachments(fullMsg.payload);
              if (gmailAttachments.length > 0) {
                await saveAttachmentsMeta(email.id, gmailAttachments, "gmail", conn.id, gmailMsgId);
                console.log(`[auto-sync] Backfilled ${gmailAttachments.length} attachment(s) for Gmail email #${email.id}`);
              }
            } catch (fetchErr: any) {
              console.error(`[auto-sync] Gmail attachment backfill error for #${email.id}:`, fetchErr.message);
            }
          }
        }
      }
    } catch (abfErr: any) {
      console.error("[auto-sync] Gmail attachment backfill error:", abfErr.message);
    }

    return synced;
  } catch (err: any) {
    logger.error({ service: "gmail-sync", connId: conn.id, email: conn.email_address, err: sanitizeErrorMessage(err.message) }, "Gmail sync error");
    await markConnectionFailure(conn.id, "gmail-api", err);
    return -1;
  }
}

async function syncOutlookForUser(conn: any): Promise<number> {
  try {
    await dedupeUserEmailsByNativeId(conn.user_id);
    let accessToken = conn.access_token;
    const MICROSOFT_CLIENT_ID = process.env["MICROSOFT_CLIENT_ID"] || "";
    const MICROSOFT_CLIENT_SECRET = process.env["MICROSOFT_CLIENT_SECRET"] || "";

    if (conn.token_expires_at && new Date(conn.token_expires_at) < new Date()) {
      if (!MICROSOFT_CLIENT_ID || !MICROSOFT_CLIENT_SECRET) {
        logger.error({ service: "outlook-sync", phase: "token-refresh", connId: conn.id, email: conn.email_address }, "Missing Microsoft credentials, cannot refresh token");
        await markConnectionFailure(conn.id, "token-refresh", new Error("Missing Microsoft credentials"));
        return -1;
      }
      const tokenResponse = await fetchWithTimeout(
        "https://login.microsoftonline.com/common/oauth2/v2.0/token",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: MICROSOFT_CLIENT_ID,
            client_secret: MICROSOFT_CLIENT_SECRET,
            refresh_token: conn.refresh_token,
            grant_type: "refresh_token",
            scope: "Mail.Read offline_access",
          }),
          timeoutMs: 20_000,
        }
      );

      if (!tokenResponse.ok) {
        const msg = `Outlook token refresh failed: ${tokenResponse.status} ${tokenResponse.statusText}`;
        logger.error({ service: "outlook-sync", phase: "token-refresh", connId: conn.id, email: conn.email_address, status: tokenResponse.status }, msg);
        await markConnectionFailure(conn.id, "token-refresh", new Error(msg));
        return -1;
      }

      const tokens = (await tokenResponse.json()) as any;
      if (!tokens.access_token) {
        logger.error({ service: "outlook-sync", phase: "token-refresh", connId: conn.id, email: conn.email_address }, "Outlook token refresh: no access_token in response");
        await markConnectionFailure(conn.id, "token-refresh", new Error("No access_token in refresh response"));
        return -1;
      }

      accessToken = tokens.access_token;
      const updates: Record<string, any> = {
        access_token: tokens.access_token,
        token_expires_at: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(),
      };
      if (tokens.refresh_token) updates.refresh_token = tokens.refresh_token;

      await supabaseAdmin
        .from("email_connections")
        .update(updates)
        .eq("id", conn.id);
    }

    // Email Brain Phase 3 (#216) — Premier sync : 2000 mails. Sinon
    // sync incrémental court (10 mails / 24h).
    const isFirstOutlookSync = !conn.last_synced_at;
    const FIRST_SYNC_TARGET = 2000;
    const PAGE_SIZE = isFirstOutlookSync ? 100 : 10;

    const baseSelect = "$select=id,internetMessageId,from,toRecipients,subject,bodyPreview,receivedDateTime";
    let graphUrl: string;
    if (isFirstOutlookSync) {
      graphUrl = `https://graph.microsoft.com/v1.0/me/messages?$top=${PAGE_SIZE}&$orderby=receivedDateTime desc&${baseSelect}`;
    } else {
      const filterDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      graphUrl = `https://graph.microsoft.com/v1.0/me/messages?$top=${PAGE_SIZE}&$orderby=receivedDateTime desc&${baseSelect}&$filter=receivedDateTime ge ${filterDate}`;
    }

    const collected: any[] = [];
    let nextUrl: string | null = graphUrl;
    while (nextUrl && collected.length < (isFirstOutlookSync ? FIRST_SYNC_TARGET : PAGE_SIZE)) {
      const response: any = await fetchWithTimeout(nextUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeoutMs: 20_000,
      });
      if (!response.ok) {
        const msg = `Outlook Graph API error: ${response.status} ${response.statusText}`;
        logger.error({ service: "outlook-sync", phase: "graph-api", connId: conn.id, email: conn.email_address, status: response.status }, msg);
        await markConnectionFailure(conn.id, "graph-api", new Error(msg));
        return -1;
      }
      const page = (await response.json()) as any;
      const items: any[] = page.value || [];
      for (const m of items) {
        if (collected.length >= (isFirstOutlookSync ? FIRST_SYNC_TARGET : PAGE_SIZE)) break;
        collected.push(m);
      }
      nextUrl = isFirstOutlookSync ? (page["@odata.nextLink"] || null) : null;
      if (items.length === 0) break;
    }

    if (isFirstOutlookSync) {
      logger.info(
        { service: "outlook-sync", email: conn.email_address, fetched: collected.length },
        "[outlook-sync] first sync — bootstrapping history",
      );
    }

    if (collected.length === 0) {
      await markConnectionSuccess(conn.id);
      return 0;
    }

    let synced = 0;
    for (const msg of collected) {
      const senderEmail = msg.from?.emailAddress?.address || "Inconnu";
      const senderName = msg.from?.emailAddress?.name || senderEmail;

      const toRecipients: any[] = Array.isArray(msg.toRecipients) ? msg.toRecipients : [];
      const recipientHeader = toRecipients
        .map((r) => r?.emailAddress?.address)
        .filter((x: any) => !!x)
        .join(", ") || conn.email_address;

      const scopedExternalId = `outlook:${msg.id}`;
      const savedId = await saveEmailWithTriage(
        conn.user_id,
        scopedExternalId,
        `${senderName} <${senderEmail}>`,
        msg.subject || "(pas de sujet)",
        msg.bodyPreview || "",
        msg.receivedDateTime,
        (conn as any)._sharedMailboxId,
        undefined,
        recipientHeader,
        { providerMessageId: msg.internetMessageId || null, nativeMessageId: msg.id || null },
      );

      if (savedId) synced++;
    }

    try {
      const junkSaved = await syncOutlookJunk(
        conn,
        accessToken,
        (conn as any)._sharedMailboxId || null,
        (payload: JunkEmailPayload, userId, sharedMailboxId) =>
          saveEmailWithTriage(
            userId,
            payload.externalId,
            payload.sender,
            payload.subject,
            payload.body,
            payload.createdAt,
            sharedMailboxId,
            payload.headers,
            payload.recipient,
            { forceSpam: true, providerMessageId: payload.providerMessageId },
          ),
      );
      if (junkSaved > 0) {
        console.log(`[auto-sync] Outlook junk: ${junkSaved} new spam(s) for ${conn.email_address}`);
      }
    } catch (junkErr: any) {
      logger.error({ service: "outlook-sync", phase: "junk", connId: conn.id, email: conn.email_address, err: sanitizeErrorMessage(junkErr.message) }, "Outlook junk error");
    }

    await markConnectionSuccess(conn.id);
    await dedupeUserEmailsByNativeId(conn.user_id);
    return synced;
  } catch (err: any) {
    logger.error({ service: "outlook-sync", connId: conn.id, email: conn.email_address, err: sanitizeErrorMessage(err.message) }, "Outlook sync error");
    await markConnectionFailure(conn.id, "graph-api", err);
    return -1;
  }
}

async function syncImapForUser(conn: any): Promise<number> {
  const log = logger.child({ service: "imap-sync", email: conn.email_address, connId: conn.id });
  await dedupeUserEmailsByNativeId(conn.user_id);

  let imapConfig: { host: string; port: number } = { host: "imap.gmail.com", port: 993 };
  try {
    if (conn.refresh_token) imapConfig = JSON.parse(conn.refresh_token);
  } catch (parseErr: any) {
    log.error(`IMAP config parse failed: ${parseErr.message}`);
    await markConnectionFailure(conn.id, "config", parseErr);
    return -1;
  }

  log.info({ host: imapConfig.host, port: imapConfig.port }, "Starting IMAP sync");

  if (!isValidImapHost(imapConfig.host)) {
    log.error({ host: imapConfig.host }, "IMAP blocked: invalid host");
    await markConnectionFailure(conn.id, "config", new Error(`Invalid IMAP host: ${imapConfig.host}`));
    return -1;
  }

  const port = Number(imapConfig.port);
  if (!port || port < 1 || port > 65535) {
    log.error({ port: imapConfig.port }, "IMAP blocked: invalid port");
    await markConnectionFailure(conn.id, "config", new Error(`Invalid IMAP port: ${imapConfig.port}`));
    return -1;
  }

  const client = new ImapFlow({
    host: imapConfig.host,
    port,
    secure: true,
    auth: { user: conn.email_address, pass: conn.access_token },
    logger: false,
  });
  client.on("error", (err: any) => {
    log.warn({ err: err?.message || err }, "ImapFlow error event suppressed");
  });

  try {
    let timeoutId: ReturnType<typeof setTimeout>;
    await Promise.race([
      client.connect(),
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error("IMAP connect timeout after 20s")), 20_000);
      }),
    ]);
    clearTimeout(timeoutId!);
    log.info("IMAP connected successfully");
  } catch (connErr: any) {
    log.error({ error: connErr.message }, "IMAP connection failed");
    try { await withTimeout(client.logout(), 5_000, "IMAP logout"); } catch {}
    await markConnectionFailure(conn.id, "connect", connErr);
    return -1;
  }

  let lock: MailboxLockObject;
  try {
    lock = await withTimeout(client.getMailboxLock("INBOX"), 10_000, "INBOX lock");
    log.info("INBOX lock acquired");
  } catch (lockErr: any) {
    log.error({ error: lockErr.message }, "Failed to lock INBOX");
    try { await withTimeout(client.logout(), 5_000, "IMAP logout"); } catch {}
    await markConnectionFailure(conn.id, "lock", lockErr);
    return -1;
  }

  let synced = 0;
  let fetchSucceeded = false;
  try {
    const mailboxStatus = client.mailbox;
    const totalMessages = mailboxStatus ? mailboxStatus.exists : 0;
    log.info({ totalMessages }, "Mailbox status");

    if (totalMessages === 0) {
      log.info("Mailbox empty, skipping INBOX fetch (junk sync will still run)");
      fetchSucceeded = true;
    }

    // Email Brain Phase 3 (#216) — Premier sync : remonter jusqu'à 2000
    // mails de l'INBOX pour bootstrap historique. Sinon on garde la
    // logique courte des 10 derniers (sync incrémental rapide).
    const isFirstImapSync = !conn.last_synced_at;
    const FIRST_SYNC_DEPTH = 2000;
    const startSeq = Math.max(
      1,
      totalMessages - (isFirstImapSync ? FIRST_SYNC_DEPTH - 1 : 9),
    );
    if (isFirstImapSync) {
      log.info(
        { startSeq, totalMessages, depth: totalMessages - startSeq + 1 },
        "[imap-sync] first sync — bootstrapping history",
      );
    }
    const range = `${startSeq}:*`;
    let fetchedCount = 0;
    const INBOX_FETCH_STEP_TIMEOUT_MS = 30_000;

    const inboxIterator = (totalMessages === 0
      ? ([] as any[])[Symbol.iterator]() as any
      : client.fetch(range, { envelope: true, uid: true, source: true })[Symbol.asyncIterator]());

    while (true) {
      const step = await withTimeout(
        Promise.resolve(inboxIterator.next()),
        INBOX_FETCH_STEP_TIMEOUT_MS,
        "INBOX fetch step",
      );
      if (step.done) break;
      const msg: any = step.value;
      fetchedCount++;
      const externalId = `imap:${conn.email_address}:${msg.uid}`;
      const envelope = msg.envelope!;
      const from = envelope?.from?.[0];
      const sender = from?.name ? `${from.name} <${from.address}>` : from?.address || "inconnu";

      let bodyText = "";
      let imapHeaders: Record<string, string> = {};
      if (msg.source) {
        try {
          const parsed = await simpleParser(msg.source);
          bodyText = parsed.html
            ? (typeof parsed.html === "string" ? parsed.html : "")
            : parsed.text || "";
          if (bodyText.length > IMAP_BODY_MAX_BYTES) {
            log.warn({ uid: msg.uid, originalLength: bodyText.length, limit: IMAP_BODY_MAX_BYTES }, "IMAP body truncated");
            bodyText = bodyText.slice(0, IMAP_BODY_MAX_BYTES);
          }
          if (parsed.headers && typeof (parsed.headers as any).forEach === "function") {
            (parsed.headers as Map<string, any>).forEach((value, key) => {
              if (value === undefined || value === null) return;
              imapHeaders[key.toLowerCase()] = String(typeof value === "object" ? JSON.stringify(value) : value);
            });
          }
        } catch (parseErr: any) {
          log.warn({ uid: msg.uid, error: parseErr.message }, "simpleParser failed, using raw fallback");
          try {
            const raw = msg.source.toString("utf-8");
            const bodyStart = raw.indexOf("\r\n\r\n");
            if (bodyStart !== -1) {
              bodyText = raw.slice(bodyStart + 4).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, IMAP_BODY_MAX_BYTES);
            }
          } catch (rawErr: any) {
            log.warn({ uid: msg.uid, error: rawErr.message }, "Raw body extraction also failed");
          }
        }
      }

      let imapAttachments: AttachmentMeta[] = [];
      if (msg.source) {
        try {
          const parsedForAttach = await simpleParser(msg.source);
          if (parsedForAttach.attachments && parsedForAttach.attachments.length > 0) {
            imapAttachments = parsedForAttach.attachments.map((a) => ({
              filename: a.filename || "attachment",
              contentType: a.contentType || "application/octet-stream",
              size: a.size || 0,
              providerAttachmentId: a.contentId || a.checksum || "",
            }));
            log.info({ uid: msg.uid, attachmentCount: imapAttachments.length }, "Attachments detected");
          }
        } catch (attachErr: any) {
          log.warn({ uid: msg.uid, error: attachErr.message }, "Attachment parsing failed");
        }
      }

      const toList: any[] = Array.isArray(envelope?.to) ? envelope.to : [];
      const recipientHeader = toList
        .map((r) => r?.address)
        .filter((x: any) => !!x)
        .join(", ") || imapHeaders["delivered-to"] || imapHeaders["to"] || conn.email_address;

      const providerMessageId = envelope?.messageId || imapHeaders["message-id"] || null;
      const savedId = await saveEmailWithTriage(
        conn.user_id,
        externalId,
        sender,
        envelope?.subject || "(pas de sujet)",
        bodyText,
        envelope?.date ? new Date(envelope.date).toISOString() : new Date().toISOString(),
        (conn as any)._sharedMailboxId,
        imapHeaders,
        recipientHeader,
        { providerMessageId, nativeMessageId: String(msg.uid) },
      );

      if (savedId) {
        synced++;
        if (imapAttachments.length > 0) {
          await saveAttachmentsMeta(savedId, imapAttachments, "imap", conn.id, String(msg.uid));
        }
      }
    }

    fetchSucceeded = true;
    log.info({ fetched: fetchedCount, newEmails: synced, duplicatesSkipped: fetchedCount - synced }, "IMAP fetch complete");

    try {
      const PAGE = 500;
      const MAX_PAGES = 6;
      const BACKFILL_BATCH = 300;
      const truncated: Array<{ id: number; external_id: string; body: string }> = [];

      for (let page = 0; page < MAX_PAGES && truncated.length < BACKFILL_BATCH; page++) {
        const from = page * PAGE;
        const to = from + PAGE - 1;
        const { data: candidateBodies } = await supabaseAdmin
          .from("emails")
          .select("id, external_id, body")
          .eq("user_id", conn.user_id)
          .like("external_id", `imap:${conn.email_address}:%`)
          .order("created_at", { ascending: false })
          .range(from, to);

        if (!candidateBodies || candidateBodies.length === 0) break;

        for (const e of candidateBodies) {
          const len = ((e as any).body || "").length;
          if (len === 10000 || len === 5000) {
            truncated.push(e as any);
            if (truncated.length >= BACKFILL_BATCH) break;
          }
        }

        if (candidateBodies.length < PAGE) break;
      }

      if (truncated.length > 0) {
        log.info({ count: truncated.length }, "Backfill: re-fetching truncated bodies");
        for (const email of truncated) {
          const parts = (email.external_id || "").split(":");
          const uid = parseInt(parts[parts.length - 1], 10);
          if (!uid) continue;
          try {
            const bfMsg = await client.fetchOne(String(uid), { source: true }, { uid: true }) as any;
            if (!bfMsg?.source) continue;
            const parsed = await simpleParser(bfMsg.source);
            let bodyText = parsed.html
              ? (typeof parsed.html === "string" ? parsed.html : "")
              : parsed.text || "";
            if (bodyText.length > IMAP_BODY_MAX_BYTES) {
              bodyText = bodyText.slice(0, IMAP_BODY_MAX_BYTES);
            }
            if (bodyText && bodyText.length > (email.body || "").length) {
              await supabaseAdmin
                .from("emails")
                .update({ body: bodyText })
                .eq("id", email.id);
              log.info({ emailId: email.id, oldLength: (email.body || "").length, newLength: bodyText.length }, "Backfilled IMAP body");
            }
          } catch (bfErr: any) {
            log.warn({ emailId: email.id, error: bfErr.message }, "Body backfill failed");
          }
        }
      }
    } catch (bfErr: any) {
      log.warn({ error: bfErr.message }, "IMAP body backfill error");
    }

    try {
      const { data: emailsWithoutAttachments } = await supabaseAdmin
        .from("emails")
        .select("id, external_id")
        .eq("user_id", conn.user_id)
        .or(`external_id.like.imap:${conn.email_address}:%,external_id.like.${conn.id}:imap_%`)
        .not("status", "eq", "sent")
        .order("created_at", { ascending: false })
        .limit(50);

      if (emailsWithoutAttachments && emailsWithoutAttachments.length > 0) {
        const emailIds = emailsWithoutAttachments.map((e: any) => e.id);
        const { data: existingAttachments } = await supabaseAdmin
          .from("email_attachments")
          .select("email_id")
          .in("email_id", emailIds);

        const emailsWithAttachmentIds = new Set((existingAttachments || []).map((a: any) => a.email_id));
        const emailsToCheck = emailsWithoutAttachments.filter((e: any) => !emailsWithAttachmentIds.has(e.id));

        if (emailsToCheck.length > 0) {
          log.info({ count: emailsToCheck.length }, "Backfill: checking emails for missing attachments");

          for (const email of emailsToCheck.slice(0, 10)) {
            const uidStr = (email as any).external_id?.split("imap_")[1];
            const uid = parseInt(uidStr || "0", 10);
            if (!uid) continue;

            try {
              const bfMsg = await client.fetchOne(String(uid), { source: true }, { uid: true }) as any;
              if (!bfMsg?.source) continue;

              const parsed = await simpleParser(bfMsg.source);
              if (parsed.attachments && parsed.attachments.length > 0) {
                const attachMeta: AttachmentMeta[] = parsed.attachments.map((a) => ({
                  filename: a.filename || "attachment",
                  contentType: a.contentType || "application/octet-stream",
                  size: a.size || 0,
                  providerAttachmentId: a.contentId || a.checksum || "",
                }));
                await saveAttachmentsMeta(email.id, attachMeta, "imap", conn.id, String(uid));
                log.info({ emailId: email.id, attachmentCount: attachMeta.length }, "Backfilled attachments");
              }
            } catch (bfErr: any) {
              log.warn({ emailId: email.id, error: bfErr.message }, "Attachment backfill failed for email");
            }
          }
        }
      }
    } catch (bfErr: any) {
      log.warn({ error: bfErr.message }, "IMAP attachment backfill error");
    }
  } catch (fetchErr: any) {
    log.error({ error: fetchErr.message }, "Error during IMAP fetch/parse");
  } finally {
    try { lock.release(); } catch {}
  }

  try {
    const junkSaved = await syncImapJunk(
      conn,
      client,
      (conn as any)._sharedMailboxId || null,
      (payload: JunkEmailPayload, userId, sharedMailboxId) =>
        saveEmailWithTriage(
          userId,
          payload.externalId,
          payload.sender,
          payload.subject,
          payload.body,
          payload.createdAt,
          sharedMailboxId,
          payload.headers,
          payload.recipient,
          { forceSpam: true, providerMessageId: payload.providerMessageId },
        ),
    );
    if (junkSaved > 0) {
      log.info({ saved: junkSaved }, "IMAP junk sync complete");
    }
  } catch (junkErr: any) {
    log.warn({ err: junkErr.message }, "IMAP junk sync error");
  }

  try {
    await withTimeout(client.logout(), 5_000, "IMAP logout");
  } catch {}

  if (fetchSucceeded) {
    await markConnectionSuccess(conn.id);
    await dedupeUserEmailsByNativeId(conn.user_id);
    return synced;
  }

  await markConnectionFailure(conn.id, "fetch", new Error("IMAP fetch did not complete"));
  return -1;
}

export type AutoSyncDispatcher = (conn: any) => Promise<number>;

const defaultDispatcher: AutoSyncDispatcher = async (conn) => {
  if (conn.provider === "gmail") return syncGmailForUser(conn);
  if (conn.provider === "outlook") return syncOutlookForUser(conn);
  if (conn.provider === "imap") return syncImapForUser(conn);
  return 0;
};

export async function runAutoSync(overrides?: {
  connections?: any[];
  dispatcher?: AutoSyncDispatcher;
  skipBackfill?: boolean;
}) {
  const cycleLog = logger.child({ service: "auto-sync" });

  if (syncRunning) {
    cycleLog.info("Sync already in progress, skipping");
    return;
  }

  syncRunning = true;
  const startTime = Date.now();

  try {
    let connections: any[] | null = overrides?.connections ?? null;

    if (!connections) {
      const { data, error: connErr } = await supabaseAdmin
        .from("email_connections")
        .select("*");

      if (connErr) {
        cycleLog.error({ err: connErr.message }, "Failed to fetch connections");
        return;
      }
      connections = data;
    }

    if (!connections || connections.length === 0) {
      return;
    }

    cycleLog.info({ count: connections.length }, "Starting sync cycle");

    const connToSharedMailbox: Record<string, string> = {};
    if (!overrides?.skipBackfill) {
      const { data: sharedMailboxes } = await supabaseAdmin
        .from("shared_mailboxes")
        .select("id, connection_id");
      if (sharedMailboxes) {
        for (const sm of sharedMailboxes) {
          if (sm.connection_id) {
            connToSharedMailbox[sm.connection_id] = sm.id;
          }
        }
      }
    }

    for (const connId of Object.keys(connToSharedMailbox)) {
      const sharedMbId = connToSharedMailbox[connId];
      const { data: backfilledRows, error: bfError } = await supabaseAdmin
        .from("emails")
        .update({ shared_mailbox_id: sharedMbId })
        .like("external_id", `${connId}:%`)
        .is("shared_mailbox_id", null)
        .select("id");
      if (bfError) {
        cycleLog.error({ connId, err: bfError.message }, "Shared mailbox backfill error");
      } else if (backfilledRows && backfilledRows.length > 0) {
        cycleLog.info({ connId, sharedMbId, count: backfilledRows.length }, "Shared mailbox backfilled");
      }
    }

    for (const c of connections) {
      (c as any)._sharedMailboxId = connToSharedMailbox[c.id] || null;
    }

    const dispatcher = overrides?.dispatcher ?? defaultDispatcher;
    const loopResult = await runSyncLoop(connections, dispatcher);

    for (const r of loopResult.perConnection) {
      if (r.synced < 0) {
        cycleLog.error({ connId: r.id, email: r.email }, "Connection sync failed");
      } else {
        cycleLog.info({ connId: r.id, email: r.email, synced: r.synced }, "Connection sync done");
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    cycleLog.info(
      { totalSynced: loopResult.totalSynced, failures: loopResult.failureCount, elapsedSeconds: elapsed },
      "Auto-sync cycle done",
    );

    // Détection des relances IA après que les nouveaux mails ont été ingérés
    try {
      await runFollowupDetectionForAllUsers();
    } catch (err: any) {
      cycleLog.warn({ err: err?.message }, "Follow-up detection cycle failed (non-fatal)");
    }
  } catch (err: any) {
    cycleLog.error({ err: err.message }, "Auto-sync fatal error");
  } finally {
    syncRunning = false;
  }
}

export async function triggerSyncForConnection(connectionId: string): Promise<{ synced: number; success: boolean; error?: string }> {
  const { data: conn, error } = await supabaseAdmin
    .from("email_connections")
    .select("*")
    .eq("id", connectionId)
    .single();

  if (error || !conn) {
    logger.error({ connectionId }, "triggerSync: connection not found");
    return { synced: 0, success: false, error: "Connection not found" };
  }

  const { data: sharedMb } = await supabaseAdmin
    .from("shared_mailboxes")
    .select("id")
    .eq("connection_id", connectionId)
    .maybeSingle();
  (conn as any)._sharedMailboxId = sharedMb?.id || null;

  logger.info({ email: conn.email_address, provider: conn.provider }, "Immediate sync triggered");

  let synced = 0;
  try {
    if (conn.provider === "gmail") {
      synced = await syncGmailForUser(conn);
    } else if (conn.provider === "outlook") {
      synced = await syncOutlookForUser(conn);
    } else if (conn.provider === "imap") {
      synced = await syncImapForUser(conn);
    }
  } catch (err: any) {
    logger.error({ email: conn.email_address, error: err.message }, "Immediate sync failed");
    return { synced: 0, success: false, error: err.message };
  }

  if (synced < 0) {
    logger.error({ email: conn.email_address }, "Immediate sync returned error status");
    return { synced: 0, success: false, error: "IMAP connection or mailbox lock failed" };
  }

  logger.info({ email: conn.email_address, synced }, "Immediate sync done");
  return { synced, success: true };
}

export function startAutoSync() {
  console.log(`[auto-sync] Started — checking every ${SYNC_INTERVAL_MS / 1000}s`);

  setTimeout(() => {
    runAutoSync();
  }, 10_000);

  setInterval(() => {
    runAutoSync();
  }, SYNC_INTERVAL_MS);
}
