import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { EmailBodyRenderer } from "@/components/EmailBodyRenderer";
import { EmailComments } from "@/components/email-comments";
import { AttachmentList, AttachmentBadge } from "@/components/AttachmentList";
import { FileAttachInput, type UploadedFile } from "@/components/FileAttachInput";
import {
  useListEmails,
  useGetCategoryCounts,
  useUpdateEmail,
  useDeleteEmail,
  useSendEmail,
  useGenerateDraft,
  getListEmailsQueryKey,
  useGetDashboardSummary,
  useTriageEmail,
  getGetDashboardSummaryQueryKey,
  getGetCategoryCountsQueryKey,
  getGetInboxHealthQueryKey,
  useListProjects,
  useGetProfile,
  useRecategorizeUncategorized,
  useBulkUpdateEmails,
  useGetMyOrganisation,
  useGetOrganisationMembers,
  useAssignEmail,
  useUnassignEmail,
  useGetSharedMailboxes,
  useGetSharedMailboxEmails,
  useClaimSharedEmail,
  useUnclaimSharedEmail,
  useCreateTask,
  getListTasksQueryKey,
  useCreateFollowup,
  getListFollowupsQueryKey,
  getGetFollowupStatsQueryKey,
} from "@workspace/api-client-react";
import type { Email, PaginatedEmails, PaginatedSharedMailboxEmails } from "@workspace/api-client-react";
import { useTranslation } from 'react-i18next';
import { translateCategoryName } from "@/lib/category-translations";
import { format } from "date-fns";
import { fr, enUS, nl } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { Clock, CheckCircle2, Sparkles, Inbox, ArrowLeft, Reply, Archive, X, ChevronRight, Trash2, RefreshCw, Search, PenSquare, Send, Wand2, Loader2, Zap, CheckCircle, Tags, Check, CheckSquare, Square, UserPlus, UserX, Users, Hand, HandMetal, ListTodo, Eye, CalendarDays, Download } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const PRIORITY_BAR_COLORS: Record<string, string> = {
  urgent: "bg-red-500",
  moyen: "bg-amber-500",
  faible: "bg-emerald-500",
};

const PRIORITY_BADGE_STYLES: Record<string, { bg: string; text: string; border: string; labelKey: string }> = {
  urgent: { bg: "bg-red-500/15", text: "text-red-400", border: "border-red-500/20", labelKey: "inbox.priorities.urgent" },
  moyen: { bg: "bg-amber-500/15", text: "text-amber-400", border: "border-amber-500/20", labelKey: "inbox.priorities.medium" },
  faible: { bg: "bg-emerald-500/15", text: "text-emerald-400", border: "border-emerald-500/20", labelKey: "inbox.priorities.low" },
};

