import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { BackToInboxButton } from "@/components/dashboard/back-to-inbox-button";
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
import { Sparkles, MailCheck, X, CheckCircle2, Clock, Loader2, Inbox } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { fr, enUS, nl, de, es, it, pt, pl, ro, sv, da, fi, hu, cs, tr, ja, ko, vi, th, id, ms, el } from "date-fns/locale";
import { useEnableLightTheme } from "@/lib/inbox-theme";

const LOCALE_MAP: Record<string, any> = { fr, en: enUS, nl, de, es, it, pt, pl, ro, sv, da, fi, hu, cs, tr, ja, ko, vi, th, id, ms, el };

function daysSince(iso: string | null | undefined): number {
  if (!iso) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
}

export default function Relances() {
  useEnableLightTheme();
  const { t, i18n } = useTranslation();
  const dateLocale = LOCALE_MAP[i18n.language?.slice(0, 2)] || fr;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: aiSuggestions, isLoading: loadingAi } = useListFollowups({ kind: "ai" });

  const updateMut = useUpdateFollowup();
  const dismissMut = useDismissFollowup();
  const draftMut = useGenerateFollowUpDraft();

  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<"draft" | "replied" | "dismiss" | null>(null);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getListFollowupsQueryKey({ kind: "ai" }) });
    queryClient.invalidateQueries({ queryKey: getListFollowupsQueryKey({ kind: "manual" }) });
    queryClient.invalidateQueries({ queryKey: getGetFollowupStatsQueryKey() });
  };

  async function handleDismiss(id: string) {
    setBusyId(id); setBusyAction("dismiss");
    try {
      await dismissMut.mutateAsync({ id });
      toast({ title: t("relances.dismissedToast", "Suggestion ignorée") });
      invalidateAll();
    } catch {
      toast({ variant: "destructive", title: t("common.error") });
    } finally {
      setBusyId(null); setBusyAction(null);
    }
  }

  async function handleMarkReplied(id: string) {
    setBusyId(id); setBusyAction("replied");
    try {
      await updateMut.mutateAsync({ id, data: { status: "termine" } });
      toast({ title: t("relances.markedRepliedToast", "Marquée comme répondu") });
      invalidateAll();
    } catch {
      toast({ variant: "destructive", title: t("common.error") });
    } finally {
      setBusyId(null); setBusyAction(null);
    }
  }

  async function handleCreateDraft(id: string) {
    setBusyId(id); setBusyAction("draft");
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
      setBusyId(null); setBusyAction(null);
    }
  }

  const aiList = (aiSuggestions as any[]) || [];

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-5 space-y-3">
        <BackToInboxButton />
        <div>
          <h1 className="text-[20px] font-semibold text-foreground flex items-center gap-2">
            <MailCheck className="w-5 h-5 text-primary" />
            {t("relances.pageTitle", "Relances")}
          </h1>
          <p className="text-[12px] text-muted-foreground mt-1">
            {t(
              "relances.pageSubtitle",
              "Inboria détecte les mails que vous avez envoyés et qui sont restés sans réponse. Validez ou ignorez les suggestions.",
            )}
          </p>
        </div>

        <section>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <h2 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {t("relances.suggestionsTitle", "Suggestions Inboria")}
            </h2>
            <span className="text-[11px] text-[#8b95a7]">({aiList.length})</span>
          </div>

          {loadingAi ? (
            <div className="flex flex-col items-center justify-center py-16 rounded-lg border border-[#1f2937] border-dashed bg-white/[0.02]">
              <Loader2 className="w-5 h-5 text-[#8b95a7] animate-spin mb-3" />
              <p className="text-[12px] text-[#b8c5d6]">{t("inbox.loadingTitle", "Chargement…")}</p>
            </div>
          ) : aiList.length === 0 ? (
            <div className="text-center py-20 rounded-lg border border-[#1f2937] border-dashed bg-white/[0.02]">
              <Inbox className="mx-auto h-10 w-10 text-[#3a4150] mb-3" />
              <h3 className="text-[13px] font-medium text-foreground mb-1">
                {t("relances.emptySuggestionsTitle", "Aucune relance à proposer")}
              </h3>
              <p className="text-[12px] text-[#8b95a7]">
                {t(
                  "relances.emptySuggestionsDesc",
                  "Tous vos mails envoyés ont reçu une réponse, ou aucun n'est assez ancien pour être relancé.",
                )}
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-[#1f2937] overflow-hidden bg-white/[0.01]">
              {aiList.map((f: any) => {
                const email = f.emails || {};
                const sentAt = email.created_at || email.createdAt || null;
                const days = daysSince(sentAt);
                const recipient = email.recipient || f.title || "?";
                const initial = recipient.trim().charAt(0).toUpperCase();
                const subject = email.subject || t("relances.noSubject", "(sans objet)");
                const summary = email.summary || "";
                const isBusy = busyId === f.id;

                return (
                  <div
                    key={f.id}
                    data-followup-row
                    data-row-id={f.id}
                    title={`${recipient}\n— ${subject}${summary ? `\n${summary}` : ""}`}
                    className="group relative flex items-center gap-3 h-[52px] pl-2 pr-3 select-none border-l-2 border-l-transparent border-b border-[#1f2937] transition-colors hover:bg-white/[0.03]"
                  >
                    <div className="w-4 shrink-0" />

                    <div className="w-7 h-7 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
                      <span className="text-primary text-[11px] font-semibold">{initial}</span>
                    </div>

                    <div className="flex-1 min-w-0 flex items-baseline gap-2 overflow-hidden">
                      <span className="text-[13px] font-medium text-foreground truncate shrink-0 max-w-[180px]">
                        {recipient}
                      </span>
                      <span className="text-[12px] truncate text-[#7a8290]">
                        {subject}{summary ? ` — ${summary}` : ""}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 group-hover:hidden">
                      <span className="inline-flex items-center gap-1 text-[11px] tabular-nums text-[#b8c5d6] whitespace-nowrap">
                        <Clock className="w-2.5 h-2.5 text-[#8b95a7]" />
                        {t("relances.daysWithoutReply", "{{count}} j sans réponse", { count: days })}
                      </span>
                    </div>

                    <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleCreateDraft(f.id); }}
                        disabled={isBusy}
                        className="p-1.5 rounded text-primary hover:bg-white/[0.08] disabled:opacity-50 disabled:pointer-events-none"
                        title={t("relances.createDraft", "Créer la relance")}
                      >
                        {isBusy && busyAction === "draft" ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleMarkReplied(f.id); }}
                        disabled={isBusy}
                        className="p-1.5 rounded text-emerald-400 hover:bg-white/[0.08] disabled:opacity-50 disabled:pointer-events-none"
                        title={t("relances.markReplied", "Marquer comme répondu")}
                      >
                        {isBusy && busyAction === "replied" ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDismiss(f.id); }}
                        disabled={isBusy}
                        className="p-1.5 rounded text-[#8b95a7] hover:bg-white/[0.08] hover:text-white disabled:opacity-50 disabled:pointer-events-none"
                        title={t("relances.dismiss", "Ignorer")}
                      >
                        {isBusy && busyAction === "dismiss" ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <X className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}
