import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { MailPageHeader } from "@/components/email-list/MailPageHeader";
import { EmailDetailContainer } from "@/components/email-detail/EmailDetailContainer";
import { useEnableLightTheme } from "@/lib/inbox-theme";
import {
  useListFolders,
  useCreateFolder,
  useUpdateFolder,
  useDeleteFolder,
  useListFolderEmails,
  useGenerateFolderPrompt,
  useUnassignEmailsFromFolder,
  useUpdateEmail,
  useDeleteEmail,
  useCreateTask,
  useSnoozeEmail,
  useGetCategoryCounts,
  useAssignEmailsToFolder,
  getListFoldersQueryKey,
  getListFolderEmailsQueryKey,
  getListEmailsQueryKey,
  getListTasksQueryKey,
} from "@workspace/api-client-react";
import type { UserFolder, Email } from "@workspace/api-client-react";
import { HoverActions, type HoverActionsCb } from "@/components/email-list/HoverActions";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useRef, useEffect, useLayoutEffect } from "react";
import { extractEmailAddress } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { BackToInboxButton } from "@/components/dashboard/back-to-inbox-button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  FolderOpen,
  Plus,
  Sparkles,
  Edit2,
  Trash2,
  ArrowLeft,
  Loader2,
  Wand2,
  X,
  Paperclip,
  ChevronRight,
  Reply,
  Forward,
  ListTodo,
  Mail,
  MailOpen,
  Clock,
  Bell,
  CalendarDays,
  Archive,
  Folder,
  Copy,
  Type as TypeIcon,
  Download,
  Printer,
} from "lucide-react";
import { format } from "date-fns";
import { fr, enUS, nl, de, es, it, pt, pl } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

type DraftFolder = {
  name: string;
  description: string;
  keywords: string;
  aiPrompt: string;
  shortBrief: string;
};

const EMPTY_DRAFT: DraftFolder = {
  name: "",
  description: "",
  keywords: "",
  aiPrompt: "",
  shortBrief: "",
};

function parseKeywords(raw: string): string[] {
  return raw
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, 50);
}

