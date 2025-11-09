import { useState, useEffect, useCallback, useRef } from 'react';
import { useWebSocket } from './useWebSocket';
import { useToast } from '@/hooks/use-toast';

interface LocationData {
  lat: number;
  lng: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  altitude?: number;
  timestamp: Date;
}

interface LocationTrackingOptions {
  enableHighAccuracy?: boolean;
  maximumAge?: number;
  timeout?: number;
  updateInterval?: number; // milliseconds
  orderId?: number; // If tracking for a specific delivery
}

export function useLocationTracking(options: LocationTrackingOptions = {}) {
  const {
    enableHighAccuracy = true,
    maximumAge = 0,
    timeout = 5000,
    updateInterval = 10000, // Update every 10 seconds
    orderId,
  } = options;

  const [location, setLocation] = useState<LocationData | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { sendMessage } = useWebSocket();
  
  const watchIdRef = useRef<number | null>(null);
  const intervalIdRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdateRef = useRef<Date | null>(null);

  // Send location update to server
  const sendLocationUpdate = useCallback(async (locationData: LocationData) => {
    try {
      // Send via WebSocket for real-time updates
      sendMessage({
        type: 'location_update',
        data: {
          lat: locationData.lat,
          lng: locationData.lng,
          accuracy: locationData.accuracy,
          speed: locationData.speed,
          heading: locationData.heading,
          altitude: locationData.altitude,
          orderId,
        },
      });

      // Also send via HTTP API as backup
      await fetch('/api/driver/location/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: locationData.lat,
          lng: locationData.lng,
          accuracy: locationData.accuracy,
          speed: locationData.speed,
          heading: locationData.heading,
          altitude: locationData.altitude,
          orderId,
        }),
        credentials: 'include',
      });

      lastUpdateRef.current = new Date();
    } catch (error) {
      console.error('Failed to send location update:', error);
    }
  }, [orderId, sendMessage]);

  // Handle successful location acquisition
  const handleSuccess = useCallback((position: GeolocationPosition) => {
    const locationData: LocationData = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy,
      speed: position.coords.speed || undefined,
      heading: position.coords.heading || undefined,
      altitude: position.coords.altitude || undefined,
      timestamp: new Date(position.timestamp),
    };

    setLocation(locationData);
    setError(null);

    // Send location update
    sendLocationUpdate(locationData);
  }, [sendLocationUpdate]);

  // Handle location error
  const handleError = useCallback((error: GeolocationPositionError) => {
    let errorMessage = 'Location tracking error';
    
    switch (error.code) {
      case error.PERMISSION_DENIED:
        errorMessage = 'Location permission denied. Please enable location access.';
        break;
      case error.POSITION_UNAVAILABLE:
        errorMessage = 'Location information unavailable.';
        break;
      case error.TIMEOUT:
        errorMessage = 'Location request timed out.';
        break;
    }

    setError(errorMessage);
    console.error('Location tracking error:', error);
  }, []);

  // Start tracking
  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      const msg = 'Geolocation is not supported by your browser';
      setError(msg);
      toast({
        title: 'Location Not Supported',
        description: msg,
        variant: 'destructive',
      });
      return;
    }

    // Request initial location
    navigator.geolocation.getCurrentPosition(handleSuccess, handleError, {
      enableHighAccuracy,
      maximumAge,
      timeout,
    });

    // Start watching position
    watchIdRef.current = navigator.geolocation.watchPosition(
      handleSuccess,
      handleError,
      {
        enableHighAccuracy,
        maximumAge,
        timeout,
      }
    );

    // Set up interval to ensure regular updates even if position doesn't change
    intervalIdRef.current = setInterval(() => {
      navigator.geolocation.getCurrentPosition(handleSuccess, handleError, {
        enableHighAccuracy,
        maximumAge,
        timeout,
      });
    }, updateInterval);

    setIsTracking(true);
    toast({
      title: 'Location Tracking Enabled',
      description: 'Your location is being tracked for deliveries.',
    });
  }, [enableHighAccuracy, maximumAge, timeout, updateInterval, handleSuccess, handleError, toast]);

  // Stop tracking
  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    if (intervalIdRef.current) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }

    setIsTracking(false);
    toast({
      title: 'Location Tracking Disabled',
      description: 'Your location is no longer being tracked.',
    });
  }, [toast]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
      }
    };
  }, []);

  // Auto-start tracking if orderId is provided (for active deliveries)
  useEffect(() => {
    if (orderId && !isTracking) {
      startTracking();
    }
  }, [orderId]); // Only depend on orderId, not isTracking or startTracking

  return {
    location,
    isTracking,
    error,
    startTracking,
    stopTracking,
    lastUpdate: lastUpdateRef.current,
  };
}
