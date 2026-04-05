import { Router, type IRouter } from "express";
import Stripe from "stripe";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth } from "../middlewares/auth";

const stripe = new Stripe(process.env["STRIPE_SECRET_KEY"] || "", {
  apiVersion: "2025-04-30.basil",
});

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
      .select("id, email, stripe_customer_id")
      .eq("id", req.userId!)
      .single();

    if (!profile) {
      res.status(404).json({ error: "Profil introuvable" });
      return;
    }

    let customerId = profile.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: profile.email,
        metadata: { userId: profile.id },
      });
      customerId = customer.id;

      await supabaseAdmin
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", req.userId!);
    }

    const quantity = planId === "business" ? (seats || 1) : 1;

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
      success_url: `${req.headers.origin || process.env["FRONTEND_URL"] || ""}/dashboard/abonnement?success=true`,
      cancel_url: `${req.headers.origin || process.env["FRONTEND_URL"] || ""}/dashboard/abonnement?cancelled=true`,
    });

    res.json({ url: session.url });
  } catch (err: any) {
    console.error("Stripe checkout error:", err);
    res.status(500).json({ error: "Erreur lors de la creation de la session de paiement" });
  }
});

router.post("/stripe/webhook", async (req, res): Promise<void> => {
  try {
    const sig = req.headers["stripe-signature"] as string;
    const webhookSecret = process.env["STRIPE_WEBHOOK_SECRET"] || "";

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        (req as any).rawBody,
        sig,
        webhookSecret
      );
    } catch (err: any) {
      console.error("Webhook signature verification failed:", err.message);
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

          await supabaseAdmin
            .from("profiles")
            .update({
              plan: planId,
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              emails_quota: quota,
            })
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
          if (quantity > 1) {
            await supabaseAdmin
              .from("profiles")
              .update({ seats: quantity })
              .eq("stripe_customer_id", customerId);
          }
        }
        break;
      }
    }

    res.json({ received: true });
  } catch (err: any) {
    console.error("Stripe webhook error:", err);
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

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${req.headers.origin || process.env["FRONTEND_URL"] || ""}/dashboard/abonnement`,
    });

    res.json({ url: portalSession.url });
  } catch (err: any) {
    console.error("Stripe portal error:", err);
    res.status(500).json({ error: "Erreur lors de l'acces au portail" });
  }
});

export default router;
