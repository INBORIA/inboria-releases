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
import { Clock, Loader2, Save, ArrowLeft, Pause } from "lucide-react";
import { useSmartBack } from "@/components/dashboard/back-to-inbox-button";
import { useState, useEffect, useMemo } from "react";
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

const baseUrl = () => import.meta.env.BASE_URL.replace(/\/$/, "");

const PRESETS = [
  { minutes: 60, label: "1h" },
  { minutes: 240, label: "4h" },
  { minutes: 480, label: "8h" },
  { minutes: 1440, label: "24h" },
  { minutes: 2880, label: "48h" },
];

const HOLIDAY_KEY = "inboria_sla_holiday_pause";

interface HolidayPause {
  from: string;
  to: string;
}

function loadHoliday(): HolidayPause | null {
  try {
    const raw = localStorage.getItem(HOLIDAY_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (p?.from && p?.to) return p;
    return null;
  } catch {
    return null;
  }
}

function isHolidayActive(p: HolidayPause | null): boolean {
  if (!p) return false;
  const today = new Date().toISOString().slice(0, 10);
  return today >= p.from && today <= p.to;
}

export default function ParametresSla() {
  const back = useSmartBack("/dashboard/parametres", "settings.title", "Paramètres");
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

  const mailboxes = useMemo(() => policiesQuery.data || [], [policiesQuery.data]);

  // Initial values inferred from the first mailbox policy (or defaults)
  const firstPolicy = mailboxes.find((m) => m.policy)?.policy ?? null;
  const initialTarget = firstPolicy?.targetMinutes ?? 240;
  const initialDays = firstPolicy?.businessHours?.days ?? [1, 2, 3, 4, 5];
  const initialPauseWeekend = !(initialDays.includes(0) && initialDays.includes(6));
  const initialEnabled = firstPolicy?.enabled ?? true;

  const [target, setTarget] = useState<number>(initialTarget);
  const [pauseWeekend, setPauseWeekend] = useState<boolean>(initialPauseWeekend);
  const [globalEnabled, setGlobalEnabled] = useState<boolean>(initialEnabled);

  const [holiday, setHoliday] = useState<HolidayPause | null>(() => loadHoliday());
  const [holidayFrom, setHolidayFrom] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [holidayTo, setHolidayTo] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });

  // Sync once mailboxes load
  useEffect(() => {
    if (firstPolicy) {
      setTarget(firstPolicy.targetMinutes);
      const d = firstPolicy.businessHours?.days ?? [1, 2, 3, 4, 5];
      setPauseWeekend(!(d.includes(0) && d.includes(6)));
      setGlobalEnabled(firstPolicy.enabled);
    }
  }, [firstPolicy]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      const days = pauseWeekend ? [1, 2, 3, 4, 5] : [0, 1, 2, 3, 4, 5, 6];
      const businessHours = {
        timezone:
          firstPolicy?.businessHours?.timezone ||
          Intl.DateTimeFormat().resolvedOptions().timeZone ||
          "Europe/Brussels",
        days,
        start: "00:00",
        end: "23:59",
      };
      await Promise.all(
        mailboxes.map(async (mb) => {
          const res = await fetch(`${baseUrl()}/api/sla/policies/${mb.sharedMailboxId}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session?.access_token}`,
            },
            body: JSON.stringify({
              enabled: globalEnabled,
              targetMinutes: target,
              businessHours,
              escalation: { email: true },
            }),
          });
          if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            throw new Error(j.error || t("common.error"));
          }
        })
      );
    },
    onSuccess: () => {
      toast({ title: "Réglages enregistrés pour toutes les boîtes partagées" });
      queryClient.invalidateQueries({ queryKey: ["sla-policies"] });
    },
    onError: (e: any) => {
      toast({ title: e.message, variant: "destructive" });
    },
  });

  function applyHoliday() {
    if (holidayFrom > holidayTo) {
      toast({ title: "La date de fin doit être après la date de début", variant: "destructive" });
      return;
    }
    const p = { from: holidayFrom, to: holidayTo };
    localStorage.setItem(HOLIDAY_KEY, JSON.stringify(p));
    setHoliday(p);
    toast({ title: "Pause vacances activée" });
  }

  function cancelHoliday() {
    localStorage.removeItem(HOLIDAY_KEY);
    setHoliday(null);
    toast({ title: "Pause vacances annulée" });
  }

  const holidayActive = isHolidayActive(holiday);

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-5 space-y-5">
        <div>
          <Link href={back.href}>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-[#b8c5d6] hover:text-white" title={t(back.labelKey, back.labelFallback)} aria-label={t(back.labelKey, back.labelFallback)}>
              <ArrowLeft className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>

        <div>
          <h1 className="text-[16px] font-semibold text-white tracking-tight flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            SLA — Délai de réponse
          </h1>
          <p className="text-[12px] text-[#b8c5d6] mt-0.5">
            Réglage commun à toutes vos boîtes partagées. Le compteur démarre à la réception d'un email et s'arrête dès qu'une réponse est envoyée.
          </p>
        </div>

        {policiesQuery.isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : mailboxes.length === 0 ? (
          <div className="bg-card border border-border border-dashed rounded-lg p-6 text-center">
            <p className="text-[12px] text-[#b8c5d6]">
              Aucune boîte partagée connectée. Activez-en une dans <Link href="/dashboard/parametres/mon-compte#shared-mailboxes" className="text-primary hover:underline">Boîtes partagées</Link>.
            </p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-lg p-4 space-y-5">
            {/* On/Off global */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[13px] font-medium text-white">Activer le suivi SLA</div>
                <div className="text-[11px] text-[#8b95a7]">S'applique à {mailboxes.length} boîte{mailboxes.length > 1 ? "s" : ""} partagée{mailboxes.length > 1 ? "s" : ""}.</div>
              </div>
              <Switch checked={globalEnabled} onCheckedChange={setGlobalEnabled} />
            </div>

            {/* Delay presets */}
            <div className={globalEnabled ? "" : "opacity-50 pointer-events-none"}>
              <Label className="text-[12px] text-white mb-2 block">Délai cible</Label>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p.minutes}
                    type="button"
                    onClick={() => setTarget(p.minutes)}
                    className={`h-9 px-4 rounded text-[12px] font-medium border transition-colors ${
                      target === p.minutes
                        ? "bg-primary text-white border-primary"
                        : "bg-background text-[#c9d1d9] border-border hover:border-primary/40"
                    }`}
                    data-testid={`preset-${p.minutes}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Weekend pause */}
            <div className={`flex items-center justify-between ${globalEnabled ? "" : "opacity-50 pointer-events-none"}`}>
              <div>
                <div className="text-[12px] font-medium text-white">Mettre en pause le week-end</div>
                <div className="text-[11px] text-[#8b95a7]">Samedi et dimanche : le compteur ne tourne pas.</div>
              </div>
              <Switch checked={pauseWeekend} onCheckedChange={setPauseWeekend} />
            </div>

            <div className="flex justify-end pt-1">
              <Button
                size="sm"
                disabled={updateMutation.isPending}
                onClick={() => updateMutation.mutate()}
                className="h-8 text-[12px]"
                data-testid="save-sla"
              >
                {updateMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}
                Enregistrer
              </Button>
            </div>
          </div>
        )}

        {/* Holiday pause */}
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Pause className="w-4 h-4 text-amber-400" />
            <div>
              <div className="text-[13px] font-medium text-white">Pause vacances / fermeture</div>
              <div className="text-[11px] text-[#8b95a7]">Aucun email ne sera compté en retard pendant cette période.</div>
            </div>
          </div>

          {holiday ? (
            <div className="flex items-center justify-between gap-3 rounded border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2">
              <div className="text-[12px] text-[#e6e9ef]">
                {holidayActive ? <span className="text-amber-300 font-medium mr-2">● En cours</span> : <span className="text-[#8b95a7] mr-2">Programmée</span>}
                du <strong>{holiday.from}</strong> au <strong>{holiday.to}</strong>
              </div>
              <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={cancelHoliday} data-testid="cancel-holiday">
                Annuler la pause
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-end">
              <div>
                <Label className="text-[11px] text-[#b8c5d6]">Du</Label>
                <Input type="date" value={holidayFrom} onChange={(e) => setHolidayFrom(e.target.value)} className="h-8 text-[12px]" />
              </div>
              <div>
                <Label className="text-[11px] text-[#b8c5d6]">Au</Label>
                <Input type="date" value={holidayTo} onChange={(e) => setHolidayTo(e.target.value)} className="h-8 text-[12px]" />
              </div>
              <Button size="sm" className="h-8 text-[12px]" onClick={applyHoliday} data-testid="apply-holiday">
                Activer la pause
              </Button>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
