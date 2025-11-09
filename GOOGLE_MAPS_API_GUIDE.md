# Google Maps API Integration Guide for Driver Portal

This guide covers all Google Maps APIs used in the EatOut driver portal and how to set them up.

## 📋 Required APIs

### 1. ✅ Google Maps JavaScript API
**Purpose:** Core map display in the driver's browser

**Features:**
- Interactive maps with driver, restaurant, and customer markers
- Real-time traffic layer for route planning
- Pan and zoom controls
- Custom marker icons

**Usage in Code:**
- `client/src/components/GoogleMapsLoader.tsx` - Loads the API
- `client/src/components/delivery/DeliveryMap.tsx` - Displays maps

**Cost:** $7 per 1,000 map loads (first 28,000/month free)

---

### 2. ✅ Directions API
**Purpose:** Turn-by-turn navigation and route calculation

**Features:**
- Optimal routes from driver → restaurant → customer
- Multiple route alternatives with time estimates
- Traffic-aware route suggestions
- Step-by-step directions

**Usage in Code:**
- `server/services/googleMaps.ts` → `calculateRoute()`
- Returns polylines for route display
- Provides turn-by-turn instructions

**Cost:** $5 per 1,000 requests (first 200/day free)

**Example:**
```typescript
const route = await googleMapsService.calculateRoute(
  driverLocation,
  customerLocation,
  {
    waypoints: [restaurantLocation],
    departureTime: new Date(),
    trafficModel: 'best_guess'
  }
);
```

---

### 3. ✅ Distance Matrix API
**Purpose:** Smart dispatch and batch delivery optimization

**Features:**
- Calculate travel time between multiple origins and destinations
- Real-time traffic data for accurate ETAs
- Helps match closest available driver to orders
- Batch distance calculations (up to 25x25 matrix)

**Usage in Code:**
- `server/services/googleMaps.ts` → `calculateDistanceMatrix()`
- `server/services/routeOptimization.ts` - Batch delivery optimization

**Cost:** $5 per 1,000 elements (first 200/day free)

**Example:**
```typescript
// Find closest driver to restaurant
const matrix = await googleMapsService.calculateDistanceMatrix(
  [driver1Location, driver2Location, driver3Location],
  [restaurantLocation]
);
```

---

### 4. ✅ Geolocation API (Browser API)
**Purpose:** Driver real-time location tracking

**Features:**
- Tracks driver's GPS position automatically
- Updates every 10 seconds
- High-accuracy mode for better precision
- Works with battery optimization

**Usage in Code:**
- `client/src/hooks/useLocationTracking.tsx`
- `server/services/locationTracking.ts` - Stores location history

**Cost:** FREE (browser API, no Google billing)

**Example:**
```typescript
const { location, isTracking, startTracking } = useLocationTracking({
  orderId: 123,
  updateInterval: 10000  // 10 seconds
});
```

---

### 5. ✅ Places API
**Purpose:** Address validation and autocomplete

**Features:**
- Real-time address autocomplete as user types
- Validates restaurant and customer addresses
- Supports Plus Codes for areas without addresses
- Parse address components (street, city, postal code)

**Usage in Code:**
- `client/src/components/maps/AddressAutocomplete.tsx` (NEW!)
- `server/services/googleMaps.ts` → `geocode()`, `reverseGeocode()`

**Cost:** 
- Autocomplete: $2.83 per 1,000 requests
- Geocoding: $5 per 1,000 requests

**Example:**
```tsx
<AddressAutocomplete
  label="Delivery Address"
  onAddressSelect={(address) => {
    console.log(address.formattedAddress);
    console.log(address.lat, address.lng);
  }}
  types={['address']}
  componentRestrictions={{ country: 'us' }}
/>
```

---

## 🚀 Optional Advanced APIs

### 6. ✅ Roads API (NOW IMPLEMENTED!)
**Purpose:** Improve GPS accuracy by snapping to roads

**Features:**
- Snaps driver location to actual road network
- Fixes poor GPS data (tunnels, tall buildings)
- Interpolates missing GPS points
- Get speed limits for routes

