import { DashboardLayout } from "@/components/layout/dashboard-layout";
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
  useSendEmail,
  useGenerateDraft,
  useGetProfile,
  useGetMyOrganisation,
  useGetOrganisationMembers,
} from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { fr, enUS, nl } from "date-fns/locale";
import {
  Calendar, Mail, Clock, Trash2, User, Sparkles, Tag, Download,
  Reply, Send, Wand2, Loader2, Plus, ArrowRight, RotateCcw, CheckCircle2,
  CheckSquare, Square, ChevronRight, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BackToInboxButton } from "@/components/dashboard/back-to-inbox-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useState, useRef, useEffect, useCallback } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTranslation } from "react-i18next";
import { downloadExport } from "@/lib/export-utils";

const PRIORITY_BADGE_STYLES: Record<string, { bg: string; text: string; border: string; labelKey: string }> = {
  urgent: { bg: "bg-red-500/15", text: "text-red-400", border: "border-red-500/20", labelKey: "inbox.priorities.urgent" },
  moyen: { bg: "bg-amber-500/15", text: "text-amber-400", border: "border-amber-500/20", labelKey: "inbox.priorities.medium" },
  faible: { bg: "bg-emerald-500/15", text: "text-emerald-400", border: "border-emerald-500/20", labelKey: "inbox.priorities.low" },
};

