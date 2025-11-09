import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DeliveryMapWithLoader } from './DeliveryMap';
import { useLocationTracking } from '@/hooks/useLocationTracking';
import { 
  MapPin, 
  Navigation, 
  Clock, 
  Package, 
  Phone,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle,
  Loader2
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

interface Order {
  id: number;
  restaurantName: string;
  restaurantAddress: string;
  restaurantLat: string;
  restaurantLng: string;
  restaurantPhone: string;
  deliveryAddress: string;
  deliveryLat: string;
  deliveryLng: string;
  customerName: string;
  customerPhone: string;
  status: string;
  items: any[];
  totalAmount: number;
  deliveryFee: string;
  estimatedPickupTime?: string;
  estimatedDeliveryTime?: string;
}

interface LiveDeliveryTrackerProps {
  order: Order;
  onStatusUpdate?: (status: string) => void;
}

export function LiveDeliveryTracker({ order, onStatusUpdate }: LiveDeliveryTrackerProps) {
  const [showMap, setShowMap] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  
  // Start location tracking for this delivery
  const { location, isTracking, error: trackingError, startTracking } = useLocationTracking({
    orderId: order.id,
    updateInterval: 10000, // Update every 10 seconds
  });

  // Fetch current route/ETA
  const { data: etaData, isLoading: etaLoading } = useQuery({
    queryKey: [`/api/driver/delivery/${order.id}/eta`],
    refetchInterval: 30000, // Refetch every 30 seconds
    enabled: isTracking && !!location,
  });

  // Auto-start tracking when component mounts
  useEffect(() => {
    if (!isTracking) {
      startTracking();
    }
  }, []); // Only run once on mount

  const restaurantLocation = {
    lat: parseFloat(order.restaurantLat),
    lng: parseFloat(order.restaurantLng),
  };

  const customerLocation = {
    lat: parseFloat(order.deliveryLat),
    lng: parseFloat(order.deliveryLng),
  };

  const openGoogleMaps = () => {
    const origin = location ? `${location.lat},${location.lng}` : 'Your+Location';
    const waypoint = `${order.restaurantLat},${order.restaurantLng}`;
    const destination = `${order.deliveryLat},${order.deliveryLng}`;
    const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&waypoints=${waypoint}&destination=${destination}&travelmode=driving`;
    window.open(url, '_blank');
  };

  const makePhoneCall = (phone: string) => {
    window.location.href = `tel:${phone}`;
  };

  const openSMS = (phone: string) => {
    window.location.href = `sms:${phone}`;
  };

  const getStatusInfo = () => {
    switch (order.status) {
      case 'accepted':
      case 'confirmed':
        return {
          icon: <Navigation className="h-5 w-5" />,
          text: 'Heading to Restaurant',
          color: 'bg-blue-500',
          nextAction: 'Mark as Picked Up',
          nextStatus: 'picked_up',
        };
      case 'picked_up':
      case 'in_transit':
        return {
          icon: <Package className="h-5 w-5" />,
          text: 'Heading to Customer',
          color: 'bg-orange-500',
          nextAction: 'Mark as Delivered',
          nextStatus: 'delivered',
        };
      default:
        return {
          icon: <CheckCircle className="h-5 w-5" />,
          text: 'Delivered',
          color: 'bg-green-500',
          nextAction: null,
          nextStatus: null,
        };
    }
  };

  const statusInfo = getStatusInfo();

  const handleUpdateStatus = async () => {
    if (!statusInfo.nextStatus) return;

    try {
      const response = await fetch(`/api/driver/orders/${order.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: statusInfo.nextStatus }),
        credentials: 'include',
      });

      if (response.ok) {
        onStatusUpdate?.(statusInfo.nextStatus);
      }
    } catch (error) {
      console.error('Failed to update order status:', error);
    }
  };

  return (
    <div className="space-y-4">
      {/* Status Header */}
      <Card className={`border-l-4 ${statusInfo.color.replace('bg-', 'border-l-')}`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`${statusInfo.color} text-white p-2 rounded-full`}>
                {statusInfo.icon}
              </div>
              <div>
                <CardTitle className="text-lg">{statusInfo.text}</CardTitle>
                <CardDescription>Order #{order.id}</CardDescription>
              </div>
            </div>
            {statusInfo.nextAction && (
              <Button onClick={handleUpdateStatus} className="bg-primary">
                {statusInfo.nextAction}
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Location Tracking Alert */}
      {trackingError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{trackingError}</AlertDescription>
        </Alert>
      )}

      {!isTracking && !trackingError && (
        <Alert>
          <Loader2 className="h-4 w-4 animate-spin" />
          <AlertDescription>Starting location tracking...</AlertDescription>
        </Alert>
      )}

      {/* ETA Card */}
      {etaData && (
        <Card className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Clock className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                    {etaData.estimatedMinutes} min
                  </p>
                  <p className="text-sm text-blue-700 dark:text-blue-300">Estimated arrival</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                  {(etaData.distanceRemainingMeters / 1000).toFixed(1)} km
                </p>
                <Badge variant="outline" className="mt-1">
                  {etaData.trafficLevel === 'low' && '🟢 Light Traffic'}
                  {etaData.trafficLevel === 'moderate' && '🟡 Moderate Traffic'}
                  {etaData.trafficLevel === 'heavy' && '🟠 Heavy Traffic'}
                  {etaData.trafficLevel === 'severe' && '🔴 Severe Traffic'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Map */}
      <div>
        <Button
          variant="ghost"
          className="w-full mb-2 justify-between"
          onClick={() => setShowMap(!showMap)}
        >
          <span className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Live Map
          </span>
          {showMap ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
        
        {showMap && (
          <DeliveryMapWithLoader
            orderId={order.id}
            driverLocation={location || undefined}
            restaurantLocation={restaurantLocation}
            customerLocation={customerLocation}
            onDirectionsClick={openGoogleMaps}
          />
        )}
      </div>

      {/* Contact Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Restaurant Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-orange-600" />
              <CardTitle className="text-base">Pickup</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="font-semibold">{order.restaurantName}</p>
            <p className="text-sm text-muted-foreground">{order.restaurantAddress}</p>
            <div className="flex gap-2 pt-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => makePhoneCall(order.restaurantPhone)}
                className="flex-1"
              >
                <Phone className="h-4 w-4 mr-2" />
                Call
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => openSMS(order.restaurantPhone)}
                className="flex-1"
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                SMS
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Customer Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-green-600" />
              <CardTitle className="text-base">Delivery</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="font-semibold">{order.customerName}</p>
            <p className="text-sm text-muted-foreground">{order.deliveryAddress}</p>
            <div className="flex gap-2 pt-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => makePhoneCall(order.customerPhone)}
                className="flex-1"
              >
                <Phone className="h-4 w-4 mr-2" />
                Call
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => openSMS(order.customerPhone)}
                className="flex-1"
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                SMS
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Order Details */}
      <Card>
        <CardHeader>
          <Button
            variant="ghost"
            className="w-full justify-between p-0 h-auto"
            onClick={() => setShowDetails(!showDetails)}
          >
            <CardTitle className="text-base">Order Details</CardTitle>
            {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CardHeader>
        {showDetails && (
          <CardContent>
            <div className="space-y-2">
              {order.items.map((item: any, index: number) => (
                <div key={index} className="flex justify-between text-sm">
                  <span>
                    {item.quantity}x {item.name}
                  </span>
                  <span className="font-medium">${item.price}</span>
                </div>
              ))}
              <div className="border-t pt-2 mt-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>${(order.totalAmount - parseFloat(order.deliveryFee)).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Delivery Fee</span>
                  <span>${order.deliveryFee}</span>
                </div>
                <div className="flex justify-between font-bold mt-2">
                  <span>Total</span>
                  <span>${order.totalAmount.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Navigation Button */}
      <Button
        onClick={openGoogleMaps}
        className="w-full bg-blue-600 hover:bg-blue-700"
        size="lg"
      >
        <Navigation className="h-5 w-5 mr-2" />
        Open in Google Maps
      </Button>
    </div>
  );
}
