import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth } from "../middlewares/auth";
import { requireAdmin } from "../middlewares/requireAdmin";
import { getPaddleClient } from "../lib/paddle";
import { logger } from "../lib/logger";
import OpenAI from "openai";
import {
  processEmailEmbeddings,
  dailyEmbeddingBudgetRemainingUsd,
} from "../services/email-embedder";

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

// Email Brain Phase 1 (#214) — backfill admin de l'indexation vectorielle
// du corpus de mails. À hit une fois par tenant après l'application de la
// migration 2026_05_03_email_chunks.sql.
//
// Réponse immédiate avec le nombre de mails enfilés ; le traitement réel
// est lancé en arrière-plan (promise non awaitée) avec logs de progression.
let backfillRunning = false;

router.post(
  "/admin/email-brain/backfill",
  requireAuth,
  requireAdmin,
  async (req, res): Promise<void> => {
    try {
      const body = (req.body ?? {}) as { limit?: unknown; userId?: unknown };
      const rawLimit = Number(body.limit);
      const limit =
        Number.isFinite(rawLimit) && rawLimit > 0
          ? Math.min(Math.floor(rawLimit), 20000)
          : 5000;
      const targetUserId =
        typeof body.userId === "string" && body.userId ? body.userId : null;

      if (backfillRunning) {
        res.status(409).json({
          ok: false,
          error: "A backfill is already running, wait for it to complete.",
        });
        return;
      }

      if (!process.env["OPENAI_API_KEY"]) {
        res.status(500).json({ ok: false, error: "OPENAI_API_KEY missing" });
        return;
      }

      let countQuery = supabaseAdmin
        .from("emails")
        .select("id", { count: "exact", head: true })
        .is("embeddings_indexed_at", null)
        .neq("status", "spam");
      if (targetUserId) countQuery = countQuery.eq("user_id", targetUserId);
      const { count: pendingCount, error: countErr } = await countQuery;
      if (countErr) {
        res.status(500).json({ ok: false, error: countErr.message });
        return;
      }

      const enqueued = Math.min(pendingCount ?? 0, limit);
      audit("email_brain_backfill_enqueued", {
        adminId: req.userId ?? null,
        targetUserId,
        enqueued,
        pendingTotal: pendingCount ?? 0,
        limit,
      });

      // Réponse immédiate, traitement async en arrière-plan.
      res.json({
        ok: true,
        enqueued,
        pendingTotal: pendingCount ?? 0,
        limit,
      });

      backfillRunning = true;
      void (async () => {
        const openai = new OpenAI({ apiKey: process.env["OPENAI_API_KEY"] });
        const startTs = Date.now();
        // Compteurs basés sur des IDs uniques pour éviter qu'un email
        // en échec transitoire (qu'on ne marque PAS indexé) soit re-fetché
        // au cycle suivant et compté plusieurs fois (bug review SEVERE).
        const seenIds = new Set<number>();
        let indexed = 0;
        let failed = 0;
        let budgetStopped = false;
        try {
          const BATCH = 50;
          // Curseur stable par id décroissant : on n'est plus dépendant
          // de la mutation `embeddings_indexed_at` pour avancer, et un
          // mail en échec transitoire ne bloque pas la file.
          let cursorId: number | null = null;
          while (seenIds.size < enqueued) {
            if (dailyEmbeddingBudgetRemainingUsd() <= 0) {
              budgetStopped = true;
              logger.warn(
                { processed: seenIds.size, indexed, failed },
                "[email-brain-backfill] daily budget exhausted, stopping",
              );
              break;
            }
            let q = supabaseAdmin
              .from("emails")
              .select(
                "id, user_id, shared_mailbox_id, sender, recipient, subject, body, status, sent_at, created_at",
              )
              .is("embeddings_indexed_at", null)
              .neq("status", "spam")
              .order("id", { ascending: false })
              .limit(BATCH);
            if (cursorId !== null) q = q.lt("id", cursorId);
            if (targetUserId) q = q.eq("user_id", targetUserId);
            const { data, error } = await q;
            if (error) {
              logger.warn(
                { err: error.message },
                "[email-brain-backfill] fetch failed",
              );
              break;
            }
            const rows = (data || []) as any[];
            if (rows.length === 0) break;
            cursorId = Number(rows[rows.length - 1]!.id);

            for (const row of rows) {
              const eid = Number(row.id);
              if (seenIds.has(eid)) continue;
              seenIds.add(eid);
              try {
                const outcome = await processEmailEmbeddings(openai, row);
                if (outcome === "indexed") indexed += 1;
                if (outcome === "transient_error") failed += 1;
                if (outcome !== "transient_error") {
                  await supabaseAdmin
                    .from("emails")
                    .update({ embeddings_indexed_at: new Date().toISOString() })
                    .eq("id", eid);
                }
              } catch (err: any) {
                failed += 1;
                logger.warn(
                  { err: err?.message, emailId: eid },
                  "[email-brain-backfill] processing crashed",
                );
              }
              if (seenIds.size % 500 === 0) {
                logger.info(
                  { processed: seenIds.size, indexed, failed, enqueued },
                  "[email-brain-backfill] progress",
                );
              }
              if (seenIds.size >= enqueued) break;
              if (dailyEmbeddingBudgetRemainingUsd() <= 0) {
                budgetStopped = true;
                break;
              }
            }
            if (budgetStopped) break;
          }
        } finally {
          backfillRunning = false;
          logger.info(
            {
              processed: seenIds.size,
              indexed,
              failed,
              enqueued,
              budgetStopped,
              durationMs: Date.now() - startTs,
              targetUserId,
            },
            "[email-brain-backfill] complete",
          );
        }
      })();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      logger.error({ err: message }, "[admin] email brain backfill crashed");
      res.status(500).json({ ok: false, error: "backfill crashed" });
    }
  },
);

