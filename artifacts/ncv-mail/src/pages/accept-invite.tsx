import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle, XCircle, Mail } from "lucide-react";

export default function AcceptInvite() {
  const { session, signOut } = useAuth();
  const [, navigate] = useLocation();
  const [status, setStatus] = useState<"loading" | "success" | "error" | "wrong-account" | "login-required">("loading");
  const [message, setMessage] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const attemptedRef = useRef(false);

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

    if (attemptedRef.current) return;
    attemptedRef.current = true;

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
        } else if (res.status === 403 && data.error?.includes("destinée à")) {
          const emailMatch = data.error.match(/destinée à ([^\s.]+)/);
          const targetEmail = emailMatch ? emailMatch[1] : "";
          setInviteEmail(targetEmail);
          setStatus("wrong-account");
          setMessage(data.error);
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

  const handleSignOutAndRedirect = async () => {
    await supabase.auth.signOut();
    const redirectPath = `/accept-invite?token=${token}`;
    window.location.href = import.meta.env.BASE_URL + `signup?redirect=${encodeURIComponent(redirectPath)}&email=${encodeURIComponent(inviteEmail)}`;
  };

  const encodedRedirect = encodeURIComponent(`/accept-invite?token=${token}`);

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

          {status === "wrong-account" && (
            <>
              <Mail className="h-8 w-8 text-yellow-500" />
              <p className="text-[#8b9cb3] text-center">
                Cette invitation est destinée à <strong className="text-white">{inviteEmail}</strong>.
              </p>
              <p className="text-[#8b9cb3] text-center text-sm">
                Vous êtes actuellement connecté(e) avec un autre compte. Pour accepter l'invitation, vous devez vous connecter avec le bon compte.
              </p>
              <Button
                onClick={handleSignOutAndRedirect}
                className="bg-[#2d7dd2] hover:bg-[#2d7dd2]/90 w-full"
              >
                Créer un compte avec {inviteEmail}
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  await supabase.auth.signOut();
                  window.location.href = import.meta.env.BASE_URL + `login?redirect=${encodedRedirect}`;
                }}
                className="border-[#1f2937] text-[#8b9cb3] w-full"
              >
                Se connecter avec {inviteEmail}
              </Button>
            </>
          )}

          {status === "login-required" && (
            <>
              <Mail className="h-8 w-8 text-[#2d7dd2]" />
              <p className="text-[#8b9cb3] text-center">
                Connectez-vous ou créez un compte pour accepter cette invitation.
              </p>
              <Button
                onClick={() => navigate(`/signup?redirect=${encodedRedirect}`)}
                className="bg-[#2d7dd2] hover:bg-[#2d7dd2]/90 w-full"
              >
                Créer un compte
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate(`/login?redirect=${encodedRedirect}`)}
                className="border-[#1f2937] text-[#8b9cb3] w-full"
              >
                J'ai déjà un compte
              </Button>
            </>
          )}

          {status === "success" && (
            <>
              <CheckCircle className="h-8 w-8 text-green-500" />
              <p className="text-white text-center">{message}</p>
              <Button
                onClick={() => navigate("/dashboard")}
                className="bg-[#2d7dd2] hover:bg-[#2d7dd2]/90 w-full"
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
                className="bg-[#2d7dd2] hover:bg-[#2d7dd2]/90 w-full"
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
