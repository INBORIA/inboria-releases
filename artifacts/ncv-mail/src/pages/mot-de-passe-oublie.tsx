import { useState } from "react";
import { Link } from "wouter";
import { supabase } from "@/lib/supabase";
import { AuthLayout } from "@/components/layout/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Mail, ArrowLeft, CheckCircle } from "lucide-react";

export default function MotDePasseOublie() {
  const [email, setEmail] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;

    setIsPending(true);
    try {
      const origin = window.location.origin;
      const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${origin}${basePath}/reset-password`,
      });

      if (error) {
        toast({
          variant: "destructive",
          title: "Erreur",
          description: error.message,
        });
      } else {
        setSent(true);
      }
    } catch {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible d'envoyer l'email de reinitialisation.",
      });
    } finally {
      setIsPending(false);
    }
  }

  if (sent) {
    return (
      <AuthLayout>
        <div className="text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
            <CheckCircle className="w-7 h-7 text-emerald-400" />
          </div>
          <h1 className="text-xl font-bold text-white">Email envoye !</h1>
          <p className="text-sm text-[#8b9cb3] leading-relaxed">
            Si un compte existe avec l'adresse <span className="text-white font-medium">{email}</span>, 
            vous recevrez un lien de reinitialisation dans quelques instants.
          </p>
          <p className="text-xs text-[#8b9cb3]">
            Pensez a verifier vos spams si vous ne trouvez pas l'email.
          </p>
          <div className="pt-2">
            <Link href="/login" className="text-sm text-primary hover:text-primary/80 font-semibold">
              Retour a la connexion
            </Link>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="mb-6 text-center">
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Mail className="w-7 h-7 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-white">Mot de passe oublie ?</h1>
        <p className="text-[#8b9cb3] mt-2 text-sm">
          Entrez votre adresse email et nous vous enverrons un lien pour reinitialiser votre mot de passe.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-[12px] text-[#8b9cb3]">Adresse email</Label>
          <Input
            type="email"
            placeholder="nom@entreprise.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-background border-border text-white"
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={isPending || !email}>
          {isPending ? "Envoi en cours..." : "Envoyer le lien"}
        </Button>
      </form>

      <div className="mt-6 text-center">
        <Link href="/login" className="text-sm text-[#8b9cb3] hover:text-white inline-flex items-center gap-1.5 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
          Retour a la connexion
        </Link>
      </div>
    </AuthLayout>
  );
}
