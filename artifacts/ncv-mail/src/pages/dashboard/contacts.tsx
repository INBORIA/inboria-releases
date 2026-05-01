import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { formatDistanceToNow } from "date-fns";
import { fr, enUS, nl, de, es } from "date-fns/locale";
import {
  Search,
  Users,
  Mail,
  ChevronRight,
  Loader2,
  ShieldAlert,
  User as UserIcon,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BackToInboxButton } from "@/components/dashboard/back-to-inbox-button";
import { Skeleton } from "@/components/ui/skeleton";
import { useListContacts, useGetMyOrganisation } from "@workspace/api-client-react";

import type { Locale } from "date-fns";

const LOCALE_MAP: Record<string, Locale> = { fr, en: enUS, nl, de, es };

interface Contact {
  email: string;
  name?: string;
  count: number;
  lastSeenAt: string;
}

interface ContactListResponse {
  contacts: Contact[];
  total: number;
  totalPages: number;
}

interface MyOrganisationLite {
  myRole?: string;
}

export default function ContactsPage() {
  const { t, i18n } = useTranslation();
  const dateLocale = LOCALE_MAP[i18n.language?.slice(0, 2)] || fr;
  const [, setLocation] = useLocation();
  const search = useSearch();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  // Task #176 — Vue dossier équipe (admin org). Toggle persisted in URL via
  // ?scope=team so the choice survives refreshes and shareable links.
  const { data: myOrg } = useGetMyOrganisation();
  const isOrgAdmin = (myOrg as MyOrganisationLite | undefined)?.myRole === "admin";
  const initialTeamView = useMemo(() => {
    return new URLSearchParams(search).get("scope") === "team";
  }, [search]);
  const [teamView, setTeamView] = useState<boolean>(initialTeamView);

  // Sync URL ↔ state when the toggle is flipped.
  useEffect(() => {
    const params = new URLSearchParams(search);
    const has = params.get("scope") === "team";
    if (teamView && !has) {
      params.set("scope", "team");
      setLocation(`/dashboard/contacts?${params.toString()}`, { replace: true });
    } else if (!teamView && has) {
      params.delete("scope");
      const qs = params.toString();
      setLocation(`/dashboard/contacts${qs ? `?${qs}` : ""}`, { replace: true });
    }
  }, [teamView, search, setLocation]);

  // Non-admin landing on a shared `?scope=team` URL: silently force back to
  // self mode (toggle won't render so they'd otherwise be stuck on an empty
  // disabled team query). The URL is cleaned up by the sync effect above.
  useEffect(() => {
    if (myOrg && !isOrgAdmin && teamView) {
      setTeamView(false);
    }
  }, [myOrg, isOrgAdmin, teamView]);

  const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");

  // Self / personal scope — always available, used for non-admin and as
  // the default rendering when scope=mine.
  const selfQuery = useListContacts(
    { q: q || undefined, page, pageSize: 30 },
    {
      query: {
        queryKey: ["contacts", "self", q, page] as const,
        enabled: !teamView,
      },
    },
  );

  // Team scope — admin only, separate query so the URL toggle has its own
  // cache key and a failure on team mode never poisons the personal list.
  const teamQuery = useQuery<ContactListResponse, Error>({
    queryKey: ["contacts", "team", q, page],
    enabled: teamView && isOrgAdmin,
    queryFn: async (): Promise<ContactListResponse> => {
      const params = new URLSearchParams();
      params.set("scope", "team");
      params.set("page", String(page));
      params.set("pageSize", "30");
      if (q) params.set("q", q);
      const res = await fetch(`${baseUrl}/api/contacts?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body?.error || `HTTP ${res.status}`);
      }
      return (await res.json()) as ContactListResponse;
    },
  });

  const isLoading = teamView ? teamQuery.isLoading : selfQuery.isLoading;
  const data: ContactListResponse | undefined = teamView
    ? teamQuery.data
    : (selfQuery.data as ContactListResponse | undefined);
  const teamLoadError = teamView && teamQuery.isError;

  const contacts = data?.contacts || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-5" data-testid="page-contacts">
        <BackToInboxButton />
        <div className="mb-4 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
              <Users className="w-6 h-6 text-primary" />
              {t("contacts.title", "Contact 360°")}
            </h1>
            <p className="text-sm text-[#8b9cb3] mt-1">
              {teamView
                ? t(
                    "contacts.teamSubtitle",
                    "Tous les contacts de votre équipe (les emails marqués privés sont masqués).",
                  )
                : t("contacts.subtitle", "Toutes les personnes avec qui vous avez échangé")}
            </p>
          </div>
          {isOrgAdmin && (
            <div
              className="inline-flex items-center rounded-md bg-[#0f1620] border border-[#1f2937] p-0.5"
              data-testid="contacts-scope-toggle"
              role="tablist"
              aria-label={t("contacts.scopeToggleAria", "Choisir la portée des contacts")}
            >
              <button
                type="button"
                onClick={() => {
                  setTeamView(false);
                  setPage(1);
                }}
                className={`px-3 py-1.5 text-xs rounded-sm flex items-center gap-1.5 transition-colors ${
                  !teamView ? "bg-primary/20 text-white" : "text-[#8b9cb3] hover:text-white"
                }`}
                data-testid="contacts-scope-mine"
                role="tab"
                aria-selected={!teamView}
              >
                <UserIcon className="w-3.5 h-3.5" />
                {t("contacts.scopeMine", "Mes contacts")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setTeamView(true);
                  setPage(1);
                }}
                className={`px-3 py-1.5 text-xs rounded-sm flex items-center gap-1.5 transition-colors ${
                  teamView ? "bg-primary/20 text-white" : "text-[#8b9cb3] hover:text-white"
                }`}
                data-testid="contacts-scope-team"
                role="tab"
                aria-selected={teamView}
              >
                <Users className="w-3.5 h-3.5" />
                {t("contacts.scopeTeam", "Toute l'équipe")}
              </button>
            </div>
          )}
        </div>

        {teamView && (
          <div
            className="mb-3 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[12px] text-amber-100 flex items-start gap-2"
            data-testid="banner-rgpd-team"
          >
            <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              {t(
                "contacts.teamRgpdBanner",
                "Vous consultez les contacts de votre équipe. Cette consultation est tracée et apparaît dans le journal vie privée des coéquipiers concernés. Les emails marqués privés sont automatiquement masqués.",
              )}
            </div>
          </div>
        )}

        {teamLoadError && (
          <div
            className="mb-3 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-[12px] text-red-100 flex items-start gap-2"
            data-testid="banner-team-load-error"
          >
            <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <div className="font-medium">
                {t("contacts.teamLoadErrorTitle", "Vue équipe indisponible")}
              </div>
              <div className="opacity-90 mt-0.5">
                {teamQuery.error?.message ||
                  t(
                    "contacts.teamLoadErrorBody",
                    "Impossible de charger la vue équipe. Vous pouvez revenir à « Mes contacts » ou réessayer.",
                  )}
              </div>
            </div>
          </div>
        )}

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
              {(contacts as Contact[]).map((c) => (
                <Link
                  key={c.email}
                  href={`/dashboard/contacts/${encodeURIComponent(c.email)}${teamView ? "?scope=team" : ""}`}
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
