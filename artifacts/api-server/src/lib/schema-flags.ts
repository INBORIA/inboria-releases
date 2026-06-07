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

let cachedHasWaveOneColumns: boolean | null = null;
let waveOneProbeInFlight: Promise<boolean> | null = null;

export async function hasWaveOneColumns(): Promise<boolean> {
  if (cachedHasWaveOneColumns !== null) return cachedHasWaveOneColumns;
  if (waveOneProbeInFlight) return waveOneProbeInFlight;

  waveOneProbeInFlight = (async () => {
    try {
      const { error } = await supabaseAdmin
        .from("emails")
        .select("snoozed_until, scheduled_send_at, sent_at, opened_at, opened_count, tracking_pixel_id")
        .limit(1);
      cachedHasWaveOneColumns = !error;
    } catch {
      cachedHasWaveOneColumns = false;
    }
    return cachedHasWaveOneColumns;
  })();

  const result = await waveOneProbeInFlight;
  waveOneProbeInFlight = null;
  return result;
}

let cachedHasTrackingProfile: boolean | null = null;
let trackingProbeInFlight: Promise<boolean> | null = null;

export async function hasTrackingProfileColumn(): Promise<boolean> {
  if (cachedHasTrackingProfile !== null) return cachedHasTrackingProfile;
  if (trackingProbeInFlight) return trackingProbeInFlight;

  trackingProbeInFlight = (async () => {
    try {
      const { error } = await supabaseAdmin
        .from("profiles")
        .select("tracking_enabled")
        .limit(1);
      cachedHasTrackingProfile = !error;
    } catch {
      cachedHasTrackingProfile = false;
    }
    return cachedHasTrackingProfile;
  })();

  const result = await trackingProbeInFlight;
  trackingProbeInFlight = null;
  return result;
}

let cachedHasHandledColumns: boolean | null = null;
let handledProbeInFlight: Promise<boolean> | null = null;

export async function hasHandledColumns(): Promise<boolean> {
  if (cachedHasHandledColumns !== null) return cachedHasHandledColumns;
  if (handledProbeInFlight) return handledProbeInFlight;

  handledProbeInFlight = (async () => {
    try {
      const { error } = await supabaseAdmin
        .from("emails")
        .select("handled_at, handled_by")
        .limit(1);
      cachedHasHandledColumns = !error;
    } catch {
      cachedHasHandledColumns = false;
    }
    return cachedHasHandledColumns;
  })();

  const result = await handledProbeInFlight;
  handledProbeInFlight = null;
  return result;
}

let cachedHasScheduledMarkHandled: boolean | null = null;
let scheduledMarkHandledProbeInFlight: Promise<boolean> | null = null;

export async function hasScheduledMarkHandledColumn(): Promise<boolean> {
  if (cachedHasScheduledMarkHandled !== null) return cachedHasScheduledMarkHandled;
  if (scheduledMarkHandledProbeInFlight) return scheduledMarkHandledProbeInFlight;

  scheduledMarkHandledProbeInFlight = (async () => {
    try {
      const { error } = await supabaseAdmin
        .from("emails")
        .select("scheduled_mark_handled_id")
        .limit(1);
      cachedHasScheduledMarkHandled = !error;
    } catch {
      cachedHasScheduledMarkHandled = false;
    }
    return cachedHasScheduledMarkHandled;
  })();

  const result = await scheduledMarkHandledProbeInFlight;
  scheduledMarkHandledProbeInFlight = null;
  return result;
}

export function resetSchemaFlagsCache(): void {
  cachedHasJunkColumns = null;
  cachedHasWaveOneColumns = null;
  cachedHasTrackingProfile = null;
  cachedHasHandledColumns = null;
  cachedHasScheduledMarkHandled = null;
}
