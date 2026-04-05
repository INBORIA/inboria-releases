import { DashboardLayout } from "@/components/layout/dashboard-layout";
import {
  useListEmails,
  useUpdateEmail,
  useDeleteEmail,
  getListEmailsQueryKey,
  getGetCategoryCountsQueryKey,
  getGetInboxHealthQueryKey,
  getGetDashboardSummaryQueryKey,
} from "@workspace/api-client-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { Clock, Inbox, ArrowLeft, Trash2, RotateCcw, ChevronRight, FolderOpen, Bell } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

function PriorityBadge({ priority }: { priority: string }) {
  if (priority === "urgent") {
    return <Badge className="bg-red-500/15 text-red-400 border-red-500/20 text-[11px] font-medium px-2 py-0.5">Urgent</Badge>;
  }
  if (priority === "moyen") {
    return <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/20 text-[11px] font-medium px-2 py-0.5">Moyen</Badge>;
  }
  return <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/20 text-[11px] font-medium px-2 py-0.5">Faible</Badge>;
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

export default function Notifications() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const { data: allEmails, isLoading: emailsLoading } = useListEmails();

  const updateEmail = useUpdateEmail();
  const deleteEmail = useDeleteEmail();

  const notifEmails = allEmails?.filter((e) => e.status === "notification") || [];

  const emailsByCategory: Record<string, typeof notifEmails> = {};
  const uncategorized: typeof notifEmails = [];

  notifEmails.forEach((email) => {
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
          invalidateAll();
          toast({ title: "Email deplace dans l'inbox" });
        },
      }
    );
  };

  const handleDelete = (id: number) => {
    deleteEmail.mutate(
      { id },
      {
        onSuccess: () => {
          invalidateAll();
          toast({ title: "Email supprime" });
        },
      }
    );
  };

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
        <div className="p-6 max-w-[900px] mx-auto w-full">
          <div className="flex items-center gap-3 mb-5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedCategory(null)}
              className="h-8 px-2 text-[#8b9cb3] hover:text-white hover:bg-white/[0.06]"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Notifications
            </Button>
            <div className="flex-1" />
            <span className="text-[13px] text-[#8b9cb3]">{selectedEmails.length} email(s)</span>
          </div>

          <h2 className="text-lg font-semibold text-white mb-4">{selectedCategory}</h2>

          <div className="space-y-2">
            {selectedEmails.length === 0 ? (
              <div className="text-center py-12 rounded-lg border border-border border-dashed bg-card/50">
                <FolderOpen className="mx-auto h-10 w-10 text-[#8b9cb3]/40 mb-3" />
                <p className="text-[13px] text-[#8b9cb3]">Aucun email dans cette categorie</p>
              </div>
            ) : (
              selectedEmails.map((email) => (
                <div
                  key={email.id}
                  className="bg-card rounded-lg border border-border p-4 hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-sm shrink-0">
                        {(email.sender || "?")[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-semibold text-[13px] text-white truncate">{email.sender}</span>
                          <PriorityBadge priority={email.priority} />
                        </div>
                        <h3 className="text-[13px] text-white/80 truncate">{email.subject}</h3>
                        {email.summary && (
                          <p className="text-[12px] text-[#8b9cb3] mt-1 line-clamp-1">{email.summary}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-[#8b9cb3] hover:text-white hover:bg-white/[0.06]"
                        onClick={() => handleRestore(email.id)}
                        title="Deplacer dans l'inbox"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-[#8b9cb3] hover:text-red-400 hover:bg-red-500/[0.08]"
                        onClick={() => handleDelete(email.id)}
                        title="Supprimer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2 ml-12">
                    <span className="text-[11px] text-[#8b9cb3] flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {format(new Date(email.createdAt), "d MMM yyyy HH:mm", { locale: fr })}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 max-w-5xl mx-auto w-full">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-white tracking-tight">Notifications</h1>
          <p className="text-[13px] text-[#8b9cb3] mt-1">
            Newsletters, promotions et notifications classees automatiquement par l'IA. {notifEmails.length} email(s).
          </p>
        </div>

        {emailsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array(6).fill(0).map((_, i) => (
              <div key={i} className="bg-card rounded-lg border border-border p-5">
                <Skeleton className="w-8 h-8 rounded-lg bg-white/5 mb-3" />
                <Skeleton className="h-5 w-3/4 mb-2 bg-white/5" />
                <Skeleton className="h-4 w-1/2 bg-white/5" />
              </div>
            ))}
          </div>
        ) : notifEmails.length === 0 ? (
          <div className="text-center py-20 rounded-lg border border-border border-dashed bg-card/50">
            <Bell className="mx-auto h-12 w-12 text-[#8b9cb3]/20 mb-3" />
            <h3 className="text-sm font-medium text-white mb-1">Aucune notification</h3>
            <p className="text-[13px] text-[#8b9cb3]">Les newsletters et promotions seront classees ici automatiquement.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {categoryList.map((catName, i) => {
              const count = catName === "Non classe" ? uncategorized.length : emailsByCategory[catName]?.length || 0;
              return (
                <div
                  key={catName}
                  className="bg-card rounded-lg border border-border p-5 hover:border-primary/30 transition-colors cursor-pointer group"
                  onClick={() => setSelectedCategory(catName)}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${categoryColors[i % categoryColors.length]}`}>
                      <FolderOpen className="w-4 h-4" />
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#8b9cb3] opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <h3 className="text-[14px] font-semibold text-white mb-1">{catName}</h3>
                  <div className="flex items-center text-[12px] text-[#8b9cb3] bg-white/[0.04] px-2.5 py-1 rounded-md inline-flex w-fit">
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
