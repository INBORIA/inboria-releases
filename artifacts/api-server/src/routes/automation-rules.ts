import { Router, type IRouter } from "express";
import OpenAI from "openai";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth } from "../middlewares/auth";
import { logger } from "../lib/logger";
import {
  matchesConditions,
  parseRuleHeuristic,
  validateRulePayload,
  type Conditions,
  type Rule,
  type RuleAction,
} from "../services/automation-rules";
import { AI_COST, checkEntitlement, consumeAiCredits } from "../services/credits";

const openai = new OpenAI({ apiKey: process.env["OPENAI_API_KEY"] });
const router: IRouter = Router();

function rowToRule(row: any) {
  return {
    id: row.id,
    name: row.name,
    naturalLanguageInput: row.natural_language_input || null,
    conditions: row.conditions || {},
    actions: Array.isArray(row.actions) ? row.actions : [],
    enabled: row.enabled !== false,
    connectionId: row.connection_id || null,
    runsCount: row.runs_count || 0,
    lastRunAt: row.last_run_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

router.get("/automation-rules", requireAuth, async (req, res): Promise<void> => {
  try {
    const { data, error } = await supabaseAdmin
      .from("automation_rules")
      .select("*")
      .eq("user_id", req.userId!)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      logger.error({ err: error.message }, "[rules] list failed");
      res.status(500).json({ error: "Failed to list rules" }); return;
    }
    res.json((data || []).map(rowToRule));
  } catch (e: any) {
    res.status(500).json({ error: "Failed to list rules" });
  }
});

router.post("/automation-rules", requireAuth, async (req, res): Promise<void> => {
  try {
    const { name, conditions, actions, enabled, connectionId, naturalLanguageInput } = req.body || {};
    const validation = validateRulePayload({ name, conditions, actions });
    if (!validation.ok) {
      res.status(400).json({ error: "Invalid rule", details: validation.errors }); return;
    }
    const insert: Record<string, any> = {
      user_id: req.userId!,
      name: validation.rule.name,
      conditions: validation.rule.conditions,
      actions: validation.rule.actions,
      enabled: enabled !== false,
    };
    if (typeof connectionId === "string" && connectionId.trim()) insert.connection_id = connectionId.trim();
    if (typeof naturalLanguageInput === "string" && naturalLanguageInput.trim()) {
      insert.natural_language_input = naturalLanguageInput.slice(0, 1000);
    }
    const { data, error } = await supabaseAdmin
      .from("automation_rules")
      .insert(insert)
      .select("*")
      .single();
    if (error || !data) {
      logger.error({ err: error?.message }, "[rules] create failed");
      res.status(500).json({ error: "Failed to create rule" }); return;
    }
    res.status(201).json(rowToRule(data));
  } catch (e: any) {
    logger.error({ err: e?.message }, "[rules] create exception");
    res.status(500).json({ error: "Failed to create rule" });
  }
});

router.patch("/automation-rules/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const { id } = req.params;
    const update: Record<string, any> = { updated_at: new Date().toISOString() };
    const body = req.body || {};

    if (body.name !== undefined || body.conditions !== undefined || body.actions !== undefined) {
      const { data: existing } = await supabaseAdmin
        .from("automation_rules")
        .select("name, conditions, actions")
        .eq("id", id)
        .eq("user_id", req.userId!)
        .maybeSingle();
      if (!existing) { res.status(404).json({ error: "Rule not found" }); return; }
      const merged = {
        name: body.name ?? existing.name,
        conditions: body.conditions ?? existing.conditions,
        actions: body.actions ?? existing.actions,
      };
      const validation = validateRulePayload(merged);
      if (!validation.ok) {
        res.status(400).json({ error: "Invalid rule", details: validation.errors }); return;
      }
      update.name = validation.rule.name;
      update.conditions = validation.rule.conditions;
      update.actions = validation.rule.actions;
    }
    if (typeof body.enabled === "boolean") update.enabled = body.enabled;

    const { data, error } = await supabaseAdmin
      .from("automation_rules")
      .update(update)
      .eq("id", id)
      .eq("user_id", req.userId!)
      .select("*")
      .single();
    if (error || !data) { res.status(404).json({ error: "Rule not found" }); return; }
    res.json(rowToRule(data));
  } catch (e: any) {
    logger.error({ err: e?.message }, "[rules] update exception");
    res.status(500).json({ error: "Failed to update rule" });
  }
});

router.delete("/automation-rules/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const { error } = await supabaseAdmin
      .from("automation_rules")
      .delete()
      .eq("id", req.params.id)
      .eq("user_id", req.userId!);
    if (error) { res.status(500).json({ error: "Failed to delete" }); return; }
    res.status(204).send();
  } catch {
    res.status(500).json({ error: "Failed to delete" });
  }
});

