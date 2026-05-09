import { Router, type IRouter } from "express";
import { google } from "googleapis";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth } from "../middlewares/auth";
import { logger } from "../lib/logger";
import {
  GOOGLE_CALENDAR_SCOPES,
  OUTLOOK_CALENDAR_SCOPES,
  getGoogleCalendarOAuth2Client,
  getValidAccessToken,
  getActiveCalendarAccountsForUser,
  type CalendarAccountRow,
} from "../services/calendar-tokens";
import { getCalendarOAuthRedirectUri } from "../lib/urls";

const router: IRouter = Router();

const MICROSOFT_CLIENT_ID = process.env["MICROSOFT_CLIENT_ID"] || "";
const MICROSOFT_CLIENT_SECRET = process.env["MICROSOFT_CLIENT_SECRET"] || "";
const GOOGLE_CLIENT_ID = process.env["GOOGLE_CLIENT_ID"] || "";
const GOOGLE_CLIENT_SECRET = process.env["GOOGLE_CLIENT_SECRET"] || "";

const FREEBUSY_CACHE = new Map<string, { at: number; busy: Array<{ start: string; end: string }> }>();
const FREEBUSY_CACHE_TTL_MS = 5 * 60 * 1000;

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function popupHtml(title: string, providerKey: string, ok: boolean, message: string): string {
  const color = ok ? "#10b981" : "#ef4444";
  const provSafe = providerKey === "google" || providerKey === "outlook" ? providerKey : "unknown";
  return `<html><body style="font-family:-apple-system,sans-serif;background:#0d1117;color:#fff;padding:40px;max-width:520px;margin:0 auto;line-height:1.5;">
<h2 style="color:${color};margin-top:0;">${escHtml(title)}</h2>
<p>${escHtml(message)}</p>
<p style="color:#6b7280;font-size:11px;margin-top:24px;">Vous pouvez fermer cette fenêtre.</p>
<script>
try { window.opener && window.opener.postMessage({ type: 'calendar-connected', provider: ${JSON.stringify(provSafe)}, ok: ${ok ? "true" : "false"} }, '*'); } catch (e) {}
setTimeout(function(){ window.close(); }, 800);
</script>
</body></html>`;
}

// ---------------------------------------------------------------------------
// OAuth Google Calendar
// ---------------------------------------------------------------------------

router.get("/calendar/connect/google", requireAuth, async (req, res): Promise<void> => {
  try {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      res.status(500).json({ error: "Google OAuth non configuré côté serveur" });
      return;
    }
    const client = getGoogleCalendarOAuth2Client();
    const url = client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: GOOGLE_CALENDAR_SCOPES,
      state: req.userId,
    });
    res.json({ url });
  } catch (err: any) {
    logger.error({ err: err.message }, "[calendar] generate google auth url failed");
    res.status(500).json({ error: "Impossible de générer l'URL Google Calendar" });
  }
});

router.get("/calendar/callback/google", async (req, res): Promise<void> => {
  try {
    const code = req.query["code"] as string | undefined;
    const userId = req.query["state"] as string | undefined;
    if (!code || !userId) {
      res.status(400).send(popupHtml("Connexion impossible", "google", false, "Paramètres manquants."));
      return;
    }
    const client = getGoogleCalendarOAuth2Client();
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    const grantedScope = (tokens.scope || "").toString();
    if (!grantedScope.includes("calendar")) {
      res.status(400).send(
        popupHtml(
          "Permission calendrier non accordée",
          "google",
          false,
          "Vous devez cocher la case d'accès à votre calendrier Google pour continuer.",
        ),
      );
      return;
    }

    const oauth2 = google.oauth2({ version: "v2", auth: client });
    const userInfo = await oauth2.userinfo.get();
    const email = userInfo.data.email;
    if (!email) {
      res.status(400).send(popupHtml("Adresse introuvable", "google", false, "Impossible de récupérer votre email Google."));
      return;
    }

    const row = {
      user_id: userId,
      provider: "google" as const,
      email_address: email,
      access_token: tokens.access_token || "",
      refresh_token: tokens.refresh_token || null,
      token_expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
      scope: grantedScope,
      status: "connected" as const,
      last_error_message: null,
      last_error_at: null,
      consecutive_failures: 0,
    };

    const { error } = await supabaseAdmin
      .from("calendar_accounts")
      .upsert(row, { onConflict: "user_id,provider,email_address" });
    if (error) {
      logger.error({ err: error.message }, "[calendar] google upsert failed");
      res.status(500).send(popupHtml("Enregistrement échoué", "google", false, "Veuillez réessayer dans un instant."));
      return;
    }

    res.send(popupHtml("Google Calendar connecté", "google", true, `Calendrier ${email} relié à NCV Mail.`));
  } catch (err: any) {
    logger.error({ err: err.message }, "[calendar] google callback failed");
    res.status(500).send(popupHtml("Connexion échouée", "google", false, err.message || "Erreur inconnue."));
  }
});

