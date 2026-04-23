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

function sanitizeErrorMessage(raw: string): string {
  let cleaned = raw;
  for (const pattern of SECRET_PATTERNS) {
    cleaned = cleaned.replace(pattern, "[redacted]");
  }
  if (cleaned.length > ERROR_MESSAGE_MAX) {
    cleaned = cleaned.slice(0, ERROR_MESSAGE_MAX);
  }
  return cleaned;
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

  try {
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
      log.info({ consecutiveFailures: next }, "Connection failure recorded");
    }
  } catch (e: unknown) {
    log.warn({ err: e instanceof Error ? e.message : String(e) }, "markConnectionFailure threw");
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
