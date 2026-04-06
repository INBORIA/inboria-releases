import { useState, useEffect, useRef, useCallback } from "react";
import {
  Inbox, Archive, LayoutDashboard, CheckSquare, FolderKanban, Tags, Settings, CreditCard,
  LogOut, Search, Clock, ChevronRight, Sparkles, Zap, CheckCircle, RefreshCw, Trash2, Check, Square,
} from "lucide-react";

const NAV_ITEMS = [
  { name: "Inbox", icon: Inbox, active: true },
  { name: "Archives", icon: Archive },
  { name: "Bilan quotidien", icon: LayoutDashboard },
  { name: "Tâches", icon: CheckSquare },
  { name: "Projets", icon: FolderKanban },
  { name: "Catégories", icon: Tags },
  { name: "Paramètres", icon: Settings },
  { name: "Abonnement", icon: CreditCard },
];

const DEMO_EMAILS = [
  { sender: "Pierre Martin", subject: "Contrat Q2 — signature requise", summary: "Contrat de prestation Q2 à signer avant vendredi. Montant : 12 400 €.", priority: "urgent" as const, isJunk: false },
  { sender: "Marie Laurent", subject: "Réunion client demain 9h", summary: "Confirmation réunion avec Dupont SA demain à 9h. Ordre du jour joint.", priority: "urgent" as const, isJunk: false },
  { sender: "Sophie Dubois", subject: "Rapport mensuel Mars 2026", summary: "Le rapport comptable de mars est prêt pour validation. CA en hausse de 8%.", priority: "moyen" as const, isJunk: false },
  { sender: "Thomas Bernard", subject: "Devis site web — retour client", summary: "Le client a approuvé le devis de 4 800 €. Demande de démarrage lundi.", priority: "moyen" as const, isJunk: false },
  { sender: "LinkedIn", subject: "3 nouvelles connexions cette semaine", summary: "Nouveaux contacts : Jean Leroy (CEO), Anne Petit (RH), Marc Faure (CTO).", priority: "faible" as const, isJunk: true },
  { sender: "Newsletter Tech", subject: "Les tendances IA en 2026", summary: "Dossier spécial : automatisation email, GPT-5, et l'avenir du SaaS B2B.", priority: "faible" as const, isJunk: true },
];

const EMAIL_COUNT = DEMO_EMAILS.length;
const ARRIVAL_DELAY = 350;
const SORT_START = EMAIL_COUNT * ARRIVAL_DELAY + 1400;
const SORT_INTERVAL = 450;
const SORT_DONE = SORT_START + EMAIL_COUNT * SORT_INTERVAL;
const SELECT_START = SORT_DONE + 1200;
const SELECT_INTERVAL = 500;
const JUNK_COUNT = DEMO_EMAILS.filter((e) => e.isJunk).length;
const DELETE_TIME = SELECT_START + JUNK_COUNT * SELECT_INTERVAL + 800;
const CLEAN_TIME = DELETE_TIME + 1000;
const CYCLE_TIME = CLEAN_TIME + 3500;

type Phase = "inbox" | "sorting" | "done" | "selecting" | "deleting" | "clean";

const PRIORITY_BAR_COLORS = {
  urgent: "bg-red-500",
  moyen: "bg-amber-500",
  faible: "bg-emerald-500",
};

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reduced;
}

