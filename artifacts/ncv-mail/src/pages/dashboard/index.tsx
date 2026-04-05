import { DashboardLayout } from "@/components/layout/dashboard-layout";
import {
  useListEmails,
  useGetCategoryCounts,
  useUpdateEmail,
  getListEmailsQueryKey,
  useGetDashboardSummary,
  useTriageEmail,
  getGetDashboardSummaryQueryKey,
  getGetCategoryCountsQueryKey,
  getGetInboxHealthQueryKey,
} from "@workspace/api-client-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { Clock, CheckCircle2, Sparkles, Inbox } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
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

const triageSchema = z.object({
  sender: z.string().min(1, "Expediteur requis"),
  subject: z.string().min(1, "Sujet requis"),
  body: z.string().min(1, "Contenu requis"),
});

export default function Dashboard() {
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [isSimulateOpen, setIsSimulateOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: emails, isLoading: emailsLoading } = useListEmails({
    priority: filterPriority !== "all" ? (filterPriority as any) : undefined,
  });

  const { data: categoryCounts, isLoading: categoriesLoading } = useGetCategoryCounts();
  const { data: summary, isLoading: summaryLoading } = useGetDashboardSummary();

  const updateEmail = useUpdateEmail();
  const triageEmail = useTriageEmail();

  const handleMarkAsRead = (id: number) => {
    updateEmail.mutate(
      { id, data: { status: "read" } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListEmailsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetInboxHealthQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        },
      }
    );
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

  return (
    <DashboardLayout>
      <div className="p-6 max-w-[1200px] mx-auto w-full flex flex-col lg:flex-row gap-6">
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-5">
            <h1 className="text-xl font-semibold text-white tracking-tight">Inbox</h1>
            <div className="flex items-center gap-2">
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
                <SelectTrigger className="w-[160px] bg-card border-border text-[#8b9cb3] text-[13px]">
                  <SelectValue placeholder="Toutes" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="all">Toutes les priorites</SelectItem>
                  <SelectItem value="urgent">Urgents</SelectItem>
                  <SelectItem value="moyen">Moyens</SelectItem>
                  <SelectItem value="faible">Faibles</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
            ) : emails?.length === 0 ? (
              <div className="text-center py-16 rounded-lg border border-border border-dashed bg-card/50">
                <Inbox className="mx-auto h-10 w-10 text-[#8b9cb3]/40 mb-3" />
                <h3 className="text-sm font-medium text-white">Inbox Zero</h3>
                <p className="text-[13px] text-[#8b9cb3] mt-1">Tous vos emails ont ete traites.</p>
              </div>
            ) : (
              emails?.map((email) => (
                <div
                  key={email.id}
                  className="group bg-card hover:bg-[#1a2235] rounded-lg border border-border p-4 transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-[13px] text-white truncate">{email.sender}</span>
                        <span className="text-[11px] text-[#8b9cb3] hidden sm:inline truncate">{email.senderEmail}</span>
                      </div>
                      <h3 className="text-[13px] text-[#8b9cb3] truncate">
                        {email.subject}
                      </h3>
                      {email.summary && (
                        <p className="text-[12px] text-primary/70 mt-1.5 line-clamp-1">
                          {email.summary}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <PriorityBadge priority={email.priority} />
                      <span className="text-[11px] text-[#8b9cb3] whitespace-nowrap flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {format(new Date(email.createdAt), "d MMM HH:mm", { locale: fr })}
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    {email.status === 'unread' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-[12px] text-[#8b9cb3] hover:text-white hover:bg-white/[0.06]"
                        onClick={() => handleMarkAsRead(email.id)}
                        disabled={updateEmail.isPending}
                      >
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Marquer lu
                      </Button>
                    )}
                    <Button
                      size="sm"
                      className="h-7 text-[12px]"
                    >
                      Repondre
                    </Button>
                  </div>
                </div>
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