// =============================================================================
// Task #306 phase 5 — Dashboard interne stats chat Inboria
// =============================================================================
// Agrège inboria_chat_logs sur une fenêtre paramétrable (default 7 jours).
// Renvoie : volume, fallback rate, reformulation rate, latence p50/p95/avg,
// score judge moyen par modèle, A/B mini vs gpt-4o, top raisons de fallback,
// pires réponses récentes (à reviewer).
//
// Tous les calculs sont faits en JS sur 5000 lignes max (cap garde-fou).
// Si la table inboria_chat_logs n'existe pas → renvoie un payload vide propre.
router.get("/inboria-stats", requireAuth, requireAdmin, async (req, res) => {
  try {
    const days = Math.max(
      1,
      Math.min(90, Number(req.query["days"]) || 7),
    );
    const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();

    const { data, error } = await supabaseAdmin
      .from("inboria_chat_logs")
      .select(
        "id, created_at, question_text, model_used, fallback_triggered, fallback_reason, was_reformulated, latency_ms, judge_score, ab_variant, ab_shadow_score",
      )
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(5000);

    if (error) {
      // Table absente ou autre erreur → payload vide propre
      logger.warn(
        { err: error.message },
        "[admin/inboria-stats] query failed (returning empty payload)",
      );
      res.json({
        windowDays: days,
        totalLogs: 0,
        byModel: {},
        fallback: { triggered: 0, rate: 0 },
        reformulation: { flagged: 0, rate: 0 },
        latency: { p50: 0, p95: 0, avg: 0 },
        judge: { scored: 0, avg: null, p50: null, byModel: {} },
        ab: { shadowCount: 0, miniAvg: null, shadowAvg: null, delta: null },
        topFallbackReasons: [],
        recentLowScore: [],
      });
      return;
    }

    const rows = (data || []) as Array<{
      id: string;
      created_at: string;
      question_text: string;
      model_used: string | null;
      fallback_triggered: boolean | null;
      fallback_reason: string | null;
      was_reformulated: boolean | null;
      latency_ms: number | null;
      judge_score: number | null;
      ab_variant: string | null;
      ab_shadow_score: number | null;
    }>;

    const total = rows.length;
    const byModel: Record<string, number> = {};
    const fallbackTriggered = rows.filter((r) => r.fallback_triggered).length;
    const reformulated = rows.filter((r) => r.was_reformulated).length;
    const latencies = rows
      .map((r) => r.latency_ms || 0)
      .filter((n) => n > 0)
      .sort((a, b) => a - b);

    for (const r of rows) {
      const m = r.model_used || "unknown";
      byModel[m] = (byModel[m] || 0) + 1;
    }

    const percentile = (arr: number[], p: number): number => {
      if (arr.length === 0) return 0;
      const idx = Math.min(arr.length - 1, Math.floor((p / 100) * arr.length));
      return arr[idx] ?? 0;
    };
    const avg = (arr: number[]): number =>
      arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;

    // Judge stats
    const scoredRows = rows.filter((r) => typeof r.judge_score === "number");
    const judgeScores = scoredRows.map((r) => r.judge_score as number);
    const judgeByModel: Record<string, { count: number; avg: number }> = {};
    for (const r of scoredRows) {
      const m = r.model_used || "unknown";
      const cur = judgeByModel[m] || { count: 0, avg: 0 };
      cur.count++;
      cur.avg = cur.avg + ((r.judge_score as number) - cur.avg) / cur.count;
      judgeByModel[m] = cur;
    }

    // A/B
    const abRows = rows.filter(
      (r) =>
        r.ab_variant === "shadow" &&
        typeof r.judge_score === "number" &&
        typeof r.ab_shadow_score === "number",
    );
    const abMiniAvg =
      abRows.length === 0
        ? null
        : avg(abRows.map((r) => r.judge_score as number));
    const abShadowAvg =
      abRows.length === 0
        ? null
        : avg(abRows.map((r) => r.ab_shadow_score as number));

    // Top fallback reasons
    const reasonCounts: Record<string, number> = {};
    for (const r of rows) {
      if (r.fallback_triggered && r.fallback_reason) {
        reasonCounts[r.fallback_reason] =
          (reasonCounts[r.fallback_reason] || 0) + 1;
      }
    }
    const topFallbackReasons = Object.entries(reasonCounts)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // Worst-scored recent rows (top 10 by lowest score)
    const recentLowScore = [...scoredRows]
      .sort((a, b) => (a.judge_score as number) - (b.judge_score as number))
      .slice(0, 10)
      .map((r) => ({
        id: r.id,
        question: (r.question_text || "").slice(0, 200),
        score: r.judge_score as number,
        model: r.model_used || "unknown",
        createdAt: r.created_at,
      }));

    res.json({
      windowDays: days,
      totalLogs: total,
      byModel,
      fallback: {
        triggered: fallbackTriggered,
        rate: total > 0 ? fallbackTriggered / total : 0,
      },
      reformulation: {
        flagged: reformulated,
        rate: total > 0 ? reformulated / total : 0,
      },
      latency: {
        p50: percentile(latencies, 50),
        p95: percentile(latencies, 95),
        avg: avg(latencies),
      },
      judge: {
        scored: scoredRows.length,
        avg: scoredRows.length > 0 ? avg(judgeScores) : null,
        p50: scoredRows.length > 0 ? percentile([...judgeScores].sort((a, b) => a - b), 50) : null,
        byModel: judgeByModel,
      },
      ab: {
        shadowCount: abRows.length,
        miniAvg: abMiniAvg,
        shadowAvg: abShadowAvg,
        delta:
          abMiniAvg !== null && abShadowAvg !== null
            ? abShadowAvg - abMiniAvg
            : null,
      },
      topFallbackReasons,
      recentLowScore,
    });
  } catch (err: any) {
    logger.error({ err: err?.message }, "[admin/inboria-stats] crashed");
    res.status(500).json({ error: "stats query failed" });
  }
});

export default router;
