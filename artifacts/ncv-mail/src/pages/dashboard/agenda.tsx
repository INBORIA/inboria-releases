import { DashboardLayout } from "@/components/layout/dashboard-layout";
import {
  useListAppointments,
  useCreateAppointment,
  useUpdateAppointment,
  useDeleteAppointment,
  useDetectAppointments,
  useListProjects,
  getListAppointmentsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, addWeeks, subWeeks, isSameDay, isSameMonth, parseISO, isToday, type Locale } from "date-fns";
import { fr, enUS, nl, de, es, it, pt } from "date-fns/locale";
import type { Appointment, Project } from "@workspace/api-client-react";
import {
  CalendarDays,
  Plus,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Trash2,
  Pencil,
  MapPin,
  Clock,
  Sparkles,
  Download,
  X,
  Calendar,
  Mail,
  ExternalLink,
} from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { BackToInboxButton } from "@/components/dashboard/back-to-inbox-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Users } from "lucide-react";

type ViewMode = "month" | "week" | "day";

const dateLocales: Record<string, Locale> = { fr, en: enUS, nl, de, es, it, pt };

export default function Agenda() {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const locale = dateLocales[i18n.language] || fr;

  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [projectFilter, setProjectFilter] = useState<Set<string>>(new Set());

  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formLocation, setFormLocation] = useState("");
  const [formStartAt, setFormStartAt] = useState("");
  const [formEndAt, setFormEndAt] = useState("");
  const [formAllDay, setFormAllDay] = useState(false);
  const [formProjectId, setFormProjectId] = useState<string>("");
  const [formReminder, setFormReminder] = useState("30");
  const [formParticipants, setFormParticipants] = useState("");
  const [formEmailId, setFormEmailId] = useState<number | undefined>(undefined);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("create") === "1") {
      const title = params.get("title") || "";
      const participants = params.get("participants") || "";
      const location = params.get("location") || "";
      const description = params.get("description") || "";
      const startAt = params.get("startAt") || "";
      const endAt = params.get("endAt") || "";
      const emailIdParam = params.get("emailId");

      setFormTitle(title);
      setFormParticipants(participants);
      setFormLocation(location);
      setFormDescription(description);
      if (emailIdParam) setFormEmailId(parseInt(emailIdParam));

      if (startAt) {
        try {
          const startDate = new Date(startAt);
          setFormStartAt(format(startDate, "yyyy-MM-dd'T'HH:mm"));
          if (endAt) {
            const endDate = new Date(endAt);
            setFormEndAt(format(endDate, "yyyy-MM-dd'T'HH:mm"));
          } else {
            const endDate = new Date(startDate.getTime() + 3600000);
            setFormEndAt(format(endDate, "yyyy-MM-dd'T'HH:mm"));
          }
        } catch {
          const d = format(new Date(), "yyyy-MM-dd");
          setFormStartAt(`${d}T09:00`);
          setFormEndAt(`${d}T10:00`);
        }
      } else {
        const d = format(new Date(), "yyyy-MM-dd");
        setFormStartAt(`${d}T09:00`);
        setFormEndAt(`${d}T10:00`);
      }

      setShowForm(true);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const rangeStart = useMemo(() => {
    if (viewMode === "month") return startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 });
    if (viewMode === "week") return startOfWeek(currentDate, { weekStartsOn: 1 });
    return new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
  }, [currentDate, viewMode]);

  const rangeEnd = useMemo(() => {
    if (viewMode === "month") return endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 });
    if (viewMode === "week") return endOfWeek(currentDate, { weekStartsOn: 1 });
    return new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 23, 59, 59);
  }, [currentDate, viewMode]);

  const { data: rawAppointments = [], isLoading } = useListAppointments({
    from: rangeStart.toISOString(),
    to: rangeEnd.toISOString(),
  });
  const { data: projects = [] } = useListProjects();

  const appointments = useMemo(() => {
    if (projectFilter.size === 0) return rawAppointments;
    return rawAppointments.filter((apt: any) => {
      const pid = apt.projectId ? String(apt.projectId) : "";
      if (!pid) return projectFilter.has("__none__");
      return projectFilter.has(pid);
    });
  }, [rawAppointments, projectFilter]);

  const projectsWithAppointments = useMemo(() => {
    const ids = new Set<string>();
    let hasUnassigned = false;
    for (const apt of rawAppointments as any[]) {
      if (apt.projectId) ids.add(String(apt.projectId));
      else hasUnassigned = true;
    }
    return {
      list: (projects as Project[]).filter((p) => ids.has(String(p.id))),
      hasUnassigned,
    };
  }, [rawAppointments, projects]);

  const toggleProjectFilter = (id: string) => {
    setProjectFilter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const clearProjectFilter = () => setProjectFilter(new Set());
  const createAppointment = useCreateAppointment();
  const updateAppointment = useUpdateAppointment();
  const deleteAppointment = useDeleteAppointment();
  const detectAppointments = useDetectAppointments();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListAppointmentsQueryKey() });

  const resetForm = () => {
    setFormTitle("");
    setFormDescription("");
    setFormLocation("");
    setFormStartAt("");
    setFormEndAt("");
    setFormAllDay(false);
    setFormProjectId("");
    setFormReminder("30");
    setFormParticipants("");
    setFormEmailId(undefined);
    setEditingId(null);
    setShowForm(false);
  };

  const openCreateForm = (date?: Date) => {
    resetForm();
    if (date) {
      const d = format(date, "yyyy-MM-dd");
      setFormStartAt(`${d}T09:00`);
      setFormEndAt(`${d}T10:00`);
    }
    setShowForm(true);
  };

  const openEditForm = (apt: Appointment) => {
    setEditingId(apt.id);
    setFormTitle(apt.title || "");
    setFormDescription(apt.description || "");
    setFormLocation(apt.location || "");
    setFormStartAt(apt.startAt ? format(parseISO(apt.startAt), "yyyy-MM-dd'T'HH:mm") : "");
    setFormEndAt(apt.endAt ? format(parseISO(apt.endAt), "yyyy-MM-dd'T'HH:mm") : "");
    setFormAllDay(apt.allDay || false);
    setFormProjectId(apt.projectId ? String(apt.projectId) : "");
    setFormReminder(String(apt.reminderMinutes ?? 30));
    setFormParticipants(apt.participants || "");
    setShowForm(true);
    setSelectedAppointment(null);
  };

  const handleSubmit = () => {
    if (!formTitle || !formStartAt || !formEndAt) return;
    const payload = {
      title: formTitle,
      description: formDescription || undefined,
      location: formLocation || undefined,
      startAt: new Date(formStartAt).toISOString(),
      endAt: new Date(formEndAt).toISOString(),
      allDay: formAllDay,
      projectId: formProjectId ? parseInt(formProjectId) : undefined,
      reminderMinutes: parseInt(formReminder) || 30,
      participants: formParticipants || undefined,
      emailId: formEmailId,
    };

    if (editingId) {
      updateAppointment.mutate(
        { id: editingId, data: payload },
        {
          onSuccess: () => {
            toast({ title: t("agenda.updated") });
            invalidate();
            resetForm();
          },
          onError: () => toast({ title: t("agenda.updateError"), variant: "destructive" }),
        }
      );
    } else {
      createAppointment.mutate(
        { data: payload },
        {
          onSuccess: () => {
            toast({ title: t("agenda.created") });
            invalidate();
            resetForm();
          },
          onError: () => toast({ title: t("agenda.createError"), variant: "destructive" }),
        }
      );
    }
  };

  const handleDelete = (id: string) => {
    deleteAppointment.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: t("agenda.deleted") });
          invalidate();
          setSelectedAppointment(null);
        },
        onError: () => toast({ title: t("agenda.deleteError"), variant: "destructive" }),
      }
    );
  };

  const handleConfirm = (id: string) => {
    updateAppointment.mutate(
      { id, data: { confirmed: true } },
      {
        onSuccess: () => {
          toast({ title: t("agenda.appointmentConfirmed") });
          invalidate();
        },
      }
    );
  };

  const handleDismiss = (id: string) => {
    deleteAppointment.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: t("agenda.appointmentDismissed") });
          invalidate();
        },
      }
    );
  };

  const suggestions = useMemo(() => {
    return appointments.filter((apt) => apt.confirmed === false);
  }, [appointments]);

  const handleDetect = () => {
    detectAppointments.mutate(
      { data: { lang: i18n.language } },
      {
        onSuccess: (data) => {
          const count = (data as { count?: number })?.count || 0;
          toast({ title: count > 0 ? t("agenda.detectedCount", { count }) : t("agenda.noDetected") });
          invalidate();
        },
      }
    );
  };

  const handleExport = async () => {
    try {
      const { downloadExport } = await import("@/lib/export-utils");
      await downloadExport("export/appointments", `rdv_${format(new Date(), "yyyy-MM-dd")}.csv`);
      toast({ title: t("agenda.exportDownloaded") });
    } catch {
      toast({ title: t("agenda.exportError"), variant: "destructive" });
    }
  };

  const navigatePrev = () => {
    if (viewMode === "month") setCurrentDate(subMonths(currentDate, 1));
    else if (viewMode === "week") setCurrentDate(subWeeks(currentDate, 1));
    else setCurrentDate(addDays(currentDate, -1));
  };

  const navigateNext = () => {
    if (viewMode === "month") setCurrentDate(addMonths(currentDate, 1));
    else if (viewMode === "week") setCurrentDate(addWeeks(currentDate, 1));
    else setCurrentDate(addDays(currentDate, 1));
  };

  const goToToday = () => setCurrentDate(new Date());

  const getAppointmentsForDay = (day: Date) => {
    return appointments.filter((apt) => {
      const start = parseISO(apt.startAt);
      return isSameDay(start, day);
    });
  };

  const monthDays = useMemo(() => {
    const days: Date[] = [];
    let d = rangeStart;
    while (d <= rangeEnd) {
      days.push(d);
      d = addDays(d, 1);
    }
    return days;
  }, [rangeStart, rangeEnd]);

  const weekDays = useMemo(() => {
    const days: Date[] = [];
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    for (let i = 0; i < 7; i++) {
      days.push(addDays(start, i));
    }
    return days;
  }, [currentDate]);

  const hours = Array.from({ length: 14 }, (_, i) => i + 7);

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-5">
        <BackToInboxButton />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div>
            <h1 className="text-[16px] font-semibold text-white tracking-tight flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary" />
              {t("agenda.title")}
            </h1>
            <p className="text-[12px] text-[#b8c5d6] mt-0.5">{t("agenda.subtitle")}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button onClick={handleDetect} disabled={detectAppointments.isPending} size="sm" variant="outline" className="h-8 text-[12px]">
              <Sparkles className={`w-3 h-3 mr-1.5 ${detectAppointments.isPending ? 'animate-spin' : ''}`} />
              {detectAppointments.isPending ? t("agenda.detecting") : t("agenda.detectFromEmails")}
            </Button>
            <Button onClick={handleExport} size="sm" variant="outline" className="h-8 text-[12px]">
              <Download className="w-3 h-3 mr-1.5" />
              {t("agenda.exportCSV")}
            </Button>
            <Button onClick={() => openCreateForm()} size="sm" className="h-8 text-[12px]">
              <Plus className="w-3 h-3 mr-1.5" />
              {t("agenda.newAppointment")}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-4 mb-4">
          <div className="flex items-center gap-2 min-w-0 flex-shrink">
            <Button onClick={navigatePrev} size="sm" variant="ghost" className="h-7 w-7 p-0 flex-shrink-0">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button onClick={goToToday} size="sm" variant="outline" className="h-7 text-[11px] px-2 flex-shrink-0">
              {t("agenda.today")}
            </Button>
            <Button onClick={navigateNext} size="sm" variant="ghost" className="h-7 w-7 p-0 flex-shrink-0">
              <ChevronRight className="w-4 h-4" />
            </Button>
            <span className="text-[14px] font-medium text-white ml-2 capitalize whitespace-nowrap">
              {viewMode === "day"
                ? format(currentDate, "EEEE d MMMM yyyy", { locale })
                : format(currentDate, "MMMM yyyy", { locale })}
            </span>
          </div>
          <div className="flex bg-card border border-border rounded-lg overflow-hidden flex-shrink-0">
            {(["day", "week", "month"] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1 text-[11px] font-medium transition-colors ${
                  viewMode === mode
                    ? "bg-primary text-white"
                    : "text-[#b8c5d6] hover:text-white"
                }`}
              >
                {t(`agenda.${mode}`)}
              </button>
            ))}
          </div>
        </div>

        {(projectsWithAppointments.list.length > 0 || projectsWithAppointments.hasUnassigned) && (
          <div className="flex items-center gap-1.5 flex-wrap mb-3 text-[11px]">
            <span className="text-[#b8c5d6] mr-1">{t("agenda.filterByProject", "Filtrer par projet :")}</span>
            <button
              type="button"
              onClick={clearProjectFilter}
              className={`px-2 py-0.5 rounded-full border transition-colors ${
                projectFilter.size === 0
                  ? "bg-primary/20 border-primary/40 text-primary"
                  : "bg-transparent border-border text-[#b8c5d6] hover:text-white"
              }`}
            >
              {t("agenda.allProjects", "Tous")}
            </button>
            {projectsWithAppointments.list.map((p) => {
              const id = String(p.id);
              const active = projectFilter.has(id);
              const color = (p as any).color || "#2d7dd2";
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggleProjectFilter(id)}
                  className={`px-2 py-0.5 rounded-full border transition-colors flex items-center gap-1.5 ${
                    active
                      ? "border-transparent text-white"
                      : "bg-transparent border-border text-[#b8c5d6] hover:text-white"
                  }`}
                  style={active ? { backgroundColor: `${color}30`, borderColor: `${color}80`, color } : undefined}
                >
                  <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                  {p.name}
                </button>
              );
            })}
            {projectsWithAppointments.hasUnassigned && (
              <button
                type="button"
                onClick={() => toggleProjectFilter("__none__")}
                className={`px-2 py-0.5 rounded-full border transition-colors ${
                  projectFilter.has("__none__")
                    ? "bg-[#b8c5d6]/20 border-[#b8c5d6]/40 text-white"
                    : "bg-transparent border-border text-[#b8c5d6] hover:text-white"
                }`}
              >
                {t("agenda.noProject", "Aucun projet")}
              </button>
            )}
          </div>
        )}

        {suggestions.length > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 mb-4">
            <h3 className="text-[12px] font-semibold text-amber-400 mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              {t("agenda.suggestionsDetected", { count: suggestions.length })}
            </h3>
            <div className="space-y-1.5">
              {suggestions.map((apt) => (
                <div key={apt.id} className="flex items-center justify-between gap-2 bg-card/50 rounded px-3 py-2 border border-border">
                  <div className="flex-1 min-w-0">
                    <span className="text-[12px] font-medium text-white truncate block">{apt.title}</span>
                    <span className="text-[10px] text-[#b8c5d6]">
                      {format(parseISO(apt.startAt), "dd/MM/yyyy HH:mm", { locale })}
                      {apt.location && ` · ${apt.location}`}
                    </span>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <Button size="sm" className="h-6 text-[10px] px-2" onClick={() => handleConfirm(apt.id)}>
                      {t("agenda.confirmAppointment")}
                    </Button>
                    <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => handleDismiss(apt.id)}>
                      {t("agenda.dismissAppointment")}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : viewMode === "month" ? (
          <div className="bg-card rounded-lg border border-border overflow-hidden">
            <div className="grid grid-cols-7 border-b border-border">
              {weekDays.map((d, i) => (
                <div key={i} className="px-2 py-1.5 text-[10px] font-medium text-[#b8c5d6] text-center uppercase">
                  {format(d, "EEE", { locale })}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {monthDays.map((day, i) => {
                const dayAppts = getAppointmentsForDay(day);
                const isCurrentMonth = isSameMonth(day, currentDate);
                const today = isToday(day);
                return (
                  <div
                    key={i}
                    onClick={() => openCreateForm(day)}
                    className={`min-h-[80px] border-b border-r border-border p-1 cursor-pointer hover:bg-[#1a2235] transition-colors ${
                      !isCurrentMonth ? "opacity-40" : ""
                    }`}
                  >
                    <div className={`text-[11px] font-medium mb-0.5 w-6 h-6 flex items-center justify-center rounded-full ${
                      today ? "bg-primary text-white" : "text-[#b8c5d6]"
                    }`}>
                      {format(day, "d")}
                    </div>
                    {dayAppts.slice(0, 3).map((apt) => {
                      const projectColor = apt.projects?.color;
                      return (
                      <div
                        key={apt.id}
                        onClick={(e) => { e.stopPropagation(); setSelectedAppointment(apt); }}
                        className={`text-[10px] px-1 py-0.5 rounded truncate mb-0.5 cursor-pointer ${apt.confirmed === false ? "bg-amber-500/20 text-amber-400" : ""}`}
                        style={apt.confirmed !== false ? { backgroundColor: projectColor ? `${projectColor}20` : undefined, color: projectColor || undefined } : undefined}
                      >
                        {projectColor && <span className="inline-block w-1.5 h-1.5 rounded-full mr-0.5" style={{ backgroundColor: projectColor }} />}
                        {apt.allDay ? "" : format(parseISO(apt.startAt), "HH:mm") + " "}{apt.title}
                      </div>
                      );
                    })}
                    {dayAppts.length > 3 && (
                      <div className="text-[9px] text-[#b8c5d6] pl-1">+{dayAppts.length - 3}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : viewMode === "week" ? (
          <div className="bg-card rounded-lg border border-border overflow-hidden">
            <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border">
              <div className="border-r border-border" />
              {weekDays.map((d, i) => (
                <div key={i} className={`px-2 py-1.5 text-center border-r border-border last:border-r-0 ${isToday(d) ? "bg-primary/10" : ""}`}>
                  <div className="text-[10px] text-[#b8c5d6] uppercase">{format(d, "EEE", { locale })}</div>
                  <div className={`text-[13px] font-medium ${isToday(d) ? "text-primary" : "text-white"}`}>{format(d, "d")}</div>
                </div>
              ))}
            </div>
            <div className="max-h-[500px] overflow-y-auto">
              {hours.map((hour) => (
                <div key={hour} className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border last:border-b-0">
                  <div className="px-2 py-2 text-[10px] text-[#b8c5d6] text-right pr-2 border-r border-border">
                    {String(hour).padStart(2, "0")}:00
                  </div>
                  {weekDays.map((d, i) => {
                    const dayAppts = getAppointmentsForDay(d).filter((apt) => {
                      const h = parseISO(apt.startAt).getHours();
                      return h === hour;
                    });
                    return (
                      <div
                        key={i}
                        onClick={() => {
                          const date = new Date(d);
                          date.setHours(hour, 0, 0, 0);
                          openCreateForm(date);
                        }}
                        className={`border-r border-border last:border-r-0 min-h-[40px] p-0.5 cursor-pointer hover:bg-[#1a2235] ${isToday(d) ? "bg-primary/5" : ""}`}
                      >
                        {dayAppts.map((apt) => {
                          const pc = apt.projects?.color;
                          return (
                          <div
                            key={apt.id}
                            onClick={(e) => { e.stopPropagation(); setSelectedAppointment(apt); }}
                            className={`text-[10px] px-1 py-0.5 rounded truncate cursor-pointer ${apt.confirmed === false ? "bg-amber-500/20 text-amber-400" : "bg-primary/20 text-primary hover:bg-primary/30"}`}
                            style={pc && apt.confirmed !== false ? { backgroundColor: `${pc}20`, color: pc } : undefined}
                          >
                            {format(parseISO(apt.startAt), "HH:mm")} {apt.title}
                          </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-card rounded-lg border border-border overflow-hidden">
            <div className="p-3 border-b border-border">
              <div className={`text-[13px] font-medium ${isToday(currentDate) ? "text-primary" : "text-white"}`}>
                {format(currentDate, "EEEE d MMMM yyyy", { locale })}
              </div>
            </div>
            <div className="max-h-[500px] overflow-y-auto">
              {hours.map((hour) => {
                const hourAppts = getAppointmentsForDay(currentDate).filter((apt) => {
                  const h = parseISO(apt.startAt).getHours();
                  return h === hour;
                });
                return (
                  <div key={hour} className="flex border-b border-border last:border-b-0">
                    <div className="w-16 px-2 py-3 text-[11px] text-[#b8c5d6] text-right pr-3 border-r border-border shrink-0">
                      {String(hour).padStart(2, "0")}:00
                    </div>
                    <div
                      className="flex-1 min-h-[48px] p-1 cursor-pointer hover:bg-[#1a2235]"
                      onClick={() => {
                        const date = new Date(currentDate);
                        date.setHours(hour, 0, 0, 0);
                        openCreateForm(date);
                      }}
                    >
                      {hourAppts.map((apt) => {
                        const pc = apt.projects?.color;
                        return (
                        <div
                          key={apt.id}
                          onClick={(e) => { e.stopPropagation(); setSelectedAppointment(apt); }}
                          className={`rounded px-2 py-1.5 cursor-pointer mb-1 border ${apt.confirmed === false ? "bg-amber-500/10 border-amber-500/30" : "bg-primary/15 border-primary/30 hover:bg-primary/25"}`}
                          style={pc && apt.confirmed !== false ? { backgroundColor: `${pc}15`, borderColor: `${pc}30` } : undefined}
                        >
                          <div className="text-[12px] font-medium text-white">{apt.title}</div>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-[10px] text-[#b8c5d6] flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {format(parseISO(apt.startAt), "HH:mm")} - {format(parseISO(apt.endAt), "HH:mm")}
                            </span>
                            {apt.location && (
                              <span className="text-[10px] text-[#b8c5d6] flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {apt.location}
                              </span>
                            )}
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {selectedAppointment && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setSelectedAppointment(null)}>
            <div className="bg-card border border-border rounded-lg w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-[14px] font-semibold text-white">{selectedAppointment.title}</h3>
                <button onClick={() => setSelectedAppointment(null)} className="text-[#b8c5d6] hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-[12px] text-[#b8c5d6]">
                  <Clock className="w-3.5 h-3.5" />
                  {selectedAppointment.allDay
                    ? t("agenda.allDay")
                    : `${format(parseISO(selectedAppointment.startAt), "dd/MM/yyyy HH:mm", { locale })} - ${format(parseISO(selectedAppointment.endAt), "HH:mm", { locale })}`}
                </div>
                {selectedAppointment.location && (
                  <div className="flex items-center gap-2 text-[12px] text-[#b8c5d6]">
                    <MapPin className="w-3.5 h-3.5" />
                    {selectedAppointment.location}
                  </div>
                )}
                {selectedAppointment.projects && (
                  <div className="flex items-center gap-2 text-[12px] text-[#b8c5d6]">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: selectedAppointment.projects.color || '#2d7dd2' }} />
                    {selectedAppointment.projects.name}
                  </div>
                )}
                {selectedAppointment.participants && (
                  <div className="flex items-center gap-2 text-[12px] text-[#b8c5d6]">
                    <Users className="w-3.5 h-3.5" />
                    {selectedAppointment.participants}
                  </div>
                )}
                {selectedAppointment.description && (
                  <p className="text-[12px] text-[#b8c5d6] bg-background rounded p-2 border border-border mt-2">
                    {selectedAppointment.description}
                  </p>
                )}
                {selectedAppointment.emailId && (
                  <a
                    href={`/inbox?emailId=${selectedAppointment.emailId}`}
                    className="flex items-center gap-2 text-[12px] text-primary hover:text-primary/80 mt-1"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    {t("agenda.viewSourceEmail")}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {selectedAppointment.confirmed === false && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-[11px] text-amber-400 font-medium">{t("agenda.aiSuggestion")}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                {selectedAppointment.confirmed === false && (
                  <Button size="sm" className="h-7 text-[11px]" onClick={() => { handleConfirm(selectedAppointment.id); setSelectedAppointment(null); }}>
                    {t("agenda.confirmAppointment")}
                  </Button>
                )}
                <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => openEditForm(selectedAppointment)}>
                  <Pencil className="w-3 h-3 mr-1" />
                  {t("agenda.editAppointment")}
                </Button>
                <Button size="sm" variant="destructive" className="h-7 text-[11px]" onClick={() => handleDelete(selectedAppointment.id)}>
                  <Trash2 className="w-3 h-3 mr-1" />
                  {t("agenda.deleteAppointment")}
                </Button>
              </div>
            </div>
          </div>
        )}

        {showForm && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={resetForm}>
            <div className="bg-card border border-border rounded-lg w-full max-w-lg p-5" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-[14px] font-semibold text-white">
                  {editingId ? t("agenda.editAppointment") : t("agenda.newAppointment")}
                </h3>
                <button onClick={resetForm} className="text-[#b8c5d6] hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[11px] text-[#b8c5d6] mb-1 block">{t("agenda.appointmentTitle")}</label>
                  <Input
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder={t("agenda.appointmentTitlePlaceholder")}
                    className="h-8 text-[12px]"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-[#b8c5d6] mb-1 block">{t("agenda.description")}</label>
                  <Textarea
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder={t("agenda.descriptionPlaceholder")}
                    className="text-[12px] min-h-[60px]"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-[#b8c5d6] mb-1 block">{t("agenda.location")}</label>
                  <Input
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    placeholder={t("agenda.locationPlaceholder")}
                    className="h-8 text-[12px]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-[#b8c5d6] mb-1 block">{t("agenda.startDate")}</label>
                    <Input
                      type="datetime-local"
                      value={formStartAt}
                      onChange={(e) => setFormStartAt(e.target.value)}
                      className="h-8 text-[12px]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-[#b8c5d6] mb-1 block">{t("agenda.endDate")}</label>
                    <Input
                      type="datetime-local"
                      value={formEndAt}
                      onChange={(e) => setFormEndAt(e.target.value)}
                      className="h-8 text-[12px]"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-[12px] text-[#b8c5d6] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formAllDay}
                      onChange={(e) => setFormAllDay(e.target.checked)}
                      className="rounded border-border"
                    />
                    {t("agenda.allDay")}
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-[#b8c5d6] mb-1 block">{t("agenda.project")}</label>
                    <select
                      value={formProjectId}
                      onChange={(e) => setFormProjectId(e.target.value)}
                      className="w-full h-8 rounded-md border border-border bg-background px-2 text-[12px] text-white"
                    >
                      <option value="">{t("agenda.noProject")}</option>
                      {(projects as Project[]).map((p) => (
                        <option key={p.id} value={p.id}>{p.reference} - {p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-[#b8c5d6] mb-1 block">{t("agenda.reminder")}</label>
                    <select
                      value={formReminder}
                      onChange={(e) => setFormReminder(e.target.value)}
                      className="w-full h-8 rounded-md border border-border bg-background px-2 text-[12px] text-white"
                    >
                      <option value="0">{t("agenda.reminderMinutes", { minutes: 0 })}</option>
                      <option value="5">{t("agenda.reminderMinutes", { minutes: 5 })}</option>
                      <option value="15">{t("agenda.reminderMinutes", { minutes: 15 })}</option>
                      <option value="30">{t("agenda.reminderMinutes", { minutes: 30 })}</option>
                      <option value="60">{t("agenda.reminderMinutes", { minutes: 60 })}</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-[#b8c5d6] mb-1 block">{t("agenda.participants")}</label>
                  <Input
                    value={formParticipants}
                    onChange={(e) => setFormParticipants(e.target.value)}
                    placeholder={t("agenda.participantsPlaceholder")}
                    className="h-8 text-[12px]"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button size="sm" variant="outline" onClick={resetForm} className="h-8 text-[12px]">
                    {t("common.cancel")}
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSubmit}
                    disabled={!formTitle || !formStartAt || !formEndAt || createAppointment.isPending || updateAppointment.isPending}
                    className="h-8 text-[12px]"
                  >
                    {(createAppointment.isPending || updateAppointment.isPending) && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                    {editingId ? t("common.save") : t("agenda.newAppointment")}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
