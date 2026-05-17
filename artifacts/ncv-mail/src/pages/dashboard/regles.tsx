import { useState } from "react";
import { useEnableLightTheme } from "@/lib/inbox-theme";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import {
  useListAutomationRules,
  useCreateAutomationRule,
  useUpdateAutomationRule,
  useDeleteAutomationRule,
  useParseAutomationRule,
  useSimulateAutomationRule,
  useListAutomationRuleAudit,
  useRollbackRuleExecution,
  getListAutomationRulesQueryKey,
  getListAutomationRuleAuditQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { BackToInboxButton } from "@/components/dashboard/back-to-inbox-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import {
  Wand2,
  Plus,
  Pencil,
  Trash2,
  PlayCircle,
  Undo2,
  History,
  Sparkles,
  CheckCircle2,
} from "lucide-react";

interface RuleConditionShape {
  field: string;
  op: string;
  value?: string | null;
}
interface RuleActionShape {
  type: string;
  category?: string;
  priority?: string;
  to?: string;
  title?: string;
  message?: string;
  projectId?: string;
}

function describeCondition(c: RuleConditionShape, t: TFunction): string {
  if (c.field === "has_attachment") {
    return t(c.op === "is_true" ? "rules.cond.hasAttachment" : "rules.cond.noAttachment");
  }
  if (c.field === "project") {
    return t("rules.cond.projectIs", { value: c.value || "" });
  }
  return `${t(`rules.field.${c.field}`)} ${t(`rules.op.${c.op}`)} "${c.value || ""}"`;
}

function describeAction(a: RuleActionShape, t: TFunction, label?: string): string {
  switch (a.type) {
    case "archive": return t("rules.action.archive");
    case "mark_read": return t("rules.action.mark_read");
    case "categorize": return t("rules.action.categorize", { category: a.category || "" });
    case "set_priority": return t("rules.action.set_priority", { priority: a.priority || "" });
    case "move_to_project": return t("rules.action.move_to_project", { project: label || a.projectId || "" });
    case "transfer": return t("rules.action.transfer", { to: a.to || "" });
    case "create_task": return t("rules.action.create_task", { title: a.title || "" });
    case "notify": return t("rules.action.notify");
    case "assign": return label ? `${t("rules.action.assign")} → ${label}` : t("rules.action.assign");
    default: return a.type;
  }
}

