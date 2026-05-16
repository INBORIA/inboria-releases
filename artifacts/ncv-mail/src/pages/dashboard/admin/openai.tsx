import { useAdminOpenAIMetrics, useGetProfile } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Sparkles,
  ExternalLink,
  XCircle,
  TrendingUp,
} from "lucide-react";

interface ProfileWithAdmin {
  isAdmin?: boolean;
}

function fmtInt(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("fr-FR");
}
function fmtUsd(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `$${n.toFixed(4)}`;
}
function fmtUsd2(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `$${n.toFixed(2)}`;
}

export default function AdminOpenAI() {
  const { data: profileData, isLoading: profileLoading } = useGetProfile();
  const profile = (profileData ?? {}) as ProfileWithAdmin;
  const isAdmin = !!profile.isAdmin;
  const { data, isLoading, refetch, isFetching, error } = useAdminOpenAIMetrics();

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
            <b>Impossible de récupérer les métriques OpenAI.</b>
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

  const { configured, modelsReachable, errorMessage, pricingCoverage, last30 } = data;

  return (
    <div className="space-y-4">
      {/* Bandeau santé clé */}
      {configured && modelsReachable ? (
        <Card className="bg-emerald-500/10 border-emerald-500/30">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-400 mt-0.5 shrink-0" />
              <div className="space-y-1 flex-1">
                <div className="font-semibold text-white">
                  Clé OpenAI fonctionnelle
                </div>
                <div className="text-sm text-[#b8c5d6]">
                  Liste des modèles accessibles confirmée.
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
          </CardContent>
        </Card>
      ) : !configured ? (
        <Card className="bg-amber-500/10 border-amber-500/30">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
              <div className="space-y-1 flex-1">
                <div className="font-semibold text-white">
                  Clé OpenAI non configurée
                </div>
                <div className="text-sm text-[#b8c5d6]">
                  <code className="text-xs">OPENAI_API_KEY</code> manquante — toutes les fonctions IA seront en panne.
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-red-500/10 border-red-500/30">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <XCircle className="h-5 w-5 text-red-400 mt-0.5 shrink-0" />
              <div className="space-y-1 flex-1">
                <div className="font-semibold text-white">
                  Clé OpenAI invalide ou bloquée
                </div>
                <div className="text-sm text-red-200/80">
                  {errorMessage ?? "Erreur inconnue à l'appel /v1/models."}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPIs 30j */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-[#0d1117] border-[#1f2937]">
          <CardContent className="pt-6">
            <div className="text-xs text-[#8b95a7] uppercase tracking-wide">Requêtes chat 30j</div>
            <div className="text-2xl font-bold text-white mt-1 tabular-nums">
              {fmtInt(last30?.totalRequests)}
            </div>
            <div className="text-[11px] text-[#6b7280] mt-1">via inboria_chat_logs</div>
          </CardContent>
        </Card>
        <Card className="bg-[#0d1117] border-[#1f2937]">
          <CardContent className="pt-6">
            <div className="text-xs text-[#8b95a7] uppercase tracking-wide">Coût estimé 30j</div>
            <div className="text-2xl font-bold text-emerald-400 mt-1 tabular-nums">
              {fmtUsd2(last30?.totalEstimatedCostUsd)}
            </div>
            <div className="text-[11px] text-[#6b7280] mt-1">chat uniquement, hors embeddings</div>
          </CardContent>
        </Card>
        <Card className="bg-[#0d1117] border-[#1f2937]">
          <CardContent className="pt-6">
            <div className="text-xs text-[#8b95a7] uppercase tracking-wide">Taux fallback</div>
            <div className={`text-2xl font-bold mt-1 tabular-nums ${last30 && last30.fallbackRate > 10 ? "text-red-400" : "text-amber-300"}`}>
              {last30 ? `${last30.fallbackRate}%` : "—"}
            </div>
            <div className="text-[11px] text-[#6b7280] mt-1">
              {fmtInt(last30?.fallbackCount)} requêtes
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#0d1117] border-[#1f2937]">
          <CardContent className="pt-6">
            <div className="text-xs text-[#8b95a7] uppercase tracking-wide">Reformulations</div>
            <div className="text-2xl font-bold text-[#b8c5d6] mt-1 tabular-nums">
              {last30 ? `${last30.reformulationRate}%` : "—"}
            </div>
            <div className="text-[11px] text-[#6b7280] mt-1">
              signal d'insatisfaction implicite
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Détail par modèle */}
      <Card className="bg-[#0d1117] border-[#1f2937]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white text-base">
            <TrendingUp className="h-4 w-4 text-primary" />
            Usage chat par modèle — 30 derniers jours
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!last30 || last30.byModel.length === 0 ? (
            <div className="text-sm text-[#8b95a7]">
              Aucune donnée. La table <code className="text-[11px]">inboria_chat_logs</code> est peut-être absente ou vide sur 30j.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1f2937] text-[#8b95a7] text-xs uppercase">
                    <th className="text-left py-2 px-2 font-medium">Modèle</th>
                    <th className="text-right py-2 px-2 font-medium">Requêtes</th>
                    <th className="text-right py-2 px-2 font-medium">Latence moy.</th>
                    <th className="text-right py-2 px-2 font-medium">Longueur réponse</th>
                    <th className="text-right py-2 px-2 font-medium">Coût estimé</th>
                  </tr>
                </thead>
                <tbody>
                  {last30.byModel.map((m) => {
                    const hasPricing = pricingCoverage.includes(m.model);
                    return (
                      <tr key={m.model} className="border-b border-[#1f2937]/50">
                        <td className="py-2 px-2 text-white font-medium">
                          {m.model}
                          {!hasPricing && (
                            <span
                              className="ml-2 text-[10px] text-amber-400"
                              title="Pas de tarif configuré pour ce modèle"
                            >
                              (pricing inconnu)
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-right text-[#b8c5d6] tabular-nums">
                          {fmtInt(m.count)}
                        </td>
                        <td className="py-2 px-2 text-right text-[#b8c5d6] tabular-nums">
                          {fmtInt(m.avgLatencyMs)} ms
                        </td>
                        <td className="py-2 px-2 text-right text-[#b8c5d6] tabular-nums">
                          {fmtInt(m.avgResponseLen)} car.
                        </td>
                        <td className="py-2 px-2 text-right text-emerald-400 tabular-nums">
                          {hasPricing ? fmtUsd(m.estimatedCostUsd) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-[#1f2937]">
                    <td className="py-2 px-2 text-white font-semibold">Total</td>
                    <td className="py-2 px-2 text-right text-white font-semibold tabular-nums">
                      {fmtInt(last30.totalRequests)}
                    </td>
                    <td colSpan={2} />
                    <td className="py-2 px-2 text-right text-emerald-400 font-semibold tabular-nums">
                      {fmtUsd2(last30.totalEstimatedCostUsd)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
          <div className="mt-3 text-xs text-[#6b7280]">
            Coût estimé sur la base des prix officiels OpenAI (in/out par 1k tokens) avec une approximation <b>~1 token = 4 caractères</b>. Hors embeddings <code className="text-[10px]">text-embedding-3-small</code> (budgétés séparément via <code className="text-[10px]">EMAIL_EMBED_DAILY_BUDGET_USD</code>).
          </div>
        </CardContent>
      </Card>

      {/* Liens externes */}
      <Card className="bg-[#0d1117] border-[#1f2937]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            Liens OpenAI
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.open("https://platform.openai.com/usage", "_blank")}
              className="border-[#1f2937] text-[#b8c5d6]"
            >
              Usage & coûts réels
              <ExternalLink className="h-3 w-3 ml-2" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.open("https://platform.openai.com/account/limits", "_blank")}
              className="border-[#1f2937] text-[#b8c5d6]"
            >
              Limites & quotas
              <ExternalLink className="h-3 w-3 ml-2" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.open("https://platform.openai.com/api-keys", "_blank")}
              className="border-[#1f2937] text-[#b8c5d6]"
            >
              Clés API
              <ExternalLink className="h-3 w-3 ml-2" />
            </Button>
          </div>

          <ul className="space-y-2 text-sm text-[#b8c5d6] pt-2">
            <li className="flex gap-2">
              <span className="text-primary">•</span>
              <span>
                <b>Le coût affiché est une estimation</b> basée sur nos logs internes. Le chiffre officiel facturé est sur platform.openai.com → Usage.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary">•</span>
              <span>
                <b>Taux de fallback ≥ 10%</b> → soit modèle trop faible, soit prompt système à revoir, soit corpus user trop bruité.
              </span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
