import { DashboardLayout } from "@/components/layout/dashboard-layout";
import {
  useListCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  getListCategoriesQueryKey,
  useApplyPack,
  useGeneratePack,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { BackToInboxButton } from "@/components/dashboard/back-to-inbox-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
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
  Tags,
  Plus,
  MoreVertical,
  Edit2,
  Trash2,
  Sparkles,
  Check,
  Receipt,
  Headphones,
  TrendingUp,
  FileText,
  Mail,
  Users,
  Briefcase,
  ShieldCheck,
  Wrench,
  BookOpen,
  Search,
  Wand2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Package,
  Landmark,
  Truck,
  CalendarCheck,
  Globe,
  AlertTriangle,
  BarChart3,
  CreditCard,
  Building2,
  HandshakeIcon,
  ClipboardList,
  MessageSquare,
  Settings,
  ArrowLeftRight,
  Combine,
  Eye,
  EyeOff,
  ArrowRight,
  Folder,
  User as UserIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Switch } from "@/components/ui/switch";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { FAMILLES_METIERS, type PackMetier, type FamilleMetier } from "@/data/packs-metiers";
import { useTranslation } from 'react-i18next';
import { translateCategoryName, translateCategory } from "@/lib/category-translations";
import { customFetch, ApiError } from "@workspace/api-client-react";
import i18n from "@/i18n";
import { useLocation } from "wouter";

function useTranslatedPacks(t: any, lang: string): FamilleMetier[] {
  return useMemo(() => {
    if (lang === "fr") {
      return FAMILLES_METIERS.map((f) => ({
        ...f,
        name: t(`packs.families.${f.key}`, f.name),
      }));
    }
    return FAMILLES_METIERS.map((f) => ({
      ...f,
      name: t(`packs.families.${f.key}`, f.name),
      packs: f.packs.map((p) => ({
        ...p,
        name: t(`packs.items.${p.id}.name`, p.name),
        categories: p.categories.map((c, idx) => ({
          name: t(`packs.items.${p.id}.cats.${idx}.n`, c.name),
          description: t(`packs.items.${p.id}.cats.${idx}.d`, c.description),
        })),
      })),
    }));
  }, [t, lang]);
}

const SUGGESTED_CATEGORY_KEYS = [
  { key: "facturation", icon: Receipt, color: "text-amber-400 bg-amber-500/10" },
  { key: "support_client", icon: Headphones, color: "text-blue-400 bg-blue-500/10" },
  { key: "commercial", icon: TrendingUp, color: "text-emerald-400 bg-emerald-500/10" },
  { key: "administratif", icon: FileText, color: "text-purple-400 bg-purple-500/10" },
  { key: "newsletter_marketing", icon: Mail, color: "text-cyan-400 bg-cyan-500/10" },
  { key: "rh_equipe", icon: Users, color: "text-pink-400 bg-pink-500/10" },
  { key: "fournisseurs", icon: Briefcase, color: "text-orange-400 bg-orange-500/10" },
  { key: "juridique_conformite", icon: ShieldCheck, color: "text-red-400 bg-red-500/10" },
  { key: "technique_it", icon: Wrench, color: "text-indigo-400 bg-indigo-500/10" },
  { key: "formation", icon: BookOpen, color: "text-teal-400 bg-teal-500/10" },
  { key: "banque_finance", icon: Landmark, color: "text-green-400 bg-green-500/10" },
  { key: "logistique_livraisons", icon: Truck, color: "text-sky-400 bg-sky-500/10" },
  { key: "rendez_vous_planning", icon: CalendarCheck, color: "text-violet-400 bg-violet-500/10" },
  { key: "international_export", icon: Globe, color: "text-blue-300 bg-blue-400/10" },
  { key: "urgent_prioritaire", icon: AlertTriangle, color: "text-red-500 bg-red-600/10" },
  { key: "comptabilite", icon: BarChart3, color: "text-lime-400 bg-lime-500/10" },
  { key: "paiements_encaissements", icon: CreditCard, color: "text-yellow-400 bg-yellow-500/10" },
  { key: "partenaires_sous_traitants", icon: HandshakeIcon, color: "text-emerald-300 bg-emerald-400/10" },
  { key: "projets", icon: ClipboardList, color: "text-fuchsia-400 bg-fuchsia-500/10" },
  { key: "communication_interne", icon: MessageSquare, color: "text-rose-400 bg-rose-500/10" },
  { key: "immobilier_locaux", icon: Building2, color: "text-stone-400 bg-stone-500/10" },
  { key: "abonnements_saas", icon: Settings, color: "text-slate-400 bg-slate-500/10" },
  { key: "devis_negociations", icon: ArrowLeftRight, color: "text-amber-300 bg-amber-400/10" },
  { key: "spam_a_supprimer", icon: Trash2, color: "text-gray-400 bg-gray-500/10" },
];

const categorySchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
});

type CategoryFormValues = z.infer<typeof categorySchema>;

const categoryColors = [
  "bg-blue-500/10 text-blue-400",
  "bg-purple-500/10 text-purple-400",
  "bg-emerald-500/10 text-emerald-400",
  "bg-amber-500/10 text-amber-400",
  "bg-red-500/10 text-red-400",
  "bg-cyan-500/10 text-cyan-400",
  "bg-pink-500/10 text-pink-400",
  "bg-indigo-500/10 text-indigo-400",
];

