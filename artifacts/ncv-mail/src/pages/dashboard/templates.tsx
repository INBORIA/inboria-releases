import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import {
  useListTemplates,
  useCreateTemplate,
  useUpdateTemplate,
  useDeleteTemplate,
  getListTemplatesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { FileText, Plus, Pencil, Trash2, Variable } from "lucide-react";

export default function Templates() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: templates, isLoading } = useListTemplates();
  const createMutation = useCreateTemplate();
  const updateMutation = useUpdateTemplate();
  const deleteMutation = useDeleteTemplate();

  const [editing, setEditing] = useState<any>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<any>(null);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const detectedVariables = useMemo(() => {
    const found = new Set<string>();
    const re = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(body)) !== null) found.add(m[1]);
    return Array.from(found);
  }, [body]);

  const openCreate = () => {
    setName("");
    setSubject("");
    setBody("");
    setEditing(null);
    setCreateOpen(true);
  };

  const openEdit = (tpl: any) => {
    setName(tpl.name);
    setSubject(tpl.subject || "");
    setBody(tpl.body || "");
    setEditing(tpl);
    setCreateOpen(true);
  };

  const handleSave = () => {
    if (!name.trim()) {
      toast({ title: t("templates.errors.nameRequired"), variant: "destructive" });
      return;
    }
    const payload = { name: name.trim(), subject: subject, body: body };
    if (editing) {
      updateMutation.mutate(
        { id: editing.id, data: payload },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListTemplatesQueryKey() });
            setCreateOpen(false);
            toast({ title: t("templates.saved") });
          },
          onError: () => toast({ title: t("templates.errors.saveFailed"), variant: "destructive" }),
        },
      );
    } else {
      createMutation.mutate(
        { data: payload },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListTemplatesQueryKey() });
            setCreateOpen(false);
            toast({ title: t("templates.created") });
          },
          onError: () => toast({ title: t("templates.errors.saveFailed"), variant: "destructive" }),
        },
      );
    }
  };

  const handleDelete = () => {
    if (!confirmDelete) return;
    deleteMutation.mutate(
      { id: confirmDelete.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTemplatesQueryKey() });
          setConfirmDelete(null);
          toast({ title: t("templates.deleted") });
        },
      },
    );
  };

  return (
    <DashboardLayout>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <FileText className="h-6 w-6" /> {t("templates.title")}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">{t("templates.subtitle")}</p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" /> {t("templates.newButton")}
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : !templates || templates.length === 0 ? (
          <div className="border border-dashed rounded-lg p-10 text-center text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>{t("templates.empty")}</p>
            <p className="text-xs mt-2">{t("templates.emptyHint")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {templates.map((tpl: any) => (
              <div key={tpl.id} className="border rounded-lg p-4 hover:bg-accent/30 transition">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium truncate">{tpl.name}</h3>
                      {tpl.categoryAi ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                          {tpl.categoryAi}
                        </span>
                      ) : null}
                      {(tpl.usageCount || 0) > 0 ? (
                        <span className="text-xs text-muted-foreground">
                          {t("templates.usedCount", { count: tpl.usageCount })}
                        </span>
                      ) : null}
                    </div>
                    {tpl.subject ? (
                      <p className="text-sm text-muted-foreground truncate">
                        {t("templates.subjectLabel")}: {tpl.subject}
                      </p>
                    ) : null}
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                      {(tpl.body || "").replace(/<[^>]+>/g, " ").slice(0, 200)}
                    </p>
                    {tpl.variables && tpl.variables.length > 0 ? (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {tpl.variables.map((v: string) => (
                          <span
                            key={v}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground"
                          >
                            <Variable className="h-2.5 w-2.5 inline mr-1" />
                            {v}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(tpl)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setConfirmDelete(tpl)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? t("templates.editTitle") : t("templates.newTitle")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("templates.fields.name")}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
            </div>
            <div>
              <Label>{t("templates.fields.subject")}</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div>
              <Label>{t("templates.fields.body")}</Label>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={10}
                placeholder={t("templates.bodyPlaceholder")}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t("templates.variablesHint")}
              </p>
              {detectedVariables.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {detectedVariables.map((v) => (
                    <span
                      key={v}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary"
                    >
                      {v}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("templates.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("templates.deleteConfirm", { name: confirmDelete?.name || "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>{t("common.delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
