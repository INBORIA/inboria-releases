import { useAdminListUsers, useGetProfile } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Server,
  TrendingUp,
  ExternalLink,
  Database,
  HardDrive,
  Activity,
} from "lucide-react";
import { useEffect, useState } from "react";

interface ProfileWithAdmin {
  isAdmin?: boolean;
}

type ComputeTier = "nano" | "micro" | "small" | "medium" | "large" | "xl";

interface TierInfo {
  id: ComputeTier;
  label: string;
  ram: string;
  cpu: string;
  pricePerMonth: number;
  maxRecommendedUsers: number;
}

const TIERS: TierInfo[] = [
  { id: "nano", label: "Nano", ram: "0.5 GB", cpu: "Partagé", pricePerMonth: 0, maxRecommendedUsers: 20 },
  { id: "micro", label: "Micro", ram: "1 GB", cpu: "2-core ARM", pricePerMonth: 10, maxRecommendedUsers: 60 },
  { id: "small", label: "Small", ram: "2 GB", cpu: "2-core ARM", pricePerMonth: 15, maxRecommendedUsers: 150 },
  { id: "medium", label: "Medium", ram: "4 GB", cpu: "2-core ARM", pricePerMonth: 60, maxRecommendedUsers: 350 },
  { id: "large", label: "Large", ram: "8 GB", cpu: "2-core ARM", pricePerMonth: 110, maxRecommendedUsers: 800 },
  { id: "xl", label: "XL", ram: "16 GB", cpu: "4-core ARM", pricePerMonth: 210, maxRecommendedUsers: 2000 },
];

const TIER_STORAGE_KEY = "inboria.admin.supabaseTier";

// Plancher de fiabilité prod : dès qu'il y a au moins 1 client payant,
// Nano est trop fragile (Disk IO partagé, incidents reboot constatés).
// On force Small minimum pour SLA acceptable.
const MIN_PROD_TIER: ComputeTier = "small";

function recommendTier(activeUsers: number, hasPayingCustomers: boolean): TierInfo {
  let chosen: TierInfo = TIERS[TIERS.length - 1];
  for (const tier of TIERS) {
    if (activeUsers <= tier.maxRecommendedUsers) {
      chosen = tier;
      break;
    }
  }
  if (hasPayingCustomers && tierRank(chosen.id) < tierRank(MIN_PROD_TIER)) {
    return TIERS.find((t) => t.id === MIN_PROD_TIER)!;
  }
  return chosen;
}

function tierRank(id: ComputeTier): number {
  return TIERS.findIndex((t) => t.id === id);
}

