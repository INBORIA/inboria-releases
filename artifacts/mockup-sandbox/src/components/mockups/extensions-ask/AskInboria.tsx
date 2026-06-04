import { useState, useEffect, useRef, useCallback } from "react";
import {
  Sparkles, Search, MessageCircleQuestion, MousePointer2, Star, Archive, Trash2,
  Reply, Inbox, Send, FileText, Tag, Puzzle, ChevronDown,
} from "lucide-react";

// Animation marketing — page « Extensions ».
// Concept : Inboria vit À L'INTÉRIEUR de votre webmail (Gmail / Outlook).
// Webmail clair recognizable -> bouton « Demander à Inboria » injecté ->
// panneau sombre Inboria qui se glisse depuis la droite -> réponse contextuelle.

const FOLDERS = [
  { icon: Inbox, label: "Boîte de réception", count: 12, active: true },
  { icon: Star, label: "Suivis", count: 0 },
  { icon: Send, label: "Envoyés", count: 0 },
  { icon: FileText, label: "Brouillons", count: 2 },
  { icon: Archive, label: "Archives", count: 0 },
];

const EMAILS = [
  { from: "Marie Lemoine", initial: "M", subject: "Re: Devis rénovation cuisine", preview: "Bonjour, avez-vous pu regarder ma demande ?", time: "09:24", unread: true, color: "#2d7dd2" },
  { from: "Beta Corp — Compta", initial: "B", subject: "Facture #2041 en attente", preview: "Relance automatique — échéance dépassée.", time: "08:51", unread: true, color: "#d97706" },
  { from: "Jean Mercier", initial: "J", subject: "Disponibilités pour le rendez-vous", preview: "Seriez-vous libre lundi ou mardi prochain ?", time: "Hier", unread: true, color: "#059669" },
  { from: "Design Weekly", initial: "D", subject: "Les tendances UI de 2026", preview: "Cette semaine : retour du skeuomorphisme…", time: "Hier", unread: false, color: "#7c3aed" },
  { from: "LinkedIn", initial: "in", subject: "Vous avez 3 nouvelles relations", preview: "Développez votre réseau professionnel.", time: "Lun.", unread: false, color: "#0a66c2" },
];

const CHIPS = [
  "Quels engagements ai-je pris cette semaine ?",
  "De quoi devrais-je relancer en priorité ?",
  "Résume mon dernier échange avec Marie.",
];

// step: 0 inbox · 1 hover · 2 click+panel · 3 greeting+chips · 4 user msg · 5 typing · 6 answer
type Step = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const TIMINGS: Array<[Step, number]> = [
  [1, 1000],
  [2, 1800],
  [3, 2200],
  [4, 3400],
  [5, 4100],
  [6, 5000],
];
const CYCLE = 11000;

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

