import { AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

export default function NotFound() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <div className="w-full max-w-md mx-4 text-center">
        <div className="bg-card rounded-xl border border-border p-10">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">{t("auth.pageNotFound")}</h1>
          <p className="text-sm text-muted-foreground mb-6">
            {t("auth.pageNotFoundDesc")}
          </p>
          <Link href="/dashboard">
            <Button size="sm">{t("auth.backToDashboard")}</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
