import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useGetProfile, useUpdateProfile, getGetProfileQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Mail, User, Bell, BrainCircuit } from "lucide-react";
import { useState, useEffect } from "react";

export default function Parametres() {
  const { data: profile, isLoading } = useGetProfile();
  const updateProfile = useUpdateProfile();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [fullName, setFullName] = useState("");

  useEffect(() => {
    if (profile) {
      setFullName(profile.fullName);
    }
  }, [profile]);

  const handleSaveProfile = () => {
    updateProfile.mutate(
      { data: { fullName } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
          toast({ title: "Profil mis à jour" });
        }
      }
    );
  };

  return (
    <DashboardLayout>
      <div className="p-6 max-w-4xl mx-auto w-full">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Paramètres</h1>
          <p className="text-gray-500 mt-1">Gérez votre compte et les préférences de l'IA.</p>
        </div>

        <div className="space-y-8">
          {/* Email Connection */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
              <Mail className="w-5 h-5 text-primary" />
              Connexion Email
            </h2>
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border border-border rounded-lg bg-secondary/30">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-600 font-bold text-xl">G</div>
                    <div>
                      <h4 className="font-medium text-gray-900">Gmail / Google Workspace</h4>
                      <p className="text-sm text-gray-500">Connectez votre compte Google pour synchroniser vos emails.</p>
                    </div>
                  </div>
                  <Button variant="outline" className="w-full sm:w-auto">Connecter</Button>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border border-border rounded-lg bg-secondary/30">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-xl">O</div>
                    <div>
                      <h4 className="font-medium text-gray-900">Microsoft Outlook</h4>
                      <p className="text-sm text-gray-500">Connectez votre compte Microsoft pour synchroniser vos emails.</p>
                    </div>
                  </div>
                  <Button variant="outline" className="w-full sm:w-auto">Connecter</Button>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* AI Preferences */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
              <BrainCircuit className="w-5 h-5 text-primary" />
              Préférences de l'Intelligence Artificielle
            </h2>
            <Card>
              <CardContent className="p-6 space-y-6">
                <div className="space-y-2">
                  <Label>Langue des résumés</Label>
                  <Select defaultValue="fr">
                    <SelectTrigger className="max-w-md">
                      <SelectValue placeholder="Sélectionnez une langue" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fr">Français</SelectItem>
                      <SelectItem value="en">Anglais</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-gray-500">L'IA rédigera les bilans et résumés dans cette langue, quelle que soit la langue d'origine de l'email.</p>
                </div>
                
                <div className="space-y-4 pt-4 border-t border-border">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Marquer les emails de facturation comme urgents</Label>
                      <p className="text-sm text-gray-500">L'IA détectera les factures impayées ou à traiter rapidement.</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Extraction automatique des tâches</Label>
                      <p className="text-sm text-gray-500">Convertir les requêtes clients en liste de tâches cochable.</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Account Profile */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
              <User className="w-5 h-5 text-primary" />
              Informations du compte
            </h2>
            <Card>
              <CardContent className="p-6">
                {isLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-10 w-full max-w-md" />
                    <Skeleton className="h-10 w-full max-w-md" />
                  </div>
                ) : (
                  <div className="space-y-4 max-w-md">
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input value={profile?.email} disabled className="bg-secondary/50 text-gray-500" />
                    </div>
                    <div className="space-y-2">
                      <Label>Nom complet</Label>
                      <Input 
                        value={fullName} 
                        onChange={(e) => setFullName(e.target.value)} 
                      />
                    </div>
                    <Button 
                      onClick={handleSaveProfile} 
                      disabled={updateProfile.isPending || fullName === profile?.fullName}
                    >
                      {updateProfile.isPending ? "Enregistrement..." : "Enregistrer les modifications"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
          
          {/* Notifications */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
              <Bell className="w-5 h-5 text-primary" />
              Notifications
            </h2>
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Bilan quotidien matinal</Label>
                    <p className="text-sm text-gray-500">Recevoir le résumé IA par email tous les matins à 8h.</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Alertes d'urgence</Label>
                    <p className="text-sm text-gray-500">Notification immédiate lors de la réception d'un email critique.</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </CardContent>
            </Card>
          </section>

        </div>
      </div>
    </DashboardLayout>
  );
}
