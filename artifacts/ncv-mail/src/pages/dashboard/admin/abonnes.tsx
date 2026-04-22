import { DashboardLayout } from "@/components/layout/dashboard-layout";
import {
  useAdminListUsers,
  useAdminCancelUserSubscription,
  useGetProfile,
  getAdminListUsersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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
  Loader2,
  Search,
  Users,
  ShieldOff,
  XCircle,
  Crown,
  AlertTriangle,
} from "lucide-react";
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";

interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  plan: string;
  seats: number;
  emailsUsed: number;
  aiCreditsUsed: number;
  emailsQuota: number;
  organisationId: string | null;
  organisationName: string | null;
  hasPaddleSubscription: boolean;
  stripeCustomerId: string | null;
  createdAt: string;
  isAdmin: boolean;
}

export default function AdminAbonnes() {
  const { t, i18n } = useTranslation();
  const { data: profile, isLoading: profileLoading } = useGetProfile();
  const { data, isLoading, refetch } = useAdminListUsers();
  const cancelMutation = useAdminCancelUserSubscription();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirmOpenFor, setConfirmOpenFor] = useState<string | null>(null);

  const isAdmin = !!(profile as any)?.isAdmin;

  const users = useMemo(() => {
    const list = ((data as any)?.users || []) as AdminUser[];
    if (!search.trim()) return list;
    const q = search.trim().toLowerCase();
    return list.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        u.fullName.toLowerCase().includes(q) ||
        (u.organisationName || "").toLowerCase().includes(q),
    );
  }, [data, search]);

  async function handleCancel(userId: string, mode: "at_period_end" | "immediate") {
    setPendingId(userId);
    try {
      const result: any = await cancelMutation.mutateAsync({
        userId,
        data: { mode },
      });
      // Backend may return ok:false (HTTP 502) when Paddle fails on at_period_end
      // and no DB-side revocation occurred — show the real failure to the admin.
      if (result?.ok === false) {
        toast({
          title: t("admin.cancelError"),
          description: result?.paddleError || result?.error || undefined,
          variant: "destructive",
        });
        return;
      }
      const message = result?.paddleCancelled
        ? mode === "immediate"
          ? t("admin.cancelDoneImmediate")
          : t("admin.cancelDonePeriodEnd")
        : t("admin.cancelDoneNoPaddle");
      toast({ title: message });
      queryClient.invalidateQueries({ queryKey: getAdminListUsersQueryKey() });
      setConfirmOpenFor(null);
    } catch (e: any) {
      const data = e?.response?.data;
      toast({
        title: data?.error || t("admin.cancelError"),
        description: data?.paddleError || undefined,
        variant: "destructive",
      });
    } finally {
      setPendingId(null);
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

  const total = (data as any)?.total ?? users.length;

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              {t("admin.subscribersTitle")}
            </h1>
            <p className="text-[12px] text-[#8b9cb3] mt-0.5">
              {t("admin.subscribersSubtitle", { count: total })}
            </p>
          </div>
          <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("admin.refresh")}
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8b9cb3]" />
          <Input
            placeholder={t("admin.subscribersSearchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-[#0d1117] border-[#1f2937] text-white pl-9"
            data-testid="input-users-search"
          />
        </div>

        <div className="bg-[#141c2b] rounded-xl border border-[#1f2937] overflow-hidden">
          {isLoading ? (
            <div className="p-5 space-y-3">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full bg-white/5" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="p-10 text-center text-[13px] text-[#8b9cb3]">
              {t("admin.subscribersEmpty")}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead className="bg-[#0d1117] text-[#8b9cb3]">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">{t("admin.colUser")}</th>
                    <th className="text-left px-4 py-2 font-medium">{t("admin.colPlan")}</th>
                    <th className="text-left px-4 py-2 font-medium">{t("admin.colOrg")}</th>
                    <th className="text-left px-4 py-2 font-medium">{t("admin.colUsage")}</th>
                    <th className="text-left px-4 py-2 font-medium">{t("admin.colPaddle")}</th>
                    <th className="text-left px-4 py-2 font-medium">{t("admin.colSince")}</th>
                    <th className="text-right px-4 py-2 font-medium">{t("admin.colActions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1f2937]">
                  {users.map((u) => {
                    const totalUsed = u.emailsUsed + u.aiCreditsUsed;
                    const isExpired = u.plan === "expired";
                    const isPending = pendingId === u.id;
                    const isSelf = u.id === (profile as any)?.id;
                    return (
                      <tr
                        key={u.id}
                        className="hover:bg-white/[0.02]"
                        data-testid={`row-user-${u.id}`}
                      >
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <div className="text-white font-medium">
                              {u.fullName || t("admin.noName")}
                            </div>
                            {u.isAdmin && (
                              <span
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-medium"
                                title={t("admin.adminBadge")}
                              >
                                <Crown className="h-2.5 w-2.5" />
                                Admin
                              </span>
                            )}
                          </div>
                          <div className="text-[#8b9cb3] text-[11px]">{u.email}</div>
                        </td>
                        <td className="px-4 py-2">
                          <span
                            className={`capitalize font-medium ${
                              isExpired ? "text-red-400" : "text-primary"
                            }`}
                          >
                            {u.plan}
                          </span>
                          {u.plan === "business" && u.seats > 1 && (
                            <span className="text-[#8b9cb3] text-[11px]"> · {u.seats} {t("admin.seatsShort")}</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-[#8b9cb3]">
                          {u.organisationName || "—"}
                        </td>
                        <td className="px-4 py-2 text-[#8b9cb3] whitespace-nowrap">
                          {totalUsed} / {u.emailsQuota}
                        </td>
                        <td className="px-4 py-2">
                          {u.hasPaddleSubscription ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400">
                              ● Paddle
                            </span>
                          ) : (
                            <span className="text-[11px] text-amber-400">
                              {t("admin.noPaddle")}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-[#8b9cb3] whitespace-nowrap">
                          {new Date(u.createdAt).toLocaleDateString(i18n.language)}
                        </td>
                        <td className="px-4 py-2 text-right">
                          {isExpired || isSelf ? (
                            <span className="text-[11px] text-[#8b9cb3]">
                              {isSelf ? t("admin.youCannotCancelSelf") : t("admin.alreadyExpired")}
                            </span>
                          ) : (
                            <AlertDialog
                              open={confirmOpenFor === u.id}
                              onOpenChange={(open) => setConfirmOpenFor(open ? u.id : null)}
                            >
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-red-400 border-red-500/30 hover:bg-red-500/10 hover:text-red-300"
                                  disabled={isPending}
                                  data-testid={`button-cancel-${u.id}`}
                                >
                                  {isPending ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                                  ) : (
                                    <XCircle className="w-3.5 h-3.5 mr-1" />
                                  )}
                                  {t("admin.revoke")}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="flex items-center gap-2">
                                    <AlertTriangle className="h-4 w-4 text-amber-400" />
                                    {t("admin.cancelConfirmTitle", { email: u.email })}
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {u.hasPaddleSubscription
                                      ? t("admin.cancelConfirmDescPaddle")
                                      : t("admin.cancelConfirmDescBeta")}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter className="gap-2">
                                  <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                                  {u.hasPaddleSubscription && (
                                    <AlertDialogAction
                                      onClick={() => handleCancel(u.id, "at_period_end")}
                                      className="bg-amber-500 hover:bg-amber-600 text-white"
                                    >
                                      {t("admin.cancelAtPeriodEnd")}
                                    </AlertDialogAction>
                                  )}
                                  <AlertDialogAction
                                    onClick={() => handleCancel(u.id, "immediate")}
                                    className="bg-red-500 hover:bg-red-600 text-white"
                                  >
                                    {t("admin.cancelImmediate")}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
