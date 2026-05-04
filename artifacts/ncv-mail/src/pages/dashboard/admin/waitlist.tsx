import { DashboardLayout } from "@/components/layout/dashboard-layout";
import {
  useAdminListWaitlist,
  useGetProfile,
  type AdminWaitlistSignup,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Loader2,
  Download,
  Search,
  Mail,
  ShieldOff,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

interface ProfileWithAdmin {
  isAdmin?: boolean;
}

const PAGE_SIZE = 50;

interface AdminWaitlistProps {
  embedded?: boolean;
}

export default function AdminWaitlist({ embedded = false }: AdminWaitlistProps = {}) {
  const { t, i18n } = useTranslation();
  const { data: profileData, isLoading: profileLoading } = useGetProfile();
  const profile = (profileData ?? {}) as ProfileWithAdmin;
  const isAdmin = !!profile.isAdmin;
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!embedded && !profileLoading && !isAdmin) {
      setLocation("/dashboard", { replace: true });
    }
  }, [embedded, profileLoading, isAdmin, setLocation]);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  const { data, isLoading, refetch } = useAdminListWaitlist({
    page,
    limit: PAGE_SIZE,
  });

  const allSignups: AdminWaitlistSignup[] = data?.signups ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  // Search is applied client-side over the current page only — for full-text
  // search across all pages, see the export CSV.
  const signups = useMemo(() => {
    if (!search.trim()) return allSignups;
    const q = search.trim().toLowerCase();
    return allSignups.filter(
      (s) =>
        s.email.toLowerCase().includes(q) ||
        (s.source || "").toLowerCase().includes(q) ||
        (s.plan || "").toLowerCase().includes(q),
    );
  }, [allSignups, search]);

  async function handleExportCsv() {
    setExporting(true);
    try {
      const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");
      const session = await supabase.auth.getSession();
      const accessToken = session.data.session?.access_token;
      const res = await fetch(`${baseUrl}/api/admin/waitlist.csv`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error("CSV download failed");
      const blob = await res.blob();
      const { saveBlobAs } = await import("@/lib/export-utils");
      await saveBlobAs(blob, `inboria-waitlist-${new Date().toISOString().slice(0, 10)}.csv`);
    } catch {
      toast({ title: t("admin.exportError"), variant: "destructive" });
    } finally {
      setExporting(false);
    }
  }

  const Wrap = ({ children }: { children: React.ReactNode }) =>
    embedded ? <>{children}</> : <DashboardLayout>{children}</DashboardLayout>;

  if (profileLoading) {
    return (
      <Wrap>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </Wrap>
    );
  }

  if (!isAdmin) {
    // Effect above redirects; render a spinner during the brief unmount window.
    return (
      <Wrap>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </Wrap>
    );
  }

  return (
    <Wrap>
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              {t("admin.waitlistTitle")}
            </h1>
            <p className="text-[12px] text-[#8b9cb3] mt-0.5">
              {t("admin.waitlistSubtitle", { count: total })}
            </p>
          </div>
          <Button
            onClick={handleExportCsv}
            disabled={exporting || total === 0}
            data-testid="button-export-waitlist-csv"
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
            ) : (
              <Download className="h-4 w-4 mr-1.5" />
            )}
            {t("admin.exportCsv")}
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8b9cb3]" />
            <Input
              placeholder={t("admin.waitlistSearchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-[#0d1117] border-[#1f2937] text-white pl-9"
              data-testid="input-waitlist-search"
            />
          </div>
          <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("admin.refresh")}
          </Button>
        </div>

        <div className="bg-[#141c2b] rounded-xl border border-[#1f2937] overflow-hidden">
          {isLoading ? (
            <div className="p-5 space-y-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-10 w-full bg-white/5" />
              ))}
            </div>
          ) : signups.length === 0 ? (
            <div className="p-10 text-center text-[13px] text-[#8b9cb3]">
              {t("admin.waitlistEmpty")}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead className="bg-[#0d1117] text-[#8b9cb3]">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">{t("admin.colDate")}</th>
                    <th className="text-left px-4 py-2 font-medium">{t("admin.colEmail")}</th>
                    <th className="text-left px-4 py-2 font-medium">{t("admin.colPlan")}</th>
                    <th className="text-left px-4 py-2 font-medium">{t("admin.colSeats")}</th>
                    <th className="text-left px-4 py-2 font-medium">{t("admin.colLocale")}</th>
                    <th className="text-left px-4 py-2 font-medium">{t("admin.colSource")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1f2937]">
                  {signups.map((s) => (
                    <tr
                      key={s.id}
                      className="hover:bg-white/[0.02]"
                      data-testid={`row-waitlist-${s.id}`}
                    >
                      <td className="px-4 py-2 text-[#8b9cb3] whitespace-nowrap">
                        {new Date(s.createdAt).toLocaleString(i18n.language)}
                      </td>
                      <td className="px-4 py-2 text-white font-medium">{s.email}</td>
                      <td className="px-4 py-2 text-[#8b9cb3]">{s.plan || "—"}</td>
                      <td className="px-4 py-2 text-[#8b9cb3]">{s.seats ?? "—"}</td>
                      <td className="px-4 py-2 text-[#8b9cb3] uppercase">
                        {s.locale || "—"}
                      </td>
                      <td className="px-4 py-2 text-[#8b9cb3]">{s.source || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-[#8b9cb3]">
              {t("admin.paginationLabel", { page, totalPages })}
            </span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1 || isLoading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                data-testid="button-page-prev"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= totalPages || isLoading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                data-testid="button-page-next"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </Wrap>
  );
}
