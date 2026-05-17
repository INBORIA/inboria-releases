/**
 * Automation rules — natural language → structured JSON, simulator, executor & rollback.
 *
 * Conditions JSON shape (extended scope, Vague 2):
 *   {
 *     "all": [
 *       { "field": "sender", "op": "contains", "value": "facture" },
 *       { "field": "subject", "op": "regex", "value": "^URGENT" },
 *       { "field": "body", "op": "contains", "value": "iban" },
 *       { "field": "category", "op": "equals", "value": "Facturation" },
 *       { "field": "has_attachment", "op": "equals", "value": "true" },
 *       { "field": "project", "op": "equals", "value": "<projectId>" }
 *     ]
 *   }
 *
 * Actions JSON shape: array of items (extended scope, Vague 2)
 *   { "type": "archive" }
 *   { "type": "mark_read" }
 *   { "type": "categorize", "category": "Facturation" }
 *   { "type": "set_priority", "priority": "urgent" }
 *   { "type": "assign", "userId": "uuid" }
 *   { "type": "transfer", "to": "alice@example.com" }
 *   { "type": "move_to_project", "projectId": "uuid" }
 *   { "type": "create_task", "title": "Vérifier facture" }
 *   { "type": "notify", "message": "Mail entrant à traiter" }
 */

import { z } from "zod";

export type RuleField =
  | "sender"
  | "recipient"
  | "subject"
  | "body"
  | "category"
  | "has_attachment"
  | "project";

export type RuleOp =
  | "contains"
  | "not_contains"
  | "equals"
  | "starts_with"
  | "ends_with"
  | "regex"
  | "is_true"
  | "is_false";

export const ConditionSchema = z
  .object({
    field: z.enum([
      "sender",
      "recipient",
      "subject",
      "body",
      "category",
      "has_attachment",
      "project",
    ]),
    op: z.enum([
      "contains",
      "not_contains",
      "equals",
      "starts_with",
      "ends_with",
      "regex",
      "is_true",
      "is_false",
    ]),
    value: z.string().max(500).optional().default(""),
  })
  .refine(
    (c) =>
      c.op === "is_true" || c.op === "is_false" || (c.value && c.value.length > 0),
    { message: "value is required for this operator", path: ["value"] },
  );

export const ConditionsSchema = z
  .object({
    all: z.array(ConditionSchema).min(1).max(10).optional(),
    any: z.array(ConditionSchema).min(1).max(10).optional(),
  })
  .refine(
    (v) => (v.all && v.all.length > 0) || (v.any && v.any.length > 0),
    { message: "conditions must contain at least one of 'all' or 'any'" },
  );

export const ActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("archive") }),
  z.object({ type: z.literal("mark_read") }),
  z.object({ type: z.literal("categorize"), category: z.string().min(1).max(120) }),
  z.object({
    type: z.literal("set_priority"),
    priority: z.enum(["urgent", "moyen", "faible"]),
  }),
  z.object({ type: z.literal("assign"), userId: z.string().uuid() }),
  z.object({ type: z.literal("transfer"), to: z.string().email() }),
  z.object({ type: z.literal("move_to_project"), projectId: z.string().uuid() }),
  z.object({ type: z.literal("create_task"), title: z.string().min(1).max(280) }),
  z.object({ type: z.literal("notify"), message: z.string().min(1).max(280) }),
]);

export const ActionsSchema = z.array(ActionSchema).min(1).max(8);

export const RuleSchema = z.object({
  name: z.string().min(1).max(120),
  conditions: ConditionsSchema,
  actions: ActionsSchema,
});

export type Condition = z.infer<typeof ConditionSchema>;
export type Conditions = z.infer<typeof ConditionsSchema>;
export type RuleAction = z.infer<typeof ActionSchema>;
export type Rule = z.infer<typeof RuleSchema>;

export interface EmailLike {
  sender?: string | null;
  recipient?: string | null;
  subject?: string | null;
  body?: string | null;
  category_name?: string | null;
  has_attachment?: boolean | null;
  project_id?: string | null;
}

function fieldValue(email: EmailLike, field: RuleField): string {
  switch (field) {
    case "sender":
      return (email.sender || "").toLowerCase();
    case "recipient":
      return (email.recipient || "").toLowerCase();
    case "subject":
      return (email.subject || "").toLowerCase();
    case "body":
      return (email.body || "").replace(/<[^>]+>/g, " ").toLowerCase();
    case "category":
      return (email.category_name || "").toLowerCase();
    case "has_attachment":
      return email.has_attachment ? "true" : "false";
    case "project":
      return (email.project_id || "").toLowerCase();
  }
}

