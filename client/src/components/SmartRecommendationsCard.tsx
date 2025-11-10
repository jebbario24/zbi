/**
 * Smart Recommendations Card
 * 
 * Displays AI-powered actionable recommendations for drivers
 * Shows on driver dashboard to help maximize earnings
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { X, TrendingUp, MapPin, Package, Clock, Home, Zap } from 'lucide-react';
import { Link } from 'wouter';

interface Recommendation {
  id: string;
  recommendationType: string;
  priority: number;
  title: string;
  description: string;
  actionUrl: string | null;
  expiresAt: string;
  dismissedAt: string | null;
  actedUponAt: string | null;
  createdAt: string;
}

export function SmartRecommendationsCard() {
  const queryClient = useQueryClient();

  // Fetch recommendations
  const { data: recommendations = [], isLoading } = useQuery<Recommendation[]>({
    queryKey: ['/api/driver/ai/recommendations'],
    refetchInterval: 60000, // Refresh every minute
  });

  // Dismiss recommendation mutation
  const dismissMutation = useMutation({
    mutationFn: async (recommendationId: string) => {
      const response = await fetch(`/api/driver/ai/recommendations/${recommendationId}/dismiss`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to dismiss');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/driver/ai/recommendations'] });
    },
  });

  // Act on recommendation mutation
  const actMutation = useMutation({
    mutationFn: async (recommendationId: string) => {
      const response = await fetch(`/api/driver/ai/recommendations/${recommendationId}/act`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to act');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/driver/ai/recommendations'] });
    },
  });

  const handleDismiss = (recommendationId: string) => {
    dismissMutation.mutate(recommendationId);
  };

  const handleAction = (recommendationId: string, actionUrl: string | null) => {
    actMutation.mutate(recommendationId);
    if (actionUrl) {
      window.location.href = actionUrl;
    }
  };

  // Get icon for recommendation type
  const getIcon = (type: string) => {
    switch (type) {
      case 'work_now':
        return <Zap className="h-5 w-5 text-orange-500" />;
      case 'best_zone':
        return <MapPin className="h-5 w-5 text-blue-500" />;
      case 'batch':
        return <Package className="h-5 w-5 text-purple-500" />;
      case 'peak_incoming':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case 'go_home':
        return <Home className="h-5 w-5 text-gray-500" />;
      default:
        return <TrendingUp className="h-5 w-5 text-green-500" />;
    }
  };

  // Get priority badge color
  const getPriorityColor = (priority: number) => {
    if (priority >= 5) return 'bg-red-500';
    if (priority >= 4) return 'bg-orange-500';
    if (priority >= 3) return 'bg-yellow-500';
    return 'bg-blue-500';
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Smart Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground">Loading recommendations...</div>
        </CardContent>
      </Card>
    );
  }

  if (recommendations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Smart Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground">
            No recommendations right now. Check back soon!
          </div>
        </CardContent>
      </Card>
    );
  }

  // Sort by priority (highest first)
  const sortedRecs = [...recommendations].sort((a, b) => b.priority - a.priority);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Smart Recommendations
          <Badge variant="secondary" className="ml-auto">
            {recommendations.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {sortedRecs.map((rec) => (
          <Alert key={rec.id} className="relative pr-12">
            <div className="flex items-start gap-3">
              {getIcon(rec.recommendationType)}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <div className="font-semibold">{rec.title}</div>
                  <Badge className={`${getPriorityColor(rec.priority)} text-white text-xs`}>
                    Priority {rec.priority}
                  </Badge>
                </div>
                <AlertDescription className="text-sm">{rec.description}</AlertDescription>

                {rec.actionUrl && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    onClick={() => handleAction(rec.id, rec.actionUrl)}
                  >
                    Take Action
                  </Button>
                )}
              </div>
            </div>

            {/* Dismiss button */}
            <Button
              size="sm"
              variant="ghost"
              className="absolute top-2 right-2 h-8 w-8 p-0"
              onClick={() => handleDismiss(rec.id)}
            >
              <X className="h-4 w-4" />
            </Button>
          </Alert>
        ))}

        <div className="text-xs text-center text-muted-foreground mt-4">
          <Link href="/driver/analytics">
            <a className="hover:underline">View AI Insights →</a>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
