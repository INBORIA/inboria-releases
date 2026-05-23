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
  useGetProfile,
  useGetMyOrganisation,
  useGetOrganisationMembers,
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
  ChevronDown,
  ChevronUp,
  UserPlus,
  MessageSquare,
  Send,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
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

  // ---- Co-organisateurs internes (Business) — Phase 2 ---------------------
  type Coorg = { id: number; userId: string; fullName: string; email: string };
  const [coorgs, setCoorgs] = useState<Coorg[]>([]);
  const [coorgLoading, setCoorgLoading] = useState(false);
  const [coorgPickerOpen, setCoorgPickerOpen] = useState(false);
  const { data: meProfile } = useGetProfile();
  const { data: myOrg } = useGetMyOrganisation();
  const { data: orgMembersList } = useGetOrganisationMembers(
    { query: { enabled: !!(myOrg as { id?: string } | undefined)?.id } as never } as never,
  );
  const isBusiness = (meProfile as { plan?: string } | undefined)?.plan === "business";
  const currentUserId = (meProfile as { id?: string; userId?: string } | undefined)?.id
    || (meProfile as { id?: string; userId?: string } | undefined)?.userId
    || null;
  const reloadCoorgs = async (apptId: string) => {
    try {
      setCoorgLoading(true);
      const { supabase } = await import("@/lib/supabase");
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const res = await fetch(
        `${import.meta.env.BASE_URL}api/appointments/${apptId}/coorganizers`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      );
      if (!res.ok) {
        setCoorgs([]);
        return;
      }
      const data = (await res.json()) as Coorg[];
      setCoorgs(Array.isArray(data) ? data : []);
    } catch {
      setCoorgs([]);
    } finally {
      setCoorgLoading(false);
    }
  };
  useEffect(() => {
    if (selectedAppointment?.id && isBusiness) {
      void reloadCoorgs(selectedAppointment.id);
    } else {
      setCoorgs([]);
      setCoorgPickerOpen(false);
    }
  }, [selectedAppointment?.id, isBusiness]);
  const addCoorg = async (userId: string) => {
    if (!selectedAppointment?.id) return;
    try {
      const { supabase } = await import("@/lib/supabase");
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const res = await fetch(
        `${import.meta.env.BASE_URL}api/appointments/${selectedAppointment.id}/coorganizers`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ userId }),
        },
      );
      if (!res.ok) {
        const err = await res.text();
        toast({ title: t("agenda.coorgAddError", "Erreur ajout co-organisateur"), description: err, variant: "destructive" });
        return;
      }
      setCoorgPickerOpen(false);
      await reloadCoorgs(selectedAppointment.id);
      toast({ title: t("agenda.coorgAdded", "Co-organisateur ajouté") });
    } catch (e) {
      toast({ title: t("agenda.coorgAddError", "Erreur ajout co-organisateur"), description: (e as Error).message, variant: "destructive" });
    }
  };
  // ---- Notes internes RDV (Business) — Phase 3 --------------------------
  type InternalNote = { id: number; userId: string; authorName: string; body: string; createdAt: string };
  const [notes, setNotes] = useState<InternalNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteSubmitting, setNoteSubmitting] = useState(false);
  const reloadNotes = async (apptId: string) => {
    try {
      setNotesLoading(true);
      const { supabase } = await import("@/lib/supabase");
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const res = await fetch(
        `${import.meta.env.BASE_URL}api/appointments/${apptId}/internal-notes`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      );
      if (!res.ok) { setNotes([]); return; }
      const data = (await res.json()) as InternalNote[];
      setNotes(Array.isArray(data) ? data : []);
    } catch {
      setNotes([]);
    } finally {
      setNotesLoading(false);
    }
  };
  useEffect(() => {
    if (selectedAppointment?.id && isBusiness) {
      void reloadNotes(selectedAppointment.id);
    } else {
      setNotes([]);
      setNoteDraft("");
    }
  }, [selectedAppointment?.id, isBusiness]);
  const submitNote = async () => {
    const body = noteDraft.trim();
    if (!body || !selectedAppointment?.id) return;
    try {
      setNoteSubmitting(true);
      const { supabase } = await import("@/lib/supabase");
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const res = await fetch(
        `${import.meta.env.BASE_URL}api/appointments/${selectedAppointment.id}/internal-notes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ body }),
        },
      );
      if (!res.ok) {
        const err = await res.text();
        toast({ title: t("agenda.noteError", "Erreur ajout note"), description: err, variant: "destructive" });
        return;
      }
      setNoteDraft("");
      await reloadNotes(selectedAppointment.id);
    } finally {
      setNoteSubmitting(false);
    }
  };
  const deleteNote = async (noteId: number) => {
    if (!selectedAppointment?.id) return;
    try {
      const { supabase } = await import("@/lib/supabase");
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const res = await fetch(
        `${import.meta.env.BASE_URL}api/appointments/${selectedAppointment.id}/internal-notes/${noteId}`,
        { method: "DELETE", headers: token ? { Authorization: `Bearer ${token}` } : {} },
      );
      if (!res.ok) return;
      await reloadNotes(selectedAppointment.id);
    } catch { /* noop */ }
  };

  const removeCoorg = async (userId: string) => {
    if (!selectedAppointment?.id) return;
    try {
      const { supabase } = await import("@/lib/supabase");
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const res = await fetch(
        `${import.meta.env.BASE_URL}api/appointments/${selectedAppointment.id}/coorganizers/${userId}`,
        { method: "DELETE", headers: token ? { Authorization: `Bearer ${token}` } : {} },
      );
      if (!res.ok) {
        toast({ title: t("agenda.coorgRemoveError", "Erreur retrait"), variant: "destructive" });
        return;
      }
      await reloadCoorgs(selectedAppointment.id);
    } catch (e) {
      toast({ title: t("agenda.coorgRemoveError", "Erreur retrait"), description: (e as Error).message, variant: "destructive" });
    }
  };
  const [projectFilter, setProjectFilter] = useState<Set<string>>(new Set());

  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formLocation, setFormLocation] = useState("");
  const [formStartAt, setFormStartAt] = useState("");
  const [formEndAt, setFormEndAt] = useState("");
  const [formDuration, setFormDuration] = useState<string>("30");
  const [formMultiDay, setFormMultiDay] = useState(false);
  const [formAllDay, setFormAllDay] = useState(false);
  const [formProjectId, setFormProjectId] = useState<string>("");
  const [formReminder, setFormReminder] = useState("30");
  const [formParticipants, setFormParticipants] = useState("");
  const [formInternal, setFormInternal] = useState(false);
  // RDV interne — sélection multi-membres de l'organisation. On stocke les
  // userId ; à la soumission on les transforme en emails joints (`a@x, b@y`)
  // pour réutiliser la colonne `participants` existante côté backend.
  const [formInternalMemberIds, setFormInternalMemberIds] = useState<string[]>([]);
  const [formInternalPickerOpen, setFormInternalPickerOpen] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<"all" | "external" | "internal">(() => {
    if (typeof window === "undefined") return "all";
    const v = window.localStorage.getItem("inboria.agenda.sourceFilter");
    return v === "external" || v === "internal" ? v : "all";
  });
  const [formEmailId, setFormEmailId] = useState<number | undefined>(undefined);
  const [formCalendarAccountId, setFormCalendarAccountId] = useState<string>("");
  type VideoProv = "none" | "jitsi" | "meet" | "teams";
  const [formVideoProvider, setFormVideoProvider] = useState<VideoProv>("none");

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
    let list = rawAppointments as Appointment[];
    if (sourceFilter === "internal") {
      list = list.filter((a) => (a as any).internal === true);
    } else if (sourceFilter === "external") {
      list = list.filter((a) => !(a as any).internal);
    }
    if (projectFilter.size === 0) return list;
    return list.filter((apt) => {
      const pid = apt.projectId ? String(apt.projectId) : "";
      if (!pid) return projectFilter.has("__none__");
      return projectFilter.has(pid);
    });
  }, [rawAppointments, projectFilter, sourceFilter]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("inboria.agenda.sourceFilter", sourceFilter);
  }, [sourceFilter]);

  // Deep-link depuis une notification `appointment_imminent` :
  // /dashboard/agenda?openApt=<id> → on ouvre la fiche RDV dès que
  // la liste est chargée, puis on nettoie l'URL pour ne pas ré-ouvrir
  // au prochain rendu.
  const openedAptIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const want = params.get("openApt");
    if (!want || openedAptIdRef.current === want) return;
    const list = (rawAppointments as Appointment[]) || [];
    if (list.length === 0) return;
    const apt = list.find((a) => String((a as any).id) === want);
    if (!apt) return;
    openedAptIdRef.current = want;
    setSelectedAppointment(apt);
    params.delete("openApt");
    const qs = params.toString();
    const newUrl = window.location.pathname + (qs ? `?${qs}` : "");
    window.history.replaceState({}, "", newUrl);
  }, [rawAppointments]);

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
    setFormInternal(false);
    setFormInternalMemberIds([]);
    setFormInternalPickerOpen(false);
    setFormEmailId(undefined);
    setFormCalendarAccountId(calendarAccounts[0]?.id || "");
    setFormVideoProvider("none");
    setFormDuration("30");
    setFormMultiDay(false);
    setEditingId(null);
    setShowForm(false);
  };

  const openCreateForm = (date?: Date, endDate?: Date, internal: boolean = false) => {
    resetForm();
    if (internal) {
      setFormInternal(true);
      setFormVideoProvider("none");
    }
    if (date) {
      setFormStartAt(format(date, "yyyy-MM-dd'T'HH:mm"));
      if (endDate) {
        if (!isSameDay(date, endDate)) {
          setFormMultiDay(true);
          setFormEndAt(format(endDate, "yyyy-MM-dd'T'HH:mm"));
        } else {
          const diffMin = Math.max(15, Math.round((endDate.getTime() - date.getTime()) / 60000));
          setFormDuration(String(diffMin));
        }
      } else {
        setFormDuration("30");
      }
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
    if (apt.startAt && apt.endAt) {
      const s = parseISO(apt.startAt);
      const e = parseISO(apt.endAt);
      if (!isSameDay(s, e)) {
        setFormMultiDay(true);
      } else {
        const diffMin = Math.max(15, Math.round((e.getTime() - s.getTime()) / 60000));
        setFormDuration(String(diffMin));
        setFormMultiDay(false);
      }
    }
    setFormAllDay(apt.allDay || false);
    setFormProjectId(apt.projectId ? String(apt.projectId) : "");
    setFormReminder(String(apt.reminderMinutes ?? 30));
    setFormParticipants(apt.participants || "");
    const isInternalApt = ((apt as any).internal as boolean) ?? false;
    setFormInternal(isInternalApt);
    // Si on édite un RDV interne, on essaie de retrouver les userId des
    // membres à partir des emails déjà enregistrés dans `participants`.
    if (isInternalApt && apt.participants) {
      const emails = String(apt.participants).split(/[,;]/).map((s) => s.trim().toLowerCase()).filter(Boolean);
      const members = (orgMembersList || []) as Array<{ userId: string; email: string }>;
      const ids = emails.map((em) => members.find((m) => m.email?.toLowerCase() === em)?.userId).filter(Boolean) as string[];
      setFormInternalMemberIds(ids);
    } else {
      setFormInternalMemberIds([]);
    }
    setFormCalendarAccountId((apt as Appointment).calendarAccountId || "");
    setFormVideoProvider(((apt as Appointment).videoProvider as VideoProv | null) || "none");
    setShowForm(true);
    setSelectedAppointment(null);
  };

  const handleSubmit = () => {
    if (!formTitle || !formStartAt) return;
    if (formMultiDay && !formEndAt) return;
    const startDate = new Date(formStartAt);
    const endDate = formMultiDay
      ? new Date(formEndAt)
      : new Date(startDate.getTime() + (parseInt(formDuration) || 30) * 60000);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || endDate <= startDate) return;
    const payload = {
      title: formTitle,
      description: formDescription || undefined,
      location: formLocation || undefined,
      startAt: startDate.toISOString(),
      endAt: endDate.toISOString(),
      allDay: formAllDay,
      projectId: formProjectId ? parseInt(formProjectId) : undefined,
      reminderMinutes: parseInt(formReminder) || 30,
      participants: formInternal
        ? (() => {
            const members = (orgMembersList || []) as Array<{ userId: string; email: string }>;
            const emails = formInternalMemberIds
              .map((id) => members.find((m) => m.userId === id)?.email)
              .filter(Boolean) as string[];
            return emails.length > 0 ? emails.join(", ") : undefined;
          })()
        : (formParticipants || undefined),
      emailId: formEmailId,
      calendarAccountId: formCalendarAccountId || undefined,
      videoProvider: formVideoProvider,
      internal: formInternal,
    };

    const extractError = (err: any): string => {
      const data = err?.response?.data ?? err?.data ?? err;
      if (data?.details?.fieldErrors) {
        const fieldErrs = Object.entries(data.details.fieldErrors)
          .map(([k, v]) => `${k}: ${(v as string[]).join(", ")}`)
          .join(" | ");
        if (fieldErrs) return fieldErrs;
      }
      return data?.error || data?.message || err?.message || "Erreur inconnue";
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
          onError: (err: any) =>
            toast({
              title: t("agenda.updateError"),
              description: extractError(err),
              variant: "destructive",
            }),
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
          onError: (err: any) =>
            toast({
              title: t("agenda.createError"),
              description: extractError(err),
              variant: "destructive",
            }),
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
  const [suggestionsCollapsed, setSuggestionsCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("agenda.suggestionsCollapsed") === "1";
  });
  const toggleSuggestionsCollapsed = () => {
    setSuggestionsCollapsed((v) => {
      const next = !v;
      try { window.localStorage.setItem("agenda.suggestionsCollapsed", next ? "1" : "0"); } catch {}
      return next;
    });
  };
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

  // ============================================================
  // DRAG-TO-CREATE / MOVE / RESIZE sur vues Semaine & Jour
  // ============================================================
  const HOUR_PX_WEEK = 40;
  const HOUR_PX_DAY = 48;
  const SNAP_MIN = 30;

  type SlotDrag = { day: Date; startHour: number; endHour: number; active: boolean };
  const [slotDrag, setSlotDrag] = useState<SlotDrag | null>(null);
  const slotDragRef = useRef<SlotDrag | null>(null);
  useEffect(() => { slotDragRef.current = slotDrag; }, [slotDrag]);

  type ApptDragMode = "move" | "resize-end" | "resize-start";
  type ApptDrag = {
    aptId: string;
    mode: ApptDragMode;
    view: "week" | "day";
    origStart: Date;
    origEnd: Date;
    startX: number;
    startY: number;
    hourPx: number;
    moved: boolean;
    previewStart: Date;
    previewEnd: Date;
  };
  const [apptDrag, setApptDrag] = useState<ApptDrag | null>(null);
  const apptDragRef = useRef<ApptDrag | null>(null);
  useEffect(() => { apptDragRef.current = apptDrag; }, [apptDrag]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const ad = apptDragRef.current;
      if (ad) {
        const dx = e.clientX - ad.startX;
        const dy = e.clientY - ad.startY;
        const deltaMin = Math.round((dy / ad.hourPx) * 60 / SNAP_MIN) * SNAP_MIN;
        const moved = Math.abs(dy) > 4 || Math.abs(dx) > 4 || ad.moved;
        let previewStart = ad.origStart;
        let previewEnd = ad.origEnd;
        // Cross-day drag (vue Semaine, mode move) : on regarde la cellule sous le curseur
        let dayDelta = 0;
        if (ad.mode === "move" && ad.view === "week") {
          const target = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
          const dayCell = target?.closest("[data-day-iso]") as HTMLElement | null;
          const iso = dayCell?.getAttribute("data-day-iso");
          if (iso) {
            const newDay = parseISO(iso);
            const origDay = new Date(ad.origStart.getFullYear(), ad.origStart.getMonth(), ad.origStart.getDate());
            dayDelta = Math.round((newDay.getTime() - origDay.getTime()) / 86400000);
          }
        }
        if (ad.mode === "move") {
          previewStart = addDays(new Date(ad.origStart.getTime() + deltaMin * 60000), dayDelta);
          previewEnd = addDays(new Date(ad.origEnd.getTime() + deltaMin * 60000), dayDelta);
        } else if (ad.mode === "resize-end") {
          const candidate = new Date(ad.origEnd.getTime() + deltaMin * 60000);
          if (candidate.getTime() >= ad.origStart.getTime() + 15 * 60000) previewEnd = candidate;
        } else if (ad.mode === "resize-start") {
          const candidate = new Date(ad.origStart.getTime() + deltaMin * 60000);
          if (candidate.getTime() <= ad.origEnd.getTime() - 15 * 60000) previewStart = candidate;
        }
        setApptDrag({ ...ad, moved, previewStart, previewEnd });
      }
    };
    const onUp = () => {
      const ad = apptDragRef.current;
      const sd = slotDragRef.current;
      if (ad) {
        const changed = ad.previewStart.getTime() !== ad.origStart.getTime()
          || ad.previewEnd.getTime() !== ad.origEnd.getTime();
        if (ad.moved && changed) {
          updateAppointment.mutate(
            { id: ad.aptId, data: { startAt: ad.previewStart.toISOString(), endAt: ad.previewEnd.toISOString() } },
            { onSuccess: () => invalidate(), onError: () => invalidate() },
          );
        }
        setApptDrag(null);
      }
      // Règle simple :
      // - clic simple (pas de plage étendue) → on n'affiche AUCUNE sélection
      // - drag d'une plage (≥ 2 cases) → on garde la plage visible (active:false)
      // Comme ça l'utilisateur n'a jamais de mini-sélection coincée.
      if (sd && sd.active) {
        if (sd.startHour === sd.endHour) {
          setSlotDrag(null);
          slotDragRef.current = null;
        } else {
          const next = { ...sd, active: false };
          setSlotDrag(next);
          slotDragRef.current = next;
        }
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setApptDrag(null); setSlotDrag(null); }
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startSlotDrag = (day: Date, hour: number) => (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("[data-appt-block]") || target.closest("[data-ext-block]")) return;
    // Toggle off : si on clique dans une sélection déjà figée (drag relâché),
    // ça désélectionne tout au lieu de démarrer un nouveau drag.
    const sd = slotDragRef.current;
    if (sd && !sd.active && isSameDay(sd.day, day)) {
      const lo = Math.min(sd.startHour, sd.endHour);
      const hi = Math.max(sd.startHour, sd.endHour);
      if (hour >= lo && hour <= hi) {
        setSlotDrag(null);
        slotDragRef.current = null;
        return;
      }
    }
    const next = { day, startHour: hour, endHour: hour, active: true };
    setSlotDrag(next);
    slotDragRef.current = next;
  };
  const extendSlotDrag = (day: Date, hour: number) => () => {
    const sd = slotDragRef.current;
    // N'étend la sélection QUE pendant un drag actif (bouton enfoncé).
    // Sinon les survols après relâchement modifieraient la sélection.
    if (!sd || !sd.active || !isSameDay(sd.day, day)) return;
    if (sd.endHour !== hour) setSlotDrag({ ...sd, endHour: hour });
  };
  // Clic-droit sur une cellule horaire : ouvre « Nouveau RDV »
  // - si une plage est déjà sélectionnée sur ce jour, l'utilise
  // - sinon, utilise l'heure de la cellule cliquée
  const handleSlotContextMenu = (day: Date, hour: number) => (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("[data-appt-block]") || target.closest("[data-ext-block]")) return;
    e.preventDefault();
    const sd = slotDragRef.current;
    if (sd && isSameDay(sd.day, day)) {
      const h1 = Math.min(sd.startHour, sd.endHour);
      const h2 = Math.max(sd.startHour, sd.endHour);
      const start = new Date(sd.day); start.setHours(h1, 0, 0, 0);
      setSlotDrag(null);
      if (h1 === h2) {
        openCreateForm(start);
      } else {
        const end = new Date(sd.day); end.setHours(h2 + 1, 0, 0, 0);
        openCreateForm(start, end);
      }
    } else {
      const start = new Date(day); start.setHours(hour, 0, 0, 0);
      setSlotDrag(null);
      openCreateForm(start);
    }
  };
  const startApptDrag = (apt: Appointment, mode: ApptDragMode, view: "week" | "day") =>
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      const origStart = parseISO(apt.startAt);
      const origEnd = parseISO(apt.endAt);
      setApptDrag({
        aptId: apt.id,
        mode,
        view,
        origStart,
        origEnd,
        startX: e.clientX,
        startY: e.clientY,
        hourPx: view === "week" ? HOUR_PX_WEEK : HOUR_PX_DAY,
        moved: false,
        previewStart: origStart,
        previewEnd: origEnd,
      });
    };
  const apptClickHandler = (apt: Appointment) => (e: React.MouseEvent) => {
    e.stopPropagation();
    const ad = apptDragRef.current;
    if (ad && ad.aptId === apt.id && ad.moved) return;
    setSelectedAppointment(apt);
  };

  // ============================================================
  // Handlers menu clic-droit (calqués Outlook : Ouvrir / Éditer /
  // Dupliquer / Transférer / Projet / Marquer comme / Supprimer)
  // ============================================================
  const extractErr = (err: any): string => {
    const d = err?.response?.data ?? err?.data ?? err;
    return d?.error || d?.message || err?.message || "Erreur";
  };
  const handleDuplicateAppt = (apt: Appointment, daysOffset: number = 7) => {
    const start = parseISO(apt.startAt);
    const end = parseISO(apt.endAt);
    const newStart = addDays(start, daysOffset);
    const newEnd = addDays(end, daysOffset);
    createAppointment.mutate(
      {
        data: {
          title: `${apt.title} (copie)`,
          description: apt.description ?? null,
          location: apt.location ?? null,
          startAt: newStart.toISOString(),
          endAt: newEnd.toISOString(),
          allDay: (apt as any).allDay ?? false,
          projectId: (apt as any).projectId ?? null,
        },
      } as any,
      {
        onSuccess: () => {
          invalidate();
          toast({ title: t("agenda.duplicated", "Rendez-vous dupliqué"), description: t("agenda.duplicatedDesc", "Copie créée 7 jours plus tard.") });
        },
        onError: (err: any) => {
          toast({ title: t("agenda.duplicateError", "Erreur duplication"), description: extractErr(err), variant: "destructive" });
        },
      },
    );
  };
  const handleForwardAppt = (apt: Appointment) => {
    const start = parseISO(apt.startAt);
    const end = parseISO(apt.endAt);
    const dateStr = format(start, "EEEE d MMMM yyyy", { locale });
    const startStr = format(start, "HH:mm");
    const endStr = format(end, "HH:mm");
    const lines: string[] = [
      t("agenda.forwardIntro", "Bonjour,"),
      "",
      t("agenda.forwardBody", "Je vous transfère les détails de ce rendez-vous :"),
      "",
      `${t("agenda.forwardTitle", "Titre")} : ${apt.title}`,
      `${t("agenda.forwardWhen", "Date")} : ${dateStr}, ${startStr} – ${endStr}`,
    ];
    if (apt.location) lines.push(`${t("agenda.forwardWhere", "Lieu")} : ${apt.location}`);
    if ((apt as any).videoUrl) lines.push(`${t("agenda.forwardVideo", "Lien visio")} : ${(apt as any).videoUrl}`);
    if (apt.description) { lines.push("", apt.description); }
    lines.push("", t("agenda.forwardOutro", "Bien à vous,"));
    const subject = `${t("agenda.forwardSubject", "TR : RDV")} — ${apt.title}`;
    try {
      sessionStorage.setItem("inboria.compose.prefill", JSON.stringify({
        to: "",
        subject,
        body: lines.join("\n"),
      }));
    } catch { /* noop */ }
    setLocation("/dashboard?compose=1");
  };
  const handleChangeProject = (apt: Appointment, projectId: string | number | null) => {
    updateAppointment.mutate(
      { id: apt.id, data: { projectId } as any },
      { onSuccess: () => invalidate(), onError: (err: any) => toast({ title: t("agenda.updateError", "Erreur"), description: extractErr(err), variant: "destructive" }) },
    );
  };
  const handleChangeStatus = (apt: Appointment, status: "confirmed" | "pending" | "declined") => {
    const data: any = { status };
    if (status === "confirmed") data.confirmed = true;
    if (status === "pending" || status === "declined") data.confirmed = false;
    updateAppointment.mutate(
      { id: apt.id, data },
      { onSuccess: () => invalidate(), onError: (err: any) => toast({ title: t("agenda.updateError", "Erreur"), description: extractErr(err), variant: "destructive" }) },
    );
  };
  const handleDeleteAppt = (apt: Appointment) => {
    if (!window.confirm(t("agenda.confirmDelete", "Supprimer ce rendez-vous ?"))) return;
    deleteAppointment.mutate(
      { id: apt.id },
      { onSuccess: () => invalidate(), onError: (err: any) => toast({ title: t("agenda.deleteError", "Erreur suppression"), description: extractErr(err), variant: "destructive" }) },
    );
  };

  // Menu clic-droit factorisé (utilisé en vue Semaine et Jour).
  // ⚠️ NE PAS transformer en composant React (ex: <ApptMenu apt={apt} />) :
  // une fonction-composant définie ici aurait une identité différente à chaque render
  // → React démonterait/remonterait le portail Radix juste avant le clic, avalant
  // tous les onSelect (sauf navigation directe type setLocation). Garder un render
  // helper { renderApptMenu(apt) } pour rester inline et stable côté reconciliation.
  const renderApptMenu = (apt: Appointment) => (
    <ContextMenuContent className="w-56">
      <ContextMenuItem onSelect={() => setSelectedAppointment(apt)}>
        {t("agenda.ctxOpen", "Ouvrir")}
      </ContextMenuItem>
      <ContextMenuItem onSelect={() => openEditForm(apt)}>
        {t("agenda.ctxEdit", "Modifier")}
      </ContextMenuItem>
      <ContextMenuSub>
        <ContextMenuSubTrigger>{t("agenda.ctxDuplicate", "Dupliquer")}</ContextMenuSubTrigger>
        <ContextMenuSubContent className="w-56">
          <ContextMenuItem onSelect={() => handleDuplicateAppt(apt, 1)}>
            {t("agenda.ctxDupNextDay", "Le lendemain")}
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => handleDuplicateAppt(apt, 7)}>
            {t("agenda.ctxDup7", "Dans 7 jours")}
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => handleDuplicateAppt(apt, 14)}>
            {t("agenda.ctxDup14", "Dans 14 jours")}
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => handleDuplicateAppt(apt, 30)}>
            {t("agenda.ctxDup30", "Dans 1 mois")}
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => handleDuplicateAppt(apt, 90)}>
            {t("agenda.ctxDup90", "Dans 3 mois")}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={() => {
            const raw = window.prompt(t("agenda.ctxDupCustom", "Dupliquer dans combien de jours ?"), "7");
            if (raw == null) return;
            const n = parseInt(raw, 10);
            if (Number.isFinite(n) && n !== 0) handleDuplicateAppt(apt, n);
          }}>
            {t("agenda.ctxDupCustomMenu", "Personnalisé…")}
          </ContextMenuItem>
        </ContextMenuSubContent>
      </ContextMenuSub>
      <ContextMenuItem onSelect={() => handleForwardAppt(apt)}>
        {t("agenda.ctxForward", "Transférer par email")}
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuSub>
        <ContextMenuSubTrigger>{t("agenda.ctxProject", "Projet")}</ContextMenuSubTrigger>
        <ContextMenuSubContent className="w-52">
          <ContextMenuItem onSelect={() => handleChangeProject(apt, null)}>
            {t("agenda.ctxNoProject", "Aucun projet")}
          </ContextMenuItem>
          {projects.length > 0 && <ContextMenuSeparator />}
          {projects.map((p: any) => (
            <ContextMenuItem key={p.id} onSelect={() => handleChangeProject(apt, p.id)}>
              <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ backgroundColor: p.color || "#2d7dd2" }} />
              {p.name}
            </ContextMenuItem>
          ))}
        </ContextMenuSubContent>
      </ContextMenuSub>
      <ContextMenuSub>
        <ContextMenuSubTrigger>{t("agenda.ctxMarkAs", "Marquer comme")}</ContextMenuSubTrigger>
        <ContextMenuSubContent className="w-48">
          <ContextMenuItem onSelect={() => handleChangeStatus(apt, "confirmed")}>
            {t("agenda.statusConfirmedShort", "Confirmé")}
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => handleChangeStatus(apt, "pending")}>
            {t("agenda.statusPendingShort", "En attente")}
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => handleChangeStatus(apt, "declined")}>
            {t("agenda.statusDeclinedShort", "Refusé")}
          </ContextMenuItem>
        </ContextMenuSubContent>
      </ContextMenuSub>
      <ContextMenuSeparator />
      <ContextMenuItem onSelect={() => handleDeleteAppt(apt)} className="text-red-400 focus:text-red-300">
        {t("agenda.ctxDelete", "Supprimer")}
      </ContextMenuItem>
    </ContextMenuContent>
  );
  const isCellInSlotDrag = (day: Date, hour: number): boolean => {
    if (!slotDrag || !isSameDay(slotDrag.day, day)) return false;
    const lo = Math.min(slotDrag.startHour, slotDrag.endHour);
    const hi = Math.max(slotDrag.startHour, slotDrag.endHour);
    return hour >= lo && hour <= hi;
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
            <div className="flex items-center gap-0.5 rounded-md border border-border bg-background/40 p-0.5">
              {(["all", "external", "internal"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setSourceFilter(k)}
                  className={`h-7 px-2 text-[11px] rounded-sm transition-colors ${
                    sourceFilter === k
                      ? "bg-primary/15 text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/[0.03]"
                  }`}
                >
                  {k === "all"
                    ? t("agenda.filterAll", "Tous")
                    : k === "external"
                      ? t("agenda.filterExternal", "Avec client")
                      : t("agenda.filterInternal", "Internes")}
                </button>
              ))}
            </div>
            <Button onClick={() => openCreateForm(undefined, undefined, true)} size="sm" variant="outline" className="h-8 text-[12px]">
              <Plus className="w-3 h-3 mr-1.5" />
              {t("agenda.newInternalAppointment", "RDV interne")}
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
          <div className={`bg-card border border-border rounded-lg ${suggestionsCollapsed ? "p-2" : "p-3"} mb-4`}>
            <div className={`flex items-center justify-between gap-2 h-7 ${suggestionsCollapsed ? "" : "mb-2"}`}>
              <h3 className="text-[12px] font-semibold text-primary flex items-center gap-1.5 whitespace-nowrap">
                <Sparkles className="w-3.5 h-3.5" />
                {t("agenda.suggestionsDetected", { count: suggestions.length })}
              </h3>
              <div className="flex items-center gap-2">
                {!suggestionsCollapsed && (
                  <>
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
                  </>
                )}
                <button
                  type="button"
                  onClick={toggleSuggestionsCollapsed}
                  className="inline-flex items-center justify-center h-6 w-6 rounded text-[#b8c5d6] hover:text-white hover:bg-white/[0.04]"
                  aria-label={suggestionsCollapsed ? t("agenda.expandSuggestions", "Afficher les suggestions") : t("agenda.collapseSuggestions", "Masquer les suggestions")}
                  title={suggestionsCollapsed ? t("agenda.expandSuggestions", "Afficher les suggestions") : t("agenda.collapseSuggestions", "Masquer les suggestions")}
                >
                  {suggestionsCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            {!suggestionsCollapsed && (
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
            )}
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
                    const selected = isCellInSlotDrag(d, hour);
                    return (
                      <div
                        key={i}
                        data-day-iso={format(d, "yyyy-MM-dd")}
                        onMouseDown={startSlotDrag(d, hour)}
                        onMouseEnter={extendSlotDrag(d, hour)}
                        onContextMenu={handleSlotContextMenu(d, hour)}
                        className={`border-r border-border last:border-r-0 min-h-[40px] p-0.5 cursor-pointer select-none hover:bg-[#1a2235] ${isToday(d) ? "bg-primary/5" : ""} ${selected ? "bg-primary/20" : ""}`}
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
                          const isDragging = apptDrag?.aptId === apt.id && apptDrag.moved;
                          return (
                          <ContextMenu key={apt.id}>
                            <ContextMenuTrigger asChild>
                              <div
                                data-appt-block
                                onMouseDown={startApptDrag(apt, "move", "week")}
                                onClick={apptClickHandler(apt)}
                                className={`relative text-[10px] px-1 py-0.5 rounded cursor-pointer ${isDragging ? "opacity-60 ring-1 ring-primary" : ""} ${nonConfirmed ? "bg-card border border-dashed border-border text-primary" : `text-foreground ${!pc ? "bg-primary/20 hover:bg-primary/30" : ""}`}`}
                                style={pc && !nonConfirmed
                                  ? { backgroundColor: `${pc}20`, borderLeft: `3px solid ${pc}` }
                                  : undefined}
                                title={`${apt.title} — ${shortLabel}${apt.projects?.name ? ` · ${apt.projects.name}` : ""}`}
                              >
                                <div className={`truncate ${nonConfirmed ? "text-primary" : "text-foreground"}`}>{format(parseISO(apt.startAt), "HH:mm")} {apt.title}</div>
                                <div className={`truncate flex items-center gap-1 ${nonConfirmed ? "text-primary" : "text-muted-foreground"}`}>
                                  {pc && (
                                    <span className="inline-block w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: pc }} />
                                  )}
                                  <span className="truncate">
                                    {shortLabel}
                                    {apt.projects?.name && <> · {apt.projects.name}</>}
                                  </span>
                                </div>
                                <div
                                  onMouseDown={startApptDrag(apt, "resize-end", "week")}
                                  className="absolute bottom-0 left-0 right-0 h-1 cursor-ns-resize hover:bg-primary/60"
                                />
                              </div>
                            </ContextMenuTrigger>
                            {renderApptMenu(apt)}
                          </ContextMenu>
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
                      className={`flex-1 min-h-[48px] p-1 cursor-pointer select-none hover:bg-[#1a2235] ${isCellInSlotDrag(currentDate, hour) ? "bg-primary/20" : ""}`}
                      onMouseDown={startSlotDrag(currentDate, hour)}
                      onMouseEnter={extendSlotDrag(currentDate, hour)}
                      onContextMenu={handleSlotContextMenu(currentDate, hour)}
                    >
                      {hourAppts.map((apt) => {
                        const pc = apt.projects?.color;
                        const aptStatus = apt.status;
                        const isCounter = aptStatus === "counter_proposed";
                        const isDeclined = aptStatus === "declined";
                        const isPending = aptStatus === "pending" || (apt.confirmed === false && !isCounter && !isDeclined);
                        const isDragging = apptDrag?.aptId === apt.id && apptDrag.moved;
                        return (
                        <ContextMenu key={apt.id}>
                          <ContextMenuTrigger asChild>
                        <div
                          data-appt-block
                          onMouseDown={startApptDrag(apt, "move", "day")}
                          onClick={apptClickHandler(apt)}
                          className={`relative rounded px-2 py-1.5 cursor-pointer mb-1 border ${isDragging ? "opacity-60 ring-1 ring-primary" : ""} ${
                            isDeclined
                              ? "bg-card border-border opacity-60"
                              : isPending || isCounter
                                ? "bg-card border-border border-dashed hover:bg-[#1a2235]"
                                : apt.confirmed === false
                                  ? "bg-primary/10 border-primary/30"
                                  : "bg-primary/15 border-primary/30 hover:bg-primary/25"
                          }`}
                          style={pc && !isPending && !isCounter && !isDeclined && apt.confirmed !== false ? { backgroundColor: `${pc}15`, borderColor: `${pc}30`, borderLeft: `3px solid ${pc}` } : undefined}
                          data-testid={`agenda-appt-${apt.id}`}
                          title={`${apt.title}${apt.projects?.name ? ` · ${apt.projects.name}` : ""}`}
                        >
                          <div
                            onMouseDown={startApptDrag(apt, "resize-start", "day")}
                            className="absolute top-0 left-0 right-0 h-1 cursor-ns-resize hover:bg-primary/60"
                          />
                          <div
                            onMouseDown={startApptDrag(apt, "resize-end", "day")}
                            className="absolute bottom-0 left-0 right-0 h-1 cursor-ns-resize hover:bg-primary/60"
                          />
                          <div className="text-[12px] font-medium text-foreground">
                            <span className="truncate">{apt.title}</span>
                          </div>
                          <div className={`text-[10px] mt-0.5 flex items-center gap-2 ${isPending || isCounter || isDeclined ? "text-primary" : "text-muted-foreground"}`}>
                            <span>
                              {isPending
                                ? t("agenda.statusPending", "En attente de réponse")
                                : isCounter
                                  ? t("agenda.statusCounter", "Contre-proposition reçue")
                                  : isDeclined
                                    ? t("agenda.statusDeclined", "Refusé par le contact")
                                    : t("agenda.statusConfirmedShort", "Confirmé")}
                            </span>
                            {apt.projects?.name && (
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: pc || "#2d7dd2" }} />
                                <span className="truncate">{apt.projects.name}</span>
                              </span>
                            )}
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
                          </ContextMenuTrigger>
                          {renderApptMenu(apt)}
                        </ContextMenu>
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

              {/* Co-organisateurs internes (Business) — Phase 2 */}
              {isBusiness && (
                <div className="mb-4 border-t border-border pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-[11px] font-medium text-foreground">
                      <UserPlus className="w-3.5 h-3.5" />
                      {t("agenda.coorganizers", "Co-organisateurs internes")}
                      {coorgs.length > 0 && (
                        <span className="text-[10px] text-muted-foreground">({coorgs.length})</span>
                      )}
                    </div>
                    {(selectedAppointment.userId === currentUserId || (selectedAppointment as { user_id?: string }).user_id === currentUserId) && (
                      <button
                        type="button"
                        onClick={() => setCoorgPickerOpen((v) => !v)}
                        className="text-[11px] text-primary hover:text-primary/80"
                      >
                        {coorgPickerOpen ? t("common.cancel", "Annuler") : t("agenda.coorgAdd", "+ Ajouter")}
                      </button>
                    )}
                  </div>
                  {coorgLoading && (
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      {t("common.loading", "Chargement…")}
                    </div>
                  )}
                  {!coorgLoading && coorgs.length === 0 && !coorgPickerOpen && (
                    <p className="text-[11px] text-muted-foreground">
                      {t("agenda.coorgEmpty", "Aucun co-organisateur. Invite un collègue pour qu'il reçoive les notifs RDV (confirmations, refus, contre-propositions, rappels).")}
                    </p>
                  )}
                  {coorgs.length > 0 && (
                    <ul className="space-y-1">
                      {coorgs.map((c) => (
                        <li
                          key={c.id}
                          className="flex items-center justify-between bg-background border border-border rounded px-2 py-1"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-5 h-5 rounded-full bg-primary/15 border border-primary/30 text-primary text-[10px] font-semibold flex items-center justify-center shrink-0">
                              {(c.fullName || c.email || "?").slice(0, 1).toUpperCase()}
                            </span>
                            <span className="text-[11px] text-foreground truncate">{c.fullName || c.email || c.userId}</span>
                            {c.email && c.fullName && (
                              <span className="text-[10px] text-muted-foreground truncate">{c.email}</span>
                            )}
                          </div>
                          {(selectedAppointment.userId === currentUserId || (selectedAppointment as { user_id?: string }).user_id === currentUserId || c.userId === currentUserId) && (
                            <button
                              type="button"
                              onClick={() => removeCoorg(c.userId)}
                              className="text-muted-foreground hover:text-destructive shrink-0"
                              title={t("common.remove", "Retirer") as string}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  {coorgPickerOpen && (
                    <div className="mt-2 border border-border rounded bg-background max-h-40 overflow-y-auto">
                      {(() => {
                        const members = ((orgMembersList || []) as Array<{ userId: string; fullName: string; email: string; status: string }>)
                          .filter((m) => m.status === "active" || !m.status)
                          .filter((m) => m.userId && m.userId !== currentUserId)
                          .filter((m) => !coorgs.some((c) => c.userId === m.userId));
                        if (members.length === 0) {
                          return (
                            <div className="text-[11px] text-muted-foreground p-2">
                              {t("agenda.coorgNoCandidate", "Aucun membre disponible.")}
                            </div>
                          );
                        }
                        return members.map((m) => (
                          <button
                            key={m.userId}
                            type="button"
                            onClick={() => addCoorg(m.userId)}
                            className="w-full text-left px-2 py-1.5 text-[11px] hover:bg-white/[0.04] flex items-center gap-2"
                          >
                            <span className="w-5 h-5 rounded-full bg-primary/15 border border-primary/30 text-primary text-[10px] font-semibold flex items-center justify-center shrink-0">
                              {(m.fullName || m.email || "?").slice(0, 1).toUpperCase()}
                            </span>
                            <span className="truncate">{m.fullName || m.email}</span>
                            {m.email && m.fullName && (
                              <span className="text-[10px] text-muted-foreground truncate">{m.email}</span>
                            )}
                          </button>
                        ));
                      })()}
                    </div>
                  )}
                </div>
              )}

              {/* Notes internes RDV (Business) — Phase 3 */}
              {isBusiness && (
                <div className="mb-4 border-t border-border pt-3">
                  <div className="flex items-center gap-2 text-[11px] font-medium text-foreground mb-2">
                    <MessageSquare className="w-3.5 h-3.5" />
                    {t("agenda.internalNotes", "Notes internes")}
                    {notes.length > 0 && (
                      <span className="text-[10px] text-muted-foreground">({notes.length})</span>
                    )}
                  </div>
                  {/* Composer (owner + co-orgs uniquement) */}
                  {(selectedAppointment.userId === currentUserId
                    || (selectedAppointment as { user_id?: string }).user_id === currentUserId
                    || coorgs.some((c) => c.userId === currentUserId)) && (
                    <div className="flex items-end gap-2 mb-2">
                      <Textarea
                        value={noteDraft}
                        onChange={(e) => setNoteDraft(e.target.value)}
                        placeholder={t("agenda.notePlaceholder", "Note interne (visible uniquement par toi et tes co-organisateurs)…") as string}
                        className="text-[11px] min-h-[44px] flex-1"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                            e.preventDefault();
                            void submitNote();
                          }
                        }}
                      />
                      <Button
                        size="sm"
                        className="h-7 text-[11px] shrink-0"
                        disabled={noteSubmitting || !noteDraft.trim()}
                        onClick={() => void submitNote()}
                      >
                        {noteSubmitting ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Send className="w-3 h-3" />
                        )}
                      </Button>
                    </div>
                  )}
                  {notesLoading && (
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      {t("common.loading", "Chargement…")}
                    </div>
                  )}
                  {!notesLoading && notes.length === 0 && (
                    <p className="text-[11px] text-muted-foreground">
                      {t("agenda.notesEmpty", "Aucune note. Les notes restent internes — jamais envoyées au client.")}
                    </p>
                  )}
                  {notes.length > 0 && (
                    <ul className="space-y-2 max-h-48 overflow-y-auto">
                      {notes.map((n) => (
                        <li key={n.id} className="bg-background border border-border rounded p-2">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-4 h-4 rounded-full bg-primary/15 border border-primary/30 text-primary text-[9px] font-semibold flex items-center justify-center shrink-0">
                                {(n.authorName || "?").slice(0, 1).toUpperCase()}
                              </span>
                              <span className="text-[11px] text-foreground truncate">{n.authorName || n.userId}</span>
                              <span className="text-[10px] text-muted-foreground shrink-0">
                                {format(parseISO(n.createdAt), "d MMM HH:mm", { locale })}
                              </span>
                            </div>
                            {(n.userId === currentUserId
                              || selectedAppointment.userId === currentUserId
                              || (selectedAppointment as { user_id?: string }).user_id === currentUserId) && (
                              <button
                                type="button"
                                onClick={() => void deleteNote(n.id)}
                                className="text-muted-foreground hover:text-destructive shrink-0"
                                title={t("common.remove", "Retirer") as string}
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                          <p className="text-[11px] text-foreground whitespace-pre-wrap break-words">{n.body}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

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
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="bg-card text-card-foreground border border-border rounded-lg w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto">
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
                  {formMultiDay ? (
                    <div>
                      <label className="text-[11px] text-muted-foreground mb-1 block">{t("agenda.endDate")}</label>
                      <Input
                        type="datetime-local"
                        value={formEndAt}
                        onChange={(e) => setFormEndAt(e.target.value)}
                        className="h-8 text-[12px]"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="text-[11px] text-muted-foreground mb-1 block">{t("agenda.duration", "Durée")}</label>
                      <select
                        value={formDuration}
                        onChange={(e) => setFormDuration(e.target.value)}
                        className="w-full h-8 rounded-md border border-border bg-background px-2 text-[12px] text-foreground"
                      >
                        <option value="15">15 min</option>
                        <option value="30">30 min</option>
                        <option value="45">45 min</option>
                        <option value="60">1 h</option>
                        <option value="90">1 h 30</option>
                        <option value="120">2 h</option>
                        <option value="180">3 h</option>
                        <option value="240">4 h</option>
                        <option value="480">8 h (journée)</option>
                      </select>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-end -mt-1">
                  <button
                    type="button"
                    onClick={() => {
                      const next = !formMultiDay;
                      setFormMultiDay(next);
                      if (next && formStartAt) {
                        const start = new Date(formStartAt);
                        const end = new Date(start.getTime() + (parseInt(formDuration) || 30) * 60000);
                        setFormEndAt(format(end, "yyyy-MM-dd'T'HH:mm"));
                      }
                    }}
                    className="text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                  >
                    {formMultiDay
                      ? t("agenda.singleDay", "Revenir à durée simple")
                      : t("agenda.multiDay", "Plusieurs jours…")}
                  </button>
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

                <label className="flex items-center gap-2 text-[12px] text-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formInternal}
                    onChange={(e) => setFormInternal(e.target.checked)}
                    className="w-3.5 h-3.5 accent-primary"
                  />
                  <span>{t("agenda.internalAppointment", "RDV interne")}</span>
                </label>

                {!formInternal ? (
                  <div>
                    <label className="text-[11px] text-muted-foreground mb-1 block">{t("agenda.participants")}</label>
                    <Input
                      value={formParticipants}
                      onChange={(e) => setFormParticipants(e.target.value)}
                      placeholder={t("agenda.participantsPlaceholder")}
                      className="h-8 text-[12px]"
                    />
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] text-muted-foreground">
                        {t("agenda.internalMembers", "Membres de l'équipe invités")}
                        {formInternalMemberIds.length > 0 && (
                          <span className="ml-1 text-[10px]">({formInternalMemberIds.length})</span>
                        )}
                      </label>
                      <button
                        type="button"
                        onClick={() => setFormInternalPickerOpen((v) => !v)}
                        className="text-[11px] text-primary hover:text-primary/80"
                      >
                        {formInternalPickerOpen ? t("common.cancel", "Annuler") : t("agenda.coorgAdd", "+ Ajouter")}
                      </button>
                    </div>
                    {formInternalMemberIds.length === 0 && !formInternalPickerOpen && (
                      <p className="text-[11px] text-muted-foreground">
                        {t("agenda.internalMembersEmpty", "Aucun membre invité. Clique « + Ajouter » pour choisir tes collègues.")}
                      </p>
                    )}
                    {formInternalMemberIds.length > 0 && (
                      <ul className="space-y-1 mb-1">
                        {formInternalMemberIds.map((id) => {
                          const m = ((orgMembersList || []) as Array<{ userId: string; fullName: string; email: string }>).find((x) => x.userId === id);
                          if (!m) return null;
                          return (
                            <li key={id} className="flex items-center justify-between bg-background border border-border rounded px-2 py-1">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="w-5 h-5 rounded-full bg-primary/15 border border-primary/30 text-primary text-[10px] font-semibold flex items-center justify-center shrink-0">
                                  {(m.fullName || m.email || "?").slice(0, 1).toUpperCase()}
                                </span>
                                <span className="text-[11px] text-foreground truncate">{m.fullName || m.email}</span>
                                {m.email && m.fullName && (
                                  <span className="text-[10px] text-muted-foreground truncate">{m.email}</span>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => setFormInternalMemberIds((prev) => prev.filter((x) => x !== id))}
                                className="text-muted-foreground hover:text-destructive shrink-0"
                                title={t("common.remove", "Retirer") as string}
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    {formInternalPickerOpen && (
                      <div className="border border-border rounded bg-background max-h-40 overflow-y-auto">
                        {(() => {
                          const members = ((orgMembersList || []) as Array<{ userId: string; fullName: string; email: string; status: string }>)
                            .filter((m) => m.status === "active" || !m.status)
                            .filter((m) => m.userId && m.userId !== currentUserId)
                            .filter((m) => !formInternalMemberIds.includes(m.userId));
                          if (members.length === 0) {
                            return (
                              <div className="text-[11px] text-muted-foreground p-2">
                                {t("agenda.coorgNoCandidate", "Aucun membre disponible.")}
                              </div>
                            );
                          }
                          return members.map((m) => (
                            <button
                              key={m.userId}
                              type="button"
                              onClick={() => {
                                setFormInternalMemberIds((prev) => [...prev, m.userId]);
                                setFormInternalPickerOpen(false);
                              }}
                              className="w-full text-left px-2 py-1.5 text-[11px] hover:bg-white/[0.04] flex items-center gap-2"
                            >
                              <span className="w-5 h-5 rounded-full bg-primary/15 border border-primary/30 text-primary text-[10px] font-semibold flex items-center justify-center shrink-0">
                                {(m.fullName || m.email || "?").slice(0, 1).toUpperCase()}
                              </span>
                              <span className="truncate">{m.fullName || m.email}</span>
                              {m.email && m.fullName && (
                                <span className="text-[10px] text-muted-foreground truncate">{m.email}</span>
                              )}
                            </button>
                          ));
                        })()}
                      </div>
                    )}
                  </div>
                )}

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
                    disabled={!formTitle || !formStartAt || (formMultiDay && !formEndAt) || createAppointment.isPending || updateAppointment.isPending}
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
