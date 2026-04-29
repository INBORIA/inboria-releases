import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams, useLocation } from "wouter";
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
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetContact } from "@workspace/api-client-react";
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

  const { data, isLoading, isError, error } = useGetContact(encodeURIComponent(email));
  const detail = data as any;

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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
