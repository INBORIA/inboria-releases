import { useState, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { fr, enUS, nl, de, es, it, pt, pl, ro, sv, da, fi, hu, cs, tr, ja, ko, vi, th, id, ms, el } from "date-fns/locale";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  Inbox, Clock, Eye, AlertTriangle, Sparkles, Reply, Forward, Wand2, Loader2, Printer,
  Archive, Trash2, ListTodo, CalendarDays, Download, Send, Lock, LockOpen, CheckCircle2,
  MoreHorizontal, ChevronDown, ChevronUp, ChevronRight, ArrowLeft,
  FolderKanban, Folder, FolderPlus, ExternalLink, Users, Hand,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RecipientInput } from "@/components/email-list/RecipientInput";
import { Textarea } from "@/components/ui/textarea";
import { SignatureEditor } from "@/components/signature/signature-editor";
import { CollaborativeComposer } from "@/components/email-detail/CollaborativeComposer";
import { colorForUser } from "@/hooks/use-shared-draft";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const plainTextToHtml = (s: string): string =>
  (s || "")
    .split("\n")
    .map((l) => l.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"))
    .join("<br>");

import { extractEmailAddress } from "@/lib/utils";
import { translateCategoryName } from "@/lib/category-translations";
import { resolveMailboxBadge } from "@/lib/mailbox-resolver";

import { EmailBodyRenderer } from "@/components/EmailBodyRenderer";
import { EmailComments } from "@/components/email-comments";
import { useEmailPresence } from "@/hooks/use-email-presence";
import { useSharedDraft, type DraftFields } from "@/hooks/use-shared-draft";
import { TaskAssigneePicker } from "@/components/task-assignee-picker";
import { AttachmentList } from "@/components/AttachmentList";
import { FileAttachInput, type UploadedFile } from "@/components/FileAttachInput";
import { TemplateSuggestionBar } from "@/components/templates/template-suggestion-bar";
import { SaveAsTemplateButton } from "@/components/templates/save-as-template-button";
import { TemplatePickerButton } from "@/components/templates/template-picker-button";
import SnoozeButton from "@/components/wave1/SnoozeButton";
import ScheduleSendDialog from "@/components/wave1/ScheduleSendDialog";

import {
  getGetProfileQueryKey,
  useGetInboriaExpertSuggestion,
  getGetInboriaExpertSuggestionQueryKey,
  useDetectAppointments,
  useUpdateAppointment,
  getListAppointmentsQueryKey,
  useListFolders,
  useAssignEmailsToFolder,
} from "@workspace/api-client-react";

interface EmailPrivateFields {
  isPrivate?: boolean;
}
interface ExpertSuggestionShape {
  suggestion: {
    userId: string;
    fullName: string;
    interactionCount: number;
    lastInteractionAt: string | null;
    score: number;
  } | null;
}

import { PRIORITY_BAR_COLORS, buildForwardCitation, buildForwardCitationHtml } from "./helpers";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Menu "Exporter ▾" regroupant les deux exports possibles d'un mail :
// - CSV : metadonnees pour Excel / analyse
// - .eml : format mail standard ouvrable dans Outlook / Apple Mail
//   + drag-out HTML5 vers le bureau (Chromium DownloadURL)
function ExportEmlButton({ emailId, subject }: { emailId: number; subject: string }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const safeName =
    (subject || "mail").replace(/[^a-zA-Z0-9._\- ]+/g, "_").slice(0, 60).trim() || "mail";
  const filename = `${safeName}-${emailId}.eml`;
  // Blob-URL pre-telechargee pour le glisser-dehors. dataTransfer n'est
  // modifiable QUE pendant dragstart (synchrone) : on prepare donc l'URL au
  // survol / a l'appui pour qu'elle soit prete au demarrage du glisser.
  const emlBlobUrl = useRef<string | null>(null);
  const fetchingEml = useRef(false);

  useEffect(() => {
    return () => {
      if (emlBlobUrl.current) {
        URL.revokeObjectURL(emlBlobUrl.current);
        emlBlobUrl.current = null;
      }
    };
  }, []);

  const fetchEmlBlob = useCallback(async (): Promise<Blob | null> => {
    try {
      const { supabase } = await import("@/lib/supabase");
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const res = await fetch(
        `${import.meta.env.BASE_URL}api/emails/${emailId}/export.eml`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      );
      if (!res.ok) throw new Error("export failed");
      return await res.blob();
    } catch {
      return null;
    }
  }, [emailId]);

  const onClick = useCallback(async () => {
    setBusy(true);
    try {
      const blob = await fetchEmlBlob();
      if (!blob) {
        toast({ variant: "destructive", title: "Téléchargement impossible" });
        return;
      }
      const { saveBlobAs } = await import("@/lib/export-utils");
      await saveBlobAs(blob, filename);
    } finally {
      setBusy(false);
    }
  }, [fetchEmlBlob, filename, toast]);

  // Pre-telecharge le .eml pour qu'il soit pret au prochain glisser.
  const prefetchEml = useCallback(() => {
    if (emlBlobUrl.current || fetchingEml.current) return;
    fetchingEml.current = true;
    void (async () => {
      try {
        const blob = await fetchEmlBlob();
        if (blob) emlBlobUrl.current = URL.createObjectURL(blob);
      } finally {
        fetchingEml.current = false;
      }
    })();
  }, [fetchEmlBlob]);

  // Drag-out HTML5 vers le bureau / un dossier (Chromium uniquement).
  const onDragStart = useCallback(
    (e: React.DragEvent<HTMLButtonElement>) => {
      const ready = emlBlobUrl.current;
      if (!ready) {
        // Pas encore pret : on amorce la pre-fetch pour le prochain essai et on
        // laisse tomber ce glisser (le bouton « Exporter » reste utilisable).
        prefetchEml();
        e.preventDefault();
        return;
      }
      e.dataTransfer.effectAllowed = "copy";
      try {
        e.dataTransfer.setData("DownloadURL", `message/rfc822:${filename}:${ready}`);
      } catch {
        /* noop */
      }
    },
    [filename, prefetchEml],
  );

  const onExportCsv = useCallback(async () => {
    setBusy(true);
    try {
      const { downloadExport } = await import("@/lib/export-utils");
      await downloadExport(`export/emails?id=${emailId}`, `email_${emailId}.csv`);
      toast({ title: t("inbox.exportDownloaded") });
    } catch {
      toast({ title: t("inbox.exportError"), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }, [emailId, t, toast]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          draggable
          onDragStart={onDragStart}
          onMouseEnter={prefetchEml}
          onPointerDown={prefetchEml}
          className="gap-1.5 h-7 text-[11px] bg-transparent border-border text-[#b8c5d6] hover:text-white hover:bg-white/[0.04] cursor-grab active:cursor-grabbing"
          disabled={busy}
          title={t("emailExport.dragHint")}
          data-testid="email-export-menu"
        >
          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
          {t("emailExport.button")} ▾
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-card border-border w-64">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-[#b8c5d6]">
          {t("emailExport.title")}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-[12px] text-white focus:bg-white/[0.06] cursor-pointer flex flex-col items-start gap-0.5 py-2"
          onClick={onClick}
          data-testid="email-export-eml"
        >
          <span className="font-medium">{t("emailExport.emlLabel")}</span>
          <span className="text-[10px] text-[#b8c5d6]">{t("emailExport.emlDesc")}</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-[12px] text-white focus:bg-white/[0.06] cursor-pointer flex flex-col items-start gap-0.5 py-2"
          onClick={onExportCsv}
          data-testid="email-export-csv"
        >
          <span className="font-medium">{t("emailExport.csvLabel")}</span>
          <span className="text-[10px] text-[#b8c5d6]">{t("emailExport.csvDesc")}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5 text-[10px] text-[#b8c5d6] leading-relaxed">
          {t("emailExport.chromeHint")}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function EmailDetail({ email, onBack, onMarkRead, onArchive, onDelete, onUpdatePriority, onUpdateCategory, onUpdateProject, onSendReply, isSending, onGenerateDraft, isDrafting, categories, projects, currentUserId, orgMembers, onAssign, onUnassign, onCreateTask, connections, sharedMailboxes }: { email: any; onBack: () => void; onMarkRead: (id: number) => void; onArchive: (id: number) => void; onDelete: (id: number) => void; onUpdatePriority: (id: number, priority: string) => void; onUpdateCategory: (id: number, categoryId: string) => void; onUpdateProject: (id: number, projectId: string) => void; onSendReply: (to: string, subject: string, body: string, replyToEmailId?: number, attachments?: UploadedFile[], connectionId?: string, projectId?: string, markHandledOfEmailId?: number, onSent?: () => void) => void; isSending: boolean; onGenerateDraft: (emailId: number, callback: (draft: string) => void) => void; isDrafting: boolean; categories: any[]; projects: any[]; currentUserId?: string; orgMembers?: any[]; onAssign?: (emailId: number, userId: string) => void; onUnassign?: (emailId: number) => void; onCreateTask?: (emailId: number, title: string, projectId?: string, assigneeUserIds?: string[]) => void; connections?: Array<{ id: string; provider: string; email_address: string; signature?: string | null }>; sharedMailboxes?: any[] }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? i18n.language.split("-")[0];
  const dateFnsLocale = ({fr,en:enUS,nl,de,es,it,pt,pl}[(i18n.resolvedLanguage || i18n.language || "fr").substring(0,2)] || fr);

  // Sync mail ouvert -> sessionStorage pour que le chat Inboria puisse
  // referencer "ce mail" meme quand l'URL n'a pas ?emailId= (cas panel
  // ouvert depuis une page hors /dashboard, ex. agenda).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = Number(email?.id);
    if (Number.isFinite(id) && id > 0) {
      try { window.sessionStorage.setItem("inboria.currentEmailId", String(id)); } catch { /* no-op */ }
    }
    return () => {
      try {
        const cur = window.sessionStorage.getItem("inboria.currentEmailId");
        if (cur && Number(cur) === id) window.sessionStorage.removeItem("inboria.currentEmailId");
      } catch { /* no-op */ }
    };
  }, [email?.id]);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyAttachments, setReplyAttachments] = useState<UploadedFile[]>([]);
  const [replyTo, setReplyTo] = useState("");
  const [replySubject, setReplySubject] = useState("");
  const [replyText, setReplyText] = useState("");
  const [replyConnectionId, setReplyConnectionId] = useState<string>("");
  const [replyProjectId, setReplyProjectId] = useState<string>("");
  const [forwardOpen, setForwardOpen] = useState(false);
  const [forwardAttachments, setForwardAttachments] = useState<UploadedFile[]>([]);
  const [forwardTo, setForwardTo] = useState("");
  const [forwardSubject, setForwardSubject] = useState("");
  const [forwardText, setForwardText] = useState("");
  const [forwardConnectionId, setForwardConnectionId] = useState<string>("");
  const [forwardIntroLoading, setForwardIntroLoading] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [scheduleForwardDialogOpen, setScheduleForwardDialogOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const resolveDefaultConnectionId = useCallback(() => {
    if (!connections || connections.length === 0) return "";
    const recip = (email?.recipient || "").toLowerCase();
    const match = connections.find((c) => (c.email_address || "").toLowerCase() === recip);
    return String((match || connections[0]).id);
  }, [connections, email]);

  const signatureForConnection = useCallback((connId: string): string => {
    const conn = connections?.find((c) => String(c.id) === String(connId));
    const raw = (conn?.signature || "").trim();
    // If signature is HTML (contains tags), do NOT prefix it as plain text in
    // the reply textarea. The server will append it as HTML on send.
    if (/<[a-z][\s\S]*>/i.test(raw)) return "";
    return raw;
  }, [connections]);

  // Raccourcis externes (clic droit liste -> Répondre / Transférer).
  useEffect(() => {
    const onReply = (e: Event) => {
      const ev = e as CustomEvent<{ emailId?: number }>;
      if (!ev.detail || ev.detail.emailId !== email.id) return;
      setReplyTo(email.senderEmail || extractEmailAddress(email.sender) || "");
      setReplySubject(email.subject?.startsWith("Re:") ? email.subject : `Re: ${email.subject}`);
      setReplyOpen(true);
    };
    const onForward = (e: Event) => {
      const ev = e as CustomEvent<{ emailId?: number }>;
      if (!ev.detail || ev.detail.emailId !== email.id) return;
      const defConn = resolveDefaultConnectionId();
      setForwardConnectionId(defConn);
      setForwardTo("");
      const subj = email.subject || "";
      const prefix = t("inbox.forwardSubjectPrefix");
      setForwardSubject(subj.toLowerCase().startsWith(prefix.trim().toLowerCase()) ? subj : `${prefix}${subj}`);
      const sig = signatureForConnection(defConn);
      const sigBlock = sig ? `\n\n-- \n${sig}` : "";
      const citationHtml = buildForwardCitationHtml(email, t, dateFnsLocale);
      setForwardText(plainTextToHtml(sigBlock) + citationHtml);
      setForwardOpen(true);
    };
    window.addEventListener("inbox-reply-shortcut", onReply);
    window.addEventListener("inbox-forward-shortcut", onForward);
    return () => {
      window.removeEventListener("inbox-reply-shortcut", onReply);
      window.removeEventListener("inbox-forward-shortcut", onForward);
    };
  }, [email.id, email.subject, email.sender, email.senderEmail, resolveDefaultConnectionId, signatureForConnection, t, dateFnsLocale]);
  // T004 — détection de collision de réponse (boîtes partagées / mails assignés).
  const isSharedContext = Boolean(email?.sharedMailboxId) || Boolean(email?.assignedTo);
  const me = (orgMembers || []).find((m: any) => m.userId === currentUserId);
  const myPresenceName = me?.fullName || me?.email || (currentUserId ? currentUserId.slice(0, 6) : "");
  const { peers: replyPeers } = useEmailPresence({
    emailId: email?.id,
    currentUserId: currentUserId || null,
    name: myPresenceName,
    enabled: isSharedContext,
    replying: replyOpen,
  });
  const replyingPeers = replyPeers.filter((p) => p.state === "replying");

  // T005 — brouillon partagé / co-rédaction temps réel (boîtes partagées / mails assignés).
  const applyingDraftRef = useRef(false);
  // Corps initial à injecter dans l'éditeur collaboratif (premier rédacteur / éditeur seul).
  const collabInitialBodyRef = useRef("");
  const myColor = colorForUser(currentUserId || "");
  const sharedDraft = useSharedDraft({
    emailId: email?.id,
    sharedMailboxId: email?.sharedMailboxId || null,
    currentUserId: currentUserId || null,
    name: myPresenceName,
    // Le corps est co-édité via Yjs (CRDT) ; le hook ne synchronise que to/sujet.
    bodyCollaborative: true,
    onRemote: (f: DraftFields, by: string) => {
      applyingDraftRef.current = true;
      setReplyTo(f.to);
      setReplySubject(f.subject);
      // Le corps n'est appliqué qu'au chargement initial (amorçage de l'éditeur) ;
      // les modifs distantes du corps passent ensuite par Yjs, pas par ici.
      if (by === "load") {
        collabInitialBodyRef.current = f.body;
        setReplyText(f.body);
      }
      setTimeout(() => {
        applyingDraftRef.current = false;
      }, 0);
    },
    onClosedByOther: (who: string) => {
      // Un collègue a envoyé le mail : on ferme le composer pour éviter un double envoi.
      setReplyOpen(false);
      setReplyText("");
      setReplyTo("");
      setReplySubject("");
      setReplyAttachments([]);
      toast({ title: t("inbox.sharedDraftSentByOther", "{{name}} a envoyé ce mail.", { name: who }) });
    },
  });
  // Réinitialise le corps initial de co-édition à chaque changement de mail,
  // pour éviter de réamorcer l'éditeur d'un brouillon avec le corps d'un autre.
  useEffect(() => {
    collabInitialBodyRef.current = "";
  }, [email?.id]);
  // Pousse les modifications locales du composer vers les autres éditeurs.
  useEffect(() => {
    if (!sharedDraft.active || applyingDraftRef.current) return;
    sharedDraft.sync({ to: replyTo, cc: "", subject: replySubject, body: replyText });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replyTo, replySubject, replyText, sharedDraft.active]);
  // T005 — coordination « qui envoie » sur brouillon partagé.
  const draftClaimerName = (() => {
    const id = sharedDraft.sendClaimedBy;
    if (!id || id === currentUserId) return "";
    const m = (orgMembers || []).find((x: any) => x.userId === id);
    const ed = sharedDraft.editors.find((e) => e.userId === id);
    return m?.fullName || m?.email || ed?.name || id.slice(0, 6);
  })();
  const sendLockedByOther =
    sharedDraft.active && !!sharedDraft.sendClaimedBy && sharedDraft.sendClaimedBy !== currentUserId;

  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskProjectId, setTaskProjectId] = useState("none");
  const [taskAssignees, setTaskAssignees] = useState<string[]>([]);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const detectAppointments = useDetectAppointments();
  const updateAppointment = useUpdateAppointment();
  const [appointmentRunning, setAppointmentRunning] = useState(false);

  // Task #294 — bouton "Déplacer vers dossier" depuis la vue détail mail.
  // Reproduit le mécanisme du HoverActions / clic droit liste, mais
  // accessible quand l'utilisateur a ouvert un mail en lecture.
  const { data: userFoldersList } = useListFolders();
  const assignToFolderFromDetail = useAssignEmailsToFolder();
  const [folderMoving, setFolderMoving] = useState(false);
  const handleMoveToFolderFromDetail = useCallback(async (folderId: string, folderName: string) => {
    if (!email?.id || folderMoving) return;
    setFolderMoving(true);
    try {
      await assignToFolderFromDetail.mutateAsync({ data: { folderId, emailIds: [email.id] } as any });
      toast({ title: t("folders.movedToast", { defaultValue: "Déplacé dans « {{name}} »", name: folderName }) });
      queryClient.invalidateQueries({ predicate: (q) => Array.isArray(q.queryKey) && String(q.queryKey[0] || "").includes("folder") });
    } catch {
      toast({ variant: "destructive", title: t("folders.moveFailed", { defaultValue: "Échec du déplacement." }) });
    } finally {
      setFolderMoving(false);
    }
  }, [email?.id, folderMoving, assignToFolderFromDetail, toast, t, queryClient]);

  const barColor = PRIORITY_BAR_COLORS[(email.priority || "faible") as keyof typeof PRIORITY_BAR_COLORS] || PRIORITY_BAR_COLORS.faible;

  // Task #176 — Marquer un email comme privé (invisible pour les admins org).
  // Resync local state when navigating between emails (le composant est
  // monté une seule fois et ré-utilisé quand l'utilisateur change de mail
  // dans la liste, donc useState seul retient l'ancienne valeur).
  const emailPrivate = email as EmailPrivateFields;
  const [isPrivate, setIsPrivate] = useState<boolean>(Boolean(emailPrivate.isPrivate));
  const [privateLoading, setPrivateLoading] = useState(false);
  useEffect(() => {
    setIsPrivate(Boolean(emailPrivate.isPrivate));
  }, [email?.id, emailPrivate.isPrivate]);
  // Task #205 — "Marquer traité" : action humaine explicite (à côté de
  // Archiver / Supprimer / Marquer privé). Pose handled_at + handled_by.
  const emailHandled = email as { handledAt?: string | null; handled_at?: string | null; handledBy?: string | null; handled_by?: string | null };
  const initialHandledAt = emailHandled.handledAt ?? emailHandled.handled_at ?? null;
  const initialHandledBy = emailHandled.handledBy ?? emailHandled.handled_by ?? null;
  const [handledAt, setHandledAt] = useState<string | null>(initialHandledAt);
  const [handledBy, setHandledBy] = useState<string | null>(initialHandledBy);
  const [handledLoading, setHandledLoading] = useState(false);
  useEffect(() => {
    setHandledAt(initialHandledAt);
    setHandledBy(initialHandledBy);
  }, [email?.id, initialHandledAt, initialHandledBy]);
  const handlerName = (() => {
    if (!handledBy) return "";
    if (currentUserId && handledBy === currentUserId) return t("inbox.handledByMe", "vous");
    const m = (orgMembers || []).find((x: any) => x.userId === handledBy);
    return m?.fullName || m?.email || handledBy.slice(0, 8);
  })();
  const toggleHandled = useCallback(async () => {
    if (!email?.id) return;
    setHandledLoading(true);
    try {
      const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");
      const { supabase } = await import("@/lib/supabase");
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const wantHandled = !handledAt;
      const res = await fetch(`${baseUrl}/api/emails/${email.id}/handled`, {
        method: wantHandled ? "POST" : "DELETE",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Échec");
      }
      const body = await res.json();
      setHandledAt(body.handledAt ?? null);
      setHandledBy(body.handledBy ?? null);
      queryClient.invalidateQueries({ queryKey: ["analytics-team"] });
      queryClient.invalidateQueries({ predicate: (q) => Array.isArray(q.queryKey) && String(q.queryKey[0] || "").includes("emails") });
      toast({
        title: wantHandled ? t("inbox.markedHandled", "Email marqué traité") : t("inbox.unmarkedHandled", "Marquage retiré"),
      });
    } catch (e: any) {
      toast({ title: t("common.error"), description: e?.message || "", variant: "destructive" });
    } finally {
      setHandledLoading(false);
    }
  }, [email?.id, handledAt, queryClient, t, toast]);

  const togglePrivate = useCallback(async () => {
    if (!email?.id) return;
    const next = !isPrivate;
    setPrivateLoading(true);
    try {
      const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");
      const { supabase } = await import("@/lib/supabase");
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const res = await fetch(`${baseUrl}/api/emails/${email.id}/private`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ isPrivate: next }),
      });
      if (!res.ok) throw new Error("Échec");
      setIsPrivate(next);
      toast({
        title: next
          ? t("emailDetail.privateOnTitle", "Email marqué privé")
          : t("emailDetail.privateOffTitle", "Email rendu visible"),
        description: next
          ? t(
              "emailDetail.privateOnDesc",
              "Cet email est désormais invisible pour vos admins (vue dossier équipe + Inboria).",
            )
          : t(
              "emailDetail.privateOffDesc",
              "Cet email redevient visible pour vos admins (vue dossier équipe + Inboria).",
            ),
      });
    } catch {
      toast({
        title: t("common.error", "Erreur"),
        description: t("emailDetail.privateError", "Impossible de mettre à jour la confidentialité."),
        variant: "destructive",
      });
    } finally {
      setPrivateLoading(false);
    }
  }, [email?.id, isPrivate, t, toast]);

  // Inboria Phase 4 — expert suggestion. Only fires for shared mailboxes
  // with multiple members and an unread/unassigned inbound email; the
  // backend itself returns null for personal mailboxes / outbound / solo
  // teams so we just gate the request on having an emailId.
  const expertQuery = useGetInboriaExpertSuggestion(
    { emailId: email?.id },
    {
      query: {
        queryKey: getGetInboriaExpertSuggestionQueryKey({ emailId: email?.id }),
        enabled: Boolean(email?.id) && !email?.assignedTo,
        staleTime: 60_000,
        retry: false,
      },
    },
  );
  const expertSuggestion = (expertQuery.data as ExpertSuggestionShape | undefined)?.suggestion ?? null as
    | {
        userId: string;
        fullName: string;
        interactionCount: number;
        lastInteractionAt: string | null;
        projectInteractionCount?: number;
        matchedProjects?: string[];
        reasons?: string[];
        score: number;
      }
    | null
    | undefined;

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-12 z-[5] flex items-center gap-2 mb-4 pb-2 pt-2 bg-background">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-[12px] h-7 px-2 rounded-md font-medium transition-colors text-[#b8c5d6] hover:text-white hover:bg-white/[0.06]"
          title={t("inbox.backHint", "Retour (Échap) — J/K pour naviguer, R répondre, E archiver") as string}
          aria-label={t("common.back", "Retour")}
          data-testid="button-back-to-inbox"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
        </button>
        <div className="flex-1" />
        {(() => {
          if (typeof window === "undefined") return null;
          let fromGmail = new URLSearchParams(window.location.search).get("from") === "gmail";
          try {
            if (!fromGmail && window.sessionStorage.getItem("inboria.fromGmail") === "1") fromGmail = true;
          } catch { /* noop */ }
          if (!fromGmail) return null;
          const msgId = String((email as any).providerMessageId || (email as any).provider_message_id || "").replace(/[<>]/g, "").trim();
          const gmailUrl = msgId
            ? `https://mail.google.com/mail/u/0/#search/rfc822msgid:${encodeURIComponent(msgId)}`
            : "https://mail.google.com/mail/u/0/#inbox";
          return (
            <a
              href={gmailUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[12px] h-7 px-2 rounded-md font-medium transition-colors text-[#b8c5d6] hover:text-white hover:bg-white/[0.06]"
              title={t("inbox.backToGmailHint", "Ouvrir ce mail exact dans Gmail") as string}
              data-testid="button-back-to-gmail"
            >
              <ExternalLink className="w-3.5 h-3.5 mr-1" />
              {t("inbox.backToGmail", "Retour à Gmail")}
            </a>
          );
        })()}
      </div>

      {isSharedContext && replyPeers.length > 0 && (
        <div className="mb-3 flex items-center gap-2 text-[11px] text-[#8b95a7]">
          <Eye className="w-3.5 h-3.5 shrink-0" />
          <span>
            {replyPeers.length === 1
              ? t("inbox.collisionViewingOne", {
                  defaultValue: "{{name}} consulte aussi ce mail",
                  name: replyPeers[0].name,
                })
              : t("inbox.collisionViewingMany", {
                  defaultValue: "{{count}} autres personnes consultent ce mail",
                  count: replyPeers.length,
                })}
          </span>
          <div className="flex -space-x-1">
            {replyPeers.slice(0, 4).map((p) => (
              <span
                key={p.userId}
                title={p.name}
                className="w-5 h-5 rounded-full border border-background flex items-center justify-center text-[9px] font-semibold text-[#fff]"
                style={{ backgroundColor: p.color }}
              >
                {(p.name || "?")[0].toUpperCase()}
              </span>
            ))}
          </div>
        </div>
      )}

      {isSharedContext && replyingPeers.length > 0 && (
        <div className="inboria-collision-banner mb-4 flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-200">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            {replyingPeers.length === 1
              ? t("inbox.collisionReplyingOne", {
                  defaultValue: "{{name}} répond déjà à ce mail",
                  name: replyingPeers[0].name,
                })
              : t("inbox.collisionReplyingMany", {
                  defaultValue: "{{count}} personnes répondent déjà à ce mail",
                  count: replyingPeers.length,
                })}
          </span>
        </div>
      )}

      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="flex">
          <div className="flex-1 min-w-0">
            <div className="p-4 border-b border-border">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-[12px]">
                    {(email.sender || "?")[0].toUpperCase()}
                  </div>
                  <div>
                    {(() => {
                      const contactEmail = (email.senderEmail || extractEmailAddress(email.sender) || "").trim();
                      const labelDom = (
                        <>
                          <div className="text-[13px] font-medium text-white">
                            {email.sender}
                          </div>
                          {email.senderEmail && email.senderEmail !== email.sender && (
                            <div className="text-[11px] text-[color:var(--mail-summary-text)]">
                              {email.senderEmail}
                            </div>
                          )}
                        </>
                      );
                      if (!contactEmail) {
                        return <div data-testid="link-contact-sender">{labelDom}</div>;
                      }
                      return (
                        <Link
                          href={`/dashboard/contacts/${encodeURIComponent(contactEmail)}`}
                          className="block !text-white no-underline hover:no-underline"
                          data-testid="link-contact-sender"
                          title={t("contactsPage.openContact", "Voir la fiche contact")}
                        >
                          {labelDom}
                        </Link>
                      );
                    })()}
                  </div>
                </div>
                <span className="text-[10px] text-[color:var(--mail-summary-text)] flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {format(new Date(email.createdAt), "d MMMM yyyy a HH:mm", { locale: dateFnsLocale })}
                </span>
              </div>
              {(() => {
                const recipients = String(email.recipient || "")
                  .split(/\s*[,;]\s*/)
                  .map((p: string) => {
                    const m = p.match(/^\s*"?([^"<>]*?)"?\s*<\s*([^<>]+)\s*>\s*$/);
                    if (m) return { name: (m[1] || "").trim() || m[2].trim(), email: m[2].trim().toLowerCase() };
                    const bare = p.replace(/^["'<\s]+|["'>\s]+$/g, "").toLowerCase();
                    if (bare.includes("@")) return { name: bare, email: bare };
                    return null;
                  })
                  .filter((x): x is { name: string; email: string } => !!x);
                if (recipients.length === 0) return null;
                return (
                  <div className="flex items-start gap-1.5 mb-2 flex-wrap">
                    <span className="text-[10px] uppercase tracking-wider text-[color:var(--mail-summary-text)] font-medium mt-0.5">À</span>
                    {recipients.map((r, i) => (
                      <span key={r.email} className="inline-flex items-center">
                        <span
                          className="text-[11px] text-[color:var(--mail-summary-text)]"
                          data-testid={`link-contact-recipient-${r.email}`}
                        >
                          {r.name}
                        </span>
                        {i < recipients.length - 1 && <span className="text-[11px] text-[color:var(--mail-summary-text)] mx-0.5">,</span>}
                      </span>
                    ))}
                  </div>
                );
              })()}
              <div className="text-[10px] uppercase tracking-wider text-[color:var(--mail-summary-text)] font-medium mb-1">{t("inbox.subjectLabel")}</div>
              <h2 className="text-[16px] font-bold text-white leading-snug">{email.subject || "(Sans objet)"}</h2>
              {(() => {
                const sn = (email as any).snoozedUntil;
                const oc = (email as any).openedCount as number | undefined;
                const oa = (email as any).openedAt as string | undefined;
                const sentAt = (email as any).sentAt;
                const snDate = sn ? new Date(sn) : null;
                const showSnoozed = !!(snDate && !isNaN(snDate.getTime()));
                const showOpened = !!(sentAt && typeof oc === "number" && oc > 0);
                if (!showSnoozed && !showOpened) return null;
                return (
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {showSnoozed && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px]" data-testid="badge-snoozed-until">
                        <Clock className="w-2.5 h-2.5" />
                        {t("wave1.snoozedUntilLabel", { date: format(snDate!, "PPp", { locale: dateFnsLocale }) })}
                      </span>
                    )}
                    {showOpened && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px]" data-testid="badge-opened-count" title={oa ? t("wave1.openedAtLabel", { date: format(new Date(oa), "PPp", { locale: dateFnsLocale }) }) as string : undefined}>
                        <Eye className="w-2.5 h-2.5" />
                        {t("wave1.openedBadgeCount", { count: oc! })}
                      </span>
                    )}
                  </div>
                );
              })()}
            </div>

            {email.summary && (
              <div className="px-4 py-2.5 bg-primary/[0.06] border-b border-border">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Sparkles className="w-3 h-3 text-primary" />
                  <span className="text-[10px] font-medium text-primary uppercase tracking-wider">{t("inbox.aiSummary")}</span>
                </div>
                <p className="text-[12px] text-[color:var(--mail-summary-text)] leading-relaxed">{email.summary}</p>
              </div>
            )}

            <div className="p-4">
              {email.body ? (
                <EmailBodyRenderer body={email.body} emailId={email.id} sender={email.senderEmail || email.sender} />
              ) : (
                <div className="space-y-2 animate-pulse" aria-label={t("inbox.loadingBody") as string}>
                  <div className="h-3 bg-white/5 rounded w-full" />
                  <div className="h-3 bg-white/5 rounded w-11/12" />
                  <div className="h-3 bg-white/5 rounded w-10/12" />
                  <div className="h-3 bg-white/5 rounded w-9/12" />
                  <div className="h-3 bg-white/5 rounded w-11/12" />
                </div>
              )}
              {email.attachments && email.attachments.length > 0 && (
                <AttachmentList attachments={email.attachments} />
              )}
            </div>

            <div className="px-4 py-3 border-t border-border">
              <div className="flex items-center gap-1.5 mb-2.5 flex-wrap">
                <Button
                  size="sm"
                  className="gap-1.5 h-7 text-[11px]"
                  onClick={() => {
                    if (!replyOpen) {
                      setReplyTo(extractEmailAddress(email.senderEmail) || extractEmailAddress(email.sender) || "");
                      setReplySubject(email.subject?.startsWith("Re:") ? email.subject : `Re: ${email.subject}`);
                      const defConn = resolveDefaultConnectionId();
                      setReplyConnectionId(defConn);
                      setReplyProjectId(email.project_id ? String(email.project_id) : "");
                      const sig = signatureForConnection(defConn);
                      setReplyText(sig ? plainTextToHtml(`\n\n-- \n${sig}`) : "");
                    }
                    setReplyOpen(!replyOpen);
                  }}
                >
                  <Reply className="w-3 h-3" />
                  {t("inbox.reply")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 h-7 text-[11px] bg-transparent border-border text-[#b8c5d6] hover:text-white hover:bg-white/[0.04]"
                  disabled={isDrafting}
                  onClick={() => {
                    setReplyTo(email.senderEmail || extractEmailAddress(email.sender) || "");
                    setReplySubject(email.subject?.startsWith("Re:") ? email.subject : `Re: ${email.subject}`);
                    const effectiveConnId = replyConnectionId || resolveDefaultConnectionId();
                    if (!replyConnectionId) setReplyConnectionId(effectiveConnId);
                    if (!replyProjectId && email.project_id) setReplyProjectId(String(email.project_id));
                    setReplyOpen(true);
                    onGenerateDraft(email.id, (draft) => {
                      setReplyText(draft || "");
                    });
                  }}
                >
                  {isDrafting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                  {isDrafting ? t("inbox.generating") : t("inbox.aiReply")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 h-7 text-[11px] bg-transparent border-border text-[#b8c5d6] hover:text-white hover:bg-white/[0.04]"
                  onClick={() => {
                    if (!forwardOpen) {
                      const defConn = resolveDefaultConnectionId();
                      setForwardConnectionId(defConn);
                      setForwardTo("");
                      const subj = email.subject || "";
                      const prefix = t("inbox.forwardSubjectPrefix");
                      setForwardSubject(subj.toLowerCase().startsWith(prefix.trim().toLowerCase()) ? subj : `${prefix}${subj}`);
                      const sig = signatureForConnection(defConn);
                      const sigBlock = sig ? `\n\n-- \n${sig}` : "";
                      const citationHtml = buildForwardCitationHtml(email, t, dateFnsLocale);
                      setForwardText(plainTextToHtml(sigBlock) + citationHtml);
                      setForwardAttachments([]);
                    }
                    setForwardOpen(!forwardOpen);
                  }}
                >
                  <Forward className="w-3 h-3" />
                  {t("inbox.forward")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 h-7 text-[11px] bg-transparent border-border text-[#b8c5d6] hover:text-white hover:bg-white/[0.04]"
                  disabled={forwardIntroLoading}
                  onClick={async () => {
                    const defConn = forwardConnectionId || resolveDefaultConnectionId();
                    if (!forwardConnectionId) setForwardConnectionId(defConn);
                    if (!forwardSubject) {
                      const subj = email.subject || "";
                      const prefix = t("inbox.forwardSubjectPrefix");
                      setForwardSubject(subj.toLowerCase().startsWith(prefix.trim().toLowerCase()) ? subj : `${prefix}${subj}`);
                    }
                    setForwardOpen(true);
                    setForwardIntroLoading(true);
                    try {
                      const { supabase } = await import("@/lib/supabase");
                      const { data: sessionData } = await supabase.auth.getSession();
                      const token = sessionData?.session?.access_token || "";
                      const baseUrl = import.meta.env.VITE_API_URL || `https://${window.location.host}`;
                      const resp = await fetch(`${baseUrl}/api/ai/forward-intro`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                        body: JSON.stringify({ emailId: email.id, to: forwardTo }),
                      });
                      const json = resp.ok ? await resp.json() : null;
                      const intro = (json?.intro || "").trim();
                      const sig = signatureForConnection(defConn);
                      const sigBlock = sig && !intro.includes(sig) ? `\n\n-- \n${sig}` : "";
                      const citationHtml = buildForwardCitationHtml(email, t, dateFnsLocale);
                      setForwardText(plainTextToHtml(`${intro}${sigBlock}`) + citationHtml);
                      if (resp.ok) {
                        queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
                      }
                    } catch {
                      // silent — keep panel open with whatever was there
                    } finally {
                      setForwardIntroLoading(false);
                    }
                  }}
                >
                  {forwardIntroLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                  {forwardIntroLoading ? t("inbox.generating") : t("inbox.aiForward")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 h-7 text-[11px] bg-transparent border-border text-[#b8c5d6] hover:text-white hover:bg-white/[0.04]"
                  title={t("inbox.print", "Imprimer")}
                  onClick={() => {
                    const w = window.open("", "_blank", "width=800,height=900");
                    if (!w) {
                      toast({ variant: "destructive", title: t("inbox.printPopupBlocked", "Impossible d'ouvrir la fenêtre d'impression") });
                      return;
                    }
                    const safeBody = (email.body || email.summary || "").toString();
                    const escape = (s: string) => String(s || "").replace(/[<>]/g, "");
                    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escape(email.subject || "")}</title>
                      <style>body{font-family:-apple-system,Segoe UI,sans-serif;color:#111;padding:24px;line-height:1.5}h1{font-size:18px;margin:0 0 12px}.meta{font-size:12px;color:#555;margin-bottom:18px;border-bottom:1px solid #ddd;padding-bottom:10px}img{max-width:100%}</style>
                      </head><body>
                      <h1>${escape(email.subject || "(sans sujet)")}</h1>
                      <div class="meta"><b>${escape(email.sender || "")}</b> &lt;${escape(email.senderEmail || "")}&gt;<br/>${new Date(email.createdAt).toLocaleString()}</div>
                      <div>${safeBody}</div>
                      </body></html>`);
                    w.document.close();
                    setTimeout(() => { try { w.focus(); w.print(); } catch {} }, 300);
                  }}
                >
                  <Printer className="w-3 h-3" />
                  {t("inbox.print", "Imprimer")}
                </Button>
                <SnoozeButton
                  emailId={email.id}
                  snoozedUntil={(email as any).snoozedUntil ?? null}
                />
                {userFoldersList && userFoldersList.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={folderMoving}
                        className="gap-1.5 h-7 text-[11px] bg-transparent border-border text-[#b8c5d6] hover:text-white hover:bg-white/[0.04]"
                      >
                        <FolderKanban className="w-3 h-3" />
                        {t("inbox.myFoldersLabel", { defaultValue: "Mes dossiers" })}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-card border-border max-h-[300px] overflow-y-auto">
                      {userFoldersList.map((f: any) => (
                        <DropdownMenuItem
                          key={f.id}
                          onClick={() => handleMoveToFolderFromDetail(f.id, f.name)}
                          className="gap-2 text-[12px] cursor-pointer"
                        >
                          <Folder className="w-3 h-3 shrink-0 text-primary/70" />
                          <span className="truncate">{f.name}</span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 h-7 text-[11px] bg-transparent border-border text-[#b8c5d6] hover:text-white hover:bg-white/[0.04]"
                  onClick={() => onArchive(email.id)}
                >
                  <Archive className="w-3 h-3" />
                  {t("inbox.archive")}
                </Button>
                <ExportEmlButton emailId={email.id} subject={email.subject || "mail"} />

                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 h-7 text-[11px] bg-transparent border-border text-red-400/70 hover:text-red-400 hover:bg-red-500/[0.08]"
                  onClick={() => onDelete(email.id)}
                >
                  <Trash2 className="w-3 h-3" />
                  {t("inbox.deleteEmail")}
                </Button>
                {handledAt && (
                  <span
                    className="inline-flex items-center gap-1.5 h-7 px-2 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px]"
                    title={t("inbox.handledOnHint", "Cliquez « Plus » pour annuler le marquage") as string}
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    {t("inbox.handledByOn", "Traité par {{name}} le {{date}}", {
                      name: handlerName,
                      date: format(new Date(handledAt), "d MMM", { locale: dateFnsLocale }),
                    })}
                  </span>
                )}
                {isPrivate && (
                  <span
                    className="inline-flex items-center gap-1.5 h-7 px-2 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px]"
                    title={t("emailDetail.unmarkPrivateHint", "Cliquez « Plus » pour rendre visible") as string}
                  >
                    <Lock className="w-3 h-3" />
                    {t("emailDetail.markPrivate", "Privé")}
                  </span>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 h-7 text-[11px] bg-transparent border-border text-[#b8c5d6] hover:text-white hover:bg-white/[0.04]"
                      data-testid="email-more-menu"
                    >
                      <MoreHorizontal className="w-3.5 h-3.5" />
                      {t("common.more", "Plus")}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-card border-border w-60">
                    <DropdownMenuItem
                      className="text-[12px] text-white focus:bg-white/[0.06] cursor-pointer gap-2"
                      onClick={() => { if (!handledLoading) toggleHandled(); }}
                      disabled={handledLoading}
                      data-testid="menu-toggle-handled"
                    >
                      {handledLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 text-[#b8c5d6]" />}
                      {handledAt
                        ? t("inbox.unmarkHandled", "Annuler « traité »")
                        : t("inbox.markHandled", "Marquer traité")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-[12px] text-white focus:bg-white/[0.06] cursor-pointer gap-2"
                      onClick={() => { if (!privateLoading) togglePrivate(); }}
                      disabled={privateLoading}
                      data-testid="menu-toggle-private"
                    >
                      {privateLoading
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : isPrivate
                          ? <LockOpen className="w-3.5 h-3.5 text-[#b8c5d6]" />
                          : <Lock className="w-3.5 h-3.5 text-[#b8c5d6]" />}
                      {isPrivate
                        ? t("emailDetail.unmarkPrivate", "Rendre visible")
                        : t("emailDetail.markPrivate", "Marquer privé")}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-[12px] text-white focus:bg-white/[0.06] cursor-pointer gap-2"
                      onClick={() => {
                        if (!taskFormOpen) {
                          setTaskTitle(`${t("inbox.handlePrefix")} ${email.subject}`);
                          setTaskProjectId(email.projectId || "none");
                        }
                        setTaskFormOpen(!taskFormOpen);
                      }}
                      data-testid="menu-create-task"
                    >
                      <ListTodo className="w-3.5 h-3.5 text-[#b8c5d6]" />
                      {t("inbox.createTask")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-[12px] text-white focus:bg-white/[0.06] cursor-pointer gap-2"
                      disabled={appointmentRunning || detectAppointments.isPending}
                      onClick={() => {
                        if (appointmentRunning) return;
                        setAppointmentRunning(true);
                        detectAppointments.mutate(
                          { data: { emailId: email.id, lang: i18n.language } },
                          {
                            onSuccess: async (data) => {
                              const created = ((data as { appointments?: any[] })?.appointments) || [];
                              queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
                              queryClient.invalidateQueries({ queryKey: getListAppointmentsQueryKey() });
                              if (created.length === 0) {
                                toast({ title: t("agenda.noDetectedForEmail", "Aucun rendez-vous detecte dans cet email."), variant: "default" });
                                setAppointmentRunning(false);
                                return;
                              }
                              await Promise.all(
                                created.map((apt: any) =>
                                  new Promise<void>((resolve) => {
                                    updateAppointment.mutate(
                                      { id: String(apt.id), data: { confirmed: true } },
                                      { onSettled: () => resolve() },
                                    );
                                  }),
                                ),
                              );
                              queryClient.invalidateQueries({ queryKey: getListAppointmentsQueryKey() });
                              const first = created[0];
                              let detail = "";
                              try {
                                if (first?.startAt) {
                                  detail = format(new Date(first.startAt), "PPP p", { locale: dateFnsLocale });
                                }
                              } catch {
                                detail = "";
                              }
                              const titlePart = created.length === 1
                                ? `${first?.title || ""}${detail ? " — " + detail : ""}`
                                : t("agenda.detectedCount", { count: created.length });
                              toast({
                                title: t("agenda.createdFromEmail", "Rendez-vous ajoute a l'agenda"),
                                description: titlePart,
                                action: (
                                  <Link
                                    to="/dashboard/agenda"
                                    className="text-emerald-400 hover:text-emerald-300 underline text-xs"
                                  >
                                    {t("agenda.viewInAgenda", "Voir l'agenda")}
                                  </Link>
                                ),
                              });
                              setAppointmentRunning(false);
                            },
                            onError: (err: any) => {
                              const msg = err?.response?.data?.error || t("agenda.detectError", "Detection impossible. Reessayez.");
                              toast({ title: msg, variant: "destructive" });
                              setAppointmentRunning(false);
                            },
                          },
                        );
                      }}
                      data-testid="menu-create-appointment"
                    >
                      {appointmentRunning || detectAppointments.isPending
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <CalendarDays className="w-3.5 h-3.5 text-[#b8c5d6]" />}
                      {t("agenda.createFromEmail")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {orgMembers && orgMembers.length > 0 && expertSuggestion && !email.assignedTo && expertSuggestion.userId !== currentUserId && (
                <div className="mb-2">
                  <button
                    type="button"
                    onClick={() => onAssign?.(email.id, expertSuggestion.userId)}
                    title={
                      (expertSuggestion as any).reasons && (expertSuggestion as any).reasons.length > 0
                        ? ((expertSuggestion as any).reasons as string[]).join("\n")
                        : expertSuggestion.lastInteractionAt
                        ? t("inboriaExpert.tooltip", {
                            count: expertSuggestion.interactionCount,
                            date: format(new Date(expertSuggestion.lastInteractionAt), "PP", { locale: dateFnsLocale }),
                          })
                        : t("inboriaExpert.tooltipNoDate", { count: expertSuggestion.interactionCount })
                    }
                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-[11px] transition-colors"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span className="font-medium">{t("inboriaExpert.suggested")}</span>
                    <span className="text-white">{expertSuggestion.fullName || t("inboriaExpert.aTeammate")}</span>
                    <span className="text-[#b8c5d6]">· {t("inboriaExpert.assignThisOne")}</span>
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={() => setDetailsOpen(!detailsOpen)}
                className="flex items-center gap-2 text-[11px] text-[#b8c5d6] hover:text-white transition-colors"
                data-testid="toggle-email-details"
              >
                {detailsOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                <span className="uppercase tracking-wider">{t("emailDetail.details", "Détails")}</span>
                {!detailsOpen && (
                  <span className="text-[#7a8699] normal-case tracking-normal">
                    {[
                      t(`inbox.priorities.${email.priority === "moyen" ? "medium" : email.priority === "faible" ? "low" : "urgent"}`),
                      email.categoryId
                        ? translateCategoryName(
                            categories.find((c: any) => String(c.categoryId) === String(email.categoryId))?.categoryName || "",
                            lang,
                          )
                        : null,
                      email.projectId
                        ? (projects.find((p: any) => String(p.id) === String(email.projectId))?.reference || t("inbox.noProject", "Aucun projet"))
                        : t("inbox.noProject", "Aucun projet"),
                      email.assignedTo
                        ? ((orgMembers || []).find((m: any) => m.userId === email.assignedTo)?.fullName
                            || (orgMembers || []).find((m: any) => m.userId === email.assignedTo)?.email
                            || t("inbox.notAssigned", "Non assigné"))
                        : t("inbox.notAssigned", "Non assigné"),
                    ].filter(Boolean).join(" · ")}
                  </span>
                )}
              </button>
              {detailsOpen && (
              <div className="flex items-center gap-2.5 flex-wrap mt-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-[#b8c5d6] uppercase tracking-wider">{t("inbox.priority")}:</span>
                  <Select value={email.priority} onValueChange={(val) => onUpdatePriority(email.id, val)}>
                    <SelectTrigger className="w-[100px] h-6 bg-card border-border text-[11px] text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="urgent">{t("inbox.priorities.urgent")}</SelectItem>
                      <SelectItem value="moyen">{t("inbox.priorities.medium")}</SelectItem>
                      <SelectItem value="faible">{t("inbox.priorities.low")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-[#b8c5d6] uppercase tracking-wider">{t("inbox.category")}:</span>
                  <Select value={email.categoryId?.toString() || "none"} onValueChange={(val) => onUpdateCategory(email.id, val)}>
                    <SelectTrigger className="w-[130px] h-6 bg-card border-border text-[11px] text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="none">{t("inbox.uncategorized")}</SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat.categoryId} value={cat.categoryId.toString()}>{translateCategoryName(cat.categoryName, lang)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-[#b8c5d6] uppercase tracking-wider">{t("inbox.project")}:</span>
                  <Select value={email.projectId || "none"} onValueChange={(val) => onUpdateProject(email.id, val)}>
                    <SelectTrigger className="w-[140px] h-6 bg-card border-border text-[11px] text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="none">{t("inbox.noProject")}</SelectItem>
                      {projects.map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>{p.reference} — {p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {orgMembers && orgMembers.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-[#b8c5d6] uppercase tracking-wider">{t("inbox.assignedTo")}:</span>
                    <Select
                      value={email.assignedTo || "none"}
                      onValueChange={(val) => {
                        if (val === "none") {
                          onUnassign?.(email.id);
                        } else {
                          onAssign?.(email.id, val);
                        }
                      }}
                    >
                      <SelectTrigger className="w-[150px] h-6 bg-card border-border text-[11px] text-white">
                        <SelectValue placeholder={t("inbox.notAssigned")} />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border">
                        <SelectItem value="none">{t("inbox.notAssigned")}</SelectItem>
                        {orgMembers.map((m: any) => (
                          <SelectItem key={m.userId} value={m.userId}>
                            {m.fullName || m.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              )}
            </div>

            <EmailComments
              emailId={email.id}
              currentUserId={currentUserId}
              email={email}
              assignedTo={email.assignedTo || null}
              sharedMailboxId={email.sharedMailboxId || null}
              ownerId={email.userId || null}
            />

            {taskFormOpen && (
              <div className="px-4 pb-4 border-t border-border pt-3 space-y-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <ListTodo className="w-3.5 h-3.5 text-[#b8c5d6]" />
                  <span className="text-[11px] font-medium text-cyan-400 uppercase tracking-wider">{t("inbox.newTask")}</span>
                </div>
                <div>
                  <label className="text-[10px] text-[#b8c5d6] uppercase tracking-wider mb-1 block">{t("inbox.taskTitle")}</label>
                  <Input
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    placeholder={t("inbox.taskTitlePlaceholder")}
                    className="bg-background border-border text-white text-[12px] h-8"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#b8c5d6] uppercase tracking-wider mb-1 block">{t("inbox.taskProjectOptional")}</label>
                  <Select value={taskProjectId} onValueChange={setTaskProjectId}>
                    <SelectTrigger className="w-full h-8 bg-background border-border text-[12px] text-white">
                      <SelectValue placeholder={t("inbox.noProject")} />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="none">{t("inbox.noProject")}</SelectItem>
                      {projects.map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>{p.reference} — {p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[10px] text-[#b8c5d6] uppercase tracking-wider mb-1 block">{t("tasks.assignTo", "Assigner à")}</label>
                  <TaskAssigneePicker
                    members={(orgMembers as any[]) || []}
                    currentUserId={currentUserId || null}
                    value={taskAssignees}
                    onChange={setTaskAssignees}
                  />
                </div>
                <div className="flex items-center gap-2 justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setTaskFormOpen(false); setTaskTitle(""); setTaskProjectId("none"); setTaskAssignees([]); }}
                    className="text-[#b8c5d6] hover:text-white h-7 text-[11px]"
                  >
                    {t("common.cancel")}
                  </Button>
                  <Button
                    size="sm"
                    className="gap-1.5 h-7 text-[11px]"
                    disabled={!taskTitle.trim()}
                    onClick={() => {
                      onCreateTask?.(
                        email.id,
                        taskTitle.trim(),
                        taskProjectId !== "none" ? taskProjectId : undefined,
                        taskAssignees,
                      );
                      setTaskFormOpen(false);
                      setTaskTitle("");
                      setTaskProjectId("none");
                      setTaskAssignees([]);
                    }}
                  >
                    <ListTodo className="w-3 h-3" />
                    {t("followup.create")}
                  </Button>
                </div>
              </div>
            )}


            {replyOpen && (
              <div className="px-4 pb-4 border-t border-border pt-3 space-y-2.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <TemplateSuggestionBar
                    emailId={email.id}
                    enabled={replyOpen}
                    emailSender={email.sender || null}
                    emailSubject={email.subject || null}
                    onInsert={(body, subject) => {
                      setReplyText((prev) => (prev?.trim() ? `${body}\n\n${prev}` : body));
                      if (subject && !replySubject) setReplySubject(subject);
                    }}
                  />
                  <TemplatePickerButton
                    emailSender={email.sender || null}
                    emailSubject={email.subject || null}
                    onInsert={(body, subject) => {
                      const html = plainTextToHtml(body);
                      setReplyText((prev) => (prev?.trim() ? `${html}<br><br>${prev}` : html));
                      if (subject && !replySubject) setReplySubject(subject);
                    }}
                  />
                </div>
                {isSharedContext && (
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <Button
                      type="button"
                      variant={sharedDraft.active ? "default" : "outline"}
                      size="sm"
                      className={`gap-1.5 h-7 text-[11px] ${
                        sharedDraft.active
                          ? ""
                          : "border-primary/40 text-primary hover:bg-primary/10 hover:text-primary"
                      }`}
                      onClick={() => {
                        if (sharedDraft.active) {
                          sharedDraft.deactivate();
                        } else {
                          sharedDraft.activate({ to: replyTo, cc: "", subject: replySubject, body: replyText });
                        }
                      }}
                      data-testid="button-shared-draft"
                    >
                      <Users className="w-3 h-3" />
                      {sharedDraft.active
                        ? t("inbox.sharedDraftOn", "Brouillon partagé activé")
                        : t("inbox.sharedDraft", "Brouillon partagé")}
                    </Button>
                    {sharedDraft.active && (
                      <div className="flex items-center gap-2 text-[11px] text-[#8b95a7] min-w-0">
                        {sharedDraft.editors.length > 0 && (
                          <span className="flex items-center gap-1 min-w-0">
                            {sharedDraft.editors.slice(0, 3).map((ed) => (
                              <span
                                key={ed.userId}
                                className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-semibold text-white shrink-0"
                                style={{ backgroundColor: ed.color }}
                                title={ed.name}
                              >
                                {(ed.name || "?").slice(0, 1).toUpperCase()}
                              </span>
                            ))}
                            <span className="truncate">{t("inbox.draftEditing", "édite(nt) en ce moment")}</span>
                          </span>
                        )}
                        <span className="shrink-0">
                          {sharedDraft.saving
                            ? t("inbox.draftSaving", "Enregistrement…")
                            : t("inbox.draftSaved", "Enregistré")}
                        </span>
                      </div>
                    )}
                    {sharedDraft.active && (
                      <div className="flex items-center gap-2 text-[11px]">
                        {!sharedDraft.sendClaimedBy && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 text-[11px] gap-1 bg-transparent border-primary/30 text-primary hover:bg-primary/10 hover:text-primary"
                            onClick={() => sharedDraft.claimSend()}
                          >
                            <Hand className="w-3 h-3" />
                            {t("inbox.draftClaimSend", "C'est moi qui envoie")}
                          </Button>
                        )}
                        {sharedDraft.sendClaimedBy === currentUserId && (
                          <span className="flex items-center gap-1.5">
                            <span className="text-primary">{t("inbox.draftYouSend", "C'est vous qui envoyez")}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-[11px] text-[#8b95a7] hover:text-white"
                              onClick={() => sharedDraft.releaseSend()}
                            >
                              {t("inbox.draftRelease", "Libérer")}
                            </Button>
                          </span>
                        )}
                        {sharedDraft.sendClaimedBy && sharedDraft.sendClaimedBy !== currentUserId && (
                          <span className="flex items-center gap-1.5">
                            <span className="flex items-center gap-1 text-amber-400">
                              <Hand className="w-3 h-3" />
                              {t("inbox.draftSomeoneSends", "{{name}} va l'envoyer", { name: draftClaimerName })}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-[11px] text-[#8b95a7] hover:text-white"
                              onClick={() => sharedDraft.claimSend()}
                              title={t("inbox.draftTakeOverHint", "Reprendre l'envoi si ce collègue n'est plus disponible")}
                            >
                              {t("inbox.draftTakeOver", "Reprendre")}
                            </Button>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {connections && connections.length > 1 && (
                  <div>
                    <label className="text-[10px] text-[#b8c5d6] uppercase tracking-wider mb-1 block">{t("inbox.from", "De")}</label>
                    <Select
                      value={replyConnectionId}
                      onValueChange={(v) => {
                        const oldSig = signatureForConnection(replyConnectionId);
                        const newSig = signatureForConnection(v);
                        setReplyConnectionId(v);
                        setReplyText((prev) => {
                          let base = prev || "";
                          if (oldSig) {
                            const oldBlock = `\n\n-- \n${oldSig}`;
                            const idx = base.lastIndexOf(oldBlock);
                            if (idx !== -1) base = base.slice(0, idx) + base.slice(idx + oldBlock.length);
                          }
                          if (newSig) base = `${base.replace(/\s+$/, "")}\n\n-- \n${newSig}`;
                          return base;
                        });
                      }}
                    >
                      <SelectTrigger className="bg-background border-border text-white text-[12px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {connections.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>{c.email_address}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <label className="text-[10px] text-[#b8c5d6] uppercase tracking-wider mb-1 block">{t("inbox.replyTo")}</label>
                  <RecipientInput
                    value={replyTo}
                    onChange={setReplyTo}
                    orgMembers={orgMembers}
                    placeholder="email@exemple.com"
                    className="bg-background border-border text-white text-[12px] h-8"
                  />
                </div>
                {projects && projects.length > 0 && (
                  <div>
                    <label className="text-[10px] text-[#b8c5d6] uppercase tracking-wider mb-1 block">{t("inbox.project")}</label>
                    <Select value={replyProjectId || "__none__"} onValueChange={(v) => setReplyProjectId(v === "__none__" ? "" : v)}>
                      <SelectTrigger className="bg-background border-border text-white text-[12px] h-8">
                        <SelectValue placeholder={t("inbox.noProject")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">{t("inbox.noProject")}</SelectItem>
                        {projects.map((p: any) => (
                          <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <label className="text-[10px] text-[#b8c5d6] uppercase tracking-wider mb-1 block">{t("inbox.subject")}</label>
                  <Input
                    value={replySubject}
                    onChange={(e) => setReplySubject(e.target.value)}
                    placeholder={t("inbox.subject")}
                    className="bg-background border-border text-white text-[12px] h-8"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#b8c5d6] uppercase tracking-wider mb-1 block">{t("inbox.message")}</label>
                  {sharedDraft.active && sharedDraft.draftId ? (
                    <CollaborativeComposer
                      key={sharedDraft.draftId}
                      draftId={sharedDraft.draftId}
                      initialHtml={collabInitialBodyRef.current || replyText}
                      canSeed={
                        (!!sharedDraft.createdBy && sharedDraft.createdBy === currentUserId) ||
                        (sharedDraft.presenceSynced && sharedDraft.editors.length === 0)
                      }
                      userName={myPresenceName}
                      userColor={myColor}
                      peers={sharedDraft.editors}
                      onChange={setReplyText}
                      minHeight={480}
                    />
                  ) : (
                    <SignatureEditor
                      value={replyText}
                      onChange={setReplyText}
                      placeholder={t("inbox.replyPlaceholder")}
                      hideHint
                      minHeight={480}
                    />
                  )}
                </div>
                <div className="flex items-center gap-2 justify-between">
                  <div className="flex items-center gap-2">
                    <FileAttachInput files={replyAttachments} onChange={setReplyAttachments} />
                    <TemplatePickerButton
                      emailSender={email.sender || null}
                      emailSubject={email.subject || null}
                      onInsert={(body, subject) => {
                        const html = plainTextToHtml(body);
                        setReplyText((prev) => (prev?.trim() ? `${html}<br><br>${prev}` : html));
                        if (subject && !replySubject) setReplySubject(subject);
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <SaveAsTemplateButton subject={replySubject} body={replyText} sourceEmailId={email.id} />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { sharedDraft.deactivate(); setReplyOpen(false); setReplyText(""); setReplyTo(""); setReplySubject(""); setReplyAttachments([]); }}
                      className="text-[#b8c5d6] hover:text-white h-7 text-[11px]"
                    >
                      {t("common.cancel")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 h-7 text-[11px] bg-transparent border-primary/30 text-primary hover:bg-primary/10 hover:text-primary"
                      disabled={isSending || !replyTo.trim() || !replySubject.trim() || !replyText.trim() || sendLockedByOther}
                      onClick={() => setScheduleDialogOpen(true)}
                      data-testid="button-schedule-send"
                    >
                      <CalendarDays className="w-3 h-3" />
                      {t("wave1.scheduleButton")}
                    </Button>
                    <Button
                      size="sm"
                      className="gap-1.5 h-7 text-[11px]"
                      disabled={isSending || !replyTo.trim() || !replySubject.trim() || !replyText.trim() || sendLockedByOther}
                      title={sendLockedByOther ? t("inbox.draftSomeoneSends", "{{name}} va l'envoyer", { name: draftClaimerName }) : undefined}
                      onClick={() => {
                        const wasShared = sharedDraft.active;
                        // Id capturé maintenant : la suppression différée (~10s) doit
                        // viser CE brouillon même si l'état du hook change entre-temps.
                        const draftIdAtClick = sharedDraft.draftId;
                        const resetComposer = () => {
                          setReplyText("");
                          setReplyTo("");
                          setReplySubject("");
                          setReplyAttachments([]);
                          setReplyConnectionId("");
                          setReplyProjectId("");
                          setReplyOpen(false);
                        };
                        onSendReply(
                          replyTo,
                          replySubject,
                          replyText,
                          email.id,
                          replyAttachments,
                          replyConnectionId || undefined,
                          replyProjectId || undefined,
                          undefined,
                          // Suppression sécurisée : ne retirer le brouillon partagé
                          // qu'une fois l'envoi confirmé (jamais au simple clic).
                          wasShared
                            ? () => {
                                sharedDraft.removeById(draftIdAtClick);
                                resetComposer();
                              }
                            : undefined,
                        );
                        // Brouillon partagé : on NE vide PAS les champs au clic, sinon
                        // l'effet de sync pousserait des valeurs vides vers les autres
                        // éditeurs et l'annulation/échec laisserait un brouillon amputé.
                        // On réinitialise uniquement à la confirmation d'envoi (onSent).
                        if (!wasShared) resetComposer();
                      }}
                    >
                      <Send className="w-3 h-3" />
                      {isSending ? t("inbox.sending") : t("inbox.send")}
                    </Button>
                  </div>
                </div>
                <ScheduleSendDialog
                  open={scheduleDialogOpen}
                  onOpenChange={setScheduleDialogOpen}
                  to={replyTo}
                  subject={replySubject}
                  body={replyText}
                  replyToEmailId={email.id}
                  connectionId={replyConnectionId || undefined}
                  projectId={replyProjectId || undefined}
                  attachments={replyAttachments}
                  onScheduled={() => {
                    // Envoi programmé : on prévient les autres éditeurs et on
                    // supprime le brouillon partagé (même logique que l'envoi direct).
                    if (sharedDraft.active) sharedDraft.remove();
                    setReplyText("");
                    setReplyTo("");
                    setReplySubject("");
                    setReplyAttachments([]);
                    setReplyConnectionId("");
                    setReplyProjectId("");
                    setReplyOpen(false);
                  }}
                />
              </div>
            )}

            {forwardOpen && (
              <div className="px-4 pb-4 border-t border-border pt-3 space-y-2.5">
                {connections && connections.length > 1 && (
                  <div>
                    <label className="text-[10px] text-[#b8c5d6] uppercase tracking-wider mb-1 block">{t("inbox.from", "De")}</label>
                    <Select
                      value={forwardConnectionId}
                      onValueChange={(v) => {
                        const oldSig = signatureForConnection(forwardConnectionId);
                        const newSig = signatureForConnection(v);
                        setForwardConnectionId(v);
                        setForwardText((prev) => {
                          let base = prev || "";
                          if (oldSig) {
                            const oldBlock = `\n\n-- \n${oldSig}`;
                            const idx = base.indexOf(oldBlock);
                            if (idx !== -1) base = base.slice(0, idx) + base.slice(idx + oldBlock.length);
                          }
                          if (newSig) {
                            const citation = buildForwardCitation(email, t, dateFnsLocale);
                            const citIdx = base.indexOf(citation.split("\n").find((l) => l.trim().length > 0) || "");
                            if (citIdx > 0) {
                              base = `${base.slice(0, citIdx).replace(/\s+$/, "")}\n\n-- \n${newSig}\n\n${base.slice(citIdx)}`;
                            } else {
                              base = `${base.replace(/\s+$/, "")}\n\n-- \n${newSig}`;
                            }
                          }
                          return base;
                        });
                      }}
                    >
                      <SelectTrigger className="bg-background border-border text-white text-[12px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {connections.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>{c.email_address}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <label className="text-[10px] text-[#b8c5d6] uppercase tracking-wider mb-1 block">{t("inbox.replyTo")}</label>
                  <RecipientInput
                    value={forwardTo}
                    onChange={setForwardTo}
                    orgMembers={orgMembers}
                    placeholder="email@exemple.com"
                    className="bg-background border-border text-white text-[12px] h-8"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#b8c5d6] uppercase tracking-wider mb-1 block">{t("inbox.subject")}</label>
                  <Input
                    value={forwardSubject}
                    onChange={(e) => setForwardSubject(e.target.value)}
                    placeholder={t("inbox.subject")}
                    className="bg-background border-border text-white text-[12px] h-8"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#b8c5d6] uppercase tracking-wider mb-1 block">{t("inbox.message")}</label>
                  <SignatureEditor
                    value={forwardText}
                    onChange={setForwardText}
                    placeholder={t("inbox.replyPlaceholder")}
                    hideHint
                    minHeight={480}
                  />
                </div>
                {Array.isArray(email?.attachments) && email.attachments.length > 0 && (
                  <div className="text-[11px] text-[#b8c5d6] bg-white/[0.02] border border-border rounded-md p-2">
                    <div className="font-medium text-white/80 mb-1">{t("inbox.forwardOriginalAttachments")} ({email.attachments.length})</div>
                    <div className="text-[#b8c5d6]">{email.attachments.map((a: any) => a.filename || a.name || "").filter(Boolean).join(", ")}</div>
                    <div className="mt-1 text-[10px] text-[#b8c5d6]/80">{t("inbox.forwardReattachHint")}</div>
                  </div>
                )}
                <div className="flex items-center gap-2 justify-between">
                  <FileAttachInput files={forwardAttachments} onChange={setForwardAttachments} />
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setForwardOpen(false); setForwardText(""); setForwardTo(""); setForwardSubject(""); setForwardAttachments([]); }}
                      className="text-[#b8c5d6] hover:text-white h-7 text-[11px]"
                    >
                      {t("common.cancel")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 h-7 text-[11px] bg-transparent border-primary/30 text-primary hover:bg-primary/10 hover:text-primary"
                      disabled={isSending || !forwardTo.trim() || !forwardSubject.trim() || !forwardText.trim()}
                      onClick={() => setScheduleForwardDialogOpen(true)}
                      data-testid="button-schedule-send-forward"
                    >
                      <CalendarDays className="w-3 h-3" />
                      {t("wave1.scheduleButton")}
                    </Button>
                    <Button
                      size="sm"
                      className="gap-1.5 h-7 text-[11px]"
                      disabled={isSending || !forwardTo.trim() || !forwardSubject.trim() || !forwardText.trim()}
                      onClick={() => {
                        // Task #205 — un transfert n'est PAS une réponse : on
                        // ne renseigne pas replyToEmailId (sinon le message
                        // sortant serait classé "Reply" dans Envoyés et
                        // polluerait reply_to_email_id en aval). À la place,
                        // on passe markHandledOfEmailId : le serveur marque
                        // l'email d'origine comme "traité" UNIQUEMENT si le
                        // POST /emails/send réussit (pas de fire-and-forget).
                        onSendReply(forwardTo, forwardSubject, forwardText, undefined, forwardAttachments, forwardConnectionId || undefined, undefined, handledAt ? undefined : email.id);
                        setForwardText("");
                        setForwardTo("");
                        setForwardSubject("");
                        setForwardAttachments([]);
                        setForwardConnectionId("");
                        setForwardOpen(false);
                      }}
                    >
                      <Send className="w-3 h-3" />
                      {isSending ? t("inbox.sending") : t("inbox.send")}
                    </Button>
                  </div>
                </div>
                <ScheduleSendDialog
                  open={scheduleForwardDialogOpen}
                  onOpenChange={setScheduleForwardDialogOpen}
                  to={forwardTo}
                  subject={forwardSubject}
                  body={forwardText}
                  replyToEmailId={null}
                  markHandledOfEmailId={handledAt ? undefined : email.id}
                  connectionId={forwardConnectionId || undefined}
                  attachments={forwardAttachments}
                  onScheduled={() => {
                    setForwardText("");
                    setForwardTo("");
                    setForwardSubject("");
                    setForwardAttachments([]);
                    setForwardConnectionId("");
                    setForwardOpen(false);
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-start mt-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-md font-medium transition-colors text-[#b8c5d6] hover:text-white hover:bg-white/[0.04]"
          title={t("inbox.backHint", "Retour (Échap) — J/K pour naviguer, R répondre, E archiver") as string}
          aria-label={t("common.back", "Retour")}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
