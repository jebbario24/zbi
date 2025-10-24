import { useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { DollarSign, CheckCircle, AlertCircle, Truck, MapPin } from "lucide-react";
import { useLocation } from "wouter";

export default function DriverDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [location] = useLocation();
  const params = new URLSearchParams(location.split('?')[1]);
  const connectStatus = params.get('connect');

  // Fetch driver profile
  const { data: driver } = useQuery({
    queryKey: ['/api/driver/profile'],
  });

  // Fetch Stripe Connect status
  const { data: stripeStatus, refetch: refetchStatus } = useQuery({
    queryKey: ['/api/driver/connect/status'],
    enabled: driver?.applicationStatus === 'approved',
  });

  // Fetch driver orders
  const { data: orders = [] } = useQuery({
    queryKey: ['/api/driver/my-orders'],
    enabled: driver?.applicationStatus === 'approved',
  });

  // Create Stripe Connect account
  const createAccountMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/driver/connect/create-account');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/driver/connect/status'] });
      toast({
        title: "Account Created",
        description: "Your Stripe account has been created. Now let's set up your bank details.",
      });
      setupPayoutsMutation.mutate();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create Stripe account",
        variant: "destructive",
      });
    },
  });

  // Generate onboarding link and redirect
  const setupPayoutsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/driver/connect/onboarding-link');
      return response;
    },
    onSuccess: (data: any) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to generate onboarding link",
        variant: "destructive",
      });
    },
  });

  const handleSetupPayouts = () => {
    if (!stripeStatus?.connected) {
      createAccountMutation.mutate();
    } else {
      setupPayoutsMutation.mutate();
    }
  };

  // Show success message after Stripe onboarding (using useEffect to prevent re-render issues)
  useEffect(() => {
    if (connectStatus === 'success') {
      const timer = setTimeout(() => {
        refetchStatus();
        toast({
          title: "Payout Setup Complete!",
          description: "Your bank account is connected. You can now receive earnings.",
        });
        window.history.replaceState({}, '', '/driver/dashboard');
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [connectStatus, refetchStatus, toast]);

  if (!driver) {
    return (
      <div className="p-8">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Loading driver profile...
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (driver.applicationStatus === 'pending') {
    return (
      <div className="p-8">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-6 w-6 text-yellow-500" />
              <CardTitle>Application Under Review</CardTitle>
            </div>
            <CardDescription>
              Your driver application is being reviewed. You'll receive an email once it's approved.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (driver.applicationStatus === 'rejected') {
    return (
      <div className="p-8">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-6 w-6 text-destructive" />
              <CardTitle>Application Rejected</CardTitle>
            </div>
            <CardDescription>
              Unfortunately, your driver application was not approved.
              {driver.rejectionReason && (
                <p className="mt-2">Reason: {driver.rejectionReason}</p>
              )}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Driver Dashboard</h1>
        <p className="text-muted-foreground">Welcome back, {driver.firstName}!</p>
      </div>

      {/* Payout Setup Card */}
      {!stripeStatus?.payoutsEnabled && (
        <Card className="border-primary">
          <CardHeader>
            <div className="flex items-center gap-2">
              <DollarSign className="h-6 w-6 text-primary" />
              <CardTitle>Setup Payouts</CardTitle>
            </div>
            <CardDescription>
              Connect your bank account through Stripe to receive your earnings. Stripe handles everything securely.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleSetupPayouts}
              disabled={createAccountMutation.isPending || setupPayoutsMutation.isPending}
              size="lg"
              data-testid="button-setup-payouts"
            >
              {createAccountMutation.isPending || setupPayoutsMutation.isPending
                ? "Setting up..."
                : "Connect Bank Account"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Payout Status - Connected */}
      {stripeStatus?.payoutsEnabled && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-6 w-6 text-green-500" />
              <CardTitle>Payouts Connected</CardTitle>
            </div>
            <CardDescription>
              Your bank account is connected. Earnings are automatically paid out weekly.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Available Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{orders.filter((o: any) => o.status === 'preparing').length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Active Deliveries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{orders.filter((o: any) => o.status === 'on_the_way').length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Completed Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {orders.filter((o: any) => {
                if (o.status !== 'delivered') return false;
                const today = new Date().toDateString();
                return new Date(o.deliveryTime).toDateString() === today;
              }).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Orders */}
      <Card>
        <CardHeader>
          <CardTitle>My Deliveries</CardTitle>
          <CardDescription>Orders assigned to you</CardDescription>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Truck className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No deliveries assigned yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order: any) => (
                <div
                  key={order.id}
                  className="border rounded-lg p-4 hover-elevate"
                  data-testid={`order-${order.id}`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold">Order #{order.orderNumber}</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                        <MapPin className="h-3 w-3" />
                        {order.deliveryAddress?.street}, {order.deliveryAddress?.city}
                      </p>
                      <p className="text-sm mt-1">Status: <span className="font-medium capitalize">{order.status.replace('_', ' ')}</span></p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">${order.total}</p>
                      <p className="text-sm text-muted-foreground">Delivery Fee: ${order.deliveryFee || '0.00'}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
