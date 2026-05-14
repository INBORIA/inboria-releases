import OpenAI from "openai";
import { supabaseAdmin } from "../lib/supabase";
import {
  extractAttachmentText,
  type AttachmentRow,
} from "../lib/attachment-extract";

const openai = new OpenAI({ apiKey: process.env["OPENAI_API_KEY"] });

const MAX_BODY_CHARS = 6000;
const MAX_LIST_BODY_CHARS = 1500;
const MAX_TOOL_RESULT_CHARS = 8000;

export interface InboriaToolCtx {
  userId: string;
  emailScopeFilter: string;
  ownershipScopeFilter: string;
  adminTeamCtx: { orgId: string; memberIds: string[]; sharedMailboxIds: string[] } | null;
  log: { info: (...a: any[]) => void; warn: (...a: any[]) => void; error: (...a: any[]) => void };
}

function stripHtml(s: string): string {
  return String(s || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function truncate(s: string, n: number): string {
  if (!s) return "";
  return s.length <= n ? s : s.slice(0, n) + " […tronqué]";
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return "?";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "?";
  return d.toISOString().slice(0, 16).replace("T", " ");
}

function parseAddress(s: string): string {
  if (!s) return "";
  const m = s.match(/<\s*([^<>]+)\s*>/);
  return (m ? m[1]! : s).trim().toLowerCase();
}

function clampString(s: string): string {
  return s.length <= MAX_TOOL_RESULT_CHARS
    ? s
    : s.slice(0, MAX_TOOL_RESULT_CHARS) + "\n[...sortie tronquee, affine ta requete si besoin]";
}

// =============================================================================
// TOOL DEFINITIONS (OpenAI schema)
// =============================================================================

export const INBORIA_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "read_email",
      description:
        "Lit le CORPS COMPLET d'un mail precis a partir de son ID interne (forme [mail#1234]). Utilise cet outil DES QUE tu as besoin de details factuels qui ne sont pas dans le resume court (date precise, montant, adresse, contenu d'une phrase). NE JAMAIS inventer ces details : appelle cet outil.",
      parameters: {
        type: "object",
        properties: {
          emailId: {
            type: "integer",
            description: "ID numerique du mail (le nombre dans [mail#XXXX])",
          },
        },
        required: ["emailId"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_thread",
      description:
        "Lit TOUS les mails d'un meme fil de discussion (le mail demande + les reponses entrantes et sortantes), avec corps complet pour chacun. Utile pour resumer une conversation, retrouver une decision prise dans un echange, ou voir l'historique avec un contact sur un sujet precis.",
      parameters: {
        type: "object",
        properties: {
          emailId: {
            type: "integer",
            description: "ID numerique d'un mail du fil (n'importe lequel suffit)",
          },
        },
        required: ["emailId"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_emails_from_contact",
      description:
        "Liste TOUS les mails recents echanges avec un CONTACT EXTERNE (client, fournisseur, prospect), avec un extrait de corps pour chacun. Indispensable quand l'utilisateur dit 'les RDV proposes par X', 'les factures de X', 'le devis de Acme', 'que m'a envoye X la semaine derniere'. ATTENTION : 'contactEmail' = adresse de l'INTERLOCUTEUR EXTERNE (ex: laure.f@umbrella.test, contact@globex.test), JAMAIS l'adresse d'un collaborateur interne dont on consulte la boite (mode admin team). Ex : si l'utilisateur dit 'le devis envoye a Umbrella par Richard', contactEmail = email du contact Umbrella (visible dans la memoire projet sous 'Contact externe: Nom <email>'), PAS l'email de Richard. Donne TOUJOURS l'adresse email exacte (visible dans la memoire courte sous la forme '[mail#ID] ... <email@domaine>' ou dans la description du projet).",
      parameters: {
        type: "object",
        properties: {
          contactEmail: {
            type: "string",
            description: "Adresse email exacte du contact (ex: petitzoosrl@hotmail.com)",
          },
          daysBack: {
            type: "integer",
            description: "Nombre de jours d'historique (par defaut 90, max 365)",
          },
          limit: {
            type: "integer",
            description: "Nombre max de mails retournes (par defaut 10, max 20)",
          },
        },
        required: ["contactEmail"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_emails",
      description:
        "Cherche dans TOUT l'historique des mails (perso + boites partagees dont je suis membre) par recherche plein texte. Renvoie les mails dont le sujet OU le corps contient les mots-cles. Utilise ca pour 'trouve le mail qui parle de X', 'le devis Acme', 'la commande #1234'. Apres, appelle read_email sur les ID interessants pour avoir le corps complet.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Termes a chercher (mot-cles, pas une phrase complete)",
          },
          daysBack: {
            type: "integer",
            description: "Fenetre d'historique en jours (par defaut 180, max 730)",
          },
          limit: {
            type: "integer",
            description: "Nombre max de resultats (par defaut 8, max 15)",
          },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_attachment",
      description:
        "Lit le contenu textuel d'une piece jointe d'un mail (PDF, docx, txt, html, csv, json). Indispensable pour repondre 'que dit la PJ X', 'quel est le montant de la facture en PJ', 'resume le contrat joint'. Donne l'ID du mail et le nom exact du fichier (visibles dans la memoire courte sous forme '[PJ: nom1.pdf, nom2.docx]').",
      parameters: {
        type: "object",
        properties: {
          emailId: {
            type: "integer",
            description: "ID du mail qui porte la PJ",
          },
          filename: {
            type: "string",
            description: "Nom de fichier exact (ex: 'Facture-2026-04.pdf')",
          },
        },
        required: ["emailId", "filename"],
        additionalProperties: false,
      },
    },
  },
];

// =============================================================================
// TOOL HANDLERS
// =============================================================================

async function handleReadEmail(
  args: { emailId: number },
  ctx: InboriaToolCtx,
): Promise<string> {
  const id = Number(args.emailId);
  if (!Number.isFinite(id) || id <= 0) {
    return JSON.stringify({ error: "emailId invalide" });
  }
  let q1: any = supabaseAdmin
    .from("emails")
    .select("id, sender, recipient, subject, body, summary, status, priority, created_at, sent_at, snoozed_until, assigned_to, category_id, project_id, user_id, shared_mailbox_id, is_private")
    .eq("id", id)
    .or(ctx.emailScopeFilter);
  // RGPD: en mode admin team, masquer totalement les mails marques prives
  // d'un collaborateur. L'admin ne doit jamais y acceder via tool call.
  if (ctx.adminTeamCtx) q1 = q1.eq("is_private", false);
  const { data, error } = await q1.maybeSingle();
  if (error) return JSON.stringify({ error: `db: ${error.message}` });
  if (!data) {
    return JSON.stringify({
      error: `Mail #${id} introuvable ou hors de votre perimetre (vous n'y avez pas acces).`,
    });
  }
  const cleanBody = truncate(stripHtml(String((data as any).body || "")), MAX_BODY_CHARS);
  // Attachments index
  const { data: atts } = await supabaseAdmin
    .from("email_attachments")
    .select("filename, content_type, size")
    .eq("email_id", id);
  const attList = (atts || []).map((a: any) => ({
    filename: a.filename,
    type: a.content_type,
    size: a.size,
  }));
  return clampString(
    JSON.stringify({
      id: (data as any).id,
      date: fmtDate((data as any).created_at),
      sent_at: fmtDate((data as any).sent_at),
      sender: (data as any).sender,
      recipient: (data as any).recipient,
      subject: (data as any).subject,
      status: (data as any).status,
      priority: (data as any).priority,
      summary_short: (data as any).summary,
      body: cleanBody || "(corps vide)",
      attachments: attList,
    }),
  );
}

async function handleReadThread(
  args: { emailId: number },
  ctx: InboriaToolCtx,
): Promise<string> {
  const id = Number(args.emailId);
  if (!Number.isFinite(id) || id <= 0) {
    return JSON.stringify({ error: "emailId invalide" });
  }
  // Anchor email
  let qa: any = supabaseAdmin
    .from("emails")
    .select("id, sender, recipient, subject, body, status, created_at, sent_at, reply_to_email_id, user_id, shared_mailbox_id, is_private")
    .eq("id", id)
    .or(ctx.emailScopeFilter);
  if (ctx.adminTeamCtx) qa = qa.eq("is_private", false);
  const { data: anchor, error } = await qa.maybeSingle();
  if (error) return JSON.stringify({ error: `db: ${error.message}` });
  if (!anchor) {
    return JSON.stringify({
      error: `Mail #${id} introuvable ou hors perimetre.`,
    });
  }
  const collected: any[] = [anchor];
  const seen = new Set<number>([Number((anchor as any).id)]);
  // Walk up
  let cursor: any = anchor;
  for (let i = 0; i < 8 && (cursor as any).reply_to_email_id; i++) {
    const parentId = Number((cursor as any).reply_to_email_id);
    if (!parentId || seen.has(parentId)) break;
    let qp: any = supabaseAdmin
      .from("emails")
      .select("id, sender, recipient, subject, body, status, created_at, sent_at, reply_to_email_id, user_id, shared_mailbox_id, is_private")
      .eq("id", parentId)
      .or(ctx.emailScopeFilter);
    if (ctx.adminTeamCtx) qp = qp.eq("is_private", false);
    const { data: parent } = await qp.maybeSingle();
    if (!parent) break;
    collected.push(parent);
    seen.add(parentId);
    cursor = parent;
  }
  // Walk down (replies pointing to anything in seen)
  for (let depth = 0; depth < 4; depth++) {
    const ids = Array.from(seen);
    let qr: any = supabaseAdmin
      .from("emails")
      .select("id, sender, recipient, subject, body, status, created_at, sent_at, reply_to_email_id, user_id, shared_mailbox_id, is_private")
      .in("reply_to_email_id", ids)
      .or(ctx.emailScopeFilter);
    if (ctx.adminTeamCtx) qr = qr.eq("is_private", false);
    const { data: replies } = await qr.order("created_at", { ascending: true });
    let added = 0;
    for (const r of replies || []) {
      const rid = Number((r as any).id);
      if (!seen.has(rid)) {
        collected.push(r);
        seen.add(rid);
        added++;
      }
    }
    if (added === 0) break;
  }
  collected.sort(
    (a, b) =>
      new Date((a as any).created_at).getTime() -
      new Date((b as any).created_at).getTime(),
  );
  const items = collected.slice(0, 12).map((m: any) => ({
    id: m.id,
    role: m.status === "sent" ? "sortant" : "entrant",
    date: fmtDate(m.created_at),
    sender: m.sender,
    recipient: m.recipient,
    subject: m.subject,
    body: truncate(stripHtml(String(m.body || "")), 2000),
  }));
  return clampString(
    JSON.stringify({ thread_size: collected.length, messages: items }),
  );
}

async function handleListFromContact(
  args: { contactEmail: string; daysBack?: number; limit?: number },
  ctx: InboriaToolCtx,
): Promise<string> {
  const email = parseAddress(String(args.contactEmail || ""));
  if (!email || !email.includes("@")) {
    return JSON.stringify({
      error: "contactEmail invalide (donne une adresse email complete)",
    });
  }
  const daysBack = Math.min(Math.max(Number(args.daysBack) || 90, 1), 365);
  const limit = Math.min(Math.max(Number(args.limit) || 10, 1), 20);
  const sinceIso = new Date(Date.now() - daysBack * 86400000).toISOString();
  let qc: any = supabaseAdmin
    .from("emails")
    .select("id, sender, recipient, subject, body, status, created_at, sent_at, summary, user_id, shared_mailbox_id, is_private")
    .or(ctx.emailScopeFilter)
    .or(`sender.ilike.%${email}%,recipient.ilike.%${email}%`)
    .gte("created_at", sinceIso);
  if (ctx.adminTeamCtx) qc = qc.eq("is_private", false);
  const { data, error } = await qc
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return JSON.stringify({ error: `db: ${error.message}` });
  if (!data || data.length === 0) {
    return JSON.stringify({
      contact: email,
      days_back: daysBack,
      result: "Aucun mail trouve avec ce contact dans cette fenetre.",
    });
  }
  const items = data.map((e: any) => ({
    id: e.id,
    date: fmtDate(e.created_at),
    role: e.status === "sent" ? "sortant" : "entrant",
    sender: e.sender,
    recipient: e.recipient,
    subject: e.subject,
    body: truncate(stripHtml(String(e.body || "")), MAX_LIST_BODY_CHARS),
  }));
  return clampString(
    JSON.stringify({
      contact: email,
      days_back: daysBack,
      count: items.length,
      mails: items,
    }),
  );
}

async function handleSearchEmails(
  args: { query: string; daysBack?: number; limit?: number },
  ctx: InboriaToolCtx,
): Promise<string> {
  const query = String(args.query || "").trim();
  if (!query || query.length < 2) {
    return JSON.stringify({ error: "query trop courte (>= 2 caracteres)" });
  }
  const daysBack = Math.min(Math.max(Number(args.daysBack) || 180, 1), 730);
  const limit = Math.min(Math.max(Number(args.limit) || 8, 1), 15);
  const sinceIso = new Date(Date.now() - daysBack * 86400000).toISOString();

  const merged = new Map<number, any>();

  // Semantic search (best effort)
  try {
    const embedRes = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: query,
    });
    const queryVec = embedRes.data[0]?.embedding;
    if (Array.isArray(queryVec) && queryVec.length === 1536) {
      const scopeUserIds = ctx.adminTeamCtx
        ? ctx.adminTeamCtx.memberIds
        : [ctx.userId];
      const scopeMailboxIds = ctx.adminTeamCtx
        ? ctx.adminTeamCtx.sharedMailboxIds
        : [];
      const { data: hits } = await supabaseAdmin.rpc("search_email_chunks", {
        query_vec: queryVec as any,
        scope_user_ids: scopeUserIds,
        scope_mailbox_ids: scopeMailboxIds,
        exclude_private: !!ctx.adminTeamCtx,
        match_limit: limit * 2,
      });
      for (const h of (hits as any[]) || []) {
        if (typeof h.distance !== "number" || h.distance >= 0.78) continue;
        const eid = Number(h.email_id);
        if (!merged.has(eid)) {
          merged.set(eid, {
            id: eid,
            sender: h.sender,
            subject: h.subject,
            date: fmtDate(h.sent_at || h.created_at),
            snippet: truncate(
              String(h.content || "").replace(/\s+/g, " "),
              350,
            ),
            via: "semantic",
          });
        }
      }
    }
  } catch (err: any) {
    ctx.log.warn?.({ err: err?.message }, "[inboria-tools] embed/RPC failed");
  }

  // Keyword fallback / supplement
  if (merged.size < limit) {
    const safe = query.replace(/[%,()]/g, "");
    let qk: any = supabaseAdmin
      .from("emails")
      .select("id, sender, subject, body, summary, created_at, sent_at, status")
      .or(ctx.emailScopeFilter)
      .or(`subject.ilike.%${safe}%,body.ilike.%${safe}%,summary.ilike.%${safe}%`)
      .gte("created_at", sinceIso);
    if (ctx.adminTeamCtx) qk = qk.eq("is_private", false);
    const { data: kw } = await qk
      .order("created_at", { ascending: false })
      .limit(limit * 2);
    for (const e of (kw as any[]) || []) {
      const eid = Number(e.id);
      if (merged.has(eid)) continue;
      merged.set(eid, {
        id: eid,
        sender: e.sender,
        subject: e.subject,
        date: fmtDate(e.created_at),
        snippet: truncate(stripHtml(String(e.body || e.summary || "")), 350),
        via: "keyword",
      });
      if (merged.size >= limit) break;
    }
  }

  const results = Array.from(merged.values()).slice(0, limit);
  if (results.length === 0) {
    return JSON.stringify({
      query,
      result: "Aucun mail trouve. Essaie d'autres mots-cles ou elargis daysBack.",
    });
  }
  return clampString(
    JSON.stringify({ query, days_back: daysBack, count: results.length, results }),
  );
}

async function handleReadAttachment(
  args: { emailId: number; filename: string },
  ctx: InboriaToolCtx,
): Promise<string> {
  const id = Number(args.emailId);
  const filename = String(args.filename || "").trim();
  if (!Number.isFinite(id) || id <= 0 || !filename) {
    return JSON.stringify({ error: "emailId ou filename invalide" });
  }
  // Ownership via emails scope
  let qo: any = supabaseAdmin
    .from("emails")
    .select("id")
    .eq("id", id)
    .or(ctx.emailScopeFilter);
  if (ctx.adminTeamCtx) qo = qo.eq("is_private", false);
  const { data: own } = await qo.maybeSingle();
  if (!own) {
    return JSON.stringify({
      error: `Mail #${id} hors perimetre, lecture PJ refusee.`,
    });
  }
  const { data: atts } = await supabaseAdmin
    .from("email_attachments")
    .select("id, email_id, filename, content_type, size, provider, provider_attachment_id, message_uid, connection_id")
    .eq("email_id", id);
  const att = (atts || []).find(
    (a: any) =>
      String(a.filename || "").toLowerCase() === filename.toLowerCase(),
  ) as AttachmentRow | undefined;
  if (!att) {
    const names = (atts || []).map((a: any) => a.filename).join(", ") || "(aucune)";
    return JSON.stringify({
      error: `Piece jointe '${filename}' introuvable. PJ disponibles: ${names}`,
    });
  }
  const text = await extractAttachmentText(att);
  if (!text) {
    return JSON.stringify({
      filename: att.filename,
      result: "Extraction impossible (format non supporte ou contenu vide).",
    });
  }
  return clampString(
    JSON.stringify({
      emailId: id,
      filename: att.filename,
      content_type: att.content_type,
      text,
    }),
  );
}

// =============================================================================
// DISPATCHER
// =============================================================================

export async function runInboriaTool(
  name: string,
  args: any,
  ctx: InboriaToolCtx,
): Promise<string> {
  try {
    switch (name) {
      case "read_email":
        return await handleReadEmail(args, ctx);
      case "read_thread":
        return await handleReadThread(args, ctx);
      case "list_emails_from_contact":
        return await handleListFromContact(args, ctx);
      case "search_emails":
        return await handleSearchEmails(args, ctx);
      case "read_attachment":
        return await handleReadAttachment(args, ctx);
      default:
        return JSON.stringify({ error: `Outil inconnu: ${name}` });
    }
  } catch (err: any) {
    ctx.log.error?.(
      { err: err?.message, tool: name },
      "[inboria-tools] handler error",
    );
    return JSON.stringify({
      error: `Erreur interne outil ${name}: ${err?.message || "inconnu"}`,
    });
  }
}
