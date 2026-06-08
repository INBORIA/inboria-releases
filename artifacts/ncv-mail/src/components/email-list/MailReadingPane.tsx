import { useEffect } from "react";
import { X } from "lucide-react";
import { notifyReadingPaneOpen, type ReadingPanePosition } from "@/lib/use-reading-pane";

interface MailReadingPaneProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  widthClassName?: string;
  position?: ReadingPanePosition;
}

export function MailReadingPane({
  open,
  onClose,
  children,
  widthClassName = "w-full sm:w-[560px] lg:w-[600px] xl:w-[680px] 2xl:w-[760px]",
  position = "right",
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

  const isBottom = position === "bottom";
  const frameClassName = isBottom
    ? `fixed left-0 lg:left-[var(--sb-w,0px)] right-0 bottom-0 z-30 bg-background border-t border-border shadow-2xl flex flex-col transition-transform duration-200 ease-out h-[55vh] ${open ? "translate-y-0" : "translate-y-full pointer-events-none"}`
    : `fixed top-0 right-0 bottom-0 z-30 bg-background border-l border-border shadow-2xl flex flex-col transition-transform duration-200 ease-out ${widthClassName} ${open ? "translate-x-0" : "translate-x-full pointer-events-none"}`;

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
