# Google OAuth Configuration Fix

## Problem
When logging in with Google OAuth from custom domain `eatout.cloud`, you receive:
```
Error 400: redirect_uri_mismatch
```

## What Was Fixed in Code

### 1. Updated `server/auth.ts`
- Changed `callbackURL` from relative path to absolute URL
- Restaurant owners: `https://eatout.cloud/api/auth/google/callback`
- Drivers: `https://eatout.cloud/api/auth/google/driver/callback`

### 2. Updated `server/env.ts`
- Changed production fallback BASE_URL from `https://etitout.onrender.com` to `https://eatout.cloud`

---

## Google Cloud Console Configuration Required

You need to add authorized redirect URIs in your Google Cloud Console:

### Step-by-Step Instructions:

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com/

2. **Select Your Project**
   - Select the project named "Eatout" (or whatever you named it)

3. **Navigate to OAuth Consent Screen**
   - Left sidebar → "APIs & Services" → "OAuth consent screen"
   - Make sure app is configured and published (or in testing mode with your email whitelisted)

4. **Go to Credentials**
   - Left sidebar → "APIs & Services" → "Credentials"
   - Click on your OAuth 2.0 Client ID

5. **Add Authorized Redirect URIs**
   Add these URIs to the "Authorized redirect URIs" section:

   **For Production (Custom Domain):**
   ```
   https://eatout.cloud/api/auth/google/callback
   https://eatout.cloud/api/auth/google/driver/callback
   ```

   **For Development (if needed):**
   ```
   http://localhost:5000/api/auth/google/callback
   http://localhost:5000/api/auth/google/driver/callback
   ```

   **For Other Domains (if you use them):**
   ```
   https://etitout.onrender.com/api/auth/google/callback
   https://etitout.onrender.com/api/auth/google/driver/callback
   ```

6. **Save Changes**
   - Click "Save" at the bottom

7. **Wait for Propagation**
   - Changes may take 5-10 minutes to propagate
   - Sometimes instant, sometimes takes a few minutes

---

## Environment Variable Configuration

Make sure your `.env` file (or hosting environment) has:

```bash
# Set your primary domain
BASE_URL=https://eatout.cloud

# Google OAuth Credentials
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
```

**Important:** The `BASE_URL` environment variable takes precedence over the hardcoded fallback. Set this in your production environment!

---

## Testing

After making the changes:

1. **Clear your browser cache** and cookies for `eatout.cloud`
2. **Try logging in again** with Google
3. **Check the redirect URL** in the browser's address bar during OAuth flow
4. **Verify** it matches what you added in Google Cloud Console

---

## Common Issues

### Still Getting Error After Adding URIs?
- Wait 5-10 minutes for Google's systems to propagate changes
- Try in an incognito/private window
- Double-check there are no typos in the URIs (https vs http, trailing slashes, etc.)

### Multiple Domains?
If you use multiple domains (e.g., `eatout.cloud`, `www.eatout.cloud`, staging domains), add ALL of them to Google Cloud Console:
```
https://eatout.cloud/api/auth/google/callback
https://www.eatout.cloud/api/auth/google/callback
https://staging.eatout.cloud/api/auth/google/callback
```

### OAuth Consent Screen Issues?
If your app is not published:
- Go to "OAuth consent screen"
- Add your test users (including jebbario20@gmail.com)
- Or publish the app (requires verification for sensitive scopes)

---

## Deployment Steps

After code changes:

```bash
# 1. Commit the changes
git add server/auth.ts server/env.ts
git commit -m "Fix Google OAuth redirect URI for custom domain"

# 2. Deploy to production
git push origin main  # or your deployment branch

# 3. Set BASE_URL environment variable on your hosting platform
# Example for Render.com:
# Dashboard → Your Service → Environment → Add: BASE_URL=https://eatout.cloud

# 4. Restart your server
```

---

## Verification Checklist

- [ ] Code updated in `server/auth.ts` with absolute URLs
- [ ] Code updated in `server/env.ts` with correct fallback
- [ ] Google Cloud Console redirect URIs added
- [ ] `BASE_URL` environment variable set in production
- [ ] Application redeployed
- [ ] Tested login from `eatout.cloud`
- [ ] No more redirect_uri_mismatch error

---

## Need More Help?

If you still encounter issues:
1. Check server logs for the actual redirect URL being used
2. Compare it exactly with what's in Google Cloud Console
3. Verify GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are correct
4. Make sure BASE_URL environment variable is set correctly
