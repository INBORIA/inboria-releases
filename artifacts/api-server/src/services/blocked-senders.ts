import { google } from "googleapis";
import { supabaseAdmin } from "../lib/supabase";
import { logger } from "../lib/logger";
import { fetchWithTimeout } from "./connection-health";

const HTTP_TIMEOUT_MS = 20_000;

export type Provider = "google" | "microsoft" | "imap";

export interface ConnectionForBlock {
  id: string;
  provider: string;
  email_address: string;
  access_token: string;
  refresh_token: string;
  token_expires_at?: string | null;
}

export interface ProviderBlockResult {
  ok: boolean;
  providerRuleId: string | null;
  reason?: "unsupported_provider" | "auth_failed" | "api_error";
  message?: string;
}

function getGoogleOAuth2Client() {
  const clientId = process.env["GOOGLE_CLIENT_ID"] || "";
  const clientSecret = process.env["GOOGLE_CLIENT_SECRET"] || "";
  return new google.auth.OAuth2(clientId, clientSecret);
}

async function persistRefreshedTokens(
  connId: string,
  tokens: {
    access_token?: string;
    refresh_token?: string;
    expiry_date?: number;
    expires_in?: number;
  },
): Promise<void> {
  const updates: Record<string, any> = {};
  if (tokens.access_token) updates.access_token = tokens.access_token;
  if (tokens.refresh_token) updates.refresh_token = tokens.refresh_token;
  if (tokens.expiry_date) {
    updates.token_expires_at = new Date(tokens.expiry_date).toISOString();
  } else if (tokens.expires_in) {
    updates.token_expires_at = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  }
  if (Object.keys(updates).length === 0) return;
  const { error } = await supabaseAdmin
    .from("email_connections")
    .update(updates)
    .eq("id", connId);
  if (error) {
    logger.error(
      { service: "blocked-senders", phase: "token-refresh", connId, err: error.message },
      "Failed to persist refreshed tokens",
    );
  }
}

async function refreshMicrosoftAccessToken(conn: ConnectionForBlock): Promise<string | null> {
  const clientId = process.env["MICROSOFT_CLIENT_ID"] || "";
  const clientSecret = process.env["MICROSOFT_CLIENT_SECRET"] || "";
  if (!clientId || !clientSecret) return null;

  const resp = await fetchWithTimeout(
    "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: conn.refresh_token,
        grant_type: "refresh_token",
        scope: "Mail.ReadWrite offline_access",
      }),
      timeoutMs: HTTP_TIMEOUT_MS,
    },
  );
  if (!resp.ok) return null;
  const tokens = (await resp.json()) as any;
  if (!tokens.access_token) return null;

  await persistRefreshedTokens(conn.id, {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_in: tokens.expires_in,
  });
  return tokens.access_token as string;
}

async function getValidMicrosoftAccessToken(conn: ConnectionForBlock): Promise<string | null> {
  if (conn.token_expires_at && new Date(conn.token_expires_at) < new Date()) {
    return refreshMicrosoftAccessToken(conn);
  }
  return conn.access_token;
}

async function getGmailClient(conn: ConnectionForBlock) {
  const oauth2Client = getGoogleOAuth2Client();
  oauth2Client.setCredentials({
    access_token: conn.access_token,
    refresh_token: conn.refresh_token,
  });
  oauth2Client.on("tokens", (tokens) => {
    void persistRefreshedTokens(conn.id, {
      access_token: tokens.access_token ?? undefined,
      refresh_token: tokens.refresh_token ?? undefined,
      expiry_date: tokens.expiry_date ?? undefined,
    });
  });
  return google.gmail({ version: "v1", auth: oauth2Client });
}

function normalizeEmail(addr: string): string {
  return addr.trim().toLowerCase();
}

export interface BlockSenderDeps {
  fetchGraph?: typeof fetchWithTimeout;
  buildGmail?: (conn: ConnectionForBlock) => Promise<any>;
  resolveMsToken?: (conn: ConnectionForBlock) => Promise<string | null>;
}

