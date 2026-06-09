import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const url = process.env.VITE_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const admin = createClient(url, secret, { auth: { persistSession: false } });
const BASE = "http://localhost:80/api/analytics/team";

// ---- 1. Apply the SQL function (best-effort; this DB has no exec_sql, so it
//         is expected to be applied manually in the Supabase SQL editor first) ----
{
  const sql = readFileSync(new URL("./migrations/2026_06_09_team_analytics_rpc.sql", import.meta.url), "utf8");
  const { error } = await admin.rpc("exec_sql", { query: sql });
  if (error) console.log("(apply skipped — exec_sql unavailable; function must already exist):", error.message);
  else console.log("✔ function applied via exec_sql");
}
// Probe that the function exists before running the diff.
{
  const { error } = await admin.rpc("inboria_team_analytics", {
    p_member_ids: [], p_mailbox_ids: [], p_since: new Date().toISOString(),
    p_member: null, p_mailbox: null, p_project: null, p_handled_enabled: true, p_days: 30,
  });
  if (error && /Could not find the function/i.test(error.message)) {
    console.error("\n✗ La fonction inboria_team_analytics n'existe pas encore en base.\n  → Collez d'abord migrations/2026_06_09_team_analytics_rpc.sql dans Supabase, puis relancez.");
    process.exit(3);
  }
  console.log("✔ function present in DB");
}

// ---- helpers ----
function canon(v) {
  if (Array.isArray(v)) {
    const arr = v.map(canon);
    arr.sort((a, b) => JSON.stringify(keyish(a)).localeCompare(JSON.stringify(keyish(b))));
    return arr;
  }
  if (v && typeof v === "object") {
    const o = {};
    for (const k of Object.keys(v).sort()) o[k] = canon(v[k]);
    return o;
  }
  return v;
}
function keyish(x) {
  if (x && typeof x === "object") {
    return x.userId ?? x.mailboxId ?? x.projectId ?? x.email ?? x.name ?? x.date ?? x;
  }
  return x;
}
function diff(a, b, path = "", out = []) {
  const sa = JSON.stringify(a), sb = JSON.stringify(b);
  if (sa === sb) return out;
  if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) diff(a[k], b[k], path ? `${path}.${k}` : k, out);
  } else if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) out.push(`${path}: len ${a.length} vs ${b.length}`);
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i++) diff(a[i], b[i], `${path}[${i}]`, out);
  } else {
    out.push(`${path}: ${sa} vs ${sb}`);
  }
  return out;
}

async function mintToken(email) {
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw new Error("generateLink: " + error.message);
  const otp = data?.properties?.email_otp;
  if (!otp) throw new Error("no email_otp");
  const anon = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data: vd, error: ve } = await anon.auth.verifyOtp({ email, token: otp, type: "email" });
  if (ve) throw new Error("verifyOtp: " + ve.message);
  return vd?.session?.access_token;
}

async function fetchTeam(token, params) {
  const qs = new URLSearchParams(params).toString();
  const r = await fetch(`${BASE}?${qs}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

// ---- 2. Find one admin/owner per org ----
const { data: adminsRows } = await admin
  .from("organisation_members")
  .select("organisation_id, user_id, role")
  .eq("status", "active")
  .in("role", ["admin", "owner"]);
const adminByOrg = new Map();
for (const r of adminsRows || []) if (!adminByOrg.has(r.organisation_id)) adminByOrg.set(r.organisation_id, r.user_id);
console.log(`orgs with admin: ${adminByOrg.size}`);

let totalRuns = 0, totalDiffs = 0;
const failed = [];

for (const [orgId, adminUserId] of adminByOrg) {
  // email of the admin
  const { data: u } = await admin.auth.admin.getUserById(adminUserId);
  const email = u?.user?.email;
  if (!email) { console.log(`org ${orgId}: admin has no email, skip`); continue; }

  let token;
  try { token = await mintToken(email); } catch (e) { console.log(`org ${orgId}: token fail ${e.message}`); continue; }
  if (!token) { console.log(`org ${orgId}: no token`); continue; }

  // sample filters
  const { data: anyMember } = await admin.from("organisation_members")
    .select("user_id").eq("organisation_id", orgId).eq("status", "active").limit(1).maybeSingle();
  const { data: anyMb } = await admin.from("shared_mailboxes")
    .select("id").eq("organisation_id", orgId).limit(1).maybeSingle();

  const runs = [
    { period: "30d" }, { period: "7d" }, { period: "90d" },
  ];
  if (anyMember?.user_id) runs.push({ period: "30d", member: anyMember.user_id });
  if (anyMb?.id) runs.push({ period: "30d", mailbox: anyMb.id });

  for (const base of runs) {
    let mem, rpc;
    try {
      mem = await fetchTeam(token, { ...base, engine: "memory" });
      rpc = await fetchTeam(token, { ...base, engine: "rpc" });
    } catch (e) {
      console.log(`org ${orgId} ${JSON.stringify(base)}: fetch err ${e.message}`);
      failed.push({ orgId, base, err: e.message });
      continue;
    }
    totalRuns++;
    const d = diff(canon(mem), canon(rpc));
    if (d.length) {
      totalDiffs++;
      console.log(`\n✗ DIFF org=${orgId} ${JSON.stringify(base)} emails=${mem?.totals?.emails}`);
      for (const line of d.slice(0, 25)) console.log("   " + line);
    }
  }
}

console.log(`\n==== runs=${totalRuns} diffs=${totalDiffs} fetchFails=${failed.length} ====`);
process.exit(totalDiffs ? 2 : 0);
