import { DashboardLayout } from "@/components/layout/dashboard-layout";
import {
  useListFollowups,
  useCreateFollowup,
  useUpdateFollowup,
  useDeleteFollowup,
  useGetFollowupStats,
  useListProjects,
  useDetectFollowups,
  useListEmails,
  getListFollowupsQueryKey,
  getGetFollowupStatsQueryKey,
} from "@workspace/api-client-react";
import type { PaginatedEmails } from "@workspace/api-client-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useQueryClient } from "@tanstack/react-query";
import {
  Clock,
  Plus,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Loader2,
  Download,
  Trash2,
  Mail,
  FolderKanban,
  CalendarDays,
  X,
  Eye,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  en_attente: { label: "En attente", color: "text-amber-400", bg: "bg-amber-500/15", icon: Clock },
  relance: { label: "Relance", color: "text-orange-400", bg: "bg-orange-500/15", icon: RotateCcw },
  termine: { label: "Terminé", color: "text-emerald-400", bg: "bg-emerald-500/15", icon: CheckCircle2 },
};

export default function Suivi() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [showAiDetect, setShowAiDetect] = useState(false);

  const { data: followups, isLoading } = useListFollowups({
    status: filterStatus !== "all" ? filterStatus as any : undefined,
  });
  const { data: stats } = useGetFollowupStats();
  const { data: projects } = useListProjects();
  const createFollowup = useCreateFollowup();
  const updateFollowup = useUpdateFollowup();
  const deleteFollowup = useDeleteFollowup();

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getListFollowupsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetFollowupStatsQueryKey() });
  };

  const handleCreate = (data: { title: string; dueDate?: string; notes?: string; projectId?: string; emailId?: number }) => {
    createFollowup.mutate(
      { data: data as any },
      {
        onSuccess: () => {
          invalidateAll();
          toast({ title: "Suivi créé" });
          setShowCreate(false);
        },
      }
    );
  };

  const handleStatusChange = (id: string, status: string) => {
    updateFollowup.mutate(
      { id, data: { status } as any },
      {
        onSuccess: () => {
          invalidateAll();
          toast({ title: `Suivi mis à jour: ${STATUS_CONFIG[status]?.label || status}` });
        },
      }
    );
  };

  const handleDelete = (id: string) => {
    deleteFollowup.mutate(
      { id },
      {
        onSuccess: () => {
          invalidateAll();
          toast({ title: "Suivi supprimé" });
        },
      }
    );
  };

  const handleExport = () => {
    window.open(`${import.meta.env.BASE_URL}api/export/followups`, "_blank");
  };

  const today = new Date().toISOString().split("T")[0];
  const followupsList = (followups as any[]) || [];

  const overdue = followupsList.filter((f) => f.due_date && f.due_date < today && f.status !== "termine");
  const active = followupsList.filter((f) => f.status !== "termine" && !(f.due_date && f.due_date < today));
  const completed = followupsList.filter((f) => f.status === "termine");

  return (
    <DashboardLayout>
      <div className="p-5 max-w-5xl mx-auto w-full">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-[16px] font-semibold text-white tracking-tight flex items-center gap-2">
              <Eye className="w-4 h-4 text-primary" />
              Suivi
            </h1>
            <p className="text-[12px] text-[#8b9cb3] mt-0.5">
              Gérez vos suivis et relances
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAiDetect(true)}
              className="gap-1 text-[11px] h-7 bg-transparent border-border text-primary hover:text-white"
            >
              <Sparkles className="w-3 h-3" />
              Détection IA
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              className="gap-1 text-[11px] h-7 bg-transparent border-border text-[#8b9cb3] hover:text-white"
            >
              <Download className="w-3 h-3" />
              Exporter
            </Button>
            <Button
              size="sm"
              onClick={() => setShowCreate(true)}
              className="gap-1 text-[11px] h-7"
            >
              <Plus className="w-3 h-3" />
              Nouveau suivi
            </Button>
          </div>
        </div>

        {stats && (
          <div className="grid grid-cols-4 gap-2 mb-5">
            <StatCard label="En attente" value={(stats as any).en_attente || 0} color="text-amber-400" bg="bg-amber-500/10" icon={Clock} />
            <StatCard label="Relance" value={(stats as any).relance || 0} color="text-orange-400" bg="bg-orange-500/10" icon={RotateCcw} />
            <StatCard label="En retard" value={(stats as any).overdue || 0} color="text-red-400" bg="bg-red-500/10" icon={AlertTriangle} />
            <StatCard label="Terminé" value={(stats as any).termine || 0} color="text-emerald-400" bg="bg-emerald-500/10" icon={CheckCircle2} />
          </div>
        )}

        <div className="flex items-center gap-2 mb-4">
          {["all", "en_attente", "relance", "termine"].map((s) => (
            <Button
              key={s}
              variant={filterStatus === s ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterStatus(s)}
              className="text-[11px] h-7"
            >
              {s === "all" ? "Tous" : STATUS_CONFIG[s]?.label || s}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : followupsList.length === 0 ? (
          <div className="text-center py-16 rounded-lg border border-border border-dashed bg-card/50">
            <Eye className="mx-auto h-8 w-8 text-[#8b9cb3]/20 mb-2" />
            <h3 className="text-[13px] font-medium text-white mb-1">Aucun suivi</h3>
            <p className="text-[12px] text-[#8b9cb3]">Créez votre premier suivi ou utilisez la détection IA.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {overdue.length > 0 && (
              <div>
                <h3 className="text-[12px] font-medium text-red-400 mb-2 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> En retard ({overdue.length})
                </h3>
                <div className="space-y-1">
                  {overdue.map((f) => (
                    <FollowupRow key={f.id} followup={f} onStatusChange={handleStatusChange} onDelete={handleDelete} isOverdue />
                  ))}
                </div>
              </div>
            )}
            {active.length > 0 && (
              <div>
                <h3 className="text-[12px] font-medium text-white mb-2">Actifs ({active.length})</h3>
                <div className="space-y-1">
                  {active.map((f) => (
                    <FollowupRow key={f.id} followup={f} onStatusChange={handleStatusChange} onDelete={handleDelete} />
                  ))}
                </div>
              </div>
            )}
            {completed.length > 0 && (
              <div>
                <h3 className="text-[12px] font-medium text-[#8b9cb3] mb-2">Terminés ({completed.length})</h3>
                <div className="space-y-1">
                  {completed.map((f) => (
                    <FollowupRow key={f.id} followup={f} onStatusChange={handleStatusChange} onDelete={handleDelete} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {showCreate && (
          <CreateFollowupModal
            onClose={() => setShowCreate(false)}
            onCreate={handleCreate}
            projects={projects || []}
          />
        )}

        {showAiDetect && (
          <AiDetectModal
            onClose={() => setShowAiDetect(false)}
            onCreate={handleCreate}
          />
        )}
      </div>
    </DashboardLayout>
  );
}

function StatCard({ label, value, color, bg, icon: Icon }: { label: string; value: number; color: string; bg: string; icon: any }) {
  return (
    <div className={`rounded-lg border border-border p-3 ${bg}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-3.5 h-3.5 ${color}`} />
        <span className="text-[11px] text-[#8b9cb3]">{label}</span>
      </div>
      <span className={`text-[18px] font-semibold ${color}`}>{value}</span>
    </div>
  );
}

function FollowupRow({
  followup: f,
  onStatusChange,
  onDelete,
  isOverdue,
}: {
  followup: any;
  onStatusChange: (id: string, status: string) => void;
  onDelete: (id: string) => void;
  isOverdue?: boolean;
}) {
  const cfg = STATUS_CONFIG[f.status] || STATUS_CONFIG.en_attente;
  const StatusIcon = cfg.icon;

  return (
    <div className={`flex items-center gap-3 rounded-lg border p-3 ${isOverdue ? "border-red-500/30 bg-red-500/5" : "border-border bg-card"}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center ${cfg.bg}`}>
        <StatusIcon className={`w-3.5 h-3.5 ${cfg.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-[12px] font-medium ${f.status === "termine" ? "text-[#8b9cb3] line-through" : "text-white"}`}>
          {f.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          {f.due_date && (
            <span className={`text-[10px] flex items-center gap-0.5 ${isOverdue ? "text-red-400" : "text-[#8b9cb3]"}`}>
              <CalendarDays className="w-3 h-3" />
              {format(new Date(f.due_date), "dd MMM yyyy", { locale: fr })}
            </span>
          )}
          {f.emails?.subject && (
            <span className="text-[10px] text-[#8b9cb3] flex items-center gap-0.5">
              <Mail className="w-3 h-3" />
              {f.emails.subject.substring(0, 30)}...
            </span>
          )}
          {f.projects?.name && (
            <span className="text-[10px] text-[#8b9cb3] flex items-center gap-0.5">
              <FolderKanban className="w-3 h-3" />
              {f.projects.reference || f.projects.name}
            </span>
          )}
        </div>
        {f.notes && <p className="text-[10px] text-[#8b9cb3] mt-0.5 line-clamp-1">{f.notes}</p>}
      </div>
      <div className="flex items-center gap-1">
        <Select value={f.status} onValueChange={(v) => onStatusChange(f.id, v)}>
          <SelectTrigger className="w-[110px] h-7 text-[10px] bg-transparent border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="en_attente" className="text-[11px]">En attente</SelectItem>
            <SelectItem value="relance" className="text-[11px]">Relance</SelectItem>
            <SelectItem value="termine" className="text-[11px]">Terminé</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(f.id)}
          className="h-7 w-7 p-0 text-[#8b9cb3] hover:text-red-400"
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}

function CreateFollowupModal({
  onClose,
  onCreate,
  projects,
}: {
  onClose: () => void;
  onCreate: (data: any) => void;
  projects: any[];
}) {
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [projectId, setProjectId] = useState("");

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-[#141c2b] rounded-xl border border-border p-5 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[14px] font-semibold text-white">Nouveau suivi</h3>
          <button onClick={onClose} className="text-[#8b9cb3] hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-3">
          <Input
            placeholder="Titre du suivi"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="bg-card border-border text-[12px]"
          />
          <Input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="bg-card border-border text-[12px]"
          />
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger className="bg-card border-border text-[12px]">
              <SelectValue placeholder="Projet (optionnel)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none" className="text-[11px]">Aucun projet</SelectItem>
              {projects.map((p: any) => (
                <SelectItem key={p.id} value={p.id} className="text-[11px]">
                  {p.reference} - {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea
            placeholder="Notes (optionnel)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="bg-card border-border text-[12px] min-h-[60px]"
          />
          <Button
            onClick={() => onCreate({
              title,
              dueDate: dueDate || undefined,
              notes: notes || undefined,
              projectId: projectId && projectId !== "none" ? projectId : undefined,
            })}
            disabled={!title.trim()}
            className="w-full text-[12px]"
          >
            Créer le suivi
          </Button>
        </div>
      </div>
    </div>
  );
}

function AiDetectModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (data: any) => void;
}) {
  const { data: emailsData, isLoading: loadingEmails } = useListEmails({ limit: 20 });
  const emails = (emailsData as PaginatedEmails | undefined)?.emails ?? [];
  const detectMut = useDetectFollowups();
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [detecting, setDetecting] = useState(false);
  const [detected, setDetected] = useState(false);
  const { toast } = useToast();

  const handleDetect = async () => {
    if (emails.length === 0) return;
    setDetecting(true);
    try {
      const result = await detectMut.mutateAsync({
        data: { emails: emails.map((e) => ({ id: e.id, sender: e.sender, subject: e.subject, summary: e.summary, body: e.body?.substring(0, 300) })) },
      });
      setSuggestions((result as any)?.followups || []);
      setDetected(true);
    } catch {
      toast({ title: "Erreur lors de la détection", variant: "destructive" });
    }
    setDetecting(false);
  };

  const handleAccept = (s: any) => {
    onCreate({
      title: s.title,
      emailId: s.emailId,
      dueDate: s.suggestedDueDate || undefined,
      notes: s.reason,
    });
    setSuggestions((prev) => prev.filter((x) => x !== s));
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-[#141c2b] rounded-xl border border-border p-5 w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[14px] font-semibold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Détection IA de suivis
          </h3>
          <button onClick={onClose} className="text-[#8b9cb3] hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        {!detected ? (
          <div className="text-center py-6">
            <p className="text-[12px] text-[#8b9cb3] mb-4">
              L'IA va analyser vos {emails.length} derniers emails pour détecter ceux qui nécessitent un suivi.
            </p>
            <Button onClick={handleDetect} disabled={detecting || loadingEmails} className="gap-1">
              {detecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {detecting ? "Analyse en cours..." : "Lancer la détection"}
            </Button>
          </div>
        ) : suggestions.length === 0 ? (
          <div className="text-center py-6">
            <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-400 mb-2" />
            <p className="text-[12px] text-[#8b9cb3]">Aucun suivi nécessaire détecté. Tout est en ordre !</p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-[11px] text-[#8b9cb3] mb-3">{suggestions.length} suivi(s) suggéré(s)</p>
            {suggestions.map((s, i) => (
              <div key={i} className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                <p className="text-[12px] font-medium text-white mb-1">{s.title}</p>
                <p className="text-[10px] text-[#8b9cb3] mb-2">{s.reason}</p>
                <div className="flex items-center gap-2">
                  {s.suggestedDueDate && (
                    <span className="text-[10px] text-[#8b9cb3] flex items-center gap-0.5">
                      <CalendarDays className="w-3 h-3" />
                      {s.suggestedDueDate}
                    </span>
                  )}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    s.urgency === "haute" ? "bg-red-500/15 text-red-400" :
                    s.urgency === "moyenne" ? "bg-amber-500/15 text-amber-400" :
                    "bg-emerald-500/15 text-emerald-400"
                  }`}>
                    {s.urgency}
                  </span>
                  <div className="flex-1" />
                  <Button size="sm" onClick={() => handleAccept(s)} className="text-[10px] h-6 gap-1">
                    <Plus className="w-3 h-3" /> Créer
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
