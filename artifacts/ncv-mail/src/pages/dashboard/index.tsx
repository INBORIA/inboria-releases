import { DashboardLayout } from "@/components/layout/dashboard-layout";
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
} from "@workspace/api-client-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { Clock, CheckCircle2, Sparkles, Inbox, ArrowLeft, Reply, Archive, X, ChevronRight, Trash2, RefreshCw, Search, PenSquare, Send, Wand2, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

function PriorityBadge({ priority }: { priority: string }) {
  if (priority === "urgent") {
    return <Badge className="bg-red-500/15 text-red-400 border-red-500/20 text-[11px] font-medium px-2 py-0.5">Urgent</Badge>;
  }
  if (priority === "moyen") {
    return <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/20 text-[11px] font-medium px-2 py-0.5">Moyen</Badge>;
  }
  return <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/20 text-[11px] font-medium px-2 py-0.5">Faible</Badge>;
}

function EmailRow({ email, onClick, onArchive }: { email: any; onClick: () => void; onArchive: (id: number) => void }) {
  return (
    <div
      className="group bg-card hover:bg-[#1a2235] rounded-lg border border-border p-4 transition-colors cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-sm shrink-0">
            {(email.sender || "?")[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="font-semibold text-[13px] text-white truncate">{email.sender}</span>
              {email.status === "unread" && (
                <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
              )}
            </div>
            <h3 className="text-[13px] text-white/80 truncate">{email.subject}</h3>
            {email.summary && (
              <p className="text-[12px] text-[#8b9cb3] mt-1 line-clamp-1">{email.summary}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {email.projectReference && (
            <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/20 text-[10px] font-medium px-1.5 py-0">
              {email.projectReference}
            </Badge>
          )}
          <PriorityBadge priority={email.priority} />
          <span className="text-[11px] text-[#8b9cb3] whitespace-nowrap flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {format(new Date(email.createdAt), "d MMM HH:mm", { locale: fr })}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onArchive(email.id); }}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-white/[0.08] text-[#8b9cb3] hover:text-white"
            title="Archiver"
          >
            <Archive className="w-4 h-4" />
          </button>
          <ChevronRight className="w-4 h-4 text-[#8b9cb3]/40 group-hover:text-[#8b9cb3] transition-colors" />
        </div>
      </div>
    </div>
  );
}

const triageSchema = z.object({
  sender: z.string().min(1, "Expediteur requis"),
  subject: z.string().min(1, "Sujet requis"),
  body: z.string().min(1, "Contenu requis"),
});

function EmailDetail({ email, onBack, onMarkRead, onArchive, onDelete, onUpdatePriority, onUpdateCategory, onUpdateProject, onSendReply, isSending, onGenerateDraft, isDrafting, categories, projects }: { email: any; onBack: () => void; onMarkRead: (id: number) => void; onArchive: (id: number) => void; onDelete: (id: number) => void; onUpdatePriority: (id: number, priority: string) => void; onUpdateCategory: (id: number, categoryId: string) => void; onUpdateProject: (id: number, projectId: string) => void; onSendReply: (to: string, subject: string, body: string, replyToEmailId?: number) => void; isSending: boolean; onGenerateDraft: (emailId: number, callback: (draft: string) => void) => void; isDrafting: boolean; categories: any[]; projects: any[] }) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyTo, setReplyTo] = useState("");
  const [replySubject, setReplySubject] = useState("");
  const [replyText, setReplyText] = useState("");

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 mb-5">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="h-8 px-2 text-[#8b9cb3] hover:text-white hover:bg-white/[0.06]"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Retour
        </Button>
        <div className="flex-1" />
        <PriorityBadge priority={email.priority} />
      </div>

      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="p-5 border-b border-border">
          <h2 className="text-lg font-semibold text-white mb-3">{email.subject}</h2>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-sm">
                {(email.sender || "?")[0].toUpperCase()}
              </div>
              <div>
                <div className="text-[13px] font-medium text-white">{email.sender}</div>
                {email.senderEmail && (
                  <div className="text-[11px] text-[#8b9cb3]">{email.senderEmail}</div>
                )}
              </div>
            </div>
            <span className="text-[11px] text-[#8b9cb3] flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {format(new Date(email.createdAt), "d MMMM yyyy a HH:mm", { locale: fr })}
            </span>
          </div>
        </div>

        {email.summary && (
          <div className="px-5 py-3 bg-primary/[0.06] border-b border-border">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span className="text-[11px] font-medium text-primary uppercase tracking-wider">Resume IA</span>
            </div>
            <p className="text-[13px] text-[#8b9cb3] leading-relaxed">{email.summary}</p>
          </div>
        )}

        <div className="p-5">
          <p className="text-[13px] text-white/80 leading-relaxed whitespace-pre-wrap">
            {email.body || "(Aucun contenu disponible)"}
          </p>
        </div>

        <div className="px-5 py-4 border-t border-border">
          <div className="flex items-center gap-2 mb-3">
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => {
                if (!replyOpen) {
                  setReplyTo(email.senderEmail || "");
                  setReplySubject(email.subject?.startsWith("Re:") ? email.subject : `Re: ${email.subject}`);
                  setReplyText("");
                }
                setReplyOpen(!replyOpen);
              }}
            >
              <Reply className="w-3.5 h-3.5" />
              Repondre
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 bg-transparent border-primary/30 text-primary hover:bg-primary/10 hover:text-primary"
              disabled={isDrafting}
              onClick={() => {
                setReplyTo(email.senderEmail || "");
                setReplySubject(email.subject?.startsWith("Re:") ? email.subject : `Re: ${email.subject}`);
                setReplyOpen(true);
                onGenerateDraft(email.id, (draft) => {
                  setReplyText(draft);
                });
              }}
            >
              {isDrafting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
              {isDrafting ? "Generation..." : "Reponse IA"}
            </Button>
            {email.status === "unread" && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 bg-transparent border-border text-[#8b9cb3] hover:text-white hover:bg-white/[0.04]"
                onClick={() => onMarkRead(email.id)}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Marquer lu
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 bg-transparent border-border text-[#8b9cb3] hover:text-white hover:bg-white/[0.04]"
              onClick={() => onArchive(email.id)}
            >
              <Archive className="w-3.5 h-3.5" />
              Archiver
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 bg-transparent border-border text-red-400/70 hover:text-red-400 hover:bg-red-500/[0.08]"
              onClick={() => onDelete(email.id)}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Supprimer
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[#8b9cb3] uppercase tracking-wider">Priorite:</span>
              <Select value={email.priority} onValueChange={(val) => onUpdatePriority(email.id, val)}>
                <SelectTrigger className="w-[110px] h-7 bg-card border-border text-[12px] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="moyen">Moyen</SelectItem>
                  <SelectItem value="faible">Faible</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[#8b9cb3] uppercase tracking-wider">Categorie:</span>
              <Select value={email.categoryId?.toString() || "none"} onValueChange={(val) => onUpdateCategory(email.id, val)}>
                <SelectTrigger className="w-[140px] h-7 bg-card border-border text-[12px] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="none">Non classe</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.categoryId} value={cat.categoryId.toString()}>{cat.categoryName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[#8b9cb3] uppercase tracking-wider">Projet:</span>
              <Select value={email.projectId || "none"} onValueChange={(val) => onUpdateProject(email.id, val)}>
                <SelectTrigger className="w-[160px] h-7 bg-card border-border text-[12px] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="none">Aucun projet</SelectItem>
                  {projects.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.reference} — {p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {replyOpen && (
          <div className="px-5 pb-5 border-t border-border pt-4 space-y-3">
            <div>
              <label className="text-[11px] text-[#8b9cb3] uppercase tracking-wider mb-1 block">Destinataire</label>
              <Input
                value={replyTo}
                onChange={(e) => setReplyTo(e.target.value)}
                placeholder="email@exemple.com"
                className="bg-background border-border text-white text-[13px]"
              />
            </div>
            <div>
              <label className="text-[11px] text-[#8b9cb3] uppercase tracking-wider mb-1 block">Sujet</label>
              <Input
                value={replySubject}
                onChange={(e) => setReplySubject(e.target.value)}
                placeholder="Sujet"
                className="bg-background border-border text-white text-[13px]"
              />
            </div>
            <div>
              <label className="text-[11px] text-[#8b9cb3] uppercase tracking-wider mb-1 block">Message</label>
              <Textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Ecrivez votre reponse..."
                className="h-28 bg-background border-border text-white resize-none"
              />
            </div>
            <div className="flex items-center gap-2 justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setReplyOpen(false); setReplyText(""); setReplyTo(""); setReplySubject(""); }}
                className="text-[#8b9cb3] hover:text-white"
              >
                Annuler
              </Button>
              <Button
                size="sm"
                className="gap-1.5"
                disabled={isSending || !replyTo.trim() || !replySubject.trim() || !replyText.trim()}
                onClick={() => {
                  onSendReply(replyTo, replySubject, replyText, email.id);
                  setReplyText("");
                  setReplyTo("");
                  setReplySubject("");
                  setReplyOpen(false);
                }}
              >
                <Send className="w-3.5 h-3.5" />
                {isSending ? "Envoi..." : "Envoyer"}
              </Button>
            </div>
          </div>
        )}
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

export default function Dashboard() {
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [isSimulateOpen, setIsSimulateOpen] = useState(false);
  const [selectedEmailId, setSelectedEmailId] = useState<number | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const searchQuery = useDebounce(searchInput, 300);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: emails, isLoading: emailsLoading } = useListEmails({
    priority: filterPriority !== "all" ? (filterPriority as any) : undefined,
    q: searchQuery || undefined,
  });

  const { data: categoryCounts, isLoading: categoriesLoading } = useGetCategoryCounts();
  const { data: summary, isLoading: summaryLoading } = useGetDashboardSummary();
  const { data: projects } = useListProjects();

  const updateEmail = useUpdateEmail();
  const deleteEmail = useDeleteEmail();
  const triageEmail = useTriageEmail();
  const sendEmailMut = useSendEmail();
  const generateDraftMut = useGenerateDraft();
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");

  const [filterCategory, setFilterCategory] = useState<string>("all");
  const activeEmails = emails
    ?.filter((e) => e.status !== "archived")
    ?.filter((e) => filterCategory === "all" || e.categoryName === filterCategory)
    ?.sort((a, b) => {
      const pOrder: Record<string, number> = { urgent: 0, moyen: 1, faible: 2 };
      return (pOrder[a.priority] ?? 2) - (pOrder[b.priority] ?? 2);
    });
  const selectedEmail = emails?.find((e) => e.id === selectedEmailId);

  const invalidateAll = () => {
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
          toast({ title: "Email archive" });
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
          toast({ title: "Email supprime" });
        },
        onError: () => {
          toast({ variant: "destructive", title: "Erreur", description: "Impossible de supprimer l'email." });
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
          toast({ title: `Priorite changee en ${priority}`, description: "L'IA retiendra ce choix pour cet expediteur." });
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
          toast({ title: "Categorie mise a jour", description: "L'IA retiendra ce choix pour cet expediteur." });
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
          toast({ title: "Projet mis a jour", description: "L'email a ete lie au projet." });
        },
      }
    );
  };

  const handleSendReply = (to: string, subject: string, body: string, replyToEmailId?: number) => {
    sendEmailMut.mutate(
      { data: { to, subject, body, replyToEmailId: replyToEmailId ?? null } },
      {
        onSuccess: () => {
          invalidateAll();
          toast({ title: "Email envoye" });
        },
        onError: () => {
          toast({ variant: "destructive", title: "Erreur", description: "Impossible d'envoyer l'email." });
        },
      }
    );
  };

  const handleComposeSend = () => {
    if (!composeTo.trim() || !composeSubject.trim() || !composeBody.trim()) return;
    sendEmailMut.mutate(
      { data: { to: composeTo, subject: composeSubject, body: composeBody, replyToEmailId: null } },
      {
        onSuccess: () => {
          invalidateAll();
          setIsComposeOpen(false);
          setComposeTo("");
          setComposeSubject("");
          setComposeBody("");
          toast({ title: "Email envoye" });
        },
        onError: () => {
          toast({ variant: "destructive", title: "Erreur", description: "Impossible d'envoyer l'email." });
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
          toast({ title: "Brouillon IA genere", description: "Le brouillon a ete insere dans le formulaire." });
        },
        onError: () => {
          toast({ variant: "destructive", title: "Erreur", description: "Impossible de generer le brouillon IA." });
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
        toast({ title: "Synchronisation terminee", description: `${data.synced || 0} nouveau(x) email(s) importe(s).` });
      } else {
        toast({ variant: "destructive", title: "Erreur", description: data.error || "Echec de la synchronisation." });
      }
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de synchroniser." });
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
      { data },
      {
        onSuccess: (result) => {
          queryClient.invalidateQueries({ queryKey: getListEmailsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetCategoryCountsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetInboxHealthQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          setIsSimulateOpen(false);
          form.reset();
          toast({ 
            title: "Email analyse", 
            description: `Classe comme ${result.priority} dans ${result.category}.` 
          });
        },
        onError: () => {
          toast({ variant: "destructive", title: "Erreur", description: "Impossible d'analyser l'email." });
        }
      }
    );
  };

  if (selectedEmail) {
    return (
      <DashboardLayout>
        <div className="p-6 max-w-[900px] mx-auto w-full">
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
          />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 max-w-[1200px] mx-auto w-full flex flex-col lg:flex-row gap-6">
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-semibold text-white tracking-tight">Inbox</h1>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-2 bg-transparent border-border text-[#8b9cb3] hover:text-white hover:bg-white/[0.04]"
                onClick={handleSync}
                disabled={isSyncing}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                {isSyncing ? "Sync..." : "Rafraichir"}
              </Button>
              <Dialog open={isComposeOpen} onOpenChange={(open) => { setIsComposeOpen(open); if (!open) { setComposeTo(""); setComposeSubject(""); setComposeBody(""); } }}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-2 bg-primary hover:bg-primary/90 text-white">
                    <PenSquare className="w-3.5 h-3.5" />
                    Nouveau
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-card border-border">
                  <DialogHeader>
                    <DialogTitle className="text-white">Nouveau message</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <label className="text-[13px] text-[#8b9cb3] mb-1.5 block">Destinataire</label>
                      <Input value={composeTo} onChange={(e) => setComposeTo(e.target.value)} placeholder="email@exemple.com" className="bg-background border-border text-white" />
                    </div>
                    <div>
                      <label className="text-[13px] text-[#8b9cb3] mb-1.5 block">Sujet</label>
                      <Input value={composeSubject} onChange={(e) => setComposeSubject(e.target.value)} placeholder="Sujet de votre email" className="bg-background border-border text-white" />
                    </div>
                    <div>
                      <label className="text-[13px] text-[#8b9cb3] mb-1.5 block">Message</label>
                      <Textarea value={composeBody} onChange={(e) => setComposeBody(e.target.value)} placeholder="Redigez votre message..." className="h-40 bg-background border-border text-white" />
                    </div>
                    <Button
                      className="w-full gap-2"
                      disabled={sendEmailMut.isPending || !composeTo.trim() || !composeSubject.trim() || !composeBody.trim()}
                      onClick={handleComposeSend}
                    >
                      <Send className="w-4 h-4" />
                      {sendEmailMut.isPending ? "Envoi en cours..." : "Envoyer"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
              <Dialog open={isSimulateOpen} onOpenChange={setIsSimulateOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="hidden sm:flex gap-2 bg-transparent border-border text-[#8b9cb3] hover:text-white hover:bg-white/[0.04]">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                    Simuler
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-card border-border">
                  <DialogHeader>
                    <DialogTitle className="text-white">Simuler la reception d'un email</DialogTitle>
                  </DialogHeader>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmitTriage)} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="sender"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[#8b9cb3]">Expediteur</FormLabel>
                            <FormControl><Input placeholder="client@entreprise.com" className="bg-background border-border text-white" {...field} /></FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="subject"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[#8b9cb3]">Sujet</FormLabel>
                            <FormControl><Input placeholder="Urgent: Probleme de facturation" className="bg-background border-border text-white" {...field} /></FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="body"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[#8b9cb3]">Corps du message</FormLabel>
                            <FormControl><Textarea className="h-32 bg-background border-border text-white" placeholder="Bonjour, je n'arrive pas a payer..." {...field} /></FormControl>
                          </FormItem>
                        )}
                      />
                      <Button type="submit" className="w-full" disabled={triageEmail.isPending}>
                        {triageEmail.isPending ? "Analyse en cours..." : "Envoyer a l'IA"}
                      </Button>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>

              <Select value={filterPriority} onValueChange={setFilterPriority}>
                <SelectTrigger className="w-[150px] bg-card border-border text-[#8b9cb3] text-[13px]">
                  <SelectValue placeholder="Priorite" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="all">Toutes priorites</SelectItem>
                  <SelectItem value="urgent">Urgents</SelectItem>
                  <SelectItem value="moyen">Moyens</SelectItem>
                  <SelectItem value="faible">Faibles</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-[150px] bg-card border-border text-[#8b9cb3] text-[13px]">
                  <SelectValue placeholder="Categorie" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="all">Toutes categories</SelectItem>
                  {categoryCounts?.map((cat) => (
                    <SelectItem key={cat.categoryId} value={cat.categoryName}>{cat.categoryName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8b9cb3]" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Rechercher par sujet, expediteur ou resume..."
              className="pl-10 bg-card border-border text-white placeholder:text-[#8b9cb3]/50 h-9 text-[13px]"
            />
            {searchInput && (
              <button
                onClick={() => setSearchInput("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8b9cb3] hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="bg-card rounded-lg border border-border p-3.5">
              <div className="text-[11px] font-medium text-red-400 uppercase tracking-wider mb-1">Urgents</div>
              <div className="text-2xl font-bold text-white">
                {summaryLoading ? <Skeleton className="h-7 w-10 bg-white/5" /> : summary?.urgentCount || 0}
              </div>
            </div>
            <div className="bg-card rounded-lg border border-border p-3.5">
              <div className="text-[11px] font-medium text-amber-400 uppercase tracking-wider mb-1">Moyens</div>
              <div className="text-2xl font-bold text-white">
                {summaryLoading ? <Skeleton className="h-7 w-10 bg-white/5" /> : summary?.moyenCount || 0}
              </div>
            </div>
            <div className="bg-card rounded-lg border border-border p-3.5">
              <div className="text-[11px] font-medium text-emerald-400 uppercase tracking-wider mb-1">Faibles</div>
              <div className="text-2xl font-bold text-white">
                {summaryLoading ? <Skeleton className="h-7 w-10 bg-white/5" /> : summary?.faibleCount || 0}
              </div>
            </div>
          </div>

          <div className="space-y-1">
            {emailsLoading ? (
              Array(5).fill(0).map((_, i) => (
                <div key={i} className="bg-card rounded-lg border border-border p-4">
                  <Skeleton className="h-5 w-3/4 mb-2 bg-white/5" />
                  <Skeleton className="h-4 w-1/2 bg-white/5" />
                </div>
              ))
            ) : activeEmails?.length === 0 ? (
              <div className="text-center py-16 rounded-lg border border-border border-dashed bg-card/50">
                <Inbox className="mx-auto h-10 w-10 text-[#8b9cb3]/40 mb-3" />
                <h3 className="text-sm font-medium text-white">Inbox Zero</h3>
                <p className="text-[13px] text-[#8b9cb3] mt-1">Tous vos emails ont ete traites.</p>
              </div>
            ) : (
              activeEmails?.map((email) => (
                <EmailRow key={email.id} email={email} onClick={() => setSelectedEmailId(email.id)} onArchive={handleArchive} />
              ))
            )}
          </div>
        </div>

        <div className="w-full lg:w-[240px] shrink-0 space-y-4">
          <div className="bg-card rounded-lg border border-border p-4">
            <h3 className="text-[11px] font-medium text-[#8b9cb3] uppercase tracking-wider mb-3">
              Categories
            </h3>
            {categoriesLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-7 w-full bg-white/5" />
                <Skeleton className="h-7 w-full bg-white/5" />
              </div>
            ) : (
              <div className="space-y-1">
                {categoryCounts?.map((cat) => (
                  <div key={cat.categoryId} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-white/[0.04] transition-colors cursor-pointer">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      <span className="text-[13px] text-[#8b9cb3]">{cat.categoryName}</span>
                    </div>
                    <span className="text-[11px] text-[#8b9cb3] bg-white/[0.06] px-1.5 py-0.5 rounded">
                      {cat.count}
                    </span>
                  </div>
                ))}
                {categoryCounts?.length === 0 && (
                  <p className="text-[12px] text-[#8b9cb3]/60 italic py-2">Aucune categorie</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
