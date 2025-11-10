/**
 * Redesigned Driver Dashboard - User-Friendly & Modern
 * 
 * Key Improvements:
 * - Clean hero section with prominent availability toggle
 * - Visual stats cards with progress indicators
 * - Scannable order cards with quick actions
 * - AI recommendations highlighted
 * - Better mobile responsiveness
 * - Reduced cognitive load
 */

import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { 
  DollarSign, 
  CheckCircle, 
  AlertCircle, 
  Package,
  Clock,
  MapPin,
  TrendingUp,
  Store,
  Navigation,
  Phone,
  Zap,
  Target,
  ArrowRight,
  Star,
  TrendingDown,
  RefreshCw,
  Filter,
  X as CloseIcon
} from "lucide-react";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { SmartRecommendationsCard } from "@/components/SmartRecommendationsCard";
import { LiveDeliveryTracker } from "@/components/delivery/LiveDeliveryTracker";
import { calculateDistance, formatDistance } from "@/utils/location";

interface DriverStats {
  totalDeliveries: number;
  totalEarnings: number;
  weeklyEarnings: number;
  acceptanceRate: number;
  isAvailable: boolean;
}

interface Order {
  id: string;
  orderNumber: string;
  restaurant: {
    id: string;
    name: string;
    address: string;
    phone: string;
  };
  deliveryAddress: string;
  deliveryFee: string;
  restaurantLat?: string;
  restaurantLng?: string;
  deliveryLat?: string;
  deliveryLng?: string;
  customerName: string | null;
  customerPhone: string | null;
  items: any[];
  total: string;
  status: string;
  createdAt: string;
}

