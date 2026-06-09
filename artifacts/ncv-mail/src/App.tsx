import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { useEffect, useLayoutEffect, lazy, Suspense } from "react";
import { getStoredNcvTheme } from "@/lib/inbox-theme";
import { QueryClient, MutationCache, QueryClientProvider } from "@tanstack/react-query";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { get as idbGet, set as idbSet, del as idbDel, createStore as createIdbStore } from "idb-keyval";
import {
  persistQueryClientRestore,
  persistQueryClientSubscribe,
  persistQueryClientSave,
} from "@tanstack/react-query-persist-client";
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
import Accueil from "@/pages/marketing/accueil";

// Lazy (code-split par page — chargement à la navigation pour réduire le
// bundle initial de ~200-400 ko gzip selon la page visitée)
const Dashboard = lazy(() => import("@/pages/dashboard/index"));
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
const Telecharger = lazy(() => import("@/pages/marketing/telecharger"));
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

// Ancienne clé localStorage (≤ v2). On la purge une fois au démarrage pour ne pas
// laisser traîner un blob de plusieurs Mo désormais inutile (on est passé à IndexedDB).
const LEGACY_LOCALSTORAGE_KEY = "inboria-cache-v1";
// Clé de l'entrée stockée dans la base locale IndexedDB.
const PERSIST_CACHE_KEY = "inboria-cache";
// v3 (et non v2) : on a (a) changé de moteur de stockage (localStorage → IndexedDB)
// et (b) élargi le périmètre persisté (la liste `/api/emails` ET le détail d'un mail
// `email-detail`). Bumper le buster invalide d'office tout cache écrit par l'ancienne
// logique → 1 seul MISS au prochain chargement, puis HIT instantané.
const CACHE_BUSTER = "v3";

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

// ---------------------------------------------------------------------------
// Cache persistant des listes d'emails (anti-clignotement à la connexion).
//
// Problème résolu : à chaque connexion / rechargement, la mémoire de l'app est
// vide → la liste des mails affichait un squelette gris pendant 1-2 s le temps
// de l'aller-retour réseau. On enregistre donc le résultat des listes de mails
// dans le navigateur (localStorage) pour le ré-afficher INSTANTANÉMENT au
// rechargement suivant, pendant qu'une mise à jour silencieuse tourne en
// arrière-plan (stale-while-revalidate).
//
// Sécurité (ancien bug d'écran blanc au rechargement) : on ne persiste QUE les
// requêtes de liste de mails réussies (clé `/api/emails`). Le profil, l'orga et
// l'auth ne sont JAMAIS persistés → aucun risque de réhydrater une donnée au
// mauvais format dans un composant critique. `buster` (CACHE_BUSTER) purge tout
// le cache stocké quand on le change (ex. après un changement de format).
// Base locale IndexedDB dédiée (asynchrone, capacité quasi illimitée — vs
// localStorage qui était synchrone et plafonné à ~5 Mo). On y range tout le
// cache des mails pour une LECTURE LOCALE instantanée au rechargement.
const idbStore =
  typeof window !== "undefined" && typeof indexedDB !== "undefined"
    ? createIdbStore("inboria-cache", "tanstack-query")
    : null;

// Adaptateur "AsyncStorage" attendu par createAsyncStoragePersister, branché sur
// IndexedDB via idb-keyval (get/set/del). Les écritures se font hors du thread
// principal → plus de à-coups quand on enregistre une grosse boîte (localStorage
// bloquait l'interface le temps de sérialiser plusieurs Mo).
const idbStorage = idbStore
  ? {
      getItem: (key: string) =>
        idbGet<string>(key, idbStore).then((v) => v ?? null),
      setItem: (key: string, value: string) => idbSet(key, value, idbStore),
      removeItem: (key: string) => idbDel(key, idbStore),
    }
  : null;

