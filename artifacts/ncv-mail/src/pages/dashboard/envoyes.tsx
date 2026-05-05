import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { EmailBodyRenderer } from "@/components/EmailBodyRenderer";
import { AttachmentList, AttachmentBadge } from "@/components/AttachmentList";
import {
  useListEmails,
  useListProjects,
  useUpdateEmail,
  useDeleteEmail,
  useGetEmailConversation,
  useGetCategoryCounts,
  useGetOrganisationMembers,
  useGetSharedMailboxes,
  useGetProfile,
  useAssignEmail,
  useUnassignEmail,
  useSendEmail,
  useGenerateDraft,
  useCreateTask,
  getListEmailsQueryKey,
  getGetProfileQueryKey,
  getListTasksQueryKey,
} from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { EmailDetail } from "@/components/email-detail/EmailDetail";
import type { UploadedFile } from "@/components/FileAttachInput";
import type { PaginatedEmails } from "@workspace/api-client-react";
import { format } from "date-fns";
import { fr, enUS, nl, de, es, it, pt, pl, ro, sv, da, fi, hu } from "date-fns/locale";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import {
  Send,
  ArrowLeft,
  Sparkles,
  Reply,
  FolderKanban,
  Download,
  Loader2,
  User,
  ArrowRight,
  CalendarDays,
  Trash2,
  ChevronRight,
  CheckSquare,
  Square,
  Check,
  Eye,
} from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { BackToInboxButton } from "@/components/dashboard/back-to-inbox-button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