// ---------------------------------------------------------------------------
// OAuth Microsoft Outlook Calendar
// ---------------------------------------------------------------------------

router.get("/calendar/connect/outlook", requireAuth, async (req, res): Promise<void> => {
  try {
    if (!MICROSOFT_CLIENT_ID || !MICROSOFT_CLIENT_SECRET) {
      res.status(500).json({ error: "Microsoft OAuth non configuré côté serveur" });
      return;
    }
    const redirectUri = getCalendarOAuthRedirectUri("outlook");
    const params = new URLSearchParams({
      client_id: MICROSOFT_CLIENT_ID,
      response_type: "code",
      redirect_uri: redirectUri,
      response_mode: "query",
      scope: OUTLOOK_CALENDAR_SCOPES.join(" "),
      state: req.userId || "",
      prompt: "consent",
    });
    const url = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
    res.json({ url });
  } catch (err: any) {
    logger.error({ err: err.message }, "[calendar] generate outlook auth url failed");
    res.status(500).json({ error: "Impossible de générer l'URL Outlook Calendar" });
  }
});

router.get("/calendar/callback/outlook", async (req, res): Promise<void> => {
  try {
    const code = req.query["code"] as string | undefined;
    const userId = req.query["state"] as string | undefined;
    if (!code || !userId) {
      res.status(400).send(popupHtml("Connexion impossible", "outlook", false, "Paramètres manquants."));
      return;
    }
    const redirectUri = getCalendarOAuthRedirectUri("outlook");
    const tokenParams = new URLSearchParams({
      client_id: MICROSOFT_CLIENT_ID,
      client_secret: MICROSOFT_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      scope: OUTLOOK_CALENDAR_SCOPES.join(" "),
    });
    const tokenResp = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenParams.toString(),
    });
    if (!tokenResp.ok) {
      const txt = await tokenResp.text();
      logger.warn({ status: tokenResp.status, body: txt.slice(0, 200) }, "[calendar] outlook token exchange failed");
      res.status(400).send(popupHtml("Connexion échouée", "outlook", false, "Microsoft a refusé l'autorisation."));
      return;
    }
    const tokens = (await tokenResp.json()) as any;

    const profileResp = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    let email: string | null = null;
    if (profileResp.ok) {
      const profile = (await profileResp.json()) as any;
      email = profile.mail || profile.userPrincipalName || null;
    }
    if (!email && tokens.id_token) {
      try {
        const payload = JSON.parse(
          Buffer.from(String(tokens.id_token).split(".")[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"),
        );
        email = payload.email || payload.preferred_username || null;
      } catch {
        /* ignore */
      }
    }
    if (!email) {
      res.status(400).send(popupHtml("Adresse introuvable", "outlook", false, "Impossible de récupérer votre email Microsoft."));
      return;
    }

    const expiresIn = typeof tokens.expires_in === "number" ? tokens.expires_in : 3500;
    const row = {
      user_id: userId,
      provider: "outlook" as const,
      email_address: email,
      access_token: tokens.access_token || "",
      refresh_token: tokens.refresh_token || null,
      token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
      scope: tokens.scope || OUTLOOK_CALENDAR_SCOPES.join(" "),
      status: "connected" as const,
      last_error_message: null,
      last_error_at: null,
      consecutive_failures: 0,
    };

    const { error } = await supabaseAdmin
      .from("calendar_accounts")
      .upsert(row, { onConflict: "user_id,provider,email_address" });
    if (error) {
      logger.error({ err: error.message }, "[calendar] outlook upsert failed");
      res.status(500).send(popupHtml("Enregistrement échoué", "outlook", false, "Veuillez réessayer dans un instant."));
      return;
    }

    res.send(popupHtml("Outlook Calendar connecté", "outlook", true, `Calendrier ${email} relié à NCV Mail.`));
  } catch (err: any) {
    logger.error({ err: err.message }, "[calendar] outlook callback failed");
    res.status(500).send(popupHtml("Connexion échouée", "outlook", false, err.message || "Erreur inconnue."));
  }
});

