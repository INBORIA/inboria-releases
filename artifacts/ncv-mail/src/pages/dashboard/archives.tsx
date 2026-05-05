import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { EmailDetailContainer } from "@/components/email-detail/EmailDetailContainer";
import {
  useListEmails,
  useListCategories,
  useUpdateEmail,
  useDeleteEmail,
  useListProjects,
  getListEmailsQueryKey,
  getGetCategoryCountsQueryKey,
  getGetInboxHealthQueryKey,
  getGetDashboardSummaryQueryKey,
} from "@workspace/api-client-react";
import { format } from "date-fns";
import { fr, enUS, nl, de, es, it, pt, pl, ro, sv, da, fi, hu, cs, tr, ja, ko, vi, th } from "date-fns/locale";
import { useTranslation } from "react-i18next";
import { translateCategoryName } from "@/lib/category-translations";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { Archive, Clock, ArrowLeft, Trash2, RotateCcw, ChevronRight, FolderOpen, Sparkles, CheckSquare, Square, Loader2 } from "lucide-react";
import { useState, useCallback, useEffect, useRef } from "react";
import type { PaginatedEmails, Email } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { BackToInboxButton } from "@/components/dashboard/back-to-inbox-button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const PRIORITY_BAR_COLORS: Record<string, string> = {
  urgent: "bg-red-500",
  moyen: "bg-amber-500",
  faible: "bg-emerald-500",
};

const PRIORITY_BADGE_STYLES: Record<string, { bg: string; text: string; border: string; labelKey: string }> = {
  urgent: { bg: "bg-red-500/15", text: "text-red-400", border: "border-red-500/20", labelKey: "inbox.priorities.urgent" },
  moyen: { bg: "bg-amber-500/15", text: "text-amber-400", border: "border-amber-500/20", labelKey: "inbox.priorities.medium" },
  faible: { bg: "bg-emerald-500/15", text: "text-emerald-400", border: "border-emerald-500/20", labelKey: "inbox.priorities.low" },
};

