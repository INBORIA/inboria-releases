import { Router, type IRouter } from "express";
import OpenAI from "openai";
import { openai } from "../services/ai-client";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth } from "../middlewares/auth";
import { logger } from "../lib/logger";
import { detectVariablesInBody } from "../services/automation-rules";
import { AI_COST, checkEntitlement, consumeAiCredits } from "../services/credits";
import { getMemberMailboxIds } from "../lib/inbox-scope";

const router: IRouter = Router();

const SUGGEST_CACHE_MS = 60 * 60 * 1000;
type CacheEntry = { ts: number; templateIds: string[] };
const suggestCache = new Map<string, CacheEntry>();

function rowToTemplate(row: any) {
  return {
    id: row.id,
    name: row.name,
    subject: row.subject || "",
    body: row.body || "",
    categoryAi: row.category_ai || null,
    variables: Array.isArray(row.variables) ? row.variables : [],
    usageCount: row.usage_count || 0,
    sourceEmailId: row.source_email_id || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

router.get("/templates", requireAuth, async (req, res): Promise<void> => {
  try {
    const { data, error } = await supabaseAdmin
      .from("email_templates")
      .select("id, name, subject, body, category_ai, variables, usage_count, source_email_id, created_at, updated_at")
      .eq("user_id", req.userId!)
      .order("usage_count", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      logger.error({ err: error.message }, "[templates] list failed");
      res.status(500).json({ error: "Failed to list templates" });
      return;
    }
    res.json((data || []).map(rowToTemplate));
  } catch (e: any) {
    logger.error({ err: e?.message }, "[templates] list exception");
    res.status(500).json({ error: "Failed to list templates" });
  }
});

router.post("/templates", requireAuth, async (req, res): Promise<void> => {
  try {
    const { name, subject, body, categoryAi, sourceEmailId } = req.body || {};
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      res.status(400).json({ error: "name required" }); return;
    }
    if (typeof body !== "string") {
      res.status(400).json({ error: "body required" }); return;
    }
    const variables = detectVariablesInBody(body);
    const insert: Record<string, any> = {
      user_id: req.userId!,
      name: name.trim().slice(0, 120),
      subject: typeof subject === "string" ? subject.slice(0, 500) : "",
      body: body.slice(0, 50_000),
      variables,
    };
    if (typeof categoryAi === "string" && categoryAi.trim()) {
      insert.category_ai = categoryAi.trim().slice(0, 80);
    }
    if (typeof sourceEmailId === "number" && Number.isInteger(sourceEmailId)) {
      insert.source_email_id = sourceEmailId;
    }
    const { data, error } = await supabaseAdmin
      .from("email_templates")
      .insert(insert)
      .select("*")
      .single();
    if (error || !data) {
      logger.error({ err: error?.message }, "[templates] create failed");
      res.status(500).json({ error: "Failed to create template" }); return;
    }
    res.status(201).json(rowToTemplate(data));
  } catch (e: any) {
    logger.error({ err: e?.message }, "[templates] create exception");
    res.status(500).json({ error: "Failed to create template" });
  }
});

router.patch("/templates/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, subject, body, categoryAi } = req.body || {};
    const update: Record<string, any> = { updated_at: new Date().toISOString() };
    if (typeof name === "string") update.name = name.trim().slice(0, 120);
    if (typeof subject === "string") update.subject = subject.slice(0, 500);
    if (typeof body === "string") {
      update.body = body.slice(0, 50_000);
      update.variables = detectVariablesInBody(body);
    }
    if (typeof categoryAi === "string") {
      update.category_ai = categoryAi.trim().slice(0, 80) || null;
    }
    const { data, error } = await supabaseAdmin
      .from("email_templates")
      .update(update)
      .eq("id", id)
      .eq("user_id", req.userId!)
      .select("*")
      .single();
    if (error || !data) {
      res.status(404).json({ error: "Template not found" }); return;
    }
    res.json(rowToTemplate(data));
  } catch (e: any) {
    logger.error({ err: e?.message }, "[templates] update exception");
    res.status(500).json({ error: "Failed to update template" });
  }
});

router.delete("/templates/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin
      .from("email_templates")
      .delete()
      .eq("id", id)
      .eq("user_id", req.userId!);
    if (error) {
      res.status(500).json({ error: "Failed to delete" }); return;
    }
    res.status(204).send();
  } catch (e: any) {
    res.status(500).json({ error: "Failed to delete" });
  }
});

