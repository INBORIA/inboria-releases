import { Router, type IRouter, type Request } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth } from "../middlewares/auth";
import { sendWhatsappMessage, ingestWhatsappWebhook } from "../services/whatsapp";
import { sendSms, ingestTwilioWebhook } from "../services/sms";
import { verifyMetaSignature, verifyTwilioSignature } from "../lib/webhook-signatures";

type RawBodyRequest = Request & { rawBody?: Buffer };

const router: IRouter = Router();

function mapChannel(c: any) {
  return {
    id: c.id,
    provider: c.provider,
    displayName: c.display_name,
    phoneNumber: c.phone_number,
    externalId: c.external_id,
    enabled: c.enabled,
    lastInboundAt: c.last_inbound_at,
    createdAt: c.created_at,
  };
}

function mapMessage(m: any) {
  return {
    id: m.id,
    channelId: m.channel_id,
    provider: m.provider,
    direction: m.direction,
    externalId: m.external_id,
    from: m.from_address,
    to: m.to_address,
    body: m.body,
    status: m.status,
    threadKey: m.thread_key,
    readAt: m.read_at,
    deliveredAt: m.delivered_at,
    createdAt: m.created_at,
  };
}

// ============== Channels CRUD ==============
router.get("/messaging/channels", requireAuth, async (req, res): Promise<void> => {
  const { data } = await supabaseAdmin
    .from("messaging_channels")
    .select("*")
    .eq("user_id", req.userId!)
    .order("created_at", { ascending: false });
  res.json((data || []).map(mapChannel));
});

router.post("/messaging/channels", requireAuth, async (req, res): Promise<void> => {
  try {
    const { provider, displayName, phoneNumber, externalId, credentials } = req.body || {};
    if (!provider || !["whatsapp", "sms_twilio", "sms_brevo"].includes(provider)) {
      res.status(400).json({ error: "invalid provider" });
      return;
    }
    if (!displayName || !phoneNumber) {
      res.status(400).json({ error: "displayName and phoneNumber required" });
      return;
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("plan")
      .eq("id", req.userId!)
      .maybeSingle();
    if (!profile || !["plus", "business"].includes(profile.plan)) {
      res.status(403).json({ error: "WhatsApp/SMS reservé au plan Plus ou Business" });
      return;
    }

    const { data, error } = await supabaseAdmin
      .from("messaging_channels")
      .upsert(
        {
          user_id: req.userId!,
          provider,
          display_name: String(displayName).slice(0, 80),
          phone_number: String(phoneNumber).slice(0, 30),
          external_id: externalId ? String(externalId).slice(0, 100) : null,
          credentials: credentials || {},
          enabled: true,
        },
        { onConflict: "user_id,provider,phone_number" },
      )
      .select("*")
      .single();
    if (error || !data) {
      res.status(500).json({ error: error?.message || "Failed to create channel" });
      return;
    }
    res.status(201).json(mapChannel(data));
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.patch("/messaging/channels/:id", requireAuth, async (req, res): Promise<void> => {
  const { enabled, displayName, credentials } = req.body || {};
  const updates: Record<string, any> = {};
  if (typeof enabled === "boolean") updates.enabled = enabled;
  if (displayName) updates.display_name = String(displayName).slice(0, 80);
  if (credentials) updates.credentials = credentials;
  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "no updatable fields" });
    return;
  }
  const { data, error } = await supabaseAdmin
    .from("messaging_channels")
    .update(updates)
    .eq("user_id", req.userId!)
    .eq("id", req.params.id)
    .select("*")
    .single();
  if (error || !data) {
    res.status(404).json({ error: "channel not found" });
    return;
  }
  res.json(mapChannel(data));
});

router.delete("/messaging/channels/:id", requireAuth, async (req, res): Promise<void> => {
  const { error } = await supabaseAdmin
    .from("messaging_channels")
    .delete()
    .eq("user_id", req.userId!)
    .eq("id", req.params.id);
  if (error) {
    res.status(500).json({ error: "Failed to delete channel" });
    return;
  }
  res.json({ success: true });
});

// ============== Unified inbox (multi-channel non-email messages) ==============
router.get("/messaging/messages", requireAuth, async (req, res): Promise<void> => {
  const channelId = req.query.channelId ? String(req.query.channelId) : null;
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  let q = supabaseAdmin
    .from("messages")
    .select("*")
    .eq("user_id", req.userId!)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (channelId) q = q.eq("channel_id", channelId);
  const { data } = await q;
  res.json((data || []).map(mapMessage));
});

router.post("/messaging/send", requireAuth, async (req, res): Promise<void> => {
  const { channel, channelId, to, body, templateName, templateLanguage } = req.body || {};
  if (!channel || !to) {
    res.status(400).json({ error: "channel and to required" });
    return;
  }
  if (channel === "whatsapp") {
    const result = await sendWhatsappMessage(req.userId!, to, body || "", {
      channelId,
      templateName,
      templateLanguage,
    });
    res.status(result.ok ? 201 : 400).json(result);
    return;
  }
  if (channel === "sms") {
    if (!body) {
      res.status(400).json({ error: "body required for sms" });
      return;
    }
    const result = await sendSms(req.userId!, to, body, { channelId });
    res.status(result.ok ? 201 : 400).json(result);
    return;
  }
  res.status(400).json({ error: "unsupported channel" });
});

// ============== Inbound webhooks (no auth — provider-specific verification) ==============

// Meta Cloud API (WhatsApp Business) webhook verification (GET)
router.get("/messaging/whatsapp/webhook", (req, res): void => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  const expected = process.env["WHATSAPP_VERIFY_TOKEN"] || "";
  if (mode === "subscribe" && expected && token === expected) {
    res.status(200).send(String(challenge));
    return;
  }
  res.status(403).send("forbidden");
});

