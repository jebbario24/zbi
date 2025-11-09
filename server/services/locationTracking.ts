import { db } from '../db';
import { driverLocationHistory, deliveryRoutes, etaUpdates, orders } from '../../shared/schema';
import { eq, and, desc, gt } from 'drizzle-orm';
import { googleMapsService } from './googleMaps';
import type { LatLng } from './googleMaps';
import logger from '../logger';

interface LocationUpdate {
  driverId: number;
  orderId?: number;
  lat: number;
  lng: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  altitude?: number;
  timestamp?: Date;
}

interface ETACalculation {
  orderId: number;
  estimatedMinutes: number;
  distanceRemainingMeters: number;
  trafficLevel: 'low' | 'moderate' | 'heavy' | 'severe';
  estimatedPickupTime?: Date;
  estimatedDeliveryTime?: Date;
}

class LocationTrackingService {
  /**
   * Update driver's current location
   * Stores high-frequency GPS data for real-time tracking
   */
  async updateLocation(update: LocationUpdate): Promise<void> {
    try {
      await db.insert(driverLocationHistory).values({
        driverId: update.driverId,
        orderId: update.orderId || null,
        lat: update.lat.toString(),
        lng: update.lng.toString(),
        accuracy: update.accuracy || null,
        speed: update.speed || null,
        heading: update.heading || null,
        altitude: update.altitude || null,
        timestamp: update.timestamp || new Date(),
      });

      // If this is for an active delivery, update ETA
      if (update.orderId) {
        await this.updateETA(update.orderId, {
          lat: update.lat,
          lng: update.lng,
        });
      }

      logger.info(`Location updated for driver ${update.driverId}`, {
        lat: update.lat,
        lng: update.lng,
        orderId: update.orderId,
      });
    } catch (error) {
      logger.error('Failed to update location', { error, update });
      throw error;
    }
  }

  /**
   * Get driver's current location (most recent)
   */
  async getCurrentLocation(driverId: number): Promise<LatLng | null> {
    const [latest] = await db
      .select()
      .from(driverLocationHistory)
      .where(eq(driverLocationHistory.driverId, driverId))
      .orderBy(desc(driverLocationHistory.timestamp))
      .limit(1);

    if (!latest) {
      return null;
    }

    return {
      lat: parseFloat(latest.lat),
      lng: parseFloat(latest.lng),
    };
  }

  /**
   * Get driver's location history for a specific time range
   */
  async getLocationHistory(
    driverId: number,
    since: Date,
    orderId?: number
  ): Promise<Array<{
    lat: number;
    lng: number;
    timestamp: Date;
    speed?: number;
    heading?: number;
  }>> {
    const conditions = [
      eq(driverLocationHistory.driverId, driverId),
      gt(driverLocationHistory.timestamp, since),
    ];

    if (orderId) {
      conditions.push(eq(driverLocationHistory.orderId, orderId));
    }

    const history = await db
      .select()
      .from(driverLocationHistory)
      .where(and(...conditions))
      .orderBy(driverLocationHistory.timestamp);

    return history.map(h => ({
      lat: parseFloat(h.lat),
      lng: parseFloat(h.lng),
      timestamp: h.timestamp,
      speed: h.speed || undefined,
      heading: h.heading || undefined,
    }));
  }