// Purge unique de l'ancien blob localStorage (≤ v2) : on est passé à IndexedDB,
// inutile de garder plusieurs Mo orphelins côté localStorage.
if (typeof window !== "undefined") {
  try { window.localStorage.removeItem(LEGACY_LOCALSTORAGE_KEY); } catch { /* noop */ }
}

const emailsPersister = idbStorage
  ? createAsyncStoragePersister({
      storage: idbStorage,
      key: PERSIST_CACHE_KEY,
      throttleTime: 1000,
    })
  : null;

// Efface l'entrée de cache dans la base locale IndexedDB (changement de compte,
// déconnexion). Renvoie une promesse pour pouvoir SÉRIALISER les opérations IDB :
// IndexedDB étant asynchrone (contrairement à localStorage), l'appelant doit
// attendre la fin de la suppression avant d'écrire à nouveau la même clé (sinon
// course = le del finit après le save et efface le cache du nouveau compte) et
// avant de quitter sur une déconnexion (sinon les mails resteraient sur disque).
function purgePersistedCacheStorage(): Promise<void> {
  if (!idbStore) return Promise.resolve();
  return idbDel(PERSIST_CACHE_KEY, idbStore).catch(() => { /* noop */ });
}

// Périmètre persisté = LECTURE LOCALE de la boîte ET de l'ouverture d'un mail :
//  - `/api/emails`  → les listes de mails (Réception, etc.).
//  - `email-detail` → le contenu d'un mail ouvert (clé utilisée par le dashboard)
//    → rouvrir un mail après rechargement est instantané, sans aller-retour réseau.
// On ne persiste QUE les requêtes réussies. Profil/orga/auth ne sont JAMAIS
// persistés (cf. ancien bug d'écran blanc à la réhydratation).
const shouldDehydrateEmailsQuery = (query: {
  queryKey: readonly unknown[];
  state: { status: string };
}) =>
  query.state.status === "success" &&
  (query.queryKey?.[0] === "/api/emails" || query.queryKey?.[0] === "email-detail");

/**
 * Lit l'id de l'utilisateur connecté DIRECTEMENT depuis localStorage, sans
 * passer par `supabase.auth.getSession()`.
 *
 * Pourquoi : getSession() acquiert le verrou gotrue `lock:sb-<ref>-auth-token`
 * qui, d'après les logs, peut rester bloqué jusqu'à 5 s (thrash de verrou auth).
 * Si on attendait getSession() ici, la restauration du cache dépasserait la
 * garde de 700 ms de main.tsx → l'app démarrerait SANS cache → le squelette
 * gris réapparaîtrait. La lecture localStorage est synchrone et instantanée.
 *
 * Supabase stocke la session sous `sb-<project-ref>-auth-token` (JSON, parfois
 * préfixé `base64-`). On en extrait juste `user.id` pour étiqueter le cache.
 */
function readCurrentUserIdSync(): string {
  try {
    const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    if (!url || typeof window === "undefined") return "anon";
    const ref = new URL(url).hostname.split(".")[0];
    let raw = window.localStorage.getItem(`sb-${ref}-auth-token`);
    if (!raw) return "anon";
    if (raw.startsWith("base64-")) raw = atob(raw.slice("base64-".length));
    const parsed = JSON.parse(raw);
    return parsed?.user?.id ?? parsed?.currentSession?.user?.id ?? "anon";
  } catch {
    return "anon";
  }
}

/**
 * Restaure le cache des listes de mails depuis le navigateur AVANT le premier
 * rendu (appelé depuis main.tsx), puis abonne le client pour ré-enregistrer le
 * cache à chaque changement. Tolérant aux pannes : si la restauration échoue ou
 * traîne, on n'empêche jamais l'app de démarrer (garde-fou côté main.tsx).
 *
 * ISOLATION DES COMPTES (sécurité B2B) : le cache stocké est étiqueté avec
 * l'identifiant de l'utilisateur connecté via `buster`. Si le cache présent
 * dans ce navigateur a été écrit par un AUTRE compte (ex. poste partagé, session
 * expirée sans déconnexion explicite), le `buster` ne correspond pas →
 * `persistQueryClientRestore` jette ce cache au lieu de l'afficher. Un compte ne
 * peut donc jamais voir, même brièvement, les mails d'un autre.
 */
