# Image Upload Setup Guide

## Problem
Restaurant logos, cover images, and menu item photos are not uploading.

## Root Cause
The application uses **Cloudflare R2** (S3-compatible object storage) for image uploads, but the required environment variables are **not configured** in production.

---

## ✅ Solution: Configure Cloudflare R2 Storage

### Why R2?
- **Free tier:** 10 GB storage, 1 million Class A operations/month
- **No egress fees:** Unlike AWS S3
- **S3-compatible:** Works with existing S3 SDKs
- **Fast global CDN:** Built-in Cloudflare CDN

---

## 🚀 Step-by-Step Setup

### Step 1: Create Cloudflare R2 Bucket

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Click **R2** in the left sidebar
   - If you don't see it, you may need to enable R2 first
3. Click **Create bucket**
4. **Bucket name:** `eatout-storage` (or your preferred name)
5. **Location:** Choose closest to your users (or leave Auto)
6. Click **Create bucket**

---

### Step 2: Create R2 API Token

1. In R2 dashboard, click **Manage R2 API Tokens**
2. Click **Create API Token**
3. **Token name:** `EatOut Production`
4. **Permissions:** Select **Object Read & Write**
5. **Optional:** Specify TTL (token expiration) or leave unlimited
6. **Optional:** Apply to specific buckets only (select `eatout-storage`)
7. Click **Create API Token**

**🚨 IMPORTANT:** Copy these credentials immediately (shown only once):
```
Access Key ID: xxxxxxxxxxxxxxxxxxxxx
Secret Access Key: yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy
```

Also note your **Account ID** (shown in R2 overview page).

---

### Step 3: Enable Public Access

Your bucket needs public access so images can be viewed by customers:

1. Go to your bucket → **Settings** tab
2. Scroll to **Public Access** section
3. Click **Allow Access** (or **Connect Domain**)
4. You'll get a **Public Bucket URL** like:
   ```
   https://pub-a1b2c3d4e5f6.r2.dev
   ```
5. **Copy this URL** - you'll need it for `R2_PUBLIC_URL`

**Optional - Custom Domain:**
If you want to use a custom domain (e.g., `cdn.eatout.cloud`):
1. Add a DNS record (CNAME) pointing to your R2 bucket
2. In bucket settings, add the custom domain
3. Use that as your `R2_PUBLIC_URL`

---

### Step 4: Configure CORS (Important!)

To allow uploads from your frontend, configure CORS:

1. In your bucket, go to **Settings** → **CORS Policy**
2. Add this policy:

```json
[
  {
    "AllowedOrigins": [
      "https://eatout.cloud",
      "https://www.eatout.cloud",
      "http://localhost:5000"
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
      "ETag"
    ],
    "MaxAgeSeconds": 3600
  }
]
```

Replace `https://eatout.cloud` with your actual domain(s).

---

### Step 5: Add Environment Variables to Production

**For Render.com:**
1. Go to https://dashboard.render.com/
2. Select your service
3. Go to **Environment** tab
4. Add these variables:

```bash
R2_ACCOUNT_ID=your_cloudflare_account_id
R2_ACCESS_KEY_ID=your_r2_access_key_id
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
R2_BUCKET_NAME=eatout-storage
R2_PUBLIC_URL=https://pub-xxxxx.r2.dev
PRIVATE_OBJECT_DIR=private
```

5. Click **Save Changes**

**For Railway:**
1. Go to your project
2. Click **Variables** tab
3. Add the same variables as above

**For Vercel:**
1. Project Settings → Environment Variables
2. Add the same variables

---

### Step 6: Restart Your Server

After adding environment variables, your server will restart automatically (Render, Railway) or you may need to redeploy (Vercel).

---

## 🧪 Testing

After setup, test the uploads:

### Test 1: Restaurant Logo
1. Go to `/online-store` page
2. Scroll to "Restaurant Logo" section
3. Click "Upload Logo" or "Change Logo"
4. Upload an image (JPG or PNG, max 5MB)
5. ✅ Image should upload and display immediately

### Test 2: Restaurant Cover Image
1. Same page, scroll to "Cover Image" section
2. Click "Upload Cover Image"
3. Upload an image
4. ✅ Should work

### Test 3: Menu Item Images
1. Go to `/menu` page
2. Click "Add Item" or edit existing item
3. Click the image upload area
4. Drag & drop or click to upload
5. ✅ Image should upload and preview

---

## 🔍 Troubleshooting

### "Upload failed" or images don't appear

**Check Browser Console:**
1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for errors like:
   - `Failed to fetch`
   - `CORS error`
   - `403 Forbidden`
   - `401 Unauthorized`

**Check Server Logs:**
1. Check your hosting platform logs
2. Look for errors like:
   - `R2_ACCOUNT_ID must be set`
   - `Missing required environment variables`
   - `Error signing URL`

**Common Issues:**