export default function AdminSupabase() {
  const { data: profileData, isLoading: profileLoading } = useGetProfile();
  const profile = (profileData ?? {}) as ProfileWithAdmin;
  const isAdmin = !!profile.isAdmin;

  const [currentTier, setCurrentTier] = useState<ComputeTier>("nano");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(TIER_STORAGE_KEY) as ComputeTier | null;
    if (stored && TIERS.some((t) => t.id === stored)) setCurrentTier(stored);
  }, []);

  function handleTierChange(value: string) {
    const next = value as ComputeTier;
    setCurrentTier(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(TIER_STORAGE_KEY, next);
    }
  }

  // Récup uniquement le total — on demande limit=1 pour ne pas charger 1000 lignes
  const { data: allUsers, isLoading: loadingAll } = useAdminListUsers({ page: 1, limit: 1 });
  const { data: payingUsers, isLoading: loadingPaying } = useAdminListUsers({ page: 1, limit: 1, plan: "pro" });
  const { data: businessUsers, isLoading: loadingBusiness } = useAdminListUsers({ page: 1, limit: 1, plan: "business" });
  const { data: essaiUsers, isLoading: loadingEssai } = useAdminListUsers({ page: 1, limit: 1, plan: "essai" });

  const loading = profileLoading || loadingAll || loadingPaying || loadingBusiness || loadingEssai;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) return null;

  const totalUsers = allUsers?.total ?? 0;
  const paying = (payingUsers?.total ?? 0) + (businessUsers?.total ?? 0);
  const trial = essaiUsers?.total ?? 0;
  const activeUsers = paying + trial; // base de calcul charge réelle

  const currentTierInfo = TIERS.find((t) => t.id === currentTier)!;
  const recommendedTier = recommendTier(activeUsers, paying > 0);
  const needsUpgrade = tierRank(recommendedTier.id) > tierRank(currentTier);
  const upgradeCost = recommendedTier.pricePerMonth - currentTierInfo.pricePerMonth;
  const usagePct = Math.min(
    100,
    Math.round((activeUsers / Math.max(1, currentTierInfo.maxRecommendedUsers)) * 100),
  );

  // Coût mensuel estimé du compute Supabase actuel
  const baseSupabaseCost = 25; // Pro plan
  const computeCost = currentTierInfo.pricePerMonth;
  const totalEstSupabase = baseSupabaseCost + (currentTier === "nano" ? 0 : computeCost);

  return (
    <div className="space-y-4">
      {/* Bandeau alerte si upgrade nécessaire */}
      {needsUpgrade ? (
        <Card className="bg-amber-500/10 border-amber-500/30">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
              <div className="space-y-2 flex-1">
                <div className="font-semibold text-white">
                  Upgrade Supabase recommandé
                </div>
                <div className="text-sm text-[#b8c5d6]">
                  Avec {activeUsers} abonnés actifs, le compute <b>{currentTierInfo.label}</b> risque
                  d'être saturé (RAM/IO). Passer à <b>{recommendedTier.label}</b> coûte{" "}
                  <b>+{upgradeCost}$/mois</b> et te protège des restart Postgres incontrôlés
                  (= incidents type 16/05/2026, downtime auth 2h+).
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-amber-500/50 text-amber-300 hover:bg-amber-500/10"
                  onClick={() =>
                    window.open(
                      "https://supabase.com/dashboard/project/ecdwevvisbrcsomdiqop/settings/compute-and-disk",
                      "_blank",
                    )
                  }
                >
                  Ouvrir Supabase Compute Settings
                  <ExternalLink className="h-3 w-3 ml-2" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-emerald-500/10 border-emerald-500/30">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-400 mt-0.5 shrink-0" />
              <div className="space-y-1 flex-1">
                <div className="font-semibold text-white">
                  Infrastructure dimensionnée correctement
                </div>
                <div className="text-sm text-[#b8c5d6]">
                  Avec {activeUsers} abonnés actifs, le compute <b>{currentTierInfo.label}</b> est
                  adapté. Marge avant prochain palier : {currentTierInfo.maxRecommendedUsers - activeUsers}{" "}
                  abonnés (~{Math.max(1, Math.round((currentTierInfo.maxRecommendedUsers - activeUsers) / 30))}{" "}
                  mois à 30 nouveaux/mois).
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Métriques clés */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card className="bg-[#0d1117] border-[#1f2937]">
          <CardContent className="pt-6">
            <div className="text-xs text-[#8b95a7] uppercase tracking-wide">Total comptes</div>
            <div className="text-2xl font-bold text-white mt-1">{totalUsers}</div>
            <div className="text-[11px] text-[#6b7280] mt-1">tous statuts confondus</div>
          </CardContent>
        </Card>
        <Card className="bg-[#0d1117] border-[#1f2937]">
          <CardContent className="pt-6">
            <div className="text-xs text-[#8b95a7] uppercase tracking-wide">Payants (pro + business)</div>
            <div className="text-2xl font-bold text-emerald-400 mt-1">{paying}</div>
            <div className="text-[11px] text-[#6b7280] mt-1">revenus récurrents</div>
          </CardContent>
        </Card>
        <Card className="bg-[#0d1117] border-[#1f2937]">
          <CardContent className="pt-6">
            <div className="text-xs text-[#8b95a7] uppercase tracking-wide">En essai</div>
            <div className="text-2xl font-bold text-amber-300 mt-1">{trial}</div>
            <div className="text-[11px] text-[#6b7280] mt-1">à convertir</div>
          </CardContent>
        </Card>
        <Card className="bg-[#0d1117] border-[#1f2937]">
          <CardContent className="pt-6">
            <div className="text-xs text-[#8b95a7] uppercase tracking-wide">Actifs (base calcul)</div>
            <div className="text-2xl font-bold text-primary mt-1">{activeUsers}</div>
            <div className="text-[11px] text-[#6b7280] mt-1">payants + essai</div>
          </CardContent>
        </Card>
      </div>

      {/* Configuration tier actuel + jauge */}
      <Card className="bg-[#0d1117] border-[#1f2937]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white text-base">
            <Server className="h-4 w-4 text-primary" />
            Compute Supabase actuel
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="text-sm text-[#b8c5d6]">Tier configuré :</div>
            <Select value={currentTier} onValueChange={handleTierChange}>
              <SelectTrigger className="w-44 bg-[#161b22] border-[#1f2937] text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#161b22] border-[#1f2937]">
                {TIERS.map((t) => (
                  <SelectItem key={t.id} value={t.id} className="text-white">
                    {t.label} ({t.ram})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="text-xs text-[#8b95a7]">
              ⚙️ À garder synchro avec ton vrai compute dans Supabase Dashboard
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
            <div className="flex items-center gap-2 text-sm text-[#b8c5d6]">
              <Database className="h-3.5 w-3.5 text-[#6b7280]" />
              RAM : <b className="text-white">{currentTierInfo.ram}</b>
            </div>
            <div className="flex items-center gap-2 text-sm text-[#b8c5d6]">
              <Activity className="h-3.5 w-3.5 text-[#6b7280]" />
              CPU : <b className="text-white">{currentTierInfo.cpu}</b>
            </div>
            <div className="flex items-center gap-2 text-sm text-[#b8c5d6]">
              <HardDrive className="h-3.5 w-3.5 text-[#6b7280]" />
              Coût : <b className="text-white">~{totalEstSupabase}$/mois</b>
              <span className="text-[11px] text-[#6b7280]">(Pro $25 + compute)</span>
            </div>
          </div>

          {/* Jauge de saturation */}
          <div>
            <div className="flex items-center justify-between text-xs text-[#8b95a7] mb-1">
              <span>
                Saturation estimée : {activeUsers} / {currentTierInfo.maxRecommendedUsers} abonnés actifs
              </span>
              <span
                className={
                  usagePct >= 90
                    ? "text-red-400 font-semibold"
                    : usagePct >= 70
                      ? "text-amber-400 font-semibold"
                      : "text-emerald-400"
                }
              >
                {usagePct}%
              </span>
            </div>
            <div className="h-2 bg-[#1f2937] rounded-full overflow-hidden">
              <div
                className={
                  "h-full transition-all " +
                  (usagePct >= 90
                    ? "bg-red-500"
                    : usagePct >= 70
                      ? "bg-amber-500"
                      : "bg-emerald-500")
                }
                style={{ width: `${usagePct}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Roadmap dimensionnement */}
      <Card className="bg-[#0d1117] border-[#1f2937]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white text-base">
            <TrendingUp className="h-4 w-4 text-primary" />
            Paliers de scaling Inboria
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xs text-[#8b95a7] mb-2">
            💡 Clique sur une ligne pour la définir comme tier actuel (synchro avec ton vrai compute Supabase).
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1f2937] text-[#8b95a7] text-xs uppercase">
                  <th className="text-left py-2 px-2 font-medium">Tier</th>
                  <th className="text-left py-2 px-2 font-medium">RAM</th>
                  <th className="text-left py-2 px-2 font-medium">CPU</th>
                  <th className="text-right py-2 px-2 font-medium">Coût compute</th>
                  <th className="text-right py-2 px-2 font-medium">Coût total Supabase</th>
                  <th className="text-right py-2 px-2 font-medium">Abonnés actifs max</th>
                  <th className="text-left py-2 px-2 font-medium">Statut</th>
                </tr>
              </thead>
              <tbody>
                {TIERS.map((t) => {
                  const isCurrent = t.id === currentTier;
                  const isRecommended = t.id === recommendedTier.id;
                  return (
                    <tr
                      key={t.id}
                      onClick={() => handleTierChange(t.id)}
                      data-testid={`tier-row-${t.id}`}
                      className={
                        "border-b border-[#1f2937]/50 cursor-pointer transition-colors " +
                        (isCurrent
                          ? "bg-primary/[0.10] hover:bg-primary/[0.14]"
                          : "hover:bg-white/[0.04]")
                      }
                    >
                      <td className="py-2 px-2 text-white font-medium">{t.label}</td>
                      <td className="py-2 px-2 text-[#b8c5d6]">{t.ram}</td>
                      <td className="py-2 px-2 text-[#b8c5d6]">{t.cpu}</td>
                      <td className="py-2 px-2 text-right text-[#b8c5d6] tabular-nums">
                        {t.pricePerMonth === 0 ? "inclus" : `${t.pricePerMonth}$/mois`}
                      </td>
                      <td className="py-2 px-2 text-right text-white tabular-nums">
                        ~{25 + (t.id === "nano" ? 0 : t.pricePerMonth)}$/mois
                      </td>
                      <td className="py-2 px-2 text-right text-[#b8c5d6] tabular-nums">
                        {t.maxRecommendedUsers}
                      </td>
                      <td className="py-2 px-2">
                        <div className="flex gap-1">
                          {isCurrent && (
                            <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px]">
                              actuel
                            </Badge>
                          )}
                          {isRecommended && !isCurrent && (
                            <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[10px]">
                              recommandé
                            </Badge>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-3 text-xs text-[#6b7280]">
            Hypothèses : ~500 mails/user/mois reçus + analysés, embeddings vectoriels actifs, workers
            (email-sync, triage, embedding, snooze-wake, crm-sync) en permanence. Au-delà de 800
            abonnés, prévoir aussi : désactiver spend cap, upgrade IOPS gp3 à 5000+, monter disque
            à 200 GB. Coûts AI (OpenAI) et bandwidth non inclus ici.
          </div>
        </CardContent>
      </Card>

      {/* Checklist actions */}
      <Card className="bg-[#0d1117] border-[#1f2937]">
        <CardHeader>
          <CardTitle className="text-white text-base">Checklist prévention</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-[#b8c5d6]">
            <li className="flex gap-2">
              <span className="text-primary">•</span>
              <span>
                <b>Surveiller Disk IO</b> :{" "}
                <a
                  href="https://supabase.com/dashboard/project/ecdwevvisbrcsomdiqop/reports/database"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  Reports → Database → Disk I/O <ExternalLink className="h-3 w-3" />
                </a>{" "}
                — si la courbe touche le rouge, upgrade compute ou IOPS.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary">•</span>
              <span>
                <b>Activer alertes mail</b> :{" "}
                <a
                  href="https://supabase.com/dashboard/account/notifications"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  Notifications Supabase <ExternalLink className="h-3 w-3" />
                </a>{" "}
                → cocher "Disk IO budget warnings" + "Project paused/restored".
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary">•</span>
              <span>
                <b>VACUUM périodique</b> (tous les 1-2 mois) sur grosses tables :{" "}
                <code className="text-xs bg-[#161b22] px-1.5 py-0.5 rounded">
                  VACUUM ANALYZE emails; VACUUM ANALYZE email_chunks;
                </code>
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary">•</span>
              <span>
                <b>Backups Pro</b> : 7 jours PITR inclus —{" "}
                <a
                  href="https://supabase.com/dashboard/project/ecdwevvisbrcsomdiqop/database/backups"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  vérifier ici <ExternalLink className="h-3 w-3" />
                </a>
                .
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary">•</span>
              <span>
                <b>Au-delà de 800 abonnés actifs</b> : désactiver spend cap + upgrade IOPS gp3 à
                5000+ + disque à 150-200 GB (+15-30$/mois).
              </span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
