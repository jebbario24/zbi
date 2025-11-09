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
  Zap,
  ChevronDown,
  ChevronUp,
  MoreVertical,
  Menu,
  X as CloseIcon
} from "lucide-react";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { OrderPreviewModal } from "@/components/OrderPreviewModal";
import { DeliveryProofCapture } from "@/components/DeliveryProofCapture";
import { QuickMessages } from "@/components/QuickMessages";
import { useLocationTracking } from "@/hooks/useLocationTracking";
import { calculateDistance, formatDistance, estimateTravelTime, getCurrentLocation } from "@/utils/location";
import { DebugAuthInfo } from "@/components/DebugAuthInfo";
import { LiveDeliveryTracker } from "@/components/delivery/LiveDeliveryTracker";
import { BatchOptimizer } from "@/components/delivery/BatchOptimizer";

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
  const [showFilters, setShowFilters] = useState(false);
  const [showOrderItems, setShowOrderItems] = useState(true);
  const [showDeliveryProgress, setShowDeliveryProgress] = useState(true);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [showBatchOptimizer, setShowBatchOptimizer] = useState(false);
  
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

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showQuickActions) {
        setShowQuickActions(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showQuickActions]);

  if (loadingStatus) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Simplified Navigation Header */}
      <div className="border-b bg-white dark:bg-background sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Left: Logo & Navigation */}
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-primary" />
                <span className="font-semibold">Driver</span>
              </div>
              
              <nav className="hidden md:flex items-center gap-1" data-testid="driver-nav-menu">
                <Button asChild variant="ghost" size="sm" data-testid="nav-dashboard">
                  <Link href="/driver/dashboard">
                    <LayoutDashboard className="h-4 w-4 mr-1.5" />
                    Dashboard
                  </Link>
                </Button>
                <Button asChild variant="ghost" size="sm" data-testid="nav-service-zones">
                  <Link href="/driver/service-zones">
                    <MapPin className="h-4 w-4 mr-1.5" />
                    Zones
                    {serviceZonesData && serviceZonesData.serviceZones.length > 0 && (
                      <Badge variant="secondary" className="ml-1.5 text-xs h-4 px-1">
                        {serviceZonesData.serviceZones.length}
                      </Badge>
                    )}
                  </Link>
                </Button>
                <Button asChild variant="ghost" size="sm" data-testid="nav-settings">
                  <Link href="/driver/settings">
                    <Settings className="h-4 w-4 mr-1.5" />
                    Settings
                  </Link>
                </Button>
              </nav>
            </div>

            {/* Right: Status & Actions */}
            <div className="flex items-center gap-3">
              {/* Available Orders Badge */}
              {isApproved && stats?.isAvailable && filteredOrders.length > 0 && (
                <Badge variant="default" className="animate-pulse hidden sm:flex">
                  {filteredOrders.length} {filteredOrders.length === 1 ? 'Order' : 'Orders'}
                </Badge>
              )}

              {/* Driver Status Toggle - Simplified */}
              {isApproved && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-background" data-testid="header-driver-status">
                  <Switch
                    id="header-status-toggle"
                    data-testid="switch-driver-status-header"
                    checked={stats?.isAvailable || false}
                    onCheckedChange={(checked) => statusMutation.mutate(checked)}
                    disabled={!canToggleStatus || statusMutation.isPending}
                  />
                  <div className="flex items-center gap-1.5">
                    <div className={`h-2 w-2 rounded-full ${stats?.isAvailable ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                    <Label htmlFor="header-status-toggle" className="text-sm font-medium cursor-pointer">
                      {stats?.isAvailable ? 'Online' : 'Offline'}
                    </Label>
                  </div>
                </div>
              )}

              {/* Quick Actions Dropdown */}
              <div className="relative">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowQuickActions(!showQuickActions)}
                  className="h-9 w-9 p-0"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
                
                {showQuickActions && (
                  <div className="absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 z-50">
                    <div className="py-1">
                      {pushSupported && (
                        <button
                          onClick={() => {
                            pushSubscribed ? unsubscribeFromPush() : subscribeToPush();
                            setShowQuickActions(false);
                          }}
                          className="flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          {pushSubscribed ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
                          {pushSubscribed ? 'Disable Notifications' : 'Enable Notifications'}
                        </button>
                      )}
                      {showInstallButton && (
                        <button
                          onClick={() => {
                            handleInstallClick();
                            setShowQuickActions(false);
                          }}
                          className="flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                          data-testid="button-install-app"
                        >
                          <Download className="h-4 w-4" />
                          Install App
                        </button>
                      )}
                      <Link href="/driver/settings">
                        <button
                          onClick={() => setShowQuickActions(false)}
                          className="flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          <Settings className="h-4 w-4" />
                          Settings
                        </button>
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto p-4 md:p-6 space-y-4 max-w-7xl">
        {/* Debug Auth Info - Shows user role and helps diagnose 403 errors */}
        <DebugAuthInfo />

        {/* Priority Alert System - Show only the most important alert */}
        {!isApproved && completionStatus && (
          <Alert variant={completionStatus.profileComplete ? "default" : "destructive"} data-testid="alert-profile-status">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between flex-wrap gap-2">
              <span className="flex-1">{profileStatus.message}</span>
              {!completionStatus.profileComplete && (
                <Link href="/driver/settings">
                  <Button size="sm" variant="outline" data-testid="button-complete-profile">
                    Complete Profile
                  </Button>
                </Link>
              )}
            </AlertDescription>
          </Alert>
        )}

        {isApproved && serviceZonesData && serviceZonesData.serviceZones.length === 0 && (
          <Alert className="bg-orange-50 dark:bg-orange-900/20 border-orange-200" data-testid="alert-no-zones">
            <MapPin className="h-4 w-4 text-orange-600" />
            <AlertDescription className="flex items-center justify-between flex-wrap gap-2">
              <span className="flex-1">No service zones selected. Select zones to receive orders.</span>
              <Link href="/driver/service-zones">
                <Button size="sm" variant="outline" data-testid="button-configure-zones">
                  Select Zones
                </Button>
              </Link>
            </AlertDescription>
          </Alert>
        )}

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

        {!isOnline && (
          <OfflineIndicator />
        )}

      {/* Compact Stats Card - Only show when approved */}
      {isApproved && stats && (
        <Card className="overflow-hidden" data-testid="card-stats-summary">
          <CardContent className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {/* Total Deliveries */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Package className="h-4 w-4" />
                  <span className="text-xs font-medium uppercase tracking-wide">Deliveries</span>
                </div>
                <div>
                  <div className="text-2xl font-bold" data-testid="stat-total-deliveries">
                    {stats.totalDeliveries}
                  </div>
                  <p className="text-xs text-muted-foreground">All time</p>
                </div>
              </div>

              {/* Total Earnings */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <DollarSign className="h-4 w-4" />
                  <span className="text-xs font-medium uppercase tracking-wide">Lifetime</span>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600" data-testid="stat-total-earnings">
                    ${Number(stats.totalEarnings).toFixed(2)}
                  </div>
                  <p className="text-xs text-muted-foreground">Total earned</p>
                </div>
              </div>

              {/* Weekly Earnings */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-xs font-medium uppercase tracking-wide">This Week</span>
                </div>
                <div>
                  <div className="text-2xl font-bold text-primary" data-testid="stat-weekly-earnings">
                    ${Number(stats.weeklyEarnings).toFixed(2)}
                  </div>
                  <p className="text-xs text-muted-foreground">Last 7 days</p>
                </div>
              </div>

              {/* Acceptance Rate */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-xs font-medium uppercase tracking-wide">Acceptance</span>
                </div>
                <div>
                  <div className="text-2xl font-bold" data-testid="stat-acceptance-rate">
                    {stats.acceptanceRate}%
                  </div>
                  <p className="text-xs text-muted-foreground">Success rate</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Phase 1: Live Delivery Tracker with Real-Time Map */}
      {isApproved && activeDelivery && (
        <LiveDeliveryTracker
          order={{
            id: parseInt(activeDelivery.id),
            restaurantName: activeDelivery.restaurant.name,
            restaurantAddress: activeDelivery.restaurant.address,
            restaurantLat: activeDelivery.restaurantLat || "0",
            restaurantLng: activeDelivery.restaurantLng || "0",
            restaurantPhone: activeDelivery.restaurant.phone,
            deliveryAddress: activeDelivery.deliveryAddress,
            deliveryLat: activeDelivery.deliveryLat || "0",
            deliveryLng: activeDelivery.deliveryLng || "0",
            customerName: activeDelivery.customerName,
            customerPhone: activeDelivery.customerPhone,
            status: activeDelivery.status,
            items: activeDelivery.items.map(item => ({
              name: item.menuItem?.name || item.bundle?.name || "Item",
              quantity: item.quantity,
              price: item.subtotal,
            })),
            totalAmount: parseFloat(activeDelivery.total),
            deliveryFee: activeDelivery.deliveryFee || "0",
            estimatedPickupTime: activeDelivery.estimatedPickupTime,
            estimatedDeliveryTime: activeDelivery.estimatedDeliveryTime,
          }}
          onStatusUpdate={(newStatus) => {
            if (newStatus === 'delivered') {
              setShowDeliveryProof(true);
            } else {
              updateStatusMutation.mutate({ 
                orderId: activeDelivery.id, 
                status: newStatus 
              });
            }
          }}
        />
      )}

      {/* Phase 2: Smart Batch Optimizer */}
      {isApproved && !activeDelivery && stats?.isAvailable && availableOrders && availableOrders.length >= 2 && (
        <div className="mb-4">
          <Button
            variant={showBatchOptimizer ? "default" : "outline"}
            onClick={() => setShowBatchOptimizer(!showBatchOptimizer)}
            className="w-full mb-3"
          >
            <Zap className="mr-2 h-4 w-4" />
            {showBatchOptimizer ? 'Hide' : 'Show'} Smart Batch Optimizer
            {!showBatchOptimizer && (
              <Badge variant="secondary" className="ml-2">
                {availableOrders.length} orders available
              </Badge>
            )}
          </Button>
          
          {showBatchOptimizer && (
            <BatchOptimizer
              orders={availableOrders.map(order => ({
                id: order.id,
                orderNumber: order.orderNumber,
                restaurantName: order.restaurant.name,
                restaurantAddress: order.restaurant.address,
                deliveryAddress: order.deliveryAddress,
                deliveryFee: order.deliveryFee,
                items: order.items || [],
                distance: driverLocation && order.restaurantLat && order.restaurantLng
                  ? calculateDistance(
                      driverLocation.lat,
                      driverLocation.lng,
                      parseFloat(order.restaurantLat),
                      parseFloat(order.restaurantLng)
                    )
                  : undefined,
              }))}
              driverLocation={driverLocation || undefined}
              onOptimized={(result) => {
                console.log('Optimized route:', result);
              }}
              onBatchAccepted={async (batchId, orderIds) => {
                // Accept all orders in the batch
                for (const orderId of orderIds) {
                  try {
                    await acceptOrderMutation.mutateAsync(orderId);
                  } catch (error) {
                    console.error('Failed to accept order:', orderId, error);
                  }
                }
                
                // Hide optimizer and refresh
                setShowBatchOptimizer(false);
                queryClient.invalidateQueries({ queryKey: ["/api/driver/active-delivery"] });
                queryClient.invalidateQueries({ queryKey: ["/api/driver/available-orders"] });
              }}
            />
          )}
        </div>
      )}

      {/* Clean Available Orders Section */}
      {isApproved && !activeDelivery && stats?.isAvailable && (
        <Card data-testid="card-available-orders">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Package className="h-5 w-5" />
                  Available Orders
                  {filteredOrders.length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {filteredOrders.length}
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="text-xs">
                  {sortBy === "distance" && "Sorted by distance"}
                  {sortBy === "earnings" && "Sorted by earnings (high to low)"}
                  {sortBy === "time" && "Sorted by time (newest first)"}
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="gap-2"
              >
                <Filter className="h-4 w-4" />
                {showFilters ? "Hide" : "Filters"}
              </Button>
            </div>

            {/* Collapsible Filters */}
            {showFilters && (
              <div className="flex gap-2 flex-wrap mt-4 pt-4 border-t">
                <Select value={sortBy} onValueChange={(v: "distance" | "earnings" | "time") => setSortBy(v)}>
                  <SelectTrigger className="w-[130px]">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="distance">Distance</SelectItem>
                    <SelectItem value="earnings">Earnings</SelectItem>
                    <SelectItem value="time">Time</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select value={filterByEarnings} onValueChange={setFilterByEarnings}>
                  <SelectTrigger className="w-[130px]">
                    <SelectValue placeholder="Min earnings" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="5">$5+</SelectItem>
                    <SelectItem value="10">$10+</SelectItem>
                    <SelectItem value="15">$15+</SelectItem>
                    <SelectItem value="20">$20+</SelectItem>
                  </SelectContent>
                </Select>

                {uniqueZones.length > 1 && (
                  <Select value={selectedZoneFilter} onValueChange={setSelectedZoneFilter}>
                    <SelectTrigger className="w-[150px]" data-testid="select-zone-filter">
                      <SelectValue placeholder="Zone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Zones</SelectItem>
                      {uniqueZones.map((zone: DeliveryZone) => (
                        <SelectItem key={zone.id} value={zone.id}>
                          {zone.city}{zone.neighborhood ? ` - ${zone.neighborhood}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
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
              <div className="space-y-3" data-testid="list-available-orders">
                {filteredOrders.map((order) => (
                  <div 
                    key={order.id} 
                    className="border rounded-lg p-4 hover:border-primary/50 hover:shadow-md transition-all bg-card"
                    data-testid={`card-order-${order.id}`}
                  >
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold truncate" data-testid={`text-order-number-${order.id}`}>
                            #{order.orderNumber}
                          </p>
                          <Badge variant="outline" className="text-xs flex-shrink-0">
                            {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground flex items-center gap-1 truncate" data-testid={`text-restaurant-${order.id}`}>
                          <Store className="h-3 w-3 flex-shrink-0" />
                          {order.restaurant.name}
                          {order.deliveryZone && (
                            <span className="text-xs">• {order.deliveryZone.city}</span>
                          )}
                        </p>
                      </div>
                      <Badge variant="default" className="text-base font-semibold px-3 py-1 flex-shrink-0" data-testid={`badge-earnings-${order.id}`}>
                        ${Number(order.estimatedEarnings).toFixed(2)}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3 p-2 bg-muted/30 rounded">
                      <MapPin className="h-3 w-3 flex-shrink-0" />
                      <span className="flex-1 truncate" data-testid={`text-delivery-address-${order.id}`}>
                        {order.deliveryAddress}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 flex-shrink-0"
                        onClick={() => openNavigation(order.deliveryAddress)}
                      >
                        <Navigation className="h-3 w-3" />
                      </Button>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => setPreviewOrder(order)}
                      >
                        <Eye className="h-3.5 w-3.5 mr-1.5" />
                        Details
                      </Button>
                      <Button
                        size="sm"
                        className="flex-[2]"
                        data-testid={`button-accept-order-${order.id}`}
                        onClick={() => acceptOrderMutation.mutate(order.id)}
                        disabled={acceptOrderMutation.isPending}
                      >
                        {acceptOrderMutation.isPending ? (
                          <>
                            <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white mr-1.5" />
                            Accepting...
                          </>
                        ) : (
                          <>
                            Accept ${Number(order.estimatedEarnings).toFixed(0)}
                            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
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
