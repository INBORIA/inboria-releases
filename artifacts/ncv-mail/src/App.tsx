import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { useEffect } from "react";
import { QueryClient, MutationCache, QueryClientProvider } from "@tanstack/react-query";
import { getGetProfileQueryKey, useGetMyOrganisation } from "@workspace/api-client-react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import NotFound from "@/pages/not-found";
import { CookieBanner } from "@/components/cookie-banner";

import Login from "@/pages/login";
import Signup from "@/pages/signup";
import VerifierEmail from "@/pages/verifier-email";
import AuthCallback from "@/pages/auth-callback";
import MotDePasseOublie from "@/pages/mot-de-passe-oublie";
import ResetPassword from "@/pages/reset-password";
import AcceptInvite from "@/pages/accept-invite";
import Dashboard from "@/pages/dashboard/index";
import Archives from "@/pages/dashboard/archives";
import Indesirables from "@/pages/dashboard/indesirables";
import Corbeille from "@/pages/dashboard/corbeille";
import Envoyes from "@/pages/dashboard/envoyes";
import Suivi from "@/pages/dashboard/suivi";
import Programmes from "@/pages/dashboard/programmes";
import Reportes from "@/pages/dashboard/reportes";
import BilanQuotidien from "@/pages/dashboard/bilan";
import Taches from "@/pages/dashboard/taches";
import Relances from "@/pages/dashboard/relances";
import Classement from "@/pages/dashboard/classement";
import Parametres from "@/pages/dashboard/parametres";
import Templates from "@/pages/dashboard/templates";
import Regles from "@/pages/dashboard/regles";
import ParametresSla from "@/pages/dashboard/parametres-sla";
import ParametresApi from "@/pages/dashboard/parametres-api";
import ParametresWebhooks from "@/pages/dashboard/parametres-webhooks";
import ParametresIntegrations from "@/pages/dashboard/parametres-integrations";
import ParametresMonCompte from "@/pages/dashboard/parametres-mon-compte";
import ParametresViePrivee from "@/pages/dashboard/parametres-vie-privee";
import ParametresCrm from "@/pages/dashboard/parametres-crm";
import ParametresDeveloppeurs from "@/pages/dashboard/parametres-developpeurs";
import Abonnement from "@/pages/dashboard/abonnement";
import Projets from "@/pages/dashboard/projets";
import Contacts from "@/pages/dashboard/contacts";
import Equipe from "@/pages/dashboard/equipe";
import AdminIndex from "@/pages/dashboard/admin";
import AdminWaitlist from "@/pages/dashboard/admin/waitlist";
import AdminAbonnes from "@/pages/dashboard/admin/abonnes";
import TeamActivite from "@/pages/dashboard/team-activite";
import Agenda from "@/pages/dashboard/agenda";

import Accueil from "@/pages/marketing/accueil";
import Fonctionnalites from "@/pages/marketing/fonctionnalites";
import Entreprise from "@/pages/marketing/entreprise";
import ClassementMarketing from "@/pages/marketing/classement";
import IntelligenceArtificielle from "@/pages/marketing/intelligence-artificielle";
import CRM from "@/pages/marketing/crm";
import Tarifs from "@/pages/marketing/tarifs";
import MentionsLegales from "@/pages/marketing/mentions-legales";
import Confidentialite from "@/pages/marketing/confidentialite";
import Conditions from "@/pages/marketing/conditions";

let _clearingSession = false;
let _consecutiveAuthFailures = 0;

setAuthTokenGetter(async () => {
  if (_clearingSession) return null;
  if (_consecutiveAuthFailures >= 3) {
    _clearingSession = true;
    _consecutiveAuthFailures = 0;
    await supabase.auth.signOut();
    _clearingSession = false;
    window.location.href = import.meta.env.BASE_URL + "login";
    return null;
  }
  const { data } = await supabase.auth.getSession();
  if (data.session?.access_token) {
    const expiresAt = data.session.expires_at ?? 0;
    const nowSec = Math.floor(Date.now() / 1000);
    if (expiresAt > nowSec + 60) {
      return data.session.access_token;
    }
    const { data: refreshed, error } = await supabase.auth.refreshSession();
    if (error || !refreshed.session) {
      _clearingSession = true;
      await supabase.auth.signOut();
      _clearingSession = false;
      return null;
    }
    return refreshed.session?.access_token ?? null;
  }
  return null;
});

