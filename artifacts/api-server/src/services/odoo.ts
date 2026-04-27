import { supabaseAdmin } from "../lib/supabase";
import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";

// ============================================================================
// Odoo — service CRM via JSON-RPC.
// Spécificités importantes (≠ HubSpot/Pipedrive/Salesforce) :
//   - PAS d'OAuth. Chaque utilisateur a sa propre instance Odoo (SaaS odoo.com
//     OU self-hosted) avec une URL, une base de données, un login (email) et
//     une clé API personnelle (générée dans Profile > Account Security >
//     New API Key). Inboria n'a PAS de "client_id" central côté Odoo.
//   - Auth = appel POST {url}/jsonrpc service=common method=authenticate
//     qui renvoie un uid (entier). uid + apiKey sont ensuite passés à chaque
//     execute_kw sur /jsonrpc service=object.
//   - Stockage : access_token = apiKey, settings = {url, db, login, uid,
//     hasCrm}. Pas de refresh_token (les clés API Odoo n'expirent pas, sauf
//     révocation manuelle par l'utilisateur).
//   - Modèles utilisés : res.partner (contacts), crm.lead (opportunités, si
//     module CRM installé sur l'instance), mail.message (log email).
//   - Le module `crm` est OPTIONNEL côté Odoo. Si crm.lead n'existe pas,
//     syncOdooDeals retourne { synced: 0 } sans erreur (graceful fallback).
// ============================================================================

interface OdooIntegrationRow {
  id: string;
  user_id: string;
  access_token: string; // = apiKey Odoo
  workspace_name: string | null;
  settings: Record<string, any>; // { url, db, login, uid, hasCrm }
  enabled: boolean;
}

function odooUrl(row: OdooIntegrationRow): string {
  const url = row.settings?.url;
  if (!url) throw new Error("Odoo URL missing in settings");
  return String(url).replace(/\/$/, "");
}

function odooDb(row: OdooIntegrationRow): string {
  const db = row.settings?.db;
  if (!db) throw new Error("Odoo database name missing in settings");
  return String(db);
}

function odooUid(row: OdooIntegrationRow): number {
  const uid = Number(row.settings?.uid);
  if (!Number.isFinite(uid) || uid <= 0) throw new Error("Odoo uid missing or invalid");
  return uid;
}

async function getIntegration(userId: string): Promise<OdooIntegrationRow | null> {
  const { data } = await supabaseAdmin
    .from("integrations")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", "odoo")
    .eq("enabled", true)
    .maybeSingle();
  return (data as OdooIntegrationRow) || null;
}

// ----------------------------------------------------------------------------
// JSON-RPC helpers
// ----------------------------------------------------------------------------

interface JsonRpcResult<T = unknown> {
  ok: true;
  data: T;
}
interface JsonRpcError {
  ok: false;
  error: string;
  status?: number;
}
type RpcResult<T = unknown> = JsonRpcResult<T> | JsonRpcError;

// SSRF guard : un utilisateur authentifié fournit l'URL Odoo, et le serveur
// fait des requêtes vers cette URL. Sans contrôle, il pourrait viser
// localhost, des IP internes, ou les endpoints de métadonnées cloud
// (169.254.169.254). On résout le hostname puis on bloque toute IP
// loopback / privée / link-local / unique-local IPv6. En production on
// exige aussi https.
function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map((n) => Number(n));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return true;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true; // link-local + cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a >= 224) return true; // multicast / reserved
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique-local
  if (lower.startsWith("fe80")) return true; // link-local
  if (lower.startsWith("::ffff:")) {
    const v4 = lower.slice(7);
    if (isIP(v4) === 4) return isPrivateIPv4(v4);
  }
  return false;
}

async function assertUrlSafe(rawUrl: string): Promise<string | null> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return "URL invalide";
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return "URL invalide (protocole non supporté)";
  }
  if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") {
    return "URL invalide (https requis en production)";
  }
  const host = parsed.hostname;
  if (!host) return "URL invalide (hostname vide)";
  // Hostname littéral en IP : check direct
  const v = isIP(host);
  if (v === 4 && isPrivateIPv4(host)) return "URL refusée (adresse IP interne)";
  if (v === 6 && isPrivateIPv6(host)) return "URL refusée (adresse IP interne)";
  if (v === 0) {
    // DNS lookup → bloque si résolution privée
    try {
      const records = await dnsLookup(host, { all: true, verbatim: true });
      for (const r of records) {
        if (r.family === 4 && isPrivateIPv4(r.address)) return "URL refusée (résolution interne)";
        if (r.family === 6 && isPrivateIPv6(r.address)) return "URL refusée (résolution interne)";
      }
    } catch {
      return "URL injoignable (DNS)";
    }
  }
  return null;
}

