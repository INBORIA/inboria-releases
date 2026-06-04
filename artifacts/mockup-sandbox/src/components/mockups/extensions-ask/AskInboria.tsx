import { useState, useEffect, useRef, useCallback } from "react";
import {
  Sparkles, Search, MousePointer2, Star, Archive, Trash2,
  Reply, Forward, Inbox, Send, FileText, Paperclip, Puzzle,
} from "lucide-react";

// Animation marketing — page « Extensions ».
// Le panneau est une RÉPLIQUE FIDÈLE du vrai add-in Outlook
// (artifacts/ncv-mail/public/inboria-addin/taskpane.html + taskpane.js) :
//   - thème violet : --primary #8b5cf6 / --primary-2 #d946ef, --bg #0b1220,
//     --panel #111a2e, --panel-2 #0f1729, --muted #93a1b9, --text #e7ecf5
//   - en-tête « Inboria » + tag « Demander à Inboria »
//   - barre : « ↗ Ouvrir dans Inboria » · « Effacer » · « Déconnexion »
//   - 3 raccourcis (chips) SANS icône : Résumer ce mail / Proposer une réponse / Que dois-je faire ?
//   - message d'accueil exact + bulle user violet + « Inboria réfléchit… »
//   - composer « Posez votre question à Inboria… » + bouton ➤

const FOLDERS = [
  { icon: Inbox, label: "Boîte de réception", count: 12, active: true },
  { icon: Star, label: "Suivis", count: 0 },
  { icon: Send, label: "Envoyés", count: 0 },
  { icon: FileText, label: "Brouillons", count: 2 },
  { icon: Archive, label: "Archives", count: 0 },
];

// Raccourcis réels (data-q) du vrai panneau, dans l'ordre exact.
const CHIPS = ["Résumer ce mail", "Proposer une réponse", "Que dois-je faire ?"];
const PICKED = 2; // « Que dois-je faire ? »
const GREETING =
  "Bonjour 👋 Je suis Inboria. Posez-moi une question sur ce mail, ou utilisez les raccourcis ci-dessus.";

