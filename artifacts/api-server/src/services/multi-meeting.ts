import { google } from "googleapis";
import nodemailer from "nodemailer";
import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "../lib/supabase";
import { logger } from "../lib/logger";
import { consumeAiCredits } from "./credits";
import { generateJitsiUrl } from "./calendar-sync";
import { buildIcs, type IcsParticipant } from "./ics";
import { findCommonSlots, resolveInternalParticipants } from "./freebusy";

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

async function resolveSendingConnection(
  userId: string,
  fromConnectionId?: string | null,
): Promise<EmailConnRow | null> {
  if (fromConnectionId) {
    const { data } = await supabaseAdmin
      .from("email_connections")
      .select("*")
      .eq("user_id", userId)
      .eq("id", fromConnectionId)
      .limit(1);
    const row = (data?.[0] as EmailConnRow | undefined) || null;
    if (row) return row;
  }
  return getPrimaryConnection(userId);
}

// Voir meeting-proposals.ts : un lieu physique (Bureau, adresse) doit
// désactiver le lien visio par défaut.
function locationLooksPhysical(loc: string | null | undefined): boolean {
  if (!loc) return false;
  const s = String(loc).trim();
  if (!s) return false;
  return !/(visio|vid[ée]o|teams|google ?meet|\bmeet\b|zoom|jitsi|webex|whereby|skype|en ligne|online|distanciel|remote|call|appel|virtuel|virtual)/i.test(
    s,
  );
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
 * Envoi d'une invitation multi-participants : un mail par destinataire, avec
 * pièce jointe iCalendar (METHOD:REQUEST). Les clients standards (Gmail,
 * Outlook, Apple Mail) afficheront les boutons Accepter / Refuser et
 * renverront une réponse RFC 5545 (METHOD:REPLY) que le worker triage parsera.
 */
export async function sendInviteWithIcs(args: {
  conn: EmailConnRow;
  to: string;
  subject: string;
  body: string;
  ics: string;
}): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const domain = args.conn.email_address.split("@")[1] || "inboria.app";
  const messageId = `<inboria-rdv-multi-${randomUUID()}@${domain}>`;
  try {
    if (args.conn.provider === "gmail") {
      const oauth2 = new google.auth.OAuth2(
        process.env["GOOGLE_CLIENT_ID"],
        process.env["GOOGLE_CLIENT_SECRET"],
      );
      oauth2.setCredentials({ access_token: args.conn.access_token, refresh_token: args.conn.refresh_token });
      const gmail = google.gmail({ version: "v1", auth: oauth2 });
      const boundary = `=_ncv_${randomUUID()}`;
      const icsB64 = Buffer.from(args.ics).toString("base64");
      const raw = Buffer.from(
        [
          `To: ${args.to}`,
          `From: ${args.conn.email_address}`,
          `Subject: ${args.subject}`,
          `Message-ID: ${messageId}`,
          "MIME-Version: 1.0",
          `Content-Type: multipart/mixed; boundary="${boundary}"`,
          "",
          `--${boundary}`,
          `Content-Type: text/plain; charset=utf-8`,
          "",
          args.body,
          "",
          `--${boundary}`,
          `Content-Type: text/calendar; method=REQUEST; charset=utf-8; name="invite.ics"`,
          `Content-Transfer-Encoding: base64`,
          `Content-Disposition: attachment; filename="invite.ics"`,
          "",
          icsB64,
          `--${boundary}--`,
          "",
        ].join("\r\n"),
      )
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
      await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
      return { ok: true, messageId };
    }

    if (args.conn.provider === "outlook") {
      const accessToken = await refreshOutlookIfNeeded(args.conn);
      const draftResp = await fetch("https://graph.microsoft.com/v1.0/me/messages", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: args.subject,
          body: { contentType: "Text", content: args.body },
          toRecipients: [{ emailAddress: { address: args.to } }],
          attachments: [
            {
              "@odata.type": "#microsoft.graph.fileAttachment",
              name: "invite.ics",
              contentType: "text/calendar",
              contentBytes: Buffer.from(args.ics).toString("base64"),
            },
          ],
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

    // SMTP fallback
    let imapConfig: { host: string } = { host: "" };
    try {
      imapConfig = JSON.parse(args.conn.refresh_token);
    } catch {
      /* noop */
    }
    if (!imapConfig.host) return { ok: false, error: "smtp configuration missing" };
    const transporter = nodemailer.createTransport({
      host: imapConfig.host.replace(/^imap\./, "smtp."),
      port: 587,
      secure: false,
      auth: { user: args.conn.email_address, pass: args.conn.access_token },
      tls: { rejectUnauthorized: true },
    });
    await transporter.sendMail({
      from: args.conn.email_address,
      to: args.to,
      subject: args.subject,
      text: args.body,
      messageId,
      icalEvent: { method: "REQUEST", filename: "invite.ics", content: args.ics },
    });
    return { ok: true, messageId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

export interface MultiProposeArgs {
  userId: string;
  subject: string;
  description?: string | null;
  location?: string | null;
  startAt: string;
  endAt: string;
  participants: Array<{ email: string; name?: string | null; isRequired?: boolean }>;
  lang?: string;
  videoProvider?: "meet" | "teams" | "jitsi" | "none" | null;
  fromConnectionId?: string | null;
}

export interface MultiProposeResult {
  ok: boolean;
  appointmentId?: string;
  participantsCreated?: number;
  invitesSent?: number;
  error?: string;
}

/**
 * Crée un RDV multi-participants : insère l'appointment (is_multi=true,
 * multi_status=pending), insère 1 ligne par participant dans
 * `appointment_participants`, génère un fichier ICS commun et envoie un mail
 * d'invitation distinct à chaque destinataire avec l'ICS en pièce jointe.
 */
export async function proposeMultiMeeting(args: MultiProposeArgs): Promise<MultiProposeResult> {
  if (!args.participants || args.participants.length < 3) {
    return { ok: false, error: "multi requires at least 3 participants" };
  }
  const conn = await resolveSendingConnection(args.userId, args.fromConnectionId);
  if (!conn) return { ok: false, error: "no email connection" };

  const billing = await consumeAiCredits(args.userId, "inboria_chat", {
    source: "multi-meeting",
    reason: "multi-participant invitation",
  });
  if (!billing.ok) return { ok: false, error: "billing failed" };

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("full_name, preferred_video_provider, personal_video_url")
    .eq("id", args.userId)
    .maybeSingle();
  const fromName = (profile as { full_name?: string } | null)?.full_name || conn.email_address;
  const preferredVideo = (profile as { preferred_video_provider?: string | null } | null)?.preferred_video_provider as
    | "meet" | "teams" | "jitsi" | "none" | null | undefined;
  const personalVideoUrl = ((profile as { personal_video_url?: string | null } | null)?.personal_video_url || "").trim() || null;

  let effVideo: "meet" | "teams" | "jitsi" | "none";
  if (args.videoProvider !== undefined && args.videoProvider !== null) {
    effVideo = args.videoProvider;
  } else if (locationLooksPhysical(args.location)) {
    effVideo = "none";
  } else if (preferredVideo && preferredVideo !== "none") {
    effVideo = preferredVideo;
  } else {
    effVideo = "jitsi";
  }
  // Pour le mail multi on garantit un lien. Si l'utilisateur a configuré un
  // lien visio personnel (Teams/Meet permanent), on l'utilise quand le
  // fournisseur choisi est Teams ou Meet ; sinon fallback Jitsi.
  let videoUrl: string | null = null;
  if (effVideo === "meet" || effVideo === "teams") {
    if (personalVideoUrl) {
      videoUrl = personalVideoUrl;
    } else {
      effVideo = "jitsi";
      videoUrl = generateJitsiUrl();
    }
  } else if (effVideo === "jitsi") {
    videoUrl = generateJitsiUrl();
  }

  const csv = args.participants.map((p) => p.email).join(", ");
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
      participants: csv,
      status: "pending",
      proposal_lang: (args.lang || "fr").toLowerCase(),
      confirmed: false,
      is_multi: true,
      multi_status: "pending",
      video_provider: effVideo === "none" ? null : effVideo,
      video_url: videoUrl,
    })
    .select("id")
    .single();

  if (insertErr || !appt) {
    logger.error({ err: insertErr?.message }, "[multi-meeting] insert appointment failed");
    return { ok: false, error: insertErr?.message || "insert failed" };
  }

  const apptId = String(appt.id);
  const partRows = args.participants.map((p) => ({
    appointment_id: apptId,
    email: p.email.toLowerCase().trim(),
    name: p.name || null,
    is_required: p.isRequired !== false,
  }));
  const { error: partErr } = await supabaseAdmin
    .from("appointment_participants")
    .insert(partRows);
  if (partErr) {
    logger.error({ err: partErr.message, apptId }, "[multi-meeting] participants insert failed");
    await supabaseAdmin.from("appointments").delete().eq("id", apptId);
    return { ok: false, error: partErr.message };
  }

  const icsParticipants: IcsParticipant[] = args.participants.map((p) => ({
    email: p.email,
    name: p.name || null,
    required: p.isRequired !== false,
  }));
  const ics = buildIcs({
    uid: `ncv-${apptId}@inboria.app`,
    method: "REQUEST",
    organizerEmail: conn.email_address,
    organizerName: fromName,
    title: args.subject,
    description: args.description || null,
    location: args.location || null,
    startAt: args.startAt,
    endAt: args.endAt,
    participants: icsParticipants,
    videoUrl,
  });

  const lang = (args.lang || "fr").toLowerCase();
  const dateLocale = lang === "en" ? "en-GB" : lang === "nl" ? "nl-NL" : "fr-FR";
  const startD = new Date(args.startAt);
  const endD = new Date(args.endAt);
  const slot = `${startD.toLocaleDateString(dateLocale, { weekday: "long", day: "numeric", month: "long", year: "numeric" })} ${startD.toLocaleTimeString(dateLocale, { hour: "2-digit", minute: "2-digit" })} – ${endD.toLocaleTimeString(dateLocale, { hour: "2-digit", minute: "2-digit" })}`;
  const greeting = lang === "en" ? "Hello," : lang === "nl" ? "Hallo," : "Bonjour,";
  const intro =
    lang === "en"
      ? `You are invited to a meeting: "${args.subject}".`
      : lang === "nl"
        ? `U bent uitgenodigd voor een vergadering: "${args.subject}".`
        : `Vous êtes invité(e) à une réunion : « ${args.subject} ».`;
  const slotLine = lang === "en" ? `When: ${slot}` : lang === "nl" ? `Wanneer: ${slot}` : `Quand : ${slot}`;
  const closing = lang === "en" ? "Best regards," : lang === "nl" ? "Met vriendelijke groet," : "Bien à vous,";
  const videoLine = videoUrl
    ? lang === "en"
      ? `\nVideo link: ${videoUrl}`
      : lang === "nl"
        ? `\nVideolink: ${videoUrl}`
        : `\nLien visio : ${videoUrl}`
    : "";
  const locLine = args.location ? (lang === "en" ? `\nWhere: ${args.location}` : lang === "nl" ? `\nWaar: ${args.location}` : `\nLieu : ${args.location}`) : "";

  let invitesSent = 0;
  for (const p of args.participants) {
    const subject = lang === "en" ? `Invitation — ${args.subject}` : `Invitation — ${args.subject}`;
    const body = `${greeting}\n\n${intro}\n${slotLine}${locLine}${videoLine}\n\n${closing}\n${fromName}`;
    const sendRes = await sendInviteWithIcs({ conn, to: p.email, subject, body, ics });
    if (sendRes.ok) {
      invitesSent++;
    } else {
      logger.warn({ apptId, to: p.email, err: sendRes.error }, "[multi-meeting] invite send failed");
    }
  }

  return {
    ok: true,
    appointmentId: apptId,
    participantsCreated: partRows.length,
    invitesSent,
  };
}

/**
 * Recherche un créneau commun pour un ensemble d'emails participants.
 * Les internes (membres de la même organisation) sont résolus vers leur
 * userId et leur freebusy est intersecté ; les externes ne contribuent pas
 * mais sont retournés tels quels pour que l'UI affiche 3 créneaux candidats.
 */
export async function findMultiCommonSlots(
  organizerUserId: string,
  emails: string[],
  durationMinutes: number,
  windowDays: number,
): Promise<{
  slots: Array<{ start: string; end: string }>;
  internal: Array<{ userId: string; email: string }>;
  external: string[];
}> {
  const { internal, external } = await resolveInternalParticipants(organizerUserId, emails);
  const userIds = [organizerUserId, ...internal.map((i) => i.userId)];
  const slots = await findCommonSlots(userIds, {
    durationMinutes,
    windowDays,
    k: 3,
  });
  return { slots, internal, external };
}

/**
 * Met à jour le statut RSVP d'un participant et recalcule multi_status sur
 * l'appointment parent (pending si au moins 1 NEEDS-ACTION, partial si certains
 * accepted, confirmed si tous accepted, declined si au moins 1 required decline).
 */
export async function updateParticipantStatus(
  apptId: string,
  participantId: string,
  status: "accepted" | "declined" | "tentative",
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabaseAdmin
    .from("appointment_participants")
    .update({
      response_status: status,
      responded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", participantId)
    .eq("appointment_id", apptId);
  if (error) return { ok: false, error: error.message };
  await recomputeMultiStatus(apptId);
  return { ok: true };
}

export async function recomputeMultiStatus(apptId: string): Promise<void> {
  const { data: rows } = await supabaseAdmin
    .from("appointment_participants")
    .select("response_status, is_required")
    .eq("appointment_id", apptId);
  if (!rows || rows.length === 0) return;
  const list = rows as Array<{ response_status: string; is_required: boolean }>;
  const anyRequiredDeclined = list.some((r) => r.is_required && r.response_status === "declined");
  const allAccepted = list.every((r) => r.response_status === "accepted");
  const anyAccepted = list.some((r) => r.response_status === "accepted");
  const anyPending = list.some((r) => r.response_status === "pending");
  let multiStatus: "pending" | "partially_confirmed" | "confirmed" | "declined" = "pending";
  if (anyRequiredDeclined) multiStatus = "declined";
  else if (allAccepted) multiStatus = "confirmed";
  else if (anyAccepted) multiStatus = "partially_confirmed";
  else multiStatus = "pending";
  await supabaseAdmin
    .from("appointments")
    .update({
      multi_status: multiStatus,
      confirmed: multiStatus === "confirmed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", apptId);
}

/**
 * Envoie une relance individuelle à un participant pending. Marque
 * `last_reminder_sent_at` et incrémente `reminder_count`. À utiliser depuis
 * la route POST /appointments/:id/participants/:pid/remind ou depuis le cron
 * J+2.
 */
export async function remindParticipant(
  organizerUserId: string,
  apptId: string,
  participantId: string,
): Promise<{ ok: boolean; error?: string }> {
  const { data: appt } = await supabaseAdmin
    .from("appointments")
    .select("id, user_id, title, start_at, end_at, location, video_url, proposal_lang, is_multi, multi_reminders_enabled")
    .eq("id", apptId)
    .eq("user_id", organizerUserId)
    .maybeSingle();
  if (!appt) return { ok: false, error: "appointment not found" };
  if ((appt as { multi_reminders_enabled?: boolean | null }).multi_reminders_enabled === false) {
    return { ok: false, error: "reminders_disabled_for_appointment" };
  }
  const { data: organizerProfile } = await supabaseAdmin
    .from("profiles")
    .select("multi_reminders_enabled")
    .eq("id", organizerUserId)
    .maybeSingle();
  if ((organizerProfile as { multi_reminders_enabled?: boolean | null } | null)?.multi_reminders_enabled === false) {
    return { ok: false, error: "reminders_disabled_for_user" };
  }

  const { data: part } = await supabaseAdmin
    .from("appointment_participants")
    .select("id, email, name, response_status")
    .eq("id", participantId)
    .eq("appointment_id", apptId)
    .maybeSingle();
  if (!part) return { ok: false, error: "participant not found" };
  if ((part as { response_status: string }).response_status !== "pending") {
    return { ok: false, error: "participant not pending" };
  }

  const conn = await getPrimaryConnection(organizerUserId);
  if (!conn) return { ok: false, error: "no email connection" };

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("full_name")
    .eq("id", organizerUserId)
    .maybeSingle();
  const fromName = (profile as { full_name?: string } | null)?.full_name || conn.email_address;

  const a = appt as {
    title: string;
    start_at: string;
    end_at: string;
    location: string | null;
    video_url: string | null;
    proposal_lang: string | null;
  };
  const lang = (a.proposal_lang || "fr").toLowerCase();
  const dateLocale = lang === "en" ? "en-GB" : lang === "nl" ? "nl-NL" : "fr-FR";
  const startD = new Date(a.start_at);
  const endD = new Date(a.end_at);
  const slot = `${startD.toLocaleDateString(dateLocale, { weekday: "long", day: "numeric", month: "long", year: "numeric" })} ${startD.toLocaleTimeString(dateLocale, { hour: "2-digit", minute: "2-digit" })} – ${endD.toLocaleTimeString(dateLocale, { hour: "2-digit", minute: "2-digit" })}`;
  const greeting = lang === "en" ? "Hello," : lang === "nl" ? "Hallo," : "Bonjour,";
  const ask =
    lang === "en"
      ? `Just a friendly reminder of the meeting "${a.title}" on ${slot}. Could you let me know if you can attend?`
      : lang === "nl"
        ? `Een vriendelijke herinnering aan de vergadering "${a.title}" op ${slot}. Kunt u aangeven of u erbij kunt zijn?`
        : `Petit rappel concernant la réunion « ${a.title} » prévue ${slot}. Pourriez-vous m'indiquer si vous pouvez y participer ?`;
  const closing = lang === "en" ? "Best regards," : lang === "nl" ? "Met vriendelijke groet," : "Bien à vous,";
  const subject = lang === "en" ? `Reminder — ${a.title}` : `Rappel — ${a.title}`;
  const body = `${greeting}\n\n${ask}\n\n${closing}\n${fromName}`;

  // Régénérer un ICS afin que la relance porte aussi les boutons RSVP des
  // clients standards (sans cela, la relance serait juste du texte).
  const ics = buildIcs({
    uid: `ncv-${apptId}@inboria.app`,
    sequence: 1,
    method: "REQUEST",
    organizerEmail: conn.email_address,
    organizerName: fromName,
    title: a.title,
    description: null,
    location: a.location,
    startAt: a.start_at,
    endAt: a.end_at,
    participants: [{ email: (part as { email: string }).email, name: (part as { name: string | null }).name }],
    videoUrl: a.video_url,
  });

  const sendRes = await sendInviteWithIcs({
    conn,
    to: (part as { email: string }).email,
    subject,
    body,
    ics,
  });
  if (!sendRes.ok) return { ok: false, error: sendRes.error };

  const { data: cur } = await supabaseAdmin
    .from("appointment_participants")
    .select("reminder_count")
    .eq("id", participantId)
    .maybeSingle();
  const nextCount = ((cur as { reminder_count: number } | null)?.reminder_count || 0) + 1;
  await supabaseAdmin
    .from("appointment_participants")
    .update({
      last_reminder_sent_at: new Date().toISOString(),
      reminder_count: nextCount,
      updated_at: new Date().toISOString(),
    })
    .eq("id", participantId);
  return { ok: true };
}

/**
 * Cron J+2 multi : pour chaque participant pending d'un RDV multi pour lequel
 * la dernière relance (ou la création) date de plus de 48h, envoie une
 * relance individuelle. Limite à 3 relances par participant.
 */
export async function runMultiParticipantReminderSweep(): Promise<number> {
  interface ApptJoin {
    id: string;
    user_id: string;
    is_multi: boolean;
    start_at: string;
    multi_reminders_enabled: boolean | null;
  }
  interface ParticipantRow {
    id: string;
    appointment_id: string;
    reminder_count: number;
    last_reminder_sent_at: string | null;
    created_at: string;
    appointments: ApptJoin | ApptJoin[] | null;
  }

  const cutoff = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
  const { data: rows } = await supabaseAdmin
    .from("appointment_participants")
    .select(
      "id, appointment_id, reminder_count, last_reminder_sent_at, created_at, appointments!inner(id, user_id, is_multi, start_at, multi_reminders_enabled)",
    )
    .eq("response_status", "pending")
    .lt("reminder_count", 3)
    .limit(50);
  const list = (rows ?? []) as ParticipantRow[];
  if (list.length === 0) return 0;

  // Profils opt-out globaux : on les charge en lot.
  const organizerIds = Array.from(
    new Set(
      list
        .map((r) => (Array.isArray(r.appointments) ? r.appointments[0] : r.appointments))
        .filter((a): a is ApptJoin => !!a)
        .map((a) => a.user_id),
    ),
  );
  const profileOptOut = new Set<string>();
  if (organizerIds.length > 0) {
    const { data: profs } = await supabaseAdmin
      .from("profiles")
      .select("id, multi_reminders_enabled")
      .in("id", organizerIds);
    for (const p of (profs ?? []) as Array<{ id: string; multi_reminders_enabled: boolean | null }>) {
      if (p.multi_reminders_enabled === false) profileOptOut.add(p.id);
    }
  }

  let sent = 0;
  for (const r of list) {
    const apptRaw = r.appointments;
    const appt = Array.isArray(apptRaw) ? apptRaw[0] ?? null : apptRaw;
    if (!appt || !appt.is_multi) continue;
    if (appt.multi_reminders_enabled === false) continue;
    if (profileOptOut.has(appt.user_id)) continue;
    if (new Date(appt.start_at).getTime() < Date.now()) continue;
    const lastTouch = r.last_reminder_sent_at ?? r.created_at;
    if (lastTouch > cutoff) continue;
    try {
      const res = await remindParticipant(appt.user_id, appt.id, r.id);
      if (res.ok) sent++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn({ err: msg, partId: r.id }, "[multi-meeting] participant reminder crashed");
    }
  }
  return sent;
}