// Compte dont le cache est actuellement persisté + fonction de désabonnement de
// l'écriture automatique. Permet de RE-CLÉER le cache quand l'utilisateur se
// connecte. PIÈGE corrigé : au boot d'une connexion FRAÎCHE, aucun jeton n'est
// encore en localStorage → readCurrentUserIdSync() = "anon" → les mails se
// sauvegardaient sous buster `v1:anon`. Au rechargement suivant (désormais
// connecté), le buster devient `v1:<realId>` ≠ `v1:anon` → persistQueryClientRestore
// JETAIT tout le cache → le squelette gris réapparaissait à chaque login. On bascule
// donc l'abonnement (et on force une sauvegarde immédiate) sur l'id réel dès que la
// session apparaît.
let _persistOwnerId: string | null = null;
let _persistUnsub: (() => void) | null = null;
// Dernier compte connu (survit à la déconnexion, dans la mémoire de l'onglet
// uniquement). Permet de reconnaître une RECONNEXION du MÊME compte pour garder
// les mails déjà en mémoire → aucune squelette/clignotement. Réinitialisé à null
// dès qu'un AUTRE compte se connecte (la mémoire est alors purgée).
let _lastOwnerId: string | null = null;

function buildPersistOptions(userId: string) {
  return {
    queryClient,
    persister: emailsPersister!,
    maxAge: ONE_DAY,
    // buster lié à l'utilisateur : tout cache d'un autre compte est ignoré.
    buster: `${CACHE_BUSTER}:${userId}`,
    dehydrateOptions: { shouldDehydrateQuery: shouldDehydrateEmailsQuery },
  };
}

export async function restorePersistedQueryCache(): Promise<void> {
  if (!emailsPersister) return;
  // Lecture synchrone (pas de verrou gotrue) → restauration toujours < 700 ms.
  const userId = readCurrentUserIdSync();
  const persistOptions = buildPersistOptions(userId);
  try {
    await persistQueryClientRestore(persistOptions as any);
  } catch {
    // Cache corrompu ou incompatible — on ignore, l'app charge depuis le réseau.
  }
  try {
    _persistUnsub = persistQueryClientSubscribe(persistOptions as any);
    _persistOwnerId = userId;
    if (userId !== "anon") _lastOwnerId = userId;
  } catch {
    // Non fatal : la persistance future est simplement désactivée.
  }
}

/**
 * Re-cible le cache persisté sur l'utilisateur réellement connecté. Appelé sur
 * chaque évènement d'auth porteur de session (login frais, refresh, session
 * initiale). No-op si le propriétaire n'a pas changé.
 *  - Connexion fraîche (boot "anon" → realId) : on bascule l'abonnement sur
 *    `v1:<realId>` ET on force une sauvegarde immédiate sous ce buster, pour qu'un
 *    rechargement juste après le login restaure bien (au lieu de jeter le cache).
 *  - Propriétaire DIFFÉRENT connu (poste partagé, session d'un autre compte
 *    restaurée par erreur) : on purge cache mémoire + persisté avant de réabonner
 *    → aucun mail d'un autre compte n'est conservé.
 */
