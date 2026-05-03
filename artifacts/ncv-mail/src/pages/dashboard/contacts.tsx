import { useEffect, useMemo, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import {
  useSearchContacts,
  useGetContactTimeline,
  useCreateManualContact,
  useUpdateManualContact,
  useDeleteManualContact,
  getGetContactTimelineQueryKey,
} from "@workspace/api-client-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Search,
  Mail,
  Send,
  BellOff,
  CalendarClock,
  Archive,
  FolderKanban,
  CheckSquare,
  MailCheck,
  CalendarDays,
  Activity,
  X,
  Plus,
  UserPen,
  Trash2,
  Phone,
  Building2,
  StickyNote,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TYPE_META: Record<string, { icon: any; labelKey: string; fallback: string }> = {
  received: { icon: Mail, labelKey: "contactsPage.types.received", fallback: "Email reçu" },
  sent: { icon: Send, labelKey: "contactsPage.types.sent", fallback: "Email envoyé" },
  snoozed: { icon: BellOff, labelKey: "contactsPage.types.snoozed", fallback: "Reporté" },
  scheduled: { icon: CalendarClock, labelKey: "contactsPage.types.scheduled", fallback: "Programmé" },
  archive: { icon: Archive, labelKey: "contactsPage.types.archive", fallback: "Archivé" },
  project: { icon: FolderKanban, labelKey: "contactsPage.types.project", fallback: "Projet" },
  task: { icon: CheckSquare, labelKey: "contactsPage.types.task", fallback: "Tâche" },
  followup: { icon: MailCheck, labelKey: "contactsPage.types.followup", fallback: "Relance" },
  appointment: { icon: CalendarDays, labelKey: "contactsPage.types.appointment", fallback: "Agenda" },
  team: { icon: Activity, labelKey: "contactsPage.types.team", fallback: "Activité équipe" },
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

type ManualForm = {
  email: string;
  displayName: string;
  phone: string;
  company: string;
  notes: string;
};

const EMPTY_FORM: ManualForm = { email: "", displayName: "", phone: "", company: "", notes: "" };

export default function Contacts() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, setLocation] = useLocation();
  const [matchEmail, params] = useRoute("/dashboard/contacts/:email");
  const selectedEmail = matchEmail && params?.email ? decodeURIComponent(params.email) : null;

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ManualForm>(EMPTY_FORM);
  const [deleteAskOpen, setDeleteAskOpen] = useState(false);
  const [activeTypes, setActiveTypes] = useState<Set<string>>(new Set());

  // Ordre exact demandé par l'utilisateur pour les filtres de chronologie.
  const TIMELINE_TYPE_ORDER = [
    "received",
    "sent",
    "team",
    "snoozed",
    "scheduled",
    "task",
    "followup",
    "project",
    "appointment",
    "archive",
  ] as const;

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query.trim()), 200);
    return () => clearTimeout(id);
  }, [query]);

  const searchParams = useMemo(
    () => ({
      q: debouncedQuery || undefined,
      limit: 50,
    }),
    [debouncedQuery],
  );

  const hasQuery = debouncedQuery.length > 0;
  const { data: searchData, isFetching: isSearching } = useSearchContacts(
    searchParams as any,
    { query: { enabled: hasQuery } as any } as any,
  );
  const contacts: Array<{
    email: string;
    displayName: string;
    lastInteractionAt: string;
    messageCount: number;
    isManual: boolean;
    manualId: string | null;
  }> = (searchData as any)?.contacts || [];

  const { data: timelineData, isLoading: isTimelineLoading } = useGetContactTimeline(
    selectedEmail || "",
    { query: { enabled: !!selectedEmail } as any } as any,
  );
  const timeline: Array<{
    type: string;
    id: string;
    occurredAt: string;
    title: string;
    snippet?: string | null;
    categoryName?: string | null;
  }> = (timelineData as any)?.items || [];
  const manualFiche: {
    id: string;
    email: string;
    displayName: string | null;
    phone: string | null;
    company: string | null;
    notes: string | null;
  } | null = (timelineData as any)?.manual || null;

  const invalidateAll = () => {
    // Invalidate toutes les variantes de recherche (toutes valeurs de q).
    qc.invalidateQueries({ queryKey: ["/api/contacts/search"] });
    if (selectedEmail) {
      qc.invalidateQueries({ queryKey: getGetContactTimelineQueryKey(selectedEmail) });
    }
  };

  const createMut = useCreateManualContact({
    mutation: {
      onSuccess: (data: any) => {
        toast({ title: t("contactsPage.created", "Contact ajouté") });
        setDialogOpen(false);
        setForm(EMPTY_FORM);
        invalidateAll();
        if (data?.email) setLocation(`/dashboard/contacts/${encodeURIComponent(data.email)}`);
      },
      onError: (err: any) => {
        toast({
          variant: "destructive",
          title: t("common.error", "Erreur"),
          description: err?.response?.data?.error || err?.message || "—",
        });
      },
    } as any,
  });

  const updateMut = useUpdateManualContact({
    mutation: {
      onSuccess: () => {
        toast({ title: t("contactsPage.updated", "Contact mis à jour") });
        setDialogOpen(false);
        setEditingId(null);
        invalidateAll();
      },
      onError: (err: any) => {
        toast({
          variant: "destructive",
          title: t("common.error", "Erreur"),
          description: err?.response?.data?.error || err?.message || "—",
        });
      },
    } as any,
  });

  const deleteMut = useDeleteManualContact({
    mutation: {
      onSuccess: () => {
        toast({ title: t("contactsPage.deleted", "Contact supprimé") });
        setDeleteAskOpen(false);
        invalidateAll();
      },
      onError: (err: any) => {
        toast({
          variant: "destructive",
          title: t("common.error", "Erreur"),
          description: err?.response?.data?.error || err?.message || "—",
        });
      },
    } as any,
  });

  const selectContact = (email: string) => {
    setLocation(`/dashboard/contacts/${encodeURIComponent(email)}`);
  };

  const clearSelection = () => {
    setLocation("/dashboard/contacts");
  };

  const openCreateDialog = () => {
    setEditingId(null);
    // Si un contact email-only est sélectionné mais sans fiche, pré-remplir l'adresse.
    setForm(
      selectedEmail && !manualFiche
        ? { ...EMPTY_FORM, email: selectedEmail }
        : EMPTY_FORM,
    );
    setDialogOpen(true);
  };

  const openEditDialog = () => {
    if (!manualFiche) return;
    setEditingId(manualFiche.id);
    setForm({
      email: manualFiche.email,
      displayName: manualFiche.displayName || "",
      phone: manualFiche.phone || "",
      company: manualFiche.company || "",
      notes: manualFiche.notes || "",
    });
    setDialogOpen(true);
  };

  const submitForm = () => {
    if (!form.email.trim()) {
      toast({ variant: "destructive", title: t("contactsPage.emailRequired", "Adresse e-mail requise") });
      return;
    }
    const payload = {
      email: form.email.trim(),
      displayName: form.displayName.trim() || null,
      phone: form.phone.trim() || null,
      company: form.company.trim() || null,
      notes: form.notes.trim() || null,
    };
    if (editingId) {
      updateMut.mutate({ id: editingId, data: payload } as any);
    } else {
      createMut.mutate({ data: payload } as any);
    }
  };

  const isMutating = createMut.isPending || updateMut.isPending;

  return (
    <DashboardLayout>
      <div className="flex flex-row h-[calc(100vh-4rem)]">
        <aside className="w-[300px] md:w-[340px] shrink-0 border-r border-[#1f2937] flex flex-col min-h-0">
          <div className="p-4 space-y-3 border-b border-[#1f2937]">
            <div className="flex items-center justify-between gap-2">
              <h1 className="text-[14px] font-semibold text-white">
                {t("sidebar.contacts", "Contacts")}
              </h1>
              <Button
                size="sm"
                onClick={openCreateDialog}
                className="h-7 text-[11px] px-2.5"
                data-testid="contacts-add-btn"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                {t("contactsPage.add", "Ajouter")}
              </Button>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8b9cb3]" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("contactsPage.searchPlaceholder", "Rechercher un contact…")}
                className="pl-8 h-9 text-[12px]"
                data-testid="contacts-search-input"
              />
            </div>
          </div>
          <ScrollArea className="flex-1">
            {!hasQuery ? (
              <div className="px-4 py-6 text-center text-[12px] text-[#8b9cb3]">
                {t(
                  "contactsPage.searchHint",
                  "Tapez un nom ou une adresse pour rechercher un contact.",
                )}
              </div>
            ) : isSearching ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-[#8b9cb3]" />
              </div>
            ) : contacts.length === 0 ? (
              <div className="px-4 py-6 text-center text-[12px] text-[#8b9cb3]">
                {t("contactsPage.noResults", "Aucun contact trouvé")}
              </div>
            ) : (
              <ul>
                {contacts.map((c) => {
                  const isActive = selectedEmail?.toLowerCase() === c.email.toLowerCase();
                  return (
                    <li key={c.email}>
                      <button
                        onClick={() => selectContact(c.email)}
                        className={cn(
                          "w-full text-left px-4 py-2.5 border-b border-[#1f2937] hover:bg-white/[0.02]",
                          isActive && "bg-[#1e3a5f]/40",
                        )}
                        data-testid={`contacts-result-${c.email}`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="text-[12px] font-medium text-white truncate flex-1">
                            {c.displayName || c.email}
                          </span>
                          {c.isManual && (
                            <Badge variant="secondary" className="h-4 text-[9px] px-1.5 shrink-0">
                              {t("contactsPage.manualBadge", "fiche")}
                            </Badge>
                          )}
                        </div>
                        <div className="text-[11px] text-[#8b9cb3] truncate">
                          {c.email}
                        </div>
                        <div className="text-[10px] text-[#6b7a8f] mt-0.5">
                          {c.messageCount > 0
                            ? `${c.messageCount} ${t("contactsPage.messages", "messages")} · ${formatDate(c.lastInteractionAt)}`
                            : t("contactsPage.noInteraction", "Aucun échange")}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </ScrollArea>
        </aside>

        <section className="flex-1 min-w-0 flex flex-col">
          {!selectedEmail ? (
            <div className="flex-1 flex items-center justify-center text-center px-6">
              <p className="text-[13px] text-[#8b9cb3]">
                {t("contactsPage.selectPrompt", "Sélectionnez un contact pour voir tout son historique.")}
              </p>
            </div>
          ) : (
            <>
              <div className="px-5 py-3 border-b border-[#1f2937] flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <h2 className="text-[14px] font-semibold text-white truncate">
                    {manualFiche?.displayName || selectedEmail}
                  </h2>
                  <p className="text-[11px] text-[#8b9cb3] truncate">{selectedEmail}</p>
                  {manualFiche && (
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-[#8b9cb3]">
                      {manualFiche.company && (
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {manualFiche.company}
                        </span>
                      )}
                      {manualFiche.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {manualFiche.phone}
                        </span>
                      )}
                    </div>
                  )}
                  {manualFiche?.notes && (
                    <div className="flex items-start gap-1.5 mt-2 text-[11px] text-[#8b9cb3]">
                      <StickyNote className="h-3 w-3 mt-0.5 shrink-0" />
                      <p className="whitespace-pre-wrap">{manualFiche.notes}</p>
                    </div>
                  )}
                  <p className="text-[10px] text-[#6b7a8f] mt-2">
                    {timeline.length}
                    {" "}
                    {t("contactsPage.timelineItems", "éléments dans la chronologie")}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {manualFiche && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={openEditDialog}
                        className="h-7 px-2 text-[11px]"
                        data-testid="contacts-edit-manual"
                      >
                        <UserPen className="h-3.5 w-3.5 mr-1" />
                        {t("common.edit", "Modifier")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteAskOpen(true)}
                        className="h-7 w-7 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        data-testid="contacts-delete-manual"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearSelection}
                    className="h-7 w-7 p-0"
                    data-testid="contacts-clear-selection"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="px-5 py-2 border-b border-[#1f2937] flex flex-wrap gap-1.5">
                {TIMELINE_TYPE_ORDER.map((tk) => {
                  const meta = TYPE_META[tk];
                  if (!meta) return null;
                  const count = timeline.filter((it) => it.type === tk).length;
                  const active = activeTypes.has(tk);
                  return (
                    <button
                      key={tk}
                      onClick={() =>
                        setActiveTypes((prev) => {
                          const next = new Set(prev);
                          if (next.has(tk)) next.delete(tk);
                          else next.add(tk);
                          return next;
                        })
                      }
                      className={cn(
                        "px-2 py-1 rounded text-[11px] border transition-colors inline-flex items-center gap-1",
                        active
                          ? "bg-primary/20 border-primary/50 text-primary"
                          : "border-[#1f2937] text-[#8b9cb3] hover:text-white hover:border-[#374151]",
                      )}
                      data-testid={`contacts-timeline-filter-${tk}`}
                    >
                      <span>{t(meta.labelKey, meta.fallback)}</span>
                      <span className="text-[10px] text-[#6b7a8f]">{count}</span>
                    </button>
                  );
                })}
                {activeTypes.size > 0 && (
                  <button
                    onClick={() => setActiveTypes(new Set())}
                    className="px-2 py-1 rounded text-[11px] text-[#8b9cb3] hover:text-white"
                    data-testid="contacts-timeline-filter-clear"
                  >
                    {t("common.reset", "Réinitialiser")}
                  </button>
                )}
              </div>
              <ScrollArea className="flex-1">
                {isTimelineLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-5 w-5 animate-spin text-[#8b9cb3]" />
                  </div>
                ) : timeline.length === 0 ? (
                  <div className="px-5 py-8 text-center text-[12px] text-[#8b9cb3]">
                    {t("contactsPage.emptyTimeline", "Rien à afficher pour ce contact.")}
                  </div>
                ) : (
                  (() => {
                    const filtered =
                      activeTypes.size === 0
                        ? timeline
                        : timeline.filter((it) => activeTypes.has(it.type));
                    if (filtered.length === 0) {
                      return (
                        <div className="px-5 py-8 text-center text-[12px] text-[#8b9cb3]">
                          {t(
                            "contactsPage.emptyFiltered",
                            "Aucun élément pour ces filtres.",
                          )}
                        </div>
                      );
                    }
                    return (
                  <ul className="px-5 py-4 space-y-2">
                    {filtered.map((item) => {
                      const meta = TYPE_META[item.type] || TYPE_META.received;
                      const Icon = meta.icon;
                      return (
                        <li
                          key={`${item.type}-${item.id}`}
                          className="flex gap-3 p-3 rounded-md border border-[#1f2937] hover:bg-white/[0.02] transition-colors"
                        >
                          <Icon className="h-4 w-4 text-[#8b9cb3] mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2">
                              <span className="text-[11px] font-medium text-primary">
                                {t(meta.labelKey, meta.fallback)}
                              </span>
                              {item.categoryName && (
                                <Badge variant="secondary" className="h-4 text-[10px] px-1.5">
                                  {item.categoryName}
                                </Badge>
                              )}
                              <span className="text-[10px] text-[#6b7a8f] ml-auto shrink-0">
                                {formatDate(item.occurredAt)}
                              </span>
                            </div>
                            <div className="text-[12px] text-white mt-0.5 truncate">
                              {item.title}
                            </div>
                            {item.snippet && (
                              <div className="text-[11px] text-[#8b9cb3] mt-1 line-clamp-2">
                                {item.snippet}
                              </div>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                    );
                  })()
                )}
              </ScrollArea>
            </>
          )}
        </section>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>
              {editingId
                ? t("contactsPage.editTitle", "Modifier le contact")
                : t("contactsPage.addTitle", "Ajouter un contact")}
            </DialogTitle>
            <DialogDescription>
              {t(
                "contactsPage.addDescription",
                "Créez une fiche pour suivre quelqu'un qui n'apparaît pas encore dans votre boîte.",
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="mc-email" className="text-[12px]">
                {t("contactsPage.fields.email", "Adresse e-mail")} *
              </Label>
              <Input
                id="mc-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                disabled={!!editingId}
                placeholder="contact@exemple.com"
                className="h-9 text-[12px] mt-1"
                data-testid="contacts-form-email"
              />
            </div>
            <div>
              <Label htmlFor="mc-name" className="text-[12px]">
                {t("contactsPage.fields.displayName", "Nom à afficher")}
              </Label>
              <Input
                id="mc-name"
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                className="h-9 text-[12px] mt-1"
                data-testid="contacts-form-name"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="mc-company" className="text-[12px]">
                  {t("contactsPage.fields.company", "Société")}
                </Label>
                <Input
                  id="mc-company"
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                  className="h-9 text-[12px] mt-1"
                  data-testid="contacts-form-company"
                />
              </div>
              <div>
                <Label htmlFor="mc-phone" className="text-[12px]">
                  {t("contactsPage.fields.phone", "Téléphone")}
                </Label>
                <Input
                  id="mc-phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="h-9 text-[12px] mt-1"
                  data-testid="contacts-form-phone"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="mc-notes" className="text-[12px]">
                {t("contactsPage.fields.notes", "Notes")}
              </Label>
              <Textarea
                id="mc-notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
                className="text-[12px] mt-1"
                data-testid="contacts-form-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)} disabled={isMutating}>
              {t("common.cancel", "Annuler")}
            </Button>
            <Button onClick={submitForm} disabled={isMutating} data-testid="contacts-form-submit">
              {isMutating && <Loader2 className="h-3 w-3 animate-spin mr-2" />}
              {editingId ? t("common.save", "Enregistrer") : t("contactsPage.create", "Créer")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteAskOpen} onOpenChange={setDeleteAskOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("contactsPage.deleteTitle", "Supprimer cette fiche ?")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "contactsPage.deleteDescription",
                "L'historique d'emails liés à cette adresse n'est pas supprimé. Seule la fiche manuelle disparaît.",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel", "Annuler")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (manualFiche) deleteMut.mutate({ id: manualFiche.id } as any);
              }}
              disabled={deleteMut.isPending}
              className="bg-red-500 hover:bg-red-600"
              data-testid="contacts-confirm-delete"
            >
              {deleteMut.isPending && <Loader2 className="h-3 w-3 animate-spin mr-2" />}
              {t("common.delete", "Supprimer")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
