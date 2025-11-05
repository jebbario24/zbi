# 🚀 EatOut Deployment Guide for Render

This guide walks you through deploying your EatOut restaurant platform to Render.

---

## ✅ Pre-Deployment Checklist

Before deploying, ensure you have:

- [ ] Cloudflare account with R2 bucket created
- [ ] PostgreSQL database (Render provides free tier)
- [ ] Stripe account (for payments)
- [ ] Domain name (optional)
- [ ] All environment variables ready

---

## 📋 Step 1: Set Up Cloudflare R2

### Create R2 Bucket

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **R2 Object Storage**
3. Click **Create bucket**
4. Name it: `eatout-storage` (or your preferred name)
5. Click **Create bucket**

### Get Account ID

- Your Account ID is visible at the top of the R2 page
- Format: `abc123def456789`
- Save this for later

### Create API Token

1. Click **Manage R2 API Tokens**
2. Click **Create API Token**
3. Name: `eatout-production`
4. Permissions: **Object Read & Write**
5. TTL: Never expires (or set expiry if you prefer)
6. Click **Create API Token**
7. **⚠️ IMPORTANT:** Copy the Access Key ID and Secret Access Key (shown only once!)

### Enable Public Access

1. Go back to your bucket → **Settings**
2. Under **Public access**:
   - Option 1: Enable "R2.dev subdomain" (free, instant)
   - Option 2: Add custom domain (requires DNS setup)
3. Copy the public URL (format: `https://pub-xxxxx.r2.dev`)

### Configure CORS

1. In your bucket → **Settings** → **CORS policy**
2. Add this policy:

```json
[
  {
    "AllowedOrigins": ["https://etitout.onrender.com"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

3. Replace `https://etitout.onrender.com` with your actual domain
4. Click **Save**

---

## 📋 Step 2: Set Up Render

### Create PostgreSQL Database

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **New** → **PostgreSQL**
3. Name: `eatout-db`
4. Region: Choose closest to your users
5. Plan: Free (or paid for production)
6. Click **Create Database**
7. **Save the connection string** (Internal Database URL)

### Create Web Service

1. Click **New** → **Web Service**
2. Connect your GitHub repository
3. Configure:
   - **Name:** `eatout-api`
   - **Region:** Same as database
   - **Branch:** `main`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Plan:** Free (or paid)

---

## 📋 Step 3: Set Environment Variables in Render

In your Render web service → **Environment** tab, add:

### Required Variables

```bash
# Database
DATABASE_URL=<your_internal_database_url_from_render>

# Session
SESSION_SECRET=<generate_with: openssl rand -base64 32>

# Cloudflare R2
R2_ACCOUNT_ID=abc123def456789
R2_ACCESS_KEY_ID=your_r2_access_key
R2_SECRET_ACCESS_KEY=your_r2_secret_key
R2_BUCKET_NAME=eatout-storage
R2_PUBLIC_URL=https://pub-xxxxx.r2.dev
PRIVATE_OBJECT_DIR=private

# Server Config
PORT=5000
NODE_ENV=production
BASE_URL=https://etitout.onrender.com
```

### Optional but Recommended (Stripe)

```bash
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_...
```

### Optional (PayPal)

```bash
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_CLIENT_SECRET=your_paypal_client_secret
```

### Optional (Google OAuth)

```bash
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

Click **Save Changes** after adding all variables.

---

## 📋 Step 4: Deploy to Render

### Push Your Code

```bash
# Commit all changes
git add .
git commit -m "Prepare for Render deployment with R2 storage"

# Push to GitHub
git push origin main
```

### Render Auto-Deploy

- Render will automatically detect the push and start building
- Monitor the build logs in Render dashboard
- Wait for deployment to complete (5-10 minutes)

### Check Deployment Status

1. In Render dashboard, click on your service
2. Check **Logs** tab for any errors
3. Look for: `✅ Environment variables validated successfully`
4. Service should show **Live** status

---

## 📋 Step 5: Set Up Database

### Run Database Migrations

```bash
# In Render Shell (go to your service → Shell tab)
npm run db:push
```

Or run locally:

```bash
# Set DATABASE_URL to your Render database
export DATABASE_URL="postgresql://..."
npm run db:push
```

---

## 📋 Step 6: Configure Stripe Webhooks

### Create Webhook Endpoint

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/)
2. **Developers** → **Webhooks** → **Add endpoint**
3. Endpoint URL: `https://etitout.onrender.com/api/webhooks/stripe`
4. Select events:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
5. Click **Add endpoint**
6. **Copy the webhook secret** (starts with `whsec_`)
7. Add it to Render environment variables as `STRIPE_WEBHOOK_SECRET`

