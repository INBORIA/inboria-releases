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

async function ensureEmailAttachmentsTable() {
  try {
    const { error } = await supabaseAdmin.from("email_attachments").select("id").limit(1);
    if (error && error.message.includes("does not exist")) {
      const { error: createErr } = await supabaseAdmin.rpc("exec_sql" as any, {
        query: `
          CREATE TABLE IF NOT EXISTS email_attachments (
            id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
            email_id integer REFERENCES emails(id) ON DELETE CASCADE,
            filename text NOT NULL DEFAULT 'attachment',
            content_type text NOT NULL DEFAULT 'application/octet-stream',
            size integer DEFAULT 0,
            provider text NOT NULL DEFAULT 'gmail',
            provider_attachment_id text,
            connection_id uuid,
            message_uid text,
            created_at timestamptz DEFAULT now()
          );
          CREATE INDEX IF NOT EXISTS idx_email_attachments_email_id ON email_attachments(email_id);
          ALTER TABLE email_attachments ENABLE ROW LEVEL SECURITY;
        `
      });
      if (createErr) {
        logger.warn({ error: createErr.message }, "email_attachments table creation via RPC failed — create manually");
      } else {
        logger.info("email_attachments table created");
      }
    } else {
      logger.info("email_attachments table OK");
    }
  } catch (e: any) {
    logger.warn({ error: e.message }, "email_attachments table check failed (non-fatal)");
  }
}

async function ensureEmailConnectionsConstraint() {
  try {
    const { error } = await supabaseAdmin.rpc("exec_sql" as any, {
      query: `
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE table_name = 'email_connections'
            AND constraint_type = 'UNIQUE'
            AND constraint_name = 'email_connections_user_id_provider_key'
          ) THEN
            ALTER TABLE email_connections DROP CONSTRAINT email_connections_user_id_provider_key;
          END IF;
        END $$;
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE table_name = 'email_connections'
            AND constraint_type = 'UNIQUE'
            AND constraint_name = 'email_connections_user_id_email_address_key'
          ) THEN
            ALTER TABLE email_connections ADD CONSTRAINT email_connections_user_id_email_address_key UNIQUE (user_id, email_address);
          END IF;
        END $$;
      `
    });
    if (error) {
      logger.warn({ error: error.message }, "email_connections constraint migration via RPC failed (run sql_multi_email_connections.sql manually)");
    } else {
      logger.info("email_connections unique constraint OK (user_id, email_address)");
    }
  } catch (e: any) {
    logger.warn({ error: e.message }, "email_connections constraint check failed (non-fatal)");
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

async function ensureAppointmentsTable() {
  try {
    const { error } = await supabaseAdmin.from("appointments").select("id").limit(1);
    if (error && error.code === "42P01") {
      logger.warn("appointments table not found — please create it in Supabase dashboard. See attached_assets/sql_appointments_setup.sql");
    } else {
      logger.info("appointments table OK");
    }
  } catch (e: any) {
    logger.warn({ error: e.message }, "appointments table check failed (non-fatal)");
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
  ensureEmailConnectionsConstraint();
  ensureEmailAttachmentsTable();
  ensureAppointmentsTable();
  startAutoSync();
});
