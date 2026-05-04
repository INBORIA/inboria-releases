import { DashboardLayout } from "@/components/layout/dashboard-layout";
import {
  useGenerateDailySummary,
  useListAppointments,
  useGetOrganisationMembers,
  useGetSharedMailboxes,
  useListProjects,
  useGetMyOrganisation,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { BackToInboxButton } from "@/components/dashboard/back-to-inbox-button";
import { Sparkles, ArrowRight, AlertTriangle, TrendingUp, RefreshCw, CheckSquare, BarChart3, CalendarDays, Clock, MapPin, Download, Users, FileText, Mail, HelpCircle, ChevronDown, ChevronRight } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Tooltip as InfoTooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTranslation } from "react-i18next";
import { format, parseISO, startOfDay, endOfDay, addDays, type Locale } from "date-fns";
import { fr, enUS, nl } from "date-fns/locale";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
  type TooltipProps,
} from "recharts";

const dateLocales: Record<string, Locale> = { fr, en: enUS, nl };

const baseUrl = () => import.meta.env.BASE_URL.replace(/\/$/, "");

interface TeamAnalytics {
  totals: { emails: number; assigned: number; notHandled: number; handled: number | null; avgHandlingMinutes: number | null; period: string };
  filters?: { period: string; member: string | null; mailbox: string | null; project: string | null };
  handledMetricsEnabled?: boolean;
  perMember: { userId: string; userName: string; handled: number; assigned: number; openLoad: number; avgFirstResponseMinutes: number | null }[];
  perMailbox?: { mailboxId: string | null; mailboxName: string; mailboxEmail: string; count: number; received: number; handled: number; notHandled: number; avgFirstResponseMinutes: number | null }[];
  perPersonalMailbox?: { userId: string; userName: string; received: number; handled: number; notHandled: number; avgFirstResponseMinutes: number | null }[];
  perProject?: { projectId: string; projectName: string; projectReference: string; count: number; received: number; handled: number; notHandled: number; avgFirstResponseMinutes: number | null }[];
  tasksPerMember?: { userId: string; userName: string; open: number; done: number; overdue: number }[];
  tasksPerProject?: { projectId: string | null; projectName: string; projectReference: string; isOutOfProject: boolean; open: number; done: number; overdue: number }[];
  topSenders: { email: string; count: number }[];
  topCategories: { name: string; count: number }[];
  evolution: { date: string; count: number; handledCount: number }[];
  slaSummary: { totalBreaches: number; openBreaches: number };
}

function formatDelay(min: number | null | undefined): string {
  if (min == null) return "—";
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `${h} h`;
  return `${Math.round(h / 24)} j`;
}

const PIE_COLORS = ["#2d7dd2", "#7d4ed2", "#d2a02d", "#d24e6f", "#4ed29a", "#d2bc4e"];

type MailMemberDatum = { name: string; openLoad: number; handled: number; delayLabel: string };
type DelayDatum = { name: string; delay: number; label: string };
type ScopeDatum = { name: string; received: number; handled: number; notHandled: number; delayLabel: string };
type PersonalDatum = { name: string; received: number; handled: number; notHandled: number; delayLabel: string };
type TaskDatum = { name: string; open: number; done: number; overdue: number };

type TooltipRow = { label: string; value: ReactNode; color?: string };

function TooltipBox({ title, rows }: { title: string; rows: TooltipRow[] }) {
  return (
    <div className="rounded border border-[#1f2937] bg-[#0d1117] px-2 py-1.5 text-[11px] shadow min-w-[160px]">
      <p className="font-medium text-white mb-1 truncate">{title}</p>
      {rows.map((r, i) => (
        <div key={i} className="flex items-center justify-between gap-3">
          <span className="text-[#8b9cb3]">{r.label}</span>
          <span style={{ color: r.color ?? "#fff" }}>{r.value}</span>
        </div>
      ))}
    </div>
  );
}

function makeChartTooltip<T extends { name?: string }>(buildRows: (datum: T) => TooltipRow[]) {
  return function ChartTooltipContent(props: TooltipProps<number | string, string>) {
    const { active, payload } = props;
    if (!active || !payload || payload.length === 0) return null;
    const datum = payload[0].payload as T;
    return <TooltipBox title={datum.name ?? ""} rows={buildRows(datum)} />;
  };
}

