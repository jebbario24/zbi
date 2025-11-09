# Phase 1 & 2 Testing Guide

**Date:** November 9, 2025  
**Environment:** Staging  
**Tester:** QA / Driver

---

## 🎯 Testing Objectives

Verify that:
1. Phase 1 (Real-Time Tracking) works during active deliveries
2. Phase 2 (Batch Optimization) works when selecting multiple orders
3. All UI components render correctly
4. API endpoints respond properly
5. Database migrations completed successfully

---

## ⚙️ Pre-Test Setup

### 1. Verify Deployment
- [ ] Check Render dashboard - build succeeded
- [ ] Database migration ran successfully
- [ ] All environment variables set:
  - `VITE_GOOGLE_MAPS_API_KEY`
  - `GOOGLE_MAPS_API_KEY`
  - `GOOGLE_MAPS_API_KEY_SERVER` (optional)

### 2. Check API Health
```bash
# Test basic endpoints
curl https://your-staging-url.com/api/health

# Check if driver endpoints are accessible
curl https://your-staging-url.com/api/driver/stats \
  -H "Cookie: your-session-cookie"
```

### 3. Database Verification
Verify these new tables exist:
- `driver_location_history`
- `delivery_routes`
- `delivery_batches`
- `eta_updates`
- `vehicle_types`
- `driver_capabilities`
- `route_constraints`
- `route_optimization_history`
- `delivery_predictions`
- `route_replays`

---

## 🧪 Phase 1: Real-Time Tracking Tests

### Test 1.1: Live Delivery Tracker Component
**Steps:**
1. Log in as approved driver
2. Go to driver dashboard
3. Accept an order
4. Verify LiveDeliveryTracker appears

**Expected Results:**
- ✅ Component loads without errors
- ✅ Map displays with your current location
- ✅ Restaurant marker shows (orange)
- ✅ Customer marker shows (green)
- ✅ Status card shows "Heading to Restaurant" or "Heading to Customer"
- ✅ ETA card displays with traffic badge
- ✅ Call/SMS buttons work for restaurant and customer

**Screenshot Required:** Yes (active delivery view)

---

### Test 1.2: GPS Location Tracking
**Steps:**
1. With active delivery, check browser console
2. Look for location update logs
3. Wait 10 seconds, verify another update

**Expected Results:**
- ✅ Browser prompts for location permission
- ✅ Location updates sent every ~10 seconds
- ✅ Console shows: "Location updated for driver X"
- ✅ No errors in console

**API Endpoint Test:**
```bash
# Check if location is being stored
curl https://your-url.com/api/driver/location/current \
  -H "Cookie: your-session"
  
# Expected: { "lat": X.XXXX, "lng": Y.YYYY }
```

---

### Test 1.3: Real-Time ETA Updates
**Steps:**
1. During active delivery, open Network tab
2. Look for `/api/driver/delivery/:orderId/eta` calls
3. Verify ETA changes as you move

**Expected Results:**
- ✅ ETA displayed in minutes
- ✅ Distance displayed in km or meters
- ✅ Traffic badge shows (🟢 🟡 🟠 🔴)
- ✅ ETA updates as driver moves
- ✅ Map re-centers on driver location

---

### Test 1.4: Google Maps Integration
**Steps:**
1. Click "Open in Google Maps" button
2. Verify it opens navigation app
3. Test call/SMS buttons

**Expected Results:**
- ✅ Google Maps opens with route
- ✅ Waypoints include restaurant + customer
- ✅ Call button opens phone dialer
- ✅ SMS button opens messaging app

---

### Test 1.5: Map Display & Markers
**Steps:**
1. Verify all map elements visible
2. Check traffic layer
3. Test map interactions

**Expected Results:**
- ✅ Blue dot shows driver location
- ✅ Orange marker shows restaurant
- ✅ Green marker shows customer
- ✅ Traffic layer displays (colored roads)
- ✅ Map is interactive (pan, zoom)
- ✅ Route polyline shows path

---

### Test 1.6: Status Updates
**Steps:**
1. Click "Mark as Picked Up"
2. Verify status changes
3. Click "Mark as Delivered"

**Expected Results:**
- ✅ Status updates immediately
- ✅ Badge changes color/text
- ✅ Progress bar updates
- ✅ Next action button appears
- ✅ Delivery proof modal opens on final step

---

## 🚀 Phase 2: Batch Optimization Tests

### Test 2.1: Smart Batch Optimizer Button
**Steps:**
1. Log in as driver (no active delivery)
2. Go online/available
3. Wait for 2+ orders to appear
4. Look for "Smart Batch Optimizer" button

**Expected Results:**
- ✅ Button appears when 2+ orders available
- ✅ Shows order count in badge
- ✅ Clicking shows/hides optimizer
- ✅ No button when <2 orders

**Screenshot Required:** Yes

---

### Test 2.2: Batch Optimizer UI
**Steps:**
1. Click "Smart Batch Optimizer"
2. Review the interface
3. Test all controls

