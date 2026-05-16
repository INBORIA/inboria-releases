import { useAdminProfitabilitySnapshot, useGetProfile } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  Loader2,
  TrendingUp,
  TrendingDown,
  PieChart,
  Users,
  BarChart3,
  Wallet,
} from "lucide-react";

interface ProfileWithAdmin {
  isAdmin?: boolean;
}

function fmtEur(n: number): string {
  return n.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  });
}
function fmtEur0(n: number): string {
  return n.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}
function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `${n}%`;
}

export default function AdminRentabilite() {
  const { data: profileData, isLoading: profileLoading } = useGetProfile();
  const profile = (profileData ?? {}) as ProfileWithAdmin;
  const isAdmin = !!profile.isAdmin;
  const { data, isLoading, refetch, isFetching, error } =
    useAdminProfitabilitySnapshot();

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
            <b>Impossible de calculer le P&L.</b>
            <div className="text-xs text-red-200/70 mt-1">{errMsg}</div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => refetch()}
            disabled={isFetching}
            className="border-red-500/50 text-red-200 hover:bg-red-500/10"
          >
            {isFetching ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : null}
            Réessayer
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { revenue, costs, margin, users, perUser, byPlan, meta, degraded, degradedReason } = data;

  const costRows = [
    { key: "supabase", label: "Supabase", val: costs.supabaseEur, color: "bg-emerald-500" },
    { key: "openai", label: "OpenAI", val: costs.openaiEur, color: "bg-sky-500" },
    { key: "paddle", label: "Frais Paddle", val: costs.paddleFeesEur, color: "bg-violet-500" },
    { key: "replit", label: "Replit", val: costs.replitEur, color: "bg-amber-500" },
    { key: "brevo", label: "Brevo", val: costs.brevoEur, color: "bg-rose-500" },
  ].sort((a, b) => b.val - a.val);

  const totalCost = costs.totalEur || 0.01;
  const isProfit = margin.grossEur >= 0;

  return (
    <div className="space-y-4">
      {degraded && (
        <Card className="bg-red-500/10 border-red-500/30">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5 shrink-0" />
              <div className="space-y-1 flex-1">
                <div className="font-semibold text-white">
                  Snapshot dégradé — chiffres potentiellement sous-estimés
                </div>
                <div className="text-xs text-red-200/80">
                  {degradedReason ?? "Une ou plusieurs sources n'ont pas répondu."}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bandeau P&L principal */}
      <Card
        className={
          isProfit
            ? "bg-emerald-500/10 border-emerald-500/30"
            : "bg-red-500/10 border-red-500/30"
        }
      >
        <CardContent className="pt-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-1">
              <div className="text-xs uppercase tracking-wide text-[#8b95a7] flex items-center gap-2">
                {isProfit ? (
                  <TrendingUp className="h-3 w-3 text-emerald-400" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-400" />
                )}
                Marge brute mensuelle
              </div>
              <div
                className={`text-4xl font-bold tabular-nums ${isProfit ? "text-emerald-400" : "text-red-400"}`}
              >
                {fmtEur(margin.grossEur)}
              </div>
              <div className="text-sm text-[#b8c5d6]">
                soit <b className={isProfit ? "text-emerald-300" : "text-red-300"}>{fmtPct(margin.grossPct)}</b> du MRR
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => refetch()}
              disabled={isFetching}
              className="border-[#1f2937] text-[#b8c5d6]"
            >
              {isFetching ? <Loader2 className="h-3 w-3 animate-spin" /> : "Rafraîchir"}
            </Button>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center text-sm">
            <div className="rounded bg-emerald-500/10 border border-emerald-500/20 px-3 py-2">
              <div className="text-[10px] uppercase text-emerald-300/70">Revenus</div>
              <div className="text-lg font-bold text-emerald-400 tabular-nums">
                {fmtEur0(revenue.mrrEur)}
              </div>
            </div>
            <div className="rounded bg-red-500/10 border border-red-500/20 px-3 py-2">
              <div className="text-[10px] uppercase text-red-300/70">− Coûts</div>
              <div className="text-lg font-bold text-red-400 tabular-nums">
                {fmtEur0(costs.totalEur)}
              </div>
            </div>
            <div
              className={`rounded border px-3 py-2 ${isProfit ? "bg-emerald-500/15 border-emerald-500/30" : "bg-red-500/15 border-red-500/30"}`}
            >
              <div className="text-[10px] uppercase text-[#8b95a7]">= Marge</div>
              <div
                className={`text-lg font-bold tabular-nums ${isProfit ? "text-emerald-300" : "text-red-300"}`}
              >
                {fmtEur0(margin.grossEur)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs par-utilisateur */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-[#0d1117] border-[#1f2937]">
          <CardContent className="pt-6">
            <div className="text-xs text-[#8b95a7] uppercase tracking-wide">ARPU</div>
            <div className="text-2xl font-bold text-emerald-400 mt-1 tabular-nums">
              {fmtEur(perUser.arpuEur)}
            </div>
            <div className="text-[11px] text-[#6b7280] mt-1">par abonné payant</div>
          </CardContent>
        </Card>
        <Card className="bg-[#0d1117] border-[#1f2937]">
          <CardContent className="pt-6">
            <div className="text-xs text-[#8b95a7] uppercase tracking-wide">Coût moyen / user</div>
            <div className="text-2xl font-bold text-red-400 mt-1 tabular-nums">
              {fmtEur(perUser.avgCostEur)}
            </div>
            <div className="text-[11px] text-[#6b7280] mt-1">
              sur {users.total} utilisateurs
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#0d1117] border-[#1f2937]">
          <CardContent className="pt-6">
            <div className="text-xs text-[#8b95a7] uppercase tracking-wide">
              Marge / user
            </div>
            <div
              className={`text-2xl font-bold mt-1 tabular-nums ${perUser.avgMarginEur >= 0 ? "text-emerald-400" : "text-red-400"}`}
            >
              {fmtEur(perUser.avgMarginEur)}
            </div>
            <div className="text-[11px] text-[#6b7280] mt-1">essai + payant inclus</div>
          </CardContent>
        </Card>
        <Card className="bg-[#0d1117] border-[#1f2937]">
          <CardContent className="pt-6">
            <div className="text-xs text-[#8b95a7] uppercase tracking-wide">Utilisateurs</div>
            <div className="text-2xl font-bold text-white mt-1 tabular-nums">
              {users.total}
            </div>
            <div className="text-[11px] text-[#6b7280] mt-1">
              {users.paying} payants · {users.trial} essai
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ventilation des coûts */}
      <Card className="bg-[#0d1117] border-[#1f2937]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white text-base">
            <PieChart className="h-4 w-4 text-primary" />
            Ventilation des coûts ({fmtEur0(costs.totalEur)} / mois)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {costRows.map((c) => {
              const pct = Math.round((c.val / totalCost) * 1000) / 10;
              return (
                <div key={c.key}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-[#b8c5d6]">{c.label}</span>
                    <span className="tabular-nums text-[#b8c5d6]">
                      {fmtEur(c.val)}{" "}
                      <span className="text-[11px] text-[#6b7280]">({pct}%)</span>
                    </span>
                  </div>
                  <div className="h-2 bg-[#161b22] rounded-full overflow-hidden">
                    <div
                      className={`h-full ${c.color}`}
                      style={{ width: `${Math.max(pct, 0.5)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 text-xs text-[#6b7280] space-y-1">
            <div>
              <b>OpenAI</b> : agrégé sur {costs.openaiSourceCount} logs des 30 derniers jours
              (≈ ${meta.openaiCostUsdRaw} USD → EUR via FX {meta.fxUsdToEur}).
            </div>
            <div>
              <b>Frais Paddle</b> : {meta.paddleFeeAssumption}.
            </div>
            <div>
              <b>Supabase / Replit / Brevo</b> : constantes ajustables via env
              <code className="text-[10px] bg-[#161b22] px-1 py-0.5 rounded ml-1">SUPABASE_MONTHLY_COST_EUR</code>{" "}
              <code className="text-[10px] bg-[#161b22] px-1 py-0.5 rounded">REPLIT_MONTHLY_COST_EUR</code>{" "}
              <code className="text-[10px] bg-[#161b22] px-1 py-0.5 rounded">BREVO_MONTHLY_COST_EUR</code>.
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rentabilité par plan */}
      <Card className="bg-[#0d1117] border-[#1f2937]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white text-base">
            <BarChart3 className="h-4 w-4 text-primary" />
            Rentabilité par plan
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1f2937] text-[#8b95a7] text-xs uppercase">
                  <th className="text-left py-2 px-2 font-medium">Plan</th>
                  <th className="text-right py-2 px-2 font-medium">Abonnés</th>
                  <th className="text-right py-2 px-2 font-medium">Prix</th>
                  <th className="text-right py-2 px-2 font-medium">Revenus</th>
                  <th className="text-right py-2 px-2 font-medium">Coûts alloués</th>
                  <th className="text-right py-2 px-2 font-medium">Marge</th>
                  <th className="text-right py-2 px-2 font-medium">Marge %</th>
                </tr>
              </thead>
              <tbody>
                {byPlan.map((p) => {
                  const pos = p.marginEur >= 0;
                  return (
                    <tr key={p.id} className="border-b border-[#1f2937]/50">
                      <td className="py-2 px-2 text-white font-medium">{p.label}</td>
                      <td className="py-2 px-2 text-right text-[#b8c5d6] tabular-nums">
                        {p.count}
                      </td>
                      <td className="py-2 px-2 text-right text-[#b8c5d6] tabular-nums">
                        {p.monthlyPriceEur === 0 ? "—" : fmtEur0(p.monthlyPriceEur)}
                      </td>
                      <td className="py-2 px-2 text-right text-emerald-400 tabular-nums">
                        {fmtEur(p.revenueEur)}
                      </td>
                      <td className="py-2 px-2 text-right text-red-300 tabular-nums">
                        {fmtEur(p.allocatedCostEur)}
                      </td>
                      <td
                        className={`py-2 px-2 text-right font-semibold tabular-nums ${pos ? "text-emerald-300" : "text-red-300"}`}
                      >
                        {fmtEur(p.marginEur)}
                      </td>
                      <td
                        className={`py-2 px-2 text-right tabular-nums ${pos ? "text-emerald-400" : "text-red-400"}`}
                      >
                        {p.marginPct === null ? "—" : `${p.marginPct}%`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-[#1f2937]">
                  <td className="py-2 px-2 text-white font-semibold">Total</td>
                  <td className="py-2 px-2 text-right text-white font-semibold tabular-nums">
                    {users.total}
                  </td>
                  <td />
                  <td className="py-2 px-2 text-right text-emerald-400 font-semibold tabular-nums">
                    {fmtEur(revenue.mrrEur)}
                  </td>
                  <td className="py-2 px-2 text-right text-red-300 font-semibold tabular-nums">
                    {fmtEur(costs.totalEur)}
                  </td>
                  <td
                    className={`py-2 px-2 text-right font-semibold tabular-nums ${isProfit ? "text-emerald-300" : "text-red-300"}`}
                  >
                    {fmtEur(margin.grossEur)}
                  </td>
                  <td
                    className={`py-2 px-2 text-right font-semibold tabular-nums ${isProfit ? "text-emerald-400" : "text-red-400"}`}
                  >
                    {fmtPct(margin.grossPct)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="mt-3 text-xs text-[#6b7280]">
            Méthode d'allocation : coûts fixes (Supabase/Replit/Brevo) répartis au
            prorata du nombre d'utilisateurs ; coût OpenAI variable réparti
            uniformément (essai inclus, car ils consomment autant voire plus que
            les payants) ; frais Paddle attribués uniquement aux payants.
          </div>
        </CardContent>
      </Card>

      {/* Pistes d'action */}
      <Card className="bg-[#0d1117] border-[#1f2937]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white text-base">
            <Wallet className="h-4 w-4 text-primary" />
            Pistes pour améliorer la marge
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-[#b8c5d6]">
            <li className="flex gap-2">
              <Users className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span>
                <b>Convertir l'essai</b> : chaque essai coûte ~{fmtEur(perUser.avgCostEur)} sans rapporter.
                Atteindre 20%+ de conversion change radicalement le P&L.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary mt-1">•</span>
              <span>
                <b>Pricing essai limité</b> : capper l'usage OpenAI gratuit (ex : 50 mails IA / mois)
                pour éviter qu'un essai non converti coûte plus cher qu'un Solo.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary mt-1">•</span>
              <span>
                <b>Router gpt-4o-mini par défaut</b> : 10× moins cher que gpt-4o pour la triage / résumé.
                Garder gpt-4o uniquement pour les drafts complexes Pro/Business.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary mt-1">•</span>
              <span>
                <b>Upsell Business</b> : marge unitaire ~3× supérieure au Solo grâce au prix fixe vs coûts quasi-stables.
              </span>
            </li>
          </ul>
        </CardContent>
      </Card>

      <div className="text-[11px] text-[#6b7280] text-right">
        Snapshot généré le {new Date(meta.generatedAt).toLocaleString("fr-FR")} —
        période OpenAI : {meta.periodDays}j glissants.
      </div>
    </div>
  );
}
