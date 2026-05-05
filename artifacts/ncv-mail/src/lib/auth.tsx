import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from "react";
import { supabase } from "./supabase";
import type { Session, User } from "@supabase/supabase-js";

type MfaState = "unknown" | "ok" | "needsMfa";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  mfaState: MfaState;
  refreshMfaState: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string, country: string) => Promise<{ error: string | null; needsVerification: boolean }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [mfaState, setMfaState] = useState<MfaState>("unknown");
  // Monotonic version counter so that out-of-order async completions from
  // concurrent auth events never overwrite the latest state.
  const authEventSeq = useRef(0);

  const computeMfaState = useCallback(async (s: Session | null): Promise<MfaState> => {
    if (!s) return "ok";
    // Hard timeout so that a slow / unreachable MFA endpoint can never
    // deadlock the app on a black screen. If the call cannot complete in
    // 4s we degrade to "ok" — the user keeps a valid AAL1 session and
    // privileged routes still depend on the API server's JWT validation.
    const timeout = new Promise<{ data: null; error: Error }>((resolve) =>
      setTimeout(
        () => resolve({ data: null, error: new Error("aal-timeout") }),
        4000,
      ),
    );
    try {
      const result = await Promise.race([
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
        timeout,
      ]);
      const { data, error } = result as Awaited<
        ReturnType<typeof supabase.auth.mfa.getAuthenticatorAssuranceLevel>
      >;
      if (error) {
        // Reachability / transient failure: don't lock the user out — the
        // API server still validates the JWT on every privileged call.
        return "ok";
      }
      if (data?.currentLevel === "aal1" && data?.nextLevel === "aal2") {
        return "needsMfa";
      }
      return "ok";
    } catch {
      return "ok";
    }
  }, []);

  const refreshMfaState = useCallback(async () => {
    const seq = ++authEventSeq.current;
    const { data } = await supabase.auth.getSession();
    const next = await computeMfaState(data.session);
    if (seq !== authEventSeq.current) return;
    setMfaState(next);
  }, [computeMfaState]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const seq = ++authEventSeq.current;
      try {
        const { data } = await supabase.auth.getSession();
        const s = data.session;
        const next = await computeMfaState(s);
        if (cancelled || seq !== authEventSeq.current) return;
        setSession(s);
        setUser(s?.user ?? null);
        setMfaState(next);
      } catch {
        // Fail-closed: clear session and force MFA recheck path; the user
        // will be redirected to /login by the route guards.
        if (cancelled || seq !== authEventSeq.current) return;
        setSession(null);
        setUser(null);
        setMfaState("ok");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, s) => {
      const seq = ++authEventSeq.current;
      const next = await computeMfaState(s);
      if (cancelled || seq !== authEventSeq.current) return;
      setSession(s);
      setUser(s?.user ?? null);
      setMfaState(next);
      // Always clear the initial loading flag — covers the case where the
      // auth event fires before the initial getSession() resolves and that
      // commit is then discarded by the sequence guard.
      setLoading(false);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [computeMfaState]);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  }

  async function signUp(email: string, password: string, fullName: string, country: string) {
    try {
      const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");

      const registerRes = await fetch(`${baseUrl}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, fullName, country: country.toUpperCase() }),
      });

      const registerData = await registerRes.json();

      if (!registerRes.ok) {
        return { error: registerData.error || "Erreur lors de l'inscription", needsVerification: false };
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        return { error: signInError.message, needsVerification: false };
      }

      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session) {
        setSession(sessionData.session);
        setUser(sessionData.session.user ?? null);
      }

      return { error: null, needsVerification: false };
    } catch {
      return { error: "Erreur de connexion au serveur", needsVerification: false };
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ session, user, loading, mfaState, refreshMfaState, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