**Usage in Code:**
- `server/services/googleMaps.ts` → `snapToRoads()`, `getSpeedLimits()`
- `server/services/locationTracking.ts` - Optional snap-to-roads on location update

**Cost:** $10 per 1,000 requests

**Example:**
```typescript
// Snap driver's GPS points to roads
const snappedPoints = await googleMapsService.snapToRoads(
  gpsPoints,
  true  // interpolate missing points
);

// Enable snap-to-roads when updating location
await locationTrackingService.updateLocation(locationData, true);
```

---

### 7. ⚠️ Fleet Engine API (For Future - Large Scale)
**Purpose:** Enterprise-level multi-driver management

**Features:**
- Manages hundreds of drivers simultaneously
- Automatic task and trip assignment
- Advanced fleet optimization algorithms
- Real-time driver-rider matching

**When to Use:**
- 50+ concurrent drivers
- High-frequency order volume
- Need Google's advanced optimization

**Cost:** Contact Google for pricing

**Note:** Not implemented yet. Phase 1-4 features are sufficient for most operations.

---

## 🔧 Setup Instructions

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Enable billing for the project

### Step 2: Enable Required APIs

Navigate to **APIs & Services → Library** and enable:

- ✅ Maps JavaScript API
- ✅ Directions API
- ✅ Distance Matrix API
- ✅ Geocoding API
- ✅ Places API
- ✅ Roads API (optional but recommended)

### Step 3: Create API Keys

You need TWO API keys for security:

#### Frontend Key (Browser)
1. **APIs & Services → Credentials → Create Credentials → API Key**
2. **Restrict Key:**
   - Application restrictions: HTTP referrers
   - Website restrictions: `https://your-domain.com/*`
   - API restrictions: 
     - Maps JavaScript API
     - Places API
     - Geocoding API

#### Backend Key (Server)
1. **Create another API Key**
2. **Restrict Key:**
   - Application restrictions: IP addresses
   - Add your server IP(s)
   - API restrictions:
     - Directions API
     - Distance Matrix API
     - Geocoding API
     - Roads API

### Step 4: Add to Environment Variables

#### Render.com Dashboard:
```
VITE_GOOGLE_MAPS_API_KEY=AIza...your-frontend-key
GOOGLE_MAPS_API_KEY=AIza...your-backend-key
GOOGLE_MAPS_API_KEY_SERVER=AIza...your-backend-key (optional)
```

#### Local Development (.env):
```bash
VITE_GOOGLE_MAPS_API_KEY=AIza...your-key
GOOGLE_MAPS_API_KEY=AIza...your-key
```

### Step 5: Verify Setup

Test each API:

```bash
# Test Geocoding
curl "https://maps.googleapis.com/maps/api/geocode/json?address=1600+Amphitheatre+Parkway,+Mountain+View,+CA&key=YOUR_KEY"

# Test Directions
curl "https://maps.googleapis.com/maps/api/directions/json?origin=San+Francisco&destination=Los+Angeles&key=YOUR_KEY"

# Test Distance Matrix
curl "https://maps.googleapis.com/maps/api/distancematrix/json?origins=San+Francisco&destinations=Los+Angeles&key=YOUR_KEY"
```

---

## 💰 Cost Optimization Tips

### 1. Use Geocoding Cache
✅ Already implemented! Addresses are cached for 24 hours.

```typescript
// Automatic caching in googleMapsService.geocode()
const result = await googleMapsService.geocode(address);
// Subsequent calls use cache (no API charge)
```

### 2. Batch Requests
✅ Use Distance Matrix API for multiple calculations:

```typescript
// BAD: 3 separate API calls
const dist1 = await calculateRoute(driver1, restaurant);
const dist2 = await calculateRoute(driver2, restaurant);
const dist3 = await calculateRoute(driver3, restaurant);

// GOOD: 1 API call
const matrix = await calculateDistanceMatrix(
  [driver1, driver2, driver3],
  [restaurant]
);
```

### 3. Smart Location Updates
✅ Update every 10 seconds (not every second):