// ---------------------------------------------------------------------------
// Liste / déconnexion
// ---------------------------------------------------------------------------

router.get("/calendar/accounts", requireAuth, async (req, res): Promise<void> => {
  try {
    const { data, error } = await supabaseAdmin
      .from("calendar_accounts")
      .select("id, provider, email_address, status, last_error_message, last_error_at, last_synced_at:created_at, created_at")
      .eq("user_id", req.userId!)
      .order("created_at", { ascending: true });
    if (error) {
      if (/does not exist/i.test(error.message)) {
        res.json({ accounts: [], schemaMissing: true });
        return;
      }
      logger.error({ err: error.message }, "[calendar] list accounts failed");
      res.status(500).json({ error: "Impossible de lister les calendriers" });
      return;
    }
    res.json({ accounts: data || [] });
  } catch (err: any) {
    logger.error({ err: err.message }, "[calendar] list accounts crashed");
    res.status(500).json({ error: "Erreur interne" });
  }
});

router.delete("/calendar/accounts/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const id = req.params["id"];
    if (!id) {
      res.status(400).json({ error: "id manquant" });
      return;
    }
    const { data: account } = await supabaseAdmin
      .from("calendar_accounts")
      .select("id, provider, refresh_token, access_token")
      .eq("id", id)
      .eq("user_id", req.userId!)
      .maybeSingle();
    if (!account) {
      res.status(404).json({ error: "Calendrier introuvable" });
      return;
    }

    // Best-effort revoke
    try {
      if (account.provider === "google" && (account.refresh_token || account.access_token)) {
        const token = account.refresh_token || account.access_token;
        await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, { method: "POST" });
      }
    } catch (e: any) {
      logger.warn({ err: e.message }, "[calendar] revoke failed (ignored)");
    }

    const { error: delErr } = await supabaseAdmin
      .from("calendar_accounts")
      .delete()
      .eq("id", id)
      .eq("user_id", req.userId!);
    if (delErr) {
      res.status(500).json({ error: "Suppression échouée" });
      return;
    }
    res.json({ ok: true });
  } catch (err: any) {
    logger.error({ err: err.message }, "[calendar] disconnect crashed");
    res.status(500).json({ error: "Erreur interne" });
  }
});

// ---------------------------------------------------------------------------
// Helpers free/busy + events
// ---------------------------------------------------------------------------

/**
 * Microsoft Graph dateTime peut arriver sans suffixe TZ (ISO local UTC quand
 * on demande Prefer: outlook.timezone="UTC") ou avec un offset/Z. On uniformise
 * en ajoutant 'Z' uniquement si aucun suffixe TZ n'est présent.
 */