function evalCondition(email: EmailLike, c: Condition): boolean {
  const fv = fieldValue(email, c.field);
  const cv = (c.value || "").toLowerCase();
  try {
    switch (c.op) {
      case "contains":
        return fv.includes(cv);
      case "not_contains":
        return !fv.includes(cv);
      case "equals":
        return fv === cv;
      case "starts_with":
        return fv.startsWith(cv);
      case "ends_with":
        return fv.endsWith(cv);
      case "regex":
        try {
          const re = new RegExp(c.value || "", "i");
          return re.test(fieldValue(email, c.field));
        } catch {
          return false;
        }
      case "is_true":
        if (c.field === "has_attachment") return email.has_attachment === true;
        return fv === "true" || fv === "1" || fv === "yes";
      case "is_false":
        if (c.field === "has_attachment") return !email.has_attachment;
        return fv === "false" || fv === "0" || fv === "no" || fv === "";
    }
  } catch {
    return false;
  }
  return false;
}

export function matchesConditions(email: EmailLike, conditions: Conditions): boolean {
  let ok = true;
  if (conditions.all && conditions.all.length > 0) {
    ok = ok && conditions.all.every((c) => evalCondition(email, c));
  }
  if (conditions.any && conditions.any.length > 0) {
    ok = ok && conditions.any.some((c) => evalCondition(email, c));
  }
  return ok;
}

/**
 * Heuristic NL → structured rule. Used as a deterministic fallback BEFORE
 * spending an OpenAI call, also useful for unit tests.
 */
