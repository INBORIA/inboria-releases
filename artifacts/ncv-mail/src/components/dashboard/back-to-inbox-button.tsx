import { Link, useSearch } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

export function useSmartBack(defaultHref: string = "/dashboard", _defaultLabelKey?: string, _defaultLabelFallback?: string) {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const from = params.get("from");
  let href = defaultHref;
  if (from === "admin") href = "/dashboard/parametres/administration";
  else if (from === "settings") href = "/dashboard/parametres";
  return {
    href,
    labelKey: "common.back",
    labelFallback: "Retour",
  };
}

export function BackToInboxButton({ iconOnly = false }: { iconOnly?: boolean } = {}) {
  const { t } = useTranslation();
  const back = useSmartBack();
  const label = t(back.labelKey, back.labelFallback || t("common.back"));
  return (
    <div className="mb-3">
      <Link href={back.href}>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-[#b8c5d6] hover:text-white hover:bg-white/[0.06] text-[12px]"
          data-testid="smart-back"
          aria-label={iconOnly ? label : undefined}
          title={iconOnly ? label : undefined}
        >
          <ArrowLeft className={iconOnly ? "w-3.5 h-3.5" : "w-3.5 h-3.5 mr-1"} />
          {!iconOnly && label}
        </Button>
      </Link>
    </div>
  );
}
