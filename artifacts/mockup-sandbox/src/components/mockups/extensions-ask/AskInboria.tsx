import { useState, useEffect, useRef, useCallback } from "react";
import {
  Sparkles, Search, MousePointer2, Star, Archive, Trash2,
  Reply, Forward, Inbox, Send, FileText, ListChecks, Paperclip,
  Puzzle, ArrowUpRight,
} from "lucide-react";

// Animation marketing — page « Extensions ».
// Concept : Inboria vit À L'INTÉRIEUR de votre webmail (Gmail / Outlook).
// Fidèle au VRAI add-in / extension / add-on Gmail :
//   - on ouvre un mail
//   - on clique le bouton « Demander à Inboria » injecté dans la barre
//   - le panneau Inboria (sombre) se glisse depuis la droite
//   - actions RÉELLES : « Résumer ce mail », « Proposer une réponse »,
//     « Que dois-je faire ? », + « ↗ Ouvrir dans Inboria »
//   - composer « Posez votre question à Inboria… »

const FOLDERS = [
  { icon: Inbox, label: "Boîte de réception", count: 12, active: true },
  { icon: Star, label: "Suivis", count: 0 },
  { icon: Send, label: "Envoyés", count: 0 },
  { icon: FileText, label: "Brouillons", count: 2 },
  { icon: Archive, label: "Archives", count: 0 },
];

// Actions réelles du panneau (cf. add-in taskpane / extension panel / Gmail Code.gs)
const ACTIONS = [
  { id: "summarize", label: "Résumer ce mail", icon: FileText },
  { id: "reply", label: "Proposer une réponse", icon: Reply },
  { id: "todo", label: "Que dois-je faire ?", icon: ListChecks },
] as const;

