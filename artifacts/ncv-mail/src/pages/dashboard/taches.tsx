import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { MailPageHeader } from "@/components/email-list/MailPageHeader";
import { extractEmailAddress } from "@/lib/utils";
import { EmailBodyRenderer } from "@/components/EmailBodyRenderer";
import { EmailComments } from "@/components/email-comments";
import { TaskAssigneePicker } from "@/components/task-assignee-picker";
import { FileAttachInput, type UploadedFile } from "@/components/FileAttachInput";
import {
  useListTasks,
  useUpdateTask,
  useDeleteTask,
  useCreateTask,
  getListTasksQueryKey,
  getListEmailsQueryKey,
  getListFoldersQueryKey,
  useSendEmail,
  useGenerateDraft,
  useGetProfile,
  useGetMyOrganisation,
  useGetOrganisationMembers,
  useUpdateEmail,
  useDeleteEmail,
  useSnoozeEmail,
  useAssignEmailsToFolder,
  useGetCategoryCounts,
  useListFolders,
} from "@workspace/api-client-react";
import { HoverActions, type HoverActionsCb } from "@/components/email-list/HoverActions";
import { format } from "date-fns";
import { fr, enUS, nl, de, es, it, pt, pl } from "date-fns/locale";
import {
  Calendar, Mail, Mail as MailIcon, MailOpen, Trash2, Sparkles, Download,
  Reply, Send, Wand2, Loader2, Plus, RotateCcw, CheckCircle2,
  Check, X, ChevronRight, CheckSquare, Square,
  Forward, UserPlus, Copy, Type as TypeIcon, ExternalLink,
  Clock, Archive, Printer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BackToInboxButton } from "@/components/dashboard/back-to-inbox-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useState, useRef, useEffect, useCallback, useLayoutEffect } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTranslation } from "react-i18next";
import { downloadExport } from "@/lib/export-utils";
import { useEnableLightTheme } from "@/lib/inbox-theme";

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded text-[10.5px] font-medium tabular-nums bg-[#1f2630] border border-[#2a3340] text-[#b8c5d6]">
      {children}
    </span>
  );
}

function PriorityGlyph({ level }: { level: string | null | undefined }) {
  // 3 traits empilés discrets : urgent=3, moyen=2, faible=1. Mono, pas de couleur.
  const bars = level === "urgent" ? 3 : level === "moyen" ? 2 : level === "faible" ? 1 : 0;
  if (!bars) return null;
  return (
    <span className="inline-flex flex-col gap-[2px] shrink-0" aria-label={`priority-${level}`}>
      {[3, 2, 1].map((n) => (
        <span
          key={n}
          className={`block h-[2px] rounded-full ${n <= bars ? "bg-[#b8c5d6]" : "bg-white/[0.08]"}`}
          style={{ width: `${4 + n * 2}px` }}
        />
      ))}
    </span>
  );
}

