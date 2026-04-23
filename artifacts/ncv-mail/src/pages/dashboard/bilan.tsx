import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useGenerateDailySummary, useListAppointments } from "@workspace/api-client-react";
import type { Appointment } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight, AlertTriangle, TrendingUp, RefreshCw, CheckSquare, BarChart3, CalendarDays, Clock, MapPin } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { format, parseISO, startOfDay, endOfDay, addDays, type Locale } from "date-fns";
import { fr, enUS, nl } from "date-fns/locale";
import { Link } from "wouter";

const dateLocales: Record<string, Locale> = { fr, en: enUS, nl };

export default function BilanQuotidien() {
  const { t, i18n } = useTranslation();
  const locale = dateLocales[i18n.language] || fr;
  const generateSummary = useGenerateDailySummary();
  const [summaryData, setSummaryData] = useState<any>(null);

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

  const fetchSummary = () => {
    generateSummary.mutate(
      { data: { language: currentLang } },
      {
        onSuccess: (data) => {
          setSummaryData(data);
        },
      }
    );
  };

  return (
    <DashboardLayout>
      <div className="p-5 max-w-5xl mx-auto w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div>
            <h1 className="text-[16px] font-semibold text-white tracking-tight flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              {t("brief.aiDailyBrief")}
            </h1>
            <p className="text-[12px] text-[#8b9cb3] mt-0.5">{t("brief.personalizedSummary")}</p>
          </div>
          <Button 
            onClick={fetchSummary} 
            disabled={generateSummary.isPending}
            size="sm"
            className="shrink-0 h-8 text-[12px]"
          >
            <RefreshCw className={`w-3 h-3 mr-1.5 ${generateSummary.isPending ? 'animate-spin' : ''}`} />
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
          <div className="bg-card rounded-lg border border-border border-dashed p-12 flex flex-col items-center justify-center text-center">
            <BarChart3 className="w-8 h-8 text-[#8b9cb3]/30 mb-3" />
            <h3 className="text-[13px] font-medium text-white mb-1">{t("brief.noBrief")}</h3>
            <p className="text-[12px] text-[#8b9cb3] mb-3">{t("brief.clickRegenerate")}</p>
            <Button onClick={fetchSummary} size="sm" className="h-7 text-[11px]">
              <Sparkles className="w-3 h-3 mr-1.5" />
              {t("brief.generateBrief")}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-3.5 relative overflow-hidden">
                <div className="absolute right-0 top-0 opacity-10 scale-110 translate-x-3 -translate-y-3">
                  <Sparkles className="w-16 h-16 text-primary" />
                </div>
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

            <div className="bg-card rounded-lg border border-border border-l-2 border-l-primary p-4">
              <h2 className="text-[13px] font-semibold text-white mb-2">{t("brief.overview")}</h2>
              <p className="text-[12px] text-[#8b9cb3] leading-relaxed">
                {summaryData.summary}
              </p>
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
                        {email.priority === 'urgent' ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium border bg-red-500/15 text-red-400 border-red-500/20">{t("brief.urgent")}</span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium border bg-amber-500/15 text-amber-400 border-amber-500/20">{t("brief.important")}</span>
                        )}
                      </div>
                      <h4 className="text-[12px] text-[#8b9cb3] mb-1.5">{email.subject}</h4>
                      <p className="text-[11px] text-[#8b9cb3]/70 bg-background rounded p-2 border border-border">
                        {email.summary}
                      </p>
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
                  <p className="text-[12px] text-[#8b9cb3] leading-relaxed italic">
                    "{summaryData.advice}"
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
