import { DashboardLayout } from "@/components/layout/dashboard-layout";
import {
  useListEmails,
  useGetInboxHealth,
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Clock, CheckCircle2, ShieldAlert, Plus, Sparkles } from "lucide-react";
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
    return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">Urgent</Badge>;
  }
  if (priority === "moyen") {
    return <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">Moyen</Badge>;
  }
  return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Faible</Badge>;
}

const triageSchema = z.object({
  sender: z.string().min(1, "Expéditeur requis"),
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

  const { data: health, isLoading: healthLoading } = useGetInboxHealth();
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
            title: "Email analysé", 
            description: `Classé comme ${result.priority} dans ${result.category}.` 
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
      <div className="p-6 max-w-[1400px] mx-auto w-full flex flex-col lg:flex-row gap-6">
        
        {/* Main Email List Area */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Boîte prioritaire</h1>
            <div className="flex items-center gap-2">
              <Dialog open={isSimulateOpen} onOpenChange={setIsSimulateOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="hidden sm:flex gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    Simuler un email
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Simuler la réception d'un email</DialogTitle>
                  </DialogHeader>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmitTriage)} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="sender"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Expéditeur</FormLabel>
                            <FormControl><Input placeholder="client@entreprise.com" {...field} /></FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="subject"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Sujet</FormLabel>
                            <FormControl><Input placeholder="Urgent: Problème de facturation" {...field} /></FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="body"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Corps du message</FormLabel>
                            <FormControl><Textarea className="h-32" placeholder="Bonjour, je n'arrive pas à payer..." {...field} /></FormControl>
                          </FormItem>
                        )}
                      />
                      <Button type="submit" className="w-full" disabled={triageEmail.isPending}>
                        {triageEmail.isPending ? "Analyse en cours..." : "Envoyer à l'IA"}
                      </Button>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>

              <Select value={filterPriority} onValueChange={setFilterPriority}>
                <SelectTrigger className="w-[180px] bg-white">
                  <SelectValue placeholder="Toutes les priorités" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les priorités</SelectItem>
                  <SelectItem value="urgent">Urgents uniquement</SelectItem>
                  <SelectItem value="moyen">Moyenne priorité</SelectItem>
                  <SelectItem value="faible">Faible priorité</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-3 gap-4 mb-6">
             <Card className="bg-destructive/5 border-destructive/20 shadow-none">
               <CardContent className="p-4">
                 <div className="text-sm font-medium text-destructive mb-1">Urgents</div>
                 <div className="text-2xl font-bold text-gray-900">
                    {summaryLoading ? <Skeleton className="h-8 w-12" /> : summary?.urgentCount || 0}
                 </div>
               </CardContent>
             </Card>
             <Card className="bg-amber-500/5 border-amber-500/20 shadow-none">
               <CardContent className="p-4">
                 <div className="text-sm font-medium text-amber-600 mb-1">Moyens</div>
                 <div className="text-2xl font-bold text-gray-900">
                    {summaryLoading ? <Skeleton className="h-8 w-12" /> : summary?.moyenCount || 0}
                 </div>
               </CardContent>
             </Card>
             <Card className="bg-emerald-500/5 border-emerald-500/20 shadow-none">
               <CardContent className="p-4">
                 <div className="text-sm font-medium text-emerald-600 mb-1">Faibles</div>
                 <div className="text-2xl font-bold text-gray-900">
                    {summaryLoading ? <Skeleton className="h-8 w-12" /> : summary?.faibleCount || 0}
                 </div>
               </CardContent>
             </Card>
          </div>

          <div className="space-y-4">
            {emailsLoading ? (
              Array(5).fill(0).map((_, i) => (
                <Card key={i} className="shadow-sm">
                  <CardContent className="p-4">
                    <Skeleton className="h-6 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-1/2 mb-4" />
                    <Skeleton className="h-12 w-full" />
                  </CardContent>
                </Card>
              ))
            ) : emails?.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg border border-border border-dashed">
                <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500 mb-3" />
                <h3 className="text-lg font-medium text-gray-900">Inbox Zero</h3>
                <p className="text-gray-500 mt-1">Tous vos emails ont été traités. Bon travail !</p>
              </div>
            ) : (
              emails?.map((email) => (
                <Card key={email.id} className={`shadow-sm transition-all ${email.status === 'unread' ? 'border-l-4 border-l-primary' : 'opacity-70'}`}>
                  <CardContent className="p-5">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-gray-900">{email.sender}</span>
                          <span className="text-sm text-gray-500 hidden sm:inline">&lt;{email.senderEmail}&gt;</span>
                          <PriorityBadge priority={email.priority} />
                          {email.categoryName && (
                            <Badge variant="secondary" className="bg-secondary text-secondary-foreground">
                              {email.categoryName}
                            </Badge>
                          )}
                        </div>
                        <h3 className={`text-lg ${email.status === 'unread' ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                          {email.subject}
                        </h3>
                      </div>
                      <div className="text-sm text-gray-500 whitespace-nowrap flex items-center gap-1 shrink-0">
                        <Clock className="w-3.5 h-3.5" />
                        {format(new Date(email.createdAt), "d MMM HH:mm", { locale: fr })}
                      </div>
                    </div>
                    
                    {email.summary && (
                      <div className="bg-secondary/50 rounded-md p-3 text-sm text-gray-700 mb-4 border border-border/50">
                        <span className="font-medium text-primary mr-2">Résumé IA :</span>
                        {email.summary}
                      </div>
                    )}
                    
                    <div className="flex justify-end gap-2">
                      {email.status === 'unread' && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleMarkAsRead(email.id)}
                          disabled={updateEmail.isPending}
                        >
                          Marquer comme lu
                        </Button>
                      )}
                      <Button variant="default" size="sm">
                        Répondre
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* Right Sidebar Area */}
        <div className="w-full lg:w-[280px] shrink-0 space-y-6">
          <Card className="shadow-sm border-t-4 border-t-primary">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                Santé de la boîte
              </CardTitle>
            </CardHeader>
            <CardContent>
              {healthLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-12 w-24" />
                  <Skeleton className="h-2 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ) : health ? (
                <div>
                  <div className="flex items-end gap-2 mb-2">
                    <span className="text-4xl font-bold text-gray-900 tracking-tighter">{health.score}</span>
                    <span className="text-sm text-gray-500 mb-1">/ 100</span>
                  </div>
                  <Progress 
                    value={health.score} 
                    className="h-2 mb-3" 
                    indicatorClassName={health.score > 80 ? "bg-emerald-500" : health.score > 50 ? "bg-amber-500" : "bg-destructive"}
                  />
                  <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-4">
                    <div className={`w-2 h-2 rounded-full ${health.score > 80 ? "bg-emerald-500" : health.score > 50 ? "bg-amber-500" : "bg-destructive"}`} />
                    {health.label}
                  </div>

                  {health.urgentUnread > 0 && (
                    <div className="flex items-start gap-2 p-3 bg-destructive/10 rounded-md text-sm text-destructive border border-destructive/20 mb-3">
                      <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
                      <div>
                        <strong>{health.urgentUnread} emails urgents</strong> attendent votre réponse.
                      </div>
                    </div>
                  )}
                  
                  {health.oldestUnanswered && (
                    <div className="flex items-start gap-2 p-3 bg-secondary rounded-md text-sm text-gray-700 border border-border">
                      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
                      <div>
                        L'email le plus ancien date du <br/>
                        <span className="font-medium">{format(new Date(health.oldestUnanswered), "dd/MM/yyyy")}</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                Catégories
              </CardTitle>
            </CardHeader>
            <CardContent>
              {categoriesLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : (
                <div className="space-y-2">
                  {categoryCounts?.map((cat) => (
                    <div key={cat.categoryId} className="flex items-center justify-between p-2 hover:bg-secondary rounded-md transition-colors group cursor-pointer">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-primary/40 group-hover:bg-primary transition-colors" />
                        <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">{cat.categoryName}</span>
                      </div>
                      <Badge variant="secondary" className="bg-white border border-border shadow-sm text-xs font-normal">
                        {cat.count}
                      </Badge>
                    </div>
                  ))}
                  {categoryCounts?.length === 0 && (
                    <p className="text-sm text-gray-500 italic">Aucune catégorie trouvée.</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
