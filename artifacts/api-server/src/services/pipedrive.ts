import { supabaseAdmin } from "../lib/supabase";

const PIPEDRIVE_OAUTH_TOKEN_URL = "https://oauth.pipedrive.com/oauth/token";

export const PIPEDRIVE_SCOPES = ["contacts:full", "deals:full", "activities:full"];

interface PipedriveIntegrationRow {
  id: string;
  user_id: string;
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
  workspace_name: string | null;
  settings: Record<string, any>;
  enabled: boolean;
}

function apiBase(row: PipedriveIntegrationRow): string {
  // Pipedrive returns api_domain in their token response, stored in settings.apiDomain
  return row.settings?.apiDomain || "https://api.pipedrive.com";
}

async function getIntegration(userId: string): Promise<PipedriveIntegrationRow | null> {
  const { data } = await supabaseAdmin
    .from("integrations")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", "pipedrive")
    .eq("enabled", true)
    .maybeSingle();
  return (data as PipedriveIntegrationRow) || null;
}

async function refreshIfExpired(row: PipedriveIntegrationRow): Promise<PipedriveIntegrationRow> {
  if (!row.expires_at) return row;
  if (new Date(row.expires_at).getTime() - Date.now() > 60_000) return row;
  if (!row.refresh_token) return row;

  const clientId = process.env["PIPEDRIVE_CLIENT_ID"];
  const clientSecret = process.env["PIPEDRIVE_CLIENT_SECRET"];
  if (!clientId || !clientSecret) return row;

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: row.refresh_token,
  });
  const res = await fetch(PIPEDRIVE_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  if (!res.ok) return row;
  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    api_domain?: string;
  };

  const newExpiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();
  const newSettings = { ...row.settings, apiDomain: data.api_domain || row.settings?.apiDomain };
  await supabaseAdmin
    .from("integrations")
    .update({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: newExpiresAt,
      settings: newSettings,
    })
    .eq("id", row.id);

  return { ...row, access_token: data.access_token, refresh_token: data.refresh_token, expires_at: newExpiresAt, settings: newSettings };
}

export async function exchangePipedriveCode(
  code: string,
  redirectUri: string,
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number; apiDomain: string } | null> {
  const clientId = process.env["PIPEDRIVE_CLIENT_ID"];
  const clientSecret = process.env["PIPEDRIVE_CLIENT_SECRET"];
  if (!clientId || !clientSecret) return null;

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });
  const res = await fetch(PIPEDRIVE_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    api_domain: string;
  };
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    apiDomain: data.api_domain,
  };
}

