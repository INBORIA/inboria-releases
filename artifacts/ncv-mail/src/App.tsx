import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { useEffect, useLayoutEffect, lazy, Suspense } from "react";
import { getStoredNcvTheme } from "@/lib/inbox-theme";
import { QueryClient, MutationCache, QueryClientProvider } from "@tanstack/react-query";
import { getGetProfileQueryKey, useGetMyOrganisation, getGetMyOrganisationQueryKey } from "@workspace/api-client-react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";
import NotFound from "@/pages/not-found";
import { CookieBanner } from "@/components/cookie-banner";

// Eager (auth flow critique + landings rentables au premier paint)
import Login from "@/pages/login";
import Signup from "@/pages/signup";
import VerifierEmail from "@/pages/verifier-email";
import AuthCallback from "@/pages/auth-callback";
import MotDePasseOublie from "@/pages/mot-de-passe-oublie";
import ResetPassword from "@/pages/reset-password";
import AcceptInvite from "@/pages/accept-invite";
import Dashboard from "@/pages/dashboard/index";
import Accueil from "@/pages/marketing/accueil";

// Lazy (code-split par page — chargement à la navigation pour réduire le
// bundle initial de ~200-400 ko gzip selon la page visitée)
const Archives = lazy(() => import("@/pages/dashboard/archives"));
const MesDossiers = lazy(() => import("@/pages/dashboard/dossiers"));
const NotificationsPage = lazy(() => import("@/pages/dashboard/notifications"));
const Indesirables = lazy(() => import("@/pages/dashboard/indesirables"));
const Corbeille = lazy(() => import("@/pages/dashboard/corbeille"));
const Envoyes = lazy(() => import("@/pages/dashboard/envoyes"));
const Reportes = lazy(() => import("@/pages/dashboard/reportes"));
const Suivi = lazy(() => import("@/pages/dashboard/suivi"));
const Programmes = lazy(() => import("@/pages/dashboard/programmes"));
const BilanQuotidien = lazy(() => import("@/pages/dashboard/bilan"));
const Taches = lazy(() => import("@/pages/dashboard/taches"));
const Relances = lazy(() => import("@/pages/dashboard/relances"));
const Classement = lazy(() => import("@/pages/dashboard/classement"));
const Parametres = lazy(() => import("@/pages/dashboard/parametres"));
const Templates = lazy(() => import("@/pages/dashboard/templates"));
const Regles = lazy(() => import("@/pages/dashboard/regles"));
const ParametresSla = lazy(() => import("@/pages/dashboard/parametres-sla"));
const ParametresApi = lazy(() => import("@/pages/dashboard/parametres-api"));
const ParametresWebhooks = lazy(() => import("@/pages/dashboard/parametres-webhooks"));
const ParametresIntegrations = lazy(() => import("@/pages/dashboard/parametres-integrations"));
const ParametresMonCompte = lazy(() => import("@/pages/dashboard/parametres-mon-compte"));
const ParametresCalendriers = lazy(() => import("@/pages/dashboard/parametres-calendriers"));
const ParametresViePrivee = lazy(() => import("@/pages/dashboard/parametres-vie-privee"));
const ParametresCrm = lazy(() => import("@/pages/dashboard/parametres-crm"));
const ParametresDeveloppeurs = lazy(() => import("@/pages/dashboard/parametres-developpeurs"));
const ParametresAdministration = lazy(() => import("@/pages/dashboard/parametres-administration"));
const Abonnement = lazy(() => import("@/pages/dashboard/abonnement"));
const Projets = lazy(() => import("@/pages/dashboard/projets"));
const Contacts = lazy(() => import("@/pages/dashboard/contacts"));
const Equipe = lazy(() => import("@/pages/dashboard/equipe"));
const AdminIndex = lazy(() => import("@/pages/dashboard/admin"));
const AdminWaitlist = lazy(() => import("@/pages/dashboard/admin/waitlist"));
const AdminAbonnes = lazy(() => import("@/pages/dashboard/admin/abonnes"));
const TeamActivite = lazy(() => import("@/pages/dashboard/team-activite"));
const Agenda = lazy(() => import("@/pages/dashboard/agenda"));

const Fonctionnalites = lazy(() => import("@/pages/marketing/fonctionnalites"));
const Extensions = lazy(() => import("@/pages/marketing/extensions"));
const Entreprise = lazy(() => import("@/pages/marketing/entreprise"));
const ClassementMarketing = lazy(() => import("@/pages/marketing/classement"));
const IntelligenceArtificielle = lazy(() => import("@/pages/marketing/intelligence-artificielle"));
const CRM = lazy(() => import("@/pages/marketing/crm"));
const Tarifs = lazy(() => import("@/pages/marketing/tarifs"));
const MentionsLegales = lazy(() => import("@/pages/marketing/mentions-legales"));
const Confidentialite = lazy(() => import("@/pages/marketing/confidentialite"));
const Conditions = lazy(() => import("@/pages/marketing/conditions"));

// Fallback Suspense — simple spinner centré, jamais une page blanche. Court
// (50-150ms) donc pas la peine d'un skeleton complet.
function RouteLoadingFallback() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}