router.post("/templates/:id/use", requireAuth, async (req, res): Promise<void> => {
  try {
    const { id } = req.params;
    const { data: existing } = await supabaseAdmin
      .from("email_templates")
      .select("usage_count")
      .eq("id", id)
      .eq("user_id", req.userId!)
      .maybeSingle();
    if (!existing) { res.status(404).json({ error: "Template not found" }); return; }
    const next = (existing.usage_count || 0) + 1;
    await supabaseAdmin
      .from("email_templates")
      .update({ usage_count: next, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", req.userId!);
    res.json({ ok: true, usageCount: next });
  } catch {
    res.status(500).json({ error: "Failed" });
  }
});

/**
 * Save the body of an existing email as a new template, with AI-derived
 * category and detected variables. Bills 1 credit (template_categorize).
 */
router.post("/templates/from-email/:emailId", requireAuth, async (req, res): Promise<void> => {
  try {
    const emailId = Number(req.params.emailId);
    if (!Number.isFinite(emailId)) { res.status(400).json({ error: "Invalid emailId" }); return; }
    const { name } = req.body || {};

    const memberMailboxIds = await getMemberMailboxIds(req.userId!);
    let q = supabaseAdmin
      .from("emails")
      .select("id, subject, body, sender")
      .eq("id", emailId);
    const { data: email } = memberMailboxIds.length > 0
      ? await q.or(`user_id.eq.${req.userId!},shared_mailbox_id.in.(${memberMailboxIds.join(",")})`).single()
      : await q.eq("user_id", req.userId!).single();

    if (!email) { res.status(404).json({ error: "Email not found" }); return; }

    const ent = await checkEntitlement(req.userId!, AI_COST.template_categorize);
    if (ent.blocked) { res.status(403).json({ error: ent.reason }); return; }

    const billed = await consumeAiCredits(req.userId!, "template_categorize", { emailId });
    if (!billed.ok) { res.status(402).json({ error: "Billing failed" }); return; }

    let categoryAi: string | null = null;
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        max_completion_tokens: 60,
        messages: [
          { role: "system", content: "Tu classes des templates d'email professionnels. Réponds en 1-3 mots maximum, en français, sans guillemets, sans ponctuation. Exemples: 'Réponse client', 'Devis', 'Relance', 'Confirmation rendez-vous'." },
          { role: "user", content: `Sujet: ${email.subject || ""}\nCorps:\n${(email.body || "").replace(/<[^>]+>/g, " ").slice(0, 1500)}\n\nCatégorie ?` },
        ],
      });
      categoryAi = (completion.choices[0]?.message?.content || "").trim().slice(0, 80) || null;
    } catch (e: any) {
      logger.warn({ err: e?.message }, "[templates] AI categorization failed (continuing)");
    }

    const variables = detectVariablesInBody(email.body || "");
    const insert = {
      user_id: req.userId!,
      name: (typeof name === "string" && name.trim()) || (email.subject || "Template").slice(0, 120),
      subject: email.subject || "",
      body: email.body || "",
      category_ai: categoryAi,
      variables,
      source_email_id: email.id,
    };
    const { data, error } = await supabaseAdmin
      .from("email_templates")
      .insert(insert)
      .select("*")
      .single();
    if (error || !data) {
      logger.error({ err: error?.message }, "[templates] from-email insert failed");
      res.status(500).json({ error: "Failed to create template" }); return;
    }
    res.status(201).json(rowToTemplate(data));
  } catch (e: any) {
    logger.error({ err: e?.message }, "[templates] from-email exception");
    res.status(500).json({ error: "Failed" });
  }
});

/**
 * Suggest a short, human-friendly NAME for a template, based on its
 * subject + body (or a source email). Returns a 1-3 word string.
 * Bills 1 credit (template_categorize) — same cost as auto-categorize.
 */
router.post("/templates/suggest-name", requireAuth, async (req, res): Promise<void> => {
  try {
    const { subject, body, sourceEmailId } = req.body || {};
    let resolvedSubject = typeof subject === "string" ? subject : "";
    let resolvedBody = typeof body === "string" ? body : "";

    if ((!resolvedSubject || !resolvedBody) && Number.isFinite(Number(sourceEmailId))) {
      const memberMailboxIds = await getMemberMailboxIds(req.userId!);
      const baseQuery = supabaseAdmin
        .from("emails")
        .select("subject, body")
        .eq("id", Number(sourceEmailId));
      const { data: email } = memberMailboxIds.length > 0
        ? await baseQuery.or(`user_id.eq.${req.userId!},shared_mailbox_id.in.(${memberMailboxIds.join(",")})`).single()
        : await baseQuery.eq("user_id", req.userId!).single();
      if (email) {
        resolvedSubject = resolvedSubject || email.subject || "";
        resolvedBody = resolvedBody || email.body || "";
      }
    }

    if (!resolvedSubject && !resolvedBody) {
      res.status(400).json({ error: "subject or body required" });
      return;
    }

    const ent = await checkEntitlement(req.userId!, AI_COST.template_categorize);
    if (ent.blocked) { res.status(403).json({ error: ent.reason }); return; }
    const billed = await consumeAiCredits(req.userId!, "template_categorize", { sourceEmailId });
    if (!billed.ok) { res.status(402).json({ error: "Billing failed" }); return; }

    let name = "";
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        max_completion_tokens: 30,
        messages: [
          {
            role: "system",
            content:
              "Tu proposes un nom court (1-4 mots) pour un template d'email professionnel. Réponds UNIQUEMENT par le nom, en français, sans guillemets, sans ponctuation finale. Exemples: 'Confirmation rendez-vous', 'Relance facture', 'Devis envoyé', 'Demande infos'.",
          },
          {
            role: "user",
            content: `Sujet: ${resolvedSubject || "(vide)"}\nCorps:\n${(resolvedBody || "").replace(/<[^>]+>/g, " ").slice(0, 1500)}\n\nNom suggéré ?`,
          },
        ],
      });
      name = (completion.choices[0]?.message?.content || "")
        .trim()
        .replace(/^["'«»]+|["'«»]+$/g, "")
        .slice(0, 60);
    } catch (e: any) {
      logger.warn({ err: e?.message }, "[templates] suggest-name AI failed");
    }

    if (!name) {
      name = (resolvedSubject || "Template").trim().slice(0, 60);
    }
    res.json({ name });
  } catch (e: any) {
    logger.error({ err: e?.message }, "[templates] suggest-name exception");
    res.status(500).json({ error: "Failed to suggest name" });
  }
});

