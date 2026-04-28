import { supabaseAdmin } from "../lib/supabase";

interface Integration {
  id: string;
  user_id: string;
  provider: string;
  access_token: string;
  workspace_name: string | null;
  channel_id: string | null;
  database_id: string | null;
  enabled: boolean;
}

export async function getUserIntegrations(userId: string): Promise<Integration[]> {
  const { data } = await supabaseAdmin
    .from("integrations")
    .select("*")
    .eq("user_id", userId);

  return (data || []) as Integration[];
}
