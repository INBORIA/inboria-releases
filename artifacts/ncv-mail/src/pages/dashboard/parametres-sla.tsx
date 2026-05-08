import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useEnableLightTheme } from "@/lib/inbox-theme";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Clock, AlertTriangle, Loader2, Save, ChevronRight, ArrowLeft } from "lucide-react";
import { useState, useEffect } from "react";
import { Link } from "wouter";

interface MailboxPolicy {
  sharedMailboxId: string;
  mailboxName: string;
  mailboxEmail: string;
  policy: null | {
    id: string;
    targetMinutes: number;
    businessHours: { timezone: string; days: number[]; start: string; end: string };
    escalation: { email?: boolean };
    enabled: boolean;
  };
}

interface SlaBreach {
  id: string;
  emailId: number;
  subject: string;
  sender: string;
  emailStatus: string | null;
  mailboxName: string;
  mailboxEmail: string;
  targetMinutes: number;
  elapsedMinutes: number;
  detectedAt: string;
  resolvedAt: string | null;
}

const baseUrl = () => import.meta.env.BASE_URL.replace(/\/$/, "");

export default function ParametresSla() {
  useEnableLightTheme();
  const { t } = useTranslation();
  const { session } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const policiesQuery = useQuery<MailboxPolicy[]>({
    queryKey: ["sla-policies"],
    enabled: !!session,
    queryFn: async () => {
      const res = await fetch(`${baseUrl()}/api/sla/policies`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!res.ok) throw new Error("fetch failed");
      return res.json();
    },
  });

  const breachesQuery = useQuery<SlaBreach[]>({
    queryKey: ["sla-breaches"],
    enabled: !!session,
    queryFn: async () => {
      const res = await fetch(`${baseUrl()}/api/sla/breaches`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!res.ok) throw new Error("fetch failed");
      return res.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (input: { mailboxId: string; payload: any }) => {
      const res = await fetch(`${baseUrl()}/api/sla/policies/${input.mailboxId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify(input.payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || t("common.error"));
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t("sla.savedToast") });
      queryClient.invalidateQueries({ queryKey: ["sla-policies"] });
    },
    onError: (e: any) => {
      toast({ title: e.message, variant: "destructive" });
    },
  });

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-5 space-y-5">
        <div className="flex items-center gap-2">
          <Link href="/dashboard/parametres">
            <Button variant="ghost" size="sm" className="h-7 px-2">
              <ArrowLeft className="w-3.5 h-3.5 mr-1" /> {t("settings.title")}
            </Button>
          </Link>
        </div>
        <div>
          <h1 className="text-[16px] font-semibold text-white tracking-tight flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            {t("sla.title")}
          </h1>
          <p className="text-[12px] text-[#b8c5d6] mt-0.5">{t("sla.subtitle")}</p>
        </div>

        {policiesQuery.isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (policiesQuery.data || []).length === 0 ? (
          <div className="bg-card border border-border border-dashed rounded-lg p-6 text-center">
            <p className="text-[12px] text-[#b8c5d6]">{t("sla.noMailboxes")}</p>
            <Link href="/dashboard/equipe">
              <Button size="sm" variant="outline" className="mt-3 h-7 text-[11px]">
                {t("sla.gotoSharedMailboxes")} <ChevronRight className="w-3 h-3 ml-1" />
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {(policiesQuery.data || []).map((mb) => (
              <PolicyCard
                key={mb.sharedMailboxId}
                mailbox={mb}
                onSave={(payload) => updateMutation.mutate({ mailboxId: mb.sharedMailboxId, payload })}
                isSaving={updateMutation.isPending}
              />
            ))}
          </div>
        )}

        <div className="pt-4">
          <h2 className="text-[13px] font-semibold text-white flex items-center gap-1.5 mb-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            {t("sla.recentBreaches")}
          </h2>
          {breachesQuery.isLoading ? (
            <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin" /></div>
          ) : (breachesQuery.data || []).length === 0 ? (
            <div className="bg-card border border-border rounded-lg p-4 text-[12px] text-[#b8c5d6]">
              {t("sla.noBreaches")}
            </div>
          ) : (
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <table className="w-full text-[11px]">
                <thead className="bg-background border-b border-border">
                  <tr>
                    <th className="text-left p-2 text-[#b8c5d6]">{t("sla.thMailbox")}</th>
                    <th className="text-left p-2 text-[#b8c5d6]">{t("sla.thSender")}</th>
                    <th className="text-left p-2 text-[#b8c5d6]">{t("sla.thSubject")}</th>
                    <th className="text-right p-2 text-[#b8c5d6]">{t("sla.thElapsed")}</th>
                    <th className="text-right p-2 text-[#b8c5d6]">{t("sla.thStatus")}</th>
                  </tr>
                </thead>
                <tbody>
                  {(breachesQuery.data || []).slice(0, 50).map((b) => (
                    <tr key={b.id} className="border-b border-border/60">
                      <td className="p-2 text-white truncate max-w-[160px]">{b.mailboxName}</td>
                      <td className="p-2 text-[#c9d1d9] truncate max-w-[180px]">{b.sender}</td>
                      <td className="p-2 text-[#c9d1d9] truncate max-w-[260px]">{b.subject}</td>
                      <td className="p-2 text-right text-amber-400">{b.elapsedMinutes} / {b.targetMinutes} min</td>
                      <td className="p-2 text-right">
                        {b.resolvedAt
                          ? <span className="text-emerald-400">{t("sla.statusResolved")}</span>
                          : <span className="text-red-400">{t("sla.statusOpen")}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

function PolicyCard({
  mailbox,
  onSave,
  isSaving,
}: {
  mailbox: MailboxPolicy;
  onSave: (payload: any) => void;
  isSaving: boolean;
}) {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState<boolean>(mailbox.policy?.enabled ?? false);
  const [target, setTarget] = useState<number>(mailbox.policy?.targetMinutes ?? 240);
  const [start, setStart] = useState<string>(mailbox.policy?.businessHours?.start ?? "09:00");
  const [end, setEnd] = useState<string>(mailbox.policy?.businessHours?.end ?? "18:00");
  const [tz, setTz] = useState<string>(mailbox.policy?.businessHours?.timezone ?? "Europe/Brussels");
  const [days, setDays] = useState<number[]>(mailbox.policy?.businessHours?.days ?? [1, 2, 3, 4, 5]);
  const [emailNotif, setEmailNotif] = useState<boolean>(mailbox.policy?.escalation?.email ?? true);

  useEffect(() => {
    if (mailbox.policy) {
      setEnabled(mailbox.policy.enabled);
      setTarget(mailbox.policy.targetMinutes);
      setStart(mailbox.policy.businessHours.start);
      setEnd(mailbox.policy.businessHours.end);
      setTz(mailbox.policy.businessHours.timezone);
      setDays(mailbox.policy.businessHours.days);
      setEmailNotif(mailbox.policy.escalation.email ?? true);
    }
  }, [mailbox.policy]);

  const dayLabels = ["S", "L", "M", "M", "J", "V", "S"];

  function toggleDay(d: number) {
    setDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b));
  }

  function handleSave() {
    onSave({
      enabled,
      targetMinutes: target,
      businessHours: { timezone: tz, days, start, end },
      escalation: { email: emailNotif },
    });
  }

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[13px] font-semibold text-white">{mailbox.mailboxName}</div>
          <div className="text-[11px] text-[#b8c5d6]">{mailbox.mailboxEmail}</div>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor={`enabled-${mailbox.sharedMailboxId}`} className="text-[11px] text-[#b8c5d6]">{t("sla.enabled")}</Label>
          <Switch id={`enabled-${mailbox.sharedMailboxId}`} checked={enabled} onCheckedChange={setEnabled} />
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <Label className="text-[11px] text-[#b8c5d6]">{t("sla.targetMinutes")}</Label>
          <Input type="number" min={5} max={10080} value={target} onChange={(e) => setTarget(parseInt(e.target.value, 10) || 240)} className="h-8 text-[12px]" />
        </div>
        <div>
          <Label className="text-[11px] text-[#b8c5d6]">{t("sla.timezone")}</Label>
          <Input value={tz} onChange={(e) => setTz(e.target.value)} className="h-8 text-[12px]" />
        </div>
        <div>
          <Label className="text-[11px] text-[#b8c5d6]">{t("sla.start")}</Label>
          <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="h-8 text-[12px]" />
        </div>
        <div>
          <Label className="text-[11px] text-[#b8c5d6]">{t("sla.end")}</Label>
          <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="h-8 text-[12px]" />
        </div>
      </div>
      <div>
        <Label className="text-[11px] text-[#b8c5d6]">{t("sla.businessDays")}</Label>
        <div className="flex gap-1 mt-1">
          {dayLabels.map((lbl, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => toggleDay(idx)}
              className={`w-7 h-7 rounded text-[11px] font-medium border transition-colors ${
                days.includes(idx) ? "bg-primary text-white border-primary" : "bg-background text-[#b8c5d6] border-border"
              }`}
            >
              {lbl}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-[12px] text-[#c9d1d9]">
          <Switch checked={emailNotif} onCheckedChange={setEmailNotif} /> {t("sla.inAppNotif")}
        </label>
      </div>
      <div className="flex justify-end">
        <Button size="sm" disabled={isSaving} onClick={handleSave} className="h-7 text-[11px]">
          {isSaving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}
          {t("sla.save")}
        </Button>
      </div>
    </div>
  );
}
