import { supabaseAdmin } from "../lib/supabase";

const META_GRAPH_API = "https://graph.facebook.com/v20.0";

export interface WhatsappCredentials {
  phoneNumberId: string;
  accessToken: string;
  businessAccountId?: string;
  verifyToken?: string;
}

export async function getWhatsappChannel(userId: string, channelId?: string) {
  let q = supabaseAdmin
    .from("messaging_channels")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", "whatsapp")
    .eq("enabled", true);
  if (channelId) q = q.eq("id", channelId);
  const { data } = await q.limit(1).maybeSingle();
  return data;
}

/**
 * Returns true when the recipient has sent the user an inbound WhatsApp message
 * within the last 24 hours — which is the Meta "customer-care" window during
 * which free-form text is allowed. Outside this window, only pre-approved
 * template messages may be sent.
 */
export async function isWithinWhatsapp24hWindow(userId: string, recipientPhone: string): Promise<boolean> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabaseAdmin
    .from("messages")
    .select("id")
    .eq("user_id", userId)
    .eq("provider", "whatsapp")
    .eq("direction", "inbound")
    .eq("from_address", recipientPhone)
    .gte("created_at", cutoff)
    .limit(1);
  return !!(data && data.length > 0);
}

export async function sendWhatsappMessage(
  userId: string,
  toPhone: string,
  body: string,
  options: { templateName?: string; templateLanguage?: string; channelId?: string } = {},
): Promise<{ ok: boolean; messageId?: string; error?: string; reason?: string }> {
  const channel = await getWhatsappChannel(userId, options.channelId);
  if (!channel) return { ok: false, error: "no whatsapp channel" };
  const creds = (channel.credentials || {}) as WhatsappCredentials;
  if (!creds.phoneNumberId || !creds.accessToken) return { ok: false, error: "missing credentials" };

  // Enforce Meta's customer-care 24h policy: free-text is only allowed when the
  // recipient has messaged us within the last 24h. Outside that window, callers
  // MUST provide an approved template name; we refuse free-text sends rather
  // than silently failing at Meta's API or being treated as spam.
  if (!options.templateName) {
    const insideWindow = await isWithinWhatsapp24hWindow(userId, toPhone);
    if (!insideWindow) {
      return {
        ok: false,
        error: "whatsapp_24h_window_closed",
        reason:
          "Free-text WhatsApp messages are only allowed within 24h of the recipient's last inbound. Provide an approved templateName instead.",
      };
    }
  }

  const payload = options.templateName
    ? {
        messaging_product: "whatsapp",
        to: toPhone,
        type: "template",
        template: {
          name: options.templateName,
          language: { code: options.templateLanguage || "fr" },
        },
      }
    : {
        messaging_product: "whatsapp",
        to: toPhone,
        type: "text",
        text: { body },
      };

  try {
    const res = await fetch(`${META_GRAPH_API}/${creds.phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${creds.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `Meta API ${res.status}: ${text.slice(0, 200)}` };
    }
    const data = (await res.json()) as { messages?: Array<{ id: string }> };
    const messageId = data.messages?.[0]?.id;

    await supabaseAdmin.from("messages").insert({
      user_id: userId,
      channel_id: channel.id,
      provider: "whatsapp",
      direction: "outbound",
      external_id: messageId || null,
      from_address: channel.phone_number,
      to_address: toPhone,
      body,
      status: "sent",
      thread_key: toPhone,
    });

    return { ok: true, messageId };
  } catch (err: any) {
    return { ok: false, error: err?.message };
  }
}

export async function ingestWhatsappWebhook(payload: any): Promise<{ processed: number }> {
  let processed = 0;
  try {
    const entries = payload?.entry || [];
    for (const entry of entries) {
      const changes = entry.changes || [];
      for (const change of changes) {
        const value = change.value || {};
        const phoneNumberId = value.metadata?.phone_number_id;
        if (!phoneNumberId) continue;

        // Tenant-safe routing: there must be exactly one channel for a given
        // (provider='whatsapp', external_id=phone_number_id). The migration
        // `2026_04_24_v4_messaging_tenant_isolation.sql` enforces this with a
        // partial unique index. We additionally enforce it at the application
        // layer (defense-in-depth) so a misconfigured DB cannot leak cross-tenant
        // PII: if multiple channels somehow match, we refuse to route the
        // inbound at all and log a critical warning for ops.
        const { data: channels } = await supabaseAdmin
          .from("messaging_channels")
          .select("*")
          .eq("provider", "whatsapp")
          .eq("external_id", phoneNumberId)
          .eq("enabled", true);
        if (!channels || channels.length === 0) continue;
        if (channels.length > 1) {
          console.error(
            "[whatsapp][SECURITY] multiple enabled channels share the same external_id — refusing to route to avoid cross-tenant disclosure",
            { phoneNumberId, channelIds: channels.map((c: any) => c.id) },
          );
          continue;
        }
        const channel = channels[0];

        const messages = value.messages || [];
        {
          for (const m of messages) {
            const body = m.text?.body || m.button?.text || `[${m.type}]`;
            const fromPhone = m.from || "";
            const messageId = m.id;
            try {
              await supabaseAdmin.from("messages").insert({
                user_id: channel.user_id,
                channel_id: channel.id,
                provider: "whatsapp",
                direction: "inbound",
                external_id: messageId,
                from_address: fromPhone,
                to_address: channel.phone_number,
                body,
                status: "received",
                thread_key: fromPhone,
              });
              processed += 1;

              await supabaseAdmin
                .from("messaging_channels")
                .update({ last_inbound_at: new Date().toISOString() })
                .eq("id", channel.id);

              const { emitEvent } = await import("./webhook-emitter");
              emitEvent(channel.user_id, "message.received", {
                channel: "whatsapp",
                from: fromPhone,
                body,
                messageId,
              }).catch(() => {});
            } catch (err: any) {
              if (err?.code !== "23505") {
                console.error("[whatsapp] ingest error:", err?.message);
              }
            }
          }
        }
      }
    }
  } catch (err) {
    console.error("[whatsapp] webhook parse error:", (err as Error).message);
  }
  return { processed };
}
