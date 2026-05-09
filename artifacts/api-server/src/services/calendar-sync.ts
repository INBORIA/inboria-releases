import { google } from "googleapis";
import { supabaseAdmin } from "../lib/supabase";
import { logger } from "../lib/logger";
import {
  getValidAccessToken,
  type CalendarAccountRow,
} from "./calendar-tokens";

const GOOGLE_CLIENT_ID = process.env["GOOGLE_CLIENT_ID"] || "";
const GOOGLE_CLIENT_SECRET = process.env["GOOGLE_CLIENT_SECRET"] || "";

export interface AppointmentPushPayload {
  title: string;
  description?: string | null;
  location?: string | null;
  startAt: string;
  endAt: string;
  allDay?: boolean | null;
  participants?: string | null;
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
): Promise<{ externalId: string; calendarId: string } | null> {
  const token = await getValidAccessToken(account);
  if (!token) return null;
  const client = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
  client.setCredentials({ access_token: token });
  const calendar = google.calendar({ version: "v3", auth: client });
  try {
    const times = eventTimes(payload, "google");
    const { data } = await calendar.events.insert({
      calendarId: "primary",
      requestBody: {
        summary: payload.title,
        description: payload.description || undefined,
        location: payload.location || undefined,
        ...times,
        attendees: parseParticipantsList(payload.participants).map((email) => ({ email })),
      },
    });
    if (!data.id) return null;
    return { externalId: data.id, calendarId: "primary" };
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

function outlookBody(payload: AppointmentPushPayload) {
  const times = eventTimes(payload, "outlook") as any;
  return {
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
}

async function pushOutlook(
  account: CalendarAccountRow,
  payload: AppointmentPushPayload,
): Promise<{ externalId: string; calendarId: string } | null> {
  const token = await getValidAccessToken(account);
  if (!token) return null;
  try {
    const resp = await fetch("https://graph.microsoft.com/v1.0/me/events", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(outlookBody(payload)),
    });
    if (!resp.ok) {
      const txt = await resp.text();
      logger.warn({ accountId: account.id, status: resp.status, body: txt.slice(0, 200) }, "[calendar-sync] outlook insert failed");
      return null;
    }
    const data = (await resp.json()) as any;
    if (!data.id) return null;
    return { externalId: data.id, calendarId: data.calendar?.id || "primary" };
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
    const resp = await fetch(`https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(externalId)}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(outlookBody(payload)),
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
): Promise<{ provider: "google" | "outlook"; externalId: string; calendarId: string } | null> {
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
