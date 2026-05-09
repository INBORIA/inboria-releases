import { google } from "googleapis";
import { supabaseAdmin } from "../lib/supabase";
import { logger } from "../lib/logger";
import {
  getActiveCalendarAccountsForUser,
  getValidAccessToken,
  type CalendarAccountRow,
} from "./calendar-tokens";

const GOOGLE_CLIENT_ID = process.env["GOOGLE_CLIENT_ID"] || "";
const GOOGLE_CLIENT_SECRET = process.env["GOOGLE_CLIENT_SECRET"] || "";

export interface BusySlot {
  start: number;
  end: number;
}

export interface CommonSlotResult {
  start: string;
  end: string;
}

async function fetchUserBusy(userId: string, startMs: number, endMs: number): Promise<BusySlot[]> {
  const accounts = await getActiveCalendarAccountsForUser(userId);
  if (accounts.length === 0) return [];
  const startIso = new Date(startMs).toISOString();
  const endIso = new Date(endMs).toISOString();
  const slots: BusySlot[] = [];

  for (const account of accounts) {
    try {
      if (account.provider === "google") {
        const token = await getValidAccessToken(account);
        if (!token) continue;
        const client = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
        client.setCredentials({ access_token: token });
        const cal = google.calendar({ version: "v3", auth: client });
        const { data } = await cal.freebusy.query({
          requestBody: { timeMin: startIso, timeMax: endIso, items: [{ id: "primary" }] },
        });
        const busy = (data.calendars?.["primary"]?.busy || []) as Array<{ start: string; end: string }>;
        for (const b of busy) {
          const s = new Date(b.start).getTime();
          const e = new Date(b.end).getTime();
          if (!isNaN(s) && !isNaN(e)) slots.push({ start: s, end: e });
        }
      } else if (account.provider === "outlook") {
        const token = await getValidAccessToken(account);
        if (!token) continue;
        const resp = await fetch("https://graph.microsoft.com/v1.0/me/calendar/getSchedule", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            schedules: [account.email_address],
            startTime: { dateTime: startIso, timeZone: "UTC" },
            endTime: { dateTime: endIso, timeZone: "UTC" },
            availabilityViewInterval: 30,
          }),
        });
        if (!resp.ok) continue;
        const data = (await resp.json()) as {
          value?: Array<{ scheduleItems?: Array<{ start?: { dateTime?: string }; end?: { dateTime?: string } }> }>;
        };
        const items = data.value?.[0]?.scheduleItems || [];
        for (const it of items) {
          const sRaw = it.start?.dateTime;
          const eRaw = it.end?.dateTime;
          if (!sRaw || !eRaw) continue;
          const sIso = /Z$|[+-]\d{2}:?\d{2}$/.test(sRaw) ? sRaw : sRaw + "Z";
          const eIso = /Z$|[+-]\d{2}:?\d{2}$/.test(eRaw) ? eRaw : eRaw + "Z";
          const s = new Date(sIso).getTime();
          const e = new Date(eIso).getTime();
          if (!isNaN(s) && !isNaN(e)) slots.push({ start: s, end: e });
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(
        { err: msg, accountId: (account as CalendarAccountRow).id },
        "[freebusy] fetch failed (best-effort skip)",
      );
    }
  }
  return slots;
}

function mergeBusy(slots: BusySlot[]): BusySlot[] {
  if (slots.length <= 1) return slots;
  const sorted = [...slots].sort((a, b) => a.start - b.start);
  const out: BusySlot[] = [];
  for (const s of sorted) {
    const last = out[out.length - 1];
    if (last && s.start <= last.end) {
      last.end = Math.max(last.end, s.end);
    } else {
      out.push({ ...s });
    }
  }
  return out;
}

/**
 * Résout des emails de participants vers des userIds NCV Mail (membres de la
 * même organisation que l'organisateur). Retourne uniquement ceux qui ont un
 * compte actif et au moins un calendrier connecté — les autres seront traités
 * comme "externes" (3 créneaux candidats au lieu de l'intersection libre).
 */
