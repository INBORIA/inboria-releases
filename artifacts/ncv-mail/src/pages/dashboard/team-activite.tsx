import { DashboardLayout } from "@/components/layout/dashboard-layout";
import {
  useGetTeamDashboard,
  useGetTeamRecentComments,
  useDeleteEmailComment,
  getGetTeamRecentCommentsQueryKey,
  getGetTeamDashboardQueryKey,
} from "@workspace/api-client-react";
import { Loader2, Users, MessageSquare, Mail, Archive, ExternalLink, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { BackToInboxButton } from "@/components/dashboard/back-to-inbox-button";
import { useLocation } from "wouter";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

function ActionLabel({ action }: { action: string }) {
  const { t } = useTranslation();
  const labels: Record<string, string> = {
    assign_email: t("teamActivity.actions.assign_email"),
    add_comment: t("teamActivity.actions.add_comment"),
    unassign_email: t("teamActivity.actions.unassign_email"),
    create_shared_mailbox: t("teamActivity.actions.create_shared_mailbox"),
    archive_email: t("teamActivity.actions.archive_email"),
  };
  return <span>{labels[action] || action}</span>;
}

function formatTime(dateStr: string, t: (key: string, opts?: any) => string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t("teamActivity.time.justNow");
  if (mins < 60) return t("teamActivity.time.minutesAgo", { count: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t("teamActivity.time.hoursAgo", { count: hours });
  const days = Math.floor(hours / 24);
  return t("teamActivity.time.daysAgo", { count: days });
}

function StatCard({ label, value, icon, onClick }: { label: string; value: number; icon: React.ReactNode; onClick?: () => void }) {
  const interactive = !!onClick;
  const baseClasses = "bg-[#141c2b] border border-[#1f2937] rounded-lg p-4 transition-colors text-left w-full";
  const interactiveClasses = interactive
    ? " hover:border-primary/40 hover:bg-[#172033] cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40"
    : "";
  if (interactive) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick?.();
          }
        }}
        className={baseClasses + interactiveClasses}
      >
        <div className="flex items-center gap-2 mb-2">
          {icon}
          <span className="text-[10px] font-medium text-[#8b9cb3] uppercase tracking-wider">{label}</span>
        </div>
        <p className="text-2xl font-bold text-white">{value}</p>
      </div>
    );
  }
  return (
    <div className={baseClasses}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-[10px] font-medium text-[#8b9cb3] uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

export default function TeamActivitePage() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { data, isLoading } = useGetTeamDashboard();
  const [commentsOpen, setCommentsOpen] = useState(false);
  const { data: recentComments, isLoading: commentsLoading } = useGetTeamRecentComments(
    { limit: 50 },
    { query: { enabled: commentsOpen } as any }
  );
  const { user } = useAuth();
  const currentUserId = user?.id;
  const queryClient = useQueryClient();
  const deleteComment = useDeleteEmailComment();
  const { toast } = useToast();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDeleteComment(commentId: string, emailId: number) {
    if (!window.confirm(t("teamActivity.commentsModalDeleteConfirm"))) return;
    setDeletingId(commentId);
    try {
      await deleteComment.mutateAsync({ emailId, commentId });
      await queryClient.invalidateQueries({ queryKey: getGetTeamRecentCommentsQueryKey({ limit: 50 }) });
      await queryClient.invalidateQueries({ queryKey: getGetTeamDashboardQueryKey() });
    } catch (e: any) {
      toast({
        title: e?.response?.data?.error || t("common.error"),
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const dashboard = data as any;
  const members = dashboard?.members || [];
  const recentActivity = dashboard?.recentActivity || [];

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-5 space-y-6">
        <BackToInboxButton />
        <div>
          <h1 className="text-xl font-bold text-white">{t("teamActivity.title")}</h1>
          <p className="text-[12px] text-[#8b9cb3] mt-1">
            {t("teamActivity.subtitle")}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label={t("teamActivity.members")}
            value={members.length}
            icon={<Users className="h-4 w-4 text-primary" />}
            onClick={() => setLocation("/dashboard/equipe")}
          />
          <StatCard
            label={t("teamActivity.assignedEmails")}
            value={members.reduce((s: number, m: any) => s + (m.assignedEmails || 0), 0)}
            icon={<Mail className="h-4 w-4 text-blue-400" />}
            onClick={() => setLocation("/dashboard?assignee=any")}
          />
          <StatCard
            label={t("teamActivity.archivedEmails")}
            value={members.reduce((s: number, m: any) => s + (m.archivedEmails || 0), 0)}
            icon={<Archive className="h-4 w-4 text-green-400" />}
            onClick={() => setLocation("/dashboard/archives")}
          />
          <StatCard
            label={t("teamActivity.comments")}
            value={members.reduce((s: number, m: any) => s + (m.commentsCount || 0), 0)}
            icon={<MessageSquare className="h-4 w-4 text-yellow-400" />}
            onClick={() => setCommentsOpen(true)}
          />
        </div>

        <div className="bg-[#141c2b] border border-[#1f2937] rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1f2937]">
            <h2 className="text-[13px] font-semibold text-white">{t("teamActivity.performance")}</h2>
          </div>
          {members.length === 0 ? (
            <div className="p-8 text-center text-[12px] text-[#8b9cb3]">
              {t("teamActivity.noMembers")}
            </div>
          ) : (
            <div className="divide-y divide-[#1f2937]">
              {members.map((m: any) => (
                <div
                  key={m.userId}
                  role="button"
                  tabIndex={0}
                  onClick={() => setLocation(`/dashboard?assignee=${encodeURIComponent(m.userId)}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setLocation(`/dashboard?assignee=${encodeURIComponent(m.userId)}`);
                    }
                  }}
                  className="w-full text-left px-4 py-3 flex items-center gap-4 hover:bg-[#172033] transition-colors focus:outline-none focus:bg-[#172033] cursor-pointer"
                >
                  <div className="h-8 w-8 rounded-full bg-[#1e3a5f] flex items-center justify-center text-[11px] font-semibold text-primary shrink-0">
                    {(m.fullName || "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium text-white truncate">
                      {m.fullName || t("teamActivity.noName")}
                    </p>
                    <p className="text-[10px] text-[#8b9cb3]">{m.email || ""}</p>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium capitalize">
                    {m.role}
                  </span>
                  <div className="flex gap-4 text-[10px] text-[#8b9cb3]">
                    <span>{m.assignedEmails} {t("teamActivity.assigned")}</span>
                    <span>{m.archivedEmails} {t("teamActivity.archived")}</span>
                    <span>{m.commentsCount} {t("teamActivity.comments").toLowerCase()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-[#141c2b] border border-[#1f2937] rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1f2937]">
            <h2 className="text-[13px] font-semibold text-white">{t("teamActivity.recentActivity")}</h2>
          </div>
          {recentActivity.length === 0 ? (
            <div className="p-8 text-center text-[12px] text-[#8b9cb3]">
              {t("teamActivity.noActivity")}
            </div>
          ) : (
            <div className="divide-y divide-[#1f2937]">
              {recentActivity.map((a: any) => (
                <div key={a.id} className="px-4 py-2.5 flex items-center gap-3">
                  <div className="h-6 w-6 rounded-full bg-[#1e3a5f] flex items-center justify-center text-[9px] font-semibold text-primary shrink-0">
                    {(a.userName || "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-white">
                      <span className="font-medium">{a.userName}</span>{" "}
                      <ActionLabel action={a.action} />
                    </p>
                  </div>
                  <span className="text-[9px] text-[#8b9cb3] shrink-0">
                    {formatTime(a.createdAt, t)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog open={commentsOpen} onOpenChange={setCommentsOpen}>
        <DialogContent className="bg-[#0d1422] border-[#1f2937] text-white sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle className="text-white">{t("teamActivity.commentsModalTitle")}</DialogTitle>
            <DialogDescription className="text-[#8b9cb3]">
              {t("teamActivity.commentsModalSubtitle")}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto -mx-2 px-2">
            {commentsLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : !recentComments || recentComments.length === 0 ? (
              <p className="text-[12px] text-[#8b9cb3] text-center py-10">
                {t("teamActivity.commentsModalEmpty")}
              </p>
            ) : (
              <ul className="space-y-3">
                {recentComments.map((c: any) => (
                  <li
                    key={c.id}
                    className="bg-[#141c2b] border border-[#1f2937] rounded-lg p-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="h-6 w-6 rounded-full bg-[#1e3a5f] flex items-center justify-center text-[9px] font-semibold text-primary shrink-0 mt-0.5">
                        {(c.userName || "?").charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[12px] font-medium text-white">
                            {c.userName || t("teamActivity.noName")}
                          </span>
                          <span className="text-[10px] text-[#8b9cb3]">
                            {formatTime(c.createdAt, t)}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#8b9cb3] mt-0.5 truncate">
                          {t("teamActivity.commentsModalOn")}{" "}
                          <span className="text-[#cbd5e1]">"{c.emailSubject || "—"}"</span>
                        </p>
                        <p className="text-[12px] text-[#e2e8f0] mt-2 whitespace-pre-wrap break-words line-clamp-3">
                          {c.body}
                        </p>
                        <div className="mt-2 flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-[11px] text-primary hover:text-primary hover:bg-primary/10"
                            onClick={() => {
                              setCommentsOpen(false);
                              setLocation(`/dashboard?emailId=${c.emailId}`);
                            }}
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            {t("teamActivity.commentsModalOpenEmail")}
                          </Button>
                          {currentUserId && c.userId === currentUserId ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={deletingId === c.id}
                              className="h-7 px-2 text-[11px] text-red-400 hover:text-red-300 hover:bg-red-500/10"
                              onClick={() => handleDeleteComment(c.id, c.emailId)}
                            >
                              {deletingId === c.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <>
                                  <Trash2 className="h-3 w-3 mr-1" />
                                  {t("teamActivity.commentsModalDelete")}
                                </>
                              )}
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
