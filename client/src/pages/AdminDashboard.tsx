import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DollarSign, Store, Users, TrendingUp, CreditCard, MessageSquare, ArrowRight, Clock, CheckCircle } from "lucide-react";
import { Link } from "wouter";

interface AdminAnalytics {
  totalRestaurants: number;
  activeSubscriptions: number;
  activeTrials: number;
  mrr: number;
  commissionRevenue: number;
  recentSignups: any[];
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
