import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CalendarClock, Trash2, Eye, Loader2, X } from "lucide-react";
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
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-4 h-4 text-[#8b95a7] animate-spin mr-2" />
              <span className="text-[12px] text-[#8b95a7]">{t("inbox.loadingTitle", "Chargement…")}</span>
            </div>
          ) : emails.length === 0 ? (
            <div className="text-center py-16">
              <CalendarClock className="w-7 h-7 mx-auto text-[#8b95a7] mb-2 opacity-50" />
              <p className="text-[13px] text-white font-medium">
                {t("wave1.scheduledPageEmpty", "Aucun envoi programmé")}
              </p>
              <p className="text-[12px] text-[#8b95a7] mt-1 max-w-md mx-auto">
                {t(
                  "wave1.scheduledPageEmptyHint",
                  "Utilisez « Programmer » dans le composer pour planifier un envoi à une date/heure précise."
                )}
              </p>
            </div>
          ) : (
            <div>
              {emails.map((e: any) => {
                const recipient = String(e.recipient || "");
                const initial = (recipient[0] || "?").toUpperCase();
                const dateShort = e.scheduledSendAt
                  ? new Intl.DateTimeFormat(i18n.language, { day: "numeric", month: "short" }).format(new Date(e.scheduledSendAt))
                  : "";
                const timeShort = e.scheduledSendAt
                  ? new Intl.DateTimeFormat(i18n.language, { hour: "2-digit", minute: "2-digit" }).format(new Date(e.scheduledSendAt))
                  : "";
                const excerpt = String(e.body || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 140);
                return (
                  <div
                    key={e.id}
                    className="group relative flex items-center gap-3 h-[52px] pl-2 pr-3 cursor-pointer select-none border-l-2 border-b border-border/40 transition-colors border-l-transparent hover:bg-white/[0.03]"
                    data-testid={`scheduled-email-${e.id}`}
                    onClick={() => setOpenId(e.id)}
                  >
                    <div className="w-3 h-3 shrink-0" />
                    <div className="w-7 h-7 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
                      <span className="text-primary text-[11px] font-semibold">{initial}</span>
                    </div>
                    <div className="w-[140px] text-[13px] text-white font-medium truncate shrink-0">
                      {recipient}
                    </div>
                    <div className="flex-1 min-w-0 text-[13px] truncate">
                      <span className="text-white">{e.subject || "(sans sujet)"}</span>
                      {excerpt && (
                        <span className="text-[#8b95a7]"> — {excerpt}</span>
                      )}
                    </div>
                    <div
                      className="hidden group-hover:flex items-center gap-1 shrink-0"
                      onClick={(ev) => ev.stopPropagation()}
                    >
                      <button
                        onClick={() => setOpenId(e.id)}
                        className="p-1.5 rounded hover:bg-white/[0.06] text-[#8b95a7] hover:text-white"
                        title={t("wave1.scheduledShow", "Voir l'email") as string}
                        data-testid={`scheduled-open-${e.id}`}
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleCancel(e.id)}
                        disabled={cancelMut.isPending}
                        className="p-1.5 rounded hover:bg-red-500/[0.08] text-[#8b95a7] hover:text-red-400 disabled:opacity-50"
                        title={t("wave1.scheduledCancel") as string}
                        data-testid={`scheduled-cancel-${e.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="group-hover:hidden flex items-center gap-2 shrink-0">
                      <CalendarClock className="w-3 h-3 text-[#8b95a7]" />
                      <span className="text-[11px] tabular-nums text-[#8b95a7] whitespace-nowrap">
                        {dateShort}{timeShort ? ` · ${timeShort}` : ""}
                      </span>
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
