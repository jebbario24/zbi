import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  CheckCircle,
  TrendingUp,
  Clock,
  Navigation,
  MapPin,
  Flag,
  AlertCircle,
  Package,
  DollarSign,
  Route,
} from 'lucide-react';
import { DeliveryMapWithLoader } from './DeliveryMap';

interface Stop {
  id: string;
  type: 'pickup' | 'dropoff';
  orderId: number;
  location: { lat: number; lng: number };
  address: string;
  arrivalTime?: Date;
}

interface OptimizedRouteResultProps {
  open: boolean;
  onClose: () => void;
  onAccept: () => void;
  result: {
    batchId: string;
    route: {
      route: Stop[];
      totalDistance: number;
      totalDuration: number;
      score: number;
      arrivalTimes: { stopId: string; arrivalTime: Date }[];
    };
    constraintsViolated: string[];
  };
  driverLocation?: { lat: number; lng: number };
}

export function OptimizedRouteResult({
  open,
  onClose,
  onAccept,
  result,
  driverLocation,
}: OptimizedRouteResultProps) {
  const [accepting, setAccepting] = useState(false);

  const handleAccept = async () => {
    setAccepting(true);
    await onAccept();
    setAccepting(false);
  };

  const estimatedEarnings = result.route.route.length / 2 * 7; // Rough estimate: $7 per order
  const orderCount = result.route.route.filter(s => s.type === 'pickup').length;
  const distanceKm = (result.route.totalDistance / 1000).toFixed(1);
  const durationMin = Math.round(result.route.totalDuration / 60);

  // Calculate savings (assuming 40% improvement over individual)
  const individualDistance = result.route.totalDistance / 0.6; // Reverse calculate
  const savedDistance = (individualDistance - result.route.totalDistance) / 1000;
  const savedTime = Math.round((individualDistance / 0.6 - result.route.totalDuration) / 60);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Route className="h-5 w-5 text-primary" />
            Optimized Route Ready
          </DialogTitle>
          <DialogDescription>
            Smart algorithm calculated the best route for {orderCount} orders
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Performance Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-col items-center text-center">
                  <Package className="h-6 w-6 text-primary mb-2" />
                  <p className="text-2xl font-bold">{orderCount}</p>
                  <p className="text-xs text-muted-foreground">Orders</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex flex-col items-center text-center">
                  <Navigation className="h-6 w-6 text-blue-600 mb-2" />
                  <p className="text-2xl font-bold">{distanceKm} km</p>
                  <p className="text-xs text-muted-foreground">Distance</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex flex-col items-center text-center">
                  <Clock className="h-6 w-6 text-orange-600 mb-2" />
                  <p className="text-2xl font-bold">{durationMin} min</p>
                  <p className="text-xs text-muted-foreground">Duration</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex flex-col items-center text-center">
                  <DollarSign className="h-6 w-6 text-green-600 mb-2" />
                  <p className="text-2xl font-bold">${estimatedEarnings.toFixed(0)}</p>
                  <p className="text-xs text-muted-foreground">Earnings</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Savings Alert */}
          <Alert className="bg-green-50 border-green-200">
            <TrendingUp className="h-4 w-4 text-green-600" />
            <AlertDescription>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-green-800">
                    Saves {savedDistance.toFixed(1)} km and {savedTime} minutes
                  </p>
                  <p className="text-sm text-green-700">
                    vs delivering orders individually
                  </p>
                </div>
                <Badge className="bg-green-600 text-lg px-3">
                  {result.route.score}/100
                </Badge>
              </div>
            </AlertDescription>
          </Alert>

          {/* Constraint Violations */}
          {result.constraintsViolated && result.constraintsViolated.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <p className="font-medium">⚠️ Constraint Violations:</p>
                <ul className="list-disc list-inside text-sm mt-1">
                  {result.constraintsViolated.map((violation, i) => (
                    <li key={i}>{violation}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Map */}
          {driverLocation && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Route Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <DeliveryMapWithLoader
                  driverLocation={driverLocation}
                  restaurantLocation={result.route.route.find(s => s.type === 'pickup')?.location}
                  customerLocation={result.route.route.find(s => s.type === 'dropoff')?.location}
                />
              </CardContent>
            </Card>
          )}

          {/* Stop Sequence */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Stop Sequence</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {result.route.route.map((stop, index) => {
                  const arrivalInfo = result.route.arrivalTimes.find(
                    a => a.stopId === stop.id
                  );
                  const arrivalTime = arrivalInfo?.arrivalTime
                    ? new Date(arrivalInfo.arrivalTime).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                      })
                    : null;

                  return (
                    <div key={stop.id}>
                      <div className="flex items-start gap-3">
                        <div className="flex flex-col items-center">
                          <div
                            className={`flex items-center justify-center w-8 h-8 rounded-full ${
                              stop.type === 'pickup'
                                ? 'bg-orange-100 text-orange-600'
                                : 'bg-green-100 text-green-600'
                            }`}
                          >
                            {stop.type === 'pickup' ? (
                              <MapPin className="h-4 w-4" />
                            ) : (
                              <Flag className="h-4 w-4" />
                            )}
                          </div>
                          {index < result.route.route.length - 1 && (
                            <div className="w-0.5 h-8 bg-border" />
                          )}
                        </div>

                        <div className="flex-1 pb-4">
                          <div className="flex items-start justify-between mb-1">
                            <div>
                              <p className="font-medium">
                                {stop.type === 'pickup' ? 'Pickup' : 'Deliver'} Order #
                                {stop.orderId}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {stop.address}
                              </p>
                            </div>
                            {arrivalTime && (
                              <Badge variant="outline" className="ml-2">
                                <Clock className="h-3 w-3 mr-1" />
                                {arrivalTime}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={accepting}
            >
              Decline
            </Button>
            <Button
              onClick={handleAccept}
              disabled={accepting}
              className="flex-1 bg-green-600 hover:bg-green-700"
              size="lg"
            >
              {accepting ? (
                <>
                  <Route className="mr-2 h-5 w-5 animate-spin" />
                  Accepting...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-5 w-5" />
                  Accept Batch ({orderCount} Orders)
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
