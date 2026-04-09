import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useListTasks, useUpdateTask, useDeleteTask, getListTasksQueryKey } from "@workspace/api-client-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { fr, enUS, nl } from "date-fns/locale";
import { Calendar, Mail, CheckSquare, Clock, Trash2, X, User, Sparkles, Tag, Download } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmailBodyRenderer } from "@/components/EmailBodyRenderer";
import { EmailComments } from "@/components/email-comments";
import { useGetProfile } from "@workspace/api-client-react";
import { useTranslation } from "react-i18next";

const PRIORITY_BADGE_STYLES: Record<string, { bg: string; text: string; border: string; labelKey: string }> = {
  urgent: { bg: "bg-red-500/15", text: "text-red-400", border: "border-red-500/20", labelKey: "inbox.priorities.urgent" },
  moyen: { bg: "bg-amber-500/15", text: "text-amber-400", border: "border-amber-500/20", labelKey: "inbox.priorities.medium" },
  faible: { bg: "bg-emerald-500/15", text: "text-emerald-400", border: "border-emerald-500/20", labelKey: "inbox.priorities.low" },
};

export default function Taches() {
  const { t, i18n } = useTranslation();
  const dateFnsLocale = i18n.language === "nl" ? nl : i18n.language === "en" ? enUS : fr;
  const [filter, setFilter] = useState<string>("pending");
  const [emailDetailTask, setEmailDetailTask] = useState<any>(null);
  const queryClient = useQueryClient();
  const { data: profile } = useGetProfile();

  const { data: tasks, isLoading } = useListTasks({
    status: filter as any,
  });

  const { toast } = useToast();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const handleToggleTask = (id: string, currentDone: boolean) => {
    updateTask.mutate(
      { id, data: { done: !currentDone } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
        },
      }
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
        onError: () => {
          toast({ variant: "destructive", title: t("common.error"), description: t("tasks.deleteError") });
        },
      }
    );
  };

  return (
    <DashboardLayout>
      <div className="p-5 max-w-4xl mx-auto w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div>
            <h1 className="text-[16px] font-semibold text-white tracking-tight">{t("tasks.extractedTasks")}</h1>
            <p className="text-[12px] text-[#8b9cb3] mt-0.5">{t("tasks.autoIdentified")}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                const { downloadExport } = await import("@/lib/export-utils");
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

        <Tabs defaultValue={filter} onValueChange={setFilter} className="mb-5">
          <TabsList className="bg-card border border-border p-0.5 h-9">
            <TabsTrigger value="pending" className="data-[state=active]:bg-primary data-[state=active]:text-white text-[#8b9cb3] text-[13px] h-7 px-3">{t("tasks.todo")}</TabsTrigger>
            <TabsTrigger value="done" className="data-[state=active]:bg-primary data-[state=active]:text-white text-[#8b9cb3] text-[13px] h-7 px-3">{t("tasks.done")}</TabsTrigger>
            <TabsTrigger value="all" className="data-[state=active]:bg-primary data-[state=active]:text-white text-[#8b9cb3] text-[13px] h-7 px-3">{t("tasks.all")}</TabsTrigger>
          </TabsList>
        </Tabs>

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
          ) : tasks?.length === 0 ? (
            <div className="text-center py-20 rounded-lg border border-border border-dashed bg-card/50">
              <CheckSquare className="mx-auto h-12 w-12 text-[#8b9cb3]/20 mb-3" />
              <h3 className="text-sm font-medium text-white mb-1">{t("tasks.noTasks")}</h3>
              <p className="text-[13px] text-[#8b9cb3]">{t("tasks.autoCreatedDesc")}</p>
            </div>
          ) : (
            tasks?.map((task) => (
              <div 
                key={task.id} 
                className={`bg-card rounded-lg border border-border p-4 flex items-start gap-4 transition-all hover:bg-[#1a2235] ${task.done ? 'opacity-50' : ''}`}
              >
                <div className="mt-0.5">
                  <Checkbox 
                    checked={task.done} 
                    onCheckedChange={() => handleToggleTask(task.id, task.done)}
                    className="w-4 h-4 border-[#8b9cb3]/40 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-[13px] font-medium text-white mb-1.5 ${task.done ? 'line-through text-[#8b9cb3]' : ''}`}>
                    {task.title}
                  </p>
                  
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#8b9cb3]">
                    {task.dueDate && (
                      <div className={`flex items-center gap-1 ${new Date(task.dueDate) < new Date() && !task.done ? 'text-red-400' : ''}`}>
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
                        const { downloadExport } = await import("@/lib/export-utils");
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
      </div>

      <Dialog open={!!emailDetailTask} onOpenChange={(open) => !open && setEmailDetailTask(null)}>
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
