# 🗺️ Google Maps API Setup Guide

## Step 1: Get Your Google Maps API Key

### Create a Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Name it something like "EatOut Delivery Platform"

### Enable Required APIs
Enable these APIs in your project:
- ✅ **Maps JavaScript API** (for frontend maps)
- ✅ **Directions API** (for route calculation)
- ✅ **Distance Matrix API** (for batch distance calculations)
- ✅ **Geocoding API** (for address → coordinates)
- ✅ **Places API** (for address autocomplete)
- ✅ **Roads API** (optional: snap GPS points to roads)

### Create API Keys
1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **API Key**
3. Create **TWO** keys:
   - **Frontend Key** (restricted to your domain)
   - **Server Key** (restricted to server IP, no HTTP referrer)

### Secure Your Keys

#### Frontend Key Restrictions:
- **Application restrictions:** HTTP referrers (websites)
- **Website restrictions:** Add your domains:
  - `http://localhost:*`
  - `https://yourdomain.com/*`
  - `https://*.yourdomain.com/*`
- **API restrictions:** Restrict to:
  - Maps JavaScript API
  - Places API
  - Geocoding API

#### Server Key Restrictions:
- **Application restrictions:** IP addresses
- **IP restrictions:** Add your server IPs
- **API restrictions:** Restrict to:
  - Directions API
  - Distance Matrix API
  - Geocoding API
  - Roads API

## Step 2: Add to Environment Variables

### Add to `.env` file:
```env
# Google Maps API Keys
GOOGLE_MAPS_API_KEY=AIzaSy...your-frontend-key-here
GOOGLE_MAPS_API_KEY_SERVER=AIzaSy...your-server-key-here

# If you only have one key (development), use the same for both:
# GOOGLE_MAPS_API_KEY=AIzaSy...your-key-here
```

### For Production (Render/Vercel/etc):
Add these as environment variables in your hosting dashboard.

## Step 3: Set Up Billing

**Important:** Google Maps APIs require a billing account!

1. Go to **Billing** in Google Cloud Console
2. Link a credit card
3. **Don't worry:** Google provides:
   - **$200 free credits per month**
   - Most small/medium apps stay within free tier

### Cost Estimate:
With 10,000 active drivers and heavy usage:
- Directions API: ~$2,000-3,000/month
- Distance Matrix: ~$1,500-2,000/month
- Geocoding: ~$500-1,000/month
- **Total:** $4,000-6,000/month

**Optimization strategies included to reduce costs by 50-70%!**

## Step 4: Test Your Setup

### Test Frontend Key:
```javascript
// In browser console
fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=1600+Amphitheatre+Parkway,+Mountain+View,+CA&key=YOUR_KEY`)
  .then(r => r.json())
  .then(console.log);
```

### Test Server Key:
```bash
curl "https://maps.googleapis.com/maps/api/directions/json?origin=Toronto&destination=Montreal&key=YOUR_SERVER_KEY"
```

## Step 5: Monitor Usage

1. Go to **APIs & Services** → **Dashboard**
2. Click on each API to see usage
3. Set up **Quota alerts** to warn at 80% usage
4. Set **daily quota limits** to prevent surprise bills

## Cost Optimization Tips

### 1. Cache Aggressively
- Cache geocoding results (address → coordinates)
- Cache distance matrix results for common routes
- Store routes in database for 24 hours

### 2. Batch Requests
- Use Distance Matrix API for multiple destinations
- Batch geocoding requests
- Combine nearby requests

### 3. Use Alternatives When Possible
- Use database calculations for simple distance (Haversine formula)
- Only use Google Maps for:
  - Route optimization
  - Traffic-aware routing
  - Turn-by-turn directions

### 4. Set Request Limits
- Limit map reloads to every 5 seconds (not real-time)
- Only fetch routes when driver accepts order
- Cache static routes

### Expected Monthly Costs by Scale:

| Scale | Drivers | Orders/Day | Est. Cost | Free Tier |
|-------|---------|------------|-----------|-----------|
| Small | 100 | 500 | $50 | ✅ Covered |
| Medium | 1,000 | 5,000 | $500 | ❌ Pay |
| Large | 10,000 | 50,000 | $5,000 | ❌ Pay |

## Development Mode (Free)

For development without billing:
1. Use the $200/month free credits
2. Implement request throttling
3. Cache everything
4. Mock responses for testing

## Troubleshooting

### "This API key is not authorized to use this service"
- Check that the API is enabled in your project
- Verify key restrictions aren't too strict
- Wait 5 minutes after creating key (propagation time)

### "You must enable Billing"
- Add a credit card to Google Cloud project
- Even with free tier, billing must be enabled

### "API key not valid. Please pass a valid API key"
- Check key is copied correctly (no spaces)
- Verify environment variable is loaded
- Test key in browser/curl first

## Next Steps

Once setup:
1. Test the API in Postman/curl
2. Verify both keys work independently
3. Check billing dashboard shows usage
4. Implement caching layer
5. Set up monitoring alerts

**You're ready to build! 🚀**
