import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { AuthLayout } from "@/components/layout/auth-layout";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

export default function AuthCallback() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            setStatus("error");
            return;
          }
        }

        const hashParams = new URLSearchParams(window.location.hash.replace("#", ""));
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) {
            setStatus("error");
            return;
          }
        }

        let attempts = 0;
        while (attempts < 10) {
          const { data } = await supabase.auth.getSession();
          if (data.session) {
            setStatus("success");

            const pendingPlan = localStorage.getItem("ncv_pending_plan");
            const pendingSeats = localStorage.getItem("ncv_pending_seats");
            localStorage.removeItem("ncv_pending_plan");
            localStorage.removeItem("ncv_pending_seats");

            setTimeout(() => {
              if (pendingPlan && pendingPlan !== "essai") {
                const redirect = new URLSearchParams();
                redirect.set("plan", pendingPlan);
                if (pendingSeats) redirect.set("seats", pendingSeats);
                setLocation(`/dashboard/abonnement?${redirect.toString()}`);
              } else {
                setLocation("/dashboard");
              }
            }, 1500);
            return;
          }
          attempts++;
          await new Promise((r) => setTimeout(r, 500));
        }

        setStatus("error");
      } catch {
        setStatus("error");
      }
    };

    handleCallback();
  }, [setLocation]);

  return (
    <AuthLayout>
      <div className="text-center space-y-4">
        {status === "loading" && (
          <>
            <Loader2 className="w-10 h-10 animate-spin text-[#2d7dd2] mx-auto" />
            <h1 className="text-xl font-bold text-white">Verification en cours...</h1>
            <p className="text-sm text-[#b8c5d6]">
              Nous confirmons votre adresse email
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto" />
            <h1 className="text-xl font-bold text-white">Email verifie !</h1>
            <p className="text-sm text-[#b8c5d6]">
              Redirection vers votre espace...
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <XCircle className="w-10 h-10 text-red-400 mx-auto" />
            <h1 className="text-xl font-bold text-white">Lien invalide ou expire</h1>
            <p className="text-sm text-[#b8c5d6]">
              Ce lien de verification n'est plus valide. Veuillez vous reconnecter ou vous reinscrire.
            </p>
            <a
              href="/login"
              className="inline-block mt-2 text-sm text-[#2d7dd2] hover:underline"
            >
              Retour a la connexion
            </a>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