export async function syncPipedriveContacts(userId: string, limit = 100): Promise<{ synced: number; error?: string }> {
  let row = await getIntegration(userId);
  if (!row) return { synced: 0, error: "not connected" };
  row = await refreshIfExpired(row);

  try {
    const res = await fetch(`${apiBase(row)}/api/v1/persons?limit=${limit}`, {
      headers: { Authorization: `Bearer ${row.access_token}` },
    });
    if (!res.ok) return { synced: 0, error: `Pipedrive API ${res.status}` };
    const data = (await res.json()) as { data?: Array<any> };
    const results = data.data || [];

    for (const p of results) {
      const email = Array.isArray(p.email) ? p.email[0]?.value : p.email;
      const phone = Array.isArray(p.phone) ? p.phone[0]?.value : p.phone;
      await supabaseAdmin.from("crm_contacts").upsert(
        {
          user_id: userId,
          provider: "pipedrive",
          external_id: String(p.id),
          email: email || null,
          first_name: p.first_name || null,
          last_name: p.last_name || null,
          company: p.org_name || null,
          phone: phone || null,
          raw: p,
          last_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,provider,external_id" },
      );
    }

    await supabaseAdmin
      .from("integrations")
      .update({ last_synced_at: new Date().toISOString(), last_error: null })
      .eq("id", row.id);
    return { synced: results.length };
  } catch (err: any) {
    return { synced: 0, error: err?.message };
  }
}

export async function syncPipedriveDeals(userId: string, limit = 100): Promise<{ synced: number; error?: string }> {
  let row = await getIntegration(userId);
  if (!row) return { synced: 0, error: "not connected" };
  row = await refreshIfExpired(row);

  try {
    const res = await fetch(`${apiBase(row)}/api/v1/deals?limit=${limit}`, {
      headers: { Authorization: `Bearer ${row.access_token}` },
    });
    if (!res.ok) return { synced: 0, error: `Pipedrive API ${res.status}` };
    const data = (await res.json()) as { data?: Array<any> };
    const results = data.data || [];

    for (const d of results) {
      await supabaseAdmin.from("crm_deals").upsert(
        {
          user_id: userId,
          provider: "pipedrive",
          external_id: String(d.id),
          title: d.title || null,
          amount: d.value ? Number(d.value) : null,
          currency: d.currency || null,
          stage: d.stage_id ? String(d.stage_id) : null,
          status: d.status || null,
          contact_external_id: d.person_id?.value ? String(d.person_id.value) : null,
          raw: d,
          last_synced_at: new Date().toISOString(),
        },
        { onConflict: "user_id,provider,external_id" },
      );
    }
    return { synced: results.length };
  } catch (err: any) {
    return { synced: 0, error: err?.message };
  }
}

export async function findPipedrivePersonIdByEmail(userId: string, email: string): Promise<number | null> {
  let row = await getIntegration(userId);
  if (!row) return null;
  row = await refreshIfExpired(row);

  const { data: cached } = await supabaseAdmin
    .from("crm_contacts")
    .select("external_id")
    .eq("user_id", userId)
    .eq("provider", "pipedrive")
    .ilike("email", email)
    .maybeSingle();
  if (cached?.external_id) return Number(cached.external_id);

  try {
    const res = await fetch(
      `${apiBase(row)}/api/v1/persons/search?term=${encodeURIComponent(email)}&fields=email&limit=1`,
      { headers: { Authorization: `Bearer ${row.access_token}` } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { data?: { items?: Array<{ item: { id: number } }> } };
    return data.data?.items?.[0]?.item?.id || null;
  } catch {
    return null;
  }
}

export async function createPipedriveActivity(
  userId: string,
  personId: number,
  subject: string,
  note: string,
): Promise<{ ok: boolean; id?: number; error?: string }> {
  let row = await getIntegration(userId);
  if (!row) return { ok: false, error: "not connected" };
  row = await refreshIfExpired(row);

  try {
    const res = await fetch(`${apiBase(row)}/api/v1/activities`, {
      method: "POST",
      headers: { Authorization: `Bearer ${row.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        subject,
        type: "email",
        person_id: personId,
        note,
        done: 1,
      }),
    });
    if (!res.ok) return { ok: false, error: `Pipedrive API ${res.status}` };
    const data = (await res.json()) as { data?: { id: number } };
    return { ok: true, id: data.data?.id };
  } catch (err: any) {
    return { ok: false, error: err?.message };
  }
}

export async function logEmailToPipedrive(
  userId: string,
  emailId: number,
  contactEmail: string,
  subject: string,
  body: string,
): Promise<void> {
  try {
    const { data: existing } = await supabaseAdmin
      .from("crm_email_logs")
      .select("id")
      .eq("user_id", userId)
      .eq("provider", "pipedrive")
      .eq("email_id", emailId)
      .maybeSingle();
    if (existing) return;

    const personId = await findPipedrivePersonIdByEmail(userId, contactEmail);
    if (!personId) return;

    const result = await createPipedriveActivity(userId, personId, subject, body.slice(0, 8000));
    await supabaseAdmin.from("crm_email_logs").insert({
      user_id: userId,
      provider: "pipedrive",
      email_id: emailId,
      external_log_id: result.id ? String(result.id) : null,
    });
  } catch (err) {
    console.error("[pipedrive] logEmailToPipedrive error:", (err as Error).message);
  }
}

// ===========================================================================
// Wave Pipedrive — Cockpit (parité HubSpot)
// Helpers explicites appelés par l'UI (boutons "Logger", "Créer affaire/tâche",
// dropdowns phase). Tous réutilisent l'access_token déjà stocké dans
// `integrations` avec refresh auto via refreshIfExpired.
// ===========================================================================

type PipedriveResult<T = void> = { ok: true; data?: T } | { ok: false; error: string; status?: number };

async function authorizedPipedriveFetch(
  userId: string,
  path: string,
  init: RequestInit,
): Promise<PipedriveResult<unknown>> {
  let row = await getIntegration(userId);
  if (!row) return { ok: false, error: "not connected" };
  row = await refreshIfExpired(row);
  try {
    const res = await fetch(`${apiBase(row)}${path}`, {
      ...init,
      headers: {
        ...(init.headers || {}),
        Authorization: `Bearer ${row.access_token}`,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return { ok: false, error: `Pipedrive API ${res.status}: ${txt.slice(0, 200)}`, status: res.status };
    }
    if (res.status === 204) return { ok: true };
    const data = await res.json().catch(() => ({}));
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: (err as Error).message || "network error" };
  }
}

// Liste les pipelines + leurs phases (pour les dropdowns "Étape" du panneau).
export async function getPipedrivePipelines(
  userId: string,
): Promise<PipedriveResult<{ pipelines: Array<{ id: string; label: string; stages: Array<{ id: string; label: string; displayOrder: number }> }> }>> {
  const pipelinesRes = await authorizedPipedriveFetch(userId, `/api/v1/pipelines`, { method: "GET" });
  if (!pipelinesRes.ok) return pipelinesRes;
  const stagesRes = await authorizedPipedriveFetch(userId, `/api/v1/stages`, { method: "GET" });
  if (!stagesRes.ok) return stagesRes;
  const pipelinesData = (pipelinesRes.data as { data?: Array<{ id: number; name: string; order_nr?: number; active?: boolean }> } | undefined)?.data || [];
  const stagesData = (stagesRes.data as { data?: Array<{ id: number; name: string; pipeline_id: number; order_nr?: number }> } | undefined)?.data || [];
  const pipelines = pipelinesData
    .filter((p) => p.active !== false)
    .sort((a, b) => (a.order_nr ?? 0) - (b.order_nr ?? 0))
    .map((p) => ({
      id: String(p.id),
      label: p.name,
      stages: stagesData
        .filter((s) => s.pipeline_id === p.id)
        .sort((a, b) => (a.order_nr ?? 0) - (b.order_nr ?? 0))
        .map((s) => ({ id: String(s.id), label: s.name, displayOrder: s.order_nr ?? 0 })),
    }));
  return { ok: true, data: { pipelines } };
}

// Construit la même forme que getHubspotContext côté Pipedrive : contact +
// affaires liées, en lisant exclusivement le cache crm_contacts/crm_deals
// (la sync upstream est déjà gérée par syncPipedriveContacts/Deals).
export async function getPipedriveContactContext(
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
    label: string | null;
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
  activities: Array<{
    id: string;
    type: string | null;
    subject: string | null;
    dueDate: string | null;
    done: boolean;
    addTime: string | null;
  }>;
} | null> {
  const { data: contactData } = await supabaseAdmin
    .from("crm_contacts")
    .select("external_id, email, first_name, last_name, company, phone, raw, last_synced_at")
    .eq("user_id", userId)
    .eq("provider", "pipedrive")
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
    raw: Record<string, unknown> | null;
    last_synced_at: string;
  };
  const raw = contact.raw || {};
  const ownerObj = (raw["owner_id"] as { id?: number | string; name?: string } | string | number | null | undefined);
  let ownerId: string | null = null;
  let ownerName: string | null = null;
  if (ownerObj && typeof ownerObj === "object") {
    ownerId = ownerObj.id != null ? String(ownerObj.id) : null;
    ownerName = ownerObj.name || null;
  } else if (ownerObj != null) {
    ownerId = String(ownerObj);
  }
  const { data: dealsData } = await supabaseAdmin
    .from("crm_deals")
    .select("external_id, title, amount, currency, stage, status, raw")
    .eq("user_id", userId)
    .eq("provider", "pipedrive")
    .eq("contact_external_id", contact.external_id);
  const deals = ((dealsData || []) as Array<{
    external_id: string;
    title: string | null;
    amount: number | null;
    currency: string | null;
    stage: string | null;
    status: string | null;
    raw: Record<string, unknown> | null;
  }>).map((d) => ({
    externalId: d.external_id,
    title: d.title,
    amount: d.amount,
    currency: d.currency,
    stage: d.stage,
    status: d.status,
    closeDate: (d.raw && (d.raw["expected_close_date"] as string | null)) || null,
  }));

  // Récupère les 5 dernières activités du contact côté Pipedrive (parité
  // avec le panneau HubSpot qui affiche aussi un historique). On préfère un
  // appel upstream live (pas de cache local) car les activités évoluent
  // souvent et le coût d'un GET supplémentaire reste marginal. Si le token
  // est invalide / réseau KO, on retombe sur une liste vide pour ne pas
  // casser l'affichage du contact.
  let activities: Array<{
    id: string;
    type: string | null;
    subject: string | null;
    dueDate: string | null;
    done: boolean;
    addTime: string | null;
  }> = [];
  try {
    const personIdNum = Number(contact.external_id);
    if (Number.isFinite(personIdNum)) {
      const actRes = await authorizedPipedriveFetch(
        userId,
        `/api/v1/persons/${personIdNum}/activities?limit=5&start=0`,
        { method: "GET" },
      );
      if (actRes.ok) {
        const rows = ((actRes.data as { data?: Array<Record<string, unknown>> } | undefined)?.data || [])
          .slice(0, 5);
        activities = rows.map((a) => ({
          id: String(a["id"] ?? ""),
          type: (a["type"] as string | null) ?? null,
          subject: (a["subject"] as string | null) ?? null,
          dueDate: (a["due_date"] as string | null) ?? null,
          done: a["done"] === true || a["done"] === 1,
          addTime: (a["add_time"] as string | null) ?? null,
        }));
      }
    }
  } catch {
    activities = [];
  }

  return {
    contact: {
      externalId: contact.external_id,
      email: contact.email,
      firstName: contact.first_name,
      lastName: contact.last_name,
      company: contact.company,
      phone: contact.phone,
      label: (raw["label"] as string | null) || null,
      ownerId,
      ownerName,
      lastSyncedAt: contact.last_synced_at,
    },
    deals,
    activities,
  };
}

// Crée une note Pipedrive reflétant un email reçu/envoyé. Pipedrive n'a pas
// de "engagement email" séparé : la convention est d'utiliser /v1/notes liée
// à person_id. Combinée avec l'idempotence crm_email_logs côté route.
export async function logEmailEngagementPipedrive(
  userId: string,
  personId: number,
  subject: string,
  bodyText: string,
  occurredAt: string | null,
): Promise<PipedriveResult<{ id?: number }>> {
  const ts = occurredAt ? new Date(occurredAt) : new Date();
  const cleanBody = bodyText.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 4000);
  const note =
    `Email enregistré depuis Inboria\n\n` +
    `Objet : ${subject || "(sans objet)"}\n` +
    `Date : ${ts.toISOString()}\n\n` +
    cleanBody;
  const result = await authorizedPipedriveFetch(userId, `/api/v1/notes`, {
    method: "POST",
    body: JSON.stringify({ content: note, person_id: personId }),
  });
  if (!result.ok) return result;
  const data = (result.data as { data?: { id: number } } | undefined)?.data;
  return { ok: true, data: { id: data?.id } };
}

export async function createPipedriveDeal(
  userId: string,
  personId: number,
  input: {
    title: string;
    value?: number | null;
    currency?: string | null;
    stageId?: string | null;
    expectedCloseDate?: string | null;
  },
): Promise<PipedriveResult<{ id?: number }>> {
  const body: Record<string, unknown> = { title: input.title, person_id: personId };
  if (input.value != null && Number.isFinite(input.value)) body["value"] = input.value;
  if (input.currency) body["currency"] = input.currency;
  if (input.stageId) {
    const n = Number(input.stageId);
    if (Number.isFinite(n)) body["stage_id"] = n;
  }
  if (input.expectedCloseDate) body["expected_close_date"] = input.expectedCloseDate;

  const result = await authorizedPipedriveFetch(userId, `/api/v1/deals`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!result.ok) return result;
  const data = (result.data as { data?: { id: number; currency?: string; stage_id?: number; status?: string } } | undefined)?.data;

  // Réplique le deal dans crm_deals pour que le panneau le voie tout de suite
  // sans attendre la prochaine sync (parité HubSpot).
  if (data?.id) {
    await supabaseAdmin.from("crm_deals").upsert(
      {
        user_id: userId,
        provider: "pipedrive",
        external_id: String(data.id),
        contact_external_id: String(personId),
        title: input.title,
        amount: input.value ?? null,
        currency: input.currency ?? data.currency ?? null,
        stage: input.stageId ?? (data.stage_id != null ? String(data.stage_id) : null),
        status: data.status ?? "open",
        raw: { ...body, expected_close_date: input.expectedCloseDate ?? null } as Record<string, unknown>,
        last_synced_at: new Date().toISOString(),
      },
      { onConflict: "user_id,provider,external_id" },
    );
  }
  return { ok: true, data: { id: data?.id } };
}

// Pipedrive ne distingue pas "task" comme un objet séparé : c'est une
// activité de type "task". On expose volontairement la même signature que
// createHubspotTask (subject/body/dueAt) pour mirror le panneau cockpit.
export async function createPipedriveTask(
  userId: string,
  personId: number,
  input: { subject: string; body?: string | null; dueAt?: string | null },
): Promise<PipedriveResult<{ id?: number }>> {
  const body: Record<string, unknown> = {
    subject: input.subject,
    type: "task",
    person_id: personId,
    done: 0,
  };
  if (input.body) body["note"] = input.body;
  if (input.dueAt) {
    const d = new Date(input.dueAt);
    if (!isNaN(d.getTime())) body["due_date"] = d.toISOString().slice(0, 10);
  }
  const result = await authorizedPipedriveFetch(userId, `/api/v1/activities`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!result.ok) return result;
  const data = (result.data as { data?: { id: number } } | undefined)?.data;
  return { ok: true, data: { id: data?.id } };
}

export async function updatePipedriveDealStage(
  userId: string,
  dealExternalId: string,
  stageId: string,
): Promise<PipedriveResult> {
  const stageNum = Number(stageId);
  if (!Number.isFinite(stageNum)) return { ok: false, error: "Invalid stage id" };
  const result = await authorizedPipedriveFetch(userId, `/api/v1/deals/${encodeURIComponent(dealExternalId)}`, {
    method: "PUT",
    body: JSON.stringify({ stage_id: stageNum }),
  });
  if (!result.ok) return result;
  await supabaseAdmin
    .from("crm_deals")
    .update({ stage: stageId, last_synced_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("provider", "pipedrive")
    .eq("external_id", dealExternalId);
  return { ok: true };
}

// Pipedrive n'a pas de "lifecyclestage"/"hs_lead_status" natifs. Le seul
// champ texte libre équivalent et largement adopté est `label` (catégorie
// libre côté Person). On expose seulement ce champ pour rester additif.
export async function updatePipedrivePerson(
  userId: string,
  personExternalId: string,
  props: { label?: string | null },
): Promise<PipedriveResult> {
  const body: Record<string, unknown> = {};
  if (props.label !== undefined) body["label"] = props.label || null;
  if (Object.keys(body).length === 0) return { ok: false, error: "no properties to update" };

  const result = await authorizedPipedriveFetch(userId, `/api/v1/persons/${encodeURIComponent(personExternalId)}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  if (!result.ok) return result;

  // Met à jour le cache local pour refléter immédiatement dans le panneau.
  const { data: existing } = await supabaseAdmin
    .from("crm_contacts")
    .select("raw")
    .eq("user_id", userId)
    .eq("provider", "pipedrive")
    .eq("external_id", personExternalId)
    .maybeSingle();
  const currentRaw = ((existing as { raw?: Record<string, unknown> | null } | null)?.raw) || {};
  const newRaw: Record<string, unknown> = { ...currentRaw };
  if (props.label !== undefined) newRaw["label"] = props.label || null;
  await supabaseAdmin
    .from("crm_contacts")
    .update({ raw: newRaw, last_synced_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("provider", "pipedrive")
    .eq("external_id", personExternalId);
  return { ok: true };
}