async function jsonRpc<T = unknown>(
  baseUrl: string,
  service: "common" | "object" | "db",
  method: string,
  args: unknown[],
): Promise<RpcResult<T>> {
  // Timeout 15 s : empêche un Odoo lent de bloquer un worker.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/jsonrpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "call",
        params: { service, method, args },
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return { ok: false, error: `Odoo HTTP ${res.status}: ${txt.slice(0, 200)}`, status: res.status };
    }
    const body = (await res.json()) as { result?: T; error?: { data?: { message?: string }; message?: string } };
    if (body.error) {
      const msg = body.error.data?.message || body.error.message || "Odoo RPC error";
      return { ok: false, error: msg };
    }
    return { ok: true, data: body.result as T };
  } catch (err) {
    return { ok: false, error: (err as Error).message || "network error" };
  } finally {
    clearTimeout(timer);
  }
}

// `execute_kw` est l'appel générique pour interagir avec un modèle Odoo.
// Format args: [db, uid, apiKey, model, method, [positional_args], {kwargs}]
async function executeKw<T = unknown>(
  row: OdooIntegrationRow,
  model: string,
  method: string,
  positional: unknown[],
  kwargs: Record<string, unknown> = {},
): Promise<RpcResult<T>> {
  return jsonRpc<T>(
    odooUrl(row),
    "object",
    "execute_kw",
    [odooDb(row), odooUid(row), row.access_token, model, method, positional, kwargs],
  );
}

// Wrapper search_read tolérant : certaines installations Odoo (versions
// anciennes, modules non installés, instances en cours d'activation) renvoient
// "Invalid field 'X' on 'model'" pour des champs pourtant standards. Plutôt que
// de planter la synchro, on parse le nom du champ rejeté, on le retire de la
// liste et on retente. Max 8 retries (assez pour absorber plusieurs champs
// manquants en cascade sans risquer une boucle).
async function searchReadResilient<T = Array<Record<string, any>>>(
  row: OdooIntegrationRow,
  model: string,
  domain: unknown[],
  opts: { fields: string[]; limit?: number; order?: string },
): Promise<RpcResult<T>> {
  let currentFields = [...opts.fields];
  const dropped: string[] = [];
  for (let attempt = 0; attempt < 8; attempt++) {
    const r = await executeKw<T>(row, model, "search_read", [domain], {
      fields: currentFields,
      ...(opts.limit !== undefined ? { limit: opts.limit } : {}),
      ...(opts.order !== undefined ? { order: opts.order } : {}),
    });
    if (r.ok) {
      if (dropped.length > 0) {
        console.log(`[odoo] ${model}: dropped invalid fields ${JSON.stringify(dropped)} — proceeding with reduced set`);
      }
      return r;
    }
    const m = (r.error || "").match(/Invalid field ['"]([^'"]+)['"] on/i);
    if (!m) return r;
    const bad = m[1];
    const next = currentFields.filter((f) => f !== bad);
    if (next.length === currentFields.length || next.length === 0) return r;
    dropped.push(bad);
    currentFields = next;
  }
  return { ok: false, error: "search_read: too many invalid-field retries" };
}

// ----------------------------------------------------------------------------
// Connexion / Authentification
// ----------------------------------------------------------------------------

export interface OdooConnectInput {
  url: string;
  db: string;
  login: string;
  apiKey: string;
}

export interface OdooConnectResult {
  ok: boolean;
  error?: string;
  uid?: number;
  workspaceName?: string;
  hasCrm?: boolean;
}

