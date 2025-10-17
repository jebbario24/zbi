import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Store, Users, TrendingUp } from "lucide-react";

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
