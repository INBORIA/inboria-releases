import { createHmac } from "crypto";
import { supabaseAdmin } from "../lib/supabase";

export type WebhookEventType =
  | "email.received"
  | "email.sent"
  | "task.created"
  | "task.completed"
  | "appointment.created"
  | "rule.triggered"
  | "message.received";

interface EmitOptions {
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 5000;

function signPayload(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function isValidWebhookUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    const host = u.hostname.toLowerCase();
    // Block localhost / RFC1918 / link-local in production to prevent SSRF.
    // Dev mode allows them for easier local testing.
    if (process.env["NODE_ENV"] === "production") {
      if (host === "localhost" || host === "127.0.0.1" || host === "::1") return false;
      if (/^10\./.test(host) || /^192\.168\./.test(host)) return false;
      if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)) return false;
      if (/^169\.254\./.test(host)) return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function emitEvent(
  userId: string,
  eventType: WebhookEventType,
  payload: Record<string, unknown>,
  options: EmitOptions = {},
): Promise<void> {
  try {
    const { data: subs } = await supabaseAdmin
      .from("webhook_subscriptions")
      .select("id, target_url, secret, failure_count")
      .eq("user_id", userId)
      .eq("event_type", eventType)
      .eq("enabled", true);

    if (!subs || subs.length === 0) return;

    const event = {
      id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      type: eventType,
      occurredAt: new Date().toISOString(),
      data: payload,
    };
    const body = JSON.stringify(event);

    await Promise.all(
      subs.map(async (sub: any) => {
        if (!isValidWebhookUrl(sub.target_url)) {
          await supabaseAdmin
            .from("webhook_subscriptions")
            .update({ last_error: "invalid target_url", failure_count: (sub.failure_count || 0) + 1 })
            .eq("id", sub.id);
          return;
        }

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          "X-Inboria-Event": eventType,
          "X-Inboria-Delivery": event.id,
          "User-Agent": "Inboria-Webhook/1.0",
        };
        if (sub.secret) {
          headers["X-Inboria-Signature"] = `sha256=${signPayload(sub.secret, body)}`;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs || DEFAULT_TIMEOUT_MS);
        try {
          const res = await fetch(sub.target_url, {
            method: "POST",
            headers,
            body,
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          if (res.ok) {
            await supabaseAdmin
              .from("webhook_subscriptions")
              .update({
                last_triggered_at: new Date().toISOString(),
                failure_count: 0,
                last_error: null,
              })
              .eq("id", sub.id);
          } else {
            await supabaseAdmin
              .from("webhook_subscriptions")
              .update({
                failure_count: (sub.failure_count || 0) + 1,
                last_error: `HTTP ${res.status}`,
              })
              .eq("id", sub.id);
          }
        } catch (err: any) {
          clearTimeout(timeoutId);
          await supabaseAdmin
            .from("webhook_subscriptions")
            .update({
              failure_count: (sub.failure_count || 0) + 1,
              last_error: String(err?.message || err).slice(0, 200),
            })
            .eq("id", sub.id);
        }
      }),
    );
  } catch (err) {
    console.error("[webhook-emitter] emit error:", (err as Error).message);
  }
}
