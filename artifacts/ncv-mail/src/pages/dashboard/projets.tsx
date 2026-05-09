import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { TaskAssigneePicker } from "@/components/task-assignee-picker";
import { useEnableLightTheme } from "@/lib/inbox-theme";
import {
  useListProjects,
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
  useGetProject,
  getListProjectsQueryKey,
  getGetProjectQueryKey,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  getListTasksQueryKey,
  useListProjectNotes,
  useCreateProjectNote,
  useDeleteProjectNote,
  getListProjectNotesQueryKey,
  useGetMyOrganisation,
  useGetOrganisationMembers,
  useGetProfile,
  useUpdateEmail,
  useDeleteEmail,
  getListEmailsQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { BackToInboxButton } from "@/components/dashboard/back-to-inbox-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FolderKanban,
  Plus,
  MoreVertical,
  Edit2,
  Trash2,
  ArrowLeft,
  Mail,
  CheckSquare,
  Check,
  Clock,
  Hash,
  ListTodo,
  StickyNote,
  Send,
  Download,
  Sparkles,
  FolderMinus,
  Eye,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState, useRef, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { EmailDetailContainer } from "@/components/email-detail/EmailDetailContainer";
import { format } from "date-fns";
import { fr, enUS, nl, de, es, it, pt, pl, ro, sv, da, fi, hu, cs, tr, ja, ko, vi, th, id, ms, el } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useTranslation } from 'react-i18next';

const projectSchema = z.object({
  name: z.string().min(2, "Le nom doit contenir au moins 2 caracteres"),
  reference: z.string().optional(),
  description: z.string().optional(),
  status: z.string().optional(),
  color: z.string().optional(),
});

type ProjectFormValues = z.infer<typeof projectSchema>;

function getProjectColors(t: (key: string) => string) {
  return [
    { value: "blue", label: t("projects.colors.blue"), class: "bg-blue-500" },
    { value: "green", label: t("projects.colors.green"), class: "bg-emerald-500" },
    { value: "purple", label: t("projects.colors.purple"), class: "bg-purple-500" },
    { value: "amber", label: t("projects.colors.amber"), class: "bg-amber-500" },
    { value: "red", label: t("projects.colors.red"), class: "bg-red-500" },
    { value: "cyan", label: t("projects.colors.cyan"), class: "bg-cyan-500" },
    { value: "pink", label: t("projects.colors.pink"), class: "bg-pink-500" },
    { value: "indigo", label: t("projects.colors.indigo"), class: "bg-indigo-500" },
  ];
}

function getStatusLabels(t: (key: string) => string) {
  return {
    actif: { label: t("projects.statusActive"), class: "bg-white/[0.06] text-foreground" },
    termine: { label: t("projects.statusComplete"), class: "bg-[#b8c5d6]/10 text-[#b8c5d6]" },
    en_pause: { label: t("projects.statusPaused"), class: "bg-amber-500/10 text-amber-400" },
  };
}

function getColorClass(color: string, PROJECT_COLORS: { value: string; class: string }[]) {
  return PROJECT_COLORS.find((c) => c.value === color)?.class || "bg-blue-500";
}

