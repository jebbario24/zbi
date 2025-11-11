# 🔴 URGENT: CORS Issue with Custom Domain

## The Problem

**Images upload successfully from:** `https://etitout.onrender.com` ✅  
**Images DON'T upload from:** `https://eatout.cloud` ❌

## Root Cause

Your Cloudflare R2 bucket's **CORS policy** only allows uploads from `etitout.onrender.com`, but NOT from your custom domain `eatout.cloud`.

When the browser tries to upload from `eatout.cloud`, the R2 bucket blocks it with a CORS error.

---

## 🔍 How to Verify the Issue

Open your browser's Developer Tools (F12) when trying to upload from `eatout.cloud`:

**Console tab will show:**
```
Access to fetch at 'https://pub-xxxxx.r2.cloudflarestorage.com/...' 
from origin 'https://eatout.cloud' has been blocked by CORS policy: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

**Network tab will show:**
- Upload request to R2 URL
- Status: **FAILED** or **CORS error**
- Red text indicating CORS block

---

## ✅ THE FIX: Update R2 CORS Policy

### Step 1: Go to Cloudflare R2 Dashboard

1. Go to https://dash.cloudflare.com/
2. Click **R2** in the left sidebar
3. Click on your bucket (e.g., `eatout-storage`)
4. Click **Settings** tab

### Step 2: Update CORS Policy

1. Scroll down to **CORS Policy** section
2. Click **Edit CORS policy** or **Add CORS policy**

### Step 3: Add This CORS Configuration

**Replace** the existing policy with this:

```json
[
  {
    "AllowedOrigins": [
      "https://eatout.cloud",
      "https://www.eatout.cloud",
      "https://etitout.onrender.com",
      "http://localhost:5000",
      "http://localhost:3000"
    ],
    "AllowedMethods": [
      "GET",
      "PUT",
      "POST",
      "DELETE",
      "HEAD"
    ],
    "AllowedHeaders": [
      "*"
    ],
    "ExposeHeaders": [
      "ETag",
      "Content-Length",
      "Content-Type"
    ],
    "MaxAgeSeconds": 3600
  }
]
```

### Step 4: Save Changes

Click **Save** or **Update CORS policy**

### Step 5: Test Immediately

CORS changes take effect **immediately** (no waiting needed):

1. Go to `https://eatout.cloud/online-store`
2. Try uploading a restaurant logo
3. ✅ Should work now!

---

## 🎯 What Each Field Does

**AllowedOrigins:**
- Lists all domains that can upload to this R2 bucket
- **MUST include `https://eatout.cloud`** (your custom domain)
- Also include `www` subdomain if you use it
- Include Render domain for backwards compatibility
- Include localhost for local development

**AllowedMethods:**
- `GET` - Download/view images
- `PUT` - Upload images (presigned URLs)
- `POST` - Alternative upload method
- `DELETE` - Delete images (if needed)
- `HEAD` - Check if file exists

**AllowedHeaders:**
- `*` - Allow all headers (simplest, most compatible)
- Alternatively, you can specify: `["Content-Type", "Content-Length", "Authorization"]`

**ExposeHeaders:**
- Headers that JavaScript can read from responses
- `ETag` - File hash/version identifier
- Important for caching and upload verification

**MaxAgeSeconds:**
- How long browser caches the CORS preflight response
- `3600` = 1 hour (good balance)

---

## 🔒 Security Note

**This is safe because:**
- Only YOUR domains are in the allowed origins list
- Presigned URLs are temporary (15 minutes expiry)
- Users can only upload to paths authorized by your backend
- The backend controls which files get presigned URLs
- ACL policies still apply (private files stay private)

---

## 🚨 Common Mistakes to Avoid

### ❌ Wrong: Missing `https://`
```json
"AllowedOrigins": [
  "eatout.cloud"  // WRONG - missing protocol
]
```

### ✅ Correct: Include full URL
```json
"AllowedOrigins": [
  "https://eatout.cloud"  // CORRECT
]
```

### ❌ Wrong: Trailing slash
```json
"AllowedOrigins": [
  "https://eatout.cloud/"  // WRONG - has trailing slash
]
```

### ✅ Correct: No trailing slash
```json
"AllowedOrigins": [
  "https://eatout.cloud"  // CORRECT
]
```

### ❌ Wrong: Wildcard in AllowedOrigins (with credentials)
```json
"AllowedOrigins": ["*"]  // WRONG - doesn't work with credentials
```

### ✅ Correct: Specific domains
```json
"AllowedOrigins": [
  "https://eatout.cloud",
  "https://etitout.onrender.com"
]
```

---

## 🧪 Testing After Fix

### Test 1: Restaurant Logo Upload
1. Login to `https://eatout.cloud/login`
2. Go to `/online-store`
3. Upload restaurant logo
4. ✅ Should upload successfully
5. ✅ Image should display immediately

