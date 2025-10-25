import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History, MapPin, Store, DollarSign, Package, CheckCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Restaurant {
  id: string;
  name: string;
}

interface DeliveryHistoryItem {
  id: string;
  orderNumber: string;
  total: string;
  deliveryAddress: string;
  driverShare: string;
  status: string;
  deliveryTime: string;
  restaurant: Restaurant;
}

export default function DriverHistory() {
  const { data: history = [], isLoading } = useQuery<DeliveryHistoryItem[]>({
    queryKey: ['/api/driver/history'],
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <History className="h-8 w-8" />
          Delivery History
        </h1>
        <p className="text-muted-foreground">
          View your past deliveries and earnings
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : history.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">No Delivery History</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              You haven't completed any deliveries yet. Start accepting orders to build your delivery history.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4" data-testid="list-delivery-history">
          {history.map((delivery) => (
            <Card key={delivery.id} data-testid={`card-delivery-${delivery.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      Order #{delivery.orderNumber}
                    </CardTitle>
                    <CardDescription>
                      {formatDistanceToNow(new Date(delivery.deliveryTime), { addSuffix: true })}
                    </CardDescription>
                  </div>
                  <Badge variant="default" className="bg-green-600">
                    <DollarSign className="h-3 w-3 mr-1" />
                    ${Number(delivery.driverShare).toFixed(2)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Store className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{delivery.restaurant.name}</span>
                </div>
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <span className="text-muted-foreground">{delivery.deliveryAddress}</span>
                </div>
                <div className="flex items-center justify-between text-sm pt-2 border-t">
                  <span className="text-muted-foreground">Order Total:</span>
                  <span className="font-semibold">${Number(delivery.total).toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
