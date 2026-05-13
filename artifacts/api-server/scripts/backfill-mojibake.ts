import { createClient } from "@supabase/supabase-js";
import { repairMojibake } from "../src/lib/text-encoding";

const supa = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
);

const MOJIBAKE_DETECT = /[\u00C0-\u00FF][\u0080-\u00BF]|[\u0080-\u009F]/;

async function main() {
  const PAGE = 500;
  let from = 0;
  let scanned = 0;
  let updated = 0;
  while (true) {
    const { data, error } = await supa
      .from("emails")
      .select("id, sender, subject, body, recipient")
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;

    for (const row of data) {
      scanned++;
      const patch: Record<string, string> = {};
      for (const f of ["sender", "subject", "body", "recipient"] as const) {
        const v = (row as any)[f];
        if (typeof v !== "string" || !v) continue;
        if (!MOJIBAKE_DETECT.test(v)) continue;
        const fixed = repairMojibake(v);
        if (fixed !== v) patch[f] = fixed;
      }
      if (Object.keys(patch).length > 0) {
        const { error: uerr } = await supa.from("emails").update(patch).eq("id", row.id);
        if (uerr) {
          console.error(`update failed id=${row.id}`, uerr.message);
        } else {
          updated++;
          if (updated <= 10 || updated % 50 === 0) {
            console.log(`fixed id=${row.id} fields=${Object.keys(patch).join(",")} subj=${JSON.stringify(((patch as any).subject || (row as any).subject || "").slice(0, 90))}`);
          }
        }
      }
    }
    if (data.length < PAGE) break;
    from += PAGE;
    process.stdout.write(`scanned=${scanned} updated=${updated}\r`);
  }
  console.log(`\nDone. scanned=${scanned} updated=${updated}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
