import { Router, type IRouter, type Request } from "express";
import Stripe from "stripe";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth } from "../middlewares/auth";
import { getStripeClient } from "../lib/stripe";
import { isAllowedCountry } from "../lib/eu-countries";

interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

function getFrontendUrl(): string {
  return process.env["FRONTEND_URL"] || `https://${process.env["REPLIT_DEV_DOMAIN"] || "inboria.com"}`;
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
          automatic_tax: { enabled: false },
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

      const customerParams: Record<string, unknown> = {
        email: userEmail,
        metadata: { userId: profile.id },
      };
      if (profile.country) {
        customerParams.address = { country: profile.country };
        customerParams.tax = { validate_location: "deferred" };
      }
      const customer = await stripe.customers.create(customerParams as any);
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
      currency: "eur",
      line_items: [
        {
          price: PRICE_MAP[planId],
          quantity,
        },
      ],
      automatic_tax: { enabled: false },
      tax_id_collection: { enabled: true },
      billing_address_collection: "required",
      customer_update: {
        address: "auto",
        name: "auto",
      },
      locale: "fr",
      payment_method_types: ["card", "sepa_debit"],
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
        const userId = session.metadata?.userId;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        if (planId && customerId) {
          const quota = PLAN_QUOTAS[planId] || 100;
          let quantity = 1;

          if (subscriptionId) {
            const subscription = await stripe.subscriptions.retrieve(subscriptionId as string);
            quantity = subscription.items.data[0]?.quantity || 1;
          }

          const updates: Record<string, unknown> = {
            plan: planId,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            emails_quota: quota,
            seats: quantity,
          };

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
