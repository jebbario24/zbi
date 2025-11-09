import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Package, 
  TrendingUp, 
  Clock, 
  Navigation, 
  AlertCircle,
  CheckCircle,
  Zap,
  Route
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMutation } from '@tanstack/react-query';

interface Order {
  id: string;
  orderNumber: string;
  restaurantName: string;
  restaurantAddress: string;
  deliveryAddress: string;
  deliveryFee: string;
  distance?: number; // km
  items: any[];
  priority?: number;
  timeWindow?: {
    earliest: string;
    latest: string;
  };
}

interface BatchOptimizerProps {
  orders: Order[];
  onOptimized: (result: any) => void;
}

export function BatchOptimizer({ orders, onOptimized }: BatchOptimizerProps) {
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [optimizeFor, setOptimizeFor] = useState<'time' | 'distance' | 'priority'>('time');
  const { toast } = useToast();

  const optimizeMutation = useMutation({
    mutationFn: async (orderIds: string[]) => {
      const response = await fetch('/api/driver/route/batch/advanced', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderIds: orderIds.map(id => parseInt(id)),
          optimizeFor,
          respectConstraints: true,
        }),
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to optimize route');
      }

      return response.json();
    },
    onSuccess: (result) => {
      toast({
        title: 'Route Optimized!',
        description: `Saved ${result.route.totalDistance}m and ${Math.round(result.route.totalDuration / 60)} minutes`,
      });
      onOptimized(result);
    },
    onError: (error: any) => {
      toast({
        title: 'Optimization Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const toggleOrder = (orderId: string) => {
    const newSelected = new Set(selectedOrders);
    if (newSelected.has(orderId)) {
      newSelected.delete(orderId);
    } else {
      newSelected.add(orderId);
    }
    setSelectedOrders(newSelected);
  };

  const selectAll = () => {
    setSelectedOrders(new Set(orders.map(o => o.id)));
  };

  const clearAll = () => {
    setSelectedOrders(new Set());
  };

  const handleOptimize = () => {
    if (selectedOrders.size < 2) {
      toast({
        title: 'Select More Orders',
        description: 'You need at least 2 orders to optimize a batch',
        variant: 'destructive',
      });
      return;
    }

    optimizeMutation.mutate(Array.from(selectedOrders));
  };

  const estimatedSavings = selectedOrders.size >= 2 
    ? Math.round(selectedOrders.size * 0.4 * 100) / 100 // Estimate 40% savings
    : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Smart Batch Optimizer
            </CardTitle>
            <CardDescription>
              Select orders to create an optimized multi-stop route
            </CardDescription>
          </div>
          <Badge variant="secondary" className="text-lg px-3 py-1">
            {selectedOrders.size} selected
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Optimization Strategy */}
        <div className="flex gap-2">
          <Button
            variant={optimizeFor === 'time' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setOptimizeFor('time')}
          >
            <Clock className="h-4 w-4 mr-2" />
            Fastest
          </Button>
          <Button
            variant={optimizeFor === 'distance' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setOptimizeFor('distance')}
          >
            <Navigation className="h-4 w-4 mr-2" />
            Shortest
          </Button>
          <Button
            variant={optimizeFor === 'priority' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setOptimizeFor('priority')}
          >
            <AlertCircle className="h-4 w-4 mr-2" />
            Priority
          </Button>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={selectAll}>
            Select All ({orders.length})
          </Button>
          <Button variant="ghost" size="sm" onClick={clearAll}>
            Clear
          </Button>
        </div>

        {/* Order List */}
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {orders.map((order) => (
            <div
              key={order.id}
              className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-all ${
                selectedOrders.has(order.id)
                  ? 'border-primary bg-primary/5'
                  : 'hover:border-muted-foreground/30'
              }`}
              onClick={() => toggleOrder(order.id)}
            >
              <Checkbox
                checked={selectedOrders.has(order.id)}
                onCheckedChange={() => toggleOrder(order.id)}
                className="mt-1"
              />
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium">Order #{order.orderNumber}</p>
                  {order.priority && order.priority <= 3 && (
                    <Badge variant="destructive" className="text-xs">
                      High Priority
                    </Badge>
                  )}
                  {order.timeWindow && (
                    <Badge variant="outline" className="text-xs">
                      <Clock className="h-3 w-3 mr-1" />
                      Time Window
                    </Badge>
                  )}
                </div>
                
                <p className="text-sm text-muted-foreground truncate">
                  {order.restaurantName}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  → {order.deliveryAddress}
                </p>
                
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-sm font-medium text-green-600">
                    ${order.deliveryFee}
                  </span>
                  {order.distance && (
                    <span className="text-xs text-muted-foreground">
                      {order.distance.toFixed(1)} km
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {order.items.length} items
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Estimated Savings */}
        {selectedOrders.size >= 2 && (
          <Alert className="bg-green-50 border-green-200">
            <TrendingUp className="h-4 w-4 text-green-600" />
            <AlertDescription>
              <div className="flex items-center justify-between">
                <span className="font-medium text-green-800">
                  Estimated savings: ~{estimatedSavings * selectedOrders.size} km
                </span>
                <Badge className="bg-green-600">
                  +{Math.round(selectedOrders.size * 1.5)} min saved
                </Badge>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Optimize Button */}
        <Button
          className="w-full"
          size="lg"
          disabled={selectedOrders.size < 2 || optimizeMutation.isPending}
          onClick={handleOptimize}
        >
          {optimizeMutation.isPending ? (
            <>
              <Route className="mr-2 h-5 w-5 animate-spin" />
              Optimizing Route...
            </>
          ) : (
            <>
              <Zap className="mr-2 h-5 w-5" />
              Optimize {selectedOrders.size} Orders
            </>
          )}
        </Button>

        {selectedOrders.size < 2 && (
          <p className="text-xs text-center text-muted-foreground">
            Select at least 2 orders to optimize a batch route
          </p>
        )}
      </CardContent>
    </Card>
  );
}