// Tente l'authentification puis upsert la ligne `integrations`. En cas d'échec
// (mauvaise URL, mauvaise DB, mauvais login, clé API invalide), retourne
// {ok:false, error} sans rien écrire en base — l'utilisateur peut corriger
// et réessayer immédiatement.
export async function connectOdoo(
  userId: string,
  input: OdooConnectInput,
): Promise<OdooConnectResult> {
  // Validation basique avant de partir en réseau
  const url = String(input.url || "").trim();
  const db = String(input.db || "").trim();
  const login = String(input.login || "").trim();
  const apiKey = String(input.apiKey || "").trim();
  if (!url || !db || !login || !apiKey) {
    return { ok: false, error: "URL, base de données, login et clé API sont requis" };
  }
  if (!/^https?:\/\//i.test(url)) {
    return { ok: false, error: "L'URL doit commencer par https:// (ou http://)" };
  }
  // Anti-SSRF : refuse toute URL vers loopback / réseau privé / métadonnées
  // cloud avant de faire la moindre requête sortante côté serveur.
  const ssrfErr = await assertUrlSafe(url);
  if (ssrfErr) return { ok: false, error: ssrfErr };

  // Authenticate → uid
  const authRes = await jsonRpc<number | false>(
    url,
    "common",
    "authenticate",
    [db, login, apiKey, {}],
  );
  if (!authRes.ok) {
    return { ok: false, error: authRes.error };
  }
  const uid = authRes.data;
  if (!uid || typeof uid !== "number") {
    return {
      ok: false,
      error: "Authentification refusée par Odoo. Vérifiez la base, le login et la clé API.",
    };
  }

  // Détection facultative du module CRM (crm.lead). Si absent, syncs deals
  // seront skippés silencieusement. On stocke le flag pour éviter de re-tester.
  let hasCrm = false;
  const tmpRow: OdooIntegrationRow = {
    id: "",
    user_id: userId,
    access_token: apiKey,
    workspace_name: null,
    settings: { url, db, login, uid },
    enabled: true,
  };
  const probeCrm = await executeKw<number>(tmpRow, "crm.lead", "search_count", [[]], { limit: 1 });
  if (probeCrm.ok) hasCrm = true;

  // Récupère un nom d'entreprise lisible pour le badge cockpit (best-effort).
  let workspaceName: string | null = null;
  const userRead = await executeKw<Array<{ name?: string; company_id?: [number, string] }>>(
    tmpRow,
    "res.users",
    "read",
    [[uid]],
    { fields: ["name", "company_id"] },
  );
  if (userRead.ok && Array.isArray(userRead.data) && userRead.data[0]) {
    const u = userRead.data[0];
    if (Array.isArray(u.company_id) && u.company_id[1]) {
      workspaceName = String(u.company_id[1]);
    } else if (u.name) {
      workspaceName = String(u.name);
    }
  }
  if (!workspaceName) {
    try {
      workspaceName = new URL(url).hostname;
    } catch {
      workspaceName = "Odoo";
    }
  }

  await supabaseAdmin
    .from("integrations")
    .upsert(
      {
        user_id: userId,
        provider: "odoo",
        access_token: apiKey,
        refresh_token: null,
        expires_at: null,
        workspace_name: workspaceName,
        settings: { url, db, login, uid, hasCrm },
        enabled: true,
        last_error: null,
      },
      { onConflict: "user_id,provider" },
    );

  return { ok: true, uid, workspaceName: workspaceName || undefined, hasCrm };
}

export async function disconnectOdoo(userId: string): Promise<void> {
  await supabaseAdmin
    .from("integrations")
    .delete()
    .eq("user_id", userId)
    .eq("provider", "odoo");
}

// ----------------------------------------------------------------------------
// Sync : Contacts (res.partner) + Deals (crm.lead, optionnel)
// ----------------------------------------------------------------------------