// step: 0 mail ouvert · 1 hover bouton · 2 click+panel · 3 actions · 4 clic action · 5 typing · 6 réponse
type Step = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const TIMINGS: Array<[Step, number]> = [
  [1, 1000],
  [2, 1800],
  [3, 2300],
  [4, 3600],
  [5, 4300],
  [6, 5200],
];
const CYCLE = 11500;

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
  // l'action « Que dois-je faire ? » est celle qui est choisie
  const pickedAction = ACTIONS[2];

  return (
    <div className="min-h-screen w-full bg-[#0a0e14] flex items-center justify-center p-6 font-sans antialiased">
      <div className="w-full max-w-[1060px]">
        <div className="text-center mb-5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#2d7dd2]/30 bg-[#2d7dd2]/10 text-[#2d7dd2] text-[12px] font-medium">
            <Puzzle className="w-3.5 h-3.5" />
            Inboria s'invite dans votre messagerie
          </div>
          <p className="mt-2 text-[13px] text-[#8b95a7]">
            Ouvrez un mail → cliquez « Demander à Inboria » → choisissez une action. Sans changer vos habitudes.
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

          {/* Corps webmail (clair) — mail ouvert */}
          <div className="relative flex h-[520px] bg-[#f6f8fa]">
            {/* Colonne dossiers */}
            <div className="hidden md:flex flex-col w-[200px] border-r border-[#e4e8ee] bg-white px-3 py-4 gap-1">
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

            {/* Volet lecture (mail ouvert) */}
            <div className="flex-1 flex flex-col min-w-0">
              {/* Toolbar du mail ouvert avec bouton injecté */}
              <div className="flex items-center gap-1.5 px-4 h-12 border-b border-[#e4e8ee] bg-white">
                <button className="p-1.5 rounded-md text-[#6b7280] hover:bg-[#f0f4f9]"><Reply className="w-4 h-4" /></button>
                <button className="p-1.5 rounded-md text-[#6b7280] hover:bg-[#f0f4f9]"><Forward className="w-4 h-4" /></button>
                <button className="p-1.5 rounded-md text-[#6b7280] hover:bg-[#f0f4f9]"><Archive className="w-4 h-4" /></button>
                <button className="p-1.5 rounded-md text-[#6b7280] hover:bg-[#f0f4f9]"><Trash2 className="w-4 h-4" /></button>
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
                  {step === 0 && (
                    <span className="absolute inset-0 rounded-lg border border-[#2d7dd2]/40 animate-ping" />
                  )}
                  {cursorVisible && (
                    <MousePointer2
                      className="absolute -bottom-3 -right-1 w-5 h-5 text-[#0a0e14] fill-white drop-shadow-md transition-all duration-500"
                      style={{ transform: step === 2 ? "translate(-2px,-2px) scale(0.9)" : "none" }}
                    />
                  )}
                </div>
              </div>

              {/* Corps du mail ouvert */}
              <div className="flex-1 overflow-hidden px-6 py-5">
                <h2 className="text-[16px] font-semibold text-[#111827]">Re: Devis rénovation cuisine</h2>
                <div className="flex items-center gap-3 mt-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-semibold text-white shrink-0" style={{ backgroundColor: "#2d7dd2" }}>
                    M
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-[#1f2937]">Marie Lemoine</p>
                    <p className="text-[11px] text-[#9aa3b0]">à moi — il y a 5 jours</p>
                  </div>
                </div>
                <div className="mt-4 space-y-2.5 text-[12.5px] text-[#4b5563] leading-relaxed max-w-[440px]">
                  <p>Bonjour,</p>
                  <p>Avez-vous pu regarder ma demande de devis pour la rénovation de la cuisine ? Je n'ai pas eu de retour depuis notre dernier échange.</p>
                  <p>Pouvez-vous me confirmer le montant et un délai possible ? Merci d'avance.</p>
                  <p className="text-[#6b7280]">Bien cordialement,<br />Marie</p>
                </div>
                <div className="mt-4 inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-[#e4e8ee] bg-white text-[11px] text-[#4b5563]">
                  <Paperclip className="w-3.5 h-3.5 text-[#9aa3b0]" />
                  devis-cuisine.pdf
                </div>
              </div>
            </div>

            {/* Panneau Inboria (sombre) glissé depuis la droite */}
            <div
              className={`absolute top-3 right-3 bottom-3 w-[336px] z-30 transition-all duration-500 ease-out ${
                panelOpen ? "translate-x-0 opacity-100" : "translate-x-[110%] opacity-0"
              }`}
            >
              <div className="h-full flex flex-col rounded-xl border border-[#1f2937] bg-[#0d1117] shadow-2xl shadow-black/50 overflow-hidden">
                {/* Entête marque — « Demander à Inboria » */}
                <div className="flex items-center gap-2 px-3.5 py-3 border-b border-[#1f2937]">
                  <div className="w-7 h-7 rounded-full bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center shrink-0">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-[12px] font-semibold text-zinc-100">Inbor<span className="text-cyan-400">ia</span></span>
                    <span className="text-[9px] text-zinc-500">Demander à Inboria — dans votre boîte</span>
                  </div>
                  <span className="text-[9px] text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> connecté
                  </span>
                </div>

                {/* Barre d'accès rapide : ouvrir l'app complète */}
                <div className="flex items-center gap-2 px-3.5 py-2 border-b border-[#1f2937]">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-medium transition-all duration-300 ${
                      step >= 6
                        ? "border-[#2d7dd2]/60 bg-[#2d7dd2]/[0.15] text-white shadow-md shadow-[#2d7dd2]/20"
                        : "border-[#1f2937] bg-[#141c2b] text-[#b8c5d6]"
                    }`}
                  >
                    <ArrowUpRight className="w-3 h-3" /> Ouvrir dans Inboria
                  </span>
                  <span className="text-[9px] text-zinc-500">pour aller plus loin</span>
                </div>

                <div className="flex-1 px-3.5 py-3 space-y-2.5 overflow-hidden">
                  <p className="text-[11px] font-semibold text-white">Bonjour 👋 Je suis Inboria.</p>
                  <p className="text-[10px] text-[#b8c5d6] leading-snug">
                    Je vois le mail de <strong className="text-white">Marie Lemoine</strong>. Que souhaitez-vous faire ?
                  </p>

                  {/* Actions RÉELLES */}
                  {step === 3 && (
                    <div className="space-y-1.5 transition-opacity duration-300">
                      {ACTIONS.map((a, i) => (
                        <div
                          key={a.id}
                          className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border text-[10px] leading-snug ${
                            i === 2
                              ? "border-[#2d7dd2]/50 bg-[#2d7dd2]/[0.12] text-white"
                              : "border-[#1f2937] bg-[#141c2b] text-white/80"
                          }`}
                        >
                          <a.icon className="w-3 h-3 text-[#2d7dd2] shrink-0" />
                          <span>{a.label}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Bulle utilisateur = action choisie */}
                  {step >= 4 && (
                    <div className="flex justify-end">
                      <div className="max-w-[85%] px-2.5 py-1.5 rounded-lg rounded-tr-sm bg-[#2d7dd2] text-white text-[10px] leading-snug">
                        {pickedAction.label}
                      </div>
                    </div>
                  )}

                  {/* Typing */}
                  {step === 5 && (
                    <div className="flex items-center gap-1 px-2.5 py-2 rounded-lg border border-[#1f2937] bg-[#141c2b] w-fit">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#2d7dd2] animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-[#2d7dd2] animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-[#2d7dd2] animate-bounce" style={{ animationDelay: "300ms" }} />
                      <span className="text-[9px] text-[#b8c5d6] ml-1">Inboria réfléchit…</span>
                    </div>
                  )}

                  {/* Réponse contextuelle au mail ouvert */}
                  {step >= 6 && (
                    <div className="flex items-start gap-1.5">
                      <div className="w-5 h-5 rounded-full bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center shrink-0 mt-px">
                        <Sparkles className="w-2.5 h-2.5 text-cyan-300" />
                      </div>
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <p className="text-[10px] text-white leading-snug">3 actions concrètes pour ce mail :</p>
                        <ul className="space-y-1 text-[10px] text-white/90 leading-snug">
                          <li className="flex items-start gap-1.5">
                            <span className="text-[#2d7dd2] shrink-0">•</span>
                            <span>Répondre à <strong className="text-white">Marie</strong> : le devis attend depuis 5 jours.</span>
                          </li>
                          <li className="flex items-start gap-1.5">
                            <span className="text-[#2d7dd2] shrink-0">•</span>
                            <span>Confirmer le <strong className="text-white">montant</strong> et un <strong className="text-white">délai</strong>.</span>
                          </li>
                          <li className="flex items-start gap-1.5">
                            <span className="text-[#2d7dd2] shrink-0">•</span>
                            <span>Renvoyer la pièce jointe <strong className="text-white">devis-cuisine.pdf</strong>.</span>
                          </li>
                        </ul>
                        <p className="text-[10px] text-[#2d7dd2] font-medium leading-snug pt-0.5">Je rédige la réponse ?</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Composer réel */}
                <div className="px-3.5 pb-3 pt-1.5 border-t border-[#1f2937]">
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#141c2b] border border-[#1f2937]">
                    <span className="text-[10px] text-[#8b95a7] truncate flex-1">Posez votre question à Inboria…</span>
                    <span className="inline-flex items-center justify-center h-6 w-6 rounded-md bg-[#2d7dd2] text-white shrink-0">
                      <Send className="w-3 h-3" />
                    </span>
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
