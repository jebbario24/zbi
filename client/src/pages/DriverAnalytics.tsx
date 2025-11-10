import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  DollarSign, 
  TrendingUp, 
  Target, 
  Clock, 
  CheckCircle, 
  Award,
  Activity,
  Zap,
  MapPin,
  BarChart3
} from 'lucide-react';

export default function DriverAnalytics() {
  const { user } = useAuth();
  const period = 'week'; // Could be made dynamic with state

  // Fetch earnings summary
  const { data: earningsSummary, isLoading: loadingEarnings } = useQuery<any>({
    queryKey: [`/api/driver/analytics/earnings/summary?period=${period}`],
    enabled: !!user && user.role === 'driver',
  });

  // Fetch earnings trend
  const { data: earningsTrend } = useQuery<any>({
    queryKey: [`/api/driver/analytics/earnings/trend?period=${period}`],
    enabled: !!user && user.role === 'driver',
  });

  // Fetch performance summary
  const { data: performanceSummary, isLoading: loadingPerformance } = useQuery<any>({
    queryKey: [`/api/driver/analytics/performance/summary?period=${period}`],
    enabled: !!user && user.role === 'driver',
  });

  // Fetch best hours
  const { data: bestHours } = useQuery<any>({
    queryKey: [`/api/driver/analytics/insights/best-hours?limit=5`],
    enabled: !!user && user.role === 'driver',
  });

  // Fetch earnings forecast
  const { data: forecast } = useQuery<any>({
    queryKey: [`/api/driver/analytics/earnings/forecast?days=7`],
    enabled: !!user && user.role === 'driver',
  });

  // Fetch goals
  const { data: goals } = useQuery<any>({
    queryKey: ['/api/driver/goals'],
    enabled: !!user && user.role === 'driver',
  });

  const getDayName = (dayOfWeek: number) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[dayOfWeek];
  };

  const getTimeLabel = (hour: number) => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}${period}`;
  };

  if (loadingEarnings || loadingPerformance) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Analytics & Insights</h1>
        <p className="text-gray-600 mt-1">
          Track your performance and maximize your earnings
        </p>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 max-w-2xl">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="earnings">Earnings</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="goals">Goals</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Total Earnings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${earningsSummary?.totalEarnings?.toFixed(2) || '0.00'}
                </div>
                <p className="text-xs text-gray-600 mt-1">This {period}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Deliveries
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {earningsSummary?.deliveryCount || 0}
                </div>
                <p className="text-xs text-gray-600 mt-1">Completed</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Avg per Delivery
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${earningsSummary?.avgEarningsPerDelivery?.toFixed(2) || '0.00'}
                </div>
                <p className="text-xs text-gray-600 mt-1">Per order</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Acceptance Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {performanceSummary?.acceptanceRate?.toFixed(0) || 0}%
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  {performanceSummary?.acceptanceRate >= 80 ? '✅ Great!' : '⚠️ Aim for 80%+'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Earnings Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Earnings Breakdown</CardTitle>
              <CardDescription>Where your money comes from</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-blue-500"></div>
                    <span className="text-sm">Base Pay</span>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">
                      ${parseFloat(earningsSummary?.basePayAmount || '0').toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-600">
                      {earningsSummary?.totalEarnings > 0
                        ? ((parseFloat(earningsSummary?.basePayAmount || '0') / earningsSummary.totalEarnings) * 100).toFixed(0)
                        : 0}%
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-green-500"></div>
                    <span className="text-sm">Tips</span>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">
                      ${parseFloat(earningsSummary?.tipsAmount || '0').toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-600">
                      {earningsSummary?.totalEarnings > 0
                        ? ((parseFloat(earningsSummary?.tipsAmount || '0') / earningsSummary.totalEarnings) * 100).toFixed(0)
                        : 0}%
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-purple-500"></div>
                    <span className="text-sm">Bonuses</span>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">
                      ${parseFloat(earningsSummary?.bonusesAmount || '0').toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-600">
                      {earningsSummary?.totalEarnings > 0
                        ? ((parseFloat(earningsSummary?.bonusesAmount || '0') / earningsSummary.totalEarnings) * 100).toFixed(0)
                        : 0}%
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Best Hours */}
          {bestHours && bestHours.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-orange-500" />
                  Best Hours to Work
                </CardTitle>
                <CardDescription>Your top earning time slots</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {bestHours.map((slot: any, index: number) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Badge variant={index === 0 ? 'default' : 'secondary'}>
                          #{index + 1}
                        </Badge>
                        <div>
                          <div className="font-medium">
                            {getDayName(slot.dayOfWeek)} at {getTimeLabel(slot.hourOfDay)}
                          </div>
                          <div className="text-xs text-gray-600">
                            {slot.totalDeliveries} deliveries • {slot.sampleCount} times worked
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-green-600">
                          ${slot.avgEarningsPerHour.toFixed(2)}/hr
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Forecast */}
          {forecast && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-blue-500" />
                  7-Day Forecast
                </CardTitle>
                <CardDescription>Predicted earnings based on your history</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-3xl font-bold text-blue-600">
                      ${forecast.forecastEarnings?.toFixed(2) || '0.00'}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      Next 7 days • {forecast.confidenceLevel} confidence
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Based on {forecast.basedOnDays} days of data
                    </p>
                  </div>
                  <div className="text-6xl">📈</div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Earnings Tab */}
        <TabsContent value="earnings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Earnings Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-600">Total Distance</div>
                    <div className="text-xl font-semibold">
                      {earningsSummary?.totalDistanceKm?.toFixed(1) || '0.0'} km
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Earnings per KM</div>
                    <div className="text-xl font-semibold">
                      ${earningsSummary?.avgEarningsPerKm?.toFixed(2) || '0.00'}
                    </div>
                  </div>
                </div>

                {earningsTrend && earningsTrend.length > 0 && (
                  <div className="mt-6">
                    <h4 className="text-sm font-medium mb-3">Daily Breakdown</h4>
                    <div className="space-y-2">
                      {earningsTrend.map((day: any) => (
                        <div key={day.date} className="flex items-center justify-between p-2 border rounded">
                          <div className="text-sm">{day.date}</div>
                          <div className="flex items-center gap-4">
                            <div className="text-sm text-gray-600">{day.deliveryCount} orders</div>
                            <div className="font-semibold">${day.totalEarnings.toFixed(2)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">On-Time Delivery Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {performanceSummary?.onTimeRate?.toFixed(0) || 0}%
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  {performanceSummary?.totalDeliveries - performanceSummary?.lateDeliveries} on time,{' '}
                  {performanceSummary?.lateDeliveries} late
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Efficiency Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {performanceSummary?.efficiencyScore?.toFixed(1) || '0.0'}
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  Deliveries per hour worked
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Customer Rating</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {performanceSummary?.avgCustomerRating?.toFixed(1) || '0.0'} ⭐
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  Average customer rating
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Total Deliveries</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {performanceSummary?.totalDeliveries || 0}
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  This {period}
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Goals Tab */}
        <TabsContent value="goals" className="space-y-6">
          {goals && goals.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {goals.map((goal: any) => {
                const progress = goal.targetValue > 0 
                  ? (parseFloat(goal.currentValue) / parseFloat(goal.targetValue)) * 100 
                  : 0;
                const isCompleted = goal.status === 'completed';

                return (
                  <Card key={goal.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{goal.goalType.replace(/_/g, ' ').toUpperCase()}</CardTitle>
                        {isCompleted && <Award className="h-5 w-5 text-yellow-500" />}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Target</span>
                          <span className="font-semibold">{goal.targetValue}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Current</span>
                          <span className="font-semibold">{goal.currentValue}</span>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span>Progress</span>
                            <span>{Math.min(progress, 100).toFixed(0)}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${isCompleted ? 'bg-green-500' : 'bg-orange-500'}`}
                              style={{ width: `${Math.min(progress, 100)}%` }}
                            ></div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs text-gray-600">
                          <span>{goal.startDate}</span>
                          <span>{goal.endDate}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Target className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Goals Set</h3>
                <p className="text-gray-600 mb-4">
                  Set goals to track your progress and stay motivated
                </p>
                <Badge>Goal setting UI coming soon</Badge>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