export function AskInboria() {
  const reducedMotion = useReducedMotion();
  const [step, setStep] = useState<Step>(reducedMotion ? 6 : 0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  const runCycle = useCallback(() => {
    if (reducedMotion) return;
    clearTimers();
    setStep(0);
    const t: ReturnType<typeof setTimeout>[] = [];
    TIMINGS.forEach(([s, ms]) => t.push(setTimeout(() => setStep(s), ms)));
    t.push(setTimeout(runCycle, CYCLE));
    timers.current = t;
  }, [clearTimers, reducedMotion]);

  useEffect(() => {
    if (reducedMotion) { setStep(6); return; }
    runCycle();
    return clearTimers;
  }, [runCycle, clearTimers, reducedMotion]);

  const panelOpen = step >= 2;
  const buttonHot = step === 1 || step === 2;
  const cursorVisible = step === 1 || step === 2;

  return (
    <div className="min-h-screen w-full bg-[#0a0e14] flex items-center justify-center p-6 font-sans antialiased">
      <div className="w-full max-w-[1060px]">
        <div className="text-center mb-5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#2d7dd2]/30 bg-[#2d7dd2]/10 text-[#2d7dd2] text-[12px] font-medium">
            <Puzzle className="w-3.5 h-3.5" />
            Inboria s'invite dans votre messagerie
          </div>
          <p className="mt-2 text-[13px] text-[#8b95a7]">
            Gmail, Outlook, webmail — sans changer vos habitudes.
          </p>
        </div>

        {/* Fenêtre navigateur */}
        <div className="rounded-xl border border-[#1f2937] bg-white overflow-hidden shadow-2xl shadow-[#2d7dd2]/10">
          {/* Barre navigateur */}
          <div className="flex items-center gap-3 px-4 py-2.5 bg-[#e9edf2] border-b border-[#d7dde4]">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-[#ec6a5e]" />
              <div className="w-3 h-3 rounded-full bg-[#f4be4f]" />
              <div className="w-3 h-3 rounded-full bg-[#61c554]" />
            </div>
            <div className="flex-1 flex items-center gap-2 bg-white border border-[#d7dde4] rounded-md px-3 py-1 max-w-[420px] mx-auto">
              <Search className="w-3 h-3 text-[#9aa3b0]" />
              <span className="text-[11px] text-[#6b7280] truncate">mail.google.com / outlook.com</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[10px] text-[#6b7280]">Extension</span>
              <span className="inline-flex items-center justify-center h-6 w-6 rounded-md bg-[#2d7dd2]/12 border border-[#2d7dd2]/25">
                <Sparkles className="w-3 h-3 text-[#2d7dd2]" />
              </span>
            </div>
          </div>

          {/* Corps webmail (clair) */}
          <div className="relative flex h-[520px] bg-[#f6f8fa]">
            {/* Colonne dossiers */}
            <div className="hidden sm:flex flex-col w-[210px] border-r border-[#e4e8ee] bg-white px-3 py-4 gap-1">
              <button className="flex items-center justify-center gap-2 mb-3 px-3 py-2 rounded-lg bg-[#2d7dd2] text-white text-[12px] font-semibold shadow-sm">
                <Reply className="w-3.5 h-3.5" /> Nouveau message
              </button>
              {FOLDERS.map((f) => (
                <div
                  key={f.label}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] ${
                    f.active ? "bg-[#2d7dd2]/10 text-[#1f5c9e] font-semibold" : "text-[#4b5563]"
                  }`}
                >
                  <f.icon className={`w-3.5 h-3.5 shrink-0 ${f.active ? "text-[#2d7dd2]" : "text-[#9aa3b0]"}`} />
                  <span className="truncate flex-1">{f.label}</span>
                  {f.count > 0 && (
                    <span className={`text-[10px] font-medium ${f.active ? "text-[#2d7dd2]" : "text-[#9aa3b0]"}`}>{f.count}</span>
                  )}
                </div>
              ))}
            </div>

            {/* Liste mails */}
            <div className="flex-1 flex flex-col min-w-0">
              {/* Toolbar webmail avec bouton injecté */}
              <div className="flex items-center gap-2 px-4 h-12 border-b border-[#e4e8ee] bg-white">
                <span className="text-[13px] font-semibold text-[#1f2937]">Boîte de réception</span>
                <span className="text-[11px] text-[#9aa3b0]">3 non lus</span>
                <div className="flex-1" />

                {/* Bouton « Demander à Inboria » — injecté par l'extension */}
                <div className="relative">
                  <div
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all duration-300 ${
                      buttonHot
                        ? "bg-[#2d7dd2] text-white shadow-lg shadow-[#2d7dd2]/30 scale-[1.04]"
                        : "bg-[#2d7dd2]/10 text-[#1f5c9e] border border-[#2d7dd2]/25"
                    }`}
                  >
                    <span className={`inline-flex items-center justify-center h-4 w-4 rounded-full ${buttonHot ? "bg-white/20" : "bg-[#2d7dd2]/15"}`}>
                      <Sparkles className={`w-2.5 h-2.5 ${buttonHot ? "text-white" : "text-[#2d7dd2]"}`} />
                    </span>
                    Demander à Inboria
                  </div>
                  {/* halo pulse au repos */}
                  {step === 0 && (
                    <span className="absolute inset-0 rounded-lg border border-[#2d7dd2]/40 animate-ping" />
                  )}
                  {/* curseur */}
                  {cursorVisible && (
                    <MousePointer2
                      className="absolute -bottom-3 -right-1 w-5 h-5 text-[#0a0e14] fill-white drop-shadow-md transition-all duration-500"
                      style={{ transform: step === 2 ? "translate(-2px,-2px) scale(0.9)" : "none" }}
                    />
                  )}
                </div>
              </div>

              {/* Mails */}
              <div className="flex-1 overflow-hidden">
                {EMAILS.map((m) => (
                  <div
                    key={m.subject}
                    className="flex items-center gap-3 h-[64px] px-4 border-b border-[#eef1f5] hover:bg-[#f0f4f9] transition-colors"
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold text-white shrink-0"
                      style={{ backgroundColor: m.color }}
                    >
                      {m.initial}
                    </div>
                    <div className="w-[150px] shrink-0">
                      <p className={`text-[12.5px] truncate ${m.unread ? "font-bold text-[#111827]" : "font-medium text-[#4b5563]"}`}>{m.from}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[12.5px] truncate ${m.unread ? "font-semibold text-[#1f2937]" : "text-[#4b5563]"}`}>
                        {m.subject} <span className="font-normal text-[#9aa3b0]">— {m.preview}</span>
                      </p>
                    </div>
                    <span className="text-[11px] text-[#9aa3b0] tabular-nums shrink-0 w-12 text-right">{m.time}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Panneau Inboria (sombre) glissé depuis la droite */}
            <div
              className={`absolute top-3 right-3 bottom-3 w-[330px] z-30 transition-all duration-500 ease-out ${
                panelOpen ? "translate-x-0 opacity-100" : "translate-x-[110%] opacity-0"
              }`}
            >
              <div className="h-full flex flex-col rounded-xl border border-[#1f2937] bg-[#0d1117] shadow-2xl shadow-black/50 overflow-hidden">
                <div className="flex items-center gap-2 px-3.5 py-3 border-b border-[#1f2937]">
                  <div className="w-7 h-7 rounded-full bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center shrink-0">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-[12px] font-semibold text-zinc-100">Inbor<span className="text-cyan-400">ia</span></span>
                    <span className="text-[9px] text-zinc-500">Votre coéquipier emails — dans votre boîte</span>
                  </div>
                  <span className="text-[9px] text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> connecté
                  </span>
                </div>

                <div className="flex-1 px-3.5 py-3 space-y-2.5 overflow-hidden">
                  <p className="text-[11px] font-semibold text-white">Bonjour 👋 Je suis Inboria.</p>
                  <p className="text-[10px] text-[#b8c5d6] leading-snug">
                    Je connais vos contacts, vos préférences et vos engagements en cours. Posez-moi une question.
                  </p>

                  {step === 3 && (
                    <div className="space-y-1.5 transition-opacity duration-300">
                      {CHIPS.map((q, i) => (
                        <div
                          key={i}
                          className={`flex items-start gap-1.5 px-2.5 py-2 rounded-lg border text-[10px] leading-snug ${
                            i === 1
                              ? "border-[#2d7dd2]/50 bg-[#2d7dd2]/[0.12] text-white"
                              : "border-[#1f2937] bg-[#141c2b] text-white/80"
                          }`}
                        >
                          <MessageCircleQuestion className="w-3 h-3 text-[#2d7dd2] shrink-0 mt-px" />
                          <span>{q}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {step >= 4 && (
                    <div className="flex justify-end">
                      <div className="max-w-[85%] px-2.5 py-1.5 rounded-lg rounded-tr-sm bg-[#2d7dd2] text-white text-[10px] leading-snug">
                        {CHIPS[1]}
                      </div>
                    </div>
                  )}

                  {step === 5 && (
                    <div className="flex items-center gap-1 px-2.5 py-2 rounded-lg border border-[#1f2937] bg-[#141c2b] w-fit">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#2d7dd2] animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-[#2d7dd2] animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-[#2d7dd2] animate-bounce" style={{ animationDelay: "300ms" }} />
                      <span className="text-[9px] text-[#b8c5d6] ml-1">Inboria réfléchit…</span>
                    </div>
                  )}

                  {step >= 6 && (
                    <div className="flex items-start gap-1.5">
                      <div className="w-5 h-5 rounded-full bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center shrink-0 mt-px">
                        <Sparkles className="w-2.5 h-2.5 text-cyan-300" />
                      </div>
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <p className="text-[10px] text-white leading-snug">3 relances prioritaires aujourd'hui :</p>
                        <ul className="space-y-1 text-[10px] text-white/90 leading-snug">
                          <li className="flex items-start gap-1.5">
                            <span className="text-[#2d7dd2] shrink-0">•</span>
                            <span><strong className="text-white">Marie Lemoine</strong> — devis envoyé il y a 5 jours, sans réponse.</span>
                          </li>
                          <li className="flex items-start gap-1.5">
                            <span className="text-[#2d7dd2] shrink-0">•</span>
                            <span><strong className="text-white">Beta Corp</strong> — facture impayée depuis 12 jours.</span>
                          </li>
                          <li className="flex items-start gap-1.5">
                            <span className="text-[#2d7dd2] shrink-0">•</span>
                            <span><strong className="text-white">Jean Mercier</strong> — rendez-vous en attente depuis lundi.</span>
                          </li>
                        </ul>
                        <p className="text-[10px] text-[#2d7dd2] font-medium leading-snug pt-0.5">Je prépare les 3 brouillons ?</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="px-3.5 pb-3 pt-1.5 border-t border-[#1f2937]">
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#141c2b] border border-[#1f2937]">
                    <Search className="w-3 h-3 text-[#b8c5d6] shrink-0" />
                    <span className="text-[10px] text-[#8b95a7] truncate flex-1">Demandez quelque chose à Inboria…</span>
                    <Tag className="w-3 h-3 text-[#3a4453]" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <p className="text-center mt-4 text-[11px] text-[#5a6270]">
          Démonstration animée — Inboria répond directement dans Gmail &amp; Outlook.
        </p>
      </div>
    </div>
  );
}
