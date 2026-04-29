import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CalendarClock, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BackToInboxButton } from "@/components/dashboard/back-to-inbox-button";
import {
  useListScheduledEmails,
  useCancelScheduledEmail,
  getListScheduledEmailsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { DashboardLayout } from "@/components/layout/dashboard-layout";

export default function Programmes() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useListScheduledEmails();
  const cancelMut = useCancelScheduledEmail();
  const fmt = new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeStyle: "short" });
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const emails = (data as any)?.emails || [];

  const handleCancel = (id: number) => {
    cancelMut.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: t("wave1.scheduledCancelSuccess") });
          qc.invalidateQueries({ queryKey: getListScheduledEmailsQueryKey() });
        },
        onError: (e: any) => {
          toast({ variant: "destructive", title: e?.message || "Cancel failed" });
        },
      }
    );
  };

  const toggleExpand = (id: number) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-5 space-y-6">
        <BackToInboxButton />
        <section>
          <div className="flex items-center gap-2 mb-3">
            <CalendarClock className="w-5 h-5 text-primary" />
            <h1 className="text-[16px] font-semibold text-white">
              {t("wave1.scheduledPageTitle", "Envois programmés")}
            </h1>
            {emails.length > 0 && (
              <span className="text-[11px] text-[#8b9cb3]">({emails.length})</span>
            )}
          </div>

          {isLoading ? (
            <div className="text-[13px] text-[#8b9cb3]">…</div>
          ) : emails.length === 0 ? (
            <div className="text-center py-8 border border-border rounded-md bg-card">
              <CalendarClock className="w-7 h-7 mx-auto text-[#8b9cb3] mb-2 opacity-50" />
              <p className="text-[13px] text-white font-medium">
                {t("wave1.scheduledPageEmpty", "Aucun envoi programmé")}
              </p>
              <p className="text-[12px] text-[#8b9cb3] mt-1">
                {t(
                  "wave1.scheduledPageEmptyHint",
                  "Utilisez « Programmer » dans le composer pour planifier un envoi à une date/heure précise."
                )}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {emails.map((e: any) => {
                const isOpen = !!expanded[e.id];
                return (
                  <div
                    key={e.id}
                    className="border border-border rounded-md bg-card p-3"
                    data-testid={`scheduled-email-${e.id}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div
                          className={`text-[13px] text-white font-medium ${isOpen ? "" : "truncate"}`}
                        >
                          {e.subject || "(sans sujet)"}
                        </div>
                        <div
                          className={`text-[11px] text-[#8b9cb3] mt-0.5 ${isOpen ? "break-all" : "truncate"}`}
                        >
                          → {e.recipient}
                        </div>
                        <div className="text-[11px] text-amber-300 mt-1 flex items-center gap-1">
                          <CalendarClock className="w-3 h-3" />
                          {t("wave1.scheduledSentAt", {
                            date: fmt.format(new Date(e.scheduledSendAt)),
                          })}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toggleExpand(e.id)}
                          className="h-7 gap-1 text-[11px] text-[#8b9cb3] hover:text-white hover:bg-white/5"
                          data-testid={`scheduled-toggle-${e.id}`}
                        >
                          {isOpen ? (
                            <>
                              <ChevronUp className="w-3 h-3" />
                              {t("wave1.scheduledHide", "Masquer")}
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-3 h-3" />
                              {t("wave1.scheduledShow", "Voir l'email")}
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCancel(e.id)}
                          disabled={cancelMut.isPending}
                          className="h-7 gap-1 text-[11px] text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          data-testid={`scheduled-cancel-${e.id}`}
                        >
                          <Trash2 className="w-3 h-3" />
                          {t("wave1.scheduledCancel")}
                        </Button>
                      </div>
                    </div>
                    {isOpen && (
                      <div className="mt-3 pt-3 border-t border-border">
                        <div className="text-[10px] uppercase tracking-wide text-[#8b9cb3] mb-1">
                          {t("wave1.scheduledBodyLabel", "Contenu de l'email")}
                        </div>
                        <div
                          className="text-[12px] text-white/90 whitespace-pre-wrap break-words max-h-80 overflow-y-auto bg-black/20 rounded p-2 border border-border/40"
                          data-testid={`scheduled-body-${e.id}`}
                        >
                          {e.body || (
                            <span className="text-[#8b9cb3] italic">
                              {t("wave1.scheduledBodyEmpty", "(corps vide)")}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
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