  /**
   * Calculate and update ETA for active delivery
   */
  async updateETA(orderId: number, driverLocation: LatLng): Promise<ETACalculation | null> {
    try {
      // Get order details
      const [order] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1);

      if (!order || order.status === 'delivered' || order.status === 'cancelled') {
        return null;
      }

      // Determine destination based on order status
      let destination: LatLng;
      let isPickup = false;

      if (order.status === 'accepted' || order.status === 'confirmed') {
        // Driver heading to restaurant
        if (!order.restaurantLat || !order.restaurantLng) {
          return null;
        }
        destination = {
          lat: parseFloat(order.restaurantLat),
          lng: parseFloat(order.restaurantLng),
        };
        isPickup = true;
      } else if (order.status === 'picked_up' || order.status === 'in_transit') {
        // Driver heading to customer
        if (!order.deliveryLat || !order.deliveryLng) {
          return null;
        }
        destination = {
          lat: parseFloat(order.deliveryLat),
          lng: parseFloat(order.deliveryLng),
        };
      } else {
        return null;
      }

      // Calculate ETA using Google Maps (includes live traffic)
      const eta = await googleMapsService.calculateETA(driverLocation, destination);

      // Get previous ETA for comparison
      const [previousETA] = await db
        .select()
        .from(etaUpdates)
        .where(eq(etaUpdates.orderId, orderId))
        .orderBy(desc(etaUpdates.createdAt))
        .limit(1);

      const estimatedMinutes = Math.ceil(eta.durationInTrafficSeconds / 60);
      const previousEstimatedMinutes = previousETA?.estimatedMinutes || null;

      // Determine traffic level based on difference between base time and traffic time
      const trafficDelay = (eta.durationInTrafficSeconds - eta.durationSeconds) / eta.durationSeconds;
      let trafficLevel: ETACalculation['trafficLevel'];
      if (trafficDelay < 0.1) trafficLevel = 'low';
      else if (trafficDelay < 0.3) trafficLevel = 'moderate';
      else if (trafficDelay < 0.5) trafficLevel = 'heavy';
      else trafficLevel = 'severe';

      // Determine change reason
      let changeReason = 'location_update';
      if (previousEstimatedMinutes) {
        const change = estimatedMinutes - previousEstimatedMinutes;
        if (Math.abs(change) > 5) {
          changeReason = change > 0 ? 'traffic_delay' : 'faster_route';
        }
      }

      // Store ETA update
      await db.insert(etaUpdates).values({
        orderId,
        estimatedMinutes,
        previousEstimatedMinutes,
        changeReason,
        driverLat: driverLocation.lat.toString(),
        driverLng: driverLocation.lng.toString(),
        distanceRemainingMeters: eta.distanceMeters,
        trafficLevel,
      });

      // Update order's estimated times
      const now = new Date();
      if (isPickup) {
        await db
          .update(orders)
          .set({
            estimatedPickupTime: new Date(now.getTime() + eta.durationInTrafficSeconds * 1000),
          })
          .where(eq(orders.id, orderId));
      } else {
        await db
          .update(orders)
          .set({
            estimatedDeliveryTime: new Date(now.getTime() + eta.durationInTrafficSeconds * 1000),
          })
          .where(eq(orders.id, orderId));
      }

      logger.info(`ETA updated for order ${orderId}`, {
        estimatedMinutes,
        distanceMeters: eta.distanceMeters,
        trafficLevel,
      });

      return {
        orderId,
        estimatedMinutes,
        distanceRemainingMeters: eta.distanceMeters,
        trafficLevel,
        estimatedPickupTime: isPickup ? eta.estimatedArrival : undefined,
        estimatedDeliveryTime: !isPickup ? eta.estimatedArrival : undefined,
      };
    } catch (error) {
      logger.error('Failed to update ETA', { error, orderId });
      return null;
    }
  }

  /**
   * Get ETA history for an order
   */
  async getETAHistory(orderId: number): Promise<Array<{
    estimatedMinutes: number;
    changeReason: string;
    distanceRemainingMeters: number;
    trafficLevel: string;
    timestamp: Date;
  }>> {
    const history = await db
      .select()
      .from(etaUpdates)
      .where(eq(etaUpdates.orderId, orderId))
      .orderBy(etaUpdates.createdAt);

    return history.map(h => ({
      estimatedMinutes: h.estimatedMinutes,
      changeReason: h.changeReason,
      distanceRemainingMeters: h.distanceRemainingMeters,
      trafficLevel: h.trafficLevel,
      timestamp: h.createdAt,
    }));
  }

  /**
   * Calculate distance between two points (Haversine formula)
   */
  calculateDistance(point1: LatLng, point2: LatLng): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (point1.lat * Math.PI) / 180;
    const φ2 = (point2.lat * Math.PI) / 180;
    const Δφ = ((point2.lat - point1.lat) * Math.PI) / 180;
    const Δλ = ((point2.lng - point1.lng) * Math.PI) / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }

  /**
   * Check if driver is close to a location (within threshold)
   */
  async isDriverNearby(
    driverId: number,
    location: LatLng,
    thresholdMeters: number = 100
  ): Promise<boolean> {
    const driverLocation = await this.getCurrentLocation(driverId);
    if (!driverLocation) {
      return false;
    }

    const distance = this.calculateDistance(driverLocation, location);
    return distance <= thresholdMeters;
  }

  /**
   * Get all active drivers with their current locations
   * Useful for dispatcher to see available drivers
   */
  async getActiveDriverLocations(): Promise<Array<{
    driverId: number;
    lat: number;
    lng: number;
    lastUpdate: Date;
    orderId?: number;
  }>> {
    // Get locations updated within last 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const locations = await db
      .select({
        driverId: driverLocationHistory.driverId,
        lat: driverLocationHistory.lat,
        lng: driverLocationHistory.lng,
        timestamp: driverLocationHistory.timestamp,
        orderId: driverLocationHistory.orderId,
      })
      .from(driverLocationHistory)
      .where(gt(driverLocationHistory.timestamp, fiveMinutesAgo))
      .orderBy(desc(driverLocationHistory.timestamp));

    // Get most recent location per driver
    const driverMap = new Map();
    for (const loc of locations) {
      if (!driverMap.has(loc.driverId)) {
        driverMap.set(loc.driverId, loc);
      }
    }

    return Array.from(driverMap.values()).map(loc => ({
      driverId: loc.driverId,
      lat: parseFloat(loc.lat),
      lng: parseFloat(loc.lng),
      lastUpdate: loc.timestamp,
      orderId: loc.orderId || undefined,
    }));
  }
}

// Export singleton instance
export const locationTrackingService = new LocationTrackingService();
export type { LocationUpdate, ETACalculation };
