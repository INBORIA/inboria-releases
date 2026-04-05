import { Router, type IRouter, type Request } from "express";
import Stripe from "stripe";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth } from "../middlewares/auth";

interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env["STRIPE_SECRET_KEY"];
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }
    _stripe = new Stripe(key);
  }
  return _stripe;
}

function getFrontendUrl(): string {
  return process.env["FRONTEND_URL"] || "https://app.ncvmail.com";
}

const PRICE_MAP: Record<string, string> = {
  solo: process.env["STRIPE_PRICE_SOLO"] || "",
  pro: process.env["STRIPE_PRICE_PRO"] || "",
  business: process.env["STRIPE_PRICE_BUSINESS"] || "",
};

const PLAN_QUOTAS: Record<string, number> = {
  gratuit: 50,
  solo: 3000,
  pro: 10000,
  business: 10000,
};

const router: IRouter = Router();

router.post("/stripe/checkout", requireAuth, async (req, res): Promise<void> => {
  try {
    const { planId, seats } = req.body;

    if (!planId || !PRICE_MAP[planId]) {
      res.status(400).json({ error: "Plan invalide" });
      return;
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, stripe_customer_id")
      .eq("id", req.userId!)
      .single();

    if (!profile) {
      res.status(404).json({ error: "Profil introuvable" });
      return;
    }

    let customerId = profile.stripe_customer_id;

    if (!customerId) {
      const token = req.headers.authorization!.slice(7);
      const { data: userData } = await supabaseAdmin.auth.getUser(token);
      const userEmail = userData.user?.email || "";

      const customer = await getStripe().customers.create({
        email: userEmail,
        metadata: { userId: profile.id },
      });
      customerId = customer.id;

      await supabaseAdmin
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", req.userId!);
    }

    const quantity = planId === "business" ? (seats || 1) : 1;
    const frontendUrl = getFrontendUrl();

    const session = await getStripe().checkout.sessions.create({
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

    let event: Stripe.Event;
    try {
      event = getStripe().webhooks.constructEvent(
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
          const quota = PLAN_QUOTAS[planId] || 50;

          const updates: Record<string, unknown> = {
            plan: planId,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            emails_quota: quota,
          };

          if (subscriptionId) {
            const subscription = await getStripe().subscriptions.retrieve(subscriptionId as string);
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
            plan: "gratuit",
            stripe_subscription_id: null,
            emails_quota: 50,
          })
          .eq("stripe_customer_id", customerId);
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        if (subscription.status === "active") {
          const quantity = subscription.items.data[0]?.quantity || 1;
          await supabaseAdmin
            .from("profiles")
            .update({ seats: quantity })
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
    const portalSession = await getStripe().billingPortal.sessions.create({
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
