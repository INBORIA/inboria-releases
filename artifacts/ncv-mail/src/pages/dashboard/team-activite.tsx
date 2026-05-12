import { DashboardLayout } from "@/components/layout/dashboard-layout";
import {
  useGetTeamAssignments,
  type TeamAssignmentsResponse,
  type TeamMemberAssignments,
  type TeamAssignedEmail,
} from "@workspace/api-client-react";
import {
  Loader2,
  Users,
  Mail,
  ChevronDown,
  ChevronRight,
  MailPlus,
  ExternalLink,
  Forward,
  Printer,
  Copy,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { BackToInboxButton } from "@/components/dashboard/back-to-inbox-button";
import { useLocation } from "wouter";
import { useState, useMemo, useEffect, useRef } from "react";
import { useEnableLightTheme } from "@/lib/inbox-theme";
import { useToast } from "@/hooks/use-toast";

function formatTime(dateStr: string, t: TFunction): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t("teamActivity.time.justNow");
  if (mins < 60) return t("teamActivity.time.minutesAgo", { count: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t("teamActivity.time.hoursAgo", { count: hours });
  const days = Math.floor(hours / 24);
  return t("teamActivity.time.daysAgo", { count: days });
}

interface MemberSectionProps {
  member: TeamMemberAssignments;
  defaultOpen: boolean;
  onOpenEmail: (id: number) => void;
  onContextMenu: (e: React.MouseEvent, email: TeamAssignedEmail) => void;
}

const PAGE_SIZE = 20;

function MemberSection({ member, defaultOpen, onOpenEmail, onContextMenu }: MemberSectionProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState<boolean>(defaultOpen);
  // Pagination par section : on n'affiche que les 20 premiers e-mails par
  // défaut, puis « Voir plus » charge 20 supplémentaires côté client. Évite
  // de rendre des centaines de lignes dans le DOM pour les grosses files.
  const [visibleCount, setVisibleCount] = useState<number>(PAGE_SIZE);
  const count = member.emails.length;
  const visibleEmails = useMemo(
    () => member.emails.slice(0, visibleCount),
    [member.emails, visibleCount],
  );
  const hasMore = count > visibleCount;
  const displayName = member.isCurrentUser
    ? t("teamActivity.meLabel")
    : member.fullName || t("teamActivity.noName");
  const initials = (displayName || "?").charAt(0).toUpperCase();

  return (
    <div
      className={`bg-[#141c2b] border rounded-lg overflow-hidden ${
        member.isCurrentUser ? "border-primary/40" : "border-[#1f2937]"
      }`}
    >
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
          <p className="text-[12px] font-medium text-white truncate">{displayName}</p>
          <p className="text-[10px] text-[#b8c5d6] truncate">{member.email || ""}</p>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium capitalize shrink-0">
          {member.role}
        </span>
        <span className="text-[11px] text-[#b8c5d6] shrink-0 tabular-nums">
          {t("teamActivity.assignedCount", { count })}
        </span>
        {open ? (
          <ChevronDown className="h-4 w-4 text-[#b8c5d6] shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-[#b8c5d6] shrink-0" />
        )}
      </button>

      {open ? (
        count === 0 ? (
          <div className="px-4 py-6 text-center text-[11px] text-[#b8c5d6] border-t border-[#1f2937]">
            {t("teamActivity.noAssignedForMember")}
          </div>
        ) : (
          <>
          <ul className="border-t border-[#1f2937] divide-y divide-[#1f2937]">
            {visibleEmails.map((e: TeamAssignedEmail) => (
              <li
                key={e.id}
                role="button"
                tabIndex={0}
                title={`${e.sender || ""}${e.senderEmail ? ` <${e.senderEmail}>` : ""}\n${e.subject || ""}${e.createdAt ? `\n${new Date(e.createdAt).toLocaleString()}` : ""}`}
                onClick={() => onOpenEmail(e.id)}
                onContextMenu={(ev) => { ev.preventDefault(); onContextMenu(ev, e); }}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter" || ev.key === " ") {
                    ev.preventDefault();
                    onOpenEmail(e.id);
                  }
                }}
                className="px-4 py-2.5 flex items-center gap-3 hover:bg-[#172033] transition-colors cursor-pointer focus:outline-none focus:bg-[#172033]"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[12px] font-medium text-white truncate">
                      {e.subject || "—"}
                    </p>
                    {e.sharedMailboxId ? (
                      <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 font-medium">
                        <MailPlus className="h-2.5 w-2.5" />
                        {e.sharedMailboxName
                          ? `${t("teamActivity.sharedMailboxBadge")} — ${e.sharedMailboxName}`
                          : t("teamActivity.sharedMailboxBadge")}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-[10px] text-[#b8c5d6] truncate">
                    {e.sender || e.senderEmail || ""}
                  </p>
                </div>
                <span className="text-[10px] text-[#b8c5d6] shrink-0">
                  {formatTime(e.createdAt, t)}
                </span>
                <ExternalLink className="h-3 w-3 text-[#b8c5d6] shrink-0" />
              </li>
            ))}
          </ul>
          {hasMore ? (
            <div className="border-t border-[#1f2937] px-4 py-2 flex items-center justify-between gap-3 bg-[#0f1623]">
              <span className="text-[10px] text-[#b8c5d6] tabular-nums">
                {t("teamActivity.shownOfTotal", {
                  shown: visibleCount,
                  total: count,
                })}
              </span>
              <button
                type="button"
                onClick={() =>
                  setVisibleCount((v) => Math.min(v + PAGE_SIZE, count))
                }
                className="text-[11px] font-medium text-primary hover:text-primary/80 transition-colors"
              >
                {t("teamActivity.showMore")}
              </button>
            </div>
          ) : null}
          </>
        )
      ) : null}
    </div>
  );
}

export default function TeamActivitePage() {
  useEnableLightTheme();
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data, isLoading, isError } = useGetTeamAssignments();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; email: TeamAssignedEmail } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contextMenu) return;
    const onDown = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setContextMenu(null); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onEsc); };
  }, [contextMenu]);

  function handleRowContextMenu(ev: React.MouseEvent, email: TeamAssignedEmail) {
    setContextMenu({ x: ev.clientX, y: ev.clientY, email });
  }

  const members: TeamMemberAssignments[] = useMemo(() => {
    const payload = data as TeamAssignmentsResponse | undefined;
    return payload?.members ?? [];
  }, [data]);
  const totalAssigned = useMemo(
    () => members.reduce((s, m) => s + m.emails.length, 0),
    [members],
  );

  function openEmail(id: number) {
    setLocation(`/dashboard?emailId=${id}&from=${encodeURIComponent("/dashboard/activite-equipe")}`);
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

  if (isError) {
    return (
      <DashboardLayout>
        <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-5 space-y-5">
          <BackToInboxButton />
          <div className="bg-[#141c2b] border border-red-500/30 rounded-lg p-8 text-center text-[12px] text-red-300">
            {t("teamActivity.loadError")}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-5 space-y-5">
        <BackToInboxButton />
        <div>
          <h1 className="text-xl font-bold text-white">{t("inbox.assignedShort", "Assignés")}</h1>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="bg-[#141c2b] border border-[#1f2937] rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-primary" />
              <span className="text-[10px] font-medium text-[#b8c5d6] uppercase tracking-wider">
                {t("sidebar.myTeam")}
              </span>
            </div>
            <p className="text-2xl font-bold text-white tabular-nums">{members.length}</p>
          </div>
          <div className="bg-[#141c2b] border border-[#1f2937] rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Mail className="h-4 w-4 text-blue-400" />
              <span className="text-[10px] font-medium text-[#b8c5d6] uppercase tracking-wider">
                {t("teamActivity.totalAssigned")}
              </span>
            </div>
            <p className="text-2xl font-bold text-white tabular-nums">{totalAssigned}</p>
          </div>
        </div>

        {members.length === 0 ? (
          <div className="bg-[#141c2b] border border-[#1f2937] rounded-lg p-8 text-center text-[12px] text-[#b8c5d6]">
            {t("teamActivity.noTeammates")}
          </div>
        ) : (
          <div className="space-y-3">
            {members.map((m) => {
              const defaultOpen =
                members.length <= 5 ? true : m.isCurrentUser;
              return (
                <MemberSection
                  key={m.userId}
                  member={m}
                  defaultOpen={defaultOpen}
                  onOpenEmail={openEmail}
                  onContextMenu={handleRowContextMenu}
                />
              );
            })}
          </div>
        )}
      </div>
      {contextMenu && (
        <div
          ref={contextMenuRef}
          data-context-menu
          className="fixed z-[9999] min-w-[200px] rounded-lg border border-[#1f2937] bg-[#141c2b] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100"
          style={{ top: Math.min(contextMenu.y, window.innerHeight - 240), left: Math.min(contextMenu.x, window.innerWidth - 220) }}
        >
          <div className="px-3 py-2 border-b border-[#1f2937]">
            <span className="text-[10px] text-[#b8c5d6] uppercase tracking-wider font-medium truncate block">
              {(contextMenu.email.subject || "—").substring(0, 36)}
            </span>
          </div>
          <div className="py-1">
            <button
              onClick={() => { openEmail(contextMenu.email.id); setContextMenu(null); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#b8c5d6] hover:bg-white/[0.06] hover:text-white transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" />
              {t("inbox.openEmail", "Ouvrir")}
            </button>
            <button
              onClick={() => {
                const id = contextMenu.email.id;
                setContextMenu(null);
                openEmail(id);
                setTimeout(() => {
                  window.dispatchEvent(new CustomEvent("inbox-forward-shortcut", { detail: { emailId: id } }));
                }, 250);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#b8c5d6] hover:bg-white/[0.06] hover:text-white transition-colors"
            >
              <Forward className="w-3.5 h-3.5" />
              {t("inbox.forward", "Transférer")}
            </button>
            <button
              onClick={() => {
                const email = contextMenu.email;
                setContextMenu(null);
                const w = window.open("", "_blank", "width=800,height=900");
                if (!w) {
                  toast({ variant: "destructive", title: t("inbox.printPopupBlocked", "Impossible d'ouvrir la fenêtre d'impression") });
                  return;
                }
                const safeBody = ((email as any).body || (email as any).summary || "").toString();
                w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${(email.subject || "").replace(/[<>]/g, "")}</title>
                  <style>body{font-family:-apple-system,Segoe UI,sans-serif;color:#111;padding:24px;line-height:1.5}h1{font-size:18px;margin:0 0 12px}.meta{font-size:12px;color:#555;margin-bottom:18px;border-bottom:1px solid #ddd;padding-bottom:10px}img{max-width:100%}</style>
                  </head><body>
                  <h1>${(email.subject || "(sans sujet)").replace(/[<>]/g, "")}</h1>
                  <div class="meta"><b>${(email.sender || email.senderEmail || "").replace(/[<>]/g, "")}</b><br/>${email.createdAt ? new Date(email.createdAt).toLocaleString() : ""}</div>
                  <div>${safeBody}</div>
                  </body></html>`);
                w.document.close();
                setTimeout(() => { try { w.focus(); w.print(); } catch {} }, 300);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#b8c5d6] hover:bg-white/[0.06] hover:text-white transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              {t("inbox.print", "Imprimer")}
            </button>
            <button
              onClick={async () => {
                const addr = contextMenu.email.senderEmail || contextMenu.email.sender || "";
                setContextMenu(null);
                if (!addr) return;
                try {
                  await navigator.clipboard.writeText(String(addr));
                  toast({ title: t("inbox.copied", "Copié") });
                } catch {}
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#b8c5d6] hover:bg-white/[0.06] hover:text-white transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
              {t("inbox.copyAddress", "Copier l'adresse")}
            </button>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