function PriorityBadge({ priority }: { priority: string }) {
  const { t } = useTranslation();
  const ps = PRIORITY_BADGE_STYLES[priority] || PRIORITY_BADGE_STYLES.faible;
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium border ${ps.bg} ${ps.text} ${ps.border}`}>
      {t(ps.labelKey)}
    </span>
  );
}

const categoryColors = [
  "bg-blue-500/10 text-blue-400 border-blue-500/20",
  "bg-purple-500/10 text-purple-400 border-purple-500/20",
  "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  "bg-amber-500/10 text-amber-400 border-amber-500/20",
  "bg-red-500/10 text-red-400 border-red-500/20",
  "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  "bg-pink-500/10 text-pink-400 border-pink-500/20",
  "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
];


export default function Archives() {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? i18n.language.split("-")[0];
  const dateFnsLocale = ({fr,en:enUS,nl,de,es,it,pt,pl}[(i18n.resolvedLanguage || i18n.language || "fr").substring(0,2)] || fr);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedEmailId, setSelectedEmailId] = useState<number | null>(null);
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

  const listContainerRef = useRef<HTMLDivElement>(null);
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

  const handleContextMenuArchive = useCallback((e: React.MouseEvent, emailId: number) => {
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

  const handleBulkRestore = () => {
    Array.from(selectedIds).forEach((id) => handleRestore(id));
    setSelectedIds(new Set());
  };

  const handleBulkDeleteArchive = () => {
    Array.from(selectedIds).forEach((id) => handleDelete(id));
    setSelectedIds(new Set());
  };

  const [archivePage, setArchivePage] = useState(1);
  const [accumulatedArchived, setAccumulatedArchived] = useState<Email[]>([]);

  const { data: archiveData, isLoading: emailsLoading, isFetching: archiveFetching } = useListEmails({ status: "archived", limit: 50, page: archivePage }, { query: { placeholderData: (prev: any) => prev } as any });
  const { data: categories } = useListCategories();
  const { data: projects } = useListProjects();
  const updateEmail = useUpdateEmail();
  const deleteEmail = useDeleteEmail();

  const paged = archiveData as PaginatedEmails | undefined;
  const archiveHasMore = archivePage < (paged?.totalPages || 0);

  const loadMoreArchives = useCallback(() => {
    if (archiveHasMore && !archiveFetching) {
      setArchivePage((p) => p + 1);
    }
  }, [archiveHasMore, archiveFetching]);

  useEffect(() => {
    if (paged) {
      if (archivePage === 1) {
        setAccumulatedArchived(paged.emails || []);
      } else {
        setAccumulatedArchived((prev) => {
          const existingIds = new Set(prev.map((e) => e.id));
          const unique = (paged.emails || []).filter((e) => !existingIds.has(e.id));
          return [...prev, ...unique];
        });
      }
    }
  }, [paged, archivePage]);

  const archivedEmails = accumulatedArchived;

  const emailsByCategory: Record<string, typeof archivedEmails> = {};
  const uncategorized: typeof archivedEmails = [];

  archivedEmails.forEach((email) => {
    const catName = email.categoryName || null;
    if (catName) {
      if (!emailsByCategory[catName]) emailsByCategory[catName] = [];
      emailsByCategory[catName].push(email);
    } else {
      uncategorized.push(email);
    }
  });

  const invalidateAll = () => {
    setArchivePage(1);
    setAccumulatedArchived([]);
    queryClient.invalidateQueries({ queryKey: getListEmailsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetCategoryCountsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetInboxHealthQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
  };

  const handleRestore = (id: number) => {
    updateEmail.mutate(
      { id, data: { status: "non_lu" } },
      {
        onSuccess: () => {
          setSelectedEmailId(null);
          invalidateAll();
          toast({ title: t("archives.restored") });
        },
      }
    );
  };

  const handleDelete = (id: number) => {
    deleteEmail.mutate(
      { id },
      {
        onSuccess: () => {
          setSelectedEmailId(null);
          invalidateAll();
          toast({ title: t("archives.emailDeleted") });
        },
      }
    );
  };

  if (selectedEmailId) {
    return (
      <DashboardLayout>
        <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-5">
          <div className="mb-3 flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleRestore(selectedEmailId)}
              className="h-8 px-3 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 text-[12px] gap-1.5"
              data-testid="button-restore-from-archive"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {t("archives.restore", "Restaurer dans la boîte")}
            </Button>
          </div>
          <EmailDetailContainer
            emailId={selectedEmailId}
            onBack={() => setSelectedEmailId(null)}
            onAfterArchive={() => setSelectedEmailId(null)}
            onAfterDelete={() => setSelectedEmailId(null)}
            onAfterMutation={invalidateAll}
          />
        </div>
      </DashboardLayout>
    );
  }

  const UNCATEGORIZED_KEY = "__uncategorized__";
  const categoryList = Object.keys(emailsByCategory).sort();
  if (uncategorized.length > 0) categoryList.push(UNCATEGORIZED_KEY);

  const selectedEmails = selectedCategory === UNCATEGORIZED_KEY
    ? uncategorized
    : selectedCategory
      ? emailsByCategory[selectedCategory] || []
      : null;

  if (selectedCategory && selectedEmails) {
    return (
      <DashboardLayout>
        <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center gap-3 mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedCategory(null)}
              className="h-7 px-2 text-[#b8c5d6] hover:text-white hover:bg-white/[0.06] text-[12px]"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              {t("archives.title")}
            </Button>
            <div className="flex-1" />
            <span className="text-[11px] text-[#b8c5d6]">{t("archives.emailCount", { count: selectedEmails.length })}</span>
          </div>

          <h2 className="text-[15px] font-semibold text-white mb-3">
            {selectedCategory === UNCATEGORIZED_KEY ? t("inbox.uncategorized") : translateCategoryName(selectedCategory!, lang)}
          </h2>

          <div className="space-y-1">
            {selectedEmails.length === 0 ? (
              <div className="text-center py-12 rounded-lg border border-border border-dashed bg-card/50">
                <FolderOpen className="mx-auto h-8 w-8 text-[#b8c5d6]/40 mb-2" />
                <p className="text-[12px] text-[#b8c5d6]">{t("inbox.noEmails")}</p>
              </div>
            ) : (
              selectedEmails.map((email) => {
                const barColor = PRIORITY_BAR_COLORS[email.priority] || PRIORITY_BAR_COLORS.faible;
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
                    onContextMenu={(e) => handleContextMenuArchive(e, email.id)}
                  >
                    <div className={`w-1 shrink-0 ${barColor}`} />
                    <div className="flex items-start gap-3 flex-1 min-w-0 p-3">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                        <span className="text-primary font-semibold text-[12px]">{(email.sender || "?")[0].toUpperCase()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-semibold text-[12px] text-white truncate">{email.sender}</span>
                        </div>
                        <h3 className="text-[12px] text-white/80 truncate">{email.subject}</h3>
                        {email.summary && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <Sparkles className="w-3 h-3 text-primary shrink-0" />
                            <p className="text-[11px] text-[#b8c5d6] line-clamp-1">{email.summary}</p>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0 self-center">
                        <PriorityBadge priority={email.priority} />
                        <span className="text-[10px] text-[#b8c5d6] flex items-center gap-1 hidden sm:flex">
                          <Clock className="w-3 h-3" />
                          {format(new Date(email.createdAt), "d MMM HH:mm", { locale: dateFnsLocale })}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRestore(email.id); }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-white/[0.08] text-[#b8c5d6] hover:text-white"
                          title="Restaurer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                        <ChevronRight className="w-3.5 h-3.5 text-[#b8c5d6]/40 group-hover:text-[#b8c5d6] transition-colors" />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          {selectionMode && (
            <div data-selection-bar className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-[#141c2b] border border-[#1f2937] rounded-lg shadow-2xl px-4 py-2 flex items-center gap-3">
              <span className="text-[11px] text-[#b8c5d6]">{t("inbox.selectedCount", { count: selectedIds.size })}</span>
              <button onClick={handleBulkRestore} className="flex items-center gap-1.5 text-[11px] text-primary hover:text-white transition-colors">
                <RotateCcw className="w-3 h-3" />{t("archives.restoreToInbox")}
              </button>
              <button onClick={handleBulkDeleteArchive} className="flex items-center gap-1.5 text-[11px] text-red-400 hover:text-red-300 transition-colors">
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
            style={{ top: Math.min(contextMenu.y, window.innerHeight - 240), left: Math.min(contextMenu.x, window.innerWidth - 220) }}
          >
            <div className="px-3 py-2 border-b border-[#1f2937]">
              <span className="text-[10px] text-[#b8c5d6] uppercase tracking-wider font-medium">
                {selectedIds.size > 1
                  ? t("inbox.selectedCount", { count: selectedIds.size })
                  : selectedEmails?.find(e => e.id === contextMenu.emailId)?.subject?.substring(0, 30) + "..."
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
              <button
                onClick={() => { handleBulkRestore(); setContextMenu(null); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#b8c5d6] hover:bg-white/[0.06] hover:text-white transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {t("archives.restoreToInbox")}
                {selectedIds.size > 1 && ` (${selectedIds.size})`}
              </button>
              <div className="border-t border-[#1f2937] my-1" />
              <button
                onClick={() => { handleBulkDeleteArchive(); setContextMenu(null); }}
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

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-5">
        <BackToInboxButton />
        <div className="mb-5">
          <h1 className="text-[16px] font-semibold text-white tracking-tight">{t("archives.title")}</h1>
          <p className="text-[12px] text-[#b8c5d6] mt-0.5">
            {t("archives.archivedByAI")} {t("archives.emailCount", { count: paged?.total || archivedEmails.length })}
          </p>
        </div>

        {emailsLoading ? (
          <div className="flex flex-col items-center justify-center py-16 rounded-lg border border-border border-dashed bg-card/50">
            <Loader2 className="w-6 h-6 text-primary animate-spin mb-3" />
            <h3 className="text-[13px] font-medium text-white">{t("inbox.loadingTitle", "Chargement…")}</h3>
          </div>
        ) : archivedEmails.length === 0 ? (
          <div className="text-center py-16 rounded-lg border border-border border-dashed bg-card/50">
            <Archive className="mx-auto h-8 w-8 text-[#b8c5d6]/20 mb-2" />
            <h3 className="text-[13px] font-medium text-white mb-1">{t("archives.noEmails")}</h3>
            <p className="text-[12px] text-[#b8c5d6]">{t("archives.noEmailsDesc")}</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {categoryList.map((catName, i) => {
                const count = catName === UNCATEGORIZED_KEY ? uncategorized.length : emailsByCategory[catName]?.length || 0;
                const displayName = catName === UNCATEGORIZED_KEY ? t("inbox.uncategorized") : translateCategoryName(catName, lang);
                return (
                  <div
                    key={catName}
                    className="bg-card rounded-lg border border-border p-4 hover:border-primary/30 transition-colors cursor-pointer group"
                    onClick={() => setSelectedCategory(catName)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${categoryColors[i % categoryColors.length]}`}>
                        <FolderOpen className="w-3.5 h-3.5" />
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-[#b8c5d6] opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <h3 className="text-[13px] font-semibold text-white mb-0.5">{displayName}</h3>
                    <div className="flex items-center text-[11px] text-[#b8c5d6] bg-white/[0.04] px-2 py-0.5 rounded-md inline-flex w-fit">
                      <span className="text-primary font-medium mr-1">{count}</span>
                      {t("classification.emailsLabel")}
                    </div>
                  </div>
                );
              })}
            </div>
            {archiveHasMore && (
              <div className="flex items-center justify-center py-4 mt-3">
                <button
                  onClick={loadMoreArchives}
                  disabled={archiveFetching}
                  className="text-[11px] text-primary hover:text-white transition-colors px-3 py-1.5 rounded-md border border-primary/20 hover:border-primary/40 disabled:opacity-50"
                >
                  {archiveFetching ? t("common.loading") : t("archives.loadMore")}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
