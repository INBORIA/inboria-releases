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
          size="sm"
          className="h-7 px-2 text-[#b8c5d6] hover:text-white hover:bg-white/[0.06] text-[12px]"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1" />
          {t("inbox.title")}
        </Button>
      </Link>
    </div>
  );
}
