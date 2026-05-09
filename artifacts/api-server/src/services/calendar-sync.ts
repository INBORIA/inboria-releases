import { google } from "googleapis";
import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "../lib/supabase";
import { logger } from "../lib/logger";
import {
  getValidAccessToken,
  type CalendarAccountRow,
} from "./calendar-tokens";

const GOOGLE_CLIENT_ID = process.env["GOOGLE_CLIENT_ID"] || "";
const GOOGLE_CLIENT_SECRET = process.env["GOOGLE_CLIENT_SECRET"] || "";

export type VideoProvider = "meet" | "teams" | "jitsi" | "none";

export interface AppointmentPushPayload {
  title: string;
  description?: string | null;
  location?: string | null;
  startAt: string;
  endAt: string;
  allDay?: boolean | null;
  participants?: string | null;
  videoProvider?: VideoProvider | null;
  videoUrl?: string | null;
}

export interface AppointmentPushResult {
  externalId: string;
  calendarId: string;
  videoUrl?: string | null;
  videoJoinUrl?: string | null;
}

export function generateJitsiUrl(): string {
  return `https://meet.jit.si/ncv-${randomUUID()}`;
}

function parseParticipantsList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter((s) => /.+@.+\..+/.test(s));
}

async function loadAccount(
  userId: string,
  accountId: string,
): Promise<CalendarAccountRow | null> {
  const { data, error } = await supabaseAdmin
    .from("calendar_accounts")
    .select(
      "id, user_id, provider, email_address, access_token, refresh_token, token_expires_at, scope, status, last_error_message, last_error_at, consecutive_failures",
    )
    .eq("id", accountId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    if (/does not exist/i.test(error.message)) return null;
    logger.warn({ err: error.message, accountId }, "[calendar-sync] load account failed");
    return null;
  }
  return (data as CalendarAccountRow) || null;
}

