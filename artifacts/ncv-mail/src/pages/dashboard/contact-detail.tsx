import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { BackToInboxButton } from "@/components/dashboard/back-to-inbox-button";
import { format, formatDistanceToNow } from "date-fns";
import { fr, enUS, nl, de, es } from "date-fns/locale";
import {
  ArrowLeft,
  Mail,
  CheckSquare,
  CalendarDays,
  FolderKanban,
  MessageSquare,
  Paperclip,
  Inbox as InboxIcon,
  Send,
  ChevronRight,
  ChevronDown,
  Sparkles,
  Users,
  Lock,
  ShieldAlert,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useGetContact,
  useGetInboriaContext,
  getGetInboriaContextQueryKey,
  useGetMyOrganisation,
} from "@workspace/api-client-react";
import type { InboriaFact, InboriaEpisode } from "@workspace/api-client-react";
import { AttachmentList } from "@/components/AttachmentList";

const LOCALE_MAP: Record<string, any> = { fr, en: enUS, nl, de, es };

function Section({
  icon: Icon,
  title,
  count,
  children,
  empty,
  sectionKey,
  defaultOpen = true,
}: {
  icon: any;
  title: string;
  count: number;
  children: React.ReactNode;
  empty: string;
  sectionKey: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="bg-[#0f1620] border-[#1f2937] p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 w-full text-left hover:opacity-80 transition-opacity"
        aria-expanded={open}
        data-testid={`toggle-section-${sectionKey}`}
      >
        <Icon className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        <Badge variant="outline" className="ml-auto text-xs">
          {count}
        </Badge>
        {open ? (
          <ChevronDown className="w-4 h-4 text-[#8b9cb3]" />
        ) : (
          <ChevronRight className="w-4 h-4 text-[#8b9cb3]" />
        )}
      </button>
      {open && (
        <div className="mt-3" data-testid={`content-section-${sectionKey}`}>
          {count === 0 ? <div className="text-xs text-[#8b9cb3] py-3 text-center">{empty}</div> : children}
        </div>
      )}
    </Card>
  );
}