const AI_MUTATION_KEYS = new Set([
  "generatePack",
  "generateDailySummary",
  "recategorizeUncategorized",
  "generateDraft",
  "getConversationSummary",
  "detectAppointments",
]);

const mutationCache = new MutationCache({
  onSuccess: (_data, _variables, _context, mutation) => {
    const key = mutation.options.mutationKey?.[0];
    if (typeof key === "string" && AI_MUTATION_KEYS.has(key)) {
      queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
    }
  },
});

const ONE_MINUTE = 1000 * 60;
const ONE_HOUR = ONE_MINUTE * 60;
const ONE_DAY = ONE_HOUR * 24;

const PERSIST_CACHE_KEY = "inboria-cache-v1";
const CACHE_BUSTER = "v1";

const queryClient = new QueryClient({
  mutationCache,
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        if (error?.status === 401) {
          _consecutiveAuthFailures++;
          if (_consecutiveAuthFailures >= 3 && !_clearingSession) {
            _clearingSession = true;
            _consecutiveAuthFailures = 0;
            supabase.auth.signOut().then(() => {
              _clearingSession = false;
              window.location.href = import.meta.env.BASE_URL + "login";
            });
          }
          return false;
        }
        return failureCount < 1;
      },
      refetchOnWindowFocus: false,
      // Stale-while-revalidate: serve cache instantly, refresh in background.
      staleTime: 30 * 1000,
      // gcTime must be >= persister maxAge so persisted entries are not garbage
      // collected before they get a chance to be re-hydrated.
      gcTime: ONE_DAY,
    },
  },
});

// PersistQueryClientProvider temporarily disabled: hydration suspected of
// breaking the app on page reload (ref: dev preview blank-after-reload bug).
// Re-enable once root cause is confirmed and a safer hydration path exists.

/**
 * Clears React Query cache (memory + persisted) when the user signs out so
 * the next user session never sees stale data from another account.
 */
function CacheCleanup() {
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        queryClient.clear();
        try {
          window.localStorage.removeItem(PERSIST_CACHE_KEY);
        } catch {
          // Storage may be unavailable in private mode — non fatal.
        }
      }
    });
    return () => subscription.unsubscribe();
  }, []);
  return null;
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { session, loading } = useAuth();

  if (loading) return null;
  if (!session) return <Redirect to="/login" />;
  return <Component />;
}

function AdminOnlyRoute({ component: Component }: { component: React.ComponentType }) {
  const { session, loading } = useAuth();
  const { data: org, isLoading: orgLoading } = useGetMyOrganisation();
  const { toast } = useToast();
  const { t } = useTranslation();
  const isOrgMember = !!org?.id && org.myRole !== "admin";
  const shouldRedirect = !loading && !orgLoading && !!session && isOrgMember;

  useEffect(() => {
    if (shouldRedirect) {
      toast({
        title: t("settings.adminOnlyToast", "Cette page est réservée à l'admin de l'équipe."),
      });
    }
  }, [shouldRedirect, toast, t]);

  if (loading || (session && orgLoading)) return null;
  if (!session) return <Redirect to="/login" />;
  if (isOrgMember) return <Redirect to="/dashboard/parametres/mon-compte" />;
  return <Component />;
}

