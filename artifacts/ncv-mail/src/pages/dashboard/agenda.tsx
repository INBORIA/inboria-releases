import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useEnableLightTheme } from "@/lib/inbox-theme";
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
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, addWeeks, subWeeks, isSameDay, isSameMonth, parseISO, isToday, type Locale } from "date-fns";
import { fr, enUS, nl, de, es, it, pt, pl, ro, sv, da, fi, hu, cs, tr, ja, ko, vi, th, id, ms, el } from "date-fns/locale";
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
  Check,
  Video,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useState, useMemo, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { BackToInboxButton } from "@/components/dashboard/back-to-inbox-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Users } from "lucide-react";

type ViewMode = "month" | "week" | "day";

const dateLocales: Record<string, Locale> = { fr, en: enUS, nl, de, es, it, pt, pl, ro, sv, da, fi, hu, cs, tr, ja, ko, vi, th, id, ms, el };

export default function Agenda() {
  const [, setLocation] = useLocation();
  useEnableLightTheme();
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const locale = dateLocales[i18n.language] || fr;

  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "month";
    const saved = window.localStorage.getItem("agenda.viewMode");
    return saved === "day" || saved === "week" || saved === "month" ? saved : "month";
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("agenda.viewMode", viewMode);
  }, [viewMode]);
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
  const [formCalendarAccountId, setFormCalendarAccountId] = useState<string>("");
  type VideoProv = "none" | "jitsi" | "meet" | "teams";
  const [formVideoProvider, setFormVideoProvider] = useState<VideoProv>("jitsi");

  type CalAccount = { id: string; provider: "google" | "outlook"; email_address: string; status: string };
  const [calendarAccounts, setCalendarAccounts] = useState<CalAccount[]>([]);
  type ExternalEvent = {
    id: string; source: "google" | "outlook"; account_id: string; account_email: string;
    title: string; description: string | null; location: string | null;
    start: string; end: string; all_day: boolean;
    organizer: string | null; participants: string[]; html_link: string | null;
  };
  const [externalEvents, setExternalEvents] = useState<ExternalEvent[]>([]);

  useEffect(() => {
    let aborted = false;
    fetch("/api/calendar/accounts", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { accounts: [] }))
      .then((data) => {
        if (aborted) return;
        const list = (data.accounts || []).filter((a: CalAccount) => a.status === "connected");
        setCalendarAccounts(list);
        if (!formCalendarAccountId && list.length > 0) {
          setFormCalendarAccountId(list[0].id);
        }
      })
      .catch(() => {});
    return () => { aborted = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const replayTriggeredRef = useRef(false);

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

  // Auto-rejoue la détection des confirmations transactionnelles (cas
  // prestataire qui confirme via mail noreply@ hors-thread, ex: Le Petit Zoo).
  // Une seule fois par session — l'endpoint est idempotent côté serveur.
  // Déclenché APRÈS le 1er chargement réussi des RDV (preuve que la session
  // est prête, sinon 401 silencieux).
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (replayTriggeredRef.current) return;
    if (isLoading) return;
    // KEY v3 : v2 a été marqué "done" par des 401 silencieux (header Bearer
    // absent) → bump pour rejouer l'appel proprement.
    const KEY = "agenda.replayTransactional.v3.done";
    if (window.sessionStorage.getItem(KEY) === "1") return;
    replayTriggeredRef.current = true;
    (async () => {
      try {
        const { supabase } = await import("@/lib/supabase");
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (!token) {
          replayTriggeredRef.current = false;
          return null;
        }
        const r = await fetch("/api/appointments/replay-transactional-confirms", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!r.ok) {
          replayTriggeredRef.current = false;
          return null;
        }
        window.sessionStorage.setItem(KEY, "1");
        return await r.json();
      } catch {
        replayTriggeredRef.current = false;
        return null;
      }
    })()
      .then((data) => {
        if (!data) return;
        const before = Number(data.pendingBefore || 0);
        const after = Number(data.pendingAfter || 0);
        if (before > after) {
          queryClient.invalidateQueries({ queryKey: ["appointments"] });
          toast({
            title: t("agenda.autoConfirmed.title", "Confirmations détectées"),
            description: t(
              "agenda.autoConfirmed.desc",
              "{{count}} rendez-vous viennent d'être confirmés automatiquement à partir des mails reçus.",
              { count: before - after },
            ),
          });
        }
      })
      .catch(() => {
        replayTriggeredRef.current = false;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  const suggestionsRange = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear() - 1, 0, 1).toISOString();
    const end = new Date(now.getFullYear() + 2, 11, 31, 23, 59, 59).toISOString();
    return { from: start, to: end };
  }, []);
  const { data: allAppointmentsForSuggestions = [] } = useListAppointments(suggestionsRange);
  const { data: projects = [] } = useListProjects();

  // Pull les événements des calendriers externes (Phase 2 sync lecture).
  useEffect(() => {
    if (calendarAccounts.length === 0) {
      setExternalEvents([]);
      return;
    }
    let aborted = false;
    const params = new URLSearchParams({
      start: rangeStart.toISOString(),
      end: rangeEnd.toISOString(),
    });
    fetch(`/api/calendar/events?${params}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { events: [] }))
      .then((data) => {
        if (aborted) return;
        setExternalEvents((data.events || []) as ExternalEvent[]);
      })
      .catch(() => { if (!aborted) setExternalEvents([]); });
    return () => { aborted = true; };
  }, [rangeStart.getTime(), rangeEnd.getTime(), calendarAccounts.length]);


  const appointments = useMemo(() => {
    const list = rawAppointments as Appointment[];
    if (projectFilter.size === 0) return list;
    return list.filter((apt) => {
      const pid = apt.projectId ? String(apt.projectId) : "";
      if (!pid) return projectFilter.has("__none__");
      return projectFilter.has(pid);
    });
  }, [rawAppointments, projectFilter]);

  const projectsWithAppointments = useMemo(() => {
    const ids = new Set<string>();
    let hasUnassigned = false;
    for (const apt of rawAppointments as Appointment[]) {
      if (apt.projectId) ids.add(String(apt.projectId));
      else hasUnassigned = true;
    }
    for (const apt of (allAppointmentsForSuggestions as any[]) || []) {
      if (apt.projectId) ids.add(String(apt.projectId));
    }
    return {
      list: (projects as Project[]).filter((p) => ids.has(String(p.id))),
      hasUnassigned,
    };
  }, [rawAppointments, allAppointmentsForSuggestions, projects]);

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
    setFormCalendarAccountId(calendarAccounts[0]?.id || "");
    setFormVideoProvider("jitsi");
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
    setFormCalendarAccountId((apt as Appointment).calendarAccountId || "");
    setFormVideoProvider(((apt as Appointment).videoProvider as VideoProv | null) || "none");
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
      calendarAccountId: formCalendarAccountId || undefined,
      videoProvider: formVideoProvider,
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

  const handleConfirm = async (id: string) => {
    const appt = (rawAppointments as Appointment[]).find((a) => a.id === id);
    if (appt?.status === "counter_proposed") {
      try {
        const { supabase } = await import("@/lib/supabase");
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        const res = await fetch(`${import.meta.env.BASE_URL}api/appointments/${id}/accept-counter`, {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error(await res.text());
        toast({ title: t("agenda.appointmentConfirmed") });
        invalidate();
      } catch {
        toast({ title: t("agenda.confirmError", "Erreur lors de la confirmation"), variant: "destructive" });
      }
      return;
    }
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

  const [selectedSuggestionIds, setSelectedSuggestionIds] = useState<Set<string>>(new Set());
  const [lastClickedIdx, setLastClickedIdx] = useState<number | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const dragRef = useRef<{ startIdx: number; startId: string; mode: "add" | "remove"; base: Set<string>; moved: boolean } | null>(null);
  const [, forceRender] = useState(0);

  useEffect(() => {
    const onUp = () => {
      const d = dragRef.current;
      if (!d) return;
      if (!d.moved) {
        const next = new Set(d.base);
        if (d.mode === "add") next.add(d.startId);
        else next.delete(d.startId);
        setSelectedSuggestionIds(next);
      }
      dragRef.current = null;
      forceRender((v) => v + 1);
    };
    window.addEventListener("mouseup", onUp);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  const applyDragRange = (toIdx: number) => {
    const d = dragRef.current;
    if (!d) return;
    d.moved = true;
    const { startIdx, mode, base } = d;
    const next = new Set(base);
    if (toIdx !== startIdx) {
      const [a, b] = startIdx < toIdx ? [startIdx + 1, toIdx] : [toIdx, startIdx - 1];
      for (let i = a; i <= b; i++) {
        const sid = suggestions[i]?.id;
        if (!sid) continue;
        if (mode === "add") next.add(sid);
        else next.delete(sid);
      }
      if (mode === "add") next.add(d.startId);
      else next.delete(d.startId);
    }
    setSelectedSuggestionIds(next);
  };

  const suggestions = useMemo(() => {
    // N'affiche QUE les suggestions detectees dans des mails entrants
    // (proposalRecipient null). Les RDV proposes par l'utilisateur lui-meme
    // (proposalRecipient renseigne) sont en attente d'une reponse du contact
    // et n'ont rien a faire dans "Suggestions a confirmer" : ils apparaissent
    // deja dans la grille avec leur badge "En attente".
    return (allAppointmentsForSuggestions as any[]).filter(
      (apt) =>
        apt.confirmed === false &&
        !apt.proposalRecipient &&
        !apt.proposalGroupId &&
        !apt.proposalMessageId,
    );
  }, [allAppointmentsForSuggestions]);

  useEffect(() => {
    setSelectedSuggestionIds((prev) => {
      const valid = new Set(suggestions.map((s) => s.id));
      const next = new Set<string>();
      prev.forEach((id) => { if (valid.has(id)) next.add(id); });
      return next.size === prev.size ? prev : next;
    });
  }, [suggestions]);

  const toggleSuggestion = (id: string, idx: number, e?: React.MouseEvent) => {
    setSelectedSuggestionIds((prev) => {
      const next = new Set(prev);
      if (e?.shiftKey && lastClickedIdx !== null) {
        const [a, b] = lastClickedIdx < idx ? [lastClickedIdx, idx] : [idx, lastClickedIdx];
        for (let i = a; i <= b; i++) {
          const sid = suggestions[i]?.id;
          if (sid) next.add(sid);
        }
      } else {
        if (next.has(id)) next.delete(id);
        else next.add(id);
      }
      return next;
    });
    setLastClickedIdx(idx);
  };

  const allSelected = suggestions.length > 0 && selectedSuggestionIds.size === suggestions.length;
  const someSelected = selectedSuggestionIds.size > 0 && !allSelected;

  const toggleSelectAll = () => {
    if (allSelected || someSelected) setSelectedSuggestionIds(new Set());
    else setSelectedSuggestionIds(new Set(suggestions.map((s) => s.id)));
  };

  const handleBulkConfirm = async (ids: string[]) => {
    if (ids.length === 0 || bulkBusy) return;
    setBulkBusy(true);
    let ok = 0;
    for (const id of ids) {
      try {
        await updateAppointment.mutateAsync({ id, data: { confirmed: true } });
        ok++;
      } catch {}
    }
    setBulkBusy(false);
    setSelectedSuggestionIds(new Set());
    invalidate();
    toast({ title: t("agenda.bulkConfirmed", { count: ok }) });
  };

  const handleBulkDismiss = async (ids: string[]) => {
    if (ids.length === 0 || bulkBusy) return;
    setBulkBusy(true);
    let ok = 0;
    for (const id of ids) {
      try {
        await deleteAppointment.mutateAsync({ id });
        ok++;
      } catch {}
    }
    setBulkBusy(false);
    setSelectedSuggestionIds(new Set());
    invalidate();
    toast({ title: t("agenda.bulkDismissed", { count: ok }) });
  };

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

  // External (Google/Outlook) events not already linked to a local appointment.
  const linkedExternalIds = useMemo(() => {
    const s = new Set<string>();
    for (const a of rawAppointments as Appointment[]) {
      if (a.externalId) s.add(`${a.externalProvider}:${a.externalId}`);
    }
    return s;
  }, [rawAppointments]);

  const externalEventsToShow = useMemo(() => {
    return externalEvents.filter((e) => !linkedExternalIds.has(`${e.source}:${e.id}`));
  }, [externalEvents, linkedExternalIds]);

  const getExternalEventsForDay = (day: Date) => {
    return externalEventsToShow.filter((e) => isSameDay(parseISO(e.start), day));
  };

  const externalEventColor = (source: "google" | "outlook") =>
    source === "google" ? "#34a853" : "#0078d4";

  // Drag & drop : déplace un RDV sur un autre jour (vue mois) en gardant l'heure.
  const [draggedApptId, setDraggedApptId] = useState<string | null>(null);
  const handleApptDragStart = (apt: Appointment, e: React.DragEvent) => {
    setDraggedApptId(apt.id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", apt.id);
  };
  const handleDayDragOver = (e: React.DragEvent) => {
    if (draggedApptId) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }
  };
  const handleDayDrop = (day: Date, e: React.DragEvent) => {
    e.preventDefault();
    const id = draggedApptId || e.dataTransfer.getData("text/plain");
    setDraggedApptId(null);
    if (!id) return;
    const apt = (rawAppointments as Appointment[]).find((a) => a.id === id);
    if (!apt) return;
    const oldStart = parseISO(apt.startAt);
    if (isSameDay(oldStart, day)) return;
    const oldEnd = parseISO(apt.endAt);
    const durationMs = oldEnd.getTime() - oldStart.getTime();
    const newStart = new Date(day);
    newStart.setHours(oldStart.getHours(), oldStart.getMinutes(), 0, 0);
    const newEnd = new Date(newStart.getTime() + durationMs);
    updateAppointment.mutate(
      { id, data: { startAt: newStart.toISOString(), endAt: newEnd.toISOString() } },
      {
        onSuccess: () => invalidate(),
        onError: () => invalidate(),
      },
    );
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

  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-5">
        <BackToInboxButton />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div>
            <h1 className="text-[16px] font-semibold text-foreground tracking-tight flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary" />
              {t("agenda.title")}
            </h1>
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
            <label className="relative ml-2 cursor-pointer">
              <span className="text-[14px] font-medium text-foreground capitalize whitespace-nowrap hover:text-primary transition-colors inline-flex items-center gap-1">
                {viewMode === "day"
                  ? format(currentDate, "EEEE d MMMM yyyy", { locale })
                  : format(currentDate, "MMMM yyyy", { locale })}
                <CalendarDays className="w-3.5 h-3.5 opacity-60" />
              </span>
              <input
                type="date"
                value={format(currentDate, "yyyy-MM-dd")}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v) {
                    const [y, m, d] = v.split("-").map(Number);
                    setCurrentDate(new Date(y, m - 1, d));
                  }
                }}
                className="absolute inset-0 opacity-0 cursor-pointer"
                title={t("agenda.pickDate", "Choisir une date")}
              />
            </label>
          </div>
          <div className="flex bg-card border border-border rounded-lg overflow-hidden flex-shrink-0">
            {(["day", "week", "month"] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1 text-[11px] font-medium transition-colors ${
                  viewMode === mode
                    ? "bg-primary text-white"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t(`agenda.${mode}`)}
              </button>
            ))}
          </div>
        </div>

        {projectsWithAppointments.list.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap mb-3 text-[11px]">
            <span className="text-muted-foreground mr-1">{t("agenda.filterByProject", "Filtrer par projet :")}</span>
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
                      ? "border-transparent text-foreground"
                      : "bg-transparent border-border text-muted-foreground hover:text-foreground"
                  }`}
                  style={active ? { backgroundColor: `${color}30`, borderColor: `${color}80`, color } : undefined}
                >
                  <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                  {p.name}
                </button>
              );
            })}
          </div>
        )}

        {suggestions.length > 0 && (
          <div className="bg-card border border-border rounded-lg p-3 mb-4">
            <div className="flex items-center justify-between mb-2 gap-2 h-7">
              <h3 className="text-[12px] font-semibold text-primary flex items-center gap-1.5 whitespace-nowrap">
                <Sparkles className="w-3.5 h-3.5" />
                {t("agenda.suggestionsDetected", { count: suggestions.length })}
              </h3>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer select-none" data-testid="suggestion-select-all">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? "indeterminate" : false}
                    onCheckedChange={toggleSelectAll}
                    aria-label={t("agenda.selectAll", "Tout sélectionner")}
                  />
                  {selectedSuggestionIds.size > 0
                    ? t("agenda.selectedCount", { count: selectedSuggestionIds.size })
                    : t("agenda.selectAll", "Tout sélectionner")}
                </label>
                {selectedSuggestionIds.size > 0 && (
                  <>
                    <Button
                      size="sm"
                      className="h-6 text-[10px] px-2 whitespace-nowrap"
                      disabled={bulkBusy}
                      onClick={() => handleBulkConfirm(Array.from(selectedSuggestionIds))}
                      data-testid="suggestion-bulk-confirm"
                    >
                      {t("agenda.confirmSelected", "Confirmer la sélection")}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-[10px] px-2 whitespace-nowrap text-foreground"
                      disabled={bulkBusy}
                      onClick={() => handleBulkDismiss(Array.from(selectedSuggestionIds))}
                      data-testid="suggestion-bulk-dismiss"
                    >
                      {t("agenda.dismissSelected", "Ignorer la sélection")}
                    </Button>
                  </>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              {suggestions.map((apt, idx) => {
                const isSelected = selectedSuggestionIds.has(apt.id);
                return (
                  <ContextMenu key={apt.id}>
                    <ContextMenuTrigger asChild>
                      <div
                        className={`flex items-center justify-between gap-2 rounded px-3 py-2 transition-colors select-none ${
                          isSelected ? "bg-primary/10 border border-primary/30" : "border border-transparent hover:bg-accent/50"
                        }`}
                        style={{ touchAction: "none" }}
                        data-testid={`suggestion-row-${apt.id}`}
                        onPointerDown={(e) => {
                          if (e.button !== 0) return;
                          if ((e.target as HTMLElement).closest("button,a")) return;
                          e.preventDefault();
                          if (e.shiftKey) {
                            toggleSuggestion(apt.id, idx, e as any);
                            return;
                          }
                          const mode: "add" | "remove" = isSelected ? "remove" : "add";
                          const base = new Set(selectedSuggestionIds);
                          dragRef.current = { startIdx: idx, startId: apt.id, mode, base, moved: false };
                          setLastClickedIdx(idx);
                        }}
                        onPointerEnter={(e) => {
                          if (dragRef.current) {
                            e.preventDefault();
                            applyDragRange(idx);
                          }
                        }}
                        onDragStart={(e) => e.preventDefault()}
                      >
                        <div className="shrink-0 flex items-center pointer-events-none">
                          <Checkbox
                            checked={isSelected}
                            tabIndex={-1}
                            aria-label={t("common.select", "Sélectionner")}
                            className="pointer-events-none"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-[12px] font-medium text-foreground truncate block">{apt.title}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {format(parseISO(apt.startAt), "dd/MM/yyyy HH:mm", { locale })}
                            {apt.location && ` · ${apt.location}`}
                          </span>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <Button size="sm" className="h-6 text-[10px] px-2" onClick={() => handleConfirm(apt.id)}>
                            {t("agenda.confirmAppointment")}
                          </Button>
                          <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 text-foreground" onClick={() => handleDismiss(apt.id)}>
                            {t("agenda.dismissAppointment")}
                          </Button>
                        </div>
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-56">
                      <ContextMenuItem onClick={() => handleConfirm(apt.id)}>
                        <Check className="w-3.5 h-3.5 mr-2" />
                        {t("agenda.confirmAppointment")}
                      </ContextMenuItem>
                      <ContextMenuItem onClick={() => handleDismiss(apt.id)} className="text-red-400 focus:text-red-300">
                        <X className="w-3.5 h-3.5 mr-2" />
                        {t("agenda.dismissAppointment")}
                      </ContextMenuItem>
                      <ContextMenuItem onClick={() => setSelectedAppointment(apt)}>
                        <ExternalLink className="w-3.5 h-3.5 mr-2" />
                        {t("agenda.viewDetails", "Voir les détails")}
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                );
              })}
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
                <div key={i} className="px-2 py-1.5 text-[10px] font-medium text-muted-foreground text-center uppercase">
                  {format(d, "EEE", { locale })}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {monthDays.map((day, i) => {
                const dayAppts = getAppointmentsForDay(day);
                const dayExt = getExternalEventsForDay(day);
                const isCurrentMonth = isSameMonth(day, currentDate);
                const today = isToday(day);
                const totalCount = dayAppts.length + dayExt.length;
                return (
                  <div
                    key={i}
                    onClick={() => openCreateForm(day)}
                    onDragOver={handleDayDragOver}
                    onDrop={(e) => handleDayDrop(day, e)}
                    className={`min-h-[80px] border-b border-r border-border p-1 cursor-pointer hover:bg-[#1a2235] transition-colors ${
                      !isCurrentMonth ? "opacity-40" : ""
                    } ${draggedApptId ? "hover:bg-primary/10" : ""}`}
                  >
                    <div className={`text-[11px] font-medium mb-0.5 w-6 h-6 flex items-center justify-center rounded-full ${
                      today ? "bg-primary text-white" : "text-muted-foreground"
                    }`}>
                      {format(day, "d")}
                    </div>
                    {dayAppts.slice(0, 3).map((apt) => {
                      const projectColor = apt.projects?.color;
                      const s = apt.status;
                      const isPendingFallback = apt.confirmed === false && s !== "counter_proposed" && s !== "declined";
                      const effective = s === "counter_proposed" || s === "declined"
                        ? s
                        : isPendingFallback ? "pending" : "confirmed";
                      const nonConfirmed = effective !== "confirmed";
                      const monthLabel = effective === "pending"
                        ? t("agenda.statusPendingShort", "En attente")
                        : effective === "counter_proposed"
                          ? t("agenda.statusCounterShort", "Contre-prop.")
                          : effective === "declined"
                            ? t("agenda.statusDeclinedShort", "Refusé")
                            : t("agenda.statusConfirmedShort", "Confirmé");
                      return (
                      <div
                        key={apt.id}
                        draggable
                        onDragStart={(e) => { e.stopPropagation(); handleApptDragStart(apt, e); }}
                        onDragEnd={() => setDraggedApptId(null)}
                        onClick={(e) => { e.stopPropagation(); setSelectedAppointment(apt); }}
                        className={`text-[10px] px-1 py-0.5 rounded mb-0.5 cursor-pointer ${nonConfirmed ? "bg-card border border-dashed border-border text-primary" : `text-foreground ${!projectColor ? "bg-primary/20" : ""}`}`}
                        style={!nonConfirmed && apt.confirmed !== false && projectColor ? { backgroundColor: `${projectColor}20` } : undefined}
                        title={`${apt.title} — ${monthLabel}`}
                      >
                        <div className="truncate">
                          {projectColor && !nonConfirmed && <span className="inline-block w-1.5 h-1.5 rounded-full mr-0.5" style={{ backgroundColor: projectColor }} />}
                          {apt.allDay ? "" : format(parseISO(apt.startAt), "HH:mm") + " "}{apt.title}
                        </div>
                        <div className={`text-[9px] truncate ${nonConfirmed ? "text-primary" : "text-muted-foreground"}`}>{monthLabel}</div>
                      </div>
                      );
                    })}
                    {dayAppts.length < 3 && dayExt.slice(0, 3 - dayAppts.length).map((ev) => {
                      const c = externalEventColor(ev.source);
                      return (
                        <div
                          key={`ext-${ev.id}`}
                          onClick={(e) => { e.stopPropagation(); }}
                          className="text-[10px] px-1 py-0.5 rounded truncate mb-0.5 italic"
                          style={{ backgroundColor: `${c}20`, borderLeft: `2px solid ${c}` }}
                          title={`${ev.title} (${ev.source === "google" ? "Google" : "Outlook"} · ${ev.account_email})`}
                        >
                          {ev.all_day ? "" : format(parseISO(ev.start), "HH:mm") + " "}{ev.title}
                        </div>
                      );
                    })}
                    {totalCount > 3 && (
                      <div className="text-[9px] text-muted-foreground pl-1">+{totalCount - 3}</div>
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
                  <div className="text-[10px] text-muted-foreground uppercase">{format(d, "EEE", { locale })}</div>
                  <div className={`text-[13px] font-medium ${isToday(d) ? "text-primary" : "text-foreground"}`}>{format(d, "d")}</div>
                </div>
              ))}
            </div>
            <div className="max-h-[500px] overflow-y-auto">
              {hours.map((hour) => (
                <div key={hour} className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border last:border-b-0">
                  <div className="px-2 py-2 text-[10px] text-muted-foreground text-right pr-2 border-r border-border">
                    {String(hour).padStart(2, "0")}:00
                  </div>
                  {weekDays.map((d, i) => {
                    const dayAppts = getAppointmentsForDay(d).filter((apt) => {
                      const h = parseISO(apt.startAt).getHours();
                      return h === hour;
                    });
                    const dayExt = getExternalEventsForDay(d).filter((ev) => parseISO(ev.start).getHours() === hour);
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
                          const s = apt.status;
                          const isPendingFallback = apt.confirmed === false && s !== "counter_proposed" && s !== "declined";
                          const effective = s === "counter_proposed" || s === "declined"
                            ? s
                            : isPendingFallback ? "pending" : "confirmed";
                          const nonConfirmed = effective !== "confirmed";
                          const shortLabel = effective === "pending"
                            ? t("agenda.statusPendingShort", "En attente")
                            : effective === "counter_proposed"
                              ? t("agenda.statusCounterShort", "Contre-prop.")
                              : effective === "declined"
                                ? t("agenda.statusDeclinedShort", "Refusé")
                                : t("agenda.statusConfirmedShort", "Confirmé");
                          return (
                          <div
                            key={apt.id}
                            onClick={(e) => { e.stopPropagation(); setSelectedAppointment(apt); }}
                            className={`text-[10px] px-1 py-0.5 rounded cursor-pointer ${nonConfirmed ? "bg-card border border-dashed border-border text-primary" : `text-foreground ${!pc ? "bg-primary/20 hover:bg-primary/30" : ""}`}`}
                            style={pc && !nonConfirmed ? { backgroundColor: `${pc}20` } : undefined}
                            title={`${apt.title} — ${shortLabel}`}
                          >
                            <div className={`truncate ${nonConfirmed ? "text-primary" : "text-foreground"}`}>{format(parseISO(apt.startAt), "HH:mm")} {apt.title}</div>
                            <div className={`truncate ${nonConfirmed ? "text-primary" : "text-muted-foreground"}`}>{shortLabel}</div>
                          </div>
                          );
                        })}
                        {dayExt.map((ev) => {
                          const c = externalEventColor(ev.source);
                          return (
                            <div
                              key={`ext-${ev.id}`}
                              onClick={(e) => { e.stopPropagation(); }}
                              className="text-[10px] px-1 py-0.5 rounded truncate italic"
                              style={{ backgroundColor: `${c}20`, borderLeft: `2px solid ${c}` }}
                              title={`${ev.title} · ${ev.source === "google" ? "Google" : "Outlook"} · ${ev.account_email}`}
                            >
                              {format(parseISO(ev.start), "HH:mm")} {ev.title}
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
              <div className={`text-[13px] font-medium ${isToday(currentDate) ? "text-primary" : "text-foreground"}`}>
                {format(currentDate, "EEEE d MMMM yyyy", { locale })}
              </div>
            </div>
            <div className="max-h-[500px] overflow-y-auto">
              {hours.map((hour) => {
                const hourAppts = getAppointmentsForDay(currentDate).filter((apt) => {
                  const h = parseISO(apt.startAt).getHours();
                  return h === hour;
                });
                const hourExt = getExternalEventsForDay(currentDate).filter((ev) => parseISO(ev.start).getHours() === hour);
                return (
                  <div key={hour} className="flex border-b border-border last:border-b-0">
                    <div className="w-16 px-2 py-3 text-[11px] text-muted-foreground text-right pr-3 border-r border-border shrink-0">
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
                        const aptStatus = apt.status;
                        const isCounter = aptStatus === "counter_proposed";
                        const isDeclined = aptStatus === "declined";
                        const isPending = aptStatus === "pending" || (apt.confirmed === false && !isCounter && !isDeclined);
                        return (
                        <div
                          key={apt.id}
                          onClick={(e) => { e.stopPropagation(); setSelectedAppointment(apt); }}
                          className={`rounded px-2 py-1.5 cursor-pointer mb-1 border ${
                            isDeclined
                              ? "bg-card border-border opacity-60"
                              : isPending || isCounter
                                ? "bg-card border-border border-dashed hover:bg-[#1a2235]"
                                : apt.confirmed === false
                                  ? "bg-primary/10 border-primary/30"
                                  : "bg-primary/15 border-primary/30 hover:bg-primary/25"
                          }`}
                          style={pc && !isPending && !isCounter && !isDeclined && apt.confirmed !== false ? { backgroundColor: `${pc}15`, borderColor: `${pc}30` } : undefined}
                          data-testid={`agenda-appt-${apt.id}`}
                        >
                          <div className="text-[12px] font-medium text-foreground">
                            <span className="truncate">{apt.title}</span>
                          </div>
                          <div className={`text-[10px] mt-0.5 ${isPending || isCounter || isDeclined ? "text-primary" : "text-muted-foreground"}`}>
                            {isPending
                              ? t("agenda.statusPending", "En attente de réponse")
                              : isCounter
                                ? t("agenda.statusCounter", "Contre-proposition reçue")
                                : isDeclined
                                  ? t("agenda.statusDeclined", "Refusé par le contact")
                                  : t("agenda.statusConfirmedShort", "Confirmé")}
                          </div>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {format(parseISO(apt.startAt), "HH:mm")} - {format(parseISO(apt.endAt), "HH:mm")}
                            </span>
                            {apt.location && (
                              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {apt.location}
                              </span>
                            )}
                          </div>
                        </div>
                        );
                      })}
                      {hourExt.map((ev) => {
                        const c = externalEventColor(ev.source);
                        return (
                          <div
                            key={`ext-${ev.id}`}
                            onClick={(e) => { e.stopPropagation(); }}
                            className="rounded px-2 py-1.5 mb-1 border italic"
                            style={{ backgroundColor: `${c}15`, borderColor: `${c}40`, borderLeftWidth: 3, borderLeftColor: c }}
                          >
                            <div className="text-[12px] font-medium text-foreground">{ev.title}</div>
                            <div className="flex items-center gap-3 mt-0.5">
                              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {format(parseISO(ev.start), "HH:mm")} - {format(parseISO(ev.end), "HH:mm")}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {ev.source === "google" ? "Google" : "Outlook"} · {ev.account_email}
                              </span>
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
                <h3 className="text-[14px] font-semibold text-foreground">{selectedAppointment.title}</h3>
                <button onClick={() => setSelectedAppointment(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                  <Clock className="w-3.5 h-3.5" />
                  {selectedAppointment.allDay
                    ? t("agenda.allDay")
                    : `${format(parseISO(selectedAppointment.startAt), "dd/MM/yyyy HH:mm", { locale })} - ${format(parseISO(selectedAppointment.endAt), "HH:mm", { locale })}`}
                </div>
                {selectedAppointment.location && (
                  <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                    <MapPin className="w-3.5 h-3.5" />
                    {selectedAppointment.location}
                  </div>
                )}
                {selectedAppointment.projects && (
                  <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: selectedAppointment.projects.color || '#2d7dd2' }} />
                    {selectedAppointment.projects.name}
                  </div>
                )}
                {selectedAppointment.participants && (
                  <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                    <Users className="w-3.5 h-3.5" />
                    {selectedAppointment.participants}
                  </div>
                )}
                {selectedAppointment.videoUrl && (
                  <div className="flex items-center gap-2 text-[12px]">
                    <Video className="w-3.5 h-3.5 text-primary" />
                    <a
                      href={selectedAppointment.videoJoinUrl || selectedAppointment.videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:text-primary/80 underline"
                    >
                      {t("agenda.videoJoin", "Rejoindre la visio")}
                    </a>
                    <span className="text-[10px] text-muted-foreground uppercase">
                      {selectedAppointment.videoProvider}
                    </span>
                  </div>
                )}
                {selectedAppointment.description && (
                  <p className="text-[12px] text-muted-foreground bg-background rounded p-2 border border-border mt-2">
                    {selectedAppointment.description}
                  </p>
                )}
                {selectedAppointment.emailId && (
                  <button
                    type="button"
                    onClick={() => {
                      const id = selectedAppointment.emailId;
                      setSelectedAppointment(null);
                      setLocation(`/dashboard?emailId=${id}`);
                    }}
                    className="flex items-center gap-2 text-[12px] text-primary hover:text-primary/80 mt-1"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    {t("agenda.viewSourceEmail")}
                    <ExternalLink className="w-3 h-3" />
                  </button>
                )}
                {selectedAppointment.confirmed === false && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                    <span className="text-[11px] text-primary font-medium">{t("agenda.aiSuggestion")}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2 flex-wrap">
                {selectedAppointment.status === "counter_proposed" ? (
                  <>
                    <Button
                      size="sm"
                      className="h-7 text-[11px]"
                      onClick={() => { handleConfirm(selectedAppointment.id); setSelectedAppointment(null); }}
                    >
                      <Sparkles className="w-3 h-3 mr-1" />
                      {t("agenda.confirmWithInboria", "Confirmer avec Inboria")}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-7 text-[11px]"
                      onClick={() => {
                        const apt = selectedAppointment;
                        const slot = apt.counterStartAt
                          ? format(new Date(apt.counterStartAt), "EEEE d MMMM yyyy 'à' HH:mm", { locale })
                          : "";
                        const contact = apt.proposalRecipient || t("agenda.theContact", "le contact");
                        const prefill = t(
                          "agenda.askInboriaNewSlotPrefill",
                          "La contre-proposition de {{contact}}{{slot}} ne me convient pas. Propose-lui d'autres créneaux compatibles avec mon agenda.",
                          { contact, slot: slot ? ` (${slot})` : "" },
                        );
                        const emailId = apt.emailId;
                        try {
                          sessionStorage.setItem("inboria.chat.prefill", prefill);
                        } catch {
                          /* noop */
                        }
                        setSelectedAppointment(null);
                        if (emailId) {
                          setLocation(`/dashboard?emailId=${emailId}`);
                        }
                        // Le listener dans InboriaChatButton consommera le prefill au mount
                        // (déjà monté = via l'event ; nouveau mount = via sessionStorage).
                        window.dispatchEvent(new CustomEvent("inboria-open-chat"));
                      }}
                    >
                      <Sparkles className="w-3 h-3 mr-1" />
                      {t("agenda.askInboriaNewSlot", "Demander à Inboria nouveau RDV")}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-7 text-[11px]"
                      onClick={async () => {
                        try {
                          const { supabase } = await import("@/lib/supabase");
                          const { data: sessionData } = await supabase.auth.getSession();
                          const token = sessionData?.session?.access_token;
                          const res = await fetch(
                            `${import.meta.env.BASE_URL}api/appointments/${selectedAppointment.id}/decline-counter`,
                            { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {} },
                          );
                          if (!res.ok) throw new Error(await res.text());
                          toast({ title: t("agenda.counterDeclined", "Refus envoyé au contact") });
                          invalidate();
                          setSelectedAppointment(null);
                        } catch {
                          toast({ title: t("agenda.deleteError"), variant: "destructive" });
                        }
                      }}
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      {t("agenda.deleteAppointment")}
                    </Button>
                  </>
                ) : (
                  <>
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
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {showForm && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={resetForm}>
            <div className="bg-card border border-border rounded-lg w-full max-w-lg p-5" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-[14px] font-semibold text-foreground">
                  {editingId ? t("agenda.editAppointment") : t("agenda.newAppointment")}
                </h3>
                <button onClick={resetForm} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[11px] text-muted-foreground mb-1 block">{t("agenda.appointmentTitle")}</label>
                  <Input
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder={t("agenda.appointmentTitlePlaceholder")}
                    className="h-8 text-[12px]"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-muted-foreground mb-1 block">{t("agenda.description")}</label>
                  <Textarea
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder={t("agenda.descriptionPlaceholder")}
                    className="text-[12px] min-h-[60px]"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-muted-foreground mb-1 block">{t("agenda.location")}</label>
                  <Input
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    placeholder={t("agenda.locationPlaceholder")}
                    className="h-8 text-[12px]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-muted-foreground mb-1 block">{t("agenda.startDate")}</label>
                    <Input
                      type="datetime-local"
                      value={formStartAt}
                      onChange={(e) => setFormStartAt(e.target.value)}
                      className="h-8 text-[12px]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-muted-foreground mb-1 block">{t("agenda.endDate")}</label>
                    <Input
                      type="datetime-local"
                      value={formEndAt}
                      onChange={(e) => setFormEndAt(e.target.value)}
                      className="h-8 text-[12px]"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-[12px] text-muted-foreground cursor-pointer">
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
                    <label className="text-[11px] text-muted-foreground mb-1 block">{t("agenda.project")}</label>
                    <select
                      value={formProjectId}
                      onChange={(e) => setFormProjectId(e.target.value)}
                      className="w-full h-8 rounded-md border border-border bg-background px-2 text-[12px] text-foreground"
                    >
                      <option value="">{t("agenda.noProject")}</option>
                      {(projects as Project[]).map((p) => (
                        <option key={p.id} value={p.id}>{p.reference} - {p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-muted-foreground mb-1 block">{t("agenda.reminder")}</label>
                    <select
                      value={formReminder}
                      onChange={(e) => setFormReminder(e.target.value)}
                      className="w-full h-8 rounded-md border border-border bg-background px-2 text-[12px] text-foreground"
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
                  <label className="text-[11px] text-muted-foreground mb-1 block">{t("agenda.participants")}</label>
                  <Input
                    value={formParticipants}
                    onChange={(e) => setFormParticipants(e.target.value)}
                    placeholder={t("agenda.participantsPlaceholder")}
                    className="h-8 text-[12px]"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-muted-foreground mb-1 block">
                    {t("agenda.destinationCalendar", "Calendrier de destination")}
                  </label>
                  <select
                    value={formCalendarAccountId}
                    onChange={(e) => setFormCalendarAccountId(e.target.value)}
                    className="w-full h-8 rounded-md border border-border bg-background px-2 text-[12px] text-foreground"
                    disabled={!!editingId && !!(rawAppointments as Appointment[]).find((a) => a.id === editingId)?.externalId}
                  >
                    <option value="">{t("agenda.localOnly", "Inboria uniquement (pas de sync)")}</option>
                    {calendarAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.provider === "google" ? "Google" : "Outlook"} · {acc.email_address}
                      </option>
                    ))}
                  </select>
                  {calendarAccounts.length === 0 && (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {t("agenda.connectCalendarHint", "Connectez un calendrier dans Réglages pour synchroniser.")}
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-[11px] text-muted-foreground mb-1 block">
                    {t("agenda.video", "Visioconférence")}
                  </label>
                  <select
                    value={formVideoProvider}
                    onChange={(e) => setFormVideoProvider(e.target.value as VideoProv)}
                    className="w-full h-8 rounded-md border border-border bg-background px-2 text-[12px] text-foreground"
                  >
                    <option value="none">{t("agenda.videoNone", "Aucune")}</option>
                    <option value="jitsi">{t("agenda.videoJitsi", "Jitsi (lien Inboria, sans compte)")}</option>
                    <option value="meet">{t("agenda.videoMeet", "Google Meet (calendrier Google requis)")}</option>
                    <option value="teams">{t("agenda.videoTeams", "Microsoft Teams (calendrier Outlook requis)")}</option>
                  </select>
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
