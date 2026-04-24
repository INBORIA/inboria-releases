import { Router, type IRouter, type Request } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth } from "../middlewares/auth";
import { getPaddleClient, getPaddleClientToken, getPaddleWebhookSecret } from "../lib/paddle";
import { isAllowedCountry } from "../lib/eu-countries";
import crypto from "crypto";

interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

function getFrontendUrl(): string {
  return process.env["FRONTEND_URL"] || `https://${process.env["REPLIT_DEV_DOMAIN"] || "inboria.com"}`;
}

const PLAN_QUOTAS: Record<string, number> = {
  essai: 100,
  solo: 3000,
  pro: 10000,
  plus: 15000,
  business: 10000,
};

const PRICE_MAP: Record<string, string> = {
  solo: process.env["PADDLE_PRICE_SOLO"] || "",
  pro: process.env["PADDLE_PRICE_PRO"] || "",
  plus: process.env["PADDLE_PRICE_PLUS"] || "",
  business: process.env["PADDLE_PRICE_BUSINESS"] || "",
};

function getPlanFromPriceId(priceId: string): string | null {
  for (const [plan, price] of Object.entries(PRICE_MAP)) {
    if (price && price === priceId) return plan;
  }
  return null;
}

const router: IRouter = Router();

router.post("/paddle/checkout", requireAuth, async (req, res): Promise<void> => {
  try {
    const { planId, seats } = req.body;

    if (!planId || !PRICE_MAP[planId]) {
      res.status(400).json({ error: "Plan invalide" });
      return;
    }

    let profile: any = null;
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, stripe_customer_id, stripe_subscription_id, country")
      .eq("id", req.userId!)
      .single();

    if (profileError && profileError.message?.includes("country")) {
      const { data: fallback } = await supabaseAdmin
        .from("profiles")
        .select("id, stripe_customer_id, stripe_subscription_id")
        .eq("id", req.userId!)
        .single();
      profile = fallback;
    } else {
      profile = profileData;
    }

    if (!profile) {
      res.status(404).json({ error: "Profil introuvable" });
      return;
    }

    if (profile.country && !isAllowedCountry(profile.country)) {
      res.status(403).json({ error: "Inboria est actuellement disponible uniquement dans l'Union Europeenne, l'EEE et la Suisse." });
      return;
    }

    const quantity = planId === "business" ? (seats || 1) : 1;
    const paddle = getPaddleClient();

    if (profile.stripe_subscription_id) {
      try {
        const subscription = await paddle.subscriptions.get(profile.stripe_subscription_id);

        if (subscription.status === "active" || subscription.status === "trialing") {
          const firstItem = subscription.items?.[0];
          if (!firstItem) {
            res.status(500).json({ error: "Abonnement Paddle invalide" });
            return;
          }

          await paddle.subscriptions.update(profile.stripe_subscription_id, {
            items: [
              {
                priceId: PRICE_MAP[planId],
                quantity,
              },
            ],
            prorationBillingMode: "prorated_immediately",
          });

          const quota = PLAN_QUOTAS[planId] || 100;
          await supabaseAdmin
            .from("profiles")
            .update({ plan: planId, emails_quota: quota, seats: quantity })
            .eq("id", req.userId!);

          res.json({ url: null, updated: true });
          return;
        }
      } catch (subErr: any) {
        console.error("Error checking existing subscription:", subErr.message);
      }
    }

    let customerId = profile.stripe_customer_id;

    if (!customerId) {
      const token = req.headers.authorization!.slice(7);
      const { data: userData } = await supabaseAdmin.auth.getUser(token);
      const userEmail = userData.user?.email || "";

      const customer = await paddle.customers.create({
        email: userEmail,
        customData: { userId: profile.id },
      });
      customerId = customer.id;

      await supabaseAdmin
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", req.userId!);
    }

    const frontendUrl = getFrontendUrl();
    const clientToken = getPaddleClientToken();

    res.json({
      clientToken,
      customerId,
      priceId: PRICE_MAP[planId],
      quantity,
      planId,
      successUrl: `${frontendUrl}/dashboard/abonnement?success=true`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Paddle checkout error:", message);
    res.status(500).json({ error: "Erreur lors de la creation de la session de paiement" });
  }
});

router.post("/paddle/webhook", async (req: RawBodyRequest, res): Promise<void> => {
  try {
    const signature = req.headers["paddle-signature"] as string;
    if (!signature) {
      res.status(400).json({ error: "Missing Paddle-Signature header" });
      return;
    }

    const webhookSecret = getPaddleWebhookSecret();
    const rawBody = req.rawBody?.toString() || JSON.stringify(req.body);

    const parts = signature.split(";").reduce((acc: Record<string, string>, part) => {
      const [key, value] = part.split("=");
      if (key && value) acc[key.trim()] = value.trim();
      return acc;
    }, {});

    const ts = parts["ts"];
    const h1 = parts["h1"];

    if (!ts || !h1) {
      res.status(400).json({ error: "Invalid signature format" });
      return;
    }

    const signedPayload = `${ts}:${rawBody}`;
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(signedPayload)
      .digest("hex");

    if (h1 !== expectedSignature) {
      console.error("Paddle webhook signature mismatch");
      res.status(400).json({ error: "Signature invalide" });
      return;
    }

    const event = req.body;
    const eventType = event.event_type;
    const data = event.data;

    switch (eventType) {
      case "transaction.completed": {
        const customerId = data.customer_id;
        const subscriptionId = data.subscription_id;
        const items = data.items || [];
        const firstItem = items[0];
        const priceId = firstItem?.price?.id || "";
        const quantity = firstItem?.quantity || 1;
        const planId = getPlanFromPriceId(priceId);

        if (planId && customerId) {
          const quota = PLAN_QUOTAS[planId] || 100;

          const updates: Record<string, unknown> = {
            plan: planId,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            emails_quota: quota,
            seats: quantity,
          };

          const { data: profileData } = await supabaseAdmin
            .from("profiles")
            .select("id")
            .eq("stripe_customer_id", customerId)
            .single();

          const userId = profileData?.id;

          if (planId === "business" && userId) {
            const { data: existingMembership } = await supabaseAdmin
              .from("organisation_members")
              .select("organisation_id")
              .eq("user_id", userId)
              .eq("status", "active")
              .single();

            if (!existingMembership) {
              const { data: profile } = await supabaseAdmin
                .from("profiles")
                .select("full_name")
                .eq("stripe_customer_id", customerId)
                .single();

              const orgName = profile?.full_name ? `Équipe de ${profile.full_name}` : "Mon organisation";
              const slug = `org-${Date.now().toString(36)}`;

              const { data: org } = await supabaseAdmin
                .from("organisations")
                .insert({
                  name: orgName,
                  slug,
                  plan: "business",
                  seats_total: quantity,
                  emails_quota: quota * quantity,
                  emails_used: 0,
                  stripe_customer_id: customerId,
                  stripe_subscription_id: subscriptionId,
                  created_by: userId,
                })
                .select()
                .single();

              if (org) {
                await supabaseAdmin
                  .from("organisation_members")
                  .insert({
                    organisation_id: org.id,
                    user_id: userId,
                    role: "admin",
                    status: "active",
                  });

                updates.organisation_id = org.id;
              }
            } else {
              await supabaseAdmin
                .from("organisations")
                .update({
                  seats_total: quantity,
                  emails_quota: quota * quantity,
                  stripe_customer_id: customerId,
                  stripe_subscription_id: subscriptionId,
                })
                .eq("id", existingMembership.organisation_id);
            }
          }

          await supabaseAdmin
            .from("profiles")
            .update(updates)
            .eq("stripe_customer_id", customerId);
        }
        break;
      }

      case "subscription.updated": {
        const customerId = data.customer_id;
        const status = data.status;
        const items = data.items || [];
        const firstItem = items[0];
        const quantity = firstItem?.quantity || 1;
        const priceId = firstItem?.price?.id || "";
        const derivedPlan = getPlanFromPriceId(priceId);

        if (status === "active") {
          const updates: Record<string, unknown> = { seats: quantity };
          if (derivedPlan) {
            updates.plan = derivedPlan;
            updates.emails_quota = PLAN_QUOTAS[derivedPlan] || 100;
          }

          await supabaseAdmin
            .from("profiles")
            .update(updates)
            .eq("stripe_customer_id", customerId);

          if (derivedPlan === "business") {
            const quota = PLAN_QUOTAS["business"] || 10000;
            await supabaseAdmin
              .from("organisations")
              .update({
                seats_total: quantity,
                emails_quota: quota * quantity,
              })
              .eq("stripe_customer_id", customerId);
          }
        }
        break;
      }

      case "subscription.canceled": {
        const customerId = data.customer_id;

        await supabaseAdmin
          .from("profiles")
          .update({
            plan: "expired",
            stripe_subscription_id: null,
            emails_quota: 0,
          })
          .eq("stripe_customer_id", customerId);
        break;
      }

      case "subscription.past_due": {
        const customerId = data.customer_id;
        console.warn(`Subscription past due for customer: ${customerId}`);
        break;
      }

      case "transaction.paid": {
        const customerId = data.customer_id;
        const subscriptionId = data.subscription_id;
        if (subscriptionId) {
          await supabaseAdmin
            .from("profiles")
            .update({ emails_used: 0 })
            .eq("stripe_customer_id", customerId);
        }
        break;
      }
    }

    res.json({ received: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Paddle webhook error:", message);
    res.status(500).json({ error: "Erreur webhook" });
  }
});

router.post("/paddle/cancel", requireAuth, async (req, res): Promise<void> => {
  try {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("stripe_subscription_id")
      .eq("id", req.userId!)
      .single();

    if (!profile?.stripe_subscription_id) {
      res.status(400).json({ error: "Aucun abonnement actif" });
      return;
    }

    const paddle = getPaddleClient();
    await paddle.subscriptions.cancel(profile.stripe_subscription_id, {
      effectiveFrom: "next_billing_period" as any,
    });

    res.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Paddle cancel error:", message);
    res.status(500).json({ error: "Erreur lors de l'annulation" });
  }
});

router.get("/paddle/portal", requireAuth, async (req, res): Promise<void> => {
  try {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("stripe_customer_id, stripe_subscription_id")
      .eq("id", req.userId!)
      .single();

    if (!profile?.stripe_customer_id) {
      res.status(400).json({ error: "Aucun abonnement Paddle trouvé" });
      return;
    }

    const paddle = getPaddleClient();
    const subIds = profile.stripe_subscription_id ? [profile.stripe_subscription_id] : [];

    const portalSession = await paddle.customerPortalSessions.create(
      profile.stripe_customer_id,
      subIds,
    );

    const urls = (portalSession as any).urls;
    const url =
      urls?.general?.overview ||
      urls?.subscriptions?.[0]?.cancelSubscription ||
      urls?.subscriptions?.[0]?.updateSubscriptionPaymentMethod ||
      "";

    if (!url) {
      res.status(500).json({ error: "Portail Paddle indisponible pour ce compte" });
      return;
    }

    res.json({ url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Paddle portal error:", message);
    res.status(500).json({ error: "Erreur lors de l'accès au portail" });
  }
});

export default router;
