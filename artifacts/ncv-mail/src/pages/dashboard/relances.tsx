import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { BackToInboxButton } from "@/components/dashboard/back-to-inbox-button";
import { MailPageHeader } from "@/components/email-list/MailPageHeader";
import { MailReadingPane } from "@/components/email-list/MailReadingPane";
import { useReadingPaneEnabled } from "@/lib/use-reading-pane";
import { EmailDetail } from "@/components/email-detail/EmailDetail";
import { HoverActions, type HoverActionsCb } from "@/components/email-list/HoverActions";
import { useToast } from "@/hooks/use-toast";
import {
  useListFollowups,
  useUpdateFollowup,
  useDismissFollowup,
  useGenerateFollowUpDraft,
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
  useSnoozeEmail,
  useListFolders,
  useAssignEmailsToFolder,
  getListEmailsQueryKey,
  getListTasksQueryKey,
  getListFoldersQueryKey,
  getGetProfileQueryKey,
  getListFollowupsQueryKey,
  getGetFollowupStatsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import type { UploadedFile } from "@/components/FileAttachInput";
import { useLocation } from "wouter";
import {
  Sparkles,
  MailCheck,
  X,
  CheckCircle2,
  Clock,
  Loader2,
  Inbox,
  Check,
  ChevronRight,
  Reply,
  Forward,
  ListTodo,
  Mail,
  MailOpen,
  Bell,
  CalendarDays,
  Archive,
  Folder,
  Copy,
  Type as TypeIcon,
  Download,
  Printer,
  Trash2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import { useEnableLightTheme } from "@/lib/inbox-theme";
import { extractEmailAddress } from "@/lib/utils";

function daysSince(iso: string | null | undefined): number {
  if (!iso) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
}

export default function Relances() {
  useEnableLightTheme();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: aiSuggestions, isLoading: loadingAi } = useListFollowups({ kind: "ai" });
  const { data: projects } = useListProjects();

  const updateMut = useUpdateFollowup();
  const dismissMut = useDismissFollowup();
  const draftMut = useGenerateFollowUpDraft();

  // Mutations email-niveau (parité Réception/Envoyés/Projets).
  const updateEmail = useUpdateEmail();
  const deleteEmail = useDeleteEmail();
  const snoozeMut = useSnoozeEmail();
  const createTaskMut = useCreateTask();
  const assignToFolderMut = useAssignEmailsToFolder();
  const { data: categoryCounts } = useGetCategoryCounts({ scope: "personal" as const });
  const { data: userFolders } = useListFolders();

  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<"draft" | "replied" | "dismiss" | null>(null);

  // Vue détail inline (parité Envoyés).
  const [selectedEmailId, setSelectedEmailId] = useState<number | null>(null);
  const [readingPaneEnabled] = useReadingPaneEnabled();

  // Sélection multiple — clés = followup ids
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<
    { x: number; y: number; rowId: string; emailId: number | null; subject: string } | null
  >(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const [menuPlacement, setMenuPlacement] = useState<{ top: number; left: number; maxHeight: number } | null>(null);
  const selectionMode = selectedIds.size > 0;

  const aiList = (aiSuggestions as any[]) || [];
  const findFollowup = (id: string) => aiList.find((f: any) => f.id === id);
  const findEmail = (eId: number | null | undefined) => {
    if (!eId) return null;
    const f = aiList.find((f: any) => Number(f.emails?.id) === Number(eId));
    return f?.emails || null;
  };

  // ─── Fermeture menu / Échap / clic extérieur ────────────────────────────
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

  // Auto-flip + clamp du menu contextuel (parité Réception/Reportés/Projets).
  useLayoutEffect(() => {
    if (!contextMenu) { setMenuPlacement(null); return; }
    const el = contextMenuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const margin = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = contextMenu.x;
    let top = contextMenu.y;
    if (left + rect.width + margin > vw) left = Math.max(margin, vw - rect.width - margin);
    if (top + rect.height + margin > vh) {
      const flipped = contextMenu.y - rect.height;
      top = flipped >= margin ? flipped : Math.max(margin, vh - rect.height - margin);
    }
    setMenuPlacement({ top, left, maxHeight: vh - 2 * margin });
  }, [contextMenu]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setSelectedIds(new Set()); setContextMenu(null); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (selectedIds.size === 0) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.closest("[data-followup-row]") ||
        target.closest("[data-selection-bar]") ||
        target.closest("[data-context-menu]")
      ) return;
      setSelectedIds(new Set());
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [selectedIds.size]);

  // ─── Drag-select ─────────────────────────────────────────────────────────
  const isDraggingRef = useRef(false);
  const didDragRef = useRef(false);
  const dragStartIdRef = useRef<string | null>(null);
  const preSelectRef = useRef<Set<string>>(new Set());
  const autoScrollRaf = useRef<number>(0);
  const lastMouseYRef = useRef(0);

  const getRowIdFromPoint = useCallback((y: number, x: number): string | null => {
    const el = document.elementFromPoint(x, y);
    if (!el) return null;
    const row = (el as HTMLElement).closest?.("[data-row-id]");
    if (!row) return null;
    return row.getAttribute("data-row-id");
  }, []);

  const selectRange = useCallback((currentId: string) => {
    const rows = Array.from(document.querySelectorAll("[data-followup-row][data-row-id]"));
    const ids = rows.map((r) => r.getAttribute("data-row-id")!);
    const startIdx = ids.indexOf(dragStartIdRef.current!);
    const endIdx = ids.indexOf(currentId);
    if (startIdx === -1 || endIdx === -1) return;
    const keep = new Set(preSelectRef.current);
    if (startIdx !== endIdx) {
      const lo = Math.min(startIdx, endIdx);
      const hi = Math.max(startIdx, endIdx);
      for (let i = lo; i <= hi; i++) keep.add(ids[i]);
    }
    setSelectedIds(keep);
  }, []);

  useEffect(() => {
    const threshold = 60;
    const speed = 14;
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      lastMouseYRef.current = e.clientY;
      if (!didDragRef.current) didDragRef.current = true;
      const hoverId = getRowIdFromPoint(e.clientY, e.clientX);
      if (hoverId !== null) selectRange(hoverId);
      cancelAnimationFrame(autoScrollRaf.current);
      const scroll = () => {
        if (!isDraggingRef.current) return;
        const y = lastMouseYRef.current;
        if (y > window.innerHeight - threshold) {
          window.scrollBy(0, speed);
          const id = getRowIdFromPoint(y, window.innerWidth / 2);
          if (id !== null) selectRange(id);
          autoScrollRaf.current = requestAnimationFrame(scroll);
        } else if (y < threshold) {
          window.scrollBy(0, -speed);
          const id = getRowIdFromPoint(y, window.innerWidth / 2);
          if (id !== null) selectRange(id);
          autoScrollRaf.current = requestAnimationFrame(scroll);
        }
      };
      scroll();
    };
    document.addEventListener("mousemove", handleMouseMove);
    return () => { document.removeEventListener("mousemove", handleMouseMove); cancelAnimationFrame(autoScrollRaf.current); };
  }, [getRowIdFromPoint, selectRange]);

  const handleDragSelectStart = useCallback((id: string) => {
    isDraggingRef.current = true;
    didDragRef.current = false;
    dragStartIdRef.current = id;
    setSelectedIds((prev) => { preSelectRef.current = new Set(prev); return prev; });
    const handleMouseUp = () => {
      isDraggingRef.current = false;
      cancelAnimationFrame(autoScrollRaf.current);
      document.removeEventListener("mouseup", handleMouseUp);
    };
    document.addEventListener("mouseup", handleMouseUp);
  }, []);

  const handleRowContextMenu = useCallback((e: React.MouseEvent, f: any) => {
    e.preventDefault();
    setSelectedIds((prev) => {
      if (prev.size > 0 && !prev.has(f.id)) return new Set(prev).add(f.id);
      if (prev.size === 0) return new Set([f.id]);
      return prev;
    });
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      rowId: f.id,
      emailId: f.emails?.id ? Number(f.emails.id) : null,
      subject: f.emails?.subject || f.title || "",
    });
  }, []);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getListFollowupsQueryKey({ kind: "ai" }) });
    queryClient.invalidateQueries({ queryKey: getListFollowupsQueryKey({ kind: "manual" }) });
    queryClient.invalidateQueries({ queryKey: getGetFollowupStatsQueryKey() });
  };
  const invalidateEmails = () => {
    queryClient.invalidateQueries({ queryKey: getListEmailsQueryKey() });
  };

  // ─── Actions relance-spécifiques ────────────────────────────────────────
  async function handleDismiss(id: string) {
    setBusyId(id); setBusyAction("dismiss");
    try {
      await dismissMut.mutateAsync({ id });
      toast({ title: t("relances.dismissedToast", "Suggestion ignorée") });
      invalidateAll();
    } catch {
      toast({ variant: "destructive", title: t("common.error") });
    } finally {
      setBusyId(null); setBusyAction(null);
    }
  }

  async function handleMarkReplied(id: string) {
    setBusyId(id); setBusyAction("replied");
    try {
      await updateMut.mutateAsync({ id, data: { status: "termine" } });
      toast({ title: t("relances.markedRepliedToast", "Marquée comme répondu") });
      invalidateAll();
    } catch {
      toast({ variant: "destructive", title: t("common.error") });
    } finally {
      setBusyId(null); setBusyAction(null);
    }
  }

  async function handleCreateDraft(id: string) {
    setBusyId(id); setBusyAction("draft");
    try {
      const result: any = await draftMut.mutateAsync({ data: { followupId: id } });
      sessionStorage.setItem(
        "inboria.compose.prefill",
        JSON.stringify({
          to: result?.to || "",
          subject: result?.subject || "",
          body: result?.draft || "",
          followupId: id,
          savedAt: Date.now(),
        }),
      );
      await updateMut.mutateAsync({ id, data: { status: "relance" } });
      invalidateAll();
      setLocation("/dashboard?compose=1");
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: t("relances.draftErrorTitle", "Échec de la génération"),
        description: err?.message || "",
      });
    } finally {
      setBusyId(null); setBusyAction(null);
    }
  }

  async function handleBulkMarkReplied() {
    const ids = Array.from(selectedIds);
    try {
      await Promise.all(ids.map((id) => updateMut.mutateAsync({ id, data: { status: "termine" } })));
      toast({ title: t("relances.bulkMarkedRepliedToast", "{{count}} marquées comme répondu", { count: ids.length }) });
    } catch {
      toast({ variant: "destructive", title: t("common.error") });
    } finally {
      setSelectedIds(new Set());
      invalidateAll();
    }
  }

  async function handleBulkDismiss() {
    const ids = Array.from(selectedIds);
    try {
      await Promise.all(ids.map((id) => dismissMut.mutateAsync({ id })));
      toast({ title: t("relances.bulkDismissedToast", "{{count}} ignorées", { count: ids.length }) });
    } catch {
      toast({ variant: "destructive", title: t("common.error") });
    } finally {
      setSelectedIds(new Set());
      invalidateAll();
    }
  }

  async function handleBulkCreateDraft() {
    const first = Array.from(selectedIds)[0];
    if (first) await handleCreateDraft(first);
  }

  // ─── Helpers email-niveau (parité Envoyés/Projets) ──────────────────────
  const copyToClipboardSafe = async (text: string): Promise<boolean> => {
    try {
      if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; }
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch { return false; }
  };

  const handleQuickReply = (id: number) => {
    setSelectedEmailId(id);
    setContextMenu(null);
    setSelectedIds(new Set());
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("inbox-reply-shortcut", { detail: { emailId: id } }));
    }, 150);
  };

  const handleQuickForward = (id: number) => {
    setSelectedEmailId(id);
    setContextMenu(null);
    setSelectedIds(new Set());
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("inbox-forward-shortcut", { detail: { emailId: id } }));
    }, 150);
  };

  const handleQuickCreateTask = (id: number) => {
    const email = findEmail(id);
    const title = (email?.subject || "Tâche").slice(0, 200);
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

  const handleToggleRead = (id: number) => {
    const email = findEmail(id);
    const isUnread = email?.status === "non_lu" || (email as any)?.isRead === false || (email as any)?.unread === true;
    const newStatus = isUnread ? "read" : "non_lu";
    updateEmail.mutate(
      { id, data: { status: newStatus } as any },
      {
        onSuccess: () => {
          invalidateEmails();
          toast({ title: isUnread ? t("inbox.markedAsRead", "Marqué comme lu") : t("inbox.markedAsUnread", "Marqué comme non lu") });
        },
      },
    );
  };

  const handleQuickSnooze = (id: number, hours: number, label: string) => {
    let date: Date;
    if (hours === 24) { date = new Date(); date.setDate(date.getDate() + 1); date.setHours(9, 0, 0, 0); }
    else if (hours === 168) { date = new Date(); const day = date.getDay(); const diff = (8 - day) % 7 || 7; date.setDate(date.getDate() + diff); date.setHours(9, 0, 0, 0); }
    else { date = new Date(Date.now() + hours * 60 * 60 * 1000); }
    snoozeMut.mutate(
      { id, data: { snoozeUntil: date.toISOString() } as any },
      {
        onSuccess: () => {
          invalidateEmails();
          toast({ title: t("wave1.snoozeSuccess", "Reporté"), description: label });
        },
        onError: (e: any) => toast({ variant: "destructive", title: e?.message || "Échec" }),
      },
    );
  };

  const handleArchiveOne = (id: number) => {
    updateEmail.mutate(
      { id, data: { status: "archived" } as any },
      {
        onSuccess: () => {
          invalidateEmails();
          toast({ title: t("inbox.archived", "Archivé") });
        },
      },
    );
  };

  const handleQuickSetCategory = (id: number, categoryId: string, categoryName: string) => {
    updateEmail.mutate(
      { id, data: { categoryId } as any },
      {
        onSuccess: () => {
          invalidateEmails();
          toast({ title: t("inbox.categorized", "Catégorisé"), description: categoryName });
        },
      },
    );
  };

  const handleMoveToFolder = async (emailIds: number[], folderId: string, folderName: string) => {
    try {
      await assignToFolderMut.mutateAsync({ data: { folderId, emailIds } as any });
      toast({ title: t("folders.movedToast", { defaultValue: "Déplacé dans « {{name}} »", name: folderName }) });
      queryClient.invalidateQueries({ queryKey: getListFoldersQueryKey() });
      invalidateEmails();
    } catch {
      toast({ title: t("folders.moveFailed", { defaultValue: "Échec du déplacement." }), variant: "destructive" });
    }
  };

  const handleCopyRecipient = async (id: number) => {
    const email = findEmail(id);
    const addr = (extractEmailAddress((email as any)?.recipient || "") || (email as any)?.recipient || "").trim();
    if (!addr) { toast({ variant: "destructive", title: t("common.error"), description: "Adresse introuvable" }); return; }
    const ok = await copyToClipboardSafe(addr);
    if (ok) toast({ title: t("inbox.copied", "Copié"), description: addr });
    else toast({ variant: "destructive", title: t("common.error"), description: "Copie impossible" });
  };

  const handleCopySubject = async (id: number) => {
    const email = findEmail(id);
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
      const baseUrl = import.meta.env.VITE_API_URL || `https://${window.location.host}`;
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
    const email = findEmail(id);
    if (!email) return;
    const w = window.open("", "_blank", "width=800,height=900");
    if (!w) { toast({ variant: "destructive", title: t("inbox.printPopupBlocked", "Impossible d'ouvrir la fenêtre d'impression") }); return; }
    const safeBody = ((email as any).body || (email as any).summary || "").toString();
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${(email.subject || "").replace(/[<>]/g, "")}</title>
      <style>body{font-family:-apple-system,Segoe UI,sans-serif;color:#111;padding:24px;line-height:1.5}h1{font-size:18px;margin:0 0 12px}.meta{font-size:12px;color:#555;margin-bottom:18px;border-bottom:1px solid #ddd;padding-bottom:10px}img{max-width:100%}</style>
      </head><body>
      <h1>${(email.subject || "(sans sujet)").replace(/[<>]/g, "")}</h1>
      <div class="meta"><b>${((email as any).recipient || "").replace(/[<>]/g, "")}</b><br/>${(email as any).createdAt ? new Date((email as any).createdAt).toLocaleString() : ""}</div>
      <div>${safeBody}</div>
      </body></html>`);
    w.document.close();
    setTimeout(() => { try { w.focus(); w.print(); } catch {} }, 300);
  };

  const handleDeleteEmail = (id: number) => {
    deleteEmail.mutate({ id }, {
      onSuccess: () => {
        invalidateEmails();
        invalidateAll();
        toast({ title: t("inbox.emailDeleted", "Email supprimé") });
      },
    });
  };

  const buildHoverCb = (email: any): HoverActionsCb => ({
    onOpen: () => setSelectedEmailId(Number(email.id)),
    onReply: () => handleQuickReply(Number(email.id)),
    onForward: () => handleQuickForward(Number(email.id)),
    onCreateTask: () => handleQuickCreateTask(Number(email.id)),
    onToggleRead: () => handleToggleRead(Number(email.id)),
    onSnooze: (hours, label) => handleQuickSnooze(Number(email.id), hours, label),
    onArchive: () => handleArchiveOne(Number(email.id)),
    onSetCategory: (categoryId, name) => handleQuickSetCategory(Number(email.id), categoryId, name),
    onMove: (folderId, name) => handleMoveToFolder([Number(email.id)], folderId, name),
    onCopySender: () => handleCopyRecipient(Number(email.id)),
    onCopySubject: () => handleCopySubject(Number(email.id)),
    onDownloadEml: () => handleDownloadEml(Number(email.id)),
    onPrint: () => handlePrintEmail(Number(email.id)),
    onBlockSender: () => { /* non applicable côté Relances : on relance ses propres envois */ },
    onDelete: () => handleDeleteEmail(Number(email.id)),
  });

  // ─── Vue détail inline ──────────────────────────────────────────────────
  if (selectedEmailId && !readingPaneEnabled) {
    return (
      <DashboardLayout>
        <div className="max-w-[1600px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-5">
          <RelanceEmailDetailView
            emailId={selectedEmailId}
            onBack={() => setSelectedEmailId(null)}
            projects={(projects as any[]) || []}
          />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <MailPageHeader currentTab="relances" showReadingPaneToggle={false} showHeaderCollapseToggle={false} />
      <div className="max-w-[1600px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-5 space-y-3">
        <BackToInboxButton />
        <div>
          <h1 className="text-[20px] font-semibold text-foreground flex items-center gap-2">
            <MailCheck className="w-5 h-5 text-primary" />
            {t("relances.pageTitle", "Relances")}
          </h1>
          <p className="text-[12px] text-muted-foreground mt-1">
            {t(
              "relances.pageSubtitle",
              "Inboria détecte les mails que vous avez envoyés et qui sont restés sans réponse. Validez ou ignorez les suggestions.",
            )}
          </p>
        </div>

        <section>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <h2 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {t("relances.suggestionsTitle", "Suggestions Inboria")}
            </h2>
            <span className="text-[11px] text-[#8b95a7]">({aiList.length})</span>
            {selectionMode && (
              <span className="text-[11px] text-[#b8c5d6] ml-2">
                · {t("inbox.selectedCount", { count: selectedIds.size })}
              </span>
            )}
          </div>

          {loadingAi ? (
            <div className="flex flex-col items-center justify-center py-16 rounded-lg border border-border/40 border-dashed bg-white/[0.02]">
              <Loader2 className="w-5 h-5 text-[#8b95a7] animate-spin mb-3" />
              <p className="text-[12px] text-[#b8c5d6]">{t("inbox.loadingTitle", "Chargement…")}</p>
            </div>
          ) : aiList.length === 0 ? (
            <div className="text-center py-20 rounded-lg border border-border/40 border-dashed bg-white/[0.02]">
              <Inbox className="mx-auto h-10 w-10 text-[#3a4150] mb-3" />
              <h3 className="text-[13px] font-medium text-foreground mb-1">
                {t("relances.emptySuggestionsTitle", "Aucune relance à proposer")}
              </h3>
              <p className="text-[12px] text-[#8b95a7]">
                {t(
                  "relances.emptySuggestionsDesc",
                  "Tous vos mails envoyés ont reçu une réponse, ou aucun n'est assez ancien pour être relancé.",
                )}
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-border/40 overflow-hidden bg-white/[0.01]">
              {aiList.map((f: any) => {
                const email = f.emails || {};
                const sentAt = email.created_at || email.createdAt || null;
                const days = daysSince(sentAt);
                const recipient = email.recipient || f.title || "?";
                const initial = recipient.trim().charAt(0).toUpperCase();
                const subject = email.subject || t("relances.noSubject", "(sans objet)");
                const summary = email.summary || "";
                const isBusy = busyId === f.id;
                const isSelected = selectedIds.has(f.id);
                const isUnread = email?.status === "non_lu" || (email as any)?.isRead === false || (email as any)?.unread === true;
                const hasEmail = !!email?.id;

                return (
                  <div
                    key={f.id}
                    data-followup-row
                    data-row-id={f.id}
                    title={`${recipient}\n— ${subject}${summary ? `\n${summary}` : ""}`}
                    className={`group relative flex items-center gap-3 h-[52px] pl-2 pr-3 select-none border-l-2 border-b border-border/40 transition-colors cursor-pointer ${
                      isSelected
                        ? "border-l-primary bg-primary/[0.10]"
                        : "border-l-transparent hover:bg-white/[0.03]"
                    }`}
                    onClick={() => {
                      if (didDragRef.current) return;
                      if (selectionMode) {
                        setSelectedIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(f.id)) next.delete(f.id); else next.add(f.id);
                          return next;
                        });
                      } else if (hasEmail) {
                        setSelectedEmailId(Number(email.id));
                      }
                    }}
                    onMouseDown={(e) => { if (e.button === 0) { e.preventDefault(); handleDragSelectStart(f.id); } }}
                    onContextMenu={(e) => handleRowContextMenu(e, f)}
                  >
                    {/* Case à cocher */}
                    <div className="w-4 flex items-center justify-center shrink-0">
                      {selectionMode || isSelected ? (
                        <button
                          className="w-4 h-4 rounded flex items-center justify-center transition-all cursor-pointer border border-[#2a3441] hover:border-white/60"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(f.id)) next.delete(f.id); else next.add(f.id);
                              return next;
                            });
                          }}
                          onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); handleDragSelectStart(f.id); }}
                        >
                          {isSelected && <Check className="w-3 h-3 text-primary" />}
                        </button>
                      ) : (
                        <span className="w-3 h-3" />
                      )}
                    </div>

                    {/* Avatar */}
                    <div className="w-7 h-7 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
                      <span className="text-primary text-[11px] font-semibold">{initial}</span>
                    </div>

                    {/* Destinataire + sujet — résumé */}
                    <div className="flex-1 min-w-0 flex items-baseline gap-2 overflow-hidden">
                      <span className={`text-[13px] truncate shrink-0 max-w-[180px] ${isUnread ? "font-medium text-foreground" : "font-normal text-[#7a8290]"}`}>
                        {recipient}
                      </span>
                      <span className={`text-[12px] truncate ${isUnread ? "text-foreground" : "text-[#7a8290]"}`}>
                        {subject}
                        {summary && <span className={isUnread ? "text-[#8b95a7]" : "text-[#5a6270]"}> — {summary}</span>}
                      </span>
                    </div>

                    {/* Indicateur "X j sans réponse" — masqué au survol */}
                    <div className="flex items-center gap-2 shrink-0 group-hover:hidden">
                      <span className="inline-flex items-center gap-1 text-[11px] tabular-nums text-[#b8c5d6] whitespace-nowrap">
                        <Clock className="w-2.5 h-2.5 text-[#8b95a7]" />
                        {t("relances.daysWithoutReply", "{{count}} j sans réponse", { count: days })}
                      </span>
                    </div>

                    {/* Au survol : 3 actions relance + barre HoverActions standard */}
                    <div className="hidden group-hover:flex items-center gap-0.5 shrink-0 mr-0.5">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleCreateDraft(f.id); }}
                        onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
                        disabled={isBusy}
                        className="p-1 rounded text-primary hover:bg-white/[0.08] disabled:opacity-50 disabled:pointer-events-none"
                        title={t("relances.createDraft", "Créer la relance")}
                      >
                        {isBusy && busyAction === "draft" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleMarkReplied(f.id); }}
                        onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
                        disabled={isBusy}
                        className="p-1 rounded text-emerald-400 hover:bg-white/[0.08] disabled:opacity-50 disabled:pointer-events-none"
                        title={t("relances.markReplied", "Marquer comme répondu")}
                      >
                        {isBusy && busyAction === "replied" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDismiss(f.id); }}
                        onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
                        disabled={isBusy}
                        className="p-1 rounded text-[#8b95a7] hover:bg-white/[0.08] hover:text-white disabled:opacity-50 disabled:pointer-events-none"
                        title={t("relances.dismiss", "Ignorer")}
                      >
                        {isBusy && busyAction === "dismiss" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                      </button>
                      <span className="w-px h-3.5 bg-white/[0.08] mx-1" />
                    </div>
                    {hasEmail && (
                      <HoverActions
                        isUnread={!!isUnread}
                        categoryCounts={categoryCounts as any[] | undefined}
                        userFolders={userFolders as any[] | undefined}
                        cb={buildHoverCb(email)}
                        showBlockSender={false}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Barre de sélection */}
      {selectionMode && (
        <div
          data-selection-bar
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 h-11 rounded-full border border-[#2a3441] bg-[#0f141b] shadow-2xl"
        >
          <span className="text-[11px] text-[#b8c5d6]">{t("inbox.selectedCount", { count: selectedIds.size })}</span>
          <div className="w-px h-4 bg-[#2a3441]" />
          <button onClick={handleBulkCreateDraft} className="flex items-center gap-1.5 text-[11px] text-primary hover:opacity-80 transition-opacity">
            <Sparkles className="w-3 h-3" />{t("relances.createDraft", "Créer la relance")}
          </button>
          <button onClick={handleBulkMarkReplied} className="flex items-center gap-1.5 text-[11px] text-emerald-400 hover:opacity-80 transition-opacity">
            <CheckCircle2 className="w-3 h-3" />{t("relances.markReplied", "Marquer comme répondu")}
          </button>
          <button onClick={handleBulkDismiss} className="flex items-center gap-1.5 text-[11px] text-[#b8c5d6] hover:text-white transition-colors">
            <X className="w-3 h-3" />{t("relances.dismiss", "Ignorer")}
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="text-[11px] text-[#8b95a7] hover:text-white transition-colors ml-2">
            {t("common.cancel")}
          </button>
        </div>
      )}

      {/* Menu contextuel — parité Réception/Envoyés/Projets + actions relance */}
      {contextMenu && (() => {
        const ctxRow = findFollowup(contextMenu.rowId);
        const multi = selectedIds.size > 1;
        const eId = contextMenu.emailId;
        const email = findEmail(eId);
        const isUnread = email?.status === "non_lu" || (email as any)?.isRead === false || (email as any)?.unread === true;
        const headerLabel = multi
          ? t("inbox.selectedCount", { count: selectedIds.size })
          : (contextMenu.subject || "").substring(0, 30) + ((contextMenu.subject || "").length > 30 ? "…" : "");
        return (
          <div
            ref={contextMenuRef}
            data-context-menu
            className="fixed z-[9999] min-w-[220px] max-w-[280px] rounded-lg border border-[#2a3441] bg-[#0f141b] shadow-2xl overflow-y-auto animate-in fade-in zoom-in-95 duration-100"
            style={{
              top: menuPlacement?.top ?? contextMenu.y,
              left: menuPlacement?.left ?? contextMenu.x,
              maxHeight: menuPlacement?.maxHeight ?? "calc(100vh - 16px)",
              opacity: menuPlacement ? 1 : 0,
            }}
          >
            <div className="px-3 py-2 border-b border-[#1f2937]">
              <span className="text-[10px] text-[#b8c5d6] uppercase tracking-wider font-medium">{headerLabel}</span>
            </div>
            <div className="py-1">
              {/* Actions relance — toujours visibles (uniques au métier) */}
              {!multi && (
                <button
                  onClick={() => { if (ctxRow) handleCreateDraft(ctxRow.id); setContextMenu(null); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#b8c5d6] hover:bg-white/[0.06] hover:text-white transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 text-primary" />{t("relances.createDraft", "Créer la relance")}
                </button>
              )}
              <button
                onClick={() => { if (multi) handleBulkMarkReplied(); else if (ctxRow) handleMarkReplied(ctxRow.id); setContextMenu(null); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#b8c5d6] hover:bg-white/[0.06] hover:text-white transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                {t("relances.markReplied", "Marquer comme répondu")}{multi && ` (${selectedIds.size})`}
              </button>
              <button
                onClick={() => { if (multi) handleBulkDismiss(); else if (ctxRow) handleDismiss(ctxRow.id); setContextMenu(null); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#b8c5d6] hover:bg-white/[0.06] hover:text-white transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                {t("relances.dismiss", "Ignorer")}{multi && ` (${selectedIds.size})`}
              </button>

              {/* Actions email — parité Réception/Envoyés/Projets */}
              {!multi && eId && (
                <>
                  <div className="border-t border-[#1f2937] my-1" />
                  <button onClick={() => { setSelectedEmailId(eId); setContextMenu(null); setSelectedIds(new Set()); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#b8c5d6] hover:bg-white/[0.06] hover:text-white transition-colors">
                    <ChevronRight className="w-3.5 h-3.5" />{t("inbox.openEmail", "Ouvrir l'email")}
                  </button>
                  <button onClick={() => handleQuickReply(eId)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#b8c5d6] hover:bg-white/[0.06] hover:text-white transition-colors">
                    <Reply className="w-3.5 h-3.5" />{t("inbox.reply", "Répondre")}
                  </button>
                  <button onClick={() => handleQuickForward(eId)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#b8c5d6] hover:bg-white/[0.06] hover:text-white transition-colors">
                    <Forward className="w-3.5 h-3.5" />{t("inbox.forward", "Transférer")}
                  </button>
                  <button onClick={() => { handleQuickCreateTask(eId); setContextMenu(null); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#b8c5d6] hover:bg-white/[0.06] hover:text-white transition-colors">
                    <ListTodo className="w-3.5 h-3.5" />{t("inbox.createTask", "Créer une tâche")}
                  </button>
                  <div className="border-t border-[#1f2937] my-1" />
                  <button onClick={() => { handleToggleRead(eId); setContextMenu(null); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#b8c5d6] hover:bg-white/[0.06] hover:text-white transition-colors">
                    {isUnread
                      ? (<><MailOpen className="w-3.5 h-3.5" />{t("inbox.markAsRead", "Marquer comme lu")}</>)
                      : (<><Mail className="w-3.5 h-3.5" />{t("inbox.markAsUnread", "Marquer comme non lu")}</>)}
                  </button>
                  <button onClick={() => { handleQuickSnooze(eId, 1, t("wave1.snooze1h", "Dans 1 h")); setContextMenu(null); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#b8c5d6] hover:bg-white/[0.06] hover:text-white transition-colors">
                    <Clock className="w-3.5 h-3.5" />{t("wave1.snooze1h", "Reporter — Dans 1 h")}
                  </button>
                  <button onClick={() => { handleQuickSnooze(eId, 24, t("wave1.snoozeTomorrow", "Demain matin")); setContextMenu(null); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#b8c5d6] hover:bg-white/[0.06] hover:text-white transition-colors">
                    <Bell className="w-3.5 h-3.5" />{t("wave1.snoozeTomorrow", "Reporter — Demain matin")}
                  </button>
                  <button onClick={() => { handleQuickSnooze(eId, 168, t("wave1.snoozeNextWeek", "Semaine prochaine")); setContextMenu(null); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#b8c5d6] hover:bg-white/[0.06] hover:text-white transition-colors">
                    <CalendarDays className="w-3.5 h-3.5" />{t("wave1.snoozeNextWeek", "Reporter — Semaine prochaine")}
                  </button>
                  <button onClick={() => { handleArchiveOne(eId); setContextMenu(null); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#b8c5d6] hover:bg-white/[0.06] hover:text-white transition-colors">
                    <Archive className="w-3.5 h-3.5" />{t("inbox.archive", "Archiver")}
                  </button>
                  {categoryCounts && (categoryCounts as any[]).length > 0 && (
                    <div className="px-3 py-1.5 text-[10px] text-[#6b7280] uppercase tracking-wider">{t("inbox.category", "Catégorie")}</div>
                  )}
                  {(categoryCounts as any[] | undefined)?.slice(0, 8).map((c: any) => (
                    <button key={c.categoryId}
                      onClick={() => { handleQuickSetCategory(eId, c.categoryId, c.categoryName); setContextMenu(null); }}
                      className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[12px] text-[#b8c5d6] hover:bg-white/[0.06] hover:text-white transition-colors">
                      {c.color && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c.color }} />}
                      <span className="truncate">{c.categoryName}</span>
                    </button>
                  ))}
                  {userFolders && (userFolders as any[]).length > 0 && (
                    <div className="px-3 py-1.5 text-[10px] text-[#6b7280] uppercase tracking-wider">{t("inbox.moveToFolder", { defaultValue: "Déplacer vers" })}</div>
                  )}
                  {(userFolders as any[] | undefined)?.slice(0, 8).map((fo: any) => (
                    <button key={fo.id}
                      onClick={() => { handleMoveToFolder([eId], fo.id, fo.name); setContextMenu(null); }}
                      className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[12px] text-[#b8c5d6] hover:bg-white/[0.06] hover:text-white transition-colors">
                      <Folder className="w-3.5 h-3.5 text-primary/70" />
                      <span className="truncate">{fo.name}</span>
                    </button>
                  ))}
                  <div className="border-t border-[#1f2937] my-1" />
                  <button onClick={() => { handleCopyRecipient(eId); setContextMenu(null); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#b8c5d6] hover:bg-white/[0.06] hover:text-white transition-colors">
                    <Copy className="w-3.5 h-3.5" />{t("inbox.copyAddress", "Copier l'adresse")}
                  </button>
                  <button onClick={() => { handleCopySubject(eId); setContextMenu(null); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#b8c5d6] hover:bg-white/[0.06] hover:text-white transition-colors">
                    <TypeIcon className="w-3.5 h-3.5" />{t("inbox.copySubject", "Copier le sujet")}
                  </button>
                  <button onClick={() => { handleDownloadEml(eId); setContextMenu(null); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#b8c5d6] hover:bg-white/[0.06] hover:text-white transition-colors">
                    <Download className="w-3.5 h-3.5" />{t("inbox.downloadEml", "Télécharger en .eml")}
                  </button>
                  <button onClick={() => { handlePrintEmail(eId); setContextMenu(null); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#b8c5d6] hover:bg-white/[0.06] hover:text-white transition-colors">
                    <Printer className="w-3.5 h-3.5" />{t("inbox.print", "Imprimer")}
                  </button>
                  <div className="border-t border-[#1f2937] my-1" />
                  <button
                    onClick={() => { handleDeleteEmail(eId); setContextMenu(null); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-red-400/80 hover:bg-red-500/[0.08] hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />{t("inbox.deleteEmail", "Supprimer l'email")}
                  </button>
                </>
              )}
            </div>
          </div>
        );
      })()}
      <MailReadingPane
        open={readingPaneEnabled && !!selectedEmailId}
        onClose={() => setSelectedEmailId(null)}
      >
        {selectedEmailId ? (
          <div className="px-3 py-3">
            <RelanceEmailDetailView
              emailId={selectedEmailId}
              onBack={() => setSelectedEmailId(null)}
              projects={(projects as any[]) || []}
            />
          </div>
        ) : null}
      </MailReadingPane>
    </DashboardLayout>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Vue détail email — alignée sur Envoyés (utilise EmailDetail pour parité
// pleine avec la Réception : en-tête, actions, fil de conversation, etc.).
// ─────────────────────────────────────────────────────────────────────────
function RelanceEmailDetailView({
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
