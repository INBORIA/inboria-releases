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
    if (error && (error.message.includes("does not exist") || error.message.includes("schema cache"))) {
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
    if (error) {
      logger.warn({ code: error.code, msg: error.message }, "appointments table may not exist — attempting auto-create");

      const supabaseUrl = process.env["VITE_SUPABASE_URL"] || process.env["SUPABASE_URL"] || "";
      const serviceKey = process.env["SUPABASE_SECRET_KEY"] || "";
      if (supabaseUrl && serviceKey) {
        const sql = `
          CREATE TABLE IF NOT EXISTS appointments (
            id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
            user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            title text NOT NULL,
            description text,
            location text,
            start_at timestamptz NOT NULL,
            end_at timestamptz NOT NULL,
            all_day boolean DEFAULT false,
            email_id integer REFERENCES emails(id) ON DELETE SET NULL,
            project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
            reminder_minutes integer DEFAULT 30,
            confirmed boolean DEFAULT true,
            participants text,
            created_at timestamptz DEFAULT now(),
            updated_at timestamptz DEFAULT now()
          );
          ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
          DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'appointments' AND policyname = 'appointments_select_own') THEN
              CREATE POLICY "appointments_select_own" ON appointments FOR SELECT USING (user_id = auth.uid());
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'appointments' AND policyname = 'appointments_insert_own') THEN
              CREATE POLICY "appointments_insert_own" ON appointments FOR INSERT WITH CHECK (user_id = auth.uid());
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'appointments' AND policyname = 'appointments_update_own') THEN
              CREATE POLICY "appointments_update_own" ON appointments FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'appointments' AND policyname = 'appointments_delete_own') THEN
              CREATE POLICY "appointments_delete_own" ON appointments FOR DELETE USING (user_id = auth.uid());
            END IF;
          END $$;
          CREATE INDEX IF NOT EXISTS idx_appointments_user ON appointments(user_id);
          CREATE INDEX IF NOT EXISTS idx_appointments_start ON appointments(start_at);
        `;

        const resp = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": serviceKey,
            "Authorization": `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({ query: sql }),
        });

        if (resp.ok) {
          logger.info("appointments table auto-created via exec_sql RPC");
        } else {
          const sqlDirect = await fetch(`${supabaseUrl}/sql`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${serviceKey}`,
            },
            body: JSON.stringify({ query: sql }),
          });
          if (sqlDirect.ok) {
            logger.info("appointments table auto-created via /sql endpoint");
          } else {
            logger.warn("Auto-create failed — please run sql_appointments_setup.sql manually in Supabase SQL Editor");
          }
        }
      } else {
        logger.warn("appointments table not found — please create it in Supabase dashboard. See attached_assets/sql_appointments_setup.sql");
      }
    } else {
      logger.info("appointments table OK");
    }
  } catch (e: any) {
    logger.warn({ error: e.message }, "appointments table check failed (non-fatal)");
  }
}

async function ensureProfileTimezone() {
  try {
    const { data, error } = await supabaseAdmin.from("profiles").select("timezone").limit(1);
    if (error && error.message.includes("timezone")) {
      const supabaseUrl = process.env["VITE_SUPABASE_URL"] || process.env["SUPABASE_URL"] || "";
      const serviceKey = process.env["SUPABASE_SECRET_KEY"] || "";
      if (supabaseUrl && serviceKey) {
        const sql = `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'Europe/Brussels';`;
        const { error: rpcErr } = await supabaseAdmin.rpc("exec_sql", { query: sql });
        if (!rpcErr) {
          logger.info("profiles.timezone column added via RPC");
        } else {
          await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}`, "apikey": serviceKey },
            body: JSON.stringify({ query: sql }),
          });
          logger.info("profiles.timezone column add attempted");
        }
      } else {
        logger.warn("profiles.timezone column missing — run: ALTER TABLE profiles ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'Europe/Brussels';");
      }
    } else {
      logger.info("profiles.timezone column OK");
    }
  } catch (e: any) {
    logger.warn({ error: e.message }, "profiles.timezone check failed (non-fatal)");
  }
}

async function cleanupDuplicateTasks() {
  try {
    const { data: aiTasks, error: fetchErr } = await supabaseAdmin
      .from("tasks")
      .select("id, email_id, title")
      .not("email_id", "is", null)
      .order("id", { ascending: true });

    if (fetchErr) {
      logger.warn({ error: fetchErr.message }, "Failed to fetch AI tasks for dedup check");
      return;
    }

    if (!aiTasks || aiTasks.length === 0) {
      logger.info("No AI tasks to deduplicate");
      return;
    }

    const seen = new Map<string, number>();
    const toDelete: number[] = [];

    for (const task of aiTasks) {
      const key = `${task.email_id}::${task.title}`;
      if (seen.has(key)) {
        toDelete.push(task.id);
      } else {
        seen.set(key, task.id);
      }
    }

    if (toDelete.length === 0) {
      logger.info(`No duplicate tasks found (${aiTasks.length} AI tasks, all unique)`);
      return;
    }

    const batchSize = 50;
    let deleted = 0;
    for (let i = 0; i < toDelete.length; i += batchSize) {
      const batch = toDelete.slice(i, i + batchSize);
      const { error: delErr } = await supabaseAdmin
        .from("tasks")
        .delete()
        .in("id", batch);
      if (delErr) {
        logger.warn({ error: delErr.message }, "Error deleting duplicate tasks batch");
      } else {
        deleted += batch.length;
      }
    }

    logger.info(`Cleaned up ${deleted} duplicate tasks (kept ${aiTasks.length - deleted})`);
  } catch (e: any) {
    logger.warn({ error: e.message }, "Duplicate task cleanup failed (non-fatal)");
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
  ensureProfileTimezone();
  cleanupDuplicateTasks();
  startAutoSync();
});
