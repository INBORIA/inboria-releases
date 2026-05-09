import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useEnableLightTheme } from "@/lib/inbox-theme";
import {
  useGetProfile,
  useUpdateProfile,
  useGetMyOrganisation,
  getGetProfileQueryKey,
  getGetSharedMailboxesQueryKey,
  useListInboriaMailboxSettings,
  useUpdateInboriaMailboxSetting,
  getListInboriaMailboxSettingsQueryKey,
} from "@workspace/api-client-react";
import type { InboriaMailboxSetting } from "@workspace/api-client-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Users2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Mail, User, CheckCircle2, Trash2, Eye, EyeOff, AlertCircle, Pen, Lock, Globe, ArrowLeft, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { Textarea } from "@/components/ui/textarea";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useTranslation } from 'react-i18next';
import { SignatureEditor } from "@/components/signature/signature-editor";
import { TwoFactorSection } from "@/components/security/TwoFactorSection";

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
  signature?: string | null;
  shared_mailbox_id?: string | null;
  is_shared?: boolean;
  consecutive_failures?: number | null;
  last_error_at?: string | null;
  last_error_message?: string | null;
}

const PERSONAL_EMAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com",
  "outlook.com", "hotmail.com", "live.com", "msn.com",
  "yahoo.com", "yahoo.fr", "ymail.com",
  "icloud.com", "me.com", "mac.com",
  "laposte.net", "orange.fr", "wanadoo.fr", "free.fr", "sfr.fr",
  "gmx.com", "gmx.fr", "gmx.de",
  "proton.me", "protonmail.com",
]);

function isPersonalDomain(email: string): boolean {
  const at = email.lastIndexOf("@");
  if (at < 0) return false;
  return PERSONAL_EMAIL_DOMAINS.has(email.slice(at + 1).toLowerCase());
}

type ImpactedMember = { userId: string; fullName: string | null; email: string | null };

