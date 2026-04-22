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

interface PaginationQuery {
  page: number;
  limit: number;
}

function parsePagination(query: Record<string, unknown>, defaultLimit = 50): PaginationQuery {
  const rawPage = Number(query["page"]);
  const rawLimit = Number(query["limit"]);
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
  const limit =
    Number.isFinite(rawLimit) && rawLimit >= 1
      ? Math.min(Math.floor(rawLimit), 200)
      : defaultLimit;
  return { page, limit };
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

function audit(action: string, fields: Record<string, unknown>): void {
  logger.info({ audit: true, action, ...fields }, `[admin-audit] ${action}`);
}

router.get(
  "/admin/waitlist",
  requireAuth,
  requireAdmin,
  async (req, res): Promise<void> => {
    try {
      const { page, limit } = parsePagination(req.query as Record<string, unknown>);
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      const { data, error, count } = await supabaseAdmin
        .from("waitlist_signups")
        .select("id, email, plan, seats, locale, source, created_at", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) {
        logger.error({ err: error }, "[admin] waitlist list failed");
        res.status(500).json({ error: "Failed to load waitlist" });
        return;
      }

      const rows = (data ?? []) as WaitlistRow[];
      const total = count ?? rows.length;
      const totalPages = limit > 0 ? Math.max(1, Math.ceil(total / limit)) : 1;

      audit("list_waitlist", { adminId: req.userId ?? null, page, limit, total });

      res.json({
        total,
        page,
        pageSize: limit,
        totalPages,
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
  async (req, res): Promise<void> => {
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

      audit("export_waitlist_csv", { adminId: req.userId ?? null, total: rows.length });

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

interface PaddleSubscriptionLike {
  status?: string | null;
}

async function fetchPaddleStatus(subscriptionId: string): Promise<string | null> {
  try {
    const paddle = getPaddleClient();
    const sub = (await paddle.subscriptions.get(subscriptionId)) as PaddleSubscriptionLike;
    return typeof sub?.status === "string" ? sub.status : null;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Paddle status fetch failed";
    logger.warn({ err: message, subscriptionId }, "[admin] paddle status fetch failed");
    return null;
  }
}

router.get(
  "/admin/users",
  requireAuth,
  requireAdmin,
  async (req, res): Promise<void> => {
    try {
      const { page, limit } = parsePagination(req.query as Record<string, unknown>);
      const search =
        typeof req.query["search"] === "string"
          ? req.query["search"].trim().toLowerCase()
          : "";
      const planFilter =
        typeof req.query["plan"] === "string" && req.query["plan"].trim() !== ""
          ? req.query["plan"].trim()
          : null;

      // Search resolves to a set of profile IDs (email match via auth.users +
      // name match via profiles.full_name) which is then paginated server-side.
      let restrictedIds: string[] | null = null;
      if (search) {
        const idsFromAuth: string[] = [];
        try {
          // TODO(#72): scale email search beyond 1000 auth users via a denormalised email column.
          const { data: usersList } = await supabaseAdmin.auth.admin.listUsers({
            page: 1,
            perPage: 1000,
          });
          for (const u of usersList?.users ?? []) {
            if (u.email && u.email.toLowerCase().includes(search)) {
              idsFromAuth.push(u.id);
            }
          }
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "auth listUsers failed";
          logger.warn({ err: message }, "[admin] auth listUsers failed during search");
        }

        const { data: nameMatches, error: nameErr } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .ilike("full_name", `%${search}%`);
        if (nameErr) {
          logger.error({ err: nameErr }, "[admin] full_name search failed");
          res.status(500).json({ error: "Failed to load users" });
          return;
        }

        const idSet = new Set<string>(idsFromAuth);
        for (const r of (nameMatches ?? []) as Array<{ id: string }>) {
          idSet.add(r.id);
        }
        restrictedIds = Array.from(idSet);
      }

      const base = supabaseAdmin
        .from("profiles")
        .select(
          "id, full_name, plan, seats, emails_used, ai_credits_used, emails_quota, stripe_customer_id, stripe_subscription_id, organisation_id, created_at, is_admin",
          { count: "exact" },
        )
        .order("created_at", { ascending: false });

      const filtered = planFilter ? base.eq("plan", planFilter) : base;

      let profileRows: ProfileRow[] = [];
      let total = 0;

      if (restrictedIds !== null) {
        if (restrictedIds.length === 0) {
          profileRows = [];
          total = 0;
        } else {
          const from = (page - 1) * limit;
          const to = from + limit - 1;
          const { data, error, count } = await filtered
            .in("id", restrictedIds)
            .range(from, to);
          if (error) {
            logger.error({ err: error }, "[admin] users list failed");
            res.status(500).json({ error: "Failed to load users" });
            return;
          }
          profileRows = (data ?? []) as ProfileRow[];
          total = count ?? profileRows.length;
        }
      } else {
        const from = (page - 1) * limit;
        const to = from + limit - 1;
        const { data, error, count } = await filtered.range(from, to);
        if (error) {
          logger.error({ err: error }, "[admin] users list failed");
          res.status(500).json({ error: "Failed to load users" });
          return;
        }
        profileRows = (data ?? []) as ProfileRow[];
        total = count ?? profileRows.length;
      }

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

      interface EnrichedUser {
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
        paddleStatus: string | null;
        stripeCustomerId: string | null;
        createdAt: string;
        isAdmin: boolean;
      }

      const enriched: EnrichedUser[] = [];

      for (const p of profileRows) {
        let email = "";
        try {
          const { data: u } = await supabaseAdmin.auth.admin.getUserById(p.id);
          email = u.user?.email || "";
        } catch {
          // ignore
        }

        const paddleStatus = p.stripe_subscription_id
          ? await fetchPaddleStatus(p.stripe_subscription_id)
          : null;

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
          organisationName: p.organisation_id
            ? orgNameById.get(p.organisation_id) ?? null
            : null,
          hasPaddleSubscription: !!p.stripe_subscription_id,
          paddleStatus,
          stripeCustomerId: p.stripe_customer_id,
          createdAt: p.created_at,
          isAdmin: !!p.is_admin,
        });
      }

      const pageRows: EnrichedUser[] = enriched;
      const effectiveTotal = total;
      const totalPages =
        limit > 0 ? Math.max(1, Math.ceil(effectiveTotal / limit)) : 1;

      audit("list_users", {
        adminId: req.userId ?? null,
        page,
        limit,
        total: effectiveTotal,
        search: search || null,
        plan: planFilter,
      });

      res.json({
        total: effectiveTotal,
        page,
        pageSize: limit,
        totalPages,
        users: pageRows,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      logger.error({ err: message }, "[admin] users list crashed");
      res.status(500).json({ error: "Failed to load users" });
    }
  },
);

async function freeOrganisationSeat(userId: string, orgId: string | null): Promise<void> {
  if (!orgId) return;
  const { error: memberErr } = await supabaseAdmin
    .from("organisation_members")
    .delete()
    .eq("user_id", userId)
    .eq("organisation_id", orgId);
  if (memberErr) {
    throw new Error(
      `Failed to remove organisation membership: ${memberErr.message ?? "unknown"}`,
    );
  }
}

router.post(
  "/admin/users/:userId/cancel-subscription",
  requireAuth,
  requireAdmin,
  async (req, res): Promise<void> => {
    try {
      const rawUserId = req.params["userId"];
      const userId = typeof rawUserId === "string" ? rawUserId : "";
      if (!userId) {
        res.status(400).json({ error: "Missing userId" });
        return;
      }

      const body = (req.body ?? {}) as { mode?: unknown };
      const mode = body.mode === "immediate" ? "immediate" : "at_period_end";

      const { data: profile, error: profileErr } = await supabaseAdmin
        .from("profiles")
        .select("stripe_subscription_id, plan, organisation_id")
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

      // Refuse to revoke locally if Paddle was contacted but rejected the
      // cancel: revoked access + ongoing charges is the worst outcome.
      if (paddleError && profile.stripe_subscription_id) {
        audit("cancel_subscription_failed", {
          adminId: req.userId ?? null,
          targetUserId: userId,
          mode,
          paddleError,
        });
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

      const { error: upErr } = await supabaseAdmin
        .from("profiles")
        .update({ plan: "expired", stripe_subscription_id: null })
        .eq("id", userId);
      if (upErr) {
        logger.error({ err: upErr, userId }, "[admin] failed to mark plan expired");
        res.status(500).json({ error: "Failed to revoke access" });
        return;
      }

      try {
        await freeOrganisationSeat(userId, profile.organisation_id);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Failed to free organisation seat";
        logger.error({ err: message, userId }, "[admin] free seat failed during revoke");
        audit("cancel_subscription_partial", {
          adminId: req.userId ?? null,
          targetUserId: userId,
          mode,
          paddleCancelled,
          stage: "free_seat",
          error: message,
        });
        res.status(500).json({
          ok: false,
          mode,
          paddleCancelled,
          paddleError,
          revokedNow: false,
          error: message,
        });
        return;
      }
      // After freeing the seat, also detach the profile from the organisation.
      if (profile.organisation_id) {
        const { error: detachErr } = await supabaseAdmin
          .from("profiles")
          .update({ organisation_id: null })
          .eq("id", userId);
        if (detachErr) {
          logger.error(
            { err: detachErr, userId },
            "[admin] failed to detach profile from organisation",
          );
          audit("cancel_subscription_partial", {
            adminId: req.userId ?? null,
            targetUserId: userId,
            mode,
            paddleCancelled,
            stage: "detach_profile",
            error: detachErr.message ?? "unknown",
          });
          res.status(500).json({
            ok: false,
            mode,
            paddleCancelled,
            paddleError,
            revokedNow: false,
            error: "Failed to detach profile from organisation",
          });
          return;
        }
      }

      audit("cancel_subscription", {
        adminId: req.userId ?? null,
        targetUserId: userId,
        mode,
        paddleCancelled,
        paddleError,
        seatFreed: !!profile.organisation_id,
      });

      res.json({
        ok: true,
        mode,
        paddleCancelled,
        paddleError,
        revokedNow: true,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      logger.error({ err: message }, "[admin] cancel subscription crashed");
      res.status(500).json({ error: "Failed to cancel subscription" });
    }
  },
);

export default router;
