import { supabaseAdmin } from "./lib/supabase";
import { translateCategoryName } from "../../ncv-mail/src/lib/category-translations";

async function main() {
  const { data, error } = await supabaseAdmin
    .from("categories")
    .select("name, is_system")
    .limit(5000);
  if (error) {
    console.error("ERR", error.message);
    return;
  }
  const counts = new Map<string, { count: number; system: boolean }>();
  for (const row of data ?? []) {
    const name = (row as any).name as string;
    const sys = !!(row as any).is_system;
    const cur = counts.get(name) ?? { count: 0, system: sys };
    cur.count += 1;
    counts.set(name, cur);
  }
  const rows = [...counts.entries()].sort((a, b) => b[1].count - a[1].count);
  const unresolved: string[] = [];
  console.log("=== DISTINCT CATEGORY NAMES (name | count | system | resolves->it?) ===");
  for (const [name, info] of rows) {
    const it = translateCategoryName(name, "it");
    const resolves = it !== name;
    if (!resolves && !info.system) unresolved.push(name);
    console.log(`${JSON.stringify(name)} | ${info.count} | sys=${info.system} | it=${JSON.stringify(it)} | resolved=${resolves}`);
  }
  console.log("\n=== UNRESOLVED (non-system) count:", unresolved.length, "===");
  for (const n of unresolved) console.log(JSON.stringify(n));
}

main().then(() => process.exit(0));
