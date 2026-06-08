import { useEffect } from "react";
import { X } from "lucide-react";
import {
  notifyReadingPaneOpen,
  type ReadingPanePosition,
  type ReadingPaneLayout,
} from "@/lib/use-reading-pane";

interface MailReadingPaneProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  widthClassName?: string;
  position?: ReadingPanePosition;
  layout?: ReadingPaneLayout;
}

export function MailReadingPane({
  open,
  onClose,
  children,
  widthClassName = "w-full sm:w-[560px] lg:w-[600px] xl:w-[680px] 2xl:w-[760px]",
  position = "right",
  layout = "overlay",
}: MailReadingPaneProps) {
  useEffect(() => {
    notifyReadingPaneOpen(open);
    return () => notifyReadingPaneOpen(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Mode « Côte à côte » (split) : on réserve l'espace du volet sur le contenu
  // via des variables CSS posées sur <html> et lues par <main> (dashboard-layout)
  // → la liste se rétrécit au lieu d'être recouverte (rendu 3 colonnes Outlook).
  // La réservation est strictement liée à `open` (donc à la présence réelle d'un
  // mail ouvert) : aucune bande vide ne subsiste si le détail ne se charge pas.
  // À droite : seulement à partir de lg (sinon overlay), largeur suivant les
  // paliers responsives du volet. En bas : 55vh. Reset au démontage.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const apply = () => {
      const split = layout === "split" && open;
      let reserveR = "0px";
      let reserveB = "0px";
      if (split) {
        if (position === "bottom") {
          reserveB = "55vh";
        } else {
          const w = window.innerWidth;
          if (w >= 1536) reserveR = "760px";
          else if (w >= 1280) reserveR = "680px";
          else if (w >= 1024) reserveR = "600px";
        }
      }
      root.style.setProperty("--rp-reserve", reserveR);
      root.style.setProperty("--rp-reserve-b", reserveB);
    };
    apply();
    window.addEventListener("resize", apply);
    return () => {
      window.removeEventListener("resize", apply);
      root.style.setProperty("--rp-reserve", "0px");
      root.style.setProperty("--rp-reserve-b", "0px");
    };
  }, [open, layout, position]);

  const isBottom = position === "bottom";
  // En mode « côte à côte » (split) à droite, le volet démarre sous l'en-tête
  // de l'app (à partir de lg) pour aligner les 3 colonnes façon Outlook.
  const splitTop = layout === "split" ? "lg:top-[var(--app-top,64px)]" : "";
  const frameClassName = isBottom
    ? `fixed left-0 lg:left-[var(--sb-w,0px)] right-0 bottom-0 z-30 bg-background border-t border-border shadow-2xl flex flex-col transition-transform duration-200 ease-out h-[55vh] ${open ? "translate-y-0" : "translate-y-full pointer-events-none"}`
    : `fixed top-0 ${splitTop} right-0 bottom-0 z-30 bg-background border-l border-border shadow-2xl flex flex-col transition-transform duration-200 ease-out ${widthClassName} ${open ? "translate-x-0" : "translate-x-full pointer-events-none"}`;

  return (
    <aside
      aria-hidden={!open}
      className={frameClassName}
      data-testid="mail-reading-pane"
    >
      <div className="flex items-center justify-end h-10 px-2 border-b border-border shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center justify-center h-7 w-7 rounded-md text-[#b8c5d6] hover:text-white hover:bg-white/[0.04]"
          aria-label="Fermer le volet"
          data-testid="mail-reading-pane-close"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">{open ? children : null}</div>
    </aside>
  );
}
