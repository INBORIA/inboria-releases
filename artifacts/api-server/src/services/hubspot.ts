import { supabaseAdmin } from "../lib/supabase";

const HUBSPOT_API = "https://api.hubapi.com";
const HUBSPOT_OAUTH_TOKEN_URL = "https://api.hubapi.com/oauth/v1/token";

export const HUBSPOT_SCOPES = [
  "crm.objects.contacts.read",
  "crm.objects.contacts.write",
  "crm.objects.deals.read",
  "crm.schemas.contacts.read",
];

interface HubspotIntegrationRow {
  id: string;
  user_id: string;
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
  enabled: boolean;
}

async function getIntegration(userId: string): Promise<HubspotIntegrationRow | null> {
  const { data } = await supabaseAdmin
    .from("integrations")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", "hubspot")
    .eq("enabled", true)
    .maybeSingle();
  return (data as HubspotIntegrationRow) || null;
}

async function refreshIfExpired(row: HubspotIntegrationRow): Promise<HubspotIntegrationRow> {
  if (!row.expires_at) return row;
  const expiresIn = new Date(row.expires_at).getTime() - Date.now();
  if (expiresIn > 60_000) return row;
  if (!row.refresh_token) return row;

  const clientId = process.env["HUBSPOT_CLIENT_ID"];
  const clientSecret = process.env["HUBSPOT_CLIENT_SECRET"];
  if (!clientId || !clientSecret) return row;

  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: row.refresh_token,
  });
  const res = await fetch(HUBSPOT_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!res.ok) return row;
  const data = (await res.json()) as { access_token: string; refresh_token: string; expires_in: number };

  const newExpiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();
  await supabaseAdmin
    .from("integrations")
    .update({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: newExpiresAt,
    })
    .eq("id", row.id);

  return { ...row, access_token: data.access_token, refresh_token: data.refresh_token, expires_at: newExpiresAt };
}

export async function exchangeHubspotCode(
  code: string,
  redirectUri: string,
): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  hubId: number | null;
} | null> {
  const clientId = process.env["HUBSPOT_CLIENT_ID"];
  const clientSecret = process.env["HUBSPOT_CLIENT_SECRET"];
  if (!clientId || !clientSecret) return null;

  const params = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code,
  });
  const res = await fetch(HUBSPOT_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { access_token: string; refresh_token: string; expires_in: number };

  // Resolve the HubSpot portal/hub identifier so inbound webhooks can be routed
  // back to the right Inboria user.
  let hubId: number | null = null;
  try {
    const introspect = await fetch(`${HUBSPOT_API}/oauth/v1/access-tokens/${data.access_token}`, {
      method: "GET",
    });
    if (introspect.ok) {
      const meta = (await introspect.json()) as { hub_id?: number };
      hubId = typeof meta.hub_id === "number" ? meta.hub_id : null;
    }
  } catch {
    // best-effort: webhook routing falls back to per-user resync if hubId is null
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    hubId,
  };
}

