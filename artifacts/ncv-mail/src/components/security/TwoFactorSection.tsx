import { useState, useEffect, useCallback } from "react";
import { ShieldCheck, Loader2, Copy, Check, AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

type Factor = {
  id: string;
  factor_type: string;
  status: string;
  friendly_name?: string | null;
};

type EnrollmentDraft = {
  factorId: string;
  qrCodeSvg: string;
  secret: string;
  uri: string;
};

export function TwoFactorSection() {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [verifiedFactor, setVerifiedFactor] = useState<Factor | null>(null);

  // Enrollment modal state
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [enrollment, setEnrollment] = useState<EnrollmentDraft | null>(null);
  const [enrollCode, setEnrollCode] = useState("");
  const [enrollPending, setEnrollPending] = useState(false);
  const [enrollStarting, setEnrollStarting] = useState(false);
  const [secretCopied, setSecretCopied] = useState(false);

  // Disable modal state
  const [disableOpen, setDisableOpen] = useState(false);
  const [disableCode, setDisableCode] = useState("");
  const [disablePending, setDisablePending] = useState(false);

  const refreshFactors = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      const totp = (data?.totp ?? []) as Factor[];
      const verified = totp.find((f) => f.status === "verified") ?? null;
      setVerifiedFactor(verified);

      // Clean up any orphaned unverified factor from a previous abandoned
      // enrollment so we always start fresh.
      const orphan = totp.find(
        (f) => f.status !== "verified" && f.id !== verified?.id,
      );
      if (orphan && !enrollOpen) {
        try {
          await supabase.auth.mfa.unenroll({ factorId: orphan.id });
        } catch {
          // best-effort cleanup
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({
        variant: "destructive",
        title: t("settings.twoFactor.loadError"),
        description: msg,
      });
    } finally {
      setLoading(false);
    }
  }, [toast, t, enrollOpen]);

  useEffect(() => {
    void refreshFactors();
  }, [refreshFactors]);

  async function startEnrollment() {
    setEnrollStarting(true);
    try {
      // If a stale unverified factor exists, drop it first.
      const { data: list } = await supabase.auth.mfa.listFactors();
      const stale = (list?.totp ?? []).find((f) => f.status !== "verified");
      if (stale) {
        await supabase.auth.mfa.unenroll({ factorId: stale.id });
      }

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `Inboria-${new Date().toISOString().slice(0, 10)}`,
      });
      if (error) throw error;
      if (!data || !("totp" in data) || !data.totp) {
        throw new Error("Réponse d'enrôlement invalide");
      }
      setEnrollment({
        factorId: data.id,
        qrCodeSvg: data.totp.qr_code,
        secret: data.totp.secret,
        uri: data.totp.uri,
      });
      setEnrollCode("");
      setSecretCopied(false);
      setEnrollOpen(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({
        variant: "destructive",
        title: t("settings.twoFactor.enrollError"),
        description: msg,
      });
    } finally {
      setEnrollStarting(false);
    }
  }

  async function confirmEnrollment() {
    if (!enrollment) return;
    const code = enrollCode.replace(/\s+/g, "").trim();
    if (!/^\d{6}$/.test(code)) {
      toast({
        variant: "destructive",
        title: t("settings.twoFactor.invalidCode"),
        description: t("settings.twoFactor.codeFormat"),
      });
      return;
    }
    setEnrollPending(true);
    try {
      const { data: chal, error: chalErr } = await supabase.auth.mfa.challenge({
        factorId: enrollment.factorId,
      });
      if (chalErr || !chal) throw chalErr ?? new Error("Challenge failed");

      const { error: verErr } = await supabase.auth.mfa.verify({
        factorId: enrollment.factorId,
        challengeId: chal.id,
        code,
      });
      if (verErr) throw verErr;

      toast({
        title: t("settings.twoFactor.enabledTitle"),
        description: t("settings.twoFactor.enabledDesc"),
      });
      setEnrollOpen(false);
      setEnrollment(null);
      setEnrollCode("");
      await refreshFactors();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({
        variant: "destructive",
        title: t("settings.twoFactor.invalidCode"),
        description: msg,
      });
    } finally {
      setEnrollPending(false);
    }
  }

  async function cancelEnrollment() {
    if (enrollment) {
      try {
        await supabase.auth.mfa.unenroll({ factorId: enrollment.factorId });
      } catch {
        // best-effort
      }
    }
    setEnrollOpen(false);
    setEnrollment(null);
    setEnrollCode("");
  }

  async function confirmDisable() {
    if (!verifiedFactor) return;
    const code = disableCode.replace(/\s+/g, "").trim();
    if (!/^\d{6}$/.test(code)) {
      toast({
        variant: "destructive",
        title: t("settings.twoFactor.invalidCode"),
        description: t("settings.twoFactor.codeFormat"),
      });
      return;
    }
    setDisablePending(true);
    try {
      // Re-prove identity with a fresh TOTP challenge before unenrolling.
      const { data: chal, error: chalErr } = await supabase.auth.mfa.challenge({
        factorId: verifiedFactor.id,
      });
      if (chalErr || !chal) throw chalErr ?? new Error("Challenge failed");

      const { error: verErr } = await supabase.auth.mfa.verify({
        factorId: verifiedFactor.id,
        challengeId: chal.id,
        code,
      });
      if (verErr) throw verErr;

      const { error: unErr } = await supabase.auth.mfa.unenroll({
        factorId: verifiedFactor.id,
      });
      if (unErr) throw unErr;

      toast({
        title: t("settings.twoFactor.disabledTitle"),
        description: t("settings.twoFactor.disabledDesc"),
      });
      setDisableOpen(false);
      setDisableCode("");
      await refreshFactors();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({
        variant: "destructive",
        title: t("settings.twoFactor.invalidCode"),
        description: msg,
      });
    } finally {
      setDisablePending(false);
    }
  }

  function copySecret() {
    if (!enrollment) return;
    navigator.clipboard
      .writeText(enrollment.secret)
      .then(() => {
        setSecretCopied(true);
        setTimeout(() => setSecretCopied(false), 2000);
      })
      .catch(() => {
        /* ignore */
      });
  }

  function handleToggle(checked: boolean) {
    if (loading || enrollStarting || disablePending) return;
    if (checked && !verifiedFactor) {
      void startEnrollment();
    } else if (!checked && verifiedFactor) {
      setDisableCode("");
      setDisableOpen(true);
    }
  }

  const isEnabled = !!verifiedFactor;

  return (
    <section>
      <h2 className="text-[14px] font-semibold text-white flex items-center gap-2 mb-3">
        <ShieldCheck className="w-4 h-4 text-primary" />
        {t("settings.twoFactor.title")}
      </h2>
      <div className="bg-card rounded-lg border border-border p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <Label className="text-[12px] text-white">
              {t("settings.twoFactor.toggleLabel")}
            </Label>
            <p className="text-[11px] text-[#b8c5d6] mt-1 leading-relaxed">
              {t("settings.twoFactor.description")}
            </p>
            {isEnabled && (
              <p className="text-[11px] text-emerald-400 mt-2 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" />
                {t("settings.twoFactor.activeBadge")}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {(loading || enrollStarting) && (
              <Loader2 className="w-3.5 h-3.5 text-[#b8c5d6] animate-spin" />
            )}
            <Switch
              checked={isEnabled}
              onCheckedChange={handleToggle}
              disabled={loading || enrollStarting}
              data-testid="switch-2fa"
            />
          </div>
        </div>
      </div>

      {/* Enrollment modal */}
      <Dialog
        open={enrollOpen}
        onOpenChange={(o) => {
          if (!o) void cancelEnrollment();
        }}
      >
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white text-[15px]">
              {t("settings.twoFactor.enrollTitle")}
            </DialogTitle>
            <DialogDescription className="text-[#b8c5d6] text-[12px]">
              {t("settings.twoFactor.enrollIntro")}
            </DialogDescription>
          </DialogHeader>
          {enrollment && (
            <div className="space-y-4">
              <div className="bg-white p-3 rounded-md mx-auto w-fit">
                <div
                  className="w-44 h-44"
                  // Supabase returns a self-contained SVG string. We display
                  // it as-is — this is trusted content from the auth provider.
                  dangerouslySetInnerHTML={{ __html: enrollment.qrCodeSvg }}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] text-[#b8c5d6]">
                  {t("settings.twoFactor.secretLabel")}
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={enrollment.secret}
                    className="bg-background border-border text-white h-9 text-[12px] font-mono"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={copySecret}
                    className="shrink-0 h-9"
                  >
                    {secretCopied ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </Button>
                </div>
                <p className="text-[10px] text-[#b8c5d6]">
                  {t("settings.twoFactor.secretHint")}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] text-[#b8c5d6]">
                  {t("settings.twoFactor.codeLabel")}
                </Label>
                <Input
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  autoComplete="one-time-code"
                  value={enrollCode}
                  onChange={(e) =>
                    setEnrollCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  className="bg-background border-border text-white h-10 text-center text-[16px] tracking-[0.4em] font-mono"
                  placeholder="000000"
                  data-testid="input-2fa-enroll-code"
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void cancelEnrollment()}
              disabled={enrollPending}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void confirmEnrollment()}
              disabled={enrollPending || enrollCode.length !== 6}
              data-testid="button-2fa-enroll-confirm"
            >
              {enrollPending && (
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
              )}
              {t("settings.twoFactor.confirmEnable")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disable modal */}
      <Dialog
        open={disableOpen}
        onOpenChange={(o) => {
          if (!o) {
            setDisableOpen(false);
            setDisableCode("");
          }
        }}
      >
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white text-[15px] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              {t("settings.twoFactor.disableTitle")}
            </DialogTitle>
            <DialogDescription className="text-[#b8c5d6] text-[12px]">
              {t("settings.twoFactor.disableIntro")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-[11px] text-[#b8c5d6]">
              {t("settings.twoFactor.codeLabel")}
            </Label>
            <Input
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              autoComplete="one-time-code"
              value={disableCode}
              onChange={(e) =>
                setDisableCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              className="bg-background border-border text-white h-10 text-center text-[16px] tracking-[0.4em] font-mono"
              placeholder="000000"
              data-testid="input-2fa-disable-code"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setDisableOpen(false);
                setDisableCode("");
              }}
              disabled={disablePending}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => void confirmDisable()}
              disabled={disablePending || disableCode.length !== 6}
              data-testid="button-2fa-disable-confirm"
            >
              {disablePending && (
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
              )}
              {t("settings.twoFactor.confirmDisable")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