export async function resolveInternalParticipants(
  organizerUserId: string,
  emails: string[],
): Promise<{ internal: Array<{ userId: string; email: string }>; external: string[] }> {
  if (emails.length === 0) return { internal: [], external: [] };
  const norm = emails.map((e) => e.toLowerCase().trim()).filter(Boolean);
  const internal: Array<{ userId: string; email: string }> = [];
  const external: string[] = [];

  // Organisation de l'organisateur
  const { data: orgMember } = await supabaseAdmin
    .from("organisation_members")
    .select("organisation_id")
    .eq("user_id", organizerUserId)
    .maybeSingle();
  const orgId = (orgMember as { organisation_id?: string } | null)?.organisation_id;

  if (!orgId) {
    return { internal: [], external: norm };
  }

  // Membres internes via auth users + organisation_members
  const { data: members } = await supabaseAdmin
    .from("organisation_members")
    .select("user_id, profiles:profiles!inner(id, email)")
    .eq("organisation_id", orgId);

  const memberMap = new Map<string, string>();
  for (const row of (members as Array<{ user_id: string; profiles: { email: string | null } | null }> | null) || []) {
    const e = row.profiles?.email?.toLowerCase();
    if (e) memberMap.set(e, row.user_id);
  }

  const candidateUids: string[] = [];
  const emailByUid = new Map<string, string>();
  for (const e of norm) {
    const uid = memberMap.get(e);
    if (uid) {
      candidateUids.push(uid);
      emailByUid.set(uid, e);
    } else {
      external.push(e);
    }
  }

  // Vérifie qu'au moins un calendrier connecté est actif pour chaque candidat.
  // Sinon, on ne peut pas intersecter sa disponibilité — il bascule en externe.
  const uidsWithCalendar = new Set<string>();
  if (candidateUids.length > 0) {
    const { data: cals } = await supabaseAdmin
      .from("calendar_accounts")
      .select("user_id, status")
      .in("user_id", candidateUids);
    for (const row of (cals as Array<{ user_id: string; status: string | null }> | null) || []) {
      if (!row.status || row.status === "active" || row.status === "connected") {
        uidsWithCalendar.add(row.user_id);
      }
    }
  }

  for (const uid of candidateUids) {
    const e = emailByUid.get(uid)!;
    if (uidsWithCalendar.has(uid)) internal.push({ userId: uid, email: e });
    else external.push(e);
  }
  return { internal, external };
}

export interface CommonSlotOptions {
  durationMinutes: number;
  windowDays?: number;
  workingHourStart?: number; // 0..23 in user local UTC offset (UTC-based here)
  workingHourEnd?: number;
  k?: number;
  granularityMinutes?: number;
}

/**
 * Cherche les K meilleurs créneaux libres communs à un ensemble d'utilisateurs
 * internes (intersection des plages libres) sur la fenêtre demandée. Retourne
 * un tableau trié par date croissante. Si aucun utilisateur fourni, renvoie [].
 *
 * Algorithme simple : on agrège tous les busy de tous les participants,
 * fusionne, puis balaie la fenêtre par créneaux glissants à granularité 30 min
 * en heures ouvrées et garde les K premiers qui ne chevauchent aucun busy.
 */
export async function findCommonSlots(
  userIds: string[],
  opts: CommonSlotOptions,
): Promise<CommonSlotResult[]> {
  if (userIds.length === 0) return [];
  const now = Date.now();
  const windowDays = opts.windowDays ?? 14;
  const horizonMs = now + windowDays * 24 * 3600 * 1000;
  const durationMs = opts.durationMinutes * 60 * 1000;
  const granularityMs = (opts.granularityMinutes ?? 30) * 60 * 1000;
  const workStart = opts.workingHourStart ?? 9;
  const workEnd = opts.workingHourEnd ?? 18;
  const k = opts.k ?? 3;

  const allBusy: BusySlot[] = [];
  for (const uid of userIds) {
    const slots = await fetchUserBusy(uid, now, horizonMs);
    allBusy.push(...slots);
  }
  const merged = mergeBusy(allBusy);

  const out: CommonSlotResult[] = [];
  // Démarre au prochain quart d'heure rond pour proposer du joli.
  let cursor = Math.ceil(now / granularityMs) * granularityMs;
  while (cursor + durationMs <= horizonMs && out.length < k) {
    const slotStart = new Date(cursor);
    const slotEnd = new Date(cursor + durationMs);
    const hour = slotStart.getUTCHours();
    const dayOfWeek = slotStart.getUTCDay();
    const isWorkday = dayOfWeek >= 1 && dayOfWeek <= 5;
    const inWorkingHours = hour >= workStart && slotEnd.getUTCHours() <= workEnd && hour < workEnd;
    if (isWorkday && inWorkingHours) {
      const overlap = merged.some(
        (b) => b.start < slotEnd.getTime() && b.end > slotStart.getTime(),
      );
      if (!overlap) {
        out.push({ start: slotStart.toISOString(), end: slotEnd.toISOString() });
      }
    }
    cursor += granularityMs;
  }
  return out;
}
