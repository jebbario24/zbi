/**
 * AI Insights Tab Component
 * 
 * Displays driver behavior analysis and personalized insights
 * Part of the Driver Analytics page
 */

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Zap,
  MapPin,
  Clock,
  Target,
  Award,
  AlertCircle,
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

interface Insight {
  category: string;
  insight: string;
  impact: 'positive' | 'neutral' | 'negative';
  actionable: boolean;
}

interface SpeedData {
  speedScore: number;
  avgMinutesPerDelivery: number;
  comparison: string;
}

interface Zone {
  zone: string;
  deliveryCount: number;
  avgEarnings: number;
  efficiency: number;
}

interface PerformanceTime {
  hour: number;
  deliveryCount: number;
  avgEarnings: number;
  speedScore: number;
}

export function AIInsightsTab() {
  // Fetch insights
  const { data: insights = [], isLoading: insightsLoading } = useQuery<Insight[]>({
    queryKey: ['/api/driver/ai/insights/behavior'],
  });

  // Fetch speed score
  const { data: speedData, isLoading: speedLoading } = useQuery<SpeedData>({
    queryKey: ['/api/driver/ai/insights/speed-score'],
  });

  // Fetch zone mastery
  const { data: zones = [], isLoading: zonesLoading } = useQuery<Zone[]>({
    queryKey: ['/api/driver/ai/insights/zone-mastery'],
  });

  // Fetch best performance times
  const { data: bestTimes = [], isLoading: timesLoading } = useQuery<PerformanceTime[]>({
    queryKey: ['/api/driver/ai/insights/best-times'],
  });

  const isLoading = insightsLoading || speedLoading || zonesLoading || timesLoading;

  const formatHour = (hour: number): string => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:00 ${period}`;
  };

  const getImpactIcon = (impact: string) => {
    if (impact === 'positive') return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (impact === 'negative') return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-gray-500" />;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="text-center py-8 text-muted-foreground">Loading AI insights...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">🤖 AI Insights</h2>
        <p className="text-muted-foreground">
          Personalized recommendations based on your driving patterns
        </p>
      </div>

      {/* Speed Score Card */}
      {speedData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Speed Score
            </CardTitle>
            <CardDescription>Your delivery speed compared to platform average</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-4xl font-bold">{speedData.speedScore}</div>
                <Badge variant={speedData.speedScore > 100 ? 'default' : 'secondary'}>
                  {speedData.comparison}
                </Badge>
              </div>
              <Progress value={Math.min(speedData.speedScore, 150)} className="h-2" />
              <div className="text-sm text-muted-foreground">
                Average time per delivery: <span className="font-semibold">{speedData.avgMinutesPerDelivery} minutes</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Insights List */}
      {insights.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Personalized Insights
            </CardTitle>
            <CardDescription>AI-identified patterns from your delivery history</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {insights.map((insight, index) => (
              <Alert key={index}>
                <div className="flex items-start gap-3">
                  {getImpactIcon(insight.impact)}
                  <div className="flex-1">
                    <div className="font-semibold text-sm mb-1">{insight.category}</div>
                    <AlertDescription className="text-sm">{insight.insight}</AlertDescription>
                    {insight.actionable && (
                      <Badge variant="outline" className="mt-2 text-xs">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Actionable
                      </Badge>
                    )}
                  </div>
                </div>
              </Alert>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Zone Mastery */}
      {zones.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Zone Mastery
            </CardTitle>
            <CardDescription>Your most profitable delivery areas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {zones.map((zone, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-muted rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">#{index + 1}</Badge>
                    <div>
                      <div className="font-semibold text-sm">Zone {zone.zone}</div>
                      <div className="text-xs text-muted-foreground">
                        {zone.deliveryCount} deliveries
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-green-600">${zone.efficiency.toFixed(2)}/hr</div>
                    <div className="text-xs text-muted-foreground">
                      ${zone.avgEarnings.toFixed(2)} avg
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Best Performance Times */}
      {bestTimes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Best Performance Times
            </CardTitle>
            <CardDescription>Hours when you deliver fastest and earn most</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {bestTimes.slice(0, 5).map((time, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 hover:bg-muted rounded"
                >
                  <div className="flex items-center gap-3">
                    <Award className={`h-4 w-4 ${index === 0 ? 'text-yellow-500' : 'text-gray-400'}`} />
                    <div className="font-medium">{formatHour(time.hour)}</div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-sm">
                      <span className="text-muted-foreground">${time.avgEarnings.toFixed(2)}</span>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {time.deliveryCount} deliveries
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {insights.length === 0 && zones.length === 0 && bestTimes.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <Target className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p className="font-semibold mb-2">Not enough data yet</p>
              <p className="text-sm">
                Complete more deliveries to unlock personalized AI insights about your driving patterns.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
