import app from "./app";
import { logger } from "./lib/logger";
import { startAutoSync, NOISE_SENDER_REGEX, NOISE_SUBJECT_REGEX } from "./services/auto-sync";
import { startScheduledSendWorker } from "./services/scheduled-send-worker";
import { startSnoozeWakeWorker } from "./services/snooze-wake-worker";
import { startCrmSyncScheduler } from "./services/crm-sync-scheduler";
import { supabaseAdmin } from "./lib/supabase";
import { getEmailOAuthRedirectUri } from "./lib/urls";
import { startSlaWorker } from "./services/sla";
import { startWebhookDispatcher } from "./services/webhooks";

async function ensureEmailsUniqueIndex() {
  try {
    const { data, error } = await supabaseAdmin
      .rpc("exec_sql" as any, {
        query: `SELECT 1 AS ok FROM pg_indexes WHERE tablename = 'emails' AND indexname = 'emails_user_external_id_uniq' LIMIT 1;`,
      });
    if (error) {
      logger.warn({ error: error.message }, "[health] could not verify emails unique index via RPC — please confirm manually that index 'emails_user_external_id_uniq' exists on emails(user_id, external_id) WHERE external_id IS NOT NULL");
      return;
    }
    const present = Array.isArray(data) ? data.length > 0 : !!data;
    if (present) {
      logger.info("[health] emails unique index OK (emails_user_external_id_uniq)");
    } else {
      logger.error("[health] CRITICAL: missing unique index 'emails_user_external_id_uniq' on emails(user_id, external_id). Duplicates can be inserted! Run: CREATE UNIQUE INDEX IF NOT EXISTS emails_user_external_id_uniq ON emails (user_id, external_id) WHERE external_id IS NOT NULL;");
    }
  } catch (e: any) {
    logger.warn({ error: e.message }, "[health] emails unique index check failed (non-fatal)");
  }
}

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

async function ensureEmailConnectionSignature() {
  try {
    const { data, error } = await supabaseAdmin.from("email_connections").select("signature").limit(1);
    if (error && error.message.toLowerCase().includes("signature")) {
      const supabaseUrl = process.env["VITE_SUPABASE_URL"] || process.env["SUPABASE_URL"] || "";
      const serviceKey = process.env["SUPABASE_SECRET_KEY"] || "";
      const sql = `ALTER TABLE email_connections ADD COLUMN IF NOT EXISTS signature text;`;
      if (supabaseUrl && serviceKey) {
        const { error: rpcErr } = await supabaseAdmin.rpc("exec_sql", { query: sql });
        if (!rpcErr) {
          logger.info("email_connections.signature column added via RPC");
        } else {
          await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}`, "apikey": serviceKey },
            body: JSON.stringify({ query: sql }),
          });
          logger.info("email_connections.signature column add attempted via REST");
        }
      } else {
        logger.warn("email_connections.signature column missing — run: ALTER TABLE email_connections ADD COLUMN IF NOT EXISTS signature text;");
      }
    } else {
      logger.info("email_connections.signature column OK");
      void data;
    }
  } catch (e: any) {
    logger.warn({ error: e.message }, "email_connections.signature check failed (non-fatal)");
  }
}

async function ensureWaveOneSchema() {
  try {
    const sql = `
      ALTER TABLE emails ADD COLUMN IF NOT EXISTS snoozed_until timestamptz;
      ALTER TABLE emails ADD COLUMN IF NOT EXISTS scheduled_send_at timestamptz;
      ALTER TABLE emails ADD COLUMN IF NOT EXISTS sent_at timestamptz;
      ALTER TABLE emails ADD COLUMN IF NOT EXISTS opened_at timestamptz;
      ALTER TABLE emails ADD COLUMN IF NOT EXISTS opened_count integer DEFAULT 0;
      ALTER TABLE emails ADD COLUMN IF NOT EXISTS tracking_pixel_id text;
      ALTER TABLE emails ADD COLUMN IF NOT EXISTS scheduled_send_error text;
      ALTER TABLE emails ADD COLUMN IF NOT EXISTS scheduled_connection_id uuid;
      ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tracking_enabled boolean DEFAULT false;
      CREATE INDEX IF NOT EXISTS idx_emails_snoozed_until ON emails(snoozed_until) WHERE snoozed_until IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_emails_scheduled_send_at ON emails(scheduled_send_at) WHERE scheduled_send_at IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_emails_tracking_pixel_id ON emails(tracking_pixel_id) WHERE tracking_pixel_id IS NOT NULL;
    `;
    const supabaseUrl = process.env["VITE_SUPABASE_URL"] || process.env["SUPABASE_URL"] || "";
    const serviceKey = process.env["SUPABASE_SECRET_KEY"] || "";
    const { error: rpcErr } = await supabaseAdmin.rpc("exec_sql" as any, { query: sql });
    if (!rpcErr) {
      logger.info("[wave1] schema columns/indexes ensured (snooze, schedule, tracking)");
      return;
    }
    if (supabaseUrl && serviceKey) {
      const resp = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` },
        body: JSON.stringify({ query: sql }),
      });
      if (resp.ok) {
        logger.info("[wave1] schema columns/indexes ensured via REST fallback");
        return;
      }
    }
    logger.warn({ error: rpcErr.message }, "[wave1] schema migration failed — features may be degraded; run the ALTER statements manually in Supabase");
  } catch (e: any) {
    logger.warn({ error: e.message }, "[wave1] schema check failed (non-fatal)");
  }
}

