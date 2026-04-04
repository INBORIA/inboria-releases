import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useGetProfile, useUpdateProfile, getGetProfileQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Check, Users, Shield, Zap, Sparkles } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const plans = [
  {
    id: "gratuit",
    name: "Gratuit",
    price: "0",
    quota: 50,
    description: "Pour tester l'autopilote",
    features: ["50 emails triés par mois", "Catégorisation basique", "Bilan quotidien simple"],
    icon: Check,
  },
  {
    id: "solo",
    name: "Solo",
    price: "9",
    quota: 3000,
    description: "Pour les indépendants",
    features: ["3 000 emails par mois", "Catégories personnalisées", "Extraction des tâches", "Bilan détaillé"],
    icon: Zap,
    popular: true,
  },
  {
    id: "pro",
    name: "Pro",
    price: "19",
    quota: 10000,
    description: "Pour les professionnels intensifs",
    features: ["10 000 emails par mois", "Priorisation IA avancée", "Multi-comptes email", "Support prioritaire"],
    icon: Sparkles,
  },
  {
    id: "business",
    name: "Business",
    price: "9",
    priceUnit: "/siège",
    quota: 10000, // per seat
    description: "Pour les équipes",
    features: ["10 000 emails par siège", "Facturation centralisée", "Partage de catégories", "Admin dashboard"],
    icon: Users,
    hasSeats: true,
  }
];

export default function Abonnement() {
  const { data: profile, isLoading } = useGetProfile();
  const updateProfile = useUpdateProfile();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [businessSeats, setBusinessSeats] = useState(5);

  const handleSubscribe = (planId: string, seats?: number) => {
    updateProfile.mutate(
      { data: { plan: planId, seats: seats || 1 } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
          toast({ 
            title: "Abonnement mis à jour",
            description: `Vous êtes maintenant sur le plan ${planId.toUpperCase()}`
          });
        }
      }
    );
  };

  return (
    <DashboardLayout>
      <div className="p-6 max-w-6xl mx-auto w-full">
        <div className="mb-10 text-center max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight mb-3">Gérez votre abonnement</h1>
          <p className="text-gray-500 text-lg">Choisissez le plan adapté à votre volume d'emails pour laisser l'IA faire le tri.</p>
        </div>

        {/* Current Usage Banner */}
        {isLoading ? (
          <Skeleton className="h-24 w-full mb-10 rounded-xl" />
        ) : profile ? (
          <Card className="mb-12 border-primary/20 bg-primary/5 shadow-sm">
            <CardContent className="p-6 flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  Plan actuel : <span className="text-primary capitalize">{profile.plan}</span>
                </h3>
                <p className="text-sm text-gray-600">
                  Renouvellement le {new Date(new Date().setMonth(new Date().getMonth() + 1)).toLocaleDateString()}
                </p>
              </div>
              <div className="w-full md:w-1/2">
                <div className="flex justify-between text-sm font-medium mb-2">
                  <span className="text-gray-700">Consommation IA</span>
                  <span className="text-gray-900">{profile.emailsUsed} / {profile.emailsQuota} emails</span>
                </div>
                <Progress 
                  value={Math.min(100, (profile.emailsUsed / Math.max(1, profile.emailsQuota)) * 100)} 
                  className="h-2.5" 
                />
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan) => {
            const isCurrentPlan = profile?.plan === plan.id;
            const isBusiness = plan.hasSeats;
            const price = isBusiness ? parseInt(plan.price) * businessSeats : plan.price;
            
            return (
              <Card 
                key={plan.id} 
                className={`relative flex flex-col ${isCurrentPlan ? 'border-2 border-primary shadow-md' : 'shadow-sm hover:shadow-md transition-shadow'} ${plan.popular ? 'mt-0 lg:-mt-4 lg:mb-4' : ''}`}
              >
                {plan.popular && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-primary text-primary-foreground px-3 py-1 text-xs font-semibold rounded-full shadow-sm">
                    Plus populaire
                  </div>
                )}
                {isCurrentPlan && (
                  <div className="absolute top-0 right-0 p-3">
                    <div className="bg-primary/10 text-primary p-1 rounded-full">
                      <Check className="w-4 h-4" />
                    </div>
                  </div>
                )}
                
                <CardHeader>
                  <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center mb-4">
                    <plan.icon className="w-6 h-6 text-gray-700" />
                  </div>
                  <CardTitle className="text-xl font-bold">{plan.name}</CardTitle>
                  <CardDescription className="h-10">{plan.description}</CardDescription>
                </CardHeader>
                
                <CardContent className="flex-1">
                  <div className="mb-6">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-extrabold text-gray-900">{price}€</span>
                      <span className="text-gray-500 font-medium">/mois</span>
                    </div>
                    {isBusiness && (
                      <p className="text-xs text-gray-500 mt-1">Soit 9€ par siège</p>
                    )}
                  </div>
                  
                  {isBusiness && (
                    <div className="mb-6 p-4 bg-secondary/50 rounded-lg border border-border">
                      <label className="text-sm font-medium text-gray-700 block mb-2">Nombre de sièges</label>
                      <div className="flex items-center gap-3">
                        <input 
                          type="range" 
                          min="2" 
                          max="50" 
                          value={businessSeats} 
                          onChange={(e) => setBusinessSeats(parseInt(e.target.value))}
                          className="w-full accent-primary"
                        />
                        <span className="font-bold text-lg w-8 text-center">{businessSeats}</span>
                      </div>
                    </div>
                  )}

                  <ul className="space-y-3">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        <span className="text-sm text-gray-600">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                
                <CardFooter>
                  <Button 
                    className="w-full" 
                    variant={isCurrentPlan ? "outline" : (plan.popular ? "default" : "secondary")}
                    disabled={isCurrentPlan || updateProfile.isPending}
                    onClick={() => handleSubscribe(plan.id, isBusiness ? businessSeats : 1)}
                  >
                    {isCurrentPlan ? "Plan actuel" : "Choisir ce plan"}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>

        <div className="mt-16 bg-sidebar rounded-2xl p-8 flex flex-col md:flex-row items-center justify-between gap-6 text-sidebar-foreground">
          <div>
            <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Sécurité et confidentialité
            </h3>
            <p className="text-sidebar-foreground/80 max-w-2xl">
              Vos emails ne sont jamais stockés pour entraîner nos modèles. Nous utilisons l'IA uniquement pour l'analyse en temps réel. Données hébergées en Europe (RGPD).
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
