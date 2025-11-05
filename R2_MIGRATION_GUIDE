# Cloudflare R2 Migration Guide

## ✅ Completed Automatically

The following files have been updated to use Cloudflare R2 instead of Google Cloud Storage:

1. **`package.json`** - Dependencies updated
2. **`server/objectStorage.ts`** - Completely rewritten for R2
3. **`server/objectAcl.ts`** - Updated for R2 compatibility
4. **`server/routes.ts`** - Updated object references

---

## 🔧 Steps You Need to Complete

### 1. Install New Dependencies

Run this command in your terminal:

```bash
npm install
```

This will install the AWS SDK packages needed for R2 (R2 is S3-compatible).

---

### 2. Set Up Cloudflare R2 Bucket

If you haven't already:

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **R2 Object Storage**
3. Create a new bucket (e.g., `eatout-storage`)
4. Note your **Account ID** (visible in the R2 overview)

---

### 3. Create R2 API Tokens

1. In Cloudflare Dashboard, go to **R2 → Manage R2 API Tokens**
2. Click **Create API Token**
3. Give it a name (e.g., `eatout-app`)
4. Set permissions: **Object Read & Write**
5. Select your bucket or allow access to all buckets
6. Click **Create API Token**
7. **Save the credentials** (Access Key ID and Secret Access Key)

---

### 4. Configure Environment Variables

Add these to your `.env` file (or set them in your hosting platform):

```bash
# Cloudflare R2 Configuration
R2_ACCOUNT_ID=your_cloudflare_account_id_here
R2_ACCESS_KEY_ID=your_r2_access_key_id_here
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key_here
R2_BUCKET_NAME=your_bucket_name_here
R2_PUBLIC_URL=https://your-bucket.r2.dev
PRIVATE_OBJECT_DIR=private
```

**How to get these values:**
- `R2_ACCOUNT_ID`: Found in R2 dashboard (looks like: `abc123def456`)
- `R2_ACCESS_KEY_ID`: From the API token you created (looks like: `abc123...`)
- `R2_SECRET_ACCESS_KEY`: From the API token (shown only once when created)
- `R2_BUCKET_NAME`: The name you gave your bucket (e.g., `eatout-storage`)
- `R2_PUBLIC_URL`: Your R2 public URL (format: `https://[bucket-name].[account-id].r2.cloudflarestorage.com`)
- `PRIVATE_OBJECT_DIR`: Directory for private uploads (default: `private`)

---

### 5. Configure R2 Public Access (Optional)

If you want public image URLs:

1. In Cloudflare Dashboard, go to your R2 bucket
2. Click **Settings**
3. Enable **Public URL** or set up a **Custom Domain**
4. Update `R2_PUBLIC_URL` in your `.env` with the public URL

---

### 6. Migrate Existing Files (If Needed)

If you have files in Google Cloud Storage:

**Option A: Manual Migration (Small datasets)**
1. Download files from GCS
2. Upload to R2 using the Cloudflare dashboard or CLI

**Option B: Automated Migration (Large datasets)**
1. Use [rclone](https://rclone.org/) to sync GCS → R2
2. Configure both GCS and R2 in rclone
3. Run: `rclone sync gcs:bucket r2:bucket`

---

### 7. Test the Integration

1. Restart your application: `npm run dev`
2. Try uploading an image (Menu item image, Restaurant logo, etc.)
3. Verify it uploads to R2
4. Check that images load correctly

**Test Upload:**
- Go to `/menu` and try adding a menu item with an image
- Go to `/settings` and try uploading a restaurant logo

---

## 🔍 Troubleshooting

### Error: "Cannot find module '@aws-sdk/client-s3'"
**Solution:** Run `npm install` to install new dependencies

### Error: "R2_ACCOUNT_ID is not defined"
**Solution:** Make sure all environment variables are set in your `.env` file

### Error: "Access Denied" when uploading
**Solution:** 
- Check that your R2 API token has **Read & Write** permissions
- Verify the bucket name is correct
- Ensure the token has access to the specified bucket

### Images not loading
**Solution:**
- Check that `R2_PUBLIC_URL` is set correctly
- Enable public access on your R2 bucket if needed
- Verify bucket CORS settings allow your domain

### Error: "SignatureDoesNotMatch"
**Solution:**
- Double-check your `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY`
- Make sure there are no extra spaces in the credentials
- Regenerate the API token if needed

---

## 📊 Key Differences from GCS

| Feature | Google Cloud Storage | Cloudflare R2 |
|---------|---------------------|---------------|
| SDK | `@google-cloud/storage` | `@aws-sdk/client-s3` (S3-compatible) |
| Authentication | Service account JSON | Access Key + Secret |
| Endpoint | `storage.googleapis.com` | `[account-id].r2.cloudflarestorage.com` |
| Pricing | Egress fees | **Zero egress fees** 🎉 |
| Signed URLs | GCS-specific | S3-style presigned URLs |

---

## ✨ Benefits of R2

- **Zero egress fees** - No charges for data transferred out
- **S3-compatible API** - Works with most S3 tools
- **Global edge network** - Fast access worldwide via Cloudflare's CDN
- **Lower storage costs** - $0.015/GB vs GCS $0.020/GB
- **Built-in CDN** - Automatic edge caching

---

## 🆘 Need Help?

If you encounter issues:

1. Check the console logs for detailed error messages
2. Verify all environment variables are correct
3. Test R2 credentials using the [Cloudflare Dashboard](https://dash.cloudflare.com/)
4. Ensure your bucket exists and is accessible

---

## ✅ Migration Checklist

- [ ] Run `npm install`
- [ ] Create R2 bucket in Cloudflare Dashboard
- [ ] Generate R2 API token
- [ ] Set all environment variables in `.env`
- [ ] Restart application
- [ ] Test image upload
- [ ] Test image viewing
- [ ] Migrate old files from GCS (if applicable)
- [ ] Update any hardcoded URLs in database
- [ ] Delete old GCS bucket (after confirming everything works)

**All done!** Your application now uses Cloudflare R2 for storage. 🚀
