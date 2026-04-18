import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useGetProfile, useCreateCheckoutSession, getGetProfileQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Check, Shield, Info, CreditCard, ExternalLink, Loader2, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useSearch, useLocation } from "wouter";
import { plans } from "@/lib/plans";
import { useTranslation } from "react-i18next";

declare global {
  interface Window {
    Paddle?: any;
  }
}

export default function Abonnement() {
  const { t, i18n } = useTranslation();
  const { data: profile, isLoading } = useGetProfile();
  const checkout = useCreateCheckoutSession();
  const [portalLoading, setPortalLoading] = useState(false);
  const [recountLoading, setRecountLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const searchString = useSearch();
  const [, navigate] = useLocation();

  const [businessSeats, setBusinessSeats] = useState(3);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [paddleReady, setPaddleReady] = useState(false);

  useEffect(() => {
    if (window.Paddle) {
      setPaddleReady(true);
      return;
    }
    const interval = setInterval(() => {
      if (window.Paddle) {
        setPaddleReady(true);
        clearInterval(interval);
      }
    }, 500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    if (params.get("success") === "true") {
      queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
      toast({
        title: t("subscription.paymentSuccess"),
        description: t("subscription.paymentSuccessDesc"),
      });
      navigate("/dashboard/abonnement", { replace: true });
    } else if (params.get("cancelled") === "true") {
      toast({
        title: t("subscription.paymentCancelled"),
        description: t("subscription.paymentCancelledDesc"),
        variant: "destructive",
      });
      navigate("/dashboard/abonnement", { replace: true });
    }
  }, [searchString, queryClient, toast, navigate]);

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const pendingPlan = params.get("plan");
    const pendingSeats = params.get("seats");
    if (pendingPlan && pendingPlan !== "essai" && profile && !isLoading) {
      const seats = pendingSeats ? parseInt(pendingSeats, 10) : undefined;
      if (pendingPlan === "business") {
        setBusinessSeats(seats || 3);
      }
      navigate("/dashboard/abonnement", { replace: true });
      handleSubscribe(pendingPlan, seats);
    }
  }, [searchString, profile, isLoading]);

  const openPaddleCheckout = useCallback((data: any) => {
    if (!window.Paddle) {
      toast({
        title: t("common.error"),
        description: "Paddle is not loaded. Please refresh the page.",
        variant: "destructive",
      });
      return;
    }

    window.Paddle.Initialize({
      token: data.clientToken,
    });

    window.Paddle.Checkout.open({
      items: [
        {
          priceId: data.priceId,
          quantity: data.quantity,
        },
      ],
      customer: {
        id: data.customerId,
      },
      settings: {
        successUrl: data.successUrl,
        locale: i18n.language === "nl" ? "nl" : i18n.language === "en" ? "en" : "fr",
      },
    });
  }, [i18n.language, toast, t]);

  const handleSubscribe = (planId: string, seats?: number) => {
    if (planId === "essai") return;

    setLoadingPlan(planId);
    checkout.mutate(
      { data: { planId: planId as "solo" | "pro" | "business", seats: seats || 1 } },
      {
        onSuccess: (data) => {
          setLoadingPlan(null);
          if (data.updated) {
            queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
            toast({
              title: t("subscription.planUpdated"),
              description: t("subscription.planUpdatedDesc"),
            });
          } else if (data.clientToken && data.priceId) {
            openPaddleCheckout(data);
          }
        },
        onError: () => {
          setLoadingPlan(null);
          toast({
            title: t("common.error"),
            description: t("subscription.paymentError"),
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleRecount = async () => {
    setRecountLoading(true);
    try {
      const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");
      const session = await (await import("@/lib/supabase")).supabase.auth.getSession();
      const accessToken = session.data.session?.access_token;
      const res = await fetch(`${baseUrl}/api/profile/recount-quota`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (data.ok) {
        await queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
        toast({ title: t("subscription.recountSuccess"), description: t("subscription.recountSuccessDesc", { count: data.emails_used }) });
      } else throw new Error(data.error || "Erreur");
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    } finally {
      setRecountLoading(false);
    }
  };

  const handleRestoreSpam = async () => {
    setRestoreLoading(true);
    try {
      const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");
      const session = await (await import("@/lib/supabase")).supabase.auth.getSession();
      const accessToken = session.data.session?.access_token;
      const res = await fetch(`${baseUrl}/api/profile/restore-spam`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (data.ok) {
        toast({ title: t("subscription.restoreSpamSuccess"), description: t("subscription.restoreSpamSuccessDesc", { count: data.restored }) });
      } else throw new Error(data.error || "Erreur");
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    } finally {
      setRestoreLoading(false);
    }
  };

  const handlePortal = async () => {
    setPortalLoading(true);
    try {
      const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");
      const token = (await import("@/lib/supabase")).supabase.auth.getSession();
      const session = await token;
      const accessToken = session.data.session?.access_token;

      const res = await fetch(`${baseUrl}/api/paddle/portal`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (data.url) {
        window.open(data.url, "_blank");
      } else {
        throw new Error(data.error || "Erreur");
      }
    } catch {
      toast({
        title: t("common.error"),
        description: t("subscription.portalError"),
        variant: "destructive",
      });
    } finally {
      setPortalLoading(false);
    }
  };

  const hasPaidPlan = profile?.plan && profile.plan !== "essai" && profile.plan !== "expired";

  return (
    <DashboardLayout>
      <div className="p-5 max-w-6xl mx-auto w-full">
        <div className="mb-6 text-center max-w-2xl mx-auto">
          <h1 className="text-xl font-bold text-white tracking-tight mb-1.5">
            {t("subscription.title")}
          </h1>
          <p className="text-[12px] text-[#8b9cb3]">
            {t("subscription.subtitle")}
          </p>
        </div>

        {!isLoading && profile && (profile.plan === "expired" || (profile.plan === "essai" && profile.emailsUsed >= profile.emailsQuota)) && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-5 mb-6 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            <div>
              <p className="text-[14px] font-semibold text-red-400">
                {profile.plan === "expired"
                  ? t("dashboard.expiredSubscription")
                  : t("dashboard.trialEnded")}
              </p>
              <p className="text-[12px] text-[#8b9cb3] mt-0.5">
                {profile.plan === "expired"
                  ? t("dashboard.resubscribe")
                  : t("dashboard.trialUsed")}
              </p>
            </div>
          </div>
        )}

        {isLoading ? (
          <Skeleton className="h-20 w-full mb-8 rounded-lg bg-white/5" />
        ) : profile ? (
          <div className="bg-card rounded-lg border border-border p-5 mb-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-[14px] font-semibold text-white mb-0.5">
                {t("subscription.currentPlan")} :{" "}
                <span className={`capitalize ${profile.plan === "expired" ? "text-red-400" : "text-primary"}`}>
                  {profile.plan === "expired" ? t("subscription.expired") : profile.plan}
                </span>
              </h3>
              <p className="text-[12px] text-[#8b9cb3]">
                {t("subscription.renewalDate")}{" "}
                {new Date(
                  new Date().setMonth(new Date().getMonth() + 1)
                ).toLocaleDateString(i18n.language)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-full md:w-64">
                <div className="flex justify-between text-[12px] font-medium mb-1.5">
                  <span className="text-[#8b9cb3]">{t("subscription.aiConsumption")}</span>
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
                  {t("subscription.manageSubscription")}
                </Button>
              )}
            </div>
          </div>
        ) : null}

        {profile && (
          <div className="bg-card rounded-lg border border-border p-4 mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="text-[12px] text-[#8b9cb3] flex-1">
              {t("subscription.maintenanceHint")}
            </div>
            <div className="flex gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={handleRecount} disabled={recountLoading}>
                {recountLoading && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
                {t("subscription.recountQuota")}
              </Button>
              <Button variant="outline" size="sm" onClick={handleRestoreSpam} disabled={restoreLoading}>
                {restoreLoading && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
                {t("subscription.restoreSpam")}
              </Button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {plans.map((plan) => {
            const isCurrentPlan = profile?.plan === plan.id;
            const isBusiness = plan.hasSeats;
            const price = isBusiness
              ? (parseFloat(plan.price) * businessSeats).toFixed(2)
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
                      {t("subscription.currentPlanBadge")}
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
                    {plan.id === "essai" ? (
                      <span className="text-3xl font-extrabold text-white">{t("common.free")}</span>
                    ) : (
                      <>
                        <span className="text-3xl font-extrabold text-white">
                          {price}€
                        </span>
                        <span className="text-[#8b9cb3] text-[13px]">
                          {isBusiness ? "/ mois" : "/mois"}
                        </span>
                      </>
                    )}
                  </div>
                  {isBusiness && (
                    <p className="text-[11px] text-[#8b9cb3] mt-0.5">
                      {t("subscription.perSeatPerMonth")}
                    </p>
                  )}
                </div>

                {isBusiness && (
                  <div className="mb-4 p-3 bg-background rounded-lg border border-border">
                    <label className="text-[12px] font-medium text-[#8b9cb3] block mb-2">
                      {t("subscription.seatCount")}
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="3"
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
                      {businessSeats} {businessSeats > 1 ? t("subscription.collaborators") : t("subscription.collaborator")} ={" "}
                      {(businessSeats * 12.99).toFixed(2)}€/{t("common.perMonth").replace("/", "")}
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
                    {t("subscription.currentPlanBadge")}
                  </Button>
                ) : plan.id === "essai" ? (
                  <Button
                    variant="ghost"
                    className="w-full"
                    size="sm"
                    disabled
                  >
                    {profile?.plan === "essai" ? t("subscription.trialInProgress") : t("subscription.trialEnded")}
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
                    {isLoading ? t("common.redirecting") : t("subscription.changePlan")}
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-6 text-center">
          <p className="text-[12px] text-[#8b9cb3] leading-relaxed">
            {t("subscription.seatsExample")}
          </p>
        </div>

        <div className="mt-6 bg-card rounded-lg border border-border p-5">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-amber-500/10 text-amber-400 shrink-0">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-[14px] font-semibold text-white mb-1">
                {t("subscription.quotaOverage")}
              </h3>
              <p className="text-[12px] text-[#8b9cb3] leading-relaxed">
                {t("subscription.quotaOverageDesc")}
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
                {t("subscription.noCommitment")}
              </h3>
              <p className="text-[12px] text-[#8b9cb3] leading-relaxed">
                {t("subscription.noCommitmentDesc")}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-3 bg-card rounded-lg border border-border p-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-[14px] font-semibold text-white mb-1 flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              {t("subscription.securityTitle")}
            </h3>
            <p className="text-[12px] text-[#8b9cb3] max-w-2xl">
              {t("subscription.securityDesc")}
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
