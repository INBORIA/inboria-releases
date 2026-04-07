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

const loginSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(1, "Le mot de passe est requis"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function Login() {
  const [_, setLocation] = useLocation();
  const searchString = useSearch();
  const { toast } = useToast();
  const { signIn } = useAuth();
  const [isPending, setIsPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
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
        title: "Erreur de connexion",
        description: error || "Veuillez verifier vos identifiants.",
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
        <h1 className="text-2xl font-bold text-white">Bienvenue</h1>
        <p className="text-[#8b9cb3] mt-2 text-sm">Connectez-vous a votre compte NCV Mail</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[#8b9cb3]">Email</FormLabel>
                <FormControl>
                  <Input placeholder="nom@entreprise.com" type="email" className="bg-background border-border text-white" {...field} />
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
                  <FormLabel className="text-[#8b9cb3]">Mot de passe</FormLabel>
                  <Link href="/mot-de-passe-oublie" className="text-xs text-primary hover:text-primary/80 font-medium" tabIndex={-1}>
                    Mot de passe oublie ?
                  </Link>
                </div>
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
                <FormMessage />
              </FormItem>
            )}
          />
          <Button
            type="submit"
            className="w-full"
            disabled={isPending}
          >
            {isPending ? "Connexion..." : "Se connecter"}
          </Button>
        </form>
      </Form>

      <div className="mt-6 text-center text-sm text-[#8b9cb3]">
        Pas encore de compte ?{" "}
        <Link href={`/signup${searchString ? `?${searchString}` : ""}`} className="font-semibold text-primary hover:text-primary/80">
          Creer un compte
        </Link>
      </div>
    </AuthLayout>
  );
}
