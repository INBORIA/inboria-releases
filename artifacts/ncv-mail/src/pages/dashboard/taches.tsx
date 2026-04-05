import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useListTasks, useUpdateTask, useDeleteTask, getListTasksQueryKey } from "@workspace/api-client-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Calendar, Mail, CheckSquare, Clock, Trash2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

export default function Taches() {
  const [filter, setFilter] = useState<string>("pending");
  const queryClient = useQueryClient();

  const { data: tasks, isLoading } = useListTasks({
    status: filter as any,
  });

  const { toast } = useToast();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const handleToggleTask = (id: string, currentDone: boolean) => {
    updateTask.mutate(
      { id, data: { done: !currentDone } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
        },
      }
    );
  };

  const handleDeleteTask = (id: string) => {
    deleteTask.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
          toast({ title: "Tache supprimee" });
        },
        onError: () => {
          toast({ variant: "destructive", title: "Erreur", description: "Impossible de supprimer la tache." });
        },
      }
    );
  };

  return (
    <DashboardLayout>
      <div className="p-6 max-w-4xl mx-auto w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl font-semibold text-white tracking-tight">Taches extraites</h1>
            <p className="text-[13px] text-[#8b9cb3] mt-1">Actions identifiees automatiquement depuis vos emails.</p>
          </div>
        </div>

        <Tabs defaultValue={filter} onValueChange={setFilter} className="mb-5">
          <TabsList className="bg-card border border-border p-0.5 h-9">
            <TabsTrigger value="pending" className="data-[state=active]:bg-primary data-[state=active]:text-white text-[#8b9cb3] text-[13px] h-7 px-3">A faire</TabsTrigger>
            <TabsTrigger value="done" className="data-[state=active]:bg-primary data-[state=active]:text-white text-[#8b9cb3] text-[13px] h-7 px-3">Terminees</TabsTrigger>
            <TabsTrigger value="all" className="data-[state=active]:bg-primary data-[state=active]:text-white text-[#8b9cb3] text-[13px] h-7 px-3">Toutes</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="space-y-1.5">
          {isLoading ? (
            Array(4).fill(0).map((_, i) => (
              <div key={i} className="bg-card rounded-lg border border-border p-4 flex items-center gap-4">
                <Skeleton className="w-5 h-5 rounded bg-white/5" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-3/4 mb-2 bg-white/5" />
                  <Skeleton className="h-3 w-1/4 bg-white/5" />
                </div>
              </div>
            ))
          ) : tasks?.length === 0 ? (
            <div className="text-center py-20 rounded-lg border border-border border-dashed bg-card/50">
              <CheckSquare className="mx-auto h-12 w-12 text-[#8b9cb3]/20 mb-3" />
              <h3 className="text-sm font-medium text-white mb-1">Aucune tache</h3>
              <p className="text-[13px] text-[#8b9cb3]">Les taches seront creees automatiquement a partir de vos emails.</p>
            </div>
          ) : (
            tasks?.map((task) => (
              <div 
                key={task.id} 
                className={`bg-card rounded-lg border border-border p-4 flex items-start gap-4 transition-all hover:bg-[#1a2235] ${task.done ? 'opacity-50' : ''}`}
              >
                <div className="mt-0.5">
                  <Checkbox 
                    checked={task.done} 
                    onCheckedChange={() => handleToggleTask(task.id, task.done)}
                    className="w-4 h-4 border-[#8b9cb3]/40 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-[13px] font-medium text-white mb-1.5 ${task.done ? 'line-through text-[#8b9cb3]' : ''}`}>
                    {task.title}
                  </p>
                  
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#8b9cb3]">
                    {task.dueDate && (
                      <div className={`flex items-center gap-1 ${new Date(task.dueDate) < new Date() && !task.done ? 'text-red-400' : ''}`}>
                        <Calendar className="w-3 h-3" />
                        <span>{format(new Date(task.dueDate), "dd MMM yyyy", { locale: fr })}</span>
                      </div>
                    )}
                    
                    {task.emailSubject && (
                      <div className="flex items-center gap-1 max-w-full">
                        <Mail className="w-3 h-3 shrink-0" />
                        <span className="truncate max-w-[200px] sm:max-w-[300px]">{task.emailSubject}</span>
                      </div>
                    )}
                    
                    {!task.dueDate && !task.emailSubject && (
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>Creee le {format(new Date(task.createdAt), "dd/MM/yyyy")}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {task.done && (
                    <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[11px] hidden sm:inline-flex">
                      Terminee
                    </Badge>
                  )}
                  <button
                    onClick={() => handleDeleteTask(task.id)}
                    className="p-1.5 rounded-md text-[#8b9cb3] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    title="Supprimer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
