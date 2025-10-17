import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SubscriptionGuard } from "@/components/SubscriptionGuard";
import { useAuth } from "@/hooks/useAuth";
import { UserMenu } from "@/components/UserMenu";
import Landing from "@/pages/Landing";
import Dashboard from "@/pages/Dashboard";
import Menu from "@/pages/Menu";
import Orders from "@/pages/Orders";
import Reservations from "@/pages/Reservations";
import Tables from "@/pages/Tables";
import Staff from "@/pages/Staff";
import Inventory from "@/pages/Inventory";
import Analytics from "@/pages/Analytics";
import Settings from "@/pages/Settings";
import POS from "@/pages/POS";
import Storefront from "@/pages/Storefront";
import Subscribe from "@/pages/Subscribe";
import DeliveryZones from "@/pages/DeliveryZones";
import OnlineStore from "@/pages/OnlineStore";
import Billing from "@/pages/Billing";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminRestaurants from "@/pages/AdminRestaurants";
import NotFound from "@/pages/not-found";

function PublicRouter() {
  // Check if we're on a subdomain or custom domain (not the main app domain)
  const hostname = window.location.hostname;
  const parts = hostname.split('.');
  
  // Main app domains: 
  // - Production: xxx.replit.app (3 parts)
  // - Development: xxx.cluster.replit.dev (4 parts)
  // - Localhost: localhost (1 part)
  // Storefront domains: subdomain.xxx.replit.app (4+ parts) or subdomain.xxx.cluster.replit.dev (5+ parts)
  const isReplitDomain = hostname.includes('replit.app') || hostname.includes('replit.dev');
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
  
  // Storefront check: 
  // - On replit.app: 4+ parts means subdomain (subdomain.xxx.replit.app)
  // - On replit.dev: 5+ parts means subdomain (subdomain.xxx.cluster.replit.dev)
  const isStorefrontDomain = isReplitDomain && (
    (hostname.includes('replit.app') && parts.length > 3) ||
    (hostname.includes('replit.dev') && parts.length > 4)
  );
  
  return (
    <Switch>
      <Route path="/">{isStorefrontDomain ? <Storefront /> : <Landing />}</Route>
      <Route path="/store/:slug" component={Storefront} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthenticatedRouter() {
  const { user } = useAuth();
  
  // Admin routes
  if (user?.role === 'admin') {
    return (
      <Switch>
        <Route path="/" component={AdminDashboard} />
        <Route path="/admin" component={AdminDashboard} />
        <Route path="/admin/restaurants" component={AdminRestaurants} />
        <Route path="/settings" component={Settings} />
        <Route path="/store/:slug" component={Storefront} />
        <Route component={NotFound} />
      </Switch>
    );
  }
  
  // Restaurant owner routes
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/subscribe" component={Subscribe} />
      <Route path="/billing" component={Billing} />
      <Route path="/menu" component={Menu} />
      <Route path="/orders" component={Orders} />
      <Route path="/reservations" component={Reservations} />
      <Route path="/tables" component={Tables} />
      <Route path="/staff" component={Staff} />
      <Route path="/inventory" component={Inventory} />
      <Route path="/delivery-zones" component={DeliveryZones} />
      <Route path="/analytics" component={Analytics} />
      <Route path="/online-store" component={OnlineStore} />
      <Route path="/settings" component={Settings} />
      <Route path="/pos" component={POS} />
      <Route path="/store/:slug" component={Storefront} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <PublicRouter />;
  }

  return (
    <SubscriptionGuard>
      <SidebarProvider style={style as React.CSSProperties}>
        <div className="flex h-screen w-full">
          <AppSidebar />
          <div className="flex flex-col flex-1 overflow-hidden">
            <header className="flex items-center justify-between p-3 border-b">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <div className="flex items-center gap-2">
                <ThemeToggle />
                <UserMenu />
              </div>
            </header>
            <main className="flex-1 overflow-auto">
              <AuthenticatedRouter />
            </main>
          </div>
        </div>
      </SidebarProvider>
    </SubscriptionGuard>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppContent />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