export default function Envoyes() {
  const { t, i18n } = useTranslation();
  const dateFnsLocale = ({fr,en:enUS,nl,de,es,it,pt,pl}[(i18n.resolvedLanguage || i18n.language || "fr").substring(0,2)] || fr);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedEmailId, setSelectedEmailId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [accumulated, setAccumulated] = useState<any[]>([]);

  const { data: emailsData, isLoading, isFetching } = useListEmails({ status: "sent" as any, limit: 50, page } as any, { query: { placeholderData: (prev: any) => prev } as any });
  const paged = emailsData as PaginatedEmails | undefined;
  const hasMore = paged ? page < (paged.totalPages ?? 1) : false;

  useEffect(() => {
    if (paged) {
      if (page === 1) {
        setAccumulated(paged.emails || []);
      } else {
        setAccumulated((prev) => {
          const ids = new Set(prev.map((e) => e.id));
          return [...prev, ...(paged.emails || []).filter((e) => !ids.has(e.id))];
        });
      }
    }
  }, [paged, page]);

  const loadMore = useCallback(() => {
    if (hasMore && !isFetching) setPage((p) => p + 1);
  }, [hasMore, isFetching]);

  const sentEmails = accumulated;
  const { data: projects } = useListProjects();
  const updateEmail = useUpdateEmail();
  const deleteEmail = useDeleteEmail();

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; emailId: number } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const selectionMode = selectedIds.size > 0;

  useEffect(() => {
    if (!contextMenu) return;
    const handler = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [contextMenu]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedIds(new Set());
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (selectedIds.size === 0) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-email-row]") || target.closest("[data-selection-bar]") || target.closest("[data-context-menu]")) return;
      setSelectedIds(new Set());
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [selectedIds.size > 0]);

  const isDraggingRef = useRef(false);
  const didDragRef = useRef(false);
  const dragStartIdRef = useRef<number | null>(null);
  const dragTrailRef = useRef<number[]>([]);
  const preSelectRef = useRef<Set<number>>(new Set());

  const handleDragSelectStart = useCallback((id: number) => {
    isDraggingRef.current = true;
    didDragRef.current = false;
    dragStartIdRef.current = id;
    dragTrailRef.current = [id];
    setSelectedIds((prev) => { preSelectRef.current = new Set(prev); return prev; });
    const handleMouseUp = () => { isDraggingRef.current = false; dragTrailRef.current = []; document.removeEventListener("mouseup", handleMouseUp); };
    document.addEventListener("mouseup", handleMouseUp);
  }, []);

  const handleDragSelectEnter = useCallback((id: number) => {
    if (!isDraggingRef.current) return;
    if (!didDragRef.current) didDragRef.current = true;
    const trail = dragTrailRef.current;
    const idx = trail.indexOf(id);
    if (idx !== -1) {
      if (idx === 0) {
        trail.length = 0;
      } else {
        trail.splice(idx + 1);
      }
    } else {
      trail.push(id);
    }
    const keep = new Set(preSelectRef.current);
    trail.forEach((tid) => keep.add(tid));
    setSelectedIds(keep);
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent, emailId: number) => {
    e.preventDefault();
    setSelectedIds((prev) => {
      if (prev.size > 0 && !prev.has(emailId)) {
        return new Set(prev).add(emailId);
      } else if (prev.size === 0) {
        return new Set([emailId]);
      }
      return prev;
    });
    setContextMenu({ x: e.clientX, y: e.clientY, emailId });
  }, []);

  const handleBulkDelete = () => {
    const ids = Array.from(selectedIds);
    ids.forEach((id) => {
      deleteEmail.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListEmailsQueryKey() });
        },
      });
    });
    setSelectedIds(new Set());
    toast({ title: t("inbox.deleteEmail") });
  };

  const handleUpdateProject = (id: number, projectId: string) => {
    updateEmail.mutate(
      { id, data: { projectId: projectId === "none" ? null : projectId } as any },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListEmailsQueryKey() });
          toast({ title: t("sent.projectUpdated") });
        },
      }
    );
  };

  const handleExport = async () => {
    try {
      const { downloadExport } = await import("@/lib/export-utils");
      await downloadExport("export/emails?status=sent", `emails_envoyes_${new Date().toISOString().split("T")[0]}.csv`);
      toast({ title: t("sent.exportDownloaded") });
    } catch {
      toast({ title: t("sent.exportError"), variant: "destructive" });
    }
  };

  if (selectedEmailId) {
    return (
      <DashboardLayout>
        <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-5">
          <SentEmailDetailView
            emailId={selectedEmailId}
            onBack={() => setSelectedEmailId(null)}
            projects={projects || []}
          />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-5">
        <BackToInboxButton />
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-[16px] font-semibold text-white tracking-tight flex items-center gap-2">
              <Send className="w-4 h-4 text-primary" />
              {t("sent.title")}
            </h1>
            <p className="text-[12px] text-[#b8c5d6] mt-0.5">
              {t("sent.emailsSentCount", { count: paged?.total || sentEmails.length })}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            className="gap-1 text-[11px] h-7 bg-transparent border-border text-[#b8c5d6] hover:text-white"
          >
            <Download className="w-3 h-3" />
            {t("sent.exportCSV")}
          </Button>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 rounded-lg border border-border border-dashed bg-card/50">
            <Loader2 className="w-6 h-6 text-primary animate-spin mb-3" />
            <h3 className="text-[13px] font-medium text-white">{t("inbox.loadingTitle", "Chargement de vos emails…")}</h3>
          </div>
        ) : sentEmails.length === 0 ? (
          <div className="text-center py-16 rounded-lg border border-border border-dashed bg-card/50">
            <Send className="mx-auto h-8 w-8 text-[#b8c5d6]/20 mb-2" />
            <h3 className="text-[13px] font-medium text-white mb-1">{t("sent.noEmails")}</h3>
            <p className="text-[12px] text-[#b8c5d6]">{t("sent.noEmailsDesc")}</p>
          </div>
        ) : (
          <>
            <div className="space-y-1">
              {sentEmails.map((email) => {
                const isReply = !!email.replyToEmailId;
                const isSelected = selectedIds.has(email.id);
                return (
                  <div
                    key={email.id}
                    data-email-row
                    className={`group flex items-stretch rounded-lg border transition-colors cursor-pointer overflow-hidden select-none ${isSelected ? "border-primary/50 bg-primary/[0.08]" : "border-border bg-card hover:bg-[#1a2235]"}`}
                    onClick={() => {
                      if (didDragRef.current) return;
                      if (selectionMode) {
                        setSelectedIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(email.id)) next.delete(email.id); else next.add(email.id);
                          return next;
                        });
                      } else {
                        setSelectedEmailId(email.id);
                      }
                    }}
                    onMouseDown={(e) => { if (e.button === 0) { e.preventDefault(); handleDragSelectStart(email.id); } }}
                    onMouseEnter={() => handleDragSelectEnter(email.id)}
                    onContextMenu={(e) => handleContextMenu(e, email.id)}
                  >
                    <div className="w-1 shrink-0 bg-primary" />
                    <div className="flex items-center gap-2 flex-1 min-w-0 p-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedIds((prev) => { const next = new Set(prev); if (next.has(email.id)) next.delete(email.id); else next.add(email.id); return next; }); }}
                        onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); handleDragSelectStart(email.id); }}
                        onMouseEnter={() => handleDragSelectEnter(email.id)}
                        className="w-5 h-5 rounded flex items-center justify-center shrink-0 transition-all cursor-pointer border border-[#2a3441] hover:border-primary select-none"
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 text-primary" />}
                      </button>
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                        {isReply ? <Reply className="w-3.5 h-3.5 text-primary" /> : <Send className="w-3.5 h-3.5 text-primary" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-semibold text-[12px] text-white truncate flex items-center gap-1">
                            <ArrowRight className="w-3 h-3 text-primary" />
                            {email.recipient || t("sent.unknownRecipient")}
                          </span>
                          {isReply && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-primary/15 text-primary">
                              {t("sent.reply")}
                            </span>
                          )}
                        </div>
                        <h3 className="text-[12px] text-white/80 truncate">{email.subject}</h3>
                        {email.summary && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <Sparkles className="w-3 h-3 text-primary shrink-0" />
                            <p className="text-[11px] text-[#b8c5d6] line-clamp-1">{email.summary}</p>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {email.projectName && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/[0.06] text-[#b8c5d6]">
                            {email.projectReference || email.projectName}
                          </span>
                        )}
                        {(email as any).attachmentCount > 0 && (
                          <AttachmentBadge count={(email as any).attachmentCount} />
                        )}
                        {(() => {
                          const oc = (email as any).openedCount as number | undefined;
                          const oa = (email as any).openedAt as string | undefined;
                          if (typeof oc !== "number" || oc <= 0) return null;
                          return (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px]"
                              data-testid={`badge-opened-row-${email.id}`}
                              title={oa ? (t("wave1.openedAtLabel", { date: format(new Date(oa), "PPp", { locale: dateFnsLocale }) }) as string) : undefined}
                            >
                              <Eye className="w-2.5 h-2.5" />
                              {t("wave1.openedBadgeCount", { count: oc })}
                            </span>
                          );
                        })()}
                        <span className="text-[10px] text-[#b8c5d6]">
                          {email.createdAt ? format(new Date(email.createdAt), "dd MMM HH:mm", { locale: dateFnsLocale }) : ""}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {hasMore && (
              <div className="flex items-center justify-center py-4 mt-3">
                <button
                  onClick={loadMore}
                  disabled={isFetching}
                  className="text-[11px] text-primary hover:text-white transition-colors px-3 py-1.5 rounded-md border border-primary/20 hover:border-primary/40 disabled:opacity-50"
                >
                  {isFetching ? t("common.loading") : t("sent.loadMore")}
                </button>
              </div>
            )}
          </>
        )}
        {selectionMode && (
          <div data-selection-bar className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-[#141c2b] border border-[#1f2937] rounded-lg shadow-2xl px-4 py-2 flex items-center gap-3">
            <span className="text-[11px] text-[#b8c5d6]">{t("inbox.selectedCount", { count: selectedIds.size })}</span>
            <button onClick={handleBulkDelete} className="flex items-center gap-1.5 text-[11px] text-red-400 hover:text-red-300 transition-colors">
              <Trash2 className="w-3 h-3" />{t("inbox.deleteEmail")}
            </button>
            <button onClick={() => setSelectedIds(new Set())} className="text-[11px] text-[#b8c5d6] hover:text-white transition-colors ml-2">{t("common.cancel")}</button>
          </div>
        )}
      </div>
      {contextMenu && (
        <div
          ref={contextMenuRef}
          data-context-menu
          className="fixed z-[9999] min-w-[200px] rounded-lg border border-[#1f2937] bg-[#141c2b] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100"
          style={{ top: Math.min(contextMenu.y, window.innerHeight - 200), left: Math.min(contextMenu.x, window.innerWidth - 220) }}
        >
          <div className="px-3 py-2 border-b border-[#1f2937]">
            <span className="text-[10px] text-[#b8c5d6] uppercase tracking-wider font-medium">
              {selectedIds.size > 1
                ? t("inbox.selectedCount", { count: selectedIds.size })
                : sentEmails.find(e => e.id === contextMenu.emailId)?.subject?.substring(0, 30) + "..."
              }
            </span>
          </div>
          <div className="py-1">
            {selectedIds.size <= 1 && (
              <button
                onClick={() => { setSelectedEmailId(contextMenu.emailId); setContextMenu(null); setSelectedIds(new Set()); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#b8c5d6] hover:bg-white/[0.06] hover:text-white transition-colors"
              >
                <ChevronRight className="w-3.5 h-3.5" />
                {t("inbox.openEmail")}
              </button>
            )}
            <div className="border-t border-[#1f2937] my-1" />
            <button
              onClick={() => { handleBulkDelete(); setContextMenu(null); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-red-400/80 hover:bg-red-500/[0.08] hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {t("inbox.deleteEmail")}
              {selectedIds.size > 1 && ` (${selectedIds.size})`}
            </button>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

// Vue détail Envoyés alignée sur la Réception : utilise EmailDetail pour
// garantir une expérience identique (en-tête, actions, dropdowns, fil de
// conversation, notes internes, panneaux CRM).
function SentEmailDetailView({
  emailId,
  onBack,
  projects,
}: {
  emailId: number;
  onBack: () => void;
  projects: any[];
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: convoData, isLoading } = useGetEmailConversation(emailId);
  const email = (convoData as any)?.email;

  const { data: profile } = useGetProfile();
  const { data: categoryCounts } = useGetCategoryCounts({ scope: "personal" as const });
  const { data: orgMembers } = useGetOrganisationMembers();
  const { data: sharedMailboxes } = useGetSharedMailboxes();
  const { data: composeConnections } = useQuery<Array<{ id: string; provider: string; email_address: string; signature?: string | null }>>({
    queryKey: ["email-connections-compose"],
    queryFn: async () => {
      const { supabase } = await import("@/lib/supabase");
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const res = await fetch(`${import.meta.env.BASE_URL}api/email/connections`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const updateEmail = useUpdateEmail();
  const deleteEmail = useDeleteEmail();
  const assignEmailMut = useAssignEmail();
  const unassignEmailMut = useUnassignEmail();
  const sendEmailMut = useSendEmail();
  const generateDraftMut = useGenerateDraft();
  const createTaskMut = useCreateTask();

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getListEmailsQueryKey() });
  };

  const handleMarkRead = (id: number) => {
    updateEmail.mutate({ id, data: { status: "read" } }, { onSuccess: invalidateAll });
  };
  const handleArchive = (id: number) => {
    updateEmail.mutate({ id, data: { status: "archived" } }, {
      onSuccess: () => { invalidateAll(); onBack(); toast({ title: t("inbox.emailArchived") }); },
    });
  };
  const handleDelete = (id: number) => {
    deleteEmail.mutate({ id }, {
      onSuccess: () => { invalidateAll(); onBack(); toast({ title: t("inbox.emailDeleted") }); },
    });
  };
  const handleUpdatePriority = (id: number, priority: string) => {
    updateEmail.mutate({ id, data: { priority } as any }, {
      onSuccess: () => { invalidateAll(); toast({ title: t("inbox.priorityChanged") }); },
    });
  };
  const handleUpdateCategory = (id: number, categoryId: string) => {
    updateEmail.mutate({ id, data: { categoryId: categoryId === "none" ? null : parseInt(categoryId) } }, {
      onSuccess: () => { invalidateAll(); toast({ title: t("inbox.categoryUpdated") }); },
    });
  };
  const handleUpdateProject = (id: number, projectId: string) => {
    updateEmail.mutate({ id, data: { projectId: projectId === "none" ? null : projectId } as any }, {
      onSuccess: () => { invalidateAll(); toast({ title: t("inbox.projectUpdated") }); },
    });
  };
  const handleAssign = (eId: number, userId: string) => {
    assignEmailMut.mutate({ emailId: eId, data: { assignTo: userId } }, {
      onSuccess: (r: any) => { invalidateAll(); toast({ title: t("inbox.assignSuccess"), description: r?.assignedToName || "" }); },
      onError: () => toast({ variant: "destructive", title: t("common.error") }),
    });
  };
  const handleUnassign = (eId: number) => {
    unassignEmailMut.mutate({ emailId: eId }, {
      onSuccess: () => { invalidateAll(); toast({ title: t("inbox.unassignSuccess") }); },
      onError: () => toast({ variant: "destructive", title: t("common.error") }),
    });
  };
  const handleCreateTask = async (eId: number, title: string, projectId?: string, assigneeUserIds?: string[]) => {
    const assignees = assigneeUserIds && assigneeUserIds.length > 0 ? assigneeUserIds : [null];
    try {
      for (const a of assignees) {
        await createTaskMut.mutateAsync({
          data: { title, emailId: eId, projectId: projectId || undefined, ...(a ? { assignedToUserId: a } : {}) } as any,
        });
      }
      if (projectId) {
        updateEmail.mutate({ id: eId, data: { projectId } }, { onSuccess: invalidateAll });
      } else {
        invalidateAll();
      }
      queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
      toast({ title: t("inbox.taskCreated") });
    } catch {
      toast({ variant: "destructive", title: t("common.error"), description: t("inbox.taskCreateError") });
    }
  };
  const handleSendReply = (to: string, subject: string, body: string, replyToEmailId?: number, attachments?: UploadedFile[], connectionId?: string, projectId?: string, markHandledOfEmailId?: number) => {
    const uploadIds = attachments?.map((a) => a.uploadId).filter(Boolean);
    const data: any = {
      to, subject, body,
      replyToEmailId: replyToEmailId ?? null,
      attachments: uploadIds && uploadIds.length > 0 ? uploadIds : undefined,
    };
    if (connectionId) data.connectionId = connectionId;
    if (projectId) data.projectId = projectId;
    if (markHandledOfEmailId) data.markHandledOfEmailId = markHandledOfEmailId;
    sendEmailMut.mutate({ data }, {
      onSuccess: () => { invalidateAll(); toast({ title: t("inbox.emailSent") }); },
      onError: (err: any) => toast({ variant: "destructive", title: t("common.error"), description: err?.data?.error || err?.message || t("inbox.sendError") }),
    });
  };
  const handleGenerateDraft = (eId: number, callback: (draft: string) => void) => {
    generateDraftMut.mutate({ data: { emailId: eId } }, {
      onSuccess: (data: any) => {
        callback(data.draft);
        queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
        toast({ title: t("inbox.draftGenerated") });
      },
      onError: () => toast({ title: t("inbox.draftError") }),
    });
  };

  if (isLoading || !email) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <EmailDetail
      email={email}
      onBack={onBack}
      onMarkRead={handleMarkRead}
      onArchive={handleArchive}
      onDelete={handleDelete}
      onUpdatePriority={handleUpdatePriority}
      onUpdateCategory={handleUpdateCategory}
      onUpdateProject={handleUpdateProject}
      onSendReply={handleSendReply}
      isSending={sendEmailMut.isPending}
      onGenerateDraft={handleGenerateDraft}
      isDrafting={generateDraftMut.isPending}
      categories={categoryCounts || []}
      projects={projects || []}
      currentUserId={(profile as any)?.id}
      orgMembers={(orgMembers as any[]) || []}
      onAssign={handleAssign}
      onUnassign={handleUnassign}
      onCreateTask={handleCreateTask}
      connections={composeConnections}
      sharedMailboxes={sharedMailboxes as any[]}
    />
  );
}
