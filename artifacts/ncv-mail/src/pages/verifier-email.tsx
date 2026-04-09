import { AuthLayout } from "@/components/layout/auth-layout";
import { Link, useSearch } from "wouter";
import { Mail, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

export default function VerifierEmail() {
  const { t } = useTranslation();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const email = params.get("email") || "";
  const [resending, setResending] = useState(false);
  const { toast } = useToast();

  const handleResend = async () => {
    if (!email) return;
    setResending(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
    });
    setResending(false);
    if (error) {
      toast({
        variant: "destructive",
        title: t("common.error"),
        description: t("auth.resendError"),
      });
    } else {
      toast({
        title: t("auth.emailResent"),
        description: t("auth.emailResentDesc"),
      });
    }
  };

  return (
    <AuthLayout>
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-[#2d7dd2]/10 flex items-center justify-center">
            <Mail className="w-8 h-8 text-[#2d7dd2]" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-white">{t("auth.verifyEmailTitle")}</h1>

        <p className="text-[#8b9cb3] text-sm leading-relaxed">
          {t("auth.verifyEmailDesc")}
          {email && (
            <>
              <br />
              <span className="text-white font-medium">{email}</span>
            </>
          )}
        </p>

        <div className="bg-[#0d1117] rounded-lg border border-[#1f2937] p-4 text-left space-y-2">
          <p className="text-[12px] text-[#8b9cb3]">
            1. {t("auth.verifyStep1")}
          </p>
          <p className="text-[12px] text-[#8b9cb3]">
            2. {t("auth.verifyStep2")}
          </p>
          <p className="text-[12px] text-[#8b9cb3]">
            3. {t("auth.verifyStep3")}
          </p>
        </div>

        <p className="text-[11px] text-[#8b9cb3]">
          {t("auth.cantFindEmail")}{" "}
          <button
            onClick={handleResend}
            disabled={resending || !email}
            className="text-[#2d7dd2] hover:underline disabled:opacity-50"
          >
            {resending ? t("auth.resending") : t("auth.resendEmail")}
          </button>
        </p>

        <div className="pt-2">
          <Link href="/login">
            <Button variant="ghost" size="sm" className="text-[#8b9cb3] hover:text-white">
              <ArrowLeft className="w-4 h-4 mr-1" />
              {t("auth.backToLogin")}
            </Button>
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}
