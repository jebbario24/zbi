import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  DollarSign, 
  CheckCircle, 
  AlertCircle, 
  Truck, 
  User, 
  XCircle,
  Clock,
  Package,
  MapPin,
  TrendingUp,
  Power,
  ArrowRight,
  Store,
  Home
} from "lucide-react";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface CompletionStatus {
  profileComplete: boolean;
  adminApproved: boolean;
}

interface DriverStats {
  totalDeliveries: number;
  totalEarnings: number;
  weeklyEarnings: number;
  acceptanceRate: number;
  isAvailable: boolean;
}

interface OrderItem {
  id: string;
  menuItemId?: string;
  bundleId?: string;
  quantity: number;
  unitPrice: string;
  subtotal: string;
  menuItem?: {
    name: string;
    price: string;
  };
  bundle?: {
    name: string;
    price: string;
  };
}

interface Restaurant {
  id: string;
  name: string;
  address: string;
  phone: string;
}

interface ActiveDelivery {
  id: string;
  orderNumber: string;
  status: string;
  total: string;
  deliveryAddress: string;
  deliveryFee: string;
  driverShare: string;
  restaurant: Restaurant;
  items: OrderItem[];
  customerName: string;
  customerPhone: string;
}

interface DeliveryZone {
  id: string;
  country: string;
  city: string;
  neighborhood: string;
}

interface AvailableOrder {
  id: string;
  orderNumber: string;
  total: string;
  deliveryAddress: string;
  estimatedEarnings: string;
  restaurant: Restaurant;
  createdAt: string;
  deliveryZone?: DeliveryZone;
}

const deliveryStatusSteps = [
  { key: 'pending', label: 'Order Placed', nextStatus: 'en_route_to_pickup' },
  { key: 'en_route_to_pickup', label: 'En Route to Pickup', nextStatus: 'arrived_at_restaurant' },
  { key: 'arrived_at_restaurant', label: 'Arrived at Restaurant', nextStatus: 'picked_up' },
  { key: 'picked_up', label: 'Picked Up Order', nextStatus: 'en_route_to_customer' },
  { key: 'en_route_to_customer', label: 'En Route to Customer', nextStatus: 'delivered' },
  { key: 'delivered', label: 'Delivered', nextStatus: null },
];

