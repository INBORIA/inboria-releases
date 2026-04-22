import { google } from "googleapis";
import { ImapFlow, type MailboxLockObject } from "imapflow";
import OpenAI from "openai";
import { simpleParser } from "mailparser";
import { supabaseAdmin } from "../lib/supabase";
import { logger } from "../lib/logger";
import * as net from "net";
import { sendSlackNotification, createNotionTask } from "./integrations";
import { preClassifyEmail, recordAIClassification, bumpMetrics } from "./pre-filter";
import { consumeAiCredits, logTriageEvent, checkEntitlement } from "./credits";
import { getEmailOAuthRedirectUri } from "../lib/urls";

interface AttachmentMeta {
  filename: string;
  contentType: string;
  size: number;
  providerAttachmentId: string;
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

function extractGmailBody(payload: any): string {
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
Réponds en JSON strict:
{ "hasAppointment": false }
OU
{ "hasAppointment": true, "title": "...", "description": "...", "location": "...", "startAt": "ISO datetime", "endAt": "ISO datetime", "allDay": false, "participants": "..." }
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
          content: `Email:\nDe: ${sender}\nSujet: ${subject}\nCorps: ${(body || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 800)}\n\nCategories existantes: ${categoryNames.join(", ") || "Aucune"}${projectsContext}${rulesContext}\n\nReponds en JSON:\n{"priority":"urgent|moyen|faible","summary":"resume 1 phrase","category":"nom de categorie existante OU propose un nouveau nom pertinent (court, professionnel). Utilise 'Non classe' uniquement si vraiment inclassable.","project":"nom exact d'un projet actif OU 'Aucun'","tasks":["tache 1","tache 2"],"is_spam":false}\n\nIMPORTANT pour is_spam: TRES CONSERVATEUR. Mets true UNIQUEMENT pour arnaques evidentes (loterie, heritage, 'vous avez gagne', sextorsion, faux remboursement fiscal). Les emails de verification, codes OTP, alertes de securite, notifications de service, newsletters, marketing legitime, emails commerciaux NE SONT PAS du spam. En cas de doute, false.\n\nIMPORTANT pour project: ne renvoie un nom de projet QUE si l'email le mentionne explicitement (nom, reference) OU si le contenu est clairement lie au projet. En cas de doute, mets "Aucun". Ne jamais inventer un nom de projet qui ne figure pas dans la liste ci-dessus.\n\nIMPORTANT pour les taches: Sois TRES SELECTIF. Ne genere des taches QUE quand une action humaine CONCRETE et IMPORTANTE est requise (repondre a un client, payer une facture, signer un document, confirmer un rendez-vous). JAMAIS de tache pour: newsletters, notifications automatiques, confirmations d'inscription, codes de verification, emails marketing, reseaux sociaux, alertes de securite, confirmations de commande, recus, emails informatifs. Si aucune action importante n'est requise, retourne "tasks":[] (tableau vide). Maximum 1 tache par email.`,
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

async function saveEmailWithTriage(
  userId: string,
  externalId: string,
  sender: string,
  subject: string,
  body: string,
  createdAt: string,
  sharedMailboxId?: string | null,
  headers?: Record<string, string | string[] | undefined>
): Promise<number | null> {
  const { data: existing } = await supabaseAdmin
    .from("emails")
    .select("id")
    .eq("user_id", userId)
    .eq("external_id", externalId)
    .maybeSingle();

  if (existing) return null;

  const { data: profile, error: profileErr } = await supabaseAdmin
    .from("profiles")
    .select("emails_used, emails_quota")
    .eq("id", userId)
    .single();

  if (profileErr || !profile) {
    console.error("[auto-sync] Profile fetch error:", profileErr?.message);
    return null;
  }

  // Unified quota check: counts emails_used + ai_credits_used against quota
  // (same logic as /api/ai/* routes). Prevents overage via combined usage.
  const ent = await checkEntitlement(userId, 1);
  if (ent.blocked) {
    return null;
  }

  // Pre-filtre deterministe : evite l'appel IA sur les mails evidents (newsletters, notifs auto, expediteurs en cache)
  const pre = await preClassifyEmail({ userId, sender, subject, headers });
  let triage: { priority: string; summary: string; category: string; tasks: string[]; is_spam: boolean };

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
    status: triage.is_spam ? "spam" : "non_lu",
    priority: triage.priority,
    summary: stripNul(triage.summary),
    category_id: categoryId,
    project_id: projectId,
    created_at: createdAt,
  };
  if (sharedMailboxId) {
    insertPayload.shared_mailbox_id = sharedMailboxId;
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

  if (triage.priority === "urgent") {
    sendSlackNotification(userId, sender, subject, triage.summary).catch(() => {});
  }

  // Log triage event for audit trail and accurate billing recount
  if (!pre.hit) {
    logTriageEvent(userId, { source: "auto-sync", externalId, sender }).catch(() => {});
  }

  // Skip appointment detection pour les hits pre-filtre evidents (newsletters, notifications)
  // -> ces mails ne contiennent jamais de RDV, evite un appel OpenAI inutile
  if (!pre.hit) {
    detectAppointmentFromEmail(inserted.id, sender, subject, body, userId).catch(() => {});
  }

  if (triage.tasks.length > 0 && !isNoiseEmail(sender, subject)) {
    const { data: existingTasks } = await supabaseAdmin
      .from("tasks")
      .select("id")
      .eq("email_id", inserted.id)
      .limit(1);

    if (!existingTasks || existingTasks.length === 0) {
      const tasksToInsert: { user_id: string; email_id: number; title: string; done: boolean }[] = [];
      for (const title of triage.tasks) {
        const dup = await userHasOpenTaskWithTitle(userId, title);
        if (dup) {
          console.log(`[auto-sync] skip duplicate task title for user ${userId}: "${title}"`);
          continue;
        }
        tasksToInsert.push({ user_id: userId, email_id: inserted.id, title, done: false });
      }

      if (tasksToInsert.length > 0) {
        const { error: taskErr } = await supabaseAdmin.from("tasks").insert(tasksToInsert);
        if (taskErr) {
          console.error("[auto-sync] task insert error:", taskErr.message);
        }

        for (const t of tasksToInsert) {
          createNotionTask(userId, t.title, subject, sender).catch(() => {});
        }
      }
    } else {
      console.log(`[auto-sync] tasks already exist for email ${inserted.id}, skipping`);
    }
  } else if (triage.tasks.length > 0) {
    console.log(`[auto-sync] noise email detected (${sender} | ${subject.slice(0, 60)}), skipping ${triage.tasks.length} task(s)`);
  }

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
      const resp = await fetch(`${supabaseUrl}/rest/v1/email_attachments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": supabaseKey!,
          "Authorization": `Bearer ${supabaseKey}`,
          "Prefer": "return=minimal",
        },
        body: JSON.stringify(rows),
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
        if (error) console.error("[auto-sync] Gmail token update error:", error.message);
      }
    });

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    const { data: messageList } = await gmail.users.messages.list({
      userId: "me",
      maxResults: 50,
      q: "is:inbox newer_than:2d",
    });

    if (!messageList.messages) return 0;

    let synced = 0;
    for (const msg of messageList.messages) {
      const { data: fullMsg } = await gmail.users.messages.get({
        userId: "me",
        id: msg.id!,
        format: "full",
      });

      const headers = fullMsg.payload?.headers || [];
      const from = headers.find((h) => h.name === "From")?.value || "Inconnu";
      const subject = headers.find((h) => h.name === "Subject")?.value || "(pas de sujet)";
      const emailBody = extractGmailBody(fullMsg.payload) || fullMsg.snippet || "";

      const headerMap: Record<string, string> = {};
      for (const h of headers) {
        if (h?.name && h?.value) headerMap[h.name.toLowerCase()] = h.value;
      }

      const scopedExternalId = `gmail:${msg.id!}`;
      const savedId = await saveEmailWithTriage(
        conn.user_id,
        scopedExternalId,
        from,
        subject,
        emailBody,
        new Date(parseInt(fullMsg.internalDate || "0")).toISOString(),
        (conn as any)._sharedMailboxId,
        headerMap
      );

      if (savedId) {
        synced++;
        const gmailAttachments = extractGmailAttachments(fullMsg.payload);
        if (gmailAttachments.length > 0) {
          await saveAttachmentsMeta(savedId, gmailAttachments, "gmail", conn.id, msg.id!);
        }
      }
    }

    if (synced > 0) {
      await supabaseAdmin
        .from("email_connections")
        .update({ last_synced_at: new Date().toISOString() })
        .eq("id", conn.id);
    }

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
          const { data: fullMsg } = await gmail.users.messages.get({
            userId: "me",
            id: gmailMsgId,
            format: "full",
          });
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
              const { data: fullMsg } = await gmail.users.messages.get({
                userId: "me",
                id: gmailMsgId,
                format: "full",
              });
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
    console.error(`[auto-sync] Gmail error for ${conn.email_address}:`, err.message);
    return 0;
  }
}

async function syncOutlookForUser(conn: any): Promise<number> {
  try {
    let accessToken = conn.access_token;
    const MICROSOFT_CLIENT_ID = process.env["MICROSOFT_CLIENT_ID"] || "";
    const MICROSOFT_CLIENT_SECRET = process.env["MICROSOFT_CLIENT_SECRET"] || "";

    if (conn.token_expires_at && new Date(conn.token_expires_at) < new Date()) {
      if (!MICROSOFT_CLIENT_ID || !MICROSOFT_CLIENT_SECRET) {
        console.error("[auto-sync] Outlook: missing Microsoft credentials, cannot refresh token");
        return 0;
      }
      const tokenResponse = await fetch(
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
        }
      );

      if (!tokenResponse.ok) {
        console.error(`[auto-sync] Outlook token refresh failed: ${tokenResponse.status} ${tokenResponse.statusText}`);
        return 0;
      }

      const tokens = (await tokenResponse.json()) as any;
      if (!tokens.access_token) {
        console.error("[auto-sync] Outlook token refresh: no access_token in response");
        return 0;
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

    const filterDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const graphUrl = `https://graph.microsoft.com/v1.0/me/messages?$top=10&$orderby=receivedDateTime desc&$select=id,from,subject,bodyPreview,receivedDateTime&$filter=receivedDateTime ge ${filterDate}`;

    const response = await fetch(graphUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      console.error(`[auto-sync] Outlook Graph API error: ${response.status} ${response.statusText}`);
      return 0;
    }

    const data = (await response.json()) as any;
    if (!data.value) return 0;

    let synced = 0;
    for (const msg of data.value) {
      const senderEmail = msg.from?.emailAddress?.address || "Inconnu";
      const senderName = msg.from?.emailAddress?.name || senderEmail;

      const scopedExternalId = `outlook:${msg.id}`;
      const savedId = await saveEmailWithTriage(
        conn.user_id,
        scopedExternalId,
        `${senderName} <${senderEmail}>`,
        msg.subject || "(pas de sujet)",
        msg.bodyPreview || "",
        msg.receivedDateTime,
        (conn as any)._sharedMailboxId
      );

      if (savedId) synced++;
    }

    if (synced > 0) {
      await supabaseAdmin
        .from("email_connections")
        .update({ last_synced_at: new Date().toISOString() })
        .eq("id", conn.id);
    }

    return synced;
  } catch (err: any) {
    console.error(`[auto-sync] Outlook error for ${conn.email_address}:`, err.message);
    return 0;
  }
}

async function syncImapForUser(conn: any): Promise<number> {
  const log = logger.child({ service: "imap-sync", email: conn.email_address, connId: conn.id });

  let imapConfig: { host: string; port: number } = { host: "imap.gmail.com", port: 993 };
  try {
    if (conn.refresh_token) imapConfig = JSON.parse(conn.refresh_token);
  } catch (parseErr: any) {
    log.error(`IMAP config parse failed: ${parseErr.message}`);
    return -1;
  }

  log.info({ host: imapConfig.host, port: imapConfig.port }, "Starting IMAP sync");

  if (!isValidImapHost(imapConfig.host)) {
    log.error({ host: imapConfig.host }, "IMAP blocked: invalid host");
    return -1;
  }

  const port = Number(imapConfig.port);
  if (!port || port < 1 || port > 65535) {
    log.error({ port: imapConfig.port }, "IMAP blocked: invalid port");
    return -1;
  }

  const client = new ImapFlow({
    host: imapConfig.host,
    port,
    secure: true,
    auth: { user: conn.email_address, pass: conn.access_token },
    logger: false,
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
    try { await client.logout(); } catch {}
    return -1;
  }

  let lock: MailboxLockObject;
  try {
    lock = await client.getMailboxLock("INBOX");
    log.info("INBOX lock acquired");
  } catch (lockErr: any) {
    log.error({ error: lockErr.message }, "Failed to lock INBOX");
    try { await client.logout(); } catch {}
    return -1;
  }

  let synced = 0;
  let fetchSucceeded = false;
  let lockReleased = false;
  try {
    const mailboxStatus = client.mailbox;
    const totalMessages = mailboxStatus ? mailboxStatus.exists : 0;
    log.info({ totalMessages }, "Mailbox status");

    if (totalMessages === 0) {
      log.info("Mailbox empty, nothing to fetch");
      fetchSucceeded = true;
      lock.release();
      lockReleased = true;
      await client.logout();
      await supabaseAdmin
        .from("email_connections")
        .update({ last_synced_at: new Date().toISOString() })
        .eq("id", conn.id);
      return 0;
    }

    const startSeq = Math.max(1, totalMessages - 9);
    const range = `${startSeq}:*`;
    let fetchedCount = 0;

    for await (const msg of client.fetch(range, { envelope: true, uid: true, source: true })) {
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
          bodyText = bodyText.slice(0, 10000);
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
              bodyText = raw.slice(bodyStart + 4).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 5000);
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

      const savedId = await saveEmailWithTriage(
        conn.user_id,
        externalId,
        sender,
        envelope?.subject || "(pas de sujet)",
        bodyText,
        envelope?.date ? new Date(envelope.date).toISOString() : new Date().toISOString(),
        (conn as any)._sharedMailboxId,
        imapHeaders
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
    if (!lockReleased) lock.release();
  }

  try {
    await client.logout();
  } catch {}

  if (fetchSucceeded) {
    await supabaseAdmin
      .from("email_connections")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("id", conn.id);
  }

  return fetchSucceeded ? synced : -1;
}

async function runAutoSync() {
  if (syncRunning) {
    console.log("[auto-sync] Sync already in progress, skipping");
    return;
  }

  syncRunning = true;
  const startTime = Date.now();

  try {
    const { data: connections, error: connErr } = await supabaseAdmin
      .from("email_connections")
      .select("*");

    if (connErr) {
      console.error("[auto-sync] Failed to fetch connections:", connErr.message);
      return;
    }

    if (!connections || connections.length === 0) {
      return;
    }

    console.log(`[auto-sync] Starting sync for ${connections.length} connection(s)`);

    const { data: sharedMailboxes } = await supabaseAdmin
      .from("shared_mailboxes")
      .select("id, connection_id");
    const connToSharedMailbox: Record<string, string> = {};
    if (sharedMailboxes) {
      for (const sm of sharedMailboxes) {
        if (sm.connection_id) {
          connToSharedMailbox[sm.connection_id] = sm.id;
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
        console.error(`[auto-sync] Backfill error for ${connId}:`, bfError.message);
      } else if (backfilledRows && backfilledRows.length > 0) {
        console.log(`[auto-sync] Backfilled ${backfilledRows.length} email(s) for shared mailbox ${sharedMbId}`);
      } else {
        console.log(`[auto-sync] Backfill check for conn ${connId}: 0 emails to update`);
      }
    }

    let totalSynced = 0;

    for (const conn of connections) {
      try {
        (conn as any)._sharedMailboxId = connToSharedMailbox[conn.id] || null;
        let synced = 0;
        if (conn.provider === "gmail") {
          synced = await syncGmailForUser(conn);
        } else if (conn.provider === "outlook") {
          synced = await syncOutlookForUser(conn);
        } else if (conn.provider === "imap") {
          synced = await syncImapForUser(conn);
        }
        if (synced < 0) {
          console.error(`[auto-sync] ${conn.email_address} (${conn.provider}): sync failed`);
        } else {
          totalSynced += synced;
          console.log(`[auto-sync] ${conn.email_address} (${conn.provider}): ${synced} new email(s)`);
        }
      } catch (err: any) {
        console.error(`[auto-sync] Error for ${conn.email_address}:`, err.message);
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[auto-sync] Done: ${totalSynced} new email(s) in ${elapsed}s`);
  } catch (err: any) {
    console.error("[auto-sync] Fatal error:", err.message);
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