const STATUS_STYLES = {
  todo: { color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
  done: { color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
};

export default function Taches() {
  const { t, i18n } = useTranslation();
  const dateFnsLocale = i18n.language === "nl" ? nl : i18n.language === "en" ? enUS : fr;
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
  const [emailDetailTask, setEmailDetailTask] = useState<any>(null);
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskAssignees, setNewTaskAssignees] = useState<string[]>([]);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; taskId: string } | null>(null);
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
      if (e.key === "Escape") setSelectedTaskIds(new Set());
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (selectedTaskIds.size === 0) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-email-row]") || target.closest("[data-selection-bar]") || target.closest("[data-context-menu]")) return;
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
    const lo = Math.min(startIdx, endIdx);
    const hi = Math.max(startIdx, endIdx);
    const keep = new Set(preSelectRef.current);
    for (let i = lo; i <= hi; i++) keep.add(ids[i]);
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

  const sendEmailMut = useSendEmail();
  const generateDraftMut = useGenerateDraft();
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyTo, setReplyTo] = useState("");
  const [replySubject, setReplySubject] = useState("");
  const [replyText, setReplyText] = useState("");
  const [replyAttachments, setReplyAttachments] = useState<UploadedFile[]>([]);

  const { data: tasks, isLoading } = useListTasks({ scope: "mine" } as any);
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
      {
        onSuccess: () => {
          invalidate();
          
        },
      }
    );
  };

  const handleDeleteTask = (id: string) => {
    deleteTask.mutate(
      { id: id as any },
      {
        onSuccess: () => { invalidate(); toast({ title: t("tasks.deleted") }); },
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

  const taskList = (tasks as any[]) || [];

  const aiCount = taskList.filter((t: any) => t.source === "ai").length;
  const todoCount = taskList.filter((t: any) => t.status !== "done").length;
  const doneCount = taskList.filter((t: any) => t.status === "done").length;

  const filteredTasks = filter === "ai"
    ? taskList.filter((t: any) => t.source === "ai")
    : filter === "todo"
    ? taskList.filter((t: any) => t.status !== "done")
    : filter === "done"
    ? taskList.filter((t: any) => t.status === "done")
    : taskList;

  const filters = [
    { key: "all", label: t("tasks.all"), count: taskList.length },
    { key: "todo", label: t("tasks.todo"), count: todoCount },
    { key: "done", label: t("tasks.done"), count: doneCount },
    { key: "ai", label: t("tasks.sourceAi"), count: aiCount },
  ];

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-5">
        <BackToInboxButton />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div>
            <h1 className="text-[16px] font-semibold text-white tracking-tight">
              {t("tasks.title")}
            </h1>
            
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => setShowAddTask(true)}
              className="gap-1 text-[11px] h-7"
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
              className="gap-1 text-[11px] h-7 bg-transparent border-border text-[#8b9cb3] hover:text-white"
            >
              <Download className="w-3 h-3" />
              {t("tasks.export")}
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-1.5 mb-4">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`text-[12px] px-3 py-1.5 rounded-md transition-all inline-flex items-center gap-1.5 ${
                filter === f.key
                  ? f.key === "ai" ? "bg-violet-600 text-white font-medium" : "bg-primary text-white font-medium"
                  : "bg-card text-[#8b9cb3] hover:bg-[#1a2235] hover:text-white border border-border"
              }`}
            >
              {f.key === "ai" && <Sparkles className="w-3 h-3" />}
              {f.label}
              {!isLoading && <span className="text-[10px] opacity-70">({f.count})</span>}
            </button>
          ))}
        </div>

        <div data-selection-bar className={`flex items-center gap-2 mb-3 p-2.5 rounded-lg border h-[40px] ${taskSelectionMode ? "bg-primary/[0.08] border-primary/20" : "bg-card/50 border-border"}`}>
          <button
            onClick={() => {
              if (selectedTaskIds.size === filteredTasks.length && selectedTaskIds.size > 0) {
                setSelectedTaskIds(new Set());
              } else {
                setSelectedTaskIds(new Set(filteredTasks.map((t: any) => t.id)));
              }
            }}
            className="flex items-center gap-1.5 text-[11px] text-primary hover:text-white transition-colors"
          >
            {selectedTaskIds.size === filteredTasks.length && selectedTaskIds.size > 0 ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
            {selectedTaskIds.size === filteredTasks.length && selectedTaskIds.size > 0 ? t("inbox.deselectAll") : t("inbox.selectAll")}
          </button>
          {taskSelectionMode && (
            <>
              <span className="text-[11px] text-[#8b9cb3]">
                {t("inbox.selectedCount", { count: selectedTaskIds.size })}
              </span>
              <div className="flex-1" />
              <button onClick={handleBulkMarkDone} className="flex items-center gap-1.5 text-[11px] text-emerald-400 hover:text-emerald-300 transition-colors px-2 py-1 rounded-md hover:bg-emerald-500/10">
                <CheckCircle2 className="w-3.5 h-3.5" />{t("tasks.markDone")}
              </button>
              <button onClick={handleBulkDeleteTasks} className="flex items-center gap-1.5 text-[11px] text-red-400 hover:text-red-300 transition-colors px-2 py-1 rounded-md hover:bg-red-500/10">
                <Trash2 className="w-3.5 h-3.5" />{t("common.delete")}
              </button>
            </>
          )}
        </div>

        <div className="space-y-1.5">
          {isLoading ? (
            Array(4).fill(0).map((_, i) => (
              <div key={i} className="bg-card rounded-lg border border-border p-4 flex items-center gap-4">
                <Skeleton className="w-5 h-5 rounded bg-white/5" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-3/4 mb-2 bg-white/5" />
                  <Skeleton className="h-3 w-1/4 bg-white/5" />
                </div>
              </div>
            ))
          ) : filteredTasks.length === 0 ? (
            <div className="text-center py-20 rounded-lg border border-border border-dashed bg-card/50">
              <Plus className="mx-auto h-12 w-12 text-[#8b9cb3]/20 mb-3" />
              <h3 className="text-sm font-medium text-white mb-1">{t("tasks.noTasks")}</h3>
              <p className="text-[13px] text-[#8b9cb3]">{t("tasks.noTasksDesc")}</p>
            </div>
          ) : (
            filteredTasks.map((task: any) => {
              const taskStatus = task.status || "todo";
              const statusStyle = STATUS_STYLES[taskStatus as keyof typeof STATUS_STYLES] || STATUS_STYLES.todo;

              const isTaskSelected = selectedTaskIds.has(task.id);
              return (
                <div
                  key={task.id}
                  data-email-row
                  data-row-id={task.id}
                  className={`group rounded-lg border p-4 flex items-start gap-3 transition-all cursor-pointer select-none ${isTaskSelected ? "border-primary/50 bg-primary/[0.08]" : `bg-card border-border hover:bg-[#1a2235]`} ${taskStatus === "done" ? "opacity-60" : ""}`}
                  onClick={() => {
                    if (didDragRef.current) return;
                    setSelectedTaskIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(task.id)) next.delete(task.id); else next.add(task.id);
                      return next;
                    });
                  }}
                  onMouseDown={(e) => { if (e.button === 0) { e.preventDefault(); handleDragSelectStart(task.id); } }}
                  onContextMenu={(e) => handleTaskContextMenu(e, task.id)}
                >
                  <button
                    onClick={(e) => { e.stopPropagation(); setSelectedTaskIds((prev) => { const next = new Set(prev); if (next.has(task.id)) next.delete(task.id); else next.add(task.id); return next; }); }}
                    onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); handleDragSelectStart(task.id); }}
                    className="w-5 h-5 rounded flex items-center justify-center shrink-0 mt-0.5 transition-all cursor-pointer border border-[#2a3441] hover:border-primary select-none"
                  >
                    {isTaskSelected && <Check className="w-3.5 h-3.5 text-primary" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[13px] font-medium text-white mb-1.5 ${taskStatus === "done" ? "line-through text-[#8b9cb3]" : ""}`}>
                      {task.title}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#8b9cb3]">
                      <Badge className={`text-[10px] px-1.5 py-0 h-[18px] font-medium border ${statusStyle.bg} ${statusStyle.color} ${statusStyle.border}`}>
                        {taskStatus === "done" ? t("tasks.done") : t("tasks.todo")}
                      </Badge>
                      {task.source === "ai" && (
                        <Badge className="text-[10px] px-1.5 py-0 h-[18px] font-medium border bg-violet-500/15 text-violet-400 border-violet-500/25">
                          <Sparkles className="w-2.5 h-2.5 mr-0.5" />{t("tasks.sourceAi")}
                        </Badge>
                      )}
                      {task.emailPriority && PRIORITY_BADGE_STYLES[task.emailPriority] && (
                        <Badge className={`text-[10px] px-1.5 py-0 h-[18px] font-medium border ${PRIORITY_BADGE_STYLES[task.emailPriority].bg} ${PRIORITY_BADGE_STYLES[task.emailPriority].text} ${PRIORITY_BADGE_STYLES[task.emailPriority].border}`}>
                          {t(PRIORITY_BADGE_STYLES[task.emailPriority].labelKey)}
                        </Badge>
                      )}
                      {task.dueDate && (
                        <div className={`flex items-center gap-1 ${new Date(task.dueDate) < new Date() && taskStatus !== "done" ? "text-red-400" : ""}`}>
                          <Calendar className="w-3 h-3" />
                          <span>{format(new Date(task.dueDate), "dd MMM yyyy", { locale: dateFnsLocale })}</span>
                        </div>
                      )}
                      {task.emailSubject && (
                        <button
                          onClick={() => setEmailDetailTask(task)}
                          className="flex items-center gap-1 max-w-full hover:text-primary transition-colors group/email"
                        >
                          <Mail className="w-3 h-3 shrink-0 group-hover/email:text-primary" />
                          <span className="truncate max-w-[200px] sm:max-w-[300px] underline decoration-dotted underline-offset-2">{task.emailSubject}</span>
                        </button>
                      )}
                      {task.emailSender && (
                        <div className="flex items-center gap-1">
                          <User className="w-3 h-3 shrink-0" />
                          <span className="truncate max-w-[150px]">{task.emailSender}</span>
                        </div>
                      )}
                      {task.projectName && (
                        <div className="flex items-center gap-1">
                          <Tag className="w-3 h-3 shrink-0" />
                          <span>{task.projectReference ? `${task.projectReference} — ` : ""}{task.projectName}</span>
                        </div>
                      )}
                      {task.assignedToUserId && (() => {
                        const m = orgMembersList.find((mm: any) => mm.userId === task.assignedToUserId);
                        const label = m ? (m.fullName || m.email) : task.assignedToUserId.slice(0, 6);
                        const isMine = task.assignedToUserId === currentUserId;
                        return (
                          <Badge className={`text-[10px] px-1.5 py-0 h-[18px] font-medium border gap-1 ${isMine ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/25" : "bg-violet-500/15 text-violet-300 border-violet-500/25"}`}>
                            <User className="w-2.5 h-2.5" />
                            {isMine ? t("tasks.assignedToMe", "Moi") : label}
                          </Badge>
                        );
                      })()}
                      {!task.dueDate && !task.emailSubject && (
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{t("tasks.createdOn")} {format(new Date(task.createdAt), "dd/MM/yyyy")}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {taskStatus !== "done" ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleToggleDone(task.id, false); }}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 hover:text-emerald-300 transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {t("tasks.markDone")}
                      </button>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleToggleDone(task.id, true); }}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium text-blue-400 bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 hover:text-blue-300 transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        {t("tasks.markTodo")}
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteTask(task.id); }}
                      className="p-1.5 rounded-md text-[#8b9cb3] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title={t("common.delete")}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
        {taskSelectionMode && (
          <div data-selection-bar className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-[#141c2b] border border-[#1f2937] rounded-lg shadow-2xl px-4 py-2 flex items-center gap-3">
            <span className="text-[11px] text-[#8b9cb3]">{t("inbox.selectedCount", { count: selectedTaskIds.size })}</span>
            <button onClick={handleBulkMarkDone} className="flex items-center gap-1.5 text-[11px] text-emerald-400 hover:text-emerald-300 transition-colors">
              <CheckCircle2 className="w-3 h-3" />{t("tasks.markDone")}
            </button>
            <button onClick={handleBulkDeleteTasks} className="flex items-center gap-1.5 text-[11px] text-red-400 hover:text-red-300 transition-colors">
              <Trash2 className="w-3 h-3" />{t("common.delete")}
            </button>
            <button onClick={() => setSelectedTaskIds(new Set())} className="text-[11px] text-[#8b9cb3] hover:text-white transition-colors ml-2">{t("common.cancel")}</button>
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
            <span className="text-[10px] text-[#8b9cb3] uppercase tracking-wider font-medium">
              {selectedTaskIds.size > 1
                ? t("inbox.selectedCount", { count: selectedTaskIds.size })
                : filteredTasks.find((t: any) => t.id === contextMenu.taskId)?.title?.substring(0, 30) + "..."
              }
            </span>
          </div>
          <div className="py-1">
            <button
              onClick={() => { handleBulkMarkDone(); setContextMenu(null); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#8b9cb3] hover:bg-white/[0.06] hover:text-white transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {t("tasks.markDone")}
              {selectedTaskIds.size > 1 && ` (${selectedTaskIds.size})`}
            </button>
            <div className="border-t border-[#1f2937] my-1" />
            <button
              onClick={() => { handleBulkDeleteTasks(); setContextMenu(null); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-red-400/80 hover:bg-red-500/[0.08] hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {t("common.delete")}
              {selectedTaskIds.size > 1 && ` (${selectedTaskIds.size})`}
            </button>
          </div>
        </div>
      )}

      <Dialog open={showAddTask} onOpenChange={setShowAddTask}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white text-[14px]">{t("tasks.addTask")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder={t("tasks.addTask")}
              className="bg-background border-border text-white text-[13px]"
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
              <Button variant="ghost" size="sm" onClick={() => { setShowAddTask(false); setNewTaskTitle(""); setNewTaskAssignees([]); }} className="text-[#8b9cb3] hover:text-white h-8 text-[12px]">
                {t("common.cancel")}
              </Button>
              <Button size="sm" onClick={handleAddTask} disabled={createTask.isPending || newTaskTitle.trim().length < 2} className="h-8 text-[12px] gap-1.5">
                {createTask.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                {t("common.add")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!emailDetailTask} onOpenChange={(open) => { if (!open) { setEmailDetailTask(null); setReplyOpen(false); setReplyTo(""); setReplySubject(""); setReplyText(""); setReplyAttachments([]); } }}>
        <DialogContent className="bg-card border-border max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white text-[14px] pr-6">
              {emailDetailTask?.emailSubject}
            </DialogTitle>
          </DialogHeader>
          {emailDetailTask && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-[12px] shrink-0">
                  {(emailDetailTask.emailSender || "?")[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-medium text-white">{emailDetailTask.emailSender}</div>
                  {emailDetailTask.emailSenderEmail && (
                    <div className="text-[10px] text-[#8b9cb3]">{emailDetailTask.emailSenderEmail}</div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {emailDetailTask.emailPriority && (() => {
                    const ps = PRIORITY_BADGE_STYLES[emailDetailTask.emailPriority] || PRIORITY_BADGE_STYLES.faible;
                    return (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium border ${ps.bg} ${ps.text} ${ps.border}`}>
                        {t(ps.labelKey)}
                      </span>
                    );
                  })()}
                  {emailDetailTask.emailCreatedAt && (
                    <span className="text-[10px] text-[#8b9cb3] flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {format(new Date(emailDetailTask.emailCreatedAt), "d MMM yyyy HH:mm", { locale: dateFnsLocale })}
                    </span>
                  )}
                </div>
              </div>

              {emailDetailTask.emailSummary && (
                <div className="px-3 py-2 bg-primary/[0.06] rounded-lg border border-primary/10">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Sparkles className="w-3 h-3 text-primary" />
                    <span className="text-[10px] font-medium text-primary uppercase tracking-wider">{t("inbox.aiSummary")}</span>
                  </div>
                  <p className="text-[12px] text-[#8b9cb3] leading-relaxed">{emailDetailTask.emailSummary}</p>
                </div>
              )}

              {emailDetailTask.emailBody && (
                <div className="border border-border rounded-lg p-3">
                  <EmailBodyRenderer body={emailDetailTask.emailBody} emailId={emailDetailTask.emailId} sender={emailDetailTask.emailSenderEmail || emailDetailTask.emailSender} />
                </div>
              )}

              <div className="flex items-center gap-1.5 pt-1">
                <Button
                  size="sm"
                  className="gap-1.5 h-7 text-[11px]"
                  onClick={() => {
                    if (!replyOpen) {
                      setReplyTo(extractEmailAddress(emailDetailTask.emailSenderEmail) || extractEmailAddress(emailDetailTask.emailSender) || "");
                      setReplySubject(emailDetailTask.emailSubject?.startsWith("Re:") ? emailDetailTask.emailSubject : `Re: ${emailDetailTask.emailSubject}`);
                      const sig = signatureForConnection(emailDetailTask.emailConnectionId);
                      setReplyText(sig ? `\n\n${sig}` : "");
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
                  className="gap-1.5 h-7 text-[11px] bg-transparent border-primary/30 text-primary hover:bg-primary/10 hover:text-primary"
                  disabled={generateDraftMut.isPending}
                  onClick={handleGenerateDraftForTask}
                >
                  {generateDraftMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                  {generateDraftMut.isPending ? t("inbox.generating") : t("inbox.aiReply")}
                </Button>
              </div>

              {replyOpen && (
                <div className="space-y-2.5 border-t border-border pt-3">
                  <div>
                    <label className="text-[10px] text-[#8b9cb3] uppercase tracking-wider mb-1 block">{t("inbox.replyTo")}</label>
                    <Input value={replyTo} onChange={(e) => setReplyTo(e.target.value)} placeholder="email@exemple.com" className="bg-background border-border text-white text-[12px] h-8" />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#8b9cb3] uppercase tracking-wider mb-1 block">{t("inbox.subject")}</label>
                    <Input value={replySubject} onChange={(e) => setReplySubject(e.target.value)} placeholder={t("inbox.subject")} className="bg-background border-border text-white text-[12px] h-8" />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#8b9cb3] uppercase tracking-wider mb-1 block">{t("inbox.message")}</label>
                    <Textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder={t("inbox.replyPlaceholder")} className="min-h-[180px] bg-background border-border text-white text-[12px] resize-y" />
                  </div>
                  <div className="flex items-center gap-2 justify-between">
                    <FileAttachInput files={replyAttachments} onChange={setReplyAttachments} />
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => { setReplyOpen(false); setReplyText(""); setReplyTo(""); setReplySubject(""); setReplyAttachments([]); }} className="text-[#8b9cb3] hover:text-white h-7 text-[11px]">{t("common.cancel")}</Button>
                      <Button size="sm" className="gap-1.5 h-7 text-[11px]" disabled={sendEmailMut.isPending || !replyTo.trim() || !replySubject.trim() || !replyText.trim()} onClick={handleSendReply}>
                        <Send className="w-3 h-3" />
                        {sendEmailMut.isPending ? t("inbox.sending") : t("inbox.send")}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {emailDetailTask.emailId && (
                <div className="border-t border-border pt-3">
                  <EmailComments emailId={emailDetailTask.emailId} />
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