export function parseRuleHeuristic(text: string, fallbackName?: string): Rule | null {
  if (!text || typeof text !== "string") return null;
  const lower = text.toLowerCase();

  const conditions: Condition[] = [];
  const actions: RuleAction[] = [];

  // ---- conditions ---------------------------------------------------------

  // sender by email address (most precise, try first)
  const senderEmail = text.match(
    /(?:de|from|von|van|envoye par|envoyé par|de la part de|expéditeur|expediteur)\s+([\w.+-]+@[\w-]+\.[\w.-]+)/i,
  );
  if (senderEmail) {
    conditions.push({
      field: "sender",
      op: "contains",
      value: senderEmail[1].trim(),
    });
  } else {
    // sender by quoted name
    const senderQuoted = text.match(
      /(?:de|from|von|van|expéditeur|expediteur|sender|envoye par|envoyé par|de la part de)\s+["“]([^"”]+)["”]/i,
    );
    if (senderQuoted) {
      conditions.push({
        field: "sender",
        op: "contains",
        value: senderQuoted[1].trim(),
      });
    }
  }

  // subject contains "X"
  const subjectQuoted = text.match(
    /(?:sujet|objet|subject|betreff|asunto|onderwerp)[^"“]*["“]([^"”]+)["”]/i,
  );
  if (subjectQuoted) {
    conditions.push({
      field: "subject",
      op: "contains",
      value: subjectQuoted[1].trim(),
    });
  } else {
    // body contains "X"
    const bodyQuoted = text.match(
      /(?:contient|contains|enthält|contiene|bevat)\s+["“]([^"”]+)["”]/i,
    );
    if (bodyQuoted) {
      conditions.push({
        field: "body",
        op: "contains",
        value: bodyQuoted[1].trim(),
      });
    }
  }

  // attachments — "avec pièce jointe", "with attachment", "mit Anhang"…
  if (
    /\b(avec\s+(?:une\s+)?pi[eè]ce[s]?\s+jointe[s]?|has\s+attachment|with\s+attachment[s]?|mit\s+anhang|met\s+bijlage|con\s+adjunto)\b/i.test(
      lower,
    )
  ) {
    conditions.push({ field: "has_attachment", op: "is_true", value: "" });
  } else if (
    /\b(sans\s+pi[eè]ce[s]?\s+jointe[s]?|no\s+attachment|without\s+attachment[s]?|ohne\s+anhang|zonder\s+bijlage|sin\s+adjunto)\b/i.test(
      lower,
    )
  ) {
    conditions.push({ field: "has_attachment", op: "is_false", value: "" });
  }

  // project condition — "dans le projet \"X\"" / "in project \"X\""
  const projectCond = text.match(
    /(?:dans\s+(?:le\s+)?projet|in\s+(?:the\s+)?project|im\s+projekt|en\s+(?:el\s+)?proyecto|in\s+(?:het\s+)?project)\s+["“]([^"”]+)["”]/i,
  );
  if (projectCond) {
    conditions.push({ field: "project", op: "equals", value: projectCond[1].trim() });
  }

  // ---- actions ------------------------------------------------------------

  // move to project — large coverage : "déplacer/classer/mettre/ranger/déposer
  // dans (le) projet X" / "vers le projet X" / "move to project X" / etc.
  // IMPORTANT : matche AVANT categorize, et la regex categorize a un negative
  // lookahead anti-"projet" pour ne pas se déclencher sur le même texte.
  // Le name capturé sera résolu en UUID côté route via resolveActionReferences.
  const moveProject = text.match(
    /(?:d[eé]placer|classer|mettre|ranger|d[eé]poser|move|verschieben|mover|verplaatsen)\s+(?:le\s+mail\s+)?(?:dans|vers|au|to|in|en|al|naar)\s+(?:le\s+|la\s+|les\s+|du\s+|the\s+|das\s+|der\s+|el\s+|los\s+|het\s+)?projets?\s+["“]?([^"”\n.;,]+?)["”]?(?=$|[.;,])/i,
  );
  if (moveProject) {
    actions.push({ type: "move_to_project", projectId: moveProject[1].trim() } as RuleAction);
  }

  // assign — "assigner à NAME" / "assign to NAME" / "attribuer à NAME"
  // NAME peut être un nom complet ou un email — résolu en UUID côté route.
  const assignMatch = text.match(
    /(?:assigner|assignez|attribuer|attribuez|assign|asignar|zuweisen|toewijzen)\s+(?:le\s+mail\s+)?(?:à|a|to|an|aan|au|aux)\s+["“]?([^"”\n.;,]+?)["”]?(?=$|[.;,])/i,
  );
  if (assignMatch) {
    actions.push({ type: "assign", userId: assignMatch[1].trim() } as RuleAction);
  }

  // archive
  if (/\b(archiver|archive|archivieren|archivar|archiveer)\b/i.test(lower)) {
    actions.push({ type: "archive" });
  }

  // mark as read
  if (
    /\b(marquer\s+(?:le\s+|comme\s+)?(?:comme\s+)?lu|mark\s+(?:as\s+)?read|als\s+gelesen\s+markieren|marcar\s+como\s+leído|markeer\s+als\s+gelezen)\b/i.test(
      lower,
    )
  ) {
    actions.push({ type: "mark_read" });
  }

  // categorize — negative lookahead anti-"projet"/"dossier"/"boîte" pour ne
  // pas piquer le verbe à move_to_project. Si une action move_to_project a
  // déjà été poussée, on skip pour éviter le doublon "classer dans projet X"
  // → move_to_project ET categorize.
  const hasMoveProject = actions.some((a) => a.type === "move_to_project");
  const catMatch = hasMoveProject
    ? null
    : text.match(
        /(?:catégoriser|categoriser|categorize|classer|kategorisieren|categorizar|categoriseer)\s+(?:le\s+mail\s+)?(?:dans|in|en|als|comme|as)\s+(?!(?:le\s+|la\s+|les\s+|du\s+|the\s+|das\s+|der\s+|el\s+|los\s+|het\s+)?(?:projets?|dossiers?|boîtes?|boites?|folders?|projects?|ordner|carpeta|map)\b)["“]?([^"”\n.;,]+?)["”]?(?=$|[.;,])/i,
      ) ||
      text.match(
        /(?:catégorie|categorie|category|kategorie|categoría|categorie)\s+["“]([^"”]+)["”]/i,
      );
  if (catMatch) {
    actions.push({
      type: "categorize",
      category: catMatch[1].trim(),
    });
  }

  // priority — must check "urgent" but not match "urgent" inside subject/body quotes
  if (
    /\b(marquer\s+(?:le\s+)?(?:comme\s+)?urgent|mark\s+as\s+urgent|priorit[éy]\s+urgente?|urgent\s+priority|priorité\s*=\s*urgent)\b/i.test(
      lower,
    )
  ) {
    actions.push({ type: "set_priority", priority: "urgent" });
  } else if (
    /\b(priorité\s+faible|low\s+priority|priority\s+low|niedrige?\s+priorität|baja\s+prioridad)\b/i.test(
      lower,
    )
  ) {
    actions.push({ type: "set_priority", priority: "faible" });
  }

  // create task
  const taskMatch =
    text.match(
      /(?:créer|creer|create|crear|erstelle?n?|maak)\s+(?:une\s+|a\s+|eine\s+|een\s+)?(?:tâche|tache|task|tarea|aufgabe|taak)[^"“]*["“]([^"”]+)["”]/i,
    );
  if (taskMatch) {
    actions.push({
      type: "create_task",
      title: taskMatch[1].trim().slice(0, 120),
    });
  }

  // notify
  if (/\b(notifier|notify|notificar|benachrichtigen|verwittig)\b/i.test(lower)) {
    actions.push({ type: "notify", message: text.slice(0, 200) });
  }

  // transfer
  const transferMatch = text.match(
    /(?:transférer|transferer|transfer|forward|weiterleiten|reenviar|stuur|doorsturen)[^@]*?(?:à|a|to|vers|an|aan|naar)\s+([\w.+-]+@[\w-]+\.[\w.-]+)/i,
  );
  if (transferMatch) {
    actions.push({ type: "transfer", to: transferMatch[1].trim() });
  }

  if (conditions.length === 0 || actions.length === 0) return null;

  return {
    name:
      (fallbackName && fallbackName.trim()) ||
      text.slice(0, 60).replace(/\s+/g, " ").trim() ||
      "Règle automatique",
    conditions: { all: conditions },
    actions,
  };
}

/**
 * Validate an arbitrary JSON candidate (e.g. coming back from GPT) and
 * return a clean Rule on success, otherwise null with the zod issue list.
 */
export function validateRulePayload(input: unknown): { ok: true; rule: Rule } | { ok: false; errors: string[] } {
  const parsed = RuleSchema.safeParse(input);
  if (parsed.success) return { ok: true, rule: parsed.data };
  return {
    ok: false,
    errors: parsed.error.issues.map((i) => `${i.path.join(".") || "root"}: ${i.message}`),
  };
}

export function detectVariablesInBody(body: string): string[] {
  if (!body) return [];
  const found = new Set<string>();
  const re = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    found.add(m[1]);
  }
  return Array.from(found);
}

/**
 * Source of values used to fill template variables when inserting.
 */
export interface TemplateContext {
  senderEmail?: string | null;
  senderName?: string | null;
  recipientName?: string | null;
  subject?: string | null;
  userFullName?: string | null;
  companyName?: string | null;
  contact?: { firstName?: string | null; lastName?: string | null; fullName?: string | null; company?: string | null } | null;
}

function parseSenderName(raw: string | null | undefined): { full: string; first: string; last: string } {
  if (!raw) return { full: "", first: "", last: "" };
  const trimmed = raw.trim();
  const m = trimmed.match(/^"?([^"<]+?)"?\s*<[^>]+>$/);
  let full = (m ? m[1] : trimmed).trim();
  // Strip an email if no display name was provided
  if (full.includes("@")) full = full.split("@")[0];
  full = full.replace(/[._]+/g, " ").trim();
  const parts = full.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { full: "", first: "", last: "" };
  if (parts.length === 1) return { full: parts[0], first: parts[0], last: "" };
  return { full, first: parts[0], last: parts.slice(1).join(" ") };
}

