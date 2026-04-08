import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { EmailBodyRenderer } from "@/components/EmailBodyRenderer";
import {
  useListEmails,
  useListProjects,
  useUpdateEmail,
  useGetEmailConversation,
  useGetConversationSummary,
  getListEmailsQueryKey,
  useCreateFollowup,
  getListFollowupsQueryKey,
  getGetFollowupStatsQueryKey,
} from "@workspace/api-client-react";
import type { PaginatedEmails } from "@workspace/api-client-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import {
  Send,
  ArrowLeft,
  Sparkles,
  Reply,
  FolderKanban,
  Download,
  Loader2,
  User,
  ArrowRight,
  Eye,
  CalendarDays,
  X,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

export default function Envoyes() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedEmailId, setSelectedEmailId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [accumulated, setAccumulated] = useState<any[]>([]);

  const { data: emailsData, isLoading, isFetching } = useListEmails({ status: "sent", limit: 50, page });
  const paged = emailsData as PaginatedEmails | undefined;
  const hasMore = paged ? page < (paged.totalPages ?? 1) : false;

  useEffect(() => {
    if (paged) {
      if (page === 1) {
        setAccumulated(paged.emails || []);
      } else {
        setAccumulated((prev) => {
          const ids = new Set(prev.map((e) => e.id));
          return [...prev, ...(paged.emails || []).filter((e) => !ids.has(e.id))];
        });
      }
    }
  }, [paged, page]);

  const loadMore = useCallback(() => {
    if (hasMore && !isFetching) setPage((p) => p + 1);
  }, [hasMore, isFetching]);

  const sentEmails = accumulated;
  const { data: projects } = useListProjects();
  const updateEmail = useUpdateEmail();

  const handleUpdateProject = (id: number, projectId: string) => {
    updateEmail.mutate(
      { id, data: { projectId: projectId === "none" ? null : projectId } as any },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListEmailsQueryKey() });
          toast({ title: "Projet mis à jour" });
        },
      }
    );
  };

  const handleExport = () => {
    const token = document.cookie.split(";").find((c) => c.trim().startsWith("sb-"))?.split("=")[1];
    window.open(`${import.meta.env.BASE_URL}api/export/emails?status=sent`, "_blank");
  };

  if (selectedEmailId) {
    return (
      <DashboardLayout>
        <div className="p-5 max-w-[900px] mx-auto w-full">
          <ConversationView
            emailId={selectedEmailId}
            onBack={() => setSelectedEmailId(null)}
            projects={projects || []}
            onUpdateProject={handleUpdateProject}
          />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-5 max-w-5xl mx-auto w-full">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-[16px] font-semibold text-white tracking-tight flex items-center gap-2">
              <Send className="w-4 h-4 text-primary" />
              Envoyés
            </h1>
            <p className="text-[12px] text-[#8b9cb3] mt-0.5">
              {paged?.total || sentEmails.length} email(s) envoyés
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            className="gap-1 text-[11px] h-7 bg-transparent border-border text-[#8b9cb3] hover:text-white"
          >
            <Download className="w-3 h-3" />
            Exporter CSV
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array(5).fill(0).map((_, i) => (
              <div key={i} className="bg-card rounded-lg border border-border p-3">
                <Skeleton className="h-4 w-3/4 mb-2 bg-white/5" />
                <Skeleton className="h-3 w-1/2 bg-white/5" />
              </div>
            ))}
          </div>
        ) : sentEmails.length === 0 ? (
          <div className="text-center py-16 rounded-lg border border-border border-dashed bg-card/50">
            <Send className="mx-auto h-8 w-8 text-[#8b9cb3]/20 mb-2" />
            <h3 className="text-[13px] font-medium text-white mb-1">Aucun email envoyé</h3>
            <p className="text-[12px] text-[#8b9cb3]">Vos emails envoyés et réponses apparaîtront ici.</p>
          </div>
        ) : (
          <>
            <div className="space-y-1">
              {sentEmails.map((email) => {
                const isReply = !!email.replyToEmailId;
                return (
                  <div
                    key={email.id}
                    className="group flex items-stretch rounded-lg border border-border bg-card hover:bg-[#1a2235] transition-colors cursor-pointer overflow-hidden"
                    onClick={() => setSelectedEmailId(email.id)}
                  >
                    <div className="w-1 shrink-0 bg-primary" />
                    <div className="flex items-start gap-3 flex-1 min-w-0 p-3">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-[12px] shrink-0 mt-0.5">
                        {isReply ? <Reply className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-semibold text-[12px] text-white truncate flex items-center gap-1">
                            <ArrowRight className="w-3 h-3 text-primary" />
                            {email.recipient || "Destinataire inconnu"}
                          </span>
                          {isReply && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-primary/15 text-primary">
                              Réponse
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
                      <div className="flex items-center gap-2 shrink-0">
                        {email.projectName && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/[0.06] text-[#8b9cb3]">
                            {email.projectReference || email.projectName}
                          </span>
                        )}
                        <span className="text-[10px] text-[#8b9cb3]">
                          {email.createdAt ? format(new Date(email.createdAt), "dd MMM HH:mm", { locale: fr }) : ""}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {hasMore && (
              <div className="flex items-center justify-center py-4 mt-3">
                <button
                  onClick={loadMore}
                  disabled={isFetching}
                  className="text-[11px] text-primary hover:text-white transition-colors px-3 py-1.5 rounded-md border border-primary/20 hover:border-primary/40 disabled:opacity-50"
                >
                  {isFetching ? "Chargement..." : "Charger plus"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

function ConversationView({
  emailId,
  onBack,
  projects,
  onUpdateProject,
}: {
  emailId: number;
  onBack: () => void;
  projects: any[];
  onUpdateProject: (id: number, projectId: string) => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: convoData, isLoading } = useGetEmailConversation(emailId);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const summaryMut = useGetConversationSummary();
  const createFollowup = useCreateFollowup();
  const [followupOpen, setFollowupOpen] = useState(false);
  const [followupTitle, setFollowupTitle] = useState("");
  const [followupDueDate, setFollowupDueDate] = useState("");
  const [followupNotes, setFollowupNotes] = useState("");
  const [followupProjectId, setFollowupProjectId] = useState("none");

  const thread = (convoData as any)?.thread || [];
  const email = (convoData as any)?.email;

  const handleGenerateSummary = async () => {
    if (thread.length === 0) return;
    setLoadingSummary(true);
    try {
      const result = await summaryMut.mutateAsync({ data: { thread } });
      setAiSummary((result as any)?.summary || "");
    } catch {
      setAiSummary("Erreur lors de la génération du résumé.");
    }
    setLoadingSummary(false);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="h-7 px-2 text-[#8b9cb3] hover:text-white hover:bg-white/[0.06] text-[12px]"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1" />
          Envoyés
        </Button>
        <div className="flex-1" />
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (!followupOpen) {
              setFollowupTitle(`Suivi: ${email?.subject || ""}`);
              setFollowupProjectId(email?.projectId || "none");
              setFollowupNotes("");
              const d = new Date(); d.setDate(d.getDate() + 3);
              setFollowupDueDate(d.toISOString().split("T")[0]);
            }
            setFollowupOpen(!followupOpen);
          }}
          className="gap-1 text-[11px] h-7 bg-transparent border-amber-500/30 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300"
        >
          <Eye className="w-3 h-3" />
          Suivre
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleGenerateSummary}
          disabled={loadingSummary || thread.length === 0}
          className="gap-1 text-[11px] h-7 bg-transparent border-border text-primary hover:text-white"
        >
          {loadingSummary ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
          Résumé IA
        </Button>
      </div>

      {email && (
        <div className="mb-4">
          <h2 className="text-[15px] font-semibold text-white mb-1">{email.subject}</h2>
          <div className="flex items-center gap-2 text-[11px] text-[#8b9cb3]">
            <span>Vers: {email.recipient || "?"}</span>
            <span>•</span>
            <span>{email.createdAt ? format(new Date(email.createdAt), "dd MMMM yyyy HH:mm", { locale: fr }) : ""}</span>
          </div>
          {email.projectName && (
            <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] text-[#8b9cb3]">
              <FolderKanban className="w-3 h-3 inline mr-1" />
              {email.projectReference} - {email.projectName}
            </span>
          )}
        </div>
      )}

      {aiSummary && (
        <div className="mb-4 p-3 rounded-lg border border-primary/20 bg-primary/5">
          <div className="flex items-center gap-1 mb-1">
            <Sparkles className="w-3 h-3 text-primary" />
            <span className="text-[11px] font-medium text-primary">Résumé IA de la conversation</span>
          </div>
          <p className="text-[12px] text-[#8b9cb3]">{aiSummary}</p>
        </div>
      )}

      {email && !email.projectId && (
        <div className="mb-4 flex items-center gap-2">
          <span className="text-[11px] text-[#8b9cb3]">Projet:</span>
          <Select onValueChange={(v) => onUpdateProject(email.id, v)}>
            <SelectTrigger className="w-[180px] h-7 text-[11px] bg-card border-border">
              <SelectValue placeholder="Assigner un projet" />
            </SelectTrigger>
            <SelectContent>
              {(projects || []).map((p: any) => (
                <SelectItem key={p.id} value={p.id} className="text-[11px]">
                  {p.reference} - {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {followupOpen && (
        <div className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 space-y-2.5">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[11px] font-medium text-amber-400 uppercase tracking-wider">Créer un suivi</span>
            </div>
            <button onClick={() => setFollowupOpen(false)} className="text-[#8b9cb3] hover:text-white"><X className="w-4 h-4" /></button>
          </div>
          <div>
            <label className="text-[10px] text-[#8b9cb3] uppercase tracking-wider mb-1 block">Titre du suivi</label>
            <Input
              value={followupTitle}
              onChange={(e) => setFollowupTitle(e.target.value)}
              placeholder="Ex: Relancer pour le devis..."
              className="bg-background border-border text-white text-[12px] h-8"
            />
          </div>
          <div>
            <label className="text-[10px] text-[#8b9cb3] uppercase tracking-wider mb-1 block">Date d'échéance</label>
            <Input
              type="date"
              value={followupDueDate}
              onChange={(e) => setFollowupDueDate(e.target.value)}
              className="bg-background border-border text-white text-[12px] h-8"
            />
          </div>
          <div>
            <label className="text-[10px] text-[#8b9cb3] uppercase tracking-wider mb-1 block">Projet (optionnel)</label>
            <Select value={followupProjectId} onValueChange={setFollowupProjectId}>
              <SelectTrigger className="w-full h-8 bg-background border-border text-[12px] text-white">
                <SelectValue placeholder="Aucun projet" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="none">Aucun projet</SelectItem>
                {projects.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.reference} — {p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] text-[#8b9cb3] uppercase tracking-wider mb-1 block">Notes (optionnel)</label>
            <Textarea
              value={followupNotes}
              onChange={(e) => setFollowupNotes(e.target.value)}
              placeholder="Notes sur ce suivi..."
              className="bg-background border-border text-white text-[12px] h-16 resize-none"
            />
          </div>
          <div className="flex items-center gap-2 justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFollowupOpen(false)}
              className="text-[#8b9cb3] hover:text-white h-7 text-[11px]"
            >
              Annuler
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
                      emailId,
                      dueDate: followupDueDate || undefined,
                      notes: followupNotes || undefined,
                      projectId: followupProjectId !== "none" ? followupProjectId : undefined,
                    } as any,
                  },
                  {
                    onSuccess: () => {
                      queryClient.invalidateQueries({ queryKey: getListFollowupsQueryKey() });
                      queryClient.invalidateQueries({ queryKey: getGetFollowupStatsQueryKey() });
                      toast({ title: "Suivi créé avec succès" });
                      setFollowupOpen(false);
                    },
                    onError: () => {
                      toast({ title: "Erreur lors de la création du suivi", variant: "destructive" });
                    },
                  }
                );
              }}
            >
              {createFollowup.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Eye className="w-3 h-3" />}
              Créer le suivi
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {thread.map((msg: any, idx: number) => (
          <div
            key={msg.id || idx}
            className={`rounded-lg border p-4 ${
              msg.role === "sent"
                ? "border-primary/20 bg-primary/5 ml-8"
                : "border-border bg-card mr-8"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold ${
                msg.role === "sent" ? "bg-primary/20 text-primary" : "bg-white/[0.06] text-[#8b9cb3]"
              }`}>
                {msg.role === "sent" ? <Send className="w-3 h-3" /> : <User className="w-3 h-3" />}
              </div>
              <span className="text-[11px] font-medium text-white">
                {msg.role === "sent" ? "Vous" : msg.sender || "?"}
              </span>
              <span className="text-[10px] text-[#8b9cb3]">
                {msg.role === "sent" ? `→ ${msg.recipient || "?"}` : ""}
              </span>
              <span className="text-[10px] text-[#8b9cb3] ml-auto">
                {msg.createdAt ? format(new Date(msg.createdAt), "dd MMM HH:mm", { locale: fr }) : ""}
              </span>
            </div>
            <div className="text-[12px] text-[#8b9cb3] max-h-[300px] overflow-y-auto">
              <EmailBodyRenderer body={msg.body || ""} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
