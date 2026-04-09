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
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState, useMemo } from "react";
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
import { FAMILLES_METIERS, type PackMetier } from "@/data/packs-metiers";
import { useTranslation } from 'react-i18next';

const SUGGESTED_CATEGORIES = [
  {
    name: "Facturation",
    description: "Factures, devis, bons de commande, relances de paiement",
    icon: Receipt,
    color: "text-amber-400 bg-amber-500/10",
  },
  {
    name: "Support client",
    description: "Demandes d'aide, réclamations, questions des clients",
    icon: Headphones,
    color: "text-blue-400 bg-blue-500/10",
  },
  {
    name: "Commercial",
    description: "Prospects, propositions commerciales, négociations, ventes",
    icon: TrendingUp,
    color: "text-emerald-400 bg-emerald-500/10",
  },
  {
    name: "Administratif",
    description: "Contrats, documents officiels, courriers juridiques",
    icon: FileText,
    color: "text-purple-400 bg-purple-500/10",
  },
  {
    name: "Newsletter / Marketing",
    description: "Newsletters, promotions, campagnes marketing, publicités",
    icon: Mail,
    color: "text-cyan-400 bg-cyan-500/10",
  },
  {
    name: "RH / Équipe",
    description: "Congés, recrutement, gestion du personnel, notes internes",
    icon: Users,
    color: "text-pink-400 bg-pink-500/10",
  },
  {
    name: "Fournisseurs",
    description: "Commandes, livraisons, relations fournisseurs, achats",
    icon: Briefcase,
    color: "text-orange-400 bg-orange-500/10",
  },
  {
    name: "Juridique / Conformité",
    description: "Mises en demeure, RGPD, conformité, contentieux, contrats",
    icon: ShieldCheck,
    color: "text-red-400 bg-red-500/10",
  },
  {
    name: "Technique / IT",
    description: "Bugs, maintenance, serveurs, IT, demandes techniques",
    icon: Wrench,
    color: "text-indigo-400 bg-indigo-500/10",
  },
  {
    name: "Formation",
    description: "Webinaires, certifications, e-learning, invitations",
    icon: BookOpen,
    color: "text-teal-400 bg-teal-500/10",
  },
  {
    name: "Banque / Finance",
    description: "Relevés bancaires, virements, prêts, assurances",
    icon: Landmark,
    color: "text-green-400 bg-green-500/10",
  },
  {
    name: "Logistique / Livraisons",
    description: "Suivi de colis, transporteurs, bons de livraison",
    icon: Truck,
    color: "text-sky-400 bg-sky-500/10",
  },
  {
    name: "Rendez-vous / Planning",
    description: "Confirmations, annulations, rappels de réunions",
    icon: CalendarCheck,
    color: "text-violet-400 bg-violet-500/10",
  },
  {
    name: "International / Export",
    description: "Douanes, clients étrangers, traductions, incoterms",
    icon: Globe,
    color: "text-blue-300 bg-blue-400/10",
  },
  {
    name: "Urgent / Prioritaire",
    description: "Emails nécessitant une action immédiate, alertes critiques",
    icon: AlertTriangle,
    color: "text-red-500 bg-red-600/10",
  },
  {
    name: "Comptabilité",
    description: "Écritures comptables, bilans, TVA, déclarations fiscales",
    icon: BarChart3,
    color: "text-lime-400 bg-lime-500/10",
  },
  {
    name: "Paiements / Encaissements",
    description: "Confirmations de paiement, retards, rappels, remboursements",
    icon: CreditCard,
    color: "text-yellow-400 bg-yellow-500/10",
  },
  {
    name: "Partenaires / Sous-traitants",
    description: "Collaborations, accords, échanges avec partenaires externes",
    icon: HandshakeIcon,
    color: "text-emerald-300 bg-emerald-400/10",
  },
  {
    name: "Projets",
    description: "Suivi de projet, livrables, deadlines, rapports d'avancement",
    icon: ClipboardList,
    color: "text-fuchsia-400 bg-fuchsia-500/10",
  },
  {
    name: "Communication interne",
    description: "Mémos, annonces, comptes-rendus, circulaires",
    icon: MessageSquare,
    color: "text-rose-400 bg-rose-500/10",
  },
  {
    name: "Immobilier / Locaux",
    description: "Baux, loyers, maintenance bâtiment, charges",
    icon: Building2,
    color: "text-stone-400 bg-stone-500/10",
  },
  {
    name: "Abonnements / SaaS",
    description: "Licences logiciels, renouvellements, factures outils",
    icon: Settings,
    color: "text-slate-400 bg-slate-500/10",
  },
  {
    name: "Devis / Négociations",
    description: "Demandes de devis, comparatifs, contre-propositions",
    icon: ArrowLeftRight,
    color: "text-amber-300 bg-amber-400/10",
  },
  {
    name: "Spam / À supprimer",
    description: "Emails indésirables, démarchage non sollicité",
    icon: Trash2,
    color: "text-gray-400 bg-gray-500/10",
  },
];

