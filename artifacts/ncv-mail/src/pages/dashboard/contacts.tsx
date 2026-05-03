import { useEffect, useMemo, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { useTranslation } from "react-i18next";
import {
  useListCategories,
  useSearchContacts,
  useGetContactTimeline,
} from "@workspace/api-client-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Search, Mail, Send, BellOff, CalendarClock, Archive, FolderKanban, CheckSquare, MailCheck, CalendarDays, Activity, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Category = { id: number; name: string };

const TYPE_META: Record<string, { icon: any; labelKey: string; fallback: string; href?: (id: string) => string }> = {
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

export default function Contacts() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [matchEmail, params] = useRoute("/dashboard/contacts/:email");
  const selectedEmail = matchEmail && params?.email ? decodeURIComponent(params.email) : null;

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query.trim()), 200);
    return () => clearTimeout(id);
  }, [query]);

  const { data: categoriesData } = useListCategories();
  const categories: Category[] = useMemo(
    () =>
      Array.isArray(categoriesData)
        ? (categoriesData as any[])
            .filter((c) => !c.isSystem)
            .map((c) => ({ id: c.id, name: c.name }))
        : [],
    [categoriesData],
  );

  const searchParams = useMemo(
    () => ({
      q: debouncedQuery || undefined,
      categoryIds: selectedCategoryIds.length > 0 ? selectedCategoryIds.join(",") : undefined,
      limit: 50,
    }),
    [debouncedQuery, selectedCategoryIds],
  );

  const { data: searchData, isFetching: isSearching } = useSearchContacts(searchParams as any);
  const contacts: Array<{ email: string; displayName: string; lastInteractionAt: string; messageCount: number }> =
    (searchData as any)?.contacts || [];

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
    href?: string | null;
  }> = (timelineData as any)?.items || [];

  const toggleCategory = (id: number) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const selectContact = (email: string) => {
    setLocation(`/dashboard/contacts/${encodeURIComponent(email)}`);
  };

  const clearSelection = () => {
    setLocation("/dashboard/contacts");
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col lg:flex-row h-[calc(100vh-4rem)]">
        <aside className="w-full lg:w-[360px] border-b lg:border-b-0 lg:border-r border-[#1f2937] flex flex-col min-h-0">
          <div className="p-4 space-y-3 border-b border-[#1f2937]">
            <h1 className="text-[14px] font-semibold text-white">
              {t("sidebar.contacts", "Contacts")}
            </h1>
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
            <div>
              <p className="text-[11px] text-[#8b9cb3] mb-1.5">
                {t("contactsPage.filterByCategory", "Filtrer par catégorie")}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {categories.length === 0 ? (
                  <span className="text-[11px] text-[#8b9cb3]">
                    {t("contactsPage.noCategories", "Aucune catégorie")}
                  </span>
                ) : (
                  categories.map((c) => {
                    const active = selectedCategoryIds.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        onClick={() => toggleCategory(c.id)}
                        className={cn(
                          "px-2 py-1 rounded text-[11px] border transition-colors",
                          active
                            ? "bg-primary/20 border-primary/50 text-primary"
                            : "border-[#1f2937] text-[#8b9cb3] hover:text-white hover:border-[#374151]",
                        )}
                        data-testid={`contacts-category-toggle-${c.id}`}
                      >
                        {c.name}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
          <ScrollArea className="flex-1">
            {isSearching ? (
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
                        <div className="text-[12px] font-medium text-white truncate">
                          {c.displayName || c.email}
                        </div>
                        <div className="text-[11px] text-[#8b9cb3] truncate">
                          {c.email}
                        </div>
                        <div className="text-[10px] text-[#6b7a8f] mt-0.5">
                          {c.messageCount}
                          {" "}
                          {t("contactsPage.messages", "messages")}
                          {" · "}
                          {formatDate(c.lastInteractionAt)}
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
              <div>
                <p className="text-[13px] text-[#8b9cb3]">
                  {t("contactsPage.selectPrompt", "Sélectionnez un contact pour voir tout son historique.")}
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="px-5 py-3 border-b border-[#1f2937] flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <h2 className="text-[14px] font-semibold text-white truncate">
                    {selectedEmail}
                  </h2>
                  <p className="text-[11px] text-[#8b9cb3]">
                    {timeline.length}
                    {" "}
                    {t("contactsPage.timelineItems", "éléments dans la chronologie")}
                  </p>
                </div>
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
                  <ul className="px-5 py-4 space-y-2">
                    {timeline.map((item) => {
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
                )}
              </ScrollArea>
            </>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}