function eventTimes(p: AppointmentPushPayload, providerKind: "google" | "outlook") {
  if (p.allDay) {
    const startDate = p.startAt.slice(0, 10);
    const endInclusive = p.endAt.slice(0, 10);
    const endExclusive = (() => {
      const d = new Date(`${endInclusive}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + 1);
      return d.toISOString().slice(0, 10);
    })();
    if (providerKind === "google") {
      return { start: { date: startDate }, end: { date: endExclusive } };
    }
    return {
      start: { dateTime: `${startDate}T00:00:00`, timeZone: "UTC" },
      end: { dateTime: `${endExclusive}T00:00:00`, timeZone: "UTC" },
      isAllDay: true,
    };
  }
  if (providerKind === "google") {
    return {
      start: { dateTime: p.startAt, timeZone: "UTC" },
      end: { dateTime: p.endAt, timeZone: "UTC" },
    };
  }
  return {
    start: { dateTime: p.startAt, timeZone: "UTC" },
    end: { dateTime: p.endAt, timeZone: "UTC" },
  };
}

// ---------------------------------------------------------------------------
// Google Calendar push / patch / delete
// ---------------------------------------------------------------------------

async function pushGoogle(
  account: CalendarAccountRow,
  payload: AppointmentPushPayload,
): Promise<AppointmentPushResult | null> {
  const token = await getValidAccessToken(account);
  if (!token) return null;
  const client = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
  client.setCredentials({ access_token: token });
  const calendar = google.calendar({ version: "v3", auth: client });
  try {
    const times = eventTimes(payload, "google");
    const wantsMeet = payload.videoProvider === "meet";
    const requestBody: Record<string, unknown> = {
      summary: payload.title,
      description: payload.description || undefined,
      location: payload.location || undefined,
      ...times,
      attendees: parseParticipantsList(payload.participants).map((email) => ({ email })),
    };
    if (wantsMeet) {
      requestBody["conferenceData"] = {
        createRequest: {
          requestId: randomUUID(),
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      };
    }
    const { data } = await calendar.events.insert({
      calendarId: "primary",
      conferenceDataVersion: wantsMeet ? 1 : 0,
      requestBody,
    });
    if (!data.id) return null;
    const meetUrl =
      data.hangoutLink ||
      data.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")?.uri ||
      null;
    return {
      externalId: data.id,
      calendarId: "primary",
      videoUrl: wantsMeet ? meetUrl : payload.videoUrl ?? null,
    };
  } catch (err: any) {
    logger.warn({ accountId: account.id, err: err.message }, "[calendar-sync] google insert failed");
    return null;
  }
}

async function patchGoogle(
  account: CalendarAccountRow,
  externalId: string,
  payload: AppointmentPushPayload,
): Promise<boolean> {
  const token = await getValidAccessToken(account);
  if (!token) return false;
  const client = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
  client.setCredentials({ access_token: token });
  const calendar = google.calendar({ version: "v3", auth: client });
  try {
    const times = eventTimes(payload, "google");
    await calendar.events.patch({
      calendarId: "primary",
      eventId: externalId,
      requestBody: {
        summary: payload.title,
        description: payload.description || undefined,
        location: payload.location || undefined,
        ...times,
        attendees: parseParticipantsList(payload.participants).map((email) => ({ email })),
      },
    });
    // Note: on patch we do NOT recreate the conference (Google ne supporte
    // pas la mise à jour conference via patch sans risque de casser le
    // hangoutLink déjà partagé). On laisse l'URL existante intacte.
    return true;
  } catch (err: any) {
    logger.warn({ accountId: account.id, externalId, err: err.message }, "[calendar-sync] google patch failed");
    return false;
  }
}

async function deleteGoogle(account: CalendarAccountRow, externalId: string): Promise<boolean> {
  const token = await getValidAccessToken(account);
  if (!token) return false;
  const client = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
  client.setCredentials({ access_token: token });
  const calendar = google.calendar({ version: "v3", auth: client });
  try {
    await calendar.events.delete({ calendarId: "primary", eventId: externalId });
    return true;
  } catch (err: any) {
    if (/410|404/.test(String(err?.code || err?.message || ""))) return true;
    logger.warn({ accountId: account.id, externalId, err: err.message }, "[calendar-sync] google delete failed");
    return false;
  }
}

// ---------------------------------------------------------------------------
// Outlook (Microsoft Graph) push / patch / delete
// ---------------------------------------------------------------------------

interface OutlookTimes {
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  isAllDay?: boolean;
}

function outlookBody(payload: AppointmentPushPayload, includeOnlineMeeting: boolean) {
  const times = eventTimes(payload, "outlook") as OutlookTimes;
  const body: Record<string, unknown> = {
    subject: payload.title,
    body: payload.description ? { contentType: "Text", content: payload.description } : undefined,
    location: payload.location ? { displayName: payload.location } : undefined,
    start: times.start,
    end: times.end,
    isAllDay: times.isAllDay || false,
    attendees: parseParticipantsList(payload.participants).map((email) => ({
      emailAddress: { address: email },
      type: "required",
    })),
  };
  if (includeOnlineMeeting) {
    body["isOnlineMeeting"] = true;
    body["onlineMeetingProvider"] = "teamsForBusiness";
  }
  return body;
}

async function pushOutlook(
  account: CalendarAccountRow,
  payload: AppointmentPushPayload,
): Promise<AppointmentPushResult | null> {
  const token = await getValidAccessToken(account);
  if (!token) return null;
  const wantsTeams = payload.videoProvider === "teams";
  try {
    const resp = await fetch("https://graph.microsoft.com/v1.0/me/events", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(outlookBody(payload, wantsTeams)),
    });
    if (!resp.ok) {
      const txt = await resp.text();
      logger.warn({ accountId: account.id, status: resp.status, body: txt.slice(0, 200) }, "[calendar-sync] outlook insert failed");
      return null;
    }
    const data = (await resp.json()) as {
      id?: string;
      calendar?: { id?: string };
      onlineMeeting?: { joinUrl?: string };
      onlineMeetingUrl?: string;
    };
    if (!data.id) return null;
    const teamsUrl = data.onlineMeeting?.joinUrl || data.onlineMeetingUrl || null;
    return {
      externalId: data.id,
      calendarId: data.calendar?.id || "primary",
      videoUrl: wantsTeams ? teamsUrl : payload.videoUrl ?? null,
      videoJoinUrl: wantsTeams ? teamsUrl : null,
    };
  } catch (err: any) {
    logger.warn({ accountId: account.id, err: err.message }, "[calendar-sync] outlook insert crashed");
    return null;
  }
}

async function patchOutlook(
  account: CalendarAccountRow,
  externalId: string,
  payload: AppointmentPushPayload,
): Promise<boolean> {
  const token = await getValidAccessToken(account);
  if (!token) return false;
  try {
    // PATCH garde isOnlineMeeting tel quel (Graph rejette le retoggle d'un
    // online meeting déjà créé). On envoie le body sans le flag.
    const resp = await fetch(`https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(externalId)}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(outlookBody(payload, false)),
    });
    if (!resp.ok) {
      logger.warn({ accountId: account.id, externalId, status: resp.status }, "[calendar-sync] outlook patch failed");
      return false;
    }
    return true;
  } catch (err: any) {
    logger.warn({ accountId: account.id, externalId, err: err.message }, "[calendar-sync] outlook patch crashed");
    return false;
  }
}

