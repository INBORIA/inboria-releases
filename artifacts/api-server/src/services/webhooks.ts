import { createHmac, randomBytes } from "crypto";
import { lookup as dnsLookup } from "dns/promises";
import { isIP } from "net";
import { supabaseAdmin } from "../lib/supabase";
import { logger } from "../lib/logger";

// =====================================================================
// SSRF protection: reject URLs that resolve to private/reserved IPs.
// Used at endpoint create time and on every dispatch attempt.
// =====================================================================
function ipv4InRange(ip: string, cidr: string): boolean {
  const [base, bitsStr] = cidr.split("/");
  const bits = Number(bitsStr);
  const toInt = (s: string) =>
    s.split(".").reduce((acc, oct) => (acc << 8) + Number(oct), 0) >>> 0;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (toInt(ip) & mask) === (toInt(base) & mask);
}

const PRIVATE_V4 = [
  "10.0.0.0/8",
  "172.16.0.0/12",
  "192.168.0.0/16",
  "127.0.0.0/8",
  "169.254.0.0/16", // link-local (incl. AWS/GCP metadata 169.254.169.254)
  "0.0.0.0/8",
  "100.64.0.0/10", // CGNAT
  "192.0.0.0/24",
  "192.0.2.0/24",
  "198.18.0.0/15",
  "198.51.100.0/24",
  "203.0.113.0/24",
  "224.0.0.0/4", // multicast
  "240.0.0.0/4", // reserved
];

function isPrivateIp(ip: string): boolean {
  const fam = isIP(ip);
  if (fam === 4) return PRIVATE_V4.some((c) => ipv4InRange(ip, c));
  if (fam === 6) {
    const lc = ip.toLowerCase();
    if (lc === "::1" || lc === "::") return true;
    if (lc.startsWith("fc") || lc.startsWith("fd")) return true; // ULA
    if (lc.startsWith("fe80")) return true; // link-local
    if (lc.startsWith("::ffff:")) {
      // IPv4-mapped
      const v4 = lc.slice(7);
      if (isIP(v4) === 4) return isPrivateIp(v4);
    }
    return false;
  }
  return true; // unknown family -> reject
}

export async function assertWebhookUrlIsSafe(rawUrl: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("invalid_url");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("invalid_protocol");
  }
  // Allow http only for local dev/test (e.g. ngrok-style); still SSRF-checked below.
  const host = parsed.hostname;
  if (!host) throw new Error("invalid_host");

  const lower = host.toLowerCase();
  if (
    lower === "localhost" ||
    lower.endsWith(".localhost") ||
    lower.endsWith(".internal") ||
    lower.endsWith(".local")
  ) {
    throw new Error("blocked_host");
  }

  // If literal IP, check directly.
  if (isIP(host)) {
    if (isPrivateIp(host)) throw new Error("blocked_ip");
    return;
  }

  // DNS lookup (all addresses) and reject if any is private.
  let addrs: { address: string }[] = [];
  try {
    addrs = await dnsLookup(host, { all: true });
  } catch {
    throw new Error("dns_failure");
  }
  if (addrs.length === 0) throw new Error("dns_failure");
  for (const a of addrs) {
    if (isPrivateIp(a.address)) throw new Error("blocked_ip");
  }
}

const ALL_EVENTS = [
  "email.received",
  "email.sent",
  "task.created",
  "task.completed",
  "appointment.created",
  "rule.triggered",
] as const;

export type WebhookEvent = typeof ALL_EVENTS[number];

const MAX_ATTEMPTS = 5;
const POLL_INTERVAL_MS = 30_000;

let started = false;

export function generateWebhookSecret(): string {
  return "whsec_" + randomBytes(24).toString("base64url");
}

export function signPayload(secret: string, body: string, timestamp: number): string {
  const baseString = `${timestamp}.${body}`;
  return createHmac("sha256", secret).update(baseString).digest("hex");
}

