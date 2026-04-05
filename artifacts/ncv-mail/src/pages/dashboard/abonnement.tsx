import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useGetProfile, useCreateCheckoutSession, getGetProfileQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Check, Users, Shield, Zap, Sparkles, Info, CreditCard, ExternalLink, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useSearch, useLocation } from "wouter";

const plans = [
  {
    id: "gratuit",
    name: "Gratuit",
    price: "0",
    quota: 50,
    description: "Parfait pour decouvrir NCV Mail",
    features: [
      "50 emails par mois",
      "3 rubriques personnalisees",
      "Support par email",
      "Integration Gmail & Outlook",
    ],
    icon: Check,
  },
  {
    id: "solo",
    name: "Solo",
    price: "9",
    quota: 3000,
    description: "Pour les independants",
    features: [
      "3 000 emails par mois",
      "Rubriques illimitees",
      "Brief quotidien",
      "Brouillons IA proactifs",
      "Extraction automatique des taches",
      "Support prioritaire",
      "Depassement : 0,002€/email",
    ],
    icon: Zap,
  },
  {
    id: "pro",
    name: "Pro",
    price: "19",
    quota: 10000,
    description: "Ideal pour les professionnels",
    features: [
      "10 000 emails par mois",
      "Rubriques illimitees",
      "Brief quotidien",
      "Brouillons IA proactifs",
      "Extraction automatique des taches",
      "Integrations avancees (Slack, Notion)",
      "Statistiques detaillees",
      "Support prioritaire",
      "Depassement : 0,001€/email",
    ],
    icon: Sparkles,
  },
  {
    id: "business",
    name: "Business",
    price: "9",
    quota: 10000,
    description: "Pour les equipes",
    features: [
      "10 000 emails tries / siege / mois",
      "Tout du plan Pro inclus",
      "Nombre d'utilisateurs configurable",
      "Boites partagees entre collegues",
      "Assignation de taches entre membres",
      "API dediee",
      "Support prioritaire",
      "Depassement : 0,001€ / email",
    ],
    icon: Users,
    hasSeats: true,
  },
];

