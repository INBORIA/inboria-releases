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
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useTranslation } from 'react-i18next';

const IMAP_PROVIDERS = [
  // Gmail via App Password (contournement OAuth Google)
  { id: "gmail", name: "Gmail / Google Workspace", color: "bg-red-500/10 text-red-400", letter: "G", host: "imap.gmail.com", port: "993" },
  // Pro / hébergeurs internationaux
  { id: "ovh", name: "OVH", color: "bg-blue-500/10 text-blue-400", letter: "OV", host: "ssl0.ovh.net", port: "993" },
  { id: "ovhpro", name: "OVH Email Pro", color: "bg-blue-500/10 text-blue-400", letter: "OP", host: "pro3.mail.ovh.net", port: "993" },
  { id: "ionos", name: "Ionos (ex 1&1)", color: "bg-blue-500/10 text-blue-400", letter: "IO", host: "imap.ionos.fr", port: "993" },
  { id: "godaddy", name: "GoDaddy", color: "bg-blue-500/10 text-blue-400", letter: "GD", host: "imap.secureserver.net", port: "993" },
  { id: "zoho", name: "Zoho Mail", color: "bg-blue-500/10 text-blue-400", letter: "ZO", host: "imap.zoho.com", port: "993" },
  { id: "fastmail", name: "Fastmail", color: "bg-blue-500/10 text-blue-400", letter: "FM", host: "imap.fastmail.com", port: "993" },
  { id: "icloud", name: "iCloud / Apple", color: "bg-blue-500/10 text-blue-400", letter: "iC", host: "imap.mail.me.com", port: "993" },
  { id: "yahoo", name: "Yahoo Mail", color: "bg-blue-500/10 text-blue-400", letter: "YH", host: "imap.mail.yahoo.com", port: "993" },
  { id: "aol", name: "AOL Mail", color: "bg-blue-500/10 text-blue-400", letter: "AO", host: "imap.aol.com", port: "993" },
  // 🇩🇪 Allemagne
  { id: "gmx", name: "GMX", color: "bg-blue-500/10 text-blue-400", letter: "GM", host: "imap.gmx.com", port: "993" },
  { id: "webde", name: "Web.de", color: "bg-blue-500/10 text-blue-400", letter: "WD", host: "imap.web.de", port: "993" },
  { id: "tonline", name: "T-Online (Telekom)", color: "bg-blue-500/10 text-blue-400", letter: "TO", host: "secureimap.t-online.de", port: "993" },
  { id: "strato", name: "Strato", color: "bg-blue-500/10 text-blue-400", letter: "ST", host: "imap.strato.de", port: "993" },
  { id: "mailboxorg", name: "Mailbox.org", color: "bg-blue-500/10 text-blue-400", letter: "MB", host: "imap.mailbox.org", port: "993" },
  { id: "posteo", name: "Posteo", color: "bg-blue-500/10 text-blue-400", letter: "PO", host: "posteo.de", port: "993" },
  // 🇫🇷 France
  { id: "free", name: "Free", color: "bg-blue-500/10 text-blue-400", letter: "FR", host: "imap.free.fr", port: "993" },
  { id: "orange", name: "Orange / Wanadoo", color: "bg-blue-500/10 text-blue-400", letter: "OR", host: "imap.orange.fr", port: "993" },
  { id: "sfr", name: "SFR", color: "bg-blue-500/10 text-blue-400", letter: "SF", host: "imap.sfr.fr", port: "993" },
  { id: "bouygues", name: "Bouygues Telecom", color: "bg-blue-500/10 text-blue-400", letter: "BT", host: "mail.bbox.fr", port: "993" },
  { id: "laposte", name: "La Poste", color: "bg-blue-500/10 text-blue-400", letter: "LP", host: "imap.laposte.net", port: "993" },
  { id: "mailo", name: "Mailo (ex Net-C)", color: "bg-blue-500/10 text-blue-400", letter: "MO", host: "mail.mailo.com", port: "993" },
  // 🇳🇱 Pays-Bas
  { id: "kpn", name: "KPN", color: "bg-blue-500/10 text-blue-400", letter: "KP", host: "mail.kpnmail.nl", port: "993" },
  { id: "ziggo", name: "Ziggo", color: "bg-blue-500/10 text-blue-400", letter: "ZG", host: "imap.ziggo.nl", port: "993" },
  { id: "xs4all", name: "XS4ALL", color: "bg-blue-500/10 text-blue-400", letter: "XS", host: "imap.xs4all.nl", port: "993" },
  // 🇪🇸 Espagne
  { id: "movistar", name: "Movistar / Telefónica", color: "bg-blue-500/10 text-blue-400", letter: "MV", host: "imap.movistar.es", port: "993" },
  { id: "telefonica", name: "Telefónica.net", color: "bg-blue-500/10 text-blue-400", letter: "TF", host: "imap.telefonica.net", port: "993" },
  // 🇬🇧 UK
  { id: "btinternet", name: "BT Internet", color: "bg-blue-500/10 text-blue-400", letter: "BI", host: "mail.btinternet.com", port: "993" },
  { id: "sky", name: "Sky", color: "bg-blue-500/10 text-blue-400", letter: "SK", host: "imap.tools.sky.com", port: "993" },
  { id: "virginmedia", name: "Virgin Media", color: "bg-blue-500/10 text-blue-400", letter: "VM", host: "imap.virginmedia.com", port: "993" },
  // 🇺🇸 US (autres que Yahoo/AOL/iCloud déjà listés)
  { id: "comcast", name: "Comcast / Xfinity", color: "bg-blue-500/10 text-blue-400", letter: "CO", host: "imap.comcast.net", port: "993" },
  { id: "att", name: "AT&T / Bellsouth", color: "bg-blue-500/10 text-blue-400", letter: "AT", host: "imap.mail.att.net", port: "993" },
  { id: "cox", name: "Cox", color: "bg-blue-500/10 text-blue-400", letter: "CX", host: "imap.cox.net", port: "993" },
  // 🌐 International
  { id: "yandex", name: "Yandex Mail", color: "bg-blue-500/10 text-blue-400", letter: "YA", host: "imap.yandex.com", port: "993" },
  { id: "mailru", name: "Mail.ru", color: "bg-blue-500/10 text-blue-400", letter: "MR", host: "imap.mail.ru", port: "993" },
  { id: "qq", name: "QQ Mail (Tencent)", color: "bg-blue-500/10 text-blue-400", letter: "QQ", host: "imap.qq.com", port: "993" },
  { id: "netease163", name: "NetEase 163", color: "bg-blue-500/10 text-blue-400", letter: "NE", host: "imap.163.com", port: "993" },
  { id: "naver", name: "Naver", color: "bg-blue-500/10 text-blue-400", letter: "NA", host: "imap.naver.com", port: "993" },
  // Saisie manuelle
  { id: "autre", name: "Autre fournisseur", color: "bg-blue-500/10 text-blue-400", letter: "?", host: "", port: "993" },
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

  const WIZARD_STORAGE_KEY = "inboria.imapWizard.v1";
  const WIZARD_TTL_MS = 30 * 60 * 1000;
  const wizardHydratedRef = useRef(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(WIZARD_STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data && typeof data === "object" && Date.now() - (data.savedAt || 0) <= WIZARD_TTL_MS) {
          if (data.selectedProvider) setSelectedProvider(data.selectedProvider);
          if (data.imapEmail) setImapEmail(data.imapEmail);
          if (data.imapPassword) setImapPassword(data.imapPassword);
          if (data.imapHost) setImapHost(data.imapHost);
          if (data.imapPort) setImapPort(data.imapPort);
          if (data.showAdvanced) setShowAdvanced(true);
        } else {
          sessionStorage.removeItem(WIZARD_STORAGE_KEY);
        }
      }
    } catch {}
    wizardHydratedRef.current = true;
  }, []);

  useEffect(() => {
    if (!wizardHydratedRef.current) return;
    try {
      if (!selectedProvider) {
        sessionStorage.removeItem(WIZARD_STORAGE_KEY);
        return;
      }
      sessionStorage.setItem(
        WIZARD_STORAGE_KEY,
        JSON.stringify({
          selectedProvider,
          imapEmail,
          imapPassword,
          imapHost,
          imapPort,
          showAdvanced,
          savedAt: Date.now(),
        })
      );
    } catch {}
  }, [selectedProvider, imapEmail, imapPassword, imapHost, imapPort, showAdvanced]);

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
        const isGmail = selectedProvider === "gmail" || imapEmail.toLowerCase().endsWith("@gmail.com") || imapEmail.toLowerCase().endsWith("@googlemail.com");
        setConnectError(isGmail ? t("settings.gmailConnectError") : (data.error || t("settings.connectionFailed")));
        if (data.needsManualConfig && selectedProvider !== "gmail") setShowAdvanced(true);
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
                  {connections && connections.length > 0 && (
                    <h3 className="text-[12px] font-semibold uppercase tracking-wide text-[#8b9cb3] mb-1">
                      {t("settings.connectedAccounts", "Comptes connectés")}
                    </h3>
                  )}
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

                  <div className={connections && connections.length > 0 ? "pt-4 mt-2 border-t border-border space-y-3" : "space-y-3"}>
                    <h3 className="text-[12px] font-semibold uppercase tracking-wide text-[#8b9cb3]">
                      {t("settings.addNewAccount", "Ajouter un compte")}
                    </h3>

                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 border border-border rounded-lg bg-background">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-red-500/10 rounded-lg flex items-center justify-center text-red-400 font-bold text-sm">G</div>
                      <div>
                        <h4 className="font-medium text-[13px] text-white">Gmail / Google Workspace</h4>
                        <p className="text-[11px] text-[#8b9cb3]">{t("settings.gmailAppPasswordDesc")}</p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-transparent border-border text-[#8b9cb3] hover:text-white hover:bg-white/[0.04] h-8 text-[12px]"
                      onClick={() => {
                        setSelectedProvider("gmail");
                        setImapHost("imap.gmail.com");
                        setImapPort("993");
                        setShowAdvanced(false);
                        setConnectError("");
                      }}
                    >
                      {t("settings.connectGmail")}
                    </Button>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 border border-border rounded-lg bg-background">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-blue-500/10 rounded-lg flex items-center justify-center text-blue-400 font-bold text-sm">M</div>
                      <div>
                        <h4 className="font-medium text-[13px] text-white">{t("settings.microsoftTitle", "Outlook / Microsoft 365")}</h4>
                        <p className="text-[11px] text-[#8b9cb3]">{t("settings.microsoftDesc", "Compte personnel ou professionnel (Exchange, Office 365)")}</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="bg-transparent border-border text-[#8b9cb3] hover:text-white hover:bg-white/[0.04] h-8 text-[12px]" onClick={() => handleOAuthConnect("outlook")}>
                      {t("settings.connectMicrosoft", "Connecter Microsoft")}
                    </Button>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 border border-border rounded-lg bg-background">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-blue-500/10 rounded-lg flex items-center justify-center text-blue-400 font-bold text-sm">@</div>
                      <div>
                        <h4 className="font-medium text-[13px] text-white">{t("settings.imapTitle", "Autre fournisseur (IMAP)")}</h4>
                        <p className="text-[11px] text-[#8b9cb3]">{t("settings.imapDesc", "OVH, GoDaddy, Yahoo, iCloud, Free, Orange et plus")}</p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-transparent border-border text-[#8b9cb3] hover:text-white hover:bg-white/[0.04] h-8 text-[12px]"
                      onClick={() => {
                        setSelectedProvider("ovh");
                        setImapHost("ssl0.ovh.net");
                        setImapPort("993");
                        setShowAdvanced(false);
                        setConnectError("");
                      }}
                    >
                      {t("settings.connectImap", "Connecter")}
                    </Button>
                  </div>
                  </div>


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
                          <Label className="text-[12px] text-[#8b9cb3]">{t("settings.provider", "Fournisseur")}</Label>
                          <Select
                            value={selectedProvider ?? undefined}
                            onValueChange={(value) => {
                              setSelectedProvider(value);
                              const prov = IMAP_PROVIDERS.find(p => p.id === value);
                              if (prov) {
                                setImapHost(prov.host);
                                setImapPort(prov.port);
                                setShowAdvanced(value === "autre");
                              }
                              setConnectError("");
                            }}
                          >
                            <SelectTrigger className="bg-background border-border text-white h-9 text-[13px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="max-h-[280px]">
                              {IMAP_PROVIDERS.map(p => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.id === "autre" ? t("settings.otherProvider") : p.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[12px] text-[#8b9cb3]">{t("settings.emailAddress")}</Label>
                          <Input
                            type="email"
                            placeholder="votre@email.com"
                            className="bg-background border-border text-white h-9 text-[13px]"
                            value={imapEmail}
                            onChange={(e) => {
                              const v = e.target.value;
                              setImapEmail(v);
                              const domain = v.split("@")[1]?.toLowerCase().trim();
                              if (domain === "gmail.com" || domain === "googlemail.com") {
                                if (selectedProvider !== "gmail") {
                                  setSelectedProvider("gmail");
                                  setImapHost("imap.gmail.com");
                                  setImapPort("993");
                                  setShowAdvanced(false);
                                }
                              }
                            }}
                          />
                        </div>

                        {selectedProvider === "gmail" && (
                          <div className="p-3 bg-background rounded-lg border border-primary/20 space-y-2">
                            <p className="text-[12px] font-semibold text-white">{t("settings.gmailWizardTitle")}</p>
                            <ol className="text-[11px] text-[#8b9cb3] space-y-1.5 list-decimal list-inside">
                              <li>
                                {t("settings.gmailWizardStep1")}{" "}
                                <a href="https://myaccount.google.com/security" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                  myaccount.google.com/security
                                </a>
                              </li>
                              <li>
                                {t("settings.gmailWizardStep2")}{" "}
                                <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                  myaccount.google.com/apppasswords
                                </a>
                              </li>
                              <li>{t("settings.gmailWizardStep3")}</li>
                              <li>{t("settings.gmailWizardStep4")}</li>
                            </ol>
                            <p className="text-[11px] text-[#8b9cb3] italic">{t("settings.gmailWizardNote")}</p>
                          </div>
                        )}

                        <div className="space-y-1">
                          <Label className="text-[12px] text-[#8b9cb3]">{t("settings.appPassword")}</Label>
                          <div className="relative">
                            <Input type={showPassword ? "text" : "password"} placeholder={t("settings.appPassword")} className="bg-background border-border text-white h-9 text-[13px] pr-10" value={imapPassword} onChange={(e) => setImapPassword(e.target.value)} />
                            <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8b9cb3] hover:text-white" onClick={() => setShowPassword(!showPassword)}>
                              {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>

                        {selectedProvider !== "gmail" && (selectedProvider === "autre" || showAdvanced) && (
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
