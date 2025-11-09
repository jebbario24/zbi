import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useBackgroundSync } from "@/hooks/useBackgroundSync";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { IOSInstallPrompt } from "@/components/IOSInstallPrompt";
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
  Home,
  Settings,
  LayoutDashboard,
  Download,
  Bell,
  BellOff,
  Navigation,
  Phone,
  ExternalLink,
  Filter,
  Eye,
  MessageSquare,
  BarChart3,
  Target,
  Zap
} from "lucide-react";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { OrderPreviewModal } from "@/components/OrderPreviewModal";
import { DeliveryProofCapture } from "@/components/DeliveryProofCapture";
import { QuickMessages } from "@/components/QuickMessages";
import { useLocationTracking } from "@/hooks/useLocationTracking";
import { calculateDistance, formatDistance, estimateTravelTime, getCurrentLocation } from "@/utils/location";

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

// Helper function to open navigation
const openNavigation = (address: string) => {
  const encodedAddress = encodeURIComponent(address);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  
  if (isIOS) {
    window.open(`maps://maps.apple.com/?daddr=${encodedAddress}`);
  } else {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`);
  }
};

export default function DriverDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedZoneFilter, setSelectedZoneFilter] = useState<string>("all");
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallButton, setShowInstallButton] = useState(false);
  const [previewOrder, setPreviewOrder] = useState<AvailableOrder | null>(null);
  const [showDeliveryProof, setShowDeliveryProof] = useState(false);
  const [showQuickMessages, setShowQuickMessages] = useState(false);
  const [messageRecipient, setMessageRecipient] = useState<{ name: string; phone: string; type: "restaurant" | "customer" } | null>(null);
  const [sortBy, setSortBy] = useState<"distance" | "earnings" | "time">("distance");
  const [filterByEarnings, setFilterByEarnings] = useState<string>("all");
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);
  
  // PWA Features
  const { isOnline, wasOffline } = useOnlineStatus();
  const { queueDeliveryStatusUpdate, isSyncing } = useBackgroundSync();
  const { isSupported: pushSupported, isSubscribed: pushSubscribed, subscribe: subscribeToPush, unsubscribe: unsubscribeFromPush } = usePushNotifications();

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

  // Location tracking for active delivery
  const { location: trackedLocation, startTracking, stopTracking } = useLocationTracking({
    enabled: !!activeDelivery,
    interval: 30000, // Update every 30 seconds
    onLocationUpdate: (loc) => {
      setDriverLocation({ lat: loc.lat, lng: loc.lng });
      // Send location update to backend
      if (activeDelivery) {
        apiRequest(`/api/driver/orders/${activeDelivery.id}/tracking`, 'PUT', {
          location: { lat: loc.lat, lng: loc.lng, timestamp: loc.timestamp }
        }).catch(err => console.error('Failed to update location:', err));
      }
    },
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

  // Get driver location for distance calculations
  useEffect(() => {
    if (availableOrders.length > 0 && !driverLocation) {
      getCurrentLocation()
        .then(loc => setDriverLocation(loc))
        .catch(err => console.error('Failed to get location:', err));
    }
  }, [availableOrders.length]);

  // Calculate distances and enrich orders
  const enrichedOrders = availableOrders.map((order: AvailableOrder) => {
    let distance: number | null = null;
    let distanceText = "Calculating...";
    let estimatedTime = "Calculating...";

    if (driverLocation) {
      // Try to geocode addresses and calculate distance
      // For now, we'll use a simple approach - in production, use proper geocoding
      // This is a placeholder - actual implementation would use geocoding API
      distanceText = "~2.5 km"; // Placeholder
      estimatedTime = "~8 min"; // Placeholder
    }

    return {
      ...order,
      distance,
      distanceText,
      estimatedTime,
    };
  });

  // Filter orders by selected zone
  let filteredOrders = selectedZoneFilter === "all" 
    ? enrichedOrders 
    : enrichedOrders.filter((order: any) => order.deliveryZone?.id === selectedZoneFilter);

  // Filter by earnings
  if (filterByEarnings !== "all") {
    const minEarnings = parseFloat(filterByEarnings);
    filteredOrders = filteredOrders.filter((order: any) => 
      Number(order.estimatedEarnings) >= minEarnings
    );
  }

  // Sort orders
  filteredOrders = [...filteredOrders].sort((a: any, b: any) => {
    if (sortBy === "distance") {
      // Sort by distance (closest first)
      return (a.distance || 999) - (b.distance || 999);
    } else if (sortBy === "earnings") {
      // Sort by earnings (highest first)
      return Number(b.estimatedEarnings) - Number(a.estimatedEarnings);
    } else {
      // Sort by time (newest first)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
  });

  // Get unique zones from available orders for filter dropdown
  const uniqueZones = Array.from(
    new Map(
      availableOrders
        .filter((order: AvailableOrder) => order.deliveryZone)
        .map((order: AvailableOrder) => [order.deliveryZone!.id, order.deliveryZone!])
    ).values()
  ) as DeliveryZone[];

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

  // PWA Install Prompt Handler
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallButton(true);
    };

    const handleAppInstalled = () => {
      setShowInstallButton(false);
      setDeferredPrompt(null);
      toast({
        title: "App Installed!",
        description: "EatOut Driver has been added to your home screen",
      });
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setShowInstallButton(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [toast]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    // Hide button regardless of outcome - it will reappear if browser fires beforeinstallprompt again
    setShowInstallButton(false);
    setDeferredPrompt(null);
    
    if (outcome === 'accepted') {
      toast({
        title: "Installing...",
        description: "The app will be added to your home screen shortly",
      });
    }
  };

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
    <div className="min-h-screen bg-background">
      {/* Navigation Header */}
      <div className="border-b bg-gradient-to-r from-primary/10 via-primary/5 to-background sticky top-0 z-50 backdrop-blur-sm shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Truck className="h-6 w-6 text-primary" />
              <span className="text-lg font-semibold">Driver Portal</span>
              {isApproved && stats?.isAvailable && filteredOrders.length > 0 && (
                <Badge variant="default" className="animate-pulse">
                  {filteredOrders.length} Available
                </Badge>
              )}
            </div>
            
            <div className="flex items-center gap-3">
              {/* Push Notifications Toggle */}
              {pushSupported && (
                <Button
                  variant={pushSubscribed ? "outline" : "default"}
                  size="sm"
                  onClick={() => pushSubscribed ? unsubscribeFromPush() : subscribeToPush()}
                  className="gap-2"
                >
                  {pushSubscribed ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
                  {pushSubscribed ? "Notifications On" : "Enable Notifications"}
                </Button>
              )}
              
              {/* PWA Install Button */}
              {showInstallButton && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleInstallClick}
                  className="gap-2"
                  data-testid="button-install-app"
                >
                  <Download className="h-4 w-4" />
                  Install App
                </Button>
              )}
              
              {/* Driver Status Toggle */}
              {isApproved && (
                <div className="flex items-center gap-3" data-testid="header-driver-status">
                  <div className="flex items-center gap-2">
                    <Power className={`h-4 w-4 ${stats?.isAvailable ? 'text-green-600' : 'text-muted-foreground'}`} />
                    <Label htmlFor="header-status-toggle" className="text-sm font-medium">
                      {stats?.isAvailable ? 'Online' : 'Offline'}
                    </Label>
                  </div>
                  <Switch
                    id="header-status-toggle"
                    data-testid="switch-driver-status-header"
                    checked={stats?.isAvailable || false}
                    onCheckedChange={(checked) => statusMutation.mutate(checked)}
                    disabled={!canToggleStatus || statusMutation.isPending}
                  />
                  <Badge 
                    variant={stats?.isAvailable ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {stats?.isAvailable ? 'Available' : 'Offline'}
                  </Badge>
                </div>
              )}
            </div>
          </div>
          
          {/* Navigation Menu */}
          <nav className="flex items-center gap-1" data-testid="driver-nav-menu">
            <Button asChild variant="ghost" size="sm" className="gap-2" data-testid="nav-dashboard">
              <Link href="/driver/dashboard">
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Link>
            </Button>
            
            <Button asChild variant="ghost" size="sm" className="gap-2 relative" data-testid="nav-service-zones">
              <Link href="/driver/service-zones">
                <MapPin className="h-4 w-4" />
                Service Zones
                {serviceZonesData && (
                  <Badge 
                    variant={serviceZonesData.serviceZones.length === 0 ? "destructive" : "secondary"}
                    className="ml-1 text-xs h-5 px-1.5"
                    data-testid="badge-zone-count-nav"
                  >
                    {serviceZonesData.serviceZones.length}
                  </Badge>
                )}
              </Link>
            </Button>
            
            <Button asChild variant="ghost" size="sm" className="gap-2" data-testid="nav-settings">
              <Link href="/driver/settings">
                <Settings className="h-4 w-4" />
                Settings
              </Link>
            </Button>
            
            <Button asChild variant="ghost" size="sm" className="gap-2" data-testid="nav-earnings">
              <Link href="/driver/dashboard#earnings">
                <TrendingUp className="h-4 w-4" />
                Earnings
              </Link>
            </Button>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto p-6 space-y-6">
        {/* Welcome Header */}
        <div>
          <h1 className="text-2xl font-bold">
            Welcome back, {user?.firstName || 'Driver'}!
          </h1>
          <p className="text-muted-foreground text-sm">
            Manage your deliveries and earnings
          </p>
        </div>

        {/* Offline/Online Indicator */}
        <OfflineIndicator />

        {/* iOS Install Instructions */}
        <IOSInstallPrompt />

        {/* Sync Status Indicator */}
        {isSyncing && (
          <Alert className="bg-blue-50 dark:bg-blue-950/20 border-blue-200">
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <AlertDescription className="text-blue-900 dark:text-blue-100">
                Syncing your offline actions...
              </AlertDescription>
            </div>
          </Alert>
        )}

      {/* Service Zones Indicator */}
      {isApproved && serviceZonesData && (
        <Card data-testid="card-service-zones">
          <CardContent className="py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 flex-1">
                <div className={`p-2 rounded-lg ${serviceZonesData.serviceZones.length === 0 ? 'bg-orange-100 dark:bg-orange-900/20' : 'bg-green-100 dark:bg-green-900/20'}`}>
                  <MapPin className={`h-5 w-5 ${serviceZonesData.serviceZones.length === 0 ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400'}`} />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-base mb-1">Service Zones</div>
                  {serviceZonesData.serviceZones.length === 0 ? (
                    <div className="text-sm text-muted-foreground mb-3">
                      No zones selected - You won't receive any orders
                    </div>
                  ) : (
                    <>
                      <div className="text-sm text-muted-foreground mb-2">
                        Serving {serviceZonesData.serviceZones.length} zone{serviceZonesData.serviceZones.length !== 1 ? 's' : ''}
                      </div>
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {serviceZonesData.serviceZones.slice(0, 4).map((zoneId: string) => {
                          const zone = allZones.find((z: any) => z.id === zoneId);
                          return zone ? (
                            <Badge key={zoneId} variant="secondary" className="text-xs" data-testid={`badge-zone-${zoneId}`}>
                              <MapPin className="h-3 w-3 mr-1" />
                              {zone.city}{zone.neighborhood ? ` - ${zone.neighborhood}` : ''}
                            </Badge>
                          ) : null;
                        })}
                        {serviceZonesData.serviceZones.length > 4 && (
                          <Badge variant="secondary" className="text-xs">
                            +{serviceZonesData.serviceZones.length - 4} more
                          </Badge>
                        )}
                      </div>
                    </>
                  )}
                  <Link href="/driver/service-zones">
                    <Button 
                      size="sm" 
                      variant={serviceZonesData.serviceZones.length === 0 ? "default" : "outline"}
                      data-testid="button-manage-zones"
                    >
                      <MapPin className="w-4 h-4 mr-2" />
                      {serviceZonesData.serviceZones.length === 0 ? "Select Zones" : "Manage Zones"}
                    </Button>
                  </Link>
                </div>
              </div>
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

      {/* Quick Stats Summary */}
      {isApproved && stats && (
        <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Today's Potential</p>
                <p className="text-2xl font-bold mt-1">
                  ${((Number(stats.weeklyEarnings) / 7) * 1.2).toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Based on weekly average + 20% boost
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-muted-foreground">Active Status</p>
                <Badge 
                  variant={stats.isAvailable ? "default" : "secondary"} 
                  className="mt-1 text-base px-3 py-1"
                >
                  {stats.isAvailable ? (
                    <>
                      <div className="h-2 w-2 rounded-full bg-green-500 mr-2 animate-pulse" />
                      Online
                    </>
                  ) : (
                    <>
                      <div className="h-2 w-2 rounded-full bg-gray-500 mr-2" />
                      Offline
                    </>
                  )}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid - Only show when approved */}
      {isApproved && stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-blue-500" data-testid="card-total-deliveries">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Deliveries</CardTitle>
              <Package className="h-5 w-5 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold" data-testid="stat-total-deliveries">
                {stats.totalDeliveries}
              </div>
              <p className="text-xs text-muted-foreground mt-1">All time deliveries</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500" data-testid="card-total-earnings">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
              <DollarSign className="h-5 w-5 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600" data-testid="stat-total-earnings">
                ${Number(stats.totalEarnings).toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Lifetime earnings</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500" data-testid="card-weekly-earnings">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">This Week</CardTitle>
              <TrendingUp className="h-5 w-5 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-600" data-testid="stat-weekly-earnings">
                ${Number(stats.weeklyEarnings).toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Last 7 days</p>
              <Progress 
                value={Math.min((Number(stats.weeklyEarnings) / 500) * 100, 100)} 
                className="mt-2 h-1" 
              />
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-orange-500" data-testid="card-acceptance-rate">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Acceptance Rate</CardTitle>
              <CheckCircle className="h-5 w-5 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-600" data-testid="stat-acceptance-rate">
                {stats.acceptanceRate}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">Order acceptance</p>
              <Progress value={stats.acceptanceRate} className="mt-2 h-1" />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Active Delivery Tracker */}
      {isApproved && activeDelivery && (
        <Card className="border-2 border-primary/20 shadow-lg" data-testid="card-active-delivery">
          <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Truck className="h-6 w-6" />
                  Active Delivery
                </CardTitle>
                <CardDescription className="text-base mt-1">
                  Order #{activeDelivery.orderNumber}
                </CardDescription>
              </div>
              <Badge className="text-lg px-4 py-2" variant="default">
                ${Number(activeDelivery.driverShare).toFixed(2)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            {/* Order Details with Quick Actions */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2 flex-1">
                    <Store className="h-4 w-4 mt-1 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="text-sm font-medium" data-testid="text-restaurant-name">{activeDelivery.restaurant.name}</p>
                      <p className="text-sm text-muted-foreground">{activeDelivery.restaurant.address}</p>
                      <p className="text-sm text-muted-foreground">{activeDelivery.restaurant.phone}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {activeDelivery.restaurant.address && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openNavigation(activeDelivery.restaurant.address)}
                        className="h-8 w-8 p-0"
                        title="Navigate to Restaurant"
                      >
                        <Navigation className="h-4 w-4" />
                      </Button>
                    )}
                    {activeDelivery.restaurant.phone && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(`tel:${activeDelivery.restaurant.phone}`)}
                        className="h-8 w-8 p-0"
                        title="Call Restaurant"
                      >
                        <Phone className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2 flex-1">
                    <Home className="h-4 w-4 mt-1 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="text-sm font-medium" data-testid="text-customer-name">{activeDelivery.customerName}</p>
                      <p className="text-sm text-muted-foreground" data-testid="text-delivery-address">{activeDelivery.deliveryAddress}</p>
                      <p className="text-sm text-muted-foreground">{activeDelivery.customerPhone}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {activeDelivery.deliveryAddress && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openNavigation(activeDelivery.deliveryAddress)}
                        className="h-8 w-8 p-0"
                        title="Navigate to Customer"
                      >
                        <Navigation className="h-4 w-4" />
                      </Button>
                    )}
                    {activeDelivery.customerPhone && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(`tel:${activeDelivery.customerPhone}`)}
                        className="h-8 w-8 p-0"
                        title="Call Customer"
                      >
                        <Phone className="h-4 w-4" />
                      </Button>
                    )}
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
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Delivery Progress
                </h4>
                {activeDelivery.status !== 'picked_up' && activeDelivery.restaurant.address && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openNavigation(activeDelivery.restaurant.address)}
                    className="gap-2"
                  >
                    <Navigation className="h-4 w-4" />
                    Navigate to Restaurant
                  </Button>
                )}
                {activeDelivery.status === 'picked_up' && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => openNavigation(activeDelivery.deliveryAddress)}
                    className="gap-2"
                  >
                    <Navigation className="h-4 w-4" />
                    Navigate to Customer
                  </Button>
                )}
              </div>
              <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-muted" />
                <div className="space-y-3">
                  {deliveryStatusSteps.map((step, index) => {
                    const currentIndex = getCurrentStepIndex(activeDelivery.status);
                    const isCompleted = index <= currentIndex;
                    const isCurrent = index === currentIndex;
                    
                    return (
                      <div key={step.key} className="relative flex items-start gap-4">
                        <div className={`relative z-10 h-8 w-8 rounded-full flex items-center justify-center transition-all ${
                          isCompleted 
                            ? 'bg-primary text-primary-foreground shadow-lg scale-110' 
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {isCompleted ? (
                            <CheckCircle className="h-5 w-5" />
                          ) : (
                            <span className="text-xs font-semibold">{index + 1}</span>
                          )}
                        </div>
                        <div className="flex-1 pt-1">
                          <div className={`flex items-center justify-between ${isCurrent ? 'mb-1' : ''}`}>
                            <span className={`text-sm font-medium ${isCurrent ? 'text-primary text-base' : ''}`} data-testid={`text-status-${step.key}`}>
                              {step.label}
                            </span>
                            {isCurrent && (
                              <Badge variant="default" className="animate-pulse">
                                Current
                              </Badge>
                            )}
                          </div>
                          {isCurrent && step.key === 'en_route_to_pickup' && activeDelivery.restaurant.address && (
                            <div className="mt-2 p-2 bg-muted rounded-md">
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {activeDelivery.restaurant.address}
                              </p>
                            </div>
                          )}
                          {isCurrent && step.key === 'en_route_to_customer' && (
                            <div className="mt-2 p-2 bg-muted rounded-md">
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {activeDelivery.deliveryAddress}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <Separator />

            {/* Quick Action Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => window.open(`tel:${activeDelivery.restaurant.phone}`)}
              >
                <Phone className="h-4 w-4" />
                Call Restaurant
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => {
                  setMessageRecipient({
                    name: activeDelivery.restaurant.name,
                    phone: activeDelivery.restaurant.phone,
                    type: "restaurant",
                  });
                  setShowQuickMessages(true);
                }}
              >
                <MessageSquare className="h-4 w-4" />
                Message Restaurant
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => window.open(`tel:${activeDelivery.customerPhone}`)}
              >
                <Phone className="h-4 w-4" />
                Call Customer
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => {
                  setMessageRecipient({
                    name: activeDelivery.customerName,
                    phone: activeDelivery.customerPhone,
                    type: "customer",
                  });
                  setShowQuickMessages(true);
                }}
              >
                <MessageSquare className="h-4 w-4" />
                Message Customer
              </Button>
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
            {getNextStatus(activeDelivery.status) === 'delivered' ? (
              <Button
                className="w-full"
                size="lg"
                onClick={() => setShowDeliveryProof(true)}
                disabled={updateStatusMutation.isPending}
              >
                Complete Delivery
                <CheckCircle className="ml-2 h-4 w-4" />
              </Button>
            ) : getNextStatus(activeDelivery.status) ? (
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
            ) : null}
          </CardContent>
        </Card>
      )}

      {/* Available Orders Section */}
      {isApproved && !activeDelivery && stats?.isAvailable && (
        <Card data-testid="card-available-orders">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Available Orders
                </CardTitle>
                <CardDescription>
                  Accept orders and start delivering
                </CardDescription>
              </div>
              <div className="flex gap-2 flex-wrap">
                {/* Sort By */}
                <Select value={sortBy} onValueChange={(v: "distance" | "earnings" | "time") => setSortBy(v)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="distance">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        Distance
                      </div>
                    </SelectItem>
                    <SelectItem value="earnings">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        Earnings
                      </div>
                    </SelectItem>
                    <SelectItem value="time">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Time
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                
                {/* Filter by Earnings */}
                <Select value={filterByEarnings} onValueChange={setFilterByEarnings}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Min earnings" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Earnings</SelectItem>
                    <SelectItem value="5">$5+</SelectItem>
                    <SelectItem value="10">$10+</SelectItem>
                    <SelectItem value="15">$15+</SelectItem>
                    <SelectItem value="20">$20+</SelectItem>
                  </SelectContent>
                </Select>

                {/* Zone Filter */}
                {uniqueZones.length > 1 && (
                  <Select value={selectedZoneFilter} onValueChange={setSelectedZoneFilter}>
                    <SelectTrigger className="w-[180px]" data-testid="select-zone-filter">
                      <SelectValue placeholder="Filter by zone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Zones ({availableOrders.length})</SelectItem>
                      {uniqueZones.map((zone: DeliveryZone) => (
                        <SelectItem key={zone.id} value={zone.id}>
                          {zone.city}{zone.neighborhood ? ` - ${zone.neighborhood}` : ''} ({availableOrders.filter((o: AvailableOrder) => o.deliveryZone?.id === zone.id).length})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
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
                  <Link href="/driver/service-zones">
                    <Button size="sm" data-testid="button-configure-zones">
                      <MapPin className="w-4 h-4 mr-2" />
                      Select Your Service Zones
                    </Button>
                  </Link>
                </AlertDescription>
              </Alert>
            ) : filteredOrders.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <div className="mx-auto w-24 h-24 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Package className="h-12 w-12 text-muted-foreground opacity-50" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No Orders Available</h3>
                <p className="text-muted-foreground max-w-md mx-auto mb-4" data-testid="text-no-orders">
                  {selectedZoneFilter === "all" 
                    ? "There are currently no delivery orders in your selected service zones. Check back soon!" 
                    : "No orders available in this zone. Try selecting 'All Zones' or check back later."}
                </p>
                {selectedZoneFilter !== "all" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedZoneFilter("all")}
                    data-testid="button-show-all-zones"
                  >
                    Show All Zones
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-4" data-testid="list-available-orders">
                {filteredOrders.map((order) => (
                  <Card 
                    key={order.id} 
                    className="transition-all hover:shadow-lg hover:border-primary/50"
                    data-testid={`card-order-${order.id}`}
                  >
                    <CardContent className="pt-6 space-y-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold" data-testid={`text-order-number-${order.id}`}>
                              Order #{order.orderNumber}
                            </p>
                            {order.deliveryZone && (
                              <Badge variant="secondary" className="text-xs" data-testid={`badge-zone-${order.id}`}>
                                <MapPin className="h-3 w-3 mr-1" />
                                {order.deliveryZone.city}{order.deliveryZone.neighborhood ? ` - ${order.deliveryZone.neighborhood}` : ''}
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-xs">
                              <Clock className="h-3 w-3 mr-1" />
                              {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground" data-testid={`text-restaurant-${order.id}`}>
                            <Store className="inline h-3 w-3 mr-1" />
                            {order.restaurant.name}
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge variant="default" className="text-lg font-semibold px-3 py-1" data-testid={`badge-earnings-${order.id}`}>
                            ${Number(order.estimatedEarnings).toFixed(2)}
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1">Earnings</p>
                        </div>
                      </div>
                      
                      <div className="space-y-2 p-3 bg-muted/50 rounded-md">
                        <div className="flex items-start gap-2 text-sm">
                          <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                          <div className="flex-1">
                            <span className="text-muted-foreground" data-testid={`text-delivery-address-${order.id}`}>
                              {order.deliveryAddress}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-auto p-0 ml-2 text-primary hover:text-primary/80"
                              onClick={() => openNavigation(order.deliveryAddress)}
                              title="Open in Maps"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-sm pt-2 border-t">
                          <span className="text-muted-foreground">Order Total:</span>
                          <span className="font-semibold" data-testid={`text-total-${order.id}`}>
                            ${Number(order.total).toFixed(2)}
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="lg"
                          className="flex-1"
                          onClick={() => setPreviewOrder(order)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Preview
                        </Button>
                        <Button
                          className="flex-1"
                          size="lg"
                          data-testid={`button-accept-order-${order.id}`}
                          onClick={() => acceptOrderMutation.mutate(order.id)}
                          disabled={acceptOrderMutation.isPending}
                        >
                          {acceptOrderMutation.isPending ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                              Accepting...
                            </>
                          ) : (
                            <>
                              Accept Order
                              <ArrowRight className="ml-2 h-4 w-4" />
                            </>
                          )}
                        </Button>
                      </div>
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

      {/* Order Preview Modal */}
      {previewOrder && (
        <OrderPreviewModal
          order={previewOrder}
          open={!!previewOrder}
          onClose={() => setPreviewOrder(null)}
          onAccept={() => {
            if (previewOrder) {
              acceptOrderMutation.mutate(previewOrder.id);
              setPreviewOrder(null);
            }
          }}
          distance={previewOrder.distanceText}
          estimatedTime={previewOrder.estimatedTime}
          isLoading={acceptOrderMutation.isPending}
        />
      )}

      {/* Delivery Proof Capture Modal */}
      {activeDelivery && (
        <DeliveryProofCapture
          open={showDeliveryProof}
          onClose={() => setShowDeliveryProof(false)}
          onComplete={async (data) => {
            // Upload photo if provided
            let photoUrl = data.photoUrl;
            if (data.photoUrl && data.photoUrl.startsWith('data:')) {
              // Convert base64 to file and upload
              try {
                const res = await apiRequest("/api/object-storage/upload-url", "POST", {
                  fileName: `delivery-proof-${activeDelivery.id}.jpg`,
                  objectPath: `drivers/${user?.id}/deliveries/${activeDelivery.id}/proof.jpg`,
                });
                const { uploadURL, objectPath } = await res.json();
                
                // Upload the image
                const blob = await fetch(data.photoUrl).then(r => r.blob());
                await fetch(uploadURL, {
                  method: 'PUT',
                  body: blob,
                  headers: { 'Content-Type': 'image/jpeg' },
                });
                
                photoUrl = objectPath;
              } catch (err) {
                console.error('Failed to upload photo:', err);
              }
            }

            // Update delivery status with proof
            updateStatusMutation.mutate({
              orderId: activeDelivery.id,
              status: 'delivered',
            }, {
              onSuccess: () => {
                // Update delivery proof in backend
                apiRequest(`/api/driver/orders/${activeDelivery.id}/proof`, 'POST', {
                  photoUrl,
                  signature: data.signature,
                  notes: data.notes,
                }).catch(err => console.error('Failed to save proof:', err));
                
                setShowDeliveryProof(false);
                toast({
                  title: "Delivery Completed!",
                  description: "Thank you for completing the delivery",
                });
              },
            });
          }}
          orderId={activeDelivery.id}
          isLoading={updateStatusMutation.isPending}
        />
      )}

      {/* Quick Messages Modal */}
      {messageRecipient && (
        <QuickMessages
          open={showQuickMessages}
          onClose={() => {
            setShowQuickMessages(false);
            setMessageRecipient(null);
          }}
          recipient={messageRecipient}
          onSend={async (message) => {
            // Send SMS via backend
            try {
              await apiRequest("/api/driver/send-message", "POST", {
                phone: messageRecipient.phone,
                message,
                type: messageRecipient.type,
              });
              toast({
                title: "Message Sent",
                description: `Message sent to ${messageRecipient.name}`,
              });
            } catch (error: any) {
              toast({
                title: "Error",
                description: error.message || "Failed to send message",
                variant: "destructive",
              });
            }
          }}
        />
      )}
      </div>
    </div>
  );
}