function ProjectNotes({ projectId }: { projectId: string }) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [noteText, setNoteText] = useState("");
  const { data: notes, isLoading } = useListProjectNotes(projectId);
  const createNote = useCreateProjectNote();
  const deleteNote = useDeleteProjectNote();

  const handleAddNote = () => {
    if (!noteText.trim()) return;
    createNote.mutate(
      { id: projectId, data: { content: noteText.trim() } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListProjectNotesQueryKey(projectId) });
          setNoteText("");
        },
        onError: () => {
          toast({ variant: "destructive", title: t("common.error"), description: t("projects.noteError") });
        },
      }
    );
  };

  const handleDeleteNote = (noteId: string) => {
    deleteNote.mutate(
      { id: projectId, noteId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListProjectNotesQueryKey(projectId) });
        },
      }
    );
  };

  return (
    <div>
      <h2 className="text-[13px] font-semibold text-white mb-2 flex items-center gap-1.5">
        <StickyNote className="w-3.5 h-3.5 text-primary" /> {t("projects.notesLabel")}
      </h2>
      <div className="flex gap-2 mb-3">
        <Textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder={t("projects.addNote")}
          className="resize-none h-16 bg-background border-border text-white text-[12px] flex-1"
        />
        <Button
          size="sm"
          className="h-16 px-3 shrink-0"
          disabled={!noteText.trim() || createNote.isPending}
          onClick={handleAddNote}
        >
          <Send className="w-3.5 h-3.5" />
        </Button>
      </div>
      {isLoading ? (
        <Skeleton className="h-12 w-full bg-white/5" />
      ) : (notes || []).length === 0 ? (
        <p className="text-[11px] text-[#b8c5d6]/60 italic">{t("projects.noNotes")}</p>
      ) : (
        <div className="space-y-1.5">
          {(notes || []).map((note: any) => (
            <div key={note.id} className="bg-card border border-border rounded-lg px-3 py-2 flex items-start gap-2 group">
              <p className="text-[12px] text-[#b8c5d6] flex-1 whitespace-pre-wrap">{note.content}</p>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] text-[#b8c5d6]/50">
                  {new Date(note.createdAt).toLocaleDateString(i18n.language)}
                </span>
                <button
                  onClick={() => handleDeleteNote(note.id)}
                  className="p-1 rounded-md text-[#b8c5d6]/40 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                  title={t("common.delete")}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


function ProjectDetailView({
  projectId,
  onBack,
}: {
  projectId: string;
  onBack: () => void;
}) {
  const { t, i18n } = useTranslation();
  const PROJECT_COLORS = getProjectColors(t);
  const STATUS_LABELS: Record<string, { label: string; class: string }> = getStatusLabels(t);
  const { data: project, isLoading } = useGetProject(projectId);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedEmailId, setSelectedEmailId] = useState<number | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskAssignees, setNewTaskAssignees] = useState<string[]>([]);
  const createTaskMut = useCreateTask();
  const updateTaskMut = useUpdateTask();
  const deleteTaskMut = useDeleteTask();
  const updateEmailMut = useUpdateEmail();
  const deleteEmailMut = useDeleteEmail();
  const [selectedEmailIds, setSelectedEmailIds] = useState<Set<string>>(new Set());
  const selectionMode = selectedEmailIds.size > 0;
  const toggleEmailSelected = (rawId: any) => {
    const id = String(rawId);
    setSelectedEmailIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  // Drag-select rubber band (pattern Relances)
  const isDraggingRef = useRef(false);
  const didDragRef = useRef(false);
  const dragStartIdRef = useRef<string | null>(null);
  const preSelectRef = useRef<Set<string>>(new Set());
  const autoScrollRaf = useRef<number>(0);
  const lastMouseYRef = useRef(0);
  const getRowIdFromPoint = useCallback((y: number, x: number): string | null => {
    const el = document.elementFromPoint(x, y);
    if (!el) return null;
    const row = (el as HTMLElement).closest?.("[data-project-email-row]");
    if (!row) return null;
    return row.getAttribute("data-row-id");
  }, []);
  const selectRange = useCallback((currentId: string) => {
    const rows = Array.from(document.querySelectorAll("[data-project-email-row][data-row-id]"));
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
    setSelectedEmailIds(keep);
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
    setSelectedEmailIds((prev) => { preSelectRef.current = new Set(prev); return prev; });
    const handleMouseUp = () => {
      isDraggingRef.current = false;
      cancelAnimationFrame(autoScrollRaf.current);
      document.removeEventListener("mouseup", handleMouseUp);
    };
    document.addEventListener("mouseup", handleMouseUp);
  }, []);
  // Échap = vider sélection
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedEmailIds(new Set());
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  // Clic extérieur = vider sélection
  useEffect(() => {
    if (selectedEmailIds.size === 0) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-project-email-row]") || target.closest("[data-context-menu]")) return;
      setSelectedEmailIds(new Set());
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [selectedEmailIds.size]);
  const [emailContextMenu, setEmailContextMenu] = useState<{ x: number; y: number; emailId: number; subject: string } | null>(null);
  const emailCtxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!emailContextMenu) return;
    const onDown = (e: MouseEvent) => {
      if (emailCtxRef.current && !emailCtxRef.current.contains(e.target as Node)) setEmailContextMenu(null);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setEmailContextMenu(null); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [emailContextMenu]);
  const handleDetachEmail = (id: number) => {
    updateEmailMut.mutate(
      { id, data: { projectId: null } as any },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
          queryClient.invalidateQueries({ queryKey: getListEmailsQueryKey() });
          toast({ title: t("projects.emailDetached", "Email retiré du projet") });
        },
        onError: (e: any) => toast({ variant: "destructive", title: t("common.error"), description: e?.message }),
      }
    );
  };
  const handleDeleteEmail = (id: number) => {
    deleteEmailMut.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
          queryClient.invalidateQueries({ queryKey: getListEmailsQueryKey() });
          toast({ title: t("inbox.emailDeleted", "Email supprimé") });
        },
        onError: (e: any) => toast({ variant: "destructive", title: t("common.error"), description: e?.message }),
      }
    );
  };
  const { data: myOrg } = useGetMyOrganisation();
  const { data: orgMembers } = useGetOrganisationMembers({ query: { enabled: !!(myOrg as any)?.id } as any });
  const { data: profile } = useGetProfile();
  const currentUserId = (profile as any)?.id || (profile as any)?.userId || null;
  const members: any[] = Array.isArray(orgMembers) ? orgMembers : [];
  const memberLabel = (uid: string | null | undefined) => {
    if (!uid) return null;
    const m = members.find((mm: any) => mm.userId === uid);
    if (!m) return null;
    return m.fullName || m.email || uid.slice(0, 6);
  };
  const handleAssignTask = (taskId: string, assignedToUserId: string | null) => {
    updateTaskMut.mutate(
      { id: taskId as any, data: { assignedToUserId } as any },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
          queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
          toast({ title: assignedToUserId ? t("projects.taskAssigned", "Tâche assignée") : t("projects.taskUnassigned", "Tâche désassignée") });
        },
        onError: (e: any) => {
          toast({ variant: "destructive", title: t("common.error"), description: e?.message || "Assignation impossible" });
        },
      }
    );
  };

  const handleDeleteTask = (taskId: string) => {
    deleteTaskMut.mutate(
      { id: taskId as any },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
          queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
          toast({ title: t("projects.taskDeleted") });
        },
      }
    );
  };

  const handleToggleTask = (taskId: string, currentDone: boolean) => {
    updateTaskMut.mutate(
      { id: taskId as any, data: { done: !currentDone } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
          queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
        },
      }
    );
  };

  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) return;
    const title = newTaskTitle.trim();
    const assignees = newTaskAssignees.length > 0 ? newTaskAssignees : [null];
    try {
      for (const assignee of assignees) {
        await createTaskMut.mutateAsync({
          data: {
            title,
            projectId,
            ...(assignee ? { assignedToUserId: assignee } : {}),
          } as any,
        });
      }
      queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
      queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
      setNewTaskTitle("");
      setNewTaskAssignees([]);
      toast({
        title:
          assignees.length > 1
            ? t("tasks.tasksCreated", { count: assignees.length, defaultValue: `${assignees.length} tâches créées` })
            : t("projects.taskCreated"),
      });
    } catch {
      toast({ variant: "destructive", title: t("common.error"), description: t("projects.taskError") });
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-5">
          <Skeleton className="h-6 w-48 bg-white/5 mb-3" />
          <Skeleton className="h-48 w-full bg-white/5" />
        </div>
      </DashboardLayout>
    );
  }

  if (!project) {
    return (
      <DashboardLayout>
        <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-5">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="text-[#b8c5d6] hover:text-white mb-3 gap-1.5 h-7 text-[12px]"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> {t("common.back")}
          </Button>
          <p className="text-[12px] text-[#b8c5d6]">Projet introuvable.</p>
        </div>
      </DashboardLayout>
    );
  }

  const statusInfo = STATUS_LABELS[project.status] || STATUS_LABELS.actif;
  const pendingTasks = (project.tasks || []).filter(
    (t: any) => !t.done
  ).length;
  const doneTasks = (project.tasks || []).filter((t: any) => t.done).length;

  if (selectedEmailId) {
    return (
      <DashboardLayout>
        <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-5">
          <EmailDetailContainer
            emailId={selectedEmailId}
            onBack={() => setSelectedEmailId(null)}
            onAfterArchive={() => setSelectedEmailId(null)}
            onAfterDelete={() => setSelectedEmailId(null)}
            onAfterMutation={() => {
              queryClient.invalidateQueries({
                queryKey: getGetProjectQueryKey(projectId),
              });
            }}
          />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-5">
        <div className="flex items-center justify-between mb-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="text-[#b8c5d6] hover:text-white gap-1.5 h-7 text-[12px]"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> {t("common.back")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                const { downloadExport } = await import("@/lib/export-utils");
                await downloadExport(`export/projects?id=${projectId}`, `projet_${project.reference || projectId}.csv`);
                toast({ title: t("projects.exportDownloaded") });
              } catch {
                toast({ title: t("projects.exportError"), variant: "destructive" });
              }
            }}
            className="gap-1 text-[11px] h-7 bg-transparent border-border text-[#b8c5d6] hover:text-white"
          >
            <Download className="w-3 h-3" />
            {t("projects.export")}
          </Button>
        </div>

        <div className="flex items-start gap-3 mb-5">
          <div
            className="w-10 h-10 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center text-primary font-semibold text-[15px] shrink-0"
          >
            {project.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h1 className="text-[16px] font-semibold text-white truncate">
                {project.name}
              </h1>
              <span
                className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${statusInfo.class}`}
              >
                {statusInfo.label}
              </span>
            </div>
            <div className="flex items-center gap-2.5 text-[12px] text-[#b8c5d6]">
              <span className="flex items-center gap-1">
                <Hash className="w-3 h-3" /> {project.reference}
              </span>
              {project.description && (
                <span className="truncate">{project.description}</span>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-5">
          <div className="bg-card rounded-lg border border-border p-3">
            <div className="flex items-center gap-1.5 text-[#b8c5d6] mb-0.5">
              <Mail className="w-3.5 h-3.5" />
              <span className="text-[11px]">{t("projects.emails")}</span>
            </div>
            <p className="text-xl font-semibold text-white">
              {(project.emails || []).length}
            </p>
          </div>
          <div className="bg-card rounded-lg border border-border p-3">
            <div className="flex items-center gap-1.5 text-[#b8c5d6] mb-0.5">
              <CheckSquare className="w-3.5 h-3.5" />
              <span className="text-[11px]">{t("projects.tasks")}</span>
            </div>
            <p className="text-xl font-semibold text-white">
              {doneTasks}/{(project.tasks || []).length}
            </p>
          </div>
          <div className="bg-card rounded-lg border border-border p-3">
            <div className="flex items-center gap-1.5 text-foreground mb-0.5">
              <Clock className="w-3.5 h-3.5" />
              <span className="text-[11px]">{t("projects.statusPaused")}</span>
            </div>
            <p className="text-xl font-semibold text-white">{pendingTasks}</p>
          </div>
        </div>

        {(project.emails || []).length > 0 && (
          <div className="mb-4">
            <h2 className="text-[13px] font-semibold text-white mb-2 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-primary" /> {t("projects.emails")} ({project.emails.length})
            </h2>
            <div className="space-y-1">
              {project.emails.map((email: any) => {
                const emailIdNum = Number(email.id);
                const emailIdStr = String(email.id);
                const isSelected = selectedEmailIds.has(emailIdStr);
                return (
                  <div
                    key={email.id}
                    data-project-email-row
                    data-row-id={emailIdStr}
                    onClick={() => {
                      if (didDragRef.current) return;
                      if (selectionMode) toggleEmailSelected(email.id);
                      else setSelectedEmailId(emailIdNum);
                    }}
                    onMouseDown={(e) => { if (e.button === 0) { e.preventDefault(); handleDragSelectStart(emailIdStr); } }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      if (selectedEmailIds.size === 0) {
                        setSelectedEmailIds(new Set([emailIdStr]));
                      } else if (!selectedEmailIds.has(emailIdStr)) {
                        setSelectedEmailIds((prev) => new Set(prev).add(emailIdStr));
                      }
                      setEmailContextMenu({ x: e.clientX, y: e.clientY, emailId: emailIdNum, subject: email.subject || "" });
                    }}
                    className={`group flex items-center gap-2.5 px-3 py-2 bg-card border rounded-lg w-full text-left transition-colors cursor-pointer select-none ${isSelected ? "border-primary/60 bg-primary/5" : "border-border hover:bg-card/80 hover:border-primary/40"}`}
                  >
                    <div className="w-4 flex items-center justify-center shrink-0">
                      {(selectionMode || isSelected) ? (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); toggleEmailSelected(email.id); }}
                          onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); handleDragSelectStart(emailIdStr); }}
                          className={`w-4 h-4 rounded border flex items-center justify-center cursor-pointer transition-colors ${isSelected ? "border-primary" : "border-[#2a3441] hover:border-primary"}`}
                          aria-label={t("common.select", "Sélectionner")}
                        >
                          {isSelected && <Check className="w-3 h-3 text-primary" />}
                        </button>
                      ) : (
                        <span className="w-3 h-3" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] text-white truncate">{email.subject}</p>
                      <p className="text-[10px] text-[#b8c5d6]">{email.sender}</p>
                    </div>
                    <span className="text-[10px] text-[#b8c5d6] shrink-0">
                      {new Date(email.createdAt).toLocaleDateString(i18n.language)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="mb-4">
          <h2 className="text-[13px] font-semibold text-white mb-2 flex items-center gap-1.5">
            <CheckSquare className="w-3.5 h-3.5 text-primary" /> {t("projects.tasks")} ({(project.tasks || []).length})
          </h2>
          <div className="flex gap-2 mb-2 flex-wrap">
            <Input
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder={t("projects.addTaskPlaceholder")}
              className="bg-background border-border text-white text-[12px] h-8 flex-1 min-w-[180px]"
              onKeyDown={(e) => {
                if (e.key === "Enter" && newTaskTitle.trim()) {
                  handleAddTask();
                }
              }}
            />
            <div className="w-[180px] shrink-0">
              <TaskAssigneePicker
                members={members}
                currentUserId={currentUserId}
                value={newTaskAssignees}
                onChange={setNewTaskAssignees}
              />
            </div>
            <Button
              size="sm"
              className="h-8 px-3 gap-1.5 shrink-0"
              disabled={!newTaskTitle.trim() || createTaskMut.isPending}
              onClick={handleAddTask}
            >
              <Plus className="w-3 h-3" />
              {t("projects.addProject").split(" ")[0]}
            </Button>
          </div>
          {(project.tasks || []).length > 0 ? (
            <div className="space-y-1">
              {project.tasks.map((task: any) => {
                const isCreator = !currentUserId || task.userId === currentUserId || !task.userId;
                const assigneeLabel = memberLabel(task.assignedToUserId);
                return (
                <div
                  key={task.id}
                  className="bg-card border border-border rounded-lg px-3 py-2 flex items-center gap-2.5 group"
                >
                  <button
                    onClick={() => handleToggleTask(String(task.id), task.done)}
                    className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 cursor-pointer transition-colors ${task.done ? "border-primary" : "border-[#2a3441] hover:border-primary"}`}
                  >
                    {task.done && (
                      <Check className="w-3 h-3 text-primary" />
                    )}
                  </button>
                  <p
                    className={`text-[12px] flex-1 ${task.done ? "line-through text-[#b8c5d6]" : "text-white"}`}
                  >
                    {task.title}
                  </p>
                  {task.emailSubject && (
                    <span className="text-[10px] text-[#b8c5d6] truncate max-w-[140px]">
                      {task.emailSubject}
                    </span>
                  )}
                  {members.length > 0 && (
                    isCreator ? (
                      <Select
                        value={task.assignedToUserId || "none"}
                        onValueChange={(val) => handleAssignTask(String(task.id), val === "none" ? null : val)}
                      >
                        <SelectTrigger className="w-[140px] h-7 bg-background border-border text-[11px] text-white">
                          <SelectValue placeholder={t("projects.assignTo", "Assigner à…")} />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border">
                          <SelectItem value="none">{t("projects.unassigned", "Non assignée")}</SelectItem>
                          {members.map((m: any) => (
                            <SelectItem key={m.userId} value={m.userId}>
                              {m.fullName || m.email}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : assigneeLabel ? (
                      <span className="text-[10px] text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded">
                        {assigneeLabel}
                      </span>
                    ) : null
                  )}
                  <button
                    onClick={() => handleDeleteTask(String(task.id))}
                    className="p-1.5 rounded-md text-[#b8c5d6]/40 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                    title={t("common.delete")}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                );
              })}
            </div>
          ) : (
            <p className="text-[11px] text-[#b8c5d6]/60 italic">{t("projects.noTasksInProject")}</p>
          )}
        </div>

        <div className="mb-4">
          <ProjectNotes projectId={projectId} />
        </div>

        {(project.emails || []).length === 0 &&
          (project.tasks || []).length === 0 && (
            <div className="text-center py-12 rounded-lg border border-border border-dashed bg-card/50">
              <FolderKanban className="mx-auto h-8 w-8 text-[#b8c5d6]/20 mb-2" />
              <p className="text-[12px] text-[#b8c5d6]">
                {t("projects.noEmailsInProject")}
              </p>
              <p className="text-[11px] text-[#b8c5d6]/60 mt-0.5">
                {t("projects.noProjectsDesc")}
              </p>
            </div>
          )}
      </div>
      {emailContextMenu && (
        <div
          ref={emailCtxRef}
          className="fixed z-[9999] min-w-[220px] rounded-lg border border-[#2a3441] bg-[#0f141b] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100"
          style={{
            top: Math.min(emailContextMenu.y, window.innerHeight - 200),
            left: Math.min(emailContextMenu.x, window.innerWidth - 240),
          }}
        >
          <div className="px-3 py-2 border-b border-[#1f2937]">
            <span className="text-[10px] text-[#6b7280] uppercase tracking-wider font-medium">
              {emailContextMenu.subject.substring(0, 30)}{emailContextMenu.subject.length > 30 ? "…" : ""}
            </span>
          </div>
          <div className="py-1">
            <button
              onClick={() => {
                setSelectedEmailId(emailContextMenu.emailId);
                setEmailContextMenu(null);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#b8c5d6] hover:bg-white/[0.06] hover:text-white transition-colors"
            >
              <Eye className="w-3.5 h-3.5 text-primary" />
              {t("projects.openEmail", "Ouvrir l'email")}
            </button>
            <button
              onClick={() => {
                handleDetachEmail(emailContextMenu.emailId);
                setEmailContextMenu(null);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#b8c5d6] hover:bg-white/[0.06] hover:text-white transition-colors"
            >
              <FolderMinus className="w-3.5 h-3.5" />
              {t("projects.detachEmail", "Retirer du projet")}
            </button>
            <div className="border-t border-[#1f2937] my-1" />
            <button
              onClick={() => {
                handleDeleteEmail(emailContextMenu.emailId);
                setEmailContextMenu(null);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {t("common.delete", "Supprimer")}
            </button>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

export default function Projets() {
  useEnableLightTheme();
  const { t, i18n } = useTranslation();
  const PROJECT_COLORS = getProjectColors(t);
  const STATUS_LABELS: Record<string, { label: string; class: string }> = getStatusLabels(t);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: projects, isLoading } = useListProjects();
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editProject, setEditProject] = useState<any>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null
  );

  const createForm = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema as any),
    defaultValues: {
      name: "",
      reference: "",
      description: "",
      status: "actif",
      color: "blue",
    },
  });

  const editForm = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema as any),
  });

  const handleOpenEdit = (project: any) => {
    setEditProject(project);
    editForm.reset({
      name: project.name,
      reference: project.reference,
      description: project.description || "",
      status: project.status,
      color: project.color,
    });
  };

  const onSubmitCreate = (data: ProjectFormValues) => {
    createProject.mutate(
      {
        data: {
          name: data.name,
          reference: data.reference || undefined,
          description: data.description || undefined,
          status: (data.status || "actif") as any,
          color: (data.color || "blue") as any,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getListProjectsQueryKey(),
          });
          setIsCreateOpen(false);
          createForm.reset();
          toast({ title: t("projects.created") });
        },
      }
    );
  };

  const onSubmitEdit = (data: ProjectFormValues) => {
    if (!editProject) return;
    updateProject.mutate(
      {
        id: editProject.id,
        data: {
          name: data.name,
          reference: data.reference || undefined,
          description: data.description || undefined,
          status: data.status as any,
          color: data.color as any,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getListProjectsQueryKey(),
          });
          queryClient.invalidateQueries({
            queryKey: getGetProjectQueryKey(editProject.id),
          });
          setEditProject(null);
          toast({ title: t("projects.updated") });
        },
      }
    );
  };

  const handleDelete = (id: string) => {
    deleteProject.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getListProjectsQueryKey(),
          });
          toast({ title: t("projects.deleted") });
        },
      }
    );
  };

  if (selectedProjectId) {
    return (
      <ProjectDetailView
        projectId={selectedProjectId}
        onBack={() => setSelectedProjectId(null)}
      />
    );
  }

  const activeProjects = (projects || []).filter(
    (p: any) => p.status === "actif"
  );
  const otherProjects = (projects || []).filter(
    (p: any) => p.status !== "actif"
  );

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-5">
        <BackToInboxButton />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div>
            <h1 className="text-[16px] font-semibold text-white tracking-tight">
              {t("projects.title")}
            </h1>
            <p className="text-[12px] text-[#b8c5d6] mt-0.5">
              {t("projects.noProjectsDesc")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  const { downloadExport } = await import("@/lib/export-utils");
                  await downloadExport("export/projects", `projets_${new Date().toISOString().split("T")[0]}.csv`);
                  toast({ title: t("projects.exportDownloaded") });
                } catch {
                  toast({ title: t("projects.exportError"), variant: "destructive" });
                }
              }}
              className="gap-1 text-[11px] h-8 bg-transparent border-border text-[#b8c5d6] hover:text-white"
            >
              <Download className="w-3 h-3" />
              {t("projects.export")}
            </Button>
            <Button
              size="sm"
              className="shrink-0 gap-2"
              onClick={() => {
                createForm.reset({
                  name: "",
                  reference: "",
                  description: "",
                  status: "actif",
                  color: "blue",
                });
                setIsCreateOpen(true);
              }}
            >
              <Plus className="w-3.5 h-3.5" />
              {t("projects.addProject")}
            </Button>
          </div>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-white">
                {t("projects.createProject")}
              </DialogTitle>
            </DialogHeader>
            <Form {...createForm}>
              <form
                onSubmit={createForm.handleSubmit(onSubmitCreate)}
                className="space-y-4"
              >
                <FormField
                  control={createForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[#b8c5d6]">
                        {t("projects.name")}
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ex: Renovation Dupont, Site web client..."
                          className="bg-background border-border text-white"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="reference"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[#b8c5d6]">
                        {t("projects.reference")}
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Auto: PROJ-001, ou personnalise: REF-2026-DUPONT"
                          className="bg-background border-border text-white"
                          {...field}
                        />
                      </FormControl>
                      <p className="text-[11px] text-[#b8c5d6]/60">
                        Laissez vide pour une reference automatique
                      </p>
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[#b8c5d6]">
                        {t("projects.description")}
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Description du projet..."
                          className="resize-none h-20 bg-background border-border text-white"
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={createForm.control}
                    name="color"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[#b8c5d6]">
                          {t("projects.color")}
                        </FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="bg-background border-border text-white">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-card border-border">
                            {PROJECT_COLORS.map((c) => (
                              <SelectItem key={c.value} value={c.value}>
                                <div className="flex items-center gap-2">
                                  <div
                                    className={`w-3 h-3 rounded-full ${c.class}`}
                                  />
                                  {c.label}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[#b8c5d6]">{t("projects.status")}</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="bg-background border-border text-white">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-card border-border">
                            <SelectItem value="actif">{t("projects.statusActive")}</SelectItem>
                            <SelectItem value="en_pause">{t("projects.statusPaused")}</SelectItem>
                            <SelectItem value="termine">{t("projects.statusComplete")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={createProject.isPending}>
                    {createProject.isPending ? "..." : t("projects.createProject")}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <Dialog
          open={!!editProject}
          onOpenChange={(open) => !open && setEditProject(null)}
        >
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-white">
                {t("projects.editProject")}
              </DialogTitle>
            </DialogHeader>
            <Form {...editForm}>
              <form
                onSubmit={editForm.handleSubmit(onSubmitEdit)}
                className="space-y-4"
              >
                <FormField
                  control={editForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[#b8c5d6]">{t("projects.name")}</FormLabel>
                      <FormControl>
                        <Input
                          className="bg-background border-border text-white"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="reference"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[#b8c5d6]">
                        {t("projects.reference")}
                      </FormLabel>
                      <FormControl>
                        <Input
                          className="bg-background border-border text-white"
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[#b8c5d6]">
                        {t("projects.description")}
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          className="resize-none h-20 bg-background border-border text-white"
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={editForm.control}
                    name="color"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[#b8c5d6]">
                          {t("projects.color")}
                        </FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="bg-background border-border text-white">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-card border-border">
                            {PROJECT_COLORS.map((c) => (
                              <SelectItem key={c.value} value={c.value}>
                                <div className="flex items-center gap-2">
                                  <div
                                    className={`w-3 h-3 rounded-full ${c.class}`}
                                  />
                                  {c.label}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[#b8c5d6]">{t("projects.status")}</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="bg-background border-border text-white">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-card border-border">
                            <SelectItem value="actif">{t("projects.statusActive")}</SelectItem>
                            <SelectItem value="en_pause">{t("projects.statusPaused")}</SelectItem>
                            <SelectItem value="termine">{t("projects.statusComplete")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={updateProject.isPending}>
                    {updateProject.isPending
                      ? "..."
                      : t("common.save")}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array(3)
              .fill(0)
              .map((_, i) => (
                <div
                  key={i}
                  className="bg-card rounded-lg border border-border p-5"
                >
                  <Skeleton className="w-10 h-10 rounded-xl bg-white/5 mb-3" />
                  <Skeleton className="h-5 w-3/4 mb-2 bg-white/5" />
                  <Skeleton className="h-4 w-full bg-white/5" />
                </div>
              ))}
          </div>
        ) : (projects || []).length === 0 ? (
          <div className="text-center py-20 rounded-lg border border-border border-dashed bg-card/50">
            <FolderKanban className="mx-auto h-12 w-12 text-[#b8c5d6]/20 mb-3" />
            <h3 className="text-sm font-medium text-white mb-1">
              {t("projects.noProjects")}
            </h3>
            <p className="text-[13px] text-[#b8c5d6] mb-4">
              {t("projects.noProjectsDesc")}
            </p>
            <Button
              onClick={() => setIsCreateOpen(true)}
              size="sm"
              className="gap-2"
            >
              <Plus className="w-3.5 h-3.5" />
              {t("projects.createProject")}
            </Button>
          </div>
        ) : (
          <>
            {activeProjects.length > 0 && (
              <div className="mb-6">
                <h2 className="text-[13px] font-medium text-[#b8c5d6] uppercase tracking-wider mb-3">
                  {t("projects.statusActive")} ({activeProjects.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {activeProjects.map((project: any) =>
                    renderProjectCard(project)
                  )}
                </div>
              </div>
            )}
            {otherProjects.length > 0 && (
              <div>
                <h2 className="text-[13px] font-medium text-[#b8c5d6] uppercase tracking-wider mb-3">
                  {t("projects.statusComplete")} ({otherProjects.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {otherProjects.map((project: any) =>
                    renderProjectCard(project)
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );

  function renderProjectCard(project: any) {
    const statusInfo =
      STATUS_LABELS[project.status] || STATUS_LABELS.actif;
    return (
      <div
        key={project.id}
        className="bg-card rounded-lg border border-border p-5 hover:border-primary/30 transition-colors group cursor-pointer"
        onClick={() => setSelectedProjectId(project.id)}
      >
        <div className="flex justify-between items-start mb-3">
          <div
            className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary font-semibold text-sm"
          >
            {project.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${statusInfo.class}`}
            >
              {statusInfo.label}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-[#b8c5d6] opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/[0.06]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-card border-border">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenEdit(project);
                  }}
                  className="gap-2 cursor-pointer text-[#b8c5d6] hover:text-white"
                >
                  <Edit2 className="h-3.5 w-3.5" /> {t("classification.edit")}
                </DropdownMenuItem>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem
                      onSelect={(e) => e.preventDefault()}
                      onClick={(e) => e.stopPropagation()}
                      className="gap-2 text-red-400 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> {t("common.delete")}
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                  <AlertDialogContent
                    className="bg-card border-border"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-white">
                        {t("projects.deleteConfirmTitle")}
                      </AlertDialogTitle>
                      <AlertDialogDescription className="text-[#b8c5d6]">
                        {t("projects.deleteConfirmDesc")}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="bg-background border-border text-[#b8c5d6] hover:bg-white/[0.04]">
                        {t("common.cancel")}
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDelete(project.id)}
                        className="bg-red-500 text-white hover:bg-red-600"
                      >
                        {t("common.delete")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <h3 className="text-[14px] font-semibold text-white mb-0.5 truncate">
          {project.name}
        </h3>
        <p className="text-[11px] text-primary/80 font-mono mb-2">
          {project.reference}
        </p>
        {project.description && (
          <p className="text-[12px] text-[#b8c5d6] line-clamp-2 mb-3">
            {project.description}
          </p>
        )}

        <div className="flex items-center gap-3 text-[12px]">
          <span className="flex items-center gap-1 text-[#b8c5d6] bg-white/[0.04] px-2 py-1 rounded-md">
            <Mail className="w-3 h-3" />
            <span className="text-primary font-medium">
              {project.emailCount}
            </span>{" "}
            {t("projects.emails").toLowerCase()}
          </span>
          <span className="flex items-center gap-1 text-[#b8c5d6] bg-white/[0.04] px-2 py-1 rounded-md">
            <CheckSquare className="w-3 h-3" />
            <span className="text-primary font-medium">
              {project.pendingTaskCount}
            </span>{" "}
            {t("projects.tasks").toLowerCase()}
          </span>
        </div>
      </div>
    );
  }
}
