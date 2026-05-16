import { useAdminPaddleMetrics, useGetProfile } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  CreditCard,
  TrendingUp,
  Users,
  ExternalLink,
  XCircle,
  AlertCircle,
} from "lucide-react";

interface ProfileWithAdmin {
  isAdmin?: boolean;
}

const PADDLE_DASHBOARD_URL = "https://vendors.paddle.com";

function formatEur(n: number): string {
  return n.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

export default function AdminPaddle() {
  const { data: profileData, isLoading: profileLoading } = useGetProfile();
  const profile = (profileData ?? {}) as ProfileWithAdmin;
  const isAdmin = !!profile.isAdmin;

  const { data, isLoading, refetch, isFetching, error } = useAdminPaddleMetrics();

  if (profileLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!isAdmin) return null;
  if (!data) {
    const errMsg =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "Réponse vide du serveur.";
    return (
      <Card className="bg-red-500/10 border-red-500/30">
        <CardContent className="pt-6 space-y-3">
          <div className="text-sm text-red-200">
            <b>Impossible de récupérer les métriques Paddle.</b>
            <div className="text-xs text-red-200/70 mt-1">{errMsg}</div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => refetch()}
            disabled={isFetching}
            className="border-red-500/50 text-red-200 hover:bg-red-500/10"
          >
            {isFetching ? (
              <Loader2 className="h-3 w-3 animate-spin mr-2" />
            ) : null}
            Réessayer
          </Button>
        </CardContent>
      </Card>
    );
  }

  const {
    paddleConfigured,
    webhookConfigured,
    priceIdsConfigured,
    plans,
    mrrTotal,
    arrTotal,
    activeSubscribers,
    trialUsers,
    expiredUsers,
    paddleApiError,
  } = data;
  const pastDueCount: number | null = data.pastDueCount ?? null;
  const pastDueCountCapped = !!data.pastDueCountCapped;
  const degraded = !!data.degraded;
  const degradedReason = data.degradedReason ?? null;

  const configOk =
    paddleConfigured &&
    webhookConfigured &&
    priceIdsConfigured.solo &&
    priceIdsConfigured.pro &&
    priceIdsConfigured.business;

  const conversionPct =
    trialUsers + activeSubscribers === 0
      ? 0
      : Math.round(
          (activeSubscribers / (trialUsers + activeSubscribers)) * 100,
        );
  const arpu =
    activeSubscribers === 0 ? 0 : Math.round((mrrTotal / activeSubscribers) * 100) / 100;

  return (
    <div className="space-y-4">
      {/* Bandeau données dégradées (priorité haute) */}
      {degraded && (
        <Card className="bg-red-500/10 border-red-500/30">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5 shrink-0" />
              <div className="space-y-1 flex-1">
                <div className="font-semibold text-white">
                  Données partielles — MRR potentiellement sous-estimé
                </div>
                <div className="text-xs text-red-200/80">
                  {degradedReason ??
                    "Au moins une requête de comptage par plan a échoué côté Supabase."}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bandeau santé config */}
      {configOk ? (
        <Card className="bg-emerald-500/10 border-emerald-500/30">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-400 mt-0.5 shrink-0" />
              <div className="space-y-1 flex-1">
                <div className="font-semibold text-white">
                  Configuration Paddle complète
                </div>
                <div className="text-sm text-[#b8c5d6]">
                  Clé API, webhook secret et les 3 price IDs (solo / pro / business)
                  sont bien configurés.
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => refetch()}
                disabled={isFetching}
                className="border-[#1f2937] text-[#b8c5d6]"
              >
                {isFetching ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  "Rafraîchir"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-amber-500/10 border-amber-500/30">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
              <div className="space-y-2 flex-1">
                <div className="font-semibold text-white">
                  Configuration Paddle incomplète
                </div>
                <ul className="text-sm text-[#b8c5d6] space-y-1">
                  {!paddleConfigured && (
                    <li>• <code className="text-xs">PADDLE_API_KEY</code> manquante</li>
                  )}
                  {!webhookConfigured && (
                    <li>• <code className="text-xs">PADDLE_WEBHOOK_SECRET</code> manquant</li>
                  )}
                  {!priceIdsConfigured.solo && (
                    <li>• <code className="text-xs">PADDLE_PRICE_SOLO</code> manquant</li>
                  )}
                  {!priceIdsConfigured.pro && (
                    <li>• <code className="text-xs">PADDLE_PRICE_PRO</code> manquant</li>
                  )}
                  {!priceIdsConfigured.business && (
                    <li>• <code className="text-xs">PADDLE_PRICE_BUSINESS</code> manquant</li>
                  )}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Métriques clés */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-[#0d1117] border-[#1f2937]">
          <CardContent className="pt-6">
            <div className="text-xs text-[#8b95a7] uppercase tracking-wide">MRR</div>
            <div className="text-2xl font-bold text-emerald-400 mt-1 tabular-nums">
              {formatEur(mrrTotal)}
            </div>
            <div className="text-[11px] text-[#6b7280] mt-1">revenu mensuel récurrent</div>
          </CardContent>
        </Card>
        <Card className="bg-[#0d1117] border-[#1f2937]">
          <CardContent className="pt-6">
            <div className="text-xs text-[#8b95a7] uppercase tracking-wide">ARR projeté</div>
            <div className="text-2xl font-bold text-white mt-1 tabular-nums">
              {formatEur(arrTotal)}
            </div>
            <div className="text-[11px] text-[#6b7280] mt-1">MRR × 12</div>
          </CardContent>
        </Card>
        <Card className="bg-[#0d1117] border-[#1f2937]">
          <CardContent className="pt-6">
            <div className="text-xs text-[#8b95a7] uppercase tracking-wide">Abonnés payants</div>
            <div className="text-2xl font-bold text-primary mt-1 tabular-nums">
              {activeSubscribers}
            </div>
            <div className="text-[11px] text-[#6b7280] mt-1">solo + pro + business</div>
          </CardContent>
        </Card>
        <Card className="bg-[#0d1117] border-[#1f2937]">
          <CardContent className="pt-6">
            <div className="text-xs text-[#8b95a7] uppercase tracking-wide">ARPU</div>
            <div className="text-2xl font-bold text-white mt-1 tabular-nums">
              {formatEur(arpu)}
            </div>
            <div className="text-[11px] text-[#6b7280] mt-1">revenu moyen / abonné</div>
          </CardContent>
        </Card>
      </div>

      {/* Funnel conversion */}
      <Card className="bg-[#0d1117] border-[#1f2937]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white text-base">
            <Users className="h-4 w-4 text-primary" />
            Funnel essai → payant
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded bg-amber-500/10 border border-amber-500/20 p-3">
              <div className="text-xs text-amber-300/70 uppercase tracking-wide">
                En essai
              </div>
              <div className="text-xl font-bold text-amber-300 mt-1 tabular-nums">
                {trialUsers}
              </div>
            </div>
            <div className="rounded bg-emerald-500/10 border border-emerald-500/20 p-3">
              <div className="text-xs text-emerald-300/70 uppercase tracking-wide">
                Payants
              </div>
              <div className="text-xl font-bold text-emerald-400 mt-1 tabular-nums">
                {activeSubscribers}
              </div>
            </div>
            <div className="rounded bg-[#161b22] border border-[#1f2937] p-3">
              <div className="text-xs text-[#8b95a7] uppercase tracking-wide">
                Conversion
              </div>
              <div className="text-xl font-bold text-white mt-1 tabular-nums">
                {conversionPct}%
              </div>
            </div>
          </div>
          <div className="mt-3 text-xs text-[#6b7280]">
            Calcul : abonnés payants / (essai + payants). Cible saine SaaS B2B :{" "}
            <b>≥ 15-20%</b>.
          </div>
        </CardContent>
      </Card>

      {/* Répartition par plan */}
      <Card className="bg-[#0d1117] border-[#1f2937]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white text-base">
            <TrendingUp className="h-4 w-4 text-primary" />
            Répartition par plan & contribution au MRR
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1f2937] text-[#8b95a7] text-xs uppercase">
                  <th className="text-left py-2 px-2 font-medium">Plan</th>
                  <th className="text-right py-2 px-2 font-medium">Abonnés</th>
                  <th className="text-right py-2 px-2 font-medium">Prix mensuel</th>
                  <th className="text-right py-2 px-2 font-medium">MRR contribué</th>
                  <th className="text-right py-2 px-2 font-medium">% du MRR</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((p) => {
                  const pct =
                    mrrTotal === 0 ? 0 : Math.round((p.mrrContribution / mrrTotal) * 100);
                  return (
                    <tr key={p.id} className="border-b border-[#1f2937]/50">
                      <td className="py-2 px-2 text-white font-medium">{p.label}</td>
                      <td className="py-2 px-2 text-right text-[#b8c5d6] tabular-nums">
                        {p.count}
                      </td>
                      <td className="py-2 px-2 text-right text-[#b8c5d6] tabular-nums">
                        {p.monthlyPrice === 0 ? "—" : formatEur(p.monthlyPrice)}
                      </td>
                      <td className="py-2 px-2 text-right text-white tabular-nums">
                        {formatEur(p.mrrContribution)}
                      </td>
                      <td className="py-2 px-2 text-right text-[#b8c5d6] tabular-nums">
                        {p.id === "essai" ? "—" : `${pct}%`}
                      </td>
                    </tr>
                  );
                })}
                <tr>
                  <td className="py-2 px-2 text-[#8b95a7] text-xs uppercase">Expirés</td>
                  <td className="py-2 px-2 text-right text-[#8b95a7] tabular-nums">
                    {expiredUsers}
                  </td>
                  <td colSpan={3} className="py-2 px-2 text-right text-[#6b7280] text-xs">
                    abonnement annulé ou échu
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr className="border-t border-[#1f2937]">
                  <td className="py-2 px-2 text-white font-semibold">Total MRR</td>
                  <td className="py-2 px-2 text-right text-white font-semibold tabular-nums">
                    {activeSubscribers}
                  </td>
                  <td />
                  <td className="py-2 px-2 text-right text-emerald-400 font-semibold tabular-nums">
                    {formatEur(mrrTotal)}
                  </td>
                  <td className="py-2 px-2 text-right text-[#8b95a7] tabular-nums">
                    100%
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="mt-3 text-xs text-[#6b7280]">
            Prix mensuels par défaut (modifiables côté backend dans{" "}
            <code className="text-[10px] bg-[#161b22] px-1 py-0.5 rounded">
              admin.ts PLAN_MONTHLY_PRICE_EUR
            </code>
            ) : Solo {formatEur(9)}, Pro {formatEur(29)}, Business {formatEur(79)}. À
            terme : pull depuis l'API Paddle (price objects) ou table de config admin.
          </div>
        </CardContent>
      </Card>

      {/* Alerte impayés */}
      <Card
        className={
          pastDueCount === null
            ? "bg-[#0d1117] border-[#1f2937]"
            : pastDueCount > 0
              ? "bg-red-500/10 border-red-500/30"
              : "bg-emerald-500/10 border-emerald-500/30"
        }
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white text-base">
            {pastDueCount === null ? (
              <AlertCircle className="h-4 w-4 text-[#8b95a7]" />
            ) : pastDueCount > 0 ? (
              <XCircle className="h-4 w-4 text-red-400" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            )}
            Paiements en échec (status past_due)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pastDueCount === null ? (
            <div className="text-sm text-[#8b95a7]">
              Indisponible — {paddleApiError ?? "API Paddle non joignable"}.
            </div>
          ) : pastDueCount > 0 ? (
            <div className="text-sm text-[#b8c5d6]">
              <b className="text-red-300">
                {pastDueCount}
                {pastDueCountCapped ? "+" : ""} abonnement(s)
              </b>{" "}
              en échec de paiement. Paddle relance automatiquement pendant ~14 jours
              puis annule. Ouvre Paddle pour voir le détail.
              {pastDueCountCapped && (
                <div className="text-[11px] text-red-300/70 mt-1">
                  ⚠ Compteur plafonné à {pastDueCount} — le total réel peut être
                  supérieur.
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-[#b8c5d6]">
              Aucun impayé en cours. 🎉
            </div>
          )}
        </CardContent>
      </Card>

      {/* Checklist + lien dashboard externe */}
      <Card className="bg-[#0d1117] border-[#1f2937]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white text-base">
            <CreditCard className="h-4 w-4 text-primary" />
            Actions & liens Paddle
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.open(PADDLE_DASHBOARD_URL, "_blank")}
              className="border-[#1f2937] text-[#b8c5d6]"
            >
              Dashboard Paddle
              <ExternalLink className="h-3 w-3 ml-2" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                window.open(
                  "https://vendors.paddle.com/subscriptions-v2",
                  "_blank",
                )
              }
              className="border-[#1f2937] text-[#b8c5d6]"
            >
              Abonnements
              <ExternalLink className="h-3 w-3 ml-2" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                window.open(
                  "https://vendors.paddle.com/transactions-v2",
                  "_blank",
                )
              }
              className="border-[#1f2937] text-[#b8c5d6]"
            >
              Transactions
              <ExternalLink className="h-3 w-3 ml-2" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                window.open(
                  "https://vendors.paddle.com/notifications-v2",
                  "_blank",
                )
              }
              className="border-[#1f2937] text-[#b8c5d6]"
            >
              Webhooks
              <ExternalLink className="h-3 w-3 ml-2" />
            </Button>
          </div>

          <ul className="space-y-2 text-sm text-[#b8c5d6] pt-2">
            <li className="flex gap-2">
              <span className="text-primary">•</span>
              <span>
                <b>Vérifier les webhooks chaque semaine</b> : si Paddle ne reçoit pas
                de 200 OK sur 3 retries consécutifs, il désactive l'endpoint
                silencieusement → MRR/abonnements deviennent désynchros.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary">•</span>
              <span>
                <b>Surveiller le past_due</b> : tag dans Paddle les clients en échec
                pour leur écrire un mail manuel après J+7.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary">•</span>
              <span>
                <b>Sous-onglet « Revenus » à venir</b> : montant facturé brut sur 30j
                + frais Paddle (~5% + 0.50€/tx) + ventilation par devise.
              </span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
