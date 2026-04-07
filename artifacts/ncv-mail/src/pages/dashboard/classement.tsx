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
    name: "Newsletter",
    description: "Newsletters, promotions, emails marketing",
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
    description: "Commandes, livraisons, relations fournisseurs",
    icon: Briefcase,
    color: "text-orange-400 bg-orange-500/10",
  },
  {
    name: "Juridique",
    description: "Mises en demeure, RGPD, conformité, contentieux",
    icon: ShieldCheck,
    color: "text-red-400 bg-red-500/10",
  },
  {
    name: "Technique",
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
          toast({ title: `"${suggestion.name}" ajoutée` });
        },
        onError: () => {
          setAddingNames((prev) => {
            const next = new Set(prev);
            next.delete(suggestion.name);
            return next;
          });
          toast({
            variant: "destructive",
            title: "Erreur",
            description: `Impossible d'ajouter "${suggestion.name}".`,
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
          toast({ title: "Catégorie créée" });
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
          toast({ title: "Catégorie modifiée" });
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
          toast({ title: "Catégorie supprimée" });
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
            title: `Pack "${selectedPack.name}" appliqué`,
            description: `${data.added} catégorie(s) ajoutée(s), ${data.skipped} déjà existante(s).`,
          });
        },
        onError: () => {
          toast({
            variant: "destructive",
            title: "Erreur",
            description: "Impossible d'appliquer le pack.",
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
            title: "Erreur",
            description:
              "Impossible de générer le pack. Réessayez.",
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
            title: `Pack "${aiGeneratedPack.packName}" appliqué`,
            description: `${data.added} catégorie(s) ajoutée(s), ${data.skipped} déjà existante(s).`,
          });
        },
        onError: () => {
          toast({
            variant: "destructive",
            title: "Erreur",
            description: "Impossible d'appliquer le pack.",
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
              Classement
            </h1>
            <p className="text-[12px] text-[#8b9cb3] mt-0.5">
              Packs métiers et catégories pour organiser vos emails avec l'IA.
            </p>
          </div>

          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="shrink-0 gap-2">
                <Plus className="w-3.5 h-3.5" />
                Nouvelle catégorie
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle className="text-white">
                  Créer une catégorie
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
                        <FormLabel className="text-[#8b9cb3]">Nom</FormLabel>
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
                          Description (pour aider l'IA)
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
                      {createCategory.isPending ? "Création..." : "Créer"}
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
                Modifier la catégorie
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
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[#8b9cb3]">
                        Description
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
                      ? "Enregistrement..."
                      : "Enregistrer"}
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
                  Packs métiers
                </h2>
                <p className="text-[12px] text-[#8b9cb3]">
                  Ajoutez des catégories pré-configurées adaptées à votre
                  activité
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
              Mon métier n'est pas listé
            </Button>
          </div>

          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8b9cb3]" />
            <Input
              placeholder="Rechercher un métier..."
              value={packSearch}
              onChange={(e) => setPackSearch(e.target.value)}
              className="pl-10 bg-background border-border text-white text-[13px]"
            />
          </div>

          {filteredFamilles.length === 0 && (
            <div className="text-center py-8">
              <p className="text-[13px] text-[#8b9cb3]">
                Aucun métier trouvé.{" "}
                <button
                  onClick={() => setIsAiDialogOpen(true)}
                  className="text-primary hover:underline"
                >
                  Générez un pack personnalisé avec l'IA
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
                                {pack.categories.length} catégories
                                {newCount < pack.categories.length && (
                                  <span className="text-primary ml-1">
                                    ({newCount} nouvelles)
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
                            Appliquer
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
                Appliquer le pack "{selectedPack?.name}"
              </DialogTitle>
            </DialogHeader>
            {selectedPack && (
              <div className="space-y-4">
                <p className="text-[13px] text-[#8b9cb3]">
                  Ce pack va ajouter{" "}
                  <span className="text-white font-medium">
                    {getNewCategoriesCount(selectedPack)}
                  </span>{" "}
                  catégorie(s) à votre classement. Vos catégories actuelles ne
                  seront ni modifiées ni supprimées.
                </p>
                {selectedPack.categories.length -
                  getNewCategoriesCount(selectedPack) >
                  0 && (
                  <p className="text-[12px] text-amber-400/80">
                    {selectedPack.categories.length -
                      getNewCategoriesCount(selectedPack)}{" "}
                    catégorie(s) existe(nt) déjà et seront ignorée(s).
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
                              (existe déjà)
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
                    Annuler
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
                        Application...
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        Appliquer ({getNewCategoriesCount(selectedPack)}{" "}
                        catégories)
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
                Générer un pack personnalisé
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {!aiGeneratedPack ? (
                <>
                  <p className="text-[13px] text-[#8b9cb3]">
                    Décrivez votre métier ou activité, et l'IA générera des
                    catégories adaptées.
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
                      Annuler
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
                          Génération...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          Générer
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </>
              ) : (
                <>
                  <p className="text-[13px] text-[#8b9cb3]">
                    Pack "{aiGeneratedPack.packName}" généré avec{" "}
                    {aiGeneratedPack.categories.length} catégories :
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
                                (existe déjà)
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
                      Régénérer
                    </Button>
                    <Button
                      onClick={handleApplyAiPack}
                      disabled={applyPack.isPending}
                      className="gap-2"
                    >
                      {applyPack.isPending ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Application...
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          Appliquer ce pack
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
                  Mes catégories
                </h2>
                <p className="text-[12px] text-[#8b9cb3]">
                  Gérez les dossiers dans lesquels l'IA classe vos emails
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
                      Catégories suggérées
                    </h3>
                    <p className="text-[12px] text-[#8b9cb3]">
                      Cliquez pour ajouter, l'IA les utilisera pour classer vos
                      emails
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
                    Tout ajouter
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-[12px] text-[#8b9cb3] hover:text-white"
                    onClick={() => setShowSuggestions(false)}
                  >
                    Masquer
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
                Afficher les suggestions
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
                  Aucune catégorie
                </h3>
                <p className="text-[13px] text-[#8b9cb3] mb-4">
                  Choisissez un pack métier ci-dessus ou créez vos propres
                  catégories.
                </p>
                <Button onClick={() => setIsCreateOpen(true)} size="sm">
                  <Plus className="w-3.5 h-3.5 mr-2" />
                  Créer la première
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
                            <Edit2 className="h-3.5 w-3.5" /> Modifier
                          </DropdownMenuItem>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem
                                onSelect={(e) => e.preventDefault()}
                                className="gap-2 text-red-400 cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" /> Supprimer
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="bg-card border-border">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="text-white">
                                  Supprimer cette catégorie ?
                                </AlertDialogTitle>
                                <AlertDialogDescription className="text-[#8b9cb3]">
                                  La catégorie "{cat.name}" sera supprimée. Les
                                  emails associés perdront cette catégorie.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="bg-background border-border text-[#8b9cb3] hover:bg-white/[0.04]">
                                  Annuler
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(cat.id)}
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

                  <h3 className="text-[14px] font-semibold text-white mb-1">
                    {cat.name}
                  </h3>
                  <p className="text-[12px] text-[#8b9cb3] line-clamp-2 h-9 mb-3">
                    {cat.description || (
                      <span className="italic opacity-50">
                        Aucune description
                      </span>
                    )}
                  </p>

                  <div className="flex items-center text-[12px] text-[#8b9cb3] bg-white/[0.04] px-2.5 py-1 rounded-md inline-flex w-fit">
                    <span className="text-primary font-medium mr-1">
                      {cat.emailCount || 0}
                    </span>
                    emails
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