export async function syncPersistedCacheOwner(userId: string): Promise<void> {
  if (!emailsPersister || !userId || userId === _persistOwnerId) return;
  if (_persistUnsub) {
    try { _persistUnsub(); } catch { /* noop */ }
    _persistUnsub = null;
  }
  // RECONNEXION DU MÊME COMPTE (déconnexion → reconnexion sans recharger la page) :
  // les mails sont encore en mémoire vive (on ne les a PAS purgés à la déconnexion).
  // On garde donc la mémoire telle quelle → aucun squelette, réaffichage instantané.
  // Tout AUTRE cas (compte DIFFÉRENT, ou origine incertaine "anon" au boot d'un poste
  // partagé) purge cache mémoire + persisté AVANT de réabonner : un compte ne voit
  // JAMAIS, même brièvement, les mails d'un autre.
  const sameAccountReconnect = userId === _lastOwnerId;
  if (!sameAccountReconnect) {
    queryClient.clear();
    // On ATTEND la fin de la suppression IDB AVANT de réécrire la même clé plus
    // bas (sinon le del asynchrone pourrait finir après le save et effacer le
    // cache fraîchement écrit pour le nouveau compte).
    await purgePersistedCacheStorage();
  }
  const persistOptions = buildPersistOptions(userId);
  // Sauvegarde immédiate sous le nouveau buster, puis réabonnement continu.
  try { await persistQueryClientSave(persistOptions as any); } catch { /* noop */ }
  try {
    _persistUnsub = persistQueryClientSubscribe(persistOptions as any);
    _persistOwnerId = userId;
    _lastOwnerId = userId;
  } catch {
    /* noop */
  }
}

function teardownPersistedCache(): void {
  if (_persistUnsub) {
    try { _persistUnsub(); } catch { /* noop */ }
    _persistUnsub = null;
  }
  _persistOwnerId = null;
}

/**
 * Clears React Query cache (memory + persisted) when the user signs out so
 * the next user session never sees stale data from another account.
 */
function CacheCleanup() {
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT") {
        // On retient le compte qui se déconnecte (mémoire de l'onglet) pour
        // reconnaître une reconnexion du MÊME compte → réaffichage instantané.
        if (_persistOwnerId) _lastOwnerId = _persistOwnerId;
        // On coupe l'écriture sur disque ET on efface le cache local (rien des
        // mails ne reste sur le disque après déconnexion — confidentialité).
        // On ATTEND la fin de la suppression IDB (asynchrone) pour garantir, autant
        // que possible, que plus rien ne subsiste sur disque avant de poursuivre.
        teardownPersistedCache();
        await purgePersistedCacheStorage();
        // On NE vide PAS la mémoire vive (queryClient) : si le même compte se
        // reconnecte dans cette fenêtre, ses mails sont réaffichés sans squelette.
        // Un AUTRE compte qui se connecte purgera la mémoire (cf. syncPersistedCacheOwner).
        return;
      }
      // Toute session présente (login frais, refresh jeton, session initiale) :
      // on ré-étiquette le cache au compte réellement connecté. Corrige le cas
      // « boot anon → realId » qui jetait le cache au rechargement post-login.
      const uid = session?.user?.id;
      if (uid) syncPersistedCacheOwner(uid);
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

