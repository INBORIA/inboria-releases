import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useEnableLightTheme } from "@/lib/inbox-theme";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Key, Plus, Loader2, Trash2, Copy, Check, ArrowLeft, ExternalLink } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState } from "react";
import { Link } from "wouter";

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

const ALL_SCOPES = ["emails:read", "tasks:write", "appointments:write", "contacts:write", "rules:trigger"];

const baseUrl = () => import.meta.env.BASE_URL.replace(/\/$/, "");

export default function ParametresApi() {
  useEnableLightTheme();
  const { t } = useTranslation();
  const { session } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>(ALL_SCOPES);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [keyToDelete, setKeyToDelete] = useState<{ id: string; name: string } | null>(null);

  const keysQuery = useQuery<ApiKey[]>({
    queryKey: ["api-keys"],
    enabled: !!session,
    queryFn: async () => {
      const res = await fetch(`${baseUrl()}/api/api-keys`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!res.ok) throw new Error("fetch failed");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${baseUrl()}/api/api-keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ name: name.trim(), scopes }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || t("common.error"));
      }
      return res.json();
    },
    onSuccess: (data) => {
      setCreatedKey(data.key);
      setCreating(false);
      setName("");
      setScopes(ALL_SCOPES);
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${baseUrl()}/api/api-keys/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!res.ok) throw new Error(t("common.error"));
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t("apiKeys.revokedToast") });
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const hardDeleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${baseUrl()}/api/api-keys/${id}/permanent`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || t("common.error"));
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t("apiKeys.deletedToast") });
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  function toggleScope(s: string) {
    setScopes((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  }

  async function copyKey() {
    if (!createdKey) return;
    await navigator.clipboard.writeText(createdKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-5 space-y-4">
        <div className="flex items-center gap-2">
          <Link href="/dashboard/parametres">
            <Button variant="ghost" size="sm" className="h-7 px-2">
              <ArrowLeft className="w-3.5 h-3.5 mr-1" /> {t("common.back", "Retour")}
            </Button>
          </Link>
        </div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-[16px] font-semibold text-white tracking-tight flex items-center gap-2">
              <Key className="w-4 h-4 text-primary" />
              {t("apiKeys.title")}
            </h1>
            <p className="text-[12px] text-[#b8c5d6] mt-0.5">{t("apiKeys.subtitle")}</p>
          </div>
          <a href={`${baseUrl()}/api/dev`} target="_blank" rel="noreferrer">
            <Button variant="outline" size="sm" className="h-7 text-[11px]">
              {t("apiKeys.viewDocs")} <ExternalLink className="w-3 h-3 ml-1" />
            </Button>
          </a>
        </div>

        {createdKey && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
            <div className="text-[12px] font-medium text-emerald-400 mb-1">{t("apiKeys.createdTitle")}</div>
            <div className="text-[11px] text-[#c9d1d9] mb-2">{t("apiKeys.createdHint")}</div>
            <div className="flex gap-2">
              <code className="bg-background border border-border rounded px-2 py-1 text-[11px] text-white flex-1 break-all">{createdKey}</code>
              <Button size="sm" variant="outline" className="h-8 px-2" onClick={copyKey}>
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              </Button>
            </div>
            <Button variant="ghost" size="sm" className="h-6 text-[11px] mt-2 text-[#b8c5d6]" onClick={() => setCreatedKey(null)}>
              {t("apiKeys.dismissCreated")}
            </Button>
          </div>
        )}

        {!creating ? (
          <Button size="sm" onClick={() => setCreating(true)} className="h-8 text-[12px]">
            <Plus className="w-3.5 h-3.5 mr-1" /> {t("apiKeys.create")}
          </Button>
        ) : (
          <div className="bg-card border border-border rounded-lg p-4 space-y-3">
            <div>
              <Label className="text-[11px] text-[#b8c5d6]">{t("apiKeys.name")}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 text-[12px]" placeholder={t("apiKeys.namePlaceholder")} />
            </div>
            <div>
              <Label className="text-[11px] text-[#b8c5d6]">{t("apiKeys.scopes")}</Label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {ALL_SCOPES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleScope(s)}
                    className={`text-[10px] rounded border px-2 py-0.5 ${scopes.includes(s) ? "bg-primary text-white border-primary" : "bg-background text-[#b8c5d6] border-border"}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => setCreating(false)}>{t("common.cancel")}</Button>
              <Button size="sm" className="h-7 text-[11px]" disabled={!name.trim() || createMutation.isPending} onClick={() => createMutation.mutate()}>
                {createMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : t("apiKeys.create")}
              </Button>
            </div>
          </div>
        )}

        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {keysQuery.isLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin" /></div>
          ) : (keysQuery.data || []).length === 0 ? (
            <div className="text-[12px] text-[#b8c5d6] p-4">{t("apiKeys.empty")}</div>
          ) : (
            <table className="w-full text-[11px]">
              <thead className="bg-background border-b border-border">
                <tr>
                  <th className="text-left p-2 text-[#b8c5d6]">{t("apiKeys.colName")}</th>
                  <th className="text-left p-2 text-[#b8c5d6]">{t("apiKeys.colPrefix")}</th>
                  <th className="text-left p-2 text-[#b8c5d6]">{t("apiKeys.colScopes")}</th>
                  <th className="text-left p-2 text-[#b8c5d6]">{t("apiKeys.colLastUsed")}</th>
                  <th className="text-left p-2 text-[#b8c5d6]">{t("apiKeys.colStatus")}</th>
                  <th className="text-right p-2"></th>
                </tr>
              </thead>
              <tbody>
                {(keysQuery.data || []).map((k) => (
                  <tr key={k.id} className="border-b border-border/60">
                    <td className="p-2 text-white">{k.name}</td>
                    <td className="p-2 text-[#c9d1d9] font-mono">{k.keyPrefix}…</td>
                    <td className="p-2 text-[#b8c5d6]">{(k.scopes || []).join(", ")}</td>
                    <td className="p-2 text-[#b8c5d6]">{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : "—"}</td>
                    <td className="p-2">{k.revokedAt ? <span className="text-red-400">{t("apiKeys.statusRevoked")}</span> : <span className="text-emerald-400">{t("apiKeys.statusActive")}</span>}</td>
                    <td className="p-2 text-right">
                      {!k.revokedAt ? (
                        <Button variant="ghost" size="sm" className="h-6 px-1 text-[#b8c5d6] hover:text-red-400" onClick={() => revokeMutation.mutate(k.id)} disabled={revokeMutation.isPending} title={t("apiKeys.statusRevoked")}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-1 text-red-400 hover:text-red-500 hover:bg-red-500/10"
                          onClick={() => setKeyToDelete({ id: k.id, name: k.name })}
                          disabled={hardDeleteMutation.isPending}
                          title={t("apiKeys.deletePermanently")}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-card border border-border rounded-lg p-4 text-[11px] text-[#b8c5d6]">
          <div className="font-semibold text-white mb-1 text-[12px]">{t("apiKeys.usageTitle")}</div>
          <pre className="bg-background border border-border rounded p-2 overflow-x-auto text-[10px] leading-relaxed">
{`curl -H "X-API-Key: ibk_..." \\
     https://inboria.com/api/v1/public/emails`}
          </pre>
          <div className="mt-2">{t("apiKeys.rateLimitNotice")}</div>
        </div>
      </div>

      <AlertDialog open={!!keyToDelete} onOpenChange={(open) => !open && setKeyToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("apiKeys.deletePermanently")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("apiKeys.deletePermanentlyConfirm")}
              {keyToDelete?.name && (
                <span className="block mt-2 font-mono text-white">« {keyToDelete.name} »</span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600 text-white"
              onClick={() => {
                if (keyToDelete) {
                  hardDeleteMutation.mutate(keyToDelete.id);
                  setKeyToDelete(null);
                }
              }}
            >
              {t("apiKeys.deletePermanently")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
