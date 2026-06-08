import { useTranslation } from "react-i18next";
import { useRowDragOut } from "@/hooks/use-row-drag-out";

// Avatar rond d'une ligne de mail qui sert AUSSI de poignée pour glisser le
// mail vers le bureau / un dossier (fichier .eml, Chromium). Encapsule le hook
// `useRowDragOut` pour pouvoir l'utiliser dans des listes rendues en `.map`
// inline (où on ne peut pas appeler un hook directement). Reproduit à
// l'identique l'avatar de la Réception (`pages/dashboard/index.tsx`).
export function DragOutAvatar({
  emailId,
  subject,
  letter,
  className = "",
}: {
  emailId: number;
  subject?: string | null;
  letter: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const dragOut = useRowDragOut(emailId, subject);
  return (
    <div
      className={`w-7 h-7 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0 cursor-grab active:cursor-grabbing ${className}`}
      title={t("emailExport.dragHint", "Glisser vers le bureau pour enregistrer en .eml")}
      draggable={dragOut.draggable}
      onDragStart={dragOut.onDragStart}
      onMouseEnter={dragOut.onMouseEnter}
      onPointerDown={dragOut.onPointerDown}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <span className="text-primary text-[11px] font-semibold">{letter}</span>
    </div>
  );
}
