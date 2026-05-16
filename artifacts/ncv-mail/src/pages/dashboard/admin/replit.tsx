import { useAdminReplitMetrics, useGetProfile } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Cloud,
  ExternalLink,
  XCircle,
  Server,
  Key,
} from "lucide-react";

interface ProfileWithAdmin {
  isAdmin?: boolean;
}

function fmtUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}j ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function AdminReplit() {
  const { data: profileData, isLoading: profileLoading } = useGetProfile();
  const profile = (profileData ?? {}) as ProfileWithAdmin;
  const isAdmin = !!profile.isAdmin;
  const { data, isLoading, refetch, isFetching, error } = useAdminReplitMetrics();

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
            <b>Impossible de récupérer les métriques Replit.</b>
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
    nodeVersion,
    uptimeSeconds,
    memoryUsedMb,
    memoryRssMb,
    isDeployment,
    domains,
    replId,
    replSlug,
    replOwner,
    secretsStatus,
  } = data;

  const criticalMissing = secretsStatus.filter((s) => s.critical && !s.configured);
  const criticalOk = criticalMissing.length === 0;

  return (
    <div className="space-y-4">
      {/* Bandeau environnement */}
      <Card
        className={
          isDeployment
            ? "bg-emerald-500/10 border-emerald-500/30"
            : "bg-amber-500/10 border-amber-500/30"
        }
      >
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            {isDeployment ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-400 mt-0.5 shrink-0" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
            )}
            <div className="space-y-1 flex-1">
              <div className="font-semibold text-white">
                Environnement : {isDeployment ? "Production (Deployment)" : "Développement (Workspace)"}
              </div>
              <div className="text-xs text-[#8b95a7]">
                {replOwner && replSlug ? (
                  <>
                    Repl : <code className="text-[11px]">{replOwner}/{replSlug}</code>
                    {replId && <> · ID : <code className="text-[11px]">{replId.slice(0, 8)}…</code></>}
                  </>
                ) : (
                  <>Repl ID inconnu</>
                )}
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

      {/* Runtime KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-[#0d1117] border-[#1f2937]">
          <CardContent className="pt-6">
            <div className="text-xs text-[#8b95a7] uppercase tracking-wide">Node.js</div>
            <div className="text-2xl font-bold text-white mt-1">{nodeVersion}</div>
            <div className="text-[11px] text-[#6b7280] mt-1">version runtime</div>
          </CardContent>
        </Card>
        <Card className="bg-[#0d1117] border-[#1f2937]">
          <CardContent className="pt-6">
            <div className="text-xs text-[#8b95a7] uppercase tracking-wide">Uptime</div>
            <div className="text-2xl font-bold text-emerald-400 mt-1 tabular-nums">
              {fmtUptime(uptimeSeconds)}
            </div>
            <div className="text-[11px] text-[#6b7280] mt-1">depuis dernier redémarrage</div>
          </CardContent>
        </Card>
        <Card className="bg-[#0d1117] border-[#1f2937]">
          <CardContent className="pt-6">
            <div className="text-xs text-[#8b95a7] uppercase tracking-wide">Mémoire heap</div>
            <div className="text-2xl font-bold text-white mt-1 tabular-nums">
              {memoryUsedMb} <span className="text-sm text-[#8b95a7]">MB</span>
            </div>
            <div className="text-[11px] text-[#6b7280] mt-1">
              RSS : {memoryRssMb} MB
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#0d1117] border-[#1f2937]">
          <CardContent className="pt-6">
            <div className="text-xs text-[#8b95a7] uppercase tracking-wide">Domaines</div>
            <div className="text-2xl font-bold text-primary mt-1 tabular-nums">
              {domains.length}
            </div>
            <div className="text-[11px] text-[#6b7280] mt-1">REPLIT_DOMAINS</div>
          </CardContent>
        </Card>
      </div>

      {/* Domaines */}
      {domains.length > 0 && (
        <Card className="bg-[#0d1117] border-[#1f2937]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white text-base">
              <Cloud className="h-4 w-4 text-primary" />
              Domaines actifs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {domains.map((d) => (
                <li
                  key={d}
                  className="flex items-center justify-between gap-2 text-sm font-mono text-[#b8c5d6] bg-[#161b22] border border-[#1f2937] rounded px-3 py-2"
                >
                  <span className="truncate">{d}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => window.open(`https://${d}`, "_blank")}
                    className="h-7 px-2 text-[#8b95a7] hover:text-white"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Secrets */}
      <Card
        className={
          criticalOk
            ? "bg-[#0d1117] border-[#1f2937]"
            : "bg-red-500/10 border-red-500/30"
        }
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white text-base">
            <Key className="h-4 w-4 text-primary" />
            Secrets & variables d'environnement
            {!criticalOk && (
              <span className="ml-2 text-xs text-red-300">
                ({criticalMissing.length} critique{criticalMissing.length > 1 ? "s" : ""} manquant{criticalMissing.length > 1 ? "s" : ""})
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {secretsStatus.map((s) => (
              <div
                key={s.name}
                className={`flex items-center justify-between gap-2 px-3 py-2 rounded border text-sm ${
                  s.configured
                    ? "bg-[#161b22] border-[#1f2937]"
                    : s.critical
                      ? "bg-red-500/5 border-red-500/30"
                      : "bg-amber-500/5 border-amber-500/20"
                }`}
              >
                <code className="text-xs text-[#b8c5d6] truncate">{s.name}</code>
                <div className="flex items-center gap-1 shrink-0">
                  {s.critical && (
                    <span className="text-[9px] uppercase text-red-400 font-semibold">
                      critique
                    </span>
                  )}
                  {s.configured ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <XCircle className={`h-4 w-4 ${s.critical ? "text-red-400" : "text-amber-400"}`} />
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 text-xs text-[#6b7280]">
            Les valeurs ne sont jamais exposées — seul leur statut configuré / manquant est affiché.
          </div>
        </CardContent>
      </Card>

      {/* Liens externes */}
      <Card className="bg-[#0d1117] border-[#1f2937]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white text-base">
            <Server className="h-4 w-4 text-primary" />
            Liens Replit
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.open("https://replit.com/~", "_blank")}
              className="border-[#1f2937] text-[#b8c5d6]"
            >
              Mes Repls
              <ExternalLink className="h-3 w-3 ml-2" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.open("https://replit.com/usage", "_blank")}
              className="border-[#1f2937] text-[#b8c5d6]"
            >
              Usage & facturation
              <ExternalLink className="h-3 w-3 ml-2" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.open("https://docs.replit.com/cloud-services/deployments/about-deployments", "_blank")}
              className="border-[#1f2937] text-[#b8c5d6]"
            >
              Docs Deployments
              <ExternalLink className="h-3 w-3 ml-2" />
            </Button>
          </div>

          <ul className="space-y-2 text-sm text-[#b8c5d6] pt-2">
            <li className="flex gap-2">
              <span className="text-primary">•</span>
              <span>
                <b>Workspace ≠ Production</b> : le workspace redémarre librement (HMR), la production est le Deployment.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary">•</span>
              <span>
                <b>Sync secrets workspace → prod</b> : chaque secret ajouté ici doit aussi être déclaré côté Deployment, sinon il n'arrive pas en prod.
              </span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
