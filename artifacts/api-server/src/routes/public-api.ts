import { Router, type IRouter } from "express";
import OpenAI from "openai";
import { supabaseAdmin } from "../lib/supabase";
import { requireApiKey } from "../middlewares/api-key";
import { emitWebhook } from "../services/webhooks";
import { recordAutopilotEvent } from "../services/autopilot-events";
import { getMemberMailboxIds } from "../lib/inbox-scope";
import { logger } from "../lib/logger";

// Email Brain Phase 3 (#216) — scope filter pour les tables inboria_*.
// Personnel (user_id + shared_mailbox_id null) OU boîtes partagées dont
// l'utilisateur est membre. Les inboria_* sont indexées par user_id ET
// shared_mailbox_id selon l'origine du mail extrait.
function brainScopeFilter(userId: string, mailboxIds: string[]): string {
  const personal = `and(user_id.eq.${userId},shared_mailbox_id.is.null)`;
  const parts = [personal];
  if (mailboxIds.length > 0) {
    parts.push(`shared_mailbox_id.in.(${mailboxIds.join(",")})`);
  }
  return parts.join(",");
}

function normalizeEmail(raw: string): string {
  const s = String(raw || "").trim().toLowerCase();
  const angle = s.match(/<([^>]+)>/);
  if (angle && angle[1]) return angle[1].trim();
  const bare = s.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  return bare ? bare[0].trim() : s;
}

const router: IRouter = Router();

// =====================================================================
// GET /api/v1/public/emails — list recent emails for the key owner
// =====================================================================
router.get("/v1/public/emails", requireApiKey(["emails:read"]), async (req, res): Promise<void> => {
  try {
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || "50"), 10) || 50));
    const offset = Math.max(0, parseInt(String(req.query.offset || "0"), 10) || 0);
    const since = req.query.since ? String(req.query.since) : null;

    let q = supabaseAdmin
      .from("emails")
      .select("id, sender, subject, body, status, priority, summary, category_id, created_at")
      .eq("user_id", req.userId!)
      .neq("status", "supprime")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (since) q = q.gte("created_at", since);

    const { data, error } = await q;
    if (error) { res.status(500).json({ error: error.message }); return; }

    res.json({
      data: (data || []).map((e: any) => ({
        id: e.id,
        from: e.sender,
        subject: e.subject,
        body: e.body,
        status: e.status,
        priority: e.priority,
        summary: e.summary,
        categoryId: e.category_id,
        createdAt: e.created_at,
      })),
      pagination: { limit, offset, count: (data || []).length },
    });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Internal error" });
  }
});

router.get("/v1/public/emails/:id", requireApiKey(["emails:read"]), async (req, res): Promise<void> => {
  try {
    const { data, error } = await supabaseAdmin
      .from("emails")
      .select("id, sender, recipient, subject, body, status, priority, summary, category_id, created_at")
      .eq("id", req.params.id)
      .eq("user_id", req.userId!)
      .single();
    if (error || !data) { res.status(404).json({ error: "Not found" }); return; }
    res.json({
      id: data.id,
      from: data.sender,
      to: data.recipient,
      subject: data.subject,
      body: data.body,
      status: data.status,
      priority: data.priority,
      summary: data.summary,
      categoryId: data.category_id,
      createdAt: data.created_at,
    });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Internal error" });
  }
});

// =====================================================================
// POST /api/v1/public/tasks — create a task
// =====================================================================
router.post("/v1/public/tasks", requireApiKey(["tasks:write"]), async (req, res): Promise<void> => {
  try {
    const { title, emailId, projectId, dueDate } = req.body || {};
    if (!title || typeof title !== "string" || title.trim().length < 2) {
      res.status(400).json({ error: "title required (min 2 chars)" });
      return;
    }
    const insertData: Record<string, unknown> = {
      user_id: req.userId!,
      title: title.trim(),
    };
    if (emailId) insertData.email_id = emailId;
    if (projectId) insertData.project_id = projectId;
    if (dueDate) insertData.due_date = dueDate;

    const { data, error } = await supabaseAdmin
      .from("tasks")
      .insert(insertData)
      .select("id, title, done, due_date, email_id, project_id, created_at")
      .single();

    if (error || !data) { res.status(500).json({ error: error?.message || "Insert failed" }); return; }

    recordAutopilotEvent({
      userId: req.userId!,
      eventType: "task_created",
      title: data.title || null,
      emailId: (data.email_id as number | null) ?? null,
      metadata: { source: "public_api" },
    }).catch(() => {});

    emitWebhook({
      userId: req.userId!,
      event: "task.created",
      payload: { id: data.id, title: data.title, emailId: data.email_id, projectId: data.project_id, dueDate: data.due_date, source: "public_api" },
    }).catch(() => {});

    res.status(201).json({
      id: data.id,
      title: data.title,
      done: data.done,
      dueDate: data.due_date,
      emailId: data.email_id,
      projectId: data.project_id,
      createdAt: data.created_at,
    });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Internal error" });
  }
});

