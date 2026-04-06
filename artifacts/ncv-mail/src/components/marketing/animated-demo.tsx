import { useState, useEffect, useRef, useCallback } from "react";
import { Mail, Tags, Zap, CheckCircle, ArrowRight, Star, Clock, AlertTriangle } from "lucide-react";

const emails = [
  { from: "Pierre Martin", subject: "Contrat Q2 a signer", cat: "Urgent", color: "#ef4444", icon: AlertTriangle, prio: true },
  { from: "Sophie Dubois", subject: "Rapport mensuel Mars 2026", cat: "Comptabilite", color: "#f59e0b", icon: Clock, prio: false },
  { from: "LinkedIn", subject: "3 nouvelles connexions", cat: "Reseaux", color: "#8b5cf6", icon: Star, prio: false },
  { from: "AWS", subject: "Votre facture est disponible", cat: "Facturation", color: "#10b981", icon: CheckCircle, prio: false },
  { from: "Marie Laurent", subject: "Reunion client demain 9h", cat: "Urgent", color: "#ef4444", icon: AlertTriangle, prio: true },
  { from: "Newsletter Tech", subject: "Les tendances IA 2026", cat: "Newsletters", color: "#6366f1", icon: Mail, prio: false },
];

const EMAIL_COUNT = emails.length;
const ARRIVAL_DELAY = 300;
const SORT_START = EMAIL_COUNT * ARRIVAL_DELAY + 1200;
const SORT_INTERVAL = 400;
const DONE_TIME = SORT_START + EMAIL_COUNT * SORT_INTERVAL + 400;
const CYCLE_TIME = DONE_TIME + 2700;

type Phase = "inbox" | "sorting" | "done";