```typescript
const { location } = useLocationTracking({
  updateInterval: 10000  // 10 seconds = 360 updates/hour
});
```

### 4. Use Roads API Wisely
⚠️ Only snap to roads when accuracy is critical:

```typescript
// During active delivery with customer watching
await updateLocation(locationData, true);  // Snap to roads

// During idle time
await updateLocation(locationData, false); // Raw GPS
```

### 5. Monitor Usage
- Set up billing alerts in Google Cloud Console
- Alert at 50%, 90% of monthly budget
- Review API usage reports weekly

---

## 📊 Expected Monthly Costs

### Small Operation (10 drivers, 50 deliveries/day)
- Directions API: ~$7.50/month (1,500 routes)
- Distance Matrix: ~$5/month (1,000 distance checks)
- Geocoding: ~$2.50/month (500 addresses, 70% cached)
- Maps JavaScript: FREE (under 28,000 loads)
- Places Autocomplete: ~$5/month (occasional use)
- **Total: ~$20/month**

### Medium Operation (50 drivers, 300 deliveries/day)
- Directions API: ~$45/month (9,000 routes)
- Distance Matrix: ~$25/month (5,000 distance checks)
- Geocoding: ~$10/month (2,000 addresses, 70% cached)
- Maps JavaScript: ~$14/month (30,000 loads)
- Places Autocomplete: ~$15/month
- Roads API: ~$30/month (3,000 snaps)
- **Total: ~$140/month**

### Large Operation (200 drivers, 1,500 deliveries/day)
- Consider volume discounts
- Estimated: ~$500-700/month
- Consider Fleet Engine API at this scale

---

## 🔒 Security Best Practices

### 1. Always Restrict API Keys
❌ Never use unrestricted API keys
✅ Always add HTTP referrer or IP restrictions

### 2. Separate Frontend/Backend Keys
- Frontend: HTTP referrer restrictions
- Backend: IP address restrictions
- Never expose backend keys in client code

### 3. Monitor for Abuse
- Set up billing alerts
- Review unusual spikes in API usage
- Rotate keys if compromised

### 4. Rate Limiting
✅ Already implemented in the codebase:

```typescript
// Server-side rate limiting in routes.ts
app.use('/api/', rateLimiter);
```

---

## 🐛 Troubleshooting

### "API key not configured"
**Solution:** Add `VITE_GOOGLE_MAPS_API_KEY` to environment variables

### "Google Maps failed to load"
**Check:**
1. API key is correct
2. Maps JavaScript API is enabled
3. HTTP referrer restrictions match your domain
4. Billing is enabled on Google Cloud project

### "No route found"
**Possible causes:**
1. Invalid coordinates
2. Locations too far apart
3. Directions API not enabled
4. API quota exceeded

### High API costs
**Solutions:**
1. Enable geocoding cache (already done!)
2. Reduce location update frequency
3. Use batch requests (Distance Matrix)
4. Disable snap-to-roads for non-delivery time

---

## 📚 Additional Resources

- [Google Maps Platform Documentation](https://developers.google.com/maps/documentation)
- [API Pricing Calculator](https://mapsplatform.google.com/pricing/)
- [Best Practices Guide](https://developers.google.com/maps/documentation/javascript/best-practices)
- [API Key Restrictions](https://cloud.google.com/docs/authentication/api-keys)

---

## ✅ Implementation Checklist

- [x] Maps JavaScript API - Core map display
- [x] Directions API - Turn-by-turn navigation
- [x] Distance Matrix API - Smart dispatch
- [x] Geolocation API - Driver tracking
- [x] Places API - Address autocomplete
- [x] Roads API - GPS accuracy improvement
- [x] Geocoding cache - Cost optimization
- [x] API key environment variables
- [x] Frontend components (DeliveryMap, AddressAutocomplete)
- [x] Backend services (googleMaps, locationTracking, routeOptimization)
- [x] WebSocket real-time updates
- [ ] Fleet Engine API (future consideration for large scale)

---

**Last Updated:** November 9, 2025
**Phase 1 Status:** ✅ Complete with all essential APIs
