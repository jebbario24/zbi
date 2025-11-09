import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, Calendar, Wallet, BarChart3, Target, Zap } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface DriverEarnings {
  today: string;
  week: string;
  month: string;
  allTime: string;
  pendingPayouts: string;
  completedPayouts: string;
  dailyBreakdown?: Array<{ date: string; earnings: string; deliveries: number }>;
  weeklyBreakdown?: Array<{ week: string; earnings: string; deliveries: number }>;
  performance?: {
    avgEarningsPerDelivery: string;
    avgEarningsPerHour: string;
    totalDeliveries: number;
    totalHours: number;
    bestDay: string;
    bestDayEarnings: string;
  };
}

export default function DriverEarnings() {
  const { data: earnings, isLoading } = useQuery<DriverEarnings>({
    queryKey: ['/api/driver/earnings'],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <DollarSign className="h-8 w-8" />
          Earnings
        </h1>
        <p className="text-muted-foreground">
          Track your delivery earnings and payouts
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card data-testid="card-today-earnings">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Earnings</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="stat-today-earnings">
              ${Number(earnings?.today || 0).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">Current day</p>
          </CardContent>
        </Card>

        <Card data-testid="card-week-earnings">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Week</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-week-earnings">
              ${Number(earnings?.week || 0).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">Last 7 days</p>
          </CardContent>
        </Card>

        <Card data-testid="card-month-earnings">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-month-earnings">
              ${Number(earnings?.month || 0).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">Current month</p>
          </CardContent>
        </Card>

        <Card data-testid="card-total-earnings">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">All Time Earnings</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary" data-testid="stat-all-time-earnings">
              ${Number(earnings?.allTime || 0).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">Total earned</p>
          </CardContent>
        </Card>

        <Card data-testid="card-pending-payouts">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Payouts</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600" data-testid="stat-pending-payouts">
              ${Number(earnings?.pendingPayouts || 0).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">Awaiting transfer</p>
          </CardContent>
        </Card>

        <Card data-testid="card-completed-payouts">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Payouts</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-completed-payouts">
              ${Number(earnings?.completedPayouts || 0).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">Successfully paid</p>
          </CardContent>
        </Card>
      </div>

      {/* Performance Metrics */}
      {earnings?.performance && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg per Delivery</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${Number(earnings.performance.avgEarningsPerDelivery || 0).toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">
                {earnings.performance.totalDeliveries} deliveries
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg per Hour</CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${Number(earnings.performance.avgEarningsPerHour || 0).toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">
                {earnings.performance.totalHours || 0} hours worked
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Best Day</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                ${Number(earnings.performance.bestDayEarnings || 0).toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">
                {earnings.performance.bestDay || "N/A"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Deliveries</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {earnings.performance.totalDeliveries || 0}
              </div>
              <p className="text-xs text-muted-foreground">All time</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Analytics Charts */}
      <Tabs defaultValue="daily" className="w-full">
        <TabsList>
          <TabsTrigger value="daily">Daily Breakdown</TabsTrigger>
          <TabsTrigger value="weekly">Weekly Breakdown</TabsTrigger>
        </TabsList>
        
        <TabsContent value="daily" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Daily Earnings Trend</CardTitle>
              <CardDescription>Your earnings over the last 7 days</CardDescription>
            </CardHeader>
            <CardContent>
              {earnings?.dailyBreakdown && earnings.dailyBreakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={earnings.dailyBreakdown.map(d => ({
                    date: new Date(d.date).toLocaleDateString('en-US', { weekday: 'short' }),
                    earnings: Number(d.earnings),
                    deliveries: d.deliveries,
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="earnings" stroke="#22c55e" strokeWidth={2} name="Earnings ($)" />
                    <Line type="monotone" dataKey="deliveries" stroke="#3b82f6" strokeWidth={2} name="Deliveries" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  No data available yet. Start delivering to see your earnings trend!
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="weekly" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Weekly Earnings Trend</CardTitle>
              <CardDescription>Your earnings over the last 4 weeks</CardDescription>
            </CardHeader>
            <CardContent>
              {earnings?.weeklyBreakdown && earnings.weeklyBreakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={earnings.weeklyBreakdown.map(w => ({
                    week: w.week,
                    earnings: Number(w.earnings),
                    deliveries: w.deliveries,
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="week" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="earnings" fill="#22c55e" name="Earnings ($)" />
                    <Bar dataKey="deliveries" fill="#3b82f6" name="Deliveries" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  No data available yet. Start delivering to see your weekly trends!
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>Earnings Breakdown</CardTitle>
          <CardDescription>
            Your earnings are calculated as 80% of the delivery fee for each completed order
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• Earnings are updated in real-time as you complete deliveries</p>
          <p>• Payouts are processed automatically once you reach the minimum threshold of $10</p>
          <p>• Funds are typically transferred to your account within 2-3 business days</p>
          <p>• Track your performance metrics to optimize your delivery strategy</p>
        </CardContent>
      </Card>
    </div>
  );
}