async function ensureTaskAssignment() {
  try {
    const { error } = await supabaseAdmin.from("tasks").select("assigned_to_user_id").limit(1);
    if (error && error.message.toLowerCase().includes("assigned_to_user_id")) {
      const supabaseUrl = process.env["VITE_SUPABASE_URL"] || process.env["SUPABASE_URL"] || "";
      const serviceKey = process.env["SUPABASE_SECRET_KEY"] || "";
      const sql = `
        ALTER TABLE public.tasks
          ADD COLUMN IF NOT EXISTS assigned_to_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
          ADD COLUMN IF NOT EXISTS assigned_at timestamptz,
          ADD COLUMN IF NOT EXISTS assigned_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
        CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks(assigned_to_user_id);
        CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON public.tasks(project_id);
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tasks' AND policyname = 'Assignees can view assigned tasks') THEN
            CREATE POLICY "Assignees can view assigned tasks" ON public.tasks FOR SELECT USING (auth.uid() = assigned_to_user_id);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tasks' AND policyname = 'Assignees can update assigned tasks') THEN
            CREATE POLICY "Assignees can update assigned tasks" ON public.tasks FOR UPDATE USING (auth.uid() = assigned_to_user_id);
          END IF;
        END $$;
      `;
      const { error: rpcErr } = await supabaseAdmin.rpc("exec_sql" as any, { query: sql });
      if (!rpcErr) {
        logger.info("tasks.assigned_to_user_id column + RLS added via RPC");
      } else if (supabaseUrl && serviceKey) {
        await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}`, "apikey": serviceKey },
          body: JSON.stringify({ query: sql }),
        });
        logger.info("tasks.assigned_to_user_id migration attempted via REST");
      } else {
        logger.warn("tasks.assigned_to_user_id missing — run sql_task_assignment.sql manually");
      }
    } else {
      logger.info("tasks.assigned_to_user_id column OK");
    }
  } catch (e: any) {
    logger.warn({ error: e.message }, "tasks.assigned_to_user_id check failed (non-fatal)");
  }
}

async function ensureTemplatesAndAutomationRules() {
  try {
    const { error } = await supabaseAdmin.from("email_templates").select("id").limit(1);
    if (!error) {
      logger.info("email_templates / automation_rules tables OK");
      return;
    }
    if (!error.message.includes("does not exist") && !error.message.includes("schema cache")) {
      logger.info("email_templates / automation_rules tables OK");
      return;
    }
    const supabaseUrl = process.env["VITE_SUPABASE_URL"] || process.env["SUPABASE_URL"] || "";
    const serviceKey = process.env["SUPABASE_SECRET_KEY"] || "";
    if (!supabaseUrl || !serviceKey) {
      logger.warn("email_templates table missing — please run artifacts/api-server/migrations/2026_04_24_templates_and_automation_rules.sql manually");
      return;
    }
    const sql = `
      CREATE TABLE IF NOT EXISTS public.email_templates (
        id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        name         text NOT NULL,
        subject      text NOT NULL DEFAULT '',
        body         text NOT NULL DEFAULT '',
        category_ai  text,
        variables    jsonb NOT NULL DEFAULT '[]'::jsonb,
        usage_count  integer NOT NULL DEFAULT 0,
        source_email_id integer,
        created_at   timestamptz NOT NULL DEFAULT now(),
        updated_at   timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS email_templates_user_id_idx ON public.email_templates (user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS email_templates_user_category_idx ON public.email_templates (user_id, category_ai);
      ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'email_templates' AND policyname = 'Users manage their templates') THEN
          CREATE POLICY "Users manage their templates" ON public.email_templates FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
        END IF;
      END $$;

      CREATE TABLE IF NOT EXISTS public.automation_rules (
        id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        connection_id   uuid REFERENCES public.email_connections(id) ON DELETE CASCADE,
        name            text NOT NULL,
        natural_language_input text,
        conditions      jsonb NOT NULL DEFAULT '{}'::jsonb,
        actions         jsonb NOT NULL DEFAULT '[]'::jsonb,
        enabled         boolean NOT NULL DEFAULT true,
        last_run_at     timestamptz,
        runs_count      integer NOT NULL DEFAULT 0,
        created_at      timestamptz NOT NULL DEFAULT now(),
        updated_at      timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS automation_rules_user_idx ON public.automation_rules (user_id, enabled);
      CREATE INDEX IF NOT EXISTS automation_rules_connection_idx ON public.automation_rules (connection_id);
      ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'automation_rules' AND policyname = 'Users manage their automation rules') THEN
          CREATE POLICY "Users manage their automation rules" ON public.automation_rules FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
        END IF;
      END $$;

      CREATE TABLE IF NOT EXISTS public.rule_executions_audit (
        id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        rule_id       uuid REFERENCES public.automation_rules(id) ON DELETE SET NULL,
        email_id      integer,
        action_type   text NOT NULL,
        action_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
        previous_state jsonb,
        rolled_back_at timestamptz,
        occurred_at   timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS rule_executions_user_idx ON public.rule_executions_audit (user_id, occurred_at DESC);
      CREATE INDEX IF NOT EXISTS rule_executions_rule_idx ON public.rule_executions_audit (rule_id);
      CREATE INDEX IF NOT EXISTS rule_executions_email_idx ON public.rule_executions_audit (email_id);
      ALTER TABLE public.rule_executions_audit ENABLE ROW LEVEL SECURITY;
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'rule_executions_audit' AND policyname = 'Users view their rule audit') THEN
          CREATE POLICY "Users view their rule audit" ON public.rule_executions_audit FOR SELECT USING (auth.uid() = user_id);
        END IF;
      END $$;
    `;
    const { error: rpcErr } = await supabaseAdmin.rpc("exec_sql" as any, { query: sql });
    if (!rpcErr) {
      logger.info("email_templates / automation_rules / rule_executions_audit tables created via RPC");
      return;
    }
    const resp = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({ query: sql }),
    });
    if (resp.ok) {
      logger.info("email_templates / automation_rules tables created via REST RPC");
    } else {
      const txt = await resp.text();
      logger.warn({ status: resp.status, body: txt.slice(0, 200) }, "email_templates table creation failed — please run artifacts/api-server/migrations/2026_04_24_templates_and_automation_rules.sql manually");
    }
  } catch (e: any) {
    logger.warn({ error: e.message }, "email_templates / automation_rules ensure failed (non-fatal)");
  }
}

async function cleanupDuplicateTasks() {
  try {
    const { data: aiTasks, error: fetchErr } = await supabaseAdmin
      .from("tasks")
      .select("id, email_id, user_id, title, done")
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

    const normTitle = (t: string) => (t || "").trim().toLowerCase().replace(/\s+/g, " ");
    const seenEmailTitle = new Map<string, number>();
    const seenUserTitle = new Map<string, number>();
    const toDelete = new Set<number>();

    for (const task of aiTasks) {
      const nt = normTitle(task.title);
      const k1 = `${task.email_id}::${nt}`;
      if (seenEmailTitle.has(k1)) {
        toDelete.add(task.id);
        continue;
      }
      seenEmailTitle.set(k1, task.id);

      if (!task.done) {
        const k2 = `${task.user_id}::${nt}`;
        if (seenUserTitle.has(k2)) {
          toDelete.add(task.id);
          continue;
        }
        seenUserTitle.set(k2, task.id);
      }
    }

    if (toDelete.size === 0) {
      logger.info(`No duplicate tasks found (${aiTasks.length} AI tasks, all unique)`);
      return;
    }

    const ids = Array.from(toDelete);
    const batchSize = 50;
    let deleted = 0;
    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
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

async function purgeNoiseTasks() {
  try {
    const NOISE_TITLE_PATTERNS = [
      "%confirm%sign%up%",
      "%sign%up%confirm%",
      "%verify%email%",
      "%email%verif%",
      "%verification%code%",
      "%code%verification%",
      "%welcome to%",
      "%confirm your email%",
      "%email confirmation%",
      "%confirmez%inscription%",
      "%v_rifi%compte%",
      "%code%v_rification%",
      "%magic link%",
      "%reset%password%",
      "%password%reset%",
      "%activate%account%",
      "%one%time%pass%",
      "%otp%code%",
    ];

    const { data: candidateTasks, error: fetchErr } = await supabaseAdmin
      .from("tasks")
      .select("id, title, email_id, emails(sender, subject)")
      .eq("done", false)
      .not("email_id", "is", null);

    if (fetchErr) {
      logger.warn({ error: fetchErr.message }, "Failed to fetch tasks for noise purge");
      return;
    }
    if (!candidateTasks || candidateTasks.length === 0) return;

    const titlePatterns = NOISE_TITLE_PATTERNS.map((p) => new RegExp(p.replace(/%/g, ".*").replace(/_/g, "."), "i"));

    const toDelete: number[] = [];
    for (const t of candidateTasks as any[]) {
      const sender = t.emails?.sender || "";
      const subject = t.emails?.subject || "";
      const titleMatchesNoise = titlePatterns.some((rx) => rx.test(t.title || ""));
      const senderIsNoise = NOISE_SENDER_REGEX.test(sender);
      const subjectIsNoise = NOISE_SUBJECT_REGEX.test(subject);
      if ((titleMatchesNoise && (senderIsNoise || subjectIsNoise)) || (senderIsNoise && subjectIsNoise)) {
        toDelete.push(t.id);
      }
    }

    if (toDelete.length === 0) {
      logger.info("No noise tasks to purge");
      return;
    }

    const batchSize = 100;
    let deleted = 0;
    for (let i = 0; i < toDelete.length; i += batchSize) {
      const batch = toDelete.slice(i, i + batchSize);
      const { error: delErr } = await supabaseAdmin.from("tasks").delete().in("id", batch);
      if (delErr) {
        logger.warn({ error: delErr.message }, "Error deleting noise tasks batch");
      } else {
        deleted += batch.length;
      }
    }
    logger.info(`Purged ${deleted} noise tasks (signup/verify/welcome from noreply senders)`);
  } catch (e: any) {
    logger.warn({ error: e.message }, "Noise task purge failed (non-fatal)");
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

process.on("uncaughtException", (err) => {
  logger.error({ err }, "uncaughtException — keeping server alive");
});
process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "unhandledRejection — keeping server alive");
});

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  logger.info({ gmailRedirectUri: getEmailOAuthRedirectUri("gmail"), outlookRedirectUri: getEmailOAuthRedirectUri("outlook") }, "[oauth] effective OAuth redirect URIs (must match Google / Microsoft consoles exactly)");

  ensureEmailsUniqueIndex();
  ensureProjectsTable();
  ensureIntegrationsTable();
  ensureOrganisationsTable();
  ensureEmailConnectionsConstraint();
  ensureEmailAttachmentsTable();
  ensureAppointmentsTable();
  ensureProfileTimezone();
  ensureEmailConnectionSignature();
  ensureTaskAssignment();
  ensureWaveOneSchema();
  ensureTemplatesAndAutomationRules();
  cleanupDuplicateTasks();
  purgeNoiseTasks();
  ensureB2bTables();
  startAutoSync();
  startScheduledSendWorker();
  startSnoozeWakeWorker();
  startSlaWorker();
  startWebhookDispatcher();
  startCrmSyncScheduler();
});

async function ensureB2bTables() {
  // Best-effort presence check for the B2B tables (sla_policies, api_keys, webhook_endpoints).
  // The actual DDL must be applied via migrations/2026_04_24_b2b_credibility.sql in Supabase.
  const tables = ["sla_policies", "sla_breaches", "api_keys", "webhook_endpoints", "webhook_deliveries"];
  for (const t of tables) {
    try {
      const { error } = await supabaseAdmin.from(t).select("id").limit(1);
      if (error && (error.message.includes("does not exist") || error.message.includes("schema cache"))) {
        logger.warn({ table: t }, "[b2b] table missing — apply migrations/2026_04_24_b2b_credibility.sql in Supabase");
      } else {
        logger.info({ table: t }, "[b2b] table OK");
      }
    } catch (e: any) {
      logger.warn({ error: e.message, table: t }, "[b2b] table check failed (non-fatal)");
    }
  }
}
