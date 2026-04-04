import { createClient } from "@supabase/supabase-js";

const url = process.env["VITE_SUPABASE_URL"]!;
const key = process.env["SUPABASE_SECRET_KEY"]!;
const supabase = createClient(url, key);

async function main() {
  const { data, error } = await supabase.auth.admin.createUser({
    email: "jj.neybergh@gmail.com",
    password: "cAROLINE19820458..",
    email_confirm: true,
    user_metadata: { full_name: "JJ Neybergh" }
  });

  if (error) {
    console.log("Erreur:", error.message);
    return;
  }

  console.log("Compte cree! User ID:", data.user?.id);

  const { error: profileErr } = await supabase.from("profiles").upsert({
    id: data.user!.id,
    full_name: "JJ Neybergh",
    plan: "gratuit",
    seats: 1,
    emails_used: 0,
    emails_quota: 50,
  });

  console.log("Profil:", profileErr ? profileErr.message : "OK");
}
main();