export async function syncOdooContacts(
  userId: string,
  limit = 100,
): Promise<{ synced: number; error?: string }> {
  const row = await getIntegration(userId);
  if (!row) return { synced: 0, error: "not connected" };
  const safeLimit = Math.max(1, Math.min(2000, limit));

  // Filtre : on ne synchronise que les contacts ayant un email. Sans email,
  // impossible de matcher avec les emails entrants Inboria → inutile en cache.
  // Tri : write_date DESC pour avoir d'abord les contacts récemment modifiés.
  const r = await searchReadResilient<Array<Record<string, any>>>(
    row,
    "res.partner",
    [["email", "!=", false]],
    {
      fields: [
        "id",
        "name",
        "email",
        "phone",
        "function",
        "company_name",
        "parent_id",
        "is_company",
        "city",
        "country_id",
        "write_date",
      ],
      limit: safeLimit,
      order: "write_date desc",
    },
  );
  if (!r.ok) {
    await supabaseAdmin
      .from("integrations")
      .update({ last_error: r.error })
      .eq("id", row.id);
    return { synced: 0, error: r.error };
  }
  const records = r.data || [];
  console.log(`[odoo] sync contacts: Odoo returned ${records.length} record(s) for user ${userId}`);
  let upsertErrors = 0;
  let firstUpsertError: string | null = null;
  for (const c of records) {
    // Odoo res.partner.name est un champ unique "Prénom Nom". On split au
    // premier espace pour first_name / last_name (best-effort, FR/EN).
    const fullName = String(c.name || "").trim();
    let firstName: string | null = null;
    let lastName: string | null = null;
    if (fullName) {
      const idx = fullName.indexOf(" ");
      if (idx > 0) {
        firstName = fullName.slice(0, idx);
        lastName = fullName.slice(idx + 1);
      } else {
        firstName = fullName;
      }
    }
    // Société : si le contact est lié à un parent (company), on prend le nom
    // du parent. Sinon on retombe sur company_name (champ libre Odoo).
    let company: string | null = null;
    if (Array.isArray(c.parent_id) && c.parent_id[1]) {
      company = String(c.parent_id[1]);
    } else if (c.company_name) {
      company = String(c.company_name);
    } else if (c.is_company === true && fullName) {
      company = fullName;
    }
    const { error: upsertErr } = await supabaseAdmin.from("crm_contacts").upsert(
      {
        user_id: userId,
        provider: "odoo",
        external_id: String(c.id),
        email: c.email ? String(c.email).toLowerCase() : null,
        first_name: firstName,
        last_name: lastName,
        company,
        phone: c.phone || c.mobile || null,
        raw: c,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,provider,external_id" },
    );
    if (upsertErr) {
      upsertErrors++;
      if (!firstUpsertError) firstUpsertError = upsertErr.message;
      console.error(`[odoo] sync contacts upsert error for external_id=${c.id} email=${c.email}:`, upsertErr.message);
    }
  }
  const persisted = records.length - upsertErrors;
  console.log(`[odoo] sync contacts: persisted ${persisted}/${records.length} for user ${userId}` + (upsertErrors > 0 ? ` (errors=${upsertErrors}, first="${firstUpsertError}")` : ""));
  await supabaseAdmin
    .from("integrations")
    .update({ last_synced_at: new Date().toISOString(), last_error: upsertErrors > 0 ? `Upsert: ${firstUpsertError}` : null })
    .eq("id", row.id);
  return { synced: persisted, error: upsertErrors > 0 ? `${upsertErrors} contact(s) refusés en base : ${firstUpsertError}` : undefined };
}

export async function syncOdooDeals(
  userId: string,
  limit = 100,
): Promise<{ synced: number; error?: string }> {
  const row = await getIntegration(userId);
  if (!row) return { synced: 0, error: "not connected" };
  // Si l'instance Odoo n'a pas le module CRM installé, on skip silencieusement
  // (détecté au connect ou sur erreur ici).
  if (row.settings?.hasCrm === false) return { synced: 0 };
  const safeLimit = Math.max(1, Math.min(2000, limit));

  // crm.lead avec type='opportunity'. Les "leads" purs (type='lead') sont
  // exclus : ce sont des prospects non qualifiés, peu pertinents pour le
  // panneau cockpit. On capture stage, contact lié, montant, devise.
  const r = await searchReadResilient<Array<Record<string, any>>>(
    row,
    "crm.lead",
    [["type", "=", "opportunity"]],
    {
      fields: [
        "id",
        "name",
        "expected_revenue",
        "company_currency",
        "stage_id",
        "probability",
        "partner_id",
        "user_id",
        "date_deadline",
        "date_closed",
        "active",
        "won_status",
        "write_date",
      ],
      limit: safeLimit,
      order: "write_date desc",
    },
  );
  if (!r.ok) {
    // Si erreur ressemble à "model not found" → on désactive hasCrm pour
    // éviter de retenter à chaque cycle.
    const msg = (r.error || "").toLowerCase();
    if (msg.includes("crm.lead") || msg.includes("does not exist") || msg.includes("model")) {
      const newSettings = { ...row.settings, hasCrm: false };
      await supabaseAdmin
        .from("integrations")
        .update({ settings: newSettings })
        .eq("id", row.id);
      return { synced: 0 };
    }
    return { synced: 0, error: r.error };
  }
  const records = r.data || [];
  for (const o of records) {
    const partnerId = Array.isArray(o.partner_id) && o.partner_id[0] ? String(o.partner_id[0]) : null;
    const stageLabel = Array.isArray(o.stage_id) && o.stage_id[1] ? String(o.stage_id[1]) : null;
    const currency = Array.isArray(o.company_currency) && o.company_currency[1] ? String(o.company_currency[1]) : null;
    // status : "won" si won_status='won', "lost" si active=false avec
    // probability=0, "open" sinon.
    let status: "open" | "won" | "lost" = "open";
    if (o.won_status === "won") status = "won";
    else if (o.active === false && Number(o.probability) === 0) status = "lost";
    await supabaseAdmin.from("crm_deals").upsert(
      {
        user_id: userId,
        provider: "odoo",
        external_id: String(o.id),
        title: o.name || null,
        amount: o.expected_revenue != null ? Number(o.expected_revenue) : null,
        currency,
        stage: stageLabel,
        status,
        contact_external_id: partnerId,
        raw: o,
        last_synced_at: new Date().toISOString(),
      },
      { onConflict: "user_id,provider,external_id" },
    );
  }
  return { synced: records.length };
}

// ----------------------------------------------------------------------------
// Cockpit panel : contact-context (lecture cache + deals/activités live)
// ----------------------------------------------------------------------------

export async function getOdooContactContext(
  userId: string,
  email: string,
): Promise<{
  contact: {
    externalId: string;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    company: string | null;
    phone: string | null;
    jobTitle: string | null;
    city: string | null;
    country: string | null;
    lastSyncedAt: string;
  };
  deals: Array<{
    externalId: string;
    title: string | null;
    amount: number | null;
    currency: string | null;
    stage: string | null;
    status: string | null;
    closeDate: string | null;
  }>;
  activities: Array<{
    id: string;
    summary: string | null;
    activityType: string | null;
    dueDate: string | null;
    state: string | null;
  }>;
} | null> {
  // Odoo res.partner peut contenir plusieurs fiches avec le même email
  // (ex. parent société + contact, ou doublons utilisateur). On prend la
  // plus récemment synchronisée — utiliser .maybeSingle() ici renverrait
  // une erreur silencieuse en cas de doublon et casserait le panneau.
  const { data: contactRows } = await supabaseAdmin
    .from("crm_contacts")
    .select("external_id, email, first_name, last_name, company, phone, raw, last_synced_at")
    .eq("user_id", userId)
    .eq("provider", "odoo")
    .ilike("email", email)
    .order("last_synced_at", { ascending: false })
    .limit(1);
  const contactData = (contactRows && contactRows.length > 0) ? contactRows[0] : null;
  if (!contactData) return null;
  const contact = contactData as {
    external_id: string;
    email: string | null;
    first_name: string | null;
    last_name: string | null;
    company: string | null;
    phone: string | null;
    raw: Record<string, any> | null;
    last_synced_at: string;
  };
  const raw = contact.raw || {};

  const row = await getIntegration(userId);
  // Deals liés via partner_id (live si possible, sinon cache)
  let deals: Array<{
    externalId: string;
    title: string | null;
    amount: number | null;
    currency: string | null;
    stage: string | null;
    status: string | null;
    closeDate: string | null;
  }> = [];
  let activities: Array<{
    id: string;
    summary: string | null;
    activityType: string | null;
    dueDate: string | null;
    state: string | null;
  }> = [];

  if (row && row.settings?.hasCrm !== false) {
    try {
      const dealsRes = await searchReadResilient<Array<Record<string, any>>>(
        row,
        "crm.lead",
        [["partner_id", "=", Number(contact.external_id)], ["type", "=", "opportunity"]],
        {
          fields: ["id", "name", "expected_revenue", "company_currency", "stage_id", "active", "won_status", "probability", "date_deadline"],
          limit: 10,
          order: "write_date desc",
        },
      );
      if (dealsRes.ok && Array.isArray(dealsRes.data)) {
        deals = dealsRes.data.map((o) => {
          const stageLabel = Array.isArray(o.stage_id) && o.stage_id[1] ? String(o.stage_id[1]) : null;
          const currency = Array.isArray(o.company_currency) && o.company_currency[1] ? String(o.company_currency[1]) : null;
          let status: "open" | "won" | "lost" = "open";
          if (o.won_status === "won") status = "won";
          else if (o.active === false && Number(o.probability) === 0) status = "lost";
          return {
            externalId: String(o.id),
            title: o.name || null,
            amount: o.expected_revenue != null ? Number(o.expected_revenue) : null,
            currency,
            stage: stageLabel,
            status,
            closeDate: o.date_deadline || null,
          };
        });
      }
    } catch {
      deals = [];
    }
  }

  if (row) {
    try {
      // mail.activity liées au contact (rappels, todos planifiés Odoo)
      const actsRes = await searchReadResilient<Array<Record<string, any>>>(
        row,
        "mail.activity",
        [["res_model", "=", "res.partner"], ["res_id", "=", Number(contact.external_id)]],
        {
          fields: ["id", "summary", "activity_type_id", "date_deadline", "state"],
          limit: 5,
          order: "date_deadline desc",
        },
      );
      if (actsRes.ok && Array.isArray(actsRes.data)) {
        activities = actsRes.data.map((a) => ({
          id: String(a.id),
          summary: a.summary || null,
          activityType: Array.isArray(a.activity_type_id) && a.activity_type_id[1] ? String(a.activity_type_id[1]) : null,
          dueDate: a.date_deadline || null,
          state: a.state || null,
        }));
      }
    } catch {
      activities = [];
    }
  }

  return {
    contact: {
      externalId: contact.external_id,
      email: contact.email,
      firstName: contact.first_name,
      lastName: contact.last_name,
      company: contact.company,
      phone: contact.phone,
      jobTitle: (raw["function"] as string | null) || null,
      city: (raw["city"] as string | null) || null,
      country: Array.isArray(raw["country_id"]) && raw["country_id"][1] ? String(raw["country_id"][1]) : null,
      lastSyncedAt: contact.last_synced_at,
    },
    deals,
    activities,
  };
}

// ----------------------------------------------------------------------------
// Log email engagement : crée un message dans le fil de discussion (chatter)
// du contact via mail.message + body. Apparaît dans la fiche partner Odoo.
// ----------------------------------------------------------------------------

export async function logEmailEngagementOdoo(
  userId: string,
  contactExternalId: string,
  subject: string,
  bodyText: string,
  occurredAt: string | null,
): Promise<{ ok: true; id?: string } | { ok: false; error: string }> {
  const row = await getIntegration(userId);
  if (!row) return { ok: false, error: "not connected" };
  const ts = occurredAt ? new Date(occurredAt) : new Date();
  const cleanBody = bodyText.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 30000);
  const html = `<p><strong>Email enregistré depuis Inboria</strong></p>` +
    `<p><em>Date : ${ts.toISOString()}</em></p>` +
    `<p><strong>Sujet :</strong> ${(subject || "(sans objet)").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]!))}</p>` +
    `<p>${cleanBody.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]!))}</p>`;

  // message_post est la méthode standard Odoo pour ajouter un message au
  // chatter d'un record. Renvoie l'id du mail.message créé.
  const r = await executeKw<number>(
    row,
    "res.partner",
    "message_post",
    [[Number(contactExternalId)]],
    {
      body: html,
      subject: (subject || "(sans objet)").slice(0, 200),
      message_type: "comment",
    },
  );
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, id: r.data ? String(r.data) : undefined };
}

