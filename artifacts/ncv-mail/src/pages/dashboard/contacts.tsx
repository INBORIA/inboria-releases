import { useState } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { formatDistanceToNow } from "date-fns";
import { fr, enUS, nl, de, es } from "date-fns/locale";
import { Search, Users, Mail, ChevronRight, Loader2 } from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BackToInboxButton } from "@/components/dashboard/back-to-inbox-button";
import { Skeleton } from "@/components/ui/skeleton";
import { useListContacts } from "@workspace/api-client-react";

const LOCALE_MAP: Record<string, any> = { fr, en: enUS, nl, de, es };

export default function ContactsPage() {
  const { t, i18n } = useTranslation();
  const dateLocale = LOCALE_MAP[i18n.language?.slice(0, 2)] || fr;
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useListContacts({ q: q || undefined, page, pageSize: 30 });
  const contacts = (data as any)?.contacts || [];
  const total = (data as any)?.total || 0;
  const totalPages = (data as any)?.totalPages || 1;

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-5" data-testid="page-contacts">
        <BackToInboxButton />
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            {t("contacts.title", "Contact 360°")}
          </h1>
          <p className="text-sm text-[#8b9cb3] mt-1">
            {t("contacts.subtitle", "Toutes les personnes avec qui vous avez échangé")}
          </p>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8b9cb3]" />
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder={t("contacts.searchPlaceholder", "Rechercher un contact…")}
            className="pl-9 bg-[#0f1620] border-[#1f2937] text-white"
            data-testid="input-search-contacts"
          />
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full bg-[#1f2937]" />
            ))}
          </div>
        ) : contacts.length === 0 ? (
          <div className="text-center py-16 text-[#8b9cb3]" data-testid="empty-contacts">
            <Mail className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p>{q ? t("contacts.noResults", "Aucun contact trouvé") : t("contacts.empty", "Aucun contact pour l'instant")}</p>
          </div>
        ) : (
          <>
            <div className="text-xs text-[#8b9cb3] mb-2">
              {t("contacts.totalCount", "{{count}} contacts", { count: total })}
            </div>
            <div className="space-y-1">
              {contacts.map((c: any) => (
                <Link
                  key={c.email}
                  href={`/dashboard/contacts/${encodeURIComponent(c.email)}`}
                  className="flex items-center gap-3 p-3 rounded-md hover:bg-[#1a2332] transition-colors group"
                  data-testid={`link-contact-${c.email}`}
                >
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold flex-shrink-0">
                    {(c.name || c.email || "?")[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">{c.name}</div>
                    {c.name !== c.email && <div className="text-xs text-[#8b9cb3] truncate">{c.email}</div>}
                  </div>
                  <div className="text-xs text-[#8b9cb3] text-right flex-shrink-0">
                    <div>{t("contacts.exchangeCount", "{{count}} échanges", { count: c.count })}</div>
                    <div className="opacity-70">
                      {formatDistanceToNow(new Date(c.lastSeenAt), { addSuffix: true, locale: dateLocale })}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#8b9cb3] opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              ))}
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  data-testid="button-prev-page"
                >
                  {t("common.previous", "Précédent")}
                </Button>
                <span className="text-sm text-[#8b9cb3]">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  data-testid="button-next-page"
                >
                  {t("common.next", "Suivant")}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
