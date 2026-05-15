import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  useGetCategoryCounts,
  useListProjects,
  useGetProfile,
  useGetMyOrganisation,
  useGetOrganisationMembers,
  useGetSharedMailboxes,
  useUpdateEmail,
  useDeleteEmail,
  useSendEmail,
  useCancelPendingSend,
  useGenerateDraft,
  useAssignEmail,
  useUnassignEmail,
  useCreateTask,
  getListEmailsQueryKey,
  getGetCategoryCountsQueryKey,
  getGetInboxHealthQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetProfileQueryKey,
  getListTasksQueryKey,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import type { UploadedFile } from "@/components/FileAttachInput";
import { EmailDetail } from "./EmailDetail";

type ComposeConnection = {
  id: string;
  provider: string;
  email_address: string;
  signature?: string | null;
  consecutive_failures?: number | null;
  last_error_message?: string | null;
};

interface EmailDetailContainerProps {
  emailId: number | null;
  onBack: () => void;
  onAfterArchive?: () => void;
  onAfterDelete?: () => void;
  onAfterMutation?: () => void;
}

export function EmailDetailContainer({
  emailId,
  onBack,
  onAfterArchive,
  onAfterDelete,
  onAfterMutation,
}: EmailDetailContainerProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: email, isLoading, isError } = useQuery<any>({
    queryKey: ["email-detail", emailId],
    queryFn: async () => {
      if (!emailId) return null;
      const { supabase } = await import("@/lib/supabase");
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error("no session");
      const resp = await fetch(`${import.meta.env.BASE_URL}api/emails/${emailId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return resp.json();
    },
    enabled: !!emailId,
    staleTime: 30_000,
    retry: 1,
  });

  const { data: categoryCounts } = useGetCategoryCounts({ scope: "personal" as const });
  const { data: projects } = useListProjects();
  const { data: profile } = useGetProfile();
  const { data: myOrg } = useGetMyOrganisation();
  const { data: orgMembers } = useGetOrganisationMembers({
    query: { enabled: !!(myOrg as any)?.id } as any,
  });
  const { data: sharedMailboxes } = useGetSharedMailboxes();

  const { data: composeConnections } = useQuery<ComposeConnection[]>({
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
  const sendEmailMut = useSendEmail();
  const cancelPendingSendMut = useCancelPendingSend();
  const generateDraftMut = useGenerateDraft();
  const assignEmailMut = useAssignEmail();
  const unassignEmailMut = useUnassignEmail();
  const createTaskMut = useCreateTask();

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getListEmailsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetCategoryCountsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetInboxHealthQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
    queryClient.refetchQueries({ queryKey: getGetDashboardSummaryQueryKey() });
    queryClient.invalidateQueries({ queryKey: ["email-detail"] });
    if (onAfterMutation) onAfterMutation();
  };

  const handleMarkAsRead = (id: number) => {
    updateEmail.mutate(
      { id, data: { status: "read" } },
      { onSuccess: invalidateAll }
    );
  };

  const handleArchive = (id: number) => {
    updateEmail.mutate(
      { id, data: { status: "archived" } },
      {
        onSuccess: () => {
          invalidateAll();
          toast({ title: t("inbox.emailArchived") });
          onAfterArchive ? onAfterArchive() : onBack();
        },
      }
    );
  };

  const handleDelete = (id: number) => {
    deleteEmail.mutate(
      { id },
      {
        onSuccess: () => {
          invalidateAll();
          toast({ title: t("inbox.emailDeleted") });
          onAfterDelete ? onAfterDelete() : onBack();
        },
        onError: () => {
          toast({
            variant: "destructive",
            title: t("common.error"),
            description: t("inbox.sendError"),
          });
        },
      }
    );
  };

  const handleUpdatePriority = (id: number, priority: string) => {
    updateEmail.mutate(
      { id, data: { priority } as any },
      {
        onSuccess: () => {
          invalidateAll();
          toast({ title: t("inbox.priorityChanged") });
        },
      }
    );
  };

  const handleUpdateCategory = (id: number, categoryId: string) => {
    updateEmail.mutate(
      { id, data: { categoryId: categoryId === "none" ? null : parseInt(categoryId) } },
      {
        onSuccess: () => {
          invalidateAll();
          toast({ title: t("inbox.categoryUpdated") });
        },
      }
    );
  };

  const handleUpdateProject = (id: number, projectId: string) => {
    updateEmail.mutate(
      { id, data: { projectId: projectId === "none" ? null : projectId } as any },
      {
        onSuccess: () => {
          invalidateAll();
          toast({ title: t("inbox.projectUpdated") });
        },
      }
    );
  };

  const handleAssign = (eId: number, userId: string) => {
    assignEmailMut.mutate(
      { emailId: eId, data: { assignTo: userId } },
      {
        onSuccess: (result) => {
          invalidateAll();
          toast({
            title: t("inbox.assignSuccess"),
            description: `${(result as any).assignedToName || ""}`,
          });
        },
        onError: () => {
          toast({ variant: "destructive", title: t("common.error") });
        },
      }
    );
  };

  const handleUnassign = (eId: number) => {
    unassignEmailMut.mutate(
      { emailId: eId },
      {
        onSuccess: () => {
          invalidateAll();
          toast({ title: t("inbox.unassignSuccess") });
        },
        onError: () => {
          toast({ variant: "destructive", title: t("common.error") });
        },
      }
    );
  };

  const handleCreateTask = async (
    eId: number,
    title: string,
    projectId?: string,
    assigneeUserIds?: string[]
  ) => {
    const assignees =
      assigneeUserIds && assigneeUserIds.length > 0 ? assigneeUserIds : [null];
    try {
      for (const assignee of assignees) {
        await createTaskMut.mutateAsync({
          data: {
            title,
            emailId: eId,
            projectId: projectId || undefined,
            ...(assignee ? { assignedToUserId: assignee } : {}),
          } as any,
        });
      }
      if (projectId) {
        await new Promise<void>((resolve) => {
          updateEmail.mutate(
            { id: eId, data: { projectId } },
            {
              onSuccess: () => {
                invalidateAll();
                resolve();
              },
              onError: () => resolve(),
            }
          );
        });
      } else {
        invalidateAll();
      }
      queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
      toast({
        title:
          assignees.length > 1
            ? t("tasks.tasksCreated", {
                count: assignees.length,
                defaultValue: `${assignees.length} tâches créées`,
              })
            : t("inbox.taskCreated"),
      });
    } catch {
      toast({
        variant: "destructive",
        title: t("common.error"),
        description: t("inbox.taskCreateError"),
      });
    }
  };

  const handleSendReply = (
    to: string,
    subject: string,
    body: string,
    replyToEmailId?: number,
    attachments?: UploadedFile[],
    connectionId?: string,
    projectId?: string,
    markHandledOfEmailId?: number
  ) => {
    const uploadIds = attachments?.map((a) => a.uploadId).filter(Boolean);
    const data: any = {
      to,
      subject,
      body,
      replyToEmailId: replyToEmailId ?? null,
      attachments: uploadIds && uploadIds.length > 0 ? uploadIds : undefined,
    };
    if (connectionId) data.connectionId = connectionId;
    if (projectId) data.projectId = projectId;
    // Task #205 — transfert : marquer l'email d'origine "traité" côté serveur,
    // mais seulement si /emails/send réussit (mutation onSuccess invalide tout).
    if (markHandledOfEmailId) data.markHandledOfEmailId = markHandledOfEmailId;

    let cancelled = false;
    const pendingId =
      typeof crypto !== "undefined" && (crypto as any).randomUUID
        ? ((crypto as any).randomUUID() as string)
        : `pend-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const performSend = () => {
      if (cancelled) return;
      sendEmailMut.mutate(
        { data },
        {
          onSuccess: (resp: any) => {
            invalidateAll();
            if (resp?.appointmentId) {
              toast({
                title: t("inbox.emailSent"),
                description: t(
                  "inbox.appointmentProposed",
                  "Rendez-vous proposé créé dans l'agenda"
                ),
              });
            } else {
              toast({ title: t("inbox.emailSent") });
            }
          },
          onError: (err: any) => {
            const msg = err?.data?.error || err?.message || t("inbox.sendError");
            toast({
              variant: "destructive",
              title: t("common.error"),
              description: msg,
            });
          },
        }
      );
    };
    const timer = setTimeout(performSend, 10000);
    toast({
      title: t("wave1.undoSendToast"),
      duration: 10000,
      action: (
        <ToastAction
          altText={t("wave1.undoSendAction") as string}
          onClick={() => {
            cancelled = true;
            clearTimeout(timer);
            cancelPendingSendMut.mutate(
              { data: { pendingId } },
              { onError: () => {} }
            );
            toast({ title: t("wave1.undoCancelled") });
          }}
          data-testid="button-undo-send"
        >
          {t("wave1.undoSendAction")}
        </ToastAction>
      ),
    });
  };

  const handleGenerateDraft = (
    eId: number,
    callback: (draft: string) => void
  ) => {
    generateDraftMut.mutate(
      { data: { emailId: eId } },
      {
        onSuccess: (data) => {
          callback(data.draft);
          queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
          toast({ title: t("inbox.draftGenerated") });
        },
        onError: () => {
          toast({ title: t("inbox.draftError") });
        },
      }
    );
  };

  if (!emailId) return null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-[#b8c5d6]">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        {t("inbox.loadingEmail", "Chargement de l'email...")}
      </div>
    );
  }

  if (isError || !email) {
    return (
      <div className="flex flex-col items-center justify-center p-12 gap-3">
        <p className="text-[#b8c5d6]">
          {t("inbox.loadEmailError", "Impossible de charger l'email.")}
        </p>
        <button
          type="button"
          onClick={onBack}
          className="text-primary hover:underline text-sm"
          data-testid="button-back-error"
        >
          {t("common.back", "Retour")}
        </button>
      </div>
    );
  }

  return (
    <EmailDetail
      email={email}
      onBack={onBack}
      onMarkRead={handleMarkAsRead}
      onArchive={handleArchive}
      onDelete={handleDelete}
      onUpdatePriority={handleUpdatePriority}
      onUpdateCategory={handleUpdateCategory}
      onUpdateProject={handleUpdateProject}
      onSendReply={handleSendReply}
      isSending={sendEmailMut.isPending}
      onGenerateDraft={handleGenerateDraft}
      isDrafting={generateDraftMut.isPending}
      categories={(categoryCounts as any) || []}
      projects={(projects as any) || []}
      currentUserId={(profile as any)?.id}
      orgMembers={(orgMembers as any[]) || []}
      onAssign={handleAssign}
      onUnassign={handleUnassign}
      onCreateTask={handleCreateTask}
      connections={composeConnections || []}
      sharedMailboxes={sharedMailboxes as any}
    />
  );
}
