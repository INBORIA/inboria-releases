import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { AuthLayout } from "@/components/layout/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Lock, Eye, EyeOff, CheckCircle, Loader2 } from "lucide-react";

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionError, setSessionError] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const handleSession = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");
        const hashParams = new URLSearchParams(window.location.hash.replace("#", ""));
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        const hashType = hashParams.get("type");

        const hasRecoveryParams = !!code || (!!accessToken && !!refreshToken) || hashType === "recovery";

        if (!hasRecoveryParams) {
          setSessionError(true);
          return;
        }

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            setSessionError(true);
            return;
          }
        }

        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) {
            setSessionError(true);
            return;
          }
        }

        let attempts = 0;
        while (attempts < 10) {
          const { data } = await supabase.auth.getSession();
          if (data.session) {
            setSessionReady(true);
            return;
          }
          attempts++;
          await new Promise((r) => setTimeout(r, 500));
        }
        setSessionError(true);
      } catch {
        setSessionError(true);
      }
    };
    handleSession();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (password.length < 6) {
      toast({
        variant: "destructive",
        title: "Mot de passe trop court",
        description: "Le mot de passe doit contenir au moins 6 caracteres.",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Les mots de passe ne correspondent pas.",
      });
      return;
    }

    setIsPending(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        toast({
          variant: "destructive",
          title: "Erreur",
          description: error.message,
        });
      } else {
        setSuccess(true);
        setTimeout(() => setLocation("/dashboard"), 2000);
      }
    } catch {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de mettre a jour le mot de passe.",
      });
    } finally {
      setIsPending(false);
    }
  }

  if (sessionError) {
    return (
      <AuthLayout>
        <div className="text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
            <Lock className="w-7 h-7 text-red-400" />
          </div>
          <h1 className="text-xl font-bold text-white">Lien expire</h1>
          <p className="text-sm text-[#8b9cb3]">
            Ce lien de reinitialisation n'est plus valide. Veuillez en demander un nouveau.
          </p>
          <a href="/mot-de-passe-oublie" className="inline-block text-sm text-primary hover:text-primary/80 font-semibold">
            Demander un nouveau lien
          </a>
        </div>
      </AuthLayout>
    );
  }

  if (!sessionReady) {
    return (
      <AuthLayout>
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
          <h1 className="text-xl font-bold text-white">Verification...</h1>
          <p className="text-sm text-[#8b9cb3]">Nous verifions votre lien de reinitialisation</p>
        </div>
      </AuthLayout>
    );
  }

  if (success) {
    return (
      <AuthLayout>
        <div className="text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
            <CheckCircle className="w-7 h-7 text-emerald-400" />
          </div>
          <h1 className="text-xl font-bold text-white">Mot de passe modifie !</h1>
          <p className="text-sm text-[#8b9cb3]">
            Redirection vers votre espace...
          </p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="mb-6 text-center">
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Lock className="w-7 h-7 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-white">Nouveau mot de passe</h1>
        <p className="text-[#8b9cb3] mt-2 text-sm">
          Choisissez un nouveau mot de passe pour votre compte.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-[12px] text-[#8b9cb3]">Nouveau mot de passe</Label>
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-background border-border text-white pr-10"
              placeholder="Minimum 6 caracteres"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8b9cb3] hover:text-white transition-colors"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-[12px] text-[#8b9cb3]">Confirmer le mot de passe</Label>
          <Input
            type={showPassword ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="bg-background border-border text-white"
            placeholder="Retapez le mot de passe"
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={isPending || !password || !confirmPassword}>
          {isPending ? "Mise a jour..." : "Reinitialiser le mot de passe"}
        </Button>
      </form>
    </AuthLayout>
  );
}
