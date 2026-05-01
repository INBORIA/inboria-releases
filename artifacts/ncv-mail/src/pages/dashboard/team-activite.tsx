import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useGetTeamAssignments } from "@workspace/api-client-react";
import {
  Loader2,
  Users,
  Mail,
  ChevronDown,
  ChevronRight,
  MailPlus,
  ExternalLink,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { BackToInboxButton } from "@/components/dashboard/back-to-inbox-button";
import { useLocation } from "wouter";
import { useState, useMemo } from "react";

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

function PriorityDot({ priority }: { priority: string }) {
  const color =
    priority === "urgent"
      ? "bg-red-400"
      : priority === "moyen"
        ? "bg-amber-400"
        : "bg-slate-500";
  return <span className={`inline-block h-1.5 w-1.5 rounded-full ${color}`} />;
}

function MemberSection({
  member,
  defaultOpen,
  onOpenEmail,
}: {
  member: any;
  defaultOpen: boolean;
  onOpenEmail: (id: number) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(defaultOpen);
  const count = member.emails?.length || 0;
  const initials = (member.fullName || "?").charAt(0).toUpperCase();

  return (
    <div className="bg-[#141c2b] border border-[#1f2937] rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? t("teamActivity.collapse") : t("teamActivity.expand")}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#172033] transition-colors text-left"
      >
        <div className="h-8 w-8 rounded-full bg-[#1e3a5f] flex items-center justify-center text-[11px] font-semibold text-primary shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-medium text-white truncate">
            {member.fullName || t("teamActivity.noName")}
          </p>
          <p className="text-[10px] text-[#8b9cb3] truncate">{member.email || ""}</p>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium capitalize shrink-0">
          {member.role}
        </span>
        <span className="text-[11px] text-[#8b9cb3] shrink-0 tabular-nums">
          {t("teamActivity.assignedCount", { count })}
        </span>
        {open ? (
          <ChevronDown className="h-4 w-4 text-[#8b9cb3] shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-[#8b9cb3] shrink-0" />
        )}
      </button>

      {open ? (
        count === 0 ? (
          <div className="px-4 py-6 text-center text-[11px] text-[#8b9cb3] border-t border-[#1f2937]">
            {t("teamActivity.noAssignedForMember")}
          </div>
        ) : (
          <ul className="border-t border-[#1f2937] divide-y divide-[#1f2937]">
            {member.emails.map((e: any) => (
              <li
                key={e.id}
                role="button"
                tabIndex={0}
                onClick={() => onOpenEmail(e.id)}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter" || ev.key === " ") {
                    ev.preventDefault();
                    onOpenEmail(e.id);
                  }
                }}
                className="px-4 py-2.5 flex items-center gap-3 hover:bg-[#172033] transition-colors cursor-pointer focus:outline-none focus:bg-[#172033]"
              >
                <PriorityDot priority={e.priority || "faible"} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[12px] font-medium text-white truncate">
                      {e.subject || "—"}
                    </p>
                    {e.sharedMailboxId ? (
                      <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 font-medium">
                        <MailPlus className="h-2.5 w-2.5" />
                        {e.sharedMailboxName || t("teamActivity.sharedMailboxBadge")}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-[10px] text-[#8b9cb3] truncate">
                    {e.sender || e.senderEmail || ""}
                  </p>
                </div>
                <span className="text-[10px] text-[#8b9cb3] shrink-0">
                  {formatTime(e.createdAt, t)}
                </span>
                <ExternalLink className="h-3 w-3 text-[#8b9cb3] shrink-0" />
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}

export default function TeamActivitePage() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { data, isLoading } = useGetTeamAssignments();

  const members = useMemo(() => (data as any)?.members || [], [data]);
  const totalAssigned = useMemo(
    () => members.reduce((s: number, m: any) => s + (m.emails?.length || 0), 0),
    [members],
  );

  function openEmail(id: number) {
    setLocation(`/dashboard?emailId=${id}`);
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

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-5 space-y-5">
        <BackToInboxButton />
        <div>
          <h1 className="text-xl font-bold text-white">{t("teamActivity.title")}</h1>
          <p className="text-[12px] text-[#8b9cb3] mt-1">{t("teamActivity.subtitle")}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="bg-[#141c2b] border border-[#1f2937] rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-primary" />
              <span className="text-[10px] font-medium text-[#8b9cb3] uppercase tracking-wider">
                {t("sidebar.myTeam")}
              </span>
            </div>
            <p className="text-2xl font-bold text-white tabular-nums">{members.length}</p>
          </div>
          <div className="bg-[#141c2b] border border-[#1f2937] rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Mail className="h-4 w-4 text-blue-400" />
              <span className="text-[10px] font-medium text-[#8b9cb3] uppercase tracking-wider">
                {t("teamActivity.totalAssigned")}
              </span>
            </div>
            <p className="text-2xl font-bold text-white tabular-nums">{totalAssigned}</p>
          </div>
        </div>

        {members.length === 0 ? (
          <div className="bg-[#141c2b] border border-[#1f2937] rounded-lg p-8 text-center text-[12px] text-[#8b9cb3]">
            {t("teamActivity.noTeammates")}
          </div>
        ) : (
          <div className="space-y-3">
            {members.map((m: any, idx: number) => (
              <MemberSection
                key={m.userId}
                member={m}
                defaultOpen={idx < 3 && (m.emails?.length || 0) > 0}
                onOpenEmail={openEmail}
              />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
