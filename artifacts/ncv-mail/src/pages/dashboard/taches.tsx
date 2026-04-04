import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useListTasks, useUpdateTask, getListTasksQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Calendar, Mail, CheckCircle2, Clock } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";

export default function Taches() {
  const [filter, setFilter] = useState<string>("pending");
  const queryClient = useQueryClient();

  const { data: tasks, isLoading } = useListTasks({
    status: filter as any,
  });

  const updateTask = useUpdateTask();

  const handleToggleTask = (id: number, currentDone: boolean) => {
    updateTask.mutate(
      { id, data: { done: !currentDone } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
        },
      }
    );
  };

  return (
    <DashboardLayout>
      <div className="p-6 max-w-4xl mx-auto w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Tâches extraites</h1>
            <p className="text-gray-500 mt-1">Actions identifiées automatiquement depuis vos emails.</p>
          </div>
        </div>

        <Tabs defaultValue={filter} onValueChange={setFilter} className="mb-6">
          <TabsList className="bg-secondary p-1">
            <TabsTrigger value="pending" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">À faire</TabsTrigger>
            <TabsTrigger value="done" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Terminées</TabsTrigger>
            <TabsTrigger value="all" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Toutes</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="space-y-3">
          {isLoading ? (
            Array(4).fill(0).map((_, i) => (
              <Card key={i} className="shadow-sm">
                <CardContent className="p-4 flex items-center gap-4">
                  <Skeleton className="w-5 h-5 rounded" />
                  <div className="flex-1">
                    <Skeleton className="h-5 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-1/4" />
                  </div>
                </CardContent>
              </Card>
            ))
          ) : tasks?.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-lg border border-border border-dashed">
              <CheckCircle2 className="mx-auto h-12 w-12 text-gray-300 mb-3" />
              <h3 className="text-lg font-medium text-gray-900">Aucune tâche</h3>
              <p className="text-gray-500 mt-1">Vous n'avez aucune tâche correspondant à ce filtre.</p>
            </div>
          ) : (
            tasks?.map((task) => (
              <Card 
                key={task.id} 
                className={`shadow-sm transition-all duration-200 ${task.done ? 'bg-secondary/50 opacity-60' : 'hover:shadow-md'}`}
              >
                <CardContent className="p-4 flex items-start gap-4">
                  <div className="mt-1">
                    <Checkbox 
                      checked={task.done} 
                      onCheckedChange={() => handleToggleTask(task.id, task.done)}
                      className={`w-5 h-5 ${task.done ? 'data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500' : ''}`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-base font-medium text-gray-900 mb-1.5 ${task.done ? 'line-through text-gray-500' : ''}`}>
                      {task.title}
                    </p>
                    
                    <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                      {task.dueDate && (
                        <div className={`flex items-center gap-1.5 ${new Date(task.dueDate) < new Date() && !task.done ? 'text-destructive font-medium' : ''}`}>
                          <Calendar className="w-3.5 h-3.5" />
                          <span>Echéance : {format(new Date(task.dueDate), "dd MMM yyyy", { locale: fr })}</span>
                        </div>
                      )}
                      
                      {task.emailSubject && (
                        <div className="flex items-center gap-1.5 max-w-full">
                          <Mail className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate max-w-[200px] sm:max-w-[300px]">
                            Email : {task.emailSubject}
                          </span>
                        </div>
                      )}
                      
                      {!task.dueDate && !task.emailSubject && (
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Créée le {format(new Date(task.createdAt), "dd/MM/yyyy")}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {task.done && (
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200 ml-auto shrink-0 hidden sm:inline-flex">
                      Terminée
                    </Badge>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
