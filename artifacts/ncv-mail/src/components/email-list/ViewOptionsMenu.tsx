import { useTranslation } from "react-i18next";
import { SlidersHorizontal, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useMailDensity, type MailDensity } from "@/lib/use-mail-density";
import { useReadingPanePosition, type ReadingPanePosition } from "@/lib/use-reading-pane";

export function ViewOptionsMenu() {
  const { t } = useTranslation();
  const [density, setDensity] = useMailDensity();
  const [position, setPosition] = useReadingPanePosition();

  const densityOptions: { value: MailDensity; label: string }[] = [
    { value: "compact", label: t("inbox.density.compact", "Compact") },
    { value: "normal", label: t("inbox.density.normal", "Normal") },
    { value: "comfortable", label: t("inbox.density.comfortable", "Confortable") },
  ];

  const positionOptions: { value: ReadingPanePosition; label: string }[] = [
    { value: "right", label: t("inbox.readingPanePos.right", "À droite") },
    { value: "bottom", label: t("inbox.readingPanePos.bottom", "En bas") },
    { value: "off", label: t("inbox.readingPanePos.off", "Masqué") },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center h-9 w-9 rounded-md border border-[#1f2630] shrink-0 text-[#b8c5d6] hover:text-white hover:bg-white/[0.04]"
          title={t("inbox.viewOptions", "Options d'affichage")}
          aria-label={t("inbox.viewOptions", "Options d'affichage")}
          data-testid="view-options-trigger"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-card border-border w-56">
        <DropdownMenuLabel className="text-[11px] text-[#8b95a7]">
          {t("inbox.density.label", "Densité d'affichage")}
        </DropdownMenuLabel>
        {densityOptions.map((opt) => (
          <DropdownMenuItem
            key={opt.value}
            onSelect={() => setDensity(opt.value)}
            className="text-[13px] flex items-center justify-between"
            data-testid={`density-${opt.value}`}
          >
            <span>{opt.label}</span>
            {density === opt.value && <Check className="w-3.5 h-3.5 text-primary" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[11px] text-[#8b95a7]">
          {t("inbox.readingPanePos.label", "Volet de lecture")}
        </DropdownMenuLabel>
        {positionOptions.map((opt) => (
          <DropdownMenuItem
            key={opt.value}
            onSelect={() => setPosition(opt.value)}
            className="text-[13px] flex items-center justify-between"
            data-testid={`pane-${opt.value}`}
          >
            <span>{opt.label}</span>
            {position === opt.value && <Check className="w-3.5 h-3.5 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
