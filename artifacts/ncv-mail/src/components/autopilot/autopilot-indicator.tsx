import { useEffect, useMemo, useRef, useState } from "react";
import {
  Sparkles,
  Inbox,
  PenLine,
  CheckSquare,
  CalendarPlus,
  Forward,
  ShieldOff,
  FileText,
  Clock,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetAutopilotActivity,
  getGetAutopilotActivityQueryKey,
  type AutopilotEvent,
} from "@workspace/api-client-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type EventTypeKey = AutopilotEvent["eventType"];

const ICONS: Record<EventTypeKey, React.ComponentType<{ className?: string }>> = {
  email_sorted: Inbox,
  draft_generated: PenLine,
  task_created: CheckSquare,
  appointment_extracted: CalendarPlus,
  forward_intro_generated: Forward,
  sender_blocked: ShieldOff,
  summary_generated: FileText,
  follow_up_detected: Clock,
};

const ACCENT: Record<EventTypeKey, string> = {
  email_sorted: "text-sky-300",
  draft_generated: "text-violet-300",
  task_created: "text-emerald-300",
  appointment_extracted: "text-amber-300",
  forward_intro_generated: "text-blue-300",
  sender_blocked: "text-rose-300",
  summary_generated: "text-fuchsia-300",
  follow_up_detected: "text-orange-300",
};

function formatRelative(iso: string, lang: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return lang === "fr" ? "à l'instant" : "just now";
  const min = Math.round(ms / 60_000);
  if (min < 60) return new Intl.RelativeTimeFormat(lang, { numeric: "auto" }).format(-min, "minute");
  const h = Math.round(min / 60);
  if (h < 24) return new Intl.RelativeTimeFormat(lang, { numeric: "auto" }).format(-h, "hour");
  const d = Math.round(h / 24);
  return new Intl.RelativeTimeFormat(lang, { numeric: "auto" }).format(-d, "day");
}

export function AutopilotIndicator() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language?.split("-")[0] || "fr";
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [tick, setTick] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  const { data } = useGetAutopilotActivity({
    query: { refetchInterval: 60_000, staleTime: 10_000 } as any,
  });

  // Re-render every 30s so relative timestamps stay fresh
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  // Realtime: invalidate the query whenever a new autopilot_event lands
  useEffect(() => {
    const channel = supabase
      .channel("autopilot-events")
      .on(
        "postgres_changes" as any,
        { event: "INSERT", schema: "public", table: "autopilot_events" },
        () => {
          queryClient.invalidateQueries({ queryKey: getGetAutopilotActivityQueryKey() });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Close panel on outside click / Esc
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const isActive = !!data?.isActive;
  const total = data?.todayCounts?.total ?? 0;
  const recent = useMemo(() => data?.recent ?? [], [data?.recent]);
  const latest = recent[0];

  const labelFor = (type: EventTypeKey) => t(`autopilot.events.${type}`);

  // tick is unused inside markup; reading it forces re-render for relative dates
  void tick;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "group flex h-8 items-center gap-2 rounded-full border border-white/5 bg-white/[0.03] px-2.5 transition",
          "hover:bg-white/[0.06] hover:border-white/10",
          open && "bg-white/[0.06] border-white/10",
        )}
        aria-label={t("autopilot.openPanel")}
      >
        <span className="relative flex h-2 w-2 shrink-0">
          {isActive && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/70 opacity-75" />
          )}
          <span
            className={cn(
              "relative inline-flex h-2 w-2 rounded-full",
              isActive ? "bg-emerald-400" : "bg-zinc-500",
            )}
          />
        </span>

        <Sparkles className="h-3.5 w-3.5 text-white/70 group-hover:text-white" />

        {latest && (
          <span className="hidden max-w-[280px] truncate text-[11px] text-white/50 md:inline">
            {labelFor(latest.eventType)}
            {latest.title ? ` — ${latest.title}` : ""}
          </span>
        )}

        {total > 0 && (
          <span
            className={cn(
              "ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5",
              "bg-emerald-500/15 text-[10px] font-semibold text-emerald-300",
            )}
          >
            {total}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          className={cn(
            "absolute right-0 top-[calc(100%+8px)] z-50 w-[380px] max-w-[calc(100vw-1rem)]",
            "overflow-hidden rounded-xl border border-white/10 bg-[#0b0d12] shadow-2xl shadow-black/50",
          )}
        >
          <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-emerald-300" />
              <span className="text-[12px] font-semibold tracking-wide text-white">
                {t("autopilot.panelTitle")}
              </span>
              <span
                className={cn(
                  "ml-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider",
                  isActive
                    ? "bg-emerald-500/15 text-emerald-300"
                    : "bg-zinc-700/40 text-zinc-400",
                )}
              >
                {isActive ? t("autopilot.statusActive") : t("autopilot.statusIdle")}
              </span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded p-1 text-white/40 transition hover:bg-white/5 hover:text-white"
              aria-label={t("common.close")}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Stats du jour */}
          <div className="grid grid-cols-4 gap-px border-b border-white/5 bg-white/5">
            <StatCell
              icon={<Inbox className="h-3 w-3" />}
              label={t("autopilot.short.sorted")}
              value={data?.todayCounts?.email_sorted ?? 0}
            />
            <StatCell
              icon={<PenLine className="h-3 w-3" />}
              label={t("autopilot.short.drafts")}
              value={data?.todayCounts?.draft_generated ?? 0}
            />
            <StatCell
              icon={<CheckSquare className="h-3 w-3" />}
              label={t("autopilot.short.tasks")}
              value={data?.todayCounts?.task_created ?? 0}
            />
            <StatCell
              icon={<CalendarPlus className="h-3 w-3" />}
              label={t("autopilot.short.appointments")}
              value={data?.todayCounts?.appointment_extracted ?? 0}
            />
          </div>

          {/* Timeline */}
          <div className="max-h-[420px] overflow-y-auto">
            {recent.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
                <Sparkles className="mb-2 h-5 w-5 text-white/20" />
                <p className="text-[11px] text-white/40">{t("autopilot.empty")}</p>
              </div>
            ) : (
              <ul className="divide-y divide-white/5">
                {recent.map((ev) => {
                  const Icon = ICONS[ev.eventType] ?? Sparkles;
                  const accent = ACCENT[ev.eventType] ?? "text-white/60";
                  return (
                    <li
                      key={ev.id}
                      className="flex items-start gap-3 px-4 py-2.5 transition hover:bg-white/[0.03]"
                    >
                      <div
                        className={cn(
                          "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/5",
                          accent,
                        )}
                      >
                        <Icon className="h-3 w-3" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[12px] leading-tight text-white/85">
                          {labelFor(ev.eventType)}
                        </div>
                        {ev.title && (
                          <div className="mt-0.5 truncate text-[11px] text-white/45">
                            {ev.title}
                          </div>
                        )}
                      </div>
                      <span className="shrink-0 text-[10px] text-white/35">
                        {formatRelative(ev.createdAt, lang)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="border-t border-white/5 px-4 py-2 text-center">
            <span className="text-[10px] text-white/30">{t("autopilot.last24h")}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCell({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="flex flex-col items-center justify-center bg-[#0b0d12] px-2 py-2.5">
      <div className="flex items-center gap-1 text-white/40">{icon}</div>
      <div className="mt-0.5 text-[14px] font-semibold leading-none text-white">{value}</div>
      <div className="mt-0.5 text-[9px] uppercase tracking-wider text-white/35">{label}</div>
    </div>
  );
}
