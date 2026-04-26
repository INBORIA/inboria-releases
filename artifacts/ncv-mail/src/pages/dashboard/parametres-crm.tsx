import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Building2,
  Briefcase,
  Cloud,
  Database,
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
  salesforce: boolean;
  odoo: boolean;
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

  // Helper générique : accepte des query params optionnels (ex. sandbox=true
  // pour Salesforce). Reste compatible avec HubSpot/Pipedrive sans option.
  async function connectProvider(provider: string, queryParams?: Record<string, string>) {
    try {
      const qs = queryParams ? `?${new URLSearchParams(queryParams).toString()}` : "";
      const res = await fetch(`${baseUrl()}/api/integrations/${provider}/connect${qs}`, {
        headers: authHeaders(token),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "failed");
      window.open(data.url, "_blank", "width=720,height=820");
    } catch (err: any) {
      toast({ title: t("integrations.connectFailed"), description: err.message, variant: "destructive" });
    }
  }

  // State local pour le toggle Sandbox de la carte Salesforce. Persisté
  // uniquement le temps de la session : décision consciente à chaque connect.
  const [sfSandbox, setSfSandbox] = useState(false);

  // State + handler pour le formulaire Odoo (4 champs : URL, base, login,
  // clé API). Odoo ne supporte pas OAuth pour les instances on-premise /
  // Community, donc on passe par une auth JSON-RPC avec clé API utilisateur.
  const [odooOpen, setOdooOpen] = useState(false);
  const [odooUrl, setOdooUrl] = useState("");
  const [odooDb, setOdooDb] = useState("");
  const [odooLogin, setOdooLogin] = useState("");
  const [odooApiKey, setOdooApiKey] = useState("");
  const [odooSubmitting, setOdooSubmitting] = useState(false);

  async function connectOdoo() {
    if (!odooUrl.trim() || !odooDb.trim() || !odooLogin.trim() || !odooApiKey.trim()) {
      toast({
        title: t("integrations.odoo.missingFields"),
        variant: "destructive",
      });
      return;
    }
    setOdooSubmitting(true);
    try {
      const res = await fetch(`${baseUrl()}/api/integrations/odoo/connect`, {
        method: "POST",
        headers: {
          ...authHeaders(token),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: odooUrl.trim(),
          db: odooDb.trim(),
          login: odooLogin.trim(),
          apiKey: odooApiKey.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "failed");
      toast({ title: t("integrations.odoo.connectSuccess") });
      setOdooOpen(false);
      setOdooUrl("");
      setOdooDb("");
      setOdooLogin("");
      setOdooApiKey("");
      qc.invalidateQueries({ queryKey: ["integrations"] });
    } catch (err: any) {
      toast({
        title: t("integrations.odoo.connectFailed"),
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setOdooSubmitting(false);
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

  async function syncCrm(provider: "hubspot" | "pipedrive" | "salesforce" | "odoo") {
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
            {t("settings.hub.crmDesc", "HubSpot, Pipedrive, Salesforce, Odoo")}
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {renderProviderCard("hubspot", "HubSpot", Building2)}
          {renderProviderCard("pipedrive", "Pipedrive", Briefcase)}

          {/* Carte Salesforce — parité HubSpot/Pipedrive avec un toggle
              Sandbox supplémentaire (cible ETI/grands comptes : tester sur
              une org Sandbox avant de connecter la Production). Le toggle
              n'est exposé qu'à l'état "non connecté" : une fois la connexion
              établie, le badge `workspaceName` indique déjà "(Sandbox)". */}
          {(() => {
            const row = findIntegration("salesforce");
            const available = availability.data?.salesforce ?? false;
            const isConnected = !!row && row.enabled;
            return (
              <Card data-testid="card-integration-salesforce">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-[#1a2332] p-2">
                      <Cloud className="h-5 w-5 text-[#2d7dd2]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-sm">
                          {row?.workspaceName || "Salesforce"}
                        </h3>
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
                      <p className="text-xs text-[#8b9cb3] mt-1">
                        {t(
                          "settings.hub.salesforceDesc",
                          "Synchronisation des contacts, comptes et opportunités Salesforce.",
                        )}
                      </p>
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
                      {!isConnected && (
                        <label
                          className="flex items-center gap-2 mt-3 text-xs text-[#8b9cb3] cursor-pointer select-none"
                          data-testid="label-salesforce-sandbox"
                        >
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5 accent-primary"
                            checked={sfSandbox}
                            onChange={(e) => setSfSandbox(e.target.checked)}
                            data-testid="checkbox-salesforce-sandbox"
                          />
                          <span>
                            {t(
                              "settings.hub.salesforceSandbox",
                              "Sandbox (test.salesforce.com)",
                            )}
                          </span>
                        </label>
                      )}
                      <div className="flex gap-2 mt-3 flex-wrap">
                        {!isConnected ? (
                          <Button
                            size="sm"
                            onClick={() =>
                              connectProvider(
                                "salesforce",
                                sfSandbox ? { sandbox: "true" } : undefined,
                              )
                            }
                            disabled={!available}
                            data-testid="button-connect-salesforce"
                          >
                            {available
                              ? t("integrations.connect")
                              : t("integrations.notConfigured")}
                          </Button>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => syncCrm("salesforce")}
                              data-testid="button-sync-salesforce"
                            >
                              <RefreshCw className="h-3 w-3 mr-1" />
                              {t("integrations.sync")}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-400"
                              onClick={() => disconnectProvider("salesforce")}
                              data-testid="button-disconnect-salesforce"
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
          })()}

          {/* Carte Odoo — auth par formulaire (URL + base + login + clé API),
              pas OAuth. Cliquer sur "Connecter" ouvre un Dialog modal. La sync
              auto 15 min tourne ensuite via le scheduler comme les 3 autres. */}
          {(() => {
            const row = findIntegration("odoo");
            const available = availability.data?.odoo ?? false;
            const isConnected = !!row && row.enabled;
            return (
              <Card data-testid="card-integration-odoo">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-[#1a2332] p-2">
                      <Database className="h-5 w-5 text-[#2d7dd2]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-sm">
                          {row?.workspaceName || "Odoo"}
                        </h3>
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
                      <p className="text-xs text-[#8b9cb3] mt-1">
                        {t("integrations.odoo.desc")}
                      </p>
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
                            onClick={() => setOdooOpen(true)}
                            disabled={!available}
                            data-testid="button-connect-odoo"
                          >
                            {available
                              ? t("integrations.connect")
                              : t("integrations.notConfigured")}
                          </Button>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => syncCrm("odoo")}
                              data-testid="button-sync-odoo"
                            >
                              <RefreshCw className="h-3 w-3 mr-1" />
                              {t("integrations.sync")}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-400"
                              onClick={() => disconnectProvider("odoo")}
                              data-testid="button-disconnect-odoo"
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
          })()}
        </div>

        {/* Dialog Odoo — 4 champs requis. Le helpDetail explique où trouver
            la clé API dans Odoo (Profil → Sécurité du compte → Nouvelle clé). */}
        <Dialog open={odooOpen} onOpenChange={setOdooOpen}>
          <DialogContent className="sm:max-w-md" data-testid="dialog-odoo-connect">
            <DialogHeader>
              <DialogTitle>{t("integrations.odoo.dialogTitle")}</DialogTitle>
              <DialogDescription>{t("integrations.odoo.dialogDesc")}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="odoo-url" className="text-xs">
                  {t("integrations.odoo.urlLabel")}
                </Label>
                <Input
                  id="odoo-url"
                  type="url"
                  placeholder={t("integrations.odoo.urlPlaceholder")}
                  value={odooUrl}
                  onChange={(e) => setOdooUrl(e.target.value)}
                  data-testid="input-odoo-url"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="odoo-db" className="text-xs">
                  {t("integrations.odoo.dbLabel")}
                </Label>
                <Input
                  id="odoo-db"
                  placeholder={t("integrations.odoo.dbPlaceholder")}
                  value={odooDb}
                  onChange={(e) => setOdooDb(e.target.value)}
                  data-testid="input-odoo-db"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="odoo-login" className="text-xs">
                  {t("integrations.odoo.loginLabel")}
                </Label>
                <Input
                  id="odoo-login"
                  type="email"
                  placeholder={t("integrations.odoo.loginPlaceholder")}
                  value={odooLogin}
                  onChange={(e) => setOdooLogin(e.target.value)}
                  data-testid="input-odoo-login"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="odoo-apikey" className="text-xs">
                  {t("integrations.odoo.apiKeyLabel")}
                </Label>
                <Input
                  id="odoo-apikey"
                  type="password"
                  placeholder={t("integrations.odoo.apiKeyPlaceholder")}
                  value={odooApiKey}
                  onChange={(e) => setOdooApiKey(e.target.value)}
                  data-testid="input-odoo-apikey"
                />
              </div>
              <p className="text-[11px] text-[#8b9cb3] mt-2">
                <span className="font-medium">{t("integrations.odoo.helpText")}</span>{" "}
                {t("integrations.odoo.helpDetail")}
              </p>
            </div>
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => setOdooOpen(false)}
                disabled={odooSubmitting}
              >
                {t("common.cancel", "Annuler")}
              </Button>
              <Button
                onClick={connectOdoo}
                disabled={odooSubmitting}
                data-testid="button-submit-odoo"
              >
                {odooSubmitting ? t("integrations.odoo.submitting") : t("integrations.odoo.submit")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
