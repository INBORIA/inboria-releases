import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Clock, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { useSnoozeEmail, useUnsnoozeEmail, getListEmailsQueryKey, getGetEmailQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface Props {
  emailId: number;
  snoozedUntil?: string | null;
  variant?: "icon" | "full";
  onAfter?: () => void;
}

function nextMorning(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(8, 0, 0, 0);
  return d;
}

function nextWeek(): Date {
  const d = new Date();
  const day = d.getDay();
  const offset = ((1 - day + 7) % 7) || 7;
  d.setDate(d.getDate() + offset);
  d.setHours(8, 0, 0, 0);
  return d;
}

export function SnoozeButton({ emailId, snoozedUntil, variant = "full", onAfter }: Props) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customDate, setCustomDate] = useState<Date | undefined>(undefined);
  const [customTime, setCustomTime] = useState("09:00");
  const snoozeMut = useSnoozeEmail();
  const unsnoozeMut = useUnsnoozeEmail();

  const isSnoozed = !!snoozedUntil && new Date(snoozedUntil).getTime() > Date.now();

  const apply = (date: Date) => {
    if (date.getTime() <= Date.now()) {
      toast({ variant: "destructive", title: t("wave1.scheduleErrorPast") });
      return;
    }
    snoozeMut.mutate(
      { id: emailId, data: { snoozeUntil: date.toISOString() } },
      {
        onSuccess: () => {
          toast({ title: t("wave1.snoozeSuccess") });
          qc.invalidateQueries({ queryKey: getListEmailsQueryKey() });
          qc.invalidateQueries({ queryKey: getGetEmailQueryKey(emailId) });
          setOpen(false);
          setShowCustom(false);
          onAfter?.();
        },
        onError: (e: any) => {
          toast({ variant: "destructive", title: e?.message || "Snooze failed" });
        },
      }
    );
  };

  const wake = () => {
    unsnoozeMut.mutate(
      { id: emailId },
      {
        onSuccess: () => {
          toast({ title: t("wave1.unsnoozeSuccess") });
          qc.invalidateQueries({ queryKey: getListEmailsQueryKey() });
          qc.invalidateQueries({ queryKey: getGetEmailQueryKey(emailId) });
          setOpen(false);
          onAfter?.();
        },
      }
    );
  };

  if (isSnoozed) {
    const fmt = new Intl.DateTimeFormat(i18n.language, { dateStyle: "short", timeStyle: "short" });
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={wake}
        disabled={unsnoozeMut.isPending}
        className="h-7 text-[11px] gap-1 border-amber-500/30 text-amber-300 hover:bg-amber-500/10"
      >
        <BellOff className="w-3 h-3" />
        {t("wave1.snoozeWake")} ({fmt.format(new Date(snoozedUntil!))})
      </Button>
    );
  }

  const presets = [
    { label: t("wave1.snooze1h"), date: () => new Date(Date.now() + 60 * 60 * 1000) },
    { label: t("wave1.snooze3h"), date: () => new Date(Date.now() + 3 * 60 * 60 * 1000) },
    { label: t("wave1.snoozeTomorrow"), date: nextMorning },
    { label: t("wave1.snoozeNextWeek"), date: nextWeek },
  ];

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setShowCustom(false); }}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="ghost" className={variant === "icon" ? "h-7 w-7 p-0" : "h-7 text-[11px] gap-1"}>
          <Clock className="w-3 h-3" />
          {variant === "full" && t("wave1.snoozeButton")}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="end">
        {!showCustom ? (
          <div className="flex flex-col gap-1">
            <div className="px-2 py-1 text-[11px] text-muted-foreground">{t("wave1.snoozeTitle")}</div>
            {presets.map((p) => (
              <button
                key={p.label}
                onClick={() => apply(p.date())}
                disabled={snoozeMut.isPending}
                className="text-left text-[12px] px-2 py-1.5 rounded hover:bg-accent transition-colors"
              >
                {p.label}
              </button>
            ))}
            <button
              onClick={() => setShowCustom(true)}
              className="text-left text-[12px] px-2 py-1.5 rounded hover:bg-accent transition-colors text-primary"
            >
              {t("wave1.snoozeCustom")}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Calendar
              mode="single"
              selected={customDate}
              onSelect={setCustomDate}
              disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
              className="p-1"
            />
            <Input
              type="time"
              value={customTime}
              onChange={(e) => setCustomTime(e.target.value)}
              className="h-8 text-[12px]"
            />
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" onClick={() => setShowCustom(false)} className="h-7 text-[11px]">
                {t("wave1.snoozeCancel")}
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  if (!customDate) return;
                  const [h, m] = customTime.split(":").map(Number);
                  const d = new Date(customDate);
                  d.setHours(h || 9, m || 0, 0, 0);
                  apply(d);
                }}
                disabled={!customDate || snoozeMut.isPending}
                className="h-7 text-[11px]"
              >
                {t("wave1.snoozeApply")}
              </Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
export default SnoozeButton;
