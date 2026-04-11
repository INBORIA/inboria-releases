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
import { Mail, User, Bell, BrainCircuit, CheckCircle2, Trash2, Eye, EyeOff, AlertCircle, Shield, Pen, Lock, Globe } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
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
  const [timezone, setTimezone] = useState("Europe/Brussels");

  useEffect(() => {
    if (profile) {
      setFullName(profile.fullName);
      setSignature((profile as any).signature || "");
      setTimezone((profile as any).timezone || "Europe/Brussels");
    }
  }, [profile]);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "email-connected") {
        toast({ title: `${e.data.provider === "gmail" ? "Gmail" : "Outlook"} ${t("settings.connectedSuccess")}` });
        queryClient.invalidateQueries({ queryKey: ["email-connections"] });
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  const handleSaveProfile = () => {
    updateProfile.mutate(
      { data: { fullName, timezone } as any },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
          toast({ title: t("settings.profileUpdated") });
        }
      }
    );
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast({ variant: "destructive", title: t("settings.passwordTooShort"), description: t("settings.passwordMinChars") });
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast({ variant: "destructive", title: t("common.error"), description: t("settings.passwordsNoMatch") });
      return;
    }
    setChangingPassword(true);
    try {
      const email = profile?.email;
      if (email && currentPassword) {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
        if (signInError) {
          toast({ variant: "destructive", title: t("settings.wrongCurrentPassword"), description: t("settings.verifyCurrentPassword") });
          setChangingPassword(false);
          return;
        }
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        toast({ variant: "destructive", title: t("common.error"), description: error.message });
      } else {
        toast({ title: t("settings.passwordChanged") });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmNewPassword("");
      }
    } catch {
      toast({ variant: "destructive", title: t("common.error"), description: t("settings.passwordChangeError") });
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
          toast({ title: t("settings.signatureSaved"), description: t("settings.signatureSavedDesc") });
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
        toast({ variant: "destructive", title: t("common.error"), description: data.error || t("settings.connectionFailed") });
      }
    } catch {
      toast({ variant: "destructive", title: t("settings.connectionError") });
    }
  };

  const handleImapConnect = async () => {
    if (!imapEmail || !imapPassword) {
      setConnectError(t("settings.fillAllFields"));
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
        toast({ title: `${imapEmail} ${t("settings.connectedSuccess")}` });
        queryClient.invalidateQueries({ queryKey: ["email-connections"] });
        setSelectedProvider(null);
        setImapEmail("");
        setImapPassword("");
        setImapHost("");
        setImapPort("");
      } else {
        setConnectError(data.error || t("settings.connectionFailed"));
        if (data.needsManualConfig) setShowAdvanced(true);
      }
    } catch {
      setConnectError(t("settings.connectionError"));
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async (connectionId: string) => {
    try {
      const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");
      await fetch(`${baseUrl}/api/email/connections/${connectionId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      queryClient.invalidateQueries({ queryKey: ["email-connections"] });
      toast({ title: t("settings.disconnected") });
    } catch {
      toast({ variant: "destructive", title: t("common.error") });
    }
  };

  return (
    <DashboardLayout>
      <div className="p-5 max-w-4xl mx-auto w-full">
        <div className="mb-5">
          <h1 className="text-[16px] font-semibold text-white tracking-tight">{t("settings.title")}</h1>
          <p className="text-[12px] text-[#8b9cb3] mt-0.5">{t("settings.subtitle")}</p>
        </div>

        <div className="space-y-6">
          <section>
            <h2 className="text-[14px] font-semibold text-white flex items-center gap-2 mb-3">
              <Mail className="w-4 h-4 text-primary" />
              {t("settings.emailConnection")}
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
                            {t("settings.connected")}
                            {conn.last_synced_at && (
                              <span className="text-[#8b9cb3] ml-1.5">
                                — {t("settings.sync")} : {new Date(conn.last_synced_at).toLocaleString()}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 text-[12px]" onClick={() => handleDisconnect(conn.id)}>
                        <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                        {t("settings.disconnect")}
                      </Button>
                    </div>
                  ))}

                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 border border-border rounded-lg bg-background">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-red-500/10 rounded-lg flex items-center justify-center text-red-400 font-bold text-sm">G</div>
                      <div>
                        <h4 className="font-medium text-[13px] text-white">Gmail / Google Workspace</h4>
                        <p className="text-[11px] text-[#8b9cb3]">{t("settings.addGoogleAccount")}</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="bg-transparent border-border text-[#8b9cb3] hover:text-white hover:bg-white/[0.04] h-8 text-[12px]" onClick={() => handleOAuthConnect("gmail")}>
                      {t("settings.connectGoogle")}
                    </Button>
                  </div>


                  {!selectedProvider && (
                    <>
                      <div className="pt-2 border-t border-border">
                        <p className="text-[12px] text-[#8b9cb3] mb-3">{t("settings.otherProviders")}</p>
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
                              <span className="text-[11px] text-[#8b9cb3] group-hover:text-white transition-colors">{provider.id === "autre" ? t("settings.other") : provider.name}</span>
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
                              <h4 className="font-medium text-[13px] text-white">{t("settings.connectProvider", { name: prov.id === "autre" ? t("settings.other") : prov.name })}</h4>
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
                          <Label className="text-[12px] text-[#8b9cb3]">{t("settings.emailAddress")}</Label>
                          <Input type="email" placeholder="votre@email.com" className="bg-background border-border text-white h-9 text-[13px]" value={imapEmail} onChange={(e) => setImapEmail(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[12px] text-[#8b9cb3]">{t("settings.appPassword")}</Label>
                          <div className="relative">
                            <Input type={showPassword ? "text" : "password"} placeholder={t("settings.appPassword")} className="bg-background border-border text-white h-9 text-[13px] pr-10" value={imapPassword} onChange={(e) => setImapPassword(e.target.value)} />
                            <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8b9cb3] hover:text-white" onClick={() => setShowPassword(!showPassword)}>
                              {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>

                        {(selectedProvider === "autre" || showAdvanced) && (
                          <div className="grid grid-cols-2 gap-2.5">
                            <div className="space-y-1">
                              <Label className="text-[12px] text-[#8b9cb3]">{t("settings.imapServer")}</Label>
                              <Input placeholder="imap.exemple.com" className="bg-background border-border text-white h-9 text-[13px]" value={imapHost} onChange={(e) => setImapHost(e.target.value)} />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[12px] text-[#8b9cb3]">{t("settings.port")}</Label>
                              <Input type="number" placeholder="993" className="bg-background border-border text-white h-9 text-[13px]" value={imapPort} onChange={(e) => setImapPort(e.target.value)} />
                            </div>
                          </div>
                        )}

                        {selectedProvider !== "autre" && (
                          <button type="button" className="text-[12px] text-primary hover:underline" onClick={() => setShowAdvanced(!showAdvanced)}>
                            {showAdvanced ? t("settings.hideAdvancedConfig") : t("settings.advancedConfig")}
                          </button>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <Button onClick={handleImapConnect} disabled={connecting} size="sm">
                          {connecting ? t("settings.connecting") : t("settings.connect")}
                        </Button>
                        <Button variant="ghost" size="sm" className="text-[#8b9cb3] hover:text-white hover:bg-white/[0.04]" onClick={() => { setSelectedProvider(null); setConnectError(""); setImapEmail(""); setImapPassword(""); setImapHost(""); setImapPort(""); }}>
                          {t("common.cancel")}
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
              {t("settings.aiPreferences")}
            </h2>
            <div className="bg-card rounded-lg border border-border p-5 space-y-5">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-[13px] text-white">{t("settings.urgentBilling")}</Label>
                    <p className="text-[11px] text-[#8b9cb3]">{t("settings.urgentBillingDesc")}</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-[13px] text-white">{t("settings.taskExtraction")}</Label>
                    <p className="text-[11px] text-[#8b9cb3]">{t("settings.taskExtractionDesc")}</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-[13px] text-white">{t("settings.projectDetection")}</Label>
                    <p className="text-[11px] text-[#8b9cb3]">{t("settings.projectDetectionDesc")}</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-[14px] font-semibold text-white flex items-center gap-2 mb-3">
              <Pen className="w-4 h-4 text-primary" />
              {t("settings.emailSignature")}
            </h2>
            <div className="bg-card rounded-lg border border-border p-5 space-y-4">
              <p className="text-[12px] text-[#8b9cb3]">
                {t("settings.signatureDesc")}
              </p>
              {isLoading ? (
                <Skeleton className="h-32 w-full bg-white/5" />
              ) : (
                <div className="space-y-3">
                  <Textarea
                    value={signature}
                    onChange={(e) => setSignature(e.target.value)}
                    placeholder={"Cordialement,\n\nJean Dupont\nGérant — Inboria\njean@inboria.com\n+32 470 00 00 00"}
                    className="bg-background border-border text-white text-[13px] min-h-[140px] resize-y font-mono"
                  />
                  {signature && (
                    <div className="p-3 bg-background rounded-lg border border-border">
                      <p className="text-[11px] text-[#8b9cb3] mb-2">{t("settings.preview")} :</p>
                      <div className="text-[13px] text-white whitespace-pre-line">{signature}</div>
                    </div>
                  )}
                  <Button
                    onClick={handleSaveSignature}
                    disabled={updateProfile.isPending || signature === ((profile as any)?.signature || "")}
                    size="sm"
                  >
                    {updateProfile.isPending ? t("settings.saving") : t("settings.saveSignature")}
                  </Button>
                </div>
              )}
            </div>
          </section>

          <section>
            <h2 className="text-[14px] font-semibold text-white flex items-center gap-2 mb-3">
              <Shield className="w-4 h-4 text-primary" />
              {t("settings.managementMode")}
            </h2>
            <div className="bg-card rounded-lg border border-border p-5 space-y-4">
              <p className="text-[12px] text-[#8b9cb3]">
                {t("settings.managementModeDesc")}
              </p>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-[13px] text-white">{t("settings.autoArchive")}</Label>
                  <p className="text-[11px] text-[#8b9cb3]">{t("settings.autoArchiveDesc")}</p>
                </div>
                <Switch />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-[13px] text-white">{t("settings.autoMark")}</Label>
                  <p className="text-[11px] text-[#8b9cb3]">{t("settings.autoMarkDesc")}</p>
                </div>
                <Switch />
              </div>
              <div className="p-3 bg-primary/[0.06] rounded-lg border border-primary/10">
                <p className="text-[11px] text-primary">
                  {t("settings.manualModeInfo")}
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-[14px] font-semibold text-white flex items-center gap-2 mb-3">
              <User className="w-4 h-4 text-primary" />
              {t("settings.accountInfo")}
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
                    <Label className="text-[12px] text-[#8b9cb3]">{t("settings.email")}</Label>
                    <Input value={profile?.email} disabled className="bg-background border-border text-[#8b9cb3] h-9 text-[13px]" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[12px] text-[#8b9cb3]">{t("settings.fullName")}</Label>
                    <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="bg-background border-border text-white h-9 text-[13px]" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[12px] text-[#8b9cb3] flex items-center gap-1.5">
                      <Globe className="w-3 h-3" />
                      {t("settings.timezone")}
                    </Label>
                    <Select value={timezone} onValueChange={setTimezone}>
                      <SelectTrigger className="bg-background border-border text-white h-9 text-[13px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border max-h-[300px]">
                        {[
                          { value: "Europe/Brussels", label: "Europe/Brussels (CET/CEST)" },
                          { value: "Europe/Paris", label: "Europe/Paris (CET/CEST)" },
                          { value: "Europe/London", label: "Europe/London (GMT/BST)" },
                          { value: "Europe/Amsterdam", label: "Europe/Amsterdam (CET/CEST)" },
                          { value: "Europe/Berlin", label: "Europe/Berlin (CET/CEST)" },
                          { value: "Europe/Zurich", label: "Europe/Zurich (CET/CEST)" },
                          { value: "Europe/Luxembourg", label: "Europe/Luxembourg (CET/CEST)" },
                          { value: "Europe/Madrid", label: "Europe/Madrid (CET/CEST)" },
                          { value: "Europe/Rome", label: "Europe/Rome (CET/CEST)" },
                          { value: "Europe/Lisbon", label: "Europe/Lisbon (WET/WEST)" },
                          { value: "Europe/Warsaw", label: "Europe/Warsaw (CET/CEST)" },
                          { value: "Europe/Bucharest", label: "Europe/Bucharest (EET/EEST)" },
                          { value: "Europe/Athens", label: "Europe/Athens (EET/EEST)" },
                          { value: "Europe/Helsinki", label: "Europe/Helsinki (EET/EEST)" },
                          { value: "Europe/Moscow", label: "Europe/Moscow (MSK)" },
                          { value: "America/New_York", label: "America/New_York (EST/EDT)" },
                          { value: "America/Chicago", label: "America/Chicago (CST/CDT)" },
                          { value: "America/Denver", label: "America/Denver (MST/MDT)" },
                          { value: "America/Los_Angeles", label: "America/Los_Angeles (PST/PDT)" },
                          { value: "America/Toronto", label: "America/Toronto (EST/EDT)" },
                          { value: "America/Montreal", label: "America/Montreal (EST/EDT)" },
                          { value: "America/Sao_Paulo", label: "America/Sao_Paulo (BRT)" },
                          { value: "Asia/Dubai", label: "Asia/Dubai (GST)" },
                          { value: "Asia/Kolkata", label: "Asia/Kolkata (IST)" },
                          { value: "Asia/Singapore", label: "Asia/Singapore (SGT)" },
                          { value: "Asia/Tokyo", label: "Asia/Tokyo (JST)" },
                          { value: "Asia/Shanghai", label: "Asia/Shanghai (CST)" },
                          { value: "Australia/Sydney", label: "Australia/Sydney (AEST/AEDT)" },
                          { value: "Pacific/Auckland", label: "Pacific/Auckland (NZST/NZDT)" },
                          { value: "Africa/Casablanca", label: "Africa/Casablanca (WET/WEST)" },
                          { value: "Africa/Johannesburg", label: "Africa/Johannesburg (SAST)" },
                        ].map((tz) => (
                          <SelectItem key={tz.value} value={tz.value} className="text-[13px]">
                            {tz.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleSaveProfile} disabled={updateProfile.isPending || (fullName === (profile?.fullName ?? "") && timezone === ((profile as any)?.timezone ?? "Europe/Brussels"))} size="sm">
                    {updateProfile.isPending ? t("settings.saving") : t("common.save")}
                  </Button>
                </div>
              )}
            </div>
          </section>

          <section>
            <h2 className="text-[14px] font-semibold text-white flex items-center gap-2 mb-3">
              <Lock className="w-4 h-4 text-primary" />
              {t("settings.changePassword")}
            </h2>
            <div className="bg-card rounded-lg border border-border p-5">
              <div className="space-y-3 max-w-md">
                <div className="space-y-1.5">
                  <Label className="text-[12px] text-[#8b9cb3]">{t("settings.currentPassword")}</Label>
                  <div className="relative">
                    <Input
                      type={showCurrentPwd ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="bg-background border-border text-white h-9 text-[13px] pr-10"
                      placeholder={t("settings.currentPasswordPlaceholder")}
                    />
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8b9cb3] hover:text-white" onClick={() => setShowCurrentPwd(!showCurrentPwd)}>
                      {showCurrentPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[12px] text-[#8b9cb3]">{t("settings.newPassword")}</Label>
                  <div className="relative">
                    <Input
                      type={showNewPwd ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="bg-background border-border text-white h-9 text-[13px] pr-10"
                      placeholder={t("settings.newPasswordPlaceholder")}
                    />
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8b9cb3] hover:text-white" onClick={() => setShowNewPwd(!showNewPwd)}>
                      {showNewPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[12px] text-[#8b9cb3]">{t("settings.confirmNewPassword")}</Label>
                  <Input
                    type={showNewPwd ? "text" : "password"}
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    className="bg-background border-border text-white h-9 text-[13px]"
                    placeholder={t("settings.confirmNewPasswordPlaceholder")}
                  />
                </div>
                <Button
                  onClick={handleChangePassword}
                  disabled={changingPassword || !currentPassword || !newPassword || !confirmNewPassword}
                  size="sm"
                >
                  {changingPassword ? t("settings.changingPassword") : t("settings.changePasswordButton")}
                </Button>
              </div>
            </div>
          </section>
          
          <section>
            <h2 className="text-[14px] font-semibold text-white flex items-center gap-2 mb-3">
              <Bell className="w-4 h-4 text-primary" />
              {t("settings.notifications")}
            </h2>
            <div className="bg-card rounded-lg border border-border p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-[13px] text-white">{t("settings.morningBrief")}</Label>
                  <p className="text-[11px] text-[#8b9cb3]">{t("settings.morningBriefDesc")}</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-[13px] text-white">{t("settings.urgentAlerts")}</Label>
                  <p className="text-[11px] text-[#8b9cb3]">{t("settings.urgentAlertsDesc")}</p>
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