export default function MesDossiers() {
  useEnableLightTheme();
  const { t, i18n } = useTranslation();
  const dateFnsLocale = ({fr,en:enUS,nl,de,es,it,pt,pl}[(i18n.resolvedLanguage || i18n.language || "fr").substring(0,2)] || fr);
  const { toast } = useToast();
  const qc = useQueryClient();

  const [openCreate, setOpenCreate] = useState(false);
  const [draft, setDraft] = useState<DraftFolder>(EMPTY_DRAFT);
  const [editingFolder, setEditingFolder] = useState<UserFolder | null>(null);
  const [folderToDelete, setFolderToDelete] = useState<UserFolder | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedEmailId, setSelectedEmailId] = useState<number | null>(null);
  const [headerSearch, setHeaderSearch] = useState("");

  const { data: folders, isLoading } = useListFolders();
  const createFolder = useCreateFolder();
  const updateFolder = useUpdateFolder();
  const deleteFolder = useDeleteFolder();
  const generatePrompt = useGenerateFolderPrompt();
  const unassign = useUnassignEmailsFromFolder();
  const updateEmail = useUpdateEmail();
  const deleteEmail = useDeleteEmail();
  const createTaskMut = useCreateTask();
  const snoozeMut = useSnoozeEmail();
  const { data: categoryCounts } = useGetCategoryCounts({ scope: "personal" } as any);
  const assignToFolderMut = useAssignEmailsToFolder();

  // Menu contextuel + auto-flip (parité Réception/Envoyés)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; emailId: number } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
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

  const selectedFolder = useMemo(
    () => (folders || []).find((f) => f.id === selectedFolderId) || null,
    [folders, selectedFolderId],
  );

  const { data: folderEmailsData, isLoading: loadingFolderEmails } = useListFolderEmails(
    selectedFolderId || "",
    {},
    {
      query: {
        enabled: Boolean(selectedFolderId) && !selectedEmailId,
        queryKey: getListFolderEmailsQueryKey(selectedFolderId || ""),
      },
    },
  );

  const resetDraft = () => setDraft(EMPTY_DRAFT);

  const openCreateDialog = () => {
    resetDraft();
    setEditingFolder(null);
    setOpenCreate(true);
  };

  const openEditDialog = (f: UserFolder) => {
    setEditingFolder(f);
    setDraft({
      name: f.name,
      description: f.description || "",
      keywords: (f.keywords || []).join(", "),
      aiPrompt: f.aiPrompt || "",
      shortBrief: "",
    });
    setOpenCreate(true);
  };

  const handleGeneratePrompt = async () => {
    if (!draft.name.trim()) {
      toast({
        title: t("folders.nameRequired", { defaultValue: "Donnez d'abord un nom au dossier." }),
        variant: "destructive",
      });
      return;
    }
    try {
      const out = await generatePrompt.mutateAsync({
        data: {
          folderName: draft.name.trim(),
          keywords: parseKeywords(draft.keywords),
          shortBrief: draft.shortBrief.trim() || null,
        },
      });
      setDraft((d) => ({ ...d, aiPrompt: out.prompt }));
      toast({ title: t("folders.promptGenerated", { defaultValue: "Prompt généré." }) });
    } catch (e: any) {
      toast({
        title: t("folders.promptFailed", { defaultValue: "Échec de la génération." }),
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async () => {
    if (!draft.name.trim()) return;
    const payload = {
      name: draft.name.trim(),
      description: draft.description.trim() || null,
      keywords: parseKeywords(draft.keywords),
      aiPrompt: draft.aiPrompt.trim() || null,
    };
    try {
      if (editingFolder) {
        await updateFolder.mutateAsync({ id: editingFolder.id, data: payload });
        toast({ title: t("folders.updated", { defaultValue: "Dossier mis à jour." }) });
      } else {
        await createFolder.mutateAsync({ data: payload });
        toast({ title: t("folders.created", { defaultValue: "Dossier créé." }) });
      }
      setOpenCreate(false);
      resetDraft();
      qc.invalidateQueries({ queryKey: getListFoldersQueryKey() });
    } catch {
      toast({
        title: t("folders.saveFailed", { defaultValue: "Échec de l'enregistrement." }),
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!folderToDelete) return;
    try {
      await deleteFolder.mutateAsync({ id: folderToDelete.id });
      toast({ title: t("folders.deleted", { defaultValue: "Dossier supprimé." }) });
      if (selectedFolderId === folderToDelete.id) setSelectedFolderId(null);
      qc.invalidateQueries({ queryKey: getListFoldersQueryKey() });
    } finally {
      setFolderToDelete(null);
    }
  };

  const handleUnassign = async (emailId: number) => {
    if (!selectedFolderId) return;
    await unassign.mutateAsync({
      data: { folderId: selectedFolderId, emailIds: [emailId] },
    });
    qc.invalidateQueries({ queryKey: getListFolderEmailsQueryKey(selectedFolderId) });
    qc.invalidateQueries({ queryKey: getListFoldersQueryKey() });
  };

  const folderEmails: any[] = (folderEmailsData as any)?.emails || [];

  const invalidateFolderEmails = () => {
    if (selectedFolderId) {
      qc.invalidateQueries({ queryKey: getListFolderEmailsQueryKey(selectedFolderId) });
    }
    qc.invalidateQueries({ queryKey: getListEmailsQueryKey() });
  };

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

  const handleQuickReply = (id: number) => {
    setSelectedEmailId(id);
    setContextMenu(null);
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("inbox-reply-shortcut", { detail: { emailId: id } }));
    }, 150);
  };
  const handleQuickForward = (id: number) => {
    setSelectedEmailId(id);
    setContextMenu(null);
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("inbox-forward-shortcut", { detail: { emailId: id } }));
    }, 150);
  };
  const handleQuickCreateTask = (id: number) => {
    const email = folderEmails.find((e: any) => e.id === id);
    const title = (email?.subject || "Tâche").slice(0, 200);
    createTaskMut.mutate(
      { data: { title, emailId: id } as any },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListTasksQueryKey() });
          toast({ title: t("inbox.taskCreated", "Tâche créée"), description: title });
        },
        onError: (e: any) => toast({ variant: "destructive", title: t("common.error"), description: e?.message }),
      },
    );
  };
  const handleToggleRead = (id: number) => {
    const email = folderEmails.find((e: any) => e.id === id);
    const isUnread = email?.status === "non_lu";
    const newStatus = isUnread ? "read" : "non_lu";
    updateEmail.mutate(
      { id, data: { status: newStatus } as any },
      {
        onSuccess: () => {
          invalidateFolderEmails();
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
        onSuccess: () => { invalidateFolderEmails(); toast({ title: t("wave1.snoozeSuccess", "Reporté"), description: label }); },
        onError: (e: any) => toast({ variant: "destructive", title: e?.message || "Échec" }),
      },
    );
  };
  const handleArchiveOne = (id: number) => {
    updateEmail.mutate(
      { id, data: { status: "archived" } as any },
      {
        onSuccess: () => { invalidateFolderEmails(); toast({ title: t("inbox.archived", "Archivé") }); },
      },
    );
  };
  const handleQuickSetCategory = (id: number, categoryId: string, categoryName: string) => {
    updateEmail.mutate(
      { id, data: { categoryId } as any },
      {
        onSuccess: () => { invalidateFolderEmails(); toast({ title: t("inbox.categorized", "Catégorisé"), description: categoryName }); },
      },
    );
  };
  const handleMoveToFolder = async (emailIds: number[], folderId: string, folderName: string) => {
    try {
      await assignToFolderMut.mutateAsync({ data: { folderId, emailIds } as any });
      toast({ title: t("folders.movedToast", { defaultValue: "Déplacé dans « {{name}} »", name: folderName }) });
      qc.invalidateQueries({ queryKey: getListFoldersQueryKey() });
      invalidateFolderEmails();
    } catch {
      toast({ title: t("folders.moveFailed", { defaultValue: "Échec du déplacement." }), variant: "destructive" });
    }
  };
  const handleCopySender = async (id: number) => {
    const email = folderEmails.find((e: any) => e.id === id);
    const addr = (extractEmailAddress(email?.sender || "") || email?.sender || "").trim();
    if (!addr) { toast({ variant: "destructive", title: t("common.error"), description: "Adresse introuvable" }); return; }
    const ok = await copyToClipboardSafe(addr);
    if (ok) toast({ title: t("inbox.copied", "Copié"), description: addr });
  };
  const handleCopySubject = async (id: number) => {
    const email = folderEmails.find((e: any) => e.id === id);
    const subject = (email?.subject || "").trim();
    if (!subject) return;
    const ok = await copyToClipboardSafe(subject);
    if (ok) toast({ title: t("inbox.copied", "Copié"), description: subject });
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
    const email = folderEmails.find((e: any) => e.id === id);
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
  const handleDeleteOne = (id: number) => {
    deleteEmail.mutate({ id }, {
      onSuccess: () => { invalidateFolderEmails(); toast({ title: t("inbox.emailDeleted") }); },
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
    onBlockSender: () => { /* non exposé ici */ },
    onDelete: () => handleDeleteOne(email.id),
  });

  const handleContextMenu = (e: React.MouseEvent, emailId: number) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, emailId });
  };

  // Vue détail email (sélectionné dans un dossier)
  if (selectedEmailId) {
    return (
      <DashboardLayout>
        <div className="max-w-[1600px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedEmailId(null)}
            className="h-8 px-2 mb-3 text-[#b8c5d6] hover:text-white text-[12px]"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            {t("common.back", "Retour")}
          </Button>
          <EmailDetailContainer
            emailId={selectedEmailId}
            onBack={() => setSelectedEmailId(null)}
            onAfterMutation={() => {
              if (selectedFolderId) {
                qc.invalidateQueries({ queryKey: getListFolderEmailsQueryKey(selectedFolderId) });
              }
            }}
          />
        </div>
      </DashboardLayout>
    );
  }

  // Vue contenu d'un dossier
  if (selectedFolder) {
    const emails = folderEmailsData?.emails || [];
    return (
      <DashboardLayout>
        <div className="max-w-[1600px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center gap-3 mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedFolderId(null)}
              className="h-7 px-2 text-[#b8c5d6] hover:text-white text-[12px]"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              {t("common.back", "Retour")}
            </Button>
            <div className="flex-1" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openEditDialog(selectedFolder)}
              className="h-7 px-2 text-[#b8c5d6] hover:text-white text-[12px]"
            >
              <Edit2 className="w-3.5 h-3.5 mr-1" />
              {t("common.edit", "Modifier")}
            </Button>
          </div>

          <h1 className="text-[16px] font-semibold text-white mb-1">{selectedFolder.name}</h1>
          {selectedFolder.description && (
            <p className="text-[12px] text-[#b8c5d6] mb-4">{selectedFolder.description}</p>
          )}

          {loadingFolderEmails ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          ) : emails.length === 0 ? (
            <div className="text-center py-12 rounded-lg border border-border border-dashed bg-card/50">
              <FolderOpen className="mx-auto h-8 w-8 text-[#b8c5d6]/30 mb-2" />
              <p className="text-[12px] text-[#b8c5d6]">
                {t("folders.empty", { defaultValue: "Aucun email pour l'instant." })}
              </p>
            </div>
          ) : (
            <div>
              {emails.map((email: Email) => {
                const isUnread = email.status === "non_lu";
                const categoryLabel = email.categoryName;
                return (
                  <div
                    key={email.id}
                    data-email-row
                    className="group relative flex items-center gap-3 h-[52px] pl-2 pr-3 cursor-pointer select-none border-l-2 border-l-transparent border-b border-border/40 transition-colors hover:bg-white/[0.03]"
                    onClick={() => setSelectedEmailId(email.id)}
                    onContextMenu={(e) => handleContextMenu(e, email.id)}
                  >
                    {/* Avatar — bleu, première lettre de l'expéditeur */}
                    <div className="w-7 h-7 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0 ml-1">
                      <span className="text-primary text-[11px] font-semibold">
                        {(email.sender || "?").trim()[0]?.toUpperCase() || "?"}
                      </span>
                    </div>

                    {/* Expéditeur */}
                    <div className="w-[140px] shrink-0 flex items-center gap-1.5 min-w-0">
                      <span className={`text-[13px] truncate ${isUnread ? "text-white font-semibold" : "text-[#7a8290] font-normal"}`}>
                        {email.sender}
                      </span>
                    </div>

                    {/* Sujet — extrait — catégorie */}
                    <div className="flex-1 min-w-0 flex items-baseline gap-2 overflow-hidden">
                      <span className={`text-[13px] truncate ${isUnread ? "text-white font-semibold" : "text-[#7a8290] font-normal"}`}>
                        {email.subject}
                      </span>
                      {email.summary && (
                        <span className={`text-[13px] truncate ${isUnread ? "text-[#8b95a7]" : "text-[#5a6270]"}`}>
                          — {email.summary}
                        </span>
                      )}
                      {categoryLabel && (
                        <span className="text-[11px] lowercase shrink-0 text-[#6b7280]">
                          {categoryLabel}
                        </span>
                      )}
                    </div>

                    {/* Indicateurs + date */}
                    <div className="flex items-center gap-2 shrink-0 group-hover:hidden">
                      {(email.attachmentCount ?? 0) > 0 && (
                        <Paperclip className="w-3 h-3 text-[#8b95a7]" />
                      )}
                      <span className="text-[11px] tabular-nums text-[#8b95a7] w-12 text-right whitespace-nowrap hidden sm:inline">
                        {format(new Date(email.createdAt), "d MMM", { locale: dateFnsLocale })}
                      </span>
                    </div>

                    {/* Barre d'actions au survol — parité 1:1 avec Réception/Envoyés */}
                    <HoverActions
                      isUnread={isUnread}
                      categoryCounts={categoryCounts as any[] | undefined}
                      userFolders={folders as any[] | undefined}
                      cb={buildHoverCb(email)}
                      showBlockSender={false}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
        {/* Menu contextuel — parité 1:1 avec Réception/Envoyés */}
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
                {(folderEmails.find((e: any) => e.id === contextMenu.emailId)?.subject || "").substring(0, 30) + "…"}
              </span>
            </div>
            <div className="py-1">
              <button onClick={() => { setSelectedEmailId(contextMenu.emailId); setContextMenu(null); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#b8c5d6] hover:bg-white/[0.06] hover:text-white transition-colors">
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
                  const email = folderEmails.find((e: any) => e.id === contextMenu.emailId);
                  const isUnread = email?.status === "non_lu";
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
              {folders && (folders as any[]).length > 0 && (
                <div className="px-3 py-1.5 text-[10px] text-[#6b7280] uppercase tracking-wider">{t("inbox.moveToFolder", { defaultValue: "Déplacer vers" })}</div>
              )}
              {(folders as any[] | undefined)?.slice(0, 8).map((f: any) => (
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
              <div className="border-t border-[#1f2937] my-1" />
              <button onClick={() => { handleUnassign(contextMenu.emailId); setContextMenu(null); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#b8c5d6] hover:bg-white/[0.06] hover:text-white transition-colors">
                <X className="w-3.5 h-3.5" />{t("folders.removeFromFolder", { defaultValue: "Retirer du dossier" })}
              </button>
              <button onClick={() => { handleDeleteOne(contextMenu.emailId); setContextMenu(null); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-red-400/80 hover:bg-red-500/[0.08] hover:text-red-400 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />{t("inbox.deleteEmail")}
              </button>
            </div>
          </div>
        )}
        {renderEditor()}
      </DashboardLayout>
    );
  }

  // Vue liste des dossiers
  return (
    <DashboardLayout>
      <MailPageHeader
        currentTab="dossiers"
        searchValue={headerSearch}
        onSearchChange={setHeaderSearch}
      />
      <div className="max-w-[1600px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-5">
        <BackToInboxButton />
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-[16px] font-semibold text-white tracking-tight">
              {t("folders.title", { defaultValue: "Mes dossiers" })}
            </h1>
            <p className="text-[12px] text-[#b8c5d6] mt-0.5">
              {t("folders.subtitle", {
                defaultValue:
                  "Dossiers privés. Inboria classe automatiquement vos mails selon vos règles. Invisibles à vos collègues.",
              })}
            </p>
          </div>
          <Button onClick={openCreateDialog} size="sm" className="h-8 text-[12px] gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            {t("folders.new", { defaultValue: "Nouveau dossier" })}
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : !folders || folders.length === 0 ? (
          <div className="text-center py-16 rounded-lg border border-border border-dashed bg-card/50">
            <FolderOpen className="mx-auto h-8 w-8 text-[#b8c5d6]/20 mb-2" />
            <h3 className="text-[13px] font-medium text-white mb-1">
              {t("folders.noFolders", { defaultValue: "Aucun dossier" })}
            </h3>
            <p className="text-[12px] text-[#b8c5d6] mb-4">
              {t("folders.noFoldersDesc", {
                defaultValue: "Créez votre premier dossier pour ranger automatiquement vos emails.",
              })}
            </p>
            <Button onClick={openCreateDialog} size="sm" className="h-8 text-[12px] gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              {t("folders.createFirst", { defaultValue: "Créer un dossier" })}
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {folders
              .filter((f) => {
                const q = headerSearch.trim().toLowerCase();
                if (!q) return true;
                return (
                  String(f.name ?? "").toLowerCase().includes(q) ||
                  String((f as any).description ?? "").toLowerCase().includes(q)
                );
              })
              .map((f) => (
              <div
                key={f.id}
                className="bg-card rounded-lg border border-border p-4 hover:border-primary/30 transition-colors cursor-pointer group relative"
                onClick={() => setSelectedFolderId(f.id)}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
                    <FolderOpen className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditDialog(f);
                      }}
                      className="p-1 rounded hover:bg-white/[0.08] text-[#b8c5d6] hover:text-white"
                      title={t("common.edit", "Modifier")}
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setFolderToDelete(f);
                      }}
                      className="p-1 rounded hover:bg-red-500/10 text-[#b8c5d6] hover:text-red-400"
                      title={t("common.delete", "Supprimer")}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <h3 className="text-[13px] font-semibold text-white mb-0.5 truncate">{f.name}</h3>
                {f.description && (
                  <p className="text-[11px] text-[#b8c5d6] line-clamp-2 mb-1">{f.description}</p>
                )}
                <div className="flex items-center gap-2 text-[11px] text-[#b8c5d6] mt-2">
                  <span className="bg-white/[0.04] px-2 py-0.5 rounded-md">
                    <span className="text-primary font-medium mr-1">{f.emailCount}</span>
                    {t("classification.emailsLabel", "emails")}
                  </span>
                  {(f.keywords?.length || 0) > 0 && (
                    <span className="text-[10px] text-[#b8c5d6]/70">
                      {f.keywords.length} {t("folders.keywordsShort", { defaultValue: "mots-clés" })}
                    </span>
                  )}
                  {f.aiPrompt && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-primary/80">
                      <Sparkles className="w-2.5 h-2.5" />
                      {t("folders.aiOn", { defaultValue: "IA" })}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {renderEditor()}

      <AlertDialog open={!!folderToDelete} onOpenChange={(o) => !o && setFolderToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("folders.confirmDeleteTitle", { defaultValue: "Supprimer ce dossier ?" })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("folders.confirmDeleteDesc", {
                defaultValue:
                  "Le dossier sera supprimé. Les emails resteront dans votre boîte (rien n'est effacé).",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel", "Annuler")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-500 hover:bg-red-600">
              {t("common.delete", "Supprimer")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );

  function renderEditor() {
    return (
      <Dialog
        open={openCreate}
        onOpenChange={(o) => {
          setOpenCreate(o);
          if (!o) {
            setEditingFolder(null);
            resetDraft();
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingFolder
                ? t("folders.editTitle", { defaultValue: "Modifier le dossier" })
                : t("folders.newTitle", { defaultValue: "Nouveau dossier" })}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label className="text-[12px]">
                {t("folders.fieldName", { defaultValue: "Nom" })}
              </Label>
              <Input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder={t("folders.namePlaceholder", { defaultValue: "ex. Factures fournisseurs" })}
                maxLength={80}
              />
            </div>

            <div>
              <Label className="text-[12px]">
                {t("folders.fieldDescription", { defaultValue: "Description (optionnel)" })}
              </Label>
              <Input
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                placeholder={t("folders.descriptionPlaceholder", { defaultValue: "Visible uniquement par vous" })}
              />
            </div>

            <div>
              <Label className="text-[12px]">
                {t("folders.fieldKeywords", { defaultValue: "Mots-clés (séparés par des virgules)" })}
              </Label>
              <Input
                value={draft.keywords}
                onChange={(e) => setDraft({ ...draft, keywords: e.target.value })}
                placeholder="facture, BL, IBAN, RIB"
              />
              <p className="text-[10px] text-[#b8c5d6] mt-1">
                {t("folders.keywordsHelp", {
                  defaultValue:
                    "Un mail correspond si l'expéditeur, l'objet ou le contenu contient l'un de ces mots.",
                })}
              </p>
            </div>

            <div className="border-t border-border pt-3">
              <div className="flex items-center justify-between mb-1">
                <Label className="text-[12px] inline-flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-primary" />
                  {t("folders.fieldAiPrompt", { defaultValue: "Prompt IA (optionnel)" })}
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleGeneratePrompt}
                  disabled={generatePrompt.isPending}
                  className="h-7 px-2 text-[11px] gap-1.5 text-primary hover:text-white"
                >
                  {generatePrompt.isPending ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Wand2 className="w-3 h-3" />
                  )}
                  {t("folders.generatePromptCta", { defaultValue: "Générer avec l'IA" })}
                </Button>
              </div>
              <Input
                value={draft.shortBrief}
                onChange={(e) => setDraft({ ...draft, shortBrief: e.target.value })}
                placeholder={t("folders.shortBriefPlaceholder", {
                  defaultValue: "Brief court pour l'IA (optionnel)",
                })}
                className="mb-2 text-[12px]"
              />
              <Textarea
                value={draft.aiPrompt}
                onChange={(e) => setDraft({ ...draft, aiPrompt: e.target.value })}
                rows={5}
                placeholder={t("folders.aiPromptPlaceholder", {
                  defaultValue:
                    "Décrivez ce qui doit aller dans ce dossier, les indices à chercher, et 1-2 contre-exemples.",
                })}
                className="text-[12px]"
              />
              <p className="text-[10px] text-[#b8c5d6] mt-1">
                {t("folders.aiPromptHelp", {
                  defaultValue:
                    "Si rempli, l'IA classera les nouveaux mails selon cette description (en plus des mots-clés).",
                })}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenCreate(false)}>
              {t("common.cancel", "Annuler")}
            </Button>
            <Button onClick={handleSubmit} disabled={!draft.name.trim() || createFolder.isPending || updateFolder.isPending}>
              {(createFolder.isPending || updateFolder.isPending) && (
                <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
              )}
              {editingFolder ? t("common.save", "Enregistrer") : t("common.create", "Créer")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
}