function Router() {
  const { session, loading } = useAuth();

  if (loading) return null;

  return (
    <Switch>
      <Route path="/" component={() => session ? <Redirect to="/dashboard" /> : <Accueil />} />
      <Route path="/fonctionnalites" component={Fonctionnalites} />
      <Route path="/entreprise" component={Entreprise} />
      <Route path="/classement" component={ClassementMarketing} />
      <Route path="/intelligence-artificielle" component={IntelligenceArtificielle} />
      <Route path="/inboria" component={IntelligenceArtificielle} />
      <Route path="/crm" component={CRM} />
      <Route path="/tarifs" component={Tarifs} />
      <Route path="/mentions-legales" component={MentionsLegales} />
      <Route path="/confidentialite" component={Confidentialite} />
      <Route path="/conditions" component={Conditions} />
      <Route path="/login" component={() => session ? <Redirect to="/dashboard" /> : <Login />} />
      <Route path="/signup" component={() => session ? <Redirect to="/dashboard" /> : <Signup />} />
      <Route path="/verifier-email" component={VerifierEmail} />
      <Route path="/auth/callback" component={AuthCallback} />
      <Route path="/mot-de-passe-oublie" component={() => session ? <Redirect to="/dashboard" /> : <MotDePasseOublie />} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/accept-invite" component={AcceptInvite} />
      <Route path="/dashboard" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/dashboard/envoyes" component={() => <ProtectedRoute component={Envoyes} />} />
      <Route path="/dashboard/suivi" component={() => <ProtectedRoute component={Suivi} />} />
      <Route path="/dashboard/programmes" component={() => <ProtectedRoute component={Programmes} />} />
      <Route path="/dashboard/reportes" component={() => <ProtectedRoute component={Reportes} />} />
      <Route path="/dashboard/archives" component={() => <ProtectedRoute component={Archives} />} />
      <Route path="/dashboard/indesirables" component={() => <ProtectedRoute component={Indesirables} />} />
      <Route path="/dashboard/corbeille" component={() => <ProtectedRoute component={Corbeille} />} />
      <Route path="/dashboard/bilan" component={() => <ProtectedRoute component={BilanQuotidien} />} />
      <Route path="/dashboard/taches" component={() => <ProtectedRoute component={Taches} />} />
      <Route path="/dashboard/relances" component={() => <ProtectedRoute component={Relances} />} />
      <Route path="/dashboard/classement" component={() => <ProtectedRoute component={Classement} />} />
      <Route path="/dashboard/categories" component={() => <Redirect to="/dashboard/classement" />} />
      <Route path="/dashboard/projets" component={() => <ProtectedRoute component={Projets} />} />
      <Route path="/dashboard/contacts" component={() => <ProtectedRoute component={Contacts} />} />
      <Route path="/dashboard/contacts/:email" component={() => <ProtectedRoute component={Contacts} />} />
      <Route path="/dashboard/parametres" component={() => <AdminOnlyRoute component={Parametres} />} />
      <Route path="/dashboard/parametres/mon-compte" component={() => <ProtectedRoute component={ParametresMonCompte} />} />
      <Route path="/dashboard/parametres/vie-privee" component={() => <AdminOnlyRoute component={ParametresViePrivee} />} />
      <Route path="/dashboard/parametres/crm" component={() => <AdminOnlyRoute component={ParametresCrm} />} />
      <Route path="/dashboard/parametres/developpeurs" component={() => <AdminOnlyRoute component={ParametresDeveloppeurs} />} />
      <Route path="/dashboard/parametres/templates" component={() => <AdminOnlyRoute component={Templates} />} />
      <Route path="/dashboard/parametres/regles" component={() => <AdminOnlyRoute component={Regles} />} />
      <Route path="/dashboard/parametres/sla" component={() => <AdminOnlyRoute component={ParametresSla} />} />
      <Route path="/dashboard/parametres/api" component={() => <AdminOnlyRoute component={ParametresApi} />} />
      <Route path="/dashboard/parametres/webhooks" component={() => <AdminOnlyRoute component={ParametresWebhooks} />} />
      <Route path="/dashboard/parametres/integrations" component={() => <AdminOnlyRoute component={ParametresIntegrations} />} />
      <Route path="/dashboard/abonnement" component={() => <AdminOnlyRoute component={Abonnement} />} />
      <Route path="/dashboard/equipe" component={() => <ProtectedRoute component={Equipe} />} />
      <Route path="/dashboard/activite-equipe" component={() => <ProtectedRoute component={TeamActivite} />} />
      <Route path="/dashboard/agenda" component={() => <ProtectedRoute component={Agenda} />} />
      <Route path="/dashboard/admin" component={() => <ProtectedRoute component={AdminIndex} />} />
      <Route path="/dashboard/admin/waitlist" component={() => <ProtectedRoute component={AdminWaitlist} />} />
      <Route path="/dashboard/admin/abonnes" component={() => <ProtectedRoute component={AdminAbonnes} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <CacheCleanup />
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
            <CookieBanner />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
