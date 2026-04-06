import { Link, useLocation } from "wouter";
import { MarketingLayout } from "@/components/layout/marketing-layout";
import { Check, Shield, CreditCard } from "lucide-react";
import { useState } from "react";
import { plans } from "@/lib/plans";
import { useAuth } from "@/lib/auth";
import { useCreateCheckoutSession } from "@workspace/api-client-react";

export default function Tarifs() {
  const [businessSeats, setBusinessSeats] = useState(3);
  const { session } = useAuth();
  const checkout = useCreateCheckoutSession();
  const [, navigate] = useLocation();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const handleCta = (planId: string, seats?: number) => {
    if (!session) {
      const params = new URLSearchParams();
      params.set("plan", planId);
      if (planId === "business" && seats) {
        params.set("seats", String(seats));
      }
      navigate(`/signup?${params.toString()}`);
      return;
    }

    if (planId === "essai") {
      navigate("/dashboard");
      return;
    }

    setLoadingPlan(planId);
    checkout.mutate(
      { data: { planId: planId as "solo" | "pro" | "business", seats: seats || 1 } },
      {
        onSuccess: (data) => {
          setLoadingPlan(null);
          if (data.url) {
            window.location.href = data.url;
          } else {
            navigate("/dashboard/abonnement");
          }
        },
        onError: () => {
          setLoadingPlan(null);
        },
      }
    );
  };

  return (
    <MarketingLayout>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#2d7dd2]/10 to-transparent" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center relative">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white">
            Des tarifs simples, sans surprise
          </h1>
          <p className="mt-4 text-[16px] text-[#8b9cb3] max-w-2xl mx-auto">
            Choisissez le plan qui correspond a vos besoins. Changez ou annulez a tout moment.
          </p>
        </div>
      </section>

      <section className="border-t border-[#1f2937]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {plans.map((plan) => {
              const isBusiness = "hasSeats" in plan && plan.hasSeats;
              const isRecommended = plan.id === "pro";
              const price = isBusiness ? businessSeats * 9 : plan.price;

              return (
                <div
                  key={plan.id}
                  className={`relative rounded-xl border p-6 flex flex-col ${
                    isRecommended
                      ? "border-[#2d7dd2] bg-[#2d7dd2]/5"
                      : "border-[#1f2937] bg-[#141c2b]"
                  }`}
                >
                  {isRecommended && (
                    <div className="absolute top-3 right-3">
                      <span className="bg-[#2d7dd2] text-white text-[10px] font-semibold px-2.5 py-1 rounded-full">
                        Recommande
                      </span>
                    </div>
                  )}

                  <h3 className="text-[16px] font-bold text-white">{plan.name}</h3>
                  <p className="text-[12px] text-[#8b9cb3] mb-4 h-8">{plan.description}</p>

                  <div className="mb-4">
                    <div className="flex items-baseline gap-0.5">
                      {plan.id === "essai" ? (
                        <span className="text-3xl font-extrabold text-white">Gratuit</span>
                      ) : (
                        <>
                          <span className="text-3xl font-extrabold text-white">{price}€</span>
                          <span className="text-[#8b9cb3] text-[13px]">
                            {isBusiness ? "/siege/mois" : "/mois"}
                          </span>
                        </>
                      )}
                    </div>
                    {isBusiness && (
                      <p className="text-[11px] text-[#8b9cb3] mt-0.5">
                        Soit 9€ par siege/mois
                      </p>
                    )}
                  </div>

                  {isBusiness && (
                    <div className="mb-4 p-3 bg-[#0d1117] rounded-lg border border-[#1f2937]">
                      <label className="text-[12px] font-medium text-[#8b9cb3] block mb-2">
                        Nombre de collaborateurs
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min="3"
                          max="50"
                          value={businessSeats}
                          onChange={(e) => setBusinessSeats(parseInt(e.target.value))}
                          className="w-full accent-[#2d7dd2]"
                        />
                        <span className="font-bold text-sm text-white w-8 text-center">
                          {businessSeats}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#8b9cb3] mt-1">
                        <span className="font-medium">Total : </span>
                        <span className="text-[#2d7dd2] font-bold">{businessSeats * 9}€</span> /mois
                      </p>
                      <p className="text-[10px] text-[#8b9cb3] mt-1">
                        Exemple : 3 collaborateurs = 27€/mois — modifiable a tout moment depuis votre espace.
                      </p>
                    </div>
                  )}

                  <ul className="space-y-2.5 mb-6 flex-1">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Check className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${isRecommended ? "text-[#2d7dd2]" : "text-emerald-400"}`} />
                        <span className="text-[12px] text-[#8b9cb3]">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => handleCta(plan.id, isBusiness ? businessSeats : undefined)}
                    disabled={loadingPlan === plan.id}
                    className={`w-full py-2.5 text-[13px] font-semibold rounded-lg transition-colors ${
                      isRecommended
                        ? "bg-[#2d7dd2] text-white hover:bg-[#2563b1]"
                        : "bg-white/5 text-white border border-[#1f2937] hover:bg-white/10"
                    } disabled:opacity-50`}
                  >
                    {loadingPlan === plan.id ? "Redirection..." : "Commencer"}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-[13px] text-[#8b9cb3]">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              <span>Sans engagement, resiliable a tout moment</span>
            </div>
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              <span>Paiement securise par Stripe</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              <span>Conforme RGPD</span>
            </div>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
