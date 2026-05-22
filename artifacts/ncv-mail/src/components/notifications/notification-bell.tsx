import { useState, useRef, useEffect, useMemo } from "react";
import {
  Bell, AlertCircle, MessageSquare, UserPlus, UserMinus, X,
  Mail, Clock, CheckSquare, Zap, MoreHorizontal, Settings as SettingsIcon,
  AtSign, Calendar, AlertTriangle, Sparkles, Send, Info,
} from "lucide-react";
import {
  useGetUnreadNotificationCount,
  useGetNotifications,
  useMarkNotificationRead,
  useMarkNotificationUnread,
  useMarkAllNotificationsRead,
  useDeleteNotification,
} from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

type FilterKey = "all" | "unread" | "mentions" | "assignments" | "reminders";

const MENTION_TYPES = new Set(["comment_mention", "commented", "comment_added"]);
const ASSIGN_TYPES = new Set(["assigned", "email_assigned", "email_unassigned", "shared_mailbox_new_unassigned"]);
const REMINDER_TYPES = new Set(["snooze_expired", "task_due", "appointment_imminent", "followup_suggestions_digest"]);

function matchesFilter(n: any, f: FilterKey): boolean {
  if (f === "all") return true;
  if (f === "unread") return !n.read;
  if (f === "mentions") return MENTION_TYPES.has(n.type);
  if (f === "assignments") return ASSIGN_TYPES.has(n.type);
  if (f === "reminders") return REMINDER_TYPES.has(n.type);
  return true;
}

function stripTagPrefix(title: string): string {
  return String(title || "").replace(/^\[(apt|task):[^\]]+\]\s*/, "");
}

function getIcon(type: string) {
  if (type === "connection_disconnected") return AlertCircle;
  if (type === "send_failed") return AlertTriangle;
  if (type === "sla_breach") return Info;
  if (type === "commented" || type === "comment_added") return MessageSquare;
  if (type === "comment_mention") return AtSign;
  if (type === "assigned" || type === "email_assigned") return UserPlus;
  if (type === "email_unassigned") return UserMinus;
  if (type === "email_reply_received") return Mail;
  if (type === "shared_mailbox_new_unassigned") return Mail;
  if (type === "appointment_imminent") return Calendar;
  if (type === "followup_suggestions_digest") return Sparkles;
  if (type === "snooze_expired") return Clock;
  if (type === "task_due") return CheckSquare;
  if (type === "automation_rule_digest") return Zap;
  return Send;
}

function bucketByDate(items: any[]): Array<{ key: string; label: string; items: any[] }> {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 86400_000;
  const startOfWeek = startOfToday - 6 * 86400_000;
  const buckets = {
    today: [] as any[],
    yesterday: [] as any[],
    week: [] as any[],
    older: [] as any[],
  };
  for (const n of items) {
    const t = new Date(n.createdAt).getTime();
    if (t >= startOfToday) buckets.today.push(n);
    else if (t >= startOfYesterday) buckets.yesterday.push(n);
    else if (t >= startOfWeek) buckets.week.push(n);
    else buckets.older.push(n);
  }
  return [
    { key: "today", label: "Aujourd'hui", items: buckets.today },
    { key: "yesterday", label: "Hier", items: buckets.yesterday },
    { key: "week", label: "Cette semaine", items: buckets.week },
    { key: "older", label: "Plus ancien", items: buckets.older },
  ].filter((b) => b.items.length > 0);
}

