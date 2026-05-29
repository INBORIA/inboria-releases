import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { EmailBodyRenderer } from "@/components/EmailBodyRenderer";
import {
  useListEmails,
  useRestoreEmail,
  usePermanentDeleteEmail,
  useEmptySpam,
  useBlockSender,
  useListBlockedSenders,
  useUnblockSender,
  getListBlockedSendersQueryKey,
  getListEmailsQueryKey,
  getGetSpamCountQueryKey,
  getGetCategoryCountsQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetInboxHealthQueryKey,
} from "@workspace/api-client-react";
import type { Email, PaginatedEmails } from "@workspace/api-client-react";
import { format } from "date-fns";
import { fr, enUS, nl, de, es, it, pt, pl, ro, sv, da, fi, hu, cs, tr, ja, ko, vi, th, id, ms, el } from "date-fns/locale";
import { useTranslation } from "react-i18next";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useState, useMemo, useEffect, useLayoutEffect, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { useMarkInboxPage } from "@/lib/inbox-theme";
import { removeEmailOptimistic } from "@/lib/optimistic-email";
import { ChevronLeft, RotateCcw, Trash2, ShieldX, Shield, Eye, EyeOff, Clock, Loader2, Download, Check } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { VirtualizedMailList } from "@/components/email-list/VirtualizedMailList";
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

type RiskLevel = "low" | "medium" | "veryHigh";

function getRisk(email: any): RiskLevel {
  if (email.priority === "urgent") return "veryHigh";
  if (email.priority === "moyen") return "medium";
  return "low";
}

const RISK_DOT: Record<RiskLevel, string> = {
  low: "bg-[#b8c5d6]",
  medium: "bg-amber-500",
  veryHigh: "bg-red-500",
};

function filteredByLabel(spamSource: string | null | undefined, t: (k: string) => string): string {
  if (spamSource === "ai") return t("junk.filteredByInboria");
  if (spamSource === "user") return t("junk.filteredByUser");
  return t("junk.filteredByProvider");
}

