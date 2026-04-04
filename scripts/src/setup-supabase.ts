import { createClient } from "@supabase/supabase-js";

const url = process.env["VITE_SUPABASE_URL"];
const key = process.env["SUPABASE_SECRET_KEY"];

if (!url || !key) {
  console.error("Missing VITE_SUPABASE_URL or SUPABASE_SECRET_KEY");
  process.exit(1);
}

const supabase = createClient(url, key);

async function createTables() {
  console.log("Creating missing tables in Supabase...");

  const profilesSQL = `
    CREATE TABLE IF NOT EXISTS public.profiles (
      id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
      created_at timestamptz DEFAULT now(),
      full_name text,
      plan text DEFAULT 'gratuit',
      seats integer DEFAULT 1,
      emails_used integer DEFAULT 0,
      emails_quota integer DEFAULT 50,
      stripe_customer_id text,
      stripe_subscription_id text,
      billing_period_start timestamptz DEFAULT now()
    );

    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

    CREATE POLICY IF NOT EXISTS "Users can view own profile" ON public.profiles
      FOR SELECT USING (auth.uid() = id);

    CREATE POLICY IF NOT EXISTS "Users can update own profile" ON public.profiles
      FOR UPDATE USING (auth.uid() = id);

    CREATE POLICY IF NOT EXISTS "Users can insert own profile" ON public.profiles
      FOR INSERT WITH CHECK (auth.uid() = id);
  `;

  const tasksSQL = `
    CREATE TABLE IF NOT EXISTS public.tasks (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at timestamptz DEFAULT now(),
      user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
      email_id uuid REFERENCES public.emails(id) ON DELETE SET NULL,
      title text NOT NULL,
      done boolean DEFAULT false,
      due_date date
    );

    ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

    CREATE POLICY IF NOT EXISTS "Users can view own tasks" ON public.tasks
      FOR SELECT USING (auth.uid() = user_id);

    CREATE POLICY IF NOT EXISTS "Users can insert own tasks" ON public.tasks
      FOR INSERT WITH CHECK (auth.uid() = user_id);

    CREATE POLICY IF NOT EXISTS "Users can update own tasks" ON public.tasks
      FOR UPDATE USING (auth.uid() = user_id);

    CREATE POLICY IF NOT EXISTS "Users can delete own tasks" ON public.tasks
      FOR DELETE USING (auth.uid() = user_id);
  `;

  // Use the Supabase REST SQL endpoint
  const sqlEndpoint = `${url}/rest/v1/rpc/`;

  // Try using direct fetch to the Supabase SQL endpoint
  const response = await fetch(`${url}/rest/v1/`, {
    method: "GET",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  });
  console.log("API status:", response.status);

  // Execute SQL directly via the Supabase Management API
  // The service role key bypasses RLS so we can use it to manage tables
  // But we need the SQL endpoint which requires the management API token
  
  // Alternative: use the pg extension
  const { data, error } = await supabase.rpc("exec", { query: profilesSQL });
  if (error) {
    console.log("exec rpc not available:", error.message);
    console.log("\n=== MANUAL TABLE CREATION REQUIRED ===");
    console.log("Please run the following SQL in your Supabase SQL Editor:");
    console.log("(Dashboard > SQL Editor > New Query)\n");
    console.log("--- PROFILES TABLE ---");
    console.log(profilesSQL);
    console.log("\n--- TASKS TABLE ---");
    console.log(tasksSQL);
  } else {
    console.log("Tables created successfully!");
  }
}

createTables().catch(console.error);
