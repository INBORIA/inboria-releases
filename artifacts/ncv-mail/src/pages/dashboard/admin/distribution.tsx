import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Apple, Smartphone, ShieldCheck, ExternalLink, Info } from "lucide-react";
import { DISTRIBUTION_COSTS, useDistributionActive, type DistributionPlatform } from "@/lib/distribution-costs";

const ICONS: Record<DistributionPlatform, React.ComponentType<{ className?: string }>> = {
  "apple-developer": Apple,
  "google-play": Smartphone,
  "windows-signing": ShieldCheck,
};

function fmtUsd(n: number, fractionDigits = 2): string {
  return n.toLocaleString("fr-FR", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

export default function AdminDistribution() {
  const { active, toggle } = useDistributionActive();
  const items = (Object.keys(DISTRIBUTION_COSTS) as DistributionPlatform[]).map((k) => DISTRIBUTION_COSTS[k]);
  const totalMonthlyUsd = items.reduce((sum, it) => (active[it.key] ? sum + it.monthlyCostUsd : sum), 0);
  const totalYearlyUsd = items.reduce((sum, it) => {
    if (!active[it.key]) return sum;
    return sum + (it.pricingPeriod === "annual" ? it.pricingUsd : it.pricingUsd / (it.amortizationMonths / 12));
  }, 0);

  return (
    <div className="space-y-4">
      <Card className="bg-[#0d1117] border-[#1f2937]">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div className="space-y-1 flex-1 text-sm text-[#b8c5d6]">
              <div className="font-semibold text-white">Distribution — coûts cartes d'entrée plateformes</div>
              <div className="text-xs text-[#8b95a7]">
                Active une plateforme dès que tu as souscrit le compte / certificat correspondant
                (au nom de la société Estonie de préférence). Les coûts actifs s'ajoutent
                automatiquement au P&L dans l'onglet « Résultat ».
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {items.map((item) => {
          const Icon = ICONS[item.key];
          const isActive = active[item.key];
          return (
            <Card
              key={item.key}
              className={`border ${isActive ? "bg-emerald-500/5 border-emerald-500/30" : "bg-[#0d1117] border-[#1f2937]"}`}
              data-testid={`card-distribution-${item.key}`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-5 w-5 ${isActive ? "text-emerald-400" : "text-[#8b95a7]"}`} />
                    <CardTitle className="text-white text-base">{item.label}</CardTitle>
                  </div>
                  <Switch
                    checked={isActive}
                    onCheckedChange={(v) => toggle(item.key, v)}
                    data-testid={`switch-distribution-${item.key}`}
                  />
                </div>
                <div className="text-[11px] text-[#6b7280]">{item.vendor}</div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-xs text-[#b8c5d6]">{item.description}</div>
                <div className="space-y-1">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] uppercase text-[#8b95a7]">Tarif</span>
                    <span className="text-lg font-bold text-white tabular-nums">
                      {fmtUsd(item.pricingUsd, 0)}{" "}
                      <span className="text-[11px] font-normal text-[#8b95a7]">
                        {item.pricingPeriod === "annual" ? "/ an" : "one-shot"}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] uppercase text-[#8b95a7]">Lissé / mois</span>
                    <span className="text-sm text-[#b8c5d6] tabular-nums">
                      {fmtUsd(item.monthlyCostUsd)}
                      {item.pricingPeriod === "one-shot" && (
                        <span className="text-[10px] text-[#6b7280] ml-1">
                          (amorti {item.amortizationMonths} mois)
                        </span>
                      )}
                    </span>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  asChild
                  className="w-full border-[#1f2937] text-[#b8c5d6] hover:bg-white/[0.04]"
                >
                  <a href={item.url} target="_blank" rel="noopener noreferrer">
                    Portail souscription
                    <ExternalLink className="h-3 w-3 ml-1.5" />
                  </a>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="bg-[#0d1117] border-[#1f2937]">
        <CardHeader>
          <CardTitle className="text-white text-base">Récapitulatif</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded bg-[#161b22] border border-[#1f2937] px-3 py-2">
              <div className="text-[10px] uppercase text-[#8b95a7]">Coût mensuel actif (lissé)</div>
              <div className="text-2xl font-bold text-white tabular-nums">{fmtUsd(totalMonthlyUsd)}</div>
            </div>
            <div className="rounded bg-[#161b22] border border-[#1f2937] px-3 py-2">
              <div className="text-[10px] uppercase text-[#8b95a7]">Coût annuel actif</div>
              <div className="text-2xl font-bold text-white tabular-nums">{fmtUsd(totalYearlyUsd, 0)}</div>
            </div>
          </div>
          <div className="mt-3 text-xs text-[#6b7280]">
            Les montants sont en USD (devise des fournisseurs). La conversion EUR pour le P&L
            « Résultat » utilise le même FX que le reste de l'admin (
            <code className="text-[10px] bg-[#161b22] px-1 py-0.5 rounded">meta.fxUsdToEur</code>).
            Le toggle est stocké localement (localStorage), partagé entre tes onglets du même
            navigateur. Pour persister cross-device, on migrera vers la base si tu veux.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
