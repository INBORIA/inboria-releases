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
  startAutoSync();
});