function PriorityBadge({ priority }: { priority: string }) {
  const { t } = useTranslation();
  const ps = PRIORITY_BADGE_STYLES[priority] || PRIORITY_BADGE_STYLES.faible;
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium border ${ps.bg} ${ps.text} ${ps.border}`}>
      {t(ps.labelKey)}
    </span>
  );
}

function EmailRow({ email, onClick, onArchive, onCategoryClick, isSelected, onToggleSelect, selectionMode }: { email: any; onClick: () => void; onArchive: (id: number) => void; onCategoryClick?: (name: string) => void; isSelected: boolean; onToggleSelect: (id: number) => void; selectionMode: boolean }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? i18n.language.split("-")[0];
  const dateFnsLocale = i18n.language === "nl" ? nl : i18n.language === "en" ? enUS : fr;
  const barColor = PRIORITY_BAR_COLORS[email.priority] || PRIORITY_BAR_COLORS.faible;

  return (
    <div
      className={`group flex items-stretch rounded-lg border bg-card hover:bg-[#1a2235] transition-colors cursor-pointer overflow-hidden ${isSelected ? "border-primary/50 bg-primary/[0.06]" : "border-border"}`}
      onClick={onClick}
    >
      <div className={`w-1 shrink-0 ${barColor}`} />
      <div className="flex items-start gap-3 flex-1 min-w-0 p-3">
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 transition-all ${selectionMode || isSelected ? "bg-transparent border-2 border-primary/40 hover:border-primary" : "bg-primary/20"}`}
          onClick={(e) => { e.stopPropagation(); onToggleSelect(email.id); }}
        >
          {selectionMode || isSelected ? (
            <div className={`w-4 h-4 rounded-sm border-2 flex items-center justify-center transition-colors ${isSelected ? "bg-primary border-primary" : "border-[#8b9cb3]/40 hover:border-primary"}`}>
              {isSelected && <Check className="w-3 h-3 text-white" />}
            </div>
          ) : (
            <span className="text-primary font-semibold text-[12px]">{(email.sender || "?")[0].toUpperCase()}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-semibold text-[12px] text-white truncate">{email.sender}</span>
            {email.status === "unread" && (
              <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
            )}
          </div>
          <h3 className="text-[12px] text-white/80 truncate">{email.subject}</h3>
          {email.summary && (
            <div className="flex items-center gap-1 mt-0.5">
              <Sparkles className="w-3 h-3 text-primary shrink-0" />
              <p className="text-[11px] text-[#8b9cb3] line-clamp-1">{email.summary}</p>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 self-center">
          {email.categoryName && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-blue-500/15 text-blue-400 border border-blue-500/20 hidden sm:inline-flex hover:bg-blue-500/25 transition-colors"
              onClick={(e) => { e.stopPropagation(); onCategoryClick?.(email.categoryName); }}
            >
              {translateCategoryName(email.categoryName, lang)}
            </span>
          )}
          {email.projectReference && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-purple-500/15 text-purple-400 border border-purple-500/20 hidden sm:inline-flex">
              {email.projectReference}
            </span>
          )}
          {(email.attachmentCount ?? 0) > 0 && (
            <AttachmentBadge count={email.attachmentCount} />
          )}
          {(email.taskCount ?? 0) > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-cyan-500/15 text-cyan-400 border border-cyan-500/20 hidden sm:inline-flex items-center gap-1">
              <ListTodo className="w-2.5 h-2.5" />
              {email.taskCount}
            </span>
          )}
          {email.assignedTo && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 hidden sm:inline-flex items-center gap-1">
              <UserPlus className="w-2.5 h-2.5" />
              {t("inbox.assignedBadge")}
            </span>
          )}
          <PriorityBadge priority={email.priority} />
          <span className="text-[10px] text-[#8b9cb3] whitespace-nowrap items-center gap-1 hidden sm:flex">
            <Clock className="w-3 h-3" />
            {format(new Date(email.createdAt), "d MMM HH:mm", { locale: dateFnsLocale })}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onArchive(email.id); }}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-white/[0.08] text-[#8b9cb3] hover:text-white"
            title={t("inbox.archive")}
          >
            <Archive className="w-3.5 h-3.5" />
          </button>
          <ChevronRight className="w-3.5 h-3.5 text-[#8b9cb3]/40 group-hover:text-[#8b9cb3] transition-colors" />
        </div>
      </div>
    </div>
  );
}

const triageSchema = z.object({
  sender: z.string().min(1, "Expéditeur requis"),
  subject: z.string().min(1, "Sujet requis"),
  body: z.string().min(1, "Contenu requis"),
});

function EmailDetail({ email, onBack, onMarkRead, onArchive, onDelete, onUpdatePriority, onUpdateCategory, onUpdateProject, onSendReply, isSending, onGenerateDraft, isDrafting, categories, projects, userSignature, currentUserId, orgMembers, onAssign, onUnassign, onCreateTask }: { email: any; onBack: () => void; onMarkRead: (id: number) => void; onArchive: (id: number) => void; onDelete: (id: number) => void; onUpdatePriority: (id: number, priority: string) => void; onUpdateCategory: (id: number, categoryId: string) => void; onUpdateProject: (id: number, projectId: string) => void; onSendReply: (to: string, subject: string, body: string, replyToEmailId?: number, attachments?: UploadedFile[]) => void; isSending: boolean; onGenerateDraft: (emailId: number, callback: (draft: string) => void) => void; isDrafting: boolean; categories: any[]; projects: any[]; userSignature?: string; currentUserId?: string; orgMembers?: any[]; onAssign?: (emailId: number, userId: string) => void; onUnassign?: (emailId: number) => void; onCreateTask?: (emailId: number, title: string, projectId?: string) => void }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? i18n.language.split("-")[0];
  const dateFnsLocale = i18n.language === "nl" ? nl : i18n.language === "en" ? enUS : fr;
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyAttachments, setReplyAttachments] = useState<UploadedFile[]>([]);
  const [replyTo, setReplyTo] = useState("");
  const [replySubject, setReplySubject] = useState("");
  const [replyText, setReplyText] = useState("");
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskProjectId, setTaskProjectId] = useState("none");
  const [followupFormOpen, setFollowupFormOpen] = useState(false);
  const [followupTitle, setFollowupTitle] = useState("");
  const [followupDueDate, setFollowupDueDate] = useState("");
  const [followupNotes, setFollowupNotes] = useState("");
  const [followupProjectId, setFollowupProjectId] = useState("none");
  const createFollowup = useCreateFollowup();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const barColor = PRIORITY_BAR_COLORS[email.priority] || PRIORITY_BAR_COLORS.faible;

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-10 flex items-center gap-3 mb-4 pb-2 pt-1 bg-[#0d1117]">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="h-7 px-2 text-[#8b9cb3] hover:text-white hover:bg-white/[0.06] text-[12px]"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1" />
          {t("common.back")}
        </Button>
        <div className="flex-1" />
        <PriorityBadge priority={email.priority} />
      </div>

      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="flex">
          <div className={`w-1 shrink-0 ${barColor}`} />
          <div className="flex-1 min-w-0">
            <div className="p-4 border-b border-border">
              <h2 className="text-[15px] font-semibold text-white mb-2.5">{email.subject}</h2>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-[12px]">
                    {(email.sender || "?")[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="text-[12px] font-medium text-white">{email.sender}</div>
                    {email.sender && email.sender !== email.sender.split("@")[0] && (
                      <div className="text-[10px] text-[#8b9cb3]">{email.sender}</div>
                    )}
                  </div>
                </div>
                <span className="text-[10px] text-[#8b9cb3] flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {format(new Date(email.createdAt), "d MMMM yyyy a HH:mm", { locale: dateFnsLocale })}
                </span>
              </div>
            </div>

            {email.summary && (
              <div className="px-4 py-2.5 bg-primary/[0.06] border-b border-border">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Sparkles className="w-3 h-3 text-primary" />
                  <span className="text-[10px] font-medium text-primary uppercase tracking-wider">{t("inbox.aiSummary")}</span>
                </div>
                <p className="text-[12px] text-[#8b9cb3] leading-relaxed">{email.summary}</p>
              </div>
            )}

            <div className="p-4">
              <EmailBodyRenderer body={email.body} />
              {email.attachments && email.attachments.length > 0 && (
                <AttachmentList attachments={email.attachments} />
              )}
            </div>

            <div className="px-4 py-3 border-t border-border">
              <div className="flex items-center gap-1.5 mb-2.5 flex-wrap">
                <Button
                  size="sm"
                  className="gap-1.5 h-7 text-[11px]"
                  onClick={() => {
                    if (!replyOpen) {
                      setReplyTo(email.sender || "");
                      setReplySubject(email.subject?.startsWith("Re:") ? email.subject : `Re: ${email.subject}`);
                      setReplyText(userSignature ? `\n\n${userSignature}` : "");
                    }
                    setReplyOpen(!replyOpen);
                  }}
                >
                  <Reply className="w-3 h-3" />
                  {t("inbox.reply")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 h-7 text-[11px] bg-transparent border-primary/30 text-primary hover:bg-primary/10 hover:text-primary"
                  disabled={isDrafting}
                  onClick={() => {
                    setReplyTo(email.sender || "");
                    setReplySubject(email.subject?.startsWith("Re:") ? email.subject : `Re: ${email.subject}`);
                    setReplyOpen(true);
                    onGenerateDraft(email.id, (draft) => {
                      setReplyText(draft);
                    });
                  }}
                >
                  {isDrafting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                  {isDrafting ? t("inbox.generating") : t("inbox.aiReply")}
                </Button>
                {email.status === "unread" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 h-7 text-[11px] bg-transparent border-border text-[#8b9cb3] hover:text-white hover:bg-white/[0.04]"
                    onClick={() => onMarkRead(email.id)}
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    {t("inbox.markRead")}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 h-7 text-[11px] bg-transparent border-border text-[#8b9cb3] hover:text-white hover:bg-white/[0.04]"
                  onClick={() => onArchive(email.id)}
                >
                  <Archive className="w-3 h-3" />
                  {t("inbox.archive")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 h-7 text-[11px] bg-transparent border-border text-red-400/70 hover:text-red-400 hover:bg-red-500/[0.08]"
                  onClick={() => onDelete(email.id)}
                >
                  <Trash2 className="w-3 h-3" />
                  {t("inbox.deleteEmail")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 h-7 text-[11px] bg-transparent border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 hover:text-cyan-300"
                  onClick={() => {
                    if (!taskFormOpen) {
                      setTaskTitle(`${t("inbox.handlePrefix")} ${email.subject}`);
                      setTaskProjectId(email.projectId || "none");
                    }
                    setTaskFormOpen(!taskFormOpen);
                  }}
                >
                  <ListTodo className="w-3 h-3" />
                  {t("inbox.createTask")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 h-7 text-[11px] bg-transparent border-amber-500/30 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300"
                  onClick={() => {
                    if (!followupFormOpen) {
                      setFollowupTitle(`${t("inbox.followPrefix")} ${email.subject}`);
                      setFollowupProjectId(email.projectId || "none");
                      setFollowupNotes("");
                      const defaultDate = new Date();
                      defaultDate.setDate(defaultDate.getDate() + 3);
                      setFollowupDueDate(defaultDate.toISOString().split("T")[0]);
                    }
                    setFollowupFormOpen(!followupFormOpen);
                  }}
                >
                  <Eye className="w-3 h-3" />
                  {t("inbox.follow")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 h-7 text-[11px] bg-transparent border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300"
                  onClick={async () => {
                    try {
                      const { supabase } = await import("@/lib/supabase");
                      const { data: sessionData } = await supabase.auth.getSession();
                      const token = sessionData?.session?.access_token || "";
                      const baseUrl = import.meta.env.VITE_API_URL || `https://${window.location.host}`;
                      const resp = await fetch(`${baseUrl}/api/ai/extract-appointment`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                        body: JSON.stringify({ emailId: email.id }),
                      });
                      const extracted = resp.ok ? await resp.json() : null;
                      const params = new URLSearchParams();
                      params.set("title", extracted?.title || email.subject || "");
                      params.set("emailId", String(email.id));
                      params.set("participants", extracted?.participants || email.sender || "");
                      if (extracted?.location) params.set("location", extracted.location);
                      if (extracted?.description) params.set("description", extracted.description);
                      if (extracted?.startAt) params.set("startAt", extracted.startAt);
                      if (extracted?.endAt) params.set("endAt", extracted.endAt);
                      window.location.href = `/dashboard/agenda?create=1&${params.toString()}`;
                    } catch {
                      const params = new URLSearchParams();
                      params.set("title", email.subject || "");
                      params.set("emailId", String(email.id));
                      if (email.sender) params.set("participants", email.sender);
                      window.location.href = `/dashboard/agenda?create=1&${params.toString()}`;
                    }
                  }}
                >
                  <CalendarDays className="w-3 h-3" />
                  {t("agenda.createFromEmail")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 h-7 text-[11px] bg-transparent border-border text-[#8b9cb3] hover:text-white hover:bg-white/[0.04]"
                  onClick={async () => {
                    try {
                      const { downloadExport } = await import("@/lib/export-utils");
                      await downloadExport(`export/emails?id=${email.id}`, `email_${email.id}.csv`);
                      toast({ title: t("inbox.exportDownloaded") });
                    } catch {
                      toast({ title: t("inbox.exportError"), variant: "destructive" });
                    }
                  }}
                >
                  <Download className="w-3 h-3" />
                  {t("common.export")}
                </Button>
              </div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-[#8b9cb3] uppercase tracking-wider">{t("inbox.priority")}:</span>
                  <Select value={email.priority} onValueChange={(val) => onUpdatePriority(email.id, val)}>
                    <SelectTrigger className="w-[100px] h-6 bg-card border-border text-[11px] text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="urgent">{t("inbox.priorities.urgent")}</SelectItem>
                      <SelectItem value="moyen">{t("inbox.priorities.medium")}</SelectItem>
                      <SelectItem value="faible">{t("inbox.priorities.low")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-[#8b9cb3] uppercase tracking-wider">{t("inbox.category")}:</span>
                  <Select value={email.categoryId?.toString() || "none"} onValueChange={(val) => onUpdateCategory(email.id, val)}>
                    <SelectTrigger className="w-[130px] h-6 bg-card border-border text-[11px] text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="none">{t("inbox.uncategorized")}</SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat.categoryId} value={cat.categoryId.toString()}>{translateCategoryName(cat.categoryName, lang)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-[#8b9cb3] uppercase tracking-wider">{t("inbox.project")}:</span>
                  <Select value={email.projectId || "none"} onValueChange={(val) => onUpdateProject(email.id, val)}>
                    <SelectTrigger className="w-[140px] h-6 bg-card border-border text-[11px] text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="none">{t("inbox.noProject")}</SelectItem>
                      {projects.map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>{p.reference} — {p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {orgMembers && orgMembers.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-[#8b9cb3] uppercase tracking-wider">{t("inbox.assignedTo")}:</span>
                    <Select
                      value={email.assignedTo || "none"}
                      onValueChange={(val) => {
                        if (val === "none") {
                          onUnassign?.(email.id);
                        } else {
                          onAssign?.(email.id, val);
                        }
                      }}
                    >
                      <SelectTrigger className="w-[150px] h-6 bg-card border-border text-[11px] text-white">
                        <SelectValue placeholder={t("inbox.notAssigned")} />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border">
                        <SelectItem value="none">{t("inbox.notAssigned")}</SelectItem>
                        {orgMembers.map((m: any) => (
                          <SelectItem key={m.userId} value={m.userId}>
                            {m.fullName || m.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>

            <EmailComments emailId={email.id} currentUserId={currentUserId} />

            {taskFormOpen && (
              <div className="px-4 pb-4 border-t border-border pt-3 space-y-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <ListTodo className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-[11px] font-medium text-cyan-400 uppercase tracking-wider">{t("inbox.newTask")}</span>
                </div>
                <div>
                  <label className="text-[10px] text-[#8b9cb3] uppercase tracking-wider mb-1 block">{t("inbox.taskTitle")}</label>
                  <Input
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    placeholder={t("inbox.taskTitlePlaceholder")}
                    className="bg-background border-border text-white text-[12px] h-8"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#8b9cb3] uppercase tracking-wider mb-1 block">{t("inbox.taskProjectOptional")}</label>
                  <Select value={taskProjectId} onValueChange={setTaskProjectId}>
                    <SelectTrigger className="w-full h-8 bg-background border-border text-[12px] text-white">
                      <SelectValue placeholder={t("inbox.noProject")} />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="none">{t("inbox.noProject")}</SelectItem>
                      {projects.map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>{p.reference} — {p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2 justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setTaskFormOpen(false); setTaskTitle(""); setTaskProjectId("none"); }}
                    className="text-[#8b9cb3] hover:text-white h-7 text-[11px]"
                  >
                    {t("common.cancel")}
                  </Button>
                  <Button
                    size="sm"
                    className="gap-1.5 h-7 text-[11px]"
                    disabled={!taskTitle.trim()}
                    onClick={() => {
                      onCreateTask?.(email.id, taskTitle.trim(), taskProjectId !== "none" ? taskProjectId : undefined);
                      setTaskFormOpen(false);
                      setTaskTitle("");
                      setTaskProjectId("none");
                    }}
                  >
                    <ListTodo className="w-3 h-3" />
                    {t("followup.create")}
                  </Button>
                </div>
              </div>
            )}

            {followupFormOpen && (
              <div className="px-4 pb-4 border-t border-border pt-3 space-y-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <Eye className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-[11px] font-medium text-amber-400 uppercase tracking-wider">{t("inbox.newFollowup")}</span>
                </div>
                <div>
                  <label className="text-[10px] text-[#8b9cb3] uppercase tracking-wider mb-1 block">{t("inbox.followupTitle")}</label>
                  <Input
                    value={followupTitle}
                    onChange={(e) => setFollowupTitle(e.target.value)}
                    placeholder={t("inbox.followupTitlePlaceholder")}
                    className="bg-background border-border text-white text-[12px] h-8"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#8b9cb3] uppercase tracking-wider mb-1 block">{t("inbox.followupDueDate")}</label>
                  <Input
                    type="date"
                    value={followupDueDate}
                    onChange={(e) => setFollowupDueDate(e.target.value)}
                    className="bg-background border-border text-white text-[12px] h-8"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#8b9cb3] uppercase tracking-wider mb-1 block">{t("inbox.taskProjectOptional")}</label>
                  <Select value={followupProjectId} onValueChange={setFollowupProjectId}>
                    <SelectTrigger className="w-full h-8 bg-background border-border text-[12px] text-white">
                      <SelectValue placeholder={t("inbox.noProject")} />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="none">{t("inbox.noProject")}</SelectItem>
                      {projects.map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>{p.reference} — {p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[10px] text-[#8b9cb3] uppercase tracking-wider mb-1 block">{t("inbox.followupNotes")}</label>
                  <Textarea
                    value={followupNotes}
                    onChange={(e) => setFollowupNotes(e.target.value)}
                    placeholder={t("inbox.followupNotesPlaceholder")}
                    className="bg-background border-border text-white text-[12px] h-16 resize-none"
                  />
                </div>
                <div className="flex items-center gap-2 justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setFollowupFormOpen(false); setFollowupTitle(""); setFollowupDueDate(""); setFollowupNotes(""); setFollowupProjectId("none"); }}
                    className="text-[#8b9cb3] hover:text-white h-7 text-[11px]"
                  >
                    {t("common.cancel")}
                  </Button>
                  <Button
                    size="sm"
                    className="gap-1.5 h-7 text-[11px] bg-amber-600 hover:bg-amber-700"
                    disabled={!followupTitle.trim() || createFollowup.isPending}
                    onClick={() => {
                      createFollowup.mutate(
                        {
                          data: {
                            title: followupTitle.trim(),
                            emailId: email.id,
                            dueDate: followupDueDate || undefined,
                            notes: followupNotes || undefined,
                            projectId: followupProjectId !== "none" ? followupProjectId : undefined,
                          } as any,
                        },
                        {
                          onSuccess: () => {
                            queryClient.invalidateQueries({ queryKey: getListFollowupsQueryKey() });
                            queryClient.invalidateQueries({ queryKey: getGetFollowupStatsQueryKey() });
                            toast({ title: t("inbox.followupCreated") });
                            setFollowupFormOpen(false);
                            setFollowupTitle("");
                            setFollowupDueDate("");
                            setFollowupNotes("");
                            setFollowupProjectId("none");
                          },
                          onError: () => {
                            toast({ title: t("inbox.followupCreateError"), variant: "destructive" });
                          },
                        }
                      );
                    }}
                  >
                    {createFollowup.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Eye className="w-3 h-3" />}
                    {t("followup.create")}
                  </Button>
                </div>
              </div>
            )}

            {replyOpen && (
              <div className="px-4 pb-4 border-t border-border pt-3 space-y-2.5">
                <div>
                  <label className="text-[10px] text-[#8b9cb3] uppercase tracking-wider mb-1 block">{t("inbox.replyTo")}</label>
                  <Input
                    value={replyTo}
                    onChange={(e) => setReplyTo(e.target.value)}
                    placeholder="email@exemple.com"
                    className="bg-background border-border text-white text-[12px] h-8"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#8b9cb3] uppercase tracking-wider mb-1 block">{t("inbox.subject")}</label>
                  <Input
                    value={replySubject}
                    onChange={(e) => setReplySubject(e.target.value)}
                    placeholder={t("inbox.subject")}
                    className="bg-background border-border text-white text-[12px] h-8"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#8b9cb3] uppercase tracking-wider mb-1 block">{t("inbox.message")}</label>
                  <Textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder={t("inbox.replyPlaceholder")}
                    className="h-24 bg-background border-border text-white text-[12px] resize-none"
                  />
                </div>
                <div className="flex items-center gap-2 justify-between">
                  <FileAttachInput files={replyAttachments} onChange={setReplyAttachments} />
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setReplyOpen(false); setReplyText(""); setReplyTo(""); setReplySubject(""); setReplyAttachments([]); }}
                      className="text-[#8b9cb3] hover:text-white h-7 text-[11px]"
                    >
                      {t("common.cancel")}
                    </Button>
                    <Button
                      size="sm"
                      className="gap-1.5 h-7 text-[11px]"
                      disabled={isSending || !replyTo.trim() || !replySubject.trim() || !replyText.trim()}
                      onClick={() => {
                        onSendReply(replyTo, replySubject, replyText, email.id, replyAttachments);
                        setReplyText("");
                        setReplyTo("");
                        setReplySubject("");
                        setReplyAttachments([]);
                        setReplyOpen(false);
                      }}
                    >
                      <Send className="w-3 h-3" />
                      {isSending ? t("inbox.sending") : t("inbox.send")}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-start mt-4">
        <Button
          variant="outline"
          size="sm"
          onClick={onBack}
          className="gap-1.5 h-8 text-[12px] bg-transparent border-border text-[#8b9cb3] hover:text-white hover:bg-white/[0.06]"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {t("common.back")}
        </Button>
      </div>
    </div>
  );
}

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

type InboxMode = "personal" | "shared";

export default function Dashboard() {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? i18n.language.split("-")[0];
  const dateFnsLocale = i18n.language === "nl" ? nl : i18n.language === "en" ? enUS : fr;
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [isSimulateOpen, setIsSimulateOpen] = useState(false);
  const [selectedEmailId, setSelectedEmailId] = useState<number | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const searchQuery = useDebounce(searchInput, 300);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [inboxMode, setInboxMode] = useState<InboxMode>("personal");
  const [selectedSharedMailboxId, setSelectedSharedMailboxId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const { data: categoryCounts, isLoading: categoriesLoading } = useGetCategoryCounts();
  const { data: summary, isLoading: summaryLoading } = useGetDashboardSummary();
  const { data: projects } = useListProjects();
  const { data: profile } = useGetProfile();

  const { data: myOrg } = useGetMyOrganisation();
  const { data: orgMembers } = useGetOrganisationMembers({ query: { enabled: !!(myOrg as any)?.id } });
  const assignEmailMut = useAssignEmail();
  const unassignEmailMut = useUnassignEmail();

  const plan = (profile as any)?.plan;
  const { data: sharedMailboxes } = useGetSharedMailboxes({ query: { enabled: plan === "business" } });
  const [sharedPage, setSharedPage] = useState(1);
  const [accumulatedSharedEmails, setAccumulatedSharedEmails] = useState<PaginatedSharedMailboxEmails["emails"]>([]);
  const { data: sharedEmailsData, isLoading: sharedEmailsLoading, isFetching: sharedFetching } = useGetSharedMailboxEmails(
    selectedSharedMailboxId || "",
    { page: sharedPage, limit: 50 },
    { query: { enabled: !!selectedSharedMailboxId && inboxMode === "shared" } }
  );
  const sharedPaged = sharedEmailsData as PaginatedSharedMailboxEmails | undefined;
  const sharedHasMore = sharedPaged ? sharedPage < (sharedPaged.totalPages ?? 1) : false;

  useEffect(() => {
    if (sharedPaged) {
      if (sharedPage === 1) {
        setAccumulatedSharedEmails(sharedPaged.emails || []);
      } else {
        setAccumulatedSharedEmails((prev) => {
          const existingIds = new Set(prev.map((e) => e.id));
          const unique = (sharedPaged.emails || []).filter((e) => !existingIds.has(e.id));
          return [...prev, ...unique];
        });
      }
    }
  }, [sharedPaged, sharedPage]);

  useEffect(() => {
    setSharedPage(1);
    setAccumulatedSharedEmails([]);
  }, [selectedSharedMailboxId]);

  const loadMoreShared = useCallback(() => {
    if (sharedHasMore && !sharedFetching) {
      setSharedPage((p) => p + 1);
    }
  }, [sharedHasMore, sharedFetching]);

  const sharedEmailsList = accumulatedSharedEmails;
  const claimEmailMut = useClaimSharedEmail();
  const unclaimEmailMut = useUnclaimSharedEmail();

  const selectedCategoryId = filterCategory !== "all"
    ? categoryCounts?.find((c) => c.categoryName === filterCategory)?.categoryId
    : undefined;

  const [emailPage, setEmailPage] = useState(1);
  const [accumulatedEmails, setAccumulatedEmails] = useState<Email[]>([]);
  const [totalEmails, setTotalEmails] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const prevFilterKey = useRef("");
  const currentFilterKey = `${filterPriority}|${searchQuery}|${filterCategory}`;
  useEffect(() => {
    if (prevFilterKey.current !== currentFilterKey) {
      prevFilterKey.current = currentFilterKey;
      setEmailPage(1);
      setAccumulatedEmails([]);
    }
  }, [currentFilterKey]);

  const { data: emailsData, isLoading: emailsLoading, isFetching: emailsFetching } = useListEmails({
    priority: filterPriority !== "all" ? (filterPriority as "urgent" | "moyen" | "faible") : undefined,
    categoryId: selectedCategoryId,
    q: searchQuery || undefined,
    page: emailPage,
    limit: 50,
  });

  useEffect(() => {
    if (emailsData) {
      const paged = emailsData as PaginatedEmails;
      const newEmails = paged.emails || [];
      setTotalEmails(paged.total || 0);
      setTotalPages(paged.totalPages || 0);
      if (emailPage === 1) {
        setAccumulatedEmails(newEmails);
      } else {
        setAccumulatedEmails((prev) => {
          const existingIds = new Set(prev.map((e) => e.id));
          const unique = newEmails.filter((e) => !existingIds.has(e.id));
          return [...prev, ...unique];
        });
      }
    }
  }, [emailsData, emailPage]);

  const emails = accumulatedEmails;
  const hasMorePages = emailPage < totalPages;

  const updateEmail = useUpdateEmail();
  const deleteEmail = useDeleteEmail();
  const triageEmail = useTriageEmail();
  const sendEmailMut = useSendEmail();
  const generateDraftMut = useGenerateDraft();
  const recategorizeMut = useRecategorizeUncategorized();
  const bulkUpdateMut = useBulkUpdateEmails();
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [composeAttachments, setComposeAttachments] = useState<UploadedFile[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const activeEmails = emails
    ?.sort((a, b) => {
      const pOrder: Record<string, number> = { urgent: 0, moyen: 1, faible: 2 };
      return (pOrder[a.priority] ?? 2) - (pOrder[b.priority] ?? 2);
    });
  const selectedEmail = emails?.find((e) => e.id === selectedEmailId);

  const loadMoreRef = useRef<HTMLDivElement>(null);
  const loadMore = useCallback(() => {
    if (hasMorePages && !emailsFetching) {
      setEmailPage((p) => p + 1);
    }
  }, [hasMorePages, emailsFetching]);

  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  const selectionMode = selectedIds.size > 0;

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!activeEmails) return;
    if (selectedIds.size === activeEmails.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(activeEmails.map((e) => e.id)));
    }
  };

  const handleBulkAction = (action: "delete" | "archive" | "read") => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    bulkUpdateMut.mutate(
      { data: { ids, action } },
      {
        onSuccess: (result) => {
          setSelectedIds(new Set());
          invalidateAll();
          const labels: Record<string, string> = { delete: t("inbox.bulkDeleted", { count: result.affected }), archive: t("inbox.bulkArchived", { count: result.affected }), read: t("inbox.bulkRead", { count: result.affected }) };
          toast({ title: labels[action] });
        },
        onError: () => {
          toast({ variant: "destructive", title: t("common.error") });
        },
      }
    );
  };

  const invalidateAll = () => {
    setEmailPage(1);
    setAccumulatedEmails([]);
    queryClient.invalidateQueries({ queryKey: getListEmailsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetCategoryCountsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetInboxHealthQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
  };

  const handleMarkAsRead = (id: number) => {
    updateEmail.mutate(
      { id, data: { status: "read" } },
      { onSuccess: invalidateAll }
    );
  };

  const handleArchive = (id: number) => {
    updateEmail.mutate(
      { id, data: { status: "archived" } },
      {
        onSuccess: () => {
          setSelectedEmailId(null);
          invalidateAll();
          toast({ title: t("inbox.emailArchived") });
        },
      }
    );
  };

  const handleDelete = (id: number) => {
    deleteEmail.mutate(
      { id },
      {
        onSuccess: () => {
          setSelectedEmailId(null);
          invalidateAll();
          toast({ title: t("inbox.emailDeleted") });
        },
        onError: () => {
          toast({ variant: "destructive", title: t("common.error"), description: t("inbox.sendError") });
        },
      }
    );
  };

  const handleUpdatePriority = (id: number, priority: string) => {
    updateEmail.mutate(
      { id, data: { priority } },
      {
        onSuccess: () => {
          invalidateAll();
          toast({ title: t("inbox.priorityChanged") });
        },
      }
    );
  };

  const handleUpdateCategory = (id: number, categoryId: string) => {
    updateEmail.mutate(
      { id, data: { categoryId: categoryId === "none" ? null : parseInt(categoryId) } },
      {
        onSuccess: () => {
          invalidateAll();
          toast({ title: t("inbox.categoryUpdated") });
        },
      }
    );
  };

  const handleUpdateProject = (id: number, projectId: string) => {
    updateEmail.mutate(
      { id, data: { projectId: projectId === "none" ? null : projectId } as any },
      {
        onSuccess: () => {
          invalidateAll();
          toast({ title: t("inbox.projectUpdated") });
        },
      }
    );
  };

  const handleAssign = (emailId: number, userId: string) => {
    assignEmailMut.mutate(
      { emailId, data: { assignTo: userId } },
      {
        onSuccess: (result) => {
          invalidateAll();
          toast({ title: t("inbox.assignSuccess"), description: `${(result as any).assignedToName || ""}` });
        },
        onError: () => {
          toast({ variant: "destructive", title: t("common.error") });
        },
      }
    );
  };

  const handleUnassign = (emailId: number) => {
    unassignEmailMut.mutate(
      { emailId },
      {
        onSuccess: () => {
          invalidateAll();
          toast({ title: t("inbox.unassignSuccess") });
        },
        onError: () => {
          toast({ variant: "destructive", title: t("common.error") });
        },
      }
    );
  };

  const createTaskMut = useCreateTask();
  const handleCreateTask = (emailId: number, title: string, projectId?: string) => {
    createTaskMut.mutate(
      { data: { title, emailId, projectId: projectId || null } },
      {
        onSuccess: () => {
          if (projectId) {
            updateEmail.mutate(
              { id: emailId, data: { projectId } },
              { onSuccess: () => invalidateAll() }
            );
          } else {
            invalidateAll();
          }
          queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
          toast({ title: t("inbox.taskCreated") });
        },
        onError: () => {
          toast({ variant: "destructive", title: t("common.error"), description: t("inbox.taskCreateError") });
        },
      }
    );
  };

  const handleSendReply = (to: string, subject: string, body: string, replyToEmailId?: number, attachments?: UploadedFile[]) => {
    const uploadIds = attachments?.map((a) => a.uploadId).filter(Boolean);
    sendEmailMut.mutate(
      { data: { to, subject, body, replyToEmailId: replyToEmailId ?? null, attachments: uploadIds && uploadIds.length > 0 ? uploadIds : undefined } },
      {
        onSuccess: () => {
          invalidateAll();
          toast({ title: t("inbox.emailSent") });
        },
        onError: (err: any) => {
          const msg = err?.data?.error || err?.message || t("inbox.sendError");
          toast({ variant: "destructive", title: t("common.error"), description: msg });
        },
      }
    );
  };

  const handleComposeSend = () => {
    if (!composeTo.trim() || !composeSubject.trim() || !composeBody.trim()) return;
    sendEmailMut.mutate(
      { data: { to: composeTo, subject: composeSubject, body: composeBody, replyToEmailId: null, attachments: composeAttachments.length > 0 ? composeAttachments.map((a) => a.uploadId) : undefined } },
      {
        onSuccess: () => {
          invalidateAll();
          setIsComposeOpen(false);
          setComposeTo("");
          setComposeSubject("");
          setComposeBody("");
          setComposeAttachments([]);
          toast({ title: t("inbox.emailSent") });
        },
        onError: (err: any) => {
          const msg = err?.data?.error || err?.message || t("inbox.sendError");
          toast({ variant: "destructive", title: t("common.error"), description: msg });
        },
      }
    );
  };

  const handleGenerateDraft = (emailId: number, callback: (draft: string) => void) => {
    generateDraftMut.mutate(
      { data: { emailId } },
      {
        onSuccess: (data) => {
          callback(data.draft);
          toast({ title: t("inbox.draftGenerated") });
        },
        onError: () => {
          toast({ title: t("inbox.draftError") });
        },
      }
    );
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const { supabase } = await import("@/lib/supabase");
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const res = await fetch(`${import.meta.env.BASE_URL}api/email/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await res.json();
      if (res.ok) {
        invalidateAll();
        toast({ title: t("inbox.emailSent"), description: `${data.synced || 0}` });
      } else {
        toast({ variant: "destructive", title: t("common.error"), description: data.error });
      }
    } catch {
      toast({ variant: "destructive", title: t("common.error") });
    } finally {
      setIsSyncing(false);
    }
  };

  const form = useForm<z.infer<typeof triageSchema>>({
    resolver: zodResolver(triageSchema),
    defaultValues: { sender: "", subject: "", body: "" },
  });

  const onSubmitTriage = (data: z.infer<typeof triageSchema>) => {
    triageEmail.mutate(
      { data: { ...data, lang } },
      {
        onSuccess: (result) => {
          queryClient.invalidateQueries({ queryKey: getListEmailsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetCategoryCountsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetInboxHealthQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          setIsSimulateOpen(false);
          form.reset();
          toast({ 
            title: t("inbox.triageSuccess"), 
            description: `${result.priority} — ${result.category}` 
          });
        },
        onError: () => {
          toast({ variant: "destructive", title: t("common.error") });
        }
      }
    );
  };

  const handleClaimEmail = (emailId: number) => {
    claimEmailMut.mutate(
      { emailId: emailId.toString() },
      {
        onSuccess: () => {
          queryClient.invalidateQueries();
          toast({ title: t("inbox.claim") });
        },
        onError: () => {
          toast({ variant: "destructive", title: t("common.error") });
        },
      }
    );
  };

  const handleUnclaimEmail = (emailId: number) => {
    unclaimEmailMut.mutate(
      { emailId: emailId.toString() },
      {
        onSuccess: () => {
          queryClient.invalidateQueries();
          toast({ title: t("inbox.unclaim") });
        },
        onError: () => {
          toast({ variant: "destructive", title: t("common.error") });
        },
      }
    );
  };

  const hasSharedMailboxes = plan === "business" && sharedMailboxes && (sharedMailboxes as any[]).length > 0;

  if (selectedEmail) {
    return (
      <DashboardLayout>
        <div className="p-5 max-w-[900px] mx-auto w-full">
          <EmailDetail
            email={selectedEmail}
            onBack={() => setSelectedEmailId(null)}
            onMarkRead={handleMarkAsRead}
            onArchive={handleArchive}
            onDelete={handleDelete}
            onUpdatePriority={handleUpdatePriority}
            onUpdateCategory={handleUpdateCategory}
            onUpdateProject={handleUpdateProject}
            onSendReply={handleSendReply}
            isSending={sendEmailMut.isPending}
            onGenerateDraft={handleGenerateDraft}
            isDrafting={generateDraftMut.isPending}
            categories={categoryCounts || []}
            projects={projects || []}
            userSignature={(profile as any)?.signature || ""}
            currentUserId={(profile as any)?.id}
            orgMembers={(orgMembers as any[]) || []}
            onAssign={handleAssign}
            onUnassign={handleUnassign}
            onCreateTask={handleCreateTask}
          />
        </div>
      </DashboardLayout>
    );
  }

  const displayedEmailCount = activeEmails?.length || 0;
  const autopilotActive = displayedEmailCount > 0;

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full">
        <div className="px-5 pt-4 pb-2.5 border-b border-border">
          <div className="flex items-center gap-2 mb-2.5 max-w-[1200px] mx-auto">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8b9cb3]" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={t("inbox.searchPlaceholder")}
                className="pl-9 bg-card border-border text-white placeholder:text-[#8b9cb3]/50 h-8 text-[12px]"
              />
              {searchInput && (
                <button
                  onClick={() => setSearchInput("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8b9cb3] hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-all ${
              autopilotActive
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : "border-[#1f2937] bg-card text-[#8b9cb3]"
            }`}>
              {autopilotActive ? (
                <CheckCircle className="w-3 h-3" />
              ) : (
                <Zap className="w-3 h-3" />
              )}
              <span className="hidden sm:inline">Autopilot</span>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-8 text-[11px] bg-transparent border-border text-[#8b9cb3] hover:text-white hover:bg-white/[0.04]"
              onClick={handleSync}
              disabled={isSyncing}
            >
              <RefreshCw className={`w-3 h-3 ${isSyncing ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">{isSyncing ? t("inbox.refreshing") : t("inbox.refresh")}</span>
            </Button>

            <Dialog open={isComposeOpen} onOpenChange={(open) => { setIsComposeOpen(open); if (!open) { setComposeTo(""); setComposeSubject(""); setComposeBody(""); } }}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5 h-8 text-[11px]">
                  <PenSquare className="w-3 h-3" />
                  <span className="hidden sm:inline">{t("inbox.newEmail")}</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border">
                <DialogHeader>
                  <DialogTitle className="text-white text-[14px]">{t("inbox.composeTitle")}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] text-[#8b9cb3] mb-1 block">{t("inbox.to")}</label>
                    <Input value={composeTo} onChange={(e) => setComposeTo(e.target.value)} placeholder="email@exemple.com" className="bg-background border-border text-white text-[12px] h-8" />
                  </div>
                  <div>
                    <label className="text-[11px] text-[#8b9cb3] mb-1 block">{t("inbox.subject")}</label>
                    <Input value={composeSubject} onChange={(e) => setComposeSubject(e.target.value)} placeholder={t("inbox.subject")} className="bg-background border-border text-white text-[12px] h-8" />
                  </div>
                  <div>
                    <label className="text-[11px] text-[#8b9cb3] mb-1 block">{t("inbox.message")}</label>
                    <Textarea value={composeBody} onChange={(e) => setComposeBody(e.target.value)} placeholder={t("inbox.message")} className="h-32 bg-background border-border text-white text-[12px]" />
                  </div>
                  <FileAttachInput files={composeAttachments} onChange={setComposeAttachments} />
                  <Button
                    className="w-full gap-2 h-8 text-[12px]"
                    disabled={sendEmailMut.isPending || !composeTo.trim() || !composeSubject.trim() || !composeBody.trim()}
                    onClick={handleComposeSend}
                  >
                    <Send className="w-3.5 h-3.5" />
                    {sendEmailMut.isPending ? t("inbox.sending") : t("inbox.send")}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={isSimulateOpen} onOpenChange={setIsSimulateOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="hidden sm:flex gap-1.5 h-8 text-[11px] bg-transparent border-border text-[#8b9cb3] hover:text-white hover:bg-white/[0.04]">
                  <Sparkles className="w-3 h-3 text-primary" />
                  {t("inbox.quickTriage")}
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border">
                <DialogHeader>
                  <DialogTitle className="text-white text-[14px]">{t("inbox.quickTriage")}</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmitTriage)} className="space-y-3">
                    <FormField
                      control={form.control}
                      name="sender"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[#8b9cb3] text-[11px]">{t("inbox.sender")}</FormLabel>
                          <FormControl><Input placeholder="client@entreprise.com" className="bg-background border-border text-white text-[12px] h-8" {...field} /></FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="subject"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[#8b9cb3] text-[11px]">{t("inbox.subject")}</FormLabel>
                          <FormControl><Input placeholder={t("inbox.subject")} className="bg-background border-border text-white text-[12px] h-8" {...field} /></FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="body"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[#8b9cb3] text-[11px]">{t("inbox.message")}</FormLabel>
                          <FormControl><Textarea className="h-28 bg-background border-border text-white text-[12px]" placeholder={t("inbox.message")} {...field} /></FormControl>
                        </FormItem>
                      )}
                    />
                    <Button type="submit" className="w-full h-8 text-[12px]" disabled={triageEmail.isPending}>
                      {triageEmail.isPending ? t("inbox.generating") : t("inbox.send")}
                    </Button>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          {hasSharedMailboxes && (
            <div className="flex items-center gap-1 max-w-[1200px] mx-auto mb-1.5">
              <button
                onClick={() => { setInboxMode("personal"); setSelectedSharedMailboxId(null); }}
                className={`flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-md font-medium transition-colors ${
                  inboxMode === "personal"
                    ? "bg-primary/15 text-primary border border-primary/20"
                    : "text-[#8b9cb3] border border-[#1f2937] hover:text-white hover:border-[#8b9cb3]/30"
                }`}
              >
                <Inbox className="w-3 h-3" />
                {t("inbox.title")}
              </button>
              <button
                onClick={() => {
                  setInboxMode("shared");
                  const mbs = sharedMailboxes as any[];
                  if (mbs?.length > 0 && !selectedSharedMailboxId) {
                    setSelectedSharedMailboxId(mbs[0].id);
                  }
                }}
                className={`flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-md font-medium transition-colors ${
                  inboxMode === "shared"
                    ? "bg-primary/15 text-primary border border-primary/20"
                    : "text-[#8b9cb3] border border-[#1f2937] hover:text-white hover:border-[#8b9cb3]/30"
                }`}
              >
                <Users className="w-3 h-3" />
                {t("inbox.sharedMailbox")}
              </button>
              {inboxMode === "shared" && (sharedMailboxes as any[])?.length > 1 && (
                <Select value={selectedSharedMailboxId || ""} onValueChange={setSelectedSharedMailboxId}>
                  <SelectTrigger className="w-auto min-w-[120px] h-6 bg-card border-border text-[#8b9cb3] text-[10px] ml-1">
                    <SelectValue placeholder={t("inbox.sharedMailbox")} />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {(sharedMailboxes as any[])?.map((mb: any) => (
                      <SelectItem key={mb.id} value={mb.id}>{mb.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          <div className="flex items-center gap-1.5 max-w-[1200px] mx-auto">
            <span className="text-[10px] text-[#8b9cb3] mr-1">{t("inbox.priority")}:</span>
            {[
              { value: "all", label: t("inbox.allCategories") },
              { value: "urgent", label: t("inbox.priorities.urgent") },
              { value: "moyen", label: t("inbox.priorities.medium") },
              { value: "faible", label: t("inbox.priorities.low") },
            ].map((f) => (
              <button
                key={f.value}
                onClick={() => setFilterPriority(f.value)}
                className={`text-[10px] px-2 py-0.5 rounded-md font-medium transition-colors ${
                  filterPriority === f.value
                    ? "bg-primary/15 text-primary border border-primary/20"
                    : "text-[#8b9cb3] border border-[#1f2937] hover:text-white hover:border-[#8b9cb3]/30"
                }`}
              >
                {f.label}
              </button>
            ))}
            <div className="w-px h-4 bg-[#1f2937] mx-1" />
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-auto min-w-[130px] h-6 bg-card border-border text-[#8b9cb3] text-[10px]">
                <SelectValue placeholder={t("inbox.category")} />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="all">{t("inbox.allCategories")}</SelectItem>
                {categoryCounts?.map((cat) => (
                  <SelectItem key={cat.categoryId} value={cat.categoryName}>{translateCategoryName(cat.categoryName, lang)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <div className="p-5 max-w-[1200px] mx-auto flex flex-col lg:flex-row gap-5">
            <div className="flex-1 min-w-0">
              {inboxMode === "shared" ? (
                <>
                  {sharedEmailsLoading ? (
                    Array(3).fill(0).map((_, i) => (
                      <div key={i} className="bg-card rounded-lg border border-border p-3 mb-1">
                        <Skeleton className="h-4 w-3/4 mb-2 bg-white/5" />
                        <Skeleton className="h-3 w-1/2 bg-white/5" />
                      </div>
                    ))
                  ) : !selectedSharedMailboxId ? (
                    <div className="text-center py-14 rounded-lg border border-border border-dashed bg-card/50">
                      <Users className="mx-auto h-8 w-8 text-[#8b9cb3]/40 mb-2" />
                      <h3 className="text-[13px] font-medium text-white">{t("inbox.sharedMailbox")}</h3>
                    </div>
                  ) : sharedEmailsList.length === 0 ? (
                    <div className="text-center py-14 rounded-lg border border-border border-dashed bg-card/50">
                      <Inbox className="mx-auto h-8 w-8 text-[#8b9cb3]/40 mb-2" />
                      <h3 className="text-[13px] font-medium text-white">{t("inbox.noEmails")}</h3>
                      <p className="text-[12px] text-[#8b9cb3] mt-1">{t("inbox.noEmailsDesc")}</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {sharedEmailsList.map((email) => {
                        const isClaimed = !!email.claimedBy;
                        const isClaimedByMe = email.claimedBy === (profile as any)?.id;
                        return (
                          <div
                            key={email.id}
                            className="group flex items-stretch rounded-lg border bg-card hover:bg-[#1a2235] transition-colors overflow-hidden border-border"
                          >
                            <div className={`w-1 shrink-0 ${PRIORITY_BAR_COLORS[email.priority] || PRIORITY_BAR_COLORS.faible}`} />
                            <div className="flex items-start gap-3 flex-1 min-w-0 p-3">
                              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 bg-primary/20">
                                <span className="text-primary font-semibold text-[12px]">{(email.sender || "?")[0].toUpperCase()}</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className="font-semibold text-[12px] text-white truncate">{email.sender}</span>
                                  <PriorityBadge priority={email.priority} />
                                  {isClaimed && (
                                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${isClaimedByMe ? "bg-primary/15 text-primary" : "bg-white/[0.06] text-[#8b9cb3]"}`}>
                                      {isClaimedByMe ? t("inbox.claimedBy") : t("inbox.claim")}
                                    </span>
                                  )}
                                </div>
                                <h3 className="text-[12px] text-white/80 truncate">{email.subject}</h3>
                                {email.summary && (
                                  <div className="flex items-center gap-1 mt-0.5">
                                    <Sparkles className="w-3 h-3 text-primary shrink-0" />
                                    <p className="text-[11px] text-[#8b9cb3] line-clamp-1">{email.summary}</p>
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {!isClaimed ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="gap-1 h-7 text-[10px] bg-transparent border-border text-primary hover:text-white hover:bg-primary/10"
                                    onClick={() => handleClaimEmail(email.id)}
                                    disabled={claimEmailMut.isPending}
                                  >
                                    <UserPlus className="w-3 h-3" />
                                    {t("inbox.claim")}
                                  </Button>
                                ) : isClaimedByMe ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="gap-1 h-7 text-[10px] bg-transparent border-border text-[#8b9cb3] hover:text-white hover:bg-white/[0.04]"
                                    onClick={() => handleUnclaimEmail(email.id)}
                                    disabled={unclaimEmailMut.isPending}
                                  >
                                    <UserX className="w-3 h-3" />
                                    {t("inbox.unclaim")}
                                  </Button>
                                ) : null}
                                <span className="text-[10px] text-[#8b9cb3] ml-1">
                                  {email.createdAt ? format(new Date(email.createdAt), "dd MMM HH:mm", { locale: dateFnsLocale }) : ""}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {sharedHasMore && (
                        <div className="flex items-center justify-center py-4">
                          <button
                            onClick={loadMoreShared}
                            disabled={sharedFetching}
                            className="text-[11px] text-primary hover:text-white transition-colors px-3 py-1.5 rounded-md border border-primary/20 hover:border-primary/40 disabled:opacity-50"
                          >
                            {sharedFetching ? t("common.loading") : t("inbox.loadMore")}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                      <div className="text-[10px] font-medium text-red-400 uppercase tracking-wider mb-0.5">{t("inbox.priorities.urgentPlural")}</div>
                      <div className="text-xl font-bold text-white">
                        {summaryLoading ? <Skeleton className="h-6 w-8 bg-white/5" /> : summary?.urgentCount || 0}
                      </div>
                    </div>
                    <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                      <div className="text-[10px] font-medium text-amber-400 uppercase tracking-wider mb-0.5">{t("inbox.priorities.mediumPlural")}</div>
                      <div className="text-xl font-bold text-white">
                        {summaryLoading ? <Skeleton className="h-6 w-8 bg-white/5" /> : summary?.moyenCount || 0}
                      </div>
                    </div>
                    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                      <div className="text-[10px] font-medium text-emerald-400 uppercase tracking-wider mb-0.5">{t("inbox.priorities.lowPlural")}</div>
                      <div className="text-xl font-bold text-white">
                        {summaryLoading ? <Skeleton className="h-6 w-8 bg-white/5" /> : summary?.faibleCount || 0}
                      </div>
                    </div>
                  </div>

                  {selectionMode && (
                    <div className="flex items-center gap-2 mb-2 p-2.5 rounded-lg bg-primary/[0.08] border border-primary/20">
                      <button
                        onClick={toggleSelectAll}
                        className="flex items-center gap-1.5 text-[11px] text-primary hover:text-white transition-colors"
                      >
                        {selectedIds.size === (activeEmails?.length || 0) ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                        {selectedIds.size === (activeEmails?.length || 0) ? t("inbox.deselectAll") : t("inbox.selectAll")}
                      </button>
                      <span className="text-[11px] text-[#8b9cb3]">
                        {t("inbox.selectedCount", { count: selectedIds.size })}
                      </span>
                      <div className="flex-1" />
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 h-7 text-[11px] bg-transparent border-border text-[#8b9cb3] hover:text-white hover:bg-white/[0.04]"
                        onClick={() => handleBulkAction("read")}
                        disabled={bulkUpdateMut.isPending}
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        {t("inbox.bulkMarkRead")}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 h-7 text-[11px] bg-transparent border-border text-[#8b9cb3] hover:text-white hover:bg-white/[0.04]"
                        onClick={() => handleBulkAction("archive")}
                        disabled={bulkUpdateMut.isPending}
                      >
                        <Archive className="w-3 h-3" />
                        {t("inbox.bulkArchive")}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 h-7 text-[11px] bg-transparent border-border text-red-400/70 hover:text-red-400 hover:bg-red-500/[0.08]"
                        onClick={() => handleBulkAction("delete")}
                        disabled={bulkUpdateMut.isPending}
                      >
                        <Trash2 className="w-3 h-3" />
                        {t("inbox.deleteEmail")}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-[#8b9cb3] hover:text-white"
                        onClick={() => setSelectedIds(new Set())}
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}

                  <div className="space-y-1">
                    {emailsLoading ? (
                      Array(5).fill(0).map((_, i) => (
                        <div key={i} className="bg-card rounded-lg border border-border p-3">
                          <Skeleton className="h-4 w-3/4 mb-2 bg-white/5" />
                          <Skeleton className="h-3 w-1/2 bg-white/5" />
                        </div>
                      ))
                    ) : activeEmails?.length === 0 ? (
                      <div className="text-center py-14 rounded-lg border border-border border-dashed bg-card/50">
                        <Inbox className="mx-auto h-8 w-8 text-[#8b9cb3]/40 mb-2" />
                        <h3 className="text-[13px] font-medium text-white">{t("inbox.noEmails")}</h3>
                        <p className="text-[12px] text-[#8b9cb3] mt-1">{t("inbox.noEmailsDesc")}</p>
                      </div>
                    ) : (
                      <>
                        {activeEmails?.map((email) => (
                          <EmailRow
                            key={email.id}
                            email={email}
                            onClick={() => { if (selectionMode) { toggleSelect(email.id); } else { setSelectedEmailId(email.id); } }}
                            onArchive={handleArchive}
                            onCategoryClick={(name: string) => setFilterCategory(name)}
                            isSelected={selectedIds.has(email.id)}
                            onToggleSelect={toggleSelect}
                            selectionMode={selectionMode}
                          />
                        ))}
                        {hasMorePages && (
                          <div ref={loadMoreRef} className="flex items-center justify-center py-4">
                            {emailsFetching ? (
                              <div className="flex items-center gap-2 text-[#8b9cb3]">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span className="text-[11px]">{t("common.loading")}</span>
                              </div>
                            ) : (
                              <button
                                onClick={loadMore}
                                className="text-[11px] text-primary hover:text-white transition-colors px-3 py-1.5 rounded-md border border-primary/20 hover:border-primary/40"
                              >
                                {t("inbox.loadMore")}
                              </button>
                            )}
                          </div>
                        )}
                        {!hasMorePages && emails.length > 50 && (
                          <div className="text-center py-3">
                            <span className="text-[10px] text-[#8b9cb3]/60">Tous les emails chargés ({totalEmails})</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="w-full lg:w-[200px] shrink-0 space-y-3">
              <div className="bg-card rounded-lg border border-border p-3">
                <div className="flex items-center justify-between mb-2.5">
                  <h3 className="text-[10px] font-medium text-[#8b9cb3] uppercase tracking-wider">
                    {t("inbox.category")}
                  </h3>
                  {(() => {
                    const JUNK = ["non classé", "non classe", "uncategorized"];
                    const summaryData = summary as { urgentCount?: number; moyenCount?: number; faibleCount?: number } | undefined;
                    const serverInboxTotal = (summaryData?.urgentCount || 0) + (summaryData?.moyenCount || 0) + (summaryData?.faibleCount || 0);
                    const categorizedTotal = (categoryCounts || []).reduce((sum, c) => sum + c.count, 0);
                    const junkTotal = (categoryCounts || []).filter((c) => JUNK.includes(c.categoryName.toLowerCase())).reduce((sum, c) => sum + c.count, 0);
                    const uncategorizedCount = Math.max(0, serverInboxTotal - categorizedTotal + junkTotal);
                    if (uncategorizedCount === 0) return null;
                    return (
                      <button
                        onClick={() => {
                          recategorizeMut.mutate({ data: { lang } }, {
                            onSuccess: (data: any) => {
                              invalidateAll();
                              toast({
                                title: t("inbox.recategorizeSuccess", { count: data.recategorized }),
                                description: data.created?.length > 0 ? data.created.join(", ") : undefined,
                              });
                            },
                            onError: () => {
                              toast({ title: t("common.error"), variant: "destructive" });
                            },
                          });
                        }}
                        disabled={recategorizeMut.isPending}
                        className="flex items-center gap-1 text-[9px] text-primary hover:text-white transition-colors disabled:opacity-50"
                        title={t("inbox.recategorize")}
                      >
                        {recategorizeMut.isPending ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Tags className="w-3 h-3" />
                        )}
                        <span>{uncategorizedCount} {t("inbox.uncategorized")}</span>
                      </button>
                    );
                  })()}
                </div>
                {categoriesLoading ? (
                  <div className="space-y-1.5">
                    <Skeleton className="h-5 w-full bg-white/5" />
                    <Skeleton className="h-5 w-full bg-white/5" />
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    <div
                      className={`flex items-center justify-between py-1 px-1.5 rounded transition-colors cursor-pointer ${filterCategory === "all" ? "bg-primary/10 text-primary" : "hover:bg-white/[0.04]"}`}
                      onClick={() => setFilterCategory("all")}
                    >
                      <span className="text-[11px]">{t("inbox.allCategories")}</span>
                      <span className="text-[10px] bg-white/[0.06] px-1.5 py-0.5 rounded">
                        {(() => {
                          const s = summary as { urgentCount?: number; moyenCount?: number; faibleCount?: number } | undefined;
                          return (s?.urgentCount || 0) + (s?.moyenCount || 0) + (s?.faibleCount || 0);
                        })()}
                      </span>
                    </div>
                    {categoryCounts?.map((cat) => (
                      <div
                        key={cat.categoryId}
                        className={`flex items-center justify-between py-1 px-1.5 rounded transition-colors cursor-pointer ${filterCategory === cat.categoryName ? "bg-primary/10 text-primary" : "hover:bg-white/[0.04]"}`}
                        onClick={() => setFilterCategory(filterCategory === cat.categoryName ? "all" : cat.categoryName)}
                      >
                        <div className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                          <span className="text-[11px] text-[#8b9cb3]">{translateCategoryName(cat.categoryName, lang)}</span>
                        </div>
                        <span className="text-[10px] text-[#8b9cb3] bg-white/[0.06] px-1.5 py-0.5 rounded">
                          {cat.count}
                        </span>
                      </div>
                    ))}
                    {categoryCounts?.length === 0 && (
                      <p className="text-[11px] text-[#8b9cb3]/60 italic py-1.5">{t("inbox.noEmails")}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
