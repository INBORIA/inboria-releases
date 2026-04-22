import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth } from "../middlewares/auth";
import { requireAdmin } from "../middlewares/requireAdmin";
import { getPaddleClient } from "../lib/paddle";
import { logger } from "../lib/logger";

const router: IRouter = Router();

interface WaitlistRow {
  id: string;
  email: string;
  plan: string | null;
  seats: number | null;
  locale: string | null;
  source: string | null;
  created_at: string;
}

interface ProfileRow {
  id: string;
  full_name: string | null;
  plan: string | null;
  seats: number | null;
  emails_used: number | null;
  ai_credits_used: number | null;
  emails_quota: number | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  organisation_id: string | null;
  created_at: string;
  is_admin: boolean | null;
}

function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  let str = String(value);
  // Neutralize spreadsheet formula injection: prefix risky leading chars with a single quote.
  if (str.length > 0 && /^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

router.get(
  "/admin/waitlist",
  requireAuth,
  requireAdmin,
  async (_req, res): Promise<void> => {
    try {
      const { data, error } = await supabaseAdmin
        .from("waitlist_signups")
        .select("id, email, plan, seats, locale, source, created_at")
        .order("created_at", { ascending: false });

      if (error) {
        logger.error({ err: error }, "[admin] waitlist list failed");
        res.status(500).json({ error: "Failed to load waitlist" });
        return;
      }

      const rows = (data ?? []) as WaitlistRow[];
      res.json({
        total: rows.length,
        signups: rows.map((r) => ({
          id: r.id,
          email: r.email,
          plan: r.plan,
          seats: r.seats,
          locale: r.locale,
          source: r.source,
          createdAt: r.created_at,
        })),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      logger.error({ err: message }, "[admin] waitlist list crashed");
      res.status(500).json({ error: "Failed to load waitlist" });
    }
  },
);

router.get(
  "/admin/waitlist.csv",
  requireAuth,
  requireAdmin,
  async (_req, res): Promise<void> => {
    try {
      const { data, error } = await supabaseAdmin
        .from("waitlist_signups")
        .select("id, email, plan, seats, locale, source, created_at")
        .order("created_at", { ascending: false });

      if (error) {
        res.status(500).json({ error: "Failed to export waitlist" });
        return;
      }

      const rows = (data ?? []) as WaitlistRow[];
      const header = ["created_at", "email", "plan", "seats", "locale", "source"].join(",");
      const lines = rows.map((r) =>
        [r.created_at, r.email, r.plan, r.seats, r.locale, r.source]
          .map(csvEscape)
          .join(","),
      );
      const csv = [header, ...lines].join("\n");

      const stamp = new Date().toISOString().slice(0, 10);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="inboria-waitlist-${stamp}.csv"`,
      );
      res.send(csv);
    } catch {
      res.status(500).json({ error: "Failed to export waitlist" });
    }
  },
);

router.get(
  "/admin/users",
  requireAuth,
  requireAdmin,
  async (req, res): Promise<void> => {
    try {
      const search =
        typeof req.query["search"] === "string"
          ? req.query["search"].trim().toLowerCase()
          : "";

      const { data: profiles, error } = await supabaseAdmin
        .from("profiles")
        .select(
          "id, full_name, plan, seats, emails_used, ai_credits_used, emails_quota, stripe_customer_id, stripe_subscription_id, organisation_id, created_at, is_admin",
        )
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) {
        logger.error({ err: error }, "[admin] users list failed");
        res.status(500).json({ error: "Failed to load users" });
        return;
      }

      const profileRows = (profiles ?? []) as ProfileRow[];

      const orgIds = Array.from(
        new Set(profileRows.map((p) => p.organisation_id).filter((v): v is string => !!v)),
      );
      const orgNameById = new Map<string, string>();
      if (orgIds.length > 0) {
        const { data: orgs } = await supabaseAdmin
          .from("organisations")
          .select("id, name")
          .in("id", orgIds);
        for (const o of (orgs ?? []) as Array<{ id: string; name: string }>) {
          orgNameById.set(o.id, o.name);
        }
      }

      const enriched: Array<{
        id: string;
        email: string;
        fullName: string;
        plan: string;
        seats: number;
        emailsUsed: number;
        aiCreditsUsed: number;
        emailsQuota: number;
        organisationId: string | null;
        organisationName: string | null;
        hasPaddleSubscription: boolean;
        stripeCustomerId: string | null;
        createdAt: string;
        isAdmin: boolean;
      }> = [];

      for (const p of profileRows) {
        let email = "";
        try {
          const { data: u } = await supabaseAdmin.auth.admin.getUserById(p.id);
          email = u.user?.email || "";
        } catch {
          // ignore
        }

        if (search && !email.toLowerCase().includes(search) && !(p.full_name || "").toLowerCase().includes(search)) {
          continue;
        }

        enriched.push({
          id: p.id,
          email,
          fullName: p.full_name || "",
          plan: p.plan || "essai",
          seats: p.seats ?? 1,
          emailsUsed: p.emails_used ?? 0,
          aiCreditsUsed: p.ai_credits_used ?? 0,
          emailsQuota: p.emails_quota ?? 0,
          organisationId: p.organisation_id,
          organisationName: p.organisation_id ? orgNameById.get(p.organisation_id) ?? null : null,
          hasPaddleSubscription: !!p.stripe_subscription_id,
          stripeCustomerId: p.stripe_customer_id,
          createdAt: p.created_at,
          isAdmin: !!p.is_admin,
        });
      }

      res.json({ total: enriched.length, users: enriched });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      logger.error({ err: message }, "[admin] users list crashed");
      res.status(500).json({ error: "Failed to load users" });
    }
  },
);

router.post(
  "/admin/users/:userId/cancel-subscription",
  requireAuth,
  requireAdmin,
  async (req, res): Promise<void> => {
    try {
      const userId = req.params["userId"];
      if (!userId) {
        res.status(400).json({ error: "Missing userId" });
        return;
      }

      const body = (req.body ?? {}) as { mode?: unknown };
      const mode = body.mode === "immediate" ? "immediate" : "at_period_end";

      const { data: profile, error: profileErr } = await supabaseAdmin
        .from("profiles")
        .select("stripe_subscription_id, plan")
        .eq("id", userId)
        .single();

      if (profileErr || !profile) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      let paddleCancelled = false;
      let paddleError: string | null = null;

      if (profile.stripe_subscription_id) {
        try {
          const paddle = getPaddleClient();
          await paddle.subscriptions.cancel(profile.stripe_subscription_id, {
            effectiveFrom:
              mode === "immediate" ? ("immediately" as never) : ("next_billing_period" as never),
          });
          paddleCancelled = true;
        } catch (err: unknown) {
          paddleError = err instanceof Error ? err.message : "Paddle cancel failed";
          logger.error({ err: paddleError, userId }, "[admin] paddle cancel failed");
        }
      }

      // For testers without a Paddle subscription, OR when mode === "immediate",
      // immediately mark the plan as expired so access is revoked right away.
      // For at_period_end on a real Paddle sub, leave the plan untouched — the
      // webhook will downgrade it when the period ends.
      const shouldExpireNow = !profile.stripe_subscription_id || mode === "immediate";
      if (shouldExpireNow) {
        const { error: upErr } = await supabaseAdmin
          .from("profiles")
          .update({ plan: "expired", stripe_subscription_id: null })
          .eq("id", userId);
        if (upErr) {
          logger.error({ err: upErr, userId }, "[admin] failed to mark plan expired");
          res.status(500).json({ error: "Failed to revoke access" });
          return;
        }
      }

      // If we tried Paddle and it failed AND we did not perform a DB-side
      // revocation (at_period_end on a real sub), the cancellation effectively
      // did not happen — surface that to the admin instead of a misleading 200.
      if (paddleError && !shouldExpireNow) {
        res.status(502).json({
          ok: false,
          mode,
          paddleCancelled: false,
          paddleError,
          revokedNow: false,
          error: "Paddle cancellation failed",
        });
        return;
      }

      res.json({
        ok: true,
        mode,
        paddleCancelled,
        paddleError,
        revokedNow: shouldExpireNow,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      logger.error({ err: message }, "[admin] cancel subscription crashed");
      res.status(500).json({ error: "Failed to cancel subscription" });
    }
  },
);

export default router;
