import app from "./app";
import { logger } from "./lib/logger";
import { startAutoSync } from "./services/auto-sync";
import { supabaseAdmin } from "./lib/supabase";

async function ensureProjectsTable() {
  try {
    const { error } = await supabaseAdmin.from("projects").select("id").limit(1);
    if (error && error.message.includes("does not exist")) {
      logger.info("projects table not found — please create it in Supabase dashboard");
    } else {
      logger.info("projects table OK");
    }
  } catch (e: any) {
    logger.warn({ error: e.message }, "projects table check failed (non-fatal)");
  }
}

async function ensureOrganisationsTable() {
  try {
    const { error } = await supabaseAdmin.from("organisations").select("id").limit(1);
    if (error && error.message.includes("does not exist")) {
      logger.warn("organisations table not found — please run the SQL script from attached_assets/sql_organisations_setup.sql in Supabase dashboard");
    } else {
      logger.info("organisations table OK");
    }
  } catch (e: any) {
    logger.warn({ error: e.message }, "organisations table check failed (non-fatal)");
  }
}

async function ensureIntegrationsTable() {
  try {
    const { error } = await supabaseAdmin.from("integrations").select("id").limit(1);
    if (error && error.message.includes("does not exist")) {
      logger.warn("integrations table not found — please create it in Supabase dashboard with: CREATE TABLE integrations (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE, provider text NOT NULL, access_token text NOT NULL, workspace_name text, channel_id text, database_id text, enabled boolean DEFAULT true, created_at timestamptz DEFAULT now(), UNIQUE(user_id, provider)); ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;");
    } else {
      logger.info("integrations table OK");
    }
  } catch (e: any) {
    logger.warn({ error: e.message }, "integrations table check failed (non-fatal)");
  }
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  ensureProjectsTable();
  ensureIntegrationsTable();
  ensureOrganisationsTable();
  startAutoSync();
});
