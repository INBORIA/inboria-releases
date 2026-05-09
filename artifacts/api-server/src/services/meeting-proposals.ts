import { google } from "googleapis";
import nodemailer from "nodemailer";
import OpenAI from "openai";
import { randomUUID } from "crypto";
import { supabaseAdmin } from "../lib/supabase";
import { logger } from "../lib/logger";
import { consumeAiCredits } from "./credits";
import { generateJitsiUrl } from "./calendar-sync";
import {
  getActiveCalendarAccountsForUser,
  getValidAccessToken,
  type CalendarAccountRow,
} from "./calendar-tokens";

const GOOGLE_CLIENT_ID = process.env["GOOGLE_CLIENT_ID"] || "";
const GOOGLE_CLIENT_SECRET = process.env["GOOGLE_CLIENT_SECRET"] || "";

/**
 * Vérifie qu'un créneau (start, end) est libre sur tous les calendriers
 * connectés (Google + Outlook) de l'utilisateur. Best-effort : si le freebusy
 * échoue pour un compte, on l'ignore (on ne bloque pas la proposition à cause
 * d'une panne API tierce). Retourne `null` si libre, sinon un message décrivant
 * le conflit.
 */
async function checkSlotAvailability(
  userId: string,
  startAt: string,
  endAt: string,
): Promise<string | null> {
  const start = new Date(startAt);
  const end = new Date(endAt);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return null;

  const accounts = await getActiveCalendarAccountsForUser(userId);
  if (accounts.length === 0) return null;

  const startMs = start.getTime();
  const endMs = end.getTime();

  for (const account of accounts) {
    let busy: Array<{ start: string; end: string }> = [];
    try {
      if (account.provider === "google") {
        const token = await getValidAccessToken(account);
        if (!token) continue;
        const client = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
        client.setCredentials({ access_token: token });
        const cal = google.calendar({ version: "v3", auth: client });
        const { data } = await cal.freebusy.query({
          requestBody: { timeMin: start.toISOString(), timeMax: end.toISOString(), items: [{ id: "primary" }] },
        });
        busy = ((data.calendars?.["primary"]?.busy || []) as Array<{ start: string; end: string }>)
          .filter((b) => !!b.start && !!b.end);
      } else if (account.provider === "outlook") {
        const token = await getValidAccessToken(account);
        if (!token) continue;
        const resp = await fetch("https://graph.microsoft.com/v1.0/me/calendar/getSchedule", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            schedules: [account.email_address],
            startTime: { dateTime: start.toISOString(), timeZone: "UTC" },
            endTime: { dateTime: end.toISOString(), timeZone: "UTC" },
            availabilityViewInterval: 30,
          }),
        });
        if (!resp.ok) continue;
        const data = (await resp.json()) as { value?: Array<{ scheduleItems?: Array<{ start?: { dateTime?: string }; end?: { dateTime?: string } }> }> };
        const items = data.value?.[0]?.scheduleItems || [];
        busy = items
          .map((it) => {
            const s = it.start?.dateTime;
            const e = it.end?.dateTime;
            if (!s || !e) return null;
            const sIso = /Z$|[+-]\d{2}:?\d{2}$/.test(s) ? s : s + "Z";
            const eIso = /Z$|[+-]\d{2}:?\d{2}$/.test(e) ? e : e + "Z";
            return { start: sIso, end: eIso };
          })
          .filter((x): x is { start: string; end: string } => !!x);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn({ accountId: (account as CalendarAccountRow).id, err: msg }, "[meeting-proposals] freebusy lookup failed (best-effort skip)");
      continue;
    }
    for (const b of busy) {
      const bs = new Date(b.start).getTime();
      const be = new Date(b.end).getTime();
      if (!isNaN(bs) && !isNaN(be) && bs < endMs && be > startMs) {
        return `slot_conflict:${account.email_address}`;
      }
    }
  }
  return null;
}

const openai = new OpenAI({ apiKey: process.env["OPENAI_API_KEY"] });