// Les <Route> de wouter remontent leur sous-arbre dès que l'identité du
// composant passé à `component` change. Avec une fonction fléchée inline
// (`component={protectedRoute(X)}`) cette identité change
// à CHAQUE rendu du Router — et le Router se re-rend à chaque évènement d'auth
// (rafraîchissement de jeton Supabase toutes les quelques secondes). Résultat :
// la page active (et donc l'état local comme le composer de réponse ouvert)
// était détruite puis recréée toutes les quelques secondes. On stabilise donc
// l'identité du wrapper par composant via un cache (les composants de page sont
// des références de module stables → clés WeakMap valides).
const protectedRouteCache = new WeakMap<React.ComponentType, React.ComponentType>();
function protectedRoute(Component: React.ComponentType): React.ComponentType {
  let wrapped = protectedRouteCache.get(Component);
  if (!wrapped) {
    wrapped = () => <ProtectedRoute component={Component} />;
    protectedRouteCache.set(Component, wrapped);
  }
  return wrapped;
}
const adminRouteCache = new WeakMap<React.ComponentType, React.ComponentType>();
function adminRoute(Component: React.ComponentType): React.ComponentType {
  let wrapped = adminRouteCache.get(Component);
  if (!wrapped) {
    wrapped = () => <AdminOnlyRoute component={Component} />;
    adminRouteCache.set(Component, wrapped);
  }
  return wrapped;
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
      <Route path="/telecharger" component={Telecharger} />
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
      <Route path="/dashboard" component={protectedRoute(Dashboard)} />
      <Route path="/dashboard/inbox-classic" component={protectedRoute(Dashboard)} />
      <Route path="/dashboard/envoyes" component={protectedRoute(Envoyes)} />
      <Route path="/dashboard/suivi" component={protectedRoute(Suivi)} />
      <Route path="/dashboard/programmes" component={protectedRoute(Programmes)} />
      {/* /dashboard/reportes — page autonome refactorisée façon Envoyés
          (52px Superhuman + HoverActions + clic droit + sélection multiple
          + colonne « Réveille le » + bouton « Réveiller maintenant » au
          survol). Remplace l'ancienne version qui montait Dashboard
          (task #293) pour afficher SnoozedPanel inline. */}
      <Route path="/dashboard/reportes" component={protectedRoute(Reportes)} />
      <Route path="/dashboard/archives" component={protectedRoute(Archives)} />
      <Route path="/dashboard/dossiers" component={protectedRoute(MesDossiers)} />
      <Route path="/dashboard/notifications" component={protectedRoute(NotificationsPage)} />
      <Route path="/dashboard/indesirables" component={protectedRoute(Indesirables)} />
      <Route path="/dashboard/corbeille" component={protectedRoute(Corbeille)} />
      <Route path="/dashboard/bilan" component={protectedRoute(BilanQuotidien)} />
      <Route path="/dashboard/taches" component={protectedRoute(Taches)} />
      <Route path="/dashboard/relances" component={protectedRoute(Relances)} />
      <Route path="/dashboard/classement" component={protectedRoute(Classement)} />
      <Route path="/dashboard/categories" component={() => <Redirect to="/dashboard/classement" />} />
      <Route path="/dashboard/projets" component={protectedRoute(Projets)} />
      <Route path="/dashboard/contacts" component={protectedRoute(Contacts)} />
      <Route path="/dashboard/contacts/:email" component={protectedRoute(Contacts)} />
      <Route path="/dashboard/parametres" component={protectedRoute(Parametres)} />
      <Route path="/dashboard/parametres/mon-compte" component={protectedRoute(ParametresMonCompte)} />
      <Route path="/dashboard/parametres/calendriers" component={protectedRoute(ParametresCalendriers)} />
      <Route path="/dashboard/parametres/vie-privee" component={protectedRoute(ParametresViePrivee)} />
      <Route path="/dashboard/parametres/crm" component={protectedRoute(ParametresCrm)} />
      <Route path="/dashboard/parametres/developpeurs" component={adminRoute(ParametresDeveloppeurs)} />
      <Route path="/dashboard/parametres/administration" component={adminRoute(ParametresAdministration)} />
      <Route path="/dashboard/parametres/templates" component={protectedRoute(Templates)} />
      <Route path="/dashboard/parametres/regles" component={protectedRoute(Regles)} />
      <Route path="/dashboard/parametres/sla" component={adminRoute(ParametresSla)} />
      <Route path="/dashboard/parametres/api" component={adminRoute(ParametresApi)} />
      <Route path="/dashboard/parametres/webhooks" component={adminRoute(ParametresWebhooks)} />
      <Route path="/dashboard/parametres/integrations" component={adminRoute(ParametresIntegrations)} />
      <Route path="/dashboard/abonnement" component={adminRoute(Abonnement)} />
      <Route path="/dashboard/equipe" component={protectedRoute(Equipe)} />
      <Route path="/dashboard/activite-equipe" component={protectedRoute(TeamActivite)} />
      <Route path="/dashboard/agenda" component={protectedRoute(Agenda)} />
      <Route path="/dashboard/admin" component={protectedRoute(AdminIndex)} />
      <Route path="/dashboard/admin/waitlist" component={protectedRoute(AdminWaitlist)} />
      <Route path="/dashboard/admin/abonnes" component={protectedRoute(AdminAbonnes)} />
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
