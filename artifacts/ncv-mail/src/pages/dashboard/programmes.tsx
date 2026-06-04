import { useState, useEffect, useLayoutEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { CalendarClock, Trash2, Eye, Loader2, X, Check, Clock, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BackToInboxButton } from "@/components/dashboard/back-to-inbox-button";
import {
  useListScheduledEmails,
  useCancelScheduledEmail,
  getListScheduledEmailsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { MailPageHeader } from "@/components/email-list/MailPageHeader";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useEnableLightTheme } from "@/lib/inbox-theme";
import DOMPurify from "dompurify";

function looksLikeHtml(s: string): boolean {
  return /<\/?[a-z][\s\S]*>|&[a-z#0-9]+;/i.test(s);
}

function plainExcerpt(body: string): string {
  return String(body || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

export default function Programmes() {
  useEnableLightTheme();
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useListScheduledEmails();
  const [headerSearch, setHeaderSearch] = useState("");
  const cancelMut = useCancelScheduledEmail();
  const fmt = new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeStyle: "short" });
  const fmtCompact = new Intl.DateTimeFormat(i18n.language, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const [openId, setOpenId] = useState<number | null>(null);

  // Sélection multiple + menu contextuel — parité avec Reportés / Envoyés.
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; emailId: number } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const [ctxMenuPos, setCtxMenuPos] = useState<{ top: number; left: number; ready: boolean }>({ top: 0, left: 0, ready: false });
  const selectionMode = selectedIds.size > 0;

  const allScheduled = (data as any)?.emails || [];
  const emails = (() => {
    const q = headerSearch.trim().toLowerCase();
    if (!q) return allScheduled;
    return allScheduled.filter((e: any) => {
      const subject = String(e.subject ?? "").toLowerCase();
      const recipient = String(e.recipient ?? "").toLowerCase();
      const body = String(e.body ?? "").toLowerCase();
      return subject.includes(q) || recipient.includes(q) || body.includes(q);
    });
  })();
  const openedEmail = emails.find((e: any) => e.id === openId) || null;

  // Auto-flip du menu contextuel (mesure réelle après render, bornes 8px).
  useLayoutEffect(() => {
    if (!contextMenu) { setCtxMenuPos({ top: 0, left: 0, ready: false }); return; }
    const el = contextMenuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const margin = 8;
    let top = contextMenu.y;
    let left = contextMenu.x;
    if (top + rect.height > window.innerHeight - margin) top = Math.max(margin, contextMenu.y - rect.height);
    if (top < margin) top = margin;
    if (left + rect.width > window.innerWidth - margin) left = Math.max(margin, contextMenu.x - rect.width);
    if (left < margin) left = margin;
    setCtxMenuPos({ top, left, ready: true });
  }, [contextMenu]);

  useEffect(() => {
    if (!contextMenu) return;
    const handler = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) setContextMenu(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [contextMenu]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") setSelectedIds(new Set()); };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (selectedIds.size === 0) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-email-row]") || target.closest("[data-selection-bar]") || target.closest("[data-context-menu]")) return;
      setSelectedIds(new Set());
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [selectedIds.size > 0]);

  // Glisser pour sélectionner.
  const isDraggingRef = useRef(false);
  const didDragRef = useRef(false);
  const dragTrailRef = useRef<number[]>([]);
  const preSelectRef = useRef<Set<number>>(new Set());

  const handleDragSelectStart = useCallback((id: number) => {
    isDraggingRef.current = true;
    didDragRef.current = false;
    dragTrailRef.current = [id];
    setSelectedIds((prev) => { preSelectRef.current = new Set(prev); return prev; });
    const handleMouseUp = () => { isDraggingRef.current = false; dragTrailRef.current = []; document.removeEventListener("mouseup", handleMouseUp); };
    document.addEventListener("mouseup", handleMouseUp);
  }, []);

  const handleDragSelectEnter = useCallback((id: number) => {
    if (!isDraggingRef.current) return;
    if (!didDragRef.current) didDragRef.current = true;
    const trail = dragTrailRef.current;
    const idx = trail.indexOf(id);
    if (idx !== -1) {
      if (idx === 0) trail.length = 0;
      else trail.splice(idx + 1);
    } else {
      trail.push(id);
    }
    const keep = new Set(preSelectRef.current);
    trail.forEach((tid) => keep.add(tid));
    setSelectedIds(keep);
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent, emailId: number) => {
    e.preventDefault();
    setSelectedIds((prev) => {
      if (prev.size > 0 && !prev.has(emailId)) return new Set(prev).add(emailId);
      if (prev.size === 0) return new Set([emailId]);
      return prev;
    });
    setContextMenu({ x: e.clientX, y: e.clientY, emailId });
  }, []);

  const handleCancel = (id: number) => {
    cancelMut.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: t("wave1.scheduledCancelSuccess") });
          qc.invalidateQueries({ queryKey: getListScheduledEmailsQueryKey() });
          if (openId === id) setOpenId(null);
        },
        onError: (e: any) => {
          toast({ variant: "destructive", title: e?.message || "Cancel failed" });
        },
      }
    );
  };

  const handleBulkCancel = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (ids.includes(openId as number)) setOpenId(null);
    setSelectedIds(new Set());
    const results = await Promise.allSettled(ids.map((id) => cancelMut.mutateAsync({ id })));
    qc.invalidateQueries({ queryKey: getListScheduledEmailsQueryKey() });
    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed === 0) {
      toast({ title: t("wave1.scheduledCancelSuccess") });
    } else if (failed === ids.length) {
      toast({ variant: "destructive", title: t("wave1.scheduledCancelError", "Échec de l'annulation") });
    } else {
      toast({
        variant: "destructive",
        title: t("wave1.scheduledCancelPartial", {
          defaultValue: "{{failed}} annulation(s) sur {{total}} ont échoué",
          failed,
          total: ids.length,
        }),
      });
    }
  };

  return (
    <DashboardLayout>
      <MailPageHeader
        currentTab="programmes"
        searchValue={headerSearch}
        onSearchChange={setHeaderSearch}
        showReadingPaneToggle={false}
        showHeaderCollapseToggle={false}
      />
      <div className="max-w-[1600px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-5 space-y-6">
        <BackToInboxButton />
        <section>
          <div className="flex items-center gap-2 mb-3">
            <CalendarClock className="w-5 h-5 text-[color:var(--mail-text-meta,#b8c5d6)]" />
            <h1 className="text-[16px] font-semibold text-foreground">
              {t("wave1.scheduledPageTitle", "Envois programmés")}
            </h1>
            {emails.length > 0 && (
              <span className="text-[11px] text-[color:var(--mail-text-meta,#b8c5d6)]">({emails.length})</span>
            )}
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 border border-border border-dashed rounded-md bg-card/50">
              <Loader2 className="w-5 h-5 text-[color:var(--mail-text-meta,#b8c5d6)] animate-spin mb-2" />
              <p className="text-[12px] text-[color:var(--mail-text-meta,#b8c5d6)]">{t("inbox.loadingTitle", "Chargement…")}</p>
            </div>
          ) : emails.length === 0 ? (
            <div className="text-center py-8 border border-border rounded-md bg-card">
              <CalendarClock className="w-7 h-7 mx-auto text-[color:var(--mail-text-meta,#b8c5d6)] mb-2 opacity-50" />
              <p className="text-[13px] text-foreground font-medium">
                {t("wave1.scheduledPageEmpty", "Aucun envoi programmé")}
              </p>
              <p className="text-[12px] text-[color:var(--mail-text-meta,#b8c5d6)] mt-1">
                {t(
                  "wave1.scheduledPageEmptyHint",
                  "Utilisez « Programmer » dans le composer pour planifier un envoi à une date/heure précise."
                )}
              </p>
            </div>
          ) : (
            <div className="space-y-1 rounded-md overflow-hidden border border-[color:var(--mail-border)]">
              {emails.map((e: any) => {
                const isSelected = selectedIds.has(e.id);
                const sendAtStr = e.scheduledSendAt ? fmtCompact.format(new Date(e.scheduledSendAt)) : "";
                const excerpt = plainExcerpt(e.body);
                const tooltip = `${e.recipient || ""}\n${e.subject || "(sans sujet)"}\n${
                  e.scheduledSendAt ? fmt.format(new Date(e.scheduledSendAt)) : ""
                }`;
                return (
                  <div
                    key={e.id}
                    data-email-row
                    data-testid={`scheduled-email-${e.id}`}
                    title={tooltip}
                    className={`group relative flex items-center gap-3 h-[52px] pl-2 pr-3 cursor-pointer select-none border-l-2 border-b border-[color:var(--mail-border)] hover:border-b-[color:var(--mail-border-hover)] transition-colors ${
                      isSelected ? "border-l-primary bg-primary/[0.10]" : "border-l-transparent hover:bg-white/[0.03]"
                    }`}
                    onClick={() => {
                      if (didDragRef.current) return;
                      if (selectionMode) {
                        setSelectedIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(e.id)) next.delete(e.id); else next.add(e.id);
                          return next;
                        });
                      } else {
                        setOpenId(e.id);
                      }
                    }}
                    onMouseDown={(ev) => {
                      if ((ev.target as HTMLElement).closest('button,[role="button"],a,input,textarea,select')) return;
                      if (ev.button === 0) { ev.preventDefault(); handleDragSelectStart(e.id); }
                    }}
                    onMouseEnter={() => handleDragSelectEnter(e.id)}
                    onContextMenu={(ev) => handleContextMenu(ev, e.id)}
                  >
                    {/* Case à cocher */}
                    <div className="w-4 flex items-center justify-center shrink-0">
                      {selectionMode || isSelected ? (
                        <button
                          onClick={(ev) => { ev.stopPropagation(); setSelectedIds((prev) => { const next = new Set(prev); if (next.has(e.id)) next.delete(e.id); else next.add(e.id); return next; }); }}
                          onMouseDown={(ev) => { ev.stopPropagation(); ev.preventDefault(); handleDragSelectStart(e.id); }}
                          className="w-4 h-4 rounded flex items-center justify-center transition-all cursor-pointer border border-[#2a3441] hover:border-primary"
                        >
                          {isSelected && <Check className="w-3 h-3 text-primary" />}
                        </button>
                      ) : (
                        <span
                          className="w-3 h-3 cursor-pointer"
                          onClick={(ev) => { ev.stopPropagation(); setSelectedIds((prev) => { const next = new Set(prev); next.add(e.id); return next; }); }}
                        />
                      )}
                    </div>

                    {/* Avatar — première lettre du destinataire */}
                    <div className="w-7 h-7 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
                      <span className="text-primary text-[11px] font-semibold">
                        {(e.recipient || "?").trim()[0]?.toUpperCase() || "?"}
                      </span>
                    </div>

                    {/* Destinataire (largeur fixe) */}
                    <div className="w-[140px] shrink-0 flex items-center gap-1.5 min-w-0">
                      <span className="text-[13px] truncate text-foreground font-semibold">
                        {e.recipient || t("wave1.scheduledNoRecipient", "Sans destinataire")}
                      </span>
                    </div>

                    {/* Sujet + extrait */}
                    <div className="flex-1 min-w-0 flex items-baseline gap-2 overflow-hidden">
                      <span className="text-[13px] truncate text-foreground font-semibold">
                        {e.subject || "(sans sujet)"}
                      </span>
                      {excerpt && (
                        <span className="text-[13px] truncate text-[color:var(--mail-text-muted,#8b95a7)]">— {excerpt}</span>
                      )}
                    </div>

                    {/* Date d'envoi programmée */}
                    <div className="flex items-center gap-2 shrink-0 group-hover:hidden">
                      <Clock className="w-3 h-3 text-primary/70" />
                      <span className="text-[11px] tabular-nums text-primary/80 w-24 text-right whitespace-nowrap hidden sm:inline">
                        {sendAtStr}
                      </span>
                    </div>

                    {/* Actions au survol — Voir / Annuler */}
                    <div className="hidden group-hover:flex items-center gap-1 shrink-0">
                      <button
                        onClick={(ev) => { ev.stopPropagation(); setOpenId(e.id); }}
                        className="h-7 px-2 flex items-center gap-1 rounded text-[11px] text-[color:var(--mail-text-meta,#b8c5d6)] hover:text-foreground hover:bg-white/[0.06] transition-colors"
                        data-testid={`scheduled-open-${e.id}`}
                        title={t("wave1.scheduledShow", "Voir l'email")}
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(ev) => { ev.stopPropagation(); handleCancel(e.id); }}
                        disabled={cancelMut.isPending}
                        className="h-7 px-2 flex items-center gap-1 rounded text-[11px] text-red-400/80 hover:text-red-400 hover:bg-red-500/[0.08] transition-colors disabled:opacity-50"
                        data-testid={`scheduled-cancel-${e.id}`}
                        title={t("wave1.scheduledCancel")}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Barre de sélection multiple */}
      {selectionMode && (
        <div data-selection-bar className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-card border border-border rounded-lg shadow-2xl px-4 py-2 flex items-center gap-3">
          <span className="text-[11px] text-foreground">{t("inbox.selectedCount", { count: selectedIds.size })}</span>
          <button onClick={handleBulkCancel} className="flex items-center gap-1.5 text-[11px] text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 transition-colors">
            <Trash2 className="w-3 h-3" />{t("wave1.scheduledCancel")}
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="text-[11px] text-foreground/70 hover:text-foreground transition-colors ml-2">{t("common.cancel")}</button>
        </div>
      )}

      {/* Menu contextuel (clic droit) */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          data-context-menu
          className="fixed z-[9999] min-w-[220px] max-w-[280px] rounded-lg border border-[#1f2937] bg-[#141c2b] shadow-2xl overflow-y-auto animate-in fade-in zoom-in-95 duration-100"
          style={{
            top: ctxMenuPos.ready ? ctxMenuPos.top : contextMenu.y,
            left: ctxMenuPos.ready ? ctxMenuPos.left : contextMenu.x,
            maxHeight: `calc(100vh - 16px)`,
            opacity: ctxMenuPos.ready ? 1 : 0,
          }}
        >
          <div className="px-3 py-2 border-b border-[#1f2937]">
            <span className="text-[10px] text-[#b8c5d6] uppercase tracking-wider font-medium">
              {selectedIds.size > 1
                ? t("inbox.selectedCount", { count: selectedIds.size })
                : (emails.find((e: any) => e.id === contextMenu.emailId)?.subject?.substring(0, 30) || "") + "…"}
            </span>
          </div>
          <div className="py-1">
            {selectedIds.size <= 1 && (
              <button
                onClick={() => { setOpenId(contextMenu.emailId); setContextMenu(null); setSelectedIds(new Set()); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#b8c5d6] hover:bg-white/[0.06] hover:text-white transition-colors"
              >
                <ChevronRight className="w-3.5 h-3.5" />
                {t("wave1.scheduledShow", "Voir l'email")}
              </button>
            )}
            <div className="border-t border-[#1f2937] my-1" />
            <button
              onClick={() => { if (selectedIds.size > 1) handleBulkCancel(); else handleCancel(contextMenu.emailId); setContextMenu(null); setSelectedIds(new Set()); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-red-400/80 hover:bg-red-500/[0.08] hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {t("wave1.scheduledCancel")}
              {selectedIds.size > 1 && ` (${selectedIds.size})`}
            </button>
          </div>
        </div>
      )}

      <Dialog open={!!openedEmail} onOpenChange={(o) => !o && setOpenId(null)}>
        <DialogContent
          aria-describedby={undefined}
          className="bg-card border-border w-[95vw] sm:max-w-2xl p-0 flex flex-col max-h-[85vh]"
        >
          {openedEmail && (
            <>
              <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border">
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-semibold text-foreground truncate">
                    {openedEmail.subject || "(sans sujet)"}
                  </div>
                  <div className="text-[12px] text-[color:var(--mail-text-meta,#b8c5d6)] mt-1 truncate">
                    → {openedEmail.recipient}
                  </div>
                  <div className="text-[11px] text-[color:var(--mail-text-meta,#b8c5d6)] mt-1 flex items-center gap-1">
                    <CalendarClock className="w-3 h-3" />
                    {t("wave1.scheduledSentAt", {
                      date: fmt.format(new Date(openedEmail.scheduledSendAt)),
                    })}
                  </div>
                </div>
                <button
                  onClick={() => setOpenId(null)}
                  className="text-[color:var(--mail-text-meta,#b8c5d6)] hover:text-foreground shrink-0"
                  aria-label="Fermer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="px-5 py-4 overflow-y-auto">
                {openedEmail.body ? (
                  looksLikeHtml(openedEmail.body) ? (
                    <div
                      className="text-[13px] text-foreground break-words ncv-email-html"
                      data-testid={`scheduled-body-${openedEmail.id}`}
                      dangerouslySetInnerHTML={{
                        __html: DOMPurify.sanitize(openedEmail.body, {
                          USE_PROFILES: { html: true },
                          FORBID_TAGS: ["script", "style", "iframe", "object", "embed"],
                          FORBID_ATTR: ["onerror", "onload", "onclick"],
                        }),
                      }}
                    />
                  ) : (
                    <div
                      className="text-[13px] text-foreground whitespace-pre-wrap break-words"
                      data-testid={`scheduled-body-${openedEmail.id}`}
                    >
                      {openedEmail.body}
                    </div>
                  )
                ) : (
                  <div
                    className="text-[13px]"
                    data-testid={`scheduled-body-${openedEmail.id}`}
                  >
                    <span className="text-[color:var(--mail-text-meta,#b8c5d6)] italic">
                      {t("wave1.scheduledBodyEmpty", "(corps vide)")}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 px-5 py-3 border-t border-border">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleCancel(openedEmail.id)}
                  disabled={cancelMut.isPending}
                  className="h-8 gap-1 text-[12px] text-[color:var(--mail-text-meta,#b8c5d6)] hover:text-foreground hover:bg-white/[0.06]"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {t("wave1.scheduledCancel")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setOpenId(null)}
                  className="h-8 text-[12px] bg-transparent border-[#1f2937] text-[color:var(--mail-text-meta,#b8c5d6)] hover:text-foreground hover:bg-white/[0.04]"
                >
                  {t("common.close", "Fermer")}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
