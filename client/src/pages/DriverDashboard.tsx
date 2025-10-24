import { useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { DollarSign, CheckCircle, AlertCircle, Truck, MapPin, XCircle, ExternalLink } from "lucide-react";
import { useLocation, Link } from "wouter";

interface DriverProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  applicationStatus: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  stripeConnectAccountId?: string;
}

interface CompletionStatus {
  profileComplete: boolean;
  adminApproved: boolean;
}

interface StripeStatus {
  connected: boolean;
  payoutsEnabled: boolean;
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  deliveryFee?: number;
  deliveryAddress?: {
    street: string;
    city: string;
  };
  deliveryTime?: string;
}

export default function DriverDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [location] = useLocation();
  const params = new URLSearchParams(location.split('?')[1]);
  const connectStatus = params.get('connect');

  // Fetch driver profile
  const { data: driver } = useQuery<DriverProfile>({
    queryKey: ['/api/driver/profile'],
  });

  // Fetch profile completion status
  const { data: completionStatus } = useQuery<CompletionStatus>({
    queryKey: ['/api/driver/check-completion'],
    enabled: !!user && user.role === 'driver',
  });

  // Fetch Stripe Connect status
  const { data: stripeStatus, refetch: refetchStatus} = useQuery<StripeStatus>({
    queryKey: ['/api/driver/connect/status'],
  });

  // Fetch driver orders
  const { data: orders = [] } = useQuery<Order[]>({
    queryKey: ['/api/driver/my-orders'],
    enabled: driver?.applicationStatus === 'approved' && completionStatus?.profileComplete && completionStatus?.adminApproved,
  });

  // Create Stripe Connect account
  const createAccountMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/driver/connect/create-account', 'POST');
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
      const response = await apiRequest('/api/driver/connect/onboarding-link', 'POST');
      return response.json();
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

  // Calculate profile completion details
  const getProfileCompletionDetails = () => {
    if (!user) return { percentage: 0, checklist: [] };
    
    const checklist = [
      {
        label: "Personal Info",
        completed: !!(user.phone && user.address && user.city && user.country && user.postalCode && user.emergencyContactName && user.emergencyContactPhone && user.dateOfBirth),
        description: "Phone, address, emergency contact",
      },
      {
        label: "Vehicle Details",
        completed: !!(user.vehicleType && user.vehicleMake && user.vehicleModel && user.vehicleYear && user.vehiclePlate && user.vehicleColor && user.licenseNumber && user.licenseExpiry),
        description: "Vehicle info and driver's license",
      },
      {
        label: "Documents",
        completed: !!(user.idProofUrl && user.insuranceUrl),
        description: "ID proof and insurance",
      },
      {
        label: "Bank Account",
        completed: !!((user as any).stripeAccountId || stripeStatus?.payoutsEnabled),
        description: "Connect your bank account",
      },
      {
        label: "Admin Approval",
        completed: !!completionStatus?.adminApproved,
        description: "Pending admin review",
      },
    ];

    const completedCount = checklist.filter(item => item.completed).length;
    const percentage = Math.round((completedCount / checklist.length) * 100);

    return { percentage, checklist };
  };

  const { percentage: completionPercentage, checklist: completionChecklist } = getProfileCompletionDetails();

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

      {/* Profile Completion Banner */}
      {(!completionStatus?.profileComplete || !completionStatus?.adminApproved) && (
        <Alert className="border-primary bg-primary/5" data-testid="alert-profile-completion">
          <AlertCircle className="h-5 w-5 text-primary" />
          <div className="flex-1 ml-2">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-lg">Complete Your Profile</h3>
              <span className="text-sm font-medium text-primary">{completionPercentage}% Complete</span>
            </div>
            
            <Progress value={completionPercentage} className="h-2 mb-4" data-testid="progress-profile-completion" />
            
            <div className="space-y-2 mb-4">
              {completionChecklist.map((item, index) => (
                <div key={index} className="flex items-start gap-2" data-testid={`checklist-item-${index}`}>
                  {item.completed ? (
                    <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" data-testid={`icon-check-${index}`} />
                  ) : (
                    <XCircle className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" data-testid={`icon-x-${index}`} />
                  )}
                  <div>
                    <p className={`font-medium ${item.completed ? 'text-green-700' : 'text-foreground'}`}>
                      {item.label}
                    </p>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>

            <AlertDescription>
              {!completionStatus?.profileComplete ? (
                <div className="flex items-center gap-2">
                  <p>Complete all required sections to start accepting deliveries.</p>
                  <Link href="/driver/settings">
                    <Button variant="default" size="sm" className="gap-1" data-testid="button-complete-profile">
                      Go to Settings
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </Link>
                </div>
              ) : !completionStatus?.adminApproved ? (
                <p className="text-yellow-700">Your profile is complete and under admin review. You'll be notified when approved.</p>
              ) : null}
            </AlertDescription>
          </div>
        </Alert>
      )}

      {/* Payout Setup Card */}
      {!stripeStatus?.payoutsEnabled && completionStatus?.adminApproved && (
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

      {/* Orders Section - Gated by Profile Completion and Admin Approval */}
      {completionStatus?.profileComplete && completionStatus?.adminApproved ? (
        <>
          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Available Orders</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold" data-testid="text-available-orders">{orders.filter((o: any) => o.status === 'preparing').length}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Active Deliveries</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold" data-testid="text-active-deliveries">{orders.filter((o: any) => o.status === 'on_the_way').length}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Completed Today</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold" data-testid="text-completed-today">
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
        </>
      ) : (
        <Card data-testid="card-orders-gated">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-6 w-6 text-yellow-500" />
              <CardTitle>Orders Not Available</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {!completionStatus?.profileComplete ? (
              <div className="text-center py-8">
                <Truck className="h-16 w-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium mb-2">Complete your profile to start accepting deliveries</p>
                <p className="text-muted-foreground mb-4">
                  Fill in all required information in your profile settings to begin receiving delivery orders.
                </p>
                <Link href="/driver/settings">
                  <Button variant="default" className="gap-1" data-testid="button-go-to-settings">
                    Go to Settings
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="text-center py-8">
                <AlertCircle className="h-16 w-16 mx-auto mb-4 text-yellow-500 opacity-50" />
                <p className="text-lg font-medium mb-2">Your profile is under review</p>
                <p className="text-muted-foreground">
                  Your profile has been submitted and is being reviewed by our admin team. You'll be notified when approved and can start accepting deliveries.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
