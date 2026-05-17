import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { MailPageHeader } from "@/components/email-list/MailPageHeader";
import { MailReadingPane } from "@/components/email-list/MailReadingPane";
import { useReadingPaneEnabled } from "@/lib/use-reading-pane";
import { EmailBodyRenderer } from "@/components/EmailBodyRenderer";
import { AttachmentList } from "@/components/AttachmentList";
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
  useSnoozeEmail,
  useUnsnoozeEmail,
  useListFolders,
  useAssignEmailsToFolder,
  getListEmailsQueryKey,
  getGetProfileQueryKey,
  getListTasksQueryKey,
  getListFoldersQueryKey,
} from "@workspace/api-client-react";
import { HoverActions, type HoverActionsCb } from "@/components/email-list/HoverActions";
import { useQuery } from "@tanstack/react-query";
import { EmailDetail } from "@/components/email-detail/EmailDetail";
import type { UploadedFile } from "@/components/FileAttachInput";
import type { PaginatedEmails } from "@workspace/api-client-react";
import { format } from "date-fns";
import { fr, enUS, nl, de, es, it, pt, pl, ro, sv, da, fi, hu, cs, tr, ja, ko, vi, th, id, ms, el } from "date-fns/locale";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import {
  Send,
  BellOff,
  ArrowLeft,
  Reply,
  FolderKanban,
  Download,
  Loader2,
  User,
  Paperclip,
  CalendarDays,
  Trash2,
  ChevronRight,
  CheckSquare,
  Square,
  Check,
  Forward,
  Printer,
  Copy,
  ListTodo,
  Type as TypeIcon,
  Archive,
  Mail,
  MailOpen,
  Clock,
  Bell,
  Folder,
  ShieldAlert,
} from "lucide-react";
import { extractEmailAddress } from "@/lib/utils";
import { useState, useEffect, useLayoutEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { BackToInboxButton } from "@/components/dashboard/back-to-inbox-button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useEnableLightTheme } from "@/lib/inbox-theme";

export default function Reportes() {
  useEnableLightTheme();
  const { t, i18n } = useTranslation();
  const dateFnsLocale = ({fr,en:enUS,nl,de,es,it,pt,pl}[(i18n.resolvedLanguage || i18n.language || "fr").substring(0,2)] || fr);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedEmailId, setSelectedEmailId] = useState<number | null>(null);
  const [readingPaneEnabled] = useReadingPaneEnabled();
  const [page, setPage] = useState(1);
  const [accumulated, setAccumulated] = useState<any[]>([]);

  // IMPORTANT : le backend (artifacts/api-server/src/routes/emails.ts L250-279)
  // filtre les reportés via le query param `?snoozed=1` (pas `?status=snoozed`,
  // qui matcherait littéralement la colonne `status` qui ne contient jamais
  // "snoozed" — un mail reporté reste `non_lu`/`read`/etc. avec juste
  // `snoozed_until` rempli). Sans `snoozed=1`, la route applique en plus son
  // filtre par défaut « snoozed_until IS NULL OR <= now » qui exclut justement
  // tous les reportés. On passe donc snoozed=1 (cast any car hors typing
  // OpenAPI généré).
  const { data: emailsData, isLoading, isFetching } = useListEmails({ snoozed: "1", limit: 50, page } as any, { query: { placeholderData: (prev: any) => prev } as any });
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

  const [headerSearch, setHeaderSearch] = useState("");
  const snoozedEmails = (() => {
    const q = headerSearch.trim().toLowerCase();
    if (!q) return accumulated;
    return accumulated.filter((e: any) => {
      const subject = String(e.subject ?? "").toLowerCase();
      const recipient = String(e.recipient ?? e.to ?? "").toLowerCase();
      const preview = String(e.preview ?? e.bodyText ?? "").toLowerCase();
      return subject.includes(q) || recipient.includes(q) || preview.includes(q);
    });
  })();
  const { data: projects } = useListProjects();
  const updateEmail = useUpdateEmail();
  const deleteEmail = useDeleteEmail();
  const createTaskMut = useCreateTask();
  const snoozeMut = useSnoozeEmail();
  const unsnoozeMut = useUnsnoozeEmail();
  const { data: categoryCounts } = useGetCategoryCounts({ scope: "personal" } as any);
  const { data: userFolders } = useListFolders();
  const assignToFolderMut = useAssignEmailsToFolder();

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; emailId: number } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  // Auto-flip du menu contextuel — même logique que dashboard/index.tsx :
  // on mesure la hauteur réelle après render et on remonte le menu si pas
  // la place dessous, on le décale à gauche si pas la place à droite. Le
  // menu reste invisible (opacity 0) tant que la position n'est pas prête
  // pour éviter le flash de bascule.
  const [ctxMenuPos, setCtxMenuPos] = useState<{ top: number; left: number; ready: boolean }>({ top: 0, left: 0, ready: false });
  useLayoutEffect(() => {
    if (!contextMenu) { setCtxMenuPos({ top: 0, left: 0, ready: false }); return; }
    const el = contextMenuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const margin = 8;
    let top = contextMenu.y;
    let left = contextMenu.x;
    if (top + rect.height > window.innerHeight - margin) {
      top = Math.max(margin, contextMenu.y - rect.height);
    }
    if (top < margin) top = margin;
    if (left + rect.width > window.innerWidth - margin) {
      left = Math.max(margin, contextMenu.x - rect.width);
    }
    if (left < margin) left = margin;
    setCtxMenuPos({ top, left, ready: true });
  }, [contextMenu]);
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

  // Helpers parité Réception : copie compatible iframe + actions rapides
  // (transférer, créer une tâche, copier destinataire/sujet, télécharger
  // .eml, imprimer). Mêmes patterns que dashboard/index.tsx.
  const copyToClipboardSafe = async (text: string): Promise<boolean> => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {/* fallback */}
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.top = "-1000px";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, text.length);
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch { return false; }
  };

  const handleQuickForward = (id: number) => {
    setSelectedEmailId(id);
    setContextMenu(null);
    setSelectedIds(new Set());
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("inbox-forward-shortcut", { detail: { emailId: id } }));
    }, 150);
  };

  const handleQuickReply = (id: number) => {
    setSelectedEmailId(id);
    setContextMenu(null);
    setSelectedIds(new Set());
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("inbox-reply-shortcut", { detail: { emailId: id } }));
    }, 150);
  };

  const handleQuickCreateTask = (id: number) => {
    const email = snoozedEmails.find((e: any) => e.id === id);
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

  const handleCopySender = async (id: number) => {
    const email = snoozedEmails.find((e: any) => e.id === id);
    const addr = (extractEmailAddress(email?.sender || "") || email?.sender || "").trim();
    if (!addr) {
      toast({ variant: "destructive", title: t("common.error"), description: "Adresse introuvable" });
      return;
    }
    const ok = await copyToClipboardSafe(addr);
    if (ok) toast({ title: t("inbox.copied", "Copié"), description: addr });
    else toast({ variant: "destructive", title: t("common.error"), description: "Copie impossible" });
  };

  const handleCopySubject = async (id: number) => {
    const email = snoozedEmails.find((e: any) => e.id === id);
    const subject = (email?.subject || "").trim();
    if (!subject) {
      toast({ variant: "destructive", title: t("common.error"), description: "Aucun sujet" });
      return;
    }
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
      const res = await fetch(`${baseUrl}/api/emails/${id}/export.eml`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
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
    const email = snoozedEmails.find((e: any) => e.id === id);
    if (!email) return;
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
      <div class="meta"><b>${(email.sender || "").replace(/[<>]/g, "")}</b><br/>${email.createdAt ? new Date(email.createdAt).toLocaleString() : ""}</div>
      <div>${safeBody}</div>
      </body></html>`);
    w.document.close();
    setTimeout(() => { try { w.focus(); w.print(); } catch {} }, 300);
  };

  // Parité Réception — Marquer lu/non lu, Reporter, Archiver, Catégorie,
  // Déplacer vers dossier. Block sender masqué côté Envoyés (n'a pas de
  // sens : on ne se bloque pas soi-même).
  const handleToggleRead = (id: number) => {
    const email = snoozedEmails.find((e: any) => e.id === id);
    const isUnread = email?.status === "non_lu" || email?.isRead === false || (email as any)?.unread === true;
    const newStatus = isUnread ? "read" : "non_lu";
    updateEmail.mutate(
      { id, data: { status: newStatus } as any },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListEmailsQueryKey() });
          toast({ title: isUnread ? t("inbox.markedAsRead", "Marqué comme lu") : t("inbox.markedAsUnread", "Marqué comme non lu") });
        },
      },
    );
  };

  const handleQuickSnooze = (id: number, hours: number, label: string) => {
    let date: Date;
    if (hours === 24) {
      date = new Date(); date.setDate(date.getDate() + 1); date.setHours(9, 0, 0, 0);
    } else if (hours === 168) {
      date = new Date(); const day = date.getDay(); const diff = (8 - day) % 7 || 7;
      date.setDate(date.getDate() + diff); date.setHours(9, 0, 0, 0);
    } else {
      date = new Date(Date.now() + hours * 60 * 60 * 1000);
    }
    snoozeMut.mutate(
      { id, data: { snoozeUntil: date.toISOString() } as any },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListEmailsQueryKey() });
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
          queryClient.invalidateQueries({ queryKey: getListEmailsQueryKey() });
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
          queryClient.invalidateQueries({ queryKey: getListEmailsQueryKey() });
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
      queryClient.invalidateQueries({ queryKey: getListEmailsQueryKey() });
    } catch {
      toast({ title: t("folders.moveFailed", { defaultValue: "Échec du déplacement." }), variant: "destructive" });
    }
  };

  const handleDeleteOne = (id: number) => {
    deleteEmail.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListEmailsQueryKey() });
        toast({ title: t("inbox.emailDeleted") });
      },
    });
  };

  const buildHoverCb = (email: any): HoverActionsCb => ({
    onOpen: () => setSelectedEmailId(email.id),
    onReply: () => handleQuickReply(email.id),
    onForward: () => handleQuickForward(email.id),
    onCreateTask: () => handleQuickCreateTask(email.id),
    onToggleRead: () => handleToggleRead(email.id),
    onSnooze: (hours, label) => handleQuickSnooze(email.id, hours, label),
    onArchive: () => handleArchiveOne(email.id),
    onSetCategory: (categoryId, name) => handleQuickSetCategory(email.id, categoryId, name),
    onMove: (folderId, name) => handleMoveToFolder([email.id], folderId, name),
    onCopySender: () => handleCopySender(email.id),
    onCopySubject: () => handleCopySubject(email.id),
    onDownloadEml: () => handleDownloadEml(email.id),
    onPrint: () => handlePrintEmail(email.id),
    onBlockSender: () => { /* TODO Reportés : raccord backend bloquer expéditeur */ },
    onDelete: () => handleDeleteOne(email.id),
    onUnsnooze: () => handleUnsnoozeOne(email.id),
  });

  // Reportés — Réveiller maintenant : sort l'email de l'état snoozed et
  // le renvoie en Réception. Invalide la liste pour qu'il disparaisse de
  // la vue courante. Utilise la mutation générée useUnsnoozeEmail.
  const handleUnsnoozeOne = (id: number) => {
    unsnoozeMut.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListEmailsQueryKey() });
          toast({ title: t("wave1.unsnoozeSuccess", "Réveillé — de retour en Réception") });
        },
        onError: (e: any) => toast({ variant: "destructive", title: e?.message || "Échec du réveil" }),
      },
    );
  };

  if (selectedEmailId && !readingPaneEnabled) {
    return (
      <DashboardLayout>
        <div className="max-w-[1600px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-5">
          <SnoozedEmailDetailView
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
      <MailPageHeader
        currentTab="reportes"
        searchValue={headerSearch}
        onSearchChange={setHeaderSearch}
      />
      <div className="max-w-[1600px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-5">
        <BackToInboxButton />
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-[16px] font-semibold text-white tracking-tight flex items-center gap-2">
              <BellOff className="w-4 h-4 text-[#b8c5d6]" />
              Emails reportés
            </h1>
            <p className="text-[12px] text-[#b8c5d6] mt-0.5">
              {(paged?.total || snoozedEmails.length)} email{(paged?.total || snoozedEmails.length) > 1 ? "s" : ""} reporté{(paged?.total || snoozedEmails.length) > 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 rounded-lg border border-border border-dashed bg-card/50">
            <Loader2 className="w-6 h-6 text-primary animate-spin mb-3" />
            <h3 className="text-[13px] font-medium text-white">{t("inbox.loadingTitle", "Chargement de vos emails…")}</h3>
          </div>
        ) : snoozedEmails.length === 0 ? (
          <div className="text-center py-16 rounded-lg border border-border border-dashed bg-card/50">
            <BellOff className="mx-auto h-8 w-8 text-[#b8c5d6]/20 mb-2" />
            <h3 className="text-[13px] font-medium text-white mb-1">Aucun email reporté</h3>
            <p className="text-[12px] text-[#b8c5d6]">Les emails que vous reportez réapparaîtront ici jusqu'à leur réveil.</p>
          </div>
        ) : (
          <>
            <div className="space-y-1">
              {snoozedEmails.map((email) => {
                const isSelected = selectedIds.has(email.id);
                const snoozedUntilStr = (email as any).snoozedUntil as string | undefined;
                const snoozedUntilTitle = snoozedUntilStr
                  ? `Réveille le ${format(new Date(snoozedUntilStr), "PPp", { locale: dateFnsLocale })}`
                  : undefined;
                return (
                  <div
                    key={email.id}
                    data-email-row
                    title={snoozedUntilTitle}
                    className={`group relative flex items-center gap-3 h-[52px] pl-2 pr-3 cursor-pointer select-none border-l-2 border-b border-border/40 transition-colors ${
                      isSelected
                        ? "border-l-primary bg-primary/[0.10]"
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
                    onContextMenu={(e) => handleContextMenu(e, email.id)}
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

                    {/* Avatar — bleu, première lettre de l'expéditeur */}
                    <div className="w-7 h-7 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
                      <span className="text-primary text-[11px] font-semibold">
                        {(email.sender || "?").trim()[0]?.toUpperCase() || "?"}
                      </span>
                    </div>

                    {/* Expéditeur (largeur fixe) */}
                    <div className="w-[140px] shrink-0 flex items-center gap-1.5 min-w-0">
                      <span className="text-[13px] truncate text-white font-semibold">
                        {email.sender || "Inconnu"}
                      </span>
                    </div>

                    {/* Sujet — extrait */}
                    <div className="flex-1 min-w-0 flex items-baseline gap-2 overflow-hidden">
                      <span className="text-[13px] truncate text-white font-semibold">
                        {email.subject}
                      </span>
                      {email.summary && (
                        <span className="text-[13px] truncate text-[#8b95a7]">— {email.summary}</span>
                      )}
                    </div>

                    {/* Indicateurs + date de réveil */}
                    <div className="flex items-center gap-2 shrink-0 group-hover:hidden">
                      {(email as any).attachmentCount > 0 && (
                        <Paperclip className="w-3 h-3 text-[#8b95a7]" />
                      )}
                      <Clock className="w-3 h-3 text-primary/70" />
                      <span className="text-[11px] tabular-nums text-primary/80 w-20 text-right whitespace-nowrap hidden sm:inline">
                        {snoozedUntilStr ? format(new Date(snoozedUntilStr), "d MMM HH:mm", { locale: dateFnsLocale }) : ""}
                      </span>
                    </div>

                    {/* Barre d'actions au survol — parité 1:1 avec Réception
                        + bouton « Réveiller maintenant » en tête (spécifique
                        Reportés). */}
                    <HoverActions
                      isUnread={(email as any).status === "non_lu" || (email as any).isRead === false || (email as any).unread === true}
                      categoryCounts={categoryCounts as any[] | undefined}
                      userFolders={userFolders as any[] | undefined}
                      cb={buildHoverCb(email)}
                      showBlockSender={false}
                      showUnsnooze={true}
                    />
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
          <div data-selection-bar className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-card border border-border rounded-lg shadow-2xl px-4 py-2 flex items-center gap-3">
            <span className="text-[11px] text-foreground">{t("inbox.selectedCount", { count: selectedIds.size })}</span>
            <button onClick={handleBulkDelete} className="flex items-center gap-1.5 text-[11px] text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 transition-colors">
              <Trash2 className="w-3 h-3" />{t("inbox.deleteEmail")}
            </button>
            <button onClick={() => setSelectedIds(new Set())} className="text-[11px] text-foreground/70 hover:text-foreground transition-colors ml-2">{t("common.cancel")}</button>
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
                : snoozedEmails.find(e => e.id === contextMenu.emailId)?.subject?.substring(0, 30) + "..."
              }
            </span>
          </div>
          <div className="py-1">
            {selectedIds.size <= 1 && (
              <>
                <button
                  onClick={() => { setSelectedEmailId(contextMenu.emailId); setContextMenu(null); setSelectedIds(new Set()); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#b8c5d6] hover:bg-white/[0.06] hover:text-white transition-colors"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                  {t("inbox.openEmail")}
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
                    const email = snoozedEmails.find((e: any) => e.id === contextMenu.emailId);
                    const isUnread = email?.status === "non_lu" || (email as any)?.isRead === false || (email as any)?.unread === true;
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
                <button onClick={() => { handleArchiveOne(contextMenu.emailId); setContextMenu(null); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#b8c5d6] hover:bg-white/[0.06] hover:text-white transition-colors">
                  <Archive className="w-3.5 h-3.5" />{t("inbox.archive")}
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
                  <Copy className="w-3.5 h-3.5" />{t("inbox.copyAddress", "Copier l'adresse")}
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
              </>
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
      <MailReadingPane
        open={readingPaneEnabled && !!selectedEmailId}
        onClose={() => setSelectedEmailId(null)}
      >
        {selectedEmailId ? (
          <div className="px-3 py-3">
            <SnoozedEmailDetailView
              emailId={selectedEmailId}
              onBack={() => setSelectedEmailId(null)}
              projects={projects || []}
            />
          </div>
        ) : null}
      </MailReadingPane>
    </DashboardLayout>
  );
}

// Vue détail Envoyés alignée sur la Réception : utilise EmailDetail pour
// garantir une expérience identique (en-tête, actions, dropdowns, fil de
// conversation, notes internes, panneaux CRM).
function SnoozedEmailDetailView({
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