export function NotificationBell() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [hoverMenu, setHoverMenu] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [, setLocation] = useLocation();

  const { data: unreadData, refetch: refetchCount } = useGetUnreadNotificationCount({
    query: { refetchInterval: 30000 } as any,
  });
  const { data: notifications, refetch: refetchNotifs } = useGetNotifications(
    { limit: 100 },
    { query: { enabled: open, refetchInterval: open ? 30000 : false } as any }
  );
  const markRead = useMarkNotificationRead();
  const markUnread = useMarkNotificationUnread();
  const markAllRead = useMarkAllNotificationsRead();
  const deleteNotif = useDeleteNotification();

  const unreadCount = (unreadData as any)?.count || 0;
  const allNotifs = (notifications as any[]) || [];

  const counts = useMemo(() => ({
    all: allNotifs.length,
    unread: allNotifs.filter((n) => !n.read).length,
    mentions: allNotifs.filter((n) => MENTION_TYPES.has(n.type)).length,
    assignments: allNotifs.filter((n) => ASSIGN_TYPES.has(n.type)).length,
    reminders: allNotifs.filter((n) => REMINDER_TYPES.has(n.type)).length,
  }), [allNotifs]);

  const filtered = useMemo(() => allNotifs.filter((n) => matchesFilter(n, filter)), [allNotifs, filter]);
  const grouped = useMemo(() => bucketByDate(filtered), [filtered]);

  // ESC pour fermer + click outside (mais PAS quand on clique sur une notif qui
  // navigue : le panneau reste ouvert — comportement Missive).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); setHoverMenu(null); }
    };
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current && !panelRef.current.contains(target)) {
        // Ne pas fermer si le clic vient du bouton cloche lui-même
        const bell = document.getElementById("notif-bell-trigger");
        if (bell && bell.contains(target)) return;
        setOpen(false);
        setHoverMenu(null);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, [open]);

  // Close hover menu on outside click
  useEffect(() => {
    if (!hoverMenu) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setHoverMenu(null);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [hoverMenu]);

  const handleClick = (notif: any) => {
    if (!notif.read) {
      markRead.mutate({ id: notif.id }, {
        onSuccess: () => { refetchCount(); refetchNotifs(); },
      });
    }
    // Navigation : on route mais on GARDE le panneau ouvert (comportement Missive).
    if (notif.type === "connection_disconnected") {
      setLocation("/dashboard/parametres");
      return;
    }
    if (notif.type === "automation_rule_digest") {
      setLocation("/dashboard/parametres/regles");
      return;
    }
    if (notif.type === "appointment_imminent") {
      const m = String(notif.title || "").match(/^\[apt:([^\]]+)\]/);
      setLocation(m ? `/dashboard/agenda?openApt=${encodeURIComponent(m[1])}` : "/dashboard/agenda");
      return;
    }
    if (notif.type === "task_due") {
      const m = String(notif.title || "").match(/^\[task:([^\]]+)\]/);
      if (notif.emailId) {
        setLocation(`/dashboard/email/${notif.emailId}`);
      } else {
        setLocation(m ? `/dashboard/taches?openTask=${encodeURIComponent(m[1])}` : "/dashboard/taches");
      }
      return;
    }
    if (notif.type === "followup_suggestions_digest") {
      setLocation("/dashboard/taches");
      return;
    }
    if (notif.emailId) {
      setLocation(`/dashboard/email/${notif.emailId}`);
    }
  };

  const handleToggleRead = (notif: any) => {
    const mut = notif.read ? markUnread : markRead;
    mut.mutate({ id: notif.id }, {
      onSuccess: () => { refetchCount(); refetchNotifs(); },
    });
    setHoverMenu(null);
  };

  const handleDelete = (notif: any) => {
    deleteNotif.mutate({ id: notif.id }, {
      onSuccess: () => { refetchCount(); refetchNotifs(); },
    });
    setHoverMenu(null);
  };

  const handleMarkAllRead = () => {
    markAllRead.mutate(undefined, {
      onSuccess: () => { refetchCount(); refetchNotifs(); },
    });
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t("notifications.justNow");
    if (mins < 60) return t("notifications.minutesAgo", { count: mins });
    const hours = Math.floor(mins / 60);
    if (hours < 24) return t("notifications.hoursAgo", { count: hours });
    const days = Math.floor(hours / 24);
    if (days < 7) return t("notifications.daysAgo", { count: days });
    return format(d, "d MMM", { locale: fr });
  };

  const FILTER_PILLS: Array<{ key: FilterKey; label: string; count: number }> = [
    { key: "all", label: "Toutes", count: counts.all },
    { key: "unread", label: "Non lues", count: counts.unread },
    { key: "mentions", label: "Mentions", count: counts.mentions },
    { key: "assignments", label: "Assignations", count: counts.assignments },
    { key: "reminders", label: "Rappels", count: counts.reminders },
  ];

  return (
    <>
      <button
        id="notif-bell-trigger"
        onClick={() => setOpen((v) => !v)}
        className="relative p-1.5 rounded-md text-[#b8c5d6] hover:text-white hover:bg-white/[0.06] transition-colors"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] rounded-full bg-red-500 text-[9px] font-bold text-white flex items-center justify-center px-1">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Backdrop semi-transparent — fermeture au clic, n'empêche pas
              d'interagir avec la liste/conv en arrière-plan car z < panel */}
          <div
            className="fixed inset-0 bg-black/20 z-[99]"
            onClick={() => { setOpen(false); setHoverMenu(null); }}
            aria-hidden
          />
          <div
            ref={panelRef}
            className="fixed top-0 right-0 h-screen w-[380px] max-md:w-full bg-[#0f141b] border-l border-[#1f2937] z-[100] shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 h-12 border-b border-[#1f2937] shrink-0">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-[#b8c5d6]" />
                <span className="text-[13px] font-semibold text-white">Notifications</span>
                {unreadCount > 0 && (
                  <span className="text-[10px] tabular-nums text-[#8b95a7]">· {unreadCount} non lu{unreadCount > 1 ? "es" : "e"}</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => { setLocation("/dashboard/parametres#notifications"); setOpen(false); }}
                  className="p-1.5 rounded text-[#8b95a7] hover:bg-white/[0.06] hover:text-white transition-colors"
                  title="Paramètres des notifications"
                >
                  <SettingsIcon className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => { setOpen(false); setHoverMenu(null); }}
                  className="p-1.5 rounded text-[#8b95a7] hover:bg-white/[0.06] hover:text-white transition-colors"
                  aria-label="Fermer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Filter pills */}
            <div className="flex items-center gap-1 px-3 py-2 border-b border-[#1f2937] shrink-0 overflow-x-auto scrollbar-none">
              {FILTER_PILLS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setFilter(p.key)}
                  className={cn(
                    "shrink-0 px-2.5 h-6 rounded-full text-[11px] font-medium transition-colors flex items-center gap-1.5",
                    filter === p.key
                      ? "bg-primary/15 text-primary"
                      : "text-[#8b95a7] hover:bg-white/[0.04] hover:text-[#b8c5d6]"
                  )}
                >
                  {p.label}
                  {p.count > 0 && (
                    <span className={cn(
                      "text-[10px] tabular-nums",
                      filter === p.key ? "text-primary/80" : "text-[#6b7280]"
                    )}>{p.count}</span>
                  )}
                </button>
              ))}
            </div>

            {/* Action bar */}
            {unreadCount > 0 && (
              <div className="px-3 py-1.5 border-b border-[#1f2937] shrink-0">
                <button
                  onClick={handleMarkAllRead}
                  className="text-[11px] text-primary hover:underline"
                >
                  Tout marquer comme lu
                </button>
              </div>
            )}

            {/* Body */}
            <div className="flex-1 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                  <div className="w-12 h-12 rounded-full bg-white/[0.03] flex items-center justify-center mb-3">
                    <Bell className="h-5 w-5 text-[#3a4150]" />
                  </div>
                  <p className="text-[12px] text-[#b8c5d6] font-medium">
                    {filter === "unread" ? "Vous êtes à jour" : "Aucune notification"}
                  </p>
                  <p className="text-[11px] text-[#6b7280] mt-1">
                    {filter === "unread" ? "Toutes les notifications ont été lues." : "Rien à afficher pour ce filtre."}
                  </p>
                </div>
              ) : (
                grouped.map((bucket) => (
                  <div key={bucket.key}>
                    <div className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-[#6b7280]">
                      {bucket.label}
                    </div>
                    {bucket.items.map((n: any) => {
                      const Icon = getIcon(n.type);
                      const displayTitle = stripTagPrefix(n.title);
                      const authorName = n.triggeredByName || "";
                      const initial = (authorName || displayTitle || "?").trim().charAt(0).toUpperCase();
                      const isMenuOpen = hoverMenu === n.id;
                      return (
                        <div
                          key={n.id}
                          className={cn(
                            "group relative flex items-start gap-2.5 px-3 py-2.5 border-b border-[#1f2937]/40 cursor-pointer transition-colors",
                            !n.read ? "bg-primary/[0.04] hover:bg-primary/[0.07]" : "hover:bg-white/[0.03]"
                          )}
                          onClick={() => handleClick(n)}
                        >
                          {/* Point bleu non-lu */}
                          <div className="w-1.5 shrink-0 pt-2">
                            {!n.read && <div className="h-1.5 w-1.5 rounded-full bg-primary" />}
                          </div>

                          {/* Avatar/icône */}
                          <div className="relative shrink-0">
                            {authorName ? (
                              <div className="h-7 w-7 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center">
                                <span className="text-primary text-[11px] font-semibold">{initial}</span>
                              </div>
                            ) : (
                              <div className="h-7 w-7 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
                                <Icon className="h-3.5 w-3.5 text-[#8b95a7]" />
                              </div>
                            )}
                            {authorName && (
                              <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-[#0f141b] border border-[#1f2937] flex items-center justify-center">
                                <Icon className={cn(
                                  "h-2 w-2",
                                  n.type === "connection_disconnected" || n.type === "send_failed" ? "text-red-400" : "text-primary"
                                )} />
                              </div>
                            )}
                          </div>

                          {/* Contenu */}
                          <div className="flex-1 min-w-0 pr-6">
                            <div className="flex items-baseline justify-between gap-2">
                              <p className={cn(
                                "text-[12px] truncate",
                                n.read ? "text-[#b8c5d6] font-normal" : "text-white font-medium",
                                n.type === "connection_disconnected" && "text-red-300"
                              )}>
                                {displayTitle}
                              </p>
                              <span className="text-[10px] text-[#6b7280] shrink-0 tabular-nums">
                                {formatTime(n.createdAt)}
                              </span>
                            </div>
                            {n.message && (
                              <p className={cn(
                                "text-[11px] mt-0.5 line-clamp-2",
                                n.read ? "text-[#6b7280]" : "text-[#8b95a7]"
                              )}>
                                {n.message}
                              </p>
                            )}
                          </div>

                          {/* Hover actions */}
                          <div className={cn(
                            "absolute right-2 top-2 flex items-center gap-0.5 transition-opacity",
                            isMenuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                          )}>
                            <button
                              onClick={(e) => { e.stopPropagation(); setHoverMenu(isMenuOpen ? null : n.id); }}
                              className="p-1 rounded text-[#8b95a7] hover:bg-white/[0.08] hover:text-white transition-colors"
                              title="Plus d'actions"
                            >
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDelete(n); }}
                              className="p-1 rounded text-[#8b95a7] hover:bg-white/[0.08] hover:text-white transition-colors"
                              title="Supprimer"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          {/* Mini menu ⋯ */}
                          {isMenuOpen && (
                            <div
                              ref={menuRef}
                              className="absolute right-2 top-9 z-10 min-w-[180px] bg-[#141c2b] border border-[#1f2937] rounded-lg shadow-xl py-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                onClick={() => handleToggleRead(n)}
                                className="w-full text-left px-3 py-1.5 text-[11px] text-[#b8c5d6] hover:bg-white/[0.04] hover:text-white transition-colors"
                              >
                                {n.read ? "Marquer comme non lue" : "Marquer comme lue"}
                              </button>
                              <button
                                onClick={() => handleDelete(n)}
                                className="w-full text-left px-3 py-1.5 text-[11px] text-[#b8c5d6] hover:bg-white/[0.04] hover:text-white transition-colors"
                              >
                                Supprimer
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-[#1f2937] px-3 py-2 shrink-0">
              <button
                onClick={() => { setLocation("/dashboard/notifications"); setOpen(false); }}
                className="w-full text-center text-[11px] text-[#8b95a7] hover:text-white transition-colors py-1"
              >
                Voir toutes les notifications
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
