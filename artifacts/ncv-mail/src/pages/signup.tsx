import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/lib/auth";
import { Link, useLocation } from "wouter";
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

const signupSchema = z.object({
  fullName: z.string().min(2, "Nom complet requis"),
  email: z.string().email("Email invalide"),
  password: z.string().min(6, "Le mot de passe doit contenir au moins 6 caracteres"),
});

type SignupFormValues = z.infer<typeof signupSchema>;

export default function Signup() {
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  const { signUp } = useAuth();
  const [isPending, setIsPending] = useState(false);

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
    },
  });

  async function onSubmit(data: SignupFormValues) {
    setIsPending(true);
    const { error } = await signUp(data.email, data.password, data.fullName);
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
      setLocation("/dashboard");
    }
  }

  return (
    <AuthLayout>
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-white">Creer un compte</h1>
        <p className="text-[#8b9cb3] mt-2 text-sm">Rejoignez NCV Mail pour organiser votre boite de reception</p>
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
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[#8b9cb3]">Mot de passe</FormLabel>
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

      <div className="mt-6 text-center text-sm text-[#8b9cb3]">
        Deja un compte ?{" "}
        <Link href="/login" className="font-semibold text-primary hover:text-primary/80">
          Se connecter
        </Link>
      </div>
    </AuthLayout>
  );
}
