import { supabaseAdmin } from "../lib/supabase";

// ============================================================================
// Salesforce — service OAuth + CRM (parité HubSpot/Pipedrive).
// Spécificités importantes :
//   - Deux endpoints OAuth selon que l'org cible est PROD ou SANDBOX :
//       prod    → https://login.salesforce.com
//       sandbox → https://test.salesforce.com
//     Ce flag est porté par le state HMAC côté `connect`, persisté dans
//     `integrations.settings.isSandbox` au callback.
//   - Le token endpoint renvoie `instance_url` (ex. https://acme.my.salesforce.com)
//     stocké dans `settings.instanceUrl`. Toutes les API REST suivantes ciblent
//     `${instance_url}/services/data/v59.0/...`.
//   - Le refresh_token Salesforce ne change PAS lors d'un refresh : on
//     réutilise celui en DB et on ne réécrit que access_token + expires_at
//     (Salesforce omet `refresh_token` dans la réponse refresh).
//   - Lien Contact ⇄ Opportunity : Salesforce utilise OpportunityContactRole
//     (pas un foreign key direct). Pour la sync, on stocke contact_external_id
//     = ContactId IsPrimary (subquery SOQL). Pour le panneau, on requête en
//     live via OpportunityContactRole pour ne pas dépendre du cache.
// ============================================================================

export const SALESFORCE_SCOPES = ["api", "refresh_token", "offline_access"];
const SALESFORCE_API_VERSION = "v59.0";

function loginHost(isSandbox: boolean): string {
  return isSandbox ? "https://test.salesforce.com" : "https://login.salesforce.com";
}

interface SalesforceIntegrationRow {
  id: string;
  user_id: string;
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
  workspace_name: string | null;
  settings: Record<string, any>;
  enabled: boolean;
}

function instanceUrl(row: SalesforceIntegrationRow): string {
  const url = row.settings?.instanceUrl;
  if (!url) throw new Error("Salesforce instance_url missing in settings");
  return String(url).replace(/\/$/, "");
}

function isSandboxRow(row: SalesforceIntegrationRow): boolean {
  return row.settings?.isSandbox === true;
}

async function getIntegration(userId: string): Promise<SalesforceIntegrationRow | null> {
  const { data } = await supabaseAdmin
    .from("integrations")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", "salesforce")
    .eq("enabled", true)
    .maybeSingle();
  return (data as SalesforceIntegrationRow) || null;
}

// Salesforce ne renvoie PAS de nouveau refresh_token sur refresh : on
// préserve celui déjà stocké et on ne met à jour que access_token + expiry.
async function refreshIfExpired(row: SalesforceIntegrationRow): Promise<SalesforceIntegrationRow> {
  if (!row.expires_at) return row;
  if (new Date(row.expires_at).getTime() - Date.now() > 60_000) return row;
  if (!row.refresh_token) return row;

  const clientId = process.env["SALESFORCE_CLIENT_ID"];
  const clientSecret = process.env["SALESFORCE_CLIENT_SECRET"];
  if (!clientId || !clientSecret) return row;

  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: row.refresh_token,
  });
  const res = await fetch(`${loginHost(isSandboxRow(row))}/services/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!res.ok) return row;
  const data = (await res.json()) as {
    access_token: string;
    instance_url?: string;
    issued_at?: string;
  };
  // Salesforce ne fournit pas expires_in sur refresh : on prend une fenêtre
  // raisonnable (2h) avant le prochain refresh préventif.
  const newExpiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  const newSettings = {
    ...row.settings,
    instanceUrl: data.instance_url || row.settings?.instanceUrl,
  };
  await supabaseAdmin
    .from("integrations")
    .update({
      access_token: data.access_token,
      expires_at: newExpiresAt,
      settings: newSettings,
    })
    .eq("id", row.id);
  return { ...row, access_token: data.access_token, expires_at: newExpiresAt, settings: newSettings };
}

export async function exchangeSalesforceCode(
  code: string,
  redirectUri: string,
  isSandbox: boolean,
): Promise<{
  accessToken: string;
  refreshToken: string;
  instanceUrl: string;
  expiresAt: string;
} | null> {
  const clientId = process.env["SALESFORCE_CLIENT_ID"];
  const clientSecret = process.env["SALESFORCE_CLIENT_SECRET"];
  if (!clientId || !clientSecret) return null;
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
  });
  const res = await fetch(`${loginHost(isSandbox)}/services/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    instance_url: string;
    issued_at: string;
  };
  // 2h de fenêtre par défaut (Salesforce config session-dependant). Le
  // refresh préventif via refreshIfExpired prendra le relais.
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    instanceUrl: data.instance_url,
    expiresAt,
  };
}

