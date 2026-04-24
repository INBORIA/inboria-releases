import { useTranslation } from "react-i18next";
import { CalendarClock, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
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
              {emails.map((e: any) => (
                <div
                  key={e.id}
                  className="border border-border rounded-md bg-card p-3 flex items-start justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] text-white font-medium truncate">
                      {e.subject || "(sans sujet)"}
                    </div>
                    <div className="text-[11px] text-[#8b9cb3] mt-0.5 truncate">
                      → {e.recipient}
                    </div>
                    <div className="text-[11px] text-amber-300 mt-1 flex items-center gap-1">
                      <CalendarClock className="w-3 h-3" />
                      {t("wave1.scheduledSentAt", {
                        date: fmt.format(new Date(e.scheduledSendAt)),
                      })}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleCancel(e.id)}
                    disabled={cancelMut.isPending}
                    className="h-7 gap-1 text-[11px] text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  >
                    <Trash2 className="w-3 h-3" />
                    {t("wave1.scheduledCancel")}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}
