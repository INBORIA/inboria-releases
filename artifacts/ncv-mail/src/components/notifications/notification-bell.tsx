import { useState, useRef, useEffect } from "react";
import { Bell, AlertCircle, MessageSquare, UserPlus, UserMinus, X, Mail, Clock, CheckSquare, Zap } from "lucide-react";
import { useGetUnreadNotificationCount, useGetNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";

export function NotificationBell() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const [, setLocation] = useLocation();

  const { data: unreadData, refetch: refetchCount } = useGetUnreadNotificationCount({
    query: { refetchInterval: 30000 } as any,
  });
  const { data: notifications, refetch: refetchNotifs } = useGetNotifications(
    { limit: 20 },
    { query: { refetchInterval: 30000, staleTime: 10000, placeholderData: (prev: any) => prev } as any }
  );
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const unreadCount = (unreadData as any)?.count || 0;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleClick = (notif: any) => {
    if (!notif.read) {
      markRead.mutate({ id: notif.id }, {
        onSuccess: () => { refetchCount(); refetchNotifs(); },
      });
    }
    if (notif.type === "connection_disconnected") {
      setLocation("/dashboard/parametres");
      setOpen(false);
      return;
    }
    if (notif.type === "automation_rule_digest") {
      setLocation("/dashboard/parametres/regles");
      setOpen(false);
      return;
    }
    if (notif.type === "task_due" && !notif.emailId) {
      setLocation("/dashboard/taches");
      setOpen(false);
      return;
    }
    if (notif.emailId) {
      setLocation(`/dashboard?emailId=${notif.emailId}`);
      setOpen(false);
    }
  };

  const renderIcon = (type: string) => {
    if (type === "connection_disconnected") {
      return <AlertCircle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />;
    }
    if (type === "commented" || type === "comment_added" || type === "comment_mention") {
      return <MessageSquare className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />;
    }
    if (type === "assigned" || type === "email_assigned") {
      return <UserPlus className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />;
    }
    if (type === "email_unassigned") {
      return <UserMinus className="h-3.5 w-3.5 text-[#8b95a7] shrink-0 mt-0.5" />;
    }
    if (type === "shared_mailbox_new_unassigned") {
      return <Mail className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />;
    }
    if (type === "snooze_expired") {
      return <Clock className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />;
    }
    if (type === "task_due") {
      return <CheckSquare className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />;
    }
    if (type === "automation_rule_digest") {
      return <Zap className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />;
    }
    return null;
  };

  const handleMarkAllRead = () => {
    markAllRead.mutate(undefined, {
      onSuccess: () => { refetchCount(); refetchNotifs(); },
    });
  };

  const formatTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t("notifications.justNow");
    if (mins < 60) return t("notifications.minutesAgo", { count: mins });
    const hours = Math.floor(mins / 60);
    if (hours < 24) return t("notifications.hoursAgo", { count: hours });
    const days = Math.floor(hours / 24);
    return t("notifications.daysAgo", { count: days });
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(!open)}
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
        <div className="absolute right-0 top-full mt-2 w-80 max-md:fixed max-md:inset-x-2 max-md:top-[110px] max-md:right-auto max-md:left-2 max-md:w-auto max-md:max-w-none bg-[#141c2b] border border-[#1f2937] rounded-lg shadow-xl z-[100] max-h-[400px] overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-3 py-2 border-b border-[#1f2937]">
            <span className="text-[12px] font-semibold text-white">{t("notifications.title")}</span>
            <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-[10px] text-primary hover:underline"
              >
                {t("notifications.markAllRead")}
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              className="rounded p-1 text-white/40 hover:bg-white/5 hover:text-white transition"
              aria-label={t("common.close", "Fermer")}
            >
              <X className="h-3.5 w-3.5" />
            </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {!notifications || (notifications as any[]).length === 0 ? (
              <div className="p-6 text-center text-[11px] text-[#b8c5d6]">
                {t("notifications.noNotifications")}
              </div>
            ) : (
              (notifications as any[]).map((n: any) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 border-b border-[#1f2937]/50 hover:bg-white/[0.03] transition-colors",
                    !n.read && "bg-primary/5"
                  )}
                >
                  <div className="flex items-start gap-2">
                    {renderIcon(n.type)}
                    {!n.read && !renderIcon(n.type) && (
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-[11px] font-medium truncate", n.type === "connection_disconnected" ? "text-red-300" : "text-white")}>{n.title}</p>
                      {n.message && (
                        <p className="text-[10px] text-[#b8c5d6] mt-0.5 line-clamp-2">{n.message}</p>
                      )}
                      <p className="text-[9px] text-[#b8c5d6]/70 mt-1">{formatTime(n.createdAt)}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
