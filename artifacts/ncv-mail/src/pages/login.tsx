import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/lib/auth";
import { Link, useLocation, useSearch } from "wouter";
import { AuthLayout } from "@/components/layout/auth-layout";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";

type MfaPending = {
  factorId: string;
};

export default function Login() {
  const { t } = useTranslation();
  const [_, setLocation] = useLocation();
  const searchString = useSearch();
  const { toast } = useToast();
  const { signIn, session, mfaState, refreshMfaState } = useAuth();
  const [isPending, setIsPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [mfaPending, setMfaPending] = useState<MfaPending | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaVerifying, setMfaVerifying] = useState(false);

  // If a session is already present but needs MFA elevation (e.g. user
  // refreshed the page mid-challenge or arrived via a redirect from a
  // protected route), jump straight to the MFA UI.
  useEffect(() => {
    if (mfaPending) return;
    if (!session || mfaState !== "needsMfa") return;
    let cancelled = false;
    void (async () => {
      try {
        const { data, error } = await supabase.auth.mfa.listFactors();
        if (error) throw error;
        const verified = (data?.totp ?? []).find((f) => f.status === "verified");
        if (cancelled) return;
        if (verified) {
          setMfaPending({ factorId: verified.id });
        } else {
          // Inconsistent state: needsMfa but no verified factor. Fail closed.
          await supabase.auth.signOut();
        }
      } catch {
        if (!cancelled) {
          await supabase.auth.signOut();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, mfaState, mfaPending]);

  const loginSchema = z.object({
    email: z.string().email(t("auth.invalidEmail")),
    password: z.string().min(1, t("auth.passwordRequired")),
  });

  type LoginFormValues = z.infer<typeof loginSchema>;

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema as any),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  function redirectAfterAuth() {
    const params = new URLSearchParams(searchString);
    const redirectPath = params.get("redirect");
    const plan = params.get("plan");
    const seats = params.get("seats");
    if (redirectPath) {
      setLocation(redirectPath);
    } else if (plan) {
      const redirect = new URLSearchParams();
      redirect.set("plan", plan);
      if (seats) redirect.set("seats", seats);
      setLocation(`/dashboard/abonnement?${redirect.toString()}`);
    } else {
      // Destination mémorisée avant le redirect login (ex. lien « Ouvrir dans
      // Inboria » de l'add-on Gmail vers /dashboard?emailId=123). Sans ça, on
      // retomberait sur /dashboard nu et le mail ciblé ne s'ouvrirait pas.
      let returnTo: string | null = null;
      try {
        const v = window.sessionStorage.getItem("inboria.returnTo");
        if (v) window.sessionStorage.removeItem("inboria.returnTo");
        if (v && v.startsWith("/dashboard")) returnTo = v;
      } catch {
        // sessionStorage indisponible (mode privé) — non fatal.
      }
      setLocation(returnTo ?? "/dashboard");
    }
  }

  async function onSubmit(data: LoginFormValues) {
    setIsPending(true);
    const { error } = await signIn(data.email, data.password);

    if (error) {
      setIsPending(false);
      toast({
        variant: "destructive",
        title: t("auth.loginError"),
        description: error || t("auth.checkCredentials"),
      });
      return;
    }

    // Determine whether the user must elevate to AAL2 (TOTP). We must FAIL
    // CLOSED if this check fails — never let a 2FA-enrolled user through
    // simply because the assurance level call errored.
    try {
      const { data: aal, error: aalErr } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalErr) throw aalErr;

      if (aal?.currentLevel === "aal1" && aal?.nextLevel === "aal2") {
        const { data: factors, error: facErr } =
          await supabase.auth.mfa.listFactors();
        if (facErr) throw facErr;
        const verified = (factors?.totp ?? []).find(
          (f) => f.status === "verified",
        );
        if (!verified) {
          throw new Error("No verified factor for MFA-enrolled account");
        }
        setMfaPending({ factorId: verified.id });
        setMfaCode("");
        setIsPending(false);
        return;
      }
    } catch (e: unknown) {
      setIsPending(false);
      // Sign back out so we never leave the user in a partially-authenticated
      // AAL1 session that might bypass route guards.
      await supabase.auth.signOut();
      const msg = e instanceof Error ? e.message : String(e);
      toast({
        variant: "destructive",
        title: t("auth.loginError"),
        description: msg,
      });
      return;
    }

    setIsPending(false);
    redirectAfterAuth();
  }

  async function onMfaSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!mfaPending) return;
    const code = mfaCode.replace(/\s+/g, "").trim();
    if (!/^\d{6}$/.test(code)) {
      toast({
        variant: "destructive",
        title: t("auth.mfa.invalidCode"),
        description: t("auth.mfa.codeFormat"),
      });
      return;
    }
    setMfaVerifying(true);
    try {
      const { data: chal, error: chalErr } = await supabase.auth.mfa.challenge({
        factorId: mfaPending.factorId,
      });
      if (chalErr || !chal) throw chalErr ?? new Error("Challenge failed");

      const { error: verErr } = await supabase.auth.mfa.verify({
        factorId: mfaPending.factorId,
        challengeId: chal.id,
        code,
      });
      if (verErr) throw verErr;

      // Make sure the auth context picks up the upgraded AAL before any
      // protected route renders.
      await refreshMfaState();

      redirectAfterAuth();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({
        variant: "destructive",
        title: t("auth.mfa.invalidCode"),
        description: msg,
      });
    } finally {
      setMfaVerifying(false);
    }
  }

  async function cancelMfa() {
    try {
      await supabase.auth.signOut();
    } catch {
      /* ignore */
    }
    setMfaPending(null);
    setMfaCode("");
  }

  if (mfaPending) {
    return (
      <AuthLayout>
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-white">
            {t("auth.mfa.title")}
          </h1>
          <p className="text-[#b8c5d6] mt-2 text-sm">
            {t("auth.mfa.subtitle")}
          </p>
        </div>
        <form onSubmit={onMfaSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-[#b8c5d6]">{t("auth.mfa.codeLabel")}</Label>
            <Input
              autoFocus
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              autoComplete="one-time-code"
              value={mfaCode}
              onChange={(e) =>
                setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              className="bg-background border-border text-white h-11 text-center text-[18px] tracking-[0.4em] font-mono"
              placeholder="000000"
              data-testid="input-mfa-code"
            />
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={mfaVerifying || mfaCode.length !== 6}
            data-testid="button-mfa-verify"
          >
            {mfaVerifying && (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            )}
            {t("auth.mfa.verifyButton")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full text-[#b8c5d6] hover:text-white"
            onClick={() => void cancelMfa()}
            disabled={mfaVerifying}
          >
            {t("auth.mfa.useAnotherAccount")}
          </Button>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-white">{t("auth.welcome")}</h1>
        <p className="text-[#b8c5d6] mt-2 text-sm">{t("auth.loginSubtitle")}</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[#b8c5d6]">{t("auth.email")}</FormLabel>
                <FormControl>
                  <Input placeholder={t("auth.emailPlaceholder")} type="email" className="bg-background border-border text-white" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel className="text-[#b8c5d6]">{t("auth.password")}</FormLabel>
                  <Link href="/mot-de-passe-oublie" className="text-xs text-primary hover:text-primary/80 font-medium" tabIndex={-1}>
                    {t("auth.forgotPassword")}
                  </Link>
                </div>
                <FormControl>
                  <div className="relative">
                    <Input type={showPassword ? "text" : "password"} placeholder="" className="bg-background border-border text-white pr-10" {...field} />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#b8c5d6] hover:text-white transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button
            type="submit"
            className="w-full"
            disabled={isPending}
          >
            {isPending ? t("auth.loggingIn") : t("auth.loginButton")}
          </Button>
        </form>
      </Form>

      <div className="mt-6 text-center text-sm text-[#b8c5d6]">
        {t("auth.noAccount")}{" "}
        <Link href={`/signup${searchString ? `?${searchString}` : ""}`} className="font-semibold text-primary hover:text-primary/80">
          {t("auth.createAccount")}
        </Link>
      </div>
    </AuthLayout>
  );
}
