import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useEnableLightTheme } from "@/lib/inbox-theme";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Webhook, Plus, Loader2, Trash2, ChevronRight, ChevronDown, ArrowLeft, Copy, Check } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";

interface WebhookEndpoint {
  id: string;
  url: string;
  secretMasked: string;
  events: string[];
  enabled: boolean;
  createdAt: string;
}

interface WebhookDelivery {
  id: string;
  event: string;
  status: string;
  attempts: number;
  lastStatusCode: number | null;
  lastError: string | null;
  nextAttemptAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const ALL_EVENTS = ["email.received", "email.sent", "task.created", "appointment.created", "rule.triggered"];
const baseUrl = () => import.meta.env.BASE_URL.replace(/\/$/, "");

export default function ParametresWebhooks() {
  useEnableLightTheme();
  const { t } = useTranslation();
  const { session } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [creating, setCreating] = useState(false);
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>(ALL_EVENTS);
  const [createdSecret, setCreatedSecret] = useState<{ url: string; secret: string } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const endpointsQuery = useQuery<WebhookEndpoint[]>({
    queryKey: ["webhook-endpoints"],
    enabled: !!session,
    queryFn: async () => {
      const res = await fetch(`${baseUrl()}/api/webhook-endpoints`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!res.ok) throw new Error("fetch failed");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${baseUrl()}/api/webhook-endpoints`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ url: url.trim(), events }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || t("common.error"));
      }
      return res.json();
    },
    onSuccess: (d: any) => {
      setCreatedSecret({ url: d.url, secret: d.secret });
      setCreating(false);
      setUrl("");
      setEvents(ALL_EVENTS);
      queryClient.invalidateQueries({ queryKey: ["webhook-endpoints"] });
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async (input: { id: string; payload: any }) => {
      const res = await fetch(`${baseUrl()}/api/webhook-endpoints/${input.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify(input.payload),
      });
      if (!res.ok) throw new Error(t("common.error"));
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["webhook-endpoints"] }),
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${baseUrl()}/api/webhook-endpoints/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!res.ok) throw new Error(t("common.error"));
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t("webhooks.deletedToast") });
      queryClient.invalidateQueries({ queryKey: ["webhook-endpoints"] });
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  function toggleEvent(s: string) {
    setEvents((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  }

  async function copySecret() {
    if (!createdSecret) return;
    await navigator.clipboard.writeText(createdSecret.secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-5 space-y-4">
        <div className="flex items-center gap-2">
          <Link href="/dashboard/parametres">
            <Button variant="ghost" size="sm" className="h-7 px-2">
              <ArrowLeft className="w-3.5 h-3.5 mr-1" /> {t("settings.title")}
            </Button>
          </Link>
        </div>
        <div>
          <h1 className="text-[16px] font-semibold text-white tracking-tight flex items-center gap-2">
            <Webhook className="w-4 h-4 text-primary" />
            {t("webhooks.title")}
          </h1>
          <p className="text-[12px] text-[#b8c5d6] mt-0.5">{t("webhooks.subtitle")}</p>
        </div>

        {createdSecret && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
            <div className="text-[12px] font-medium text-emerald-400 mb-1">{t("webhooks.createdTitle")}</div>
            <div className="text-[11px] text-[#c9d1d9] mb-2">{t("webhooks.createdHint")}</div>
            <code className="block bg-background border border-border rounded px-2 py-1 text-[11px] text-white break-all mb-2">{createdSecret.url}</code>
            <div className="flex gap-2">
              <code className="bg-background border border-border rounded px-2 py-1 text-[11px] text-white flex-1 break-all">{createdSecret.secret}</code>
              <Button size="sm" variant="outline" className="h-8 px-2" onClick={copySecret}>
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              </Button>
            </div>
            <Button variant="ghost" size="sm" className="h-6 text-[11px] mt-2 text-[#b8c5d6]" onClick={() => setCreatedSecret(null)}>
              {t("webhooks.dismissCreated")}
            </Button>
          </div>
        )}

        {!creating ? (
          <Button size="sm" onClick={() => setCreating(true)} className="h-8 text-[12px]">
            <Plus className="w-3.5 h-3.5 mr-1" /> {t("webhooks.create")}
          </Button>
        ) : (
          <div className="bg-card border border-border rounded-lg p-4 space-y-3">
            <div>
              <Label className="text-[11px] text-[#b8c5d6]">{t("webhooks.url")}</Label>
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/inboria" className="h-8 text-[12px]" />
            </div>
            <div>
              <Label className="text-[11px] text-[#b8c5d6]">{t("webhooks.events")}</Label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {ALL_EVENTS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleEvent(s)}
                    className={`text-[10px] rounded border px-2 py-0.5 ${events.includes(s) ? "bg-primary text-white border-primary" : "bg-background text-[#b8c5d6] border-border"}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => setCreating(false)}>{t("common.cancel")}</Button>
              <Button size="sm" className="h-7 text-[11px]" disabled={!url.trim() || createMutation.isPending} onClick={() => createMutation.mutate()}>
                {createMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : t("webhooks.create")}
              </Button>
            </div>
          </div>
        )}

        {endpointsQuery.isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin" /></div>
        ) : (endpointsQuery.data || []).length === 0 ? (
          <div className="bg-card border border-border rounded-lg p-4 text-[12px] text-[#b8c5d6]">{t("webhooks.empty")}</div>
        ) : (
          <div className="space-y-2">
            {(endpointsQuery.data || []).map((ep) => (
              <div key={ep.id} className="bg-card border border-border rounded-lg overflow-hidden">
                <div className="flex items-center justify-between p-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] text-white font-medium truncate">{ep.url}</div>
                    <div className="text-[10px] text-[#b8c5d6] mt-0.5 truncate">{(ep.events || []).join(", ")}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch
                      checked={ep.enabled}
                      onCheckedChange={(checked) => updateMutation.mutate({ id: ep.id, payload: { enabled: checked } })}
                    />
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-[#b8c5d6]" onClick={() => setExpandedId(expandedId === ep.id ? null : ep.id)}>
                      {expandedId === ep.id ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-[#b8c5d6] hover:text-red-400" onClick={() => deleteMutation.mutate(ep.id)} disabled={deleteMutation.isPending}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                {expandedId === ep.id && (
                  <Deliveries endpointId={ep.id} sessionToken={session?.access_token || ""} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function Deliveries({ endpointId, sessionToken }: { endpointId: string; sessionToken: string }) {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery<WebhookDelivery[]>({
    queryKey: ["webhook-deliveries", endpointId],
    queryFn: async () => {
      const res = await fetch(`${baseUrl()}/api/webhook-endpoints/${endpointId}/deliveries`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (!res.ok) throw new Error("fetch failed");
      return res.json();
    },
  });
  return (
    <div className="border-t border-border bg-background p-3">
      <div className="text-[11px] font-semibold text-white mb-2">{t("webhooks.recentDeliveries")}</div>
      {isLoading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (data || []).length === 0 ? (
        <div className="text-[11px] text-[#b8c5d6]">{t("webhooks.noDeliveries")}</div>
      ) : (
        <table className="w-full text-[10px]">
          <thead>
            <tr className="text-[#b8c5d6]">
              <th className="text-left p-1">{t("webhooks.colEvent")}</th>
              <th className="text-left p-1">{t("webhooks.colStatus")}</th>
              <th className="text-right p-1">{t("webhooks.colAttempts")}</th>
              <th className="text-right p-1">HTTP</th>
              <th className="text-right p-1">{t("webhooks.colDate")}</th>
            </tr>
          </thead>
          <tbody>
            {(data || []).map((d) => (
              <tr key={d.id} className="border-t border-border/40">
                <td className="p-1 text-[#c9d1d9]">{d.event}</td>
                <td className={`p-1 ${d.status === "success" ? "text-emerald-400" : d.status === "exhausted" ? "text-red-400" : "text-amber-400"}`}>{d.status}</td>
                <td className="p-1 text-right">{d.attempts}</td>
                <td className="p-1 text-right">{d.lastStatusCode ?? "—"}</td>
                <td className="p-1 text-right text-[#b8c5d6]">{new Date(d.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
