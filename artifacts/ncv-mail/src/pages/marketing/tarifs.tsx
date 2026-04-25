import { Link, useLocation } from "wouter";
import { MarketingLayout } from "@/components/layout/marketing-layout";
import { Check, Shield, CreditCard, Clock } from "lucide-react";
import { useState } from "react";
import { plans } from "@/lib/plans";
import { useAuth } from "@/lib/auth";
import { useCreateCheckoutSession } from "@workspace/api-client-react";
import { useTranslation } from "react-i18next";
import { isPaymentsEnabled } from "@/lib/feature-flags";
import { WaitlistForm } from "@/components/waitlist-form";

const planFeatureKeys: Record<string, string[]> = {
  essai: ["f1", "f2", "f3", "f4"],
  solo: ["f1", "f2", "f3", "f4", "f5", "f6", "f7"],
  pro: ["f1", "f2", "f3", "f4", "f5", "f6", "f7", "f8"],
  business: ["f1", "f2", "f3", "f4", "f5", "f6", "f7", "f8"],
};

export default function Tarifs() {
  const { t } = useTranslation();
  const [businessSeats, setBusinessSeats] = useState(3);
  const { session } = useAuth();
  const checkout = useCreateCheckoutSession();
  const [, navigate] = useLocation();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const paymentsEnabled = isPaymentsEnabled();

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
          if (data.clientToken && data.priceId && (window as any).Paddle) {
            (window as any).Paddle.Initialize({ token: data.clientToken });
            (window as any).Paddle.Checkout.open({
              items: [{ priceId: data.priceId, quantity: data.quantity }],
              customer: { id: data.customerId },
              settings: { successUrl: data.successUrl },
            });
          } else if (data.updated) {
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
            {t("marketing.pricing.heroTitle")}
          </h1>
          <p className="mt-4 text-[16px] text-[#8b9cb3] max-w-2xl mx-auto">
            {t("marketing.pricing.heroDesc")}
          </p>
        </div>
      </section>

      {!paymentsEnabled && (
        <section className="border-t border-[#1f2937]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <div
              className="rounded-2xl border border-[#2d7dd2]/40 bg-[#2d7dd2]/5 p-6 sm:p-8"
              data-testid="banner-coming-soon"
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#2d7dd2]/15 text-[#2d7dd2] text-[11px] font-semibold">
                  <Clock className="w-3 h-3" />
                  {t("waitlist.title")}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white">
                {t("waitlist.bannerTitle")}
              </h2>
              <p className="mt-2 text-[14px] text-[#8b9cb3] max-w-2xl">
                {t("waitlist.bannerDesc")}
              </p>
              <div className="mt-5">
                <WaitlistForm compact source="marketing-tarifs" />
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="border-t border-[#1f2937]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {plans.map((plan) => {
              const isBusiness = "hasSeats" in plan && plan.hasSeats;
              const isRecommended = plan.id === "pro";
              const price = isBusiness ? (businessSeats * 12.99).toFixed(2) : plan.price;
              const featureKeys = planFeatureKeys[plan.id] || [];
              const isPaid = plan.id !== "essai";
              const ctaDisabled = !paymentsEnabled || loadingPlan === plan.id;

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
                        {t("plans.recommended")}
                      </span>
                    </div>
                  )}

                  <h3 className="text-[16px] font-bold text-white">{t(`plans.${plan.id}`)}</h3>
                  <p className="text-[12px] text-[#8b9cb3] mb-4 h-8">{t(`plans.${plan.id}Desc`)}</p>

                  <div className="mb-4">
                    <div className="flex items-baseline gap-0.5">
                      {plan.id === "essai" ? (
                        <span className="text-3xl font-extrabold text-white">{t("plans.free")}</span>
                      ) : (
                        <>
                          <span className="text-3xl font-extrabold text-white">{price}€</span>
                          <span className="text-[#8b9cb3] text-[13px]">
                            {isBusiness ? t("plans.perSeatMonth") : t("plans.perMonth")}
                          </span>
                        </>
                      )}
                    </div>
                    {isBusiness && (
                      <p className="text-[11px] text-[#8b9cb3] mt-0.5">
                        {t("plans.perSeatDetail")}
                      </p>
                    )}
                  </div>

                  {isBusiness && (
                    <div className="mb-4 p-3 bg-[#0d1117] rounded-lg border border-[#1f2937]">
                      <label className="text-[12px] font-medium text-[#8b9cb3] block mb-2">
                        {t("plans.numberOfCollaborators")}
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
                        <span className="font-medium">{t("plans.total")} : </span>
                        <span className="text-[#2d7dd2] font-bold">{(businessSeats * 12.99).toFixed(2)}€</span> {t("plans.perMonth")}
                      </p>
                      <p className="text-[10px] text-[#8b9cb3] mt-1">
                        {t("plans.seatsExample")}
                      </p>
                    </div>
                  )}

                  <ul className="space-y-2.5 mb-6 flex-1">
                    {featureKeys.map((fKey) => (
                      <li key={fKey} className="flex items-start gap-2">
                        <Check className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${isRecommended ? "text-[#2d7dd2]" : "text-emerald-400"}`} />
                        <span className="text-[12px] text-[#8b9cb3]">{t(`plans.${plan.id}Features.${fKey}`)}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => handleCta(plan.id, isBusiness ? businessSeats : undefined)}
                    disabled={ctaDisabled}
                    className={`w-full py-2.5 text-[13px] font-semibold rounded-lg transition-colors ${
                      isRecommended
                        ? "bg-[#2d7dd2] text-white hover:bg-[#2563b1]"
                        : "bg-white/5 text-white border border-[#1f2937] hover:bg-white/10"
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                    data-testid={`button-cta-${plan.id}`}
                  >
                    {!paymentsEnabled
                      ? t("waitlist.ctaComingSoon")
                      : loadingPlan === plan.id
                        ? t("plans.redirecting")
                        : t("plans.start")}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-[13px] text-[#8b9cb3]">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              <span>{t("marketing.pricing.noCommitment")}</span>
            </div>
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              <span>{t("marketing.pricing.securePayment")}</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              <span>{t("marketing.pricing.gdprCompliant")}</span>
            </div>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