// =====================================================================
// POST /api/v1/public/appointments — create an appointment
// =====================================================================
router.post("/v1/public/appointments", requireApiKey(["appointments:write"]), async (req, res): Promise<void> => {
  try {
    const { title, description, location, startAt, endAt, allDay, emailId, projectId, reminderMinutes, participants } = req.body || {};
    if (!title || !startAt || !endAt) {
      res.status(400).json({ error: "title, startAt, endAt required" });
      return;
    }
    const { data, error } = await supabaseAdmin
      .from("appointments")
      .insert({
        user_id: req.userId!,
        title,
        description: description || null,
        location: location || null,
        start_at: startAt,
        end_at: endAt,
        all_day: !!allDay,
        email_id: emailId || null,
        project_id: projectId || null,
        reminder_minutes: reminderMinutes ?? 30,
        participants: participants || null,
      })
      .select("id, title, start_at, end_at, all_day, email_id, project_id, created_at")
      .single();
    if (error || !data) { res.status(500).json({ error: error?.message || "Insert failed" }); return; }

    emitWebhook({
      userId: req.userId!,
      event: "appointment.created",
      payload: { id: data.id, title: data.title, startAt: data.start_at, endAt: data.end_at, source: "public_api" },
    }).catch(() => {});

    res.status(201).json({
      id: data.id,
      title: data.title,
      startAt: data.start_at,
      endAt: data.end_at,
      allDay: data.all_day,
      emailId: data.email_id,
      projectId: data.project_id,
      createdAt: data.created_at,
    });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Internal error" });
  }
});

// =====================================================================
// POST /api/v1/public/contacts — create / upsert a contact (lightweight)
// We don't have a proper contacts table; we record an organisation-level
// known contact via a simple table or fall back to projects.contacts JSON.
// For V1 we store as a no-op success if no table exists, so client sees 200.
// =====================================================================
router.post("/v1/public/contacts", requireApiKey(["contacts:write"]), async (req, res): Promise<void> => {
  try {
    const { name, email, phone, notes } = req.body || {};
    if (!email || typeof email !== "string" || !/.+@.+\..+/.test(email)) {
      res.status(400).json({ error: "email required" });
      return;
    }
    const lcEmail = email.toLowerCase();

    // Upsert into contacts table; require it to exist for the public API contract.
    const { data, error } = await supabaseAdmin
      .from("contacts")
      .upsert(
        {
          user_id: req.userId!,
          name: name || null,
          email: lcEmail,
          phone: phone || null,
          notes: notes || null,
        },
        { onConflict: "user_id,email" },
      )
      .select("id, name, email, phone, notes, created_at, updated_at")
      .maybeSingle();

    if (error) {
      logger.warn({ err: error.message }, "[public-api] contacts insert failed");
      res.status(503).json({
        error: "contacts_storage_unavailable",
        message: "Contacts table is not provisioned. Apply migrations/2026_04_24_b2b_credibility.sql in Supabase.",
      });
      return;
    }
    res.status(201).json({ ...data, persisted: true });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Internal error" });
  }
});