// Préchauffage des chunks de pages en tâche de fond. Les pages du dashboard
// sont chargées à la demande (lazy) pour démarrer vite ; conséquence : la
// 1ère ouverture d'une page affiche un spinner le temps de télécharger son
// code. Ici, une fois l'app authentifiée et le navigateur INACTIF, on
// précharge ces chunks un par un, espacés, sans gêner les requêtes de la
// page courante. Résultat : quand l'utilisateur clique enfin sur une
// rubrique, le code est déjà là → plus de spinner « 1ère fois ».
const warmableRouteChunks: Array<() => Promise<unknown>> = [
  () => import("@/pages/dashboard/envoyes"),
  () => import("@/pages/dashboard/agenda"),
  () => import("@/pages/dashboard/contacts"),
  () => import("@/pages/dashboard/programmes"),
  () => import("@/pages/dashboard/dossiers"),
  () => import("@/pages/dashboard/bilan"),
  () => import("@/pages/dashboard/classement"),
  () => import("@/pages/dashboard/reportes"),
  () => import("@/pages/dashboard/archives"),
  () => import("@/pages/dashboard/taches"),
  () => import("@/pages/dashboard/relances"),
  () => import("@/pages/dashboard/templates"),
  () => import("@/pages/dashboard/regles"),
  () => import("@/pages/dashboard/parametres"),
];

function RouteWarmer() {
  useEffect(() => {
    let cancelled = false;
    let handle = 0;
    const hasRic = typeof (window as any).requestIdleCallback === "function";
    const ric = (cb: () => void): number =>
      hasRic
        ? (window as any).requestIdleCallback(cb, { timeout: 3000 })
        : window.setTimeout(cb, 1200);
    let i = 0;
    const pump = () => {
      if (cancelled || i >= warmableRouteChunks.length) return;
      const load = warmableRouteChunks[i++];
      load()
        .catch(() => { /* silencieux : le clic chargera le chunk au besoin */ })
        .finally(() => {
          if (!cancelled) handle = ric(pump);
        });
    };
    handle = ric(pump);
    return () => {
      cancelled = true;
      if (hasRic && typeof (window as any).cancelIdleCallback === "function") {
        (window as any).cancelIdleCallback(handle);
      } else {
        window.clearTimeout(handle);
      }
    };
  }, []);
  return null;
}

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

// Quand un onglet sans session active ouvre une route protégée porteuse
// d'intention (ex. lien « Ouvrir dans Inboria » de l'add-on Gmail vers
// /dashboard?emailId=123), le garde redirige vers /login et la query string
// serait perdue. On mémorise donc la destination complète (path + query) puis
// on y revient une fois l'utilisateur authentifié.
const RETURN_TO_KEY = "inboria.returnTo";

function captureReturnTo() {
  try {
    if (typeof window === "undefined") return;
    const path = window.location.pathname + window.location.search;
    // On ne mémorise que les destinations dashboard porteuses de paramètres
    // (sinon /login renverrait toujours vers /dashboard, ce qui est déjà le défaut).
    if (path.startsWith("/dashboard") && window.location.search) {
      window.sessionStorage.setItem(RETURN_TO_KEY, path);
    }
  } catch {
    // sessionStorage indisponible (mode privé) — non fatal.
  }
}

function consumeReturnTo(): string | null {
  try {
    if (typeof window === "undefined") return null;
    const v = window.sessionStorage.getItem(RETURN_TO_KEY);
    if (v) window.sessionStorage.removeItem(RETURN_TO_KEY);
    return v && v.startsWith("/dashboard") ? v : null;
  } catch {
    return null;
  }
}

// Destination par défaut une fois authentifié : la route mémorisée (returnTo)
// si elle existe, sinon le dashboard.
function AuthedHome() {
  const target = consumeReturnTo() ?? "/dashboard";
  return <Redirect to={target} />;
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { session, loading, mfaState } = useAuth();

  if (loading || mfaState === "unknown") return null;
  if (!session) {
    captureReturnTo();
    return <Redirect to="/login" />;
  }
  if (mfaState === "needsMfa") {
    captureReturnTo();
    return <Redirect to="/login" />;
  }
  return <Component />;
}

function AdminOnlyRoute({ component: Component }: { component: React.ComponentType }) {
  const { session, loading, mfaState } = useAuth();
  const needsMfa = mfaState === "needsMfa";
  const mfaUnknown = mfaState === "unknown";
  const fullyAuthed = !!session && mfaState === "ok";
  // Defer the privileged org query until the user has cleared MFA so we
  // never issue authorization-bearing requests on an AAL1 session.
  const { data: org, isLoading: orgLoading } = useGetMyOrganisation({
    query: { queryKey: getGetMyOrganisationQueryKey(), enabled: fullyAuthed },
  });
  const { toast } = useToast();
  const { t } = useTranslation();
  const isOrgMember = !!org?.id && org.myRole !== "admin";
  const shouldRedirect = !loading && !mfaUnknown && !needsMfa && !orgLoading && fullyAuthed && isOrgMember;

  useEffect(() => {
    if (shouldRedirect) {
      toast({
        title: t("settings.adminOnlyToast", "Cette page est réservée à l'admin de l'équipe."),
      });
    }
  }, [shouldRedirect, toast, t]);

  if (loading || mfaUnknown || (fullyAuthed && orgLoading)) return null;
  if (!session) return <Redirect to="/login" />;
  if (needsMfa) return <Redirect to="/login" />;
  if (isOrgMember) return <Redirect to="/dashboard/parametres/mon-compte" />;
  return <Component />;
}

