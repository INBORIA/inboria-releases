import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import appLogo from "@assets/inboria_logo_transparent_fix_v1_1775916067670.png";
import {
  Sparkles, Search, MousePointer2, Star, Archive, Trash2,
  Reply, Forward, Inbox, Send, FileText, Paperclip, Puzzle,
  CalendarClock, BellOff, MailCheck, CheckSquare, Users, CalendarDays,
  FolderOpen, LayoutDashboard, Tags, Bell, Sun, RefreshCw, Plus,
} from "lucide-react";

// Animation marketing — page « Extensions ».
// 1) Panneau = réplique fidèle du vrai add-in Outlook (thème violet).
// 2) Fin : clic « Ouvrir dans Inboria » → la vraie app Inboria (dashboard
//    sombre) s'ouvre sur la boîte de réception triée par catégories.
// Tout le texte visible passe par i18n (marketing.extensions.demo.* + sidebar.*).

// Métadonnées non traduisibles (icône/compteur) des dossiers du webmail.
const WEBMAIL_FOLDERS: Array<{ key: string; icon: any; count: number; active?: boolean }> = [
  { key: "inbox", icon: Inbox, count: 12, active: true },
  { key: "followed", icon: Star, count: 0 },
  { key: "sent", icon: Send, count: 0 },
  { key: "drafts", icon: FileText, count: 2 },
  { key: "archives", icon: Archive, count: 0 },
];

// Navigation de l'app Inboria — libellés réutilisés depuis sidebar.* (43 langues).
const INBORIA_NAV: Array<{ i18n: string; icon: any; active?: boolean }> = [
  { i18n: "sidebar.inbox", icon: Inbox, active: true },
  { i18n: "sidebar.sent", icon: Send },
  { i18n: "sidebar.scheduled", icon: CalendarClock },
  { i18n: "sidebar.snoozed", icon: BellOff },
  { i18n: "sidebar.followups", icon: MailCheck },
  { i18n: "sidebar.archives", icon: Archive },
  { i18n: "sidebar.myTasks", icon: CheckSquare },
  { i18n: "sidebar.contacts", icon: Users },
  { i18n: "sidebar.agenda", icon: CalendarDays },
  { i18n: "marketing.extensions.demo.navFolders", icon: FolderOpen },
  { i18n: "sidebar.dailyBrief", icon: LayoutDashboard },
  { i18n: "sidebar.classification", icon: Tags },
];

// Couleurs/états des lignes triées — non traduisibles ; le texte (expéditeur,
// sujet, extrait, catégorie) vient de l'i18n par index. La date est composée
// d'un nombre + d'une unité localisée (dateUnits.h = heures, dateUnits.d = jours).
const INBOX_META: Array<{ color: string; n: number; u: "h" | "d"; unread?: boolean; urgent?: boolean }> = [
  { color: "#2d7dd2", n: 5, u: "d", unread: true, urgent: true },
  { color: "#10b981", n: 2, u: "h", unread: true },
  { color: "#10b981", n: 3, u: "h", unread: true },
  { color: "#f43f5e", n: 4, u: "h", unread: true },
  { color: "#f59e0b", n: 1, u: "d" },
  { color: "#f59e0b", n: 6, u: "h" },
  { color: "#06b6d4", n: 1, u: "d" },
  { color: "#64748b", n: 8, u: "h" },
];

const PICKED = 2;

// step: 0 mail ouvert · 1 hover bouton · 2 panel+accueil · 3 hover raccourci ·
//       4 bulle user · 5 typing · 6 réponse · 7 hover « Ouvrir » · 8 app Inboria
type Step = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

const TIMINGS: Array<[Step, number]> = [
  [1, 1000],
  [2, 1800],
  [3, 2900],
  [4, 3800],
  [5, 4400],
  [6, 5400],
  [7, 6900],
  [8, 7700],
];
const CYCLE = 13500;

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

