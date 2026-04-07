import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { supabase } from "@/lib/supabase";
import NotFound from "@/pages/not-found";
import { CookieBanner } from "@/components/cookie-banner";

import Login from "@/pages/login";
import Signup from "@/pages/signup";
import VerifierEmail from "@/pages/verifier-email";
import AuthCallback from "@/pages/auth-callback";
import MotDePasseOublie from "@/pages/mot-de-passe-oublie";
import ResetPassword from "@/pages/reset-password";
import Dashboard from "@/pages/dashboard/index";
import Archives from "@/pages/dashboard/archives";
import BilanQuotidien from "@/pages/dashboard/bilan";
import Taches from "@/pages/dashboard/taches";
import Categories from "@/pages/dashboard/categories";
import Parametres from "@/pages/dashboard/parametres";
import Abonnement from "@/pages/dashboard/abonnement";
import Projets from "@/pages/dashboard/projets";

import Accueil from "@/pages/marketing/accueil";
import Fonctionnalites from "@/pages/marketing/fonctionnalites";
import Tarifs from "@/pages/marketing/tarifs";
import MentionsLegales from "@/pages/marketing/mentions-legales";
import Confidentialite from "@/pages/marketing/confidentialite";
import Conditions from "@/pages/marketing/conditions";

setAuthTokenGetter(async () => {
  const { data } = await supabase.auth.getSession();
  if (data.session?.access_token) {
    const expiresAt = data.session.expires_at ?? 0;
    const nowSec = Math.floor(Date.now() / 1000);
    if (expiresAt > nowSec + 60) {
      return data.session.access_token;
    }
    const { data: refreshed } = await supabase.auth.refreshSession();
    return refreshed.session?.access_token ?? null;
  }
  return null;
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { session, loading } = useAuth();

  if (loading) return null;
  if (!session) return <Redirect to="/login" />;
  return <Component />;
}

function Router() {
  const { session, loading } = useAuth();

  if (loading) return null;

  return (
    <Switch>
      <Route path="/" component={() => session ? <Redirect to="/dashboard" /> : <Accueil />} />
      <Route path="/fonctionnalites" component={Fonctionnalites} />
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
      <Route path="/dashboard" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/dashboard/archives" component={() => <ProtectedRoute component={Archives} />} />
      <Route path="/dashboard/bilan" component={() => <ProtectedRoute component={BilanQuotidien} />} />
      <Route path="/dashboard/taches" component={() => <ProtectedRoute component={Taches} />} />
      <Route path="/dashboard/categories" component={() => <ProtectedRoute component={Categories} />} />
      <Route path="/dashboard/projets" component={() => <ProtectedRoute component={Projets} />} />
      <Route path="/dashboard/parametres" component={() => <ProtectedRoute component={Parametres} />} />
      <Route path="/dashboard/abonnement" component={() => <ProtectedRoute component={Abonnement} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
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
