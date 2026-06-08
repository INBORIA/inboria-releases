import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { MailPageHeader } from "@/components/email-list/MailPageHeader";
import { DragOutAvatar } from "@/components/email-list/DragOutAvatar";
import { MailReadingPane } from "@/components/email-list/MailReadingPane";
import { useReadingPaneEnabled } from "@/lib/use-reading-pane";
import { EmailDetailContainer } from "@/components/email-detail/EmailDetailContainer";
import { HoverActions, type HoverActionsCb } from "@/components/email-list/HoverActions";
import { useEnableLightTheme } from "@/lib/inbox-theme";
import { removeEmailOptimistic, patchEmailOptimistic } from "@/lib/optimistic-email";
import {
  useListEmails,
  useListCategories,
  useUpdateEmail,
  useDeleteEmail,
  useListProjects,
  useGetCategoryCounts,
  useListFolders,
  useAssignEmailsToFolder,
  useCreateTask,
  useSnoozeEmail,
  getListEmailsQueryKey,
  getGetCategoryCountsQueryKey,
  getGetInboxHealthQueryKey,
  getGetDashboardSummaryQueryKey,
  getListFoldersQueryKey,
  getListTasksQueryKey,
} from "@workspace/api-client-react";
import { format } from "date-fns";
import { fr, enUS, nl, de, es, it, pt, pl } from "date-fns/locale";
import { useTranslation } from "react-i18next";
import { translateCategoryName } from "@/lib/category-translations";
import { useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  ArrowLeft,
  Trash2,
  RotateCcw,
  ChevronRight,
  FolderOpen,
  Loader2,
  Paperclip,
  Check,
  Reply,
  Forward,
  ListTodo,
  Mail,
  MailOpen,
  Clock,
  Bell,
  CalendarDays,
  Folder,
  Copy,
  Type as TypeIcon,
  Download,
  Printer,
  ShieldAlert,
} from "lucide-react";
import { useState, useCallback, useEffect, useRef, useLayoutEffect } from "react";
import type { PaginatedEmails, Email } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { BackToInboxButton } from "@/components/dashboard/back-to-inbox-button";
import { useToast } from "@/hooks/use-toast";
import { VirtualizedMailList } from "@/components/email-list/VirtualizedMailList";
import { extractEmailAddress } from "@/lib/utils";

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
  useEnableLightTheme();
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? i18n.language.split("-")[0];
  const dateFnsLocale = ({ fr, en: enUS, nl, de, es, it, pt, pl }[(i18n.resolvedLanguage || i18n.language || "fr").substring(0, 2)] || fr);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedEmailId, setSelectedEmailId] = useState<number | null>(null);
  const [readingPaneEnabled] = useReadingPaneEnabled();
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; emailId: number } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const selectionMode = selectedIds.size > 0;

  // Auto-flip context menu — parité Réception/Envoyés.
  const [ctxMenuPos, setCtxMenuPos] = useState<{ top: number; left: number; ready: boolean }>({ top: 0, left: 0, ready: false });
  useLayoutEffect(() => {
    if (!contextMenu) { setCtxMenuPos({ top: 0, left: 0, ready: false }); return; }
    const el = contextMenuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const margin = 8;
    let top = contextMenu.y;
    let left = contextMenu.x;
    if (top + rect.height > window.innerHeight - margin) top = Math.max(margin, contextMenu.y - rect.height);
    if (top < margin) top = margin;
    if (left + rect.width > window.innerWidth - margin) left = Math.max(margin, contextMenu.x - rect.width);
    if (left < margin) left = margin;
    setCtxMenuPos({ top, left, ready: true });
  }, [contextMenu]);

  useEffect(() => {
    if (!contextMenu) return;
    const handler = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) setContextMenu(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [contextMenu]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") setSelectedIds(new Set()); };
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
      if (idx === 0) trail.length = 0;
      else trail.splice(idx + 1);
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
      if (prev.size > 0 && !prev.has(emailId)) return new Set(prev).add(emailId);
      if (prev.size === 0) return new Set([emailId]);
      return prev;
    });
    setContextMenu({ x: e.clientX, y: e.clientY, emailId });
  }, []);

  const [archivePage, setArchivePage] = useState(1);
  const [accumulatedArchived, setAccumulatedArchived] = useState<Email[]>([]);

  const { data: archiveData, isLoading: emailsLoading, isFetching: archiveFetching } = useListEmails(
    { status: "archived", limit: 50, page: archivePage },
    { query: { placeholderData: (prev: any) => prev } as any },
  );
  const { data: categories } = useListCategories();
  const { data: projects } = useListProjects();
  const { data: categoryCounts } = useGetCategoryCounts({ scope: "personal" } as any);
  const { data: userFolders } = useListFolders();
  const assignToFolderMut = useAssignEmailsToFolder();
  const updateEmail = useUpdateEmail();
  const deleteEmail = useDeleteEmail();
  const createTaskMut = useCreateTask();
  const snoozeMut = useSnoozeEmail();

  const paged = archiveData as PaginatedEmails | undefined;
  const archiveHasMore = archivePage < (paged?.totalPages || 0);

  const loadMoreArchives = useCallback(() => {
    if (archiveHasMore && !archiveFetching) setArchivePage((p) => p + 1);
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
    // Task #308 — optimiste : disparaît de la liste Archives instantanément.
    const rollback = removeEmailOptimistic(queryClient, id);
    if (selectedEmailId === id) setSelectedEmailId(null);
    updateEmail.mutate({ id, data: { status: "non_lu" } }, {
      onSuccess: () => { invalidateAll(); toast({ title: t("archives.restored") }); },
      onError: (e: any) => {
        rollback();
        toast({ variant: "destructive", title: e?.message || "Échec de la restauration" });
      },
    });
  };

  const handleDelete = (id: number) => {
    // Task #308 — optimiste.
    const rollback = removeEmailOptimistic(queryClient, id);
    if (selectedEmailId === id) setSelectedEmailId(null);
    deleteEmail.mutate({ id }, {
      onSuccess: () => { invalidateAll(); toast({ title: t("archives.emailDeleted") }); },
      onError: (e: any) => {
        rollback();
        toast({ variant: "destructive", title: e?.message || "Échec de la suppression" });
      },
    });
  };

  const handleBulkRestore = () => {
    Array.from(selectedIds).forEach((id) => handleRestore(id));
    setSelectedIds(new Set());
  };

  const handleBulkDeleteArchive = () => {
    Array.from(selectedIds).forEach((id) => handleDelete(id));
    setSelectedIds(new Set());
  };

  // Helpers parité Réception/Envoyés — copie sûre, reply/forward, créer
  // une tâche, copier expéditeur/sujet, télécharger .eml, imprimer.
  const copyToClipboardSafe = async (text: string): Promise<boolean> => {
    try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; } } catch { /* fallback */ }
    try {
      const ta = document.createElement("textarea");
      ta.value = text; ta.setAttribute("readonly", "");
      ta.style.position = "fixed"; ta.style.top = "-1000px"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, text.length);
      const ok = document.execCommand("copy"); document.body.removeChild(ta);
      return ok;
    } catch { return false; }
  };

  const handleQuickReply = (id: number) => {
    setSelectedEmailId(id); setContextMenu(null); setSelectedIds(new Set());
    setTimeout(() => { window.dispatchEvent(new CustomEvent("inbox-reply-shortcut", { detail: { emailId: id } })); }, 150);
  };

  const handleQuickForward = (id: number) => {
    setSelectedEmailId(id); setContextMenu(null); setSelectedIds(new Set());
    setTimeout(() => { window.dispatchEvent(new CustomEvent("inbox-forward-shortcut", { detail: { emailId: id } })); }, 150);
  };

  const handleQuickCreateTask = (id: number) => {
    const email = archivedEmails.find((e: any) => e.id === id);
    const title = ((email as any)?.subject || "Tâche").slice(0, 200);
    createTaskMut.mutate(
      { data: { title, emailId: id } as any },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
          toast({ title: t("inbox.taskCreated", "Tâche créée"), description: title });
        },
        onError: (e: any) => toast({ variant: "destructive", title: t("common.error"), description: e?.message }),
      },
    );
  };

  const handleCopySender = async (id: number) => {
    const email = archivedEmails.find((e: any) => e.id === id) as any;
    const addr = (extractEmailAddress(email?.sender || "") || email?.sender || "").trim();
    if (!addr) { toast({ variant: "destructive", title: t("common.error"), description: "Adresse introuvable" }); return; }
    const ok = await copyToClipboardSafe(addr);
    if (ok) toast({ title: t("inbox.copied", "Copié"), description: addr });
    else toast({ variant: "destructive", title: t("common.error"), description: "Copie impossible" });
  };

  const handleCopySubject = async (id: number) => {
    const email = archivedEmails.find((e: any) => e.id === id) as any;
    const subject = (email?.subject || "").trim();
    if (!subject) { toast({ variant: "destructive", title: t("common.error"), description: "Aucun sujet" }); return; }
    const ok = await copyToClipboardSafe(subject);
    if (ok) toast({ title: t("inbox.copied", "Copié"), description: subject });
    else toast({ variant: "destructive", title: t("common.error"), description: "Copie impossible" });
  };

  const handleDownloadEml = async (id: number) => {
    try {
      const { supabase } = await import("@/lib/supabase");
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const baseUrl = (import.meta as any).env?.VITE_API_URL || `https://${window.location.host}`;
      const res = await fetch(`${baseUrl}/api/emails/${id}/export.eml`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const { saveBlobAs } = await import("@/lib/export-utils");
      await saveBlobAs(blob, `email_${id}.eml`);
      toast({ title: t("inbox.exportDownloaded", "Téléchargé") });
    } catch (e: any) {
      toast({ variant: "destructive", title: t("inbox.exportError", "Échec du téléchargement"), description: e?.message });
    }
  };

  const handlePrintEmail = (id: number) => {
    const email = archivedEmails.find((e: any) => e.id === id) as any;
    if (!email) return;
    const w = window.open("", "_blank", "width=800,height=900");
    if (!w) { toast({ variant: "destructive", title: t("inbox.printPopupBlocked", "Impossible d'ouvrir la fenêtre d'impression") }); return; }
    const safeBody = ((email as any).body || (email as any).summary || "").toString();
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${(email.subject || "").replace(/[<>]/g, "")}</title>
      <style>body{font-family:-apple-system,Segoe UI,sans-serif;color:#111;padding:24px;line-height:1.5}h1{font-size:18px;margin:0 0 12px}.meta{font-size:12px;color:#555;margin-bottom:18px;border-bottom:1px solid #ddd;padding-bottom:10px}img{max-width:100%}</style>
      </head><body>
      <h1>${(email.subject || "(sans sujet)").replace(/[<>]/g, "")}</h1>
      <div class="meta"><b>${(email.sender || "").replace(/[<>]/g, "")}</b><br/>${email.createdAt ? new Date(email.createdAt).toLocaleString() : ""}</div>
      <div>${safeBody}</div>
      </body></html>`);
    w.document.close();
    setTimeout(() => { try { w.focus(); w.print(); } catch {} }, 300);
  };

  const handleToggleRead = (id: number) => {
    const email = archivedEmails.find((e: any) => e.id === id) as any;
    const isUnread = email?.status === "non_lu" || email?.isRead === false || email?.unread === true;
    const newStatus = isUnread ? "read" : "non_lu";
    const rollback = patchEmailOptimistic(queryClient, id, { status: newStatus, isRead: isUnread, unread: !isUnread });
    updateEmail.mutate({ id, data: { status: newStatus } as any }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListEmailsQueryKey() });
        toast({ title: isUnread ? t("inbox.markedAsRead", "Marqué comme lu") : t("inbox.markedAsUnread", "Marqué comme non lu") });
      },
      onError: (e: any) => {
        rollback();
        toast({ variant: "destructive", title: t("common.error"), description: e?.message });
      },
    });
  };

  const handleQuickSnooze = (id: number, hours: number, label: string) => {
    let date: Date;
    if (hours === 24) { date = new Date(); date.setDate(date.getDate() + 1); date.setHours(9, 0, 0, 0); }
    else if (hours === 168) { date = new Date(); const day = date.getDay(); const diff = (8 - day) % 7 || 7; date.setDate(date.getDate() + diff); date.setHours(9, 0, 0, 0); }
    else { date = new Date(Date.now() + hours * 60 * 60 * 1000); }
    snoozeMut.mutate({ id, data: { snoozeUntil: date.toISOString() } as any }, {
      onSuccess: () => { invalidateAll(); toast({ title: t("wave1.snoozeSuccess", "Reporté"), description: label }); },
      onError: (e: any) => toast({ variant: "destructive", title: e?.message || "Échec" }),
    });
  };

  const handleQuickSetCategory = (id: number, categoryId: string, categoryName: string) => {
    const rollback = patchEmailOptimistic(queryClient, id, { categoryId, categoryName });
    updateEmail.mutate({ id, data: { categoryId } as any }, {
      onSuccess: () => { invalidateAll(); toast({ title: t("inbox.categorized", "Catégorisé"), description: categoryName }); },
      onError: (e: any) => { rollback(); toast({ variant: "destructive", title: t("common.error"), description: e?.message }); },
    });
  };

  const handleMoveToFolder = async (emailIds: number[], folderId: string, folderName: string) => {
    try {
      await assignToFolderMut.mutateAsync({ data: { folderId, emailIds } as any });
      toast({ title: t("folders.movedToast", { defaultValue: "Déplacé dans « {{name}} »", name: folderName }) });
      queryClient.invalidateQueries({ queryKey: getListFoldersQueryKey() });
      invalidateAll();
    } catch {
      toast({ title: t("folders.moveFailed", { defaultValue: "Échec du déplacement." }), variant: "destructive" });
    }
  };

  const handleBlockSender = async (id: number) => {
    const email = archivedEmails.find((e: any) => e.id === id) as any;
    const addr = (extractEmailAddress(email?.sender || "") || email?.sender || "").trim();
    if (!addr) return;
    try {
      const { supabase } = await import("@/lib/supabase");
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const res = await fetch(`${import.meta.env.BASE_URL}api/junk/block`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ email: addr }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast({ title: t("junk.blockSenderSuccess", "Expéditeur bloqué"), description: addr });
      invalidateAll();
    } catch (e: any) {
      toast({ variant: "destructive", title: t("common.error"), description: e?.message });
    }
  };

  const buildHoverCb = (email: any): HoverActionsCb => ({
    onOpen: () => setSelectedEmailId(email.id),
    onReply: () => handleQuickReply(email.id),
    onForward: () => handleQuickForward(email.id),
    onCreateTask: () => handleQuickCreateTask(email.id),
    onToggleRead: () => handleToggleRead(email.id),
    onSnooze: (hours, label) => handleQuickSnooze(email.id, hours, label),
    onArchive: () => { /* déjà archivé — no-op */ },
    onSetCategory: (categoryId, name) => handleQuickSetCategory(email.id, categoryId, name),
    onMove: (folderId, name) => handleMoveToFolder([email.id], folderId, name),
    onCopySender: () => handleCopySender(email.id),
    onCopySubject: () => handleCopySubject(email.id),
    onDownloadEml: () => handleDownloadEml(email.id),
    onPrint: () => handlePrintEmail(email.id),
    onBlockSender: () => handleBlockSender(email.id),
    onDelete: () => handleDelete(email.id),
  });

  // ─── Vue Détail email ─────────────────────────────────────────────────
  if (selectedEmailId && !readingPaneEnabled) {
    return (
      <DashboardLayout>
        <div className="max-w-[1600px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-5">
          <div className="mb-3 flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleRestore(selectedEmailId)}
              className="h-8 px-3 text-white hover:text-white hover:bg-white/[0.08] text-[12px] gap-1.5"
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

  // ─── Vue Catégorie ouverte (liste 52px style Superhuman) ──────────────
  if (selectedCategory && selectedEmails) {
    return (
      <DashboardLayout>
        <MailPageHeader currentTab="archives" showReadingPaneToggle={false} showHeaderCollapseToggle={false} />
        <div className="max-w-[1600px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center gap-3 mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedCategory(null)}
              title={t("common.back", "Retour")}
              aria-label={t("common.back", "Retour")}
              className="h-7 px-2 text-[#b8c5d6] hover:text-white hover:bg-white/[0.06] text-[12px]"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
            </Button>
            <div className="flex-1" />
            <span className="text-[11px] text-[#b8c5d6]">{t("archives.emailCount", { count: selectedEmails.length })}</span>
          </div>

          <h2 className="text-[15px] font-semibold text-white mb-3">
            {selectedCategory === UNCATEGORIZED_KEY ? t("inbox.uncategorized") : translateCategoryName(selectedCategory!, lang)}
          </h2>

          <div className="space-y-0">
            {selectedEmails.length === 0 ? (
              <div className="text-center py-12 rounded-lg border border-border border-dashed bg-card/50">
                <FolderOpen className="mx-auto h-8 w-8 text-[#b8c5d6]/40 mb-2" />
                <p className="text-[12px] text-[#b8c5d6]">{t("inbox.noEmails")}</p>
              </div>
            ) : (
              <VirtualizedMailList
                items={selectedEmails}
                keyExtractor={(e: any) => e.id}
                renderRow={(email: any) => {
                const isSelected = selectedIds.has(email.id);
                const isUnread = email.status === "non_lu" || email.isRead === false || email.unread === true;
                return (
                  <div
                    key={email.id}
                    data-email-row
                    className={`group relative flex items-center gap-3 h-[52px] pl-2 pr-3 cursor-pointer select-none border-l-2 border-l-transparent border-b border-[color:var(--mail-border)] hover:border-b-[color:var(--mail-border-hover)] transition-colors ${
                      isSelected
                        ? "bg-primary/[0.10]"
                        : "border-l-transparent hover:bg-white/[0.03]"
                    }`}
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
                    onMouseDown={(e) => {
                      if ((e.target as HTMLElement).closest('button,[role="button"],a,input,textarea,select')) return;
                      if (e.button === 0) { e.preventDefault(); handleDragSelectStart(email.id); }
                    }}
                    onMouseEnter={() => handleDragSelectEnter(email.id)}
                    onContextMenu={(e) => handleContextMenuArchive(e, email.id)}
                  >
                    {/* Case à cocher */}
                    <div className="w-4 flex items-center justify-center shrink-0">
                      {selectionMode || isSelected ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedIds((prev) => { const next = new Set(prev); if (next.has(email.id)) next.delete(email.id); else next.add(email.id); return next; }); }}
                          onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); handleDragSelectStart(email.id); }}
                          className="w-4 h-4 rounded flex items-center justify-center transition-all cursor-pointer border border-[#2a3441] hover:border-primary"
                        >
                          {isSelected && <Check className="w-3 h-3 text-primary" />}
                        </button>
                      ) : (
                        <span
                          className="w-3 h-3 cursor-pointer"
                          onClick={(e) => { e.stopPropagation(); setSelectedIds((prev) => { const next = new Set(prev); next.add(email.id); return next; }); }}
                        />
                      )}
                    </div>

                    {/* Avatar — première lettre expéditeur */}
                    <DragOutAvatar
                      emailId={email.id}
                      subject={email.subject}
                      letter={(email.sender || "?").trim()[0]?.toUpperCase() || "?"}
                    />

                    {/* Expéditeur */}
                    <div className="w-[140px] shrink-0 min-w-0">
                      <span className={`text-[13px] truncate block ${isUnread ? "text-white font-semibold" : "text-[#7a8290] font-normal"}`}>
                        {email.sender || t("inbox.unknownSender", "Inconnu")}
                      </span>
                    </div>

                    {/* Sujet + extrait */}
                    <div className="flex-1 min-w-0 flex items-baseline gap-2 overflow-hidden">
                      <span className={`text-[13px] truncate ${isUnread ? "text-white font-semibold" : "text-[#7a8290] font-normal"}`}>
                        {email.subject}
                      </span>
                      {email.summary && (
                        <span className={`text-[13px] truncate ${isUnread ? "text-[#8b95a7]" : "text-[#5a6270]"}`}>— {email.summary}</span>
                      )}
                    </div>

                    {/* Indicateurs + date */}
                    <div className="flex items-center gap-2 shrink-0 group-hover:hidden">
                      {(email as any).attachmentCount > 0 && (
                        <Paperclip className="w-3 h-3 text-[#8b95a7]" />
                      )}
                      <span className="text-[11px] tabular-nums text-[#8b95a7] w-12 text-right whitespace-nowrap hidden sm:inline">
                        {email.createdAt ? format(new Date(email.createdAt), "d MMM", { locale: dateFnsLocale }) : ""}
                      </span>
                    </div>

                    {/* Barre d'actions au survol — parité 1:1 Réception/Envoyés */}
                    <HoverActions
                      isUnread={isUnread}
                      categoryCounts={categoryCounts as any[] | undefined}
                      userFolders={userFolders as any[] | undefined}
                      cb={buildHoverCb(email)}
                    />
                  </div>
                );
              }}
              />
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
            className="fixed z-[9999] min-w-[220px] max-w-[280px] rounded-lg border border-[#1f2937] bg-[#141c2b] shadow-2xl overflow-y-auto animate-in fade-in zoom-in-95 duration-100"
            style={{
              top: ctxMenuPos.ready ? ctxMenuPos.top : contextMenu.y,
              left: ctxMenuPos.ready ? ctxMenuPos.left : contextMenu.x,
              maxHeight: `calc(100vh - 16px)`,
              opacity: ctxMenuPos.ready ? 1 : 0,
            }}
          >
            <div className="px-3 py-2 border-b border-[#1f2937]">
              <span className="text-[10px] text-[#b8c5d6] uppercase tracking-wider font-medium">
                {selectedIds.size > 1
                  ? t("inbox.selectedCount", { count: selectedIds.size })
                  : (selectedEmails?.find((e: any) => e.id === contextMenu.emailId)?.subject?.substring(0, 30) || "") + "..."}
              </span>
            </div>
            <div className="py-1">
              {selectedIds.size <= 1 && (
                <>
                  <button
                    onClick={() => { setSelectedEmailId(contextMenu.emailId); setContextMenu(null); setSelectedIds(new Set()); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#b8c5d6] hover:bg-white/[0.06] hover:text-white transition-colors"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />{t("inbox.openEmail")}
                  </button>
                  <button onClick={() => handleQuickReply(contextMenu.emailId)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#b8c5d6] hover:bg-white/[0.06] hover:text-white transition-colors">
                    <Reply className="w-3.5 h-3.5" />{t("inbox.reply", "Répondre")}
                  </button>
                  <button onClick={() => handleQuickForward(contextMenu.emailId)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#b8c5d6] hover:bg-white/[0.06] hover:text-white transition-colors">
                    <Forward className="w-3.5 h-3.5" />{t("inbox.forward", "Transférer")}
                  </button>
                  <button onClick={() => { handleQuickCreateTask(contextMenu.emailId); setContextMenu(null); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#b8c5d6] hover:bg-white/[0.06] hover:text-white transition-colors">
                    <ListTodo className="w-3.5 h-3.5" />{t("inbox.createTask", "Créer une tâche")}
                  </button>
                  <div className="border-t border-[#1f2937] my-1" />
                  <button onClick={() => { handleToggleRead(contextMenu.emailId); setContextMenu(null); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#b8c5d6] hover:bg-white/[0.06] hover:text-white transition-colors">
                    {(() => {
                      const email = archivedEmails.find((e: any) => e.id === contextMenu.emailId) as any;
                      const isUnread = email?.status === "non_lu" || email?.isRead === false || email?.unread === true;
                      return isUnread
                        ? (<><MailOpen className="w-3.5 h-3.5" />{t("inbox.markAsRead", "Marquer comme lu")}</>)
                        : (<><Mail className="w-3.5 h-3.5" />{t("inbox.markAsUnread", "Marquer comme non lu")}</>);
                    })()}
                  </button>
                  <button onClick={() => { handleQuickSnooze(contextMenu.emailId, 1, t("wave1.snooze1h", "Dans 1 h")); setContextMenu(null); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#b8c5d6] hover:bg-white/[0.06] hover:text-white transition-colors">
                    <Clock className="w-3.5 h-3.5" />{t("wave1.snooze1h", "Reporter — Dans 1 h")}
                  </button>
                  <button onClick={() => { handleQuickSnooze(contextMenu.emailId, 24, t("wave1.snoozeTomorrow", "Demain matin")); setContextMenu(null); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#b8c5d6] hover:bg-white/[0.06] hover:text-white transition-colors">
                    <Bell className="w-3.5 h-3.5" />{t("wave1.snoozeTomorrow", "Reporter — Demain matin")}
                  </button>
                  <button onClick={() => { handleQuickSnooze(contextMenu.emailId, 168, t("wave1.snoozeNextWeek", "Semaine prochaine")); setContextMenu(null); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#b8c5d6] hover:bg-white/[0.06] hover:text-white transition-colors">
                    <CalendarDays className="w-3.5 h-3.5" />{t("wave1.snoozeNextWeek", "Reporter — Semaine prochaine")}
                  </button>
                  {categoryCounts && (categoryCounts as any[]).length > 0 && (
                    <div className="px-3 py-1.5 text-[10px] text-[#6b7280] uppercase tracking-wider">{t("inbox.category", "Catégorie")}</div>
                  )}
                  {(categoryCounts as any[] | undefined)?.slice(0, 8).map((c: any) => (
                    <button key={c.categoryId}
                      onClick={() => { handleQuickSetCategory(contextMenu.emailId, c.categoryId, c.categoryName); setContextMenu(null); }}
                      className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[12px] text-[#b8c5d6] hover:bg-white/[0.06] hover:text-white transition-colors">
                      {c.color && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c.color }} />}
                      <span className="truncate">{c.categoryName}</span>
                    </button>
                  ))}
                  {userFolders && (userFolders as any[]).length > 0 && (
                    <div className="px-3 py-1.5 text-[10px] text-[#6b7280] uppercase tracking-wider">{t("inbox.moveToFolder", { defaultValue: "Déplacer vers" })}</div>
                  )}
                  {(userFolders as any[] | undefined)?.slice(0, 8).map((f: any) => (
                    <button key={f.id}
                      onClick={() => { handleMoveToFolder([contextMenu.emailId], f.id, f.name); setContextMenu(null); }}
                      className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[12px] text-[#b8c5d6] hover:bg-white/[0.06] hover:text-white transition-colors">
                      <Folder className="w-3.5 h-3.5 text-primary/70" />
                      <span className="truncate">{f.name}</span>
                    </button>
                  ))}
                  <div className="border-t border-[#1f2937] my-1" />
                  <button onClick={() => { handleCopySender(contextMenu.emailId); setContextMenu(null); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#b8c5d6] hover:bg-white/[0.06] hover:text-white transition-colors">
                    <Copy className="w-3.5 h-3.5" />{t("inbox.copySenderEmail", "Copier l'adresse de l'expéditeur")}
                  </button>
                  <button onClick={() => { handleCopySubject(contextMenu.emailId); setContextMenu(null); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#b8c5d6] hover:bg-white/[0.06] hover:text-white transition-colors">
                    <TypeIcon className="w-3.5 h-3.5" />{t("inbox.copySubject", "Copier le sujet")}
                  </button>
                  <button onClick={() => { handleDownloadEml(contextMenu.emailId); setContextMenu(null); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#b8c5d6] hover:bg-white/[0.06] hover:text-white transition-colors">
                    <Download className="w-3.5 h-3.5" />{t("inbox.downloadEml", "Télécharger en .eml")}
                  </button>
                  <button onClick={() => { handlePrintEmail(contextMenu.emailId); setContextMenu(null); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#b8c5d6] hover:bg-white/[0.06] hover:text-white transition-colors">
                    <Printer className="w-3.5 h-3.5" />{t("inbox.print", "Imprimer")}
                  </button>
                  <button onClick={() => { handleBlockSender(contextMenu.emailId); setContextMenu(null); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#b8c5d6] hover:bg-white/[0.06] hover:text-white transition-colors">
                    <ShieldAlert className="w-3.5 h-3.5" />{t("junk.blockSender")}
                  </button>
                </>
              )}
              <div className="border-t border-[#1f2937] my-1" />
              <button
                onClick={() => { handleBulkRestore(); setContextMenu(null); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#b8c5d6] hover:bg-white/[0.06] hover:text-white transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {t("archives.restoreToInbox")}
                {selectedIds.size > 1 && ` (${selectedIds.size})`}
              </button>
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
        <MailReadingPane
          open={readingPaneEnabled && !!selectedEmailId}
          onClose={() => setSelectedEmailId(null)}
        >
          {selectedEmailId ? (
            <div className="px-3 py-3">
              <div className="mb-3 flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRestore(selectedEmailId)}
                  className="h-8 px-3 text-white hover:text-white hover:bg-white/[0.08] text-[12px] gap-1.5"
                  data-testid="button-restore-from-archive-pane"
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
          ) : null}
        </MailReadingPane>
      </DashboardLayout>
    );
  }

  // ─── Vue Racine — grille de catégories ────────────────────────────────
  return (
    <DashboardLayout>
      <MailPageHeader currentTab="archives" showReadingPaneToggle={false} showHeaderCollapseToggle={false} />
      <div className="max-w-[1600px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-5">
        <BackToInboxButton iconOnly />
        <div className="mb-5">
          <h1 className="text-[16px] font-semibold text-white tracking-tight flex items-center gap-2">
            {t("archives.title")}
            {(paged?.total || archivedEmails.length) > 0 && (
              <span className="text-[11px] font-normal text-[color:var(--mail-text-meta,#b8c5d6)]">
                ({paged?.total || archivedEmails.length})
              </span>
            )}
          </h1>
          <p className="text-[12px] text-[#b8c5d6] mt-0.5">
            {t("archives.archivedByAI")}
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