export default function DriverDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedZoneFilter, setSelectedZoneFilter] = useState<string>("all");

  // Fetch profile completion status
  const { data: completionStatus, isLoading: loadingStatus } = useQuery<CompletionStatus>({
    queryKey: ['/api/driver/check-completion'],
    enabled: !!user && user.role === 'driver',
  });

  // Bypass for test account
  const isTestAccount = user?.email === 'drivertest28697@gmail.com';
  const isApproved = completionStatus?.adminApproved === true || isTestAccount;

  // Fetch driver stats
  const { data: stats, isLoading: loadingStats } = useQuery<DriverStats>({
    queryKey: ['/api/driver/stats'],
    enabled: !!user && user.role === 'driver' && isApproved,
  });

  // Fetch active delivery
  const { data: activeDelivery, isLoading: loadingActiveDelivery } = useQuery<ActiveDelivery | null>({
    queryKey: ['/api/driver/active-delivery'],
    enabled: !!user && user.role === 'driver' && isApproved,
  });

  // Fetch service zones
  const { data: serviceZonesData } = useQuery<{ serviceZones: string[] }>({
    queryKey: ['/api/driver/service-zones'],
    enabled: !!user && user.role === 'driver' && isApproved,
  });

  // Fetch all available zones to map IDs to names
  const { data: allZones = [] } = useQuery<any[]>({
    queryKey: ['/api/driver/available-zones'],
    enabled: !!user && user.role === 'driver' && isApproved,
  });

  // Fetch available orders
  const { data: availableOrders = [], isLoading: loadingAvailableOrders } = useQuery<AvailableOrder[]>({
    queryKey: ['/api/driver/available-orders'],
    enabled: !!user && user.role === 'driver' && (isTestAccount || completionStatus?.adminApproved === true) && !activeDelivery,
  });

  // Filter orders by selected zone
  const filteredOrders = selectedZoneFilter === "all" 
    ? availableOrders 
    : availableOrders.filter(order => order.deliveryZone?.id === selectedZoneFilter);

  // Get unique zones from available orders for filter dropdown
  const uniqueZones = Array.from(
    new Map(
      availableOrders
        .filter(order => order.deliveryZone)
        .map(order => [order.deliveryZone!.id, order.deliveryZone!])
    ).values()
  );

  // Toggle driver online/offline status
  const statusMutation = useMutation({
    mutationFn: async (isAvailable: boolean) => {
      const response = await apiRequest('/api/driver/status', 'POST', { isAvailable });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/driver/stats'] });
      toast({
        title: "Status Updated",
        description: stats?.isAvailable ? "You are now offline" : "You are now online",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Accept order mutation
  const acceptOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const response = await apiRequest(`/api/driver/orders/${orderId}/accept`, 'POST');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/driver/active-delivery'] });
      queryClient.invalidateQueries({ queryKey: ['/api/driver/available-orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/driver/stats'] });
      toast({
        title: "Order Accepted",
        description: "You can now start the delivery",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update delivery status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      const response = await apiRequest(`/api/driver/orders/${orderId}/status`, 'POST', { status });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/driver/active-delivery'] });
      queryClient.invalidateQueries({ queryKey: ['/api/driver/stats'] });
      toast({
        title: "Status Updated",
        description: "Delivery status has been updated",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // WebSocket listener for real-time updates
  useEffect(() => {
    if (!user || user.role !== 'driver') return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    
    ws.onopen = () => {
      console.log('WebSocket connected for driver dashboard');
    };
    
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        // Handle application status changes (approved/rejected/updated)
        if (message.type === 'application_status_changed' || message.type === 'driver_application_updated') {
          queryClient.invalidateQueries({ queryKey: ['/api/driver/check-completion'] });
          
          if (message.data?.status === 'approved' || message.type === 'application_status_changed') {
            toast({
              title: "Application Approved! 🎉",
              description: message.data?.message || "You can now start accepting deliveries!",
              duration: 10000,
            });
            // Refetch stats and orders since driver is now approved
            queryClient.invalidateQueries({ queryKey: ['/api/driver/stats'] });
            queryClient.invalidateQueries({ queryKey: ['/api/driver/available-orders'] });
          }
        }
        
        // Handle new orders becoming available
        if (message.type === 'new_order_available' || message.type === 'new_delivery_order') {
          queryClient.invalidateQueries({ queryKey: ['/api/driver/available-orders'] });
          
          // Show notification for new delivery orders
          if (message.type === 'new_delivery_order') {
            const deliveryAddress = message.data?.deliveryAddress || 'Address not available';
            const earnings = message.data?.estimatedEarnings || '0';
            const restaurantName = message.data?.restaurantName || 'restaurant';
            
            toast({
              title: "🚗 New Delivery Available!",
              description: `From ${restaurantName} to ${deliveryAddress}. Earn $${earnings}`,
              duration: 10000,
            });
          }
        }
        
        // Handle delivery status updates
        if (message.type === 'delivery_status_updated') {
          queryClient.invalidateQueries({ queryKey: ['/api/driver/active-delivery'] });
          queryClient.invalidateQueries({ queryKey: ['/api/driver/stats'] });
        }
        
        // Handle driver assignment to orders
        if (message.type === 'driver_assigned') {
          queryClient.invalidateQueries({ queryKey: ['/api/driver/active-delivery'] });
          queryClient.invalidateQueries({ queryKey: ['/api/driver/available-orders'] });
          queryClient.invalidateQueries({ queryKey: ['/api/driver/stats'] });
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    ws.onclose = () => {
      console.log('WebSocket disconnected');
    };
    
    return () => {
      ws.close();
    };
  }, [user, toast]);

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

  const getCurrentStepIndex = (status: string) => {
    return deliveryStatusSteps.findIndex(step => step.key === status);
  };

  const getNextStatus = (currentStatus: string) => {
    const step = deliveryStatusSteps.find(s => s.key === currentStatus);
    return step?.nextStatus;
  };

  const profileStatus = getProfileCompletionMessage();
  const canToggleStatus = isTestAccount ? true : (completionStatus?.profileComplete && completionStatus?.adminApproved);

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Truck className="h-8 w-8" />
            Driver Dashboard
          </h1>
          <p className="text-muted-foreground">
            Welcome back, {user?.firstName || 'Driver'}!
          </p>
        </div>

        {/* Driver Status Toggle */}
        {isApproved && (
          <Card className="w-auto" data-testid="card-driver-status">
            <CardContent className="flex items-center gap-4 py-4">
              <div className="flex items-center gap-2">
                <Power className={`h-5 w-5 ${stats?.isAvailable ? 'text-green-600' : 'text-muted-foreground'}`} />
                <Label htmlFor="status-toggle" className="text-sm font-medium">
                  {stats?.isAvailable ? 'Online' : 'Offline'}
                </Label>
              </div>
              <Switch
                id="status-toggle"
                data-testid="switch-driver-status"
                checked={stats?.isAvailable || false}
                onCheckedChange={(checked) => statusMutation.mutate(checked)}
                disabled={!canToggleStatus || statusMutation.isPending}
              />
              <Badge 
                variant={stats?.isAvailable ? "default" : "secondary"}
                data-testid="badge-driver-status"
              >
                {stats?.isAvailable ? 'Available' : 'Unavailable'}
              </Badge>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Service Zones Indicator */}
      {isApproved && serviceZonesData && (
        <Card data-testid="card-service-zones">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="font-medium">Service Zones</div>
                <div className="text-sm text-muted-foreground">
                  {serviceZonesData.serviceZones.length === 0 ? (
                    "No zones selected"
                  ) : (
                    `Serving ${serviceZonesData.serviceZones.length} zone${serviceZonesData.serviceZones.length !== 1 ? 's' : ''}`
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {serviceZonesData.serviceZones.length === 0 ? (
                <Link href="/driver/settings?tab=zones">
                  <Button size="sm" variant="outline" data-testid="button-select-zones">
                    <MapPin className="w-4 h-4 mr-2" />
                    Select Zones
                  </Button>
                </Link>
              ) : (
                <div className="flex flex-wrap gap-1 max-w-md">
                  {serviceZonesData.serviceZones.slice(0, 3).map((zoneId: string) => {
                    const zone = allZones.find((z: any) => z.id === zoneId);
                    return zone ? (
                      <Badge key={zoneId} variant="secondary" data-testid={`badge-zone-${zoneId}`}>
                        {zone.neighborhood || zone.city}
                      </Badge>
                    ) : null;
                  })}
                  {serviceZonesData.serviceZones.length > 3 && (
                    <Badge variant="secondary">
                      +{serviceZonesData.serviceZones.length - 3} more
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Profile Completion Alert */}
      {!completionStatus?.adminApproved && (
        <Alert variant={completionStatus?.profileComplete ? "default" : "destructive"} data-testid="alert-profile-status">
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
      {!isApproved && (
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
                <span className="font-medium" data-testid="text-completion-percent">{profileStatus.percent}%</span>
              </div>
              <Progress value={profileStatus.percent} data-testid="progress-profile-completion" />
            </div>
            
            <div className="grid gap-3">
              <div className="flex items-center gap-2">
                {completionStatus?.profileComplete ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-destructive" />
                )}
                <span className="text-sm" data-testid="text-profile-complete-status">
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
                <span className="text-sm" data-testid="text-admin-approval-status">
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
      )}

      {/* Stats Grid - Only show when approved */}
      {isApproved && stats && (
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
                ${Number(stats.totalEarnings).toFixed(2)}
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
                ${Number(stats.weeklyEarnings).toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">Last 7 days</p>
            </CardContent>
          </Card>

          <Card data-testid="card-acceptance-rate">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Acceptance Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary" data-testid="stat-acceptance-rate">
                {stats.acceptanceRate}%
              </div>
              <p className="text-xs text-muted-foreground">Order acceptance</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Active Delivery Tracker */}
      {isApproved && activeDelivery && (
        <Card data-testid="card-active-delivery">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Active Delivery
            </CardTitle>
            <CardDescription>
              Order #{activeDelivery.orderNumber}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Order Details */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <Store className="h-4 w-4 mt-1 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium" data-testid="text-restaurant-name">{activeDelivery.restaurant.name}</p>
                    <p className="text-sm text-muted-foreground">{activeDelivery.restaurant.address}</p>
                    <p className="text-sm text-muted-foreground">{activeDelivery.restaurant.phone}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <Home className="h-4 w-4 mt-1 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium" data-testid="text-customer-name">{activeDelivery.customerName}</p>
                    <p className="text-sm text-muted-foreground" data-testid="text-delivery-address">{activeDelivery.deliveryAddress}</p>
                    <p className="text-sm text-muted-foreground">{activeDelivery.customerPhone}</p>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Order Items */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Order Items</h4>
              <div className="space-y-2" data-testid="list-order-items">
                {activeDelivery.items.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span>
                      {item.quantity}x {item.menuItem?.name || item.bundle?.name}
                    </span>
                    <span className="text-muted-foreground">${Number(item.subtotal).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Delivery Progress */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold">Delivery Progress</h4>
              <div className="space-y-3">
                {deliveryStatusSteps.map((step, index) => {
                  const currentIndex = getCurrentStepIndex(activeDelivery.status);
                  const isCompleted = index <= currentIndex;
                  const isCurrent = index === currentIndex;
                  
                  return (
                    <div key={step.key} className="flex items-center gap-3">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                        isCompleted ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                      }`}>
                        {isCompleted ? (
                          <CheckCircle className="h-4 w-4" />
                        ) : (
                          <span className="text-xs">{index + 1}</span>
                        )}
                      </div>
                      <span className={`text-sm ${isCurrent ? 'font-semibold' : ''}`} data-testid={`text-status-${step.key}`}>
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <Separator />

            {/* Earnings Info */}
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">Your Earnings</p>
                <p className="text-2xl font-bold text-green-600" data-testid="text-delivery-earnings">
                  ${Number(activeDelivery.driverShare).toFixed(2)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Order Total</p>
                <p className="text-lg font-semibold" data-testid="text-order-total">
                  ${Number(activeDelivery.total).toFixed(2)}
                </p>
              </div>
            </div>

            {/* Update Status Button */}
            {getNextStatus(activeDelivery.status) && (
              <Button
                className="w-full"
                size="lg"
                data-testid={`button-update-status-${getNextStatus(activeDelivery.status)}`}
                onClick={() => updateStatusMutation.mutate({ 
                  orderId: activeDelivery.id, 
                  status: getNextStatus(activeDelivery.status)! 
                })}
                disabled={updateStatusMutation.isPending}
              >
                {updateStatusMutation.isPending ? (
                  "Updating..."
                ) : (
                  <>
                    {deliveryStatusSteps.find(s => s.key === getNextStatus(activeDelivery.status))?.label}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Available Orders Section */}
      {isApproved && !activeDelivery && stats?.isAvailable && (
        <Card data-testid="card-available-orders">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Available Orders
                </CardTitle>
                <CardDescription>
                  Accept orders and start delivering
                </CardDescription>
              </div>
              {uniqueZones.length > 1 && (
                <Select value={selectedZoneFilter} onValueChange={setSelectedZoneFilter}>
                  <SelectTrigger className="w-[200px]" data-testid="select-zone-filter">
                    <SelectValue placeholder="Filter by zone" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Zones ({availableOrders.length})</SelectItem>
                    {uniqueZones.map((zone) => (
                      <SelectItem key={zone.id} value={zone.id}>
                        {zone.city}{zone.neighborhood ? ` - ${zone.neighborhood}` : ''} ({availableOrders.filter(o => o.deliveryZone?.id === zone.id).length})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loadingAvailableOrders ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              </div>
            ) : serviceZonesData && serviceZonesData.serviceZones.length === 0 ? (
              <Alert className="mb-4" data-testid="alert-no-zones">
                <MapPin className="h-4 w-4" />
                <AlertDescription>
                  <p className="font-medium mb-2">No Service Zones Selected</p>
                  <p className="mb-4">You need to select at least one delivery zone to start receiving orders.</p>
                  <Link href="/driver/settings?tab=zones">
                    <Button size="sm" data-testid="button-configure-zones">
                      <MapPin className="w-4 h-4 mr-2" />
                      Select Your Service Zones
                    </Button>
                  </Link>
                </AlertDescription>
              </Alert>
            ) : filteredOrders.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p data-testid="text-no-orders">
                  {selectedZoneFilter === "all" 
                    ? "No orders available in your selected zones" 
                    : "No orders available in this zone"}
                </p>
                <p className="text-sm">
                  {selectedZoneFilter === "all"
                    ? "Check back soon for delivery opportunities"
                    : "Try selecting 'All Zones' or check back later"}
                </p>
              </div>
            ) : (
              <div className="space-y-4" data-testid="list-available-orders">
                {filteredOrders.map((order) => (
                  <Card key={order.id} data-testid={`card-order-${order.id}`}>
                    <CardContent className="pt-6 space-y-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold" data-testid={`text-order-number-${order.id}`}>
                              Order #{order.orderNumber}
                            </p>
                            {order.deliveryZone && (
                              <Badge variant="secondary" className="text-xs" data-testid={`badge-zone-${order.id}`}>
                                <MapPin className="h-3 w-3 mr-1" />
                                {order.deliveryZone.city}{order.deliveryZone.neighborhood ? ` - ${order.deliveryZone.neighborhood}` : ''}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground" data-testid={`text-restaurant-${order.id}`}>
                            <Store className="inline h-3 w-3 mr-1" />
                            {order.restaurant.name}
                          </p>
                        </div>
                        <Badge variant="outline" data-testid={`badge-earnings-${order.id}`}>
                          Earn ${Number(order.estimatedEarnings).toFixed(2)}
                        </Badge>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-start gap-2 text-sm">
                          <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
                          <span className="text-muted-foreground" data-testid={`text-delivery-address-${order.id}`}>
                            {order.deliveryAddress}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Order Total:</span>
                          <span className="font-semibold" data-testid={`text-total-${order.id}`}>
                            ${Number(order.total).toFixed(2)}
                          </span>
                        </div>
                      </div>

                      <Button
                        className="w-full"
                        data-testid={`button-accept-order-${order.id}`}
                        onClick={() => acceptOrderMutation.mutate(order.id)}
                        disabled={acceptOrderMutation.isPending}
                      >
                        {acceptOrderMutation.isPending ? "Accepting..." : "Accept Order"}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Offline Message */}
      {isApproved && !stats?.isAvailable && !activeDelivery && (
        <Card data-testid="card-offline-message">
          <CardContent className="py-12 text-center">
            <Power className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">You're Currently Offline</h3>
            <p className="text-muted-foreground max-w-md mx-auto mb-4">
              Toggle your status to online at the top of the page to start receiving delivery orders.
            </p>
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