export default function Classement() {
  const { t, i18n } = useTranslation();
  const lang = (i18n.resolvedLanguage ?? i18n.language.split("-")[0]).substring(0, 2);
  const translatedFamilles = useTranslatedPacks(t, lang);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: categories, isLoading } = useListCategories();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();
  const applyPack = useApplyPack();
  const generatePack = useGeneratePack();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editCategory, setEditCategory] = useState<any>(null);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [addingNames, setAddingNames] = useState<Set<string>>(new Set());

  const [packSearch, setPackSearch] = useState("");
  const [expandedFamilles, setExpandedFamilles] = useState<Set<string>>(
    new Set(FAMILLES_METIERS.map((f) => f.key))
  );
  const [selectedPack, setSelectedPack] = useState<PackMetier | null>(null);
  const [isApplyDialogOpen, setIsApplyDialogOpen] = useState(false);
  const [isAiDialogOpen, setIsAiDialogOpen] = useState(false);
  const [aiDescription, setAiDescription] = useState("");
  const [aiGeneratedPack, setAiGeneratedPack] = useState<{
    packName: string;
    categories: { name: string; description: string }[];
  } | null>(null);

  // ---- Refonte : doublons, fusion, vue inutilisées, modale near-dup ----
  type DuplicateCat = { id: number; name: string; sourcePack: string | null; emailCount: number };
  type DuplicatePair = { a: DuplicateCat; b: DuplicateCat; similarity: number };

  const [showUnused, setShowUnused] = useState(true);
  const [isCleanupOpen, setIsCleanupOpen] = useState(false);
  const [mergeConfirm, setMergeConfirm] = useState<{
    source: DuplicateCat;
    target: DuplicateCat;
  } | null>(null);
  const [mergeBusy, setMergeBusy] = useState(false);
  const [nearDup, setNearDup] = useState<null | {
    source: "form" | "suggestion";
    name: string;
    description: string;
    similar: Array<{ id: number; name: string; similarity: number }>;
    suggestionKey?: string;
  }>(null);
  const [forcing, setForcing] = useState(false);

  // Détection des paires de doublons côté serveur. Refetch après chaque
  // mutation (création, fusion, suppression).
  const duplicatesQuery = useQuery({
    queryKey: ["categories", "duplicates"],
    queryFn: () =>
      customFetch<{ pairs: DuplicatePair[] }>("/api/categories/duplicates"),
    staleTime: 10_000,
  });
  const duplicatePairs = duplicatesQuery.data?.pairs ?? [];

  // Set des noms "standards" (= proposés dans les suggestions) toutes langues
  // confondues, pour distinguer les catégories standard des purement manuelles
  // dans la section "Mes catégories" (les catégories avec sourcePack restent
  // toujours classées dans leur pack, prioritairement).
  const standardNamesSet = useMemo(() => {
    const set = new Set<string>();
    const langs = ["fr", "en", "nl", "de", "es"];
    for (const lang of langs) {
      for (const k of SUGGESTED_CATEGORY_KEYS) {
        const name = i18n.getResource(
          lang,
          "translation",
          `classification.suggestedCats.${k.key}.name`,
        );
        if (typeof name === "string" && name.trim()) {
          set.add(name.toLowerCase().trim());
        }
      }
    }
    return set;
  }, []);

  type GroupKind = "system" | "pack" | "standard" | "manual";
  type CategoryGroup = { key: string; kind: GroupKind; label: string; items: any[] };

  const filteredCategories = useMemo(() => {
    const list = categories || [];
    if (showUnused) return list;
    return list.filter((c: any) => (c.emailCount || 0) > 0);
  }, [categories, showUnused]);

  const unusedCount = useMemo(
    () => (categories || []).filter((c: any) => (c.emailCount || 0) === 0).length,
    [categories],
  );

  // Regroupement : catégories à sourcePack → une section par pack ;
  // catégories sans sourcePack mais nom = standard → "Catégories standards" ;
  // tout le reste → "Mes catégories personnelles".
  // La catégorie système "Non classé" est volontairement masquée ici :
  // elle se gère exclusivement depuis le tableau de bord (compteur d'emails
  // à reclasser dans la barre latérale "Réception").
  const groupedCategories = useMemo<CategoryGroup[]>(() => {
    const byPack = new Map<string, any[]>();
    const standards: any[] = [];
    const manuals: any[] = [];
    for (const cat of filteredCategories as any[]) {
      if (cat.isSystem === true) continue; // masquée — gérée dans le dashboard
      const pack = (cat.sourcePack || "").trim();
      if (pack) {
        if (!byPack.has(pack)) byPack.set(pack, []);
        byPack.get(pack)!.push(cat);
        continue;
      }
      const norm = (cat.name || "").toLowerCase().trim();
      if (standardNamesSet.has(norm)) {
        standards.push(cat);
      } else {
        manuals.push(cat);
      }
    }
    const groups: CategoryGroup[] = [];
    // Packs : un par sourcePack distinct, triés par nom de pack
    Array.from(byPack.keys())
      .sort((x, y) => x.localeCompare(y))
      .forEach((packName) => {
        groups.push({
          key: `pack:${packName}`,
          kind: "pack",
          label: t("classification.sections.byPack", { name: packName }),
          items: byPack.get(packName)!,
        });
      });
    if (standards.length > 0) {
      groups.push({
        key: "standards",
        kind: "standard",
        label: t("classification.sections.standards"),
        items: standards,
      });
    }
    if (manuals.length > 0) {
      groups.push({
        key: "manual",
        kind: "manual",
        label: t("classification.sections.manual"),
        items: manuals,
      });
    }
    return groups;
  }, [categories, filteredCategories, standardNamesSet, t]);

  const extractSimilar = (
    err: unknown,
  ): Array<{ id: number; name: string; similarity: number }> | null => {
    if (err instanceof ApiError && err.status === 409) {
      const data = err.data as
        | { similar?: Array<{ id: number; name: string; similarity: number }> }
        | null;
      if (data && Array.isArray(data.similar) && data.similar.length > 0) {
        return data.similar;
      }
    }
    return null;
  };

  const forceCreateCategory = async (name: string, description: string) => {
    return customFetch<{ id: number; name: string }>(
      "/api/categories?force=1",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Force-Create": "1" },
        body: JSON.stringify({ name, description }),
      },
    );
  };

  const handleNearDupForce = async () => {
    if (!nearDup) return;
    setForcing(true);
    try {
      await forceCreateCategory(nearDup.name, nearDup.description);
      await queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
      await duplicatesQuery.refetch();
      toast({ title: t("classification.categoryCreated") });
      if (nearDup.source === "form") {
        setIsCreateOpen(false);
        createForm.reset();
      }
      setNearDup(null);
    } catch {
      toast({
        variant: "destructive",
        title: t("common.error"),
        description: t("classification.createError"),
      });
    } finally {
      setForcing(false);
    }
  };

  const handleNearDupUseExisting = () => {
    if (!nearDup) return;
    if (nearDup.source === "form") {
      setIsCreateOpen(false);
      createForm.reset();
    }
    toast({
      title: t("classification.duplicateWarning.usedExistingToast", {
        name: nearDup.similar[0]?.name ?? "",
      }),
    });
    setNearDup(null);
  };

  const doMerge = async (source: DuplicateCat, target: DuplicateCat) => {
    setMergeBusy(true);
    try {
      const result = await customFetch<{
        movedEmails: number;
        deletedCategoryId: number;
        targetCategoryId: number;
        targetName: string;
      }>(`/api/categories/${source.id}/merge-into/${target.id}`, {
        method: "POST",
      });
      await queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
      await duplicatesQuery.refetch();
      toast({
        title: t("classification.cleanupDuplicates.mergedToast", {
          count: result.movedEmails,
          target: result.targetName,
        }),
      });
      setMergeConfirm(null);
    } catch {
      toast({
        variant: "destructive",
        title: t("common.error"),
        description: t("classification.deleteErrorDesc"),
      });
    } finally {
      setMergeBusy(false);
    }
  };

  const suggestedCategories = useMemo(() => {
    return SUGGESTED_CATEGORY_KEYS.map((s) => ({
      ...s,
      name: t(`classification.suggestedCats.${s.key}.name`),
      description: t(`classification.suggestedCats.${s.key}.desc`),
    }));
  }, [t]);

  const existingNames = useMemo(() => {
    return new Set(
      (categories || []).map((c: any) => c.name.toLowerCase())
    );
  }, [categories]);

  const availableSuggestions = useMemo(() => {
    return suggestedCategories.filter(
      (s) => !existingNames.has(s.name.toLowerCase())
    );
  }, [existingNames, suggestedCategories]);

  const filteredFamilles = useMemo(() => {
    if (!packSearch.trim()) return translatedFamilles;
    const q = packSearch.toLowerCase();
    return translatedFamilles.map((f) => ({
      ...f,
      packs: f.packs.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.categories.some((c) => c.name.toLowerCase().includes(q))
      ),
    })).filter((f) => f.packs.length > 0);
  }, [packSearch, translatedFamilles]);

  const handleAddSuggestion = (
    suggestion: { name: string; description: string; key: string }
  ) => {
    setAddingNames((prev) => new Set(prev).add(suggestion.key));
    createCategory.mutate(
      { data: { name: suggestion.name, description: suggestion.description } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getListCategoriesQueryKey(),
          });
          setAddingNames((prev) => {
            const next = new Set(prev);
            next.delete(suggestion.key);
            return next;
          });
          toast({ title: `"${suggestion.name}" ${t("classification.added")}` });
        },
        onError: (err: unknown) => {
          setAddingNames((prev) => {
            const next = new Set(prev);
            next.delete(suggestion.key);
            return next;
          });
          const similar = extractSimilar(err);
          if (similar) {
            setNearDup({
              source: "suggestion",
              name: suggestion.name,
              description: suggestion.description,
              similar,
              suggestionKey: suggestion.key,
            });
            return;
          }
          toast({
            variant: "destructive",
            title: t("common.error"),
            description: t("classification.addErrorDesc", { name: suggestion.name }),
          });
        },
      }
    );
  };

  const handleAddAllSuggestions = () => {
    availableSuggestions.forEach((s) => handleAddSuggestion(s));
  };

  const createForm = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema as any),
    defaultValues: { name: "", description: "" },
  });

  const editForm = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema as any),
  });

  const handleOpenEdit = (category: any) => {
    setEditCategory(category);
    editForm.reset({
      name: category.name,
      description: category.description || "",
    });
  };

  const onSubmitCreate = (data: CategoryFormValues) => {
    createCategory.mutate(
      { data },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getListCategoriesQueryKey(),
          });
          duplicatesQuery.refetch();
          setIsCreateOpen(false);
          createForm.reset();
          toast({ title: t("classification.categoryCreated") });
        },
        onError: (err: unknown) => {
          const similar = extractSimilar(err);
          if (similar) {
            setNearDup({
              source: "form",
              name: data.name,
              description: data.description || "",
              similar,
            });
            return;
          }
          toast({
            variant: "destructive",
            title: t("common.error"),
            description: t("classification.createError"),
          });
        },
      }
    );
  };

  // Détecte le code d'erreur "system_category_protected" renvoyé par l'API
  // pour les opérations interdites sur la catégorie système (rename / delete /
  // merge). On accepte n'importe quelle réponse JSON tant qu'elle a un champ
  // `error` string, sans recourir à un cast `as any`.
  const isSystemCategoryProtectedError = (err: unknown): boolean => {
    if (!(err instanceof ApiError) || err.status !== 400) return false;
    const data = err.data;
    if (data === null || typeof data !== "object") return false;
    const errCode = (data as { error?: unknown }).error;
    return errCode === "system_category_protected";
  };

  const onSubmitEdit = (data: CategoryFormValues) => {
    if (!editCategory) return;
    updateCategory.mutate(
      { id: editCategory.id, data },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getListCategoriesQueryKey(),
          });
          setEditCategory(null);
          toast({ title: t("classification.categoryUpdated") });
        },
        onError: (err: unknown) => {
          // La catégorie système "Non classé" ne peut pas être renommée :
          // l'API renvoie 400 avec error="system_category_protected".
          if (isSystemCategoryProtectedError(err)) {
            setEditCategory(null);
            toast({
              variant: "destructive",
              title: t("common.error"),
              description: t("classification.systemCat.cannotRename"),
            });
            return;
          }
          toast({
            variant: "destructive",
            title: t("common.error"),
            description: t("classification.updateError"),
          });
        },
      }
    );
  };

  const handleDelete = (id: number) => {
    deleteCategory.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getListCategoriesQueryKey(),
          });
          toast({ title: t("classification.categoryDeleted") });
        },
        onError: (err: unknown) => {
          queryClient.invalidateQueries({
            queryKey: getListCategoriesQueryKey(),
          });
          // Idem côté suppression : message dédié quand la catégorie est protégée.
          if (isSystemCategoryProtectedError(err)) {
            toast({
              variant: "destructive",
              title: t("common.error"),
              description: t("classification.systemCat.cannotDelete"),
            });
            return;
          }
          toast({
            title: t("common.error"),
            description: t("classification.deleteErrorDesc"),
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleSelectPack = (pack: PackMetier) => {
    setSelectedPack(pack);
    setIsApplyDialogOpen(true);
  };

  const getNewCategoriesCount = (pack: PackMetier) => {
    return pack.categories.filter(
      (c) => !existingNames.has(c.name.toLowerCase())
    ).length;
  };

  const handleApplyPack = () => {
    if (!selectedPack) return;
    applyPack.mutate(
      {
        data: {
          packName: selectedPack.name,
          categories: selectedPack.categories.map((c) => ({
            name: c.name,
            description: c.description,
          })),
        },
      },
      {
        onSuccess: (data: any) => {
          queryClient.invalidateQueries({
            queryKey: getListCategoriesQueryKey(),
          });
          setIsApplyDialogOpen(false);
          setSelectedPack(null);
          toast({
            title: t("classification.packAppliedTitle", { name: selectedPack.name }),
            description: t("classification.packAppliedDesc", { added: data.added, skipped: data.skipped }),
          });
        },
        onError: () => {
          toast({
            variant: "destructive",
            title: t("common.error"),
            description: t("classification.applyPackError"),
          });
        },
      }
    );
  };

  const handleGeneratePack = () => {
    if (!aiDescription.trim()) return;
    generatePack.mutate(
      { data: { description: aiDescription } },
      {
        onSuccess: (data: any) => {
          setAiGeneratedPack({
            packName: data.packName,
            categories: data.categories,
          });
        },
        onError: () => {
          toast({
            variant: "destructive",
            title: t("common.error"),
            description: t("classification.generateRetryError"),
          });
        },
      }
    );
  };

  const handleApplyAiPack = () => {
    if (!aiGeneratedPack) return;
    applyPack.mutate(
      {
        data: {
          packName: aiGeneratedPack.packName,
          categories: aiGeneratedPack.categories,
        },
      },
      {
        onSuccess: (data: any) => {
          queryClient.invalidateQueries({
            queryKey: getListCategoriesQueryKey(),
          });
          setIsAiDialogOpen(false);
          setAiGeneratedPack(null);
          setAiDescription("");
          toast({
            title: t("classification.packAppliedTitle", { name: aiGeneratedPack.packName }),
            description: t("classification.packAppliedDesc", { added: data.added, skipped: data.skipped }),
          });
        },
        onError: () => {
          toast({
            variant: "destructive",
            title: t("common.error"),
            description: t("classification.applyPackError"),
          });
        },
      }
    );
  };

  const toggleFamille = (key: string) => {
    setExpandedFamilles((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-5">
        <BackToInboxButton />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div>
            <h1 className="text-[16px] font-semibold text-white tracking-tight">
              {t("classification.title")}
            </h1>
            <p className="text-[12px] text-[#8b9cb3] mt-0.5">
              {t("classification.subtitle")}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {duplicatePairs.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCleanupOpen(true)}
                className="gap-2 border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
              >
                <Combine className="w-3.5 h-3.5" />
                {t("classification.cleanupDuplicates.buttonCount", {
                  count: duplicatePairs.length,
                })}
              </Button>
            )}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Plus className="w-3.5 h-3.5" />
                  {t("classification.newCategory")}
                </Button>
              </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle className="text-white">
                  {t("classification.createCategory")}
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
                        <FormLabel className="text-[#8b9cb3]">{t("classification.nameLabel")}</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Ex: Factures, Fournisseurs..."
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
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[#8b9cb3]">
                          {t("classification.descriptionHelp")}
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Ex: Tous les emails contenant des factures, devis ou reçus."
                            className="resize-none h-24 bg-background border-border text-white"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button
                      type="submit"
                      disabled={createCategory.isPending}
                    >
                      {createCategory.isPending ? t("classification.creating") : t("classification.create")}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        <Dialog
          open={!!editCategory}
          onOpenChange={(open) => !open && setEditCategory(null)}
        >
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-white">
                {t("classification.editCategory")}
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
                      <FormLabel className="text-[#8b9cb3]">{t("classification.nameLabel")}</FormLabel>
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
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[#8b9cb3]">
                        {t("classification.descriptionLabel")}
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          className="resize-none h-24 bg-background border-border text-white"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button
                    type="submit"
                    disabled={updateCategory.isPending}
                  >
                    {updateCategory.isPending
                      ? t("classification.saving")
                      : t("common.save")}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <Dialog open={isApplyDialogOpen} onOpenChange={setIsApplyDialogOpen}>
          <DialogContent className="bg-card border-border max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-white">
                {t("classification.applyPackTitle", { name: selectedPack?.name })}
              </DialogTitle>
            </DialogHeader>
            {selectedPack && (
              <div className="space-y-4">
                <p className="text-[13px] text-[#8b9cb3]">
                  {t("classification.packWillAddDesc", { count: getNewCategoriesCount(selectedPack) })}
                </p>
                {selectedPack.categories.length -
                  getNewCategoriesCount(selectedPack) >
                  0 && (
                  <p className="text-[12px] text-amber-400/80">
                    {t("classification.alreadyExistCount", { count: selectedPack.categories.length - getNewCategoriesCount(selectedPack) })}
                  </p>
                )}
                <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                  {selectedPack.categories.map((cat) => {
                    const exists = existingNames.has(cat.name.toLowerCase());
                    return (
                      <div
                        key={cat.name}
                        className={`flex items-start gap-2 p-2 rounded-md text-[12px] ${
                          exists
                            ? "opacity-40 line-through"
                            : "bg-white/[0.03]"
                        }`}
                      >
                        <Tags className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                        <div>
                          <span className="text-white font-medium">
                            {cat.name}
                          </span>
                          {exists && (
                            <span className="text-amber-400 ml-1 no-underline">
                              {t("classification.alreadyExists")}
                            </span>
                          )}
                          <p className="text-[#8b9cb3] text-[11px]">
                            {translateCategory(cat.name, cat.description, lang).description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <DialogFooter>
                  <Button
                    variant="ghost"
                    onClick={() => setIsApplyDialogOpen(false)}
                    className="text-[#8b9cb3]"
                  >
                    {t("common.cancel")}
                  </Button>
                  <Button
                    onClick={handleApplyPack}
                    disabled={
                      applyPack.isPending ||
                      getNewCategoriesCount(selectedPack) === 0
                    }
                    className="gap-2"
                  >
                    {applyPack.isPending ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        {t("classification.applying")}
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        {t("classification.applyCount", { count: getNewCategoriesCount(selectedPack) })}
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog
          open={isAiDialogOpen}
          onOpenChange={(open) => {
            setIsAiDialogOpen(open);
            if (!open) {
              setAiGeneratedPack(null);
              setAiDescription("");
            }
          }}
        >
          <DialogContent className="bg-card border-border max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2">
                <Wand2 className="w-4 h-4 text-primary" />
                {t("classification.generateCustomTitle")}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {!aiGeneratedPack ? (
                <>
                  <p className="text-[13px] text-[#8b9cb3]">
                    {t("classification.generateCustomDesc")}
                  </p>
                  <Textarea
                    placeholder="Ex: Cabinet d'ostéopathie spécialisé dans le sport, avec gestion de rendez-vous patients, contacts médecins et clubs sportifs..."
                    value={aiDescription}
                    onChange={(e) => setAiDescription(e.target.value)}
                    className="resize-none h-28 bg-background border-border text-white text-[13px]"
                  />
                  <DialogFooter>
                    <Button
                      variant="ghost"
                      onClick={() => setIsAiDialogOpen(false)}
                      className="text-[#8b9cb3]"
                    >
                      {t("common.cancel")}
                    </Button>
                    <Button
                      onClick={handleGeneratePack}
                      disabled={
                        generatePack.isPending || !aiDescription.trim()
                      }
                      className="gap-2"
                    >
                      {generatePack.isPending ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          {t("classification.generating")}
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          {t("classification.generate")}
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </>
              ) : (
                <>
                  <p className="text-[13px] text-[#8b9cb3]">
                    {t("classification.packGeneratedDesc", { name: aiGeneratedPack.packName, count: aiGeneratedPack.categories.length })}
                  </p>
                  <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                    {aiGeneratedPack.categories.map((cat) => {
                      const exists = existingNames.has(
                        cat.name.toLowerCase()
                      );
                      return (
                        <div
                          key={cat.name}
                          className={`flex items-start gap-2 p-2 rounded-md text-[12px] ${
                            exists
                              ? "opacity-40 line-through"
                              : "bg-white/[0.03]"
                          }`}
                        >
                          <Tags className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                          <div>
                            <span className="text-white font-medium">
                              {cat.name}
                            </span>
                            {exists && (
                              <span className="text-amber-400 ml-1 no-underline">
                                {t("classification.alreadyExists")}
                              </span>
                            )}
                            <p className="text-[#8b9cb3] text-[11px]">
                              {translateCategory(cat.name, cat.description, lang).description}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <DialogFooter>
                    <Button
                      variant="ghost"
                      onClick={() => setAiGeneratedPack(null)}
                      className="text-[#8b9cb3]"
                    >
                      {t("classification.regenerate")}
                    </Button>
                    <Button
                      onClick={handleApplyAiPack}
                      disabled={applyPack.isPending}
                      className="gap-2"
                    >
                      {applyPack.isPending ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          {t("classification.applying")}
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          {t("classification.applyThisPack")}
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* === MES CATÉGORIES (TOP) === */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Tags className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h2 className="text-[14px] font-semibold text-white">
                  {t("classification.myCategories")}
                </h2>
                <p className="text-[12px] text-[#8b9cb3]">
                  {t("classification.countCategories", { count: categories?.length ?? 0 })}
                  {unusedCount > 0 && (
                    <span className="ml-2 text-amber-400/80">
                      · {t("classification.countUnused", { count: unusedCount })}
                    </span>
                  )}
                </p>
              </div>
            </div>
            {unusedCount > 0 && (
              <div className="flex items-center gap-2">
                <Switch
                  id="show-unused"
                  checked={showUnused}
                  onCheckedChange={setShowUnused}
                />
                <label
                  htmlFor="show-unused"
                  className="text-[12px] text-[#8b9cb3] flex items-center gap-1.5 cursor-pointer"
                >
                  {showUnused ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  {showUnused
                    ? t("classification.unusedToggle.hide")
                    : t("classification.unusedToggle.show")}
                </label>
              </div>
            )}
          </div>

          {duplicatePairs.length > 0 && (
            <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/[0.04] p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <Combine className="w-4 h-4 text-amber-400 shrink-0" />
                <p className="text-[12px] text-amber-200">
                  {t("classification.cleanupDuplicates.desc", {
                    count: duplicatePairs.length,
                  })}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
                onClick={() => setIsCleanupOpen(true)}
              >
                {t("classification.cleanupDuplicates.button")}
              </Button>
            </div>
          )}

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {Array(6)
                .fill(0)
                .map((_, i) => (
                  <div
                    key={i}
                    className="bg-card rounded-lg border border-border p-5"
                  >
                    <Skeleton className="w-8 h-8 rounded-lg bg-white/5 mb-3" />
                    <Skeleton className="h-5 w-3/4 mb-2 bg-white/5" />
                    <Skeleton className="h-4 w-full bg-white/5" />
                  </div>
                ))}
            </div>
          ) : (categories?.length ?? 0) === 0 ? (
            <div className="text-center py-20 rounded-lg border border-border border-dashed bg-card/50">
              <Tags className="mx-auto h-12 w-12 text-[#8b9cb3]/20 mb-3" />
              <h3 className="text-sm font-medium text-white mb-1">
                {t("classification.noCategories")}
              </h3>
              <p className="text-[13px] text-[#8b9cb3] mb-4">
                {t("classification.noCategoriesAltDesc")}
              </p>
              <Button onClick={() => setIsCreateOpen(true)} size="sm">
                <Plus className="w-3.5 h-3.5 mr-2" />
                {t("classification.createFirst")}
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {groupedCategories.map(
                (group) =>
                  group.items.length > 0 && (
                    <div key={group.key}>
                      <div className="flex items-center gap-2 mb-3">
                        {group.kind === "system" ? (
                          <ShieldCheck className="w-3.5 h-3.5 text-amber-400/80" />
                        ) : group.kind === "pack" ? (
                          <Package className="w-3.5 h-3.5 text-primary/70" />
                        ) : group.kind === "standard" ? (
                          <Folder className="w-3.5 h-3.5 text-blue-400/70" />
                        ) : (
                          <UserIcon className="w-3.5 h-3.5 text-purple-400/70" />
                        )}
                        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[#8b9cb3]">
                          {group.label}
                        </h3>
                        <span className="text-[11px] text-[#8b9cb3]/50">
                          ({group.items.length})
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {group.items.map((cat: any, i: number) => {
                          const allList = (categories ?? []) as any[];
                          const idx = allList.findIndex(
                            (c: any) => c.id === cat.id,
                          );
                          const colorIdx =
                            (idx >= 0 ? idx : i) % categoryColors.length;
                          const isUnused = (cat.emailCount || 0) === 0;
                          const isSystemCat = cat.isSystem === true;
                          const toSortCount = isSystemCat ? (cat.emailCount || 0) : 0;
                          const originLabel = isSystemCat
                            ? t("classification.origin.system")
                            : cat.sourcePack
                              ? cat.sourcePack
                              : group.kind === "standard"
                                ? t("classification.origin.standard")
                                : t("classification.origin.manual");
                          const originColor = isSystemCat
                            ? "bg-white/[0.06] text-[#8b9cb3]"
                            : cat.sourcePack
                              ? "bg-primary/10 text-primary/80"
                              : group.kind === "standard"
                                ? "bg-blue-500/10 text-blue-300"
                                : "bg-purple-500/10 text-purple-300";
                          // La carte système n'est jamais "grisée" (elle peut être
                          // vide volontairement, c'est une bonne nouvelle).
                          const cardClasses = isSystemCat
                            ? "bg-card rounded-lg border border-amber-500/30 p-5 hover:border-amber-500/50 transition-colors group"
                            : `bg-card rounded-lg border p-5 hover:border-primary/30 transition-colors group ${
                                isUnused
                                  ? "border-border/50 opacity-70"
                                  : "border-border"
                              }`;
                          // Pour la catégorie système, on affiche le nom et la
                          // description traduits depuis i18n, indépendamment de
                          // ce qui est stocké en base (créé en français côté
                          // serveur).
                          const displayName = isSystemCat
                            ? t("classification.systemCat.name")
                            : translateCategoryName(cat.name, lang);
                          const displayDescription = isSystemCat
                            ? t("classification.systemCat.description")
                            : translateCategory(cat.name, cat.description, lang).description;
                          return (
                            <div key={cat.id} className={cardClasses}>
                              <div className="flex justify-between items-start mb-3 gap-2">
                                <div
                                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                                    isSystemCat
                                      ? "bg-amber-500/15 text-amber-300"
                                      : categoryColors[colorIdx]
                                  }`}
                                >
                                  {isSystemCat ? (
                                    <ShieldCheck className="w-4 h-4" />
                                  ) : (
                                    <Tags className="w-4 h-4" />
                                  )}
                                </div>
                                <div className="flex items-center gap-1 flex-wrap justify-end">
                                  <span
                                    className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${originColor}`}
                                  >
                                    {originLabel}
                                  </span>
                                  {isSystemCat && toSortCount > 0 && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-300 font-semibold">
                                      {t("classification.systemCat.toSortBadge", { count: toSortCount })}
                                    </span>
                                  )}
                                  {!isSystemCat && isUnused && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 font-medium">
                                      {t("classification.unusedBadge")}
                                    </span>
                                  )}
                                  {/* Menu d'actions masqué pour la catégorie
                                      système : elle ne peut être ni éditée ni
                                      supprimée. */}
                                  {!isSystemCat && (
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-7 w-7 text-[#8b9cb3] opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/[0.06]"
                                        >
                                          <MoreVertical className="h-3.5 w-3.5" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent
                                        align="end"
                                        className="bg-card border-border"
                                      >
                                        <DropdownMenuItem
                                          onClick={() => handleOpenEdit(cat)}
                                          className="gap-2 cursor-pointer text-[#8b9cb3] hover:text-white"
                                        >
                                          <Edit2 className="h-3.5 w-3.5" />{" "}
                                          {t("classification.edit")}
                                        </DropdownMenuItem>
                                        <AlertDialog>
                                          <AlertDialogTrigger asChild>
                                            <DropdownMenuItem
                                              onSelect={(e) => e.preventDefault()}
                                              className="gap-2 text-red-400 cursor-pointer"
                                            >
                                              <Trash2 className="h-3.5 w-3.5" />{" "}
                                              {t("common.delete")}
                                            </DropdownMenuItem>
                                          </AlertDialogTrigger>
                                          <AlertDialogContent className="bg-card border-border">
                                            <AlertDialogHeader>
                                              <AlertDialogTitle className="text-white">
                                                {t("classification.deleteConfirmTitle")}
                                              </AlertDialogTitle>
                                              <AlertDialogDescription className="text-[#8b9cb3]">
                                                {t("classification.deleteConfirmCatDesc", {
                                                  name: cat.name,
                                                })}
                                              </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                              <AlertDialogCancel className="bg-background border-border text-[#8b9cb3] hover:bg-white/[0.04]">
                                                {t("common.cancel")}
                                              </AlertDialogCancel>
                                              <AlertDialogAction
                                                onClick={() => handleDelete(cat.id)}
                                                className="bg-red-500 text-white hover:bg-red-600"
                                              >
                                                {t("common.delete")}
                                              </AlertDialogAction>
                                            </AlertDialogFooter>
                                          </AlertDialogContent>
                                        </AlertDialog>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  )}
                                </div>
                              </div>

                              <h3 className="text-[14px] font-semibold text-white mb-1">
                                {displayName}
                              </h3>
                              <p className="text-[12px] text-[#8b9cb3] line-clamp-2 h-9 mb-3">
                                {displayDescription || (
                                  <span className="italic opacity-50">
                                    {t("classification.noDescription")}
                                  </span>
                                )}
                              </p>

                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center text-[12px] text-[#8b9cb3] bg-white/[0.04] px-2.5 py-1 rounded-md inline-flex w-fit">
                                  <span className="text-primary font-medium mr-1">
                                    {cat.emailCount || 0}
                                  </span>
                                  {t("classification.emailsLabel")}
                                </div>
                                {isSystemCat && toSortCount > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => setLocation("/dashboard")}
                                    className="text-[12px] text-orange-300 hover:text-orange-200 inline-flex items-center gap-1 font-medium"
                                  >
                                    {t("classification.systemCat.goToInbox")}
                                    <ArrowRight className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ),
              )}
            </div>
          )}
        </div>

        {/* === ACCORDION BOTTOM (Packs métiers + Suggestions) === */}
        <Accordion type="multiple" className="space-y-3">
          <AccordionItem
            value="industry-packs"
            className="rounded-lg border border-border bg-card/50 px-4"
          >
            <AccordionTrigger className="hover:no-underline py-3">
              <div className="flex items-center gap-2 text-left">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Package className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h2 className="text-[14px] font-semibold text-white">
                    {t("classification.industryPacksAccordion")}
                  </h2>
                  <p className="text-[12px] text-[#8b9cb3] font-normal">
                    {t("classification.industryPacksAccordionDesc")}
                  </p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-2 pb-4">
              <div className="flex justify-end mb-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 text-[12px] border-primary/30 text-primary hover:bg-primary/10"
                  onClick={() => setIsAiDialogOpen(true)}
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  {t("classification.jobNotListed")}
                </Button>
              </div>
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8b9cb3]" />
                <Input
                  placeholder={t("classification.searchJobs")}
                  value={packSearch}
                  onChange={(e) => setPackSearch(e.target.value)}
                  className="pl-10 bg-background border-border text-white text-[13px]"
                />
              </div>
              {filteredFamilles.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-[13px] text-[#8b9cb3]">
                    {t("classification.noJobFound")}{" "}
                    <button
                      onClick={() => setIsAiDialogOpen(true)}
                      className="text-primary hover:underline"
                    >
                      {t("classification.generateCustomWithAI")}
                    </button>
                  </p>
                </div>
              )}
              <div className="space-y-3">
                {filteredFamilles.map((famille) => (
                  <div
                    key={famille.key}
                    className="rounded-lg border border-border overflow-hidden"
                  >
                    <button
                      onClick={() => toggleFamille(famille.key)}
                      className="w-full flex items-center justify-between px-4 py-2.5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
                    >
                      <span className="text-[13px] font-medium text-white">
                        {famille.name}
                        <span className="text-[#8b9cb3] font-normal ml-2">
                          ({famille.packs.length})
                        </span>
                      </span>
                      {expandedFamilles.has(famille.key) ? (
                        <ChevronUp className="w-4 h-4 text-[#8b9cb3]" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-[#8b9cb3]" />
                      )}
                    </button>
                    {expandedFamilles.has(famille.key) && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 p-3">
                        {famille.packs.map((pack) => {
                          const Icon = pack.icon;
                          const newCount = getNewCategoriesCount(pack);
                          return (
                            <div
                              key={pack.id}
                              className="flex flex-col items-start gap-2 p-3 rounded-lg border border-border bg-background hover:border-primary/40 hover:bg-primary/[0.04] transition-all text-left group"
                            >
                              <div className="flex items-center gap-2 w-full">
                                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                  <Icon className="w-4 h-4 text-primary" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-[12px] font-medium text-white truncate">
                                    {pack.name}
                                  </p>
                                  <p className="text-[10px] text-[#8b9cb3]">
                                    {t("classification.categoriesCount", {
                                      count: pack.categories.length,
                                    })}
                                    {newCount < pack.categories.length && (
                                      <span className="text-primary ml-1">
                                        {t("classification.newCount", {
                                          count: newCount,
                                        })}
                                      </span>
                                    )}
                                  </p>
                                </div>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full text-[11px] h-7 border-primary/30 text-primary hover:bg-primary/10 mt-1"
                                onClick={() => handleSelectPack(pack)}
                              >
                                <Plus className="w-3 h-3 mr-1" />
                                {t("classification.apply")}
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>

          {availableSuggestions.length > 0 && (
            <AccordionItem
              value="suggestions"
              className="rounded-lg border border-border bg-card/50 px-4"
            >
              <AccordionTrigger className="hover:no-underline py-3">
                <div className="flex items-center gap-2 text-left">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-[14px] font-semibold text-white">
                      {t("classification.suggestionsAccordion")}
                    </h2>
                    <p className="text-[12px] text-[#8b9cb3] font-normal">
                      {t("classification.suggestionsAccordionDesc")}
                    </p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-4">
                <div className="flex justify-end mb-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-[12px] border-primary/30 text-primary hover:bg-primary/10"
                    onClick={handleAddAllSuggestions}
                    disabled={addingNames.size > 0}
                  >
                    {t("classification.addAll")}
                  </Button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                  {availableSuggestions.map((s) => {
                    const Icon = s.icon;
                    const isAdding = addingNames.has(s.key);
                    return (
                      <button
                        key={s.key}
                        onClick={() => handleAddSuggestion(s)}
                        disabled={isAdding}
                        className="flex flex-col items-center gap-2 p-3 rounded-lg border border-border bg-card hover:border-primary/40 hover:bg-primary/[0.04] transition-all text-center group disabled:opacity-50"
                      >
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center ${s.color} group-hover:scale-110 transition-transform`}
                        >
                          {isAdding ? (
                            <Check className="w-4 h-4 animate-pulse" />
                          ) : (
                            <Icon className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <p className="text-[12px] font-medium text-white">
                            {s.name}
                          </p>
                          <p className="text-[10px] text-[#8b9cb3] line-clamp-1 mt-0.5">
                            {s.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>

        {/* === DIALOG NEAR-DUPLICATE === */}
        <Dialog open={!!nearDup} onOpenChange={(open) => !open && setNearDup(null)}>
          <DialogContent className="bg-card border-border max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                {t("classification.nearDup.title")}
              </DialogTitle>
            </DialogHeader>
            {nearDup && (
              <div className="space-y-4">
                <p className="text-[13px] text-[#8b9cb3]">
                  {t("classification.nearDup.desc", { name: nearDup.name })}
                </p>
                <div className="space-y-2">
                  {nearDup.similar.slice(0, 3).map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between p-3 rounded-md bg-white/[0.03] border border-border"
                    >
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-white truncate">
                          {s.name}
                        </p>
                        <p className="text-[11px] text-[#8b9cb3]">
                          {t("classification.nearDup.similarity", {
                            pct: Math.round(s.similarity * 100),
                          })}
                        </p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-[#8b9cb3] shrink-0" />
                    </div>
                  ))}
                </div>
                <DialogFooter className="gap-2 sm:gap-2 flex-col sm:flex-row">
                  <Button
                    variant="ghost"
                    onClick={() => setNearDup(null)}
                    className="text-[#8b9cb3]"
                  >
                    {t("common.cancel")}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleNearDupUseExisting}
                    className="border-primary/30 text-primary hover:bg-primary/10"
                  >
                    {t("classification.nearDup.useExisting")}
                  </Button>
                  <Button onClick={handleNearDupForce} disabled={forcing}>
                    {forcing ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />
                        {t("classification.creating")}
                      </>
                    ) : (
                      t("classification.nearDup.createAnyway")
                    )}
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* === DIALOG CLEANUP DUPLICATES === */}
        <Dialog open={isCleanupOpen} onOpenChange={setIsCleanupOpen}>
          <DialogContent className="bg-card border-border max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2">
                <Combine className="w-4 h-4 text-amber-400" />
                {t("classification.cleanupDuplicates.title")}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-[13px] text-[#8b9cb3]">
                {t("classification.cleanupDuplicates.desc")}
              </p>
              {duplicatePairs.length === 0 ? (
                <div className="text-center py-8">
                  <Check className="mx-auto h-10 w-10 text-emerald-400/40 mb-2" />
                  <p className="text-[13px] text-[#8b9cb3]">
                    {t("classification.cleanupDuplicates.empty")}
                  </p>
                </div>
              ) : (
                <div className="max-h-96 overflow-y-auto space-y-2 pr-1">
                  {duplicatePairs.map((pair: any, idx: number) => (
                    <div
                      key={idx}
                      className="rounded-md bg-white/[0.03] border border-border p-3"
                    >
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="text-[13px] text-white font-medium truncate">
                            {pair.a.name}
                          </span>
                          <ArrowLeftRight className="w-3.5 h-3.5 text-[#8b9cb3] shrink-0" />
                          <span className="text-[13px] text-white font-medium truncate">
                            {pair.b.name}
                          </span>
                        </div>
                        <span className="text-[11px] text-amber-300 shrink-0">
                          {Math.round(pair.similarity * 100)}%
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-[11px] h-7 border-primary/30 text-primary hover:bg-primary/10"
                          onClick={() =>
                            setMergeConfirm({
                              source: pair.b,
                              target: pair.a,
                            })
                          }
                        >
                          {t("classification.cleanupDuplicates.mergeArrow", {
                            source: pair.b.name,
                            target: pair.a.name,
                          })}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-[11px] h-7 border-primary/30 text-primary hover:bg-primary/10"
                          onClick={() =>
                            setMergeConfirm({
                              source: pair.a,
                              target: pair.b,
                            })
                          }
                        >
                          {t("classification.cleanupDuplicates.mergeArrow", {
                            source: pair.a.name,
                            target: pair.b.name,
                          })}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => setIsCleanupOpen(false)}
                className="text-[#8b9cb3]"
              >
                {t("common.close")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* === DIALOG MERGE CONFIRM === */}
        <AlertDialog
          open={!!mergeConfirm}
          onOpenChange={(open) => !open && setMergeConfirm(null)}
        >
          <AlertDialogContent className="bg-card border-border">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-white">
                {t("classification.cleanupDuplicates.confirmTitle")}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-[#8b9cb3]">
                {mergeConfirm &&
                  t("classification.cleanupDuplicates.confirmDesc", {
                    source: mergeConfirm.source.name,
                    target: mergeConfirm.target.name,
                  })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-background border-border text-[#8b9cb3] hover:bg-white/[0.04]">
                {t("common.cancel")}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  if (mergeConfirm) {
                    void doMerge(mergeConfirm.source, mergeConfirm.target);
                  }
                }}
                disabled={mergeBusy}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {mergeBusy ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />
                    {t("classification.cleanupDuplicates.merging")}
                  </>
                ) : (
                  t("classification.cleanupDuplicates.mergeBtn")
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
