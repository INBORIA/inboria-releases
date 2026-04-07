import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useGetTeamDashboard } from "@workspace/api-client-react";
import { Loader2, Users, MessageSquare, Mail, Archive } from "lucide-react";

function ActionLabel({ action }: { action: string }) {
  const labels: Record<string, string> = {
    assign_email: "a assigné un email",
    add_comment: "a ajouté un commentaire",
    unassign_email: "a désassigné un email",
    create_shared_mailbox: "a créé une boîte partagée",
    archive_email: "a archivé un email",
  };
  return <span>{labels[action] || action}</span>;
}

function formatTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days}j`;
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
          <h1 className="text-xl font-bold text-white">Tableau de bord équipe</h1>
          <p className="text-[12px] text-[#8b9cb3] mt-1">
            Vue d'ensemble de l'activité de votre équipe
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Membres"
            value={members.length}
            icon={<Users className="h-4 w-4 text-primary" />}
          />
          <StatCard
            label="Emails assignés"
            value={members.reduce((s: number, m: any) => s + (m.assignedEmails || 0), 0)}
            icon={<Mail className="h-4 w-4 text-blue-400" />}
          />
          <StatCard
            label="Emails archivés"
            value={members.reduce((s: number, m: any) => s + (m.archivedEmails || 0), 0)}
            icon={<Archive className="h-4 w-4 text-green-400" />}
          />
          <StatCard
            label="Commentaires"
            value={members.reduce((s: number, m: any) => s + (m.commentsCount || 0), 0)}
            icon={<MessageSquare className="h-4 w-4 text-yellow-400" />}
          />
        </div>

        <div className="bg-[#141c2b] border border-[#1f2937] rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1f2937]">
            <h2 className="text-[13px] font-semibold text-white">Performance par membre</h2>
          </div>
          {members.length === 0 ? (
            <div className="p-8 text-center text-[12px] text-[#8b9cb3]">
              Aucun membre dans votre organisation
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
                      {m.fullName || "Sans nom"}
                    </p>
                    <p className="text-[10px] text-[#8b9cb3]">{m.email || ""}</p>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium capitalize">
                    {m.role}
                  </span>
                  <div className="flex gap-4 text-[10px] text-[#8b9cb3]">
                    <span>{m.assignedEmails} assignés</span>
                    <span>{m.archivedEmails} archivés</span>
                    <span>{m.commentsCount} commentaires</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-[#141c2b] border border-[#1f2937] rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1f2937]">
            <h2 className="text-[13px] font-semibold text-white">Activité récente</h2>
          </div>
          {recentActivity.length === 0 ? (
            <div className="p-8 text-center text-[12px] text-[#8b9cb3]">
              Aucune activité récente
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
                    {formatTime(a.createdAt)}
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
