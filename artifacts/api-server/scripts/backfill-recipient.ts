import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("missing SUPABASE_URL or SUPABASE_SECRET_KEY");
  process.exit(1);
}

const supabaseAdmin = createClient(url, key);

async function main() {
  const { data: connections, error: connErr } = await supabaseAdmin
    .from("email_connections")
    .select("id, user_id, provider, email_address");

  if (connErr) {
    console.error("connections fetch failed:", connErr.message);
    process.exit(1);
  }
  if (!connections || connections.length === 0) {
    console.log("no connections found");
    return;
  }

  const byUser = new Map<string, Array<{ id: string; provider: string; email_address: string }>>();
  for (const c of connections) {
    const list = byUser.get(c.user_id) || [];
    list.push({ id: String(c.id), provider: String(c.provider), email_address: String(c.email_address) });
    byUser.set(c.user_id, list);
  }

  let totalUpdated = 0;
  let totalSkipped = 0;

  for (const [userId, conns] of byUser.entries()) {
    const { data: emails, error: emailsErr } = await supabaseAdmin
      .from("emails")
      .select("id, external_id, recipient, shared_mailbox_id")
      .eq("user_id", userId)
      .or("recipient.is.null,recipient.eq.");

    if (emailsErr) {
      console.error(`[user ${userId}] emails fetch failed:`, emailsErr.message);
      continue;
    }
    if (!emails || emails.length === 0) continue;

    for (const e of emails) {
      if (e.shared_mailbox_id) continue;
      const ext = String(e.external_id || "");
      let provider: string | null = null;
      let imapConnId: string | null = null;
      if (ext.startsWith("gmail:")) provider = "gmail";
      else if (ext.startsWith("outlook:")) provider = "outlook";
      else {
        const idx = ext.indexOf(":");
        if (idx > 0) imapConnId = ext.slice(0, idx);
      }

      let target: { id: string; email_address: string } | null = null;
      if (imapConnId) {
        const m = conns.find((c) => c.id === imapConnId);
        if (m) target = m;
      } else if (provider) {
        const matches = conns.filter((c) => c.provider === provider);
        if (matches.length === 1) target = matches[0]!;
      }

      if (!target) {
        totalSkipped++;
        continue;
      }

      const { error: updErr } = await supabaseAdmin
        .from("emails")
        .update({ recipient: target.email_address })
        .eq("id", e.id);
      if (updErr) {
        console.error(`update email ${e.id} failed:`, updErr.message);
        continue;
      }
      totalUpdated++;
    }
  }

  console.log(`done: updated=${totalUpdated} skipped=${totalSkipped}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
