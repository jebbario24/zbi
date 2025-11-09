import { useEffect, useRef, useState } from 'react';
import { GoogleMapsLoader } from '@/components/GoogleMapsLoader';
import { useWebSocket } from '@/hooks/useWebSocket';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Navigation, MapPin, Flag, Clock } from 'lucide-react';

interface Location {
  lat: number;
  lng: number;
}

interface DeliveryMapProps {
  orderId?: number;
  driverLocation?: Location;
  restaurantLocation?: Location;
  customerLocation?: Location;
  polyline?: string; // Encoded polyline from Google Directions
  showTraffic?: boolean;
  autoCenter?: boolean;
  onDirectionsClick?: () => void;
}

export function DeliveryMap({
  orderId,
  driverLocation,
  restaurantLocation,
  customerLocation,
  polyline,
  showTraffic = true,
  autoCenter = true,
  onDirectionsClick,
}: DeliveryMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<{
    driver?: google.maps.Marker;
    restaurant?: google.maps.Marker;
    customer?: google.maps.Marker;
  }>({});
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const trafficLayerRef = useRef<google.maps.TrafficLayer | null>(null);

  const [eta, setEta] = useState<number | null>(null);
  const [distance, setDistance] = useState<string>('');
  const { lastMessage } = useWebSocket();

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = new google.maps.Map(mapRef.current, {
      zoom: 13,
      center: driverLocation || restaurantLocation || customerLocation || { lat: 0, lng: 0 },
      mapTypeControl: false,
      fullscreenControl: true,
      streetViewControl: false,
      zoomControl: true,
      styles: [
        {
          featureType: 'poi',
          elementType: 'labels',
          stylers: [{ visibility: 'off' }],
        },
      ],
    });

    mapInstanceRef.current = map;

    // Add traffic layer
    if (showTraffic) {
      const trafficLayer = new google.maps.TrafficLayer();
      trafficLayer.setMap(map);
      trafficLayerRef.current = trafficLayer;
    }
  }, []);

  // Update driver marker
  useEffect(() => {
    if (!mapInstanceRef.current || !driverLocation) return;

    if (markersRef.current.driver) {
      markersRef.current.driver.setPosition(driverLocation);
    } else {
      markersRef.current.driver = new google.maps.Marker({
        position: driverLocation,
        map: mapInstanceRef.current,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#3B82F6',
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 3,
        },
        title: 'Driver',
        zIndex: 1000,
      });
    }

    if (autoCenter) {
      mapInstanceRef.current.panTo(driverLocation);
    }
  }, [driverLocation, autoCenter]);

  // Update restaurant marker
  useEffect(() => {
    if (!mapInstanceRef.current || !restaurantLocation) return;

    if (!markersRef.current.restaurant) {
      markersRef.current.restaurant = new google.maps.Marker({
        position: restaurantLocation,
        map: mapInstanceRef.current,
        icon: {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="#EA580C">
              <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"/>
            </svg>
          `),
          scaledSize: new google.maps.Size(32, 32),
          anchor: new google.maps.Point(16, 32),
        },
        title: 'Restaurant',
      });
    }
  }, [restaurantLocation]);

  // Update customer marker
  useEffect(() => {
    if (!mapInstanceRef.current || !customerLocation) return;

    if (!markersRef.current.customer) {
      markersRef.current.customer = new google.maps.Marker({
        position: customerLocation,
        map: mapInstanceRef.current,
        icon: {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="#10B981">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
          `),
          scaledSize: new google.maps.Size(32, 32),
          anchor: new google.maps.Point(16, 32),
        },
        title: 'Customer',
      });
    }
  }, [customerLocation]);

  // Update route polyline
  useEffect(() => {
    if (!mapInstanceRef.current || !polyline) return;

    // Remove old polyline
    if (polylineRef.current) {
      polylineRef.current.setMap(null);
    }

    // Decode polyline
    const path = google.maps.geometry.encoding.decodePath(polyline);

    // Create new polyline
    polylineRef.current = new google.maps.Polyline({
      path,
      map: mapInstanceRef.current,
      strokeColor: '#3B82F6',
      strokeWeight: 4,
      strokeOpacity: 0.8,
    });

    // Fit bounds to show entire route
    if (autoCenter) {
      const bounds = new google.maps.LatLngBounds();
      path.forEach((point: google.maps.LatLng) => bounds.extend(point));
      if (driverLocation) bounds.extend(driverLocation);
      if (restaurantLocation) bounds.extend(restaurantLocation);
      if (customerLocation) bounds.extend(customerLocation);
      mapInstanceRef.current.fitBounds(bounds);
    }
  }, [polyline, autoCenter, driverLocation, restaurantLocation, customerLocation]);

  // Listen for WebSocket ETA updates
  useEffect(() => {
    if (!lastMessage || !orderId) return;

    if (lastMessage.type === 'eta_update' && lastMessage.data.orderId === orderId) {
      setEta(lastMessage.data.estimatedMinutes);
      
      // Format distance
      const meters = lastMessage.data.distanceRemainingMeters;
      if (meters < 1000) {
        setDistance(`${Math.round(meters)} m`);
      } else {
        setDistance(`${(meters / 1000).toFixed(1)} km`);
      }
    }

    if (lastMessage.type === 'delivery_location_update' && lastMessage.data.orderId === orderId) {
      // Driver location will be updated via driverLocation prop
    }
  }, [lastMessage, orderId]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
      }
      if (trafficLayerRef.current) {
        trafficLayerRef.current.setMap(null);
      }
      Object.values(markersRef.current).forEach(marker => {
        if (marker) marker.setMap(null);
      });
    };
  }, []);

  return (
    <Card className="overflow-hidden">
      {/* ETA Header */}
      {(eta !== null || distance) && (
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {eta !== null && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span className="font-semibold">{eta} min</span>
              </div>
            )}
            {distance && (
              <div className="flex items-center gap-2">
                <Navigation className="h-4 w-4" />
                <span className="font-semibold">{distance}</span>
              </div>
            )}
          </div>
          {onDirectionsClick && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onDirectionsClick}
              className="bg-white/20 hover:bg-white/30 text-white border-0"
            >
              <Navigation className="h-4 w-4 mr-2" />
              Directions
            </Button>
          )}
        </div>
      )}

      {/* Map */}
      <div ref={mapRef} className="w-full h-[400px]" />

      {/* Legend */}
      <div className="p-3 bg-muted/50 flex items-center justify-around text-sm">
        {driverLocation && (
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-blue-500 border-2 border-white" />
            <span className="text-muted-foreground">Driver</span>
          </div>
        )}
        {restaurantLocation && (
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-orange-600" />
            <span className="text-muted-foreground">Pickup</span>
          </div>
        )}
        {customerLocation && (
          <div className="flex items-center gap-2">
            <Flag className="h-4 w-4 text-green-600" />
            <span className="text-muted-foreground">Delivery</span>
          </div>
        )}
      </div>
    </Card>
  );
}

/**
 * Wrapper with Google Maps loader
 */
export function DeliveryMapWithLoader(props: DeliveryMapProps) {
  return (
    <GoogleMapsLoader>
      <DeliveryMap {...props} />
    </GoogleMapsLoader>
  );
}