export default function Abonnement() {
  const { data: profile, isLoading } = useGetProfile();
  const checkout = useCreateCheckoutSession();
  const [portalLoading, setPortalLoading] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const searchString = useSearch();
  const [, navigate] = useLocation();

  const [businessSeats, setBusinessSeats] = useState(1);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    if (params.get("success") === "true") {
      queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
      toast({
        title: "Paiement reussi",
        description: "Votre abonnement a ete mis a jour avec succes.",
      });
      navigate("/dashboard/abonnement", { replace: true });
    } else if (params.get("cancelled") === "true") {
      toast({
        title: "Paiement annule",
        description: "Vous n'avez pas ete debite.",
        variant: "destructive",
      });
      navigate("/dashboard/abonnement", { replace: true });
    }
  }, [searchString, queryClient, toast, navigate]);

  const handleSubscribe = (planId: string, seats?: number) => {
    if (planId === "gratuit") return;

    setLoadingPlan(planId);
    checkout.mutate(
      { data: { planId: planId as "solo" | "pro" | "business", seats: seats || 1 } },
      {
        onSuccess: (data) => {
          setLoadingPlan(null);
          if (data.updated) {
            queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
            toast({
              title: "Plan mis a jour",
              description: "Votre abonnement a ete modifie avec succes.",
            });
          } else if (data.url) {
            window.location.href = data.url;
          }
        },
        onError: () => {
          setLoadingPlan(null);
          toast({
            title: "Erreur",
            description: "Impossible de creer la session de paiement.",
            variant: "destructive",
          });
        },
      }
    );
  };

  const handlePortal = async () => {
    setPortalLoading(true);
    try {
      const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");
      const token = (await import("@/lib/supabase")).supabase.auth.getSession();
      const session = await token;
      const accessToken = session.data.session?.access_token;

      const res = await fetch(`${baseUrl}/api/stripe/portal`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || "Erreur");
      }
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible d'acceder au portail de gestion.",
        variant: "destructive",
      });
    } finally {
      setPortalLoading(false);
    }
  };

  const hasPaidPlan = profile?.plan && profile.plan !== "gratuit";

  return (
    <DashboardLayout>
      <div className="p-6 max-w-6xl mx-auto w-full">
        <div className="mb-8 text-center max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold text-white tracking-tight mb-2">
            Gerez votre abonnement
          </h1>
          <p className="text-[14px] text-[#8b9cb3]">
            Choisissez le plan adapte a votre volume d'emails.
          </p>
        </div>

        {isLoading ? (
          <Skeleton className="h-20 w-full mb-8 rounded-lg bg-white/5" />
        ) : profile ? (
          <div className="bg-card rounded-lg border border-border p-5 mb-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-[14px] font-semibold text-white mb-0.5">
                Plan actuel :{" "}
                <span className="text-primary capitalize">{profile.plan}</span>
              </h3>
              <p className="text-[12px] text-[#8b9cb3]">
                Renouvellement le{" "}
                {new Date(
                  new Date().setMonth(new Date().getMonth() + 1)
                ).toLocaleDateString("fr-FR")}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-full md:w-64">
                <div className="flex justify-between text-[12px] font-medium mb-1.5">
                  <span className="text-[#8b9cb3]">Consommation IA</span>
                  <span className="text-white">
                    {profile.emailsUsed} / {profile.emailsQuota}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, (profile.emailsUsed / Math.max(1, profile.emailsQuota)) * 100)}%`,
                    }}
                  />
                </div>
              </div>
              {hasPaidPlan && (
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={handlePortal}
                  disabled={portalLoading}
                >
                  {portalLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-1" />
                  ) : (
                    <ExternalLink className="w-3.5 h-3.5 mr-1" />
                  )}
                  Gerer l'abonnement
                </Button>
              )}
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {plans.map((plan) => {
            const isCurrentPlan = profile?.plan === plan.id;
            const isBusiness = plan.hasSeats;
            const price = isBusiness
              ? parseInt(plan.price) * businessSeats
              : plan.price;
            const isLoading = loadingPlan === plan.id;

            return (
              <div
                key={plan.id}
                className={`relative rounded-lg border p-5 flex flex-col ${
                  isCurrentPlan
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card"
                }`}
              >
                {isCurrentPlan && (
                  <div className="absolute top-3 right-3">
                    <div className="bg-primary/20 text-primary text-[10px] font-semibold px-2 py-0.5 rounded-full">
                      Plan actuel
                    </div>
                  </div>
                )}

                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 ${isCurrentPlan ? "bg-primary/10 text-primary" : "bg-white/[0.04] text-[#8b9cb3]"}`}
                >
                  <plan.icon className="w-5 h-5" />
                </div>

                <h3 className="text-[15px] font-bold text-white">
                  {plan.name}
                </h3>
                <p className="text-[12px] text-[#8b9cb3] mb-4 h-8">
                  {plan.description}
                </p>

                <div className="mb-4">
                  <div className="flex items-baseline gap-0.5">
                    <span className="text-3xl font-extrabold text-white">
                      {price}€
                    </span>
                    <span className="text-[#8b9cb3] text-[13px]">
                      {isBusiness ? "/ mois" : "/mois"}
                    </span>
                  </div>
                  {isBusiness && (
                    <p className="text-[11px] text-[#8b9cb3] mt-0.5">
                      Soit 9€ par siege / mois
                    </p>
                  )}
                </div>

                {isBusiness && (
                  <div className="mb-4 p-3 bg-background rounded-lg border border-border">
                    <label className="text-[12px] font-medium text-[#8b9cb3] block mb-2">
                      Nombre de sieges
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="1"
                        max="50"
                        value={businessSeats}
                        onChange={(e) =>
                          setBusinessSeats(parseInt(e.target.value))
                        }
                        className="w-full accent-primary"
                      />
                      <span className="font-bold text-sm text-white w-8 text-center">
                        {businessSeats}
                      </span>
                    </div>
                    <p className="text-[11px] text-primary mt-2">
                      {businessSeats} collaborateur{businessSeats > 1 ? "s" : ""} ={" "}
                      {businessSeats * 9}€/mois
                    </p>
                  </div>
                )}

                <ul className="space-y-2 mb-5 flex-1">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check
                        className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${isCurrentPlan ? "text-primary" : "text-emerald-400"}`}
                      />
                      <span className="text-[12px] text-[#8b9cb3]">
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                {isCurrentPlan ? (
                  <Button
                    variant="ghost"
                    className="w-full text-primary hover:text-primary hover:bg-primary/10"
                    size="sm"
                    disabled
                  >
                    Plan actuel
                  </Button>
                ) : plan.id === "gratuit" ? (
                  <Button
                    variant="ghost"
                    className="w-full"
                    size="sm"
                    disabled
                  >
                    Plan de base
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    size="sm"
                    disabled={isLoading || loadingPlan !== null}
                    onClick={() => {
                      handleSubscribe(
                        plan.id,
                        isBusiness ? businessSeats : 1
                      );
                    }}
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-1" />
                    ) : null}
                    {isLoading ? "Redirection..." : "Changer de plan"}
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-6 text-center">
          <p className="text-[12px] text-[#8b9cb3] leading-relaxed">
            Exemple : 3 collaborateurs = 27€/mois — modifiable a tout moment depuis votre espace.
          </p>
        </div>

        <div className="mt-6 bg-card rounded-lg border border-border p-5">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-amber-500/10 text-amber-400 shrink-0">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-[14px] font-semibold text-white mb-1">
                Depassement de quota
              </h3>
              <p className="text-[12px] text-[#8b9cb3] leading-relaxed">
                Facturation automatique Pay-as-you-go. Aucune surprise — vous etes notifie a 80% de votre quota mensuel.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-3 bg-card rounded-lg border border-border p-5">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-blue-500/10 text-blue-400 shrink-0">
              <Info className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-[14px] font-semibold text-white mb-1">
                Sans engagement
              </h3>
              <p className="text-[12px] text-[#8b9cb3] leading-relaxed">
                Tous les plans sont sans engagement. Vous pouvez ajouter ou retirer des sieges, changer de plan ou annuler a tout moment depuis votre espace personnel.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-3 bg-card rounded-lg border border-border p-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-[14px] font-semibold text-white mb-1 flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              Securite et confidentialite
            </h3>
            <p className="text-[12px] text-[#8b9cb3] max-w-2xl">
              Vos emails ne sont jamais stockes pour entrainer nos modeles. IA
              en temps reel uniquement. Donnees hebergees en Europe (RGPD).
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
