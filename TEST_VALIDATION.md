# Quick Test Validation Checklist

## 🚀 Pre-Deployment Checks

### ✅ Build Status
- [x] Build completes successfully (npm run build)
- [x] No TypeScript errors
- [x] All components compile
- [x] Bundle size reasonable (<3MB)

### ✅ Critical Files Present
- [x] `client/src/hooks/useWebSocket.ts` - WebSocket hook
- [x] `client/src/hooks/useLocationTracking.tsx` - GPS tracking
- [x] `client/src/components/GoogleMapsLoader.tsx` - Maps loader
- [x] `client/src/components/delivery/LiveDeliveryTracker.tsx` - Phase 1
- [x] `client/src/components/delivery/DeliveryMap.tsx` - Phase 1
- [x] `client/src/components/delivery/BatchOptimizer.tsx` - Phase 2
- [x] `client/src/components/delivery/OptimizedRouteResult.tsx` - Phase 2
- [x] `client/src/pages/DriverVehicleSettings.tsx` - Phase 2
- [x] `server/services/googleMaps.ts` - Maps API service
- [x] `server/services/locationTracking.ts` - Location service
- [x] `server/services/routeOptimization.ts` - Basic optimization
- [x] `server/services/vrpSolver.ts` - Advanced VRP solver
- [x] `server/services/advancedRouteOptimization.ts` - Phase 2 backend

---

## 🔑 Environment Variables to Set on Render

```bash
# Required for Phase 1 & 2
GOOGLE_MAPS_API_KEY=your_key_here
GOOGLE_MAPS_API_KEY_SERVER=your_key_here  # Optional, falls back to GOOGLE_MAPS_API_KEY

# Client-side (already set if exists)
VITE_GOOGLE_MAPS_API_KEY=your_key_here
```

**⚠️ CRITICAL:** Both keys must be set for Phase 1 & 2 to work!

---

## 🧪 Quick Smoke Tests (3 minutes)

### Test 1: Driver Dashboard Loads
1. Go to `/driver/dashboard`
2. Should see updated UI with no console errors
3. **PASS if:** No red errors in browser console

### Test 2: Maps Load
1. Accept an order (or create test order)
2. Look for map in active delivery section
3. **PASS if:** Map appears (even blank) with no "Google Maps API key" errors

### Test 3: GPS Tracking Prompt
1. With active delivery, watch for browser prompt
2. **PASS if:** Browser asks for location permission

### Test 4: Batch Optimizer Button
1. Go to dashboard with NO active delivery
2. Wait for 2+ orders to appear
3. **PASS if:** "Smart Batch Optimizer 🚀" button appears

### Test 5: Vehicle Settings Page
1. Navigate to `/driver/vehicle-settings`
2. **PASS if:** Page loads with vehicle type buttons

---

## 🐛 Common Issues & Quick Fixes

### Issue: "Google Maps JavaScript API error"
**Solution:** Set `VITE_GOOGLE_MAPS_API_KEY` in Render environment variables

### Issue: Maps show but no tracking
**Solution:** User must allow location permission in browser

### Issue: Batch Optimizer doesn't appear
**Solution:** Need 2+ available orders AND no active delivery

### Issue: 500 error on optimization
**Solution:** Check that `GOOGLE_MAPS_API_KEY_SERVER` or `GOOGLE_MAPS_API_KEY` is set

### Issue: Build fails on Render
**Solution:** Check build logs for specific error. Most common: missing env vars or dependency issues

---

## 📊 API Endpoint Quick Tests

Use these curl commands to test backend services:

### Test Location Tracking
```bash
curl https://your-url.com/api/driver/location/current \
  -H "Cookie: connect.sid=YOUR_SESSION_COOKIE"
  
# Expected: {"lat": X, "lng": Y} or 404 if no location yet
```

### Test Basic Optimization
```bash
curl -X POST https://your-url.com/api/driver/route/batch \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=YOUR_SESSION_COOKIE" \
  -d '{
    "orderIds": [1, 2, 3],
    "optimizeFor": "time"
  }'
  
# Expected: {"batchId": "...", "route": {...}}
```

### Test Advanced Optimization (Phase 2)
```bash
curl -X POST https://your-url.com/api/driver/route/batch/advanced \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=YOUR_SESSION_COOKIE" \
  -d '{
    "orderIds": [1, 2],
    "optimizeFor": "time",
    "respectConstraints": true
  }'
  
# Expected: {"batchId": "...", "route": {...}, "constraintsViolated": []}
```

### Test Driver Capabilities (Phase 2)
```bash
curl https://your-url.com/api/driver/capabilities \
  -H "Cookie: connect.sid=YOUR_SESSION_COOKIE"
  
# Expected: {"vehicleType": "...", "maxOrders": 4, ...}
```

---

## 🎯 Success Criteria

**Phase 1 is working if:**
- ✅ Map loads during active delivery
- ✅ GPS location updates (check console)
- ✅ No critical errors in browser console
- ✅ Driver can mark orders as picked up/delivered

**Phase 2 is working if:**
- ✅ Batch Optimizer button appears (when 2+ orders)
- ✅ Clicking "Optimize" returns results
- ✅ Result modal shows route details
- ✅ Accepting batch creates active delivery
- ✅ Vehicle settings page works

---

## 📸 Screenshots to Take

1. **Driver Dashboard** - Full view with available orders
2. **Active Delivery** - LiveDeliveryTracker with map
3. **Batch Optimizer** - Opened with 2+ orders selected
4. **Optimized Result** - Modal showing route details
5. **Vehicle Settings** - Capabilities configuration page
6. **Browser Console** - No errors (or list any errors found)

---

## 🚨 Critical Blockers (STOP if you see these)

1. **500 errors on ALL optimization requests** → Backend issue, check server logs
2. **Maps never load (perpetual spinner)** → API key issue
3. **GPS tracking fails silently** → Location service not responding
4. **Accepting batch does nothing** → Order acceptance API issue
5. **Database migration failed** → Check Render logs for DB errors

---

## ✅ Final Approval Checklist

Before approving for production:
- [ ] All smoke tests pass
- [ ] No critical console errors
- [ ] Phase 1: GPS tracking works
- [ ] Phase 1: ETA updates visible
- [ ] Phase 2: Route optimization works
- [ ] Phase 2: Batch acceptance works
- [ ] Phase 2: Vehicle settings persist
- [ ] Performance acceptable (<3 sec for optimization)
- [ ] Mobile browser tested (GPS works on phone)
- [ ] At least 3 test deliveries completed successfully

---

## 📞 Need Help?

**Check these first:**
1. Browser Console (F12) → Look for red errors
2. Network Tab → Check failed API calls
3. Render Logs → Search for "error" or "failed"
4. Google Maps Console → Check API usage/quota

**Common Error Messages:**
- "This API project is not authorized" → Enable API in Google Cloud Console
- "Location permission denied" → User needs to allow location in browser
- "Failed to optimize route" → Check backend logs for details
- "Google Maps API key is invalid" → Verify key and API restrictions

---

**Last Updated:** November 9, 2025  
**Test Plan Version:** 1.0
