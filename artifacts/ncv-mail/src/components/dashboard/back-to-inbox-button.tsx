import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

export function BackToInboxButton() {
  const { t } = useTranslation();
  return (
    <div className="mb-3">
      <Link href="/dashboard">
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("inbox.title")}
          title={t("inbox.title")}
          className="h-7 w-7 text-[#b8c5d6] hover:text-white hover:bg-white/[0.06]"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
      </Link>
    </div>
  );
}
