import { supabaseAdmin } from "../lib/supabase";

const TWILIO_API = "https://api.twilio.com/2010-04-01";

export interface TwilioCredentials {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}

export async function getSmsChannel(userId: string, channelId?: string) {
  let q = supabaseAdmin
    .from("messaging_channels")
    .select("*")
    .eq("user_id", userId)
    .in("provider", ["sms_twilio", "sms_brevo"])
    .eq("enabled", true);
  if (channelId) q = q.eq("id", channelId);
  const { data } = await q.limit(1).maybeSingle();
  return data;
}

export async function sendSms(
  userId: string,
  toPhone: string,
  body: string,
  options: { channelId?: string } = {},
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const channel = await getSmsChannel(userId, options.channelId);
  if (!channel) return { ok: false, error: "no sms channel" };

  if (channel.provider === "sms_twilio") {
    const creds = (channel.credentials || {}) as TwilioCredentials;
    if (!creds.accountSid || !creds.authToken) return { ok: false, error: "missing credentials" };
    const auth = Buffer.from(`${creds.accountSid}:${creds.authToken}`).toString("base64");
    const params = new URLSearchParams({
      From: channel.phone_number,
      To: toPhone,
      Body: body,
    });
    try {
      const res = await fetch(`${TWILIO_API}/Accounts/${creds.accountSid}/Messages.json`, {
        method: "POST",
        headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });
      if (!res.ok) {
        const text = await res.text();
        return { ok: false, error: `Twilio ${res.status}: ${text.slice(0, 200)}` };
      }
      const data = (await res.json()) as { sid?: string };
      const messageId = data.sid;
      await supabaseAdmin.from("messages").insert({
        user_id: userId,
        channel_id: channel.id,
        provider: "sms_twilio",
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

  // Brevo (Sendinblue) SMS
  if (channel.provider === "sms_brevo") {
    const creds = (channel.credentials || {}) as { apiKey: string };
    if (!creds.apiKey) return { ok: false, error: "missing credentials" };
    try {
      const res = await fetch("https://api.brevo.com/v3/transactionalSMS/sms", {
        method: "POST",
        headers: { "api-key": creds.apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          sender: channel.phone_number,
          recipient: toPhone,
          content: body,
          type: "transactional",
        }),
      });
      if (!res.ok) return { ok: false, error: `Brevo ${res.status}` };
      const data = (await res.json()) as { reference?: string };
      const messageId = data.reference || null;
      await supabaseAdmin.from("messages").insert({
        user_id: userId,
        channel_id: channel.id,
        provider: "sms_brevo",
        direction: "outbound",
        external_id: messageId,
        from_address: channel.phone_number,
        to_address: toPhone,
        body,
        status: "sent",
        thread_key: toPhone,
      });
      return { ok: true, messageId: messageId || undefined };
    } catch (err: any) {
      return { ok: false, error: err?.message };
    }
  }

  return { ok: false, error: "unsupported provider" };
}

export async function ingestTwilioWebhook(form: Record<string, string>): Promise<{ processed: boolean }> {
  try {
    const fromPhone = form.From || form.from;
    const toPhone = form.To || form.to;
    const body = form.Body || form.body || "";
    const messageSid = form.MessageSid || form.SmsMessageSid;
    if (!fromPhone || !toPhone) return { processed: false };

    // Tenant-safe routing: a Twilio number is owned by exactly one Twilio
    // account at a time, so it must map to exactly one Inboria tenant. The
    // migration `2026_04_24_v4_messaging_tenant_isolation.sql` enforces this
    // with a partial unique index on (provider='sms_twilio', phone_number).
    // We additionally enforce it at the application layer (defense-in-depth):
    // if multiple enabled channels somehow share the same destination number,
    // we refuse to route the inbound rather than risk cross-tenant disclosure.
    const { data: channels } = await supabaseAdmin
      .from("messaging_channels")
      .select("*")
      .eq("provider", "sms_twilio")
      .eq("phone_number", toPhone)
      .eq("enabled", true);
    if (!channels || channels.length === 0) return { processed: false };
    if (channels.length > 1) {
      console.error(
        "[sms][SECURITY] multiple enabled Twilio channels share the same phone_number — refusing to route to avoid cross-tenant disclosure",
        { toPhone, channelIds: channels.map((c: any) => c.id) },
      );
      return { processed: false };
    }
    const channel = channels[0];

    try {
      await supabaseAdmin.from("messages").insert({
        user_id: channel.user_id,
        channel_id: channel.id,
        provider: "sms_twilio",
        direction: "inbound",
        external_id: messageSid || null,
        from_address: fromPhone,
        to_address: toPhone,
        body,
        status: "received",
        thread_key: fromPhone,
      });
      await supabaseAdmin
        .from("messaging_channels")
        .update({ last_inbound_at: new Date().toISOString() })
        .eq("id", channel.id);

      const { emitEvent } = await import("./webhook-emitter");
      emitEvent(channel.user_id, "message.received", {
        channel: "sms",
        from: fromPhone,
        body,
        messageId: messageSid,
      }).catch(() => {});
    } catch (err: any) {
      if (err?.code !== "23505") console.error("[sms] ingest error:", err?.message);
    }
    return { processed: true };
  } catch (err) {
    console.error("[sms] webhook error:", (err as Error).message);
    return { processed: false };
  }
}
