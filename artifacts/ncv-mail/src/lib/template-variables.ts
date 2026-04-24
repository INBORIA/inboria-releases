/**
 * Mirror of api-server `applyTemplateVariables`. Resolves `{{var}}`
 * placeholders in template subject/body using info available on the
 * client (current email + user profile). Unknown placeholders are
 * left untouched so the user can see what's still missing.
 */

export interface ClientTemplateContext {
  senderEmail?: string | null;
  senderName?: string | null;
  subject?: string | null;
  userFullName?: string | null;
  companyName?: string | null;
}

function parseSenderName(raw: string | null | undefined): {
  full: string;
  first: string;
  last: string;
} {
  if (!raw) return { full: "", first: "", last: "" };
  const trimmed = raw.trim();
  const m = trimmed.match(/^"?([^"<]+?)"?\s*<[^>]+>$/);
  let full = (m ? m[1] : trimmed).trim();
  if (full.includes("@")) full = full.split("@")[0];
  full = full.replace(/[._]+/g, " ").trim();
  const parts = full.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { full: "", first: "", last: "" };
  if (parts.length === 1) return { full: parts[0], first: parts[0], last: "" };
  return { full, first: parts[0], last: parts.slice(1).join(" ") };
}

export function buildTemplateValues(
  ctx: ClientTemplateContext,
): Record<string, string> {
  const senderParts = parseSenderName(ctx.senderName || ctx.senderEmail);
  const userFull = (ctx.userFullName || "").trim();
  const userParts = parseSenderName(userFull);
  const isoDate = new Date().toISOString().slice(0, 10);
  return {
    first_name: senderParts.first,
    prenom: senderParts.first,
    last_name: senderParts.last,
    nom: senderParts.last,
    full_name: senderParts.full,
    name: senderParts.full,
    sender_email: ctx.senderEmail || "",
    email: ctx.senderEmail || "",
    company: ctx.companyName || "",
    entreprise: ctx.companyName || "",
    societe: ctx.companyName || "",
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
}

export function applyTemplateVariables(
  input: string,
  ctx: ClientTemplateContext,
): string {
  if (!input) return input;
  const values = buildTemplateValues(ctx);
  return input.replace(
    /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g,
    (full, key: string) => {
      const v = values[key.toLowerCase()];
      return v === undefined || v === "" ? full : v;
    },
  );
}
