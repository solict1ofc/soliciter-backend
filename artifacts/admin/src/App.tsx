import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import { Login } from "@/pages/Login";
import { Dashboard } from "@/pages/Dashboard";
import { useAuth } from "@/hooks/use-auth";

const queryClient = new QueryClient();

// Protected Route Component
function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated } = useAuth();
  
  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }
  
  return <Component />;
}

// Redirect if already logged in
function LoginRoute() {
  const { isAuthenticated } = useAuth();
  
  if (isAuthenticated) {
    return <Redirect to="/" />;
  }
  
  return <Login />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginRoute} />
      <Route path="/">
        {() => <ProtectedRoute component={Dashboard} />}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <Router />
      </WouterRouter>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
