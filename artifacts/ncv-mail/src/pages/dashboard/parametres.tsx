import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useGetProfile, useUpdateProfile, getGetProfileQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Mail, User, Bell, BrainCircuit, CheckCircle2, RefreshCw, Trash2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";

interface EmailConnection {
  id: string;
  provider: string;
  email_address: string;
  created_at: string;
  last_synced_at: string | null;
}

function useEmailConnections() {
  const { session } = useAuth();
  return useQuery<EmailConnection[]>({
    queryKey: ["email-connections"],
    queryFn: async () => {
      const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${baseUrl}/api/email/connections`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch connections");
      return res.json();
    },
    enabled: !!session,
  });
}

export default function Parametres() {
  const { data: profile, isLoading } = useGetProfile();
  const updateProfile = useUpdateProfile();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { session } = useAuth();
  const { data: connections, isLoading: connectionsLoading } = useEmailConnections();

  const [fullName, setFullName] = useState("");
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.fullName);
    }
  }, [profile]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    if (connected) {
      toast({ title: `${connected === "gmail" ? "Gmail" : "Outlook"} connecte avec succes !` });
      queryClient.invalidateQueries({ queryKey: ["email-connections"] });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const handleSaveProfile = () => {
    updateProfile.mutate(
      { data: { fullName } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
          toast({ title: "Profil mis a jour" });
        }
      }
    );
  };

  const handleConnect = async (provider: "gmail" | "outlook") => {
    try {
      const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${baseUrl}/api/email/connect/${provider}`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast({ variant: "destructive", title: "Erreur", description: data.error || "Impossible de se connecter" });
      }
    } catch {
      toast({ variant: "destructive", title: "Erreur de connexion" });
    }
  };

  const handleDisconnect = async (provider: string) => {
    try {
      const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");
      await fetch(`${baseUrl}/api/email/connections/${provider}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      queryClient.invalidateQueries({ queryKey: ["email-connections"] });
      toast({ title: `${provider === "gmail" ? "Gmail" : "Outlook"} deconnecte` });
    } catch {
      toast({ variant: "destructive", title: "Erreur" });
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${baseUrl}/api/email/sync`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: `${data.synced} nouveaux emails synchronises` });
        queryClient.invalidateQueries({ queryKey: ["email-connections"] });
      } else {
        toast({ variant: "destructive", title: "Erreur", description: data.error });
      }
    } catch {
      toast({ variant: "destructive", title: "Erreur de synchronisation" });
    } finally {
      setSyncing(false);
    }
  };

  const gmailConnected = connections?.find(c => c.provider === "gmail");
  const outlookConnected = connections?.find(c => c.provider === "outlook");

  return (
    <DashboardLayout>
      <div className="p-6 max-w-4xl mx-auto w-full">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Parametres</h1>
          <p className="text-gray-500 mt-1">Gerez votre compte et les preferences de l'IA.</p>
        </div>

        <div className="space-y-8">
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Mail className="w-5 h-5 text-primary" />
                Connexion Email
              </h2>
              {(gmailConnected || outlookConnected) && (
                <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
                  <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
                  {syncing ? "Synchronisation..." : "Synchroniser"}
                </Button>
              )}
            </div>
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border border-border rounded-lg bg-secondary/30">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-600 font-bold text-xl">G</div>
                    <div>
                      <h4 className="font-medium text-gray-900">Gmail / Google Workspace</h4>
                      {gmailConnected ? (
                        <p className="text-sm text-green-600 flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" />
                          Connecte : {gmailConnected.email_address}
                        </p>
                      ) : (
                        <p className="text-sm text-gray-500">Connectez votre compte Google pour synchroniser vos emails.</p>
                      )}
                    </div>
                  </div>
                  {gmailConnected ? (
                    <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => handleDisconnect("gmail")}>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Deconnecter
                    </Button>
                  ) : (
                    <Button variant="outline" className="w-full sm:w-auto" onClick={() => handleConnect("gmail")}>Connecter</Button>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border border-border rounded-lg bg-secondary/30">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-xl">O</div>
                    <div>
                      <h4 className="font-medium text-gray-900">Microsoft Outlook</h4>
                      {outlookConnected ? (
                        <p className="text-sm text-green-600 flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" />
                          Connecte : {outlookConnected.email_address}
                        </p>
                      ) : (
                        <p className="text-sm text-gray-500">Connectez votre compte Microsoft pour synchroniser vos emails.</p>
                      )}
                    </div>
                  </div>
                  {outlookConnected ? (
                    <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => handleDisconnect("outlook")}>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Deconnecter
                    </Button>
                  ) : (
                    <Button variant="outline" className="w-full sm:w-auto" onClick={() => handleConnect("outlook")}>Connecter</Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
              <BrainCircuit className="w-5 h-5 text-primary" />
              Preferences de l'Intelligence Artificielle
            </h2>
            <Card>
              <CardContent className="p-6 space-y-6">
                <div className="space-y-2">
                  <Label>Langue des resumes</Label>
                  <Select defaultValue="fr">
                    <SelectTrigger className="max-w-md">
                      <SelectValue placeholder="Selectionnez une langue" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fr">Francais</SelectItem>
                      <SelectItem value="en">Anglais</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-gray-500">L'IA redigera les bilans et resumes dans cette langue.</p>
                </div>
                
                <div className="space-y-4 pt-4 border-t border-border">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Marquer les emails de facturation comme urgents</Label>
                      <p className="text-sm text-gray-500">L'IA detectera les factures impayees ou a traiter rapidement.</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Extraction automatique des taches</Label>
                      <p className="text-sm text-gray-500">Convertir les requetes clients en liste de taches cochable.</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

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
                    <p className="text-sm text-gray-500">Recevoir le resume IA par email tous les matins a 8h.</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Alertes d'urgence</Label>
                    <p className="text-sm text-gray-500">Notification immediate lors de la reception d'un email critique.</p>
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
