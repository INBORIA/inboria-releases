import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { EmailBodyRenderer } from "@/components/EmailBodyRenderer";
import {
  useListEmails,
  useRestoreEmail,
  usePermanentDeleteEmail,
  useEmptySpam,
  useBlockSender,
  getListEmailsQueryKey,
  getGetSpamCountQueryKey,
  getGetCategoryCountsQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetInboxHealthQueryKey,
} from "@workspace/api-client-react";
import type { Email, PaginatedEmails } from "@workspace/api-client-react";
import { format } from "date-fns";
import { fr, enUS, nl } from "date-fns/locale";
import { useTranslation } from "react-i18next";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { useAuth } from "@/lib/auth";
import { ArrowLeft, RotateCcw, Trash2, ShieldX, Shield, Eye, EyeOff, Clock, Loader2 } from "lucide-react";
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

type RiskLevel = "low" | "medium" | "veryHigh";

function getRisk(email: any): RiskLevel {
  if (email.priority === "urgent") return "veryHigh";
  if (email.priority === "moyen") return "medium";
  return "low";
}

const RISK_DOT: Record<RiskLevel, string> = {
  low: "bg-[#8b9cb3]",
  medium: "bg-amber-500",
  veryHigh: "bg-red-500",
};

function filteredByLabel(spamSource: string | null | undefined, t: (k: string) => string): string {
  if (spamSource === "ai") return t("junk.filteredByInboria");
  if (spamSource === "user") return t("junk.filteredByUser");
  return t("junk.filteredByProvider");
}

