import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Store, Users, TrendingUp, CreditCard, MessageSquare, ArrowRight, Clock, CheckCircle, Truck, Navigation } from "lucide-react";
import { Link } from "wouter";
import { useEffect } from "react";
import { queryClient } from "@/lib/queryClient";

interface AdminAnalytics {
  totalRestaurants: number;
  activeSubscriptions: number;
  activeTrials: number;
  mrr: number;
  commissionRevenue: number;
  recentSignups: any[];
}

interface DriverActivity {
  totalDrivers: number;
  onlineDrivers: number;
  approvedDrivers: number;
  pendingDrivers: number;
  activeDeliveries: Array<{
    orderId: string;
    orderNumber: string;
    restaurantName: string;
    driverName: string;
    driverPhone: string;
    customerName: string;
    customerAddress: string;
    deliveryStatus: string;
    orderTotal: string;
    deliveryFee: string;
    assignedAt: Date;
    lastUpdatedAt: Date;
  }>;
  todaysDeliveries: number;
  todaysEarnings: string;
}

export default function AdminDashboard() {
  const { data: analytics, isLoading } = useQuery<AdminAnalytics>({
    queryKey: ['/api/admin/analytics'],
  });

  const { data: allPayouts = [] } = useQuery({
    queryKey: ['/api/admin/payouts'],
    queryFn: async () => fetch('/api/admin/payouts').then(res => res.json()),
  });

  const { data: allReviews = [] } = useQuery({
    queryKey: ['/api/admin/reviews'],
    queryFn: async () => fetch('/api/admin/reviews').then(res => res.json()),
  });

  const { data: driverActivity } = useQuery<DriverActivity>({
    queryKey: ['/api/admin/drivers/activity'],
  });

  // WebSocket integration for real-time driver updates
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

    ws.onopen = () => {
      console.log('WebSocket connected for admin driver monitoring');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'delivery_update') {
          // Invalidate driver activity query to refresh data
          queryClient.invalidateQueries({ queryKey: ['/api/admin/drivers/activity'] });
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
    };

    return () => {
      ws.close();
    };
  }, []);

  const payoutStats = {
    total: allPayouts.length,
    pending: allPayouts.filter((p: any) => p.status === 'pending').length,
    failed: allPayouts.filter((p: any) => p.status === 'failed').length,
  };

  const reviewStats = {
    total: allReviews.length,
    pending: allReviews.filter((r: any) => !r.isPublished).length,
    avgRating: allReviews.length > 0
      ? (allReviews.reduce((sum: number, r: any) => sum + r.rating, 0) / allReviews.length).toFixed(1)
      : '0.0',
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-muted-foreground">Loading analytics...</div>
      </div>
    );
  }

  const stats = [
    {
      title: "Total Restaurants",
      value: analytics?.totalRestaurants || 0,
      icon: Store,
      description: "Registered on platform"
    },
    {
      title: "Active Subscriptions",
      value: analytics?.activeSubscriptions || 0,
      icon: Users,
      description: "Paying customers"
    },
    {
      title: "Active Trials",
      value: analytics?.activeTrials || 0,
      icon: TrendingUp,
      description: "In trial period"
    },
    {
      title: "Monthly Recurring Revenue",
      value: `$${analytics?.mrr || 0}`,
      icon: DollarSign,
      description: "From subscriptions"
    }
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Platform Admin Dashboard</h1>
        <p className="text-muted-foreground">Monitor your EatOut platform performance</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} data-testid={`card-${stat.title.toLowerCase().replace(/\s+/g, '-')}`}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid={`text-${stat.title.toLowerCase().replace(/\s+/g, '-')}-value`}>
                  {stat.value}
                </div>
                <p className="text-xs text-muted-foreground">{stat.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0">
            <div>
              <CardTitle>Payout Management</CardTitle>
              <CardDescription>Monitor restaurant payouts across the platform</CardDescription>
            </div>
            <CreditCard className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-2xl font-bold" data-testid="dashboard-stat-total-payouts">
                  {payoutStats.total}
                </div>
                <p className="text-xs text-muted-foreground">Total Runs</p>
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-600" data-testid="dashboard-stat-pending-payouts">
                  {payoutStats.pending}
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />Pending
                </p>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-600" data-testid="dashboard-stat-failed-payouts">
                  {payoutStats.failed}
                </div>
                <p className="text-xs text-muted-foreground">Failed</p>
              </div>
            </div>
            <Link href="/admin/payouts">
              <Button variant="outline" className="w-full" data-testid="button-view-all-payouts">
                View All Payouts
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0">
            <div>
              <CardTitle>Content Moderation</CardTitle>
              <CardDescription>Customer reviews across all restaurants</CardDescription>
            </div>
            <MessageSquare className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-2xl font-bold" data-testid="dashboard-stat-total-reviews">
                  {reviewStats.total}
                </div>
                <p className="text-xs text-muted-foreground">Total Reviews</p>
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-600" data-testid="dashboard-stat-hidden-reviews">
                  {reviewStats.pending}
                </div>
                <p className="text-xs text-muted-foreground">Hidden</p>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600" data-testid="dashboard-stat-avg-rating">
                  {reviewStats.avgRating}★
                </div>
                <p className="text-xs text-muted-foreground">Avg Rating</p>
              </div>
            </div>
            <Link href="/admin/moderation">
              <Button variant="outline" className="w-full" data-testid="button-view-all-reviews">
                View All Reviews
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0">
          <div>
            <CardTitle>Driver Activity</CardTitle>
            <CardDescription>Real-time driver monitoring across the platform</CardDescription>
          </div>
          <Truck className="h-5 w-5 text-muted-foreground" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-2xl font-bold" data-testid="dashboard-stat-total-drivers">
                {driverActivity?.totalDrivers || 0}
              </div>
              <p className="text-xs text-muted-foreground">Total Drivers</p>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600" data-testid="dashboard-stat-online-drivers">
                {driverActivity?.onlineDrivers || 0}
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Navigation className="h-3 w-3" />Online
              </p>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600" data-testid="dashboard-stat-active-deliveries">
                {driverActivity?.activeDeliveries.length || 0}
              </div>
              <p className="text-xs text-muted-foreground">Active Deliveries</p>
            </div>
          </div>

          {driverActivity?.activeDeliveries && driverActivity.activeDeliveries.length > 0 ? (
            <div className="space-y-2">
              <div className="text-sm font-medium">Current Deliveries</div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {driverActivity.activeDeliveries.slice(0, 5).map((delivery) => (
                  <div
                    key={delivery.orderId}
                    className="flex items-center justify-between p-3 border rounded-md hover-elevate"
                    data-testid={`row-delivery-${delivery.orderId}`}
                  >
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm" data-testid={`text-order-number-${delivery.orderId}`}>
                          {delivery.orderNumber}
                        </span>
                        <Badge 
                          variant={
                            delivery.deliveryStatus === 'picked_up' ? 'default' :
                            delivery.deliveryStatus === 'en_route_to_customer' ? 'default' :
                            delivery.deliveryStatus === 'arrived_at_restaurant' ? 'secondary' :
                            'outline'
                          }
                          className="text-xs"
                          data-testid={`badge-status-${delivery.orderId}`}
                        >
                          {delivery.deliveryStatus.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {delivery.restaurantName} → {delivery.customerName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Driver: {delivery.driverName}
                      </div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground ml-2">
                      <div className="font-medium">${delivery.orderTotal}</div>
                      <div>{new Date(delivery.assignedAt).toLocaleTimeString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No active deliveries at the moment
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 pt-2 border-t">
            <div>
              <div className="text-lg font-bold" data-testid="dashboard-stat-todays-deliveries">
                {driverActivity?.todaysDeliveries || 0}
              </div>
              <p className="text-xs text-muted-foreground">Today's Deliveries</p>
            </div>
            <div>
              <div className="text-lg font-bold" data-testid="dashboard-stat-todays-earnings">
                ${parseFloat(driverActivity?.todaysEarnings || '0').toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">Today's Earnings</p>
            </div>
          </div>

          <Link href="/admin/drivers">
            <Button variant="outline" className="w-full" data-testid="button-view-all-drivers">
              View All Drivers
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Restaurant Signups</CardTitle>
          <CardDescription>Latest restaurants to join the platform</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {analytics?.recentSignups && analytics.recentSignups.length > 0 ? (
              analytics.recentSignups.map((restaurant: any) => (
                <div key={restaurant.id} className="flex items-center justify-between border-b pb-3 last:border-0" data-testid={`row-restaurant-${restaurant.id}`}>
                  <div>
                    <p className="font-medium" data-testid={`text-restaurant-name-${restaurant.id}`}>{restaurant.name}</p>
                    <p className="text-sm text-muted-foreground">{restaurant.email}</p>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {new Date(restaurant.createdAt).toLocaleDateString()}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No restaurants yet
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
