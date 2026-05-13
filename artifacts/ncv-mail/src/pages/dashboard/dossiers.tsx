import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { EmailDetailContainer } from "@/components/email-detail/EmailDetailContainer";
import { useEnableLightTheme } from "@/lib/inbox-theme";
import {
  useListFolders,
  useCreateFolder,
  useUpdateFolder,
  useDeleteFolder,
  useListFolderEmails,
  useGenerateFolderPrompt,
  useUnassignEmailsFromFolder,
  getListFoldersQueryKey,
  getListFolderEmailsQueryKey,
} from "@workspace/api-client-react";
import type { UserFolder, Email } from "@workspace/api-client-react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { BackToInboxButton } from "@/components/dashboard/back-to-inbox-button";
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
import {
  FolderOpen,
  Plus,
  Sparkles,
  Edit2,
  Trash2,
  ArrowLeft,
  ChevronRight,
  Loader2,
  Wand2,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type DraftFolder = {
  name: string;
  description: string;
  keywords: string;
  aiPrompt: string;
  shortBrief: string;
};

const EMPTY_DRAFT: DraftFolder = {
  name: "",
  description: "",
  keywords: "",
  aiPrompt: "",
  shortBrief: "",
};

function parseKeywords(raw: string): string[] {
  return raw
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, 50);
}

