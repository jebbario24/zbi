# 🔍 Upload Debugging Guide for eatout.cloud

## Issue
Images upload successfully from `etitout.onrender.com` but not from `eatout.cloud`

CORS is configured correctly ✅  
But uploads still fail ❌

---

## 🧪 Step-by-Step Debugging

### Step 1: Open Browser DevTools

1. Go to `https://eatout.cloud/online-store`
2. Press **F12** to open DevTools
3. Go to **Console** tab
4. Go to **Network** tab
5. Keep both open while testing

### Step 2: Try Uploading

1. Click "Upload Logo" or "Change Logo"
2. Select an image file
3. Watch what happens in Console and Network tabs

### Step 3: Check for Errors

Look for these specific error types:

---

## 🚨 Common Error Scenarios

### Error Type 1: CORS Error
**Console shows:**
```
Access to fetch at 'https://pub-xxxxx.r2.cloudflarestorage.com/...'
from origin 'https://eatout.cloud' has been blocked by CORS policy
```

**Network tab shows:**
- Request to R2 URL
- Status: **(failed)** or **CORS error**
- Red text

**Solution:** Update CORS policy (but you already did this ✅)

---

### Error Type 2: 401 Unauthorized
**Console shows:**
```
POST https://eatout.cloud/api/objects/upload 401 (Unauthorized)
```

**Network tab shows:**
- Request to `/api/objects/upload`
- Status: **401**
- Response: `{"message": "Unauthorized"}`

**What this means:**
- You're not logged in (session not working)
- Session cookie not being sent with requests

**Solution:** See "Session Cookie Issues" section below

---

### Error Type 3: 403 Forbidden (R2)
**Console shows:**
```
PUT https://pub-xxxxx.r2.cloudflarestorage.com/... 403 (Forbidden)
```

**Network tab shows:**
- Request to R2 presigned URL
- Status: **403**

**What this means:**
- Presigned URL is invalid or expired
- Or R2 API token doesn't have write permissions

**Solution:** Check R2 API token permissions

---

### Error Type 4: Silent Failure
**Symptoms:**
- Upload dialog appears
- You select file
- Shows "Uploading..."
- Then nothing happens
- No error message
- Image doesn't appear

**Console shows:**
- No errors (or generic errors)

**Network tab shows:**
- May show successful 200 response
- But image still doesn't display

**What this means:**
- Upload might succeed, but image path not saved correctly
- Or image uploaded to wrong location
- Or R2_PUBLIC_URL is incorrect

---

### Error Type 5: Network Error
**Console shows:**
```
Failed to fetch
TypeError: Failed to fetch
```

**What this means:**
- Network issue
- DNS not resolving
- Firewall blocking requests

---

## 🍪 Session Cookie Issues

**How to check if session cookies are working:**

### Step 1: Check if you're authenticated

Open Console and run:
```javascript
fetch('/api/user', {credentials: 'include'})
  .then(r => r.json())
  .then(d => console.log('User:', d))
  .catch(e => console.log('Error:', e))
```

**Expected result:**
```json
User: {
  "id": "...",
  "email": "your@email.com",
  "role": "owner",
  ...
}
```

**If you see:**
```json
Error: 401 Unauthorized
```
→ Session cookie not working!

### Step 2: Check cookies

1. In DevTools, go to **Application** tab (Chrome) or **Storage** tab (Firefox)
2. Expand **Cookies**
3. Click on `https://eatout.cloud`
4. Look for a cookie (usually named `connect.sid`)

**If NO cookie exists:**
- Session not created
- You need to login again from eatout.cloud

**If cookie exists, check:**
- **Domain:** Should be `eatout.cloud` or `.eatout.cloud`
- **Path:** Should be `/`
- **Secure:** Should be checked (yes)
- **HttpOnly:** Should be checked (yes)
- **SameSite:** Should be `Lax` or `None`

### Step 3: Test cross-domain session

**Problem scenario:**
1. You login on `etitout.onrender.com`
2. Cookie is set for `etitout.onrender.com`
3. You go to `eatout.cloud`
4. No cookie for `eatout.cloud` → not authenticated

**Solution:**
**You MUST login separately on each domain!**

Try this:
1. **Logout** from `etitout.onrender.com`
2. Go to `https://eatout.cloud/login`
3. **Login** again (creates cookie for eatout.cloud)
4. Try uploading → should work ✅

---

## 🧪 Manual Upload Test

Test the upload API directly:

### Step 1: Get upload URL

Open Console and run:
```javascript
fetch('/api/objects/upload', {
  method: 'POST',
  credentials: 'include'
})
  .then(r => r.json())
  .then(d => {
    console.log('Upload URL:', d.uploadURL);
    console.log('Object Path:', d.objectPath);
    window.uploadData = d; // Save for next step
  })
  .catch(e => console.error('Error:', e))
```

**Expected result:**
```javascript
Upload URL: https://pub-xxxxx.r2.cloudflarestorage.com/...?X-Amz-Signature=...
Object Path: /objects/uploads/some-uuid
```

**If you get 401 Unauthorized:**
→ Not logged in on this domain!

