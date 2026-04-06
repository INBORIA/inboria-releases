import { Router, type IRouter, type Request } from "express";
import Stripe from "stripe";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth } from "../middlewares/auth";
import { getStripeClient } from "../lib/stripe";

interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

function getFrontendUrl(): string {
  return process.env["FRONTEND_URL"] || `https://${process.env["REPLIT_DEV_DOMAIN"] || "ncvmail.com"}`;
}

const PRICE_MAP: Record<string, string> = {
  solo: process.env["STRIPE_PRICE_SOLO"] || "",
  pro: process.env["STRIPE_PRICE_PRO"] || "",
  business: process.env["STRIPE_PRICE_BUSINESS"] || "",
};

const PLAN_QUOTAS: Record<string, number> = {
  essai: 100,
  solo: 3000,
  pro: 10000,
  business: 10000,
};

function getPlanFromPriceId(priceId: string): string | null {
  for (const [plan, price] of Object.entries(PRICE_MAP)) {
    if (price && price === priceId) return plan;
  }
  return null;
}

const router: IRouter = Router();

router.post("/stripe/checkout", requireAuth, async (req, res): Promise<void> => {
  try {
    const { planId, seats } = req.body;

    if (!planId || !PRICE_MAP[planId]) {
      res.status(400).json({ error: "Plan invalide" });
      return;
    }

    const stripe = await getStripeClient();

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, stripe_customer_id, stripe_subscription_id")
      .eq("id", req.userId!)
      .single();

    if (!profile) {
      res.status(404).json({ error: "Profil introuvable" });
      return;
    }

    const quantity = planId === "business" ? (seats || 1) : 1;

    if (profile.stripe_subscription_id) {
      const subscription = await stripe.subscriptions.retrieve(profile.stripe_subscription_id);

      if (subscription.status === "active" || subscription.status === "trialing") {
        const subscriptionItem = subscription.items.data[0];
        if (!subscriptionItem) {
          res.status(500).json({ error: "Abonnement Stripe invalide" });
          return;
        }

        await stripe.subscriptions.update(profile.stripe_subscription_id, {
          items: [
            {
              id: subscriptionItem.id,
              price: PRICE_MAP[planId],
              quantity,
            },
          ],
          metadata: { planId },
          proration_behavior: "create_prorations",
        });

        const quota = PLAN_QUOTAS[planId] || 100;
        await supabaseAdmin
          .from("profiles")
          .update({ plan: planId, emails_quota: quota, seats: quantity })
          .eq("id", req.userId!);

        res.json({ url: null, updated: true });
        return;
      }
    }

    let customerId = profile.stripe_customer_id;

    if (!customerId) {
      const token = req.headers.authorization!.slice(7);
      const { data: userData } = await supabaseAdmin.auth.getUser(token);
      const userEmail = userData.user?.email || "";

      const customer = await stripe.customers.create({
        email: userEmail,
        metadata: { userId: profile.id },
      });
      customerId = customer.id;

      await supabaseAdmin
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", req.userId!);
    }

    const frontendUrl = getFrontendUrl();

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [
        {
          price: PRICE_MAP[planId],
          quantity,
        },
      ],
      metadata: { planId, userId: req.userId! },
      success_url: `${frontendUrl}/dashboard/abonnement?success=true`,
      cancel_url: `${frontendUrl}/dashboard/abonnement?cancelled=true`,
    });

    res.json({ url: session.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Stripe checkout error:", message);
    res.status(500).json({ error: "Erreur lors de la creation de la session de paiement" });
  }
});

router.post("/stripe/webhook", async (req: RawBodyRequest, res): Promise<void> => {
  try {
    const sig = req.headers["stripe-signature"] as string;
    const webhookSecret = process.env["STRIPE_WEBHOOK_SECRET"] || "";

    const stripe = await getStripeClient();

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        req.rawBody!,
        sig,
        webhookSecret
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("Webhook signature verification failed:", message);
      res.status(400).json({ error: "Signature invalide" });
      return;
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const planId = session.metadata?.planId;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        if (planId && customerId) {
          const quota = PLAN_QUOTAS[planId] || 100;

          const updates: Record<string, unknown> = {
            plan: planId,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            emails_quota: quota,
          };

          if (subscriptionId) {
            const subscription = await stripe.subscriptions.retrieve(subscriptionId as string);
            const quantity = subscription.items.data[0]?.quantity || 1;
            updates.seats = quantity;
          }

          await supabaseAdmin
            .from("profiles")
            .update(updates)
            .eq("stripe_customer_id", customerId);
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        await supabaseAdmin
          .from("profiles")
          .update({ emails_used: 0 })
          .eq("stripe_customer_id", customerId);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

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

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        if (subscription.status === "active") {
          const subscriptionItem = subscription.items.data[0];
          const quantity = subscriptionItem?.quantity || 1;
          const priceId = subscriptionItem?.price?.id || "";
          const derivedPlan = getPlanFromPriceId(priceId);

          const updates: Record<string, unknown> = { seats: quantity };
          if (derivedPlan) {
            updates.plan = derivedPlan;
            updates.emails_quota = PLAN_QUOTAS[derivedPlan] || 100;
          }

          await supabaseAdmin
            .from("profiles")
            .update(updates)
            .eq("stripe_customer_id", customerId);
        }
        break;
      }
    }

    res.json({ received: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Stripe webhook error:", message);
    res.status(500).json({ error: "Erreur webhook" });
  }
});

router.get("/stripe/portal", requireAuth, async (req, res): Promise<void> => {
  try {
    const stripe = await getStripeClient();

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", req.userId!)
      .single();

    if (!profile?.stripe_customer_id) {
      res.status(400).json({ error: "Aucun abonnement Stripe trouve" });
      return;
    }

    const frontendUrl = getFrontendUrl();
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${frontendUrl}/dashboard/abonnement`,
    });

    res.json({ url: portalSession.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Stripe portal error:", message);
    res.status(500).json({ error: "Erreur lors de l'acces au portail" });
  }
});

export default router;