**Expected Results:**
- ✅ All available orders listed
- ✅ Checkboxes work
- ✅ "Select All" button works
- ✅ "Clear" button works
- ✅ Strategy buttons work (Fastest/Shortest/Priority)
- ✅ Estimated savings shown
- ✅ Order details visible (restaurant, address, fee, distance)

---

### Test 2.3: Route Optimization
**Steps:**
1. Select 2-3 orders
2. Choose "Fastest" strategy
3. Click "Optimize X Orders"
4. Wait for result

**Expected Results:**
- ✅ Button shows "Optimizing Route..." with spinner
- ✅ Completes in <3 seconds
- ✅ Result modal opens automatically
- ✅ No errors in console

**API Endpoint Test:**
```bash
# Test optimization endpoint
curl -X POST https://your-url.com/api/driver/route/batch/advanced \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session" \
  -d '{
    "orderIds": [123, 124, 125],
    "optimizeFor": "time",
    "respectConstraints": true
  }'

# Expected: 
# {
#   "batchId": "uuid",
#   "route": { ... },
#   "constraintsViolated": []
# }
```

---

### Test 2.4: Optimized Route Result Modal
**Steps:**
1. After optimization completes
2. Review the modal content
3. Test all interactions

**Expected Results:**
- ✅ Modal displays with route info
- ✅ Performance cards show:
  - Number of orders
  - Total distance (km)
  - Total duration (min)
  - Estimated earnings ($)
- ✅ Savings alert shows (green)
- ✅ Map preview displays (if location available)
- ✅ Stop sequence shows all stops
- ✅ Arrival times displayed
- ✅ Pickup stops have orange icons
- ✅ Dropoff stops have green icons
- ✅ Quality score shown (X/100)

**Screenshot Required:** Yes (optimized result modal)

---

### Test 2.5: Batch Acceptance Flow
**Steps:**
1. In result modal, click "Accept Batch"
2. Wait for acceptance
3. Verify dashboard updates

**Expected Results:**
- ✅ Button shows "Accepting..." with spinner
- ✅ Success toast appears
- ✅ Modal closes
- ✅ Dashboard refreshes
- ✅ Active delivery appears (first order in batch)
- ✅ LiveDeliveryTracker shows
- ✅ Orders removed from available list

---

### Test 2.6: Batch Decline Flow
**Steps:**
1. Optimize orders
2. In result modal, click "Decline"
3. Verify return to optimizer

**Expected Results:**
- ✅ Modal closes
- ✅ BatchOptimizer still visible
- ✅ Selected orders remain selected
- ✅ Can optimize again with different options

---

### Test 2.7: Vehicle Settings Page
**Steps:**
1. Navigate to Driver Settings
2. Find Vehicle/Capabilities section (may need to add to nav)
3. Or go directly to `/driver/vehicle-settings`

**Expected Results:**
- ✅ Page loads without errors
- ✅ Vehicle type buttons work (Bike, Scooter, Car)
- ✅ Capacity inputs work (max orders, max weight)
- ✅ Storage switches work (cold, hot, insulated)
- ✅ Special capabilities switches work
- ✅ Save button becomes enabled when changes made
- ✅ Clicking save shows success toast
- ✅ Settings persist after refresh

**API Endpoint Test:**
```bash
# Get capabilities
curl https://your-url.com/api/driver/capabilities \
  -H "Cookie: your-session"

# Update capabilities
curl -X PUT https://your-url.com/api/driver/capabilities \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session" \
  -d '{
    "vehicleTypeId": "bike",
    "maxOrders": 2,
    "maxWeight": 10,
    "hasColdStorage": false,
    "hasHotStorage": true
  }'
```

---

### Test 2.8: Constraint Handling
**Steps:**
1. Set vehicle capacity to 2 orders (in settings)
2. Try to optimize 4 orders
3. Check result

**Expected Results:**
- ✅ Optimization completes
- ✅ Constraint violation alert shows (if violated)
- ✅ Can still accept batch if violations are warnings
- ✅ Cannot accept if hard constraints violated

---

### Test 2.9: Different Optimization Strategies
**Steps:**
1. Select same 3 orders
2. Try "Fastest" strategy - note result
3. Try "Shortest" strategy - note result
4. Try "Priority" strategy - note result

**Expected Results:**
- ✅ Different strategies give different routes
- ✅ Fastest minimizes time
- ✅ Shortest minimizes distance
- ✅ Priority handles high-priority orders first
- ✅ Results show different scores/savings

---

## 🔍 Edge Cases & Error Handling

### Test 3.1: No Location Permission
**Steps:**
1. Block location permission in browser
2. Try to start delivery

**Expected Results:**
- ✅ Error alert shows: "Location permission denied"
- ✅ Instructions to enable location
- ✅ App doesn't crash

---

### Test 3.2: Offline Mode
**Steps:**
1. Start delivery
2. Turn off internet
3. Turn back on

**Expected Results:**
- ✅ Offline indicator shows
- ✅ Location updates queue
- ✅ Sync happens when back online
- ✅ No data loss

---

### Test 3.3: No Google Maps API Key
**Steps:**
1. Check browser console for API errors
2. Verify maps still attempt to load

