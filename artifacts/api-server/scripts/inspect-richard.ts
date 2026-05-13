import { createClient } from "@supabase/supabase-js";

const URL = process.env.VITE_SUPABASE_URL!;
const SERVICE = process.env.SUPABASE_SECRET_KEY!;
const supa = createClient(URL, SERVICE);

const JJ_EMAIL = "jj.neybergh@gmail.com";
const RICHARD_EMAIL = "jj.neybergh@xchangesuite.com";

async function main() {
  // 1) users
  const { data: list } = await supa.auth.admin.listUsers({ page: 1, perPage: 500 });
  const jj = list?.users.find((u) => u.email === JJ_EMAIL);
  const richard = list?.users.find((u) => u.email === RICHARD_EMAIL);
  console.log("JJ:", jj?.id, jj?.email);
  console.log("Richard:", richard?.id, richard?.email);

  if (!jj || !richard) {
    console.log("⚠ user manquant — listing first 30 emails for diagnostic");
    list?.users.slice(0, 30).forEach((u) => console.log("  ", u.email, u.id));
    return;
  }

  // 2) shared mailboxes (both users)
  const { data: smJJ } = await supa
    .from("shared_mailboxes")
    .select("*")
    .eq("user_id", jj.id);
  const { data: smR } = await supa
    .from("shared_mailboxes")
    .select("*")
    .eq("user_id", richard.id);
  console.log("\nShared mailboxes JJ:", JSON.stringify(smJJ, null, 2));
  console.log("Shared mailboxes Richard:", JSON.stringify(smR, null, 2));

  // 3) shared_mailbox_members
  const { data: members } = await supa
    .from("shared_mailbox_members")
    .select("*")
    .in("user_id", [jj.id, richard.id]);
  console.log("\nMembers (JJ or Richard):", JSON.stringify(members, null, 2));

  // 4) projects de chacun
  const { data: projJJ } = await supa
    .from("projects")
    .select("id, name, reference, status, color, created_at")
    .eq("user_id", jj.id)
    .order("created_at", { ascending: false });
  const { data: projR } = await supa
    .from("projects")
    .select("id, name, reference, status, color, created_at")
    .eq("user_id", richard.id)
    .order("created_at", { ascending: false });
  console.log("\nProjets JJ (count):", projJJ?.length);
  projJJ?.forEach((p) => console.log("  ", p.reference, "—", p.name, `(${p.status})`));
  console.log("\nProjets Richard (count):", projR?.length);
  projR?.forEach((p) => console.log("  ", p.reference, "—", p.name, `(${p.status})`));

  // 5) sample email columns
  const { data: sample } = await supa
    .from("emails")
    .select("*")
    .eq("user_id", jj.id)
    .limit(1);
  console.log("\nEmail columns:", sample?.[0] ? Object.keys(sample[0]).join(", ") : "n/a");

  // 6) categories (pour assigner les mails)
  const { data: cats } = await supa
    .from("categories")
    .select("id, name, user_id")
    .in("user_id", [jj.id, richard.id]);
  console.log("\nCategories (JJ + Richard):");
  cats?.forEach((c) => console.log("  ", c.user_id === jj.id ? "JJ" : "RC", c.id, c.name));

  // 7) profiles (admin team / role)
  const { data: prof } = await supa
    .from("profiles")
    .select("*")
    .in("id", [jj.id, richard.id]);
  console.log("\nProfiles:", JSON.stringify(prof, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