### Step 2: Test upload to R2

```javascript
// Create a test file
const blob = new Blob(['test'], {type: 'text/plain'});

// Upload it
fetch(window.uploadData.uploadURL, {
  method: 'PUT',
  body: blob
})
  .then(r => console.log('Upload successful!', r.status))
  .catch(e => console.error('Upload failed:', e))
```

**If this works:** Upload system is fine, issue is elsewhere  
**If this fails:** R2 upload issue (check CORS, permissions)

---

## 🔧 Quick Fixes to Try

### Fix 1: Login on eatout.cloud
1. Go to `https://eatout.cloud/login`
2. Login with your credentials
3. Try upload again

### Fix 2: Clear cookies and cache
1. Press F12 → Application tab
2. Right-click on `https://eatout.cloud` under Cookies
3. Click "Clear"
4. Close DevTools
5. Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
6. Login again
7. Try upload

### Fix 3: Test in Incognito
1. Open Incognito/Private window
2. Go to `https://eatout.cloud/login`
3. Login
4. Try upload
5. If it works → cache issue in regular browser

### Fix 4: Check R2_PUBLIC_URL
The `R2_PUBLIC_URL` environment variable must be correct:

```bash
# Should be:
R2_PUBLIC_URL=https://pub-2122a21add76d5f26d687d7c453203ad.r2.cloudflarestorage.com

# NOT:
R2_PUBLIC_URL=https://eatout.cloud
```

---

## 📊 Detailed Network Tab Analysis

When upload fails, check Network tab:

### Request #1: Get Upload URL
```
POST https://eatout.cloud/api/objects/upload
```

**Check:**
- Status: Should be **200 OK**
- Response: Should have `uploadURL` and `objectPath`
- If 401: Not authenticated
- If 500: Server error (check logs)

### Request #2: Upload to R2
```
PUT https://pub-xxxxx.r2.cloudflarestorage.com/...
```

**Check:**
- Status: Should be **200 OK**
- If CORS error: CORS not configured
- If 403: Permission issue or expired presigned URL
- If 404: Bucket doesn't exist

### Request #3: Save image path
```
PUT https://eatout.cloud/api/restaurant/logo
```

**Check:**
- Status: Should be **200 OK**
- Payload: Should have `logoUrl` or `coverImageUrl`
- If 401: Not authenticated
- If 400: Missing logoUrl in request

---

## 🎯 Most Likely Causes

Based on "works from etitout.onrender.com but not eatout.cloud":

### Cause #1: Session Cookie Domain (80% likely)
You're logged in on `etitout.onrender.com`, and that session cookie doesn't work on `eatout.cloud`.

**Fix:** Login separately on `eatout.cloud`

### Cause #2: R2_PUBLIC_URL Wrong (15% likely)
If `R2_PUBLIC_URL` includes the app domain instead of the R2 domain.

**Fix:** Check environment variable is set to R2's public URL

### Cause #3: CORS Cached (5% likely)
Browser cached old CORS policy before you added `eatout.cloud`.

**Fix:** Hard refresh or test in incognito

---

## ✅ Verification Checklist

- [ ] CORS policy includes `https://eatout.cloud` ✅ (you did this)
- [ ] R2 API token has Read & Write permissions
- [ ] R2 bucket has Public Access enabled
- [ ] `R2_PUBLIC_URL` environment variable is correct R2 URL
- [ ] `BASE_URL` environment variable is `https://eatout.cloud`
- [ ] You're logged in ON `eatout.cloud` (not just on Render)
- [ ] Session cookie exists for `eatout.cloud` domain
- [ ] Upload request returns 200 (not 401)
- [ ] Upload to R2 returns 200 (not CORS error)
- [ ] Server has been restarted after env var changes

---

## 🆘 If Nothing Works

### Get detailed logs:

**Browser Console Log:**
1. Open Console
2. Try upload
3. Copy ALL console output
4. Share for analysis

**Network Tab HAR:**
1. Open Network tab
2. Try upload
3. Right-click anywhere in Network tab
4. "Save all as HAR with content"
5. Share the file (remove sensitive data first!)

**Server Logs:**
Check your hosting platform logs for errors when upload happens

---

## 💡 Pro Tip: Compare Requests

**Do this side-by-side:**

1. Open `https://etitout.onrender.com/online-store` in one browser tab
2. Open `https://eatout.cloud/online-store` in another tab
3. Open DevTools Network tab in BOTH
4. Try uploading in BOTH
5. **Compare the requests:**
   - Do they both make POST to `/api/objects/upload`?
   - Do both get 200 response?
   - Do both get a valid `uploadURL`?
   - Do both successfully PUT to R2?
   - Which step fails on eatout.cloud?

This will show you exactly where the difference is!

---

## 📞 Next Steps

After running diagnostics, you should know:

1. **Is the user authenticated?** (Check cookies)
2. **Does `/api/objects/upload` return 200?** (Check Network tab)
3. **Does the R2 PUT request succeed?** (Check Network tab)
4. **What's the exact error message?** (Check Console)

Share these findings and we can pinpoint the exact issue!
