import { AuthLayout } from "@/components/layout/auth-layout";
import { Link, useSearch } from "wouter";
import { Mail, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function VerifierEmail() {
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const email = params.get("email") || "";
  const [resending, setResending] = useState(false);
  const { toast } = useToast();

  const handleResend = async () => {
    if (!email) return;
    setResending(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
    });
    setResending(false);
    if (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de renvoyer l'email. Reessayez dans quelques minutes.",
      });
    } else {
      toast({
        title: "Email renvoye",
        description: "Verifiez votre boite de reception et vos spams.",
      });
    }
  };

  return (
    <AuthLayout>
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-[#2d7dd2]/10 flex items-center justify-center">
            <Mail className="w-8 h-8 text-[#2d7dd2]" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-white">Verifiez votre email</h1>

        <p className="text-[#8b9cb3] text-sm leading-relaxed">
          Nous avons envoye un lien de confirmation a
          {email && (
            <>
              <br />
              <span className="text-white font-medium">{email}</span>
            </>
          )}
        </p>

        <div className="bg-[#0d1117] rounded-lg border border-[#1f2937] p-4 text-left space-y-2">
          <p className="text-[12px] text-[#8b9cb3]">
            1. Ouvrez votre boite de reception
          </p>
          <p className="text-[12px] text-[#8b9cb3]">
            2. Cliquez sur le lien dans l'email de NCV Mail
          </p>
          <p className="text-[12px] text-[#8b9cb3]">
            3. Vous serez redirige vers votre espace
          </p>
        </div>

        <p className="text-[11px] text-[#8b9cb3]">
          Vous ne trouvez pas l'email ? Verifiez vos spams ou{" "}
          <button
            onClick={handleResend}
            disabled={resending || !email}
            className="text-[#2d7dd2] hover:underline disabled:opacity-50"
          >
            {resending ? "Envoi..." : "renvoyez-le"}
          </button>
        </p>

        <div className="pt-2">
          <Link href="/login">
            <Button variant="ghost" size="sm" className="text-[#8b9cb3] hover:text-white">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Retour a la connexion
            </Button>
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}
