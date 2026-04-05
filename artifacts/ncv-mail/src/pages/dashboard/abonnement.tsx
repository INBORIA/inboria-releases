import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useGetProfile, useUpdateProfile, getGetProfileQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
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
    features: ["50 emails tries par mois", "Categorisation basique", "Bilan quotidien simple"],
    icon: Check,
  },
  {
    id: "solo",
    name: "Solo",
    price: "9",
    quota: 3000,
    description: "Pour les independants",
    features: ["3 000 emails par mois", "Categories personnalisees", "Extraction des taches", "Bilan detaille"],
    icon: Zap,
    popular: true,
  },
  {
    id: "pro",
    name: "Pro",
    price: "19",
    quota: 10000,
    description: "Pour les professionnels intensifs",
    features: ["10 000 emails par mois", "Priorisation IA avancee", "Multi-comptes email", "Support prioritaire"],
    icon: Sparkles,
  },
  {
    id: "business",
    name: "Business",
    price: "9",
    priceUnit: "/siege",
    quota: 10000,
    description: "Pour les equipes",
    features: ["10 000 emails par siege", "Facturation centralisee", "Partage de categories", "Admin dashboard"],
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
  const [showSeats, setShowSeats] = useState(false);

  const handleSubscribe = (planId: string, seats?: number) => {
    updateProfile.mutate(
      { data: { plan: planId, seats: seats || 1 } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
          toast({ 
            title: "Abonnement mis a jour",
            description: `Vous etes maintenant sur le plan ${planId.toUpperCase()}`
          });
        }
      }
    );
  };

  const currentPlanIndex = plans.findIndex(p => p.id === profile?.plan);

  return (
    <DashboardLayout>
      <div className="p-6 max-w-6xl mx-auto w-full">
        <div className="mb-8 text-center max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold text-white tracking-tight mb-2">Gerez votre abonnement</h1>
          <p className="text-[14px] text-[#8b9cb3]">Choisissez le plan adapte a votre volume d'emails.</p>
        </div>

        {isLoading ? (
          <Skeleton className="h-20 w-full mb-8 rounded-lg bg-white/5" />
        ) : profile ? (
          <div className="bg-card rounded-lg border border-border p-5 mb-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-[14px] font-semibold text-white mb-0.5">
                Plan actuel : <span className="text-primary capitalize">{profile.plan}</span>
              </h3>
              <p className="text-[12px] text-[#8b9cb3]">
                Renouvellement le {new Date(new Date().setMonth(new Date().getMonth() + 1)).toLocaleDateString("fr-FR")}
              </p>
            </div>
            <div className="w-full md:w-1/2">
              <div className="flex justify-between text-[12px] font-medium mb-1.5">
                <span className="text-[#8b9cb3]">Consommation IA</span>
                <span className="text-white">{profile.emailsUsed} / {profile.emailsQuota}</span>
              </div>
              <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${Math.min(100, (profile.emailsUsed / Math.max(1, profile.emailsQuota)) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {plans.map((plan, idx) => {
            const isCurrentPlan = profile?.plan === plan.id;
            const isUpgrade = idx > currentPlanIndex;
            const isBusiness = plan.hasSeats;
            const price = isBusiness ? parseInt(plan.price) * businessSeats : plan.price;
            
            return (
              <div 
                key={plan.id} 
                className={`relative rounded-lg border p-5 flex flex-col ${
                  isCurrentPlan 
                    ? 'border-primary bg-primary/5' 
                    : 'border-border bg-card'
                } ${plan.popular && !isCurrentPlan ? 'lg:-mt-2 lg:mb-2' : ''}`}
              >
                {plan.popular && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-primary text-white px-2.5 py-0.5 text-[10px] font-semibold rounded-full">
                    Populaire
                  </div>
                )}
                {isCurrentPlan && (
                  <div className="absolute top-3 right-3">
                    <div className="bg-primary/20 text-primary text-[10px] font-semibold px-2 py-0.5 rounded-full">
                      Plan actuel
                    </div>
                  </div>
                )}
                
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 ${isCurrentPlan ? 'bg-primary/10 text-primary' : 'bg-white/[0.04] text-[#8b9cb3]'}`}>
                  <plan.icon className="w-5 h-5" />
                </div>
                
                <h3 className="text-[15px] font-bold text-white">{plan.name}</h3>
                <p className="text-[12px] text-[#8b9cb3] mb-4 h-8">{plan.description}</p>
                
                <div className="mb-4">
                  <div className="flex items-baseline gap-0.5">
                    <span className="text-3xl font-extrabold text-white">{price}€</span>
                    <span className="text-[#8b9cb3] text-[13px]">/mois</span>
                  </div>
                  {isBusiness && (
                    <p className="text-[11px] text-[#8b9cb3] mt-0.5">Soit 9€ par siege</p>
                  )}
                </div>
                
                {isBusiness && showSeats && (
                  <div className="mb-4 p-3 bg-background rounded-lg border border-border">
                    <label className="text-[12px] font-medium text-[#8b9cb3] block mb-2">Nombre de sieges</label>
                    <div className="flex items-center gap-3">
                      <input 
                        type="range" 
                        min="2" 
                        max="50" 
                        value={businessSeats} 
                        onChange={(e) => setBusinessSeats(parseInt(e.target.value))}
                        className="w-full accent-primary"
                      />
                      <span className="font-bold text-sm text-white w-8 text-center">{businessSeats}</span>
                    </div>
                  </div>
                )}

                <ul className="space-y-2 mb-5 flex-1">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${isCurrentPlan ? 'text-primary' : 'text-emerald-400'}`} />
                      <span className="text-[12px] text-[#8b9cb3]">{feature}</span>
                    </li>
                  ))}
                </ul>
                
                {isCurrentPlan ? null : isUpgrade ? (
                  <Button 
                    className="w-full"
                    size="sm"
                    disabled={updateProfile.isPending}
                    onClick={() => {
                      if (isBusiness && !showSeats) {
                        setShowSeats(true);
                        return;
                      }
                      handleSubscribe(plan.id, isBusiness ? businessSeats : 1);
                    }}
                  >
                    Passer a ce plan
                  </Button>
                ) : (
                  <Button 
                    variant="ghost"
                    className="w-full text-[#8b9cb3] hover:text-white hover:bg-white/[0.04]"
                    size="sm"
                    disabled
                  >
                    Plan inferieur
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-10 bg-card rounded-lg border border-border p-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-[14px] font-semibold text-white mb-1 flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              Securite et confidentialite
            </h3>
            <p className="text-[12px] text-[#8b9cb3] max-w-2xl">
              Vos emails ne sont jamais stockes pour entrainer nos modeles. IA en temps reel uniquement. Donnees hebergees en Europe (RGPD).
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
