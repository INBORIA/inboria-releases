import { DashboardLayout } from "@/components/layout/dashboard-layout";
import {
  useAdminListWaitlist,
  useGetProfile,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Download, Search, Mail, ShieldOff } from "lucide-react";
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

export default function AdminWaitlist() {
  const { t, i18n } = useTranslation();
  const { data: profile, isLoading: profileLoading } = useGetProfile();
  const { data, isLoading, refetch } = useAdminListWaitlist();
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  const isAdmin = !!(profile as any)?.isAdmin;

  const signups = useMemo(() => {
    const list = ((data as any)?.signups || []) as Array<{
      id: string;
      email: string;
      plan: string | null;
      seats: number | null;
      locale: string | null;
      source: string | null;
      createdAt: string;
    }>;
    if (!search.trim()) return list;
    const q = search.trim().toLowerCase();
    return list.filter(
      (s) =>
        s.email.toLowerCase().includes(q) ||
        (s.source || "").toLowerCase().includes(q) ||
        (s.plan || "").toLowerCase().includes(q),
    );
  }, [data, search]);

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
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `inboria-waitlist-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: t("admin.exportError"), variant: "destructive" });
    } finally {
      setExporting(false);
    }
  }

  if (profileLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!isAdmin) {
    return (
      <DashboardLayout>
        <div className="max-w-xl mx-auto px-4 py-12">
          <div className="bg-[#141c2b] rounded-xl border border-[#1f2937] p-8 text-center">
            <ShieldOff className="mx-auto h-12 w-12 text-[#8b9cb3]/40 mb-4" />
            <h2 className="text-lg font-semibold text-white mb-2">
              {t("admin.notAuthorizedTitle")}
            </h2>
            <p className="text-[13px] text-[#8b9cb3]">{t("admin.notAuthorizedDesc")}</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const total = (data as any)?.total ?? signups.length;

  return (
    <DashboardLayout>
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
            disabled={exporting || signups.length === 0}
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
                      <td className="px-4 py-2 text-[#8b9cb3] uppercase">{s.locale || "—"}</td>
                      <td className="px-4 py-2 text-[#8b9cb3]">{s.source || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
