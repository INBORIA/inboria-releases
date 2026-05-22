import { supabaseAdmin } from "../lib/supabase";
import { logger } from "../lib/logger";

const ERROR_MESSAGE_MAX = 500;
const SECRET_PATTERNS = [
  /Bearer\s+[A-Za-z0-9._\-]+/gi,
  /eyJ[A-Za-z0-9._\-]{20,}/g,
  /pass(word)?["']?\s*[:=]\s*["']?[^"'\s,}]+/gi,
  /token["']?\s*[:=]\s*["']?[^"'\s,}]+/gi,
];

export type SyncPhase =
  | "config"
  | "connect"
  | "lock"
  | "fetch"
  | "junk"
  | "trash"
  | "logout"
  | "token-refresh"
  | "graph-api"
  | "gmail-api"
  | "unknown";

export function sanitizeErrorMessage(raw: string): string {
  let cleaned = raw;
  for (const pattern of SECRET_PATTERNS) {
    cleaned = cleaned.replace(pattern, "[redacted]");
  }
  if (cleaned.length > ERROR_MESSAGE_MAX) {
    cleaned = cleaned.slice(0, ERROR_MESSAGE_MAX);
  }
  return cleaned;
}

/**
 * Détecte les erreurs qui ne reflètent PAS une vraie déconnexion du compte
 * (token révoqué, mot de passe changé, OAuth invalid_grant, 401/403…) mais
 * juste un incident réseau transitoire (Gmail API qui timeout, IMAP qui
 * répond lent, etc.). On ne doit pas les incrémenter dans
 * `consecutive_failures` sinon après quelques cycles de sync l'API marque
 * le compte "déconnecté" et envoie un mail à l'utilisateur alors que la
 * connexion est saine. Vrais disconnects = pris ailleurs (token-refresh
 * phase, 401/403 explicites).
 */
function isTransientNetworkError(rawMessage: string): boolean {
  const m = rawMessage.toLowerCase();
  return (
    m.includes("timeout after") ||
    m.includes("etimedout") ||
    m.includes("econnreset") ||
    m.includes("econnrefused") ||
    m.includes("enotfound") ||
    m.includes("socket hang up") ||
    m.includes("network socket disconnected") ||
    m.includes("aborterror") ||
    m.includes("request aborted")
  );
}

export async function markConnectionFailure(
  connId: string,
  phase: SyncPhase,
  err: unknown,
): Promise<void> {
  const log = logger.child({ service: "connection-health", connId, phase });
  const rawMessage =
    err instanceof Error ? err.message : typeof err === "string" ? err : JSON.stringify(err ?? "unknown");
  const message = sanitizeErrorMessage(`[${phase}] ${rawMessage}`);

  // Erreur réseau transitoire (ex: "Gmail messages.list timeout after
  // 20000ms") → on log mais on n'incrémente PAS le compteur, sinon une
  // série de timeouts API non-OAuth (réseau lent, Gmail down 5 min, etc.)
  // finit par envoyer un mail "compte déconnecté" alors qu'aucun token
  // n'est invalide. La phase `token-refresh` reste comptée (vraie OAuth).
  if (phase !== "token-refresh" && isTransientNetworkError(rawMessage)) {
    log.warn({ rawMessage }, "Transient network error — NOT counted as connection failure");
    return;
  }

  try {
    const { error: rpcErr } = await supabaseAdmin.rpc("increment_connection_failure", {
      p_id: connId,
      p_error_message: message,
    });

    if (!rpcErr) {
      log.info("Connection failure recorded (atomic)");
      void notifyDisconnectedIfNeeded(connId);
      return;
    }

    log.warn({ err: rpcErr.message }, "RPC unavailable, falling back to read-modify-write");

    const { data, error: readErr } = await supabaseAdmin
      .from("email_connections")
      .select("consecutive_failures")
      .eq("id", connId)
      .maybeSingle();

    if (readErr) {
      log.warn({ err: readErr.message }, "Failed to read consecutive_failures");
      return;
    }

    const current = Number((data as { consecutive_failures?: number } | null)?.consecutive_failures ?? 0);
    const next = current + 1;

    const { error: updateErr } = await supabaseAdmin
      .from("email_connections")
      .update({
        consecutive_failures: next,
        last_error_at: new Date().toISOString(),
        last_error_message: message,
      })
      .eq("id", connId);

    if (updateErr) {
      log.warn({ err: updateErr.message }, "Failed to persist failure");
    } else {
      log.info({ consecutiveFailures: next }, "Connection failure recorded (fallback)");
      void notifyDisconnectedIfNeeded(connId);
    }
  } catch (e: unknown) {
    log.warn({ err: e instanceof Error ? e.message : String(e) }, "markConnectionFailure threw");
  }
}