---

## 📋 Step 7: Test Your Deployment

### Health Checks

1. Visit: `https://etitout.onrender.com/`
2. Should see your application loading

### Test Authentication

1. Try signing up: `https://etitout.onrender.com/signup`
2. Try logging in: `https://etitout.onrender.com/login`

### Test File Upload

1. Log in as restaurant owner
2. Go to Menu → Add menu item
3. Upload an image
4. Verify image appears correctly

### Test Subscription (if Stripe configured)

1. Go to: `https://etitout.onrender.com/subscribe`
2. Try creating a subscription
3. Check Stripe dashboard for payment

---

## 🔧 Troubleshooting

### Build Fails

**Error:** `Module not found`
**Solution:** Run `npm install` locally first, ensure package-lock.json is committed

**Error:** `TypeScript compilation failed`
**Solution:** Run `npm run check` locally to fix type errors

### Database Connection Issues

**Error:** `Failed to connect to database`
**Solution:**
- Verify `DATABASE_URL` in Render environment variables
- Check database is running in Render dashboard
- Ensure IP whitelist includes Render IPs (usually not needed)

### File Upload Fails

**Error:** `Failed to upload file`
**Solution:**
1. Check R2 credentials are correct
2. Verify R2 bucket name matches
3. Check CORS policy in R2 bucket
4. Check Render logs for detailed error

### Stripe Webhooks Not Working

**Error:** `Webhook signature verification failed`
**Solution:**
1. Verify `STRIPE_WEBHOOK_SECRET` is set correctly
2. Check webhook endpoint URL is correct
3. Test webhook in Stripe dashboard

### Environment Variables Not Loading

**Solution:**
1. Check all required variables are set in Render
2. Click "Save Changes" after adding variables
3. Manually redeploy: Dashboard → Manual Deploy

### Cold Starts (Free Tier)

**Issue:** App takes 30+ seconds to load first time
**Explanation:** Render free tier spins down after 15 minutes of inactivity
**Solutions:**
- Upgrade to paid plan ($7/month) for always-on
- Use UptimeRobot to ping your app every 14 minutes
- Accept cold starts for development/testing

---

## 🎯 Post-Deployment Tasks

### Security

- [ ] Set up custom domain with HTTPS
- [ ] Enable Render auto-deploy from GitHub
- [ ] Set up monitoring/alerts
- [ ] Review and rotate secrets regularly

### Monitoring

- [ ] Set up error tracking (e.g., Sentry)
- [ ] Monitor Render logs regularly
- [ ] Check Stripe dashboard for payment issues
- [ ] Monitor R2 usage and costs

### Backups

- [ ] Enable automatic PostgreSQL backups in Render
- [ ] Backup R2 bucket regularly
- [ ] Document recovery procedures

### Performance

- [ ] Enable Render Redis cache (optional)
- [ ] Set up CDN for static assets
- [ ] Monitor response times
- [ ] Optimize database queries

---

## 📞 Support

### Common Issues

1. **Rate limiting errors:** Normal for public APIs, adjust limits if needed
2. **Session issues:** Clear cookies and try again
3. **Payment failures:** Check Stripe logs for details

### Resources

- [Render Docs](https://render.com/docs)
- [Cloudflare R2 Docs](https://developers.cloudflare.com/r2/)
- [Stripe Docs](https://stripe.com/docs)

### Need Help?

- Check Render logs: Dashboard → Your Service → Logs
- Check application logs: `/logs/error.log` (via Shell)
- Review this guide's troubleshooting section

---

## ✅ Deployment Complete!

Your EatOut platform is now live at: `https://etitout.onrender.com`

Next steps:
1. Create your first restaurant
2. Set up your menu
3. Configure payment settings
4. Start taking orders!

🎉 Congratulations on your deployment!