export default function Taches() {
  useEnableLightTheme();
  const { t, i18n } = useTranslation();
  const dateFnsLocale = ({fr,en:enUS,nl,de,es,it,pt,pl}[(i18n.resolvedLanguage || i18n.language || "fr").substring(0,2)] || fr);
  const queryClient = useQueryClient();
  const { data: profile } = useGetProfile();
  const { session } = useAuth();
  const { toast } = useToast();

  const { data: connections } = useQuery<Array<{ id: string; provider: string; email_address: string; signature?: string | null }>>({
    queryKey: ["taches-compose-connections"],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/email/connections`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!session,
  });

  const signatureForConnection = useCallback((connId: string | null | undefined): string => {
    if (!connId || !connections) return "";
    const conn = connections.find((c) => String(c.id) === String(connId));
    return (conn?.signature || "").trim();
  }, [connections]);

  const [filter, setFilter] = useState<string>("all");
  const [scope, setScope] = useState<"mine" | "assigned_to_me" | "created_by_me" | "team">("mine");
  // Recherche locale alimentée par MailPageHeader (parité Reportés/Envoyés —
  // le bandeau gère l'input ; la liste filtre côté front sur titre + sujet
  // d'email rattaché + nom de l'assigné).
  const [headerSearch, setHeaderSearch] = useState("");
  const [emailDetailTask, setEmailDetailTask] = useState<any>(null);
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskAssignees, setNewTaskAssignees] = useState<string[]>([]);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; taskId: string } | null>(null);
  // Position finale du menu après mesure (auto-flip vers le haut si dépasse,
  // borne 8px de marge). Tant que la mesure n'est pas faite, le menu est
  // rendu en opacity-0 pour éviter le flash position basse → haute.
  // Convention partagée — cf. replit.md "menu contextuel auto-flip".
  const [menuPlacement, setMenuPlacement] = useState<{ top: number; left: number; maxHeight: number } | null>(null);
  const [showComments, setShowComments] = useState(false);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const taskSelectionMode = selectedTaskIds.size > 0;

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
      if (e.key === "Escape") {
        if (emailDetailTask) { setEmailDetailTask(null); setShowComments(false); return; }
        setSelectedTaskIds(new Set());
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [emailDetailTask]);

  useEffect(() => {
    if (selectedTaskIds.size === 0) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-email-row]") || target.closest("[data-selection-bar]") || target.closest("[data-context-menu]") || target.closest("[data-detail-panel]")) return;
      setSelectedTaskIds(new Set());
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [selectedTaskIds.size > 0]);

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
    const rows = Array.from(document.querySelectorAll("[data-row-id]"));
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
    setSelectedTaskIds(keep);
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
    setSelectedTaskIds((prev) => { preSelectRef.current = new Set(prev); return prev; });
    const handleMouseUp = () => { isDraggingRef.current = false; cancelAnimationFrame(autoScrollRaf.current); document.removeEventListener("mouseup", handleMouseUp); };
    document.addEventListener("mouseup", handleMouseUp);
  }, []);

  const handleTaskContextMenu = useCallback((e: React.MouseEvent, taskId: string) => {
    e.preventDefault();
    setSelectedTaskIds((prev) => {
      if (prev.size > 0 && !prev.has(taskId)) {
        return new Set(prev).add(taskId);
      } else if (prev.size === 0) {
        return new Set([taskId]);
      }
      return prev;
    });
    setContextMenu({ x: e.clientX, y: e.clientY, taskId });
  }, []);

  const handleBulkMarkDone = () => {
    Array.from(selectedTaskIds).forEach((id) => handleToggleDone(id, false));
    setSelectedTaskIds(new Set());
  };

  const handleBulkDeleteTasks = () => {
    Array.from(selectedTaskIds).forEach((id) => handleDeleteTask(id));
    setSelectedTaskIds(new Set());
  };

  // ─── Actions au survol / clic droit ─────────────────────────────────────
  // Wrappers task-spécifiques utilisés par la barre hover et le menu
  // contextuel pour parité fonctionnelle avec Réception/Reportés.
  const openReplyForTask = (task: any) => {
    if (!task?.emailSubject) {
      toast({ title: t("tasks.noLinkedEmail", "Cette tâche n'est liée à aucun email.") });
      return;
    }
    setEmailDetailTask(task);
    setReplyTo(extractEmailAddress(task.emailSenderEmail) || extractEmailAddress(task.emailSender) || "");
    setReplySubject(task.emailSubject?.startsWith("Re:") ? task.emailSubject : `Re: ${task.emailSubject}`);
    const sig = signatureForConnection(task.emailConnectionId);
    setReplyText(sig ? `\n\n${sig}` : "");
    setReplyAttachments([]);
    setReplyOpen(true);
  };

  const openForwardForTask = (task: any) => {
    if (!task?.emailSubject) {
      toast({ title: t("tasks.noLinkedEmail", "Cette tâche n'est liée à aucun email.") });
      return;
    }
    setEmailDetailTask(task);
    setReplyTo("");
    setReplySubject(task.emailSubject?.startsWith("Fwd:") ? task.emailSubject : `Fwd: ${task.emailSubject}`);
    const sig = signatureForConnection(task.emailConnectionId);
    setReplyText(sig ? `\n\n${sig}` : "");
    setReplyAttachments([]);
    setReplyOpen(true);
  };

  const handleReassignTask = (taskId: string, userId: string | null) => {
    updateTask.mutate(
      { id: taskId as any, data: { assignedToUserId: userId } as any },
      {
        onSuccess: () => {
          invalidate();
          toast({ title: t("tasks.reassigned", "Tâche réassignée") });
        },
        onError: () =>
          toast({ variant: "destructive", title: t("common.error") }),
      },
    );
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: label });
    } catch {
      toast({ variant: "destructive", title: t("common.error") });
    }
  };

  // ─── Actions sur le mail lié à la tâche (parité 1:1 hover Réception) ───
  // Toutes ces actions s'appliquent au mail derrière la tâche (task.emailId).
  // Pour Snooze/Archive/Catégorie/Move/Block — on agit sur le mail source.
  // Pour Delete — on supprime la TÂCHE, pas le mail (voir hover bar plus bas).
  const updateEmailMut = useUpdateEmail();
  const deleteEmailMut = useDeleteEmail();
  const snoozeEmailMut = useSnoozeEmail();
  const assignToFolderMut = useAssignEmailsToFolder();
  const { data: categoryCounts } = useGetCategoryCounts();
  const { data: userFolders } = useListFolders();
  const createTaskMut2 = useCreateTask();

  const invalidateEmailLists = () => {
    queryClient.invalidateQueries({ queryKey: getListEmailsQueryKey() });
  };

  const handleEmailToggleRead = (emailId: number, isUnread: boolean) => {
    updateEmailMut.mutate(
      { id: emailId, data: { status: isUnread ? "read" : "non_lu" } as any },
      { onSuccess: () => { invalidateEmailLists(); toast({ title: isUnread ? t("inbox.markedAsRead", "Marqué comme lu") : t("inbox.markedAsUnread", "Marqué comme non lu") }); } },
    );
  };

  const handleEmailSnooze = (emailId: number, hours: number, label: string) => {
    let date: Date;
    if (hours === 24) { date = new Date(); date.setDate(date.getDate() + 1); date.setHours(9,0,0,0); }
    else if (hours === 168) { date = new Date(); const day = date.getDay(); const diff = (8 - day) % 7 || 7; date.setDate(date.getDate() + diff); date.setHours(9,0,0,0); }
    else { date = new Date(Date.now() + hours * 3600 * 1000); }
    snoozeEmailMut.mutate(
      { id: emailId, data: { snoozeUntil: date.toISOString() } as any },
      { onSuccess: () => { invalidateEmailLists(); toast({ title: t("wave1.snoozeSuccess", "Reporté"), description: label }); }, onError: (e: any) => toast({ variant: "destructive", title: e?.message || "Échec" }) },
    );
  };

  const handleEmailArchive = (emailId: number) => {
    updateEmailMut.mutate(
      { id: emailId, data: { status: "archived" } as any },
      { onSuccess: () => { invalidateEmailLists(); toast({ title: t("inbox.archived", "Archivé") }); } },
    );
  };

  const handleEmailSetCategory = (emailId: number, categoryId: string, name: string) => {
    updateEmailMut.mutate(
      { id: emailId, data: { categoryId } as any },
      { onSuccess: () => { invalidateEmailLists(); toast({ title: t("inbox.categorized", "Catégorisé"), description: name }); } },
    );
  };

  const handleEmailMove = async (emailId: number, folderId: string, folderName: string) => {
    try {
      await assignToFolderMut.mutateAsync({ data: { folderId, emailIds: [emailId] } as any });
      toast({ title: t("folders.movedToast", { defaultValue: "Déplacé dans « {{name}} »", name: folderName }) });
      queryClient.invalidateQueries({ queryKey: getListFoldersQueryKey() });
      invalidateEmailLists();
    } catch {
      toast({ variant: "destructive", title: t("folders.moveFailed", { defaultValue: "Échec du déplacement." }) });
    }
  };

  const handleEmailCopySender = async (task: any) => {
    const addr = (extractEmailAddress(task?.emailSenderEmail || task?.emailSender || "") || task?.emailSenderEmail || task?.emailSender || "").trim();
    if (!addr) { toast({ variant: "destructive", title: t("common.error"), description: "Adresse introuvable" }); return; }
    try { await navigator.clipboard.writeText(addr); toast({ title: t("inbox.copied", "Copié"), description: addr }); }
    catch { toast({ variant: "destructive", title: t("common.error") }); }
  };

  const handleEmailCopySubject = async (task: any) => {
    const subj = (task?.emailSubject || "").trim();
    if (!subj) { toast({ variant: "destructive", title: t("common.error"), description: "Aucun sujet" }); return; }
    try { await navigator.clipboard.writeText(subj); toast({ title: t("inbox.copied", "Copié"), description: subj }); }
    catch { toast({ variant: "destructive", title: t("common.error") }); }
  };

  const handleEmailDownloadEml = async (emailId: number) => {
    try {
      const { supabase } = await import("@/lib/supabase");
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const baseUrl = import.meta.env.VITE_API_URL || `https://${window.location.host}`;
      const res = await fetch(`${baseUrl}/api/emails/${emailId}/export.eml`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const { saveBlobAs } = await import("@/lib/export-utils");
      await saveBlobAs(blob, `email_${emailId}.eml`);
      toast({ title: t("inbox.exportDownloaded", "Téléchargé") });
    } catch (e: any) {
      toast({ variant: "destructive", title: t("inbox.exportError", "Échec du téléchargement"), description: e?.message });
    }
  };

  const handleEmailPrint = (task: any) => {
    const w = window.open("", "_blank", "width=800,height=900");
    if (!w) { toast({ variant: "destructive", title: t("inbox.printPopupBlocked", "Impossible d'ouvrir la fenêtre d'impression") }); return; }
    const safeBody = (task?.emailBody || task?.emailSummary || "").toString();
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${(task?.emailSubject || "").replace(/[<>]/g, "")}</title>
      <style>body{font-family:-apple-system,Segoe UI,sans-serif;color:#111;padding:24px;line-height:1.5}h1{font-size:18px;margin:0 0 12px}.meta{font-size:12px;color:#555;margin-bottom:18px;border-bottom:1px solid #ddd;padding-bottom:10px}img{max-width:100%}</style>
      </head><body>
      <h1>${(task?.emailSubject || "(sans sujet)").replace(/[<>]/g, "")}</h1>
      <div class="meta"><b>${(task?.emailSender || "").replace(/[<>]/g, "")}</b></div>
      <div>${safeBody}</div>
      </body></html>`);
    w.document.close();
    setTimeout(() => { try { w.focus(); w.print(); } catch {} }, 300);
  };

  const handleEmailCreateTaskFromTask = (task: any) => {
    if (!task?.emailId) return;
    const title = (task.emailSubject || "Tâche").slice(0, 200);
    createTaskMut2.mutate(
      { data: { title, emailId: task.emailId } as any },
      {
        onSuccess: () => { invalidate(); toast({ title: t("inbox.taskCreated", "Tâche créée"), description: title }); },
        onError: (e: any) => toast({ variant: "destructive", title: t("common.error"), description: e?.message }),
      },
    );
  };

  // Builder du callback HoverActions pour une tâche donnée. Toutes les
  // actions email-liées agissent sur task.emailId ; onDelete supprime
  // la TÂCHE (pas le mail) car on est sur la page Tâches.
  const buildTaskHoverCb = (task: any): HoverActionsCb => ({
    onOpen: () => { setEmailDetailTask(task); setShowComments(false); },
    onReply: () => openReplyForTask(task),
    onForward: () => openForwardForTask(task),
    onCreateTask: () => handleEmailCreateTaskFromTask(task),
    onToggleRead: () => task.emailId && handleEmailToggleRead(task.emailId, !task.emailIsRead),
    onSnooze: (hours, label) => task.emailId && handleEmailSnooze(task.emailId, hours, label),
    onArchive: () => task.emailId && handleEmailArchive(task.emailId),
    onSetCategory: (categoryId, name) => task.emailId && handleEmailSetCategory(task.emailId, categoryId, name),
    onMove: (folderId, name) => task.emailId && handleEmailMove(task.emailId, folderId, name),
    onCopySender: () => handleEmailCopySender(task),
    onCopySubject: () => handleEmailCopySubject(task),
    onDownloadEml: () => task.emailId && handleEmailDownloadEml(task.emailId),
    onPrint: () => handleEmailPrint(task),
    onBlockSender: () => { /* TODO Tâches : raccord backend bloquer expéditeur */ },
    onDelete: () => handleDeleteTask(task.id),
  });

  // Auto-flip / clamp du menu contextuel : mesure réelle de la hauteur du
  // menu après render, puis flip vers le haut si overflow bas, et clamp
  // horizontal pour rester dans la fenêtre (marge 8px).
  useLayoutEffect(() => {
    if (!contextMenu) {
      setMenuPlacement(null);
      return;
    }
    const el = contextMenuRef.current;
    if (!el) return;
    const margin = 8;
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const rect = el.getBoundingClientRect();
    const desiredH = rect.height;
    const desiredW = rect.width;
    // Vertical : tente d'ouvrir vers le bas ; sinon flip vers le haut.
    let top = contextMenu.y;
    let maxHeight = vh - top - margin;
    if (desiredH > maxHeight && contextMenu.y > vh / 2) {
      // flip up : ancre le menu au-dessus du curseur
      const above = contextMenu.y - margin;
      top = Math.max(margin, contextMenu.y - desiredH);
      maxHeight = Math.min(above, vh - margin * 2);
    } else {
      maxHeight = Math.max(120, maxHeight);
    }
    // Horizontal : clamp pour rester visible.
    const left = Math.min(contextMenu.x, vw - desiredW - margin);
    setMenuPlacement({ top, left: Math.max(margin, left), maxHeight });
  }, [contextMenu]);

  // Sous-menu hover ouvert (réassigner). Une seule clé à la fois.
  const [hoverMenu, setHoverMenu] = useState<{ taskId: string; kind: "assign" | "more" } | null>(null);
  useEffect(() => {
    if (!hoverMenu) return;
    const onClick = () => setHoverMenu(null);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setHoverMenu(null); };
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [hoverMenu]);

  const sendEmailMut = useSendEmail();
  const generateDraftMut = useGenerateDraft();
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyTo, setReplyTo] = useState("");
  const [replySubject, setReplySubject] = useState("");
  const [replyText, setReplyText] = useState("");
  const [replyAttachments, setReplyAttachments] = useState<UploadedFile[]>([]);

  const { data: tasks, isLoading } = useListTasks({ scope } as any, { query: { placeholderData: (prev: any) => prev } as any });
  const { data: myOrg } = useGetMyOrganisation();
  const { data: orgMembers } = useGetOrganisationMembers({ query: { enabled: !!(myOrg as any)?.id } as any });
  const orgMembersList: any[] = Array.isArray(orgMembers) ? orgMembers : [];
  const currentUserId = (profile as any)?.id || (profile as any)?.userId || null;
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const createTask = useCreateTask();

  const invalidate = () => queryClient.refetchQueries({ queryKey: getListTasksQueryKey() });

  const handleToggleDone = (id: string, currentDone: boolean) => {
    updateTask.mutate(
      { id: id as any, data: { done: !currentDone } },
      { onSuccess: () => { invalidate(); } }
    );
  };

  const handleDeleteTask = (id: string) => {
    deleteTask.mutate(
      { id: id as any },
      {
        onSuccess: () => { invalidate(); toast({ title: t("tasks.deleted") }); if (emailDetailTask?.id === id) setEmailDetailTask(null); },
        onError: () => toast({ variant: "destructive", title: t("common.error"), description: t("tasks.deleteError") }),
      }
    );
  };

  const handleAddTask = async () => {
    if (!newTaskTitle.trim() || newTaskTitle.trim().length < 2) return;
    const title = newTaskTitle.trim();
    const assignees = newTaskAssignees.length > 0 ? newTaskAssignees : [null];
    try {
      for (const assignee of assignees) {
        await createTask.mutateAsync({
          data: {
            title,
            ...(assignee ? { assignedToUserId: assignee } : {}),
          } as any,
        });
      }
      invalidate();
      toast({
        title:
          assignees.length > 1
            ? t("tasks.tasksCreated", { count: assignees.length, defaultValue: `${assignees.length} tâches créées` })
            : t("tasks.taskCreated"),
      });
      setNewTaskTitle("");
      setNewTaskAssignees([]);
      setShowAddTask(false);
    } catch (e: any) {
      toast({ variant: "destructive", title: t("common.error"), description: e?.message || "" });
    }
  };

  const handleSendReply = () => {
    if (!replyTo.trim() || !replySubject.trim() || !replyText.trim()) return;
    const uploadIds = replyAttachments.map((a) => a.uploadId).filter(Boolean);
    sendEmailMut.mutate(
      { data: { to: replyTo, subject: replySubject, body: replyText, replyToEmailId: emailDetailTask?.emailId ?? null, attachments: uploadIds.length > 0 ? uploadIds : undefined } },
      {
        onSuccess: () => {
          toast({ title: t("inbox.emailSent") });
          setReplyOpen(false); setReplyTo(""); setReplySubject(""); setReplyText(""); setReplyAttachments([]);
        },
        onError: (err: any) => {
          toast({ variant: "destructive", title: t("common.error"), description: err?.data?.error || err?.message || t("inbox.sendError") });
        },
      }
    );
  };

  const handleGenerateDraftForTask = () => {
    if (!emailDetailTask?.emailId) return;
    setReplyTo(extractEmailAddress(emailDetailTask.emailSenderEmail) || extractEmailAddress(emailDetailTask.emailSender) || "");
    setReplySubject(emailDetailTask.emailSubject?.startsWith("Re:") ? emailDetailTask.emailSubject : `Re: ${emailDetailTask.emailSubject}`);
    setReplyOpen(true);
    generateDraftMut.mutate(
      { data: { emailId: emailDetailTask.emailId } },
      {
        onSuccess: (data) => { setReplyText((data as any).draft); toast({ title: t("inbox.draftGenerated") }); },
        onError: () => toast({ title: t("inbox.draftError") }),
      }
    );
  };

  const rawTaskList = (tasks as any[]) || [];
  const taskList = scope === "team"
    ? rawTaskList.filter((tk: any) => tk.assignedToUserId && tk.assignedToUserId !== currentUserId)
    : rawTaskList;

  const aiCount = taskList.filter((t: any) => t.source === "ai").length;
  const todoCount = taskList.filter((t: any) => t.status !== "done").length;
  const doneCount = taskList.filter((t: any) => t.status === "done").length;

  useEffect(() => {
    if (scope === "team" && filter === "ai") setFilter("all");
  }, [scope, filter]);

  const filteredByPill = filter === "ai"
    ? taskList.filter((t: any) => t.source === "ai")
    : filter === "todo"
    ? taskList.filter((t: any) => t.status !== "done")
    : filter === "done"
    ? taskList.filter((t: any) => t.status === "done")
    : taskList;

  // Recherche : titre + sujet email rattaché + expéditeur. Casse-insensible.
  const filteredTasks = (() => {
    const q = headerSearch.trim().toLowerCase();
    if (!q) return filteredByPill;
    return filteredByPill.filter((tk: any) => {
      const title = String(tk.title ?? "").toLowerCase();
      const subj = String(tk.emailSubject ?? "").toLowerCase();
      const sender = String(tk.emailSender ?? tk.emailSenderEmail ?? "").toLowerCase();
      return title.includes(q) || subj.includes(q) || sender.includes(q);
    });
  })();

  const filters = [
    { key: "all", label: t("tasks.all"), count: taskList.length },
    { key: "todo", label: t("tasks.todo"), count: todoCount },
    { key: "done", label: t("tasks.done"), count: doneCount },
    ...(scope === "mine" ? [{ key: "ai", label: t("tasks.sourceAi"), count: aiCount }] : []),
  ];

  const detailOpen = !!emailDetailTask;

  return (
    <DashboardLayout>
      {!detailOpen && (
        <MailPageHeader
          currentTab="taches"
          searchValue={headerSearch}
          onSearchChange={setHeaderSearch}
          showReadingPaneToggle={false}
          showHeaderCollapseToggle={false}
        />
      )}
      <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 py-5 max-w-[1600px]">
        {!detailOpen && <BackToInboxButton />}
        {!detailOpen && (
        <>
        {/* Onglets Mes tâches / Équipe + actions à droite (Nouvelle tâche /
            Export CSV). Le bandeau sticky MailPageHeader au-dessus apporte
            recherche + tabs boîtes mail (parité Reportés/Envoyés) ; ici on
            garde les actions task-spécifiques séparées. */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-3 border-b border-[#1f2937]">
          <div className="flex items-center gap-1.5 flex-wrap">
            {([
              { key: "mine", label: t("tasks.myTasks", "Mes tâches") },
              { key: "team", label: t("tasks.teamTasks", "Tâches assignées à l'équipe") },
            ] as const).map((s) => (
              <button
                key={s.key}
                onClick={() => setScope(s.key)}
                className={`text-[12px] px-3 py-2 transition-all border-b -mb-px ${
                  scope === s.key
                    ? "border-white text-white font-medium"
                    : "border-transparent text-[#8b95a7] hover:text-white"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 pb-2">
            <Button
              size="sm"
              onClick={() => setShowAddTask(true)}
              className="gap-1 text-[11px] h-7 rounded-full bg-white/[0.06] border border-[#1f2937] text-[#b8c5d6] hover:bg-white/[0.10] hover:text-white"
            >
              <Plus className="w-3 h-3" />
              {t("tasks.addTask")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  await downloadExport("export/tasks", `taches_${new Date().toISOString().split("T")[0]}.csv`);
                  toast({ title: t("tasks.exportDownloaded") });
                } catch {
                  toast({ title: t("tasks.exportError"), variant: "destructive" });
                }
              }}
              className="gap-1 text-[11px] h-7 rounded-full bg-transparent border-[#1f2937] text-[#8b95a7] hover:text-white hover:bg-white/[0.04]"
            >
              <Download className="w-3 h-3" />
              {t("tasks.export")}
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-1.5 mb-3">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`text-[11px] px-2.5 py-1 rounded-full transition-all inline-flex items-center gap-1.5 border ${
                filter === f.key
                  ? "bg-white/[0.08] text-white border-[#2a3441] font-medium"
                  : "bg-transparent text-[#8b95a7] hover:text-white border-[#1f2937] hover:bg-white/[0.03]"
              }`}
            >
              {f.key === "ai" && <Sparkles className="w-3 h-3" />}
              {f.label}
              {!isLoading && <span className="text-[10px] opacity-60 ncv-tab-count">{f.count}</span>}
            </button>
          ))}
        </div>

        {/* Barre sélection globale — mono, alignée Réception */}
        <div data-selection-bar className="flex items-center gap-2 mb-2 px-2 h-7">
          <button
            onClick={() => {
              if (selectedTaskIds.size === filteredTasks.length && selectedTaskIds.size > 0) {
                setSelectedTaskIds(new Set());
              } else {
                setSelectedTaskIds(new Set(filteredTasks.map((t: any) => t.id)));
              }
            }}
            className="flex items-center gap-1.5 text-[11px] text-[#8b95a7] hover:text-white transition-colors"
            disabled={filteredTasks.length === 0}
          >
            {selectedTaskIds.size === filteredTasks.length && selectedTaskIds.size > 0
              ? <CheckSquare className="w-3.5 h-3.5" />
              : <Square className="w-3.5 h-3.5" />}
            {selectedTaskIds.size === filteredTasks.length && selectedTaskIds.size > 0
              ? t("inbox.deselectAll")
              : t("inbox.selectAll")}
          </button>
          {taskSelectionMode && (
            <span className="text-[11px] text-[#6b7280]">
              · {t("inbox.selectedCount", { count: selectedTaskIds.size })}
            </span>
          )}
        </div>
        </>
        )}

        <div className="grid gap-4 grid-cols-1">
          {/* Liste — masquée quand un email est ouvert (vue pleine page) */}
          {!detailOpen && (
          <div className="min-w-0">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-16 rounded-lg border border-[#1f2937] border-dashed bg-white/[0.02]">
                <Loader2 className="w-5 h-5 text-[#8b95a7] animate-spin mb-3" />
                <h3 className="text-[12px] text-[#b8c5d6]">{t("tasks.loadingTitle", "Chargement des tâches…")}</h3>
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className="text-center py-20 rounded-lg border border-[#1f2937] border-dashed bg-white/[0.02]">
                <Plus className="mx-auto h-10 w-10 text-[#3a4150] mb-3" />
                <h3 className="text-[13px] font-medium text-foreground mb-1">{t("tasks.noTasks")}</h3>
                <p className="text-[12px] text-[#8b95a7]">{t("tasks.noTasksDesc")}</p>
              </div>
            ) : (
              <div className="rounded-lg border border-[#1f2937] overflow-hidden bg-white/[0.01]">
                {filteredTasks.map((task: any) => {
                  const taskStatus = task.status || "todo";
                  const isDone = taskStatus === "done";
                  const senderName = task.emailSender || task.emailSenderEmail || "";
                  const senderInitial = (senderName || task.title || "?").trim().charAt(0).toUpperCase();
                  const isTaskSelected = selectedTaskIds.has(task.id);
                  const isOpen = emailDetailTask?.id === task.id;
                  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !isDone;
                  const assignedMember = task.assignedToUserId
                    ? orgMembersList.find((mm: any) => mm.userId === task.assignedToUserId)
                    : null;

                  return (
                    <div
                      key={task.id}
                      data-email-row
                      data-row-id={task.id}
                      title={task.title + (task.emailSubject ? `\n— ${task.emailSubject}` : "")}
                      className={`group relative flex items-center gap-3 h-[52px] pl-2 pr-3 cursor-pointer select-none border-l-2 border-b border-[#1f2937] transition-colors ${
                        isOpen
                          ? "border-l-white/40 bg-white/[0.05]"
                          : isTaskSelected
                          ? "border-l-white/40 bg-white/[0.05]"
                          : "border-l-transparent hover:bg-white/[0.03]"
                      } ${isDone ? "opacity-50" : ""}`}
                      onClick={() => {
                        if (didDragRef.current) return;
                        if (taskSelectionMode) {
                          setSelectedTaskIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(task.id)) next.delete(task.id); else next.add(task.id);
                            return next;
                          });
                          return;
                        }
                        // Ouverture/fermeture du panneau détail
                        if (isOpen) { setEmailDetailTask(null); setShowComments(false); }
                        else { setEmailDetailTask(task); setShowComments(false); }
                      }}
                      onMouseDown={(e) => { if (e.button === 0) { e.preventDefault(); handleDragSelectStart(task.id); } }}
                      onContextMenu={(e) => handleTaskContextMenu(e, task.id)}
                    >
                      {/* Case à cocher (visible si sélection active ou hover) */}
                      <div className="w-4 flex items-center justify-center shrink-0">
                        {taskSelectionMode || isTaskSelected ? (
                          <button
                            className="w-4 h-4 rounded flex items-center justify-center transition-all cursor-pointer border border-[#2a3441] hover:border-primary"
                            onClick={(e) => { e.stopPropagation(); setSelectedTaskIds((prev) => { const next = new Set(prev); if (next.has(task.id)) next.delete(task.id); else next.add(task.id); return next; }); }}
                            onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); handleDragSelectStart(task.id); }}
                          >
                            {isTaskSelected && <Check className="w-3 h-3 text-primary" />}
                          </button>
                        ) : (
                          <span className="w-3 h-3" />
                        )}
                      </div>

                      {/* Avatar — bleu */}
                      <div className="w-7 h-7 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
                        <span className="text-primary text-[11px] font-semibold">
                          {senderInitial}
                        </span>
                      </div>

                      {/* Titre + sujet email source */}
                      <div className="flex-1 min-w-0 flex items-baseline gap-2 overflow-hidden">
                        <span className={`text-[13px] truncate ${isDone ? "line-through text-[#5a6270]" : "text-white font-medium"}`}>
                          {task.title}
                        </span>
                        {task.source === "ai" && (
                          <Sparkles className="w-3 h-3 text-[#8b95a7] shrink-0" />
                        )}
                        {task.emailSubject && (
                          <span className="text-[12px] truncate text-[#7a8290]">
                            — {task.emailSubject}
                          </span>
                        )}
                      </div>

                      {/* Méta + actions — masquées au hover.
                          L'assigné n'est affiché qu'en mode Équipe (en mode
                          "Mes tâches" toutes les tâches sont à l'utilisateur
                          courant donc le nom est redondant). */}
                      <div className="flex items-center gap-2 shrink-0 group-hover:hidden">
                        {scope === "team" && assignedMember && (
                          <span className="text-[10px] text-[#8b95a7] truncate max-w-[100px]" title={assignedMember.fullName || assignedMember.email}>
                            {assignedMember.fullName || assignedMember.email}
                          </span>
                        )}
                        {/* Barres de priorité retirées : reprises depuis le
                            mail source, elles apparaissaient sur toute tâche
                            issue d'un mail et créaient du bruit visuel. */}
                        {task.dueDate && (
                          <span className={`text-[11px] tabular-nums whitespace-nowrap inline-flex items-center gap-1 ${isOverdue ? "text-[#e0a8a8]" : "text-[#8b95a7]"}`}>
                            <Calendar className="w-2.5 h-2.5" />
                            {format(new Date(task.dueDate), "d MMM", { locale: dateFnsLocale })}
                          </span>
                        )}
                        {!task.dueDate && (
                          <span className="text-[11px] tabular-nums text-[#8b95a7] w-12 text-right whitespace-nowrap hidden sm:inline">
                            {format(new Date(task.createdAt), "d MMM", { locale: dateFnsLocale })}
                          </span>
                        )}
                      </div>

                      {/* Actions au survol — parité 1:1 avec Réception via le
                          composant partagé <HoverActions>. On préfixe avec 2
                          boutons task-spécifiques (Done/Todo + Réassigner)
                          puis on délègue à HoverActions toutes les actions
                          email (Voir/Reply/Forward/CreateTask/ToggleRead/
                          Snooze/Archive/Catégorie/Move/Copier/Download/Print/
                          Block/Delete) — Delete y supprime la TÂCHE (cf.
                          buildTaskHoverCb). Si la tâche n'a pas de mail lié,
                          on garde une mini-bar minimale. */}
                      <div className="hidden group-hover:flex items-center gap-0 shrink-0 relative" onClick={(e) => e.stopPropagation()} onContextMenu={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleToggleDone(task.id, isDone); }}
                          className="p-1 rounded hover:bg-white/[0.08] text-[#8b95a7] hover:text-white"
                          title={isDone ? t("tasks.markTodo") : t("tasks.markDone")}
                        >
                          {isDone ? <RotateCcw className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        </button>
                        {orgMembersList.length > 1 && (
                          <div className="relative">
                            <button
                              onClick={(e) => { e.stopPropagation(); setHoverMenu(hoverMenu && hoverMenu.taskId === task.id && hoverMenu.kind === "assign" ? null : { taskId: task.id, kind: "assign" }); }}
                              className="p-1 rounded hover:bg-white/[0.08] text-[#8b95a7] hover:text-white"
                              title={t("tasks.reassign", "Réassigner")}
                            >
                              <UserPlus className="w-3.5 h-3.5" />
                            </button>
                            {hoverMenu && hoverMenu.taskId === task.id && hoverMenu.kind === "assign" && (
                              <div
                                className="absolute right-0 top-full mt-1 z-[100] min-w-[200px] max-h-[260px] overflow-y-auto rounded-lg border border-[#1f2937] bg-[#141c2b] shadow-2xl py-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-[#b8c5d6] hover:bg-white/[0.06] hover:text-white transition-colors text-left"
                                  onClick={(e) => { e.stopPropagation(); handleReassignTask(task.id, null); setHoverMenu(null); }}
                                >
                                  <X className="w-3 h-3 shrink-0" />
                                  {t("tasks.unassign", "Désassigner")}
                                </button>
                                <div className="border-t border-[#1f2937] my-1" />
                                {orgMembersList.map((m: any) => (
                                  <button
                                    key={m.userId}
                                    className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-[#b8c5d6] hover:bg-white/[0.06] hover:text-white transition-colors text-left"
                                    onClick={(e) => { e.stopPropagation(); handleReassignTask(task.id, m.userId); setHoverMenu(null); }}
                                  >
                                    <span className="w-4 h-4 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
                                      <span className="text-primary text-[9px] font-semibold">
                                        {(m.fullName || m.email || "?").trim().charAt(0).toUpperCase()}
                                      </span>
                                    </span>
                                    <span className="truncate">{m.fullName || m.email}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        {task.emailId ? (
                          <HoverActions
                            isUnread={task.emailIsRead === false}
                            categoryCounts={categoryCounts as any[] | undefined}
                            userFolders={userFolders as any[] | undefined}
                            cb={buildTaskHoverCb(task)}
                            showBlockSender={true}
                          />
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteTask(task.id); }}
                            className="p-1 rounded hover:bg-red-500/[0.08] text-[#8b95a7] hover:text-red-400"
                            title={t("common.delete")}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          )}

          {/* Panneau détail email lié — pleine page */}
          {detailOpen && emailDetailTask && (() => {
            const senderName = emailDetailTask.emailSender || emailDetailTask.emailSenderEmail || "?";
            const initial = senderName.trim().charAt(0).toUpperCase();
            const taskStatus = emailDetailTask.status || "todo";
            const isDone = taskStatus === "done";
            return (
              <div data-detail-panel className="rounded-lg border border-[#1f2937] bg-white/[0.02] flex flex-col overflow-hidden">
                {/* Barre retour */}
                <button
                  onClick={() => { setEmailDetailTask(null); setShowComments(false); }}
                  className="flex items-center gap-1.5 px-4 py-2 text-[12px] text-[#8b95a7] hover:text-white hover:bg-white/[0.04] border-b border-[#1f2937] transition-colors"
                >
                  <ChevronRight className="w-3 h-3 rotate-180" />
                  {t("common.back", "Retour")}
                </button>
                {/* Bloc tâche */}
                <div className="px-4 py-3 border-b border-[#1f2937] flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] uppercase tracking-wider text-[#6b7280] mb-1">{t("tasks.title")}</div>
                    <div className={`text-[14px] font-medium ${isDone ? "line-through text-[#5a6270]" : "text-white"}`}>
                      {emailDetailTask.title}
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-[11px] text-[#8b95a7]">
                      <button
                        onClick={() => handleToggleDone(emailDetailTask.id, isDone)}
                        className="inline-flex items-center gap-1.5 px-2 h-6 rounded bg-white/[0.04] border border-[#1f2937] text-[#b8c5d6] hover:bg-white/[0.08] hover:text-white"
                      >
                        {isDone ? <RotateCcw className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                        {isDone ? t("tasks.markTodo") : t("tasks.markDone")}
                      </button>
                      {emailDetailTask.dueDate && (
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(emailDetailTask.dueDate), "d MMM yyyy", { locale: dateFnsLocale })}
                        </span>
                      )}
                      {emailDetailTask.source === "ai" && (
                        <span className="inline-flex items-center gap-1"><Sparkles className="w-3 h-3" />{t("tasks.sourceAi")}</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => { setEmailDetailTask(null); setShowComments(false); }}
                    className="p-1.5 rounded text-[#8b95a7] hover:text-white hover:bg-white/[0.06]"
                    title={t("common.close", "Fermer")}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Bloc email lié */}
                {emailDetailTask.emailSubject ? (
                  <>
                    <div className="px-4 py-3 border-b border-[#1f2937] flex items-start gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
                        <span className="text-primary text-[12px] font-semibold">{initial}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-medium text-white truncate">
                          {emailDetailTask.emailSubject}
                        </div>
                        <div className="text-[12px] text-[#b8c5d6] truncate mt-0.5">{emailDetailTask.emailSender}</div>
                        {emailDetailTask.emailSenderEmail && emailDetailTask.emailSenderEmail !== emailDetailTask.emailSender && (
                          <div className="text-[11px] text-[#7a8290] truncate">{emailDetailTask.emailSenderEmail}</div>
                        )}
                      </div>
                    </div>

                    <div className="px-4 py-3 overflow-y-auto flex-1 space-y-3">
                      {emailDetailTask.emailSummary && (
                        <div className="px-3 py-2 bg-white/[0.03] rounded border border-[#1f2937]">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <Sparkles className="w-3 h-3 text-[#8b95a7]" />
                            <span className="text-[10px] font-medium text-[#8b95a7] uppercase tracking-wider">{t("inbox.aiSummary")}</span>
                          </div>
                          <p className="text-[12px] text-[#b8c5d6] leading-relaxed">{emailDetailTask.emailSummary}</p>
                        </div>
                      )}

                      {emailDetailTask.emailBody && (
                        <div className="text-[13px] text-[#d4dae4]">
                          <EmailBodyRenderer body={emailDetailTask.emailBody} emailId={emailDetailTask.emailId} sender={emailDetailTask.emailSenderEmail || emailDetailTask.emailSender} />
                        </div>
                      )}

                      {emailDetailTask.emailId && (
                        <div className="pt-2 border-t border-[#1f2937]">
                          <button
                            onClick={() => setShowComments((v) => !v)}
                            className="flex items-center gap-1.5 text-[11px] text-[#8b95a7] hover:text-white transition-colors"
                          >
                            <ChevronRight className={`w-3 h-3 transition-transform ${showComments ? "rotate-90" : ""}`} />
                            {t("inbox.commentsTitle", "Commentaires internes")}
                          </button>
                          {showComments && (
                            <div className="mt-2">
                              <EmailComments emailId={emailDetailTask.emailId} />
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-[#1f2937]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Button
                          size="sm"
                          className="gap-1.5 h-8 text-[12px] rounded-full bg-white/[0.08] border border-[#2a3441] text-white hover:bg-white/[0.12] shrink-0 whitespace-nowrap"
                          onClick={() => {
                            setReplyTo(extractEmailAddress(emailDetailTask.emailSenderEmail) || extractEmailAddress(emailDetailTask.emailSender) || "");
                            setReplySubject(emailDetailTask.emailSubject?.startsWith("Re:") ? emailDetailTask.emailSubject : `Re: ${emailDetailTask.emailSubject}`);
                            const sig = signatureForConnection(emailDetailTask.emailConnectionId);
                            setReplyText(sig ? `\n\n${sig}` : "");
                            setReplyOpen(true);
                          }}
                        >
                          <Reply className="w-3.5 h-3.5" />
                          {t("inbox.reply")}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 h-8 text-[12px] rounded-full bg-transparent border-[#1f2937] text-[#b8c5d6] hover:bg-white/[0.04] hover:text-white shrink-0 whitespace-nowrap"
                          disabled={generateDraftMut.isPending}
                          onClick={handleGenerateDraftForTask}
                        >
                          {generateDraftMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                          {generateDraftMut.isPending ? t("inbox.generating") : t("inbox.aiReply")}
                        </Button>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 h-8 text-[12px] rounded-full bg-transparent border-[#1f2937] text-[#b8c5d6] hover:bg-white/[0.04] hover:text-white shrink-0 whitespace-nowrap"
                          onClick={() => handleToggleDone(emailDetailTask.id, isDone)}
                        >
                          {isDone ? <RotateCcw className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                          {isDone ? t("tasks.markTodo") : t("tasks.markDone")}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 h-8 text-[12px] rounded-full bg-transparent border-[#1f2937] text-red-400 hover:bg-red-500/10 hover:text-red-300 hover:border-red-500/40 shrink-0 whitespace-nowrap"
                          onClick={() => handleDeleteTask(emailDetailTask.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          {t("common.delete")}
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="px-4 py-6 text-[12px] text-[#7a8290] text-center">
                    {t("tasks.noLinkedEmail", "Cette tâche n'est liée à aucun email.")}
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* Pop-bar sélection multiple */}
        {taskSelectionMode && (
          <div data-selection-bar className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-[#0f141b] border border-[#2a3441] rounded-full shadow-2xl px-4 py-2 flex items-center gap-3">
            <span className="text-[11px] text-[#b8c5d6]">{t("inbox.selectedCount", { count: selectedTaskIds.size })}</span>
            <button onClick={handleBulkMarkDone} className="flex items-center gap-1.5 text-[11px] text-[#b8c5d6] hover:text-white transition-colors">
              <CheckCircle2 className="w-3 h-3" />{t("tasks.markDone")}
            </button>
            <button onClick={handleBulkDeleteTasks} className="flex items-center gap-1.5 text-[11px] text-[#b8c5d6] hover:text-white transition-colors">
              <Trash2 className="w-3 h-3" />{t("common.delete")}
            </button>
            <button onClick={() => setSelectedTaskIds(new Set())} className="text-[11px] text-[#8b95a7] hover:text-white transition-colors ml-2">{t("common.cancel")}</button>
          </div>
        )}
      </div>

      {/* Menu contextuel — mono */}
      {contextMenu && (() => {
        const ctxTask = filteredTasks.find((t: any) => t.id === contextMenu.taskId);
        const isDone = ctxTask?.status === "done";
        const hasEmail = !!ctxTask?.emailSubject;
        const multi = selectedTaskIds.size > 1;
        return (
          <div
            ref={contextMenuRef}
            data-context-menu
            className="fixed z-[9999] min-w-[220px] max-w-[280px] rounded-lg border border-[#2a3441] bg-[#0f141b] shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-100"
            style={
              menuPlacement
                ? {
                    top: menuPlacement.top,
                    left: menuPlacement.left,
                    maxHeight: menuPlacement.maxHeight,
                    opacity: 1,
                  }
                : {
                    // Pré-mesure : on rend hors-vue en opacity 0 pour éviter
                    // le flash position incorrecte.
                    top: contextMenu.y,
                    left: contextMenu.x,
                    opacity: 0,
                    pointerEvents: "none",
                  }
            }
          >
            <div className="px-3 py-2 border-b border-[#1f2937]">
              <span className="text-[10px] text-[#6b7280] uppercase tracking-wider font-medium">
                {multi
                  ? t("inbox.selectedCount", { count: selectedTaskIds.size })
                  : (ctxTask?.title?.substring(0, 30) || "") + (ctxTask && ctxTask.title.length > 30 ? "…" : "")
                }
              </span>
            </div>
            <div className="py-1 overflow-y-auto flex-1">
              {/* Mono — actions email-liées + actions task. Multi — actions
                  bulk uniquement. Parité Réception/Reportés. */}
              {!multi && ctxTask ? (
                <>
                  {hasEmail && (
                    <>
                      <button
                        onClick={() => { setEmailDetailTask(ctxTask); setShowComments(false); setContextMenu(null); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#b8c5d6] hover:bg-white/[0.06] hover:text-white transition-colors text-left"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        {t("tasks.viewEmail")}
                      </button>
                      <button
                        onClick={() => { openReplyForTask(ctxTask); setContextMenu(null); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#b8c5d6] hover:bg-white/[0.06] hover:text-white transition-colors text-left"
                      >
                        <Reply className="w-3.5 h-3.5" />
                        {t("inbox.reply", "Répondre")}
                      </button>
                      <button
                        onClick={() => { openForwardForTask(ctxTask); setContextMenu(null); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#b8c5d6] hover:bg-white/[0.06] hover:text-white transition-colors text-left"
                      >
                        <Forward className="w-3.5 h-3.5" />
                        {t("inbox.forward", "Transférer")}
                      </button>
                      <div className="border-t border-[#1f2937] my-1" />
                    </>
                  )}
                  <button
                    onClick={() => { handleToggleDone(ctxTask.id, !!isDone); setContextMenu(null); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#b8c5d6] hover:bg-white/[0.06] hover:text-white transition-colors text-left"
                  >
                    {isDone ? <RotateCcw className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    {isDone ? t("tasks.markTodo") : t("tasks.markDone")}
                  </button>
                  {orgMembersList.length > 1 && (
                    <>
                      <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-[#6b7280] font-medium">
                        {t("tasks.reassign", "Réassigner")}
                      </div>
                      <button
                        onClick={() => { handleReassignTask(ctxTask.id, null); setContextMenu(null); }}
                        className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[12px] text-[#b8c5d6] hover:bg-white/[0.06] hover:text-white transition-colors text-left"
                      >
                        <X className="w-3 h-3" />
                        {t("tasks.unassign", "Désassigner")}
                      </button>
                      {orgMembersList.slice(0, 6).map((m: any) => (
                        <button
                          key={m.userId}
                          onClick={() => { handleReassignTask(ctxTask.id, m.userId); setContextMenu(null); }}
                          className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[12px] text-[#b8c5d6] hover:bg-white/[0.06] hover:text-white transition-colors text-left"
                        >
                          <span className="w-4 h-4 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
                            <span className="text-primary text-[9px] font-semibold">
                              {(m.fullName || m.email || "?").trim().charAt(0).toUpperCase()}
                            </span>
                          </span>
                          <span className="truncate">{m.fullName || m.email}</span>
                        </button>
                      ))}
                    </>
                  )}
                  <div className="border-t border-[#1f2937] my-1" />
                  <button
                    onClick={() => { copyToClipboard(ctxTask.title || "", t("tasks.titleCopied", "Titre copié")); setContextMenu(null); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#b8c5d6] hover:bg-white/[0.06] hover:text-white transition-colors text-left"
                  >
                    <TypeIcon className="w-3.5 h-3.5" />
                    {t("tasks.copyTitle", "Copier le titre")}
                  </button>
                  {ctxTask.emailSubject && (
                    <button
                      onClick={() => { copyToClipboard(ctxTask.emailSubject || "", t("inbox.copiedSubject", "Sujet copié")); setContextMenu(null); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#b8c5d6] hover:bg-white/[0.06] hover:text-white transition-colors text-left"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      {t("inbox.copySubject", "Copier le sujet")}
                    </button>
                  )}
                  {ctxTask.emailSenderEmail && (
                    <button
                      onClick={() => { copyToClipboard(ctxTask.emailSenderEmail || "", t("inbox.copiedSenderEmail", "Adresse copiée")); setContextMenu(null); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#b8c5d6] hover:bg-white/[0.06] hover:text-white transition-colors text-left"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      {t("inbox.copySenderEmail", "Copier l'adresse de l'expéditeur")}
                    </button>
                  )}
                  {ctxTask.emailId && (
                    <button
                      onClick={() => { window.location.href = `${import.meta.env.BASE_URL}dashboard?openEmail=${ctxTask.emailId}`; }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#b8c5d6] hover:bg-white/[0.06] hover:text-white transition-colors text-left"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      {t("tasks.openInInbox", "Ouvrir dans la Réception")}
                    </button>
                  )}
                  {/* Actions sur le mail lié — parité Réception/Reportés.
                      Affichées uniquement si la tâche a un emailId. */}
                  {ctxTask.emailId && (
                    <>
                      <div className="border-t border-[#1f2937] my-1" />
                      <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-[#6b7280] font-medium">
                        {t("tasks.linkedEmailActions", "Sur le mail lié")}
                      </div>
                      <button
                        onClick={() => { handleEmailToggleRead(ctxTask.emailId, ctxTask.emailIsRead !== false); setContextMenu(null); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#b8c5d6] hover:bg-white/[0.06] hover:text-white transition-colors text-left"
                      >
                        {ctxTask.emailIsRead === false ? <MailOpen className="w-3.5 h-3.5" /> : <MailIcon className="w-3.5 h-3.5" />}
                        {ctxTask.emailIsRead === false ? t("inbox.markAsRead", "Marquer comme lu") : t("inbox.markAsUnread", "Marquer comme non lu")}
                      </button>
                      <button
                        onClick={() => { handleEmailSnooze(ctxTask.emailId, 3, t("inbox.snooze3h", "Dans 3h")); setContextMenu(null); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#b8c5d6] hover:bg-white/[0.06] hover:text-white transition-colors text-left"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        {t("inbox.snooze", "Reporter")} (3h)
                      </button>
                      <button
                        onClick={() => { handleEmailSnooze(ctxTask.emailId, 24, t("inbox.snoozeTomorrow", "Demain matin")); setContextMenu(null); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#b8c5d6] hover:bg-white/[0.06] hover:text-white transition-colors text-left"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        {t("inbox.snoozeTomorrow", "Demain matin")}
                      </button>
                      <button
                        onClick={() => { handleEmailArchive(ctxTask.emailId); setContextMenu(null); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#b8c5d6] hover:bg-white/[0.06] hover:text-white transition-colors text-left"
                      >
                        <Archive className="w-3.5 h-3.5" />
                        {t("inbox.archive", "Archiver")}
                      </button>
                      <button
                        onClick={() => { handleEmailDownloadEml(ctxTask.emailId); setContextMenu(null); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#b8c5d6] hover:bg-white/[0.06] hover:text-white transition-colors text-left"
                      >
                        <Download className="w-3.5 h-3.5" />
                        {t("inbox.downloadEml", "Télécharger .eml")}
                      </button>
                      <button
                        onClick={() => { handleEmailPrint(ctxTask); setContextMenu(null); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#b8c5d6] hover:bg-white/[0.06] hover:text-white transition-colors text-left"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        {t("inbox.print", "Imprimer")}
                      </button>
                    </>
                  )}
                </>
              ) : (
                <button
                  onClick={() => { handleBulkMarkDone(); setContextMenu(null); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#b8c5d6] hover:bg-white/[0.06] hover:text-white transition-colors text-left"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {t("tasks.markDone")} ({selectedTaskIds.size})
                </button>
              )}
              <div className="border-t border-[#1f2937] my-1" />
              <button
                onClick={() => {
                  if (multi) handleBulkDeleteTasks();
                  else if (ctxTask) handleDeleteTask(ctxTask.id);
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-red-400/80 hover:bg-red-500/[0.08] hover:text-red-400 transition-colors text-left"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {t("common.delete")}
                {multi && ` (${selectedTaskIds.size})`}
              </button>
            </div>
          </div>
        );
      })()}

      {/* Modale ajout tâche */}
      <Dialog open={showAddTask} onOpenChange={setShowAddTask}>
        <DialogContent className="bg-[#0f141b] border-[#1f2937] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground text-[14px]">{t("tasks.addTask")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder={t("tasks.addTask")}
              className="bg-white/[0.02] border-[#1f2937] text-foreground text-[13px]"
              onKeyDown={(e) => { if (e.key === "Enter") handleAddTask(); }}
              autoFocus
            />
            <TaskAssigneePicker
              members={orgMembersList}
              currentUserId={currentUserId}
              value={newTaskAssignees}
              onChange={setNewTaskAssignees}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setShowAddTask(false); setNewTaskTitle(""); setNewTaskAssignees([]); }} className="text-[#8b95a7] hover:text-white h-8 text-[12px]">
                {t("common.cancel")}
              </Button>
              <Button size="sm" onClick={handleAddTask} disabled={createTask.isPending || newTaskTitle.trim().length < 2} className="h-8 text-[12px] gap-1.5 rounded-full bg-white/[0.08] border border-[#2a3441] text-white hover:bg-white/[0.12]">
                {createTask.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                {t("common.add")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Compose / Reply */}
      <Dialog open={replyOpen} onOpenChange={(open) => { if (!open) { setReplyOpen(false); setReplyText(""); setReplyTo(""); setReplySubject(""); setReplyAttachments([]); } }}>
        <DialogContent className="bg-[#0f141b] border-[#1f2937] w-[95vw] sm:max-w-2xl p-0 flex flex-col max-h-[85vh]">
          <DialogHeader className="px-5 py-4 border-b border-[#1f2937]">
            <DialogTitle className="text-foreground text-[14px] flex items-center gap-2">
              <Reply className="w-4 h-4" />
              {t("inbox.reply")}
            </DialogTitle>
          </DialogHeader>
          <div className="px-5 py-4 space-y-3 overflow-y-auto">
            <div>
              <label className="text-[10px] text-[#6b7280] uppercase tracking-wider mb-1 block">{t("inbox.replyTo")}</label>
              <Input value={replyTo} onChange={(e) => setReplyTo(e.target.value)} placeholder="email@exemple.com" className="bg-white/[0.02] border-[#1f2937] text-foreground text-[12px] h-8" />
            </div>
            <div>
              <label className="text-[10px] text-[#6b7280] uppercase tracking-wider mb-1 block">{t("inbox.subject")}</label>
              <Input value={replySubject} onChange={(e) => setReplySubject(e.target.value)} placeholder={t("inbox.subject")} className="bg-white/[0.02] border-[#1f2937] text-foreground text-[12px] h-8" />
            </div>
            <div>
              <label className="text-[10px] text-[#6b7280] uppercase tracking-wider mb-1 block">{t("inbox.message")}</label>
              <Textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder={t("inbox.replyPlaceholder")} className="min-h-[200px] bg-white/[0.02] border-[#1f2937] text-foreground text-[12px] resize-y" />
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-[#1f2937]">
            <FileAttachInput files={replyAttachments} onChange={setReplyAttachments} />
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setReplyOpen(false); setReplyText(""); setReplyTo(""); setReplySubject(""); setReplyAttachments([]); }} className="text-[#8b95a7] hover:text-white h-8 text-[12px]">{t("common.cancel")}</Button>
              <Button size="sm" className="gap-1.5 h-8 text-[12px] rounded-full bg-white/[0.08] border border-[#2a3441] text-white hover:bg-white/[0.12]" disabled={sendEmailMut.isPending || !replyTo.trim() || !replySubject.trim() || !replyText.trim()} onClick={handleSendReply}>
                <Send className="w-3.5 h-3.5" />
                {sendEmailMut.isPending ? t("inbox.sending") : t("inbox.send")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
