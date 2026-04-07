import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

export default function AcceptInvite() {
  const { session } = useAuth();
  const [, navigate] = useLocation();
  const [status, setStatus] = useState<"loading" | "success" | "error" | "login-required">("loading");
  const [message, setMessage] = useState("");

  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Lien d'invitation invalide.");
      return;
    }

    if (!session) {
      setStatus("login-required");
      return;
    }

    const acceptInvite = async () => {
      try {
        const authToken = session.access_token;

        const res = await fetch(`${import.meta.env.BASE_URL}api/invitations/${token}/accept`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
        });

        const data = await res.json();

        if (res.ok) {
          setStatus("success");
          setMessage("Vous avez rejoint l'organisation avec succès !");
        } else {
          setStatus("error");
          setMessage(data.error || "Erreur lors de l'acceptation de l'invitation.");
        }
      } catch {
        setStatus("error");
        setMessage("Erreur de connexion au serveur.");
      }
    };

    acceptInvite();
  }, [token, session]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0d1117] p-4">
      <Card className="w-full max-w-md bg-[#141c2b] border-[#1f2937]">
        <CardHeader>
          <CardTitle className="text-white text-center">Invitation d'équipe</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          {status === "loading" && (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-[#2d7dd2]" />
              <p className="text-[#8b9cb3]">Acceptation de l'invitation en cours...</p>
            </>
          )}

          {status === "login-required" && (
            <>
              <XCircle className="h-8 w-8 text-yellow-500" />
              <p className="text-[#8b9cb3] text-center">
                Vous devez vous connecter pour accepter cette invitation.
              </p>
              <Button
                onClick={() => navigate(`/login?redirect=/accept-invite?token=${token}`)}
                className="bg-[#2d7dd2] hover:bg-[#2d7dd2]/90"
              >
                Se connecter
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate(`/signup?redirect=/accept-invite?token=${token}`)}
                className="border-[#1f2937] text-[#8b9cb3]"
              >
                Créer un compte
              </Button>
            </>
          )}

          {status === "success" && (
            <>
              <CheckCircle className="h-8 w-8 text-green-500" />
              <p className="text-white text-center">{message}</p>
              <Button
                onClick={() => navigate("/dashboard")}
                className="bg-[#2d7dd2] hover:bg-[#2d7dd2]/90"
              >
                Accéder au tableau de bord
              </Button>
            </>
          )}

          {status === "error" && (
            <>
              <XCircle className="h-8 w-8 text-red-500" />
              <p className="text-red-400 text-center">{message}</p>
              <Button
                onClick={() => navigate("/")}
                className="bg-[#2d7dd2] hover:bg-[#2d7dd2]/90"
              >
                Retour à l'accueil
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