type SfResult<T = void> = { ok: true; data?: T } | { ok: false; error: string; status?: number };

async function authorizedFetch(
  userId: string,
  path: string,
  init: RequestInit,
): Promise<SfResult<unknown>> {
  let row = await getIntegration(userId);
  if (!row) return { ok: false, error: "not connected" };
  row = await refreshIfExpired(row);
  try {
    const res = await fetch(`${instanceUrl(row)}${path}`, {
      ...init,
      headers: {
        ...(init.headers || {}),
        Authorization: `Bearer ${row.access_token}`,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return { ok: false, error: `Salesforce API ${res.status}: ${txt.slice(0, 200)}`, status: res.status };
    }
    if (res.status === 204) return { ok: true };
    const text = await res.text();
    if (!text) return { ok: true };
    try {
      return { ok: true, data: JSON.parse(text) };
    } catch {
      return { ok: true, data: text };
    }
  } catch (err) {
    return { ok: false, error: (err as Error).message || "network error" };
  }
}

function soqlEscape(s: string): string {
  // Échappement minimal pour valeurs string SOQL : apostrophe + backslash.
  // Indispensable car Salesforce concatène la query sans paramètres typés.
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function soqlQuery<T = Record<string, unknown>>(
  userId: string,
  soql: string,
): Promise<SfResult<{ records: T[] }>> {
  const r = await authorizedFetch(
    userId,
    `/services/data/${SALESFORCE_API_VERSION}/query?q=${encodeURIComponent(soql)}`,
    { method: "GET" },
  );
  if (!r.ok) return r;
  const data = r.data as { records?: T[] } | undefined;
  return { ok: true, data: { records: data?.records || [] } };
}

// ============================================================================
// Sync : Contacts + Opportunities.
// On stocke contact_external_id = ContactId via OpportunityContactRoles
// (subquery). Si l'opportunity n'a aucun contact role, on tombe en fallback
// sur AccountId (nul si standalone).
// ============================================================================

export async function syncSalesforceContacts(
  userId: string,
  limit = 100,
): Promise<{ synced: number; error?: string }> {
  const safeLimit = Math.max(1, Math.min(2000, limit));
  const soql =
    `SELECT Id, FirstName, LastName, Email, Phone, Title, Description, AccountId, Account.Name, ` +
    `OwnerId, Owner.Name, LeadSource, LastModifiedDate FROM Contact ` +
    `WHERE Email != null ORDER BY LastModifiedDate DESC LIMIT ${safeLimit}`;
  const r = await soqlQuery<Record<string, any>>(userId, soql);
  if (!r.ok) return { synced: 0, error: r.error };
  const records = r.data?.records || [];
  for (const c of records) {
    await supabaseAdmin.from("crm_contacts").upsert(
      {
        user_id: userId,
        provider: "salesforce",
        external_id: String(c.Id),
        email: c.Email || null,
        first_name: c.FirstName || null,
        last_name: c.LastName || null,
        company: c.Account?.Name || null,
        phone: c.Phone || null,
        raw: c,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,provider,external_id" },
    );
  }
  await supabaseAdmin
    .from("integrations")
    .update({ last_synced_at: new Date().toISOString(), last_error: null })
    .eq("user_id", userId)
    .eq("provider", "salesforce");
  return { synced: records.length };
}

export async function syncSalesforceDeals(
  userId: string,
  limit = 100,
): Promise<{ synced: number; error?: string }> {
  const safeLimit = Math.max(1, Math.min(2000, limit));
  // OpportunityContactRoles est une subquery : on récupère l'éventuel primary
  // pour stocker contact_external_id. Si aucun role, contact_external_id = null
  // (le deal sera quand même cherchable via AccountId côté getContactContext).
  // CurrencyIsoCode n'existe que sur les orgs multi-currency. On tente avec,
  // et si Salesforce répond INVALID_FIELD on retombe sur la query sans devise
  // (la valeur stockée sera alors null — graceful fallback).
  const soqlBase = (withCurrency: boolean) =>
    `SELECT Id, Name, Amount,${withCurrency ? " CurrencyIsoCode," : ""} StageName, CloseDate, AccountId, IsClosed, IsWon, ` +
    `(SELECT ContactId, IsPrimary FROM OpportunityContactRoles) ` +
    `FROM Opportunity ORDER BY LastModifiedDate DESC LIMIT ${safeLimit}`;
  let r = await soqlQuery<Record<string, any>>(userId, soqlBase(true));
  if (!r.ok && /INVALID_FIELD/i.test(r.error || "") && /CurrencyIsoCode/i.test(r.error || "")) {
    r = await soqlQuery<Record<string, any>>(userId, soqlBase(false));
  }
  if (!r.ok) return { synced: 0, error: r.error };
  const records = r.data?.records || [];
  for (const o of records) {
    const roles = (o.OpportunityContactRoles?.records || []) as Array<{ ContactId: string; IsPrimary: boolean }>;
    const primary = roles.find((r) => r.IsPrimary) || roles[0];
    await supabaseAdmin.from("crm_deals").upsert(
      {
        user_id: userId,
        provider: "salesforce",
        external_id: String(o.Id),
        title: o.Name || null,
        amount: o.Amount != null ? Number(o.Amount) : null,
        currency: (o.CurrencyIsoCode as string | null) || null,
        stage: o.StageName || null,
        status: o.IsClosed ? (o.IsWon ? "won" : "lost") : "open",
        contact_external_id: primary?.ContactId ? String(primary.ContactId) : null,
        raw: o,
        last_synced_at: new Date().toISOString(),
      },
      { onConflict: "user_id,provider,external_id" },
    );
  }
  return { synced: records.length };
}

// ============================================================================
// Cockpit panel : pipelines, contact-context, actions (log/create/patch).
// ============================================================================

// Salesforce n'a pas de notion native de "pipelines" multiples. La phase
// d'une Opportunity = picklist `StageName` global (sauf RecordType custom).
// On expose donc un seul "pipeline virtuel" listant les valeurs StageName
// actives, ce qui suffit pour les dropdowns du panneau.
export async function getSalesforcePipelines(
  userId: string,
): Promise<SfResult<{ pipelines: Array<{ id: string; label: string; stages: Array<{ id: string; label: string; displayOrder: number }> }> }>> {
  const r = await authorizedFetch(
    userId,
    `/services/data/${SALESFORCE_API_VERSION}/sobjects/Opportunity/describe`,
    { method: "GET" },
  );
  if (!r.ok) return r;
  const desc = r.data as { fields?: Array<{ name: string; picklistValues?: Array<{ value: string; label: string; active: boolean }> }> } | undefined;
  const stageField = desc?.fields?.find((f) => f.name === "StageName");
  const values = (stageField?.picklistValues || []).filter((v) => v.active !== false);
  const stages = values.map((v, idx) => ({ id: v.value, label: v.label || v.value, displayOrder: idx }));
  return {
    ok: true,
    data: {
      pipelines: [
        { id: "opportunity", label: "Opportunity", stages },
      ],
    },
  };
}

export async function getSalesforceContactContext(
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
    description: string | null;
    leadSource: string | null;
    ownerId: string | null;
    ownerName: string | null;
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
  tasks: Array<{
    id: string;
    subject: string | null;
    status: string | null;
    activityDate: string | null;
    isClosed: boolean;
    createdDate: string | null;
  }>;
} | null> {
  const { data: contactData } = await supabaseAdmin
    .from("crm_contacts")
    .select("external_id, email, first_name, last_name, company, phone, raw, last_synced_at")
    .eq("user_id", userId)
    .eq("provider", "salesforce")
    .ilike("email", email)
    .maybeSingle();
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

  // Deals liés : on requête en live via OpportunityContactRole pour capturer
  // les Opps non encore synchronisées (la sync est best-effort).
  let deals: Array<{
    externalId: string;
    title: string | null;
    amount: number | null;
    currency: string | null;
    stage: string | null;
    status: string | null;
    closeDate: string | null;
  }> = [];
  try {
    // Idem syncSalesforceDeals : tentative avec CurrencyIsoCode, fallback sans
    // si l'org n'a pas l'option multi-currency activée.
    const dealSoqlBase = (withCurrency: boolean) =>
      `SELECT Id, Name, Amount,${withCurrency ? " CurrencyIsoCode," : ""} StageName, CloseDate, IsClosed, IsWon FROM Opportunity ` +
      `WHERE Id IN (SELECT OpportunityId FROM OpportunityContactRole WHERE ContactId = '${soqlEscape(contact.external_id)}') ` +
      `ORDER BY LastModifiedDate DESC LIMIT 10`;
    let dealsRes = await soqlQuery<Record<string, any>>(userId, dealSoqlBase(true));
    if (!dealsRes.ok && /INVALID_FIELD/i.test(dealsRes.error || "") && /CurrencyIsoCode/i.test(dealsRes.error || "")) {
      dealsRes = await soqlQuery<Record<string, any>>(userId, dealSoqlBase(false));
    }
    if (dealsRes.ok) {
      deals = (dealsRes.data?.records || []).map((o) => ({
        externalId: String(o.Id),
        title: o.Name || null,
        amount: o.Amount != null ? Number(o.Amount) : null,
        currency: (o.CurrencyIsoCode as string | null) || null,
        stage: o.StageName || null,
        status: o.IsClosed ? (o.IsWon ? "won" : "lost") : "open",
        closeDate: o.CloseDate || null,
      }));
    }
  } catch {
    deals = [];
  }

  // Activités récentes : 5 dernières Task liées au contact.
  let tasks: Array<{
    id: string;
    subject: string | null;
    status: string | null;
    activityDate: string | null;
    isClosed: boolean;
    createdDate: string | null;
  }> = [];
  try {
    const taskSoql =
      `SELECT Id, Subject, Status, ActivityDate, IsClosed, CreatedDate FROM Task ` +
      `WHERE WhoId = '${soqlEscape(contact.external_id)}' ` +
      `ORDER BY CreatedDate DESC LIMIT 5`;
    const tasksRes = await soqlQuery<Record<string, any>>(userId, taskSoql);
    if (tasksRes.ok) {
      tasks = (tasksRes.data?.records || []).map((tk) => ({
        id: String(tk.Id),
        subject: tk.Subject || null,
        status: tk.Status || null,
        activityDate: tk.ActivityDate || null,
        isClosed: tk.IsClosed === true,
        createdDate: tk.CreatedDate || null,
      }));
    }
  } catch {
    tasks = [];
  }

  return {
    contact: {
      externalId: contact.external_id,
      email: contact.email,
      firstName: contact.first_name,
      lastName: contact.last_name,
      company: contact.company,
      phone: contact.phone,
      jobTitle: (raw["Title"] as string | null) || null,
      description: (raw["Description"] as string | null) || null,
      leadSource: (raw["LeadSource"] as string | null) || null,
      ownerId: (raw["OwnerId"] as string | null) || null,
      ownerName: ((raw["Owner"] as { Name?: string } | null)?.Name) || null,
      lastSyncedAt: contact.last_synced_at,
    },
    deals,
    tasks,
  };
}

// Salesforce n'a pas d'objet "EmailMessage Engagement" simple à créer en
// REST sans envoyer un vrai email. La convention adoptée : créer une Task
// Type='Email' Status='Completed' WhoId=ContactId, qui apparaît bien dans
// l'historique Activity du contact côté Salesforce UI.
export async function logEmailEngagementSalesforce(
  userId: string,
  contactId: string,
  subject: string,
  bodyText: string,
  occurredAt: string | null,
): Promise<SfResult<{ id?: string }>> {
  const ts = occurredAt ? new Date(occurredAt) : new Date();
  const cleanBody = bodyText.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 30000);
  const r = await authorizedFetch(
    userId,
    `/services/data/${SALESFORCE_API_VERSION}/sobjects/Task/`,
    {
      method: "POST",
      body: JSON.stringify({
        Subject: (subject || "(no subject)").slice(0, 255),
        Description: `Email enregistré depuis Inboria\nDate : ${ts.toISOString()}\n\n${cleanBody}`.slice(0, 32000),
        WhoId: contactId,
        Type: "Email",
        Status: "Completed",
        ActivityDate: ts.toISOString().slice(0, 10),
      }),
    },
  );
  if (!r.ok) return r;
  const data = r.data as { id?: string } | undefined;
  return { ok: true, data: { id: data?.id } };
}

export async function createSalesforceOpportunity(
  userId: string,
  contactId: string,
  input: {
    name: string;
    amount?: number | null;
    currency?: string | null;
    stageName?: string | null;
    closeDate?: string | null;
  },
): Promise<SfResult<{ id?: string }>> {
  // Salesforce exige Name + StageName + CloseDate sur Opportunity. On récupère
  // l'AccountId du contact (obligatoire pour rattacher l'Opp à un compte).
  const contactRes = await authorizedFetch(
    userId,
    `/services/data/${SALESFORCE_API_VERSION}/sobjects/Contact/${encodeURIComponent(contactId)}?fields=AccountId`,
    { method: "GET" },
  );
  if (!contactRes.ok) return contactRes;
  const accountId = ((contactRes.data as { AccountId?: string } | undefined)?.AccountId) || null;

  const body: Record<string, unknown> = {
    Name: input.name.slice(0, 120),
    StageName: input.stageName || "Prospecting",
    CloseDate: input.closeDate || new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10),
  };
  if (input.amount != null && Number.isFinite(input.amount)) body["Amount"] = input.amount;
  if (input.currency && /^[A-Z]{3}$/.test(input.currency)) body["CurrencyIsoCode"] = input.currency;
  if (accountId) body["AccountId"] = accountId;

  const r = await authorizedFetch(
    userId,
    `/services/data/${SALESFORCE_API_VERSION}/sobjects/Opportunity/`,
    { method: "POST", body: JSON.stringify(body) },
  );
  if (!r.ok) return r;
  const oppId = (r.data as { id?: string } | undefined)?.id;

  // Lier explicitement le contact via OpportunityContactRole (best-effort).
  if (oppId) {
    await authorizedFetch(
      userId,
      `/services/data/${SALESFORCE_API_VERSION}/sobjects/OpportunityContactRole/`,
      {
        method: "POST",
        body: JSON.stringify({ OpportunityId: oppId, ContactId: contactId, IsPrimary: true }),
      },
    ).catch(() => null);

    // Réplique dans crm_deals pour affichage immédiat.
    await supabaseAdmin.from("crm_deals").upsert(
      {
        user_id: userId,
        provider: "salesforce",
        external_id: oppId,
        contact_external_id: contactId,
        title: input.name,
        amount: input.amount ?? null,
        currency: (body["CurrencyIsoCode"] as string | undefined) || null,
        stage: (body["StageName"] as string) || null,
        status: "open",
        raw: { ...body, AccountId: accountId } as Record<string, unknown>,
        last_synced_at: new Date().toISOString(),
      },
      { onConflict: "user_id,provider,external_id" },
    );
  }
  return { ok: true, data: { id: oppId } };
}

export async function createSalesforceTask(
  userId: string,
  contactId: string,
  input: { subject: string; body?: string | null; dueAt?: string | null },
): Promise<SfResult<{ id?: string }>> {
  const body: Record<string, unknown> = {
    Subject: input.subject.slice(0, 255),
    WhoId: contactId,
    Status: "Not Started",
  };
  if (input.body) body["Description"] = String(input.body).slice(0, 32000);
  if (input.dueAt) {
    const d = new Date(input.dueAt);
    if (!isNaN(d.getTime())) body["ActivityDate"] = d.toISOString().slice(0, 10);
  }
  const r = await authorizedFetch(
    userId,
    `/services/data/${SALESFORCE_API_VERSION}/sobjects/Task/`,
    { method: "POST", body: JSON.stringify(body) },
  );
  if (!r.ok) return r;
  const data = r.data as { id?: string } | undefined;
  return { ok: true, data: { id: data?.id } };
}

export async function updateSalesforceOpportunityStage(
  userId: string,
  opportunityId: string,
  stageName: string,
): Promise<SfResult> {
  const r = await authorizedFetch(
    userId,
    `/services/data/${SALESFORCE_API_VERSION}/sobjects/Opportunity/${encodeURIComponent(opportunityId)}`,
    { method: "PATCH", body: JSON.stringify({ StageName: stageName }) },
  );
  if (!r.ok) return r;
  await supabaseAdmin
    .from("crm_deals")
    .update({ stage: stageName, last_synced_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("provider", "salesforce")
    .eq("external_id", opportunityId);
  return { ok: true };
}

// Salesforce expose Description (texte libre) sur Contact, équivalent du
// "label" Pipedrive : champ unique éditable inline depuis le panneau.
export async function updateSalesforceContact(
  userId: string,
  contactId: string,
  props: { description?: string | null },
): Promise<SfResult> {
  const body: Record<string, unknown> = {};
  if (props.description !== undefined) body["Description"] = props.description || null;
  if (Object.keys(body).length === 0) return { ok: false, error: "no properties to update" };

  const r = await authorizedFetch(
    userId,
    `/services/data/${SALESFORCE_API_VERSION}/sobjects/Contact/${encodeURIComponent(contactId)}`,
    { method: "PATCH", body: JSON.stringify(body) },
  );
  if (!r.ok) return r;

  // Met à jour le cache local.
  const { data: existing } = await supabaseAdmin
    .from("crm_contacts")
    .select("raw")
    .eq("user_id", userId)
    .eq("provider", "salesforce")
    .eq("external_id", contactId)
    .maybeSingle();
  const currentRaw = ((existing as { raw?: Record<string, unknown> | null } | null)?.raw) || {};
  const newRaw: Record<string, unknown> = { ...currentRaw };
  if (props.description !== undefined) newRaw["Description"] = props.description || null;
  await supabaseAdmin
    .from("crm_contacts")
    .update({ raw: newRaw, last_synced_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("provider", "salesforce")
    .eq("external_id", contactId);
  return { ok: true };
}