async function notifyDisconnectedIfNeeded(connId: string): Promise<void> {
  try {
    const mod = await import("./email-alerts");
    await mod.maybeSendDisconnectedAlert(connId);
  } catch (e: unknown) {
    logger.warn(
      { service: "connection-health", connId, err: e instanceof Error ? e.message : String(e) },
      "notifyDisconnectedIfNeeded threw",
    );
  }
}

export interface SyncLoopResult {
  totalSynced: number;
  failureCount: number;
  perConnection: Array<{ id: string | null; email: string | null; synced: number }>;
}

/**
 * Runs `dispatcher` for each connection, isolating per-connection failures.
 * Mirrors the loop used by `runAutoSync` so tests can assert that one
 * thrown connection does not stop the others and that markConnectionFailure
 * is invoked for the failing one.
 */
export async function runSyncLoop(
  connections: Array<{ id: string; email_address: string; provider?: string } & Record<string, unknown>>,
  dispatcher: (conn: any) => Promise<number>,
): Promise<SyncLoopResult> {
  let totalSynced = 0;
  let failureCount = 0;
  const perConnection: SyncLoopResult["perConnection"] = [];

  for (const conn of connections) {
    const synced = await safeRunForConnection(conn, "fetch", () => dispatcher(conn));
    perConnection.push({ id: conn.id ?? null, email: conn.email_address ?? null, synced });
    if (synced < 0) failureCount++;
    else totalSynced += synced;
  }

  return { totalSynced, failureCount, perConnection };
}

export async function safeRunForConnection<T>(
  conn: { id?: string | null; email_address?: string | null } | null | undefined,
  phase: SyncPhase,
  fn: () => Promise<T>,
): Promise<T | -1> {
  try {
    return await fn();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const log = logger.child({ service: "connection-health", connId: conn?.id ?? null });
    log.warn({ err: msg, email: conn?.email_address ?? null }, "Per-connection sync threw, isolating");
    if (conn?.id) {
      await markConnectionFailure(conn.id, phase, err);
    }
    return -1;
  }
}

export async function markConnectionSuccess(connId: string): Promise<void> {
  const log = logger.child({ service: "connection-health", connId });
  try {
    const { error } = await supabaseAdmin
      .from("email_connections")
      .update({
        consecutive_failures: 0,
        last_error_at: null,
        last_error_message: null,
        last_alert_sent_at: null,
        last_synced_at: new Date().toISOString(),
      })
      .eq("id", connId);
    if (error) {
      log.warn({ err: error.message }, "Failed to reset failure counter");
    }
  } catch (e: unknown) {
    log.warn({ err: e instanceof Error ? e.message : String(e) }, "markConnectionSuccess threw");
  }
}

export interface FetchWithTimeoutOptions extends RequestInit {
  timeoutMs?: number;
}

export async function fetchWithTimeout(
  input: string,
  options: FetchWithTimeoutOptions = {},
): Promise<Response> {
  const { timeoutMs = 20_000, signal: externalSignal, ...rest } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`HTTP timeout after ${timeoutMs}ms`)), timeoutMs);

  if (externalSignal) {
    if (externalSignal.aborted) controller.abort(externalSignal.reason);
    else externalSignal.addEventListener("abort", () => controller.abort(externalSignal.reason), { once: true });
  }

  try {
    return await fetch(input, { ...rest, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race<T>([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
