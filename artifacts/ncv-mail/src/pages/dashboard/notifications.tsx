import { DashboardLayout } from "@/components/layout/dashboard-layout";
import {
  useGetNotifications,
  useGetUnreadNotificationCount,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from "@workspace/api-client-react";
import { useTranslation } from "react-i18next";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { AlertCircle, MessageSquare, UserPlus, Bell, Info } from "lucide-react";

type NotifType =
  | "assigned"
  | "commented"
  | "sla_breach"
  | "connection_disconnected"
  | string;

type Notif = {
  id: string;
  type: NotifType;
  title: string;
  message?: string | null;
  emailId?: string | null;
  triggeredBy?: string | null;
  triggeredByName?: string | null;
  read: boolean;
  createdAt: string;
};

type FilterKey = "all" | "unread" | "mentions" | "assignations" | "team" | "system";

function getInitial(notif: Notif): string {
  if (notif.triggeredByName && notif.triggeredByName.trim().length > 0) {
    return notif.triggeredByName.trim().charAt(0).toUpperCase();
  }
  if (notif.type === "sla_breach" || notif.type === "connection_disconnected") {
    return "i";
  }
  return "•";
}

function getIcon(type: NotifType) {
  if (type === "connection_disconnected") return AlertCircle;
  if (type === "sla_breach") return Info;
  if (type === "commented") return MessageSquare;
  if (type === "assigned") return UserPlus;
  return Bell;
}

function matchesFilter(n: Notif, filter: FilterKey): boolean {
  if (filter === "all") return true;
  if (filter === "unread") return !n.read;
  if (filter === "mentions") return n.type === "commented";
  if (filter === "assignations") return n.type === "assigned";
  if (filter === "team") return n.type === "assigned" || n.type === "commented" || n.type === "sla_breach";
  if (filter === "system") return n.type === "connection_disconnected" || n.type === "sla_breach";
  return true;
}

function formatRelative(dateStr: string, t: (k: string, opts?: any) => string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t("notifications.justNow");
  if (mins < 60) return t("notifications.minutesAgo", { count: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t("notifications.hoursAgo", { count: hours });
  const days = Math.floor(hours / 24);
  return t("notifications.daysAgo", { count: days });
}

export default function NotificationsPage() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [filter, setFilter] = useState<FilterKey>("all");

  const { data: notifications, refetch: refetchList } = useGetNotifications(
    { limit: 100 },
    { query: { refetchInterval: 60000 } as any },
  );
  const { data: unreadData, refetch: refetchCount } = useGetUnreadNotificationCount({
    query: { refetchInterval: 30000 } as any,
  });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const list: Notif[] = useMemo(
    () => (Array.isArray(notifications) ? (notifications as Notif[]) : []),
    [notifications],
  );
  const unreadCount = (unreadData as any)?.count || 0;
  const total = list.length;

  const filtered = useMemo(() => list.filter((n) => matchesFilter(n, filter)), [list, filter]);

  const handleClick = (n: Notif) => {
    if (!n.read) {
      markRead.mutate(
        { id: n.id },
        {
          onSuccess: () => {
            refetchCount();
            refetchList();
          },
        },
      );
    }
    if (n.type === "connection_disconnected") {
      setLocation("/dashboard/parametres");
      return;
    }
    if (n.emailId) {
      setLocation(`/dashboard/email/${n.emailId}`);
    }
  };

  const handleMarkAllRead = () => {
    markAllRead.mutate(undefined, {
      onSuccess: () => {
        refetchCount();
        refetchList();
      },
    });
  };

  const chipBase =
    "h-7 px-2.5 inline-flex items-center text-[12px] rounded-full border transition-colors select-none cursor-pointer";
  const chipActive = "bg-white/[0.06] border-white/[0.12] text-white";
  const chipIdle = "bg-transparent border-white/[0.08] text-[#8b95a7] hover:text-white hover:border-white/[0.16]";

  const filters: Array<{ key: FilterKey; label: string }> = [
    { key: "all", label: t("notificationsPage.filters.all", "Tout") },
    { key: "unread", label: t("notificationsPage.filters.unread", "Non lues") },
    { key: "mentions", label: t("notificationsPage.filters.mentions", "Commentaires") },
    { key: "assignations", label: t("notificationsPage.filters.assignations", "Assignations") },
    { key: "team", label: t("notificationsPage.filters.team", "Équipe") },
    { key: "system", label: t("notificationsPage.filters.system", "Système") },
  ];

  return (
    <DashboardLayout>
      <div className="sticky top-0 z-10 bg-background border-b border-border">
        <div className="flex items-center justify-between px-4 h-12">
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="text-[14px] font-semibold text-white truncate">
              {t("notifications.title", "Notifications")}
            </h1>
            <span className="text-[12px] text-[#7a8290] tabular-nums">
              {t("notificationsPage.counter", "{{unread}} non lues · {{total}} au total", {
                unread: unreadCount,
                total,
              })}
            </span>
          </div>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="text-[12px] text-[#7a8290] hover:text-white transition-colors"
            >
              {t("notifications.markAllRead")}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 px-4 h-10 overflow-x-auto">
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(chipBase, filter === f.key ? chipActive : chipIdle)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-6xl">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-[#7a8290]">
            <Bell className="h-6 w-6 mb-3 opacity-50" />
            <p className="text-[13px]">{t("notifications.noNotifications")}</p>
          </div>
        ) : (
          <ul role="list">
            {filtered.map((n) => {
              const Icon = getIcon(n.type);
              const isSystem = n.type === "sla_breach" || n.type === "connection_disconnected";
              const sourceLabel = n.triggeredByName?.trim() || t("notificationsPage.system", "Système");
              return (
                <li
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={cn(
                    "group relative flex items-center gap-3 h-[52px] pl-2 pr-3 cursor-pointer select-none border-l-2 border-b border-border/40 transition-colors",
                    !n.read
                      ? "border-l-primary/60 hover:bg-white/[0.03]"
                      : "border-l-transparent hover:bg-white/[0.03]",
                  )}
                >
                  <div className="w-3 shrink-0" />
                  <div className="h-7 w-7 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
                    {isSystem ? (
                      <Icon className="h-3.5 w-3.5 text-primary" />
                    ) : (
                      <span className="text-primary text-[11px] font-semibold">
                        {getInitial(n)}
                      </span>
                    )}
                  </div>
                  <div className="w-[140px] shrink-0 truncate">
                    <span
                      className={cn(
                        "text-[13px] truncate",
                        !n.read ? "text-white font-semibold" : "text-[#7a8290] font-normal",
                      )}
                    >
                      {sourceLabel}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <span
                      className={cn(
                        "text-[13px] truncate",
                        !n.read ? "text-white" : "text-[#7a8290]",
                      )}
                    >
                      {n.title}
                    </span>
                    {n.message && (
                      <span
                        className={cn(
                          "text-[13px] truncate",
                          !n.read ? "text-[#8b95a7]" : "text-[#5a6270]",
                        )}
                      >
                        — {n.message}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] tabular-nums text-[#8b95a7] w-16 text-right shrink-0">
                    {formatRelative(n.createdAt, t)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </DashboardLayout>
  );
}