function Router() {
  const { session, loading, mfaState } = useAuth();
  const [location] = useLocation();

  // Contrôleur de thème centralisé (autorité unique). Le thème clair n'existe
  // QUE dans l'app (/dashboard*) : c'est le choix de l'abonné connecté. Le
  // site vitrine, la connexion et l'inscription restent TOUJOURS en sombre.
  // En useLayoutEffect → appliqué avant peinture, donc aucun flash de clair
  // en quittant l'app vers une page publique.
  useLayoutEffect(() => {
    if (typeof document === "undefined") return;
    const el = document.documentElement;
    if (location.startsWith("/dashboard")) {
      el.setAttribute("data-ncv-page", "inbox");
      el.setAttribute("data-ncv-theme", getStoredNcvTheme());
    } else {
      el.removeAttribute("data-ncv-page");
      el.setAttribute("data-ncv-theme", "dark");
    }
  }, [location]);

  if (loading || mfaState === "unknown") return null;

  const fullyAuthed = !!session && mfaState === "ok";

  return (
    <>
    {fullyAuthed && <RouteWarmer />}
    <Suspense fallback={<RouteLoadingFallback />}>
    <Switch>
      <Route path="/" component={() => fullyAuthed ? <AuthedHome /> : <Accueil />} />
      <Route path="/fonctionnalites" component={Fonctionnalites} />
      <Route path="/extensions" component={Extensions} />
      <Route path="/entreprise" component={Entreprise} />
      <Route path="/classement" component={ClassementMarketing} />
      <Route path="/intelligence-artificielle" component={IntelligenceArtificielle} />
      <Route path="/inboria" component={IntelligenceArtificielle} />
      <Route path="/crm" component={CRM} />
      <Route path="/tarifs" component={Tarifs} />
      <Route path="/mentions-legales" component={MentionsLegales} />
      <Route path="/confidentialite" component={Confidentialite} />
      <Route path="/conditions" component={Conditions} />
      <Route path="/login" component={() => fullyAuthed ? <AuthedHome /> : <Login />} />
      <Route path="/signup" component={() => session ? <Redirect to="/dashboard" /> : <Signup />} />
      <Route path="/verifier-email" component={VerifierEmail} />
      <Route path="/auth/callback" component={AuthCallback} />
      <Route path="/mot-de-passe-oublie" component={() => session ? <Redirect to="/dashboard" /> : <MotDePasseOublie />} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/accept-invite" component={AcceptInvite} />
      <Route path="/dashboard" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/dashboard/inbox-classic" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/dashboard/envoyes" component={() => <ProtectedRoute component={Envoyes} />} />
      <Route path="/dashboard/suivi" component={() => <ProtectedRoute component={Suivi} />} />
      <Route path="/dashboard/programmes" component={() => <ProtectedRoute component={Programmes} />} />
      {/* /dashboard/reportes — page autonome refactorisée façon Envoyés
          (52px Superhuman + HoverActions + clic droit + sélection multiple
          + colonne « Réveille le » + bouton « Réveiller maintenant » au
          survol). Remplace l'ancienne version qui montait Dashboard
          (task #293) pour afficher SnoozedPanel inline. */}
      <Route path="/dashboard/reportes" component={() => <ProtectedRoute component={Reportes} />} />
      <Route path="/dashboard/archives" component={() => <ProtectedRoute component={Archives} />} />
      <Route path="/dashboard/dossiers" component={() => <ProtectedRoute component={MesDossiers} />} />
      <Route path="/dashboard/notifications" component={() => <ProtectedRoute component={NotificationsPage} />} />
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
      <Route path="/dashboard/parametres" component={() => <ProtectedRoute component={Parametres} />} />
      <Route path="/dashboard/parametres/mon-compte" component={() => <ProtectedRoute component={ParametresMonCompte} />} />
      <Route path="/dashboard/parametres/calendriers" component={() => <ProtectedRoute component={ParametresCalendriers} />} />
      <Route path="/dashboard/parametres/vie-privee" component={() => <ProtectedRoute component={ParametresViePrivee} />} />
      <Route path="/dashboard/parametres/crm" component={() => <ProtectedRoute component={ParametresCrm} />} />
      <Route path="/dashboard/parametres/developpeurs" component={() => <AdminOnlyRoute component={ParametresDeveloppeurs} />} />
      <Route path="/dashboard/parametres/administration" component={() => <AdminOnlyRoute component={ParametresAdministration} />} />
      <Route path="/dashboard/parametres/templates" component={() => <ProtectedRoute component={Templates} />} />
      <Route path="/dashboard/parametres/regles" component={() => <ProtectedRoute component={Regles} />} />
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
    </Suspense>
    </>
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
