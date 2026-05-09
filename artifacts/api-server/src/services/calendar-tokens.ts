import { google } from "googleapis";
import { supabaseAdmin } from "../lib/supabase";
import { logger } from "../lib/logger";
import { getCalendarOAuthRedirectUri } from "../lib/urls";

const GOOGLE_CLIENT_ID = process.env["GOOGLE_CLIENT_ID"] || "";
const GOOGLE_CLIENT_SECRET = process.env["GOOGLE_CLIENT_SECRET"] || "";
const MICROSOFT_CLIENT_ID = process.env["MICROSOFT_CLIENT_ID"] || "";
const MICROSOFT_CLIENT_SECRET = process.env["MICROSOFT_CLIENT_SECRET"] || "";

export interface CalendarAccountRow {
  id: string;
  user_id: string;
  provider: "google" | "outlook";
  email_address: string;
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string | null;
  scope: string | null;
  status: "connected" | "reauth_required" | "error";
  last_error_message: string | null;
  last_error_at: string | null;
  consecutive_failures: number;
}

const REFRESH_MARGIN_MS = 60 * 1000;

export function getGoogleCalendarOAuth2Client() {
  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    getCalendarOAuthRedirectUri("google"),
  );
}

export const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/userinfo.email",
];

export const OUTLOOK_CALENDAR_SCOPES = [
  "offline_access",
  "openid",
  "email",
  "profile",
  "User.Read",
  "Calendars.ReadWrite",
];

async function markAccountSuccess(accountId: string, patch: Partial<CalendarAccountRow>) {
  await supabaseAdmin
    .from("calendar_accounts")
    .update({
      ...patch,
      status: "connected",
      last_error_message: null,
      last_error_at: null,
      consecutive_failures: 0,
    })
    .eq("id", accountId);
}

async function markAccountFailure(accountId: string, message: string, requiresReauth = false) {
  const { data: current } = await supabaseAdmin
    .from("calendar_accounts")
    .select("consecutive_failures")
    .eq("id", accountId)
    .maybeSingle();
  const failures = ((current as any)?.consecutive_failures ?? 0) + 1;
  await supabaseAdmin
    .from("calendar_accounts")
    .update({
      status: requiresReauth ? "reauth_required" : "error",
      last_error_message: message.slice(0, 500),
      last_error_at: new Date().toISOString(),
      consecutive_failures: failures,
    })
    .eq("id", accountId);
}

/**
 * Renvoie un access_token valide pour le compte calendrier donné. Renouvelle
 * automatiquement via le refresh_token si nécessaire. Retourne null si le
 * compte doit être reconnecté manuellement par l'utilisateur.
 */
export async function getValidAccessToken(account: CalendarAccountRow): Promise<string | null> {
  const expiresAt = account.token_expires_at ? Date.parse(account.token_expires_at) : 0;
  const now = Date.now();
  if (expiresAt && expiresAt - REFRESH_MARGIN_MS > now) {
    return account.access_token;
  }
  if (!account.refresh_token) {
    await markAccountFailure(account.id, "Aucun refresh_token disponible", true);
    return null;
  }
  try {
    if (account.provider === "google") {
      const client = getGoogleCalendarOAuth2Client();
      client.setCredentials({ refresh_token: account.refresh_token });
      const { credentials } = await client.refreshAccessToken();
      const newToken = credentials.access_token;
      const newExpiry = credentials.expiry_date
        ? new Date(credentials.expiry_date).toISOString()
        : new Date(now + 55 * 60 * 1000).toISOString();
      if (!newToken) throw new Error("Google n'a pas renvoyé d'access_token");
      await markAccountSuccess(account.id, {
        access_token: newToken,
        token_expires_at: newExpiry,
      });
      return newToken;
    }
    if (account.provider === "outlook") {
      const params = new URLSearchParams({
        client_id: MICROSOFT_CLIENT_ID,
        client_secret: MICROSOFT_CLIENT_SECRET,
        refresh_token: account.refresh_token,
        grant_type: "refresh_token",
        scope: OUTLOOK_CALENDAR_SCOPES.join(" "),
      });
      const resp = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });
      if (!resp.ok) {
        const text = await resp.text();
        const reauth = resp.status === 400 || resp.status === 401;
        throw new Error(`Microsoft refresh failed (${resp.status}): ${text.slice(0, 200)}__REAUTH=${reauth}`);
      }
      const data = (await resp.json()) as any;
      if (!data.access_token) throw new Error("Microsoft n'a pas renvoyé d'access_token");
      const expiresIn = typeof data.expires_in === "number" ? data.expires_in : 3500;
      await markAccountSuccess(account.id, {
        access_token: data.access_token,
        refresh_token: data.refresh_token || account.refresh_token,
        token_expires_at: new Date(now + expiresIn * 1000).toISOString(),
      });
      return data.access_token as string;
    }
    return null;
  } catch (err: any) {
    const msg = err?.message || String(err);
    const requiresReauth =
      /__REAUTH=true/.test(msg) ||
      /invalid_grant/i.test(msg) ||
      /AADSTS70008/.test(msg) ||
      /AADSTS50173/.test(msg);
    logger.warn(
      { accountId: account.id, provider: account.provider, err: msg.replace(/__REAUTH=\w+/, "") },
      "[calendar-tokens] refresh failed",
    );
    await markAccountFailure(account.id, msg.replace(/__REAUTH=\w+/, ""), requiresReauth);
    return null;
  }
}

export async function getActiveCalendarAccountsForUser(userId: string): Promise<CalendarAccountRow[]> {
  const { data, error } = await supabaseAdmin
    .from("calendar_accounts")
    .select(
      "id, user_id, provider, email_address, access_token, refresh_token, token_expires_at, scope, status, last_error_message, last_error_at, consecutive_failures",
    )
    .eq("user_id", userId)
    .eq("status", "connected");
  if (error) {
    if (/does not exist/i.test(error.message)) return [];
    logger.warn({ userId, err: error.message }, "[calendar-tokens] list accounts failed");
    return [];
  }
  return (data || []) as CalendarAccountRow[];
}