export default function BilanQuotidien() {
  const { t, i18n } = useTranslation();
  const { session } = useAuth();
  const locale = dateLocales[i18n.language] || fr;
  const generateSummary = useGenerateDailySummary();
  const [summaryData, setSummaryData] = useState<any>(null);
  const [period, setPeriod] = useState<"7d" | "30d" | "90d">("30d");
  const [memberFilter, setMemberFilter] = useState<string>("");
  const [mailboxFilter, setMailboxFilter] = useState<string>("");
  const [projectFilter, setProjectFilter] = useState<string>("");

  const { data: orgMembers } = useGetOrganisationMembers();
  const { data: sharedMailboxes } = useGetSharedMailboxes();
  const { data: projectsList } = useListProjects();
  const { data: myOrg } = useGetMyOrganisation();
  const myRole = (myOrg as { myRole?: string } | undefined)?.myRole;
  const isOrgAdmin = myRole === "admin" || myRole === "owner";

  const now = new Date();
  const tomorrow = addDays(now, 1);
  const { data: todayAppointments = [] } = useListAppointments({
    from: startOfDay(now).toISOString(),
    to: endOfDay(now).toISOString(),
  });
  const { data: tomorrowAppointments = [] } = useListAppointments({
    from: startOfDay(tomorrow).toISOString(),
    to: endOfDay(tomorrow).toISOString(),
  });

  const currentLang = (i18n.resolvedLanguage || i18n.language || "fr").substring(0, 2);

  const filterQS = () => {
    const p = new URLSearchParams({ period });
    if (memberFilter) p.set("member", memberFilter);
    if (mailboxFilter) p.set("mailbox", mailboxFilter);
    if (projectFilter) p.set("project", projectFilter);
    return p.toString();
  };

  const teamAnalytics = useQuery<TeamAnalytics>({
    queryKey: ["analytics-team", period, memberFilter, mailboxFilter, projectFilter],
    enabled: !!session && isOrgAdmin,
    queryFn: async () => {
      const res = await fetch(`${baseUrl()}/api/analytics/team?${filterQS()}`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!res.ok) throw new Error("fetch failed");
      return res.json();
    },
  });

  const fetchSummary = () => {
    generateSummary.mutate(
      { data: { language: currentLang } },
      { onSuccess: (data) => setSummaryData(data) }
    );
  };

  async function downloadFile(format: "csv" | "pdf") {
    const url = `${baseUrl()}/api/analytics/team/export.${format}?${filterQS()}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const { saveBlobAs } = await import("@/lib/export-utils");
    await saveBlobAs(blob, `inboria-team-${period}.${format === "pdf" ? "pdf" : "csv"}`);
  }

  const ta = teamAnalytics.data;

  const loadPerMemberData: MailMemberDatum[] = (ta?.perMember ?? [])
    .map((m) => ({
      name: m.userName || m.userId.slice(0, 8),
      openLoad: m.openLoad,
      handled: m.handled,
      delayLabel: formatDelay(m.avgFirstResponseMinutes),
    }))
    .filter((m) => m.openLoad + m.handled > 0)
    .sort((a, b) => b.openLoad - a.openLoad);

  const delayPerMemberData: DelayDatum[] = (ta?.perMember ?? [])
    .filter((m) => m.avgFirstResponseMinutes != null)
    .map((m) => ({
      name: m.userName || m.userId.slice(0, 8),
      delay: m.avgFirstResponseMinutes as number,
      label: formatDelay(m.avgFirstResponseMinutes),
    }))
    .sort((a, b) => b.delay - a.delay);

  const sharedMailboxData: ScopeDatum[] = (ta?.perMailbox ?? [])
    .map((m) => ({
      name: m.mailboxName + (m.mailboxEmail && m.mailboxEmail !== m.mailboxName ? ` (${m.mailboxEmail})` : ""),
      received: m.received ?? m.count,
      handled: m.handled,
      notHandled: m.notHandled ?? Math.max(0, (m.received ?? m.count) - m.handled),
      delayLabel: formatDelay(m.avgFirstResponseMinutes),
    }))
    .filter((m) => m.handled + m.notHandled > 0)
    .sort((a, b) => b.notHandled - a.notHandled);

  const projectsData: ScopeDatum[] = (ta?.perProject ?? [])
    .map((p) => ({
      name: p.projectName + (p.projectReference ? ` [${p.projectReference}]` : ""),
      received: p.received ?? p.count,
      handled: p.handled,
      notHandled: p.notHandled ?? Math.max(0, (p.received ?? p.count) - p.handled),
      delayLabel: formatDelay(p.avgFirstResponseMinutes),
    }))
    .filter((p) => p.handled + p.notHandled > 0)
    .sort((a, b) => b.notHandled - a.notHandled);

  const personalMailboxData: PersonalDatum[] = (ta?.perPersonalMailbox ?? [])
    .map((m) => ({
      name: m.userName || m.userId.slice(0, 8),
      received: m.received,
      handled: m.handled,
      notHandled: m.notHandled,
      delayLabel: formatDelay(m.avgFirstResponseMinutes),
    }))
    .filter((m) => m.received + m.handled > 0)
    .sort((a, b) => b.received - a.received);

  const tasksMemberPie: TaskDatum[] = (ta?.tasksPerMember ?? [])
    .filter((m) => m.open + m.done + m.overdue > 0)
    .map((m) => ({
      name: m.userName || m.userId.slice(0, 8),
      open: m.open,
      done: m.done,
      overdue: m.overdue,
    }));
  const totalOpenTasks = tasksMemberPie.reduce((s, m) => s + m.open, 0);

  const tasksProjectData: TaskDatum[] = (ta?.tasksPerProject ?? [])
    .filter((p) => p.open + p.done + p.overdue > 0)
    .map((p) => ({
      name: p.isOutOfProject ? t("analytics.outOfProject") : (p.projectName + (p.projectReference ? ` [${p.projectReference}]` : "")),
      open: p.open,
      done: p.done,
      overdue: p.overdue,
    }));

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-5">
        <BackToInboxButton />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div>
            <h1 className="text-[16px] font-semibold text-white tracking-tight flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              {t("brief.aiDailyBrief")}
            </h1>
            <p className="text-[12px] text-[#8b9cb3] mt-0.5">{t("brief.personalizedSummary")}</p>
          </div>
          <Button onClick={fetchSummary} disabled={generateSummary.isPending} size="sm" className="shrink-0 h-8 text-[12px]">
            <RefreshCw className={`w-3 h-3 mr-1.5 ${generateSummary.isPending ? "animate-spin" : ""}`} />
            {t("brief.regenerate")}
          </Button>
        </div>

        {generateSummary.isPending && !summaryData ? (
          <div className="bg-card rounded-lg border border-border p-8 flex flex-col items-center justify-center text-center">
            <RefreshCw className="w-8 h-8 text-primary animate-spin mb-3" />
            <h3 className="text-[13px] font-medium text-white">{t("brief.analyzing")}</h3>
            <p className="text-[12px] text-[#8b9cb3] mt-1 max-w-md">{t("brief.analyzingDesc")}</p>
          </div>
        ) : !summaryData ? (
          <div className="bg-card rounded-lg border border-border border-dashed p-8 flex flex-col items-center justify-center text-center mb-4">
            <BarChart3 className="w-8 h-8 text-[#8b9cb3]/30 mb-3" />
            <h3 className="text-[13px] font-medium text-white mb-1">{t("brief.noBrief")}</h3>
            <p className="text-[12px] text-[#8b9cb3] mb-3">{t("brief.clickRegenerate")}</p>
            <Button onClick={fetchSummary} size="sm" className="h-7 text-[11px]">
              <Sparkles className="w-3 h-3 mr-1.5" />
              {t("brief.generateBrief")}
            </Button>
          </div>
        ) : (
          <div className="space-y-3 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-3.5 relative overflow-hidden">
                <p className="text-[10px] font-medium text-primary uppercase tracking-wider mb-0.5">{t("brief.serenityScore")}</p>
                <div className="flex items-end gap-1">
                  <span className="text-2xl font-bold text-white tracking-tighter">{summaryData.score}</span>
                  <span className="text-[12px] text-[#8b9cb3] mb-0.5">/100</span>
                </div>
                <div className="w-full h-1 bg-white/10 rounded-full mt-2 overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${summaryData.score}%` }} />
                </div>
              </div>

              <div className="bg-card rounded-lg border border-red-500/20 bg-red-500/5 p-3.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                  <span className="text-[10px] font-medium text-red-400 uppercase tracking-wider">{t("brief.urgencies")}</span>
                </div>
                <div className="text-xl font-bold text-white">
                  {summaryData.stats.urgent} <span className="text-[11px] font-normal text-[#8b9cb3]">{t("brief.toHandle")}</span>
                </div>
              </div>

              <div className="bg-card rounded-lg border border-primary/20 bg-primary/5 p-3.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <CheckSquare className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[10px] font-medium text-primary uppercase tracking-wider">{t("brief.tasksLabel")}</span>
                </div>
                <div className="text-xl font-bold text-white">
                  {summaryData.stats.pending} <span className="text-[11px] font-normal text-[#8b9cb3]">{t("brief.newTasks")}</span>
                </div>
              </div>
            </div>

            {todayAppointments.length > 0 && (
              <div className="bg-card rounded-lg border border-border border-l-2 border-l-amber-400 p-4">
                <h2 className="text-[13px] font-semibold text-white mb-2 flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5 text-amber-400" />
                  {t("agenda.todayAppointments")} ({todayAppointments.length})
                </h2>
                <div className="space-y-1.5">
                  {todayAppointments.map((apt) => (
                    <Link key={apt.id} href="/dashboard/agenda" className="flex items-center gap-3 text-[12px] p-2 rounded hover:bg-[#1a2235] transition-colors">
                      <div className="flex items-center gap-1 text-amber-400 shrink-0 w-24">
                        <Clock className="w-3 h-3" />
                        {apt.allDay ? t("agenda.allDay") : `${format(parseISO(apt.startAt), "HH:mm")} - ${format(parseISO(apt.endAt), "HH:mm")}`}
                      </div>
                      <span className="text-white font-medium truncate">{apt.title}</span>
                      {apt.location && (
                        <span className="text-[#8b9cb3] flex items-center gap-1 shrink-0">
                          <MapPin className="w-3 h-3" />
                          {apt.location}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {tomorrowAppointments.length > 0 && (
              <div className="bg-card rounded-lg border border-border border-l-2 border-l-blue-400 p-4">
                <h2 className="text-[13px] font-semibold text-white mb-2 flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5 text-blue-400" />
                  {t("agenda.tomorrowAppointments")} ({tomorrowAppointments.length})
                </h2>
                <div className="space-y-1.5">
                  {tomorrowAppointments.map((apt) => (
                    <Link key={apt.id} href="/dashboard/agenda" className="flex items-center gap-3 text-[12px] p-2 rounded hover:bg-[#1a2235] transition-colors">
                      <div className="flex items-center gap-1 text-blue-400 shrink-0 w-24">
                        <Clock className="w-3 h-3" />
                        {apt.allDay ? t("agenda.allDay") : `${format(parseISO(apt.startAt), "HH:mm")} - ${format(parseISO(apt.endAt), "HH:mm")}`}
                      </div>
                      <span className="text-white font-medium truncate">{apt.title}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-card rounded-lg border border-border border-l-2 border-l-primary p-4">
              <h2 className="text-[13px] font-semibold text-white mb-2">{t("brief.overview")}</h2>
              <p className="text-[12px] text-[#8b9cb3] leading-relaxed">{summaryData.summary}</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <div className="lg:col-span-2 space-y-2">
                <h3 className="text-[12px] font-semibold text-white flex items-center gap-1.5">
                  <ArrowRight className="w-3.5 h-3.5 text-primary" />
                  {t("brief.keyEmails")}
                </h3>
                {summaryData.keyEmails.length > 0 ? (
                  summaryData.keyEmails.map((email: any) => (
                    <div key={email.id} className="bg-card rounded-lg border border-border p-3 hover:bg-[#1a2235] transition-colors">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-medium text-[12px] text-white">{email.sender}</span>
                        {email.priority === "urgent" ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium border bg-red-500/15 text-red-400 border-red-500/20">{t("brief.urgent")}</span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium border bg-amber-500/15 text-amber-400 border-amber-500/20">{t("brief.important")}</span>
                        )}
                      </div>
                      <h4 className="text-[12px] text-[#8b9cb3] mb-1.5">{email.subject}</h4>
                      <p className="text-[11px] text-[#8b9cb3]/70 bg-background rounded p-2 border border-border">{email.summary}</p>
                    </div>
                  ))
                ) : (
                  <div className="bg-card rounded-lg border border-border border-dashed p-6 text-center">
                    <p className="text-[12px] text-[#8b9cb3]">{t("brief.noCriticalEmail")}</p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <h3 className="text-[12px] font-semibold text-white flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-primary" />
                  {t("brief.dailyAdvice")}
                </h3>
                <div className="bg-card rounded-lg border border-border p-3.5">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                  </div>
                  <p className="text-[12px] text-[#8b9cb3] leading-relaxed italic">"{summaryData.advice}"</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {isOrgAdmin && (
        <div className="border-t border-border pt-5 mt-2">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-[14px] font-semibold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                {t("analytics.title")}
              </h2>
              <p className="text-[11px] text-[#8b9cb3] mt-0.5">{t("analytics.subtitle")}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center bg-card border border-border rounded p-0.5">
                {(["7d", "30d", "90d"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPeriod(p)}
                    className={`text-[10px] px-2 py-1 rounded ${period === p ? "bg-primary text-white" : "text-[#8b9cb3] hover:text-white"}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <select
                value={memberFilter}
                onChange={(e) => setMemberFilter(e.target.value)}
                className="bg-card border border-border rounded text-[10px] text-white h-7 px-1.5 max-w-[140px]"
                title={t("analytics.filterMember", { defaultValue: "Member" })}
              >
                <option value="">{t("analytics.allMembers", { defaultValue: "All members" })}</option>
                {((orgMembers as any[]) || []).map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.fullName || m.email || m.userId.slice(0, 8)}
                  </option>
                ))}
              </select>
              <select
                value={mailboxFilter}
                onChange={(e) => setMailboxFilter(e.target.value)}
                className="bg-card border border-border rounded text-[10px] text-white h-7 px-1.5 max-w-[140px]"
                title={t("analytics.filterMailbox", { defaultValue: "Mailbox" })}
              >
                <option value="">{t("analytics.allMailboxes", { defaultValue: "All mailboxes" })}</option>
                {((sharedMailboxes as any[]) || []).map((m) => (
                  <option key={m.id} value={m.id}>{m.name || m.emailAddress}</option>
                ))}
              </select>
              <select
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                className="bg-card border border-border rounded text-[10px] text-white h-7 px-1.5 max-w-[140px]"
                title={t("analytics.filterProject", { defaultValue: "Project" })}
              >
                <option value="">{t("analytics.allProjects", { defaultValue: "All projects" })}</option>
                {((projectsList as any[]) || []).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => downloadFile("csv")}>
                <Download className="w-3 h-3 mr-1" /> CSV
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => downloadFile("pdf")}>
                <FileText className="w-3 h-3 mr-1" /> PDF
              </Button>
            </div>
          </div>

          {teamAnalytics.isLoading ? (
            <div className="flex justify-center py-6"><RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" /></div>
          ) : !ta ? (
            <div className="bg-card border border-border rounded-lg p-4 text-[12px] text-[#8b9cb3]">{t("analytics.empty")}</div>
          ) : (
            <div className="space-y-3">
              {ta.handledMetricsEnabled === false && (
                <div className="bg-amber-500/10 border border-amber-500/30 text-amber-200 rounded-lg p-3 text-[11px]">
                  {t("analytics.migrationBanner")}
                </div>
              )}
              {ta.handledMetricsEnabled === false ? (
                // Migration non appliquée : on conserve l'ancien rendu —
                // Total / Assignés / Écartés / Délai moyen (proxy
                // claimed_at/assigned_at/inboria_processed_at) /
                // Dépassements SLA. Le bandeau prévient l'utilisateur.
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  <StatCard label={t("analytics.totalEmails")} value={ta.totals.emails} />
                  <StatCard label={t("analytics.assigned")} value={ta.totals.assigned} />
                  <StatCard label={t("analytics.notHandled")} value={ta.totals.notHandled ?? Math.max(0, ta.totals.emails - (ta.totals.handled ?? ta.totals.assigned))} />
                  <StatCardText label={t("analytics.avgHandlingTime")} value={formatDelay(ta.totals.avgHandlingMinutes)} />
                  <StatCard label={t("analytics.openBreaches")} value={ta.slaSummary.openBreaches} accent={ta.slaSummary.openBreaches > 0 ? "red" : "default"} />
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  <StatCard label={t("analytics.totalEmails")} value={ta.totals.emails} />
                  <StatCard label={t("analytics.handled")} value={ta.totals.handled ?? 0} />
                  <StatCard label={t("analytics.notHandled")} value={ta.totals.notHandled ?? Math.max(0, ta.totals.emails - (ta.totals.handled ?? 0))} />
                  <StatCardText label={t("analytics.avgHandlingTime")} value={formatDelay(ta.totals.avgHandlingMinutes)} />
                  <StatCard label={t("analytics.openBreaches")} value={ta.slaSummary.openBreaches} accent={ta.slaSummary.openBreaches > 0 ? "red" : "default"} />
                </div>
              )}

              <div className="bg-card rounded-lg border border-border p-3">
                <h3 className="text-[12px] font-semibold text-white mb-2">{t("analytics.evolution")}</h3>
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={ta.evolution}>
                      <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#8b9cb3" }} />
                      <YAxis tick={{ fontSize: 10, fill: "#8b9cb3" }} allowDecimals={false} />
                      <Tooltip contentStyle={{ background: "#0d1117", border: "1px solid #1f2937", fontSize: 11 }} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      <Line type="monotone" dataKey="count" name={t("analytics.receivedPerDay")} stroke="#2d7dd2" strokeWidth={2} dot={false} />
                      {ta.handledMetricsEnabled !== false && (
                        <Line type="monotone" dataKey="handledCount" name={t("analytics.handledPerDay")} stroke="#4ed29a" strokeWidth={2} dot={false} />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-card rounded-lg border border-border p-3">
                  <h3 className="text-[12px] font-semibold text-white mb-2">{t("analytics.topSenders")}</h3>
                  {ta.topSenders.length === 0 ? (
                    <p className="text-[11px] text-[#8b9cb3] py-6 text-center">{t("analytics.noTopSenders")}</p>
                  ) : (
                    <div className="h-44 sm:h-56 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={ta.topSenders.slice(0, 8)} layout="vertical" margin={{ left: 8, right: 16 }}>
                          <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                          <XAxis type="number" tick={{ fontSize: 10, fill: "#8b9cb3" }} allowDecimals={false} />
                          <YAxis type="category" dataKey="email" width={210} tick={{ fontSize: 10, fill: "#8b9cb3" }} interval={0} />
                          <Tooltip contentStyle={{ background: "#0d1117", border: "1px solid #1f2937", fontSize: 11 }} />
                          <Bar dataKey="count" fill="#2d7dd2" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                <div className="bg-card rounded-lg border border-border p-3">
                  <h3 className="text-[12px] font-semibold text-white mb-2">{t("analytics.topCategories")}</h3>
                  <div className="h-44 sm:h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={ta.topCategories.slice(0, 6)} dataKey="count" nameKey="name" outerRadius={70} label={{ fontSize: 10, fill: "#c9d1d9" }}>
                          {ta.topCategories.slice(0, 6).map((_, idx) => (
                            <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ background: "#0d1117", border: "1px solid #1f2937", fontSize: 11 }} />
                        <Legend wrapperStyle={{ fontSize: 10 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* ===== BLOC MAILS ===== */}
              {(loadPerMemberData.length > 0 || delayPerMemberData.length > 0 || sharedMailboxData.length > 0 || projectsData.length > 0 || personalMailboxData.length > 0) && (
                <div className="mt-2">
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
                    <Mail className="w-4 h-4 text-cyan-400" />
                    <h2 className="text-[14px] font-semibold text-white">{t("analytics.blockMails")}</h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {loadPerMemberData.length > 0 && (
                      <AnalyticsChartCard title={t("analytics.chartLoadPerMember")} tooltip={t("analytics.tooltipLoadPerMember")}>
                        <div className="h-44 sm:h-56 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={loadPerMemberData} layout="vertical" margin={{ left: 8, right: 16 }}>
                              <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                              <XAxis type="number" tick={{ fontSize: 10, fill: "#8b9cb3" }} allowDecimals={false} />
                              <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 10, fill: "#8b9cb3" }} interval={0} />
                              <Tooltip content={makeChartTooltip<MailMemberDatum>((d) => [
                                { label: t("analytics.colOpenLoad"), value: d.openLoad, color: "#2d7dd2" },
                                { label: t("analytics.colHandled"), value: d.handled, color: "#4ed29a" },
                                { label: t("analytics.colAvgResponse"), value: d.delayLabel },
                              ])} />
                              <Legend wrapperStyle={{ fontSize: 10 }} />
                              <Bar dataKey="openLoad" name={t("analytics.colOpenLoad")} fill="#2d7dd2" stackId="a" />
                              <Bar dataKey="handled" name={t("analytics.colHandled")} fill="#4ed29a" stackId="a" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </AnalyticsChartCard>
                    )}

                    {delayPerMemberData.length > 0 && (
                      <AnalyticsChartCard title={t("analytics.chartAvgDelayPerMember")} tooltip={t("analytics.tooltipAvgDelayPerMember")}>
                        <div className="h-44 sm:h-56 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={delayPerMemberData} layout="vertical" margin={{ left: 8, right: 16 }}>
                              <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                              <XAxis type="number" tick={{ fontSize: 10, fill: "#8b9cb3" }} allowDecimals={false} unit=" min" />
                              <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 10, fill: "#8b9cb3" }} interval={0} />
                              <Tooltip content={makeChartTooltip<DelayDatum>((d) => [
                                { label: t("analytics.colAvgResponse"), value: d.label, color: d.delay > 240 ? "#d24e6f" : "#fff" },
                                { label: "min", value: d.delay },
                              ])} />
                              <Bar dataKey="delay" name={t("analytics.colAvgResponse")}>
                                {delayPerMemberData.map((d, i) => (
                                  <Cell key={i} fill={d.delay > 240 ? "#d24e6f" : "#2d7dd2"} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </AnalyticsChartCard>
                    )}

                    {sharedMailboxData.length > 0 && (
                      <AnalyticsChartCard title={t("analytics.perMailbox")} tooltip={t("analytics.tooltipSharedMailboxes")}>
                        <div className="h-44 sm:h-56 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={sharedMailboxData} layout="vertical" margin={{ left: 8, right: 16 }}>
                              <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                              <XAxis type="number" tick={{ fontSize: 10, fill: "#8b9cb3" }} allowDecimals={false} />
                              <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 10, fill: "#8b9cb3" }} interval={0} />
                              <Tooltip content={makeChartTooltip<ScopeDatum>((d) => [
                                { label: t("analytics.colReceived"), value: d.received },
                                { label: t("analytics.colHandled"), value: d.handled, color: "#4ed29a" },
                                { label: t("analytics.colNotHandled"), value: d.notHandled, color: "#d2a02d" },
                                { label: t("analytics.colAvgResponse"), value: d.delayLabel },
                              ])} />
                              <Legend wrapperStyle={{ fontSize: 10 }} />
                              <Bar dataKey="handled" name={t("analytics.colHandled")} fill="#4ed29a" stackId="a" />
                              <Bar dataKey="notHandled" name={t("analytics.colNotHandled")} fill="#d2a02d" stackId="a" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </AnalyticsChartCard>
                    )}

                    {projectsData.length > 0 && (
                      <AnalyticsChartCard title={t("analytics.perProject")} tooltip={t("analytics.tooltipProjects")}>
                        <div className="h-44 sm:h-56 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={projectsData} layout="vertical" margin={{ left: 8, right: 16 }}>
                              <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                              <XAxis type="number" tick={{ fontSize: 10, fill: "#8b9cb3" }} allowDecimals={false} />
                              <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 10, fill: "#8b9cb3" }} interval={0} />
                              <Tooltip content={makeChartTooltip<ScopeDatum>((d) => [
                                { label: t("analytics.colReceived"), value: d.received },
                                { label: t("analytics.colHandled"), value: d.handled, color: "#4ed29a" },
                                { label: t("analytics.colNotHandled"), value: d.notHandled, color: "#d2a02d" },
                                { label: t("analytics.colAvgResponse"), value: d.delayLabel },
                              ])} />
                              <Legend wrapperStyle={{ fontSize: 10 }} />
                              <Bar dataKey="handled" name={t("analytics.colHandled")} fill="#4ed29a" stackId="a" />
                              <Bar dataKey="notHandled" name={t("analytics.colNotHandled")} fill="#d2a02d" stackId="a" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </AnalyticsChartCard>
                    )}
                  </div>

                  {personalMailboxData.length > 0 && (
                    <PersonalMailboxSection data={personalMailboxData} t={t} />
                  )}
                </div>
              )}

              {/* ===== BLOC TÂCHES ===== */}
              {(totalOpenTasks > 0 || tasksProjectData.length > 0) && (
                <div className="mt-2">
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
                    <CheckSquare className="w-4 h-4 text-violet-400" />
                    <h2 className="text-[14px] font-semibold text-white">{t("analytics.blockTasks")}</h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {totalOpenTasks > 0 && (
                      <AnalyticsChartCard title={t("analytics.tasksPerMember")} tooltip={t("analytics.tooltipTasksPerMember")}>
                        <div className="h-44 sm:h-56 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie data={tasksMemberPie} dataKey="open" nameKey="name" outerRadius={70}>
                                {tasksMemberPie.map((_, i) => (
                                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip content={makeChartTooltip<TaskDatum>((d) => [
                                { label: t("analytics.colTasksOpen"), value: d.open, color: "#2d7dd2" },
                                { label: t("analytics.colTasksDone"), value: d.done, color: "#4ed29a" },
                                { label: t("analytics.colTasksOverdue"), value: d.overdue, color: "#d24e6f" },
                              ])} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="mt-2 space-y-1">
                          {tasksMemberPie.map((m, i) => (
                            <div key={i} className="flex items-center gap-2 text-[11px]">
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                              <span className="text-white flex-1 truncate">{m.name}</span>
                              <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 text-[10px]">{m.done} {t("analytics.colTasksDone")}</span>
                              <span className="px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-300 text-[10px]">{m.overdue} {t("analytics.colTasksOverdue")}</span>
                            </div>
                          ))}
                        </div>
                      </AnalyticsChartCard>
                    )}

                    {tasksProjectData.length > 0 && (
                      <AnalyticsChartCard title={t("analytics.tasksPerProject")} tooltip={t("analytics.tooltipTasksPerProject")}>
                        <div className="h-44 sm:h-56 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={tasksProjectData} layout="vertical" margin={{ left: 8, right: 16 }}>
                              <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                              <XAxis type="number" tick={{ fontSize: 10, fill: "#8b9cb3" }} allowDecimals={false} />
                              <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 10, fill: "#8b9cb3" }} interval={0} />
                              <Tooltip content={makeChartTooltip<TaskDatum>((d) => [
                                { label: t("analytics.colTasksOpen"), value: d.open, color: "#2d7dd2" },
                                { label: t("analytics.colTasksDone"), value: d.done, color: "#4ed29a" },
                                { label: t("analytics.colTasksOverdue"), value: d.overdue, color: "#d24e6f" },
                              ])} />
                              <Legend wrapperStyle={{ fontSize: 10 }} />
                              <Bar dataKey="open" name={t("analytics.colTasksOpen")} fill="#2d7dd2" stackId="a" />
                              <Bar dataKey="done" name={t("analytics.colTasksDone")} fill="#4ed29a" stackId="a" />
                              <Bar dataKey="overdue" name={t("analytics.colTasksOverdue")} fill="#d24e6f" stackId="a" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </AnalyticsChartCard>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function StatCard({ label, value, accent = "default" }: { label: string; value: number; accent?: "default" | "red" | "muted" }) {
  const isRed = accent === "red";
  const isMuted = accent === "muted";
  return (
    <div className={`rounded-lg border p-3 ${isRed ? "bg-red-500/10 border-red-500/20" : "bg-card border-border"}`}>
      <p className="text-[10px] uppercase tracking-wider text-[#8b9cb3]">{label}</p>
      <p className={`text-xl font-bold ${isRed ? "text-red-400" : isMuted ? "text-[#8b9cb3]" : "text-white"}`}>{value}</p>
    </div>
  );
}

function StatCardText({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card border-border p-3">
      <p className="text-[10px] uppercase tracking-wider text-[#8b9cb3]">{label}</p>
      <p className="text-xl font-bold text-white">{value}</p>
    </div>
  );
}

function AnalyticsChartCard({ title, tooltip, children }: { title: string; tooltip: string; children: ReactNode }) {
  return (
    <div className="bg-card rounded-lg border border-border p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <h3 className="text-[12px] font-semibold text-white">{title}</h3>
        <InfoTooltip>
          <TooltipTrigger asChild>
            <button type="button" aria-label="info" className="text-[#8b9cb3] hover:text-white transition-colors">
              <HelpCircle className="w-3 h-3" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-[260px] text-[11px] leading-snug">
            {tooltip}
          </TooltipContent>
        </InfoTooltip>
      </div>
      {children}
    </div>
  );
}

function PersonalMailboxSection({ data, t }: { data: PersonalDatum[]; t: (k: string) => string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-[11px] text-[#8b9cb3] hover:text-white transition-colors"
      >
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        {t("analytics.personalDetailToggle")}
      </button>
      {open && (
        <div className="mt-2">
          <AnalyticsChartCard title={t("analytics.chartPersonalMailboxes")} tooltip={t("analytics.tooltipPersonalMailboxes")}>
            <div className="h-44 sm:h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "#8b9cb3" }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 10, fill: "#8b9cb3" }} interval={0} />
                  <Tooltip content={makeChartTooltip<PersonalDatum>((d) => [
                    { label: t("analytics.colReceived"), value: d.received, color: "#2d7dd2" },
                    { label: t("analytics.colHandled"), value: d.handled, color: "#4ed29a" },
                    { label: t("analytics.colNotHandled"), value: d.notHandled, color: "#d2a02d" },
                    { label: t("analytics.colAvgResponse"), value: d.delayLabel },
                  ])} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="received" name={t("analytics.colReceived")} fill="#2d7dd2" />
                  <Bar dataKey="handled" name={t("analytics.colHandled")} fill="#4ed29a" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </AnalyticsChartCard>
        </div>
      )}
    </div>
  );
}
