import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useGetProfile, useUpdateProfile, getGetProfileQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Mail, User, Bell, BrainCircuit, CheckCircle2, RefreshCw, Trash2, Eye, EyeOff, AlertCircle } from "lucide-react";
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
  const [showImapForm, setShowImapForm] = useState(false);
  const [imapEmail, setImapEmail] = useState("");
  const [imapPassword, setImapPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [imapHost, setImapHost] = useState("");
  const [imapPort, setImapPort] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState("");

  useEffect(() => {
    if (profile) setFullName(profile.fullName);
  }, [profile]);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "email-connected") {
        toast({ title: `${e.data.provider === "gmail" ? "Gmail" : "Outlook"} connecte avec succes !` });
        queryClient.invalidateQueries({ queryKey: ["email-connections"] });
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
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

  const handleOAuthConnect = async (provider: "gmail" | "outlook") => {
    try {
      const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${baseUrl}/api/email/connect/${provider}`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const data = await res.json();
      if (data.url) {
        window.open(data.url, "_blank", "width=600,height=700,left=200,top=100");
      } else {
        toast({ variant: "destructive", title: "Erreur", description: data.error || "Impossible de se connecter" });
      }
    } catch {
      toast({ variant: "destructive", title: "Erreur de connexion" });
    }
  };

  const handleImapConnect = async () => {
    if (!imapEmail || !imapPassword) {
      setConnectError("Veuillez remplir tous les champs");
      return;
    }
    setConnecting(true);
    setConnectError("");
    try {
      const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${baseUrl}/api/email/connect/imap`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: imapEmail,
          password: imapPassword,
          imapHost: imapHost || undefined,
          imapPort: imapPort ? parseInt(imapPort) : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: `${imapEmail} connecte avec succes !` });
        queryClient.invalidateQueries({ queryKey: ["email-connections"] });
        setShowImapForm(false);
        setImapEmail("");
        setImapPassword("");
        setImapHost("");
        setImapPort("");
      } else {
        setConnectError(data.error || "Connexion echouee");
        if (data.needsManualConfig) setShowAdvanced(true);
      }
    } catch {
      setConnectError("Erreur de connexion au serveur");
    } finally {
      setConnecting(false);
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
      toast({ title: "Compte email deconnecte" });
    } catch {
      toast({ variant: "destructive", title: "Erreur" });
    }
  };

  const handleSync = async (force = false) => {
    setSyncing(true);
    try {
      const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${baseUrl}/api/email/sync`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ force }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: `${data.synced} emails synchronises${force ? " (re-sync complet)" : ""}` });
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
  const imapConnected = connections?.find(c => c.provider === "imap");
  const hasConnections = connections && connections.length > 0;

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
              {hasConnections && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleSync(false)} disabled={syncing}>
                    <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
                    {syncing ? "Sync..." : "Synchroniser"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleSync(true)} disabled={syncing} className="text-orange-600 border-orange-300 hover:bg-orange-50">
                    <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
                    Re-sync + tri IA
                  </Button>
                </div>
              )}
            </div>
            <Card>
              <CardContent className="p-6 space-y-4">
                {connectionsLoading ? (
                  <Skeleton className="h-20 w-full" />
                ) : (
                  <>
                    {connections?.map((conn) => (
                      <div key={conn.id} className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border border-border rounded-lg bg-secondary/30">
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl ${
                            conn.provider === "gmail" ? "bg-red-100 text-red-600" :
                            conn.provider === "outlook" ? "bg-blue-100 text-blue-600" :
                            "bg-gray-100 text-gray-600"
                          }`}>
                            {conn.provider === "gmail" ? "G" : conn.provider === "outlook" ? "O" : "@"}
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-900">{conn.email_address}</h4>
                            <p className="text-sm text-green-600 flex items-center gap-1">
                              <CheckCircle2 className="w-4 h-4" />
                              Connecte
                              {conn.last_synced_at && (
                                <span className="text-gray-400 ml-2">
                                  — Derniere sync : {new Date(conn.last_synced_at).toLocaleString("fr-FR")}
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                        <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => handleDisconnect(conn.provider)}>
                          <Trash2 className="w-4 h-4 mr-2" />
                          Deconnecter
                        </Button>
                      </div>
                    ))}

                    {!gmailConnected && (
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border border-border rounded-lg bg-secondary/30">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-600 font-bold text-xl">G</div>
                          <div>
                            <h4 className="font-medium text-gray-900">Gmail / Google Workspace</h4>
                            <p className="text-sm text-gray-500">Connectez votre compte Google en un clic.</p>
                          </div>
                        </div>
                        <Button variant="outline" className="w-full sm:w-auto" onClick={() => handleOAuthConnect("gmail")}>
                          Se connecter avec Google
                        </Button>
                      </div>
                    )}

                    {!outlookConnected && (
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border border-border rounded-lg bg-secondary/30">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-xl">O</div>
                          <div>
                            <h4 className="font-medium text-gray-900">Microsoft Outlook</h4>
                            <p className="text-sm text-gray-500">Connectez votre compte Microsoft en un clic.</p>
                          </div>
                        </div>
                        <Button variant="outline" className="w-full sm:w-auto" onClick={() => handleOAuthConnect("outlook")}>
                          Se connecter avec Microsoft
                        </Button>
                      </div>
                    )}

                    {!imapConnected && !showImapForm && (
                      <button
                        className="w-full text-sm text-gray-500 hover:text-primary py-2 text-center"
                        onClick={() => setShowImapForm(true)}
                      >
                        Autre fournisseur (Orange, Free, SFR, Yahoo...)
                      </button>
                    )}

                    {showImapForm && (
                      <div className="p-4 border border-primary/30 rounded-lg bg-primary/5 space-y-4">
                        <h4 className="font-medium text-gray-900">Connecter un autre compte email</h4>
                        <p className="text-sm text-gray-500">
                          Pour Orange, Free, SFR, Yahoo, La Poste, OVH et autres fournisseurs.
                        </p>

                        {connectError && (
                          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <span>{connectError}</span>
                          </div>
                        )}

                        <div className="space-y-3">
                          <div className="space-y-1">
                            <Label>Adresse email</Label>
                            <Input type="email" placeholder="votre@email.com" value={imapEmail} onChange={(e) => setImapEmail(e.target.value)} />
                          </div>
                          <div className="space-y-1">
                            <Label>Mot de passe</Label>
                            <div className="relative">
                              <Input type={showPassword ? "text" : "password"} placeholder="Mot de passe" value={imapPassword} onChange={(e) => setImapPassword(e.target.value)} />
                              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" onClick={() => setShowPassword(!showPassword)}>
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>
                          </div>

                          <button type="button" className="text-sm text-primary hover:underline" onClick={() => setShowAdvanced(!showAdvanced)}>
                            {showAdvanced ? "Masquer" : "Configuration avancee (serveur IMAP personnalise)"}
                          </button>

                          {showAdvanced && (
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <Label>Serveur IMAP</Label>
                                <Input placeholder="imap.exemple.com" value={imapHost} onChange={(e) => setImapHost(e.target.value)} />
                              </div>
                              <div className="space-y-1">
                                <Label>Port</Label>
                                <Input type="number" placeholder="993" value={imapPort} onChange={(e) => setImapPort(e.target.value)} />
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex gap-3">
                          <Button onClick={handleImapConnect} disabled={connecting} className="bg-[#1877F2] hover:bg-[#1565c0]">
                            {connecting ? "Connexion en cours..." : "Connecter"}
                          </Button>
                          <Button variant="outline" onClick={() => { setShowImapForm(false); setConnectError(""); }}>
                            Annuler
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
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
                      <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
                    </div>
                    <Button onClick={handleSaveProfile} disabled={updateProfile.isPending || fullName === profile?.fullName}>
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