interface ProposeArgs {
  userId: string;
  to: string;
  contactName?: string;
  startAt: string;
  endAt: string;
  subject: string;
  location?: string | null;
  description?: string | null;
  lang?: string;
  videoProvider?: "meet" | "teams" | "jitsi" | "none" | null;
}

interface ProposeResult {
  ok: boolean;
  appointmentId?: string;
  error?: string;
}

interface EmailConnRow {
  id: string;
  user_id: string;
  provider: string;
  email_address: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string | null;
}

async function getPrimaryConnection(userId: string): Promise<EmailConnRow | null> {
  const { data } = await supabaseAdmin
    .from("email_connections")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1);
  return (data?.[0] as EmailConnRow | undefined) || null;
}

function buildMessageId(domain: string): string {
  const id = randomUUID();
  return `<inboria-rdv-${id}@${domain || "inboria.app"}>`;
}

async function refreshOutlookIfNeeded(conn: EmailConnRow): Promise<string> {
  if (!conn.token_expires_at || new Date(conn.token_expires_at) >= new Date()) {
    return conn.access_token;
  }
  const tokenResp = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env["MICROSOFT_CLIENT_ID"] || "",
      client_secret: process.env["MICROSOFT_CLIENT_SECRET"] || "",
      refresh_token: conn.refresh_token,
      grant_type: "refresh_token",
      scope: "openid email Mail.Read Mail.Send offline_access",
    }),
  });
  const newTokens = (await tokenResp.json()) as { access_token?: string; expires_in?: number };
  if (newTokens.access_token) {
    await supabaseAdmin
      .from("email_connections")
      .update({
        access_token: newTokens.access_token,
        token_expires_at: new Date(Date.now() + (newTokens.expires_in || 3600) * 1000).toISOString(),
      })
      .eq("id", conn.id);
    return newTokens.access_token;
  }
  return conn.access_token;
}

/**
 * Envoie le mail de proposition via le compte mail principal de l'utilisateur.
 * Pour Gmail/IMAP-SMTP on injecte un Message-ID stable de notre côté afin que
 * le worker de détection puisse retrouver le RDV depuis l'In-Reply-To de la
 * réponse. Pour Outlook (Graph API) on lit le Message-ID renvoyé par Microsoft
 * sur le mail envoyé (Graph nous interdit d'imposer le nôtre côté envoi).
 */