/**
 * Build the dictionary of variable values from a template context.
 * Keys cover both English and French aliases. Unknown variables
 * resolve to empty string with a `{{name}}` fallback when applied.
 */
export function buildVariableValues(ctx: TemplateContext): Record<string, string> {
  const senderParts = parseSenderName(ctx.senderName || ctx.senderEmail);
  const contactFirst = ctx.contact?.firstName || senderParts.first || "";
  const contactLast = ctx.contact?.lastName || senderParts.last || "";
  const contactFull = ctx.contact?.fullName || senderParts.full || "";
  const company = ctx.contact?.company || ctx.companyName || "";
  const today = new Date();
  const isoDate = today.toISOString().slice(0, 10);
  const userFull = (ctx.userFullName || "").trim();
  const userParts = parseSenderName(userFull);

  const values: Record<string, string> = {
    first_name: contactFirst,
    prenom: contactFirst,
    last_name: contactLast,
    nom: contactLast,
    full_name: contactFull,
    name: contactFull,
    sender_email: ctx.senderEmail || "",
    email: ctx.senderEmail || "",
    company,
    entreprise: company,
    societe: company,
    subject: ctx.subject || "",
    sujet: ctx.subject || "",
    today: isoDate,
    current_date: isoDate,
    date: isoDate,
    my_name: userFull,
    mon_nom: userFull,
    my_first_name: userParts.first,
    mon_prenom: userParts.first,
  };
  return values;
}

/**
 * Replace `{{variable}}` placeholders in a string. Unknown variables
 * are left in place so the user can see what's still missing.
 */
export function applyTemplateVariables(input: string, ctx: TemplateContext): string {
  if (!input) return input;
  const values = buildVariableValues(ctx);
  return input.replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g, (full, key: string) => {
    const v = values[key.toLowerCase()];
    return v === undefined || v === "" ? full : v;
  });
}