export default function Indesirables() {
  useMarkInboxPage();
  const { t, i18n } = useTranslation();
  const dateFnsLocale = ({fr,en:enUS,nl,de,es,it,pt,pl}[(i18n.resolvedLanguage || i18n.language || "fr").substring(0,2)] || fr);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { session } = useAuth();
  const [selectedEmailId, setSelectedEmailId] = useState<number | null>(null);
  const [showDangerous, setShowDangerous] = useState(false);
  const [emptyConfirmOpen, setEmptyConfirmOpen] = useState(false);
  const [refetchingBody, setRefetchingBody] = useState(false);
  const [refetchError, setRefetchError] = useState<string | null>(null);
  const [recoveredBodies, setRecoveredBodies] = useState<Record<number, string>>({});
  const autoFetchedRef = useRef<Set<number>>(new Set());

  const handleRefetchBody = async (id: number) => {
    setRefetchingBody(true);
    setRefetchError(null);
    try {
      const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${baseUrl}/api/emails/${id}/refetch-body`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(j.error || `Échec (HTTP ${res.status})`);
      }
      const body = String(j.body || "");
      if (!body || body.trim().length === 0) {
        throw new Error("Le fournisseur n'a renvoyé aucun contenu");
      }
      setRecoveredBodies((prev) => ({ ...prev, [id]: body }));
    } catch (e: any) {
      setRefetchError(e?.message || "Échec");
    } finally {
      setRefetchingBody(false);
    }
  };

  const { data: connections } = useQuery<any[]>({
    queryKey: ["email-connections"],
    queryFn: async () => {
      const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${baseUrl}/api/email/connections`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch connections");
      return res.json();
    },
    enabled: !!session,
  });
  const firstConnectionId = (connections || []).find((c: any) => c.status !== "disconnected")?.id
    || (connections || [])[0]?.id
    || null;

  const { data, isLoading } = useListEmails({ status: "spam", limit: 200, page: 1 }, { query: { placeholderData: (prev: any) => prev } as any });
  const paged = data as PaginatedEmails | undefined;
  const emails = useMemo(() => (paged?.emails || []) as Email[], [paged]);

  const restore = useRestoreEmail();
  const permDelete = usePermanentDeleteEmail();
  const emptySpam = useEmptySpam();
  const blockSender = useBlockSender();

  // Sélection multiple par drag souris + menu contextuel clic droit
  // (parité Corbeille). Anchor-was-selected → drag retire la plage ; sinon
  // ajoute. Seuil 5px pour distinguer clic simple vs drag.
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; ids: number[] } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);
  const didDragRef = useRef(false);
  const dragStartIdRef = useRef<number | null>(null);
  const dragStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const preSelectRef = useRef<Set<number>>(new Set());
  const anchorWasSelectedRef = useRef<boolean>(false);
  // Optims drag-select : snapshot ids 1× au mousedown + throttle rAF.
  const dragIdsSnapshotRef = useRef<number[]>([]);
  const dragIdIndexRef = useRef<Map<number, number>>(new Map());
  const moveRaf = useRef<number>(0);
  const lastMouseXRef = useRef(0);
  const lastMouseYRef = useRef(0);
  const lastHoverIdRef = useRef<number | null>(null);
  const [menuPos, setMenuPos] = useState<{ left: number; top: number; opacity: number }>({ left: 0, top: 0, opacity: 0 });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListEmailsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetSpamCountQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetCategoryCountsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetInboxHealthQueryKey() });
  };

  const describeEmail = (id: number): string => {
    const e = emails.find((x) => x.id === id) as any;
    if (!e) return "";
    const subj = (e.subject || "").trim() || "(sans objet)";
    const sender = (e.senderEmail || e.sender || "").trim();
    return sender ? `${subj} — ${sender}` : subj;
  };

  const handleRestore = (id: number) => {
    const desc = describeEmail(id);
    // Task #308 — optimiste : le mail quitte les Indésirables instantanément.
    const rollback = removeEmailOptimistic(queryClient, id);
    if (selectedEmailId === id) setSelectedEmailId(null);
    restore.mutate({ id }, {
      onSuccess: () => {
        invalidate();
        toast({
          title: t("junk.restored"),
          description: desc,
          duration: 8000,
          action: (
            <Link
              href={`/dashboard?emailId=${id}`}
              className="inline-flex items-center justify-center rounded-md border border-border bg-card px-3 py-1.5 text-[11px] font-medium text-foreground hover:bg-muted transition-colors whitespace-nowrap"
            >
              {t("junk.openRestored", "Ouvrir")}
            </Link>
          ) as any,
        });
      },
      onError: () => {
        rollback();
        toast({ title: t("common.error"), description: desc, variant: "destructive" });
      },
    });
  };

  const handleDelete = (id: number) => {
    const desc = describeEmail(id);
    // Task #308 — optimiste.
    const rollback = removeEmailOptimistic(queryClient, id);
    if (selectedEmailId === id) setSelectedEmailId(null);
    permDelete.mutate({ id }, {
      onSuccess: () => {
        invalidate();
        toast({ title: t("junk.deleted"), description: desc });
      },
      onError: () => {
        rollback();
        toast({ title: t("common.error"), description: desc, variant: "destructive" });
      },
    });
  };

  const handleBlock = (email: any) => {
    const addr = (email.senderEmail || "").trim();
    if (!addr) {
      toast({ title: t("junk.blockFailed"), description: t("junk.blockNoEmail"), variant: "destructive" });
      return;
    }
    if (!firstConnectionId) {
      toast({ title: t("junk.blockFailed"), description: t("junk.blockNoConnection"), variant: "destructive" });
      return;
    }
    blockSender.mutate(
      { data: { email: addr, connectionId: firstConnectionId, scope: "all_accounts" } },
      {
        onSuccess: () => toast({ title: t("junk.blocked"), description: addr }),
        onError: () => toast({ title: t("junk.blockFailed"), variant: "destructive" }),
      },
    );
  };

  // --- Bloqués (unblock UI) ---
  const [showBlocked, setShowBlocked] = useState(false);
  const { data: blockedList } = useListBlockedSenders({}, { query: { enabled: showBlocked } as any });
  const unblockMut = useUnblockSender();
  const handleUnblock = (id: string, addr: string) => {
    unblockMut.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListBlockedSendersQueryKey({} as any) });
          toast({ title: t("junk.unblocked", { defaultValue: "Expéditeur débloqué" }), description: addr });
        },
        onError: (e: any) =>
          toast({ variant: "destructive", title: t("common.error"), description: e?.message || "Échec" }),
      },
    );
  };

  const getRowIdFromPoint = (y: number, x: number): number | null => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    if (!el) return null;
    const row = el.closest("[data-row-id]");
    if (!row) return null;
    const id = Number((row as HTMLElement).dataset.rowId);
    return Number.isFinite(id) ? id : null;
  };

  const visibleIds = useMemo(() => {
    const dang = emails.filter((e) => getRisk(e) === "veryHigh");
    const norm = emails.filter((e) => getRisk(e) !== "veryHigh");
    return (showDangerous ? [...norm, ...dang] : norm).map((e: any) => e.id);
  }, [emails, showDangerous]);

  useEffect(() => {
    const processMove = () => {
      moveRaf.current = 0;
      if (!isDraggingRef.current) return;
      const id = getRowIdFromPoint(lastMouseYRef.current, lastMouseXRef.current);
      if (id == null || dragStartIdRef.current == null) return;
      if (id === lastHoverIdRef.current) return;
      lastHoverIdRef.current = id;
      const idx = dragIdIndexRef.current;
      const ids = dragIdsSnapshotRef.current;
      const a = idx.get(dragStartIdRef.current) ?? -1;
      const b = idx.get(id) ?? -1;
      if (a < 0 || b < 0) return;
      const [lo, hi] = a < b ? [a, b] : [b, a];
      const next = new Set(preSelectRef.current);
      if (anchorWasSelectedRef.current) {
        for (let i = lo; i <= hi; i++) next.delete(ids[i]);
      } else if (a !== b) {
        for (let i = lo; i <= hi; i++) next.add(ids[i]);
      }
      setSelectedIds(next);
    };
    const onMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      if (!didDragRef.current && dragStartPosRef.current) {
        const dx = Math.abs(e.clientX - dragStartPosRef.current.x);
        const dy = Math.abs(e.clientY - dragStartPosRef.current.y);
        if (dx < 5 && dy < 5) return;
        didDragRef.current = true;
      }
      lastMouseXRef.current = e.clientX;
      lastMouseYRef.current = e.clientY;
      if (moveRaf.current === 0) moveRaf.current = requestAnimationFrame(processMove);
    };
    const onUp = () => {
      isDraggingRef.current = false;
      dragStartIdRef.current = null;
      if (moveRaf.current !== 0) { cancelAnimationFrame(moveRaf.current); moveRaf.current = 0; }
      setTimeout(() => { didDragRef.current = false; }, 0);
    };
    document.addEventListener("mousemove", onMove, { passive: true });
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      if (moveRaf.current !== 0) cancelAnimationFrame(moveRaf.current);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedIds(new Set());
        setContextMenu(null);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!contextMenu) return;
    const onDown = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [contextMenu]);

  useLayoutEffect(() => {
    if (!contextMenu || !contextMenuRef.current) {
      setMenuPos({ left: 0, top: 0, opacity: 0 });
      return;
    }
    const m = 8;
    const rect = contextMenuRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = contextMenu.x;
    let top = contextMenu.y;
    if (left + rect.width + m > vw) left = Math.max(m, vw - rect.width - m);
    if (top + rect.height + m > vh) top = Math.max(m, vh - rect.height - m);
    setMenuPos({ left, top, opacity: 1 });
  }, [contextMenu]);

  const handleBulkRestore = (ids: number[]) => {
    for (const id of ids) {
      restore.mutate({ id }, { onSuccess: () => { invalidate(); }, onError: () => toast({ title: t("common.error"), variant: "destructive" }) });
    }
    setSelectedIds(new Set());
    setContextMenu(null);
    toast({ title: t("junk.restored"), description: `${ids.length} mail(s)` });
  };

  const handleBulkDelete = (ids: number[]) => {
    for (const id of ids) {
      permDelete.mutate({ id }, { onSuccess: () => { invalidate(); }, onError: () => toast({ title: t("common.error"), variant: "destructive" }) });
    }
    setSelectedIds(new Set());
    setContextMenu(null);
    toast({ title: t("junk.deleted"), description: `${ids.length} mail(s)` });
  };

  const handleBulkBlock = (ids: number[]) => {
    let ok = 0;
    for (const id of ids) {
      const em = emails.find((e) => e.id === id) as any;
      const addr = (em?.senderEmail || "").trim();
      if (!addr || !firstConnectionId) continue;
      blockSender.mutate({ data: { email: addr, connectionId: firstConnectionId, scope: "all_accounts" } }, {
        onError: () => toast({ title: t("junk.blockFailed"), variant: "destructive" }),
      });
      ok++;
    }
    setSelectedIds(new Set());
    setContextMenu(null);
    if (ok > 0) toast({ title: t("junk.blocked"), description: `${ok} expéditeur(s)` });
  };

  const handleEmpty = () => {
    emptySpam.mutate(undefined, {
      onSuccess: () => {
        setSelectedEmailId(null);
        invalidate();
        toast({ title: t("junk.emptied") });
      },
      onError: () => toast({ title: t("common.error"), variant: "destructive" }),
    });
    setEmptyConfirmOpen(false);
  };

  const dangerous = emails.filter((e) => getRisk(e) === "veryHigh");
  const normal = emails.filter((e) => getRisk(e) !== "veryHigh");
  const visible = showDangerous ? [...normal, ...dangerous] : normal;
  const selectedEmail = emails.find((e) => e.id === selectedEmailId);

  // Auto-récupération du corps si vide à l'ouverture du mail.
  // Une seule tentative par id (autoFetchedRef) pour éviter les boucles.
  useEffect(() => {
    if (!selectedEmail) return;
    const id = selectedEmail.id;
    const bodyLen = ((selectedEmail as any).body || "").trim().length;
    if (bodyLen >= 30) return;
    if (recoveredBodies[id]) return;
    if (autoFetchedRef.current.has(id)) return;
    autoFetchedRef.current.add(id);
    handleRefetchBody(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEmailId]);

  if (selectedEmail) {
    return (
      <DashboardLayout>
        <div className="max-w-[1600px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center gap-3 mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedEmailId(null)}
              className="h-7 px-2 text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04] text-[12px]"
            >
              <ChevronLeft className="w-3.5 h-3.5 mr-1" />
              {t("common.back", "Retour")}
            </Button>
          </div>

          <div className="mb-3 rounded-md border border-border bg-muted/30 px-3 py-2 flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground">
              {filteredByLabel((selectedEmail as any).spamSource, t)}
            </span>
          </div>

          <div className="bg-card rounded-lg border border-border overflow-hidden">
            <div className="p-4 border-b border-border">
              <h2 className="text-[15px] font-semibold text-white mb-2.5">{selectedEmail.subject}</h2>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#1e3a5f] flex items-center justify-center text-primary font-semibold text-[12px]">
                    {((selectedEmail as any).sender || "?")[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="text-[12px] font-medium text-white">{(selectedEmail as any).sender}</div>
                    {(selectedEmail as any).senderEmail && (
                      <div className="text-[10px] text-[#b8c5d6]">{(selectedEmail as any).senderEmail}</div>
                    )}
                  </div>
                </div>
                <span className="text-[10px] text-[#b8c5d6] flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {format(new Date((selectedEmail as any).createdAt), "d MMMM yyyy HH:mm", { locale: dateFnsLocale })}
                </span>
              </div>
            </div>

            <div className="p-4">
              {(() => {
                const localBody = recoveredBodies[selectedEmail.id];
                const liveBody = (selectedEmail as any).body || "";
                const effectiveBody = (localBody && localBody.trim().length >= 30) ? localBody : liveBody;
                if (effectiveBody.trim().length >= 30) {
                  return <EmailBodyRenderer body={effectiveBody} emailId={selectedEmail.id} sender={(selectedEmail as any).sender} />;
                }
                if (refetchingBody) {
                  return (
                    <div className="rounded-md border border-border bg-muted/20 px-4 py-8 text-center flex flex-col items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      <p className="text-[12px] text-muted-foreground">
                        {t("junk.fetchingFromProvider", "Récupération du contenu depuis votre fournisseur…")}
                      </p>
                    </div>
                  );
                }
                if (refetchError) {
                  return (
                    <div className="rounded-md border border-border bg-muted/20 px-4 py-6 text-center">
                      <p className="text-[12px] text-muted-foreground mb-1">
                        {t("junk.fetchFailed", "Impossible de récupérer le contenu de ce mail.")}
                      </p>
                      <p className="text-[11px] text-muted-foreground/70 mb-3">{refetchError}</p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 h-7 text-[11px]"
                        onClick={() => { autoFetchedRef.current.delete(selectedEmail.id); handleRefetchBody(selectedEmail.id); }}
                      >
                        <Download className="w-3 h-3" />
                        {t("junk.retryFetch", "Réessayer")}
                      </Button>
                    </div>
                  );
                }
                return (
                  <div className="rounded-md border border-border bg-muted/20 px-4 py-6 text-center flex flex-col items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    <p className="text-[12px] text-muted-foreground">
                      {t("junk.fetchingFromProvider", "Récupération du contenu depuis votre fournisseur…")}
                    </p>
                  </div>
                );
              })()}
            </div>

            <div className="px-4 py-3 border-t border-border flex items-center gap-1.5 flex-wrap">
              <Button size="sm" className="gap-1.5 h-7 text-[11px]" onClick={() => handleRestore(selectedEmail.id)}>
                <RotateCcw className="w-3 h-3" />
                {t("junk.restore")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-7 text-[11px] bg-transparent border-border text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04]"
                onClick={() => handleBlock(selectedEmail)}
                disabled={blockSender.isPending}
              >
                <ShieldX className="w-3 h-3" />
                {t("junk.blockSender")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-7 text-[11px] bg-transparent border-border text-red-400/80 hover:text-red-400 hover:bg-red-500/[0.08]"
                onClick={() => handleDelete(selectedEmail.id)}
              >
                <Trash2 className="w-3 h-3" />
                {t("junk.permanentDelete")}
              </Button>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-[1600px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-5">
        <div className="mb-2">
          <Link href="/dashboard">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04] text-[12px]"
            >
              <ChevronLeft className="w-3.5 h-3.5 mr-1" />
              {t("common.back", "Retour")}
            </Button>
          </Link>
        </div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-baseline gap-3">
            <h1 className="text-[18px] font-semibold text-white">{t("junk.title")}</h1>
            <span className="text-[12px] text-[#b8c5d6]">
              {t("junk.count", { count: emails.length })}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[11px] bg-transparent border-border text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04]"
              onClick={() => setShowBlocked((v) => !v)}
            >
              <Shield className="w-3 h-3 mr-1" />
              {t("junk.blockedList", { defaultValue: "Bloqués" })}
              {blockedList && blockedList.length > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center rounded bg-amber-500/20 text-amber-300 text-[10px] px-1.5 py-px tabular-nums">
                  {blockedList.length}
                </span>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[11px] bg-transparent border-border text-red-400/80 hover:text-red-400 hover:bg-red-500/[0.08]"
              onClick={() => setEmptyConfirmOpen(true)}
              disabled={emails.length === 0 || emptySpam.isPending}
            >
              <Trash2 className="w-3 h-3 mr-1" />
              {t("junk.empty")}
            </Button>
          </div>
        </div>

        {showBlocked && (
          <div className="mb-3 rounded-md border border-border bg-card/40">
            <div className="px-3 py-2 border-b border-border flex items-center justify-between">
              <span className="text-[11px] font-medium text-white flex items-center gap-1.5">
                <Shield className="w-3 h-3 text-amber-300" />
                {t("junk.blockedList", { defaultValue: "Expéditeurs bloqués" })}
              </span>
              <button
                onClick={() => setShowBlocked(false)}
                className="text-[11px] text-muted-foreground hover:text-foreground"
              >
                {t("common.close", { defaultValue: "Fermer" })}
              </button>
            </div>
            {!blockedList ? (
              <div className="px-3 py-4 text-center text-[11px] text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin inline mr-1.5" />
                {t("common.loading", { defaultValue: "Chargement…" })}
              </div>
            ) : blockedList.length === 0 ? (
              <div className="px-3 py-4 text-center text-[11px] text-muted-foreground">
                {t("junk.noBlocked", { defaultValue: "Aucun expéditeur bloqué" })}
              </div>
            ) : (
              <ul className="divide-y divide-border/60 max-h-[300px] overflow-y-auto">
                {blockedList.map((b: any) => (
                  <li key={b.id} className="px-3 py-2 flex items-center gap-2">
                    <ShieldX className="w-3 h-3 text-amber-300 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] text-white truncate">{b.emailAddress}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {b.provider}
                        {b.blockedAt && ` · ${format(new Date(b.blockedAt), "d MMM yyyy", { locale: dateFnsLocale })}`}
                      </div>
                    </div>
                    <button
                      onClick={() => handleUnblock(b.id, b.emailAddress)}
                      disabled={unblockMut.isPending}
                      className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] text-primary hover:bg-primary/10 disabled:opacity-40"
                      title={t("junk.unblock", { defaultValue: "Débloquer" })}
                    >
                      <RotateCcw className="w-3 h-3" />
                      {t("junk.unblock", { defaultValue: "Débloquer" })}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 rounded-lg border border-border border-dashed bg-card/50">
            <Loader2 className="w-6 h-6 text-primary animate-spin mb-3" />
            <h3 className="text-[13px] font-medium text-white">{t("inbox.loadingTitle", "Chargement…")}</h3>
          </div>
        ) : emails.length === 0 ? (
          <div className="text-center py-16 rounded-lg border border-border border-dashed bg-card/50">
            <Shield className="mx-auto h-8 w-8 text-[#b8c5d6]/40 mb-2" />
            <p className="text-[12px] text-[#b8c5d6]">{t("junk.noEmails")}</p>
          </div>
        ) : (
          <>
            {dangerous.length > 0 && (
              <button
                className="w-full mb-2 rounded-md border border-red-500/20 bg-red-500/[0.06] px-3 py-2 flex items-center justify-between hover:bg-red-500/[0.10] transition-colors"
                onClick={() => setShowDangerous((v) => !v)}
              >
                <span className="text-[11px] text-red-300 flex items-center gap-2">
                  <ShieldX className="w-3.5 h-3.5" />
                  {t("junk.hiddenDangerous", { count: dangerous.length })}
                </span>
                <span className="text-[11px] text-red-300 flex items-center gap-1 font-medium">
                  {showDangerous ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  {showDangerous ? t("junk.hide") : t("junk.show")}
                </span>
              </button>
            )}

            <div>
              <VirtualizedMailList
                items={visible}
                keyExtractor={(e: any) => e.id}
                renderRow={(email: any) => {
                const risk = getRisk(email);
                const isSelected = selectedIds.has(email.id);
                return (
                  <div
                    key={email.id}
                    data-row-id={email.id}
                    title={`${email.sender || ""}${email.senderEmail ? ` <${email.senderEmail}>` : ""}\n${email.subject || ""}${email.createdAt ? `\n${new Date(email.createdAt).toLocaleString()}` : ""}${email.summary ? `\n\n${email.summary}` : ""}`}
                    className={`group relative flex items-center gap-3 h-[52px] pl-2 pr-3 cursor-pointer select-none border-l-2 border-l-transparent border-b border-border/40 transition-colors ${
                      isSelected ? "bg-primary/[0.10]" : "hover:bg-white/[0.03]"
                    }`}
                    onMouseDown={(e) => {
                      if (e.button !== 0) return;
                      isDraggingRef.current = true;
                      didDragRef.current = false;
                      dragStartIdRef.current = email.id;
                      dragStartPosRef.current = { x: e.clientX, y: e.clientY };
                      lastHoverIdRef.current = null;
                      const additive = e.metaKey || e.ctrlKey || e.shiftKey;
                      preSelectRef.current = additive ? new Set(selectedIds) : new Set<number>();
                      anchorWasSelectedRef.current = selectedIds.has(email.id);
                      const rows = document.querySelectorAll<HTMLElement>("[data-row-id]");
                      const ids: number[] = [];
                      const idx = new Map<number, number>();
                      rows.forEach((r, i) => {
                        const v = Number(r.dataset.rowId);
                        if (Number.isFinite(v)) { ids.push(v); idx.set(v, i); }
                      });
                      dragIdsSnapshotRef.current = ids;
                      dragIdIndexRef.current = idx;
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      let ids: number[];
                      if (selectedIds.has(email.id) && selectedIds.size > 0) {
                        ids = Array.from(selectedIds);
                      } else {
                        ids = [email.id];
                        setSelectedIds(new Set([email.id]));
                      }
                      setContextMenu({ x: e.clientX, y: e.clientY, ids });
                    }}
                    onClick={(e) => {
                      if (didDragRef.current) return;
                      if (e.metaKey || e.ctrlKey || e.shiftKey) {
                        e.preventDefault();
                        const next = new Set(selectedIds);
                        if (next.has(email.id)) next.delete(email.id);
                        else next.add(email.id);
                        setSelectedIds(next);
                        return;
                      }
                      if (selectedIds.size > 0) setSelectedIds(new Set());
                      setSelectedEmailId(email.id);
                    }}
                  >
                    {/* Case à cocher — visible en mode sélection ou si la ligne est sélectionnée */}
                    {(selectedIds.size > 0 || isSelected) ? (
                      <div
                        className="w-4 h-4 rounded flex items-center justify-center transition-all cursor-pointer border border-[#2a3441] hover:border-primary shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          const next = new Set(selectedIds);
                          if (next.has(email.id)) next.delete(email.id);
                          else next.add(email.id);
                          setSelectedIds(next);
                        }}
                      >
                        {isSelected && <Check className="w-3 h-3 text-primary" />}
                      </div>
                    ) : (
                      <div className="w-4 shrink-0" />
                    )}
                    <div className="w-4 flex items-center justify-center shrink-0">
                      {risk !== "low" && (
                        <span className={`w-1.5 h-1.5 rounded-full ${RISK_DOT[risk]}`} title={t(`junk.risk.${risk}`)} />
                      )}
                    </div>
                    <div className="w-7 h-7 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
                      <span className="text-primary text-[11px] font-semibold">
                        {(email.sender || "?").trim()[0]?.toUpperCase() || "?"}
                      </span>
                    </div>
                    <div className="w-[140px] shrink-0 min-w-0">
                      <span className="text-[13px] truncate text-[#c2c8d4] block">{email.sender}</span>
                    </div>
                    <div className="flex-1 min-w-0 flex items-baseline gap-2 overflow-hidden">
                      <span className="text-[13px] truncate text-[#c2c8d4]">{email.subject}</span>
                      {email.summary && (
                        <span className="text-[13px] truncate text-[#8b95a7]">— {email.summary}</span>
                      )}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRestore(email.id); }}
                      className="shrink-0 p-1.5 rounded text-[#6b7480] hover:text-primary hover:bg-primary/10"
                      title={t("junk.restore")}
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleBlock(email); }}
                      className="shrink-0 p-1.5 rounded text-[#6b7480] hover:text-amber-300 hover:bg-amber-500/10 disabled:opacity-40"
                      title={t("junk.blockSender")}
                      disabled={blockSender.isPending}
                    >
                      <ShieldX className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(email.id); }}
                      className="shrink-0 p-1.5 rounded text-[#6b7480] hover:text-red-400 hover:bg-red-500/10"
                      title={t("junk.permanentDelete")}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[11px] tabular-nums text-[#8b95a7] w-12 text-right whitespace-nowrap hidden sm:inline shrink-0">
                      {format(new Date(email.createdAt), "d MMM", { locale: dateFnsLocale })}
                    </span>
                  </div>
                );
              }}
              />
            </div>
          </>
        )}
      </div>

      {contextMenu && (
        <div
          ref={contextMenuRef}
          style={{
            position: "fixed",
            left: menuPos.left,
            top: menuPos.top,
            opacity: menuPos.opacity,
            zIndex: 9999,
            maxHeight: "calc(100vh - 16px)",
            overflowY: "auto",
          }}
          className="min-w-[220px] max-w-[280px] rounded-md border border-border bg-popover shadow-lg py-1"
          onContextMenu={(e) => e.preventDefault()}
        >
          <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-muted-foreground border-b border-border/60">
            {contextMenu.ids.length} {contextMenu.ids.length > 1 ? "mails" : "mail"}
          </div>
          <button
            className="w-full text-left px-3 py-1.5 text-[12px] text-foreground hover:bg-foreground/[0.06] flex items-center gap-2"
            onClick={() => handleBulkRestore(contextMenu.ids)}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {t("junk.restore")}
          </button>
          <button
            className="w-full text-left px-3 py-1.5 text-[12px] text-amber-300 hover:bg-amber-500/[0.10] flex items-center gap-2"
            onClick={() => handleBulkBlock(contextMenu.ids)}
            disabled={blockSender.isPending}
          >
            <ShieldX className="w-3.5 h-3.5" />
            {t("junk.blockSender")}
          </button>
          <div className="my-1 border-t border-border/60" />
          <button
            className="w-full text-left px-3 py-1.5 text-[12px] text-red-400 hover:bg-red-500/[0.10] flex items-center gap-2"
            onClick={() => handleBulkDelete(contextMenu.ids)}
          >
            <Trash2 className="w-3.5 h-3.5" />
            {t("junk.permanentDelete")}
          </button>
        </div>
      )}

      <AlertDialog open={emptyConfirmOpen} onOpenChange={setEmptyConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("junk.emptyConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("junk.emptyConfirmBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleEmpty} className="bg-red-500 hover:bg-red-500/90">
              {emptySpam.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : t("junk.empty")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