async function sendProposalEmail(
  conn: EmailConnRow,
  to: string,
  subject: string,
  body: string,
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const domain = conn.email_address.split("@")[1] || "inboria.app";
  const messageId = buildMessageId(domain);
  try {
    if (conn.provider === "gmail") {
      const oauth2 = new google.auth.OAuth2(
        process.env["GOOGLE_CLIENT_ID"],
        process.env["GOOGLE_CLIENT_SECRET"],
      );
      oauth2.setCredentials({ access_token: conn.access_token, refresh_token: conn.refresh_token });
      const gmail = google.gmail({ version: "v1", auth: oauth2 });
      const raw = Buffer.from(
        [
          `To: ${to}`,
          `From: ${conn.email_address}`,
          `Subject: ${subject}`,
          `Message-ID: ${messageId}`,
          `Content-Type: text/plain; charset=utf-8`,
          "",
          body,
        ].join("\r\n"),
      )
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
      await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
      return { ok: true, messageId };
    }

    if (conn.provider === "outlook") {
      const accessToken = await refreshOutlookIfNeeded(conn);
      // Graph API : créer un brouillon (pour récupérer son internetMessageId
      // stable), puis l'envoyer. C'est la seule façon propre d'avoir notre
      // Message-ID côté serveur Microsoft.
      const draftResp = await fetch("https://graph.microsoft.com/v1.0/me/messages", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          body: { contentType: "Text", content: body },
          toRecipients: [{ emailAddress: { address: to } }],
        }),
      });
      if (!draftResp.ok) {
        const err = await draftResp.text();
        return { ok: false, error: `outlook draft: ${err.slice(0, 200)}` };
      }
      const draft = (await draftResp.json()) as { id?: string; internetMessageId?: string };
      if (!draft.id) return { ok: false, error: "outlook: no draft id" };
      const sendResp = await fetch(
        `https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(draft.id)}/send`,
        { method: "POST", headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (!sendResp.ok) {
        const err = await sendResp.text();
        return { ok: false, error: `outlook send: ${err.slice(0, 200)}` };
      }
      return { ok: true, messageId: draft.internetMessageId || messageId };
    }

    // IMAP / SMTP fallback
    let imapConfig: { host: string } = { host: "" };
    try {
      imapConfig = JSON.parse(conn.refresh_token);
    } catch {
      /* noop */
    }
    if (!imapConfig.host) return { ok: false, error: "smtp configuration missing" };
    const transporter = nodemailer.createTransport({
      host: imapConfig.host.replace(/^imap\./, "smtp."),
      port: 587,
      secure: false,
      auth: { user: conn.email_address, pass: conn.access_token },
      tls: { rejectUnauthorized: true },
    });
    await transporter.sendMail({
      from: conn.email_address,
      to,
      subject,
      text: body,
      messageId,
    });
    return { ok: true, messageId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

function langInstruction(lang: string | undefined): string {
  const map: Record<string, string> = {
    fr: "Rédige en français avec vouvoiement (vous), ton professionnel et bienveillant.",
    en: "Write in English with a polite, professional B2B tone.",
    nl: "Schrijf in het Nederlands met formele beleefdheid (u), professionele B2B-toon.",
    de: "Schreibe auf Deutsch mit förmlicher Anrede (Sie), professioneller B2B-Ton.",
    es: "Escribe en español con tratamiento de usted, tono profesional B2B.",
    it: "Scrivi in italiano con il Lei di cortesia, tono professionale B2B.",
  };
  return map[lang || "fr"] || map["fr"]!;
}

/**
 * Génère le corps du mail de proposition (1 paragraphe court + créneau lisible
 * + signature ouverte). Le destinataire répond en clair "ok / non / et si on
 * faisait plutôt …" — le worker classera la réponse.
 */
function videoLineForLang(lang: string, url: string): string {
  if (lang === "en") return `Video link: ${url}`;
  if (lang === "nl") return `Videolink: ${url}`;
  if (lang === "de") return `Videolink: ${url}`;
  if (lang === "es") return `Enlace de videollamada: ${url}`;
  if (lang === "it") return `Link videochiamata: ${url}`;
  return `Lien visio : ${url}`;
}

async function generateProposalEmailBody(
  args: ProposeArgs,
  fromName: string,
  videoUrl: string | null,
): Promise<{ subject: string; body: string }> {
  const startDate = new Date(args.startAt);
  const endDate = new Date(args.endAt);
  const lang = (args.lang || "fr").toLowerCase();
  const dateLocale = lang === "en" ? "en-GB" : lang === "nl" ? "nl-NL" : "fr-FR";
  const slot = `${startDate.toLocaleDateString(dateLocale, { weekday: "long", day: "numeric", month: "long", year: "numeric" })} ${startDate.toLocaleTimeString(dateLocale, { hour: "2-digit", minute: "2-digit" })} – ${endDate.toLocaleTimeString(dateLocale, { hour: "2-digit", minute: "2-digit" })}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 350,
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content:
            "Tu rédiges un court mail de proposition de rendez-vous 1 à 1, professionnel, en B2B. " +
            langInstruction(lang) +
            " Ne mets PAS d'objet (juste le corps). Pas de markdown. Maximum 6 lignes. Termine par 'Bien à vous,\\n" +
            fromName +
            "' ou équivalent dans la langue.",
        },
        {
          role: "user",
          content: `Destinataire: ${args.contactName || args.to}
Sujet du RDV: ${args.subject}
Créneau proposé: ${slot}
${args.location ? `Lieu: ${args.location}\n` : ""}${args.description ? `Contexte: ${args.description}\n` : ""}
Rédige le corps du mail. Mentionne clairement le créneau et invite poliment à confirmer, refuser ou proposer un autre créneau.`,
        },
      ],
    });
    const llmBody = completion.choices[0]?.message?.content?.trim() || "";
    if (llmBody.length > 0) {
      const finalBody = videoUrl
        ? `${llmBody}\n\n${videoLineForLang((args.lang || "fr").toLowerCase(), videoUrl)}`
        : llmBody;
      return { subject: args.subject, body: finalBody };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({ err: msg }, "[meeting-proposals] LLM body generation failed, using fallback");
  }

  // Fallback déterministe.
  const greeting = args.contactName ? `Bonjour ${args.contactName},` : "Bonjour,";
  const videoLine = videoUrl ? `\n${videoLineForLang(lang, videoUrl)}` : "";
  return {
    subject: args.subject,
    body: `${greeting}

Je vous propose un rendez-vous : ${slot}.${args.location ? `\nLieu : ${args.location}.` : ""}${videoLine}

Cela vous convient-il ? N'hésitez pas à proposer un autre créneau si besoin.

Bien à vous,
${fromName}`,
  };
}

/**
 * Envoie un mail court de confirmation au contact quand l'utilisateur accepte
 * une contre-proposition reçue. Ferme la boucle "1 clic" côté UI.
 */
export async function sendCounterAcceptedEmail(args: {
  userId: string;
  to: string;
  subject: string;
  startAt: string;
  endAt: string;
  lang: string;
}): Promise<{ ok: boolean; error?: string }> {
  const conn = await getPrimaryConnection(args.userId);
  if (!conn) return { ok: false, error: "no email connection" };
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("full_name")
    .eq("id", args.userId)
    .maybeSingle();
  const fromName = (profile as { full_name?: string } | null)?.full_name || conn.email_address;
  const lang = (args.lang || "fr").toLowerCase();
  const dateLocale = lang === "en" ? "en-GB" : lang === "nl" ? "nl-NL" : "fr-FR";
  const startDate = new Date(args.startAt);
  const endDate = new Date(args.endAt);
  const slot = `${startDate.toLocaleDateString(dateLocale, { weekday: "long", day: "numeric", month: "long", year: "numeric" })} ${startDate.toLocaleTimeString(dateLocale, { hour: "2-digit", minute: "2-digit" })} – ${endDate.toLocaleTimeString(dateLocale, { hour: "2-digit", minute: "2-digit" })}`;
  const greeting = lang === "en" ? "Hello," : lang === "nl" ? "Hallo," : "Bonjour,";
  const confirm =
    lang === "en"
      ? `Thanks for the new slot — it works for me. I confirm our meeting: ${slot}.`
      : lang === "nl"
        ? `Bedankt voor het nieuwe voorstel — het past me. Ik bevestig onze afspraak: ${slot}.`
        : `Merci pour le nouveau créneau — il me convient. Je confirme notre rendez-vous : ${slot}.`;
  const closing = lang === "en" ? "Best regards," : lang === "nl" ? "Met vriendelijke groet," : "Bien à vous,";
  const subject = lang === "en" ? `Confirmed — ${args.subject}` : `Confirmé — ${args.subject}`;
  const body = `${greeting}\n\n${confirm}\n\n${closing}\n${fromName}`;
  const sendRes = await sendProposalEmail(conn, args.to, subject, body);
  return sendRes.ok ? { ok: true } : { ok: false, error: sendRes.error };
}

/**
 * Coeur Phase 3 : crée un RDV `pending`, envoie le mail de proposition,
 * stocke le Message-ID pour la détection ultérieure de la réponse. Programme
 * la relance auto à +48h si l'utilisateur l'a activée.
 */
export async function proposeMeeting(args: ProposeArgs): Promise<ProposeResult> {
  const conn = await getPrimaryConnection(args.userId);
  if (!conn) return { ok: false, error: "no email connection" };

  // Phase 1 freebusy guard : on refuse silencieusement la proposition si le
  // créneau chevauche un événement déjà inscrit dans un calendrier connecté.
  // Retour explicite côté API pour que le frontend puisse afficher un message.
  const conflict = await checkSlotAvailability(args.userId, args.startAt, args.endAt);
  if (conflict) {
    logger.info({ userId: args.userId, conflict }, "[meeting-proposals] slot conflict, propose blocked");
    return { ok: false, error: conflict };
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("full_name, meeting_reminders_enabled, preferred_video_provider")
    .eq("id", args.userId)
    .maybeSingle();
  const fromName = (profile as { full_name?: string } | null)?.full_name || conn.email_address;
  const remindersEnabled = (profile as { meeting_reminders_enabled?: boolean } | null)?.meeting_reminders_enabled !== false;
  const preferredVideo = (profile as { preferred_video_provider?: string | null } | null)?.preferred_video_provider as
    | "meet" | "teams" | "jitsi" | "none" | null | undefined;

  const billing = await consumeAiCredits(args.userId, "inboria_chat", {
    source: "meeting-proposal",
    reason: "schedule_meeting tool",
  });
  if (!billing.ok) return { ok: false, error: "billing failed" };

  // Effective video provider for this proposal: explicit arg wins; otherwise
  // user preference. Meet/Teams require a connected calendar of the right
  // type — if not available, we gracefully fall back to Jitsi so the link is
  // still included in the email.
  // Phase 4 : par défaut TOUTE proposition Inboria reçoit un lien visio (Jitsi).
  // Seul l'appelant qui passe explicitement "none" peut désactiver le lien.
  let effVideo: "meet" | "teams" | "jitsi" | "none";
  if (args.videoProvider !== undefined && args.videoProvider !== null) {
    effVideo = args.videoProvider;
  } else if (preferredVideo) {
    effVideo = preferredVideo;
  } else {
    effVideo = "jitsi";
  }
  let videoUrl: string | null = null;
  if (effVideo === "jitsi") {
    videoUrl = generateJitsiUrl();
  } else if (effVideo === "meet" || effVideo === "teams") {
    const wantedProvider = effVideo === "meet" ? "google" : "outlook";
    const { data: calAcc } = await supabaseAdmin
      .from("calendar_accounts")
      .select("id")
      .eq("user_id", args.userId)
      .eq("provider", wantedProvider)
      .eq("status", "connected")
      .limit(1)
      .maybeSingle();
    if (!calAcc) {
      // Pas de calendrier compatible : on retombe sur Jitsi pour ne pas
      // bloquer la proposition (le contact aura quand même un lien visio).
      logger.info(
        { userId: args.userId, requested: effVideo },
        "[meeting-proposals] no matching calendar, falling back to jitsi",
      );
      effVideo = "jitsi";
      videoUrl = generateJitsiUrl();
    }
  }

  const { subject, body } = await generateProposalEmailBody(
    { ...args, videoProvider: effVideo },
    fromName,
    videoUrl,
  );

  const awaitingReminderAt = remindersEnabled
    ? new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
    : null;

  // Insert FIRST so we never lose tracking if the send succeeds but the DB
  // write fails. We then update with the real Message-ID after sending and
  // delete the row if the send itself fails.
  const { data: appt, error: insertErr } = await supabaseAdmin
    .from("appointments")
    .insert({
      user_id: args.userId,
      title: args.subject,
      description: args.description || null,
      location: args.location || null,
      start_at: args.startAt,
      end_at: args.endAt,
      all_day: false,
      reminder_minutes: 30,
      participants: args.to,
      status: "pending",
      proposal_message_id: null,
      proposal_recipient: args.to,
      proposal_lang: (args.lang || "fr").toLowerCase(),
      awaiting_reminder_at: awaitingReminderAt,
      confirmed: false,
      video_provider: effVideo === "none" ? null : effVideo,
      video_url: videoUrl,
    })
    .select("id")
    .single();

  if (insertErr || !appt) {
    logger.error({ err: insertErr?.message }, "[meeting-proposals] insert appointment failed");
    return { ok: false, error: insertErr?.message || "insert failed" };
  }

  const sendRes = await sendProposalEmail(conn, args.to, subject, body);
  if (!sendRes.ok) {
    await supabaseAdmin.from("appointments").delete().eq("id", appt.id);
    logger.warn({ userId: args.userId, err: sendRes.error }, "[meeting-proposals] send failed, row rolled back");
    return { ok: false, error: sendRes.error || "send failed" };
  }

  if (sendRes.messageId) {
    await supabaseAdmin
      .from("appointments")
      .update({ proposal_message_id: sendRes.messageId })
      .eq("id", appt.id);
  }
  return { ok: true, appointmentId: String(appt.id) };
}

/**
 * Classifie une réponse à une proposition de RDV (oui / non / contre-prop).
 * Appelé par le worker de triage email quand un mail entrant a un In-Reply-To
 * qui matche un proposal_message_id stocké.
 */
export async function classifyMeetingReply(
  userId: string,
  appointmentId: string,
  responseEmailId: number,
  responseMessageId: string | null,
  replyBody: string,
  originalStart: string,
  originalEnd: string,
): Promise<void> {
  try {
    const cleanBody = (replyBody || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 1500);
    const today = new Date().toISOString().split("T")[0];
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 250,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `Tu analyses la réponse à une proposition de rendez-vous. Date du jour : ${today}.
Renvoie un JSON STRICT :
{ "decision": "accept" | "decline" | "counter" | "unknown",
  "counterStartAt": "ISO datetime ou null",
  "counterEndAt": "ISO datetime ou null" }
Règles :
- "accept" : l'auteur confirme le créneau proposé.
- "decline" : l'auteur refuse sans proposer d'alternative.
- "counter" : l'auteur propose un autre créneau (date+heure précis ou demande "plutôt mardi 15h").
  Dans ce cas, déduis la date/heure complète et remplis counterStartAt et counterEndAt.
- "unknown" : ce n'est ni l'un ni l'autre (hors-sujet, simple question…).`,
        },
        {
          role: "user",
          content: `Créneau d'origine : ${originalStart} → ${originalEnd}
Réponse reçue :
${cleanBody}`,
        },
      ],
    });

    const content = completion.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(content) as {
      decision?: string;
      counterStartAt?: string | null;
      counterEndAt?: string | null;
    };

    const decision = parsed.decision;
    if (!decision || decision === "unknown") return;

    const update: Record<string, unknown> = {
      response_message_id: responseMessageId,
      awaiting_reminder_at: null,
      updated_at: new Date().toISOString(),
    };

    if (decision === "accept") {
      update.status = "confirmed";
      update.confirmed = true;
    } else if (decision === "decline") {
      update.status = "declined";
      update.confirmed = false;
    } else if (decision === "counter") {
      update.status = "counter_proposed";
      update.confirmed = false;
      if (parsed.counterStartAt) update.counter_start_at = parsed.counterStartAt;
      if (parsed.counterEndAt) update.counter_end_at = parsed.counterEndAt;
    }

    await supabaseAdmin.from("appointments").update(update).eq("id", appointmentId).eq("user_id", userId);
    void consumeAiCredits(userId, "inboria_chat", {
      source: "meeting-reply-classifier",
      emailId: responseEmailId,
    });
    logger.info({ userId, appointmentId, decision }, "[meeting-proposals] reply classified");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({ err: msg, appointmentId }, "[meeting-proposals] classify failed");
  }
}