// ----------------------------------------------------------------------------
// Liste des types d'activité Odoo (mail.activity.type) — alimente le dropdown
// du formulaire "Créer activité" du cockpit. Cap à 50 (largement suffisant
// pour une instance type ; les types les plus courants sont "To-Do", "Call",
// "Meeting", "Email"). Retourne [] si l'instance n'a pas le module installé.
// ----------------------------------------------------------------------------
export async function listOdooActivityTypes(
  userId: string,
): Promise<Array<{ id: number; name: string }>> {
  const row = await getIntegration(userId);
  if (!row) return [];
  try {
    const r = await searchReadResilient<Array<Record<string, any>>>(
      row,
      "mail.activity.type",
      [],
      { fields: ["id", "name"], limit: 50, order: "sequence asc, id asc" },
    );
    if (!r.ok || !Array.isArray(r.data)) return [];
    return r.data
      .filter((t) => typeof t.id === "number" && typeof t.name === "string")
      .map((t) => ({ id: Number(t.id), name: String(t.name) }));
  } catch {
    return [];
  }
}

// ----------------------------------------------------------------------------
// Créer une opportunité (crm.lead type='opportunity') liée au contact.
// expectedRevenue et dateDeadline sont optionnels. La devise est héritée
// automatiquement du paramétrage Odoo (company_currency).
// ----------------------------------------------------------------------------
export async function createOdooDeal(
  userId: string,
  input: {
    contactExternalId: string;
    name: string;
    expectedRevenue: number | null;
    dateDeadline: string | null;
  },
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const row = await getIntegration(userId);
  if (!row) return { ok: false, error: "not connected" };
  if (row.settings?.hasCrm === false) {
    return { ok: false, error: "Odoo CRM module not installed" };
  }
  const partnerId = Number(input.contactExternalId);
  if (!Number.isFinite(partnerId) || partnerId <= 0) {
    return { ok: false, error: "invalid contact id" };
  }
  const trimmedName = (input.name || "").trim().slice(0, 200);
  if (!trimmedName) return { ok: false, error: "name required" };
  const payload: Record<string, unknown> = {
    name: trimmedName,
    partner_id: partnerId,
    type: "opportunity",
  };
  if (input.expectedRevenue != null && Number.isFinite(input.expectedRevenue)) {
    payload["expected_revenue"] = Number(input.expectedRevenue);
  }
  if (input.dateDeadline) {
    payload["date_deadline"] = String(input.dateDeadline);
  }
  // Odoo `create` retourne soit un id (single) soit un array d'ids selon la
  // version. On normalise.
  const r = await executeKw<number | number[]>(
    row,
    "crm.lead",
    "create",
    [payload],
    {},
  );
  if (!r.ok) return { ok: false, error: r.error };
  const id = Array.isArray(r.data) ? r.data[0] : r.data;
  if (!Number.isFinite(Number(id))) return { ok: false, error: "create returned no id" };
  return { ok: true, id: String(id) };
}