export async function syncHubspotContacts(userId: string, limit = 100): Promise<{ synced: number; error?: string }> {
  let row = await getIntegration(userId);
  if (!row) return { synced: 0, error: "not connected" };
  row = await refreshIfExpired(row);

  try {
    const res = await fetch(
      `${HUBSPOT_API}/crm/v3/objects/contacts?limit=${limit}&properties=email,firstname,lastname,company,phone,jobtitle,lifecyclestage,hubspot_owner_id,notes_last_contacted,hs_lead_status`,
      { headers: { Authorization: `Bearer ${row.access_token}` } },
    );
    if (!res.ok) {
      const text = await res.text();
      return { synced: 0, error: `HubSpot API ${res.status}: ${text.slice(0, 200)}` };
    }
    const data = (await res.json()) as { results?: Array<{ id: string; properties: Record<string, string> }> };
    const results = data.results || [];

    for (const c of results) {
      await supabaseAdmin
        .from("crm_contacts")
        .upsert(
          {
            user_id: userId,
            provider: "hubspot",
            external_id: c.id,
            email: c.properties.email || null,
            first_name: c.properties.firstname || null,
            last_name: c.properties.lastname || null,
            company: c.properties.company || null,
            phone: c.properties.phone || null,
            raw: c.properties as any,
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
    const message = err?.message || "unknown";
    await supabaseAdmin.from("integrations").update({ last_error: message.slice(0, 200) }).eq("id", row.id);
    return { synced: 0, error: message };
  }
}

export async function syncHubspotDeals(userId: string, limit = 100): Promise<{ synced: number; error?: string }> {
  let row = await getIntegration(userId);
  if (!row) return { synced: 0, error: "not connected" };
  row = await refreshIfExpired(row);

  try {
    const res = await fetch(
      `${HUBSPOT_API}/crm/v3/objects/deals?limit=${limit}&properties=dealname,amount,dealstage,pipeline`,
      { headers: { Authorization: `Bearer ${row.access_token}` } },
    );
    if (!res.ok) return { synced: 0, error: `HubSpot API ${res.status}` };
    const data = (await res.json()) as { results?: Array<{ id: string; properties: Record<string, string> }> };
    const results = data.results || [];

    for (const d of results) {
      await supabaseAdmin
        .from("crm_deals")
        .upsert(
          {
            user_id: userId,
            provider: "hubspot",
            external_id: d.id,
            title: d.properties.dealname || null,
            amount: d.properties.amount ? Number(d.properties.amount) : null,
            currency: null,
            stage: d.properties.dealstage || null,
            status: null,
            raw: d.properties as any,
            last_synced_at: new Date().toISOString(),
          },
          { onConflict: "user_id,provider,external_id" },
        );
    }
    return { synced: results.length };
  } catch (err: any) {
    return { synced: 0, error: err?.message || "unknown" };
  }
}

export async function findHubspotContactIdByEmail(userId: string, email: string): Promise<string | null> {
  let row = await getIntegration(userId);
  if (!row) return null;
  row = await refreshIfExpired(row);

  const { data: cached } = await supabaseAdmin
    .from("crm_contacts")
    .select("external_id")
    .eq("user_id", userId)
    .eq("provider", "hubspot")
    .ilike("email", email)
    .maybeSingle();
  if (cached?.external_id) return cached.external_id;

  try {
    const res = await fetch(`${HUBSPOT_API}/crm/v3/objects/contacts/search`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${row.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: email }] }],
        properties: ["email"],
        limit: 1,
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { results?: Array<{ id: string }> };
    return data.results?.[0]?.id || null;
  } catch {
    return null;
  }
}

export async function createHubspotNote(
  userId: string,
  contactExternalId: string,
  body: string,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  let row = await getIntegration(userId);
  if (!row) return { ok: false, error: "not connected" };
  row = await refreshIfExpired(row);

  try {
    const res = await fetch(`${HUBSPOT_API}/crm/v3/objects/notes`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${row.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        properties: {
          hs_note_body: body,
          hs_timestamp: Date.now(),
        },
        associations: [
          {
            to: { id: contactExternalId },
            types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 202 }],
          },
        ],
      }),
    });
    if (!res.ok) return { ok: false, error: `HubSpot API ${res.status}` };
    const data = (await res.json()) as { id?: string };
    return { ok: true, id: data.id };
  } catch (err: any) {
    return { ok: false, error: err?.message };
  }
}

export async function logEmailToHubspot(
  userId: string,
  emailId: number,
  contactEmail: string,
  subject: string,
  body: string,
  direction: "inbound" | "outbound",
): Promise<void> {
  try {
    const { data: existing } = await supabaseAdmin
      .from("crm_email_logs")
      .select("id")
      .eq("user_id", userId)
      .eq("provider", "hubspot")
      .eq("email_id", emailId)
      .maybeSingle();
    if (existing) return;

    const contactId = await findHubspotContactIdByEmail(userId, contactEmail);
    if (!contactId) return;

    let row = await getIntegration(userId);
    if (!row) return;
    row = await refreshIfExpired(row);

    const res = await fetch(`${HUBSPOT_API}/crm/v3/objects/emails`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${row.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        properties: {
          hs_email_subject: subject,
          hs_email_text: body.slice(0, 8000),
          hs_email_direction: direction === "inbound" ? "INCOMING_EMAIL" : "EMAIL",
          hs_timestamp: Date.now(),
        },
        associations: [
          {
            to: { id: contactId },
            types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 198 }],
          },
        ],
      }),
    });
    let externalLogId: string | null = null;
    if (res.ok) {
      const data = (await res.json()) as { id?: string };
      externalLogId = data.id || null;
    }

    await supabaseAdmin.from("crm_email_logs").insert({
      user_id: userId,
      provider: "hubspot",
      email_id: emailId,
      external_log_id: externalLogId,
    });
  } catch (err) {
    console.error("[hubspot] logEmailToHubspot error:", (err as Error).message);
  }
}
