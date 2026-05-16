import { useAdminBrevoMetrics, useGetProfile } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Mail,
  ExternalLink,
  Send,
} from "lucide-react";

interface ProfileWithAdmin {
  isAdmin?: boolean;
}

const BREVO_DASHBOARD_URL = "https://app.brevo.com";

function fmtInt(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("fr-FR");
}

export default function AdminBrevo() {
  const { data: profileData, isLoading: profileLoading } = useGetProfile();
  const profile = (profileData ?? {}) as ProfileWithAdmin;
  const isAdmin = !!profile.isAdmin;
  const { data, isLoading, refetch, isFetching, error } = useAdminBrevoMetrics();

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
            <b>Impossible de récupérer les métriques Brevo.</b>
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

  const {
    configured,
    smtpConfigured,
    accountEmail,
    planType,
    emailCredits,
    smsCredits,
    last30,
    errorMessage,
  } = data;

  return (
    <div className="space-y-4">
      {/* Bandeau santé config */}
      {configured ? (
        <Card className="bg-emerald-500/10 border-emerald-500/30">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-400 mt-0.5 shrink-0" />
              <div className="space-y-1 flex-1">
                <div className="font-semibold text-white">
                  Configuration Brevo OK
                </div>
                <div className="text-sm text-[#b8c5d6]">
                  Clé API présente. {smtpConfigured ? "SMTP également configuré." : "SMTP non configuré (transactionnel via API uniquement)."}
                </div>
                {accountEmail && (
                  <div className="text-xs text-[#8b95a7]">
                    Compte : <code className="text-[11px]">{accountEmail}</code>
                  </div>
                )}
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
      ) : (
        <Card className="bg-amber-500/10 border-amber-500/30">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
              <div className="space-y-2 flex-1">
                <div className="font-semibold text-white">
                  Configuration Brevo incomplète
                </div>
                <div className="text-sm text-[#b8c5d6]">
                  <code className="text-xs">BREVO_API_KEY</code> non définie — aucun mail transactionnel ne pourra partir.
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {errorMessage && configured && (
        <Card className="bg-amber-500/10 border-amber-500/30">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
              <div className="text-sm text-amber-200">
                Données partielles : <span className="text-xs">{errorMessage}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Plan & crédits */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-[#0d1117] border-[#1f2937]">
          <CardContent className="pt-6">
            <div className="text-xs text-[#8b95a7] uppercase tracking-wide">Plan</div>
            <div className="text-2xl font-bold text-white mt-1">
              {planType ?? "—"}
            </div>
            <div className="text-[11px] text-[#6b7280] mt-1">type d'abonnement</div>
          </CardContent>
        </Card>
        <Card className="bg-[#0d1117] border-[#1f2937]">
          <CardContent className="pt-6">
            <div className="text-xs text-[#8b95a7] uppercase tracking-wide">
              Crédits emails
            </div>
            <div className="text-2xl font-bold text-emerald-400 mt-1 tabular-nums">
              {fmtInt(emailCredits)}
            </div>
            <div className="text-[11px] text-[#6b7280] mt-1">restants ce mois</div>
          </CardContent>
        </Card>
        <Card className="bg-[#0d1117] border-[#1f2937]">
          <CardContent className="pt-6">
            <div className="text-xs text-[#8b95a7] uppercase tracking-wide">
              Crédits SMS
            </div>
            <div className="text-2xl font-bold text-white mt-1 tabular-nums">
              {fmtInt(smsCredits)}
            </div>
            <div className="text-[11px] text-[#6b7280] mt-1">non utilisé</div>
          </CardContent>
        </Card>
        <Card className="bg-[#0d1117] border-[#1f2937]">
          <CardContent className="pt-6">
            <div className="text-xs text-[#8b95a7] uppercase tracking-wide">
              Taux livraison 30j
            </div>
            <div className="text-2xl font-bold text-primary mt-1 tabular-nums">
              {last30 ? `${last30.deliveryRate}%` : "—"}
            </div>
            <div className="text-[11px] text-[#6b7280] mt-1">delivered / requests</div>
          </CardContent>
        </Card>
      </div>

      {/* Stats 30j */}
      <Card className="bg-[#0d1117] border-[#1f2937]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white text-base">
            <Send className="h-4 w-4 text-primary" />
            Volume transactionnel — 30 derniers jours
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!last30 ? (
            <div className="text-sm text-[#8b95a7]">
              Statistiques indisponibles.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1f2937] text-[#8b95a7] text-xs uppercase">
                    <th className="text-left py-2 px-2 font-medium">Indicateur</th>
                    <th className="text-right py-2 px-2 font-medium">Valeur</th>
                    <th className="text-right py-2 px-2 font-medium">% requests</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: "Requests", val: last30.requests, color: "text-white" },
                    { label: "Délivrés", val: last30.delivered, color: "text-emerald-400" },
                    { label: "Hard bounces", val: last30.hardBounces, color: "text-red-300" },
                    { label: "Soft bounces", val: last30.softBounces, color: "text-amber-300" },
                    { label: "Plaintes (spam)", val: last30.complaints, color: "text-red-400" },
                    { label: "Bloqués", val: last30.blocked, color: "text-[#8b95a7]" },
                  ].map((r) => {
                    const pct =
                      last30.requests === 0
                        ? 0
                        : Math.round((r.val / last30.requests) * 1000) / 10;
                    return (
                      <tr key={r.label} className="border-b border-[#1f2937]/50">
                        <td className="py-2 px-2 text-[#b8c5d6]">{r.label}</td>
                        <td className={`py-2 px-2 text-right tabular-nums ${r.color}`}>
                          {fmtInt(r.val)}
                        </td>
                        <td className="py-2 px-2 text-right text-[#8b95a7] tabular-nums">
                          {r.label === "Requests" ? "—" : `${pct}%`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Liens externes */}
      <Card className="bg-[#0d1117] border-[#1f2937]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white text-base">
            <Mail className="h-4 w-4 text-primary" />
            Liens Brevo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.open(BREVO_DASHBOARD_URL, "_blank")}
              className="border-[#1f2937] text-[#b8c5d6]"
            >
              Dashboard Brevo
              <ExternalLink className="h-3 w-3 ml-2" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.open("https://app.brevo.com/statistics/email", "_blank")}
              className="border-[#1f2937] text-[#b8c5d6]"
            >
              Stats détaillées
              <ExternalLink className="h-3 w-3 ml-2" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.open("https://app.brevo.com/contact/index/blocked", "_blank")}
              className="border-[#1f2937] text-[#b8c5d6]"
            >
              Contacts bloqués
              <ExternalLink className="h-3 w-3 ml-2" />
            </Button>
          </div>

          <ul className="space-y-2 text-sm text-[#b8c5d6] pt-2">
            <li className="flex gap-2">
              <span className="text-primary">•</span>
              <span>
                <b>Surveiller le taux de livraison</b> : viser ≥ 95%. En dessous → vérifier DKIM/SPF/DMARC + warm-up de l'IP dédiée.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary">•</span>
              <span>
                <b>Plaintes {'>'} 0.1%</b> = risque blacklist. Auditer le contenu et les listes d'envoi.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary">•</span>
              <span>
                <b>Hard bounces</b> : nettoyer la base, ces adresses sont permanentes.
              </span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