export async function emitWebhook(params: {
  userId: string;
  event: WebhookEvent;
  payload: Record<string, unknown>;
}): Promise<void> {
  try {
    const { data: endpoints } = await supabaseAdmin
      .from("webhook_endpoints")
      .select("id, events, enabled")
      .eq("user_id", params.userId)
      .eq("enabled", true);

    if (!endpoints || endpoints.length === 0) return;

    const matching = endpoints.filter((e: any) =>
      Array.isArray(e.events) && e.events.includes(params.event),
    );
    if (matching.length === 0) return;

    const inserts = matching.map((e: any) => ({
      endpoint_id: e.id,
      user_id: params.userId,
      event: params.event,
      payload: params.payload,
      status: "pending",
      attempts: 0,
      next_attempt_at: new Date().toISOString(),
    }));

    await supabaseAdmin.from("webhook_deliveries").insert(inserts);
  } catch (e: any) {
    logger.warn({ error: e?.message, event: params.event }, "[webhooks] emit failed");
  }
}

function backoffDelayMs(attempt: number): number {
  // 30s, 2m, 8m, 30m, 2h
  const base = 30_000;
  return Math.min(base * Math.pow(4, attempt), 2 * 60 * 60 * 1000);
}

async function deliverOne(delivery: any): Promise<void> {
  const { data: endpoint } = await supabaseAdmin
    .from("webhook_endpoints")
    .select("id, url, secret, enabled")
    .eq("id", delivery.endpoint_id)
    .single();

  if (!endpoint || !endpoint.enabled) {
    await supabaseAdmin
      .from("webhook_deliveries")
      .update({ status: "exhausted", last_error: "Endpoint disabled or missing", updated_at: new Date().toISOString() })
      .eq("id", delivery.id);
    return;
  }

  const ts = Math.floor(Date.now() / 1000);
  const body = JSON.stringify({ event: delivery.event, payload: delivery.payload, timestamp: ts });
  const signature = signPayload(endpoint.secret, body, ts);

  const attempt = (delivery.attempts || 0) + 1;
  let statusCode = 0;
  let errorMsg: string | null = null;

  try {
    // SSRF guard: re-resolve at dispatch time so DNS rebinding can't bypass
    // the create-time check.
    await assertWebhookUrlIsSafe(endpoint.url);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Inboria-Signature": `t=${ts},v1=${signature}`,
        "X-Inboria-Event": delivery.event,
        "User-Agent": "Inboria-Webhooks/1.0",
      },
      body,
      signal: controller.signal,
      redirect: "manual", // prevent following redirects to internal hosts
    });
    clearTimeout(timeout);
    statusCode = res.status;
    if (statusCode >= 300 && statusCode < 400) {
      errorMsg = `Refused redirect (HTTP ${statusCode})`;
    } else if (!res.ok) {
      errorMsg = `HTTP ${res.status}`;
    }
  } catch (e: any) {
    errorMsg = e?.message || "Network error";
    statusCode = 0;
  }

  if (!errorMsg) {
    await supabaseAdmin
      .from("webhook_deliveries")
      .update({
        status: "success",
        attempts: attempt,
        last_status_code: statusCode,
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", delivery.id);
    return;
  }

  if (attempt >= MAX_ATTEMPTS) {
    await supabaseAdmin
      .from("webhook_deliveries")
      .update({
        status: "exhausted",
        attempts: attempt,
        last_status_code: statusCode,
        last_error: errorMsg.slice(0, 500),
        updated_at: new Date().toISOString(),
      })
      .eq("id", delivery.id);
    return;
  }

  await supabaseAdmin
    .from("webhook_deliveries")
    .update({
      status: "pending",
      attempts: attempt,
      last_status_code: statusCode,
      last_error: errorMsg.slice(0, 500),
      next_attempt_at: new Date(Date.now() + backoffDelayMs(attempt)).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", delivery.id);
}

async function tick() {
  try {
    const nowIso = new Date().toISOString();
    const { data: due } = await supabaseAdmin
      .from("webhook_deliveries")
      .select("id, endpoint_id, event, payload, attempts")
      .eq("status", "pending")
      .lte("next_attempt_at", nowIso)
      .order("next_attempt_at", { ascending: true })
      .limit(20);

    if (!due || due.length === 0) return;
    for (const d of due) {
      await deliverOne(d);
    }
  } catch (e: any) {
    logger.warn({ error: e?.message }, "[webhooks] dispatcher tick failed");
  }
}

export function startWebhookDispatcher() {
  if (started) return;
  started = true;
  // run shortly after boot, then on interval
  setTimeout(tick, 5000).unref?.();
  setInterval(tick, POLL_INTERVAL_MS).unref?.();
  logger.info("[webhooks] dispatcher started");
}
