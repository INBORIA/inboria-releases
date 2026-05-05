import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { fr, enUS, nl, de, es, it, pt, pl, ro, sv, da, fi, hu, cs, tr, ja, ko, vi, th, id, ms } from "date-fns/locale";
import {
  ArrowLeft,
  ShieldCheck,
  ShieldAlert,
  Lock,
  LockOpen,
  Eye,
  Loader2,
  Inbox,
  User,
  Users,
  ListTree,
  MessageSquare,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

const LOCALE_MAP: Record<string, any> = { fr, en: enUS, nl, de, es, it, pt, pl, ro, sv, da, fi, hu, cs, tr, ja, ko, vi, th, id, ms };

type LogEntry = {
  id: number;
  adminUserId: string;
  adminName: string;
  adminEmail?: string;
  targetUserId?: string | null;
  targetName?: string;
  targetEmail?: string;
  targetType: string;
  targetValue: string | null;
  emailsSeenCount: number;
  action: string;
  createdAt: string;
};

type PrivateEmail = {
  id: number;
  sender: string;
  subject: string;
  createdAt: string;
};

const TARGET_ICON: Record<string, any> = {
  inbox_overview: Inbox,
  member_inbox: User,
  member: Users,
  contact: MessageSquare,
  contact_list: ListTree,
  inboria_chat: MessageSquare,
};

export default function ParametresViePrivee() {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? i18n.language.split("-")[0];
  const dateLocale = LOCALE_MAP[lang] || fr;
  const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [unmarkingId, setUnmarkingId] = useState<number | null>(null);

  const logQuery = useQuery({
    queryKey: ["privacy", "team-access-log", "mine"],
    queryFn: async () => {
      const res = await fetch(`${baseUrl}/api/admin/team-access-log?scope=mine`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("log");
      return res.json() as Promise<{ entries: LogEntry[] }>;
    },
  });

  // Org-wide journal — admin only. Backend returns 403 for non-admins; we
  // gate the query so non-admins don't see a spurious failure.
  const orgQuery = useQuery({
    queryKey: ["privacy", "team-access-log", "org"],
    queryFn: async () => {
      const res = await fetch(`${baseUrl}/api/admin/team-access-log?scope=org&limit=100`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("org-log");
      return res.json() as Promise<{ entries: LogEntry[] }>;
    },
    retry: false,
  });
  const isOrgAdmin = !orgQuery.isError && Array.isArray(orgQuery.data?.entries);

  const privateQuery = useQuery({
    queryKey: ["privacy", "private-emails"],
    queryFn: async () => {
      const res = await fetch(`${baseUrl}/api/me/private-emails`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("private");
      return res.json() as Promise<{ entries: PrivateEmail[] }>;
    },
  });

  async function unmarkPrivate(emailId: number) {
    setUnmarkingId(emailId);
    try {
      const res = await fetch(`${baseUrl}/api/emails/${emailId}/private`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPrivate: false }),
      });
      if (!res.ok) throw new Error("unmark");
      await queryClient.invalidateQueries({ queryKey: ["privacy", "private-emails"] });
      toast({
        title: t("privacy.unmarkedTitle", "Email rendu visible"),
        description: t(
          "privacy.unmarkedDesc",
          "Cet email redevient visible pour vos admins (vue dossier équipe + Inboria).",
        ),
      });
    } catch {
      toast({
        title: t("common.error", "Erreur"),
        description: t("privacy.unmarkError", "Impossible de mettre à jour cet email."),
        variant: "destructive",
      });
    } finally {
      setUnmarkingId(null);
    }
  }

  function describeAction(e: LogEntry): string {
    const who = e.adminName || t("privacy.anAdmin", "Un administrateur");
    switch (e.action) {
      case "view_member_inbox":
        return t("privacy.action.viewMemberInbox", "{{who}} a consulté votre boîte de réception", { who });
      case "view_contact_team":
        return t("privacy.action.viewContactTeam", "{{who}} a consulté un dossier contact (vue équipe) — {{n}} email(s) visibles", {
          who,
          n: e.emailsSeenCount,
        });
      case "view_contact_list_team":
        return t("privacy.action.viewContactListTeam", "{{who}} a consulté la liste des contacts (vue équipe)", { who });
      case "view_inboria_team":
        return t("privacy.action.viewInboriaTeam", "{{who}} a posé une question à Inboria en mode équipe — {{n}} email(s) lus", {
          who,
          n: e.emailsSeenCount,
        });
      default:
        return t("privacy.action.generic", "{{who}} a effectué une consultation administrateur ({{action}})", {
          who,
          action: e.action,
        });
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-5">
        <div className="mb-2">
          <Link href="/dashboard/parametres">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[#b8c5d6] hover:text-white"
              data-testid="back-to-settings"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" /> {t("settings.title", "Paramètres")}
            </Button>
          </Link>
        </div>

        <div className="mb-6 flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-[18px] font-semibold text-white tracking-tight">
              {t("privacy.title", "Vie privée et accès équipe")}
            </h1>
            <p className="text-[12px] text-[#b8c5d6] mt-0.5 max-w-2xl">
              {t(
                "privacy.subtitle",
                "Vos emails restent les vôtres. Les administrateurs de votre organisation peuvent ouvrir un « dossier équipe » par contact (utile en cas d'absence ou de turn-over) — vous voyez ici quand cela arrive et vous pouvez masquer un email à tout moment.",
              )}
            </p>
          </div>
        </div>

        {/* Section 1 — How it works */}
        <Card className="bg-[#0f1620] border-[#1f2937] p-4 mb-6">
          <div className="flex items-start gap-2 text-[12px] text-[#cbd5e1]">
            <ShieldAlert className="w-4 h-4 mt-0.5 text-amber-300 shrink-0" />
            <div>
              <div className="font-medium text-white mb-1">
                {t("privacy.howTitle", "Ce que vos admins peuvent voir — et pas voir")}
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-[#b8c5d6]">
                <li>
                  {t(
                    "privacy.how1",
                    "Vos admins peuvent ouvrir un dossier contact en « vue équipe » et voir les échanges de l'org avec ce contact (continuité de service).",
                  )}
                </li>
                <li>
                  {t(
                    "privacy.how2",
                    "Les emails que vous marquez « privés » sont automatiquement masqués dans la vue équipe et dans Inboria côté admin.",
                  )}
                </li>
                <li>
                  {t(
                    "privacy.how3",
                    "Chaque consultation admin est tracée et apparaît ci-dessous. Le journal est immuable.",
                  )}
                </li>
              </ul>
            </div>
          </div>
        </Card>

        {/* Section 2 — Private emails */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Lock className="w-4 h-4 text-amber-300" />
            <h2 className="text-[14px] font-semibold text-white">
              {t("privacy.privateTitle", "Mes emails privés")}
            </h2>
          </div>
          <Card className="bg-[#0f1620] border-[#1f2937]">
            {privateQuery.isLoading ? (
              <div className="p-4 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ) : privateQuery.data?.entries?.length ? (
              <ul className="divide-y divide-[#1f2937]">
                {privateQuery.data.entries.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-center gap-3 p-3"
                    data-testid={`private-email-${e.id}`}
                  >
                    <Lock className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] text-white truncate">{e.subject || "(Sans objet)"}</div>
                      <div className="text-[11px] text-[#b8c5d6] truncate">
                        {e.sender} · {format(new Date(e.createdAt), "Pp", { locale: dateLocale })}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 h-7 text-[11px] bg-transparent border-border text-[#b8c5d6] hover:text-white"
                      disabled={unmarkingId === e.id}
                      onClick={() => unmarkPrivate(e.id)}
                      data-testid={`button-unmark-${e.id}`}
                    >
                      {unmarkingId === e.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <LockOpen className="w-3 h-3" />
                      )}
                      {t("privacy.unmark", "Rendre visible")}
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-4 text-[12px] text-[#b8c5d6]">
                {t(
                  "privacy.privateEmpty",
                  "Aucun email marqué privé pour l'instant. Vous pouvez en marquer un depuis sa fiche email (bouton « Marquer privé »).",
                )}
              </div>
            )}
          </Card>
        </div>

        {/* Section 3 — Access log */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Eye className="w-4 h-4 text-primary" />
            <h2 className="text-[14px] font-semibold text-white">
              {t("privacy.logTitle", "Journal des consultations admin vous concernant")}
            </h2>
          </div>
          <Card className="bg-[#0f1620] border-[#1f2937]">
            {logQuery.isLoading ? (
              <div className="p-4 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ) : logQuery.data?.entries?.length ? (
              <ul className="divide-y divide-[#1f2937]">
                {logQuery.data.entries.map((e) => {
                  const Icon = TARGET_ICON[e.targetType] || Eye;
                  return (
                    <li
                      key={e.id}
                      className="flex items-start gap-3 p-3"
                      data-testid={`log-entry-${e.id}`}
                    >
                      <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                        <Icon className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] text-white">{describeAction(e)}</div>
                        <div className="text-[11px] text-[#b8c5d6] mt-0.5">
                          {formatDistanceToNow(new Date(e.createdAt), { addSuffix: true, locale: dateLocale })}
                          {e.targetValue && (
                            <span className="ml-2 text-[#b8c5d6]/80">· {e.targetValue}</span>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="p-4 text-[12px] text-[#b8c5d6]">
                {t(
                  "privacy.logEmpty",
                  "Aucune consultation admin vous concernant pour l'instant.",
                )}
              </div>
            )}
          </Card>
        </div>

        {/* Section 4 — Admin org-wide journal (admin org only) */}
        {isOrgAdmin && (
          <div className="mb-6" data-testid="admin-org-journal-section">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-primary" />
              <h2 className="text-[14px] font-semibold text-white">
                {t("privacy.orgLogTitle", "Journal des consultations admin (toute l'organisation)")}
              </h2>
            </div>
            <p className="text-[12px] text-[#b8c5d6] mb-2">
              {t(
                "privacy.orgLogSubtitle",
                "En tant qu'administrateur, vous voyez ici l'ensemble des consultations « vue équipe » faites par tous les admins de votre organisation, avec l'admin et le coéquipier concerné.",
              )}
            </p>
            <Card className="bg-[#0f1620] border-[#1f2937]">
              {orgQuery.isLoading ? (
                <div className="p-4 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ) : orgQuery.data?.entries?.length ? (
                <ul className="divide-y divide-[#1f2937]">
                  {orgQuery.data.entries.map((e) => {
                    const Icon = TARGET_ICON[e.targetType] || Eye;
                    const adminLabel =
                      e.adminName || e.adminEmail || t("privacy.anAdmin", "Un administrateur");
                    const targetLabel =
                      e.targetName ||
                      e.targetEmail ||
                      e.targetValue ||
                      (e.targetType === "inbox_overview"
                        ? t("privacy.targetOrgWide", "Toute l'organisation")
                        : t("privacy.targetUnknown", "Cible inconnue"));
                    return (
                      <li
                        key={e.id}
                        className="flex items-start gap-3 p-3"
                        data-testid={`org-log-entry-${e.id}`}
                      >
                        <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                          <Icon className="w-3.5 h-3.5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] text-white">
                            {t("privacy.orgLogLine", "{{admin}} → {{target}}", {
                              admin: adminLabel,
                              target: targetLabel,
                            })}
                          </div>
                          <div className="text-[11px] text-[#b8c5d6] mt-0.5">
                            <span>{describeAction(e)}</span>
                            <span className="mx-1.5">·</span>
                            <span>
                              {formatDistanceToNow(new Date(e.createdAt), {
                                addSuffix: true,
                                locale: dateLocale,
                              })}
                            </span>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="p-4 text-[12px] text-[#b8c5d6]">
                  {t(
                    "privacy.orgLogEmpty",
                    "Aucune consultation admin enregistrée dans votre organisation pour l'instant.",
                  )}
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
