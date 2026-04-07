import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { EmailBodyRenderer } from "@/components/EmailBodyRenderer";
import {
  useListEmails,
  useListCategories,
  useUpdateEmail,
  useDeleteEmail,
  useListProjects,
  getListEmailsQueryKey,
  getGetCategoryCountsQueryKey,
  getGetInboxHealthQueryKey,
  getGetDashboardSummaryQueryKey,
} from "@workspace/api-client-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { Archive, Clock, ArrowLeft, Trash2, RotateCcw, ChevronRight, FolderOpen, Sparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const PRIORITY_BAR_COLORS: Record<string, string> = {
  urgent: "bg-red-500",
  moyen: "bg-amber-500",
  faible: "bg-emerald-500",
};

const PRIORITY_BADGE_STYLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  urgent: { bg: "bg-red-500/15", text: "text-red-400", border: "border-red-500/20", label: "Urgent" },
  moyen: { bg: "bg-amber-500/15", text: "text-amber-400", border: "border-amber-500/20", label: "Moyen" },
  faible: { bg: "bg-emerald-500/15", text: "text-emerald-400", border: "border-emerald-500/20", label: "Faible" },
};

function PriorityBadge({ priority }: { priority: string }) {
  const ps = PRIORITY_BADGE_STYLES[priority] || PRIORITY_BADGE_STYLES.faible;
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium border ${ps.bg} ${ps.text} ${ps.border}`}>
      {ps.label}
    </span>
  );
}

const categoryColors = [
  "bg-blue-500/10 text-blue-400 border-blue-500/20",
  "bg-purple-500/10 text-purple-400 border-purple-500/20",
  "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  "bg-amber-500/10 text-amber-400 border-amber-500/20",
  "bg-red-500/10 text-red-400 border-red-500/20",
  "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  "bg-pink-500/10 text-pink-400 border-pink-500/20",
  "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
];

function ArchivedEmailDetail({ email, onBack, onRestore, onDelete, onUpdatePriority, onUpdateCategory, onUpdateProject, categories, projects }: {
  email: any;
  onBack: () => void;
  onRestore: (id: number) => void;
  onDelete: (id: number) => void;
  onUpdatePriority: (id: number, priority: string) => void;
  onUpdateCategory: (id: number, categoryId: string) => void;
  onUpdateProject: (id: number, projectId: string) => void;
  categories: any[];
  projects: any[];
}) {
  const barColor = PRIORITY_BAR_COLORS[email.priority] || PRIORITY_BAR_COLORS.faible;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 mb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="h-7 px-2 text-[#8b9cb3] hover:text-white hover:bg-white/[0.06] text-[12px]"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1" />
          Retour
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
                    {email.senderEmail && (
                      <div className="text-[10px] text-[#8b9cb3]">{email.senderEmail}</div>
                    )}
                  </div>
                </div>
                <span className="text-[10px] text-[#8b9cb3] flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {format(new Date(email.createdAt), "d MMMM yyyy a HH:mm", { locale: fr })}
                </span>
              </div>
            </div>

            {email.summary && (
              <div className="px-4 py-2.5 bg-primary/[0.06] border-b border-border">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Sparkles className="w-3 h-3 text-primary" />
                  <span className="text-[10px] font-medium text-primary uppercase tracking-wider">Resume IA</span>
                </div>
                <p className="text-[12px] text-[#8b9cb3] leading-relaxed">{email.summary}</p>
              </div>
            )}

            <div className="p-4">
              <EmailBodyRenderer body={email.body} />
            </div>

            <div className="px-4 py-3 border-t border-border">
              <div className="flex items-center gap-1.5 mb-2.5">
                <Button
                  size="sm"
                  className="gap-1.5 h-7 text-[11px]"
                  onClick={() => onRestore(email.id)}
                >
                  <RotateCcw className="w-3 h-3" />
                  Restaurer dans la réception
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 h-7 text-[11px] bg-transparent border-border text-red-400/70 hover:text-red-400 hover:bg-red-500/[0.08]"
                  onClick={() => onDelete(email.id)}
                >
                  <Trash2 className="w-3 h-3" />
                  Supprimer
                </Button>
              </div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-[#8b9cb3] uppercase tracking-wider">Priorite:</span>
                  <Select value={email.priority} onValueChange={(val) => onUpdatePriority(email.id, val)}>
                    <SelectTrigger className="w-[100px] h-6 bg-card border-border text-[11px] text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="urgent">Urgent</SelectItem>
                      <SelectItem value="moyen">Moyen</SelectItem>
                      <SelectItem value="faible">Faible</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-[#8b9cb3] uppercase tracking-wider">Categorie:</span>
                  <Select value={email.categoryId?.toString() || "none"} onValueChange={(val) => onUpdateCategory(email.id, val)}>
                    <SelectTrigger className="w-[130px] h-6 bg-card border-border text-[11px] text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="none">Non classe</SelectItem>
                      {categories.map((cat: any) => (
                        <SelectItem key={cat.id} value={cat.id.toString()}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-[#8b9cb3] uppercase tracking-wider">Projet:</span>
                  <Select value={email.projectId || "none"} onValueChange={(val) => onUpdateProject(email.id, val)}>
                    <SelectTrigger className="w-[140px] h-6 bg-card border-border text-[11px] text-white">
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
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Archives() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedEmailId, setSelectedEmailId] = useState<number | null>(null);

  const { data: allEmails, isLoading: emailsLoading } = useListEmails();
  const { data: categories } = useListCategories();
  const { data: projects } = useListProjects();
  const updateEmail = useUpdateEmail();
  const deleteEmail = useDeleteEmail();

  const archivedEmails = allEmails?.filter((e) => e.status === "archived") || [];

  const emailsByCategory: Record<string, typeof archivedEmails> = {};
  const uncategorized: typeof archivedEmails = [];

  archivedEmails.forEach((email) => {
    const catName = email.categoryName || null;
    if (catName) {
      if (!emailsByCategory[catName]) emailsByCategory[catName] = [];
      emailsByCategory[catName].push(email);
    } else {
      uncategorized.push(email);
    }
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getListEmailsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetCategoryCountsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetInboxHealthQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
  };

  const handleRestore = (id: number) => {
    updateEmail.mutate(
      { id, data: { status: "non_lu" } },
      {
        onSuccess: () => {
          setSelectedEmailId(null);
          invalidateAll();
          toast({ title: "Email restauré dans la réception" });
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
      }
    );
  };

  const handleUpdatePriority = (id: number, priority: string) => {
    updateEmail.mutate(
      { id, data: { priority } },
      {
        onSuccess: () => {
          invalidateAll();
          toast({ title: `Priorite changee en ${priority}` });
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
          toast({ title: "Categorie mise a jour" });
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
          toast({ title: "Projet mis a jour" });
        },
      }
    );
  };

  const selectedEmail = archivedEmails.find((e) => e.id === selectedEmailId);

  if (selectedEmail) {
    return (
      <DashboardLayout>
        <div className="p-5 max-w-[900px] mx-auto w-full">
          <ArchivedEmailDetail
            email={selectedEmail}
            onBack={() => setSelectedEmailId(null)}
            onRestore={handleRestore}
            onDelete={handleDelete}
            onUpdatePriority={handleUpdatePriority}
            onUpdateCategory={handleUpdateCategory}
            onUpdateProject={handleUpdateProject}
            categories={categories || []}
            projects={projects || []}
          />
        </div>
      </DashboardLayout>
    );
  }

  const categoryList = Object.keys(emailsByCategory).sort();
  if (uncategorized.length > 0) categoryList.push("Non classe");

  const selectedEmails = selectedCategory === "Non classe"
    ? uncategorized
    : selectedCategory
      ? emailsByCategory[selectedCategory] || []
      : null;

  if (selectedCategory && selectedEmails) {
    return (
      <DashboardLayout>
        <div className="p-5 max-w-[900px] mx-auto w-full">
          <div className="flex items-center gap-3 mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedCategory(null)}
              className="h-7 px-2 text-[#8b9cb3] hover:text-white hover:bg-white/[0.06] text-[12px]"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              Archives
            </Button>
            <div className="flex-1" />
            <span className="text-[11px] text-[#8b9cb3]">{selectedEmails.length} email(s)</span>
          </div>

          <h2 className="text-[15px] font-semibold text-white mb-3">{selectedCategory}</h2>

          <div className="space-y-1">
            {selectedEmails.length === 0 ? (
              <div className="text-center py-12 rounded-lg border border-border border-dashed bg-card/50">
                <FolderOpen className="mx-auto h-8 w-8 text-[#8b9cb3]/40 mb-2" />
                <p className="text-[12px] text-[#8b9cb3]">Aucun email dans cette categorie</p>
              </div>
            ) : (
              selectedEmails.map((email) => {
                const barColor = PRIORITY_BAR_COLORS[email.priority] || PRIORITY_BAR_COLORS.faible;
                return (
                  <div
                    key={email.id}
                    className="group flex items-stretch rounded-lg border border-border bg-card hover:bg-[#1a2235] transition-colors cursor-pointer overflow-hidden"
                    onClick={() => setSelectedEmailId(email.id)}
                  >
                    <div className={`w-1 shrink-0 ${barColor}`} />
                    <div className="flex items-start gap-3 flex-1 min-w-0 p-3">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-[12px] shrink-0 mt-0.5">
                        {(email.sender || "?")[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-semibold text-[12px] text-white truncate">{email.sender}</span>
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
                        <PriorityBadge priority={email.priority} />
                        <span className="text-[10px] text-[#8b9cb3] flex items-center gap-1 hidden sm:flex">
                          <Clock className="w-3 h-3" />
                          {format(new Date(email.createdAt), "d MMM HH:mm", { locale: fr })}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRestore(email.id); }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-white/[0.08] text-[#8b9cb3] hover:text-white"
                          title="Restaurer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                        <ChevronRight className="w-3.5 h-3.5 text-[#8b9cb3]/40 group-hover:text-[#8b9cb3] transition-colors" />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-5 max-w-5xl mx-auto w-full">
        <div className="mb-5">
          <h1 className="text-[16px] font-semibold text-white tracking-tight">Archives</h1>
          <p className="text-[12px] text-[#8b9cb3] mt-0.5">
            Emails classes automatiquement par l'IA. {archivedEmails.length} email(s) archives.
          </p>
        </div>

        {emailsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {Array(6).fill(0).map((_, i) => (
              <div key={i} className="bg-card rounded-lg border border-border p-4">
                <Skeleton className="w-7 h-7 rounded-lg bg-white/5 mb-2" />
                <Skeleton className="h-4 w-3/4 mb-1.5 bg-white/5" />
                <Skeleton className="h-3 w-1/2 bg-white/5" />
              </div>
            ))}
          </div>
        ) : archivedEmails.length === 0 ? (
          <div className="text-center py-16 rounded-lg border border-border border-dashed bg-card/50">
            <Archive className="mx-auto h-8 w-8 text-[#8b9cb3]/20 mb-2" />
            <h3 className="text-[13px] font-medium text-white mb-1">Aucune archive</h3>
            <p className="text-[12px] text-[#8b9cb3]">Les emails archives apparaitront ici.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {categoryList.map((catName, i) => {
              const count = catName === "Non classe" ? uncategorized.length : emailsByCategory[catName]?.length || 0;
              return (
                <div
                  key={catName}
                  className="bg-card rounded-lg border border-border p-4 hover:border-primary/30 transition-colors cursor-pointer group"
                  onClick={() => setSelectedCategory(catName)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${categoryColors[i % categoryColors.length]}`}>
                      <FolderOpen className="w-3.5 h-3.5" />
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-[#8b9cb3] opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <h3 className="text-[13px] font-semibold text-white mb-0.5">{catName}</h3>
                  <div className="flex items-center text-[11px] text-[#8b9cb3] bg-white/[0.04] px-2 py-0.5 rounded-md inline-flex w-fit">
                    <span className="text-primary font-medium mr-1">{count}</span>
                    email{count !== 1 ? "s" : ""}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
