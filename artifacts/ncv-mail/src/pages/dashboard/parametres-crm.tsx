import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Building2,
  Briefcase,
  Cloud,
  ArrowLeft,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

interface IntegrationRow {
  id: string;
  provider: string;
  workspaceName: string | null;
  enabled: boolean;
  lastSyncedAt: string | null;
  lastError: string | null;
  createdAt: string;
}

interface AvailabilityMap {
  slack: boolean;
  notion: boolean;
  hubspot: boolean;
  pipedrive: boolean;
  whatsapp: boolean;
  sms_twilio: boolean;
  sms_brevo: boolean;
}

const baseUrl = () => import.meta.env.BASE_URL.replace(/\/$/, "");
function authHeaders(token?: string): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function ParametresCrm() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const token = session?.access_token;

  const integrations = useQuery<IntegrationRow[]>({
    queryKey: ["integrations"],
    enabled: !!token,
    queryFn: async () => {
      const res = await fetch(`${baseUrl()}/api/integrations`, { headers: authHeaders(token) });
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
  });

  const availability = useQuery<AvailabilityMap>({
    queryKey: ["integrations-availability"],
    queryFn: async () => {
      const res = await fetch(`${baseUrl()}/api/integrations/availability`);
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
  });

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.data?.type === "integration-connected") {
        qc.invalidateQueries({ queryKey: ["integrations"] });
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [qc]);

  async function connectProvider(provider: string) {
    try {
      const res = await fetch(`${baseUrl()}/api/integrations/${provider}/connect`, {
        headers: authHeaders(token),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "failed");
      window.open(data.url, "_blank", "width=720,height=820");
    } catch (err: any) {
      toast({ title: t("integrations.connectFailed"), description: err.message, variant: "destructive" });
    }
  }

  async function disconnectProvider(provider: string) {
    if (!confirm(t("integrations.confirmDisconnect"))) return;
    const res = await fetch(`${baseUrl()}/api/integrations/${provider}`, {
      method: "DELETE",
      headers: authHeaders(token),
    });
    if (res.ok) {
      qc.invalidateQueries({ queryKey: ["integrations"] });
      toast({ title: t("integrations.disconnected") });
    }
  }

  async function syncCrm(provider: "hubspot" | "pipedrive") {
    const res = await fetch(`${baseUrl()}/api/integrations/${provider}/sync`, {
      method: "POST",
      headers: authHeaders(token),
    });
    const data = await res.json();
    if (res.ok) {
      toast({
        title: t("integrations.syncDone"),
        description: `${data.contacts?.synced || 0} ${t("integrations.contacts")}, ${data.deals?.synced || 0} ${t("integrations.deals")}`,
      });
      qc.invalidateQueries({ queryKey: ["integrations"] });
    } else {
      toast({ title: t("integrations.syncFailed"), description: data.error, variant: "destructive" });
    }
  }

  function findIntegration(provider: string) {
    return integrations.data?.find((i) => i.provider === provider);
  }

  const renderProviderCard = (provider: "hubspot" | "pipedrive", label: string, Icon: any) => {
    const row = findIntegration(provider);
    const available = availability.data?.[provider as keyof AvailabilityMap] ?? false;
    const isConnected = !!row && row.enabled;
    const descKey = provider === "hubspot" ? "integrations.hubspot.desc" : "integrations.pipedrive.desc";
    return (
      <Card key={provider} data-testid={`card-integration-${provider}`}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-[#1a2332] p-2">
              <Icon className="h-5 w-5 text-[#2d7dd2]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm">{label}</h3>
                {isConnected ? (
                  <Badge variant="default" className="text-[10px] bg-emerald-600">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    {t("integrations.connected")}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px]">
                    {t("integrations.notConnected")}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-[#8b9cb3] mt-1">{t(descKey)}</p>
              {row?.lastError && (
                <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {row.lastError}
                </p>
              )}
              {row?.lastSyncedAt && (
                <p className="text-xs text-[#8b9cb3] mt-1">
                  {t("integrations.lastSynced")}: {new Date(row.lastSyncedAt).toLocaleString()}
                </p>
              )}
              <div className="flex gap-2 mt-3 flex-wrap">
                {!isConnected ? (
                  <Button
                    size="sm"
                    onClick={() => connectProvider(provider)}
                    disabled={!available}
                    data-testid={`button-connect-${provider}`}
                  >
                    {available ? t("integrations.connect") : t("integrations.notConfigured")}
                  </Button>
                ) : (
                  <>
                    <Button size="sm" variant="outline" onClick={() => syncCrm(provider)}>
                      <RefreshCw className="h-3 w-3 mr-1" />
                      {t("integrations.sync")}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-400"
                      onClick={() => disconnectProvider(provider)}
                      data-testid={`button-disconnect-${provider}`}
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      {t("integrations.disconnect")}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <DashboardLayout>
      <div className="p-5 max-w-4xl mx-auto w-full space-y-4">
        <div>
          <Link href="/dashboard/parametres">
            <Button variant="ghost" size="sm" className="h-7 px-2 text-[#8b9cb3] hover:text-white">
              <ArrowLeft className="w-3.5 h-3.5 mr-1" /> {t("settings.title")}
            </Button>
          </Link>
        </div>
        <div>
          <h1 className="text-[16px] font-semibold text-white tracking-tight flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" />
            {t("settings.hub.crm", "CRM")}
          </h1>
          <p className="text-[12px] text-[#8b9cb3] mt-0.5">
            {t("settings.hub.crmDesc", "HubSpot, Pipedrive, Salesforce")}
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {renderProviderCard("hubspot", "HubSpot", Building2)}
          {renderProviderCard("pipedrive", "Pipedrive", Briefcase)}

          <Card data-testid="card-integration-salesforce" className="opacity-70">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-[#1a2332] p-2">
                  <Cloud className="h-5 w-5 text-[#2d7dd2]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm">Salesforce</h3>
                    <Badge variant="outline" className="text-[10px]">
                      {t("settings.hub.comingSoon", "Bientôt disponible")}
                    </Badge>
                  </div>
                  <p className="text-xs text-[#8b9cb3] mt-1">
                    {t("settings.hub.salesforceDesc", "Synchronisation des contacts, comptes et opportunités Salesforce.")}
                  </p>
                  <div className="mt-3">
                    <Button size="sm" disabled>
                      {t("settings.hub.comingSoon", "Bientôt disponible")}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
