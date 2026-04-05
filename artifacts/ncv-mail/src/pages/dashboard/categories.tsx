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
import { Tags, Plus, MoreVertical, Edit2, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const categorySchema = z.object({
  name: z.string().min(2, "Le nom doit contenir au moins 2 caracteres"),
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
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data: categories, isLoading } = useListCategories();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editCategory, setEditCategory] = useState<any>(null);

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
          toast({ title: "Categorie creee" });
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
          toast({ title: "Categorie modifiee" });
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
          toast({ title: "Categorie supprimee" });
        },
      }
    );
  };

  return (
    <DashboardLayout>
      <div className="p-6 max-w-5xl mx-auto w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl font-semibold text-white tracking-tight">Categories de classement</h1>
            <p className="text-[13px] text-[#8b9cb3] mt-1">Gerez les dossiers dans lesquels l'IA classe vos emails.</p>
          </div>
          
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="shrink-0 gap-2">
                <Plus className="w-3.5 h-3.5" />
                Nouvelle categorie
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle className="text-white">Creer une categorie</DialogTitle>
              </DialogHeader>
              <Form {...createForm}>
                <form onSubmit={createForm.handleSubmit(onSubmitCreate)} className="space-y-4">
                  <FormField
                    control={createForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[#8b9cb3]">Nom</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Factures, Fournisseurs..." className="bg-background border-border text-white" {...field} />
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
                        <FormLabel className="text-[#8b9cb3]">Description (pour aider l'IA)</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Ex: Tous les emails contenant des factures, devis ou recus." 
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
                      {createCategory.isPending ? "Creation..." : "Creer"}
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
              <DialogTitle className="text-white">Modifier la categorie</DialogTitle>
            </DialogHeader>
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(onSubmitEdit)} className="space-y-4">
                <FormField
                  control={editForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[#8b9cb3]">Nom</FormLabel>
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
                      <FormLabel className="text-[#8b9cb3]">Description</FormLabel>
                      <FormControl>
                        <Textarea className="resize-none h-24 bg-background border-border text-white" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" disabled={updateCategory.isPending}>
                    {updateCategory.isPending ? "Enregistrement..." : "Enregistrer"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

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
              <h3 className="text-sm font-medium text-white mb-1">Aucune categorie</h3>
              <p className="text-[13px] text-[#8b9cb3] mb-4">Creez des categories pour organiser votre boite.</p>
              <Button onClick={() => setIsCreateOpen(true)} size="sm">
                <Plus className="w-3.5 h-3.5 mr-2" />
                Creer la premiere
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
                        <Edit2 className="h-3.5 w-3.5" /> Modifier
                      </DropdownMenuItem>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="gap-2 text-red-400 cursor-pointer">
                            <Trash2 className="h-3.5 w-3.5" /> Supprimer
                          </DropdownMenuItem>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-card border-border">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-white">Supprimer cette categorie ?</AlertDialogTitle>
                            <AlertDialogDescription className="text-[#8b9cb3]">
                              La categorie "{cat.name}" sera supprimee. Les emails associes perdront cette categorie.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="bg-background border-border text-[#8b9cb3] hover:bg-white/[0.04]">Annuler</AlertDialogCancel>
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
                
                <h3 className="text-[14px] font-semibold text-white mb-1">{cat.name}</h3>
                <p className="text-[12px] text-[#8b9cb3] line-clamp-2 h-9 mb-3">
                  {cat.description || <span className="italic opacity-50">Aucune description</span>}
                </p>
                
                <div className="flex items-center text-[12px] text-[#8b9cb3] bg-white/[0.04] px-2.5 py-1 rounded-md inline-flex w-fit">
                  <span className="text-primary font-medium mr-1">{cat.emailCount || 0}</span> 
                  emails
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
