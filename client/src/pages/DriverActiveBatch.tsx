import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import {
  Package,
  MapPin,
  Phone,
  MessageSquare,
  Navigation,
  CheckCircle2,
  Clock,
  DollarSign,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface Stop {
  id: string;
  stopType: string;
  stopNumber: number;
  orderId: string;
  lat: string;
  lng: string;
  address: string;
  contactName: string;
  contactPhone: string;
  instructions?: string;
  status: string;
  estimatedArrivalTime?: string;
  completedAt?: string;
}

interface Batch {
  id: string;
  orderCount: number;
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  estimatedEarnings: string;
  batchStatus: string;
  stops: Stop[];
}

export default function DriverActiveBatch() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [batch, setBatch] = useState<Batch | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentStopIndex, setCurrentStopIndex] = useState(0);
  const [completingStop, setCompletingStop] = useState(false);
  const [expandedStops, setExpandedStops] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchActiveBatch();
    const interval = setInterval(fetchActiveBatch, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const fetchActiveBatch = async () => {
    try {
      const res = await fetch('/api/driver/batch/active', {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        if (data) {
          setBatch(data);
          // Find current stop (first pending/in_progress)
          const currentIndex = data.stops.findIndex(
            (s: Stop) => s.status === 'pending' || s.status === 'in_progress'
          );
          if (currentIndex >= 0) {
            setCurrentStopIndex(currentIndex);
          }
        } else {
          setBatch(null);
        }
      }
    } catch (error) {
      console.error('Error fetching active batch:', error);
    } finally {
      setLoading(false);
    }
  };

  const startBatch = async () => {
    if (!batch) return;

    try {
      const res = await fetch(`/api/driver/batch/${batch.id}/start`, {
        method: 'POST',
        credentials: 'include',
      });

      if (res.ok) {
        toast({
          title: 'Batch Started',
          description: 'Begin your first stop!',
        });
        await fetchActiveBatch();
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to start batch',
        variant: 'destructive',
      });
    }
  };

  const completeStop = async (stopId: string) => {
    if (!batch) return;

    setCompletingStop(true);
    try {
      const res = await fetch(`/api/driver/batch/${batch.id}/stop/${stopId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          arrivalTime: new Date().toISOString(),
          duration: 5, // Could make this dynamic
          hasIssues: false,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        toast({
          title: 'Stop Completed',
          description: data.batchCompleted
            ? 'Batch complete! Great job! 🎉'
            : 'Move to next stop',
        });

        if (data.batchCompleted) {
          setLocation('/driver/dashboard');
        } else {
          await fetchActiveBatch();
        }
      } else {
        throw new Error('Failed to complete stop');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to complete stop',
        variant: 'destructive',
      });
    } finally {
      setCompletingStop(false);
    }
  };

  const openInMaps = (lat: string, lng: string) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    window.open(url, '_blank');
  };

  const toggleStopExpanded = (stopId: string) => {
    setExpandedStops((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(stopId)) {
        newSet.delete(stopId);
      } else {
        newSet.add(stopId);
      }
      return newSet;
    });
  };

  const getStopIcon = (stop: Stop) => {
    if (stop.status === 'completed') {
      return <CheckCircle2 className="h-5 w-5 text-green-600" />;
    }
    if (stop.stopType === 'pickup') {
      return <Package className="h-5 w-5 text-orange-600" />;
    }
    return <MapPin className="h-5 w-5 text-blue-600" />;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      completed: <Badge className="bg-green-100 text-green-800">Completed</Badge>,
      in_progress: <Badge className="bg-blue-100 text-blue-800">In Progress</Badge>,
      pending: <Badge variant="outline">Pending</Badge>,
      skipped: <Badge variant="secondary">Skipped</Badge>,
    };
    return variants[status] || <Badge>{status}</Badge>;
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
        </div>
      </div>
    );
  }

  if (!batch) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <Package className="h-16 w-16 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-semibold mb-2">No Active Batch</h3>
              <p className="text-gray-600 mb-4">
                You don't have any active batch deliveries
              </p>
              <Button onClick={() => setLocation('/driver/dashboard')}>
                Back to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const completedStops = batch.stops.filter((s) => s.status === 'completed').length;
  const progress = (completedStops / batch.stops.length) * 100;
  const currentStop = batch.stops[currentStopIndex];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Batch Delivery</h1>
        <p className="text-gray-600 mt-1">
          {completedStops} of {batch.stops.length} stops completed
        </p>
      </div>

      {/* Progress Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Batch Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-2xl font-bold">{batch.orderCount}</div>
              <div className="text-sm text-gray-600">Orders</div>
            </div>
            <div>
              <div className="text-2xl font-bold">
                {(batch.totalDistanceMeters / 1000).toFixed(1)} km
              </div>
              <div className="text-sm text-gray-600">Distance</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">
                ${parseFloat(batch.estimatedEarnings || '0').toFixed(2)}
              </div>
              <div className="text-sm text-gray-600">Est. Earnings</div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Progress</span>
              <span className="font-medium">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {batch.batchStatus === 'pending' && (
            <Button onClick={startBatch} className="w-full">
              Start Batch Delivery
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Current Stop */}
      {batch.batchStatus === 'active' && currentStop && (
        <Card className="border-2 border-orange-500">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                {getStopIcon(currentStop)}
                Current Stop #{currentStop.stopNumber}
              </CardTitle>
              {getStatusBadge(currentStop.status)}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant={currentStop.stopType === 'pickup' ? 'default' : 'secondary'}>
                  {currentStop.stopType === 'pickup' ? '📦 PICKUP' : '📍 DROPOFF'}
                </Badge>
              </div>
              <div className="text-sm font-medium mb-1">{currentStop.contactName}</div>
              <div className="text-sm text-gray-600">{currentStop.address}</div>
            </div>

            {currentStop.instructions && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-800">{currentStop.instructions}</div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              {currentStop.contactPhone && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => (window.location.href = `tel:${currentStop.contactPhone}`)}
                  >
                    <Phone className="h-4 w-4 mr-2" />
                    Call
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => (window.location.href = `sms:${currentStop.contactPhone}`)}
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    SMS
                  </Button>
                </>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={() => openInMaps(currentStop.lat, currentStop.lng)}
              >
                <Navigation className="h-4 w-4 mr-2" />
                Navigate
              </Button>
              <Button
                onClick={() => completeStop(currentStop.id)}
                disabled={completingStop}
                className="bg-green-600 hover:bg-green-700"
              >
                {completingStop ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Completing...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Complete Stop
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Stops List */}
      <Card>
        <CardHeader>
          <CardTitle>All Stops ({batch.stops.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {batch.stops.map((stop, index) => {
              const isExpanded = expandedStops.has(stop.id);
              const isCurrent = index === currentStopIndex;

              return (
                <div
                  key={stop.id}
                  className={`border rounded-lg p-4 ${
                    isCurrent ? 'border-orange-500 bg-orange-50' : ''
                  }`}
                >
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => toggleStopExpanded(stop.id)}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div className="flex-shrink-0">{getStopIcon(stop)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium">Stop #{stop.stopNumber}</span>
                          <Badge
                            variant={stop.stopType === 'pickup' ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {stop.stopType.toUpperCase()}
                          </Badge>
                          {getStatusBadge(stop.status)}
                        </div>
                        <div className="text-sm text-gray-600 truncate">
                          {stop.address}
                        </div>
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-gray-400" />
                    )}
                  </div>

                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t space-y-2">
                      <div className="text-sm">
                        <div className="font-medium">{stop.contactName}</div>
                        {stop.contactPhone && (
                          <div className="text-gray-600">{stop.contactPhone}</div>
                        )}
                      </div>
                      {stop.instructions && (
                        <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                          {stop.instructions}
                        </div>
                      )}
                      <div className="flex gap-2 mt-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openInMaps(stop.lat, stop.lng)}
                        >
                          <Navigation className="h-3 w-3 mr-1" />
                          Navigate
                        </Button>
                        {stop.status === 'pending' && isCurrent && (
                          <Button
                            size="sm"
                            onClick={() => completeStop(stop.id)}
                            disabled={completingStop}
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Complete
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