/**
 * Parse a natural-language sentence into a structured rule preview.
 * 1) Try the deterministic heuristic parser first (free, fast, unit-tested).
 * 2) Fall back to GPT-4o-mini if heuristic fails (bills rule_parse credits).
 */
router.post("/automation-rules/parse", requireAuth, async (req, res): Promise<void> => {
  try {
    const { input, name } = req.body || {};
    if (!input || typeof input !== "string" || input.trim().length < 5) {
      res.status(400).json({ error: "input required (>= 5 chars)" }); return;
    }

    const heuristic = parseRuleHeuristic(input, typeof name === "string" ? name : undefined);
    if (heuristic) {
      res.json({ source: "heuristic", rule: heuristic });
      return;
    }

    const ent = await checkEntitlement(req.userId!, AI_COST.rule_parse);
    if (ent.blocked) { res.status(403).json({ error: ent.reason }); return; }
    const billed = await consumeAiCredits(req.userId!, "rule_parse", { len: input.length });
    if (!billed.ok) { res.status(402).json({ error: "Billing failed" }); return; }

    let aiCandidate: any = null;
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        max_completion_tokens: 400,
        messages: [
          {
            role: "system",
            content: `Tu convertis une instruction en langage naturel (FR/EN/NL/DE/ES) en règle d'automatisation pour un client mail.

Réponds UNIQUEMENT en JSON valide, sans texte autour, format strict :
{
  "name": "string court (max 80 chars)",
  "conditions": {
    "all": [ { "field": "sender|recipient|subject|body|category", "op": "contains|not_contains|equals|starts_with|ends_with|regex", "value": "string" } ]
  },
  "actions": [
    { "type": "archive" } |
    { "type": "mark_read" } |
    { "type": "categorize", "category": "string" } |
    { "type": "set_priority", "priority": "urgent|moyen|faible" } |
    { "type": "transfer", "to": "email@example.com" } |
    { "type": "create_task", "title": "string" } |
    { "type": "notify", "message": "string" }
  ]
}

Règles :
- Au moins 1 condition et 1 action.
- "value" doit être concrète (extraite de l'instruction), pas un placeholder.
- Préfère "contains" sauf si l'utilisateur précise "exactement / égal à / regex".
- Pour les emails dans "transfer.to" : récupère l'adresse fournie. Si aucune adresse, ne mets PAS d'action transfer.
- Plusieurs actions sont autorisées dans le tableau "actions".`,
          },
          { role: "user", content: input.slice(0, 1000) },
        ],
      });
      const content = completion.choices[0]?.message?.content ?? "{}";
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      aiCandidate = JSON.parse(jsonMatch ? jsonMatch[0] : "{}");
      if (typeof name === "string" && name.trim()) aiCandidate.name = name.trim();
    } catch (e: any) {
      logger.warn({ err: e?.message }, "[rules] AI parse failed");
      res.status(422).json({ error: "Could not parse instruction. Please rephrase or use the manual builder." });
      return;
    }

    const validation = validateRulePayload(aiCandidate);
    if (!validation.ok) {
      logger.info({ errors: validation.errors }, "[rules] AI candidate failed validation");
      res.status(422).json({ error: "Parsed rule is invalid", details: validation.errors });
      return;
    }
    res.json({ source: "ai", rule: validation.rule });
  } catch (e: any) {
    logger.error({ err: e?.message }, "[rules] parse exception");
    res.status(500).json({ error: "Failed to parse instruction" });
  }
});

/**
 * Simulate a rule on the user's last 100 emails. Read-only — no actions taken.
 */