/**
 * Suggest 1-3 templates relevant to an email. Cached 1h per email.
 * Bills 1 credit (template_suggest) only when AI is actually called.
 */
router.get("/templates/suggest", requireAuth, async (req, res): Promise<void> => {
  try {
    const emailId = Number(req.query.emailId);
    if (!Number.isFinite(emailId)) { res.status(400).json({ error: "emailId required" }); return; }

    const cacheKey = `${req.userId}:${emailId}`;
    const hit = suggestCache.get(cacheKey);
    if (hit && Date.now() - hit.ts < SUGGEST_CACHE_MS) {
      const { data } = await supabaseAdmin
        .from("email_templates")
        .select("id, name, subject, body, category_ai, variables, usage_count, source_email_id, created_at, updated_at")
        .in("id", hit.templateIds)
        .eq("user_id", req.userId!);
      res.json({ cached: true, templates: (data || []).map(rowToTemplate) });
      return;
    }

    const memberMailboxIds = await getMemberMailboxIds(req.userId!);
    const baseQuery = supabaseAdmin.from("emails").select("subject, body, sender, category_id").eq("id", Number(emailId));
    const { data: email } = memberMailboxIds.length > 0
      ? await baseQuery.or(`user_id.eq.${req.userId!},shared_mailbox_id.in.(${memberMailboxIds.join(",")})`).single()
      : await baseQuery.eq("user_id", req.userId!).single();
    if (!email) { res.status(404).json({ error: "Email not found" }); return; }

    const { data: templates } = await supabaseAdmin
      .from("email_templates")
      .select("id, name, subject, body, category_ai, variables, usage_count, source_email_id, created_at, updated_at")
      .eq("user_id", req.userId!)
      .order("usage_count", { ascending: false })
      .limit(50);
    const all = templates || [];
    if (all.length === 0) { res.json({ cached: false, templates: [] }); return; }

    const ent = await checkEntitlement(req.userId!, AI_COST.template_suggest);
    if (ent.blocked) { res.status(403).json({ error: ent.reason }); return; }
    const billed = await consumeAiCredits(req.userId!, "template_suggest", { emailId });
    if (!billed.ok) { res.status(402).json({ error: "Billing failed" }); return; }

    let chosenIds: string[] = [];
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        max_completion_tokens: 120,
        messages: [
          { role: "system", content: "Tu choisis les 1 à 3 templates d'email les plus pertinents pour répondre à un email donné. Réponds STRICTEMENT en JSON: {\"templateIds\":[\"id1\",...]}. Si aucun template ne convient, renvoie {\"templateIds\":[]}." },
          { role: "user", content: `Email reçu:\nDe: ${email.sender}\nSujet: ${email.subject}\nCorps: ${(email.body || "").replace(/<[^>]+>/g, " ").slice(0, 800)}\n\nTemplates disponibles:\n${all.map((t: any) => `- id=${t.id} | nom="${t.name}" | catégorie=${t.category_ai || "?"} | sujet="${(t.subject || "").slice(0, 80)}"`).join("\n")}` },
        ],
      });
      const content = completion.choices[0]?.message?.content ?? "{}";
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : "{}");
      const ids = Array.isArray(parsed.templateIds) ? parsed.templateIds.filter((x: any) => typeof x === "string") : [];
      const validIds = new Set(all.map((t: any) => String(t.id)));
      chosenIds = ids.filter((id: string) => validIds.has(id)).slice(0, 3);
    } catch (e: any) {
      logger.warn({ err: e?.message }, "[templates] suggest AI failed");
    }

    suggestCache.set(cacheKey, { ts: Date.now(), templateIds: chosenIds });
    if (suggestCache.size > 5000) {
      const toDelete = Array.from(suggestCache.keys()).slice(0, 1000);
      for (const k of toDelete) suggestCache.delete(k);
    }

    const chosen = all.filter((t: any) => chosenIds.includes(String(t.id)));
    res.json({ cached: false, templates: chosen.map(rowToTemplate) });
  } catch (e: any) {
    logger.error({ err: e?.message }, "[templates] suggest exception");
    res.status(500).json({ error: "Failed to suggest templates" });
  }
});

export default router;