export function AskInboriaDemo() {
  const { t, i18n } = useTranslation();
  const reducedMotion = useReducedMotion();
  const [step, setStep] = useState<Step>(reducedMotion ? 6 : 0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const D = "marketing.extensions.demo";
  const chipsRaw = t(`${D}.chips`, { returnObjects: true });
  const chips: string[] = Array.isArray(chipsRaw) ? (chipsRaw as string[]) : [];
  const inboxRaw = t(`${D}.inbox`, { returnObjects: true });
  const inbox = (Array.isArray(inboxRaw) ? inboxRaw : []) as Array<{
    from: string; subject: string; preview: string; cat: string;
  }>;
  const langBadge = (i18n.language || "fr").slice(0, 2).toUpperCase();

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  const runCycle = useCallback(() => {
    if (reducedMotion) return;
    clearTimers();
    setStep(0);
    const tm: ReturnType<typeof setTimeout>[] = [];
    TIMINGS.forEach(([s, ms]) => tm.push(setTimeout(() => setStep(s), ms)));
    tm.push(setTimeout(runCycle, CYCLE));
    timers.current = tm;
  }, [clearTimers, reducedMotion]);

  useEffect(() => {
    if (reducedMotion) { setStep(6); return; }
    runCycle();
    return clearTimers;
  }, [runCycle, clearTimers, reducedMotion]);

  const panelOpen = step >= 2 && step <= 7;
  const buttonHot = step === 1 || step === 2;
  const cursorOnButton = step === 1 || step === 2;
  const cursorOnChip = step === 3;
  const openHot = step === 7;
  const cursorOnOpen = step === 7;
  const appOpen = step >= 8;

  return (
    <div className="w-full flex items-center justify-center font-sans antialiased">
      <div className="w-full max-w-[1060px]">
        <div className="text-center mb-5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#8b5cf6]/30 bg-[#8b5cf6]/10 text-[#b79bff] text-[12px] font-medium">
            <Puzzle className="w-3.5 h-3.5" />
            {t(`${D}.eyebrow`)}
          </div>
          <p className="mt-2 text-[13px] text-[#8b95a7]">
            {t(`${D}.subtitle`)}
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
              <span className="text-[11px] text-[#6b7280] truncate">
                {appOpen ? "app.inboria.com / dashboard" : "mail.google.com / outlook.com"}
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[10px] text-[#6b7280]">{t(`${D}.browserExtension`)}</span>
              <span className="inline-flex items-center justify-center h-6 w-6 rounded-md bg-[#8b5cf6]/12 border border-[#8b5cf6]/25">
                <Sparkles className="w-3 h-3 text-[#8b5cf6]" />
              </span>
            </div>
          </div>

          {/* Corps */}
          <div className="relative flex h-[520px] bg-[#f6f8fa] overflow-hidden">
            {/* ===== Webmail (clair) — mail ouvert ===== */}
            <div className="hidden md:flex flex-col w-[200px] border-r border-[#e4e8ee] bg-white px-3 py-4 gap-1">
              <button className="flex items-center justify-center gap-2 mb-3 px-3 py-2 rounded-lg bg-[#2d7dd2] text-white text-[12px] font-semibold shadow-sm">
                <Reply className="w-3.5 h-3.5" /> {t(`${D}.newMessage`)}
              </button>
              {WEBMAIL_FOLDERS.map((f) => (
                <div
                  key={f.key}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] ${
                    f.active ? "bg-[#2d7dd2]/10 text-[#1f5c9e] font-semibold" : "text-[#4b5563]"
                  }`}
                >
                  <f.icon className={`w-3.5 h-3.5 shrink-0 ${f.active ? "text-[#2d7dd2]" : "text-[#9aa3b0]"}`} />
                  <span className="truncate flex-1">{t(`${D}.webmail.${f.key}`)}</span>
                  {f.count > 0 && (
                    <span className={`text-[10px] font-medium ${f.active ? "text-[#2d7dd2]" : "text-[#9aa3b0]"}`}>{f.count}</span>
                  )}
                </div>
              ))}
            </div>

            <div className="flex-1 flex flex-col min-w-0">
              <div className="flex items-center gap-1.5 px-4 h-12 border-b border-[#e4e8ee] bg-white">
                <button className="p-1.5 rounded-md text-[#6b7280] hover:bg-[#f0f4f9]"><Reply className="w-4 h-4" /></button>
                <button className="p-1.5 rounded-md text-[#6b7280] hover:bg-[#f0f4f9]"><Forward className="w-4 h-4" /></button>
                <button className="p-1.5 rounded-md text-[#6b7280] hover:bg-[#f0f4f9]"><Archive className="w-4 h-4" /></button>
                <button className="p-1.5 rounded-md text-[#6b7280] hover:bg-[#f0f4f9]"><Trash2 className="w-4 h-4" /></button>
                <div className="flex-1" />
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
                    {t(`${D}.ask`)}
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

              <div className="flex-1 overflow-hidden px-6 py-5">
                <h2 className="text-[16px] font-semibold text-[#111827]">{t(`${D}.mail.subject`)}</h2>
                <div className="flex items-center gap-3 mt-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-semibold text-white shrink-0" style={{ backgroundColor: "#2d7dd2" }}>
                    {t(`${D}.mail.from`).charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-[#1f2937]">{t(`${D}.mail.from`)}</p>
                    <p className="text-[11px] text-[#9aa3b0]">{t(`${D}.mail.meta`)}</p>
                  </div>
                </div>
                <div className="mt-4 space-y-2.5 text-[12.5px] text-[#4b5563] leading-relaxed max-w-[440px]">
                  <p>{t(`${D}.mail.p1`)}</p>
                  <p>{t(`${D}.mail.p2`)}</p>
                  <p>{t(`${D}.mail.p3`)}</p>
                  <p className="text-[#6b7280] whitespace-pre-line">{t(`${D}.mail.signoff`)}</p>
                </div>
                <div className="mt-4 inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-[#e4e8ee] bg-white text-[11px] text-[#4b5563]">
                  <Paperclip className="w-3.5 h-3.5 text-[#9aa3b0]" />
                  {t(`${D}.mail.attachment`)}
                </div>
              </div>
            </div>

            {/* ===== Panneau Inboria — réplique fidèle du vrai add-in ===== */}
            <div
              className={`absolute top-3 right-3 bottom-3 w-[330px] z-30 transition-all duration-500 ease-out ${
                panelOpen ? "translate-x-0 opacity-100" : "translate-x-[110%] opacity-0"
              }`}
            >
              <div className="h-full flex flex-col rounded-xl border border-white/[0.08] bg-[#0b1220] shadow-2xl shadow-black/50 overflow-hidden">
                <div className="flex items-center gap-2 px-3.5 py-3 border-b border-white/[0.08] bg-[#0f1729]">
                  <span className="w-[22px] h-[22px] rounded-md bg-gradient-to-br from-[#8b5cf6] to-[#d946ef] flex items-center justify-center shrink-0">
                    <Sparkles className="w-3 h-3 text-white" />
                  </span>
                  <b className="text-[14px] text-[#e7ecf5] tracking-[0.2px]">Inboria</b>
                  <span className="ml-auto text-[10px] text-[#93a1b9]">{t(`${D}.ask`)}</span>
                </div>

                {/* topbar — « Ouvrir dans Inboria » devient cliqué à l'étape 7 */}
                <div className="flex items-center gap-2 px-3.5 py-2 border-b border-white/[0.08]">
                  <span className="relative">
                    <span
                      className={`inline-block text-[11px] px-2.5 py-1.5 rounded-lg border transition-all duration-300 ${
                        openHot
                          ? "border-[#8b5cf6] bg-gradient-to-br from-[#8b5cf6] to-[#d946ef] text-white scale-[1.05] shadow-md shadow-[#8b5cf6]/30"
                          : "border-white/[0.08] bg-[#111a2e] text-[#e7ecf5]"
                      }`}
                    >
                      ↗ {t(`${D}.openInInboria`)}
                    </span>
                    {cursorOnOpen && (
                      <MousePointer2 className="absolute -bottom-3 right-2 w-5 h-5 text-[#0a0e14] fill-white drop-shadow-md" />
                    )}
                  </span>
                  <span className="ml-auto text-[11px] text-[#93a1b9]">{t(`${D}.clear`)}</span>
                  <span className="text-[11px] text-[#93a1b9]">{t(`${D}.logout`)}</span>
                </div>

                <div className="flex flex-wrap gap-1.5 px-3.5 pt-2.5">
                  {chips.map((c, i) => (
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

                <div className="flex-1 px-3.5 py-3 flex flex-col gap-2.5 overflow-hidden">
                  <div className="self-start max-w-[92%] px-2.5 py-2 rounded-xl rounded-bl-[4px] bg-[#111a2e] border border-white/[0.08] text-[11px] text-[#e7ecf5] leading-relaxed">
                    {t(`${D}.greeting`)}
                  </div>
                  {step >= 4 && (
                    <div className="self-end max-w-[92%] px-2.5 py-2 rounded-xl rounded-br-[4px] bg-gradient-to-br from-[#8b5cf6] to-[#d946ef] text-white text-[11px] leading-relaxed">
                      {chips[PICKED]}
                    </div>
                  )}
                  {step === 5 && (
                    <div className="self-start max-w-[92%] px-2.5 py-2 rounded-xl rounded-bl-[4px] bg-[#111a2e] border border-white/[0.08] text-[11px] italic text-[#93a1b9]">
                      {t(`${D}.thinking`)}
                    </div>
                  )}
                  {step >= 6 && (
                    <div className="self-start max-w-[92%] px-2.5 py-2 rounded-xl rounded-bl-[4px] bg-[#111a2e] border border-white/[0.08] text-[11px] text-[#e7ecf5] leading-relaxed whitespace-pre-line">
                      {t(`${D}.answer`)}
                    </div>
                  )}
                </div>

                <div className="flex items-end gap-2 px-3.5 py-2.5 border-t border-white/[0.08] bg-[#0f1729]">
                  <div className="flex-1 px-2.5 py-2 rounded-lg bg-[#111a2e] border border-white/[0.08] text-[11px] text-[#93a1b9] truncate">
                    {t(`${D}.composerPlaceholder`)}
                  </div>
                  <span className="inline-flex items-center justify-center w-[34px] h-[34px] rounded-[10px] bg-gradient-to-br from-[#8b5cf6] to-[#d946ef] text-white text-[14px] shrink-0">
                    ➤
                  </span>
                </div>
              </div>
            </div>

            {/* ===== App Inboria (dashboard sombre) — s'ouvre au clic « Ouvrir » ===== */}
            <div
              className={`absolute inset-0 z-40 bg-[#0d1117] flex transition-all duration-500 ease-out ${
                appOpen ? "opacity-100 scale-100" : "opacity-0 scale-[0.97] pointer-events-none"
              }`}
            >
              {/* Sidebar Inboria */}
              <div className="hidden md:flex flex-col w-[176px] border-r border-[#1f2937] bg-[#0d1117]">
                <div className="flex items-center justify-center px-3 h-14 border-b border-[#1f2937]">
                  <img src={appLogo} alt="Inboria" className="h-9 w-auto object-contain" />
                </div>
                <nav className="flex-1 px-2 py-2 space-y-px overflow-hidden">
                  {INBORIA_NAV.map((item) => (
                    <div
                      key={item.i18n}
                      className={`flex items-center gap-1.5 px-2 py-[5px] rounded-md text-[10px] font-medium ${
                        item.active ? "bg-[#1e3a5f] text-[#2d7dd2]" : "text-[#b8c5d6]"
                      }`}
                    >
                      <item.icon className={`w-3 h-3 shrink-0 ${item.active ? "text-[#2d7dd2]" : "text-[#b8c5d6]"}`} />
                      <span className="truncate">{t(item.i18n)}</span>
                    </div>
                  ))}
                </nav>
              </div>

              {/* Contenu app — la boîte triée par Inboria */}
              <div className="flex-1 flex flex-col min-w-0">
                {/* Topbar app — vrai header Inboria (accent cyan/bleu) */}
                <div className="flex items-center gap-2 px-4 h-14 border-b border-[#1f2937]">
                  <div className="flex-1" />
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-cyan-500/[0.08] border border-cyan-400/20 text-[11px] font-medium text-cyan-200 shrink-0">
                    <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-cyan-500/15 border border-cyan-400/30">
                      <Sparkles className="w-2.5 h-2.5 text-cyan-300" />
                    </span>
                    <span className="hidden sm:inline">{t(`${D}.ask`)}</span>
                  </div>
                  <div className="hidden sm:flex items-center justify-center h-7 w-7 rounded-lg border border-[#1f2937] bg-[#141c2b] text-[#b8c5d6] shrink-0"><Bell className="w-3.5 h-3.5" /></div>
                  <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#1f2937] bg-[#141c2b] text-[11px] font-medium text-[#b8c5d6] shrink-0">
                    <Sparkles className="w-3 h-3 text-cyan-300" />
                    <span className="max-w-[180px] truncate">{t(`${D}.autopilotPill`)}</span>
                  </div>
                  <div className="hidden sm:flex items-center justify-center h-7 w-7 rounded-lg border border-[#1f2937] bg-[#141c2b] text-[#b8c5d6] shrink-0"><Sun className="w-3.5 h-3.5" /></div>
                  <div className="hidden sm:flex items-center justify-center h-7 px-2 rounded-lg border border-[#1f2937] bg-[#141c2b] text-[10px] font-medium text-[#b8c5d6] shrink-0">{langBadge}</div>
                  <div className="flex items-center justify-center h-7 w-7 rounded-full bg-[#1e3a5f] text-[11px] font-semibold text-[#2d7dd2] shrink-0">J</div>
                </div>

                {/* Barre d'actions */}
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#1f2937]">
                  <div className="flex-1 flex items-center gap-2 bg-[#141c2b] border border-[#1f2937] rounded-lg px-3 py-1.5 min-w-0 max-w-[280px]">
                    <Search className="w-3.5 h-3.5 text-[#b8c5d6] shrink-0" />
                    <span className="text-[11px] text-[#b8c5d6] truncate">{t(`${D}.searchPlaceholder`)}</span>
                  </div>
                  <div className="hidden md:flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-[#1f2937] bg-[#141c2b] text-[10px] font-medium text-[#b8c5d6]">
                    <RefreshCw className="w-3 h-3" /> {t(`${D}.refresh`)}
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-[#2d7dd2] text-[10px] font-medium text-white">
                    <Plus className="w-3 h-3" /> <span className="hidden sm:inline">{t(`${D}.newEmail`)}</span>
                  </div>
                </div>

                {/* Bandeau autopilote — la valeur produit en une phrase */}
                <div className="mx-4 mt-3 flex items-center gap-2 rounded-lg border border-cyan-400/25 bg-cyan-500/[0.08] px-3 py-2">
                  <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-cyan-500/15 border border-cyan-400/30 shrink-0">
                    <Sparkles className="w-3 h-3 text-cyan-300" />
                  </span>
                  <p className="text-[11px] text-[#cdd6e4] leading-snug">
                    <b className="text-cyan-200">{t(`${D}.bannerBold`)}</b> {t(`${D}.bannerRest`)}
                  </p>
                </div>

                {/* Boîte de réception triée — chaque ligne porte la couleur de sa
                    catégorie ; entrée en cascade à chaque ouverture (effet « tri »). */}
                <div className="flex-1 overflow-hidden px-3 pt-2.5 pb-3">
                  {INBOX_META.map((meta, i) => {
                    const m = inbox[i];
                    if (!m) return null;
                    return (
                      <div
                        key={i}
                        className="relative flex items-center gap-2.5 h-[42px] pl-2 pr-2 rounded-md border-l-2 transition-all duration-500 ease-out"
                        style={{
                          borderLeftColor: meta.color,
                          backgroundColor: i === 0 ? "rgba(45,125,210,0.10)" : "transparent",
                          opacity: appOpen ? 1 : 0,
                          transform: appOpen ? "translateY(0)" : "translateY(8px)",
                          transitionDelay: appOpen ? `${i * 70}ms` : "0ms",
                        }}
                      >
                        <span
                          className="flex items-center justify-center h-7 w-7 rounded-full text-[11px] font-semibold shrink-0"
                          style={{ backgroundColor: `${meta.color}26`, color: meta.color, border: `1px solid ${meta.color}4d` }}
                        >
                          {m.from.charAt(0)}
                        </span>
                        <span className={`w-[118px] text-[12px] truncate shrink-0 ${meta.unread ? "text-[#e7ecf5] font-semibold" : "text-[#7a8290] font-normal"}`}>
                          {m.from}
                        </span>
                        <span className="flex-1 min-w-0 flex items-center gap-1.5">
                          {meta.urgent && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-[9px] font-medium shrink-0">
                              <span className="w-1 h-1 rounded-full bg-red-500" /> {t(`${D}.urgent`)}
                            </span>
                          )}
                          <span className={`text-[12px] truncate shrink-0 max-w-[230px] ${meta.unread ? "text-[#e7ecf5] font-medium" : "text-[#8b95a7]"}`}>
                            {m.subject}
                          </span>
                          <span className="text-[11px] text-[#5a6270] truncate hidden lg:inline">— {m.preview}</span>
                        </span>
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0 hidden sm:inline"
                          style={{ backgroundColor: `${meta.color}1f`, color: meta.color }}
                        >
                          {m.cat}
                        </span>
                        <span className="text-[10px] tabular-nums text-[#7a8290] w-8 text-right shrink-0">{meta.n} {t(`${D}.dateUnits.${meta.u}`)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        <p className="text-center mt-4 text-[11px] text-[#5a6270]">
          {t(`${D}.caption`)}
        </p>
      </div>
    </div>
  );
}
