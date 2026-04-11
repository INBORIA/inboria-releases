import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { 
  useListCategories, 
  useCreateCategory, 
  useUpdateCategory, 
  useDeleteCategory,
  getListCategoriesQueryKey
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tags, Plus, MoreVertical, Edit2, Trash2, Sparkles, Check, Receipt, Headphones, TrendingUp, FileText, Mail, Users, Briefcase, ShieldCheck, Wrench, BookOpen } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useTranslation } from "react-i18next";
import { translateCategoryName, translateCategory } from "@/lib/category-translations";

const SUGGESTED_CATEGORY_KEYS = [
  { key: "facturation", icon: Receipt, color: "text-amber-400 bg-amber-500/10" },
  { key: "support_client", icon: Headphones, color: "text-blue-400 bg-blue-500/10" },
  { key: "commercial", icon: TrendingUp, color: "text-emerald-400 bg-emerald-500/10" },
  { key: "administratif", icon: FileText, color: "text-purple-400 bg-purple-500/10" },
  { key: "newsletter", icon: Mail, color: "text-cyan-400 bg-cyan-500/10" },
  { key: "rh_equipe", icon: Users, color: "text-pink-400 bg-pink-500/10" },
  { key: "fournisseurs", icon: Briefcase, color: "text-orange-400 bg-orange-500/10" },
  { key: "juridique", icon: ShieldCheck, color: "text-red-400 bg-red-500/10" },
  { key: "technique", icon: Wrench, color: "text-indigo-400 bg-indigo-500/10" },
  { key: "formation", icon: BookOpen, color: "text-teal-400 bg-teal-500/10" },
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

export default function Categories() {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? i18n.language.split("-")[0];
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data: categories, isLoading } = useListCategories();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editCategory, setEditCategory] = useState<any>(null);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [addingNames, setAddingNames] = useState<Set<string>>(new Set());

  const suggestedCategories = useMemo(() => {
    return SUGGESTED_CATEGORY_KEYS.map((s) => ({
      ...s,
      name: t(`classification.suggestedCats.${s.key}.name`),
      description: t(`classification.suggestedCats.${s.key}.desc`),
    }));
  }, [t]);

  const existingNames = useMemo(() => {
    return new Set((categories || []).map((c: any) => c.name.toLowerCase()));
  }, [categories]);

  const availableSuggestions = useMemo(() => {
    return suggestedCategories.filter(s => !existingNames.has(s.name.toLowerCase()));
  }, [existingNames, suggestedCategories]);

  const handleAddSuggestion = (suggestion: { name: string; description: string; key: string }) => {
    setAddingNames(prev => new Set(prev).add(suggestion.key));
    createCategory.mutate(
      { data: { name: suggestion.name, description: suggestion.description } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
          setAddingNames(prev => { const next = new Set(prev); next.delete(suggestion.key); return next; });
          toast({ title: t("classification.categoryCreated") });
        },
        onError: () => {
          setAddingNames(prev => { const next = new Set(prev); next.delete(suggestion.key); return next; });
          toast({ variant: "destructive", title: t("common.error"), description: t("classification.addErrorDesc", { name: suggestion.name }) });
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
          queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
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
          queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
          setEditCategory(null);
          toast({ title: t("classification.categoryModified") });
        },
      }
    );
  };

  const handleDelete = (id: number) => {
    deleteCategory.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
          toast({ title: t("classification.categoryDeleted") });
        },
      }
    );
  };

  return (
    <DashboardLayout>
      <div className="p-5 max-w-5xl mx-auto w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div>
            <h1 className="text-[16px] font-semibold text-white tracking-tight">{t("classification.title")}</h1>
            <p className="text-[12px] text-[#8b9cb3] mt-0.5">{t("classification.manageCategoriesDesc")}</p>
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
                <DialogTitle className="text-white">{t("classification.createCategory")}</DialogTitle>
              </DialogHeader>
              <Form {...createForm}>
                <form onSubmit={createForm.handleSubmit(onSubmitCreate)} className="space-y-4">
                  <FormField
                    control={createForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[#8b9cb3]">{t("classification.nameLabel")}</FormLabel>
                        <FormControl>
                          <Input placeholder={t("classification.namePlaceholder")} className="bg-background border-border text-white" {...field} />
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
                        <FormLabel className="text-[#8b9cb3]">{t("classification.descriptionHelp")}</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder={t("classification.descriptionPlaceholder")} 
                            className="resize-none h-24 bg-background border-border text-white"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button type="submit" disabled={createCategory.isPending}>
                      {createCategory.isPending ? t("classification.creating") : t("common.save")}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        <Dialog open={!!editCategory} onOpenChange={(open) => !open && setEditCategory(null)}>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-white">{t("classification.editCategory")}</DialogTitle>
            </DialogHeader>
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(onSubmitEdit)} className="space-y-4">
                <FormField
                  control={editForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[#8b9cb3]">{t("classification.nameLabel")}</FormLabel>
                      <FormControl>
                        <Input className="bg-background border-border text-white" {...field} />
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
                      <FormLabel className="text-[#8b9cb3]">{t("classification.descriptionLabel")}</FormLabel>
                      <FormControl>
                        <Textarea className="resize-none h-24 bg-background border-border text-white" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" disabled={updateCategory.isPending}>
                    {updateCategory.isPending ? t("classification.saving") : t("common.save")}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {showSuggestions && availableSuggestions.length > 0 && (
          <div className="mb-6 rounded-lg border border-primary/20 bg-primary/[0.03] p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-[14px] font-semibold text-white">{t("classification.suggestedCategoriesTitle")}</h3>
                  <p className="text-[12px] text-[#8b9cb3]">{t("classification.suggestedCategoriesDesc")}</p>
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
                const isAdding = addingNames.has(s.key);
                return (
                  <button
                    key={s.key}
                    onClick={() => handleAddSuggestion(s)}
                    disabled={isAdding}
                    className="flex flex-col items-center gap-2 p-3 rounded-lg border border-border bg-card hover:border-primary/40 hover:bg-primary/[0.04] transition-all text-center group disabled:opacity-50"
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${s.color} group-hover:scale-110 transition-transform`}>
                      {isAdding ? <Check className="w-4 h-4 animate-pulse" /> : <Icon className="w-4 h-4" />}
                    </div>
                    <div>
                      <p className="text-[12px] font-medium text-white">{s.name}</p>
                      <p className="text-[10px] text-[#8b9cb3] line-clamp-1 mt-0.5">{s.description}</p>
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
            Array(6).fill(0).map((_, i) => (
              <div key={i} className="bg-card rounded-lg border border-border p-5">
                <Skeleton className="w-8 h-8 rounded-lg bg-white/5 mb-3" />
                <Skeleton className="h-5 w-3/4 mb-2 bg-white/5" />
                <Skeleton className="h-4 w-full bg-white/5" />
              </div>
            ))
          ) : categories?.length === 0 ? (
            <div className="col-span-full text-center py-20 rounded-lg border border-border border-dashed bg-card/50">
              <Tags className="mx-auto h-12 w-12 text-[#8b9cb3]/20 mb-3" />
              <h3 className="text-sm font-medium text-white mb-1">{t("classification.noCategories")}</h3>
              <p className="text-[13px] text-[#8b9cb3] mb-4">{t("classification.noCategoriesAltDesc")}</p>
              <Button onClick={() => setIsCreateOpen(true)} size="sm">
                <Plus className="w-3.5 h-3.5 mr-2" />
                {t("classification.createFirst")}
              </Button>
            </div>
          ) : (
            categories?.map((cat, i) => (
              <div key={cat.id} className="bg-card rounded-lg border border-border p-5 hover:border-primary/30 transition-colors group">
                <div className="flex justify-between items-start mb-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${categoryColors[i % categoryColors.length]}`}>
                    <Tags className="w-4 h-4" />
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-[#8b9cb3] opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/[0.06]">
                        <MoreVertical className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-card border-border">
                      <DropdownMenuItem onClick={() => handleOpenEdit(cat)} className="gap-2 cursor-pointer text-[#8b9cb3] hover:text-white">
                        <Edit2 className="h-3.5 w-3.5" /> {t("classification.editCategory")}
                      </DropdownMenuItem>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="gap-2 text-red-400 cursor-pointer">
                            <Trash2 className="h-3.5 w-3.5" /> {t("common.delete")}
                          </DropdownMenuItem>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-card border-border">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-white">{t("classification.deleteConfirmTitle")}</AlertDialogTitle>
                            <AlertDialogDescription className="text-[#8b9cb3]">
                              {t("classification.deleteConfirmCatDesc", { name: cat.name })}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="bg-background border-border text-[#8b9cb3] hover:bg-white/[0.04]">{t("common.cancel")}</AlertDialogCancel>
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
                
                <h3 className="text-[14px] font-semibold text-white mb-1">{translateCategoryName(cat.name, lang)}</h3>
                <p className="text-[12px] text-[#8b9cb3] line-clamp-2 h-9 mb-3">
                  {translateCategory(cat.name, cat.description, lang).description || <span className="italic opacity-50">{t("classification.noDescription")}</span>}
                </p>
                
                <div className="flex items-center text-[12px] text-[#8b9cb3] bg-white/[0.04] px-2.5 py-1 rounded-md inline-flex w-fit">
                  <span className="text-primary font-medium mr-1">{cat.emailCount || 0}</span> 
                  {t("classification.emailsLabel")}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