export default function Regles() {
  useEnableLightTheme();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: rules, isLoading } = useListAutomationRules();
  const { data: audit } = useListAutomationRuleAudit();
  const createMutation = useCreateAutomationRule();
  const updateMutation = useUpdateAutomationRule();
  const deleteMutation = useDeleteAutomationRule();
  const parseMutation = useParseAutomationRule();
  const simulateMutation = useSimulateAutomationRule();
  const rollbackMutation = useRollbackRuleExecution();

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [confirmDelete, setConfirmDelete] = useState<any>(null);

  const [nlInput, setNlInput] = useState("");
  const [draftName, setDraftName] = useState("");
  const [draftRule, setDraftRule] = useState<any>(null);
  const [draftLabels, setDraftLabels] = useState<Record<number, string>>({});
  const [simulation, setSimulation] = useState<{ totalScanned: number; matchCount: number; matches: any[] } | null>(null);

  const refreshAudit = () => queryClient.invalidateQueries({ queryKey: getListAutomationRuleAuditQueryKey() });

  const openCreate = () => {
    setNlInput("");
    setDraftName("");
    setDraftRule(null);
    setDraftLabels({});
    setSimulation(null);
    setEditing(null);
    setCreateOpen(true);
  };

  const handleParse = () => {
    if (!nlInput.trim() || nlInput.trim().length < 5) {
      toast({ title: t("rules.errors.tooShort"), variant: "destructive" });
      return;
    }
    parseMutation.mutate(
      { data: { input: nlInput.trim(), name: draftName.trim() || undefined } },
      {
        onSuccess: (res: any) => {
          setDraftRule(res.rule);
          setDraftLabels(res.labels || {});
          if (!draftName) setDraftName(res.rule.name);
          toast({
            title: t("rules.parsed"),
            description: res.source === "ai" ? t("rules.parsedByAI") : t("rules.parsedByHeuristic"),
          });
        },
        onError: (e: any) => {
          const msg = e?.response?.data?.error || t("rules.errors.parseFailed");
          toast({ title: msg, variant: "destructive" });
        },
      },
    );
  };

  const handleSimulate = () => {
    if (!draftRule) return;
    simulateMutation.mutate(
      { data: { conditions: draftRule.conditions } },
      {
        onSuccess: (res: any) => setSimulation(res),
        onError: () => toast({ title: t("rules.errors.simulateFailed"), variant: "destructive" }),
      },
    );
  };

  const handleSave = () => {
    if (!draftRule) return;
    const payload = {
      name: draftName.trim() || draftRule.name,
      conditions: draftRule.conditions,
      actions: draftRule.actions,
      naturalLanguageInput: nlInput.trim() || undefined,
      enabled: true,
    };
    if (editing) {
      updateMutation.mutate(
        { id: editing.id, data: payload },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListAutomationRulesQueryKey() });
            setCreateOpen(false);
            toast({ title: t("rules.saved") });
          },
          onError: () => toast({ title: t("rules.errors.saveFailed"), variant: "destructive" }),
        },
      );
    } else {
      createMutation.mutate(
        { data: payload },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListAutomationRulesQueryKey() });
            setCreateOpen(false);
            toast({ title: t("rules.created") });
          },
          onError: () => toast({ title: t("rules.errors.saveFailed"), variant: "destructive" }),
        },
      );
    }
  };

  const toggleEnabled = (rule: any, value: boolean) => {
    updateMutation.mutate(
      { id: rule.id, data: { enabled: value } },
      {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getListAutomationRulesQueryKey() }),
      },
    );
  };

  const handleDelete = () => {
    if (!confirmDelete) return;
    deleteMutation.mutate(
      { id: confirmDelete.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListAutomationRulesQueryKey() });
          setConfirmDelete(null);
          toast({ title: t("rules.deleted") });
        },
      },
    );
  };

  const handleRollback = (id: string) => {
    rollbackMutation.mutate(
      { id },
      {
        onSuccess: () => {
          refreshAudit();
          toast({ title: t("rules.rollbackDone") });
        },
        onError: (e: any) => {
          const msg = e?.response?.data?.error || t("rules.errors.rollbackFailed");
          toast({ title: msg, variant: "destructive" });
        },
      },
    );
  };

  const openEdit = (r: any) => {
    setEditing(r);
    setNlInput(r.naturalLanguageInput || "");
    setDraftName(r.name);
    setDraftRule({ name: r.name, conditions: r.conditions, actions: r.actions });
    setDraftLabels({});
    setSimulation(null);
    setCreateOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-5">
        <BackToInboxButton />
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Wand2 className="h-6 w-6" /> {t("rules.title")}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">{t("rules.subtitle")}</p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" /> {t("rules.newButton")}
          </Button>
        </div>

        <Tabs defaultValue="list">
          <TabsList>
            <TabsTrigger value="list">{t("rules.tabs.list")}</TabsTrigger>
            <TabsTrigger value="audit">
              <History className="h-4 w-4 mr-1" /> {t("rules.tabs.audit")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="mt-4">
            {isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : !rules || rules.length === 0 ? (
              <div className="border border-dashed rounded-lg p-10 text-center text-muted-foreground">
                <Wand2 className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p>{t("rules.empty")}</p>
                <p className="text-xs mt-2">{t("rules.emptyHint")}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {rules.map((r: any) => (
                  <div key={r.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-medium">{r.name}</h3>
                          {(r.runsCount || 0) > 0 && (
                            <span className="text-xs text-muted-foreground">
                              {t("rules.runsCount", { count: r.runsCount })}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground space-y-1">
                          <div>
                            <strong>{t("rules.ifLabel")}: </strong>
                            {(r.conditions?.all || r.conditions?.any || []).map((c: any, i: number) => (
                              <span key={i}>
                                {i > 0 && (r.conditions?.all ? ` ${t("rules.and")} ` : ` ${t("rules.or")} `)}
                                {describeCondition(c, t)}
                              </span>
                            ))}
                          </div>
                          <div>
                            <strong>{t("rules.thenLabel")}: </strong>
                            {(r.actions || []).map((a: any, i: number) => (
                              <span key={i}>
                                {i > 0 ? ", " : ""}
                                {describeAction(a, t)}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={r.enabled}
                          onCheckedChange={(v: boolean) => toggleEnabled(r, v)}
                        />
                        <Button variant="ghost" size="icon" onClick={() => openEdit(r)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setConfirmDelete(r)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="audit" className="mt-4">
            {!audit || audit.length === 0 ? (
              <div className="border border-dashed rounded-lg p-10 text-center text-muted-foreground">
                <History className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p>{t("rules.auditEmpty")}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {audit.map((a: any) => (
                  <div key={a.id} className="border rounded-lg p-3 text-sm flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">
                        {describeAction({ type: a.actionType, ...a.actionPayload }, t)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {t("rules.auditEmail")} #{a.emailId} · {new Date(a.occurredAt).toLocaleString()}
                      </div>
                    </div>
                    {a.rolledBackAt ? (
                      <span className="text-xs text-emerald-500 flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> {t("rules.rolledBack")}
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRollback(a.id)}
                        disabled={rollbackMutation.isPending}
                      >
                        <Undo2 className="h-3.5 w-3.5 mr-1" /> {t("rules.rollback")}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editing ? t("rules.editTitle") : t("rules.newTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("rules.nameLabel")}</Label>
              <Input
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder={t("rules.namePlaceholder")}
              />
            </div>
            <div>
              <Label>{t("rules.nlLabel")}</Label>
              <Textarea
                value={nlInput}
                onChange={(e) => setNlInput(e.target.value)}
                rows={3}
                placeholder={t("rules.nlPlaceholder")}
              />
              <p className="text-xs text-muted-foreground mt-1">{t("rules.nlHint")}</p>
              <Button
                size="sm"
                variant="secondary"
                className="mt-2"
                onClick={handleParse}
                disabled={parseMutation.isPending}
              >
                <Sparkles className="h-3.5 w-3.5 mr-1" />
                {parseMutation.isPending ? t("common.loading") : t("rules.parseButton")}
              </Button>
            </div>

            {draftRule && (
              <div className="border rounded-md p-3 bg-accent/30 text-sm">
                <div>
                  <strong>{t("rules.ifLabel")}: </strong>
                  {(draftRule.conditions?.all || draftRule.conditions?.any || []).map(
                    (c: any, i: number) => (
                      <span key={i}>
                        {i > 0 && ` ${t("rules.and")} `}
                        {describeCondition(c, t)}
                      </span>
                    ),
                  )}
                </div>
                <div className="mt-1">
                  <strong>{t("rules.thenLabel")}: </strong>
                  {draftRule.actions.map((a: any, i: number) => (
                    <span key={i}>
                      {i > 0 ? ", " : ""}
                      {describeAction(a, t, draftLabels[i])}
                    </span>
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSimulate}
                    disabled={simulateMutation.isPending}
                  >
                    <PlayCircle className="h-3.5 w-3.5 mr-1" />
                    {simulateMutation.isPending ? t("common.loading") : t("rules.simulateButton")}
                  </Button>
                  {simulation && (
                    <span className="text-xs text-muted-foreground">
                      {t("rules.simulationResult", {
                        count: simulation.matchCount,
                        total: simulation.totalScanned,
                      })}
                    </span>
                  )}
                </div>
                {simulation && simulation.matches.length > 0 && (
                  <div className="mt-2 max-h-40 overflow-y-auto border rounded p-2 text-xs space-y-1 bg-background">
                    {simulation.matches.slice(0, 10).map((m: any) => (
                      <div key={m.id} className="truncate">
                        {m.sender} — {m.subject || "(no subject)"}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleSave}
              disabled={!draftRule || createMutation.isPending || updateMutation.isPending}
            >
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("rules.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("rules.deleteConfirm", { name: confirmDelete?.name || "" })}
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