function parseGraphDate(dt: string | null | undefined): string | null {
  if (!dt || typeof dt !== "string") return null;
  const hasTz = /Z$|[+-]\d{2}:?\d{2}$/.test(dt);
  const iso = hasTz ? dt : dt + "Z";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

function parseRange(req: any): { start: Date; end: Date } | null {
  const startRaw = req.query?.["start"] as string | undefined;
  const endRaw = req.query?.["end"] as string | undefined;
  const start = startRaw ? new Date(startRaw) : new Date();
  const end = endRaw ? new Date(endRaw) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
  if (end.getTime() <= start.getTime()) return null;
  // Hard cap : 60 jours
  if (end.getTime() - start.getTime() > 60 * 24 * 60 * 60 * 1000) return null;
  return { start, end };
}

async function fetchGoogleBusy(account: CalendarAccountRow, start: Date, end: Date): Promise<Array<{ start: string; end: string }>> {
  const token = await getValidAccessToken(account);
  if (!token) return [];
  const client = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
  client.setCredentials({ access_token: token });
  const calendar = google.calendar({ version: "v3", auth: client });
  try {
    const { data } = await calendar.freebusy.query({
      requestBody: {
        timeMin: start.toISOString(),
        timeMax: end.toISOString(),
        items: [{ id: "primary" }],
      },
    });
    const busy = (data.calendars?.["primary"]?.busy || []) as Array<{ start: string; end: string }>;
    return busy.filter((b) => !!b.start && !!b.end);
  } catch (err: any) {
    logger.warn({ accountId: account.id, err: err.message }, "[calendar] google freebusy failed");
    return [];
  }
}

async function fetchOutlookBusy(account: CalendarAccountRow, start: Date, end: Date): Promise<Array<{ start: string; end: string }>> {
  const token = await getValidAccessToken(account);
  if (!token) return [];
  try {
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
    if (!resp.ok) return [];
    const data = (await resp.json()) as any;
    const items = data.value?.[0]?.scheduleItems || [];
    return items
      .map((it: any) => ({ start: parseGraphDate(it.start?.dateTime), end: parseGraphDate(it.end?.dateTime) }))
      .filter((it: { start: string | null; end: string | null }) => !!it.start && !!it.end) as Array<{ start: string; end: string }>;
  } catch (err: any) {
    logger.warn({ accountId: account.id, err: err.message }, "[calendar] outlook freebusy failed");
    return [];
  }
}

interface NormalizedEvent {
  id: string;
  source: "google" | "outlook";
  account_id: string;
  account_email: string;
  title: string;
  description: string | null;
  location: string | null;
  start: string;
  end: string;
  all_day: boolean;
  organizer: string | null;
  participants: string[];
  html_link: string | null;
}

async function fetchGoogleEvents(account: CalendarAccountRow, start: Date, end: Date): Promise<NormalizedEvent[]> {
  const token = await getValidAccessToken(account);
  if (!token) return [];
  const client = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
  client.setCredentials({ access_token: token });
  const calendar = google.calendar({ version: "v3", auth: client });
  try {
    const { data } = await calendar.events.list({
      calendarId: "primary",
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 250,
    });
    return (data.items || []).map((ev) => {
      const allDay = !!ev.start?.date && !ev.start?.dateTime;
      const startStr = ev.start?.dateTime || (ev.start?.date ? `${ev.start.date}T00:00:00.000Z` : new Date().toISOString());
      const endStr = ev.end?.dateTime || (ev.end?.date ? `${ev.end.date}T00:00:00.000Z` : startStr);
      return {
        id: ev.id || "",
        source: "google" as const,
        account_id: account.id,
        account_email: account.email_address,
        title: ev.summary || "(Sans titre)",
        description: ev.description || null,
        location: ev.location || null,
        start: new Date(startStr).toISOString(),
        end: new Date(endStr).toISOString(),
        all_day: allDay,
        organizer: ev.organizer?.email || null,
        participants: (ev.attendees || []).map((a) => a.email).filter((e): e is string => !!e),
        html_link: ev.htmlLink || null,
      };
    });
  } catch (err: any) {
    logger.warn({ accountId: account.id, err: err.message }, "[calendar] google events failed");
    return [];
  }
}

async function fetchOutlookEvents(account: CalendarAccountRow, start: Date, end: Date): Promise<NormalizedEvent[]> {
  const token = await getValidAccessToken(account);
  if (!token) return [];
  try {
    const url =
      `https://graph.microsoft.com/v1.0/me/calendarview?` +
      `startDateTime=${encodeURIComponent(start.toISOString())}` +
      `&endDateTime=${encodeURIComponent(end.toISOString())}` +
      `&$top=250&$orderby=start/dateTime`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Prefer: 'outlook.timezone="UTC"' },
    });
    if (!resp.ok) return [];
    const data = (await resp.json()) as any;
    const items = (data.value || []) as any[];
    return items.map((ev) => {
      const startIso = parseGraphDate(ev.start?.dateTime) || new Date().toISOString();
      const endIso = parseGraphDate(ev.end?.dateTime) || startIso;
      return {
        id: ev.id || "",
        source: "outlook" as const,
        account_id: account.id,
        account_email: account.email_address,
        title: ev.subject || "(Sans titre)",
        description: ev.bodyPreview || null,
        location: ev.location?.displayName || null,
        start: startIso,
        end: endIso,
        all_day: !!ev.isAllDay,
        organizer: ev.organizer?.emailAddress?.address || null,
        participants: (ev.attendees || []).map((a: any) => a.emailAddress?.address).filter((e: any): e is string => !!e),
        html_link: ev.webLink || null,
      };
    });
  } catch (err: any) {
    logger.warn({ accountId: account.id, err: err.message }, "[calendar] outlook events failed");
    return [];
  }
}