export default function MesDossiers() {
  useEnableLightTheme();
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [openCreate, setOpenCreate] = useState(false);
  const [draft, setDraft] = useState<DraftFolder>(EMPTY_DRAFT);
  const [editingFolder, setEditingFolder] = useState<UserFolder | null>(null);
  const [folderToDelete, setFolderToDelete] = useState<UserFolder | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedEmailId, setSelectedEmailId] = useState<number | null>(null);

  const { data: folders, isLoading } = useListFolders();
  const createFolder = useCreateFolder();
  const updateFolder = useUpdateFolder();
  const deleteFolder = useDeleteFolder();
  const generatePrompt = useGenerateFolderPrompt();
  const unassign = useUnassignEmailsFromFolder();

  const selectedFolder = useMemo(
    () => (folders || []).find((f) => f.id === selectedFolderId) || null,
    [folders, selectedFolderId],
  );

  const { data: folderEmailsData, isLoading: loadingFolderEmails } = useListFolderEmails(
    selectedFolderId || "",
    {},
    {
      query: {
        enabled: Boolean(selectedFolderId) && !selectedEmailId,
        queryKey: getListFolderEmailsQueryKey(selectedFolderId || ""),
      },
    },
  );

  const resetDraft = () => setDraft(EMPTY_DRAFT);

  const openCreateDialog = () => {
    resetDraft();
    setEditingFolder(null);
    setOpenCreate(true);
  };

  const openEditDialog = (f: UserFolder) => {
    setEditingFolder(f);
    setDraft({
      name: f.name,
      description: f.description || "",
      keywords: (f.keywords || []).join(", "),
      aiPrompt: f.aiPrompt || "",
      shortBrief: "",
    });
    setOpenCreate(true);
  };

  const handleGeneratePrompt = async () => {
    if (!draft.name.trim()) {
      toast({
        title: t("folders.nameRequired", { defaultValue: "Donnez d'abord un nom au dossier." }),
        variant: "destructive",
      });
      return;
    }
    try {
      const out = await generatePrompt.mutateAsync({
        data: {
          folderName: draft.name.trim(),
          keywords: parseKeywords(draft.keywords),
          shortBrief: draft.shortBrief.trim() || null,
        },
      });
      setDraft((d) => ({ ...d, aiPrompt: out.prompt }));
      toast({ title: t("folders.promptGenerated", { defaultValue: "Prompt généré." }) });
    } catch (e: any) {
      toast({
        title: t("folders.promptFailed", { defaultValue: "Échec de la génération." }),
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async () => {
    if (!draft.name.trim()) return;
    const payload = {
      name: draft.name.trim(),
      description: draft.description.trim() || null,
      keywords: parseKeywords(draft.keywords),
      aiPrompt: draft.aiPrompt.trim() || null,
    };
    try {
      if (editingFolder) {
        await updateFolder.mutateAsync({ id: editingFolder.id, data: payload });
        toast({ title: t("folders.updated", { defaultValue: "Dossier mis à jour." }) });
      } else {
        await createFolder.mutateAsync({ data: payload });
        toast({ title: t("folders.created", { defaultValue: "Dossier créé." }) });
      }
      setOpenCreate(false);
      resetDraft();
      qc.invalidateQueries({ queryKey: getListFoldersQueryKey() });
    } catch {
      toast({
        title: t("folders.saveFailed", { defaultValue: "Échec de l'enregistrement." }),
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!folderToDelete) return;
    try {
      await deleteFolder.mutateAsync({ id: folderToDelete.id });
      toast({ title: t("folders.deleted", { defaultValue: "Dossier supprimé." }) });
      if (selectedFolderId === folderToDelete.id) setSelectedFolderId(null);
      qc.invalidateQueries({ queryKey: getListFoldersQueryKey() });
    } finally {
      setFolderToDelete(null);
    }
  };

  const handleUnassign = async (emailId: number) => {
    if (!selectedFolderId) return;
    await unassign.mutateAsync({
      data: { folderId: selectedFolderId, emailIds: [emailId] },
    });
    qc.invalidateQueries({ queryKey: getListFolderEmailsQueryKey(selectedFolderId) });
    qc.invalidateQueries({ queryKey: getListFoldersQueryKey() });
  };

  // Vue détail email (sélectionné dans un dossier)
  if (selectedEmailId) {
    return (
      <DashboardLayout>
        <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedEmailId(null)}
            className="h-8 px-2 mb-3 text-[#b8c5d6] hover:text-white text-[12px]"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            {t("common.back", "Retour")}
          </Button>
          <EmailDetailContainer
            emailId={selectedEmailId}
            onBack={() => setSelectedEmailId(null)}
            onAfterMutation={() => {
              if (selectedFolderId) {
                qc.invalidateQueries({ queryKey: getListFolderEmailsQueryKey(selectedFolderId) });
              }
            }}
          />
        </div>
      </DashboardLayout>
    );
  }

  // Vue contenu d'un dossier
  if (selectedFolder) {
    const emails = folderEmailsData?.emails || [];
    return (
      <DashboardLayout>
        <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center gap-3 mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedFolderId(null)}
              className="h-7 px-2 text-[#b8c5d6] hover:text-white text-[12px]"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              {t("common.back", "Retour")}
            </Button>
            <div className="flex-1" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openEditDialog(selectedFolder)}
              className="h-7 px-2 text-[#b8c5d6] hover:text-white text-[12px]"
            >
              <Edit2 className="w-3.5 h-3.5 mr-1" />
              {t("common.edit", "Modifier")}
            </Button>
          </div>

          <h1 className="text-[16px] font-semibold text-white mb-1">{selectedFolder.name}</h1>
          {selectedFolder.description && (
            <p className="text-[12px] text-[#b8c5d6] mb-4">{selectedFolder.description}</p>
          )}

          {loadingFolderEmails ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          ) : emails.length === 0 ? (
            <div className="text-center py-12 rounded-lg border border-border border-dashed bg-card/50">
              <FolderOpen className="mx-auto h-8 w-8 text-[#b8c5d6]/30 mb-2" />
              <p className="text-[12px] text-[#b8c5d6]">
                {t("folders.empty", { defaultValue: "Aucun email pour l'instant." })}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {emails.map((email: Email) => (
                <div
                  key={email.id}
                  className="group flex items-stretch rounded-lg border border-border bg-card hover:bg-[#1a2235] transition-colors cursor-pointer overflow-hidden"
                  onClick={() => setSelectedEmailId(email.id)}
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0 p-3">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                      <span className="text-primary font-semibold text-[12px]">
                        {(email.sender || "?")[0].toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-semibold text-[12px] text-white truncate">{email.sender}</span>
                      </div>
                      <h3 className="text-[12px] text-white/80 truncate">{email.subject}</h3>
                      {email.summary && (
                        <p className="text-[11px] text-[#b8c5d6] truncate mt-0.5">{email.summary}</p>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUnassign(email.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-white/[0.08] text-[#b8c5d6] hover:text-white"
                      title={t("folders.removeFromFolder", { defaultValue: "Retirer du dossier" })}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <ChevronRight className="w-3.5 h-3.5 text-[#b8c5d6]/40 group-hover:text-[#b8c5d6] transition-colors self-center" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        {renderEditor()}
      </DashboardLayout>
    );
  }

  // Vue liste des dossiers
  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-5">
        <BackToInboxButton />
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-[16px] font-semibold text-white tracking-tight">
              {t("folders.title", { defaultValue: "Mes dossiers" })}
            </h1>
            <p className="text-[12px] text-[#b8c5d6] mt-0.5">
              {t("folders.subtitle", {
                defaultValue:
                  "Dossiers privés. Inboria classe automatiquement vos mails selon vos règles. Invisibles à vos collègues.",
              })}
            </p>
          </div>
          <Button onClick={openCreateDialog} size="sm" className="h-8 text-[12px] gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            {t("folders.new", { defaultValue: "Nouveau dossier" })}
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : !folders || folders.length === 0 ? (
          <div className="text-center py-16 rounded-lg border border-border border-dashed bg-card/50">
            <FolderOpen className="mx-auto h-8 w-8 text-[#b8c5d6]/20 mb-2" />
            <h3 className="text-[13px] font-medium text-white mb-1">
              {t("folders.noFolders", { defaultValue: "Aucun dossier" })}
            </h3>
            <p className="text-[12px] text-[#b8c5d6] mb-4">
              {t("folders.noFoldersDesc", {
                defaultValue: "Créez votre premier dossier pour ranger automatiquement vos emails.",
              })}
            </p>
            <Button onClick={openCreateDialog} size="sm" className="h-8 text-[12px] gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              {t("folders.createFirst", { defaultValue: "Créer un dossier" })}
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {folders.map((f) => (
              <div
                key={f.id}
                className="bg-card rounded-lg border border-border p-4 hover:border-primary/30 transition-colors cursor-pointer group relative"
                onClick={() => setSelectedFolderId(f.id)}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
                    <FolderOpen className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditDialog(f);
                      }}
                      className="p-1 rounded hover:bg-white/[0.08] text-[#b8c5d6] hover:text-white"
                      title={t("common.edit", "Modifier")}
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setFolderToDelete(f);
                      }}
                      className="p-1 rounded hover:bg-red-500/10 text-[#b8c5d6] hover:text-red-400"
                      title={t("common.delete", "Supprimer")}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <h3 className="text-[13px] font-semibold text-white mb-0.5 truncate">{f.name}</h3>
                {f.description && (
                  <p className="text-[11px] text-[#b8c5d6] line-clamp-2 mb-1">{f.description}</p>
                )}
                <div className="flex items-center gap-2 text-[11px] text-[#b8c5d6] mt-2">
                  <span className="bg-white/[0.04] px-2 py-0.5 rounded-md">
                    <span className="text-primary font-medium mr-1">{f.emailCount}</span>
                    {t("classification.emailsLabel", "emails")}
                  </span>
                  {(f.keywords?.length || 0) > 0 && (
                    <span className="text-[10px] text-[#b8c5d6]/70">
                      {f.keywords.length} {t("folders.keywordsShort", { defaultValue: "mots-clés" })}
                    </span>
                  )}
                  {f.aiPrompt && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-primary/80">
                      <Sparkles className="w-2.5 h-2.5" />
                      {t("folders.aiOn", { defaultValue: "IA" })}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {renderEditor()}

      <AlertDialog open={!!folderToDelete} onOpenChange={(o) => !o && setFolderToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("folders.confirmDeleteTitle", { defaultValue: "Supprimer ce dossier ?" })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("folders.confirmDeleteDesc", {
                defaultValue:
                  "Le dossier sera supprimé. Les emails resteront dans votre boîte (rien n'est effacé).",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel", "Annuler")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-500 hover:bg-red-600">
              {t("common.delete", "Supprimer")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );

  function renderEditor() {
    return (
      <Dialog
        open={openCreate}
        onOpenChange={(o) => {
          setOpenCreate(o);
          if (!o) {
            setEditingFolder(null);
            resetDraft();
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingFolder
                ? t("folders.editTitle", { defaultValue: "Modifier le dossier" })
                : t("folders.newTitle", { defaultValue: "Nouveau dossier" })}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label className="text-[12px]">
                {t("folders.fieldName", { defaultValue: "Nom" })}
              </Label>
              <Input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder={t("folders.namePlaceholder", { defaultValue: "ex. Factures fournisseurs" })}
                maxLength={80}
              />
            </div>

            <div>
              <Label className="text-[12px]">
                {t("folders.fieldDescription", { defaultValue: "Description (optionnel)" })}
              </Label>
              <Input
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                placeholder={t("folders.descriptionPlaceholder", { defaultValue: "Visible uniquement par vous" })}
              />
            </div>

            <div>
              <Label className="text-[12px]">
                {t("folders.fieldKeywords", { defaultValue: "Mots-clés (séparés par des virgules)" })}
              </Label>
              <Input
                value={draft.keywords}
                onChange={(e) => setDraft({ ...draft, keywords: e.target.value })}
                placeholder="facture, BL, IBAN, RIB"
              />
              <p className="text-[10px] text-[#b8c5d6] mt-1">
                {t("folders.keywordsHelp", {
                  defaultValue:
                    "Un mail correspond si l'expéditeur, l'objet ou le contenu contient l'un de ces mots.",
                })}
              </p>
            </div>

            <div className="border-t border-border pt-3">
              <div className="flex items-center justify-between mb-1">
                <Label className="text-[12px] inline-flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-primary" />
                  {t("folders.fieldAiPrompt", { defaultValue: "Prompt IA (optionnel)" })}
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleGeneratePrompt}
                  disabled={generatePrompt.isPending}
                  className="h-7 px-2 text-[11px] gap-1.5 text-primary hover:text-white"
                >
                  {generatePrompt.isPending ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Wand2 className="w-3 h-3" />
                  )}
                  {t("folders.generatePromptCta", { defaultValue: "Générer avec l'IA" })}
                </Button>
              </div>
              <Input
                value={draft.shortBrief}
                onChange={(e) => setDraft({ ...draft, shortBrief: e.target.value })}
                placeholder={t("folders.shortBriefPlaceholder", {
                  defaultValue: "Brief court pour l'IA (optionnel)",
                })}
                className="mb-2 text-[12px]"
              />
              <Textarea
                value={draft.aiPrompt}
                onChange={(e) => setDraft({ ...draft, aiPrompt: e.target.value })}
                rows={5}
                placeholder={t("folders.aiPromptPlaceholder", {
                  defaultValue:
                    "Décrivez ce qui doit aller dans ce dossier, les indices à chercher, et 1-2 contre-exemples.",
                })}
                className="text-[12px]"
              />
              <p className="text-[10px] text-[#b8c5d6] mt-1">
                {t("folders.aiPromptHelp", {
                  defaultValue:
                    "Si rempli, l'IA classera les nouveaux mails selon cette description (en plus des mots-clés).",
                })}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenCreate(false)}>
              {t("common.cancel", "Annuler")}
            </Button>
            <Button onClick={handleSubmit} disabled={!draft.name.trim() || createFolder.isPending || updateFolder.isPending}>
              {(createFolder.isPending || updateFolder.isPending) && (
                <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
              )}
              {editingFolder ? t("common.save", "Enregistrer") : t("common.create", "Créer")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
}
