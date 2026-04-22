#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing SUPABASE_URL / SUPABASE_SECRET_KEY env vars");
  process.exit(1);
}

const APPLY = process.argv.includes("--apply");

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function log(...a) {
  console.log("[repair-orphans]", ...a);
}

async function main() {
  log(`mode=${APPLY ? "APPLY" : "DRY-RUN"} (use --apply to write changes)`);

  const { data: orphans, error } = await supabase
    .from("shared_mailboxes")
    .select("id, organisation_id, name, email_address, created_by")
    .is("connection_id", null);

  if (error) {
    console.error("Failed to load orphan shared mailboxes:", error);
    process.exit(1);
  }

  log(`found ${orphans?.length || 0} orphan shared mailbox(es)`);
  if (!orphans || orphans.length === 0) return;

  let fixed = 0;
  let unresolved = 0;
  let ambiguous = 0;

  for (const mb of orphans) {
    const email = (mb.email_address || "").toLowerCase().trim();
    if (!email) {
      log(`SKIP id=${mb.id} (no email_address)`);
      unresolved++;
      continue;
    }

    const { data: members } = await supabase
      .from("organisation_members")
      .select("user_id")
      .eq("organisation_id", mb.organisation_id)
      .eq("status", "active");

    const memberIds = (members || []).map((m) => m.user_id).filter(Boolean);
    if (memberIds.length === 0) {
      log(`UNRESOLVED id=${mb.id} email=${email} — no active members in org ${mb.organisation_id}`);
      unresolved++;
      continue;
    }

    const { data: candidates } = await supabase
      .from("email_connections")
      .select("id, user_id, email_address, provider")
      .ilike("email_address", email)
      .in("user_id", memberIds);

    if (!candidates || candidates.length === 0) {
      log(`UNRESOLVED id=${mb.id} email=${email} — no matching connection in org`);
      unresolved++;
      continue;
    }

    if (candidates.length > 1) {
      log(`AMBIGUOUS id=${mb.id} email=${email} — ${candidates.length} candidates: ${candidates.map((c) => `${c.user_id}/${c.provider}`).join(", ")}`);
      ambiguous++;
      continue;
    }

    const cand = candidates[0];
    log(`MATCH id=${mb.id} email=${email} -> connection_id=${cand.id} user=${cand.user_id} provider=${cand.provider}`);

    if (APPLY) {
      const { error: updErr } = await supabase
        .from("shared_mailboxes")
        .update({ connection_id: cand.id })
        .eq("id", mb.id);
      if (updErr) {
        log(`  FAILED to update: ${updErr.message}`);
        unresolved++;
        continue;
      }

      const { data: bf, error: bfErr } = await supabase
        .from("emails")
        .update({ shared_mailbox_id: mb.id })
        .eq("user_id", cand.user_id)
        .like("external_id", `${cand.id}:%`)
        .is("shared_mailbox_id", null)
        .select("id");
      if (bfErr) {
        log(`  backfill warning: ${bfErr.message}`);
      } else {
        log(`  backfilled ${bf?.length || 0} email(s)`);
      }
      fixed++;
    } else {
      fixed++;
    }
  }

  log(`done — ${APPLY ? "fixed" : "would fix"}=${fixed}, unresolved=${unresolved}, ambiguous=${ambiguous}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