export default function Indesirables() {
  const { t, i18n } = useTranslation();
  const dateFnsLocale = i18n.language === "nl" ? nl : i18n.language === "en" ? enUS : fr;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { session } = useAuth();
  const [selectedEmailId, setSelectedEmailId] = useState<number | null>(null);
  const [showDangerous, setShowDangerous] = useState(false);
  const [emptyConfirmOpen, setEmptyConfirmOpen] = useState(false);

  const { data: connections } = useQuery<any[]>({
    queryKey: ["email-connections"],
    queryFn: async () => {
      const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${baseUrl}/api/email/connections`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch connections");
      return res.json();
    },
    enabled: !!session,
  });
  const firstConnectionId = (connections || []).find((c: any) => c.status !== "disconnected")?.id
    || (connections || [])[0]?.id
    || null;

  const { data, isLoading } = useListEmails({ status: "spam", limit: 200, page: 1 }, { query: { placeholderData: (prev: any) => prev } as any });
  const paged = data as PaginatedEmails | undefined;
  const emails = useMemo(() => (paged?.emails || []) as Email[], [paged]);

  const restore = useRestoreEmail();
  const permDelete = usePermanentDeleteEmail();
  const emptySpam = useEmptySpam();
  const blockSender = useBlockSender();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListEmailsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetSpamCountQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetCategoryCountsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetInboxHealthQueryKey() });
  };

  const handleRestore = (id: number) => {
    restore.mutate({ id }, {
      onSuccess: () => {
        if (selectedEmailId === id) setSelectedEmailId(null);
        invalidate();
        toast({ title: t("junk.restored") });
      },
      onError: () => toast({ title: t("common.error"), variant: "destructive" }),
    });
  };

  const handleDelete = (id: number) => {
    permDelete.mutate({ id }, {
      onSuccess: () => {
        if (selectedEmailId === id) setSelectedEmailId(null);
        invalidate();
        toast({ title: t("junk.deleted") });
      },
      onError: () => toast({ title: t("common.error"), variant: "destructive" }),
    });
  };

  const handleBlock = (email: any) => {
    const addr = (email.senderEmail || "").trim();
    if (!addr) {
      toast({ title: t("junk.blockFailed"), description: t("junk.blockNoEmail"), variant: "destructive" });
      return;
    }
    if (!firstConnectionId) {
      toast({ title: t("junk.blockFailed"), description: t("junk.blockNoConnection"), variant: "destructive" });
      return;
    }
    blockSender.mutate(
      { data: { email: addr, connectionId: firstConnectionId, scope: "all_accounts" } },
      {
        onSuccess: () => toast({ title: t("junk.blocked"), description: addr }),
        onError: () => toast({ title: t("junk.blockFailed"), variant: "destructive" }),
      },
    );
  };

  const handleEmpty = () => {
    emptySpam.mutate(undefined, {
      onSuccess: () => {
        setSelectedEmailId(null);
        invalidate();
        toast({ title: t("junk.emptied") });
      },
      onError: () => toast({ title: t("common.error"), variant: "destructive" }),
    });
    setEmptyConfirmOpen(false);
  };

  const dangerous = emails.filter((e) => getRisk(e) === "veryHigh");
  const normal = emails.filter((e) => getRisk(e) !== "veryHigh");
  const visible = showDangerous ? [...normal, ...dangerous] : normal;
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
              className="h-7 px-2 text-[#8b9cb3] hover:text-white hover:bg-white/[0.06] text-[12px]"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              {t("junk.title")}
            </Button>
          </div>

          <div className="mb-3 rounded-md border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2 flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[11px] text-amber-300">
              {filteredByLabel((selectedEmail as any).spamSource, t)}
            </span>
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
                      <div className="text-[10px] text-[#8b9cb3]">{(selectedEmail as any).senderEmail}</div>
                    )}
                  </div>
                </div>
                <span className="text-[10px] text-[#8b9cb3] flex items-center gap-1">
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
                {t("junk.restore")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-7 text-[11px] bg-transparent border-border text-amber-300 hover:text-amber-200 hover:bg-amber-500/[0.08]"
                onClick={() => handleBlock(selectedEmail)}
                disabled={blockSender.isPending}
              >
                <ShieldX className="w-3 h-3" />
                {t("junk.blockSender")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-7 text-[11px] bg-transparent border-border text-red-400/80 hover:text-red-400 hover:bg-red-500/[0.08]"
                onClick={() => handleDelete(selectedEmail.id)}
              >
                <Trash2 className="w-3 h-3" />
                {t("junk.permanentDelete")}
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
              className="h-7 px-2 text-[#8b9cb3] hover:text-white hover:bg-white/[0.06] text-[12px]"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              {t("inbox.title")}
            </Button>
          </Link>
        </div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-baseline gap-3">
            <h1 className="text-[18px] font-semibold text-white">{t("junk.title")}</h1>
            <span className="text-[12px] text-[#8b9cb3]">
              {t("junk.count", { count: emails.length })}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[11px] bg-transparent border-border text-red-400/80 hover:text-red-400 hover:bg-red-500/[0.08]"
            onClick={() => setEmptyConfirmOpen(true)}
            disabled={emails.length === 0 || emptySpam.isPending}
          >
            <Trash2 className="w-3 h-3 mr-1" />
            {t("junk.empty")}
          </Button>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 rounded-lg border border-border border-dashed bg-card/50">
            <Loader2 className="w-6 h-6 text-primary animate-spin mb-3" />
            <h3 className="text-[13px] font-medium text-white">{t("inbox.loadingTitle", "Chargement…")}</h3>
          </div>
        ) : emails.length === 0 ? (
          <div className="text-center py-16 rounded-lg border border-border border-dashed bg-card/50">
            <Shield className="mx-auto h-8 w-8 text-[#8b9cb3]/40 mb-2" />
            <p className="text-[12px] text-[#8b9cb3]">{t("junk.noEmails")}</p>
          </div>
        ) : (
          <>
            {dangerous.length > 0 && (
              <button
                className="w-full mb-2 rounded-md border border-red-500/20 bg-red-500/[0.06] px-3 py-2 flex items-center justify-between hover:bg-red-500/[0.10] transition-colors"
                onClick={() => setShowDangerous((v) => !v)}
              >
                <span className="text-[11px] text-red-300 flex items-center gap-2">
                  <ShieldX className="w-3.5 h-3.5" />
                  {t("junk.hiddenDangerous", { count: dangerous.length })}
                </span>
                <span className="text-[11px] text-red-300 flex items-center gap-1 font-medium">
                  {showDangerous ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  {showDangerous ? t("junk.hide") : t("junk.show")}
                </span>
              </button>
            )}

            <div className="space-y-0.5">
              {visible.map((email: any) => {
                const risk = getRisk(email);
                return (
                  <div
                    key={email.id}
                    className="group flex items-center gap-3 rounded-md border border-border bg-card hover:bg-[#1a2235] transition-colors cursor-pointer px-3 py-2"
                    onClick={() => setSelectedEmailId(email.id)}
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${RISK_DOT[risk]}`} title={t(`junk.risk.${risk}`)} />
                    <div className="w-6 h-6 rounded-full bg-[#1e3a5f] flex items-center justify-center shrink-0">
                      <span className="text-primary font-semibold text-[10px]">{(email.sender || "?")[0].toUpperCase()}</span>
                    </div>
                    <span className="text-[12px] font-medium text-white truncate min-w-[120px] max-w-[200px]">{email.sender}</span>
                    <span className="text-[12px] text-[#8b9cb3] truncate flex-1">{email.subject}</span>
                    <span className="text-[10px] text-[#8b9cb3]/70 shrink-0 hidden sm:inline">
                      {format(new Date(email.createdAt), "d MMM", { locale: dateFnsLocale })}
                    </span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRestore(email.id); }}
                        className="p-1 rounded hover:bg-white/[0.08] text-[#8b9cb3] hover:text-white"
                        title={t("junk.restore")}
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleBlock(email); }}
                        className="p-1 rounded hover:bg-amber-500/[0.12] text-[#8b9cb3] hover:text-amber-300"
                        title={t("junk.blockSender")}
                        disabled={blockSender.isPending}
                      >
                        <ShieldX className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(email.id); }}
                        className="p-1 rounded hover:bg-red-500/[0.12] text-[#8b9cb3] hover:text-red-400"
                        title={t("junk.permanentDelete")}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <AlertDialog open={emptyConfirmOpen} onOpenChange={setEmptyConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("junk.emptyConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("junk.emptyConfirmBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleEmpty} className="bg-red-500 hover:bg-red-500/90">
              {emptySpam.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : t("junk.empty")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