const categorySchema = z.object({
  name: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
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
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

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
    new Set(FAMILLES_METIERS.map((f) => f.name))
  );
  const [selectedPack, setSelectedPack] = useState<PackMetier | null>(null);
  const [isApplyDialogOpen, setIsApplyDialogOpen] = useState(false);
  const [isAiDialogOpen, setIsAiDialogOpen] = useState(false);
  const [aiDescription, setAiDescription] = useState("");
  const [aiGeneratedPack, setAiGeneratedPack] = useState<{
    packName: string;
    categories: { name: string; description: string }[];
  } | null>(null);

  const existingNames = useMemo(() => {
    return new Set(
      (categories || []).map((c: any) => c.name.toLowerCase())
    );
  }, [categories]);

  const availableSuggestions = useMemo(() => {
    return SUGGESTED_CATEGORIES.filter(
      (s) => !existingNames.has(s.name.toLowerCase())
    );
  }, [existingNames]);

  const filteredFamilles = useMemo(() => {
    if (!packSearch.trim()) return FAMILLES_METIERS;
    const q = packSearch.toLowerCase();
    return FAMILLES_METIERS.map((f) => ({
      ...f,
      packs: f.packs.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.categories.some((c) => c.name.toLowerCase().includes(q))
      ),
    })).filter((f) => f.packs.length > 0);
  }, [packSearch]);

  const handleAddSuggestion = (
    suggestion: (typeof SUGGESTED_CATEGORIES)[0]
  ) => {
    setAddingNames((prev) => new Set(prev).add(suggestion.name));
    createCategory.mutate(
      { data: { name: suggestion.name, description: suggestion.description } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getListCategoriesQueryKey(),
          });
          setAddingNames((prev) => {
            const next = new Set(prev);
            next.delete(suggestion.name);
            return next;
          });
          toast({ title: `"${suggestion.name}" ${t("classification.added")}` });
        },
        onError: () => {
          setAddingNames((prev) => {
            const next = new Set(prev);
            next.delete(suggestion.name);
            return next;
          });
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
    resolver: zodResolver(categorySchema),
    defaultValues: { name: "", description: "" },
  });

  const editForm = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
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
          setIsCreateOpen(false);
          createForm.reset();
          toast({ title: t("classification.categoryCreated") });
        },
      }
    );
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
        onError: () => {
          queryClient.invalidateQueries({
            queryKey: getListCategoriesQueryKey(),
          });
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

  const toggleFamille = (name: string) => {
    setExpandedFamilles((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  return (
    <DashboardLayout>
      <div className="p-5 max-w-5xl mx-auto w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div>
            <h1 className="text-[16px] font-semibold text-white tracking-tight">
              {t("classification.title")}
            </h1>
            <p className="text-[12px] text-[#8b9cb3] mt-0.5">
              {t("classification.subtitle")}
            </p>
          </div>

          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="shrink-0 gap-2">
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

        <div className="mb-8 rounded-lg border border-border bg-card/50 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Package className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h2 className="text-[14px] font-semibold text-white">
                  {t("classification.industryPacks")}
                </h2>
                <p className="text-[12px] text-[#8b9cb3]">
                  {t("classification.packPreConfigDesc")}
                </p>
              </div>
            </div>
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
              <div key={famille.name} className="rounded-lg border border-border overflow-hidden">
                <button
                  onClick={() => toggleFamille(famille.name)}
                  className="w-full flex items-center justify-between px-4 py-2.5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
                >
                  <span className="text-[13px] font-medium text-white">
                    {famille.name}
                    <span className="text-[#8b9cb3] font-normal ml-2">
                      ({famille.packs.length})
                    </span>
                  </span>
                  {expandedFamilles.has(famille.name) ? (
                    <ChevronUp className="w-4 h-4 text-[#8b9cb3]" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[#8b9cb3]" />
                  )}
                </button>

                {expandedFamilles.has(famille.name) && (
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
                                {t("classification.categoriesCount", { count: pack.categories.length })}
                                {newCount < pack.categories.length && (
                                  <span className="text-primary ml-1">
                                    {t("classification.newCount", { count: newCount })}
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
        </div>

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
                            {cat.description}
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
                              {cat.description}
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

        <div className="mb-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Tags className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h2 className="text-[14px] font-semibold text-white">
                  {t("classification.myCategories")}
                </h2>
                <p className="text-[12px] text-[#8b9cb3]">
                  {t("classification.manageCategoriesDesc")}
                </p>
              </div>
            </div>
          </div>

          {showSuggestions && availableSuggestions.length > 0 && (
            <div className="mb-6 rounded-lg border border-primary/20 bg-primary/[0.03] p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-[14px] font-semibold text-white">
                      {t("classification.suggestedCategoriesTitle")}
                    </h3>
                    <p className="text-[12px] text-[#8b9cb3]">
                      {t("classification.suggestedCategoriesDesc")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-[12px] border-primary/30 text-primary hover:bg-primary/10"
                    onClick={handleAddAllSuggestions}
                    disabled={addingNames.size > 0}
                  >
                    {t("classification.addAll")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-[12px] text-[#8b9cb3] hover:text-white"
                    onClick={() => setShowSuggestions(false)}
                  >
                    {t("classification.hide")}
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                {availableSuggestions.map((s) => {
                  const Icon = s.icon;
                  const isAdding = addingNames.has(s.name);
                  return (
                    <button
                      key={s.name}
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
            </div>
          )}

          {!showSuggestions && availableSuggestions.length > 0 && (
            <div className="mb-4 flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                className="text-[12px] text-[#8b9cb3] hover:text-white gap-1.5"
                onClick={() => setShowSuggestions(true)}
              >
                <Sparkles className="w-3 h-3" />
                {t("classification.showSuggestions")}
              </Button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {isLoading ? (
              Array(6)
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
                ))
            ) : categories?.length === 0 ? (
              <div className="col-span-full text-center py-20 rounded-lg border border-border border-dashed bg-card/50">
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
              categories?.map((cat: any, i: number) => (
                <div
                  key={cat.id}
                  className="bg-card rounded-lg border border-border p-5 hover:border-primary/30 transition-colors group"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center ${categoryColors[i % categoryColors.length]}`}
                    >
                      <Tags className="w-4 h-4" />
                    </div>
                    <div className="flex items-center gap-1">
                      {cat.sourcePack && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary/70 font-medium">
                          {cat.sourcePack}
                        </span>
                      )}
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
                            <Edit2 className="h-3.5 w-3.5" /> {t("classification.edit")}
                          </DropdownMenuItem>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem
                                onSelect={(e) => e.preventDefault()}
                                className="gap-2 text-red-400 cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" /> {t("common.delete")}
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="bg-card border-border">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="text-white">
                                  {t("classification.deleteConfirmTitle")}
                                </AlertDialogTitle>
                                <AlertDialogDescription className="text-[#8b9cb3]">
                                  {t("classification.deleteConfirmCatDesc", { name: cat.name })}
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
                    </div>
                  </div>

                  <h3 className="text-[14px] font-semibold text-white mb-1">
                    {cat.name}
                  </h3>
                  <p className="text-[12px] text-[#8b9cb3] line-clamp-2 h-9 mb-3">
                    {cat.description || (
                      <span className="italic opacity-50">
                        {t("classification.noDescription")}
                      </span>
                    )}
                  </p>

                  <div className="flex items-center text-[12px] text-[#8b9cb3] bg-white/[0.04] px-2.5 py-1 rounded-md inline-flex w-fit">
                    <span className="text-primary font-medium mr-1">
                      {cat.emailCount || 0}
                    </span>
                    {t("classification.emailsLabel")}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
