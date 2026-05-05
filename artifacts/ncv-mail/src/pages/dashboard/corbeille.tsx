import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { EmailBodyRenderer } from "@/components/EmailBodyRenderer";
import {
  useListEmails,
  useRestoreEmail,
  usePermanentDeleteEmail,
  useEmptyTrash,
  getListEmailsQueryKey,
  getGetCategoryCountsQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetInboxHealthQueryKey,
} from "@workspace/api-client-react";
import type { Email, PaginatedEmails } from "@workspace/api-client-react";
import { format } from "date-fns";
import { fr, enUS, nl, de, es, it, pt, pl, ro, sv, da, fi, hu } from "date-fns/locale";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { ArrowLeft, RotateCcw, Trash2, Clock, Loader2, Inbox } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
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

export default function Corbeille() {
  const { t, i18n } = useTranslation();
  const dateFnsLocale = ({fr,en:enUS,nl,de,es,it,pt,pl}[(i18n.resolvedLanguage || i18n.language || "fr").substring(0,2)] || fr);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [selectedEmailId, setSelectedEmailId] = useState<number | null>(null);
  const [emptyConfirmOpen, setEmptyConfirmOpen] = useState(false);

  const { data, isLoading } = useListEmails({ status: "trashed", limit: 200, page: 1 }, { query: { placeholderData: (prev: any) => prev } as any });
  const paged = data as PaginatedEmails | undefined;
  const emails = useMemo(() => (paged?.emails || []) as Email[], [paged]);

  const restore = useRestoreEmail();
  const permDelete = usePermanentDeleteEmail();
  const emptyTrash = useEmptyTrash();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListEmailsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetCategoryCountsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetInboxHealthQueryKey() });
  };

  const handleRestore = (id: number) => {
    restore.mutate({ id }, {
      onSuccess: () => {
        if (selectedEmailId === id) setSelectedEmailId(null);
        invalidate();
        toast({ title: t("trash.restored") });
      },
      onError: () => toast({ title: t("common.error"), variant: "destructive" }),
    });
  };

  const handleDelete = (id: number) => {
    permDelete.mutate({ id }, {
      onSuccess: () => {
        if (selectedEmailId === id) setSelectedEmailId(null);
        invalidate();
        toast({ title: t("trash.deleted") });
      },
      onError: () => toast({ title: t("common.error"), variant: "destructive" }),
    });
  };

  const handleEmpty = () => {
    emptyTrash.mutate(undefined, {
      onSuccess: () => {
        setSelectedEmailId(null);
        invalidate();
        toast({ title: t("trash.emptied") });
      },
      onError: () => toast({ title: t("common.error"), variant: "destructive" }),
    });
    setEmptyConfirmOpen(false);
  };

  const selectedEmail = emails.find((e) => e.id === selectedEmailId);

  if (selectedEmail) {
    return (
      <DashboardLayout>
        <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center gap-3 mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedEmailId(null)}
              className="h-7 px-2 text-[#b8c5d6] hover:text-white hover:bg-white/[0.06] text-[12px]"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              {t("trash.title")}
            </Button>
          </div>

          <div className="bg-card rounded-lg border border-border overflow-hidden">
            <div className="p-4 border-b border-border">
              <h2 className="text-[15px] font-semibold text-white mb-2.5">{selectedEmail.subject}</h2>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#1e3a5f] flex items-center justify-center text-primary font-semibold text-[12px]">
                    {((selectedEmail as any).sender || "?")[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="text-[12px] font-medium text-white">{(selectedEmail as any).sender}</div>
                    {(selectedEmail as any).senderEmail && (
                      <div className="text-[10px] text-[#b8c5d6]">{(selectedEmail as any).senderEmail}</div>
                    )}
                  </div>
                </div>
                <span className="text-[10px] text-[#b8c5d6] flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {format(new Date((selectedEmail as any).createdAt), "d MMMM yyyy HH:mm", { locale: dateFnsLocale })}
                </span>
              </div>
            </div>

            <div className="p-4">
              <EmailBodyRenderer body={(selectedEmail as any).body || ""} emailId={selectedEmail.id} sender={(selectedEmail as any).sender} />
            </div>

            <div className="px-4 py-3 border-t border-border flex items-center gap-1.5 flex-wrap">
              <Button size="sm" className="gap-1.5 h-7 text-[11px]" onClick={() => handleRestore(selectedEmail.id)}>
                <RotateCcw className="w-3 h-3" />
                {t("trash.restore")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-7 text-[11px] bg-transparent border-border text-red-400/80 hover:text-red-400 hover:bg-red-500/[0.08]"
                onClick={() => handleDelete(selectedEmail.id)}
              >
                <Trash2 className="w-3 h-3" />
                {t("trash.permanentDelete")}
              </Button>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-5">
        <div className="mb-2">
          <Link href="/dashboard">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[#b8c5d6] hover:text-white hover:bg-white/[0.06] text-[12px]"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              {t("inbox.title")}
            </Button>
          </Link>
        </div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-baseline gap-3">
            <h1 className="text-[18px] font-semibold text-white">{t("trash.title")}</h1>
            <span className="text-[12px] text-[#b8c5d6]">
              {t("trash.count", { count: emails.length })}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[11px] bg-transparent border-border text-red-400/80 hover:text-red-400 hover:bg-red-500/[0.08]"
            onClick={() => setEmptyConfirmOpen(true)}
            disabled={emails.length === 0 || emptyTrash.isPending}
          >
            <Trash2 className="w-3 h-3 mr-1" />
            {t("trash.empty")}
          </Button>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 rounded-lg border border-border border-dashed bg-card/50">
            <Loader2 className="w-6 h-6 text-primary animate-spin mb-3" />
            <h3 className="text-[13px] font-medium text-white">{t("inbox.loadingTitle", "Chargement…")}</h3>
          </div>
        ) : emails.length === 0 ? (
          <div className="text-center py-16 rounded-lg border border-border border-dashed bg-card/50">
            <Inbox className="mx-auto h-8 w-8 text-[#b8c5d6]/40 mb-2" />
            <p className="text-[12px] text-[#b8c5d6]">{t("trash.noEmails")}</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {emails.map((email: any) => (
              <div
                key={email.id}
                className="group flex items-center gap-3 rounded-md border border-border bg-card hover:bg-[#1a2235] transition-colors cursor-pointer px-3 py-2"
                onClick={() => setSelectedEmailId(email.id)}
              >
                <div className="w-6 h-6 rounded-full bg-[#1e3a5f] flex items-center justify-center shrink-0">
                  <span className="text-primary font-semibold text-[10px]">{(email.sender || "?")[0].toUpperCase()}</span>
                </div>
                <span className="text-[12px] font-medium text-white truncate min-w-[120px] max-w-[200px]">{email.sender}</span>
                <span className="text-[12px] text-[#b8c5d6] truncate flex-1">{email.subject}</span>
                <span className="text-[10px] text-[#b8c5d6]/70 shrink-0 hidden sm:inline">
                  {format(new Date(email.createdAt), "d MMM", { locale: dateFnsLocale })}
                </span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRestore(email.id); }}
                    className="p-1 rounded hover:bg-white/[0.08] text-[#b8c5d6] hover:text-white"
                    title={t("trash.restore")}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(email.id); }}
                    className="p-1 rounded hover:bg-red-500/[0.12] text-[#b8c5d6] hover:text-red-400"
                    title={t("trash.permanentDelete")}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={emptyConfirmOpen} onOpenChange={setEmptyConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("trash.emptyConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("trash.emptyConfirmBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleEmpty} className="bg-red-500 hover:bg-red-500/90">
              {emptyTrash.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : t("trash.empty")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
