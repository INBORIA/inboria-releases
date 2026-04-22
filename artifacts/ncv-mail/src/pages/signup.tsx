import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/lib/auth";
import { Link, useLocation, useSearch } from "wouter";
import { AuthLayout } from "@/components/layout/auth-layout";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useState, useMemo } from "react";
import { Eye, EyeOff, Globe } from "lucide-react";
import { EU_EEE_COUNTRIES } from "@/data/eu-countries";
import { useTranslation } from "react-i18next";
import { isPaymentsEnabled } from "@/lib/feature-flags";

export default function Signup() {
  const { t } = useTranslation();
  const [_, setLocation] = useLocation();
  const searchString = useSearch();
  const { toast } = useToast();
  const { signUp } = useAuth();
  const [isPending, setIsPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const params = new URLSearchParams(searchString);
  const rawSelectedPlan = params.get("plan");
  const selectedPlan = isPaymentsEnabled() ? rawSelectedPlan : null;
  const prefillEmail = params.get("email") || "";

  function getPasswordStrength(password: string) {
    const checks = [
      { label: t("auth.passwordStrength.min8"), passed: password.length >= 8 },
      { label: t("auth.passwordStrength.uppercase"), passed: /[A-Z]/.test(password) },
      { label: t("auth.passwordStrength.lowercase"), passed: /[a-z]/.test(password) },
      { label: t("auth.passwordStrength.digit"), passed: /[0-9]/.test(password) },
      { label: t("auth.passwordStrength.special"), passed: /[^A-Za-z0-9]/.test(password) },
    ];
    const score = checks.filter(c => c.passed).length;
    const label = score <= 1 ? t("auth.passwordStrength.veryWeak") : score === 2 ? t("auth.passwordStrength.weak") : score === 3 ? t("auth.passwordStrength.medium") : score === 4 ? t("auth.passwordStrength.strong") : t("auth.passwordStrength.excellent");
    const color = score <= 1 ? "bg-red-500" : score === 2 ? "bg-orange-500" : score === 3 ? "bg-yellow-500" : score === 4 ? "bg-lime-500" : "bg-emerald-500";
    return { score, label, color, checks };
  }

  const allowedCodes = EU_EEE_COUNTRIES.map((c) => c.code) as unknown as [string, ...string[]];

  const signupSchema = z.object({
    fullName: z.string().min(2, t("auth.fullNameRequired")),
    email: z.string().email(t("auth.invalidEmail")),
    country: z.enum(allowedCodes, { errorMap: () => ({ message: t("auth.selectCountry") }) }),
    password: z.string()
      .min(8, t("auth.passwordValidation.min8"))
      .regex(/[A-Z]/, t("auth.passwordValidation.uppercase"))
      .regex(/[a-z]/, t("auth.passwordValidation.lowercase"))
      .regex(/[0-9]/, t("auth.passwordValidation.digit"))
      .regex(/[^A-Za-z0-9]/, t("auth.passwordValidation.special")),
    confirmPassword: z.string().min(1, t("auth.confirmPasswordRequired")),
  }).refine((data) => data.password === data.confirmPassword, {
    message: t("auth.passwordsNoMatch"),
    path: ["confirmPassword"],
  });

  type SignupFormValues = z.infer<typeof signupSchema>;

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema as any),
    defaultValues: {
      fullName: "",
      email: prefillEmail,
      country: "" as any,
      password: "",
      confirmPassword: "",
    },
  });

  const watchedPassword = form.watch("password");
  const strength = useMemo(() => getPasswordStrength(watchedPassword || ""), [watchedPassword, t]);

  async function onSubmit(data: SignupFormValues) {
    setIsPending(true);
    const { error, needsVerification } = await signUp(data.email, data.password, data.fullName, data.country);
    setIsPending(false);

    if (error) {
      toast({
        variant: "destructive",
        title: t("auth.signupError"),
        description: error,
      });
    } else {
      toast({
        title: t("auth.accountCreated"),
        description: t("auth.accountCreatedDesc"),
      });
      const redirectPath = params.get("redirect");
      if (redirectPath) {
        setLocation(redirectPath);
      } else if (selectedPlan && selectedPlan !== "essai") {
        const redirect = new URLSearchParams();
        redirect.set("plan", selectedPlan);
        const seats = params.get("seats");
        if (seats) redirect.set("seats", seats);
        setLocation(`/dashboard/abonnement?${redirect.toString()}`);
      } else {
        setLocation("/dashboard");
      }
    }
  }

  return (
    <AuthLayout>
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-white">{t("auth.signupTitle")}</h1>
        <p className="text-[#8b9cb3] mt-2 text-sm">
          {selectedPlan && selectedPlan !== "essai"
            ? t("auth.signupForPlan", { plan: selectedPlan.charAt(0).toUpperCase() + selectedPlan.slice(1) })
            : t("auth.signupSubtitle")}
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="fullName"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[#8b9cb3]">{t("auth.fullName")}</FormLabel>
                <FormControl>
                  <Input placeholder={t("auth.fullNamePlaceholder")} className="bg-background border-border text-white" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[#8b9cb3]">{t("auth.professionalEmail")}</FormLabel>
                <FormControl>
                  <Input placeholder={t("auth.professionalEmailPlaceholder")} type="email" className="bg-background border-border text-white" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="country"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[#8b9cb3]">{t("auth.country")}</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8b9cb3] pointer-events-none" />
                    <select
                      {...field}
                      className="w-full h-10 pl-9 pr-3 rounded-md border border-border bg-background text-white text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
                    >
                      <option value="" disabled className="text-[#8b9cb3]">{t("auth.selectCountry")}</option>
                      {EU_EEE_COUNTRIES.map((c) => (
                        <option key={c.code} value={c.code} className="bg-[#141c2b] text-white">
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </FormControl>
                <p className="text-[10px] text-[#8b9cb3]/60 mt-1">
                  {t("auth.countryAvailability")}
                </p>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[#8b9cb3]">{t("auth.password")}</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input type={showPassword ? "text" : "password"} placeholder="" className="bg-background border-border text-white pr-10" {...field} />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8b9cb3] hover:text-white transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </FormControl>
                {watchedPassword && watchedPassword.length > 0 && (
                  <div className="space-y-2 mt-2">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${i <= strength.score ? strength.color : "bg-white/10"}`} />
                      ))}
                    </div>
                    <p className={`text-[11px] font-medium ${strength.score <= 1 ? "text-red-400" : strength.score === 2 ? "text-orange-400" : strength.score === 3 ? "text-yellow-400" : strength.score === 4 ? "text-lime-400" : "text-emerald-400"}`}>
                      {strength.label}
                    </p>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                      {strength.checks.map((check) => (
                        <p key={check.label} className={`text-[10px] ${check.passed ? "text-emerald-400" : "text-[#8b9cb3]"}`}>
                          {check.passed ? "✓" : "○"} {check.label}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[#8b9cb3]">{t("auth.confirmPassword")}</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="" className="bg-background border-border text-white" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button
            type="submit"
            className="w-full"
            disabled={isPending}
          >
            {isPending ? t("auth.creatingAccount") : t("auth.createMyAccount")}
          </Button>
        </form>
      </Form>

      <div className="mt-4 text-center text-[10px] text-[#8b9cb3] leading-relaxed">
        {t("auth.termsAccept")}{" "}
        <Link href="/conditions" className="text-[#2d7dd2] hover:underline">
          {t("auth.termsLink")}
        </Link>{" "}
        {t("auth.andOur")}{" "}
        <Link href="/confidentialite" className="text-[#2d7dd2] hover:underline">
          {t("auth.privacyLink")}
        </Link>
      </div>

      <div className="mt-4 text-center text-sm text-[#8b9cb3]">
        {t("auth.alreadyAccount")}{" "}
        <Link href={`/login${searchString ? `?${searchString}` : ""}`} className="font-semibold text-primary hover:text-primary/80">
          {t("auth.loginButton")}
        </Link>
      </div>
    </AuthLayout>
  );
}