// =====================================================================
// POST /api/v1/public/rules/:id/trigger — manually apply an ai_rule.
//
// Behavior:
//   - Validates the rule exists and is owned by the API key's user.
//   - If body.emailId is provided, the rule's forced_priority and
//     forced_category are applied to that single email (only if it
//     belongs to the same user). The rule's sender_pattern is *not*
//     re-checked here — the caller is asking for an explicit override.
//   - Otherwise, the endpoint scans the user's last 200 inbox emails
//     and re-applies forced_priority / forced_category to those whose
//     sender contains the rule's sender_pattern (case-insensitive).
//   - In all cases an `rule.triggered` webhook is emitted with the
//     count of affected emails so external automations can react.
// =====================================================================
router.post("/v1/public/rules/:id/trigger", requireApiKey(["rules:trigger"]), async (req, res): Promise<void> => {
  try {
    const ruleId = req.params.id;
    const userId = req.userId!;
    const body = req.body || {};
    const targetEmailId = body.emailId != null ? Number(body.emailId) : null;

    // Ownership check on the rule.
    const { data: rule, error: ruleErr } = await supabaseAdmin
      .from("ai_rules")
      .select("id, user_id, sender_pattern, forced_priority, forced_category")
      .eq("id", ruleId)
      .maybeSingle();
    if (ruleErr || !rule) {
      res.status(404).json({ error: "Rule not found" });
      return;
    }
    if (rule.user_id !== userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    // Resolve forced category id (if any) once.
    let forcedCategoryId: string | null = null;
    if (rule.forced_category) {
      const { data: cat } = await supabaseAdmin
        .from("categories")
        .select("id")
        .eq("user_id", userId)
        .ilike("name", rule.forced_category)
        .maybeSingle();
      forcedCategoryId = cat?.id || null;
    }

    const r = rule;
    function buildUpdate(): Record<string, unknown> {
      const upd: Record<string, unknown> = {};
      if (r.forced_priority) upd.priority = r.forced_priority;
      if (forcedCategoryId) upd.category_id = forcedCategoryId;
      return upd;
    }

    let affected = 0;

    if (targetEmailId) {
      const { data: e } = await supabaseAdmin
        .from("emails")
        .select("id, user_id")
        .eq("id", targetEmailId)
        .maybeSingle();
      if (!e || e.user_id !== userId) {
        res.status(404).json({ error: "Email not found" });
        return;
      }
      const upd = buildUpdate();
      if (Object.keys(upd).length > 0) {
        await supabaseAdmin.from("emails").update(upd).eq("id", targetEmailId);
        affected = 1;
      }
    } else if (rule.sender_pattern) {
      const pattern = String(rule.sender_pattern).trim();
      if (pattern) {
        const { data: matches } = await supabaseAdmin
          .from("emails")
          .select("id")
          .eq("user_id", userId)
          .ilike("sender", `%${pattern}%`)
          .neq("status", "supprime")
          .order("created_at", { ascending: false })
          .limit(200);
        const ids = (matches || []).map((m: any) => m.id);
        if (ids.length > 0) {
          const upd = buildUpdate();
          if (Object.keys(upd).length > 0) {
            await supabaseAdmin.from("emails").update(upd).in("id", ids);
            affected = ids.length;
          }
        }
      }
    }

    emitWebhook({
      userId,
      event: "rule.triggered",
      payload: {
        ruleId,
        emailId: targetEmailId,
        affected,
        source: "public_api",
      },
    }).catch(() => {});

    logger.info({ userId, ruleId, affected, source: "public_api" }, "[public-api] rule.triggered");

    res.status(202).json({ accepted: true, ruleId, affected });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Internal error" });
  }
});

// =====================================================================
// Developer documentation router (mounted at both /api and /).
// Exposes:
//   - GET /v1/public/openapi.json  (the OpenAPI 3 spec)
//   - GET /dev                     (Redoc viewer)
// =====================================================================
export const devDocsRouter: IRouter = Router();

devDocsRouter.get("/v1/public/openapi.json", (_req, res) => {
  res.json(PUBLIC_OPENAPI);
});

devDocsRouter.get("/dev", (_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Inboria — Developers</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    .header { padding: 16px 24px; border-bottom: 1px solid #e5e7eb; display: flex; align-items: center; justify-content: space-between; }
    .header h1 { font-size: 18px; margin: 0; }
    .header a { color: #2d7dd2; text-decoration: none; font-size: 14px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Inboria — API publique v1</h1>
    <a href="/api/v1/public/openapi.json">Télécharger OpenAPI spec</a>
  </div>
  <redoc spec-url="/api/v1/public/openapi.json"></redoc>
  <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
</body>
</html>`);
});

// Also mount the dev/docs handlers on the main /api router for backwards
// compatibility (existing UI links use /api/dev and /api/v1/public/openapi.json).
router.use("/", devDocsRouter);

const PUBLIC_OPENAPI = {
  openapi: "3.0.3",
  info: {
    title: "Inboria Public API",
    version: "1.0.0",
    description:
      "Public REST API for Inboria. Authenticate with `X-API-Key: <key>` (or `Authorization: Bearer <key>`). Rate limit: 60 requests / minute / key. Generate keys at /dashboard/parametres/api.",
  },
  servers: [{ url: "/api/v1/public", description: "Production base path" }],
  components: {
    securitySchemes: {
      ApiKeyAuth: { type: "apiKey", in: "header", name: "X-API-Key" },
    },
    schemas: {
      Error: { type: "object", properties: { error: { type: "string" } } },
      Email: {
        type: "object",
        properties: {
          id: { type: "integer" },
          from: { type: "string" },
          subject: { type: "string" },
          body: { type: "string" },
          status: { type: "string" },
          priority: { type: "string" },
          summary: { type: "string" },
          categoryId: { type: "string", nullable: true },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Task: {
        type: "object",
        required: ["title"],
        properties: {
          id: { type: "integer" },
          title: { type: "string" },
          done: { type: "boolean" },
          dueDate: { type: "string", format: "date-time", nullable: true },
          emailId: { type: "integer", nullable: true },
          projectId: { type: "string", nullable: true },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Appointment: {
        type: "object",
        required: ["title", "startAt", "endAt"],
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          startAt: { type: "string", format: "date-time" },
          endAt: { type: "string", format: "date-time" },
          allDay: { type: "boolean" },
          location: { type: "string", nullable: true },
          description: { type: "string", nullable: true },
        },
      },
      Contact: {
        type: "object",
        required: ["email"],
        properties: {
          email: { type: "string" },
          name: { type: "string", nullable: true },
          phone: { type: "string", nullable: true },
          notes: { type: "string", nullable: true },
        },
      },
    },
  },
  security: [{ ApiKeyAuth: [] }],
  paths: {
    "/emails": {
      get: {
        summary: "List emails",
        parameters: [
          { name: "limit", in: "query", schema: { type: "integer", default: 50, maximum: 100 } },
          { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
          { name: "since", in: "query", schema: { type: "string", format: "date-time" } },
        ],
        responses: { "200": { description: "OK" }, "401": { description: "Unauthorized" }, "429": { description: "Rate limited" } },
      },
    },
    "/emails/{id}": {
      get: {
        summary: "Get one email",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { "200": { description: "OK" }, "404": { description: "Not found" } },
      },
    },
    "/tasks": {
      post: {
        summary: "Create a task",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/Task" } } },
        },
        responses: { "201": { description: "Created" }, "400": { description: "Bad request" } },
      },
    },
    "/appointments": {
      post: {
        summary: "Create an appointment",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/Appointment" } } },
        },
        responses: { "201": { description: "Created" }, "400": { description: "Bad request" } },
      },
    },
    "/contacts": {
      post: {
        summary: "Create or upsert a contact",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/Contact" } } },
        },
        responses: { "201": { description: "Created" }, "200": { description: "Accepted (no persistence)" }, "400": { description: "Bad request" } },
      },
    },
    "/rules/{id}/trigger": {
      post: {
        summary: "Manually trigger a rule by id",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "202": { description: "Accepted" } },
      },
    },
  },
};

// =====================================================================
// Email Brain Phase 3 (#216) — API agentique lecture mémoire
// =====================================================================

// GET /api/v1/public/brain/contact?email=...
router.get(
  "/v1/public/brain/contact",
  requireApiKey(["brain:read"]),
  async (req, res): Promise<void> => {
    try {
      const userId = req.userId!;
      const email = normalizeEmail(String(req.query.email || ""));
      if (!email || !email.includes("@")) {
        res.status(400).json({ error: "email query param required" });
        return;
      }
      const mailboxIds = await getMemberMailboxIds(userId);
      const scope = brainScopeFilter(userId, mailboxIds);

      // Manual contact fiche (optionnelle).
      const { data: manualRows } = await supabaseAdmin
        .from("contacts")
        .select("display_name, phone, company, notes, updated_at")
        .eq("email", email)
        .or(scope)
        .order("updated_at", { ascending: false })
        .limit(1);
      const manual = (manualRows || [])[0] || null;

      // Dernière synthèse (cache contact-summarizer).
      let summary: { content: string; generated_at: string } | null = null;
      try {
        const { data: summaryRow } = await supabaseAdmin
          .from("inboria_contact_summaries")
          .select("content, generated_at")
          .eq("user_id", userId)
          .eq("contact_email", email)
          .is("shared_mailbox_id", null)
          .maybeSingle();
        if (summaryRow) summary = summaryRow as any;
      } catch {
        // table missing — ignore
      }

      // Stats : nb mails entrants/sortants connus avec ce contact.
      const { count: inboundCount } = await supabaseAdmin
        .from("emails")
        .select("id", { count: "exact", head: true })
        .ilike("sender", `%${email}%`)
        .or(scope);

      res.json({
        email,
        manual: manual
          ? {
              displayName: (manual as any).display_name || null,
              phone: (manual as any).phone || null,
              company: (manual as any).company || null,
              notes: (manual as any).notes || null,
              updatedAt: (manual as any).updated_at || null,
            }
          : null,
        summary: summary
          ? { content: summary.content, generatedAt: summary.generated_at }
          : null,
        stats: { knownEmails: inboundCount || 0 },
      });
    } catch (e: any) {
      req.log.error({ err: e?.message }, "[brain-api] contact crashed");
      res.status(500).json({ error: e?.message || "Internal error" });
    }
  },
);

// GET /api/v1/public/brain/contact/timeline?email=&limit=
router.get(
  "/v1/public/brain/contact/timeline",
  requireApiKey(["brain:read"]),
  async (req, res): Promise<void> => {
    try {
      const userId = req.userId!;
      const email = normalizeEmail(String(req.query.email || ""));
      if (!email || !email.includes("@")) {
        res.status(400).json({ error: "email query param required" });
        return;
      }
      const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || "20"), 10) || 20));
      const mailboxIds = await getMemberMailboxIds(userId);
      const scope = brainScopeFilter(userId, mailboxIds);

      const [factsRes, episodesRes, decisionsRes] = await Promise.all([
        supabaseAdmin
          .from("inboria_facts")
          .select("kind, statement, source_email_id, extracted_at")
          .eq("contact_email", email)
          .or(scope)
          .order("extracted_at", { ascending: false })
          .limit(limit),
        supabaseAdmin
          .from("inboria_episodes")
          .select("kind, summary, event_date, source_email_id, extracted_at")
          .eq("contact_email", email)
          .or(scope)
          .order("extracted_at", { ascending: false })
          .limit(limit),
        supabaseAdmin
          .from("inboria_decisions")
          .select("decision, decided_at, amount_eur, source_email_id, created_at")
          .eq("contact_email", email)
          .or(scope)
          .order("created_at", { ascending: false })
          .limit(limit),
      ]);

      res.json({
        email,
        facts: (factsRes.data || []).map((f: any) => ({
          kind: f.kind,
          statement: f.statement,
          sourceEmailId: f.source_email_id,
          extractedAt: f.extracted_at,
        })),
        episodes: (episodesRes.data || []).map((e: any) => ({
          kind: e.kind,
          summary: e.summary,
          eventDate: e.event_date,
          sourceEmailId: e.source_email_id,
          extractedAt: e.extracted_at,
        })),
        decisions: (decisionsRes.data || []).map((d: any) => ({
          decision: d.decision,
          decidedAt: d.decided_at,
          amountEur: d.amount_eur,
          sourceEmailId: d.source_email_id,
          createdAt: d.created_at,
        })),
      });
    } catch (e: any) {
      req.log.error({ err: e?.message }, "[brain-api] timeline crashed");
      res.status(500).json({ error: e?.message || "Internal error" });
    }
  },
);

// GET /api/v1/public/brain/projects?status=active&limit=
router.get(
  "/v1/public/brain/projects",
  requireApiKey(["brain:read"]),
  async (req, res): Promise<void> => {
    try {
      const userId = req.userId!;
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || "30"), 10) || 30));
      const status = req.query.status ? String(req.query.status) : "active";
      const mailboxIds = await getMemberMailboxIds(userId);
      const scope = brainScopeFilter(userId, mailboxIds);

      const { data, error } = await supabaseAdmin
        .from("inboria_projects_inferred")
        .select("id, name, status, participants, last_activity_at, created_at")
        .eq("status", status)
        .or(scope)
        .order("last_activity_at", { ascending: false, nullsFirst: false })
        .limit(limit);
      if (error && !/relation .*inboria_projects_inferred.* does not exist/i.test(error.message)) {
        res.status(500).json({ error: error.message });
        return;
      }
      res.json({
        data: (data || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          status: p.status,
          participants: p.participants || [],
          lastActivityAt: p.last_activity_at,
          createdAt: p.created_at,
        })),
      });
    } catch (e: any) {
      req.log.error({ err: e?.message }, "[brain-api] projects crashed");
      res.status(500).json({ error: e?.message || "Internal error" });
    }
  },
);

// GET /api/v1/public/brain/decisions?contactEmail=&since=&limit=
router.get(
  "/v1/public/brain/decisions",
  requireApiKey(["brain:read"]),
  async (req, res): Promise<void> => {
    try {
      const userId = req.userId!;
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || "30"), 10) || 30));
      const since = req.query.since ? String(req.query.since) : null;
      const contactEmail = req.query.contactEmail
        ? normalizeEmail(String(req.query.contactEmail))
        : null;
      const mailboxIds = await getMemberMailboxIds(userId);
      const scope = brainScopeFilter(userId, mailboxIds);

      let q = supabaseAdmin
        .from("inboria_decisions")
        .select("decision, contact_email, decided_at, amount_eur, source_email_id, created_at")
        .or(scope)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (contactEmail) q = q.eq("contact_email", contactEmail);
      if (since) q = q.gte("created_at", since);

      const { data, error } = await q;
      if (error && !/relation .*inboria_decisions.* does not exist/i.test(error.message)) {
        res.status(500).json({ error: error.message });
        return;
      }
      res.json({
        data: (data || []).map((d: any) => ({
          decision: d.decision,
          contactEmail: d.contact_email,
          decidedAt: d.decided_at,
          amountEur: d.amount_eur,
          sourceEmailId: d.source_email_id,
          createdAt: d.created_at,
        })),
      });
    } catch (e: any) {
      req.log.error({ err: e?.message }, "[brain-api] decisions crashed");
      res.status(500).json({ error: e?.message || "Internal error" });
    }
  },
);

// GET /api/v1/public/brain/search?q=...&limit=
router.get(
  "/v1/public/brain/search",
  requireApiKey(["brain:read"]),
  async (req, res): Promise<void> => {
    try {
      const userId = req.userId!;
      const q = String(req.query.q || "").trim();
      if (!q || q.length < 3) {
        res.status(400).json({ error: "q query param required (min 3 chars)" });
        return;
      }
      const limit = Math.min(20, Math.max(1, parseInt(String(req.query.limit || "10"), 10) || 10));
      const mailboxIds = await getMemberMailboxIds(userId);

      const apiKey = process.env["OPENAI_API_KEY"];
      if (!apiKey) {
        res.status(503).json({ error: "Search unavailable: embeddings disabled" });
        return;
      }
      const openai = new OpenAI({ apiKey });
      const embed = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: q,
      });
      const queryVec = embed.data[0]?.embedding as number[] | undefined;
      if (!Array.isArray(queryVec) || queryVec.length !== 1536) {
        res.status(500).json({ error: "Embedding failed" });
        return;
      }
      const { data, error } = await supabaseAdmin.rpc("search_email_chunks", {
        query_vec: queryVec as any,
        scope_user_ids: [userId],
        scope_mailbox_ids: mailboxIds,
        exclude_private: false,
        match_limit: limit * 2,
      });
      if (error) {
        const msg = String(error.message || "");
        if (
          /relation .*email_chunks.* does not exist/i.test(msg) ||
          /function .*search_email_chunks.* does not exist/i.test(msg)
        ) {
          res.json({ data: [] });
          return;
        }
        res.status(500).json({ error: msg });
        return;
      }
      const seen = new Set<number>();
      const hits = ((data as any[]) || [])
        .filter((h) => typeof h.distance === "number" && h.distance < 0.78)
        .filter((h) => {
          const eid = Number(h.email_id);
          if (seen.has(eid)) return false;
          seen.add(eid);
          return true;
        })
        .slice(0, limit)
        .map((h) => ({
          emailId: Number(h.email_id),
          subject: String(h.subject || ""),
          sender: String(h.sender || ""),
          sentAt: String(h.sent_at || h.created_at || ""),
          snippet: String(h.content || "").slice(0, 280).replace(/\s+/g, " "),
          distance: Number(h.distance),
        }));
      res.json({ data: hits });
    } catch (e: any) {
      req.log.error({ err: e?.message }, "[brain-api] search crashed");
      res.status(500).json({ error: e?.message || "Internal error" });
    }
  },
);

export default router;
