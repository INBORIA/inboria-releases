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

function getPasswordStrength(password: string): { score: number; label: string; color: string; checks: { label: string; passed: boolean }[] } {
  const checks = [
    { label: "8 caracteres minimum", passed: password.length >= 8 },
    { label: "Une lettre majuscule", passed: /[A-Z]/.test(password) },
    { label: "Une lettre minuscule", passed: /[a-z]/.test(password) },
    { label: "Un chiffre", passed: /[0-9]/.test(password) },
    { label: "Un caractere special (!@#$...)", passed: /[^A-Za-z0-9]/.test(password) },
  ];
  const score = checks.filter(c => c.passed).length;
  const label = score <= 1 ? "Tres faible" : score === 2 ? "Faible" : score === 3 ? "Moyen" : score === 4 ? "Fort" : "Excellent";
  const color = score <= 1 ? "bg-red-500" : score === 2 ? "bg-orange-500" : score === 3 ? "bg-yellow-500" : score === 4 ? "bg-lime-500" : "bg-emerald-500";
  return { score, label, color, checks };
}

const allowedCodes = EU_EEE_COUNTRIES.map((c) => c.code) as unknown as [string, ...string[]];

const signupSchema = z.object({
  fullName: z.string().min(2, "Nom complet requis"),
  email: z.string().email("Email invalide"),
  country: z.enum(allowedCodes, { errorMap: () => ({ message: "Veuillez selectionner votre pays" }) }),
  password: z.string()
    .min(8, "Minimum 8 caracteres")
    .regex(/[A-Z]/, "Au moins une majuscule")
    .regex(/[a-z]/, "Au moins une minuscule")
    .regex(/[0-9]/, "Au moins un chiffre")
    .regex(/[^A-Za-z0-9]/, "Au moins un caractere special"),
  confirmPassword: z.string().min(1, "Veuillez confirmer votre mot de passe"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"],
});

type SignupFormValues = z.infer<typeof signupSchema>;

export default function Signup() {
  const [_, setLocation] = useLocation();
  const searchString = useSearch();
  const { toast } = useToast();
  const { signUp } = useAuth();
  const [isPending, setIsPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const params = new URLSearchParams(searchString);
  const selectedPlan = params.get("plan");
  const prefillEmail = params.get("email") || "";

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      fullName: "",
      email: prefillEmail,
      country: "" as any,
      password: "",
      confirmPassword: "",
    },
  });

  const watchedPassword = form.watch("password");
  const strength = useMemo(() => getPasswordStrength(watchedPassword || ""), [watchedPassword]);

  async function onSubmit(data: SignupFormValues) {
    setIsPending(true);
    const { error, needsVerification } = await signUp(data.email, data.password, data.fullName, data.country);
    setIsPending(false);

    if (error) {
      toast({
        variant: "destructive",
        title: "Erreur d'inscription",
        description: error,
      });
    } else {
      toast({
        title: "Compte cree",
        description: "Votre compte a ete cree avec succes.",
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
        <h1 className="text-2xl font-bold text-white">Creer un compte</h1>
        <p className="text-[#8b9cb3] mt-2 text-sm">
          {selectedPlan && selectedPlan !== "essai"
            ? `Inscrivez-vous pour activer le plan ${selectedPlan.charAt(0).toUpperCase() + selectedPlan.slice(1)}`
            : "Rejoignez NCV Mail pour organiser votre boite de reception"}
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="fullName"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[#8b9cb3]">Nom complet</FormLabel>
                <FormControl>
                  <Input placeholder="Jean Dupont" className="bg-background border-border text-white" {...field} />
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
                <FormLabel className="text-[#8b9cb3]">Email professionnel</FormLabel>
                <FormControl>
                  <Input placeholder="jean@entreprise.com" type="email" className="bg-background border-border text-white" {...field} />
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
                <FormLabel className="text-[#8b9cb3]">Pays</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8b9cb3] pointer-events-none" />
                    <select
                      {...field}
                      className="w-full h-10 pl-9 pr-3 rounded-md border border-border bg-background text-white text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
                    >
                      <option value="" disabled className="text-[#8b9cb3]">Selectionnez votre pays</option>
                      {EU_EEE_COUNTRIES.map((c) => (
                        <option key={c.code} value={c.code} className="bg-[#141c2b] text-white">
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </FormControl>
                <p className="text-[10px] text-[#8b9cb3]/60 mt-1">
                  NCV Mail est disponible dans l'Union Europeenne, l'EEE et la Suisse.
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
                <FormLabel className="text-[#8b9cb3]">Mot de passe</FormLabel>
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
                <FormLabel className="text-[#8b9cb3]">Confirmer le mot de passe</FormLabel>
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
            {isPending ? "Creation..." : "Creer mon compte"}
          </Button>
        </form>
      </Form>

      <div className="mt-4 text-center text-[10px] text-[#8b9cb3] leading-relaxed">
        En creant un compte, vous acceptez nos{" "}
        <Link href="/conditions" className="text-[#2d7dd2] hover:underline">
          conditions d'utilisation
        </Link>{" "}
        et notre{" "}
        <Link href="/confidentialite" className="text-[#2d7dd2] hover:underline">
          politique de confidentialite
        </Link>
      </div>

      <div className="mt-4 text-center text-sm text-[#8b9cb3]">
        Deja un compte ?{" "}
        <Link href={`/login${searchString ? `?${searchString}` : ""}`} className="font-semibold text-primary hover:text-primary/80">
          Se connecter
        </Link>
      </div>
    </AuthLayout>
  );
}
