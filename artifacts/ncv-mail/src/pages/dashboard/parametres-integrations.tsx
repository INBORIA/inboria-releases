import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  Building2,
  Briefcase,
  KeyRound,
  Webhook,
  Trash2,
  Plus,
  Copy,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Loader2,
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
  hubspot: boolean;
  pipedrive: boolean;
}

interface ApiKeyRow {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  createdAt: string;
  plainKey?: string;
}

interface WebhookRow {
  id: string;
  eventType: string;
  targetUrl: string;
  secret: string | null;
  description: string | null;
  enabled: boolean;
  failureCount: number;
  lastTriggeredAt: string | null;
  lastError: string | null;
}

const baseUrl = () => import.meta.env.BASE_URL.replace(/\/$/, "");

function authHeaders(token: string | undefined): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const PROVIDER_META: Record<
  string,
  { label: string; icon: any; categoryKey: "communication" | "crm"; descKey: string }
> = {
  hubspot: { label: "HubSpot", icon: Building2, categoryKey: "crm", descKey: "integrations.hubspot.desc" },
  pipedrive: { label: "Pipedrive", icon: Briefcase, categoryKey: "crm", descKey: "integrations.pipedrive.desc" },
};

export default function ParametresIntegrations() {
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

  const apiKeys = useQuery<ApiKeyRow[]>({
    queryKey: ["api-keys"],
    enabled: !!token,
    queryFn: async () => {
      const res = await fetch(`${baseUrl()}/api/api-keys`, { headers: authHeaders(token) });
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
  });

  const webhooks = useQuery<WebhookRow[]>({
    queryKey: ["webhook-subscriptions"],
    enabled: !!token,
    queryFn: async () => {
      const res = await fetch(`${baseUrl()}/api/webhook-subscriptions`, { headers: authHeaders(token) });
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
  });

  // Listen for OAuth popup completion
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

  function findIntegration(provider: string): IntegrationRow | undefined {
    return integrations.data?.find((i) => i.provider === provider);
  }

  const renderProviderCard = (provider: string) => {
    const meta = PROVIDER_META[provider];
    if (!meta) return null;
    const row = findIntegration(provider);
    const Icon = meta.icon;
    const available = availability.data?.[provider as keyof AvailabilityMap] ?? false;
    const isConnected = !!row && row.enabled;
    return (
      <Card key={provider} data-testid={`card-integration-${provider}`}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-[#1a2332] p-2">
              <Icon className="h-5 w-5 text-[#2d7dd2]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm">{meta.label}</h3>
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
              <p className="text-xs text-[#8b9cb3] mt-1">{t(meta.descKey)}</p>
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
                    {(provider === "hubspot" || provider === "pipedrive") && (
                      <Button size="sm" variant="outline" onClick={() => syncCrm(provider)}>
                        <RefreshCw className="h-3 w-3 mr-1" />
                        {t("integrations.sync")}
                      </Button>
                    )}
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
      <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-5 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{t("integrations.pageTitle")}</h1>
          <p className="text-sm text-[#8b9cb3]">{t("integrations.pageDesc")}</p>
        </div>

        {/* CRM section */}
        <section data-testid="section-crm">
          <h2 className="text-lg font-semibold mb-3">{t("integrations.categoryCrm")}</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {renderProviderCard("hubspot")}
            {renderProviderCard("pipedrive")}
          </div>
        </section>

        {/* Automation section */}
        <section data-testid="section-automation">
          <h2 className="text-lg font-semibold mb-3">{t("integrations.categoryAutomation")}</h2>
          <p className="text-xs text-[#8b9cb3] mb-3">{t("integrations.automationDesc")}</p>
          <div className="grid gap-3 md:grid-cols-2">
            <ApiKeysCard
              keys={apiKeys.data || []}
              onChange={() => qc.invalidateQueries({ queryKey: ["api-keys"] })}
              token={token}
            />
            <WebhooksCard
              hooks={webhooks.data || []}
              onChange={() => qc.invalidateQueries({ queryKey: ["webhook-subscriptions"] })}
              token={token}
            />
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}

function ApiKeysCard({
  keys,
  onChange,
  token,
}: {
  keys: ApiKeyRow[];
  onChange: () => void;
  token: string | undefined;
}) {
  const { t } = useTranslation();
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const { toast } = useToast();

  const create = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${baseUrl()}/api/api-keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(token) },
        body: JSON.stringify({ name: newName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "failed");
      return data;
    },
    onSuccess: (data) => {
      setRevealedKey(data.plainKey);
      setNewName("");
      setCreating(false);
      onChange();
    },
    onError: (err: any) => {
      toast({ title: t("integrations.apiKeys.createFailed"), description: err.message, variant: "destructive" });
    },
  });

  async function revoke(id: string) {
    if (!confirm(t("integrations.apiKeys.confirmRevoke"))) return;
    await fetch(`${baseUrl()}/api/api-keys/${id}`, { method: "DELETE", headers: authHeaders(token) });
    onChange();
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <KeyRound className="h-4 w-4" />
          {t("integrations.apiKeys.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-[#8b9cb3]">{t("integrations.apiKeys.desc")}</p>
        {revealedKey && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
            <p className="mb-2 font-semibold text-amber-300">{t("integrations.apiKeys.copyNow")}</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-black/40 p-2 rounded text-[10px] break-all">{revealedKey}</code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(revealedKey);
                  toast({ title: t("integrations.copied") });
                }}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="mt-2 text-xs"
              onClick={() => setRevealedKey(null)}
            >
              {t("common.close")}
            </Button>
          </div>
        )}

        {!creating ? (
          <Button size="sm" onClick={() => setCreating(true)} data-testid="button-new-api-key">
            <Plus className="h-3 w-3 mr-1" />
            {t("integrations.apiKeys.create")}
          </Button>
        ) : (
          <div className="space-y-2">
            <Input
              placeholder={t("integrations.apiKeys.namePlaceholder")}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              data-testid="input-api-key-name"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={!newName.trim() || create.isPending}
                onClick={() => create.mutate()}
                data-testid="button-create-api-key"
              >
                {create.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : t("common.create")}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>
                {t("common.cancel")}
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {keys.length === 0 && <p className="text-xs text-[#8b9cb3]">{t("integrations.apiKeys.empty")}</p>}
          {keys.map((k) => (
            <div
              key={k.id}
              className="flex items-center justify-between border border-[#1a2332] rounded p-2 text-xs"
            >
              <div>
                <div className="font-medium">{k.name}</div>
                <div className="text-[#8b9cb3]">
                  {k.keyPrefix}…
                  {k.lastUsedAt && (
                    <span className="ml-2">
                      {t("integrations.apiKeys.lastUsed")}: {new Date(k.lastUsedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => revoke(k.id)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function WebhooksCard({
  hooks,
  onChange,
  token,
}: {
  hooks: WebhookRow[];
  onChange: () => void;
  token: string | undefined;
}) {
  const { t } = useTranslation();
  const [creating, setCreating] = useState(false);
  const [eventType, setEventType] = useState("email.received");
  const [targetUrl, setTargetUrl] = useState("");
  const { toast } = useToast();

  const events = [
    "email.received",
    "email.sent",
    "task.created",
    "task.completed",
    "appointment.created",
    "rule.triggered",
    "message.received",
  ];

  async function create() {
    const res = await fetch(`${baseUrl()}/api/webhook-subscriptions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify({ eventType, targetUrl }),
    });
    if (res.ok) {
      setCreating(false);
      setTargetUrl("");
      onChange();
    } else {
      const err = await res.json().catch(() => ({}));
      toast({
        title: t("integrations.webhooks.createFailed"),
        description: err.error,
        variant: "destructive",
      });
    }
  }

  async function toggle(id: string, enabled: boolean) {
    await fetch(`${baseUrl()}/api/webhook-subscriptions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify({ enabled }),
    });
    onChange();
  }

  async function remove(id: string) {
    if (!confirm(t("integrations.webhooks.confirmDelete"))) return;
    await fetch(`${baseUrl()}/api/webhook-subscriptions/${id}`, {
      method: "DELETE",
      headers: authHeaders(token),
    });
    onChange();
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Webhook className="h-4 w-4" />
          {t("integrations.webhooks.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-[#8b9cb3]">{t("integrations.webhooks.desc")}</p>

        {!creating ? (
          <Button size="sm" onClick={() => setCreating(true)} data-testid="button-new-webhook">
            <Plus className="h-3 w-3 mr-1" />
            {t("integrations.webhooks.create")}
          </Button>
        ) : (
          <div className="space-y-2">
            <Label className="text-xs">{t("integrations.webhooks.eventType")}</Label>
            <select
              className="w-full bg-[#1a2332] border border-[#2a3548] rounded p-2 text-xs"
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              data-testid="select-event-type"
            >
              {events.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
            <Label className="text-xs">{t("integrations.webhooks.targetUrl")}</Label>
            <Input
              placeholder="https://hooks.zapier.com/..."
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              data-testid="input-webhook-url"
            />
            <div className="flex gap-2">
              <Button size="sm" disabled={!targetUrl} onClick={create} data-testid="button-create-webhook">
                {t("common.create")}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>
                {t("common.cancel")}
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {hooks.length === 0 && <p className="text-xs text-[#8b9cb3]">{t("integrations.webhooks.empty")}</p>}
          {hooks.map((h) => (
            <div key={h.id} className="border border-[#1a2332] rounded p-2 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] truncate flex-1">{h.eventType}</span>
                <Switch checked={h.enabled} onCheckedChange={(v) => toggle(h.id, v)} />
                <Button size="sm" variant="ghost" onClick={() => remove(h.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              <div className="text-[#8b9cb3] truncate">{h.targetUrl}</div>
              {h.lastError && <div className="text-red-400">{h.lastError}</div>}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