async function deleteOutlook(account: CalendarAccountRow, externalId: string): Promise<boolean> {
  const token = await getValidAccessToken(account);
  if (!token) return false;
  try {
    const resp = await fetch(`https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(externalId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (resp.status === 404 || resp.status === 410) return true;
    if (!resp.ok) {
      logger.warn({ accountId: account.id, externalId, status: resp.status }, "[calendar-sync] outlook delete failed");
      return false;
    }
    return true;
  } catch (err: any) {
    logger.warn({ accountId: account.id, externalId, err: err.message }, "[calendar-sync] outlook delete crashed");
    return false;
  }
}

// ---------------------------------------------------------------------------
// Public façade
// ---------------------------------------------------------------------------

export async function pushAppointmentToProvider(
  userId: string,
  accountId: string,
  payload: AppointmentPushPayload,
): Promise<({ provider: "google" | "outlook" } & AppointmentPushResult) | null> {
  const account = await loadAccount(userId, accountId);
  if (!account || account.status !== "connected") return null;
  if (account.provider === "google") {
    const r = await pushGoogle(account, payload);
    return r ? { provider: "google", ...r } : null;
  }
  if (account.provider === "outlook") {
    const r = await pushOutlook(account, payload);
    return r ? { provider: "outlook", ...r } : null;
  }
  return null;
}

export async function patchAppointmentOnProvider(
  userId: string,
  accountId: string,
  provider: "google" | "outlook",
  externalId: string,
  payload: AppointmentPushPayload,
): Promise<boolean> {
  const account = await loadAccount(userId, accountId);
  if (!account || account.status !== "connected") return false;
  if (account.provider !== provider) return false;
  if (provider === "google") return patchGoogle(account, externalId, payload);
  if (provider === "outlook") return patchOutlook(account, externalId, payload);
  return false;
}

export async function deleteAppointmentOnProvider(
  userId: string,
  accountId: string,
  provider: "google" | "outlook",
  externalId: string,
): Promise<boolean> {
  const account = await loadAccount(userId, accountId);
  if (!account || account.status !== "connected") return false;
  if (account.provider !== provider) return false;
  if (provider === "google") return deleteGoogle(account, externalId);
  if (provider === "outlook") return deleteOutlook(account, externalId);
  return false;
}

// ---------------------------------------------------------------------------
// Inbound pull — fetch external events and upsert them into appointments,
// idempotent via unique idx (user_id, external_provider, external_id).
// Also reconciles deletions: any local row linked to this account whose
// external_id no longer appears in the window is removed.
// ---------------------------------------------------------------------------

interface PulledEvent {
  externalId: string;
  calendarId: string;
  title: string;
  description: string | null;
  location: string | null;
  startAt: string;
  endAt: string;
  allDay: boolean;
  cancelled: boolean;
}

async function pullGoogleEvents(
  account: CalendarAccountRow,
  startISO: string,
  endISO: string,
): Promise<PulledEvent[] | null> {
  const token = await getValidAccessToken(account);
  if (!token) return null;
  const client = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
  client.setCredentials({ access_token: token });
  const calendar = google.calendar({ version: "v3", auth: client });
  try {
    const out: PulledEvent[] = [];
    let pageToken: string | undefined;
    do {
      const { data } = await calendar.events.list({
        calendarId: "primary",
        timeMin: startISO,
        timeMax: endISO,
        singleEvents: true,
        showDeleted: true,
        maxResults: 250,
        pageToken,
      });
      for (const ev of data.items || []) {
        if (!ev.id) continue;
        const allDay = Boolean(ev.start?.date && !ev.start?.dateTime);
        const startAt = ev.start?.dateTime || (ev.start?.date ? `${ev.start.date}T00:00:00Z` : null);
        const endAt = ev.end?.dateTime || (ev.end?.date ? `${ev.end.date}T00:00:00Z` : null);
        if (!startAt || !endAt) continue;
        out.push({
          externalId: ev.id,
          calendarId: "primary",
          title: ev.summary || "(no title)",
          description: ev.description || null,
          location: ev.location || null,
          startAt,
          endAt,
          allDay,
          cancelled: ev.status === "cancelled",
        });
      }
      pageToken = data.nextPageToken || undefined;
    } while (pageToken);
    return out;
  } catch (err: any) {
    logger.warn({ accountId: account.id, err: err.message }, "[calendar-sync] google list failed");
    return null;
  }
}

async function pullOutlookEvents(
  account: CalendarAccountRow,
  startISO: string,
  endISO: string,
): Promise<PulledEvent[] | null> {
  const token = await getValidAccessToken(account);
  if (!token) return null;
  try {
    const url =
      `https://graph.microsoft.com/v1.0/me/calendarView` +
      `?startDateTime=${encodeURIComponent(startISO)}&endDateTime=${encodeURIComponent(endISO)}` +
      `&$top=200&$select=id,subject,bodyPreview,location,start,end,isAllDay,isCancelled`;
    const out: PulledEvent[] = [];
    let next: string | null = url;
    while (next) {
      const resp: Response = await fetch(next, {
        headers: { Authorization: `Bearer ${token}`, Prefer: 'outlook.timezone="UTC"' },
      });
      if (!resp.ok) {
        logger.warn({ accountId: account.id, status: resp.status }, "[calendar-sync] outlook list failed");
        return null;
      }
      interface OutlookEvent {
        id?: string;
        subject?: string;
        bodyPreview?: string;
        location?: { displayName?: string };
        start?: { dateTime?: string };
        end?: { dateTime?: string };
        isAllDay?: boolean;
        isCancelled?: boolean;
      }
      interface OutlookListResponse {
        value?: OutlookEvent[];
        "@odata.nextLink"?: string;
      }
      const data = (await resp.json()) as OutlookListResponse;
      for (const ev of data.value || []) {
        if (!ev.id || !ev.start?.dateTime || !ev.end?.dateTime) continue;
        out.push({
          externalId: ev.id,
          calendarId: "primary",
          title: ev.subject || "(no title)",
          description: ev.bodyPreview || null,
          location: ev.location?.displayName || null,
          startAt: new Date(ev.start.dateTime + "Z").toISOString(),
          endAt: new Date(ev.end.dateTime + "Z").toISOString(),
          allDay: Boolean(ev.isAllDay),
          cancelled: Boolean(ev.isCancelled),
        });
      }
      next = data["@odata.nextLink"] || null;
    }
    return out;
  } catch (err: any) {
    logger.warn({ accountId: account.id, err: err.message }, "[calendar-sync] outlook list crashed");
    return null;
  }
}

export interface PullSyncResult {
  imported: number;
  updated: number;
  deleted: number;
  accounts: number;
  errors: Array<{ accountId: string; error: string }>;
}

export async function pullExternalEventsAndUpsert(
  userId: string,
  startISO: string,
  endISO: string,
): Promise<PullSyncResult> {
  const result: PullSyncResult = { imported: 0, updated: 0, deleted: 0, accounts: 0, errors: [] };
  const { data: accounts, error } = await supabaseAdmin
    .from("calendar_accounts")
    .select(
      "id, user_id, provider, email_address, access_token, refresh_token, token_expires_at, scope, status, last_error_message, last_error_at, consecutive_failures",
    )
    .eq("user_id", userId)
    .eq("status", "connected");
  if (error) {
    if (/does not exist/i.test(error.message)) return result;
    throw new Error(error.message);
  }
  for (const acc of (accounts || []) as CalendarAccountRow[]) {
    result.accounts += 1;
    let events: PulledEvent[] | null = null;
    if (acc.provider === "google") events = await pullGoogleEvents(acc, startISO, endISO);
    else if (acc.provider === "outlook") events = await pullOutlookEvents(acc, startISO, endISO);
    if (events == null) {
      result.errors.push({ accountId: acc.id, error: "fetch_failed" });
      continue;
    }
    const seen = new Set<string>();
    for (const ev of events) {
      seen.add(ev.externalId);
      if (ev.cancelled) {
        const { error: delErr, count } = await supabaseAdmin
          .from("appointments")
          .delete({ count: "exact" })
          .eq("user_id", userId)
          .eq("external_provider", acc.provider)
          .eq("external_id", ev.externalId);
        if (!delErr && (count || 0) > 0) result.deleted += count || 0;
        continue;
      }
      const { data: existing } = await supabaseAdmin
        .from("appointments")
        .select("id")
        .eq("user_id", userId)
        .eq("external_provider", acc.provider)
        .eq("external_id", ev.externalId)
        .maybeSingle();
      const row = {
        user_id: userId,
        title: ev.title,
        description: ev.description,
        location: ev.location,
        start_at: ev.startAt,
        end_at: ev.endAt,
        all_day: ev.allDay,
        calendar_account_id: acc.id,
        external_provider: acc.provider,
        external_id: ev.externalId,
        external_calendar_id: ev.calendarId,
        organizer_email: acc.email_address,
        last_synced_at: new Date().toISOString(),
        last_sync_error: null as string | null,
        updated_at: new Date().toISOString(),
      };
      if (existing) {
        const { error: upErr } = await supabaseAdmin
          .from("appointments")
          .update(row)
          .eq("id", existing.id);
        if (!upErr) result.updated += 1;
      } else {
        const { error: insErr } = await supabaseAdmin
          .from("appointments")
          .insert({ ...row, reminder_minutes: 30, confirmed: true });
        if (!insErr) result.imported += 1;
      }
    }
    // Reconcile deletions: any locally-linked row whose external_id is no
    // longer in the window AND whose start falls inside it → drop.
    const { data: stale } = await supabaseAdmin
      .from("appointments")
      .select("id, external_id")
      .eq("user_id", userId)
      .eq("calendar_account_id", acc.id)
      .gte("start_at", startISO)
      .lte("start_at", endISO);
    for (const row of stale || []) {
      if (row.external_id && !seen.has(row.external_id)) {
        const { error: delErr } = await supabaseAdmin
          .from("appointments")
          .delete()
          .eq("id", row.id);
        if (!delErr) result.deleted += 1;
      }
    }
  }
  return result;
}
