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
import { Mail, User, Bell, BrainCircuit, CheckCircle2, Trash2, Eye, EyeOff, AlertCircle, Shield, Pen, Lock } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

const IMAP_PROVIDERS = [
  { id: "outlook", name: "Outlook", color: "bg-blue-500/10 text-blue-400", letter: "Ol", host: "outlook.office365.com", port: "993" },
  { id: "hotmail", name: "Hotmail", color: "bg-blue-500/10 text-blue-400", letter: "Hm", host: "outlook.office365.com", port: "993" },
  { id: "orange", name: "Orange", color: "bg-orange-500/10 text-orange-400", letter: "Or", host: "imap.orange.fr", port: "993" },
  { id: "free", name: "Free", color: "bg-red-500/10 text-red-400", letter: "Fr", host: "imap.free.fr", port: "993" },
  { id: "sfr", name: "SFR", color: "bg-green-500/10 text-green-400", letter: "SF", host: "imap.sfr.fr", port: "993" },
  { id: "bouygues", name: "Bouygues", color: "bg-cyan-500/10 text-cyan-400", letter: "BT", host: "imap.bbox.fr", port: "993" },
  { id: "laposte", name: "La Poste", color: "bg-yellow-500/10 text-yellow-400", letter: "LP", host: "imap.laposte.net", port: "993" },
  { id: "yahoo", name: "Yahoo", color: "bg-purple-500/10 text-purple-400", letter: "Y!", host: "imap.mail.yahoo.com", port: "993" },
  { id: "proximus", name: "Proximus", color: "bg-violet-500/10 text-violet-400", letter: "Px", host: "imap.proximus.be", port: "993" },
  { id: "skynet", name: "Skynet", color: "bg-sky-500/10 text-sky-400", letter: "Sk", host: "imap.skynet.be", port: "993" },
  { id: "voo", name: "VOO", color: "bg-amber-500/10 text-amber-400", letter: "VO", host: "imap.voo.be", port: "993" },
  { id: "telenet", name: "Telenet", color: "bg-teal-500/10 text-teal-400", letter: "Te", host: "imap.telenet.be", port: "993" },
  { id: "ovh", name: "OVH", color: "bg-blue-500/10 text-blue-400", letter: "OV", host: "", port: "993" },
  { id: "ionos", name: "IONOS", color: "bg-indigo-500/10 text-indigo-400", letter: "IO", host: "imap.ionos.fr", port: "993" },
  { id: "infomaniak", name: "Infomaniak", color: "bg-lime-500/10 text-lime-400", letter: "IM", host: "mail.infomaniak.com", port: "993" },
  { id: "gmx", name: "GMX", color: "bg-blue-500/10 text-blue-400", letter: "Gx", host: "imap.gmx.com", port: "993" },
  { id: "icloud", name: "iCloud", color: "bg-gray-400/10 text-gray-300", letter: "iC", host: "imap.mail.me.com", port: "993" },
  { id: "autre", name: "Autre", color: "bg-white/[0.06] text-[#8b9cb3]", letter: "@", host: "", port: "993" },
];

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
  const [signature, setSignature] = useState("");
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [imapEmail, setImapEmail] = useState("");
  const [imapPassword, setImapPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [imapHost, setImapHost] = useState("");
  const [imapPort, setImapPort] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.fullName);
      setSignature((profile as any).signature || "");
    }
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

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast({ variant: "destructive", title: "Mot de passe trop court", description: "Minimum 6 caracteres." });
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast({ variant: "destructive", title: "Erreur", description: "Les mots de passe ne correspondent pas." });
      return;
    }
    setChangingPassword(true);
    try {
      const email = profile?.email;
      if (email && currentPassword) {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
        if (signInError) {
          toast({ variant: "destructive", title: "Mot de passe actuel incorrect", description: "Veuillez verifier votre mot de passe actuel." });
          setChangingPassword(false);
          return;
        }
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        toast({ variant: "destructive", title: "Erreur", description: error.message });
      } else {
        toast({ title: "Mot de passe modifie avec succes" });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmNewPassword("");
      }
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de modifier le mot de passe." });
    } finally {
      setChangingPassword(false);
    }
  };

  const handleSaveSignature = () => {
    updateProfile.mutate(
      { data: { signature } as any },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
          toast({ title: "Signature enregistree", description: "Votre signature sera utilisee dans les brouillons IA et les reponses." });
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
        setSelectedProvider(null);
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

  const gmailConnected = connections?.find(c => c.provider === "gmail");
  const imapConnected = connections?.find(c => c.provider === "imap");

  return (
    <DashboardLayout>
      <div className="p-6 max-w-4xl mx-auto w-full">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-white tracking-tight">Parametres</h1>
          <p className="text-[13px] text-[#8b9cb3] mt-1">Gerez votre compte et les preferences de l'IA.</p>
        </div>

        <div className="space-y-6">
          <section>
            <h2 className="text-[14px] font-semibold text-white flex items-center gap-2 mb-3">
              <Mail className="w-4 h-4 text-primary" />
              Connexion Email
            </h2>
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


                  {!selectedProvider && (
                    <>
                      <div className="pt-2 border-t border-border">
                        <p className="text-[12px] text-[#8b9cb3] mb-3">Autres fournisseurs</p>
                        <div className="grid grid-cols-4 gap-2">
                          {IMAP_PROVIDERS.map((provider) => (
                            <button
                              key={provider.id}
                              className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-border bg-background hover:border-primary/30 hover:bg-primary/[0.04] transition-all group"
                              onClick={() => {
                                setSelectedProvider(provider.id);
                                setImapHost(provider.host);
                                setImapPort(provider.port);
                                setShowAdvanced(provider.id === "autre");
                                setConnectError("");
                              }}
                            >
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-[11px] ${provider.color}`}>
                                {provider.letter}
                              </div>
                              <span className="text-[11px] text-[#8b9cb3] group-hover:text-white transition-colors">{provider.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {selectedProvider && (
                    <div className="p-4 border border-primary/20 rounded-lg bg-primary/5 space-y-3">
                      <div className="flex items-center gap-2">
                        {(() => {
                          const prov = IMAP_PROVIDERS.find(p => p.id === selectedProvider);
                          return prov ? (
                            <>
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-[10px] ${prov.color}`}>{prov.letter}</div>
                              <h4 className="font-medium text-[13px] text-white">Connecter {prov.name}</h4>
                            </>
                          ) : null;
                        })()}
                      </div>

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

                        {(selectedProvider === "autre" || showAdvanced) && (
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

                        {selectedProvider !== "autre" && (
                          <button type="button" className="text-[12px] text-primary hover:underline" onClick={() => setShowAdvanced(!showAdvanced)}>
                            {showAdvanced ? "Masquer la config avancee" : "Configuration avancee"}
                          </button>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <Button onClick={handleImapConnect} disabled={connecting} size="sm">
                          {connecting ? "Connexion..." : "Connecter"}
                        </Button>
                        <Button variant="ghost" size="sm" className="text-[#8b9cb3] hover:text-white hover:bg-white/[0.04]" onClick={() => { setSelectedProvider(null); setConnectError(""); setImapEmail(""); setImapPassword(""); setImapHost(""); setImapPort(""); }}>
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
              <div className="space-y-4">
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
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-[13px] text-white">Detection de projets</Label>
                    <p className="text-[11px] text-[#8b9cb3]">Associer automatiquement les emails a vos projets actifs.</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-[14px] font-semibold text-white flex items-center gap-2 mb-3">
              <Pen className="w-4 h-4 text-primary" />
              Signature email
            </h2>
            <div className="bg-card rounded-lg border border-border p-5 space-y-4">
              <p className="text-[12px] text-[#8b9cb3]">
                Cette signature sera automatiquement ajoutee aux brouillons generes par l'IA et a vos reponses manuelles.
              </p>
              {isLoading ? (
                <Skeleton className="h-32 w-full bg-white/5" />
              ) : (
                <div className="space-y-3">
                  <Textarea
                    value={signature}
                    onChange={(e) => setSignature(e.target.value)}
                    placeholder={"Cordialement,\n\nJean Neybergh\nGerant — NCV Management\njean@ncvmanagement.com\n+32 470 00 00 00"}
                    className="bg-background border-border text-white text-[13px] min-h-[140px] resize-y font-mono"
                  />
                  {signature && (
                    <div className="p-3 bg-background rounded-lg border border-border">
                      <p className="text-[11px] text-[#8b9cb3] mb-2">Apercu :</p>
                      <div className="text-[13px] text-white whitespace-pre-line">{signature}</div>
                    </div>
                  )}
                  <Button
                    onClick={handleSaveSignature}
                    disabled={updateProfile.isPending || signature === ((profile as any)?.signature || "")}
                    size="sm"
                  >
                    {updateProfile.isPending ? "Enregistrement..." : "Enregistrer la signature"}
                  </Button>
                </div>
              )}
            </div>
          </section>

          <section>
            <h2 className="text-[14px] font-semibold text-white flex items-center gap-2 mb-3">
              <Shield className="w-4 h-4 text-primary" />
              Mode de gestion
            </h2>
            <div className="bg-card rounded-lg border border-border p-5 space-y-4">
              <p className="text-[12px] text-[#8b9cb3]">
                Choisissez le niveau d'autonomie de l'IA dans la gestion de vos emails.
              </p>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-[13px] text-white">Archivage automatique</Label>
                  <p className="text-[11px] text-[#8b9cb3]">L'IA archive les emails a faible priorite (newsletters, pubs, notifications). Les emails urgents et moyens restent dans l'inbox.</p>
                </div>
                <Switch />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-[13px] text-white">Marquage automatique</Label>
                  <p className="text-[11px] text-[#8b9cb3]">Marquer comme lu les emails faible priorite deja resumes par l'IA.</p>
                </div>
                <Switch />
              </div>
              <div className="p-3 bg-primary/[0.06] rounded-lg border border-primary/10">
                <p className="text-[11px] text-primary">
                  En mode manuel (par defaut), l'IA trie et classe vos emails mais ne prend aucune action automatique. Activez les options ci-dessus pour passer en mode autopilote.
                </p>
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
              <Lock className="w-4 h-4 text-primary" />
              Modifier le mot de passe
            </h2>
            <div className="bg-card rounded-lg border border-border p-5">
              <div className="space-y-3 max-w-md">
                <div className="space-y-1.5">
                  <Label className="text-[12px] text-[#8b9cb3]">Mot de passe actuel</Label>
                  <div className="relative">
                    <Input
                      type={showCurrentPwd ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="bg-background border-border text-white h-9 text-[13px] pr-10"
                      placeholder="Votre mot de passe actuel"
                    />
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8b9cb3] hover:text-white" onClick={() => setShowCurrentPwd(!showCurrentPwd)}>
                      {showCurrentPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[12px] text-[#8b9cb3]">Nouveau mot de passe</Label>
                  <div className="relative">
                    <Input
                      type={showNewPwd ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="bg-background border-border text-white h-9 text-[13px] pr-10"
                      placeholder="Minimum 6 caracteres"
                    />
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8b9cb3] hover:text-white" onClick={() => setShowNewPwd(!showNewPwd)}>
                      {showNewPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[12px] text-[#8b9cb3]">Confirmer le nouveau mot de passe</Label>
                  <Input
                    type={showNewPwd ? "text" : "password"}
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    className="bg-background border-border text-white h-9 text-[13px]"
                    placeholder="Retapez le nouveau mot de passe"
                  />
                </div>
                <Button
                  onClick={handleChangePassword}
                  disabled={changingPassword || !currentPassword || !newPassword || !confirmNewPassword}
                  size="sm"
                >
                  {changingPassword ? "Modification..." : "Modifier le mot de passe"}
                </Button>
              </div>
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
