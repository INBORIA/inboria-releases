import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { supabase } from "@/lib/supabase";
import NotFound from "@/pages/not-found";

import Login from "@/pages/login";
import Signup from "@/pages/signup";
import Dashboard from "@/pages/dashboard/index";
import BilanQuotidien from "@/pages/dashboard/bilan";
import Taches from "@/pages/dashboard/taches";
import Categories from "@/pages/dashboard/categories";
import Parametres from "@/pages/dashboard/parametres";
import Abonnement from "@/pages/dashboard/abonnement";

setAuthTokenGetter(async () => {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
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
      <Route path="/" component={() => session ? <Redirect to="/dashboard" /> : <Redirect to="/login" />} />
      <Route path="/login" component={() => session ? <Redirect to="/dashboard" /> : <Login />} />
      <Route path="/signup" component={() => session ? <Redirect to="/dashboard" /> : <Signup />} />
      <Route path="/dashboard" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/dashboard/bilan" component={() => <ProtectedRoute component={BilanQuotidien} />} />
      <Route path="/dashboard/taches" component={() => <ProtectedRoute component={Taches} />} />
      <Route path="/dashboard/categories" component={() => <ProtectedRoute component={Categories} />} />
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
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