export async function blockSenderOnProvider(
  conn: ConnectionForBlock,
  emailAddress: string,
  deps: BlockSenderDeps = {},
): Promise<ProviderBlockResult> {
  const log = logger.child({
    service: "blocked-senders",
    connId: conn.id,
    provider: conn.provider,
    target: emailAddress,
  });
  const target = normalizeEmail(emailAddress);

  if (conn.provider === "microsoft" || conn.provider === "outlook") {
    const accessToken = await (deps.resolveMsToken ?? getValidMicrosoftAccessToken)(conn);
    if (!accessToken) {
      log.warn("Cannot obtain Microsoft access token");
      return { ok: false, providerRuleId: null, reason: "auth_failed" };
    }
    const fetchFn = deps.fetchGraph ?? fetchWithTimeout;
    const resp = await fetchFn(
      "https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messageRules",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          displayName: `Inboria — Bloquer ${target}`,
          sequence: 1,
          isEnabled: true,
          conditions: {
            fromAddresses: [{ emailAddress: { address: target } }],
          },
          actions: {
            moveToFolder: "junkemail",
            stopProcessingRules: true,
          },
        }),
        timeoutMs: HTTP_TIMEOUT_MS,
      },
    );
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      log.warn({ status: resp.status, body: text.slice(0, 200) }, "Graph messageRules POST failed");
      return { ok: false, providerRuleId: null, reason: "api_error", message: `${resp.status}` };
    }
    const body = (await resp.json()) as any;
    log.info({ ruleId: body?.id }, "Microsoft block rule created");
    return { ok: true, providerRuleId: body?.id ?? null };
  }

  if (conn.provider === "google" || conn.provider === "gmail") {
    const gmail = await (deps.buildGmail ?? getGmailClient)(conn);
    try {
      const { data } = await gmail.users.settings.filters.create({
        userId: "me",
        requestBody: {
          criteria: { from: target },
          action: {
            addLabelIds: ["TRASH"],
            removeLabelIds: ["INBOX"],
          },
        },
      });
      log.info({ filterId: data?.id }, "Gmail block filter created");
      return { ok: true, providerRuleId: data?.id ?? null };
    } catch (err: any) {
      log.warn({ err: err?.message }, "Gmail filter create failed");
      return { ok: false, providerRuleId: null, reason: "api_error", message: err?.message };
    }
  }

  return { ok: false, providerRuleId: null, reason: "unsupported_provider" };
}

export async function unblockSenderOnProvider(
  conn: ConnectionForBlock,
  providerRuleId: string | null,
  deps: BlockSenderDeps = {},
): Promise<ProviderBlockResult> {
  const log = logger.child({
    service: "blocked-senders",
    connId: conn.id,
    provider: conn.provider,
    ruleId: providerRuleId,
  });

  if (!providerRuleId) {
    return { ok: true, providerRuleId: null };
  }

  if (conn.provider === "microsoft" || conn.provider === "outlook") {
    const accessToken = await (deps.resolveMsToken ?? getValidMicrosoftAccessToken)(conn);
    if (!accessToken) {
      return { ok: false, providerRuleId, reason: "auth_failed" };
    }
    const fetchFn = deps.fetchGraph ?? fetchWithTimeout;
    const resp = await fetchFn(
      `https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messageRules/${encodeURIComponent(providerRuleId)}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
        timeoutMs: HTTP_TIMEOUT_MS,
      },
    );
    if (!resp.ok && resp.status !== 404) {
      log.warn({ status: resp.status }, "Graph messageRules DELETE failed");
      return { ok: false, providerRuleId, reason: "api_error", message: `${resp.status}` };
    }
    return { ok: true, providerRuleId };
  }

  if (conn.provider === "google" || conn.provider === "gmail") {
    const gmail = await (deps.buildGmail ?? getGmailClient)(conn);
    try {
      await gmail.users.settings.filters.delete({ userId: "me", id: providerRuleId });
      return { ok: true, providerRuleId };
    } catch (err: any) {
      const status = err?.code || err?.response?.status;
      if (status === 404) return { ok: true, providerRuleId };
      log.warn({ err: err?.message }, "Gmail filter delete failed");
      return { ok: false, providerRuleId, reason: "api_error", message: err?.message };
    }
  }

  return { ok: true, providerRuleId };
}
