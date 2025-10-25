import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { 
  DollarSign, 
  CheckCircle, 
  AlertCircle, 
  Truck, 
  User, 
  XCircle,
  Clock,
  Package
} from "lucide-react";
import { Link } from "wouter";

interface CompletionStatus {
  profileComplete: boolean;
  adminApproved: boolean;
}

interface DriverStats {
  totalDeliveries: number;
  totalEarnings: number;
  weeklyEarnings: number;
  pendingOrders: number;
}

export default function DriverDashboard() {
  const { user } = useAuth();

  // Fetch profile completion status
  const { data: completionStatus, isLoading: loadingStatus } = useQuery<CompletionStatus>({
    queryKey: ['/api/driver/check-completion'],
    enabled: !!user && user.role === 'driver',
  });

  // Mock driver stats (replace with real API call later)
  const stats: DriverStats = {
    totalDeliveries: 0,
    totalEarnings: 0,
    weeklyEarnings: 0,
    pendingOrders: 0,
  };

  const getProfileCompletionMessage = () => {
    if (!completionStatus) return { message: "Loading...", percent: 0 };
    
    if (completionStatus.profileComplete && completionStatus.adminApproved) {
      return { message: "Profile complete and approved! You can start delivering.", percent: 100 };
    }
    
    if (completionStatus.profileComplete && !completionStatus.adminApproved) {
      return { message: "Profile complete. Waiting for admin approval.", percent: 75 };
    }
    
    return { message: "Please complete your profile to start delivering.", percent: 25 };
  };

  const profileStatus = getProfileCompletionMessage();

  if (loadingStatus) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Welcome Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Truck className="h-8 w-8" />
          Driver Dashboard
        </h1>
        <p className="text-muted-foreground">
          Welcome back, {user?.firstName || 'Driver'}!
        </p>
      </div>

      {/* Profile Completion Alert */}
      {!completionStatus?.adminApproved && (
        <Alert variant={completionStatus?.profileComplete ? "default" : "destructive"}>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>{profileStatus.message}</span>
            {!completionStatus?.profileComplete && (
              <Link href="/driver/settings">
                <Button size="sm" variant="outline" data-testid="button-complete-profile">
                  Complete Profile
                </Button>
              </Link>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Profile Completion Card */}
      <Card data-testid="card-profile-completion">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile Status
          </CardTitle>
          <CardDescription>
            Complete your profile to start accepting deliveries
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Profile Completion</span>
              <span className="font-medium">{profileStatus.percent}%</span>
            </div>
            <Progress value={profileStatus.percent} />
          </div>
          
          <div className="grid gap-3">
            <div className="flex items-center gap-2">
              {completionStatus?.profileComplete ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-destructive" />
              )}
              <span className="text-sm">
                {completionStatus?.profileComplete ? 'Profile Complete' : 'Profile Incomplete'}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              {completionStatus?.adminApproved ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : completionStatus?.profileComplete ? (
                <Clock className="h-5 w-5 text-yellow-600" />
              ) : (
                <XCircle className="h-5 w-5 text-muted-foreground" />
              )}
              <span className="text-sm">
                {completionStatus?.adminApproved 
                  ? 'Approved by Admin' 
                  : completionStatus?.profileComplete
                  ? 'Pending Admin Approval'
                  : 'Awaiting Profile Completion'}
              </span>
            </div>
          </div>

          {!completionStatus?.profileComplete && (
            <Link href="/driver/settings">
              <Button className="w-full" data-testid="button-go-to-settings">
                <User className="mr-2 h-4 w-4" />
                Complete Your Profile
              </Button>
            </Link>
          )}
        </CardContent>
      </Card>

      {/* Stats Grid - Only show when approved */}
      {completionStatus?.adminApproved && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card data-testid="card-total-deliveries">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Deliveries</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-total-deliveries">
                {stats.totalDeliveries}
              </div>
              <p className="text-xs text-muted-foreground">All time</p>
            </CardContent>
          </Card>

          <Card data-testid="card-total-earnings">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-total-earnings">
                ${stats.totalEarnings.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">All time</p>
            </CardContent>
          </Card>

          <Card data-testid="card-weekly-earnings">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">This Week</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600" data-testid="stat-weekly-earnings">
                ${stats.weeklyEarnings.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">Last 7 days</p>
            </CardContent>
          </Card>

          <Card data-testid="card-pending-orders">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Available Orders</CardTitle>
              <Truck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary" data-testid="stat-pending-orders">
                {stats.pendingOrders}
              </div>
              <p className="text-xs text-muted-foreground">Ready to accept</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Available Deliveries - Only show when approved */}
      {completionStatus?.adminApproved && (
        <Card data-testid="card-available-deliveries">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Available Deliveries
            </CardTitle>
            <CardDescription>
              Accept orders and start delivering
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No orders available at the moment</p>
              <p className="text-sm">Check back soon for delivery opportunities</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Waiting for Approval Message */}
      {completionStatus?.profileComplete && !completionStatus?.adminApproved && (
        <Card data-testid="card-waiting-approval">
          <CardContent className="py-12 text-center">
            <Clock className="h-12 w-12 mx-auto mb-4 text-yellow-600" />
            <h3 className="text-lg font-semibold mb-2">Application Under Review</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Thank you for completing your profile! Our team is reviewing your application. 
              You'll be able to start accepting deliveries once you're approved.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
