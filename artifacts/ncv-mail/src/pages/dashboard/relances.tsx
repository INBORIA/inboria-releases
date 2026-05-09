import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { BackToInboxButton } from "@/components/dashboard/back-to-inbox-button";
import { useToast } from "@/hooks/use-toast";
import {
  useListFollowups,
  useUpdateFollowup,
  useDismissFollowup,
  useGenerateFollowUpDraft,
  getListFollowupsQueryKey,
  getGetFollowupStatsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Sparkles, MailCheck, X, CheckCircle2, Clock, Loader2, Inbox, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useState, useRef, useEffect, useCallback } from "react";
import { useEnableLightTheme } from "@/lib/inbox-theme";

function daysSince(iso: string | null | undefined): number {
  if (!iso) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
}

export default function Relances() {
  useEnableLightTheme();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: aiSuggestions, isLoading: loadingAi } = useListFollowups({ kind: "ai" });

  const updateMut = useUpdateFollowup();
  const dismissMut = useDismissFollowup();
  const draftMut = useGenerateFollowUpDraft();

  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<"draft" | "replied" | "dismiss" | null>(null);

  // Sélection multiple + menu contextuel — pattern Tâches
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; rowId: string } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const selectionMode = selectedIds.size > 0;

  const aiList = (aiSuggestions as any[]) || [];

  // Fermeture menu contextuel au clic extérieur
  useEffect(() => {
    if (!contextMenu) return;
    const handler = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [contextMenu]);

  // Échap = vider sélection
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

  // Clic extérieur = vider sélection
  useEffect(() => {
    if (selectedIds.size === 0) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.closest("[data-followup-row]") ||
        target.closest("[data-selection-bar]") ||
        target.closest("[data-context-menu]")
      ) return;
      setSelectedIds(new Set());
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [selectedIds.size]);

  // Drag-select
  const isDraggingRef = useRef(false);
  const didDragRef = useRef(false);
  const dragStartIdRef = useRef<string | null>(null);
  const preSelectRef = useRef<Set<string>>(new Set());
  const autoScrollRaf = useRef<number>(0);
  const lastMouseYRef = useRef(0);

  const getRowIdFromPoint = useCallback((y: number, x: number): string | null => {
    const el = document.elementFromPoint(x, y);
    if (!el) return null;
    const row = (el as HTMLElement).closest?.("[data-row-id]");
    if (!row) return null;
    return row.getAttribute("data-row-id");
  }, []);

  const selectRange = useCallback((currentId: string) => {
    const rows = Array.from(document.querySelectorAll("[data-followup-row][data-row-id]"));
    const ids = rows.map((r) => r.getAttribute("data-row-id")!);
    const startIdx = ids.indexOf(dragStartIdRef.current!);
    const endIdx = ids.indexOf(currentId);
    if (startIdx === -1 || endIdx === -1) return;
    const keep = new Set(preSelectRef.current);
    if (startIdx !== endIdx) {
      const lo = Math.min(startIdx, endIdx);
      const hi = Math.max(startIdx, endIdx);
      for (let i = lo; i <= hi; i++) keep.add(ids[i]);
    }
    setSelectedIds(keep);
  }, []);

  useEffect(() => {
    const threshold = 60;
    const speed = 14;
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      lastMouseYRef.current = e.clientY;
      if (!didDragRef.current) didDragRef.current = true;
      const hoverId = getRowIdFromPoint(e.clientY, e.clientX);
      if (hoverId !== null) selectRange(hoverId);
      cancelAnimationFrame(autoScrollRaf.current);
      const scroll = () => {
        if (!isDraggingRef.current) return;
        const y = lastMouseYRef.current;
        if (y > window.innerHeight - threshold) {
          window.scrollBy(0, speed);
          const id = getRowIdFromPoint(y, window.innerWidth / 2);
          if (id !== null) selectRange(id);
          autoScrollRaf.current = requestAnimationFrame(scroll);
        } else if (y < threshold) {
          window.scrollBy(0, -speed);
          const id = getRowIdFromPoint(y, window.innerWidth / 2);
          if (id !== null) selectRange(id);
          autoScrollRaf.current = requestAnimationFrame(scroll);
        }
      };
      scroll();
    };
    document.addEventListener("mousemove", handleMouseMove);
    return () => { document.removeEventListener("mousemove", handleMouseMove); cancelAnimationFrame(autoScrollRaf.current); };
  }, [getRowIdFromPoint, selectRange]);

  const handleDragSelectStart = useCallback((id: string) => {
    isDraggingRef.current = true;
    didDragRef.current = false;
    dragStartIdRef.current = id;
    setSelectedIds((prev) => { preSelectRef.current = new Set(prev); return prev; });
    const handleMouseUp = () => {
      isDraggingRef.current = false;
      cancelAnimationFrame(autoScrollRaf.current);
      document.removeEventListener("mouseup", handleMouseUp);
    };
    document.addEventListener("mouseup", handleMouseUp);
  }, []);

  const handleRowContextMenu = useCallback((e: React.MouseEvent, rowId: string) => {
    e.preventDefault();
    setSelectedIds((prev) => {
      if (prev.size > 0 && !prev.has(rowId)) return new Set(prev).add(rowId);
      if (prev.size === 0) return new Set([rowId]);
      return prev;
    });
    setContextMenu({ x: e.clientX, y: e.clientY, rowId });
  }, []);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getListFollowupsQueryKey({ kind: "ai" }) });
    queryClient.invalidateQueries({ queryKey: getListFollowupsQueryKey({ kind: "manual" }) });
    queryClient.invalidateQueries({ queryKey: getGetFollowupStatsQueryKey() });
  };

  async function handleDismiss(id: string) {
    setBusyId(id); setBusyAction("dismiss");
    try {
      await dismissMut.mutateAsync({ id });
      toast({ title: t("relances.dismissedToast", "Suggestion ignorée") });
      invalidateAll();
    } catch {
      toast({ variant: "destructive", title: t("common.error") });
    } finally {
      setBusyId(null); setBusyAction(null);
    }
  }

  async function handleMarkReplied(id: string) {
    setBusyId(id); setBusyAction("replied");
    try {
      await updateMut.mutateAsync({ id, data: { status: "termine" } });
      toast({ title: t("relances.markedRepliedToast", "Marquée comme répondu") });
      invalidateAll();
    } catch {
      toast({ variant: "destructive", title: t("common.error") });
    } finally {
      setBusyId(null); setBusyAction(null);
    }
  }

  async function handleCreateDraft(id: string) {
    setBusyId(id); setBusyAction("draft");
    try {
      const result: any = await draftMut.mutateAsync({ data: { followupId: id } });
      sessionStorage.setItem(
        "inboria.compose.prefill",
        JSON.stringify({
          to: result?.to || "",
          subject: result?.subject || "",
          body: result?.draft || "",
          followupId: id,
          savedAt: Date.now(),
        }),
      );
      await updateMut.mutateAsync({ id, data: { status: "relance" } });
      invalidateAll();
      setLocation("/dashboard?compose=1");
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: t("relances.draftErrorTitle", "Échec de la génération"),
        description: err?.message || "",
      });
    } finally {
      setBusyId(null); setBusyAction(null);
    }
  }

  // Actions en lot
  async function handleBulkMarkReplied() {
    const ids = Array.from(selectedIds);
    try {
      await Promise.all(ids.map((id) => updateMut.mutateAsync({ id, data: { status: "termine" } })));
      toast({ title: t("relances.bulkMarkedRepliedToast", "{{count}} marquées comme répondu", { count: ids.length }) });
    } catch {
      toast({ variant: "destructive", title: t("common.error") });
    } finally {
      setSelectedIds(new Set());
      invalidateAll();
    }
  }

  async function handleBulkDismiss() {
    const ids = Array.from(selectedIds);
    try {
      await Promise.all(ids.map((id) => dismissMut.mutateAsync({ id })));
      toast({ title: t("relances.bulkDismissedToast", "{{count}} ignorées", { count: ids.length }) });
    } catch {
      toast({ variant: "destructive", title: t("common.error") });
    } finally {
      setSelectedIds(new Set());
      invalidateAll();
    }
  }

  // Créer la relance n'a de sens qu'à l'unité (ouvre la composition).
  // En lot, on prend le premier sélectionné et on garde les autres en sélection.
  async function handleBulkCreateDraft() {
    const first = Array.from(selectedIds)[0];
    if (first) await handleCreateDraft(first);
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-5 space-y-3">
        <BackToInboxButton />
        <div>
          <h1 className="text-[20px] font-semibold text-foreground flex items-center gap-2">
            <MailCheck className="w-5 h-5 text-primary" />
            {t("relances.pageTitle", "Relances")}
          </h1>
          <p className="text-[12px] text-muted-foreground mt-1">
            {t(
              "relances.pageSubtitle",
              "Inboria détecte les mails que vous avez envoyés et qui sont restés sans réponse. Validez ou ignorez les suggestions.",
            )}
          </p>
        </div>

        <section>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <h2 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {t("relances.suggestionsTitle", "Suggestions Inboria")}
            </h2>
            <span className="text-[11px] text-[#8b95a7]">({aiList.length})</span>
            {selectionMode && (
              <span className="text-[11px] text-[#b8c5d6] ml-2">
                · {t("inbox.selectedCount", { count: selectedIds.size })}
              </span>
            )}
          </div>

          {loadingAi ? (
            <div className="flex flex-col items-center justify-center py-16 rounded-lg border border-[#1f2937] border-dashed bg-white/[0.02]">
              <Loader2 className="w-5 h-5 text-[#8b95a7] animate-spin mb-3" />
              <p className="text-[12px] text-[#b8c5d6]">{t("inbox.loadingTitle", "Chargement…")}</p>
            </div>
          ) : aiList.length === 0 ? (
            <div className="text-center py-20 rounded-lg border border-[#1f2937] border-dashed bg-white/[0.02]">
              <Inbox className="mx-auto h-10 w-10 text-[#3a4150] mb-3" />
              <h3 className="text-[13px] font-medium text-foreground mb-1">
                {t("relances.emptySuggestionsTitle", "Aucune relance à proposer")}
              </h3>
              <p className="text-[12px] text-[#8b95a7]">
                {t(
                  "relances.emptySuggestionsDesc",
                  "Tous vos mails envoyés ont reçu une réponse, ou aucun n'est assez ancien pour être relancé.",
                )}
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-[#1f2937] overflow-hidden bg-white/[0.01]">
              {aiList.map((f: any) => {
                const email = f.emails || {};
                const sentAt = email.created_at || email.createdAt || null;
                const days = daysSince(sentAt);
                const recipient = email.recipient || f.title || "?";
                const initial = recipient.trim().charAt(0).toUpperCase();
                const subject = email.subject || t("relances.noSubject", "(sans objet)");
                const summary = email.summary || "";
                const isBusy = busyId === f.id;
                const isSelected = selectedIds.has(f.id);

                return (
                  <div
                    key={f.id}
                    data-followup-row
                    data-row-id={f.id}
                    title={`${recipient}\n— ${subject}${summary ? `\n${summary}` : ""}`}
                    className={`group relative flex items-center gap-3 h-[52px] pl-2 pr-3 select-none border-l-2 border-b border-[#1f2937] transition-colors cursor-pointer ${
                      isSelected
                        ? "border-l-white/40 bg-white/[0.05]"
                        : "border-l-transparent hover:bg-white/[0.03]"
                    }`}
                    onClick={() => {
                      if (didDragRef.current) return;
                      if (selectionMode) {
                        setSelectedIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(f.id)) next.delete(f.id); else next.add(f.id);
                          return next;
                        });
                      }
                    }}
                    onMouseDown={(e) => { if (e.button === 0) { e.preventDefault(); handleDragSelectStart(f.id); } }}
                    onContextMenu={(e) => handleRowContextMenu(e, f.id)}
                  >
                    {/* Case à cocher (visible si sélection active ou hover ligne) */}
                    <div className="w-4 flex items-center justify-center shrink-0">
                      {selectionMode || isSelected ? (
                        <button
                          className="w-4 h-4 rounded flex items-center justify-center transition-all cursor-pointer border border-[#2a3441] hover:border-white/60"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(f.id)) next.delete(f.id); else next.add(f.id);
                              return next;
                            });
                          }}
                          onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); handleDragSelectStart(f.id); }}
                        >
                          {isSelected && <Check className="w-3 h-3 text-primary" />}
                        </button>
                      ) : (
                        <span className="w-3 h-3" />
                      )}
                    </div>

                    {/* Avatar bleu primary */}
                    <div className="w-7 h-7 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
                      <span className="text-primary text-[11px] font-semibold">{initial}</span>
                    </div>

                    {/* Destinataire + sujet — résumé */}
                    <div className="flex-1 min-w-0 flex items-baseline gap-2 overflow-hidden">
                      <span className="text-[13px] font-medium text-foreground truncate shrink-0 max-w-[180px]">
                        {recipient}
                      </span>
                      <span className="text-[12px] truncate text-[#7a8290]">
                        {subject}{summary ? ` — ${summary}` : ""}
                      </span>
                    </div>

                    {/* Méta hors survol */}
                    <div className="flex items-center gap-2 shrink-0 group-hover:hidden">
                      <span className="inline-flex items-center gap-1 text-[11px] tabular-nums text-[#b8c5d6] whitespace-nowrap">
                        <Clock className="w-2.5 h-2.5 text-[#8b95a7]" />
                        {t("relances.daysWithoutReply", "{{count}} j sans réponse", { count: days })}
                      </span>
                    </div>

                    {/* Actions au survol */}
                    <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleCreateDraft(f.id); }}
                        disabled={isBusy}
                        className="p-1.5 rounded text-primary hover:bg-white/[0.08] disabled:opacity-50 disabled:pointer-events-none"
                        title={t("relances.createDraft", "Créer la relance")}
                      >
                        {isBusy && busyAction === "draft" ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleMarkReplied(f.id); }}
                        disabled={isBusy}
                        className="p-1.5 rounded text-emerald-400 hover:bg-white/[0.08] disabled:opacity-50 disabled:pointer-events-none"
                        title={t("relances.markReplied", "Marquer comme répondu")}
                      >
                        {isBusy && busyAction === "replied" ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDismiss(f.id); }}
                        disabled={isBusy}
                        className="p-1.5 rounded text-[#8b95a7] hover:bg-white/[0.08] hover:text-white disabled:opacity-50 disabled:pointer-events-none"
                        title={t("relances.dismiss", "Ignorer")}
                      >
                        {isBusy && busyAction === "dismiss" ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <X className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Barre de sélection en bas */}
      {selectionMode && (
        <div
          data-selection-bar
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 h-11 rounded-full border border-[#2a3441] bg-[#0f141b] shadow-2xl"
        >
          <span className="text-[11px] text-[#b8c5d6]">
            {t("inbox.selectedCount", { count: selectedIds.size })}
          </span>
          <div className="w-px h-4 bg-[#2a3441]" />
          <button
            onClick={handleBulkCreateDraft}
            className="flex items-center gap-1.5 text-[11px] text-primary hover:opacity-80 transition-opacity"
            title={t("relances.createDraft", "Créer la relance")}
          >
            <Sparkles className="w-3 h-3" />
            {t("relances.createDraft", "Créer la relance")}
          </button>
          <button
            onClick={handleBulkMarkReplied}
            className="flex items-center gap-1.5 text-[11px] text-emerald-400 hover:opacity-80 transition-opacity"
          >
            <CheckCircle2 className="w-3 h-3" />
            {t("relances.markReplied", "Marquer comme répondu")}
          </button>
          <button
            onClick={handleBulkDismiss}
            className="flex items-center gap-1.5 text-[11px] text-[#b8c5d6] hover:text-white transition-colors"
          >
            <X className="w-3 h-3" />
            {t("relances.dismiss", "Ignorer")}
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-[11px] text-[#8b95a7] hover:text-white transition-colors ml-2"
          >
            {t("common.cancel")}
          </button>
        </div>
      )}

      {/* Menu contextuel */}
      {contextMenu && (() => {
        const ctxRow = aiList.find((f: any) => f.id === contextMenu.rowId);
        const multi = selectedIds.size > 1;
        const recipient = ctxRow?.emails?.recipient || ctxRow?.title || "";
        return (
          <div
            ref={contextMenuRef}
            data-context-menu
            className="fixed z-[9999] min-w-[220px] rounded-lg border border-[#2a3441] bg-[#0f141b] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100"
            style={{
              top: Math.min(contextMenu.y, window.innerHeight - 200),
              left: Math.min(contextMenu.x, window.innerWidth - 240),
            }}
          >
            <div className="px-3 py-2 border-b border-[#1f2937]">
              <span className="text-[10px] text-[#6b7280] uppercase tracking-wider font-medium">
                {multi
                  ? t("inbox.selectedCount", { count: selectedIds.size })
                  : recipient.substring(0, 30) + (recipient.length > 30 ? "…" : "")
                }
              </span>
            </div>
            <div className="py-1">
              {!multi && (
                <button
                  onClick={() => {
                    if (ctxRow) handleCreateDraft(ctxRow.id);
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#b8c5d6] hover:bg-white/[0.06] hover:text-white transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  {t("relances.createDraft", "Créer la relance")}
                </button>
              )}
              <button
                onClick={() => {
                  if (multi) handleBulkMarkReplied();
                  else if (ctxRow) handleMarkReplied(ctxRow.id);
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#b8c5d6] hover:bg-white/[0.06] hover:text-white transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                {t("relances.markReplied", "Marquer comme répondu")}
                {multi && ` (${selectedIds.size})`}
              </button>
              <div className="border-t border-[#1f2937] my-1" />
              <button
                onClick={() => {
                  if (multi) handleBulkDismiss();
                  else if (ctxRow) handleDismiss(ctxRow.id);
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#b8c5d6] hover:bg-white/[0.06] hover:text-white transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                {t("relances.dismiss", "Ignorer")}
                {multi && ` (${selectedIds.size})`}
              </button>
            </div>
          </div>
        );
      })()}
    </DashboardLayout>
  );
}