function scheduleAnimation(
  setPhase: (p: Phase) => void,
  setVisibleEmails: (n: number) => void,
  setSortedCount: (n: number) => void,
): ReturnType<typeof setTimeout>[] {
  const timers: ReturnType<typeof setTimeout>[] = [];
  for (let i = 1; i <= EMAIL_COUNT; i++) {
    timers.push(setTimeout(() => setVisibleEmails(i), i * ARRIVAL_DELAY));
  }
  timers.push(setTimeout(() => setPhase("sorting"), SORT_START));
  for (let i = 1; i <= EMAIL_COUNT; i++) {
    timers.push(setTimeout(() => setSortedCount(i), SORT_START + i * SORT_INTERVAL));
  }
  timers.push(setTimeout(() => setPhase("done"), DONE_TIME));
  return timers;
}

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
  const [phase, setPhase] = useState<Phase>(reducedMotion ? "done" : "inbox");
  const [visibleEmails, setVisibleEmails] = useState(reducedMotion ? EMAIL_COUNT : 0);
  const [sortedCount, setSortedCount] = useState(reducedMotion ? EMAIL_COUNT : 0);
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

    const startTimer = setTimeout(() => {
      if (!mountedRef.current || !visibleRef.current) return;
      const animTimers = scheduleAnimation(setPhase, setVisibleEmails, setSortedCount);
      animTimers.push(
        setTimeout(() => {
          if (mountedRef.current && visibleRef.current) runCycle();
        }, CYCLE_TIME)
      );
      timersRef.current = animTimers;
    }, 500);
    timersRef.current = [startTimer];
  }, [clearTimers, reducedMotion]);

  useEffect(() => {
    mountedRef.current = true;

    if (reducedMotion) {
      setPhase("done");
      setVisibleEmails(EMAIL_COUNT);
      setSortedCount(EMAIL_COUNT);
      return;
    }

    const el = containerRef.current;
    if (!el) {
      runCycle();
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        visibleRef.current = entry.isIntersecting;
        if (entry.isIntersecting) {
          runCycle();
        } else {
          clearTimers();
        }
      },
      { threshold: 0.2 }
    );
    observer.observe(el);

    return () => {
      mountedRef.current = false;
      clearTimers();
      observer.disconnect();
    };
  }, [runCycle, clearTimers, reducedMotion]);

  return (
    <div ref={containerRef} className="relative max-w-4xl mx-auto mt-12">
      <div className="rounded-xl border border-[#1f2937] bg-[#0a0e14] overflow-hidden shadow-2xl shadow-[#2d7dd2]/5">
        <div className="flex items-center gap-2 px-4 py-2.5 bg-[#141c2b] border-b border-[#1f2937]">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#ef4444]/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#10b981]/60" />
          </div>
          <div className="flex-1 text-center">
            <span className="text-[11px] text-[#8b9cb3]">NCV Mail — Dashboard</span>
          </div>
        </div>

        <div className="flex min-h-[320px] sm:min-h-[360px]">
          <div className="hidden sm:flex flex-col w-44 border-r border-[#1f2937] bg-[#0d1117] py-3 px-3 gap-1">
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-[#2d7dd2]/10 text-[#2d7dd2]">
              <Mail className="w-3.5 h-3.5" />
              <span className="text-[11px] font-medium">Inbox</span>
              <span className="ml-auto text-[10px] bg-[#2d7dd2]/20 px-1.5 py-0.5 rounded-full">{phase === "done" ? "0" : Math.max(0, visibleEmails - sortedCount)}</span>
            </div>
            <div className="flex items-center gap-2 px-2 py-1.5 text-[#8b9cb3]">
              <Tags className="w-3.5 h-3.5" />
              <span className="text-[11px]">Categories</span>
            </div>
            <div className="flex items-center gap-2 px-2 py-1.5 text-[#8b9cb3]">
              <Zap className="w-3.5 h-3.5" />
              <span className="text-[11px]">Autopilot</span>
              <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded-full transition-all duration-500 ${phase === "sorting" ? "bg-[#2d7dd2]/20 text-[#2d7dd2] animate-pulse" : phase === "done" ? "bg-[#10b981]/20 text-[#10b981]" : "bg-white/5 text-[#8b9cb3]"}`}>
                {phase === "sorting" ? "Actif" : phase === "done" ? "Fait" : "Pret"}
              </span>
            </div>
          </div>

          <div className="flex-1 p-3 sm:p-4">
            <div aria-live="polite" className="mb-3 flex items-center gap-2">
              {phase === "inbox" && (
                <>
                  <Mail className="w-4 h-4 text-[#2d7dd2]" />
                  <span className="text-[12px] font-medium text-white">Nouveaux emails</span>
                  <span className="text-[10px] text-[#8b9cb3]">({visibleEmails} recus)</span>
                </>
              )}
              {phase === "sorting" && (
                <>
                  <Zap className="w-4 h-4 text-[#2d7dd2] animate-pulse" />
                  <span className="text-[12px] font-medium text-[#2d7dd2]">IA en cours de tri...</span>
                  <span className="text-[10px] text-[#8b9cb3]">({sortedCount}/{EMAIL_COUNT} classes)</span>
                </>
              )}
              {phase === "done" && (
                <>
                  <CheckCircle className="w-4 h-4 text-[#10b981]" />
                  <span className="text-[12px] font-medium text-[#10b981]">Inbox organisee automatiquement</span>
                </>
              )}
            </div>

            <div className="space-y-1.5">
              {emails.map((email, i) => {
                const visible = i < visibleEmails;
                const sorted = i < sortedCount;
                const Icon = email.icon;

                return (
                  <div
                    key={i}
                    aria-hidden={!visible}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-500 ${
                      !visible
                        ? "opacity-0 translate-y-3"
                        : sorted
                        ? "opacity-90 bg-[#141c2b] border border-[#1f2937]/50"
                        : "opacity-100 bg-[#141c2b]/50"
                    }`}
                  >
                    <div className={`w-1 h-8 rounded-full transition-all duration-500 ${sorted ? "" : "bg-[#2d7dd2]/30"}`} style={sorted ? { backgroundColor: email.color } : {}} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-[11px] font-medium truncate ${email.prio ? "text-white" : "text-[#c9d1d9]"}`}>{email.from}</span>
                        {sorted && (
                          <span
                            className="text-[9px] px-1.5 py-0.5 rounded-full font-medium shrink-0 transition-all duration-300"
                            style={{ backgroundColor: `${email.color}20`, color: email.color }}
                          >
                            {email.cat}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-[#8b9cb3] truncate">{email.subject}</p>
                    </div>
                    {sorted && (
                      <Icon className="w-3.5 h-3.5 shrink-0 transition-all duration-300" style={{ color: email.color }} />
                    )}
                    {!sorted && visible && phase === "sorting" && i === sortedCount && (
                      <ArrowRight className="w-3.5 h-3.5 text-[#2d7dd2] animate-pulse shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>

            {phase === "done" && (
              <div className="mt-4 grid grid-cols-3 gap-2">
                {[
                  { label: "Urgent", count: 2, color: "#ef4444" },
                  { label: "Classe", count: EMAIL_COUNT, color: "#10b981" },
                  { label: "Temps epargne", count: "12 min", color: "#2d7dd2" },
                ].map((stat) => (
                  <div key={stat.label} className="text-center p-2 rounded-lg bg-[#141c2b] border border-[#1f2937]/50">
                    <div className="text-[14px] font-bold" style={{ color: stat.color }}>{stat.count}</div>
                    <div className="text-[9px] text-[#8b9cb3]">{stat.label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="absolute -inset-px rounded-xl bg-gradient-to-b from-[#2d7dd2]/10 via-transparent to-transparent pointer-events-none" />
    </div>
  );
}
