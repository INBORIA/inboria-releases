import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { EmailBodyRenderer } from "@/components/EmailBodyRenderer";
import { EmailComments } from "@/components/email-comments";
import { FileAttachInput, type UploadedFile } from "@/components/FileAttachInput";
import {
  useListTasks,
  useUpdateTask,
  useDeleteTask,
  getListTasksQueryKey,
  useListFollowups,
  useCreateFollowup,
  useUpdateFollowup,
  useDeleteFollowup,
  useGetFollowupStats,
  useListProjects,
  useDetectFollowups,
  useListEmails,
  useGetEmailConversation,
  useGetConversationSummary,
  useSendEmail,
  useGenerateDraft,
  useGetProfile,
  getListFollowupsQueryKey,
  getGetFollowupStatsQueryKey,
  getListEmailsQueryKey,
} from "@workspace/api-client-react";
import type { PaginatedEmails } from "@workspace/api-client-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { fr, enUS, nl } from "date-fns/locale";
import {
  Calendar, Mail, CheckSquare, Clock, Trash2, X, User, Sparkles, Tag, Download,
  Reply, Send, Wand2, Loader2, Plus, CheckCircle2, AlertTriangle, RotateCcw,
  FolderKanban, CalendarDays, Eye, ArrowLeft, MessageSquare,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
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

function getStatusConfig(t: (key: string) => string) {
  return {
    en_attente: { label: t("followup.pending"), color: "text-amber-400", bg: "bg-amber-500/15", icon: Clock },
    relance: { label: t("followup.relance"), color: "text-orange-400", bg: "bg-orange-500/15", icon: RotateCcw },
    termine: { label: t("followup.completed"), color: "text-emerald-400", bg: "bg-emerald-500/15", icon: CheckCircle2 },
  } as Record<string, any>;
}

export default function Taches() {
  const { t, i18n } = useTranslation();
  const dateFnsLocale = i18n.language === "nl" ? nl : i18n.language === "en" ? enUS : fr;
  const queryClient = useQueryClient();
  const { data: profile } = useGetProfile();
  const { toast } = useToast();

  const [mainTab, setMainTab] = useState<"actions" | "relances">("actions");

  const [taskFilter, setTaskFilter] = useState<string>("pending");
  const [emailDetailTask, setEmailDetailTask] = useState<any>(null);
  const sendEmailMut = useSendEmail();
  const generateDraftMut = useGenerateDraft();
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyTo, setReplyTo] = useState("");
  const [replySubject, setReplySubject] = useState("");
  const [replyText, setReplyText] = useState("");
  const [replyAttachments, setReplyAttachments] = useState<UploadedFile[]>([]);

  const { data: tasks, isLoading: tasksLoading } = useListTasks({ status: taskFilter as any });
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const STATUS_CONFIG = getStatusConfig(t);
  const [followupFilter, setFollowupFilter] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [showAiDetect, setShowAiDetect] = useState(false);
  const [selectedFollowup, setSelectedFollowup] = useState<any>(null);

  const { data: followups, isLoading: followupsLoading } = useListFollowups({
    status: followupFilter !== "all" ? followupFilter as any : undefined,
  });
  const { data: stats } = useGetFollowupStats();
  const { data: projects } = useListProjects();
  const createFollowup = useCreateFollowup();
  const updateFollowup = useUpdateFollowup();
  const deleteFollowup = useDeleteFollowup();

  const invalidateFollowups = () => {
    queryClient.invalidateQueries({ queryKey: getListFollowupsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetFollowupStatsQueryKey() });
  };

  const handleToggleTask = (id: string, currentDone: boolean) => {
    updateTask.mutate(
      { id, data: { done: !currentDone } },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() }) }
    );
  };

  const handleDeleteTask = (id: string) => {
    deleteTask.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
          toast({ title: t("tasks.deleted") });
        },
        onError: () => toast({ variant: "destructive", title: t("common.error"), description: t("tasks.deleteError") }),
      }
    );
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
    setReplyTo(emailDetailTask.emailSenderEmail || emailDetailTask.emailSender || "");
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

  const handleCreateFollowup = (data: { title: string; dueDate?: string; notes?: string; projectId?: string; emailId?: number }) => {
    createFollowup.mutate(
      { data: data as any },
      {
        onSuccess: () => { invalidateFollowups(); toast({ title: t("followup.created") }); setShowCreate(false); },
      }
    );
  };

  const handleFollowupStatusChange = (id: string, status: string) => {
    updateFollowup.mutate(
      { id, data: { status } as any },
      { onSuccess: () => { invalidateFollowups(); toast({ title: `${t("followup.statusUpdated")}: ${STATUS_CONFIG[status]?.label || status}` }); } }
    );
  };

  const handleDeleteFollowup = (id: string) => {
    deleteFollowup.mutate(
      { id },
      { onSuccess: () => { invalidateFollowups(); toast({ title: t("followup.deleted") }); } }
    );
  };

  if (selectedFollowup) {
    return (
      <DashboardLayout>
        <div className="p-5 max-w-[900px] mx-auto w-full">
          <FollowupDetail
            followup={selectedFollowup}
            onBack={() => setSelectedFollowup(null)}
            onStatusChange={(status) => {
              handleFollowupStatusChange(selectedFollowup.id, status);
              setSelectedFollowup({ ...selectedFollowup, status });
            }}
            onDelete={() => { handleDeleteFollowup(selectedFollowup.id); setSelectedFollowup(null); }}
            projects={(projects as any[]) || []}
          />
        </div>
      </DashboardLayout>
    );
  }

  const followupsList = (followups as any[]) || [];
  const today = new Date().toISOString().split("T")[0];
  const overdue = followupsList.filter((f) => f.due_date && f.due_date < today && f.status !== "termine");
  const active = followupsList.filter((f) => f.status !== "termine" && !(f.due_date && f.due_date < today));
  const completed = followupsList.filter((f) => f.status === "termine");

  return (
    <DashboardLayout>
      <div className="p-5 max-w-5xl mx-auto w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div>
            <h1 className="text-[16px] font-semibold text-white tracking-tight flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-primary" />
              {t("tasksAndFollowup.title")}
            </h1>
            <p className="text-[12px] text-[#8b9cb3] mt-0.5">{t("tasksAndFollowup.subtitle")}</p>
          </div>
          <div className="flex items-center gap-2">
            {mainTab === "relances" && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAiDetect(true)}
                  className="gap-1 text-[11px] h-7 bg-transparent border-border text-primary hover:text-white"
                >
                  <Sparkles className="w-3 h-3" />
                  {t("followup.aiDetection")}
                </Button>
                <Button
                  size="sm"
                  onClick={() => setShowCreate(true)}
                  className="gap-1 text-[11px] h-7"
                >
                  <Plus className="w-3 h-3" />
                  {t("followup.newFollowup")}
                </Button>
              </>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  if (mainTab === "actions") {
                    await downloadExport("export/tasks", `taches_${new Date().toISOString().split("T")[0]}.csv`);
                    toast({ title: t("tasks.exportDownloaded") });
                  } else {
                    await downloadExport("export/followups", `suivis_${new Date().toISOString().split("T")[0]}.csv`);
                    toast({ title: t("followup.exportDownloaded") });
                  }
                } catch {
                  toast({ title: t("tasks.exportError"), variant: "destructive" });
                }
              }}
              className="gap-1 text-[11px] h-7 bg-transparent border-border text-[#8b9cb3] hover:text-white"
            >
              <Download className="w-3 h-3" />
              {t("common.export")}
            </Button>
          </div>
        </div>

        <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as any)} className="mb-5">
          <TabsList className="bg-card border border-border p-0.5 h-9">
            <TabsTrigger value="actions" className="data-[state=active]:bg-primary data-[state=active]:text-white text-[#8b9cb3] text-[13px] h-7 px-4 gap-1.5">
              <CheckSquare className="w-3 h-3" />
              {t("tasksAndFollowup.actions")}
            </TabsTrigger>
            <TabsTrigger value="relances" className="data-[state=active]:bg-primary data-[state=active]:text-white text-[#8b9cb3] text-[13px] h-7 px-4 gap-1.5">
              <Eye className="w-3 h-3" />
              {t("tasksAndFollowup.followups")}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {mainTab === "actions" && (
          <>
            <Tabs defaultValue={taskFilter} onValueChange={setTaskFilter} className="mb-4">
              <TabsList className="bg-card border border-border p-0.5 h-8">
                <TabsTrigger value="pending" className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-[#8b9cb3] text-[11px] h-6 px-3">{t("tasks.todo")}</TabsTrigger>
                <TabsTrigger value="done" className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-[#8b9cb3] text-[11px] h-6 px-3">{t("tasks.done")}</TabsTrigger>
                <TabsTrigger value="all" className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-[#8b9cb3] text-[11px] h-6 px-3">{t("tasks.all")}</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="space-y-1.5">
              {tasksLoading ? (
                Array(4).fill(0).map((_, i) => (
                  <div key={i} className="bg-card rounded-lg border border-border p-4 flex items-center gap-4">
                    <Skeleton className="w-5 h-5 rounded bg-white/5" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-3/4 mb-2 bg-white/5" />
                      <Skeleton className="h-3 w-1/4 bg-white/5" />
                    </div>
                  </div>
                ))
              ) : (tasks as any[])?.length === 0 ? (
                <div className="text-center py-20 rounded-lg border border-border border-dashed bg-card/50">
                  <CheckSquare className="mx-auto h-12 w-12 text-[#8b9cb3]/20 mb-3" />
                  <h3 className="text-sm font-medium text-white mb-1">{t("tasks.noTasks")}</h3>
                  <p className="text-[13px] text-[#8b9cb3]">{t("tasks.autoCreatedDesc")}</p>
                </div>
              ) : (
                (tasks as any[])?.map((task: any) => (
                  <div
                    key={task.id}
                    className={`bg-card rounded-lg border border-border p-4 flex items-start gap-4 transition-all hover:bg-[#1a2235] ${task.done ? "opacity-50" : ""}`}
                  >
                    <div className="mt-0.5">
                      <Checkbox
                        checked={task.done}
                        onCheckedChange={() => handleToggleTask(task.id, task.done)}
                        className="w-4 h-4 border-[#8b9cb3]/40 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[13px] font-medium text-white mb-1.5 ${task.done ? "line-through text-[#8b9cb3]" : ""}`}>
                        {task.title}
                      </p>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#8b9cb3]">
                        {task.dueDate && (
                          <div className={`flex items-center gap-1 ${new Date(task.dueDate) < new Date() && !task.done ? "text-red-400" : ""}`}>
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
                        {!task.dueDate && !task.emailSubject && (
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{t("tasks.createdOn")} {format(new Date(task.createdAt), "dd/MM/yyyy")}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {task.done && (
                        <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[11px] hidden sm:inline-flex">
                          {t("tasks.completed")}
                        </Badge>
                      )}
                      <button
                        onClick={async () => {
                          try {
                            await downloadExport(`export/tasks?id=${task.id}`, `tache_${task.id}.csv`);
                            toast({ title: t("tasks.exportDownloaded") });
                          } catch {
                            toast({ title: t("tasks.exportError"), variant: "destructive" });
                          }
                        }}
                        className="p-1.5 rounded-md text-[#8b9cb3] hover:text-primary hover:bg-primary/10 transition-colors"
                        title={t("tasks.export")}
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteTask(task.id)}
                        className="p-1.5 rounded-md text-[#8b9cb3] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title={t("common.delete")}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {mainTab === "relances" && (
          <>
            {stats && (
              <div className="grid grid-cols-4 gap-2 mb-4">
                <StatCard label={t("followup.pending")} value={(stats as any).en_attente || 0} color="text-amber-400" bg="bg-amber-500/10" icon={Clock} />
                <StatCard label={t("followup.relance")} value={(stats as any).relance || 0} color="text-orange-400" bg="bg-orange-500/10" icon={RotateCcw} />
                <StatCard label={t("followup.overdue")} value={(stats as any).overdue || 0} color="text-red-400" bg="bg-red-500/10" icon={AlertTriangle} />
                <StatCard label={t("followup.completed")} value={(stats as any).termine || 0} color="text-emerald-400" bg="bg-emerald-500/10" icon={CheckCircle2} />
              </div>
            )}

            <div className="flex items-center gap-2 mb-4">
              {["all", "en_attente", "relance", "termine"].map((s) => (
                <Button
                  key={s}
                  variant={followupFilter === s ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFollowupFilter(s)}
                  className="text-[11px] h-7"
                >
                  {s === "all" ? t("followup.all") : STATUS_CONFIG[s]?.label || s}
                </Button>
              ))}
            </div>

            {followupsLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : followupsList.length === 0 ? (
              <div className="text-center py-16 rounded-lg border border-border border-dashed bg-card/50">
                <Eye className="mx-auto h-8 w-8 text-[#8b9cb3]/20 mb-2" />
                <h3 className="text-[13px] font-medium text-white mb-1">{t("followup.noFollowups")}</h3>
                <p className="text-[12px] text-[#8b9cb3]">{t("followup.noFollowupsAlt")}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {overdue.length > 0 && (
                  <div>
                    <h3 className="text-[12px] font-medium text-red-400 mb-2 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> {t("followup.overdue")} ({overdue.length})
                    </h3>
                    <div className="space-y-1">
                      {overdue.map((f: any) => (
                        <FollowupRow key={f.id} followup={f} onStatusChange={handleFollowupStatusChange} onDelete={handleDeleteFollowup} onClick={() => setSelectedFollowup(f)} isOverdue />
                      ))}
                    </div>
                  </div>
                )}
                {active.length > 0 && (
                  <div>
                    <h3 className="text-[12px] font-medium text-white mb-2">{t("followup.active")} ({active.length})</h3>
                    <div className="space-y-1">
                      {active.map((f: any) => (
                        <FollowupRow key={f.id} followup={f} onStatusChange={handleFollowupStatusChange} onDelete={handleDeleteFollowup} onClick={() => setSelectedFollowup(f)} />
                      ))}
                    </div>
                  </div>
                )}
                {completed.length > 0 && (
                  <div>
                    <h3 className="text-[12px] font-medium text-[#8b9cb3] mb-2">{t("followup.completed")} ({completed.length})</h3>
                    <div className="space-y-1">
                      {completed.map((f: any) => (
                        <FollowupRow key={f.id} followup={f} onStatusChange={handleFollowupStatusChange} onDelete={handleDeleteFollowup} onClick={() => setSelectedFollowup(f)} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {showCreate && (
          <CreateFollowupModal
            onClose={() => setShowCreate(false)}
            onCreate={handleCreateFollowup}
            projects={projects || []}
          />
        )}

        {showAiDetect && (
          <AiDetectModal
            onClose={() => setShowAiDetect(false)}
            onCreate={handleCreateFollowup}
          />
        )}
      </div>

      <Dialog open={!!emailDetailTask} onOpenChange={(open) => { if (!open) { setEmailDetailTask(null); setReplyOpen(false); setReplyTo(""); setReplySubject(""); setReplyText(""); setReplyAttachments([]); } }}>
        <DialogContent className="bg-card border-border max-w-2xl max-h-[80vh] overflow-y-auto">
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
                  <EmailBodyRenderer body={emailDetailTask.emailBody} />
                </div>
              )}

              <div className="flex items-center gap-1.5 pt-1">
                <Button
                  size="sm"
                  className="gap-1.5 h-7 text-[11px]"
                  onClick={() => {
                    if (!replyOpen) {
                      setReplyTo(emailDetailTask.emailSenderEmail || emailDetailTask.emailSender || "");
                      setReplySubject(emailDetailTask.emailSubject?.startsWith("Re:") ? emailDetailTask.emailSubject : `Re: ${emailDetailTask.emailSubject}`);
                      setReplyText((profile as any)?.signature ? `\n\n${(profile as any).signature}` : "");
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
                    <Textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder={t("inbox.replyPlaceholder")} className="h-24 bg-background border-border text-white text-[12px] resize-none" />
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
                <div className="rounded-lg border border-border overflow-hidden">
                  <EmailComments emailId={emailDetailTask.emailId} currentUserId={(profile as any)?.id} />
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function StatCard({ label, value, color, bg, icon: Icon }: { label: string; value: number; color: string; bg: string; icon: any }) {
  return (
    <div className={`rounded-lg border border-border p-3 ${bg}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-3.5 h-3.5 ${color}`} />
        <span className="text-[11px] text-[#8b9cb3]">{label}</span>
      </div>
      <span className={`text-[18px] font-semibold ${color}`}>{value}</span>
    </div>
  );
}

function FollowupRow({
  followup: f,
  onStatusChange,
  onDelete,
  onClick,
  isOverdue,
}: {
  followup: any;
  onStatusChange: (id: string, status: string) => void;
  onDelete: (id: string) => void;
  onClick: () => void;
  isOverdue?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const dateFnsLocale = i18n.language === "nl" ? nl : i18n.language === "en" ? enUS : fr;
  const STATUS_CONFIG = getStatusConfig(t);
  const cfg = STATUS_CONFIG[f.status] || STATUS_CONFIG.en_attente;
  const StatusIcon = cfg.icon;
  const { toast } = useToast();

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-[#1a2235] transition-colors ${isOverdue ? "border-red-500/30 bg-red-500/5" : "border-border bg-card"}`}
      onClick={onClick}
    >
      <div className={`w-7 h-7 rounded-full flex items-center justify-center ${cfg.bg}`}>
        <StatusIcon className={`w-3.5 h-3.5 ${cfg.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-[12px] font-medium ${f.status === "termine" ? "text-[#8b9cb3] line-through" : "text-white"}`}>
          {f.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          {f.due_date && (
            <span className={`text-[10px] flex items-center gap-0.5 ${isOverdue ? "text-red-400" : "text-[#8b9cb3]"}`}>
              <CalendarDays className="w-3 h-3" />
              {format(new Date(f.due_date), "dd MMM yyyy", { locale: dateFnsLocale })}
            </span>
          )}
          {f.emails?.subject && (
            <span className="text-[10px] text-[#8b9cb3] flex items-center gap-0.5">
              <Mail className="w-3 h-3" />
              {f.emails.subject.substring(0, 30)}...
            </span>
          )}
          {f.projects?.name && (
            <span className="text-[10px] text-[#8b9cb3] flex items-center gap-0.5">
              <FolderKanban className="w-3 h-3" />
              {f.projects.reference || f.projects.name}
            </span>
          )}
        </div>
        {f.notes && <p className="text-[10px] text-[#8b9cb3] mt-0.5 line-clamp-1">{f.notes}</p>}
      </div>
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <Select value={f.status} onValueChange={(v) => onStatusChange(f.id, v)}>
          <SelectTrigger className="w-[110px] h-7 text-[10px] bg-transparent border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="en_attente" className="text-[11px]">{t("followup.pending")}</SelectItem>
            <SelectItem value="relance" className="text-[11px]">{t("followup.relance")}</SelectItem>
            <SelectItem value="termine" className="text-[11px]">{t("followup.completed")}</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            try {
              await downloadExport(`export/followups?id=${f.id}`, `suivi_${f.id}.csv`);
              toast({ title: t("followup.exportDownloaded") });
            } catch {
              toast({ title: t("followup.exportError"), variant: "destructive" });
            }
          }}
          className="h-7 w-7 p-0 text-[#8b9cb3] hover:text-primary"
          title={t("common.export")}
        >
          <Download className="w-3 h-3" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(f.id)}
          className="h-7 w-7 p-0 text-[#8b9cb3] hover:text-red-400"
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}

function FollowupDetail({
  followup: f,
  onBack,
  onStatusChange,
  onDelete,
  projects,
}: {
  followup: any;
  onBack: () => void;
  onStatusChange: (status: string) => void;
  onDelete: () => void;
  projects: any[];
}) {
  const { t, i18n } = useTranslation();
  const dateFnsLocale = i18n.language === "nl" ? nl : i18n.language === "en" ? enUS : fr;
  const STATUS_CONFIG = getStatusConfig(t);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: profile } = useGetProfile();
  const emailId = f.email_id;
  const { data: convoData, isLoading: loadingConvo } = useGetEmailConversation(emailId!, { query: { enabled: !!emailId } });
  const summaryMut = useGetConversationSummary();
  const sendEmailMut = useSendEmail();
  const generateDraftMut = useGenerateDraft();
  const updateFollowup = useUpdateFollowup();

  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyTo, setReplyTo] = useState("");
  const [replySubject, setReplySubject] = useState("");
  const [replyText, setReplyText] = useState("");
  const [editNotes, setEditNotes] = useState(f.notes || "");
  const [notesChanged, setNotesChanged] = useState(false);

  const thread = (convoData as any)?.thread || [];
  const email = (convoData as any)?.email;
  const cfg = STATUS_CONFIG[f.status] || STATUS_CONFIG.en_attente;
  const StatusIcon = cfg.icon;
  const today = new Date().toISOString().split("T")[0];
  const isOverdue = f.due_date && f.due_date < today && f.status !== "termine";

  const handleGenerateSummary = async () => {
    if (thread.length === 0) return;
    setLoadingSummary(true);
    try {
      const result = await summaryMut.mutateAsync({ data: { thread } });
      setAiSummary((result as any)?.summary || "");
    } catch {
      setAiSummary(t("followup.summaryError"));
    }
    setLoadingSummary(false);
  };

  const handleSendReply = () => {
    if (!replyTo.trim() || !replySubject.trim() || !replyText.trim()) return;
    sendEmailMut.mutate(
      { data: { to: replyTo, subject: replySubject, body: replyText, replyToEmailId: emailId ?? null } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListEmailsQueryKey() });
          toast({ title: t("followup.replySent") });
          setReplyOpen(false); setReplyText("");
        },
        onError: (err: any) => {
          toast({ variant: "destructive", title: t("common.error"), description: err?.data?.error || t("followup.replyError") });
        },
      }
    );
  };

  const handleGenerateDraft = () => {
    if (!emailId) return;
    generateDraftMut.mutate(
      { data: { emailId } },
      {
        onSuccess: (data: any) => { setReplyText(data.draft); toast({ title: t("followup.draftGenerated") }); },
        onError: () => toast({ title: t("followup.draftError"), variant: "destructive" }),
      }
    );
  };

  const handleSaveNotes = () => {
    updateFollowup.mutate(
      { id: f.id, data: { notes: editNotes } as any },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListFollowupsQueryKey() });
          toast({ title: t("followup.notesUpdated") });
          setNotesChanged(false);
        },
      }
    );
  };

  const handleExportConversation = async () => {
    if (!emailId) return;
    try {
      await downloadExport(`export/emails?id=${emailId}`, `conversation_${emailId}.csv`);
      toast({ title: t("followup.conversationExported") });
    } catch {
      toast({ title: t("followup.exportError"), variant: "destructive" });
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="h-7 px-2 text-[#8b9cb3] hover:text-white hover:bg-white/[0.06] text-[12px]"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1" />
          {t("tasksAndFollowup.title")}
        </Button>
        <div className="flex-1" />
        {emailId && (
          <>
            <Button variant="outline" size="sm" onClick={handleExportConversation} className="gap-1 text-[11px] h-7 bg-transparent border-border text-[#8b9cb3] hover:text-white">
              <Download className="w-3 h-3" />
              {t("common.export")}
            </Button>
            <Button variant="outline" size="sm" onClick={handleGenerateSummary} disabled={loadingSummary || thread.length === 0} className="gap-1 text-[11px] h-7 bg-transparent border-border text-primary hover:text-white">
              {loadingSummary ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              {t("followup.aiSummary")}
            </Button>
          </>
        )}
        <Button variant="outline" size="sm" onClick={onDelete} className="gap-1 text-[11px] h-7 bg-transparent border-red-500/30 text-red-400 hover:bg-red-500/10">
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>

      <div className={`rounded-lg border p-4 mb-4 ${isOverdue ? "border-red-500/30 bg-red-500/5" : "border-border bg-card"}`}>
        <div className="flex items-start gap-3">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center ${cfg.bg} shrink-0`}>
            <StatusIcon className={`w-4 h-4 ${cfg.color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-[15px] font-semibold text-white mb-1">{f.title}</h2>
            <div className="flex items-center gap-3 flex-wrap">
              {f.due_date && (
                <span className={`text-[11px] flex items-center gap-1 ${isOverdue ? "text-red-400" : "text-[#8b9cb3]"}`}>
                  <CalendarDays className="w-3.5 h-3.5" />
                  {format(new Date(f.due_date), "dd MMMM yyyy", { locale: dateFnsLocale })}
                  {isOverdue && <span className="text-red-400 font-medium ml-1">{t("followup.overdue")}</span>}
                </span>
              )}
              {f.projects?.name && (
                <span className="text-[11px] text-[#8b9cb3] flex items-center gap-1">
                  <FolderKanban className="w-3.5 h-3.5" />
                  {f.projects.reference} — {f.projects.name}
                </span>
              )}
              {f.emails?.subject && (
                <span className="text-[11px] text-[#8b9cb3] flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5" />
                  {f.emails.subject}
                </span>
              )}
            </div>
          </div>
          <div onClick={(e) => e.stopPropagation()}>
            <Select value={f.status} onValueChange={onStatusChange}>
              <SelectTrigger className="w-[120px] h-8 text-[11px] bg-transparent border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en_attente" className="text-[11px]">{t("followup.pending")}</SelectItem>
                <SelectItem value="relance" className="text-[11px]">{t("followup.relance")}</SelectItem>
                <SelectItem value="termine" className="text-[11px]">{t("followup.completed")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-border/50">
          <label className="text-[10px] text-[#8b9cb3] uppercase tracking-wider mb-1 block">{t("followup.notes")}</label>
          <Textarea
            value={editNotes}
            onChange={(e) => { setEditNotes(e.target.value); setNotesChanged(true); }}
            placeholder={t("followup.notesPlaceholder")}
            className="bg-background border-border text-white text-[12px] h-16 resize-none"
          />
          {notesChanged && (
            <div className="flex justify-end mt-1">
              <Button size="sm" onClick={handleSaveNotes} className="text-[10px] h-6">
                {t("followup.save")}
              </Button>
            </div>
          )}
        </div>

        {emailId && (
          <div className="mt-3 pt-3 border-t border-border/50 rounded-lg overflow-hidden">
            <EmailComments emailId={emailId} currentUserId={(profile as any)?.id} />
          </div>
        )}
      </div>

      {aiSummary && (
        <div className="mb-4 p-3 rounded-lg border border-primary/20 bg-primary/5">
          <div className="flex items-center gap-1 mb-1">
            <Sparkles className="w-3 h-3 text-primary" />
            <span className="text-[11px] font-medium text-primary">{t("followup.aiSummary")}</span>
          </div>
          <p className="text-[12px] text-[#8b9cb3] whitespace-pre-wrap">{aiSummary}</p>
        </div>
      )}

      {!emailId ? (
        <div className="text-center py-12 rounded-lg border border-border border-dashed bg-card/50">
          <MessageSquare className="mx-auto h-8 w-8 text-[#8b9cb3]/20 mb-2" />
          <h3 className="text-[13px] font-medium text-white mb-1">{t("followup.noFollowups")}</h3>
          <p className="text-[12px] text-[#8b9cb3]">{t("followup.noFollowupsAlt")}</p>
        </div>
      ) : loadingConvo ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[13px] font-medium text-white flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-primary" />
              {t("followup.conversationWith")} ({thread.length} message{thread.length > 1 ? "s" : ""})
            </h3>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                className="gap-1 h-7 text-[11px]"
                onClick={() => {
                  if (!replyOpen && email) {
                    const sender = email.sender || "";
                    const recipient = email.recipient || "";
                    const lastReceived = [...thread].reverse().find((m: any) => m.role === "received");
                    setReplyTo(lastReceived?.sender || sender || recipient);
                    setReplySubject(email.subject?.startsWith("Re:") ? email.subject : `Re: ${email.subject}`);
                    setReplyText("");
                  }
                  setReplyOpen(!replyOpen);
                }}
              >
                <Reply className="w-3 h-3" />
                {t("followup.reply")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1 h-7 text-[11px] bg-transparent border-primary/30 text-primary hover:bg-primary/10"
                disabled={generateDraftMut.isPending}
                onClick={() => {
                  if (email) {
                    const sender = email.sender || "";
                    const lastReceived = [...thread].reverse().find((m: any) => m.role === "received");
                    setReplyTo(lastReceived?.sender || sender);
                    setReplySubject(email.subject?.startsWith("Re:") ? email.subject : `Re: ${email.subject}`);
                    setReplyOpen(true);
                    handleGenerateDraft();
                  }
                }}
              >
                {generateDraftMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                {t("followup.aiReply")}
              </Button>
            </div>
          </div>

          {replyOpen && (
            <div className="mb-4 rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-medium text-primary uppercase tracking-wider flex items-center gap-1">
                  <Reply className="w-3.5 h-3.5" /> {t("followup.reply")}
                </span>
                <button onClick={() => setReplyOpen(false)} className="text-[#8b9cb3] hover:text-white"><X className="w-4 h-4" /></button>
              </div>
              <Input placeholder={t("followup.replyTo")} value={replyTo} onChange={(e) => setReplyTo(e.target.value)} className="bg-background border-border text-white text-[12px] h-8" />
              <Input placeholder={t("followup.replySubject")} value={replySubject} onChange={(e) => setReplySubject(e.target.value)} className="bg-background border-border text-white text-[12px] h-8" />
              <Textarea placeholder={t("followup.replyMessage")} value={replyText} onChange={(e) => setReplyText(e.target.value)} className="bg-background border-border text-white text-[12px] min-h-[120px]" />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setReplyOpen(false)} className="text-[#8b9cb3] h-7 text-[11px]">{t("common.cancel")}</Button>
                <Button size="sm" className="gap-1 h-7 text-[11px]" disabled={sendEmailMut.isPending || !replyTo.trim() || !replyText.trim()} onClick={handleSendReply}>
                  {sendEmailMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                  {sendEmailMut.isPending ? t("followup.sending") : t("followup.send")}
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {thread.map((msg: any, idx: number) => (
              <div
                key={msg.id || idx}
                className={`rounded-lg border p-4 ${
                  msg.role === "sent"
                    ? "border-primary/20 bg-primary/5 ml-8"
                    : "border-border bg-card mr-8"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold ${
                    msg.role === "sent" ? "bg-primary/20 text-primary" : "bg-white/[0.06] text-[#8b9cb3]"
                  }`}>
                    {msg.role === "sent" ? <Send className="w-3 h-3" /> : <User className="w-3 h-3" />}
                  </div>
                  <span className="text-[11px] font-medium text-white">
                    {msg.role === "sent" ? "Vous" : msg.sender || "?"}
                  </span>
                  <span className="text-[10px] text-[#8b9cb3]">
                    {msg.role === "sent" ? `→ ${msg.recipient || "?"}` : ""}
                  </span>
                  <span className="text-[10px] text-[#8b9cb3] ml-auto">
                    {msg.createdAt ? format(new Date(msg.createdAt), "dd MMM HH:mm", { locale: dateFnsLocale }) : ""}
                  </span>
                </div>
                {msg.summary && (
                  <div className="mb-2 px-2 py-1.5 rounded bg-primary/[0.06]">
                    <div className="flex items-center gap-1 mb-0.5">
                      <Sparkles className="w-2.5 h-2.5 text-primary" />
                      <span className="text-[9px] font-medium text-primary uppercase">{t("followup.aiSummary")}</span>
                    </div>
                    <p className="text-[11px] text-[#8b9cb3]">{msg.summary}</p>
                  </div>
                )}
                <div className="text-[12px] text-[#8b9cb3] max-h-[300px] overflow-y-auto">
                  <EmailBodyRenderer body={msg.body || ""} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function CreateFollowupModal({
  onClose,
  onCreate,
  projects,
}: {
  onClose: () => void;
  onCreate: (data: any) => void;
  projects: any[];
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [projectId, setProjectId] = useState("");

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-[#141c2b] rounded-xl border border-border p-5 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[14px] font-semibold text-white">{t("followup.newFollowup")}</h3>
          <button onClick={onClose} className="text-[#8b9cb3] hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-3">
          <Input placeholder={t("followup.titlePlaceholder")} value={title} onChange={(e) => setTitle(e.target.value)} className="bg-card border-border text-[12px]" />
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="bg-card border-border text-[12px]" />
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger className="bg-card border-border text-[12px]">
              <SelectValue placeholder={t("followup.projectOptional")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none" className="text-[11px]">{t("followup.noProject")}</SelectItem>
              {projects.map((p: any) => (
                <SelectItem key={p.id} value={p.id} className="text-[11px]">
                  {p.reference} - {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea placeholder={t("followup.notes")} value={notes} onChange={(e) => setNotes(e.target.value)} className="bg-card border-border text-[12px] min-h-[60px]" />
          <Button
            onClick={() => onCreate({
              title,
              dueDate: dueDate || undefined,
              notes: notes || undefined,
              projectId: projectId && projectId !== "none" ? projectId : undefined,
            })}
            disabled={!title.trim()}
            className="w-full text-[12px]"
          >
            {t("followup.create")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function AiDetectModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (data: any) => void;
}) {
  const { t } = useTranslation();
  const { data: emailsData, isLoading: loadingEmails } = useListEmails({ limit: 20 });
  const emails = (emailsData as PaginatedEmails | undefined)?.emails ?? [];
  const detectMut = useDetectFollowups();
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [detecting, setDetecting] = useState(false);
  const [detected, setDetected] = useState(false);
  const { toast } = useToast();

  const handleDetect = async () => {
    if (emails.length === 0) return;
    setDetecting(true);
    try {
      const result = await detectMut.mutateAsync({
        data: { emails: emails.map((e) => ({ id: e.id, sender: e.sender, subject: e.subject, summary: e.summary, body: e.body?.substring(0, 300) })) },
      });
      setSuggestions((result as any)?.followups || []);
      setDetected(true);
    } catch {
      toast({ title: t("followup.exportError"), variant: "destructive" });
    }
    setDetecting(false);
  };

  const handleAccept = (s: any) => {
    onCreate({
      title: s.title,
      emailId: s.emailId,
      dueDate: s.suggestedDueDate || undefined,
      notes: s.reason,
    });
    setSuggestions((prev) => prev.filter((x) => x !== s));
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-[#141c2b] rounded-xl border border-border p-5 w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[14px] font-semibold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            {t("followup.aiDetection")}
          </h3>
          <button onClick={onClose} className="text-[#8b9cb3] hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        {!detected ? (
          <div className="text-center py-6">
            <p className="text-[12px] text-[#8b9cb3] mb-4">
              {t("followup.aiDetectionDesc")}
            </p>
            <Button onClick={handleDetect} disabled={detecting || loadingEmails} className="gap-1">
              {detecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {detecting ? t("followup.detecting") : t("followup.aiDetection")}
            </Button>
          </div>
        ) : suggestions.length === 0 ? (
          <div className="text-center py-6">
            <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-400 mb-2" />
            <p className="text-[12px] text-[#8b9cb3]">{t("followup.noFollowupsAlt")}</p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-[11px] text-[#8b9cb3] mb-3">{t("followup.detectedCount", { count: suggestions.length })}</p>
            {suggestions.map((s, i) => (
              <div key={i} className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                <p className="text-[12px] font-medium text-white mb-1">{s.title}</p>
                <p className="text-[10px] text-[#8b9cb3] mb-2">{s.reason}</p>
                <div className="flex items-center gap-2">
                  {s.suggestedDueDate && (
                    <span className="text-[10px] text-[#8b9cb3] flex items-center gap-0.5">
                      <CalendarDays className="w-3 h-3" />
                      {s.suggestedDueDate}
                    </span>
                  )}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    s.urgency === "haute" ? "bg-red-500/15 text-red-400" :
                    s.urgency === "moyenne" ? "bg-amber-500/15 text-amber-400" :
                    "bg-emerald-500/15 text-emerald-400"
                  }`}>
                    {s.urgency}
                  </span>
                  <div className="flex-1" />
                  <Button size="sm" onClick={() => handleAccept(s)} className="text-[10px] h-6 gap-1">
                    <Plus className="w-3 h-3" /> {t("followup.create")}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