router.post("/automation-rules/simulate", requireAuth, async (req, res): Promise<void> => {
  try {
    const { conditions } = req.body || {};
    const validation = validateRulePayload({
      name: "simulation",
      conditions,
      actions: [{ type: "archive" }],
    });
    if (!validation.ok) {
      res.status(400).json({ error: "Invalid conditions", details: validation.errors }); return;
    }

    type SimEmailRow = {
      id: number;
      sender: string;
      recipient: string | null;
      subject: string | null;
      body: string | null;
      created_at: string;
      category_id: string | null;
      project_id: string | null;
      has_attachment: boolean | null;
      categories: { name: string | null } | { name: string | null }[] | null;
    };

    const { data: emails } = await supabaseAdmin
      .from("emails")
      .select("id, sender, recipient, subject, body, created_at, category_id, project_id, has_attachment, categories ( name )")
      .eq("user_id", req.userId!)
      .order("created_at", { ascending: false })
      .limit(100)
      .returns<SimEmailRow[]>();

    const matches: Array<{ id: number; sender: string; subject: string; createdAt: string }> = [];
    for (const e of emails || []) {
      const categoryName = Array.isArray(e.categories)
        ? e.categories[0]?.name || null
        : e.categories?.name || null;
      const ok = matchesConditions(
        {
          sender: e.sender,
          recipient: e.recipient,
          subject: e.subject,
          body: e.body,
          category_name: categoryName,
          has_attachment: e.has_attachment,
          project_id: e.project_id,
        },
        validation.rule.conditions as Conditions,
      );
      if (ok) {
        matches.push({
          id: e.id,
          sender: e.sender,
          subject: e.subject || "",
          createdAt: e.created_at,
        });
      }
    }

    res.json({
      totalScanned: (emails || []).length,
      matchCount: matches.length,
      matches: matches.slice(0, 50),
    });
  } catch (e: any) {
    logger.error({ err: e?.message }, "[rules] simulate exception");
    res.status(500).json({ error: "Failed to simulate" });
  }
});

/**
 * Audit: list rule executions of last 24h (rollback window).
 */
router.get("/automation-rules/audit", requireAuth, async (req, res): Promise<void> => {
  try {
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { data, error } = await supabaseAdmin
      .from("rule_executions_audit")
      .select("id, rule_id, email_id, action_type, action_payload, previous_state, rolled_back_at, occurred_at")
      .eq("user_id", req.userId!)
      .gte("occurred_at", since)
      .order("occurred_at", { ascending: false })
      .limit(500);
    if (error) {
      res.status(500).json({ error: "Failed to load audit" }); return;
    }
    res.json(
      (data || []).map((r: any) => ({
        id: r.id,
        ruleId: r.rule_id,
        emailId: r.email_id,
        actionType: r.action_type,
        actionPayload: r.action_payload || {},
        previousState: r.previous_state || null,
        rolledBackAt: r.rolled_back_at || null,
        occurredAt: r.occurred_at,
      })),
    );
  } catch {
    res.status(500).json({ error: "Failed to load audit" });
  }
});

/**
 * Rollback a single executed action — only when rolled_back_at is null and
 * the action happened within the last 24h.
 */