**1. CORS Error**
```
Access to fetch at 'https://pub-xxx.r2.dev' has been blocked by CORS policy
```
**Fix:** Configure CORS in R2 bucket settings (see Step 4)

**2. 403 Forbidden**
```
403 Forbidden when uploading
```
**Fix:** 
- Check R2 API token has **Object Read & Write** permissions
- Check bucket has **Public Access** enabled
- Verify `R2_PUBLIC_URL` is correct

**3. 401 Unauthorized**
```
401 Unauthorized
```
**Fix:**
- Verify `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` are correct
- Check if token hasn't expired

**4. Images Upload But Don't Display**
```
Image uploads successfully but shows broken image icon
```
**Fix:**
- Verify `R2_PUBLIC_URL` is correct
- Check bucket has **Public Access** enabled
- Make sure bucket isn't private

**5. Environment Variables Not Loading**
```
Server starts but still says missing env vars
```
**Fix:**
- Restart your server/service completely
- Check variables are in correct environment (production vs. development)
- Verify no typos in variable names

---

## 📊 Cost Estimate

**Cloudflare R2 Pricing:**
- **Storage:** $0.015 per GB/month (first 10 GB free)
- **Class A operations** (PUT, POST): $4.50 per million (first 1 million free)
- **Class B operations** (GET, HEAD): $0.36 per million (first 10 million free)
- **Egress:** **FREE** (no bandwidth charges!)

**Expected costs for restaurant platform:**
- Small restaurant (100 menu items, 1000 orders/month): **FREE**
- Medium restaurant (500 menu items, 5000 orders/month): **~$1-2/month**
- Platform with 100 restaurants: **~$50-100/month**

Much cheaper than AWS S3!

---

## 🎯 Verification Checklist

After setup, verify:

- [ ] R2 bucket created successfully
- [ ] API token generated with correct permissions
- [ ] Public access enabled on bucket
- [ ] CORS policy configured correctly
- [ ] All 6 environment variables added to production
- [ ] Server restarted and running without errors
- [ ] Can upload restaurant logo
- [ ] Can upload restaurant cover image
- [ ] Can upload menu item images
- [ ] Images display correctly on storefront
- [ ] Images persist after page refresh

---

## 🔐 Security Best Practices

1. **Never commit credentials to git**
   - All R2 credentials should be in environment variables only
   - `.env` file is already in `.gitignore`

2. **Use separate tokens for dev/staging/prod**
   - Create different API tokens for each environment
   - Easier to rotate and revoke if compromised

3. **Rotate tokens periodically**
   - Create new tokens every 6-12 months
   - Update environment variables
   - Delete old tokens

4. **Monitor usage**
   - Check R2 dashboard for unusual activity
   - Set up alerts for excessive API calls
   - Review storage growth trends

5. **Private objects**
   - Driver documents (ID, insurance) are stored in `private/` directory
   - These use presigned URLs for controlled access
   - Only authenticated users can access

---

## 🆘 Still Not Working?

If you've followed all steps and images still won't upload:

1. **Check Server Logs**
   ```bash
   # Look for startup messages like:
   ✅ Environment variables validated successfully
   # OR errors like:
   ❌ Missing required environment variables: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID...
   ```

2. **Test R2 Connection**
   Add this temporarily to your `server/index.ts`:
   ```typescript
   console.log('🔍 R2 Config Check:');
   console.log('Account ID:', process.env.R2_ACCOUNT_ID ? '✅ Set' : '❌ Missing');
   console.log('Access Key:', process.env.R2_ACCESS_KEY_ID ? '✅ Set' : '❌ Missing');
   console.log('Secret Key:', process.env.R2_SECRET_ACCESS_KEY ? '✅ Set' : '❌ Missing');
   console.log('Bucket:', process.env.R2_BUCKET_NAME ? '✅ Set' : '❌ Missing');
   console.log('Public URL:', process.env.R2_PUBLIC_URL ? '✅ Set' : '❌ Missing');
   ```

3. **Test Upload API**
   ```bash
   curl -X POST https://eatout.cloud/api/objects/upload \
     -H "Cookie: your-session-cookie" \
     -v
   ```
   Should return `{ "uploadURL": "...", "objectPath": "..." }`

4. **Contact Support**
   - Provide server logs
   - Share browser console errors
   - Describe exactly what happens when you try to upload

---

## 📚 Additional Resources

- [Cloudflare R2 Documentation](https://developers.cloudflare.com/r2/)
- [R2 Pricing](https://developers.cloudflare.com/r2/pricing/)
- [R2 API](https://developers.cloudflare.com/r2/api/s3/)
- [AWS S3 SDK for JavaScript](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-s3/)

---

## ✅ Success!

Once configured, you'll be able to:
- ✅ Upload restaurant logos and cover images
- ✅ Upload menu item photos
- ✅ Upload driver documents
- ✅ View all images on storefront
- ✅ Customers can see beautiful product photos
- ✅ Fast image loading via Cloudflare CDN
