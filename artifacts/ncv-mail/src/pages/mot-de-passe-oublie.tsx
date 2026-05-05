import { useState } from "react";
import { Link } from "wouter";
import { AuthLayout } from "@/components/layout/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Mail, ArrowLeft, CheckCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function MotDePasseOublie() {
  const { t, i18n } = useTranslation();
  const [email, setEmail] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;

    setIsPending(true);
    try {
      const origin = window.location.origin;
      const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
      const redirectTo = `${origin}${basePath}/reset-password`;
      const lang = (i18n.resolvedLanguage || i18n.language || "fr").slice(0, 2).toLowerCase();

      const resp = await fetch(`${import.meta.env.BASE_URL}api/auth/send-password-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, redirectTo, lang }),
      });

      if (!resp.ok) {
        toast({
          variant: "destructive",
          title: t("common.error"),
          description: t("auth.resetEmailSentDesc"),
        });
      } else {
        setSent(true);
      }
    } catch {
      toast({
        variant: "destructive",
        title: t("common.error"),
        description: t("auth.resetEmailSentDesc"),
      });
    } finally {
      setIsPending(false);
    }
  }

  if (sent) {
    return (
      <AuthLayout>
        <div className="text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
            <CheckCircle className="w-7 h-7 text-emerald-400" />
          </div>
          <h1 className="text-xl font-bold text-white">{t("auth.resetEmailSent")}</h1>
          <p className="text-sm text-[#b8c5d6] leading-relaxed">
            {t("auth.resetEmailSentIfExists", { email }).replace(/<1>|<\/1>/g, "")}
          </p>
          <p className="text-xs text-[#b8c5d6]">
            {t("auth.checkSpam")}
          </p>
          <div className="pt-2">
            <Link href="/login" className="text-sm text-primary hover:text-primary/80 font-semibold">
              {t("auth.backToLogin")}
            </Link>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="mb-6 text-center">
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Mail className="w-7 h-7 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-white">{t("auth.forgotPasswordTitle")}</h1>
        <p className="text-[#b8c5d6] mt-2 text-sm">
          {t("auth.forgotPasswordSubtitle")}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-[12px] text-[#b8c5d6]">{t("auth.emailAddress")}</Label>
          <Input
            type="email"
            placeholder={t("auth.emailPlaceholder")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-background border-border text-white"
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={isPending || !email}>
          {isPending ? t("auth.sending") : t("auth.sendResetLink")}
        </Button>
      </form>

      <div className="mt-6 text-center">
        <Link href="/login" className="text-sm text-[#b8c5d6] hover:text-white inline-flex items-center gap-1.5 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
          {t("auth.backToLogin")}
        </Link>
      </div>
    </AuthLayout>
  );
}
