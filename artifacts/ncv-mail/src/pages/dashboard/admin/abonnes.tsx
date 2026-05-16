import { DashboardLayout } from "@/components/layout/dashboard-layout";
import {
  useAdminListUsers,
  useAdminCancelUserSubscription,
  useAdminReactivateUser,
  useAdminDeleteUser,
  useGetProfile,
  getAdminListUsersQueryKey,
  type AdminUser,
  type AdminCancelSubscriptionResult,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Search,
  Users,
  ShieldOff,
  XCircle,
  Crown,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Trash2,
  RotateCcw,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

interface ProfileWithAdmin {
  id?: string;
  isAdmin?: boolean;
}

interface ApiErrorResponse {
  error?: string;
  paddleError?: string;
}

interface ApiError {
  response?: { data?: ApiErrorResponse };
}

const PAGE_SIZE = 50;
const PLAN_OPTIONS = ["essai", "solo", "pro", "business", "expired"];
const ALL_PLANS = "__all__";

interface AdminAbonnesProps {
  embedded?: boolean;
}

export default function AdminAbonnes({ embedded = false }: AdminAbonnesProps = {}) {
  const { t, i18n } = useTranslation();
  const { data: profileData, isLoading: profileLoading } = useGetProfile();
  const profile = (profileData ?? {}) as ProfileWithAdmin;
  const isAdmin = !!profile.isAdmin;
  const [, setLocation] = useLocation();

  // When rendered standalone, redirect non-admin users. When embedded inside
  // the unified /dashboard/admin page, the parent handles the redirect.
  useEffect(() => {
    if (!embedded && !profileLoading && !isAdmin) {
      setLocation("/dashboard", { replace: true });
    }
  }, [embedded, profileLoading, isAdmin, setLocation]);

  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState<string>(ALL_PLANS);
  const [page, setPage] = useState(1);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirmOpenFor, setConfirmOpenFor] = useState<string | null>(null);

  const params = {
    page,
    limit: PAGE_SIZE,
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(planFilter !== ALL_PLANS ? { plan: planFilter } : {}),
  };

  const { data, isLoading, refetch } = useAdminListUsers(params);
  const cancelMutation = useAdminCancelUserSubscription();
  const reactivateMutation = useAdminReactivateUser();
  const deleteMutation = useAdminDeleteUser();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [reactivateOpenFor, setReactivateOpenFor] = useState<string | null>(null);
  const [deleteOpenFor, setDeleteOpenFor] = useState<string | null>(null);

  async function handleReactivate(userId: string) {
    setPendingId(userId);
    try {
      await reactivateMutation.mutateAsync({ userId, data: { plan: "essai" } });
      toast({ title: "Compte réactivé en essai." });
      queryClient.invalidateQueries({ queryKey: getAdminListUsersQueryKey() });
      setReactivateOpenFor(null);
    } catch (err) {
      const apiErr = err as ApiError;
      toast({
        title: apiErr?.response?.data?.error || "Échec de la réactivation.",
        variant: "destructive",
      });
    } finally {
      setPendingId(null);
    }
  }

  async function handleDelete(userId: string) {
    setPendingId(userId);
    try {
      await deleteMutation.mutateAsync({ userId });
      toast({ title: "Compte supprimé." });
      queryClient.invalidateQueries({ queryKey: getAdminListUsersQueryKey() });
      setDeleteOpenFor(null);
    } catch (err) {
      const apiErr = err as ApiError;
      const errorMsg = apiErr?.response?.data?.error;
      toast({
        title:
          errorMsg === "active_paddle_subscription"
            ? "Impossible de supprimer : un abonnement Paddle est actif. Révoquez d'abord."
            : errorMsg || "Échec de la suppression.",
        variant: "destructive",
      });
    } finally {
      setPendingId(null);
    }
  }

  const users: AdminUser[] = data?.users ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  async function handleCancel(userId: string, mode: "at_period_end" | "immediate") {
    setPendingId(userId);
    try {
      const result = (await cancelMutation.mutateAsync({
        userId,
        data: { mode },
      })) as AdminCancelSubscriptionResult;

      if (result?.ok === false) {
        toast({
          title: t("admin.cancelError"),
          description: result?.paddleError ?? undefined,
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
    } catch (err) {
      const apiErr = err as ApiError;
      const data = apiErr?.response?.data;
      toast({
        title: data?.error || t("admin.cancelError"),
        description: data?.paddleError || undefined,
        variant: "destructive",
      });
    } finally {
      setPendingId(null);
    }
  }

  function resetToPage1<T>(setter: (v: T) => void, value: T): void {
    setter(value);
    setPage(1);
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
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              {t("admin.subscribersTitle")}
            </h1>
            <p className="text-[12px] text-[#b8c5d6] mt-0.5">
              {t("admin.subscribersSubtitle", { count: total })}
            </p>
          </div>
          <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("admin.refresh")}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#b8c5d6]" />
            <Input
              placeholder={t("admin.subscribersSearchPlaceholder")}
              value={search}
              onChange={(e) => resetToPage1(setSearch, e.target.value)}
              className="bg-[#0d1117] border-[#1f2937] text-white pl-9"
              data-testid="input-users-search"
            />
          </div>
          <Select
            value={planFilter}
            onValueChange={(v) => resetToPage1(setPlanFilter, v)}
          >
            <SelectTrigger
              className="w-[180px] bg-[#0d1117] border-[#1f2937] text-white"
              data-testid="select-plan-filter"
            >
              <SelectValue placeholder={t("admin.planFilterPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_PLANS}>{t("admin.planFilterAll")}</SelectItem>
              {PLAN_OPTIONS.map((p) => (
                <SelectItem key={p} value={p} className="capitalize">
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="bg-[#141c2b] rounded-xl border border-[#1f2937] overflow-hidden">
          {isLoading ? (
            <div className="p-5 space-y-3">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full bg-white/5" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="p-10 text-center text-[13px] text-[#b8c5d6]">
              {t("admin.subscribersEmpty")}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead className="bg-[#0d1117] text-[#b8c5d6]">
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
                    const seats = u.seats ?? 1;
                    const totalUsed = u.emailsUsed + u.aiCreditsUsed;
                    const isExpired = u.plan === "expired";
                    const isPending = pendingId === u.id;
                    const isSelf = u.id === profile.id;
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
                          <div className="text-[#b8c5d6] text-[11px]">{u.email}</div>
                        </td>
                        <td className="px-4 py-2">
                          <span
                            className={`capitalize font-medium ${
                              isExpired ? "text-red-400" : "text-primary"
                            }`}
                          >
                            {u.plan}
                          </span>
                          {u.plan === "business" && seats > 1 && (
                            <span className="text-[#b8c5d6] text-[11px]">
                              {" "}
                              · {seats} {t("admin.seatsShort")}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-[#b8c5d6]">
                          {u.organisationName || "—"}
                        </td>
                        <td className="px-4 py-2 text-[#b8c5d6] whitespace-nowrap">
                          {totalUsed} / {u.emailsQuota}
                        </td>
                        <td className="px-4 py-2">
                          {u.hasPaddleSubscription ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400">
                                ● Paddle
                              </span>
                              {u.paddleStatus && (
                                <span
                                  className="text-[10px] text-[#b8c5d6] capitalize"
                                  data-testid={`paddle-status-${u.id}`}
                                >
                                  {u.paddleStatus.replace(/_/g, " ")}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] text-amber-400">
                              {t("admin.noPaddle")}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-[#b8c5d6] whitespace-nowrap">
                          {new Date(u.createdAt).toLocaleDateString(i18n.language)}
                        </td>
                        <td className="px-4 py-2 text-right">
                          {isSelf ? (
                            <span className="text-[11px] text-[#b8c5d6]">
                              {t("admin.youCannotCancelSelf")}
                            </span>
                          ) : isExpired ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <AlertDialog
                                open={reactivateOpenFor === u.id}
                                onOpenChange={(open) =>
                                  setReactivateOpenFor(open ? u.id : null)
                                }
                              >
                                <AlertDialogTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-300"
                                    disabled={isPending}
                                    data-testid={`button-reactivate-${u.id}`}
                                  >
                                    {isPending ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                                    ) : (
                                      <RotateCcw className="w-3.5 h-3.5 mr-1" />
                                    )}
                                    Réactiver
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>
                                      Réactiver le compte de {u.email} ?
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Le plan repassera à « essai » avec un quota frais et l'utilisateur retrouvera l'accès à l'application. Aucun appel Paddle n'est fait — pour réactiver un abonnement payant, l'utilisateur doit le souscrire à nouveau.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter className="gap-2">
                                    <AlertDialogCancel>
                                      Annuler
                                    </AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleReactivate(u.id)}
                                      className="bg-emerald-500 hover:bg-emerald-600 text-white"
                                    >
                                      Réactiver en essai
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                              <AlertDialog
                                open={deleteOpenFor === u.id}
                                onOpenChange={(open) =>
                                  setDeleteOpenFor(open ? u.id : null)
                                }
                              >
                                <AlertDialogTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-red-400 border-red-500/30 hover:bg-red-500/10 hover:text-red-300"
                                    disabled={isPending}
                                    data-testid={`button-delete-${u.id}`}
                                  >
                                    {isPending ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                                    ) : (
                                      <Trash2 className="w-3.5 h-3.5 mr-1" />
                                    )}
                                    Supprimer
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle className="flex items-center gap-2">
                                      <AlertTriangle className="h-4 w-4 text-red-400" />
                                      Supprimer définitivement {u.email} ?
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Cette action est IRRÉVERSIBLE : le compte auth, le profil, l'historique de mails et toutes les données associées seront supprimés. À n'utiliser que pour des comptes de test ou un droit à l'effacement RGPD. Refus si un abonnement Paddle est actif.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter className="gap-2">
                                    <AlertDialogCancel>
                                      Annuler
                                    </AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDelete(u.id)}
                                      className="bg-red-500 hover:bg-red-600 text-white"
                                    >
                                      Supprimer définitivement
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          ) : (
                            <AlertDialog
                              open={confirmOpenFor === u.id}
                              onOpenChange={(open) =>
                                setConfirmOpenFor(open ? u.id : null)
                              }
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
                                      onClick={() =>
                                        handleCancel(u.id, "at_period_end")
                                      }
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

        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-[#b8c5d6]">
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
