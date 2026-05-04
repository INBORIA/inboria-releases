import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { BellOff, Mail, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BackToInboxButton } from "@/components/dashboard/back-to-inbox-button";
import {
  useUnsnoozeEmail,
  getListEmailsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { supabase } from "@/lib/supabase";

const baseUrl = () => import.meta.env.BASE_URL.replace(/\/$/, "");

interface SnoozedEmail {
  id: number;
  subject?: string | null;
  sender?: string | null;
  snoozedUntil?: string | null;
}

export default function Reportes() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const unsnoozeMut = useUnsnoozeEmail();
  const fmt = new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeStyle: "short" });

  const [snoozed, setSnoozed] = useState<SnoozedEmail[]>([]);
  const [snoozedLoading, setSnoozedLoading] = useState(true);

  const loadSnoozed = async () => {
    setSnoozedLoading(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) { setSnoozed([]); return; }
      const res = await fetch(`${baseUrl()}/api/emails?snoozed=1&limit=200`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { setSnoozed([]); return; }
      const j = await res.json();
      const list: SnoozedEmail[] = (j.emails || []).map((e: any) => ({
        id: e.id,
        subject: e.subject,
        sender: e.sender,
        snoozedUntil: e.snoozedUntil,
      }));
      list.sort((a, b) => {
        const da = a.snoozedUntil ? new Date(a.snoozedUntil).getTime() : 0;
        const db = b.snoozedUntil ? new Date(b.snoozedUntil).getTime() : 0;
        return da - db;
      });
      setSnoozed(list);
    } catch {
      setSnoozed([]);
    } finally {
      setSnoozedLoading(false);
    }
  };

  useEffect(() => {
    loadSnoozed();
  }, []);

  const handleWake = (id: number) => {
    unsnoozeMut.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: t("wave1.unsnoozeSuccess") });
          qc.invalidateQueries({ queryKey: getListEmailsQueryKey() });
          loadSnoozed();
        },
        onError: (e: any) => {
          toast({ variant: "destructive", title: e?.message || "Wake failed" });
        },
      }
    );
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-5 space-y-6">
        <BackToInboxButton />
        <section>
          <div className="flex items-center gap-2 mb-3">
            <BellOff className="w-5 h-5 text-amber-400" />
            <h1 className="text-[16px] font-semibold text-white">
              {t("wave1.snoozedSectionTitle", "Emails reportés")}
            </h1>
            {snoozed.length > 0 && (
              <span className="text-[11px] text-[#8b9cb3]">({snoozed.length})</span>
            )}
          </div>

          {snoozedLoading ? (
            <div className="flex flex-col items-center justify-center py-12 border border-border border-dashed rounded-md bg-card/50">
              <Loader2 className="w-5 h-5 text-primary animate-spin mb-2" />
              <p className="text-[12px] text-[#8b9cb3]">{t("inbox.loadingTitle", "Chargement…")}</p>
            </div>
          ) : snoozed.length === 0 ? (
            <div className="text-center py-8 border border-border rounded-md bg-card">
              <BellOff className="w-7 h-7 mx-auto text-[#8b9cb3] mb-2 opacity-50" />
              <p className="text-[13px] text-white font-medium">
                {t("wave1.snoozedSectionEmpty", "Aucun email reporté")}
              </p>
              <p className="text-[12px] text-[#8b9cb3] mt-1">
                {t(
                  "wave1.snoozedSectionEmptyHint",
                  "Les emails que vous reportez réapparaîtront ici jusqu'à leur réveil."
                )}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {snoozed.map((e) => (
                <div
                  key={e.id}
                  className="border border-border rounded-md bg-card p-3 flex items-start justify-between gap-3"
                  data-testid={`snoozed-row-${e.id}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] text-white font-medium truncate">
                      {e.subject || "(sans sujet)"}
                    </div>
                    {e.sender && (
                      <div className="text-[11px] text-[#8b9cb3] mt-0.5 truncate">
                        {e.sender}
                      </div>
                    )}
                    {e.snoozedUntil && (
                      <div className="text-[11px] text-amber-300 mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {t("wave1.snoozedUntilLabel", {
                          date: fmt.format(new Date(e.snoozedUntil)),
                        })}
                      </div>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleWake(e.id)}
                    disabled={unsnoozeMut.isPending}
                    className="h-7 gap-1 text-[11px] text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                    data-testid={`button-wake-${e.id}`}
                  >
                    <Mail className="w-3 h-3" />
                    {t("wave1.snoozeWake")}
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
