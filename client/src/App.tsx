import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/hooks/use-sidebar-context";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { useInactivityTimeout } from "@/hooks/use-inactivity-timeout";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Requests from "@/pages/requests";
import { Experticias } from "@/pages/experticias";
import Trazabilidad from "@/pages/trazabilidad";
import Templates from "@/pages/templates";
import Users from "@/pages/users";
import ChatbotPage from "@/pages/chatbot";
import Monitoreo from "@/pages/monitoreo";
import NotFound from "@/pages/not-found";

function ProtectedRoute({
  children,
  requirePermission,
}: {
  children: React.ReactNode;
  requirePermission?: keyof import("@/hooks/use-permissions").Permission;
}) {
  const { isAuthenticated, loading } = useAuth();
  const permissions = usePermissions();

  // Always call hooks in the same order
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  if (requirePermission && !permissions[requirePermission]) {
    return <NotFound />;
  }

  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/dashboard">
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      </Route>
      <Route path="/solicitudes">
        <ProtectedRoute>
          <Requests />
        </ProtectedRoute>
      </Route>
      <Route path="/experticias">
        <ProtectedRoute>
          <Experticias />
        </ProtectedRoute>
      </Route>
      <Route path="/trazabilidad">
        <ProtectedRoute>
          <Trazabilidad />
        </ProtectedRoute>
      </Route>
      <Route path="/plantillas">
        <ProtectedRoute requirePermission="canViewEmailTemplates">
          <Templates />
        </ProtectedRoute>
      </Route>
      <Route path="/chatbot">
        <ProtectedRoute>
          <ChatbotPage />
        </ProtectedRoute>
      </Route>
      <Route path="/usuarios">
        <ProtectedRoute requirePermission="canViewUsers">
          <Users />
        </ProtectedRoute>
      </Route>
      <Route path="/monitoreo">
        <ProtectedRoute requirePermission="canViewUsers">
          <Monitoreo />
        </ProtectedRoute>
      </Route>
      <Route path="/">
        <ProtectedRoute requirePermission="canViewDashboard">
          <Dashboard />
        </ProtectedRoute>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function InactivityManager() {
  useInactivityTimeout();
  return null;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SidebarProvider>
          <InactivityManager />
          <Toaster />
          <Router />
        </SidebarProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
