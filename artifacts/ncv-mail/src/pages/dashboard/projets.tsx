import { DashboardLayout } from "@/components/layout/dashboard-layout";
import {
  useListProjects,
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
  useGetProject,
  getListProjectsQueryKey,
  getGetProjectQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FolderKanban,
  Plus,
  MoreVertical,
  Edit2,
  Trash2,
  ArrowLeft,
  Mail,
  CheckSquare,
  Clock,
  Hash,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const projectSchema = z.object({
  name: z.string().min(2, "Le nom doit contenir au moins 2 caracteres"),
  reference: z.string().optional(),
  description: z.string().optional(),
  status: z.string().optional(),
  color: z.string().optional(),
});

type ProjectFormValues = z.infer<typeof projectSchema>;

const PROJECT_COLORS = [
  { value: "blue", label: "Bleu", class: "bg-blue-500" },
  { value: "green", label: "Vert", class: "bg-emerald-500" },
  { value: "purple", label: "Violet", class: "bg-purple-500" },
  { value: "amber", label: "Ambre", class: "bg-amber-500" },
  { value: "red", label: "Rouge", class: "bg-red-500" },
  { value: "cyan", label: "Cyan", class: "bg-cyan-500" },
  { value: "pink", label: "Rose", class: "bg-pink-500" },
  { value: "indigo", label: "Indigo", class: "bg-indigo-500" },
];

const STATUS_LABELS: Record<string, { label: string; class: string }> = {
  actif: { label: "Actif", class: "bg-emerald-500/10 text-emerald-400" },
  termine: { label: "Termine", class: "bg-[#8b9cb3]/10 text-[#8b9cb3]" },
  en_pause: { label: "En pause", class: "bg-amber-500/10 text-amber-400" },
};

function getColorClass(color: string) {
  return PROJECT_COLORS.find((c) => c.value === color)?.class || "bg-blue-500";
}

function ProjectDetailView({
  projectId,
  onBack,
}: {
  projectId: string;
  onBack: () => void;
}) {
  const { data: project, isLoading } = useGetProject(projectId);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="p-5 max-w-5xl mx-auto w-full">
          <Skeleton className="h-6 w-48 bg-white/5 mb-3" />
          <Skeleton className="h-48 w-full bg-white/5" />
        </div>
      </DashboardLayout>
    );
  }

  if (!project) {
    return (
      <DashboardLayout>
        <div className="p-5 max-w-5xl mx-auto w-full">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="text-[#8b9cb3] hover:text-white mb-3 gap-1.5 h-7 text-[12px]"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Retour
          </Button>
          <p className="text-[12px] text-[#8b9cb3]">Projet introuvable.</p>
        </div>
      </DashboardLayout>
    );
  }

  const statusInfo = STATUS_LABELS[project.status] || STATUS_LABELS.actif;
  const pendingTasks = (project.tasks || []).filter(
    (t: any) => !t.done
  ).length;
  const doneTasks = (project.tasks || []).filter((t: any) => t.done).length;

  return (
    <DashboardLayout>
      <div className="p-5 max-w-5xl mx-auto w-full">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="text-[#8b9cb3] hover:text-white mb-3 gap-1.5 h-7 text-[12px]"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Retour aux projets
        </Button>

        <div className="flex items-start gap-3 mb-5">
          <div
            className={`w-10 h-10 rounded-lg ${getColorClass(project.color)} flex items-center justify-center text-white font-bold text-[15px] shrink-0`}
          >
            {project.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h1 className="text-[16px] font-semibold text-white truncate">
                {project.name}
              </h1>
              <span
                className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${statusInfo.class}`}
              >
                {statusInfo.label}
              </span>
            </div>
            <div className="flex items-center gap-2.5 text-[12px] text-[#8b9cb3]">
              <span className="flex items-center gap-1">
                <Hash className="w-3 h-3" /> {project.reference}
              </span>
              {project.description && (
                <span className="truncate">{project.description}</span>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-5">
          <div className="bg-card rounded-lg border border-border p-3">
            <div className="flex items-center gap-1.5 text-[#8b9cb3] mb-0.5">
              <Mail className="w-3.5 h-3.5" />
              <span className="text-[11px]">Emails</span>
            </div>
            <p className="text-xl font-semibold text-white">
              {(project.emails || []).length}
            </p>
          </div>
          <div className="bg-card rounded-lg border border-border p-3">
            <div className="flex items-center gap-1.5 text-[#8b9cb3] mb-0.5">
              <CheckSquare className="w-3.5 h-3.5" />
              <span className="text-[11px]">Taches terminees</span>
            </div>
            <p className="text-xl font-semibold text-white">
              {doneTasks}/{(project.tasks || []).length}
            </p>
          </div>
          <div className="bg-card rounded-lg border border-border p-3">
            <div className="flex items-center gap-1.5 text-amber-400 mb-0.5">
              <Clock className="w-3.5 h-3.5" />
              <span className="text-[11px]">En attente</span>
            </div>
            <p className="text-xl font-semibold text-white">{pendingTasks}</p>
          </div>
        </div>

        {(project.emails || []).length > 0 && (
          <div className="mb-4">
            <h2 className="text-[13px] font-semibold text-white mb-2 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-primary" /> Emails lies ({project.emails.length})
            </h2>
            <div className="space-y-1">
              {project.emails.map((email: any) => {
                const barColors: Record<string, string> = {
                  urgent: "bg-red-500",
                  moyen: "bg-amber-500",
                  faible: "bg-emerald-500",
                };
                return (
                  <div
                    key={email.id}
                    className="flex items-stretch bg-card border border-border rounded-lg overflow-hidden"
                  >
                    <div className={`w-1 shrink-0 ${barColors[email.priority] || barColors.faible}`} />
                    <div className="flex items-center gap-2.5 flex-1 min-w-0 px-3 py-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] text-white truncate">{email.subject}</p>
                        <p className="text-[10px] text-[#8b9cb3]">{email.sender}</p>
                      </div>
                      <span className="text-[10px] text-[#8b9cb3] shrink-0">
                        {new Date(email.createdAt).toLocaleDateString("fr-FR")}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {(project.tasks || []).length > 0 && (
          <div>
            <h2 className="text-[13px] font-semibold text-white mb-2 flex items-center gap-1.5">
              <CheckSquare className="w-3.5 h-3.5 text-primary" /> Taches ({project.tasks.length})
            </h2>
            <div className="space-y-1">
              {project.tasks.map((task: any) => (
                <div
                  key={task.id}
                  className="bg-card border border-border rounded-lg px-3 py-2 flex items-center gap-2.5"
                >
                  <div
                    className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${task.done ? "bg-primary border-primary" : "border-[#8b9cb3]/30"}`}
                  >
                    {task.done && (
                      <CheckSquare className="w-2.5 h-2.5 text-white" />
                    )}
                  </div>
                  <p
                    className={`text-[12px] flex-1 ${task.done ? "line-through text-[#8b9cb3]" : "text-white"}`}
                  >
                    {task.title}
                  </p>
                  {task.emailSubject && (
                    <span className="text-[10px] text-[#8b9cb3] truncate max-w-[180px]">
                      {task.emailSubject}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {(project.emails || []).length === 0 &&
          (project.tasks || []).length === 0 && (
            <div className="text-center py-12 rounded-lg border border-border border-dashed bg-card/50">
              <FolderKanban className="mx-auto h-8 w-8 text-[#8b9cb3]/20 mb-2" />
              <p className="text-[12px] text-[#8b9cb3]">
                Aucun email ou tache lie a ce projet pour le moment.
              </p>
              <p className="text-[11px] text-[#8b9cb3]/60 mt-0.5">
                Attribuez des emails a ce projet depuis la boite de reception.
              </p>
            </div>
          )}
      </div>
    </DashboardLayout>
  );
}

export default function Projets() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: projects, isLoading } = useListProjects();
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editProject, setEditProject] = useState<any>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null
  );

  const createForm = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: "",
      reference: "",
      description: "",
      status: "actif",
      color: "blue",
    },
  });

  const editForm = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
  });

  const handleOpenEdit = (project: any) => {
    setEditProject(project);
    editForm.reset({
      name: project.name,
      reference: project.reference,
      description: project.description || "",
      status: project.status,
      color: project.color,
    });
  };

  const onSubmitCreate = (data: ProjectFormValues) => {
    createProject.mutate(
      {
        data: {
          name: data.name,
          reference: data.reference || undefined,
          description: data.description || undefined,
          status: data.status || "actif",
          color: data.color || "blue",
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getListProjectsQueryKey(),
          });
          setIsCreateOpen(false);
          createForm.reset();
          toast({ title: "Projet cree" });
        },
      }
    );
  };

  const onSubmitEdit = (data: ProjectFormValues) => {
    if (!editProject) return;
    updateProject.mutate(
      {
        id: editProject.id,
        data: {
          name: data.name,
          reference: data.reference || undefined,
          description: data.description || undefined,
          status: data.status,
          color: data.color,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getListProjectsQueryKey(),
          });
          queryClient.invalidateQueries({
            queryKey: getGetProjectQueryKey(editProject.id),
          });
          setEditProject(null);
          toast({ title: "Projet modifie" });
        },
      }
    );
  };

  const handleDelete = (id: string) => {
    deleteProject.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getListProjectsQueryKey(),
          });
          toast({ title: "Projet supprime" });
        },
      }
    );
  };

  if (selectedProjectId) {
    return (
      <ProjectDetailView
        projectId={selectedProjectId}
        onBack={() => setSelectedProjectId(null)}
      />
    );
  }

  const activeProjects = (projects || []).filter(
    (p: any) => p.status === "actif"
  );
  const otherProjects = (projects || []).filter(
    (p: any) => p.status !== "actif"
  );

  return (
    <DashboardLayout>
      <div className="p-5 max-w-5xl mx-auto w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div>
            <h1 className="text-[16px] font-semibold text-white tracking-tight">
              Gestion de projets
            </h1>
            <p className="text-[12px] text-[#8b9cb3] mt-0.5">
              Organisez vos emails et taches par projet avec une reference
              unique.
            </p>
          </div>
          <Button
            size="sm"
            className="shrink-0 gap-2"
            onClick={() => {
              createForm.reset({
                name: "",
                reference: "",
                description: "",
                status: "actif",
                color: "blue",
              });
              setIsCreateOpen(true);
            }}
          >
            <Plus className="w-3.5 h-3.5" />
            Nouveau projet
          </Button>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-white">
                Creer un projet
              </DialogTitle>
            </DialogHeader>
            <Form {...createForm}>
              <form
                onSubmit={createForm.handleSubmit(onSubmitCreate)}
                className="space-y-4"
              >
                <FormField
                  control={createForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[#8b9cb3]">
                        Nom du projet
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ex: Renovation Dupont, Site web client..."
                          className="bg-background border-border text-white"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="reference"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[#8b9cb3]">
                        Reference (optionnel)
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Auto: PROJ-001, ou personnalise: REF-2026-DUPONT"
                          className="bg-background border-border text-white"
                          {...field}
                        />
                      </FormControl>
                      <p className="text-[11px] text-[#8b9cb3]/60">
                        Laissez vide pour une reference automatique
                      </p>
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[#8b9cb3]">
                        Description
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Description du projet..."
                          className="resize-none h-20 bg-background border-border text-white"
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={createForm.control}
                    name="color"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[#8b9cb3]">
                          Couleur
                        </FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="bg-background border-border text-white">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-card border-border">
                            {PROJECT_COLORS.map((c) => (
                              <SelectItem key={c.value} value={c.value}>
                                <div className="flex items-center gap-2">
                                  <div
                                    className={`w-3 h-3 rounded-full ${c.class}`}
                                  />
                                  {c.label}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[#8b9cb3]">Statut</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="bg-background border-border text-white">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-card border-border">
                            <SelectItem value="actif">Actif</SelectItem>
                            <SelectItem value="en_pause">En pause</SelectItem>
                            <SelectItem value="termine">Termine</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={createProject.isPending}>
                    {createProject.isPending ? "Creation..." : "Creer"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <Dialog
          open={!!editProject}
          onOpenChange={(open) => !open && setEditProject(null)}
        >
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-white">
                Modifier le projet
              </DialogTitle>
            </DialogHeader>
            <Form {...editForm}>
              <form
                onSubmit={editForm.handleSubmit(onSubmitEdit)}
                className="space-y-4"
              >
                <FormField
                  control={editForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[#8b9cb3]">Nom</FormLabel>
                      <FormControl>
                        <Input
                          className="bg-background border-border text-white"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="reference"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[#8b9cb3]">
                        Reference
                      </FormLabel>
                      <FormControl>
                        <Input
                          className="bg-background border-border text-white"
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[#8b9cb3]">
                        Description
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          className="resize-none h-20 bg-background border-border text-white"
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={editForm.control}
                    name="color"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[#8b9cb3]">
                          Couleur
                        </FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="bg-background border-border text-white">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-card border-border">
                            {PROJECT_COLORS.map((c) => (
                              <SelectItem key={c.value} value={c.value}>
                                <div className="flex items-center gap-2">
                                  <div
                                    className={`w-3 h-3 rounded-full ${c.class}`}
                                  />
                                  {c.label}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[#8b9cb3]">Statut</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="bg-background border-border text-white">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-card border-border">
                            <SelectItem value="actif">Actif</SelectItem>
                            <SelectItem value="en_pause">En pause</SelectItem>
                            <SelectItem value="termine">Termine</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={updateProject.isPending}>
                    {updateProject.isPending
                      ? "Enregistrement..."
                      : "Enregistrer"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array(3)
              .fill(0)
              .map((_, i) => (
                <div
                  key={i}
                  className="bg-card rounded-lg border border-border p-5"
                >
                  <Skeleton className="w-10 h-10 rounded-xl bg-white/5 mb-3" />
                  <Skeleton className="h-5 w-3/4 mb-2 bg-white/5" />
                  <Skeleton className="h-4 w-full bg-white/5" />
                </div>
              ))}
          </div>
        ) : (projects || []).length === 0 ? (
          <div className="text-center py-20 rounded-lg border border-border border-dashed bg-card/50">
            <FolderKanban className="mx-auto h-12 w-12 text-[#8b9cb3]/20 mb-3" />
            <h3 className="text-sm font-medium text-white mb-1">
              Aucun projet
            </h3>
            <p className="text-[13px] text-[#8b9cb3] mb-4">
              Creez des projets pour organiser vos emails et taches par dossier.
            </p>
            <Button
              onClick={() => setIsCreateOpen(true)}
              size="sm"
              className="gap-2"
            >
              <Plus className="w-3.5 h-3.5" />
              Creer le premier projet
            </Button>
          </div>
        ) : (
          <>
            {activeProjects.length > 0 && (
              <div className="mb-6">
                <h2 className="text-[13px] font-medium text-[#8b9cb3] uppercase tracking-wider mb-3">
                  Projets actifs ({activeProjects.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {activeProjects.map((project: any) =>
                    renderProjectCard(project)
                  )}
                </div>
              </div>
            )}
            {otherProjects.length > 0 && (
              <div>
                <h2 className="text-[13px] font-medium text-[#8b9cb3] uppercase tracking-wider mb-3">
                  Autres ({otherProjects.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {otherProjects.map((project: any) =>
                    renderProjectCard(project)
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );

  function renderProjectCard(project: any) {
    const statusInfo =
      STATUS_LABELS[project.status] || STATUS_LABELS.actif;
    return (
      <div
        key={project.id}
        className="bg-card rounded-lg border border-border p-5 hover:border-primary/30 transition-colors group cursor-pointer"
        onClick={() => setSelectedProjectId(project.id)}
      >
        <div className="flex justify-between items-start mb-3">
          <div
            className={`w-10 h-10 rounded-xl ${getColorClass(project.color)} flex items-center justify-center text-white font-bold text-sm`}
          >
            {project.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${statusInfo.class}`}
            >
              {statusInfo.label}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-[#8b9cb3] opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/[0.06]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-card border-border">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenEdit(project);
                  }}
                  className="gap-2 cursor-pointer text-[#8b9cb3] hover:text-white"
                >
                  <Edit2 className="h-3.5 w-3.5" /> Modifier
                </DropdownMenuItem>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem
                      onSelect={(e) => e.preventDefault()}
                      onClick={(e) => e.stopPropagation()}
                      className="gap-2 text-red-400 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Supprimer
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                  <AlertDialogContent
                    className="bg-card border-border"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-white">
                        Supprimer ce projet ?
                      </AlertDialogTitle>
                      <AlertDialogDescription className="text-[#8b9cb3]">
                        Le projet "{project.name}" sera supprime. Les emails
                        et taches associes seront delies.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="bg-background border-border text-[#8b9cb3] hover:bg-white/[0.04]">
                        Annuler
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDelete(project.id)}
                        className="bg-red-500 text-white hover:bg-red-600"
                      >
                        Supprimer
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <h3 className="text-[14px] font-semibold text-white mb-0.5 truncate">
          {project.name}
        </h3>
        <p className="text-[11px] text-primary/80 font-mono mb-2">
          {project.reference}
        </p>
        {project.description && (
          <p className="text-[12px] text-[#8b9cb3] line-clamp-2 mb-3">
            {project.description}
          </p>
        )}

        <div className="flex items-center gap-3 text-[12px]">
          <span className="flex items-center gap-1 text-[#8b9cb3] bg-white/[0.04] px-2 py-1 rounded-md">
            <Mail className="w-3 h-3" />
            <span className="text-primary font-medium">
              {project.emailCount}
            </span>{" "}
            emails
          </span>
          <span className="flex items-center gap-1 text-[#8b9cb3] bg-white/[0.04] px-2 py-1 rounded-md">
            <CheckSquare className="w-3 h-3" />
            <span className="text-primary font-medium">
              {project.pendingTaskCount}
            </span>{" "}
            taches
          </span>
        </div>
      </div>
    );
  }
}
