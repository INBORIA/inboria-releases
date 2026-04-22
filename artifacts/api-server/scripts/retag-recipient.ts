import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SECRET_KEY");
  process.exit(1);
}
const sb = createClient(url, key);

interface Conn {
  id: string;
  user_id: string;
  provider: string;
  email_address: string;
}

async function main() {
  const { data: conns, error: connErr } = await sb
    .from("email_connections")
    .select("id, user_id, provider, email_address");
  if (connErr) {
    console.error("connections fetch failed:", connErr.message);
    process.exit(1);
  }
  const connections = (conns || []) as Conn[];
  console.log(`fetched ${connections.length} connection(s)`);

  const byUser = new Map<string, Conn[]>();
  for (const c of connections) {
    const list = byUser.get(c.user_id) || [];
    list.push(c);
    byUser.set(c.user_id, list);
  }

  let totalUpdated = 0;
  let totalSkipped = 0;
  const skipReasons: Record<string, number> = {};

  for (const [userId, userConns] of byUser.entries()) {
    const connById = new Map<string, Conn>();
    const connByAddr = new Map<string, Conn>();
    for (const c of userConns) {
      connById.set(c.id, c);
      connByAddr.set(c.email_address.trim().toLowerCase(), c);
    }
    const gmailProviderConns = userConns.filter((c) => c.provider === "gmail");
    const outlookProviderConns = userConns.filter((c) => c.provider === "outlook");
    const gmailLikeConns = gmailProviderConns.length > 0
      ? gmailProviderConns
      : userConns.filter((c) => c.email_address.toLowerCase().endsWith("@gmail.com"));
    const outlookLikeConns = outlookProviderConns.length > 0
      ? outlookProviderConns
      : userConns.filter((c) => /(@outlook\.|@hotmail\.|@live\.)/i.test(c.email_address));

    let from = 0;
    const PAGE = 500;
    while (true) {
      const { data: emails, error: emailsErr } = await sb
        .from("emails")
        .select("id, external_id, recipient, shared_mailbox_id")
        .eq("user_id", userId)
        .or("recipient.is.null,recipient.eq.")
        .range(from, from + PAGE - 1);
      if (emailsErr) {
        console.error(`[user ${userId}] emails fetch failed:`, emailsErr.message);
        break;
      }
      if (!emails || emails.length === 0) break;

      for (const e of emails) {
        if (e.shared_mailbox_id) {
          totalSkipped++;
          skipReasons["shared"] = (skipReasons["shared"] || 0) + 1;
          continue;
        }
        const ext = String(e.external_id || "");
        let target: Conn | null = null;

        if (ext.startsWith("imap:")) {
          const rest = ext.slice("imap:".length);
          const lastColon = rest.lastIndexOf(":");
          const addr = (lastColon > 0 ? rest.slice(0, lastColon) : rest).trim().toLowerCase();
          target = connByAddr.get(addr) || null;
        } else if (ext.startsWith("gmail:") || (!ext.includes(":") && ext.length > 0)) {
          if (gmailLikeConns.length === 1) target = gmailLikeConns[0]!;
        } else if (ext.startsWith("outlook:")) {
          if (outlookLikeConns.length === 1) target = outlookLikeConns[0]!;
        } else {
          const idx = ext.indexOf(":");
          if (idx > 0) {
            const maybeId = ext.slice(0, idx);
            target = connById.get(maybeId) || null;
          }
        }

        if (!target) {
          totalSkipped++;
          const k = ext.split(":")[0] || "(no-colon)";
          skipReasons[k] = (skipReasons[k] || 0) + 1;
          continue;
        }

        const { error: updErr } = await sb
          .from("emails")
          .update({ recipient: target.email_address })
          .eq("id", e.id);
        if (updErr) {
          console.error(`update email ${e.id} failed:`, updErr.message);
          continue;
        }
        totalUpdated++;
      }

      if (emails.length < PAGE) break;
      from += PAGE;
    }
  }

  console.log(`done: updated=${totalUpdated} skipped=${totalSkipped}`);
  console.log("skip reasons:", skipReasons);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