**Expected Results:**
- ✅ If no key: Error message shows
- ✅ If invalid key: "Failed to load Google Maps"
- ✅ Rest of app still works
- ✅ No infinite loading spinners

---

### Test 3.4: Large Batch (8+ orders)
**Steps:**
1. Select 8 orders for optimization
2. Click optimize

**Expected Results:**
- ✅ Optimization completes (may take 3-5 seconds)
- ✅ Route shows all stops
- ✅ Modal scrollable if too tall
- ✅ Performance acceptable

---

### Test 3.5: Constraint Violations
**Steps:**
1. Set max orders to 2
2. Try to optimize 5 orders

**Expected Results:**
- ✅ Optimization completes
- ✅ Red alert shows violations
- ✅ Lists specific violations
- ✅ Can still decline batch

---

## 📊 Performance Checks

### Test 4.1: Page Load Time
- [ ] Driver dashboard loads in <2 seconds
- [ ] Maps load in <3 seconds
- [ ] No layout shift when components load

### Test 4.2: Optimization Speed
- [ ] 2 orders: <1 second
- [ ] 4 orders: <2 seconds
- [ ] 8 orders: <5 seconds

### Test 4.3: Location Update Frequency
- [ ] Updates sent every 10 seconds ±2 seconds
- [ ] No duplicate updates
- [ ] Battery drain acceptable on mobile

### Test 4.4: Memory Usage
- [ ] Check browser Task Manager
- [ ] No memory leaks during long delivery
- [ ] Map doesn't consume excessive RAM

---

## 🐛 Known Issues & Workarounds

### Issue 1: Maps Not Loading
**Symptom:** Blank map area  
**Check:** Browser console for API key errors  
**Fix:** Verify `VITE_GOOGLE_MAPS_API_KEY` is set in Render

### Issue 2: Location Not Updating
**Symptom:** Blue dot doesn't move  
**Check:** Browser console for Geolocation errors  
**Fix:** Ensure HTTPS enabled, check location permissions

### Issue 3: Optimization Fails
**Symptom:** "Failed to optimize route" error  
**Check:** Network tab for API response  
**Fix:** Verify driver location available, orders have valid coordinates

### Issue 4: Batch Accept Does Nothing
**Symptom:** Click accept, nothing happens  
**Check:** Browser console for errors  
**Fix:** Verify orders are still available, not already accepted

---

## ✅ Test Results Summary

### Phase 1: Real-Time Tracking
- [ ] Test 1.1: Live Delivery Tracker ___/___
- [ ] Test 1.2: GPS Tracking ___/___
- [ ] Test 1.3: ETA Updates ___/___
- [ ] Test 1.4: Google Maps ___/___
- [ ] Test 1.5: Map Display ___/___
- [ ] Test 1.6: Status Updates ___/___

**Phase 1 Status:** ⬜ Pass / ⬜ Fail / ⬜ Partial

---

### Phase 2: Batch Optimization
- [ ] Test 2.1: Optimizer Button ___/___
- [ ] Test 2.2: Optimizer UI ___/___
- [ ] Test 2.3: Route Optimization ___/___
- [ ] Test 2.4: Result Modal ___/___
- [ ] Test 2.5: Batch Acceptance ___/___
- [ ] Test 2.6: Batch Decline ___/___
- [ ] Test 2.7: Vehicle Settings ___/___
- [ ] Test 2.8: Constraints ___/___
- [ ] Test 2.9: Strategies ___/___

**Phase 2 Status:** ⬜ Pass / ⬜ Fail / ⬜ Partial

---

### Edge Cases
- [ ] Test 3.1: No Location ___/___
- [ ] Test 3.2: Offline Mode ___/___
- [ ] Test 3.3: No API Key ___/___
- [ ] Test 3.4: Large Batch ___/___
- [ ] Test 3.5: Violations ___/___

---

## 🚨 Critical Blockers

**If these fail, DO NOT deploy to production:**
1. [ ] GPS tracking not working at all
2. [ ] Optimization endpoint returns 500 errors
3. [ ] Batch acceptance doesn't work
4. [ ] Maps never load
5. [ ] Database migration failed

---

## 📝 Test Notes

**Tester:**  
**Date:**  
**Environment:**  
**Browser:**  
**Device:**  

**Overall Assessment:**  
⬜ Ready for Production  
⬜ Needs Minor Fixes  
⬜ Needs Major Fixes  

**Bugs Found:**
1. 
2. 
3. 

**Comments:**


---

## 🔗 Quick Test URLs

```
Driver Dashboard: https://your-url.com/driver/dashboard
Vehicle Settings: https://your-url.com/driver/vehicle-settings
```

## 🛠️ Debug Commands

```bash
# Check if optimization service running
curl -X POST https://your-url.com/api/driver/route/batch/advanced \
  -H "Content-Type: application/json" \
  -d '{"orderIds":[1,2], "optimizeFor":"time"}'

# Check location tracking
curl https://your-url.com/api/driver/location/current

# View recent logs (Render dashboard)
# Settings → Logs → Filter by "error" or "optimization"
```

---

**Good luck testing! 🚀**
