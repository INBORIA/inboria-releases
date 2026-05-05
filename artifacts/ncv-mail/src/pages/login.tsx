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
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function Login() {
  const { t } = useTranslation();
  const [_, setLocation] = useLocation();
  const searchString = useSearch();
  const { toast } = useToast();
  const { signIn } = useAuth();
  const [isPending, setIsPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const loginSchema = z.object({
    email: z.string().email(t("auth.invalidEmail")),
    password: z.string().min(1, t("auth.passwordRequired")),
  });

  type LoginFormValues = z.infer<typeof loginSchema>;

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema as any),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(data: LoginFormValues) {
    setIsPending(true);
    const { error } = await signIn(data.email, data.password);
    setIsPending(false);

    if (error) {
      toast({
        variant: "destructive",
        title: t("auth.loginError"),
        description: error || t("auth.checkCredentials"),
      });
    } else {
      const params = new URLSearchParams(searchString);
      const redirectPath = params.get("redirect");
      const plan = params.get("plan");
      const seats = params.get("seats");
      if (redirectPath) {
        setLocation(redirectPath);
      } else if (plan) {
        const redirect = new URLSearchParams();
        redirect.set("plan", plan);
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
        <h1 className="text-2xl font-bold text-white">{t("auth.welcome")}</h1>
        <p className="text-[#b8c5d6] mt-2 text-sm">{t("auth.loginSubtitle")}</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[#b8c5d6]">{t("auth.email")}</FormLabel>
                <FormControl>
                  <Input placeholder={t("auth.emailPlaceholder")} type="email" className="bg-background border-border text-white" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel className="text-[#b8c5d6]">{t("auth.password")}</FormLabel>
                  <Link href="/mot-de-passe-oublie" className="text-xs text-primary hover:text-primary/80 font-medium" tabIndex={-1}>
                    {t("auth.forgotPassword")}
                  </Link>
                </div>
                <FormControl>
                  <div className="relative">
                    <Input type={showPassword ? "text" : "password"} placeholder="" className="bg-background border-border text-white pr-10" {...field} />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#b8c5d6] hover:text-white transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
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
            {isPending ? t("auth.loggingIn") : t("auth.loginButton")}
          </Button>
        </form>
      </Form>

      <div className="mt-6 text-center text-sm text-[#b8c5d6]">
        {t("auth.noAccount")}{" "}
        <Link href={`/signup${searchString ? `?${searchString}` : ""}`} className="font-semibold text-primary hover:text-primary/80">
          {t("auth.createAccount")}
        </Link>
      </div>
    </AuthLayout>
  );
}
