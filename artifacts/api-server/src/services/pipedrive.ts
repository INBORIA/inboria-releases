import { supabaseAdmin } from "../lib/supabase";

const PIPEDRIVE_OAUTH_TOKEN_URL = "https://oauth.pipedrive.com/oauth/token";

export const PIPEDRIVE_SCOPES = ["contacts:full", "deals:read", "activities:full"];

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
