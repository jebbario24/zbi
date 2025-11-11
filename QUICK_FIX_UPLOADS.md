# 🚨 QUICK FIX: Image Uploads Not Working

## The Problem
Restaurant logos, cover images, and menu item photos won't upload for new accounts.

## Root Cause
**Missing Cloudflare R2 storage credentials**

Your code expects these environment variables but they're NOT set:
```bash
R2_ACCOUNT_ID           ❌ Missing
R2_ACCESS_KEY_ID        ❌ Missing
R2_SECRET_ACCESS_KEY    ❌ Missing
R2_BUCKET_NAME          ❌ Missing
R2_PUBLIC_URL           ❌ Missing
```

---

## ⚡ Quick Fix (5 Minutes)

### 1. Create Cloudflare R2 Bucket
- Go to https://dash.cloudflare.com/
- Click **R2** → **Create bucket**
- Name: `eatout-storage`
- Click **Create**

### 2. Get API Credentials
- Click **Manage R2 API Tokens**
- Click **Create API Token**
- Name: "EatOut Production"
- Permissions: **Object Read & Write**
- **Copy the credentials** (shown only once!)

### 3. Enable Public Access
- Go to bucket → **Settings**
- Find **Public Access** section
- Click **Allow Access**
- **Copy the Public URL** (e.g., `https://pub-xxxxx.r2.dev`)

### 4. Add to Production Environment

**Render.com:**
```
Dashboard → Your Service → Environment → Add Variables
```

**Railway:**
```
Project → Variables → Add Variables
```

**Add these:**
```bash
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=eatout-storage
R2_PUBLIC_URL=https://pub-xxxxx.r2.dev
```

### 5. Restart Server
Service will auto-restart. Wait 1-2 minutes.

### 6. Test Upload
- Go to `/online-store`
- Upload a restaurant logo
- ✅ Should work now!

---

## 📖 Detailed Guide
See `IMAGE_UPLOAD_SETUP.md` for:
- Full step-by-step instructions
- CORS configuration
- Troubleshooting tips
- Cost estimates (FREE for most cases!)

---

## 🆘 Still Broken?

**Check if variables loaded:**
1. Check server logs for: `✅ Environment variables validated successfully`
2. If you see `❌ Missing required environment variables`, the vars aren't loaded

**CORS Error?**
Add CORS policy to R2 bucket (see detailed guide)

**403 Forbidden?**
- Verify API token has **Read & Write** permissions
- Check bucket has **Public Access** enabled

---

## Why R2?
- ✅ **FREE** for most restaurant usage
- ✅ **No egress fees** (unlike AWS S3)
- ✅ **Fast CDN** (Cloudflare global network)
- ✅ **S3-compatible** (works with existing code)
