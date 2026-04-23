import { supabaseAdmin } from "./supabase";

let cachedHasJunkColumns: boolean | null = null;
let probeInFlight: Promise<boolean> | null = null;

export async function hasJunkColumns(): Promise<boolean> {
  if (cachedHasJunkColumns !== null) return cachedHasJunkColumns;
  if (probeInFlight) return probeInFlight;

  probeInFlight = (async () => {
    try {
      const { error } = await supabaseAdmin
        .from("emails")
        .select("spam_source, provider_message_id")
        .limit(1);
      cachedHasJunkColumns = !error;
    } catch {
      cachedHasJunkColumns = false;
    }
    return cachedHasJunkColumns;
  })();

  const result = await probeInFlight;
  probeInFlight = null;
  return result;
}

export function resetSchemaFlagsCache(): void {
  cachedHasJunkColumns = null;
}