### Test 2: Menu Item Image
1. Go to `/menu`
2. Add new item or edit existing
3. Upload menu item photo
4. ✅ Should work

### Test 3: Cover Image
1. Go to `/online-store`
2. Upload cover image
3. ✅ Should work

### Test 4: Verify from Both Domains
- ✅ Upload from `https://eatout.cloud` - should work
- ✅ Upload from `https://etitout.onrender.com` - should still work
- ✅ Images viewable from storefront

---

## 🔍 Still Not Working?

### Check Browser Console for CORS Errors

**If you see:**
```
CORS policy: No 'Access-Control-Allow-Origin' header
```
→ CORS policy not applied yet, or wrong origin

**If you see:**
```
CORS policy: The 'Access-Control-Allow-Origin' header contains 
multiple values '*, https://eatout.cloud', but only one is allowed.
```
→ You have conflicting CORS rules (duplicate policies)

**If you see:**
```
403 Forbidden
```
→ Not a CORS issue - check R2 API token permissions

### Verify CORS Policy Was Saved

1. Go back to R2 bucket → Settings
2. Check CORS Policy section
3. Should show your JSON configuration
4. If empty, it wasn't saved - try again

### Clear Browser Cache

Sometimes browsers cache CORS preflight responses:
1. Open DevTools (F12)
2. Right-click the refresh button
3. Select "Empty Cache and Hard Reload"
4. Try upload again

### Test in Incognito/Private Window

Opens a fresh browser session without cached CORS data:
1. Open incognito window (Ctrl+Shift+N or Cmd+Shift+N)
2. Login to `https://eatout.cloud`
3. Try uploading
4. Should work if CORS is fixed

---

## 🌐 Multiple Domains? Add All of Them!

If you use multiple domains or subdomains:

```json
"AllowedOrigins": [
  "https://eatout.cloud",
  "https://www.eatout.cloud",
  "https://app.eatout.cloud",
  "https://staging.eatout.cloud",
  "https://etitout.onrender.com",
  "http://localhost:5000",
  "http://localhost:3000"
]
```

**Include:**
- ✅ Main domain (`eatout.cloud`)
- ✅ www subdomain (`www.eatout.cloud`) if you use it
- ✅ Any subdomains (`app.`, `staging.`, etc.)
- ✅ Original Render domain (for backwards compatibility)
- ✅ Localhost domains (for development)

---

## 📱 Mobile/PWA Considerations

If you have a PWA (Progressive Web App):

The PWA may run from a different origin:
- iOS: `capacitor://` or `ionic://`
- Android: `http://localhost` or custom scheme

If uploads don't work in PWA, you may need to add:
```json
"AllowedOrigins": [
  "capacitor://localhost",
  "http://localhost"
]
```

But for web-based PWAs, the regular domain should work.

---

## ✅ Verification Checklist

After applying the fix:

- [ ] CORS policy updated in R2 bucket settings
- [ ] `https://eatout.cloud` added to AllowedOrigins
- [ ] CORS policy saved successfully
- [ ] Browser cache cleared
- [ ] Tested upload from `https://eatout.cloud` - works ✅
- [ ] Tested upload from `https://etitout.onrender.com` - still works ✅
- [ ] Images display correctly on storefront
- [ ] No CORS errors in browser console
- [ ] All 3 image types work (logo, cover, menu items)

---

## 🎓 Understanding CORS

**What is CORS?**
Cross-Origin Resource Sharing - a browser security feature that restricts web pages from making requests to a different domain than the one serving the web page.

**Why does it matter?**
When your frontend (`eatout.cloud`) tries to upload to R2 (`pub-xxxxx.r2.cloudflarestorage.com`), the browser sees this as a "cross-origin" request and blocks it unless R2 explicitly allows it.

**The CORS Preflight:**
Before uploading, the browser sends a "preflight" request (OPTIONS method) asking: "Is this origin allowed?" R2 responds with allowed origins, methods, and headers. If your domain isn't in the list, the browser blocks the upload.

**Why it worked from Render but not custom domain:**
Your CORS policy probably had `etitout.onrender.com` but not `eatout.cloud`, so only the Render domain was allowed.

---

## 📞 Need Help?

If you're still having issues after updating CORS:

1. **Share the CORS error** from browser console
2. **Check R2 dashboard** - verify CORS policy is saved
3. **Try from both domains** - does either work?
4. **Check Network tab** - what's the response status?
5. **Verify R2 public URL** - is `R2_PUBLIC_URL` environment variable correct?

---

## 🚀 Success!

Once CORS is configured correctly, uploads will work from:
- ✅ `https://eatout.cloud` (your custom domain)
- ✅ `https://www.eatout.cloud` (if you use www)
- ✅ `https://etitout.onrender.com` (original domain)
- ✅ `http://localhost:5000` (local development)

All restaurant owners will be able to upload their logos, cover images, and menu item photos! 🎉