router.post("/automation-rules/audit/:id/rollback", requireAuth, async (req, res): Promise<void> => {
  try {
    const { id } = req.params;
    const { data: row } = await supabaseAdmin
      .from("rule_executions_audit")
      .select("id, action_type, action_payload, previous_state, email_id, rolled_back_at, occurred_at, user_id")
      .eq("id", id)
      .eq("user_id", req.userId!)
      .maybeSingle();
    if (!row) { res.status(404).json({ error: "Audit entry not found" }); return; }
    if (row.rolled_back_at) { res.status(400).json({ error: "Already rolled back" }); return; }
    const ageMs = Date.now() - new Date(row.occurred_at).getTime();
    if (ageMs > 24 * 3600 * 1000) {
      res.status(400).json({ error: "Rollback window (24h) expired" }); return;
    }

    if (row.email_id) {
      const ps = (row.previous_state || {}) as Record<string, any>;
      const restore: Record<string, any> = {};
      switch (row.action_type) {
        case "archive":
          restore.status = ps.status || "non_lu";
          break;
        case "categorize":
          restore.category_id = ps.category_id ?? null;
          break;
        case "set_priority":
          restore.priority = ps.priority || "moyen";
          break;
        default:
          break;
      }
      if (Object.keys(restore).length > 0) {
        await supabaseAdmin
          .from("emails")
          .update(restore)
          .eq("id", row.email_id)
          .eq("user_id", req.userId!);
      }
    }

    await supabaseAdmin
      .from("rule_executions_audit")
      .update({ rolled_back_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", req.userId!);

    res.json({ ok: true });
  } catch (e: any) {
    logger.error({ err: e?.message }, "[rules] rollback exception");
    res.status(500).json({ error: "Failed to rollback" });
  }
});

// =============================================================================
// Executor — used by the auto-sync pipeline. NOT exposed as an HTTP route.
// =============================================================================
export interface ExecuteRulesContext {
  userId: string;
  emailId: number;
  email: {
    sender: string | null;
    recipient: string | null;
    subject: string | null;
    body: string | null;
    category_name: string | null;
    category_id: string | number | null;
    project_id?: string | null;
    priority: string | null;
    status: string | null;
  };
}

interface ExecutedAction {
  ruleId: string;
  actionType: string;
  payload: Record<string, any>;
  previousState: Record<string, any>;
}

export async function runMatchingRules(ctx: ExecuteRulesContext): Promise<ExecutedAction[]> {
  const { userId, emailId, email } = ctx;
  const executed: ExecutedAction[] = [];
  try {
    const { data: rules } = await supabaseAdmin
      .from("automation_rules")
      .select("id, name, conditions, actions, runs_count")
      .eq("user_id", userId)
      .eq("enabled", true);
    if (!rules || rules.length === 0) return executed;

    for (const rule of rules) {
      try {
        const ok = matchesConditions(email, rule.conditions as Conditions);
        if (!ok) continue;
        const actions: RuleAction[] = Array.isArray(rule.actions) ? (rule.actions as RuleAction[]) : [];
        for (const action of actions) {
          const previousState: Record<string, any> = {
            status: email.status,
            category_id: email.category_id,
            priority: email.priority,
          };
          let applied = true;
          let payload: Record<string, unknown> = { ...(action as Record<string, unknown>) };

          try {
            switch (action.type) {
              case "archive":
                await supabaseAdmin
                  .from("emails")
                  .update({ status: "classe" })
                  .eq("id", emailId)
                  .eq("user_id", userId);
                email.status = "classe";
                break;
              case "mark_read":
                await supabaseAdmin
                  .from("emails")
                  .update({ read_at: new Date().toISOString() })
                  .eq("id", emailId)
                  .eq("user_id", userId);
                break;
              case "set_priority":
                await supabaseAdmin
                  .from("emails")
                  .update({ priority: action.priority })
                  .eq("id", emailId)
                  .eq("user_id", userId);
                email.priority = action.priority;
                break;
              case "categorize": {
                const { data: cat } = await supabaseAdmin
                  .from("categories")
                  .select("id")
                  .eq("user_id", userId)
                  .eq("name", action.category)
                  .maybeSingle();
                let catId = cat?.id || null;
                if (!catId) {
                  const { data: created } = await supabaseAdmin
                    .from("categories")
                    .insert({ user_id: userId, name: action.category })
                    .select("id")
                    .single();
                  catId = created?.id || null;
                }
                if (catId) {
                  await supabaseAdmin
                    .from("emails")
                    .update({ category_id: catId })
                    .eq("id", emailId)
                    .eq("user_id", userId);
                  email.category_id = catId;
                }
                break;
              }
              case "move_to_project":
                await supabaseAdmin
                  .from("emails")
                  .update({ project_id: action.projectId })
                  .eq("id", emailId)
                  .eq("user_id", userId);
                email.project_id = action.projectId;
                break;
              case "create_task": {
                await supabaseAdmin.from("tasks").insert({
                  user_id: userId,
                  email_id: emailId,
                  title: action.title.slice(0, 280),
                  done: false,
                });
                break;
              }
              case "assign":
                await supabaseAdmin
                  .from("emails")
                  .update({ assigned_to_user_id: action.userId, assigned_at: new Date().toISOString(), assigned_by_user_id: userId })
                  .eq("id", emailId)
                  .eq("user_id", userId);
                break;
              case "notify":
                // best-effort notification record; if table is missing, ignore
                await supabaseAdmin
                  .from("notifications")
                  .insert({
                    user_id: userId,
                    type: "rule",
                    title: rule.name,
                    body: action.message,
                    email_id: emailId,
                  })
                  .then(() => undefined, () => undefined);
                break;
              case "transfer":
                // transfer is stored as audit only; actual sending should be done
                // via /emails/send endpoint. For now we record intent.
                payload.deferred = true;
                break;
            }
          } catch (e: any) {
            logger.warn({ err: e?.message, ruleId: rule.id, actionType: action.type }, "[rules] action failed");
            applied = false;
          }

          if (applied) {
            await supabaseAdmin.from("rule_executions_audit").insert({
              user_id: userId,
              rule_id: rule.id,
              email_id: emailId,
              action_type: action.type,
              action_payload: payload,
              previous_state: previousState,
            });
            executed.push({
              ruleId: rule.id,
              actionType: action.type,
              payload,
              previousState,
            });
          }
        }

        await supabaseAdmin
          .from("automation_rules")
          .update({
            runs_count: (rule.runs_count || 0) + 1,
            last_run_at: new Date().toISOString(),
          })
          .eq("id", rule.id);
      } catch (e: any) {
        logger.warn({ err: e?.message, ruleId: rule.id }, "[rules] rule iteration failed");
      }
    }
  } catch (e: any) {
    logger.warn({ err: e?.message }, "[rules] runMatchingRules outer failed");
  }
  return executed;
}

export default router;
