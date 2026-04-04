import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import Login from "@/pages/login";
import Signup from "@/pages/signup";
import Dashboard from "@/pages/dashboard/index";
import BilanQuotidien from "@/pages/dashboard/bilan";
import Taches from "@/pages/dashboard/taches";
import Categories from "@/pages/dashboard/categories";
import Parametres from "@/pages/dashboard/parametres";
import Abonnement from "@/pages/dashboard/abonnement";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={() => <Redirect to="/login" />} />
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/dashboard/bilan" component={BilanQuotidien} />
      <Route path="/dashboard/taches" component={Taches} />
      <Route path="/dashboard/categories" component={Categories} />
      <Route path="/dashboard/parametres" component={Parametres} />
      <Route path="/dashboard/abonnement" component={Abonnement} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
