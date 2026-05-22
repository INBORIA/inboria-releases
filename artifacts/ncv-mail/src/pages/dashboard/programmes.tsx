import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CalendarClock, Trash2, Eye, Loader2, X } from "lucide-react";
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
import { MailPageHeader } from "@/components/email-list/MailPageHeader";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useEnableLightTheme } from "@/lib/inbox-theme";
import DOMPurify from "dompurify";

function looksLikeHtml(s: string): boolean {
  return /<\/?[a-z][\s\S]*>|&[a-z#0-9]+;/i.test(s);
}

export default function Programmes() {
  useEnableLightTheme();
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useListScheduledEmails();
  const [headerSearch, setHeaderSearch] = useState("");
  const cancelMut = useCancelScheduledEmail();
  const fmt = new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeStyle: "short" });
  const [openId, setOpenId] = useState<number | null>(null);

  const allScheduled = (data as any)?.emails || [];
  const emails = (() => {
    const q = headerSearch.trim().toLowerCase();
    if (!q) return allScheduled;
    return allScheduled.filter((e: any) => {
      const subject = String(e.subject ?? "").toLowerCase();
      const recipient = String(e.recipient ?? "").toLowerCase();
      const body = String(e.body ?? "").toLowerCase();
      return subject.includes(q) || recipient.includes(q) || body.includes(q);
    });
  })();
  const openedEmail = emails.find((e: any) => e.id === openId) || null;

  const handleCancel = (id: number) => {
    cancelMut.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: t("wave1.scheduledCancelSuccess") });
          qc.invalidateQueries({ queryKey: getListScheduledEmailsQueryKey() });
          if (openId === id) setOpenId(null);
        },
        onError: (e: any) => {
          toast({ variant: "destructive", title: e?.message || "Cancel failed" });
        },
      }
    );
  };

  return (
    <DashboardLayout>
      <MailPageHeader
        currentTab="programmes"
        searchValue={headerSearch}
        onSearchChange={setHeaderSearch}
        showReadingPaneToggle={false}
        showHeaderCollapseToggle={false}
      />
      <div className="max-w-[1600px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-5 space-y-6">
        <BackToInboxButton />
        <section>
          <div className="flex items-center gap-2 mb-3">
            <CalendarClock className="w-5 h-5 text-[#b8c5d6]" />
            <h1 className="text-[16px] font-semibold text-white">
              {t("wave1.scheduledPageTitle", "Envois programmés")}
            </h1>
            {emails.length > 0 && (
              <span className="text-[11px] text-[#b8c5d6]">({emails.length})</span>
            )}
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 border border-border border-dashed rounded-md bg-card/50">
              <Loader2 className="w-5 h-5 text-[#b8c5d6] animate-spin mb-2" />
              <p className="text-[12px] text-[#b8c5d6]">{t("inbox.loadingTitle", "Chargement…")}</p>
            </div>
          ) : emails.length === 0 ? (
            <div className="text-center py-8 border border-border rounded-md bg-card">
              <CalendarClock className="w-7 h-7 mx-auto text-[#b8c5d6] mb-2 opacity-50" />
              <p className="text-[13px] text-white font-medium">
                {t("wave1.scheduledPageEmpty", "Aucun envoi programmé")}
              </p>
              <p className="text-[12px] text-[#b8c5d6] mt-1">
                {t(
                  "wave1.scheduledPageEmptyHint",
                  "Utilisez « Programmer » dans le composer pour planifier un envoi à une date/heure précise."
                )}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {emails.map((e: any) => {
                const tooltip = `${e.recipient || ""}\n${e.subject || "(sans sujet)"}\n${
                  e.scheduledSendAt ? fmt.format(new Date(e.scheduledSendAt)) : ""
                }`;
                return (
                  <div
                    key={e.id}
                    className="border border-border rounded-md bg-card p-3 hover:bg-white/[0.02] cursor-pointer"
                    data-testid={`scheduled-email-${e.id}`}
                    title={tooltip}
                    onClick={() => setOpenId(e.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] text-white font-medium truncate">
                          {e.subject || "(sans sujet)"}
                        </div>
                        <div className="text-[11px] text-[#b8c5d6] mt-0.5 truncate">
                          → {e.recipient}
                        </div>
                        <div className="text-[11px] text-[#b8c5d6] mt-1 flex items-center gap-1">
                          <CalendarClock className="w-3 h-3" />
                          {t("wave1.scheduledSentAt", {
                            date: fmt.format(new Date(e.scheduledSendAt)),
                          })}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 shrink-0" onClick={(ev) => ev.stopPropagation()}>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setOpenId(e.id)}
                          className="h-7 gap-1 text-[11px] text-[#b8c5d6] hover:text-white hover:bg-white/[0.06]"
                          data-testid={`scheduled-open-${e.id}`}
                        >
                          <Eye className="w-3 h-3" />
                          {t("wave1.scheduledShow", "Voir l'email")}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCancel(e.id)}
                          disabled={cancelMut.isPending}
                          className="h-7 gap-1 text-[11px] text-[#b8c5d6] hover:text-white hover:bg-white/[0.06]"
                          data-testid={`scheduled-cancel-${e.id}`}
                        >
                          <Trash2 className="w-3 h-3" />
                          {t("wave1.scheduledCancel")}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <Dialog open={!!openedEmail} onOpenChange={(o) => !o && setOpenId(null)}>
        <DialogContent
          aria-describedby={undefined}
          className="bg-card border-border w-[95vw] sm:max-w-2xl p-0 flex flex-col max-h-[85vh]"
        >
          {openedEmail && (
            <>
              <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border">
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-semibold text-white truncate">
                    {openedEmail.subject || "(sans sujet)"}
                  </div>
                  <div className="text-[12px] text-[#b8c5d6] mt-1 truncate">
                    → {openedEmail.recipient}
                  </div>
                  <div className="text-[11px] text-[#b8c5d6] mt-1 flex items-center gap-1">
                    <CalendarClock className="w-3 h-3" />
                    {t("wave1.scheduledSentAt", {
                      date: fmt.format(new Date(openedEmail.scheduledSendAt)),
                    })}
                  </div>
                </div>
                <button
                  onClick={() => setOpenId(null)}
                  className="text-[#b8c5d6] hover:text-white shrink-0"
                  aria-label="Fermer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="px-5 py-4 overflow-y-auto">
                {openedEmail.body ? (
                  looksLikeHtml(openedEmail.body) ? (
                    <div
                      className="text-[13px] text-foreground break-words ncv-email-html"
                      data-testid={`scheduled-body-${openedEmail.id}`}
                      dangerouslySetInnerHTML={{
                        __html: DOMPurify.sanitize(openedEmail.body, {
                          USE_PROFILES: { html: true },
                          FORBID_TAGS: ["script", "style", "iframe", "object", "embed"],
                          FORBID_ATTR: ["onerror", "onload", "onclick"],
                        }),
                      }}
                    />
                  ) : (
                    <div
                      className="text-[13px] text-foreground whitespace-pre-wrap break-words"
                      data-testid={`scheduled-body-${openedEmail.id}`}
                    >
                      {openedEmail.body}
                    </div>
                  )
                ) : (
                  <div
                    className="text-[13px]"
                    data-testid={`scheduled-body-${openedEmail.id}`}
                  >
                    <span className="text-[#b8c5d6] italic">
                      {t("wave1.scheduledBodyEmpty", "(corps vide)")}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 px-5 py-3 border-t border-border">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleCancel(openedEmail.id)}
                  disabled={cancelMut.isPending}
                  className="h-8 gap-1 text-[12px] text-[#b8c5d6] hover:text-white hover:bg-white/[0.06]"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {t("wave1.scheduledCancel")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setOpenId(null)}
                  className="h-8 text-[12px] bg-transparent border-[#1f2937] text-[#b8c5d6] hover:text-white hover:bg-white/[0.04]"
                >
                  {t("common.close", "Fermer")}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
