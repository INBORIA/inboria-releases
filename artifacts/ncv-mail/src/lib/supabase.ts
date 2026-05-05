import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase environment variables");
}

// Detect whether the app is running as an installed PWA (display-mode:
// standalone) so we can lengthen session lifetime on what is, by
// definition, the user's own protected device. On a regular browser
// tab we still persist the session in localStorage but the Supabase
// refresh token TTL (configured in the Supabase project) acts as the
// hard ceiling.
function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return (
      window.matchMedia?.("(display-mode: standalone)").matches === true ||
      // iOS Safari "Add to home screen"
      (window.navigator as any).standalone === true
    );
  } catch {
    return false;
  }
}

if (typeof window !== "undefined") {
  try {
    window.localStorage.setItem(
      "inboria.runtime.standalone",
      isStandalonePwa() ? "1" : "0",
    );
  } catch {
    // localStorage may be unavailable (private mode, blocked) — non-fatal.
  }
}

// Persist the auth session in localStorage in BOTH dev and production.
// Previously production used sessionStorage, which wiped the session
// every time the user closed the tab and forced a fresh login on every
// visit — defeating the purpose of an "always-on" mail app. The
// Supabase refresh-token TTL (set in the Supabase project, default 30
// days) remains the security ceiling.
const authStorage =
  typeof window !== "undefined" ? window.localStorage : undefined;

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: authStorage,
    // NOTE: we deliberately keep Supabase's default storage key
    // (`sb-<project-ref>-auth-token`) so existing dev sessions stored
    // in localStorage stay valid after this change. Production users
    // who had a session in `sessionStorage` will have to log in once
    // — there is no way to migrate cross-storage transparently.
  },
});
