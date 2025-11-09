import { useState, useEffect, useRef } from "react";

export interface Location {
  lat: number;
  lng: number;
  timestamp: number;
}

interface UseLocationTrackingOptions {
  enabled?: boolean;
  interval?: number; // in milliseconds
  onLocationUpdate?: (location: Location) => void;
}

export function useLocationTracking(options: UseLocationTrackingOptions = {}) {
  const { enabled = false, interval = 30000, onLocationUpdate } = options;
  const [location, setLocation] = useState<Location | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const updateLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by this browser");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newLocation: Location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          timestamp: Date.now(),
        };
        setLocation(newLocation);
        setError(null);
        onLocationUpdate?.(newLocation);
      },
      (err) => {
        setError(err.message);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const startTracking = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by this browser");
      return;
    }

    setIsTracking(true);
    updateLocation(); // Get initial location

    // Update location at specified interval
    intervalRef.current = setInterval(() => {
      updateLocation();
    }, interval);
  };

  const stopTracking = () => {
    setIsTracking(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  };

  useEffect(() => {
    if (enabled) {
      startTracking();
    } else {
      stopTracking();
    }

    return () => {
      stopTracking();
    };
  }, [enabled, interval]);

  return {
    location,
    error,
    isTracking,
    startTracking,
    stopTracking,
    updateLocation,
  };
}

