import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Package, MapPin, Store, DollarSign } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Restaurant {
  id: string;
  name: string;
  address: string;
  phone: string;
}

interface AvailableOrder {
  id: string;
  orderNumber: string;
  total: string;
  deliveryAddress: string;
  estimatedEarnings: string;
  restaurant: Restaurant;
  createdAt: string;
}

export default function DriverAvailableOrders() {
  const { toast } = useToast();

  const { data: availableOrders = [], isLoading } = useQuery<AvailableOrder[]>({
    queryKey: ['/api/driver/available-orders'],
  });

  const acceptOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const response = await apiRequest(`/api/driver/orders/${orderId}/accept`, 'POST');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/driver/active-delivery'] });
      queryClient.invalidateQueries({ queryKey: ['/api/driver/available-orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/driver/stats'] });
      toast({
        title: "Order Accepted",
        description: "You can now start the delivery",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Package className="h-8 w-8" />
          Available Orders
        </h1>
        <p className="text-muted-foreground">
          Accept orders and start delivering
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : availableOrders.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">No Available Orders</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              There are no orders available at the moment. Check back soon for delivery opportunities.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4" data-testid="list-available-orders">
          {availableOrders.map((order) => (
            <Card key={order.id} data-testid={`card-order-${order.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle data-testid={`text-order-number-${order.id}`}>
                      Order #{order.orderNumber}
                    </CardTitle>
                    <CardDescription data-testid={`text-restaurant-${order.id}`}>
                      <Store className="inline h-3 w-3 mr-1" />
                      {order.restaurant.name}
                    </CardDescription>
                  </div>
                  <Badge variant="default" className="bg-green-600" data-testid={`badge-earnings-${order.id}`}>
                    <DollarSign className="h-3 w-3 mr-1" />
                    ${Number(order.estimatedEarnings).toFixed(2)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <span className="text-muted-foreground" data-testid={`text-delivery-address-${order.id}`}>
                      {order.deliveryAddress}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm pt-2 border-t">
                    <span className="text-muted-foreground">Order Total:</span>
                    <span className="font-semibold text-lg" data-testid={`text-total-${order.id}`}>
                      ${Number(order.total).toFixed(2)}
                    </span>
                  </div>
                </div>

                <Button
                  className="w-full"
                  size="lg"
                  data-testid={`button-accept-order-${order.id}`}
                  onClick={() => acceptOrderMutation.mutate(order.id)}
                  disabled={acceptOrderMutation.isPending}
                >
                  {acceptOrderMutation.isPending ? "Accepting..." : "Accept Order"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
