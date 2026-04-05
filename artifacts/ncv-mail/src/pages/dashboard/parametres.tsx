import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useGetProfile, useUpdateProfile, getGetProfileQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
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
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-white tracking-tight">Parametres</h1>
          <p className="text-[13px] text-[#8b9cb3] mt-1">Gerez votre compte et les preferences de l'IA.</p>
        </div>

        <div className="space-y-6">
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[14px] font-semibold text-white flex items-center gap-2">
                <Mail className="w-4 h-4 text-primary" />
                Connexion Email
              </h2>
              {hasConnections && (
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" className="h-8 text-[12px] text-[#8b9cb3] hover:text-white hover:bg-white/[0.04]" onClick={() => handleSync(false)} disabled={syncing}>
                    <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${syncing ? "animate-spin" : ""}`} />
                    {syncing ? "Sync..." : "Synchroniser"}
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 text-[12px] text-amber-400 hover:text-amber-300 hover:bg-amber-500/10" onClick={() => handleSync(true)} disabled={syncing}>
                    <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${syncing ? "animate-spin" : ""}`} />
                    Re-sync + tri IA
                  </Button>
                </div>
              )}
            </div>
            <div className="bg-card rounded-lg border border-border p-5 space-y-3">
              {connectionsLoading ? (
                <Skeleton className="h-16 w-full bg-white/5" />
              ) : (
                <>
                  {connections?.map((conn) => (
                    <div key={conn.id} className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 border border-border rounded-lg bg-background">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm ${
                          conn.provider === "gmail" ? "bg-red-500/10 text-red-400" :
                          conn.provider === "outlook" ? "bg-blue-500/10 text-blue-400" :
                          "bg-white/[0.06] text-[#8b9cb3]"
                        }`}>
                          {conn.provider === "gmail" ? "G" : conn.provider === "outlook" ? "O" : "@"}
                        </div>
                        <div>
                          <h4 className="font-medium text-[13px] text-white">{conn.email_address}</h4>
                          <p className="text-[11px] text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Connecte
                            {conn.last_synced_at && (
                              <span className="text-[#8b9cb3] ml-1.5">
                                — Sync : {new Date(conn.last_synced_at).toLocaleString("fr-FR")}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 text-[12px]" onClick={() => handleDisconnect(conn.provider)}>
                        <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                        Deconnecter
                      </Button>
                    </div>
                  ))}

                  {!gmailConnected && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 border border-border rounded-lg bg-background">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-red-500/10 rounded-lg flex items-center justify-center text-red-400 font-bold text-sm">G</div>
                        <div>
                          <h4 className="font-medium text-[13px] text-white">Gmail / Google Workspace</h4>
                          <p className="text-[11px] text-[#8b9cb3]">Connexion OAuth en un clic.</p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" className="bg-transparent border-border text-[#8b9cb3] hover:text-white hover:bg-white/[0.04] h-8 text-[12px]" onClick={() => handleOAuthConnect("gmail")}>
                        Connecter Google
                      </Button>
                    </div>
                  )}

                  {!outlookConnected && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 border border-border rounded-lg bg-background">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-blue-500/10 rounded-lg flex items-center justify-center text-blue-400 font-bold text-sm">O</div>
                        <div>
                          <h4 className="font-medium text-[13px] text-white">Microsoft Outlook</h4>
                          <p className="text-[11px] text-[#8b9cb3]">Connexion OAuth en un clic.</p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" className="bg-transparent border-border text-[#8b9cb3] hover:text-white hover:bg-white/[0.04] h-8 text-[12px]" onClick={() => handleOAuthConnect("outlook")}>
                        Connecter Microsoft
                      </Button>
                    </div>
                  )}

                  {!imapConnected && !showImapForm && (
                    <button
                      className="w-full text-[12px] text-[#8b9cb3] hover:text-primary py-2 text-center transition-colors"
                      onClick={() => setShowImapForm(true)}
                    >
                      Autre fournisseur (Orange, Free, SFR, Yahoo...)
                    </button>
                  )}

                  {showImapForm && (
                    <div className="p-4 border border-primary/20 rounded-lg bg-primary/5 space-y-3">
                      <h4 className="font-medium text-[13px] text-white">Connecter un autre compte email</h4>
                      <p className="text-[11px] text-[#8b9cb3]">
                        Orange, Free, SFR, Yahoo, La Poste, OVH et autres.
                      </p>

                      {connectError && (
                        <div className="flex items-start gap-2 p-2.5 bg-red-500/10 border border-red-500/20 rounded-lg text-[12px] text-red-400">
                          <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                          <span>{connectError}</span>
                        </div>
                      )}

                      <div className="space-y-2.5">
                        <div className="space-y-1">
                          <Label className="text-[12px] text-[#8b9cb3]">Adresse email</Label>
                          <Input type="email" placeholder="votre@email.com" className="bg-background border-border text-white h-9 text-[13px]" value={imapEmail} onChange={(e) => setImapEmail(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[12px] text-[#8b9cb3]">Mot de passe</Label>
                          <div className="relative">
                            <Input type={showPassword ? "text" : "password"} placeholder="Mot de passe" className="bg-background border-border text-white h-9 text-[13px] pr-10" value={imapPassword} onChange={(e) => setImapPassword(e.target.value)} />
                            <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8b9cb3] hover:text-white" onClick={() => setShowPassword(!showPassword)}>
                              {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>

                        <button type="button" className="text-[12px] text-primary hover:underline" onClick={() => setShowAdvanced(!showAdvanced)}>
                          {showAdvanced ? "Masquer" : "Configuration avancee"}
                        </button>

                        {showAdvanced && (
                          <div className="grid grid-cols-2 gap-2.5">
                            <div className="space-y-1">
                              <Label className="text-[12px] text-[#8b9cb3]">Serveur IMAP</Label>
                              <Input placeholder="imap.exemple.com" className="bg-background border-border text-white h-9 text-[13px]" value={imapHost} onChange={(e) => setImapHost(e.target.value)} />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[12px] text-[#8b9cb3]">Port</Label>
                              <Input type="number" placeholder="993" className="bg-background border-border text-white h-9 text-[13px]" value={imapPort} onChange={(e) => setImapPort(e.target.value)} />
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <Button onClick={handleImapConnect} disabled={connecting} size="sm">
                          {connecting ? "Connexion..." : "Connecter"}
                        </Button>
                        <Button variant="ghost" size="sm" className="text-[#8b9cb3] hover:text-white hover:bg-white/[0.04]" onClick={() => { setShowImapForm(false); setConnectError(""); }}>
                          Annuler
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </section>

          <section>
            <h2 className="text-[14px] font-semibold text-white flex items-center gap-2 mb-3">
              <BrainCircuit className="w-4 h-4 text-primary" />
              Preferences IA
            </h2>
            <div className="bg-card rounded-lg border border-border p-5 space-y-5">
              <div className="space-y-1.5">
                <Label className="text-[13px] text-white">Langue des resumes</Label>
                <Select defaultValue="fr">
                  <SelectTrigger className="max-w-md bg-background border-border text-white h-9 text-[13px]">
                    <SelectValue placeholder="Selectionnez" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="fr">Francais</SelectItem>
                    <SelectItem value="en">Anglais</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-[#8b9cb3]">Langue des bilans et resumes IA.</p>
              </div>
              
              <div className="space-y-4 pt-4 border-t border-border">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-[13px] text-white">Facturation urgente</Label>
                    <p className="text-[11px] text-[#8b9cb3]">Detecter les factures impayees comme urgentes.</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-[13px] text-white">Extraction de taches</Label>
                    <p className="text-[11px] text-[#8b9cb3]">Convertir les requetes clients en taches.</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-[14px] font-semibold text-white flex items-center gap-2 mb-3">
              <User className="w-4 h-4 text-primary" />
              Informations du compte
            </h2>
            <div className="bg-card rounded-lg border border-border p-5">
              {isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-9 w-full max-w-md bg-white/5" />
                  <Skeleton className="h-9 w-full max-w-md bg-white/5" />
                </div>
              ) : (
                <div className="space-y-3 max-w-md">
                  <div className="space-y-1.5">
                    <Label className="text-[12px] text-[#8b9cb3]">Email</Label>
                    <Input value={profile?.email} disabled className="bg-background border-border text-[#8b9cb3] h-9 text-[13px]" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[12px] text-[#8b9cb3]">Nom complet</Label>
                    <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="bg-background border-border text-white h-9 text-[13px]" />
                  </div>
                  <Button onClick={handleSaveProfile} disabled={updateProfile.isPending || fullName === profile?.fullName} size="sm">
                    {updateProfile.isPending ? "Enregistrement..." : "Enregistrer"}
                  </Button>
                </div>
              )}
            </div>
          </section>
          
          <section>
            <h2 className="text-[14px] font-semibold text-white flex items-center gap-2 mb-3">
              <Bell className="w-4 h-4 text-primary" />
              Notifications
            </h2>
            <div className="bg-card rounded-lg border border-border p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-[13px] text-white">Bilan matinal</Label>
                  <p className="text-[11px] text-[#8b9cb3]">Resume IA par email tous les matins a 8h.</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-[13px] text-white">Alertes urgentes</Label>
                  <p className="text-[11px] text-[#8b9cb3]">Notification pour les emails critiques.</p>
                </div>
                <Switch defaultChecked />
              </div>
            </div>
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
}
