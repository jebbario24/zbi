# Google OAuth Troubleshooting Guide

## ❌ Error: redirect_uri_mismatch

This error occurs when the redirect URI in your app doesn't match what's configured in Google Cloud Console.

---

## 🔍 Step-by-Step Diagnosis

### 1. Check Your Current BASE_URL

**Where to check:**
- Render.com: Dashboard → Your Service → Environment tab
- Railway: Project → Variables tab  
- Vercel: Project Settings → Environment Variables
- Heroku: Settings → Config Vars

**What it should be:**
```bash
BASE_URL=https://eatout.cloud
```

**NOT:**
```bash
BASE_URL=https://etitout.onrender.com  ❌
```

---

### 2. Check Google Cloud Console

Go to: [Google Cloud Console](https://console.cloud.google.com/)

**Navigate to:** APIs & Services → Credentials → Your OAuth 2.0 Client ID

**Authorized redirect URIs should include:**

✅ **Primary Domain (Required):**
```
https://eatout.cloud/api/auth/google/callback
https://eatout.cloud/api/auth/google/driver/callback
```

✅ **Secondary Domain (Optional - if you use both):**
```
https://etitout.onrender.com/api/auth/google/callback
https://etitout.onrender.com/api/auth/google/driver/callback
```

✅ **With www (If you use www subdomain):**
```
https://www.eatout.cloud/api/auth/google/callback
https://www.eatout.cloud/api/auth/google/driver/callback
```

✅ **Development (For testing):**
```
http://localhost:5000/api/auth/google/callback
http://localhost:5000/api/auth/google/driver/callback
```

---

### 3. Common Mistakes

❌ **Wrong Protocol:**
```
http://eatout.cloud  (should be https://)
```

❌ **Trailing Slash:**
```
https://eatout.cloud/api/auth/google/callback/  (no trailing slash!)
```

❌ **Wrong Path:**
```
https://eatout.cloud/auth/google/callback  (missing /api/)
```

❌ **Missing Driver Callback:**
```
Only added /api/auth/google/callback but forgot /api/auth/google/driver/callback
```

---

## ✅ Complete Fix Checklist

### Step 1: Update Production Environment Variable
- [ ] Go to your hosting platform (Render, Railway, etc.)
- [ ] Find `BASE_URL` environment variable
- [ ] Change it to `https://eatout.cloud`
- [ ] Save changes (server will restart)

### Step 2: Update Google Cloud Console
- [ ] Go to Google Cloud Console
- [ ] Navigate to APIs & Services → Credentials
- [ ] Click your OAuth 2.0 Client ID
- [ ] Add all redirect URIs (see section 2 above)
- [ ] Click "Save"
- [ ] Wait 5-10 minutes for changes to propagate

### Step 3: Test
- [ ] Clear browser cache and cookies
- [ ] Go to `https://eatout.cloud/login`
- [ ] Click "Sign in with Google"
- [ ] Should redirect to Google login
- [ ] After login, should redirect back to eatout.cloud
- [ ] Should be logged in successfully

---

## 🔧 Advanced Troubleshooting

### Check What URL Is Being Used

Add this to your `server/auth.ts` temporarily:

```typescript
console.log('🔍 OAuth Callback URL:', `${getBaseUrl()}/api/auth/google/callback`);
```

Restart your server and check the logs to see what URL is actually being used.

### Multiple Domains Setup

If you want to support multiple domains, you have two options:

**Option A: Use Dynamic Redirect URL**

Modify `server/auth.ts` to use the request's host:

```typescript
callbackURL: (req) => {
  const protocol = req.secure ? 'https' : 'http';
  return `${protocol}://${req.get('host')}/api/auth/google/callback`;
}
```

Then add ALL your domains to Google Cloud Console.

**Option B: Use BASE_URL with Fallback (Current)**

Keep current setup but set `BASE_URL` to your primary domain and add all domains to Google Cloud Console.

---

## 🚨 Emergency Quick Fix

If you need it to work immediately from **etitout.onrender.com**:

1. **Don't change BASE_URL** (leave it as `https://etitout.onrender.com`)
2. **Add this to Google Cloud Console:**
   ```
   https://etitout.onrender.com/api/auth/google/callback
   https://etitout.onrender.com/api/auth/google/driver/callback
   ```
3. **Test from:** `https://etitout.onrender.com/login`

Then later, you can:
1. Change BASE_URL to `https://eatout.cloud`
2. Add eatout.cloud URLs to Google Cloud Console
3. Setup DNS redirect from etitout.onrender.com to eatout.cloud

---

## 📞 Still Not Working?

### Check Server Logs

Look for errors in your server logs:
- Render: Dashboard → Logs tab
- Railway: Deployments → View logs
- Vercel: Deployment → Function logs

### Verify Environment Variables Loaded

Add this to `server/index.ts` temporarily:

```typescript
console.log('🔍 BASE_URL:', getBaseUrl());
console.log('🔍 GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? '✅ Set' : '❌ Missing');
```

### Test with Incognito/Private Window

Sometimes cached OAuth data causes issues. Always test in a fresh incognito window.

### Check DNS

Make sure `eatout.cloud` actually points to your server:

```bash
nslookup eatout.cloud
```

Should return your server's IP address.

---

## 📝 Notes

- Google OAuth changes can take 5-10 minutes to propagate
- Always clear browser cache after making changes
- You can have multiple redirect URIs (add all domains you use)
- The BASE_URL environment variable must match your primary domain
- Make sure your OAuth consent screen has your email as a test user (if not published)

---

## ✅ Success Criteria

You'll know it's working when:
1. Clicking "Sign in with Google" redirects to Google login
2. After logging in with Google, it redirects back to your app
3. You're logged in successfully
4. No error messages appear
5. Your profile picture and name appear in the UI