function AccountConnectionCard({
  conn,
  onDisconnect,
  onSaveSignature,
  onShare,
  onUnshare,
  onFetchShareMembers,
  isAdmin,
  isPlanEntitled,
  t,
}: {
  conn: EmailConnection;
  onDisconnect: () => void;
  onSaveSignature: (value: string) => void;
  onShare: () => Promise<void>;
  onUnshare: () => Promise<void>;
  onFetchShareMembers: () => Promise<ImpactedMember[]>;
  isAdmin: boolean;
  isPlanEntitled: boolean;
  t: any;
}) {
  const [sigDraft, setSigDraft] = useState(conn.signature || "");
  const [editing, setEditing] = useState(false);
  const [confirmShareOpen, setConfirmShareOpen] = useState(false);
  const [confirmUnshareOpen, setConfirmUnshareOpen] = useState(false);
  const [toggleBusy, setToggleBusy] = useState(false);
  const [unshareMembers, setUnshareMembers] = useState<ImpactedMember[] | null>(null);
  const [unshareMembersLoading, setUnshareMembersLoading] = useState(false);
  useEffect(() => { setSigDraft(conn.signature || ""); }, [conn.signature]);
  const saved = (conn.signature || "");
  const dirty = sigDraft !== saved;
  const isShared = !!conn.is_shared;
  const personal = isPersonalDomain(conn.email_address);
  const showToggle = isAdmin;
  const toggleDisabled = !isPlanEntitled || toggleBusy;

  async function handleToggleChange(next: boolean) {
    if (next === isShared) return;
    if (!isPlanEntitled) return;
    if (next) {
      if (personal) {
        setConfirmShareOpen(true);
      } else {
        setToggleBusy(true);
        try { await onShare(); } finally { setToggleBusy(false); }
      }
    } else {
      setUnshareMembers(null);
      setConfirmUnshareOpen(true);
      setUnshareMembersLoading(true);
      try {
        const members = await onFetchShareMembers();
        setUnshareMembers(members);
      } catch {
        setUnshareMembers([]);
      } finally {
        setUnshareMembersLoading(false);
      }
    }
  }

  async function confirmShare() {
    setConfirmShareOpen(false);
    setToggleBusy(true);
    try { await onShare(); } finally { setToggleBusy(false); }
  }

  async function confirmUnshare() {
    setConfirmUnshareOpen(false);
    setToggleBusy(true);
    try { await onUnshare(); } finally { setToggleBusy(false); }
  }

  return (
    <div className="flex flex-col gap-3 p-3.5 border border-border rounded-lg bg-background">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm ${
            conn.provider === "gmail" ? "bg-red-500/10 text-red-400" :
            conn.provider === "outlook" ? "bg-blue-500/10 text-blue-400" :
            "bg-white/[0.06] text-[#b8c5d6]"
          }`}>
            {conn.provider === "gmail" ? "G" : conn.provider === "outlook" ? "O" : "@"}
          </div>
          <div>
            <h4 className="font-medium text-[13px] text-white flex items-center gap-2">
              {conn.email_address}
              {isShared && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                  <Users2 className="w-3 h-3" />
                  {t("settings.sharedBadge", "Partagée")}
                </span>
              )}
            </h4>
            {(conn.consecutive_failures ?? 0) >= 3 ? (
              <p className="text-[11px] text-red-400 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                <TooltipProvider delayDuration={150}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-help underline decoration-dotted underline-offset-2">
                        {t("settings.disconnectedBadge", "Déconnectée")}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="text-[11px]">
                        {t("settings.disconnectedTooltip", "Reconnectez ce compte pour reprendre la synchronisation.")}
                      </p>
                      {conn.last_error_message && (
                        <p className="text-[10px] mt-1 text-[#b8c5d6] break-words">
                          {conn.last_error_message}
                        </p>
                      )}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                {conn.last_error_at && (
                  <span className="text-[#b8c5d6] ml-1.5">
                    — {new Date(conn.last_error_at).toLocaleString()}
                  </span>
                )}
              </p>
            ) : (
              <p className="text-[11px] text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                {t("settings.connected")}
                {conn.last_synced_at && (
                  <span className="text-[#b8c5d6] ml-1.5">
                    — {t("settings.sync")} : {new Date(conn.last_synced_at).toLocaleString()}
                  </span>
                )}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-[#b8c5d6] hover:text-white hover:bg-white/[0.04] h-8 text-[12px]"
            onClick={() => setEditing((v) => !v)}
          >
            <Pen className="w-3.5 h-3.5 mr-1.5" />
            {editing ? t("common.close", "Fermer") : t("settings.accountSignature", "Signature")}
          </Button>
          <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 text-[12px]" onClick={onDisconnect}>
            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
            {t("settings.disconnect")}
          </Button>
        </div>
      </div>
      {showToggle && (
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-border">
          <div className="flex items-start gap-2">
            <Users2 className="w-3.5 h-3.5 text-[#b8c5d6] mt-0.5" />
            <div>
              <Label className="text-[12px] text-white">
                {t("settings.shareWithTeam", "Partager avec l'équipe")}
              </Label>
              <p className="text-[11px] text-[#b8c5d6] mt-0.5">
                {isShared
                  ? t("settings.shareWithTeamOnDesc", "Vos collègues membres voient les emails et peuvent les traiter.")
                  : t("settings.shareWithTeamOffDesc", "Boîte personnelle. Seul vous voyez les emails.")}
              </p>
            </div>
          </div>
          {isPlanEntitled ? (
            <Switch
              checked={isShared}
              disabled={toggleDisabled}
              onCheckedChange={handleToggleChange}
            />
          ) : (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-block cursor-not-allowed opacity-60">
                    <Switch checked={false} disabled aria-disabled />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="left">
                  {t("settings.shareRequiresPlan", "Disponible avec les plans Pro et Business.")}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      )}
      <AlertDialog open={confirmShareOpen} onOpenChange={setConfirmShareOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("settings.shareConfirmPersonalTitle", "Vraiment partager cette adresse personnelle ?")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("settings.shareConfirmPersonalDesc", "L'adresse {{email}} ressemble à une boîte mail personnelle. Tous les membres de votre organisation pourront lire vos emails entrants et y répondre. Cette action est destinée aux boîtes professionnelles partagées (support@, contact@…).", { email: conn.email_address })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel", "Annuler")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmShare}>
              {t("settings.shareConfirmYes", "Oui, partager")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={confirmUnshareOpen} onOpenChange={setConfirmUnshareOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("settings.unshareConfirmTitle", "Arrêter le partage avec l'équipe ?")}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  {t("settings.unshareConfirmDesc", "Les membres de votre organisation ne verront plus les emails de {{email}}. Vos emails restent disponibles dans votre boîte personnelle.", { email: conn.email_address })}
                </p>
                {unshareMembersLoading && (
                  <p className="text-[12px] text-[#b8c5d6]">
                    {t("settings.unshareMembersLoading", "Chargement des membres concernés…")}
                  </p>
                )}
                {!unshareMembersLoading && unshareMembers && unshareMembers.length > 0 && (
                  <div className="rounded-md border border-border bg-background/40 p-2.5">
                    <p className="text-[12px] font-medium text-white mb-1.5">
                      {t("settings.unshareMembersImpactedTitle", "Membres qui perdront l'accès :")}
                    </p>
                    <ul className="text-[12px] text-[#c5cee0] space-y-0.5 max-h-32 overflow-y-auto">
                      {unshareMembers.map((m) => (
                        <li key={m.userId} className="truncate">
                          {m.fullName || m.email || m.userId}
                          {m.fullName && m.email && (
                            <span className="text-[#b8c5d6]"> — {m.email}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {!unshareMembersLoading && unshareMembers && unshareMembers.length === 0 && (
                  <p className="text-[12px] text-[#b8c5d6]">
                    {t("settings.unshareMembersNone", "Aucun autre membre n'a actuellement accès à cette boîte.")}
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel", "Annuler")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmUnshare}>
              {t("settings.unshareConfirmYes", "Arrêter le partage")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {editing && (
        <div className="space-y-2 pt-2 border-t border-border">
          <Label className="text-[11px] text-[#b8c5d6]">{t("settings.accountSignatureLabel", "Signature pour ce compte")}</Label>
          <SignatureEditor
            value={sigDraft}
            onChange={setSigDraft}
            placeholder={t("settings.accountSignaturePlaceholder", "Signature spécifique à ce compte (laisser vide pour aucune signature)")}
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              className="h-8 text-[12px]"
              disabled={!dirty}
              onClick={() => onSaveSignature(sigDraft)}
            >
              {t("common.save")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
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

function InboriaPrivacySection({ t }: { t: any }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useListInboriaMailboxSettings({
    query: { queryKey: getListInboriaMailboxSettingsQueryKey() },
  });
  const updateMutation = useUpdateInboriaMailboxSetting();
  const { toast } = useToast();
  const [pending, setPending] = useState<string | null>(null);

  const personal: InboriaMailboxSetting[] = (data as any)?.personal ?? [];
  const shared: InboriaMailboxSetting[] = (data as any)?.shared ?? [];
  const all = [...personal, ...shared];

  async function handleToggle(item: InboriaMailboxSetting, next: boolean) {
    const key = `${item.kind}:${item.id}`;
    setPending(key);
    try {
      await updateMutation.mutateAsync({
        data: { kind: item.kind, id: item.id, enabled: next },
      });
      await queryClient.invalidateQueries({
        queryKey: getListInboriaMailboxSettingsQueryKey(),
      });
      toast({
        title: next
          ? t("settings.inboriaPrivacyToastOn", "Mémoire Inboria activée pour cette boîte.")
          : t("settings.inboriaPrivacyToastOff", "Mémoire Inboria désactivée pour cette boîte."),
      });
    } catch (err: any) {
      toast({
        title: t("settings.inboriaPrivacyToastError", "Impossible de modifier le paramètre."),
        variant: "destructive" as any,
      });
    } finally {
      setPending(null);
    }
  }

  function renderRow(item: InboriaMailboxSetting) {
    const key = `${item.kind}:${item.id}`;
    return (
      <div
        key={key}
        className="flex items-center justify-between gap-3 p-3 border border-border rounded-lg bg-background"
        data-testid={`row-inboria-mailbox-${item.kind}-${item.id}`}
      >
        <div className="flex items-start gap-2 min-w-0">
          <Sparkles className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />
          <div className="min-w-0">
            <div className="text-[13px] text-white truncate">{item.label}</div>
            <div className="text-[11px] text-[#b8c5d6] truncate">
              {item.kind === "shared"
                ? t("settings.inboriaPrivacySharedHint", "Boîte partagée — affecte toute l'équipe")
                : item.emailAddress}
            </div>
          </div>
        </div>
        <Switch
          checked={item.enabled}
          disabled={pending === key}
          onCheckedChange={(next) => handleToggle(item, next)}
          data-testid={`switch-inboria-${item.kind}-${item.id}`}
        />
      </div>
    );
  }

  return (
    <section>
      <h2 className="text-[14px] font-semibold text-white flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-primary" />
        {t("settings.inboriaPrivacyTitle", "Confidentialité — Mémoire Inboria")}
      </h2>
      <div className="bg-card rounded-lg border border-border p-5 space-y-3">
        <p className="text-[12px] text-[#b8c5d6]">
          {t(
            "settings.inboriaPrivacyDesc",
            "Inboria mémorise les préférences, sujets, décisions et engagements présents dans vos emails pour personnaliser ses réponses. Désactivez la mémoire sur une boîte pour qu'elle soit ignorée — par exemple votre boîte personnelle.",
          )}
        </p>
        {isLoading ? (
          <Skeleton className="h-12 w-full bg-white/5" />
        ) : all.length === 0 ? (
          <p className="text-[12px] text-[#b8c5d6] py-4 text-center">
            {t(
              "settings.inboriaPrivacyEmpty",
              "Aucune boîte mail connectée pour l'instant.",
            )}
          </p>
        ) : (
          <>
            {personal.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-[12px] font-semibold uppercase tracking-wide text-[#b8c5d6]">
                  {t("settings.inboriaPrivacyPersonal", "Vos boîtes personnelles")}
                </h3>
                {personal.map(renderRow)}
              </div>
            )}
            {shared.length > 0 && (
              <div className="space-y-2 pt-2">
                <h3 className="text-[12px] font-semibold uppercase tracking-wide text-[#b8c5d6]">
                  {t("settings.inboriaPrivacyShared", "Boîtes partagées de l'équipe")}
                </h3>
                {shared.map(renderRow)}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

export default function ParametresMonCompte() {
  useEnableLightTheme();
  const { t } = useTranslation();
  const { data: profile, isLoading } = useGetProfile();
  const updateProfile = useUpdateProfile();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { session } = useAuth();
  const { data: connections, isLoading: connectionsLoading } = useEmailConnections();
  const { data: org } = useGetMyOrganisation();
  const isOrgAdmin = (org as any)?.myRole === "admin";
  const isOrgMember = !!(org as any)?.id && (org as any)?.myRole !== "admin";
  const userPlan = (profile as any)?.plan;
  const canShareWithTeam = isOrgAdmin && (userPlan === "business" || userPlan === "pro");

  const [fullName, setFullName] = useState("");
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
  const [followUpDelayDays, setFollowUpDelayDays] = useState<number>(5);
  const [trackingEnabled, setTrackingEnabled] = useState<boolean>(false);
  const [meetingRemindersEnabled, setMeetingRemindersEnabled] = useState<boolean>(true);
  type VideoProv = "none" | "jitsi" | "meet" | "teams";
  const [preferredVideoProvider, setPreferredVideoProvider] = useState<VideoProv>("none");

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
      setTimezone((profile as any).timezone || "Europe/Brussels");
      const d = (profile as any).followUpDelayDays;
      setFollowUpDelayDays(typeof d === "number" && d >= 1 && d <= 60 ? d : 5);
      setTrackingEnabled(!!(profile as any).trackingEnabled);
      const mr = (profile as any).meetingRemindersEnabled;
      setMeetingRemindersEnabled(mr !== false);
      const pv = (profile as any).preferredVideoProvider;
      if (pv === "meet" || pv === "teams" || pv === "jitsi" || pv === "none") {
        setPreferredVideoProvider(pv);
      }
    }
  }, [profile]);

  const handleChangePreferredVideo = (next: VideoProv) => {
    const prev = preferredVideoProvider;
    setPreferredVideoProvider(next);
    updateProfile.mutate(
      { data: { preferredVideoProvider: next } as any },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
          toast({ title: t("settings.profileUpdated") });
        },
        onError: () => setPreferredVideoProvider(prev),
      },
    );
  };

  const handleToggleMeetingReminders = (next: boolean) => {
    setMeetingRemindersEnabled(next);
    updateProfile.mutate(
      { data: { meetingRemindersEnabled: next } as any },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
          toast({ title: t("settings.profileUpdated") });
        },
        onError: () => setMeetingRemindersEnabled(!next),
      },
    );
  };

  const handleToggleTracking = (next: boolean) => {
    setTrackingEnabled(next);
    updateProfile.mutate(
      { data: { trackingEnabled: next } as any },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
          toast({ title: t("settings.profileUpdated") });
        },
        onError: () => {
          setTrackingEnabled(!next);
        },
      }
    );
  };

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
    const safeDelay = Math.max(1, Math.min(60, Math.round(followUpDelayDays || 5)));
    updateProfile.mutate(
      { data: { fullName, timezone, followUpDelayDays: safeDelay } as any },
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
        const serverMsg = data.error || t("settings.connectionFailed");
        // Only show the "check your app password" hint on auth failures (401).
        // Timeouts (408) and other errors keep the server's real message so the
        // user isn't misled into thinking their password is wrong.
        if (isGmail && res.status === 401) {
          setConnectError(t("settings.gmailConnectError"));
        } else {
          setConnectError(serverMsg);
        }
        if (data.needsManualConfig && selectedProvider !== "gmail") setShowAdvanced(true);
      }
    } catch {
      setConnectError(t("settings.connectionError"));
    } finally {
      setConnecting(false);
    }
  };

  const handleSaveAccountSignature = async (connectionId: string, value: string) => {
    try {
      const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${baseUrl}/api/email/connections/${connectionId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ signature: value }),
      });
      if (!res.ok) throw new Error("Save failed");
      queryClient.invalidateQueries({ queryKey: ["email-connections"] });
      toast({ title: t("settings.signatureSaved") });
    } catch {
      toast({ variant: "destructive", title: t("common.error") });
    }
  };

  const handleDisconnect = async (connectionId: string) => {
    try {
      const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${baseUrl}/api/email/connections/${connectionId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.status === 409) {
        toast({
          variant: "destructive",
          title: t("settings.cannotDisconnectSharedTitle", "Désactivez d'abord le partage"),
          description: t(
            "settings.cannotDisconnectSharedDesc",
            "Ce compte alimente une boîte partagée d'équipe. Désactivez le toggle « Partager avec l'équipe » avant de déconnecter le compte.",
          ),
        });
        return;
      }
      if (!res.ok) {
        toast({ variant: "destructive", title: t("common.error") });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["email-connections"] });
      toast({ title: t("settings.disconnected") });
    } catch {
      toast({ variant: "destructive", title: t("common.error") });
    }
  };

  const handleShareConnection = async (connectionId: string) => {
    const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");
    try {
      const res = await fetch(`${baseUrl}/api/email/connections/${connectionId}/share`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({}),
      });
      if (res.status === 409) {
        queryClient.invalidateQueries({ queryKey: ["email-connections"] });
        queryClient.invalidateQueries({ queryKey: getGetSharedMailboxesQueryKey() });
        toast({ title: t("settings.shareAlreadyShared", "Ce compte est déjà partagé.") });
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast({
          variant: "destructive",
          title: body?.message || body?.error || t("common.error"),
        });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["email-connections"] });
      queryClient.invalidateQueries({ queryKey: getGetSharedMailboxesQueryKey() });
      toast({ title: t("settings.shareSuccess", "Compte partagé avec l'équipe") });
    } catch {
      toast({ variant: "destructive", title: t("common.error") });
    }
  };

  const handleFetchShareMembers = async (connectionId: string): Promise<ImpactedMember[]> => {
    const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");
    try {
      const res = await fetch(`${baseUrl}/api/email/connections/${connectionId}/share/members`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!res.ok) return [];
      const body = await res.json().catch(() => ({}));
      return Array.isArray(body?.members) ? body.members : [];
    } catch {
      return [];
    }
  };

  const handleUnshareConnection = async (connectionId: string) => {
    const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");
    try {
      const res = await fetch(`${baseUrl}/api/email/connections/${connectionId}/share`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast({
          variant: "destructive",
          title: body?.message || body?.error || t("common.error"),
        });
        return;
      }
      const body = await res.json().catch(() => ({}));
      const impacted = Array.isArray(body?.impactedMembers) ? body.impactedMembers : [];
      queryClient.invalidateQueries({ queryKey: ["email-connections"] });
      queryClient.invalidateQueries({ queryKey: getGetSharedMailboxesQueryKey() });
      const toastTitle = t("settings.unshareSuccess", "Partage désactivé");
      const toastDesc = impacted.length > 0
        ? t("settings.unshareSuccessDesc", "{{count}} membre(s) ont perdu l'accès.", { count: impacted.length })
        : undefined;
      toast({ title: toastTitle, description: toastDesc });
    } catch {
      toast({ variant: "destructive", title: t("common.error") });
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-5">
        {!isOrgMember && (
          <div className="mb-2">
            <Link href="/dashboard/parametres">
              <Button variant="ghost" size="sm" className="h-7 px-2 text-[#b8c5d6] hover:text-white">
                <ArrowLeft className="w-3.5 h-3.5 mr-1" /> {t("settings.title")}
              </Button>
            </Link>
          </div>
        )}
        <div className="mb-5">
          <h1 className="text-[16px] font-semibold text-white tracking-tight">{t("settings.hub.myAccount", "Mon compte")}</h1>
          <p className="text-[12px] text-[#b8c5d6] mt-0.5">{t("settings.hub.myAccountDesc", "Profil, sécurité, comptes email, Inboria et notifications")}</p>
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
                    <h3 className="text-[12px] font-semibold uppercase tracking-wide text-[#b8c5d6] mb-1">
                      {t("settings.connectedAccounts", "Comptes connectés")}
                    </h3>
                  )}
                  {connections?.map((conn) => (
                    <AccountConnectionCard
                      key={conn.id}
                      conn={conn}
                      onDisconnect={() => handleDisconnect(conn.id)}
                      onSaveSignature={(val) => handleSaveAccountSignature(conn.id, val)}
                      onShare={() => handleShareConnection(conn.id)}
                      onUnshare={() => handleUnshareConnection(conn.id)}
                      onFetchShareMembers={() => handleFetchShareMembers(conn.id)}
                      isAdmin={isOrgAdmin}
                      isPlanEntitled={canShareWithTeam}
                      t={t}
                    />
                  ))}

                  <div className={connections && connections.length > 0 ? "pt-4 mt-2 border-t border-border space-y-3" : "space-y-3"}>
                    <h3 className="text-[12px] font-semibold uppercase tracking-wide text-[#b8c5d6]">
                      {t("settings.addNewAccount", "Ajouter un compte")}
                    </h3>

                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 border border-border rounded-lg bg-background">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-red-500/10 rounded-lg flex items-center justify-center text-red-400 font-bold text-sm">G</div>
                      <div>
                        <h4 className="font-medium text-[13px] text-white">Gmail / Google Workspace</h4>
                        <p className="text-[11px] text-[#b8c5d6]">{t("settings.gmailAppPasswordDesc")}</p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-transparent border-border text-[#b8c5d6] hover:text-white hover:bg-white/[0.04] h-8 text-[12px]"
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
                        <p className="text-[11px] text-[#b8c5d6]">{t("settings.microsoftDesc", "Compte personnel ou professionnel (Exchange, Office 365)")}</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="bg-transparent border-border text-[#b8c5d6] hover:text-white hover:bg-white/[0.04] h-8 text-[12px]" onClick={() => handleOAuthConnect("outlook")}>
                      {t("settings.connectMicrosoft", "Connecter Microsoft")}
                    </Button>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 border border-border rounded-lg bg-background">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-blue-500/10 rounded-lg flex items-center justify-center text-blue-400 font-bold text-sm">@</div>
                      <div>
                        <h4 className="font-medium text-[13px] text-white">{t("settings.imapTitle", "Autre fournisseur (IMAP)")}</h4>
                        <p className="text-[11px] text-[#b8c5d6]">{t("settings.imapDesc", "OVH, GoDaddy, Yahoo, iCloud, Free, Orange et plus")}</p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-transparent border-border text-[#b8c5d6] hover:text-white hover:bg-white/[0.04] h-8 text-[12px]"
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
                          <Label className="text-[12px] text-[#b8c5d6]">{t("settings.provider", "Fournisseur")}</Label>
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
                          <Label className="text-[12px] text-[#b8c5d6]">{t("settings.emailAddress")}</Label>
                          <Input
                            type="email"
                            placeholder={t("auth.emailPlaceholder")}
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
                          <>
                            <div className="p-3 bg-primary/5 rounded-lg border border-primary/30 space-y-2">
                              <p className="text-[12px] font-semibold text-white">Méthode recommandée — Connexion en 1 clic</p>
                              <p className="text-[11px] text-[#b8c5d6]">Aucun mot de passe à copier. Google ouvre une fenêtre, vous validez, c'est connecté.</p>
                              <Button
                                type="button"
                                size="sm"
                                className="h-8 text-[12px] w-full"
                                onClick={() => handleOAuthConnect("gmail")}
                                data-testid="btn-connect-gmail-oauth"
                              >
                                Se connecter avec Google
                              </Button>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-px bg-border" />
                              <span className="text-[10px] uppercase tracking-wider text-[#6b7280]">ou</span>
                              <div className="flex-1 h-px bg-border" />
                            </div>
                          <div className="p-3 bg-background rounded-lg border border-primary/20 space-y-2">
                            <p className="text-[12px] font-semibold text-white">{t("settings.gmailWizardTitle")}</p>
                            <ol className="text-[11px] text-[#b8c5d6] space-y-1.5 list-decimal list-inside">
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
                            <p className="text-[11px] text-[#b8c5d6] italic">{t("settings.gmailWizardNote")}</p>
                          </div>
                          </>
                        )}

                        <div className="space-y-1">
                          <Label className="text-[12px] text-[#b8c5d6]">{t("settings.appPassword")}</Label>
                          <div className="relative">
                            <Input type={showPassword ? "text" : "password"} placeholder={t("settings.appPassword")} className="bg-background border-border text-white h-9 text-[13px] pr-10" value={imapPassword} onChange={(e) => setImapPassword(e.target.value)} />
                            <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-[#b8c5d6] hover:text-white" onClick={() => setShowPassword(!showPassword)}>
                              {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>

                        {selectedProvider !== "gmail" && (selectedProvider === "autre" || showAdvanced) && (
                          <div className="grid grid-cols-2 gap-2.5">
                            <div className="space-y-1">
                              <Label className="text-[12px] text-[#b8c5d6]">{t("settings.imapServer")}</Label>
                              <Input placeholder="imap.exemple.com" className="bg-background border-border text-white h-9 text-[13px]" value={imapHost} onChange={(e) => setImapHost(e.target.value)} />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[12px] text-[#b8c5d6]">{t("settings.port")}</Label>
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
                        <Button variant="ghost" size="sm" className="text-[#b8c5d6] hover:text-white hover:bg-white/[0.04]" onClick={() => { setSelectedProvider(null); setConnectError(""); setImapEmail(""); setImapPassword(""); setImapHost(""); setImapPort(""); }}>
                          {t("common.cancel")}
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </section>

          {!isOrgMember && <InboriaPrivacySection t={t} />}

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
                    <Label className="text-[12px] text-[#b8c5d6]">{t("settings.email")}</Label>
                    <Input value={profile?.email} disabled className="bg-background border-border text-[#b8c5d6] h-9 text-[13px]" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[12px] text-[#b8c5d6]">{t("settings.fullName")}</Label>
                    <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="bg-background border-border text-white h-9 text-[13px]" />
                  </div>
                  {!isOrgMember && (
                  <div className="space-y-1.5">
                    <Label className="text-[12px] text-[#b8c5d6] flex items-center gap-1.5">
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
                  )}
                  {!isOrgMember && (
                  <div className="space-y-1.5">
                    <Label className="text-[12px] text-[#b8c5d6] flex items-center gap-1.5">
                      <MailCheck className="w-3 h-3" />
                      {t("settings.followUpDelayLabel", "Délai avant suggestion de relance (jours)")}
                    </Label>
                    <Input
                      type="number"
                      min={1}
                      max={60}
                      value={followUpDelayDays}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        if (!isNaN(v)) setFollowUpDelayDays(v);
                      }}
                      onBlur={() => setFollowUpDelayDays((d) => Math.max(1, Math.min(60, Math.round(d || 5))))}
                      className="bg-background border-border text-white h-9 text-[13px] max-w-[120px]"
                    />
                    <p className="text-[11px] text-[#b8c5d6]">
                      {t(
                        "settings.followUpDelayHint",
                        "Inboria suggérera une relance pour vos mails envoyés sans réponse après ce nombre de jours (1 à 60).",
                      )}
                    </p>
                  </div>
                  )}
                  <Button onClick={handleSaveProfile} disabled={updateProfile.isPending || (fullName === (profile?.fullName ?? "") && timezone === ((profile as any)?.timezone ?? "Europe/Brussels") && followUpDelayDays === ((profile as any)?.followUpDelayDays ?? 5))} size="sm">
                    {updateProfile.isPending ? t("settings.saving") : t("common.save")}
                  </Button>

                  {!isOrgMember && (
                  <div className="pt-3 mt-3 border-t border-border/50 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Label className="text-[12px] text-white">{t("wave1.trackingSectionTitle")}</Label>
                        <p className="text-[11px] text-[#b8c5d6] mt-0.5">{t("wave1.trackingSectionDesc")}</p>
                      </div>
                      <Switch
                        checked={trackingEnabled}
                        onCheckedChange={handleToggleTracking}
                        disabled={updateProfile.isPending}
                      />
                    </div>
                    <p className="text-[10px] text-[#b8c5d6] italic">{t("wave1.trackingDisclaimer")}</p>
                  </div>
                  )}

                  <div className="pt-3 mt-3 border-t border-border/50 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Label className="text-[12px] text-white">
                          {t("settings.meetingRemindersTitle", "Relances automatiques de RDV")}
                        </Label>
                        <p className="text-[11px] text-[#b8c5d6] mt-0.5">
                          {t(
                            "settings.meetingRemindersDesc",
                            "Inboria envoie un rappel poli au contact 48 h après une proposition de rendez-vous restée sans réponse.",
                          )}
                        </p>
                      </div>
                      <Switch
                        checked={meetingRemindersEnabled}
                        onCheckedChange={handleToggleMeetingReminders}
                        disabled={updateProfile.isPending}
                        data-testid="settings-meeting-reminders-toggle"
                      />
                    </div>
                  </div>

                  <div className="pt-3 mt-3 border-t border-border/50 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <Label className="text-[12px] text-white">
                          {t("settings.preferredVideoTitle", "Visioconférence par défaut")}
                        </Label>
                        <p className="text-[11px] text-[#b8c5d6] mt-0.5">
                          {t(
                            "settings.preferredVideoDesc",
                            "Choisissez le fournisseur de visio par défaut pour les nouveaux RDV. Meet exige un calendrier Google connecté ; Teams exige Outlook. Jitsi fonctionne sans compte.",
                          )}
                        </p>
                      </div>
                      <select
                        value={preferredVideoProvider}
                        onChange={(e) => handleChangePreferredVideo(e.target.value as VideoProv)}
                        disabled={updateProfile.isPending}
                        className="h-8 rounded-md border border-border bg-background px-2 text-[12px] text-white shrink-0"
                        data-testid="settings-preferred-video-select"
                      >
                        <option value="none">{t("agenda.videoNone", "Aucune")}</option>
                        <option value="jitsi">{t("agenda.videoJitsi", "Jitsi (lien Inboria, sans compte)")}</option>
                        <option value="meet">{t("agenda.videoMeet", "Google Meet (calendrier Google requis)")}</option>
                        <option value="teams">{t("agenda.videoTeams", "Microsoft Teams (calendrier Outlook requis)")}</option>
                      </select>
                    </div>
                  </div>
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
                  <Label className="text-[12px] text-[#b8c5d6]">{t("settings.currentPassword")}</Label>
                  <div className="relative">
                    <Input
                      type={showCurrentPwd ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="bg-background border-border text-white h-9 text-[13px] pr-10"
                      placeholder={t("settings.currentPasswordPlaceholder")}
                    />
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-[#b8c5d6] hover:text-white" onClick={() => setShowCurrentPwd(!showCurrentPwd)}>
                      {showCurrentPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[12px] text-[#b8c5d6]">{t("settings.newPassword")}</Label>
                  <div className="relative">
                    <Input
                      type={showNewPwd ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="bg-background border-border text-white h-9 text-[13px] pr-10"
                      placeholder={t("settings.newPasswordPlaceholder")}
                    />
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-[#b8c5d6] hover:text-white" onClick={() => setShowNewPwd(!showNewPwd)}>
                      {showNewPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[12px] text-[#b8c5d6]">{t("settings.confirmNewPassword")}</Label>
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

          <TwoFactorSection />
        </div>
      </div>
    </DashboardLayout>
  );
}
