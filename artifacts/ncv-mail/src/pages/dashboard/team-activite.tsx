import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useGetTeamDashboard } from "@workspace/api-client-react";
import { Loader2, Users, MessageSquare, Mail, Archive } from "lucide-react";
import { useTranslation } from "react-i18next";

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

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="bg-[#141c2b] border border-[#1f2937] rounded-lg p-4">
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
  const { data, isLoading } = useGetTeamDashboard();

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
      <div className="p-6 max-w-5xl mx-auto space-y-6">
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
          />
          <StatCard
            label={t("teamActivity.assignedEmails")}
            value={members.reduce((s: number, m: any) => s + (m.assignedEmails || 0), 0)}
            icon={<Mail className="h-4 w-4 text-blue-400" />}
          />
          <StatCard
            label={t("teamActivity.archivedEmails")}
            value={members.reduce((s: number, m: any) => s + (m.archivedEmails || 0), 0)}
            icon={<Archive className="h-4 w-4 text-green-400" />}
          />
          <StatCard
            label={t("teamActivity.comments")}
            value={members.reduce((s: number, m: any) => s + (m.commentsCount || 0), 0)}
            icon={<MessageSquare className="h-4 w-4 text-yellow-400" />}
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
                <div key={m.userId} className="px-4 py-3 flex items-center gap-4">
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
    </DashboardLayout>
  );
}