export default function ContactDetailPage() {
  const { t, i18n } = useTranslation();
  const dateLocale = LOCALE_MAP[i18n.language?.slice(0, 2)] || fr;
  const params = useParams<{ email: string }>();
  const [, setLocation] = useLocation();
  const email = decodeURIComponent(params.email || "");

  // Task #176 — Vue dossier équipe (admin org).
  const { data: myOrg } = useGetMyOrganisation();
  const isOrgAdmin = (myOrg as any)?.myRole === "admin";
  const [teamView, setTeamView] = useState(false);
  const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");

  // Self view stays always-enabled so the page header + toggle + orange RGPD
  // banner remain visible even if the team-scope query fails.
  const selfQuery = useGetContact(encodeURIComponent(email), {
    query: { enabled: !!email } as any,
  });
  const teamQuery = useQuery({
    queryKey: ["contact", email, "team"],
    enabled: !!email && teamView && isOrgAdmin,
    queryFn: async () => {
      const res = await fetch(
        `${baseUrl}/api/contacts/${encodeURIComponent(email)}?scope=team`,
        { credentials: "include" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw Object.assign(new Error(body?.error || "Erreur"), {
          response: { status: res.status },
        });
      }
      return res.json();
    },
  });
  // Team data wins when available AND not currently in error; otherwise we
  // fall back to self data so the contact card and conversations list keep
  // rendering. Strict fallback: if the latest team fetch errored we always
  // show self data even when stale team data is still in cache.
  const detail: any =
    teamView && teamQuery.data && !teamQuery.isError
      ? teamQuery.data
      : selfQuery.data || null;
  const isLoading = !detail && (selfQuery.isLoading || (teamView && teamQuery.isLoading));
  const isError = !detail && (selfQuery.isError || (teamView && teamQuery.isError));
  const error = (selfQuery.isError ? selfQuery.error : teamQuery.error) as any;
  const teamLoadError = teamView && teamQuery.isError;
  const teamLoadErrorMessage = (teamQuery.error as any)?.message ?? null;

  const inboriaParams = { contactEmail: email, limit: 12 };
  const inboriaQuery = useGetInboriaContext(inboriaParams, {
    query: {
      queryKey: getGetInboriaContextQueryKey(inboriaParams),
      enabled: !!email && email.includes("@"),
    },
  });
  const inboriaFacts: InboriaFact[] = (inboriaQuery.data as any)?.facts ?? [];
  const inboriaEpisodes: InboriaEpisode[] = (inboriaQuery.data as any)?.episodes ?? [];
  const inboriaCount = inboriaFacts.length + inboriaEpisodes.length;

  const factKindLabel = (kind: string): string => {
    switch (kind) {
      case "preference":
        return t("inboria.kindPreference", "préférence");
      case "topic":
        return t("inboria.kindTopic", "sujet");
      case "role":
        return t("inboria.kindRole", "rôle");
      default:
        return kind;
    }
  };
  const episodeKindLabel = (kind: string): string => {
    switch (kind) {
      case "decision":
        return t("inboria.kindDecision", "décision");
      case "commitment":
        return t("inboria.kindCommitment", "engagement");
      default:
        return kind;
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="p-6 max-w-5xl mx-auto space-y-4">
          <Skeleton className="h-20 w-full bg-[#1f2937]" />
          <Skeleton className="h-40 w-full bg-[#1f2937]" />
          <Skeleton className="h-40 w-full bg-[#1f2937]" />
        </div>
      </DashboardLayout>
    );
  }

  if (isError || !detail) {
    const status = (error as any)?.response?.status;
    return (
      <DashboardLayout>
        <div className="p-6 max-w-5xl mx-auto" data-testid="contact-not-found">
          <button
            onClick={() => setLocation("/dashboard/contacts")}
            className="flex items-center gap-2 text-sm text-[#8b9cb3] hover:text-white mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            {t("contacts.backToList", "Retour aux contacts")}
          </button>
          <div className="text-center py-16 text-[#8b9cb3]">
            <Mail className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p>{status === 404 ? t("contacts.notFound", "Contact introuvable") : t("contacts.loadError", "Erreur de chargement")}</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const c = detail.contact;
  const conversations = detail.conversations || [];
  const tasks = detail.tasks || [];
  const appointments = detail.appointments || [];
  const projects = detail.projects || [];
  const comments = detail.comments || [];
  const attachments = detail.attachments || [];

  return (
    <DashboardLayout>
      <div className="p-6 max-w-5xl mx-auto" data-testid="page-contact-detail">
        <BackToInboxButton />
        <button
          onClick={() => setLocation("/dashboard/contacts")}
          className="flex items-center gap-2 text-sm text-[#8b9cb3] hover:text-white mb-4"
          data-testid="button-back-contacts"
        >
          <ArrowLeft className="w-4 h-4" />
          {t("contacts.backToList", "Retour aux contacts")}
        </button>

        <Card className="bg-[#0f1620] border-[#1f2937] p-5 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xl font-semibold">
              {(c.name || c.email || "?")[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-semibold text-white truncate" data-testid="text-contact-name">{c.name}</h1>
              <a
                href={`mailto:${c.email}`}
                className="text-sm text-[#8b9cb3] hover:text-primary truncate block"
                data-testid="text-contact-email"
              >
                {c.email}
              </a>
              <div className="text-xs text-[#8b9cb3] mt-1">
                {t("contacts.relationshipSince", "Première interaction")} :{" "}
                {format(new Date(c.firstSeenAt), "PPP", { locale: dateLocale })} ·{" "}
                {t("contacts.lastInteraction", "Dernière interaction")} :{" "}
                {formatDistanceToNow(new Date(c.lastSeenAt), { addSuffix: true, locale: dateLocale })}
              </div>
            </div>
            <div className="text-right text-xs text-[#8b9cb3]">
              <div className="text-2xl font-semibold text-white">{c.totalCount}</div>
              <div>{t("contacts.exchanges", "échanges")}</div>
            </div>
          </div>
        </Card>

        {isOrgAdmin && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <button
                type="button"
                onClick={() => setTeamView(false)}
                className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
                  !teamView
                    ? "bg-primary/15 border-primary/40 text-primary"
                    : "bg-[#0f1620] border-[#1f2937] text-[#8b9cb3] hover:text-white"
                }`}
                data-testid="button-view-mine"
              >
                {t("contacts.viewMine", "Mon dossier")}
              </button>
              <button
                type="button"
                onClick={() => setTeamView(true)}
                className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors flex items-center gap-1.5 ${
                  teamView
                    ? "bg-amber-500/15 border-amber-500/40 text-amber-200"
                    : "bg-[#0f1620] border-[#1f2937] text-[#8b9cb3] hover:text-white"
                }`}
                data-testid="button-view-team"
              >
                <Users className="w-3.5 h-3.5" />
                {t("contacts.viewTeam", "Vue dossier équipe")}
              </button>
            </div>
            {teamView && (
              <div
                className="flex items-start gap-2 p-3 rounded border border-amber-500/30 bg-amber-500/5 text-xs text-amber-100"
                data-testid="banner-rgpd"
              >
                <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-medium mb-0.5">
                    {t("contacts.rgpdTitle", "Vous consultez le dossier équipe de ce contact")}
                  </div>
                  <div className="text-amber-100/80">
                    {t(
                      "contacts.rgpdBody",
                      "Vous voyez les échanges de tous vos coéquipiers avec ce contact (utile en cas d'absence ou de turn-over). Les emails marqués « privés » par leur propriétaire sont automatiquement masqués. Cette consultation est tracée et visible par les coéquipiers concernés.",
                    )}
                  </div>
                </div>
              </div>
            )}
            {teamLoadError && (
              <div
                className="mt-2 flex items-start gap-2 p-3 rounded border border-red-500/30 bg-red-500/10 text-xs text-red-200"
                data-testid="banner-team-load-error"
              >
                <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-medium mb-0.5">
                    {t("contacts.teamLoadErrorTitle", "Vue équipe indisponible")}
                  </div>
                  <div className="text-red-200/80">
                    {t(
                      "contacts.teamLoadErrorBody",
                      "Affichage de votre dossier personnel à la place. Détail : ",
                    )}
                    <span className="font-mono opacity-70">{teamLoadErrorMessage || "—"}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {email?.includes("@") && (
          <div className="lg:col-span-2">
            <Section
              icon={Sparkles}
              sectionKey="inboria"
              title={t("inboria.sectionTitle", "Ce qu'Inboria a noté")}
              count={inboriaCount}
              empty={
                inboriaQuery.isLoading
                  ? t("inboria.loading", "Inboria analyse vos échanges…")
                  : t(
                      "inboria.empty",
                      "Inboria n'a encore rien noté sur ce contact. Les observations apparaîtront au fur et à mesure des échanges.",
                    )
              }
            >
              <div className="space-y-4">
                {inboriaFacts.length > 0 && (
                  <div>
                    <div className="text-xs uppercase tracking-wide text-[#8b9cb3] mb-2">
                      {t("inboria.factsLabel", "Inboria a remarqué")}
                    </div>
                    <ul className="space-y-2">
                      {inboriaFacts.map((f) => (
                        <li
                          key={f.id}
                          className="flex items-start gap-2 p-2.5 rounded bg-[#0b1118] border border-[#1f2937]"
                          data-testid={`item-inboria-fact-${f.id}`}
                        >
                          <Sparkles className="w-3.5 h-3.5 text-primary mt-1 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1.5 py-0 h-4 border-[#2d7dd2]/40 text-[#9ab8df]"
                              >
                                {factKindLabel(f.kind)}
                              </Badge>
                              <span className="text-sm text-white">{f.statement}</span>
                            </div>
                            <div className="text-[10px] text-[#8b9cb3] mt-1 flex items-center gap-2">
                              {f.source.sentAt && (
                                <span>
                                  {t("inboria.extractedAt", "noté")}{" "}
                                  {formatDistanceToNow(new Date(f.source.sentAt), {
                                    addSuffix: true,
                                    locale: dateLocale,
                                  })}
                                </span>
                              )}
                              {f.source?.emailId && (
                                <Link
                                  href={`/dashboard?emailId=${f.source.emailId}`}
                                  className="text-primary hover:underline truncate"
                                  data-testid={`link-inboria-fact-source-${f.id}`}
                                >
                                  {t("inboria.viewSource", "Voir l'email source")}
                                  {f.source.subject ? ` — ${f.source.subject}` : ""}
                                </Link>
                              )}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {inboriaEpisodes.length > 0 && (
                  <div>
                    <div className="text-xs uppercase tracking-wide text-[#8b9cb3] mb-2">
                      {t("inboria.episodesLabel", "Inboria suggère")}
                    </div>
                    <ul className="space-y-2">
                      {inboriaEpisodes.map((e) => (
                        <li
                          key={e.id}
                          className="flex items-start gap-2 p-2.5 rounded bg-[#0b1118] border border-[#1f2937]"
                          data-testid={`item-inboria-episode-${e.id}`}
                        >
                          <CalendarDays className="w-3.5 h-3.5 text-primary mt-1 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1.5 py-0 h-4 border-amber-500/40 text-amber-300"
                              >
                                {episodeKindLabel(e.kind)}
                              </Badge>
                              <span className="text-sm text-white">{e.summary}</span>
                            </div>
                            <div className="text-[10px] text-[#8b9cb3] mt-1 flex items-center gap-2">
                              {e.eventDate && (
                                <span>
                                  {t("inboria.eventDate", "le")}{" "}
                                  {format(new Date(e.eventDate), "PPP", { locale: dateLocale })}
                                </span>
                              )}
                              {e.source?.emailId && (
                                <Link
                                  href={`/dashboard?emailId=${e.source.emailId}`}
                                  className="text-primary hover:underline truncate"
                                  data-testid={`link-inboria-episode-source-${e.id}`}
                                >
                                  {t("inboria.viewSource", "Voir l'email source")}
                                  {e.source.subject ? ` — ${e.source.subject}` : ""}
                                </Link>
                              )}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </Section>
          </div>
          )}

          <Section
            icon={Mail}
            sectionKey="conversations"
            title={t("contacts.conversations", "Conversations")}
            count={conversations.length}
            empty={t("contacts.noConversations", "Aucun échange")}
          >
            <ul className="space-y-1 max-h-96 overflow-y-auto pr-1">
              {conversations.map((conv: any) => (
                <li key={conv.threadKey || conv.id}>
                  <Link
                    href={`/dashboard?emailId=${conv.id}`}
                    className="flex items-start gap-2 p-2 rounded hover:bg-[#1a2332] transition-colors group"
                    data-testid={`link-conversation-${conv.id}`}
                  >
                    {conv.direction === "outbound" ? (
                      <Send className="w-3.5 h-3.5 text-blue-400 mt-0.5 flex-shrink-0" />
                    ) : (
                      <InboxIcon className="w-3.5 h-3.5 text-green-400 mt-0.5 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="text-sm text-white truncate flex-1">{conv.subject}</div>
                        {conv.messageCount > 1 && (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 flex-shrink-0">
                            {conv.messageCount}
                          </Badge>
                        )}
                      </div>
                      {conv.summary && <div className="text-xs text-[#8b9cb3] truncate">{conv.summary}</div>}
                      <div className="text-[10px] text-[#8b9cb3] mt-0.5">
                        {format(new Date(conv.createdAt), "Pp", { locale: dateLocale })}
                        {conv.projectName && (
                          <span className="ml-2 text-primary">· {conv.projectName}</span>
                        )}
                        {teamView && conv.handledByName && (
                          <span className="ml-2 text-amber-200" data-testid={`text-handled-by-${conv.id}`}>
                            · {t("contacts.handledBy", "Traité par")} {conv.handledByName}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-[#8b9cb3] opacity-0 group-hover:opacity-100 mt-1" />
                  </Link>
                </li>
              ))}
            </ul>
          </Section>

          <Section
            icon={CheckSquare}
            sectionKey="tasks"
            title={t("contacts.tasks", "Tâches liées")}
            count={tasks.length}
            empty={t("contacts.noTasks", "Aucune tâche")}
          >
            <ul className="space-y-2">
              {tasks.map((task: any) => (
                <li
                  key={task.id}
                  className="flex items-start gap-2 text-sm"
                  data-testid={`item-task-${task.id}`}
                >
                  <CheckSquare className={`w-3.5 h-3.5 mt-1 flex-shrink-0 ${task.done ? "text-green-400" : "text-[#8b9cb3]"}`} />
                  <div className="flex-1 min-w-0">
                    <div className={`truncate ${task.done ? "line-through text-[#8b9cb3]" : "text-white"}`}>
                      {task.title}
                    </div>
                    {task.dueDate && (
                      <div className="text-xs text-[#8b9cb3]">
                        {t("contacts.dueDate", "Échéance")} : {format(new Date(task.dueDate), "PPP", { locale: dateLocale })}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Section>

          <Section
            icon={CalendarDays}
            sectionKey="appointments"
            title={t("contacts.appointments", "Rendez-vous")}
            count={appointments.length}
            empty={t("contacts.noAppointments", "Aucun rendez-vous")}
          >
            <ul className="space-y-2">
              {appointments.map((appt: any) => (
                <li key={appt.id} className="text-sm" data-testid={`item-appointment-${appt.id}`}>
                  <div className="text-white truncate">{appt.title}</div>
                  <div className="text-xs text-[#8b9cb3]">
                    {format(new Date(appt.startAt), "PPp", { locale: dateLocale })}
                    {appt.location && <span className="ml-2">· {appt.location}</span>}
                  </div>
                </li>
              ))}
            </ul>
          </Section>

          <Section
            icon={FolderKanban}
            sectionKey="projects"
            title={t("contacts.projects", "Projets")}
            count={projects.length}
            empty={t("contacts.noProjects", "Aucun projet")}
          >
            <ul className="space-y-2">
              {projects.map((p: any) => (
                <li key={p.id} className="text-sm text-white" data-testid={`item-project-${p.id}`}>
                  {p.name}
                  {p.reference && <span className="text-xs text-[#8b9cb3] ml-2">({p.reference})</span>}
                </li>
              ))}
            </ul>
          </Section>

          <Section
            icon={MessageSquare}
            sectionKey="comments"
            title={t("contacts.comments", "Notes internes")}
            count={comments.length}
            empty={t("contacts.noComments", "Aucune note")}
            defaultOpen={false}
          >
            <ul className="space-y-2">
              {comments.map((cm: any) => (
                <li key={cm.id} className="text-sm border-l-2 border-primary/40 pl-2" data-testid={`item-comment-${cm.id}`}>
                  <div className="text-white">{cm.body}</div>
                  <div className="text-xs text-[#8b9cb3]">
                    {cm.authorName || t("contacts.unknownAuthor", "Inconnu")} ·{" "}
                    {formatDistanceToNow(new Date(cm.createdAt), { addSuffix: true, locale: dateLocale })}
                    {cm.emailSubject && <span className="ml-1">· {cm.emailSubject}</span>}
                  </div>
                </li>
              ))}
            </ul>
          </Section>

          <Section
            icon={Paperclip}
            sectionKey="attachments"
            title={t("contacts.attachments", "Pièces jointes")}
            count={attachments.length}
            empty={t("contacts.noAttachments", "Aucune pièce jointe")}
            defaultOpen={false}
          >
            <AttachmentList
              attachments={attachments.map((a: any) => ({
                id: String(a.id),
                filename: a.filename,
                content_type: a.contentType || "application/octet-stream",
                size: a.size || 0,
              })) as any}
            />
          </Section>
        </div>
      </div>
    </DashboardLayout>
  );
}