export function AnimatedDemo() {
  const reducedMotion = useReducedMotion();
  const [phase, setPhase] = useState<Phase>(reducedMotion ? "clean" : "inbox");
  const [visibleEmails, setVisibleEmails] = useState(reducedMotion ? EMAIL_COUNT : 0);
  const [sortedCount, setSortedCount] = useState(reducedMotion ? EMAIL_COUNT : 0);
  const [selectedJunk, setSelectedJunk] = useState(reducedMotion ? JUNK_COUNT : 0);
  const [deletedJunk, setDeletedJunk] = useState(reducedMotion);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const mountedRef = useRef(true);
  const visibleRef = useRef(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  const runCycle = useCallback(() => {
    if (!mountedRef.current || !visibleRef.current || reducedMotion) return;
    clearTimers();
    setPhase("inbox");
    setVisibleEmails(0);
    setSortedCount(0);
    setSelectedJunk(0);
    setDeletedJunk(false);

    const startTimer = setTimeout(() => {
      if (!mountedRef.current || !visibleRef.current) return;
      const t: ReturnType<typeof setTimeout>[] = [];
      for (let i = 1; i <= EMAIL_COUNT; i++) {
        t.push(setTimeout(() => setVisibleEmails(i), i * ARRIVAL_DELAY));
      }
      t.push(setTimeout(() => setPhase("sorting"), SORT_START));
      for (let i = 1; i <= EMAIL_COUNT; i++) {
        t.push(setTimeout(() => setSortedCount(i), SORT_START + i * SORT_INTERVAL));
      }
      t.push(setTimeout(() => setPhase("done"), SORT_DONE + 500));

      t.push(setTimeout(() => setPhase("selecting"), SELECT_START));
      for (let i = 1; i <= JUNK_COUNT; i++) {
        t.push(setTimeout(() => setSelectedJunk(i), SELECT_START + i * SELECT_INTERVAL));
      }

      t.push(setTimeout(() => {
        setPhase("deleting");
        setDeletedJunk(true);
      }, DELETE_TIME));

      t.push(setTimeout(() => setPhase("clean"), CLEAN_TIME));

      t.push(setTimeout(() => {
        if (mountedRef.current && visibleRef.current) runCycle();
      }, CYCLE_TIME));
      timersRef.current = t;
    }, 500);
    timersRef.current = [startTimer];
  }, [clearTimers, reducedMotion]);

  useEffect(() => {
    mountedRef.current = true;
    if (reducedMotion) {
      setPhase("clean");
      setVisibleEmails(EMAIL_COUNT);
      setSortedCount(EMAIL_COUNT);
      setSelectedJunk(JUNK_COUNT);
      setDeletedJunk(true);
      return;
    }
    const el = containerRef.current;
    if (!el) { runCycle(); return; }
    const observer = new IntersectionObserver(
      ([entry]) => {
        visibleRef.current = entry.isIntersecting;
        if (entry.isIntersecting) runCycle();
        else clearTimers();
      },
      { threshold: 0.2 }
    );
    observer.observe(el);
    return () => { mountedRef.current = false; clearTimers(); observer.disconnect(); };
  }, [runCycle, clearTimers, reducedMotion]);

  const unreadCount = Math.max(0, visibleEmails - sortedCount);
  const isSelectingOrAfter = phase === "selecting" || phase === "deleting" || phase === "clean";
  const isDeleting = phase === "deleting";

  const junkIndices = DEMO_EMAILS.map((e, i) => e.isJunk ? i : -1).filter((i) => i >= 0);
  const junkSelectedSet = new Set(junkIndices.slice(0, selectedJunk));

  const inboxCount = isSelectingOrAfter && deletedJunk
    ? EMAIL_COUNT - JUNK_COUNT
    : phase === "done" || isSelectingOrAfter
    ? 0
    : unreadCount;

  const statusText = phase === "sorting"
    ? `IA en cours de tri — ${sortedCount}/${EMAIL_COUNT} classés`
    : phase === "done"
    ? `Inbox organisée — ${EMAIL_COUNT} emails triés automatiquement`
    : phase === "selecting"
    ? `${selectedJunk} newsletter(s) sélectionnée(s)`
    : phase === "deleting"
    ? `${JUNK_COUNT} email(s) supprimé(s) !`
    : phase === "clean"
    ? `Inbox propre — ${EMAIL_COUNT - JUNK_COUNT} emails importants`
    : `${visibleEmails} email${visibleEmails !== 1 ? "s" : ""} reçu${visibleEmails !== 1 ? "s" : ""}`;

  return (
    <div ref={containerRef} className="relative max-w-5xl mx-auto mt-12" aria-label="Démo animée du dashboard NCV Mail" role="img">
      <span className="sr-only" aria-live="polite" aria-atomic="true">{statusText}</span>
      <div aria-hidden="true" className="rounded-xl border border-[#1f2937] bg-[#0d1117] overflow-hidden shadow-2xl shadow-[#2d7dd2]/8">
        <div className="flex items-center gap-2 px-4 py-2 bg-[#141c2b] border-b border-[#1f2937]">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#ef4444]/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#10b981]/60" />
          </div>
          <div className="flex-1 text-center">
            <span className="text-[11px] text-[#8b9cb3]">NCV Mail — Dashboard</span>
          </div>
        </div>

        <div className="flex min-h-[380px] sm:min-h-[420px]">
          <div className="hidden sm:flex flex-col w-[180px] border-r border-[#1f2937] bg-[#0d1117]">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1f2937]">
              <div className="w-6 h-6 rounded-md bg-[#2d7dd2] flex items-center justify-center">
                <span className="text-[10px] font-bold text-white">N</span>
              </div>
              <span className="text-[12px] font-semibold text-white tracking-tight">NCV Mail</span>
            </div>

            <nav className="flex-1 px-2 py-2 space-y-0.5">
              {NAV_ITEMS.map((item) => (
                <div
                  key={item.name}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[11px] font-medium ${
                    item.active
                      ? "bg-[#1e3a5f] text-[#2d7dd2]"
                      : "text-[#8b9cb3]"
                  }`}
                >
                  <item.icon className={`w-3.5 h-3.5 shrink-0 ${item.active ? "text-[#2d7dd2]" : "text-[#8b9cb3]"}`} />
                  <span className="truncate">{item.name}</span>
                  {item.active && (
                    <span className="ml-auto text-[9px] bg-[#2d7dd2]/20 text-[#2d7dd2] px-1.5 py-0.5 rounded-full font-medium">
                      {inboxCount}
                    </span>
                  )}
                </div>
              ))}
            </nav>

            <div className="p-2 mt-auto border-t border-[#1f2937]">
              <div className="px-2.5 py-2">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[9px] font-medium text-[#8b9cb3] uppercase tracking-wider">Quota</span>
                  <span className="text-[9px] font-medium text-white">24/3000</span>
                </div>
                <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-[#2d7dd2] rounded-full" style={{ width: "1%" }} />
                </div>
              </div>
              <div className="flex items-center gap-2 px-2.5 py-1.5">
                <div className="w-6 h-6 rounded-full bg-[#1e3a5f] flex items-center justify-center text-[10px] font-semibold text-[#2d7dd2]">
                  J
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[11px] font-medium text-white truncate">Jean Dupont</span>
                  <span className="text-[9px] text-[#8b9cb3]">Solo</span>
                </div>
                <LogOut className="w-3 h-3 text-[#8b9cb3] ml-auto shrink-0" />
              </div>
            </div>
          </div>

          <div className="flex-1 flex flex-col min-w-0">
            <div className="px-3 sm:px-4 pt-3 sm:pt-4 pb-2 border-b border-[#1f2937]">
              <div className="flex items-center gap-2 mb-2.5">
                <div className="flex-1 flex items-center gap-2 bg-[#141c2b] border border-[#1f2937] rounded-lg px-3 py-1.5">
                  <Search className="w-3.5 h-3.5 text-[#8b9cb3]" />
                  <span className="text-[11px] text-[#8b9cb3]">Rechercher des emails...</span>
                </div>
                <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-all duration-500 ${
                  phase === "sorting"
                    ? "border-[#2d7dd2]/30 bg-[#2d7dd2]/10 text-[#2d7dd2]"
                    : phase === "done" || phase === "clean"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                    : phase === "selecting" || phase === "deleting"
                    ? "border-red-500/30 bg-red-500/10 text-red-400"
                    : "border-[#1f2937] bg-[#141c2b] text-[#8b9cb3]"
                }`}>
                  {phase === "sorting" ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : phase === "done" || phase === "clean" ? (
                    <CheckCircle className="w-3 h-3" />
                  ) : phase === "selecting" || phase === "deleting" ? (
                    <Trash2 className="w-3 h-3" />
                  ) : (
                    <Zap className="w-3 h-3" />
                  )}
                  <span className="hidden sm:inline">
                    {phase === "sorting" ? "IA en cours..." : phase === "done" ? "Trié !" : phase === "selecting" ? `${selectedJunk} sélec.` : phase === "deleting" ? "Supprimé !" : phase === "clean" ? "Propre !" : "Autopilot"}
                  </span>
                </div>
              </div>

              {(phase === "selecting" || phase === "deleting") && !deletedJunk ? (
                <div className="flex items-center gap-2 py-1 px-2.5 rounded-lg bg-[#2d7dd2]/[0.08] border border-[#2d7dd2]/20 transition-all duration-300">
                  <span className="text-[10px] text-[#2d7dd2] font-medium">{selectedJunk} sélectionné(s)</span>
                  <div className="flex-1" />
                  <div className="flex items-center gap-1 text-[10px] text-red-400 font-medium px-2 py-0.5 rounded bg-red-500/10 border border-red-500/20">
                    <Trash2 className="w-2.5 h-2.5" />
                    Supprimer
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-[#8b9cb3] mr-1">Priorité :</span>
                  {["Tous", "Urgent", "Moyen", "Faible"].map((f, i) => (
                    <div
                      key={f}
                      className={`text-[10px] px-2 py-0.5 rounded-md font-medium ${
                        i === 0
                          ? "bg-[#2d7dd2]/15 text-[#2d7dd2] border border-[#2d7dd2]/20"
                          : "text-[#8b9cb3] border border-[#1f2937]"
                      }`}
                    >
                      {f}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex-1 px-3 sm:px-4 py-2 space-y-1 overflow-hidden">
              {DEMO_EMAILS.map((email, i) => {
                const visible = i < visibleEmails;
                const sorted = i < sortedCount;
                const barColor = PRIORITY_BAR_COLORS[email.priority];
                const isJunkSelected = isSelectingOrAfter && junkSelectedSet.has(i);
                const isHidden = deletedJunk && email.isJunk;

                return (
                  <div
                    key={i}
                    className={`flex items-stretch rounded-lg border overflow-hidden transition-all duration-500 ${
                      isHidden
                        ? "opacity-0 max-h-0 my-0 border-transparent scale-y-0 origin-top"
                        : !visible
                        ? "opacity-0 translate-y-4 border-transparent max-h-20"
                        : isJunkSelected
                        ? "opacity-100 bg-red-500/[0.06] border-red-500/30 max-h-20"
                        : sorted
                        ? "opacity-100 bg-[#141c2b] border-[#1f2937]/60 max-h-20"
                        : "opacity-100 bg-[#141c2b]/40 border-[#1f2937]/30 max-h-20"
                    }`}
                    style={{ transition: isHidden ? "all 0.5s ease-out" : undefined }}
                  >
                    <div className={`w-1 shrink-0 transition-all duration-500 ${isJunkSelected ? "bg-red-500" : sorted ? barColor : "bg-transparent"}`} />
                    <div className="flex items-start gap-2 flex-1 min-w-0 px-2.5 py-2">
                      {isSelectingOrAfter && email.isJunk && !isHidden ? (
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 transition-all duration-300 ${
                          isJunkSelected ? "bg-red-500" : "border-2 border-[#8b9cb3]/30"
                        }`}>
                          {isJunkSelected ? (
                            <Check className="w-3.5 h-3.5 text-white" />
                          ) : (
                            <Square className="w-3 h-3 text-[#8b9cb3]/40" />
                          )}
                        </div>
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-[#2d7dd2]/20 flex items-center justify-center text-[#2d7dd2] font-semibold text-[11px] shrink-0 mt-0.5">
                          {email.sender[0]}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={`text-[11px] font-semibold truncate ${isJunkSelected ? "text-red-300/70 line-through" : "text-white"}`}>{email.sender}</span>
                          {!sorted && visible && (
                            <div className="w-1.5 h-1.5 rounded-full bg-[#2d7dd2] shrink-0" />
                          )}
                        </div>
                        <p className={`text-[11px] truncate ${isJunkSelected ? "text-white/40 line-through" : "text-white/80"}`}>{email.subject}</p>
                        {sorted && !isJunkSelected && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <Sparkles className="w-3 h-3 text-[#2d7dd2] shrink-0" />
                            <p className="text-[10px] text-[#8b9cb3] truncate">{email.summary}</p>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[9px] text-[#8b9cb3] whitespace-nowrap items-center gap-0.5 hidden sm:flex">
                          <Clock className="w-2.5 h-2.5" />
                          {i < 2 ? "Auj." : i < 4 ? "Hier" : "3 avr."}
                        </span>
                        <ChevronRight className={`w-3.5 h-3.5 transition-colors ${visible ? "text-[#8b9cb3]/40" : "text-transparent"}`} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {(phase === "done" || phase === "selecting" || phase === "deleting" || phase === "clean") && (
              <div className="px-3 sm:px-4 pb-3 pt-1">
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Urgents", count: "2", color: "text-red-400", borderColor: "border-l-red-500" },
                    {
                      label: phase === "clean" ? "Nettoyés" : "Triés par IA",
                      count: phase === "clean" ? String(JUNK_COUNT) : String(EMAIL_COUNT),
                      color: phase === "clean" ? "text-red-400" : "text-emerald-400",
                      borderColor: phase === "clean" ? "border-l-red-500" : "border-l-emerald-500",
                    },
                    { label: "Temps épargné", count: phase === "clean" ? "14 min" : "12 min", color: "text-[#2d7dd2]", borderColor: "border-l-[#2d7dd2]" },
                  ].map((stat) => (
                    <div key={stat.label} className={`text-center py-2 px-1 rounded-lg border border-[#1f2937] border-l-2 ${stat.borderColor} bg-[#141c2b]`}>
                      <div className={`text-[13px] font-bold ${stat.color}`}>{stat.count}</div>
                      <div className="text-[9px] text-[#8b9cb3]">{stat.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="absolute -inset-px rounded-xl bg-gradient-to-b from-[#2d7dd2]/10 via-transparent to-transparent pointer-events-none" />
    </div>
  );
}