router.post("/messaging/whatsapp/webhook", async (req: RawBodyRequest, res): Promise<void> => {
  try {
    const appSecret = process.env["WHATSAPP_APP_SECRET"] || "";
    if (!appSecret) {
      // Refuse to process unsigned inbound webhooks when no app secret is configured.
      // This prevents spoofed inbound messages in environments missing Meta verification setup.
      console.warn("[messaging][whatsapp] WHATSAPP_APP_SECRET not configured — rejecting webhook");
      res.status(401).json({ ok: false, error: "webhook signature verification not configured" });
      return;
    }
    const sigHeader = req.get("x-hub-signature-256") || req.get("X-Hub-Signature-256");
    if (!verifyMetaSignature(req.rawBody, sigHeader, appSecret)) {
      res.status(401).json({ ok: false, error: "invalid signature" });
      return;
    }
    const result = await ingestWhatsappWebhook(req.body);
    res.status(200).json({ ok: true, ...result });
  } catch (err) {
    console.error("[messaging][whatsapp] webhook error:", (err as Error).message);
    res.status(200).json({ ok: false });
  }
});

// Twilio SMS webhook (form-encoded). Twilio signs with HMAC-SHA1 over the full
// webhook URL concatenated with sorted POST parameters.
router.post("/messaging/sms/twilio/webhook", async (req, res): Promise<void> => {
  try {
    const form = (req.body || {}) as Record<string, string>;
    const sigHeader = req.get("x-twilio-signature") || req.get("X-Twilio-Signature");
    const toPhone = String(form["To"] || form["to"] || "");

    // Try per-channel auth token first (preferred): each Twilio number/account has its own token.
    let authToken = "";
    if (toPhone) {
      const { data: channels } = await supabaseAdmin
        .from("messaging_channels")
        .select("credentials")
        .eq("provider", "sms_twilio")
        .eq("phone_number", toPhone);
      const fromChannel = channels?.find((c: any) => c?.credentials?.authToken)?.credentials?.authToken;
      if (fromChannel) authToken = String(fromChannel);
    }
    if (!authToken) authToken = process.env["TWILIO_AUTH_TOKEN"] || "";

    if (!authToken) {
      console.warn("[messaging][sms] no Twilio auth token available — rejecting webhook");
      res.status(401).end();
      return;
    }

    const proto = (req.get("x-forwarded-proto") || req.protocol || "https").split(",")[0]!.trim();
    const host = req.get("x-forwarded-host") || req.get("host") || "";
    const fullUrl = `${proto}://${host}${req.originalUrl}`;

    if (!verifyTwilioSignature(fullUrl, form, sigHeader, authToken)) {
      res.status(401).end();
      return;
    }

    await ingestTwilioWebhook(form);
    res.set("Content-Type", "text/xml");
    res.send("<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response/>");
  } catch (err) {
    console.error("[messaging][sms] twilio webhook error:", (err as Error).message);
    res.status(200).end();
  }
});

export default router;