function mergeBusy(slots: Array<{ start: string; end: string }>): Array<{ start: string; end: string }> {
  if (slots.length <= 1) return slots;
  const sorted = [...slots]
    .map((s) => ({ start: new Date(s.start).getTime(), end: new Date(s.end).getTime() }))
    .filter((s) => !isNaN(s.start) && !isNaN(s.end))
    .sort((a, b) => a.start - b.start);
  const merged: Array<{ start: number; end: number }> = [];
  for (const s of sorted) {
    const last = merged[merged.length - 1];
    if (last && s.start <= last.end) {
      last.end = Math.max(last.end, s.end);
    } else {
      merged.push({ ...s });
    }
  }
  return merged.map((s) => ({ start: new Date(s.start).toISOString(), end: new Date(s.end).toISOString() }));
}

// ---------------------------------------------------------------------------
// /api/calendar/freebusy
// ---------------------------------------------------------------------------

router.get("/calendar/freebusy", requireAuth, async (req, res): Promise<void> => {
  const range = parseRange(req);
  if (!range) {
    res.status(400).json({ error: "Plage start/end invalide (max 60 jours)" });
    return;
  }
  const cacheKey = `${req.userId}|${range.start.toISOString()}|${range.end.toISOString()}`;
  const cached = FREEBUSY_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.at < FREEBUSY_CACHE_TTL_MS) {
    res.json({ busy: cached.busy, cached: true });
    return;
  }

  const accounts = await getActiveCalendarAccountsForUser(req.userId!);
  if (accounts.length === 0) {
    res.json({ busy: [], accounts: 0 });
    return;
  }

  const results = await Promise.all(
    accounts.map((acc) =>
      acc.provider === "google" ? fetchGoogleBusy(acc, range.start, range.end) : fetchOutlookBusy(acc, range.start, range.end),
    ),
  );
  const merged = mergeBusy(results.flat());
  FREEBUSY_CACHE.set(cacheKey, { at: Date.now(), busy: merged });
  res.json({ busy: merged, accounts: accounts.length });
});

// ---------------------------------------------------------------------------
// /api/calendar/events
// ---------------------------------------------------------------------------

router.get("/calendar/events", requireAuth, async (req, res): Promise<void> => {
  const range = parseRange(req);
  if (!range) {
    res.status(400).json({ error: "Plage start/end invalide (max 60 jours)" });
    return;
  }
  const accounts = await getActiveCalendarAccountsForUser(req.userId!);
  if (accounts.length === 0) {
    res.json({ events: [], accounts: 0 });
    return;
  }
  const results = await Promise.all(
    accounts.map((acc) =>
      acc.provider === "google" ? fetchGoogleEvents(acc, range.start, range.end) : fetchOutlookEvents(acc, range.start, range.end),
    ),
  );
  const events = results.flat().sort((a, b) => a.start.localeCompare(b.start));
  res.json({ events, accounts: accounts.length });
});

export default router;