// step: 0 mail ouvert · 1 hover bouton · 2 click+panel+accueil · 3 hover raccourci · 4 bulle user · 5 typing · 6 réponse
type Step = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const TIMINGS: Array<[Step, number]> = [
  [1, 1000],
  [2, 1800],
  [3, 2900],
  [4, 3800],
  [5, 4400],
  [6, 5400],
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
  const cursorOnButton = step === 1 || step === 2;
  const cursorOnChip = step === 3;

  return (
    <div className="min-h-screen w-full bg-[#0a0e14] flex items-center justify-center p-6 font-sans antialiased">
      <div className="w-full max-w-[1060px]">
        <div className="text-center mb-5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#8b5cf6]/30 bg-[#8b5cf6]/10 text-[#b79bff] text-[12px] font-medium">
            <Puzzle className="w-3.5 h-3.5" />
            Inboria s'invite dans votre messagerie
          </div>
          <p className="mt-2 text-[13px] text-[#8b95a7]">
            Ouvrez un mail → cliquez « Demander à Inboria » → choisissez une action. Sans changer vos habitudes.
          </p>
        </div>

        {/* Fenêtre navigateur */}
        <div className="rounded-xl border border-[#1f2937] bg-white overflow-hidden shadow-2xl shadow-[#8b5cf6]/10">
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
              <span className="inline-flex items-center justify-center h-6 w-6 rounded-md bg-[#8b5cf6]/12 border border-[#8b5cf6]/25">
                <Sparkles className="w-3 h-3 text-[#8b5cf6]" />
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
                        ? "bg-gradient-to-br from-[#8b5cf6] to-[#d946ef] text-white shadow-lg shadow-[#8b5cf6]/30 scale-[1.04]"
                        : "bg-[#8b5cf6]/10 text-[#6d28d9] border border-[#8b5cf6]/30"
                    }`}
                  >
                    <span className={`inline-flex items-center justify-center h-4 w-4 rounded-full ${buttonHot ? "bg-white/20" : "bg-[#8b5cf6]/15"}`}>
                      <Sparkles className={`w-2.5 h-2.5 ${buttonHot ? "text-white" : "text-[#8b5cf6]"}`} />
                    </span>
                    Demander à Inboria
                  </div>
                  {step === 0 && (
                    <span className="absolute inset-0 rounded-lg border border-[#8b5cf6]/40 animate-ping" />
                  )}
                  {cursorOnButton && (
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

            {/* === Panneau Inboria — réplique fidèle du vrai add-in === */}
            <div
              className={`absolute top-3 right-3 bottom-3 w-[330px] z-30 transition-all duration-500 ease-out ${
                panelOpen ? "translate-x-0 opacity-100" : "translate-x-[110%] opacity-0"
              }`}
            >
              <div className="h-full flex flex-col rounded-xl border border-white/[0.08] bg-[#0b1220] shadow-2xl shadow-black/50 overflow-hidden">
                {/* .brand */}
                <div className="flex items-center gap-2 px-3.5 py-3 border-b border-white/[0.08] bg-[#0f1729]">
                  <span className="w-[22px] h-[22px] rounded-md bg-gradient-to-br from-[#8b5cf6] to-[#d946ef] flex items-center justify-center shrink-0">
                    <Sparkles className="w-3 h-3 text-white" />
                  </span>
                  <b className="text-[14px] text-[#e7ecf5] tracking-[0.2px]">Inboria</b>
                  <span className="ml-auto text-[10px] text-[#93a1b9]">Demander à Inboria</span>
                </div>

                {/* .topbar */}
                <div className="flex items-center gap-2 px-3.5 py-2 border-b border-white/[0.08]">
                  <span className="text-[11px] px-2.5 py-1.5 rounded-lg border border-white/[0.08] bg-[#111a2e] text-[#e7ecf5]">
                    ↗ Ouvrir dans Inboria
                  </span>
                  <span className="ml-auto text-[11px] text-[#93a1b9]">Effacer</span>
                  <span className="text-[11px] text-[#93a1b9]">Déconnexion</span>
                </div>

                {/* .quick (chips, sans icône) */}
                <div className="flex flex-wrap gap-1.5 px-3.5 pt-2.5">
                  {CHIPS.map((c, i) => (
                    <span
                      key={c}
                      className={`relative text-[11px] px-2.5 py-1.5 rounded-full border transition-all duration-300 ${
                        cursorOnChip && i === PICKED
                          ? "border-[#8b5cf6] bg-[#111a2e] text-[#e7ecf5] scale-[1.05]"
                          : "border-white/[0.08] bg-[#111a2e] text-[#e7ecf5]"
                      }`}
                    >
                      {c}
                      {cursorOnChip && i === PICKED && (
                        <MousePointer2 className="absolute -bottom-2.5 -right-1 w-4 h-4 text-[#0a0e14] fill-white drop-shadow-md" />
                      )}
                    </span>
                  ))}
                </div>

                {/* #messages */}
                <div className="flex-1 px-3.5 py-3 flex flex-col gap-2.5 overflow-hidden">
                  {/* accueil (bot) */}
                  <div className="self-start max-w-[92%] px-2.5 py-2 rounded-xl rounded-bl-[4px] bg-[#111a2e] border border-white/[0.08] text-[11px] text-[#e7ecf5] leading-relaxed">
                    {GREETING}
                  </div>

                  {/* bulle utilisateur = raccourci choisi */}
                  {step >= 4 && (
                    <div className="self-end max-w-[92%] px-2.5 py-2 rounded-xl rounded-br-[4px] bg-gradient-to-br from-[#8b5cf6] to-[#d946ef] text-white text-[11px] leading-relaxed">
                      {CHIPS[PICKED]}
                    </div>
                  )}

                  {/* typing */}
                  {step === 5 && (
                    <div className="self-start max-w-[92%] px-2.5 py-2 rounded-xl rounded-bl-[4px] bg-[#111a2e] border border-white/[0.08] text-[11px] italic text-[#93a1b9]">
                      Inboria réfléchit…
                    </div>
                  )}

                  {/* réponse (bot) — texte type IA, contextuel au mail */}
                  {step >= 6 && (
                    <div className="self-start max-w-[92%] px-2.5 py-2 rounded-xl rounded-bl-[4px] bg-[#111a2e] border border-white/[0.08] text-[11px] text-[#e7ecf5] leading-relaxed whitespace-pre-line">
                      {"Voici les actions à prévoir pour ce mail :\n\n1. Répondre à Marie — son devis attend depuis 5 jours.\n2. Confirmer le montant et un délai.\n3. Renvoyer la pièce jointe devis-cuisine.pdf.\n\nVoulez-vous que je rédige la réponse ?"}
                    </div>
                  )}
                </div>

                {/* .composer */}
                <div className="flex items-end gap-2 px-3.5 py-2.5 border-t border-white/[0.08] bg-[#0f1729]">
                  <div className="flex-1 px-2.5 py-2 rounded-lg bg-[#111a2e] border border-white/[0.08] text-[11px] text-[#93a1b9] truncate">
                    Posez votre question à Inboria…
                  </div>
                  <span className="inline-flex items-center justify-center w-[34px] h-[34px] rounded-[10px] bg-gradient-to-br from-[#8b5cf6] to-[#d946ef] text-white text-[14px] shrink-0">
                    ➤
                  </span>
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