export default function DriverDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<"distance" | "earnings" | "time">("earnings");

  // Fetch driver stats
  const { data: stats, isLoading: statsLoading } = useQuery<DriverStats>({
    queryKey: ["/api/driver/stats"],
    refetchInterval: 30000,
  });

  // Fetch available orders
  const { data: availableOrders = [], isLoading: ordersLoading } = useQuery<Order[]>({
    queryKey: ["/api/driver/available-orders"],
    refetchInterval: 15000,
  });

  // Fetch active delivery
  const { data: activeDelivery } = useQuery<Order | null>({
    queryKey: ["/api/driver/active-delivery"],
    refetchInterval: 10000,
  });

  // Get driver location for distance calculations
  const { data: driverLocation } = useQuery<{ lat: number; lng: number }>({
    queryKey: ["/api/driver/location"],
  });

  // Toggle availability mutation
  const toggleAvailabilityMutation = useMutation({
    mutationFn: async (isAvailable: boolean) => {
      await apiRequest("POST", "/api/driver/availability", {
        isAvailable,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver/stats"] });
      toast({
        title: stats?.isAvailable ? "You're now offline" : "You're now online!",
        description: stats?.isAvailable 
          ? "You won't receive new orders" 
          : "You can now accept deliveries",
      });
    },
  });

  // Accept order mutation
  const acceptOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      await apiRequest("POST", `/api/driver/orders/${orderId}/accept`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver/available-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/driver/active-delivery"] });
      toast({
        title: "Order Accepted!",
        description: "Navigate to the restaurant to pick up the order",
      });
    },
    onError: () => {
      toast({
        title: "Failed to accept order",
        description: "Please try again",
        variant: "destructive",
      });
    },
  });

  // Sort orders
  const sortedOrders = useMemo(() => {
    if (!availableOrders || availableOrders.length === 0) return [];
    
    return [...availableOrders].sort((a, b) => {
      if (sortBy === "distance" && driverLocation && a.restaurantLat && b.restaurantLat) {
        const distA = calculateDistance(
          driverLocation.lat,
          driverLocation.lng,
          parseFloat(a.restaurantLat),
          parseFloat(a.restaurantLng)
        );
        const distB = calculateDistance(
          driverLocation.lat,
          driverLocation.lng,
          parseFloat(b.restaurantLat),
          parseFloat(b.restaurantLng)
        );
        return distA - distB;
      }
      if (sortBy === "earnings") {
        return parseFloat(b.deliveryFee) - parseFloat(a.deliveryFee);
      }
      if (sortBy === "time") {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      return 0;
    });
  }, [availableOrders, sortBy, driverLocation]);

  // Calculate weekly progress (out of $500 goal)
  const weeklyGoal = 500;
  const weeklyProgress = stats?.weeklyEarnings ? Math.min((stats.weeklyEarnings / weeklyGoal) * 100, 100) : 0;

  // Check if profile is complete (simplified)
  const isApproved = user?.role === 'driver';

  if (statsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header - Simplified */}
      <header className="bg-white border-b sticky top-0 z-40 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Driver Portal</h1>
              <p className="text-sm text-muted-foreground">Welcome back, {user?.firstName || 'Driver'}!</p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={stats?.isAvailable ? "default" : "secondary"} className="hidden md:inline-flex">
                {stats?.isAvailable ? "🟢 Online" : "⚫ Offline"}
              </Badge>
              <Link href="/driver/analytics">
                <Button variant="ghost" size="sm">
                  <Target className="h-4 w-4 mr-2" />
                  Analytics
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 space-y-6 max-w-7xl">
        
        {/* Hero Card - Availability Toggle */}
        <Card className={`border-2 ${stats?.isAvailable ? 'border-green-500 bg-gradient-to-r from-green-50 to-emerald-50' : 'border-gray-300 bg-gray-50'}`}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <div className={`h-4 w-4 rounded-full ${stats?.isAvailable ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
                  <h2 className="text-2xl font-bold">
                    {stats?.isAvailable ? "You're Online" : "You're Offline"}
                  </h2>
                </div>
                <p className="text-muted-foreground">
                  {stats?.isAvailable 
                    ? "Ready to accept deliveries and earn money" 
                    : "Turn on to start receiving orders"}
                </p>
                {stats?.weeklyEarnings !== undefined && stats.weeklyEarnings > 0 && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-muted-foreground">Weekly Goal Progress</span>
                      <span className="font-semibold">${stats.weeklyEarnings.toFixed(2)} / ${weeklyGoal}</span>
                    </div>
                    <Progress value={weeklyProgress} className="h-2" />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-4">
                <Switch
                  checked={stats?.isAvailable || false}
                  onCheckedChange={(checked) => toggleAvailabilityMutation.mutate(checked)}
                  className="data-[state=checked]:bg-green-500 scale-150"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid - Visual & Engaging */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Weekly Earnings */}
            <Card className="relative overflow-hidden hover:shadow-lg transition-shadow">
              <div className="absolute top-0 right-0 text-9xl opacity-5">💰</div>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  This Week
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">
                  ${stats.weeklyEarnings.toFixed(2)}
                </div>
                <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
                  <TrendingUp className="h-3 w-3" />
                  12% vs last week
                </p>
              </CardContent>
            </Card>

            {/* Total Deliveries */}
            <Card className="relative overflow-hidden hover:shadow-lg transition-shadow">
              <div className="absolute top-0 right-0 text-9xl opacity-5">📦</div>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Deliveries
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.totalDeliveries}</div>
                <p className="text-xs text-muted-foreground mt-1">All time</p>
              </CardContent>
            </Card>

            {/* Acceptance Rate */}
            <Card className="relative overflow-hidden hover:shadow-lg transition-shadow">
              <div className="absolute top-0 right-0 text-9xl opacity-5">✅</div>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Acceptance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.acceptanceRate}%</div>
                <Progress value={stats.acceptanceRate} className="mt-2 h-1" />
              </CardContent>
            </Card>

            {/* Total Earnings */}
            <Card className="relative overflow-hidden hover:shadow-lg transition-shadow">
              <div className="absolute top-0 right-0 text-9xl opacity-5">🏆</div>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Star className="h-4 w-4" />
                  Lifetime
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">${stats.totalEarnings.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground mt-1">Total earned</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Active Delivery Section */}
        {isApproved && activeDelivery && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Zap className="h-5 w-5 text-orange-500" />
                Active Delivery
              </h2>
              <Badge className="bg-orange-500 text-white">In Progress</Badge>
            </div>
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
                estimatedPickupTime: null,
                estimatedDeliveryTime: null,
              }}
              onStatusUpdate={(status) => console.log('Status:', status)}
            />
          </div>
        )}

        {/* Smart Recommendations - Highlighted */}
        {isApproved && !activeDelivery && (
          <div className="relative">
            <div className="absolute -top-3 -right-3 z-10">
              <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg">
                <Zap className="h-3 w-3 mr-1" />
                AI Powered
              </Badge>
            </div>
            <SmartRecommendationsCard />
          </div>
        )}

        {/* Available Orders Section */}
        {isApproved && !activeDelivery && stats?.isAvailable && (
          <div className="space-y-4">
            {/* Section Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Available Orders
                  {sortedOrders.length > 0 && (
                    <Badge variant="secondary">{sortedOrders.length}</Badge>
                  )}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {sortBy === "distance" && "Sorted by distance"}
                  {sortBy === "earnings" && "Sorted by highest earnings"}
                  {sortBy === "time" && "Sorted by newest first"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Sort
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/driver/available-orders"] })}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Sort Options */}
            {showFilters && (
              <Card className="border-orange-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Sort By</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowFilters(false)}
                    >
                      <CloseIcon className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={sortBy === "earnings" ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setSortBy("earnings");
                        setShowFilters(false);
                      }}
                    >
                      <DollarSign className="h-4 w-4 mr-1" />
                      Highest Earnings
                    </Button>
                    <Button
                      variant={sortBy === "distance" ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setSortBy("distance");
                        setShowFilters(false);
                      }}
                    >
                      <MapPin className="h-4 w-4 mr-1" />
                      Closest
                    </Button>
                    <Button
                      variant={sortBy === "time" ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setSortBy("time");
                        setShowFilters(false);
                      }}
                    >
                      <Clock className="h-4 w-4 mr-1" />
                      Newest
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Orders List - Enhanced Cards */}
            {ordersLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto"></div>
                <p className="mt-2 text-sm text-muted-foreground">Loading orders...</p>
              </div>
            ) : sortedOrders.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <div className="bg-gray-100 rounded-full w-24 h-24 mx-auto flex items-center justify-center mb-4">
                    <Package className="h-12 w-12 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">No Orders Available</h3>
                  <p className="text-muted-foreground mb-4">
                    Check back soon for new delivery opportunities
                  </p>
                  <div className="flex gap-2 justify-center">
                    <Button
                      variant="outline"
                      onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/driver/available-orders"] })}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Refresh
                    </Button>
                    <Link href="/driver/analytics">
                      <Button variant="outline">
                        <Target className="h-4 w-4 mr-2" />
                        View Analytics
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sortedOrders.map((order) => {
                  const distance = driverLocation && order.restaurantLat && order.restaurantLng
                    ? calculateDistance(
                        driverLocation.lat,
                        driverLocation.lng,
                        parseFloat(order.restaurantLat),
                        parseFloat(order.restaurantLng)
                      )
                    : null;

                  return (
                    <Card
                      key={order.id}
                      className="hover:shadow-lg transition-all duration-200 hover:scale-[1.02] cursor-pointer"
                    >
                      <CardContent className="p-5">
                        {/* Header */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="bg-orange-100 p-3 rounded-full">
                              <Store className="h-6 w-6 text-orange-600" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-lg">{order.restaurant.name}</h3>
                              {distance && (
                                <p className="text-sm text-muted-foreground flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {formatDistance(distance)} away
                                </p>
                              )}
                            </div>
                          </div>
                          <Badge className="bg-green-100 text-green-800 font-bold text-lg">
                            ${parseFloat(order.deliveryFee).toFixed(2)}
                          </Badge>
                        </div>

                        <Separator className="my-3" />

                        {/* Details */}
                        <div className="space-y-2 mb-4">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Package className="h-4 w-4" />
                            <span>{order.items?.length || 0} items</span>
                            <span className="mx-1">•</span>
                            <span>Order #{order.orderNumber}</span>
                          </div>
                          <div className="flex items-start gap-2 text-sm">
                            <Navigation className="h-4 w-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
                            <span className="text-muted-foreground line-clamp-1">
                              {order.deliveryAddress}
                            </span>
                          </div>
                        </div>

                        {/* Action Button */}
                        <Button
                          className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold"
                          size="lg"
                          onClick={() => acceptOrderMutation.mutate(order.id)}
                          disabled={acceptOrderMutation.isPending}
                        >
                          {acceptOrderMutation.isPending ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Accepting...
                            </>
                          ) : (
                            <>
                              Accept Order
                              <ArrowRight className="ml-2 h-4 w-4" />
                            </>
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Offline/Not Approved States */}
        {!isApproved && (
          <Card>
            <CardContent className="py-12 text-center">
              <AlertCircle className="h-12 w-12 mx-auto text-orange-500 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Complete Your Profile</h3>
              <p className="text-muted-foreground mb-4">
                Finish setting up your driver profile to start accepting orders
              </p>
              <Link href="/driver/settings">
                <Button>
                  Complete Profile
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

      </main>
    </div>
  );
}