/**
 * Hook appelé après l'enregistrement d'un mail entrant : si son In-Reply-To
 * correspond à un proposal_message_id pending, on lance la classification.
 * Best-effort — n'arrête JAMAIS la sync mail.
 */
export async function handleIncomingEmailForMeeting(
  userId: string,
  emailId: number,
  inReplyTo: string | null | undefined,
  responseMessageId: string | null,
  body: string,
): Promise<void> {
  if (!inReplyTo) return;
  try {
    const { data: appt } = await supabaseAdmin
      .from("appointments")
      .select("id, start_at, end_at, status")
      .eq("user_id", userId)
      .eq("proposal_message_id", inReplyTo)
      .maybeSingle();
    if (!appt) return;
    if (appt.status !== "pending" && appt.status !== "counter_proposed") return;
    await classifyMeetingReply(
      userId,
      String(appt.id),
      emailId,
      responseMessageId,
      body,
      String(appt.start_at),
      String(appt.end_at),
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({ err: msg, emailId }, "[meeting-proposals] incoming hook failed");
  }
}

/**
 * Worker 48h : pour chaque RDV pending dont awaiting_reminder_at est passé,
 * envoie une relance polie via le compte mail principal et marque
 * reminder_sent_at pour ne pas relancer deux fois.
 */
export async function runMeetingFollowupSweep(): Promise<number> {
  const nowIso = new Date().toISOString();
  const { data: rows } = await supabaseAdmin
    .from("appointments")
    .select("id, user_id, title, start_at, end_at, proposal_recipient, proposal_lang, location")
    .eq("status", "pending")
    .lte("awaiting_reminder_at", nowIso)
    .is("reminder_sent_at", null)
    .not("proposal_recipient", "is", null)
    .limit(50);

  if (!rows || rows.length === 0) return 0;

  let sent = 0;
  for (const row of rows as Array<{
    id: string;
    user_id: string;
    title: string;
    start_at: string;
    end_at: string;
    proposal_recipient: string;
    proposal_lang: string | null;
    location: string | null;
  }>) {
    try {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("full_name, meeting_reminders_enabled")
        .eq("id", row.user_id)
        .maybeSingle();
      const remindersEnabled = (profile as { meeting_reminders_enabled?: boolean } | null)?.meeting_reminders_enabled !== false;
      if (!remindersEnabled) {
        await supabaseAdmin
          .from("appointments")
          .update({ awaiting_reminder_at: null })
          .eq("id", row.id);
        continue;
      }
      const conn = await getPrimaryConnection(row.user_id);
      if (!conn) continue;
      const fromName = (profile as { full_name?: string } | null)?.full_name || conn.email_address;
      const lang = (row.proposal_lang || "fr").toLowerCase();
      const greeting = lang === "en" ? "Hello," : lang === "nl" ? "Hallo," : "Bonjour,";
      const ask =
        lang === "en"
          ? `Just a quick reminder of my proposal for "${row.title}". Does the slot still work for you?`
          : lang === "nl"
            ? `Even een herinnering aan mijn voorstel voor "${row.title}". Past het tijdslot nog?`
            : `Petit rappel concernant ma proposition pour « ${row.title} ». Le créneau vous convient-il toujours ?`;
      const closing = lang === "en" ? "Best regards," : lang === "nl" ? "Met vriendelijke groet," : "Bien à vous,";
      const body = `${greeting}\n\n${ask}\n\n${closing}\n${fromName}`;
      const subject = lang === "en" ? `Reminder — ${row.title}` : `Rappel — ${row.title}`;
      const sendRes = await sendProposalEmail(conn, row.proposal_recipient, subject, body);
      if (sendRes.ok) {
        await supabaseAdmin
          .from("appointments")
          .update({
            reminder_sent_at: new Date().toISOString(),
            awaiting_reminder_at: null,
          })
          .eq("id", row.id);
        sent++;
      } else {
        // Backoff 6h for retry — do NOT mark reminder_sent_at, otherwise the
        // sweep would skip this row forever and the user would think a
        // reminder was sent when it never reached the contact.
        const retryAt = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
        await supabaseAdmin
          .from("appointments")
          .update({ awaiting_reminder_at: retryAt })
          .eq("id", row.id);
        logger.warn({ apptId: row.id, err: sendRes.error, retryAt }, "[meeting-proposals] reminder send failed, will retry");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn({ apptId: row.id, err: msg }, "[meeting-proposals] reminder loop crashed");
    }
  }
  return sent;
}
