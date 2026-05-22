import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useEnableLightTheme } from "@/lib/inbox-theme";
import { EmailBodyRenderer } from "@/components/EmailBodyRenderer";
import {
  useListEmails,
  useRestoreEmail,
  usePermanentDeleteEmail,
  useEmptyTrash,
  getListEmailsQueryKey,
  getGetCategoryCountsQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetInboxHealthQueryKey,
} from "@workspace/api-client-react";
import type { Email, PaginatedEmails } from "@workspace/api-client-react";
import { format } from "date-fns";
import { fr, enUS, nl, de, es, it, pt, pl, ro, sv, da, fi, hu, cs, tr, ja, ko, vi, th, id, ms, el } from "date-fns/locale";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useEffect, useRef } from "react";
import { ArrowLeft, RotateCcw, Trash2, Clock, Loader2, Inbox, Download, Check } from "lucide-react";
import { useAuth } from "@/lib/auth";
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

export default function Corbeille() {
  useEnableLightTheme();
  const { t, i18n } = useTranslation();
  const dateFnsLocale = ({fr,en:enUS,nl,de,es,it,pt,pl}[(i18n.resolvedLanguage || i18n.language || "fr").substring(0,2)] || fr);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { session } = useAuth();
  const [selectedEmailId, setSelectedEmailId] = useState<number | null>(null);
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
      if (!res.ok) throw new Error(j.error || `Échec (HTTP ${res.status})`);
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

  const { data, isLoading } = useListEmails({ status: "trashed", limit: 200, page: 1 }, { query: { placeholderData: (prev: any) => prev } as any });
  const paged = data as PaginatedEmails | undefined;
  const emails = useMemo(() => (paged?.emails || []) as Email[], [paged]);

  const restore = useRestoreEmail();
  const permDelete = usePermanentDeleteEmail();
  const emptyTrash = useEmptyTrash();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListEmailsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetCategoryCountsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetInboxHealthQueryKey() });
  };

  const handleRestore = (id: number) => {
    restore.mutate({ id }, {
      onSuccess: () => {
        if (selectedEmailId === id) setSelectedEmailId(null);
        invalidate();
        toast({ title: t("trash.restored") });
      },
      onError: () => toast({ title: t("common.error"), variant: "destructive" }),
    });
  };

  const handleDelete = (id: number) => {
    permDelete.mutate({ id }, {
      onSuccess: () => {
        if (selectedEmailId === id) setSelectedEmailId(null);
        invalidate();
        toast({ title: t("trash.deleted") });
      },
      onError: () => toast({ title: t("common.error"), variant: "destructive" }),
    });
  };

  const handleEmpty = () => {
    emptyTrash.mutate(undefined, {
      onSuccess: () => {
        setSelectedEmailId(null);
        invalidate();
        toast({ title: t("trash.emptied") });
      },
      onError: () => toast({ title: t("common.error"), variant: "destructive" }),
    });
    setEmptyConfirmOpen(false);
  };

  const selectedEmail = emails.find((e) => e.id === selectedEmailId);

  // Sélection multiple par drag souris + menu contextuel clic droit.
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; ids: number[] } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const listContainerRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);
  const didDragRef = useRef(false);
  const dragStartIdRef = useRef<number | null>(null);
  const dragStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const preSelectRef = useRef<Set<number>>(new Set());
  const anchorWasSelectedRef = useRef<boolean>(false);
  // Optims drag-select : snapshot ids 1× au mousedown (Map id→index O(1)),
  // throttle rAF du mousemove, skip si hover id inchangé.
  const dragIdsSnapshotRef = useRef<number[]>([]);
  const dragIdIndexRef = useRef<Map<number, number>>(new Map());
  const moveRaf = useRef<number>(0);
  const lastMouseXRef = useRef(0);
  const lastMouseYRef = useRef(0);
  const lastHoverIdRef = useRef<number | null>(null);

  const getRowIdFromPoint = (y: number, x: number): number | null => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    if (!el) return null;
    const row = el.closest("[data-row-id]");
    if (!row) return null;
    const id = Number((row as HTMLElement).dataset.rowId);
    return Number.isFinite(id) ? id : null;
  };

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

  const handleBulkRestore = (ids: number[]) => {
    for (const id of ids) {
      restore.mutate({ id }, {
        onSuccess: () => { invalidate(); },
        onError: () => toast({ title: t("common.error"), variant: "destructive" }),
      });
    }
    setSelectedIds(new Set());
    setContextMenu(null);
    toast({ title: t("trash.restored"), description: `${ids.length} mail(s)` });
  };

  const handleBulkDelete = (ids: number[]) => {
    for (const id of ids) {
      permDelete.mutate({ id }, {
        onSuccess: () => { invalidate(); },
        onError: () => toast({ title: t("common.error"), variant: "destructive" }),
      });
    }
    setSelectedIds(new Set());
    setContextMenu(null);
    toast({ title: t("trash.deleted"), description: `${ids.length} mail(s)` });
  };

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
              className="h-7 px-2 text-[#b8c5d6] hover:text-white hover:bg-white/[0.06] text-[12px]"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              {t("trash.title")}
            </Button>
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
                {t("trash.restore")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-7 text-[11px] bg-transparent border-border text-red-400/80 hover:text-red-400 hover:bg-red-500/[0.08]"
                onClick={() => handleDelete(selectedEmail.id)}
              >
                <Trash2 className="w-3 h-3" />
                {t("trash.permanentDelete")}
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
              className="h-7 px-2 text-[#b8c5d6] hover:text-white hover:bg-white/[0.06] text-[12px]"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              {t("common.back", "Retour")}
            </Button>
          </Link>
        </div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-baseline gap-3">
            <h1 className="text-[18px] font-semibold text-white">{t("trash.title")}</h1>
            <span className="text-[12px] text-[#b8c5d6]">
              {t("trash.count", { count: emails.length })}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[11px] bg-transparent border-border text-red-400/80 hover:text-red-400 hover:bg-red-500/[0.08]"
            onClick={() => setEmptyConfirmOpen(true)}
            disabled={emails.length === 0 || emptyTrash.isPending}
          >
            <Trash2 className="w-3 h-3 mr-1" />
            {t("trash.empty")}
          </Button>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 rounded-lg border border-border border-dashed bg-card/50">
            <Loader2 className="w-6 h-6 text-primary animate-spin mb-3" />
            <h3 className="text-[13px] font-medium text-white">{t("inbox.loadingTitle", "Chargement…")}</h3>
          </div>
        ) : emails.length === 0 ? (
          <div className="text-center py-16 rounded-lg border border-border border-dashed bg-card/50">
            <Inbox className="mx-auto h-8 w-8 text-[#b8c5d6]/40 mb-2" />
            <p className="text-[12px] text-[#b8c5d6]">{t("trash.noEmails")}</p>
          </div>
        ) : (
          <>
            <div ref={listContainerRef}>
              <VirtualizedMailList
                items={emails}
                keyExtractor={(e: any) => e.id}
                renderRow={(email: any) => {
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
                      // On arme le drag mais on NE sélectionne PAS encore :
                      // tant qu'aucun mouvement n'est détecté, c'est un clic
                      // simple qui doit ouvrir le mail. La sélection ne
                      // démarre qu'au 1er mousemove (seuil 5px).
                      isDraggingRef.current = true;
                      didDragRef.current = false;
                      dragStartIdRef.current = email.id;
                      dragStartPosRef.current = { x: e.clientX, y: e.clientY };
                      lastHoverIdRef.current = null;
                      anchorWasSelectedRef.current = selectedIds.has(email.id);
                      const additive = e.metaKey || e.ctrlKey || e.shiftKey;
                      preSelectRef.current = additive ? new Set(selectedIds) : new Set<number>();
                      // Snapshot ordre courant des ids visibles (depuis le DOM).
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
                    onClick={(e) => {
                      // Pas d'ouverture si on vient juste de drag-sélectionner.
                      if (didDragRef.current) return;
                      // Cmd/Ctrl/Shift + clic = toggle dans la sélection
                      if (e.metaKey || e.ctrlKey || e.shiftKey) {
                        e.preventDefault();
                        const next = new Set(selectedIds);
                        if (next.has(email.id)) next.delete(email.id);
                        else next.add(email.id);
                        setSelectedIds(next);
                        return;
                      }
                      // Clic simple = ouvre le mail (et vide la sélection)
                      if (selectedIds.size > 0) setSelectedIds(new Set());
                      setSelectedEmailId(email.id);
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      // Si on clique droit sur une ligne non sélectionnée,
                      // on bascule la sélection sur cette ligne uniquement.
                      const targetIds = selectedIds.has(email.id)
                        ? Array.from(selectedIds)
                        : [email.id];
                      if (!selectedIds.has(email.id)) {
                        setSelectedIds(new Set([email.id]));
                      }
                      setContextMenu({ x: e.clientX, y: e.clientY, ids: targetIds });
                    }}
                  >
                    {/* Case à cocher — visible en mode sélection ou si la ligne est sélectionnée */}
                    {(selectedIds.size > 0 || isSelected) ? (
                      <div
                        className="w-4 h-4 rounded flex items-center justify-center transition-all cursor-pointer border border-[#2a3441] hover:border-primary shrink-0"
                      >
                        {isSelected && <Check className="w-3 h-3 text-primary" />}
                      </div>
                    ) : (
                      <div className="w-4 shrink-0" />
                    )}
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
                      title={t("trash.restore")}
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(email.id); }}
                      className="shrink-0 p-1.5 rounded text-[#6b7480] hover:text-red-400 hover:bg-red-500/10"
                      title={t("trash.permanentDelete")}
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

      {/* Menu contextuel clic droit */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 min-w-[200px] rounded-md border border-[#1f2630] bg-[#0d1218] shadow-2xl py-1 text-[12px]"
          style={{
            left: Math.min(contextMenu.x, window.innerWidth - 220),
            top: Math.min(contextMenu.y, window.innerHeight - 100),
          }}
        >
          <button
            type="button"
            onClick={() => handleBulkRestore(contextMenu.ids)}
            className="w-full text-left px-3 py-2 flex items-center gap-2 text-[#e6e9ef] hover:bg-white/[0.05]"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#b8c5d6]" />
            {t("trash.restore")}
            {contextMenu.ids.length > 1 && (
              <span className="ml-auto text-[10px] text-[#8b95a7]">{contextMenu.ids.length}</span>
            )}
          </button>
          <button
            type="button"
            onClick={() => handleBulkDelete(contextMenu.ids)}
            className="w-full text-left px-3 py-2 flex items-center gap-2 text-red-400 hover:bg-red-500/[0.08]"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {t("trash.permanentDelete")}
            {contextMenu.ids.length > 1 && (
              <span className="ml-auto text-[10px] text-red-400/70">{contextMenu.ids.length}</span>
            )}
          </button>
        </div>
      )}

      <AlertDialog open={emptyConfirmOpen} onOpenChange={setEmptyConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("trash.emptyConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("trash.emptyConfirmBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleEmpty} className="bg-red-500 hover:bg-red-500/90">
              {emptyTrash.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : t("trash.empty")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
