// Purge totale du seed Richard. Reversibilite RGPD : 1 commande, idempotent.
//   pnpm exec tsx scripts/purge-richard-seed.ts

import { createClient } from "@supabase/supabase-js";

const URL = process.env.VITE_SUPABASE_URL!;
const SERVICE = process.env.SUPABASE_SECRET_KEY!;
const supa = createClient(URL, SERVICE);

const RICHARD_ID = "1d04a551-2164-412b-bed0-1b772982b62d";

async function main() {
  console.log("=== PURGE seed:richard:* ===\n");

  // 1) compte avant
  const { count: cBefore } = await supa
    .from("emails")
    .select("id", { count: "exact", head: true })
    .like("external_id", "seed:richard:%");
  console.log(`Mails seed avant : ${cBefore ?? 0}`);

  // 2) supprime mails (cascade dependante : ok, juste DELETE)
  const { error: eMail } = await supa
    .from("emails")
    .delete()
    .like("external_id", "seed:richard:%");
  if (eMail) throw new Error(`emails delete: ${eMail.message}`);

  // 3) supprime projets RM-* de Richard
  const { count: cProjBefore } = await supa
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("user_id", RICHARD_ID)
    .like("reference", "RM-%");
  console.log(`Projets RM-* avant : ${cProjBefore ?? 0}`);

  const { error: eProj } = await supa
    .from("projects")
    .delete()
    .eq("user_id", RICHARD_ID)
    .like("reference", "RM-%");
  if (eProj) throw new Error(`projects delete: ${eProj.message}`);

  // 4) verif apres
  const { count: cAfter } = await supa
    .from("emails")
    .select("id", { count: "exact", head: true })
    .like("external_id", "seed:richard:%");
  const { count: cProjAfter } = await supa
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("user_id", RICHARD_ID)
    .like("reference", "RM-%");

  console.log(`\nMails seed apres : ${cAfter ?? 0} (supprimes : ${(cBefore ?? 0) - (cAfter ?? 0)})`);
  console.log(`Projets RM-* apres : ${cProjAfter ?? 0} (supprimes : ${(cProjBefore ?? 0) - (cProjAfter ?? 0)})`);
  console.log("\nPurge OK.");
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
