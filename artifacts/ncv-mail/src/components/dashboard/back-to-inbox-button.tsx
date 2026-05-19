import { Link, useSearch } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

export function useSmartBack(defaultHref: string = "/dashboard", defaultLabelKey: string = "common.back", defaultLabelFallback?: string) {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const from = params.get("from");
  if (from === "admin") {
    return {
      href: "/dashboard/parametres/administration",
      labelKey: "settings.hub.administration",
      labelFallback: "Administration",
    };
  }
  if (from === "settings") {
    return {
      href: "/dashboard/parametres",
      labelKey: "settings.title",
      labelFallback: "Paramètres",
    };
  }
  return {
    href: defaultHref,
    labelKey: defaultLabelKey,
    labelFallback: defaultLabelFallback ?? "",
  };
}

export function BackToInboxButton() {
  const { t } = useTranslation();
  const back = useSmartBack();
  return (
    <div className="mb-3">
      <Link href={back.href}>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-[#b8c5d6] hover:text-white hover:bg-white/[0.06] text-[12px]"
          data-testid="smart-back"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1" />
          {t(back.labelKey, back.labelFallback || t("common.back"))}
        </Button>
      </Link>
    </div>
  );
}
