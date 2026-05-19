import { useEffect, useState, useCallback } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Calendar as CalendarIcon, CheckCircle2, AlertCircle, Trash2, Plus, Loader2 } from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useEnableLightTheme } from "@/lib/inbox-theme";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

interface CalendarAccount {
  id: string;
  provider: "google" | "outlook";
  email_address: string;
  status: "connected" | "reauth_required" | "error";
  last_error_message: string | null;
  last_error_at: string | null;
  created_at: string;
}

const API_BASE = (import.meta.env["VITE_API_URL"] as string | undefined) || "";

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function ParametresCalendriers() {
  useEnableLightTheme();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<CalendarAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [schemaMissing, setSchemaMissing] = useState(false);
  const [busyProvider, setBusyProvider] = useState<"google" | "outlook" | null>(null);

  const refresh = useCallback(async () => {
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_BASE}/api/calendar/accounts`, { headers, credentials: "include" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      setAccounts(data.accounts || []);
      setSchemaMissing(!!data.schemaMissing);
    } catch {
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    function onMsg(ev: MessageEvent) {
      // Sécurité : on n'accepte que les messages provenant de notre propre origine
      // (le popup OAuth est servi par le proxy Replit sous le même domaine que l'app).
      if (ev.origin !== window.location.origin) return;
      const d = ev.data;
      if (!d || typeof d !== "object" || d.type !== "calendar-connected") return;
      if (d.ok) {
        toast({
          title: t("calendars.connectedToastTitle", "Calendrier connecté"),
          description: t("calendars.connectedToastDesc", "La synchronisation est active."),
        });
      } else {
        toast({
          title: t("calendars.connectFailedTitle", "Connexion échouée"),
          description: t("calendars.connectFailedDesc", "Veuillez réessayer."),
          variant: "destructive",
        });
      }
      setBusyProvider(null);
      refresh();
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [toast, refresh, t]);

  async function connect(provider: "google" | "outlook") {
    setBusyProvider(provider);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_BASE}/api/calendar/connect/${provider}`, { headers, credentials: "include" });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "Erreur");
      const popup = window.open(data.url, "calendar-oauth", "width=520,height=680");
      if (!popup) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      toast({
        title: t("calendars.connectFailedTitle", "Connexion échouée"),
        description: err.message || t("calendars.connectFailedDesc", "Veuillez réessayer."),
        variant: "destructive",
      });
      setBusyProvider(null);
    }
  }

  async function disconnect(id: string) {
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_BASE}/api/calendar/accounts/${id}`, {
        method: "DELETE",
        headers,
        credentials: "include",
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      toast({
        title: t("calendars.disconnectedToast", "Calendrier déconnecté"),
      });
      refresh();
    } catch {
      toast({
        title: t("calendars.disconnectFailed", "Suppression impossible"),
        variant: "destructive",
      });
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-5">
        <div className="mb-2">
          <Link href="/dashboard/parametres/mon-compte">
            <Button variant="ghost" size="sm" className="h-7 px-2 text-[#b8c5d6] hover:text-white" data-testid="back-to-account">
              <ArrowLeft className="w-3.5 h-3.5 mr-1" /> {t("common.back", "Retour")}
            </Button>
          </Link>
        </div>
        <div className="mb-6">
          <h1 className="text-[16px] font-semibold text-white tracking-tight">
            {t("calendars.title", "Calendriers connectés")}
          </h1>
          <p className="text-[12px] text-[#b8c5d6] mt-0.5">
            {t(
              "calendars.subtitle",
              "Reliez Google Calendar ou Outlook Calendar pour que NCV Mail voie vos disponibilités et y inscrive vos rendez-vous.",
            )}
          </p>
        </div>

        {schemaMissing && (
          <div className="mb-4 p-3.5 border border-amber-500/30 bg-amber-500/5 rounded-lg text-[12px] text-amber-200">
            {t(
              "calendars.schemaMissing",
              "La table calendar_accounts n'est pas encore créée dans la base. Exécutez la migration 2026_05_09_calendar_accounts.sql dans Supabase.",
            )}
          </div>
        )}

        <div className="space-y-3 mb-6">
          {loading ? (
            <div className="text-[12px] text-[#b8c5d6]">{t("common.loading", "Chargement...")}</div>
          ) : accounts.length === 0 ? (
            <div className="p-5 border border-border rounded-lg bg-card text-[12px] text-[#b8c5d6] text-center">
              {t("calendars.empty", "Aucun calendrier connecté pour le moment.")}
            </div>
          ) : (
            accounts.map((acc) => (
              <div
                key={acc.id}
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 border border-border rounded-lg bg-card"
                data-testid={`calendar-account-${acc.id}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 ${
                      acc.provider === "google" ? "bg-red-500/10 text-red-400" : "bg-blue-500/10 text-blue-400"
                    }`}
                  >
                    {acc.provider === "google" ? "G" : "O"}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium text-white truncate">{acc.email_address}</div>
                    {acc.status === "connected" ? (
                      <div className="text-[11px] text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        {t("calendars.statusConnected", "Connecté")}
                      </div>
                    ) : (
                      <div className="text-[11px] text-amber-400 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {t("calendars.statusReauth", "À reconnecter")}
                      </div>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => disconnect(acc.id)}
                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 text-[12px]"
                  data-testid={`disconnect-calendar-${acc.id}`}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                  {t("calendars.disconnect", "Déconnecter")}
                </Button>
              </div>
            ))
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => connect("google")}
            disabled={busyProvider === "google"}
            className="group flex items-center gap-3 p-3.5 border border-border rounded-lg bg-card hover:border-primary/40 transition-colors text-left disabled:opacity-50"
            data-testid="connect-google-calendar"
          >
            <div className="w-9 h-9 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center font-bold">G</div>
            <div className="flex-1">
              <div className="text-[13px] font-medium text-white">{t("calendars.connectGoogle", "Connecter Google Calendar")}</div>
              <div className="text-[11px] text-[#b8c5d6] mt-0.5">{t("calendars.connectGoogleDesc", "Lecture des événements et écriture des nouveaux RDV.")}</div>
            </div>
            {busyProvider === "google" ? <Loader2 className="w-4 h-4 animate-spin text-[#b8c5d6]" /> : <Plus className="w-4 h-4 text-[#b8c5d6] group-hover:text-white" />}
          </button>

          <button
            type="button"
            onClick={() => connect("outlook")}
            disabled={busyProvider === "outlook"}
            className="group flex items-center gap-3 p-3.5 border border-border rounded-lg bg-card hover:border-primary/40 transition-colors text-left disabled:opacity-50"
            data-testid="connect-outlook-calendar"
          >
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold">O</div>
            <div className="flex-1">
              <div className="text-[13px] font-medium text-white">{t("calendars.connectOutlook", "Connecter Outlook Calendar")}</div>
              <div className="text-[11px] text-[#b8c5d6] mt-0.5">{t("calendars.connectOutlookDesc", "Lecture des événements et écriture des nouveaux RDV.")}</div>
            </div>
            {busyProvider === "outlook" ? <Loader2 className="w-4 h-4 animate-spin text-[#b8c5d6]" /> : <Plus className="w-4 h-4 text-[#b8c5d6] group-hover:text-white" />}
          </button>
        </div>

        <p className="text-[11px] text-[#6b7280] mt-4 flex items-start gap-1.5">
          <CalendarIcon className="w-3 h-3 mt-0.5 shrink-0" />
          {t("calendars.help", "Inboria utilise vos calendriers pour vérifier vos disponibilités et y créer les rendez-vous fixés depuis NCV Mail.")}
        </p>
      </div>
    </DashboardLayout>
  );
}