// ----------------------------------------------------------------------------
// Créer une activité Odoo (mail.activity) attachée au contact (res.partner).
// activityTypeId optionnel : si absent, on prend le premier type disponible
// (l'instance Odoo a toujours au moins "To-Do" / "Email" par défaut).
// ----------------------------------------------------------------------------
export async function createOdooActivity(
  userId: string,
  input: {
    contactExternalId: string;
    summary: string;
    note: string;
    dateDeadline: string | null;
    activityTypeId: number | null;
  },
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const row = await getIntegration(userId);
  if (!row) return { ok: false, error: "not connected" };
  const partnerId = Number(input.contactExternalId);
  if (!Number.isFinite(partnerId) || partnerId <= 0) {
    return { ok: false, error: "invalid contact id" };
  }
  const summary = (input.summary || "").trim().slice(0, 200);
  if (!summary) return { ok: false, error: "summary required" };

  // Résout activity_type_id : si l'utilisateur n'a pas choisi, on récupère
  // le premier type pour éviter le rejet "activity_type_id is required".
  let activityTypeId = input.activityTypeId;
  if (!activityTypeId || !Number.isFinite(activityTypeId)) {
    const types = await listOdooActivityTypes(userId);
    activityTypeId = types[0]?.id ?? null;
    if (!activityTypeId) {
      return { ok: false, error: "no activity type available in Odoo" };
    }
  }

  // Récupère res_model_id de res.partner. mail.activity exige soit
  // res_model_id (id de ir.model) soit res_model (string) selon la version.
  // Le couple {res_model: "res.partner", res_id} est accepté par toutes les
  // versions modernes d'Odoo (≥13).
  const cleanNote = (input.note || "").replace(/<[^>]+>/g, " ").trim().slice(0, 5000);
  const payload: Record<string, unknown> = {
    res_model: "res.partner",
    res_id: partnerId,
    summary,
    activity_type_id: Number(activityTypeId),
  };
  if (cleanNote) payload["note"] = cleanNote.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]!));
  if (input.dateDeadline) {
    payload["date_deadline"] = String(input.dateDeadline);
  } else {
    // Odoo exige date_deadline. Défaut : J+7.
    const d = new Date();
    d.setDate(d.getDate() + 7);
    payload["date_deadline"] = d.toISOString().slice(0, 10);
  }

  const r = await executeKw<number | number[]>(
    row,
    "mail.activity",
    "create",
    [payload],
    {},
  );
  if (!r.ok) return { ok: false, error: r.error };
  const id = Array.isArray(r.data) ? r.data[0] : r.data;
  if (!Number.isFinite(Number(id))) return { ok: false, error: "create returned no id" };
  return { ok: true, id: String(id) };
}
