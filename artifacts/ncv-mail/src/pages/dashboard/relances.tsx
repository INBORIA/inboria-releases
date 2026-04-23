import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  useListFollowups,
  useUpdateFollowup,
  useDismissFollowup,
  useGenerateFollowUpDraft,
  getListFollowupsQueryKey,
  getGetFollowupStatsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Sparkles, MailCheck, X, ArrowUpRight, Clock, Loader2, Inbox } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { fr, enUS, nl, de, es } from "date-fns/locale";

const LOCALE_MAP: Record<string, any> = { fr, en: enUS, nl, de, es };

function daysSince(iso: string | null | undefined): number {
  if (!iso) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
}

export default function Relances() {
  const { t, i18n } = useTranslation();
  const dateLocale = LOCALE_MAP[i18n.language?.slice(0, 2)] || fr;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: aiSuggestions, isLoading: loadingAi } = useListFollowups({ kind: "ai" });
  const { data: manual, isLoading: loadingManual } = useListFollowups({ kind: "manual" });

  const updateMut = useUpdateFollowup();
  const dismissMut = useDismissFollowup();
  const draftMut = useGenerateFollowUpDraft();

  const [busyId, setBusyId] = useState<string | null>(null);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getListFollowupsQueryKey({ kind: "ai" }) });
    queryClient.invalidateQueries({ queryKey: getListFollowupsQueryKey({ kind: "manual" }) });
    queryClient.invalidateQueries({ queryKey: getGetFollowupStatsQueryKey() });
  };

  async function handleDismiss(id: string) {
    setBusyId(id);
    try {
      await dismissMut.mutateAsync({ id });
      toast({ title: t("relances.dismissedToast", "Suggestion ignorée") });
      invalidateAll();
    } catch {
      toast({ variant: "destructive", title: t("common.error") });
    } finally {
      setBusyId(null);
    }
  }

  async function handleMarkReplied(id: string) {
    setBusyId(id);
    try {
      await updateMut.mutateAsync({ id, data: { status: "termine" } });
      toast({ title: t("relances.markedRepliedToast", "Marquée comme répondu") });
      invalidateAll();
    } catch {
      toast({ variant: "destructive", title: t("common.error") });
    } finally {
      setBusyId(null);
    }
  }

  async function handleCreateDraft(id: string) {
    setBusyId(id);
    try {
      const result: any = await draftMut.mutateAsync({ data: { followupId: id } });
      sessionStorage.setItem(
        "inboria.compose.prefill",
        JSON.stringify({
          to: result?.to || "",
          subject: result?.subject || "",
          body: result?.draft || "",
          followupId: id,
          savedAt: Date.now(),
        }),
      );
      // Marquer la suggestion comme "relance" (en cours) pour la sortir de la liste
      await updateMut.mutateAsync({ id, data: { status: "relance" } });
      invalidateAll();
      setLocation("/dashboard?compose=1");
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: t("relances.draftErrorTitle", "Échec de la génération"),
        description: err?.message || "",
      });
    } finally {
      setBusyId(null);
    }
  }

  const aiList = (aiSuggestions as any[]) || [];
  const manualList = (manual as any[]) || [];

  return (
    <DashboardLayout>
      <div className="max-w-[1100px] mx-auto p-4 sm:p-6 space-y-6">
        <div>
          <h1 className="text-[20px] font-semibold text-white flex items-center gap-2">
            <MailCheck className="w-5 h-5 text-primary" />
            {t("relances.pageTitle", "Relances")}
          </h1>
          <p className="text-[12px] text-[#8b9cb3] mt-1">
            {t(
              "relances.pageSubtitle",
              "Inboria détecte les mails que vous avez envoyés et qui sont restés sans réponse. Validez ou ignorez les suggestions.",
            )}
          </p>
        </div>

        <section>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-primary" />
            <h2 className="text-[13px] font-medium text-white uppercase tracking-wider">
              {t("relances.suggestionsTitle", "Suggestions IA")}
            </h2>
            <span className="text-[11px] text-[#8b9cb3]">
              ({aiList.length})
            </span>
          </div>

          {loadingAi ? (
            <div className="space-y-2">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : aiList.length === 0 ? (
            <div className="rounded-lg border border-border bg-card/40 p-8 text-center">
              <Inbox className="w-8 h-8 text-[#8b9cb3] mx-auto mb-2" />
              <p className="text-[13px] text-white">
                {t("relances.emptySuggestionsTitle", "Aucune relance à proposer")}
              </p>
              <p className="text-[12px] text-[#8b9cb3] mt-1">
                {t(
                  "relances.emptySuggestionsDesc",
                  "Tous vos mails envoyés ont reçu une réponse, ou aucun n'est assez ancien pour être relancé.",
                )}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {aiList.map((f: any) => {
                const email = f.emails || {};
                const sentAt = email.created_at || email.createdAt || null;
                const days = daysSince(sentAt);
                const isBusy = busyId === f.id;
                return (
                  <div
                    key={f.id}
                    className="rounded-lg border border-border bg-card p-4 hover:border-primary/30 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[13px] font-medium text-white truncate">
                            {email.recipient || f.title}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400">
                            <Clock className="w-3 h-3" />
                            {t("relances.daysWithoutReply", "{{count}} j sans réponse", { count: days })}
                          </span>
                        </div>
                        <p className="text-[12px] text-[#c5cee0] mt-1 truncate">
                          {email.subject || t("relances.noSubject", "(sans objet)")}
                        </p>
                        {email.summary && (
                          <p className="text-[11px] text-[#8b9cb3] mt-1 line-clamp-2">
                            {email.summary}
                          </p>
                        )}
                        {sentAt && (
                          <p className="text-[10px] text-[#8b9cb3] mt-1">
                            {t("relances.sentOn", "Envoyé")} {formatDistanceToNow(new Date(sentAt), { addSuffix: true, locale: dateLocale })}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border flex-wrap">
                      <Button
                        size="sm"
                        onClick={() => handleCreateDraft(f.id)}
                        disabled={isBusy}
                        className="h-8 text-[11px]"
                      >
                        {isBusy && draftMut.isPending ? (
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        ) : (
                          <Sparkles className="w-3 h-3 mr-1" />
                        )}
                        {t("relances.createDraft", "Créer la relance")}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleMarkReplied(f.id)}
                        disabled={isBusy}
                        className="h-8 text-[11px] text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                      >
                        <ArrowUpRight className="w-3 h-3 mr-1" />
                        {t("relances.markReplied", "Marquer comme répondu")}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDismiss(f.id)}
                        disabled={isBusy}
                        className="h-8 text-[11px] text-[#8b9cb3] hover:text-white"
                      >
                        <X className="w-3 h-3 mr-1" />
                        {t("relances.dismiss", "Ignorer")}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center gap-2 mb-3">
            <MailCheck className="w-4 h-4 text-[#8b9cb3]" />
            <h2 className="text-[13px] font-medium text-white uppercase tracking-wider">
              {t("relances.scheduledTitle", "Programmées")}
            </h2>
            <span className="text-[11px] text-[#8b9cb3]">
              ({manualList.length})
            </span>
          </div>

          {loadingManual ? (
            <Skeleton className="h-20 w-full" />
          ) : manualList.length === 0 ? (
            <div className="rounded-lg border border-border bg-card/40 p-6 text-center">
              <p className="text-[12px] text-[#8b9cb3]">
                {t(
                  "relances.emptyScheduledDesc",
                  "Aucune relance programmée manuellement. Vous pouvez en créer une depuis n'importe quel mail envoyé.",
                )}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {manualList.map((f: any) => (
                <div
                  key={f.id}
                  className="rounded-lg border border-border bg-card p-3 flex items-center justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-white truncate">{f.title}</p>
                    {f.due_date && (
                      <p className="text-[11px] text-[#8b9cb3] mt-0.5">
                        {t("relances.dueOn", "Échéance")} : {new Date(f.due_date).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded ${
                      f.status === "termine"
                        ? "bg-emerald-500/10 text-emerald-400"
                        : f.status === "relance"
                          ? "bg-blue-500/10 text-blue-400"
                          : "bg-amber-500/10 text-amber-400"
                    }`}
                  >
                    {t(`relances.status.${f.status}`, f.status) as string}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}
