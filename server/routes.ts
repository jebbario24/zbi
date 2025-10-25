import type { Express } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";
import { passport, hashPassword } from "./auth";
import {
  insertRestaurantSchema,
  insertMenuCategorySchema,
  insertMenuItemSchema,
  insertTableSchema,
  insertReservationSchema,
  insertStaffSchema,
  insertInventorySchema,
  insertDeliveryZoneSchema,
} from "@shared/schema";
import { z } from "zod";
import Stripe from "stripe";
import { 
  Client, 
  Environment, 
  OrdersController, 
  CheckoutPaymentIntent,
  OrderApplicationContextLandingPage,
  OrderApplicationContextUserAction 
} from '@paypal/paypal-server-sdk';
import { ObjectStorageService, ObjectNotFoundError, signObjectURL } from "./objectStorage";
import { db } from "./db";
import { boostSlots, promoRules } from "@shared/schema";
import { eq, and, isNotNull } from "drizzle-orm";
import { wsManager } from "./websocket";

// Initialize Stripe only if credentials are available
const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-09-30.clover",
    })
  : null;

// Initialize PayPal only if credentials are available
const paypalClient = (process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET)
  ? new Client({
      clientCredentialsAuthCredentials: {
        oAuthClientId: process.env.PAYPAL_CLIENT_ID,
        oAuthClientSecret: process.env.PAYPAL_CLIENT_SECRET
      },
      timeout: 0,
      environment: Environment.Sandbox,
    })
  : null;
const paypalOrdersController = paypalClient ? new OrdersController(paypalClient) : null;

// Helper function to generate sequential order numbers
async function generateOrderNumber(restaurantId: string, prefix: 'ORD' | 'WEB'): Promise<string> {
  const lastOrder = await storage.getLastOrderByPrefix(restaurantId, prefix);
  
  if (!lastOrder) {
    return `${prefix}-001`;
  }
  
  // Extract number from order number - only match 3-digit padded format (e.g., "WEB-001" -> 1)
  // This regex specifically looks for exactly 3 digits to avoid matching old timestamp-based formats
  const match = lastOrder.orderNumber.match(new RegExp(`^${prefix}-(\\d{3})$`));
  
  if (!match) {
    // If no match (old format or invalid), start fresh from 001
    return `${prefix}-001`;
  }
  
  const lastNumber = parseInt(match[1], 10);
  const nextNumber = lastNumber + 1;
  
  // Pad with zeros (001, 002, etc.)
  return `${prefix}-${String(nextNumber).padStart(3, '0')}`;
}

// Helper function to log admin activity
async function logAdminActivity(params: {
  userId: string;
  userEmail: string;
  actionType: string;
  actionCategory: string;
  description: string;
  targetId?: string;
  targetType?: string;
  targetName?: string;
  metadata?: any;
  ipAddress?: string;
  userAgent?: string;
}) {
  try {
    await storage.createActivityLog(params);
  } catch (error) {
    console.error("Failed to log admin activity:", error);
    // Don't throw - logging failure shouldn't break the actual action
  }
}

const orderSchema = z.object({
  orderType: z.string(),
  tableId: z.string().nullable().optional(),
  customerName: z.string().nullable().optional(),
  customerPhone: z.string().nullable().optional(),
  customerEmail: z.string().nullable().optional(),
  paymentMethod: z.enum(['stripe', 'paypal', 'cash']).optional().default('cash'),
  items: z.array(z.object({
    menuItemId: z.string().optional(),
    bundleId: z.string().optional(),
    quantity: z.number(),
    unitPrice: z.string(),
    selectedOptions: z.any().nullable().optional(),
    notes: z.string().optional(),
  }).refine(
    (item) => (item.menuItemId && !item.bundleId) || (!item.menuItemId && item.bundleId),
    { message: "Each order item must have exactly one of menuItemId or bundleId" }
  )),
  subtotal: z.string(),
  tax: z.string(),
  total: z.string(),
});

const onlineOrderSchema = z.object({
  orderType: z.enum(['pickup', 'delivery']).default('delivery'),
  customerName: z.string().nullable().optional(),
  customerPhone: z.string().nullable().optional(),
  customerEmail: z.string().nullable().optional(),
  shippingAddress: z.string().nullable().optional(),
  deliveryCountry: z.string().nullable().optional(),
  deliveryCity: z.string().nullable().optional(),
  deliveryAddress: z.string().nullable().optional(),
  deliveryFee: z.string().nullable().optional(),
  paymentMethod: z.enum(['stripe', 'paypal', 'cash', 'apple', 'google']).optional().default('cash'),
  items: z.array(z.object({
    menuItemId: z.string().optional(),
    bundleId: z.string().optional(),
    quantity: z.number(),
    unitPrice: z.string(),
    selectedOptions: z.any().nullable().optional(),
  }).refine(
    (item) => (item.menuItemId && !item.bundleId) || (!item.menuItemId && item.bundleId),
    { message: "Each order item must have exactly one of menuItemId or bundleId" }
  )),
  subtotal: z.string(),
  promoCode: z.string().nullable().optional(),
  promoDiscount: z.string().nullable().optional(),
  tax: z.string(),
  total: z.string(),
});

// Middleware to check if user is authenticated
const isAuthenticated = (req: any, res: any, next: any) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
};

// Middleware to check if user is admin
const isAdmin = async (req: any, res: any, next: any) => {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: "Forbidden: Admin access required" });
  }
  
  next();
};

// Middleware to check subscription status (allows admins to bypass)
const requireActiveSubscription = async (req: any, res: any, next: any) => {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  const user = req.user;
  
  // Admins bypass subscription check
  if (user.role === 'admin') {
    return next();
  }
  
  const now = new Date();
  const hasActiveSubscription = user.subscriptionStatus === 'active' && 
                                 user.subscriptionEndsAt && 
                                 user.subscriptionEndsAt > now;
  
  const hasActiveTrial = user.subscriptionStatus === 'trial' && 
                         user.trialEndsAt && 
                         user.trialEndsAt > now;
  
  if (!hasActiveSubscription && !hasActiveTrial) {
    return res.status(402).json({ 
      message: "Subscription required",
      subscriptionStatus: user.subscriptionStatus 
    });
  }
  
  next();
};

// Service function for processing scheduled payouts (called by cron and admin endpoint)
export async function processScheduledPayouts(storage: any, stripe: any) {
  const results = {
    processed: 0,
    failed: 0,
    skipped: 0,
    totalAmount: 0,
    details: [] as any[],
  };

  if (!stripe) {
    console.error('[Payout] Stripe is not configured');
    return results;
  }

  try {
    // Get all restaurants
    const allRestaurants = await storage.getAllRestaurants();

    for (const restaurantData of allRestaurants) {
      const restaurant = restaurantData;
      
      try {
        // Skip if no Stripe Connect account
        if (!restaurant.stripeAccountId) {
          results.skipped++;
          continue;
        }

        // Verify Connect account is fully onboarded
        const connectedAccount = await stripe.accounts.retrieve(restaurant.stripeAccountId);
        if (!connectedAccount.payouts_enabled) {
          results.skipped++;
          continue;
        }

        // Get payout account for schedule preference
        const payoutAccount = await storage.getPayoutAccount(restaurant.id);
        
        // Check if payout is due based on schedule
        const lastPayout = await storage.getPayoutRuns(restaurant.id);
        const mostRecentPayout = lastPayout[0];
        
        const now = new Date();
        let shouldProcess = false;

        if (!mostRecentPayout) {
          shouldProcess = true; // First payout
        } else {
          const lastPayoutDate = new Date(mostRecentPayout.createdAt);
          const daysSinceLastPayout = (now.getTime() - lastPayoutDate.getTime()) / (1000 * 60 * 60 * 24);

          const schedule = payoutAccount?.payoutSchedule || 'weekly';
          if (schedule === 'daily' && daysSinceLastPayout >= 1) {
            shouldProcess = true;
          } else if (schedule === 'weekly' && daysSinceLastPayout >= 7) {
            shouldProcess = true;
          }
        }

        if (!shouldProcess) {
          results.skipped++;
          continue;
        }

        // Get pending earnings
        const pendingEarnings = await storage.getPendingEarnings(restaurant.id);
        const amountInDollars = parseFloat(pendingEarnings.total);

        // Skip if below minimum payout threshold
        if (amountInDollars < 10) {
          results.skipped++;
          continue;
        }

        // Get pending ledger entries
        const ledgerEntries = await storage.getEarningsLedger(restaurant.id);
        const pendingEntries = ledgerEntries.filter((entry: any) => entry.restaurantPayoutStatus === 'pending');
        const ledgerEntryIds = pendingEntries.map((entry: any) => entry.id);

        if (ledgerEntryIds.length === 0) {
          results.skipped++;
          continue;
        }

        // Create payout run
        const payoutRun = await storage.createPayoutRun(
          restaurant.id,
          amountInDollars,
          'stripe',
          new Date()
        );

        try {
          const amountInCents = Math.round(amountInDollars * 100);

          // Create Stripe Transfer to connected account (proper Connect flow)
          const transfer = await stripe.transfers.create({
            amount: amountInCents,
            currency: 'usd',
            destination: restaurant.stripeAccountId,
            description: `Scheduled payout for ${restaurant.name}`,
            metadata: {
              restaurantId: restaurant.id,
              payoutRunId: payoutRun.id,
              restaurantName: restaurant.name,
              automated: 'true',
            },
          });

          // Complete payout transaction (atomic operation)
          await storage.completePayoutTransaction(payoutRun.id, ledgerEntryIds, transfer.id);

          results.processed++;
          results.totalAmount += amountInDollars;
          results.details.push({
            restaurantId: restaurant.id,
            restaurantName: restaurant.name,
            amount: amountInDollars,
            status: 'success',
            transferId: transfer.id,
          });

          console.log(`[Payout] Success: ${restaurant.name} - $${amountInDollars} (${transfer.id})`);

        } catch (stripeError: any) {
          console.error(`[Payout] Stripe transfer error for restaurant ${restaurant.id}:`, stripeError);
          
          await storage.updatePayoutRunStatus(
            payoutRun.id,
            'failed',
            undefined,
            stripeError.message
          );

          results.failed++;
          results.details.push({
            restaurantId: restaurant.id,
            restaurantName: restaurant.name,
            amount: amountInDollars,
            status: 'failed',
            error: stripeError.message,
          });
        }

      } catch (error: any) {
        console.error(`[Payout] Error processing payout for restaurant ${restaurant.id}:`, error);
        results.failed++;
        results.details.push({
          restaurantId: restaurant.id,
          restaurantName: restaurant.name,
          status: 'failed',
          error: error.message,
        });
      }
    }

    console.log(`[Payout] Batch complete - Processed: ${results.processed}, Failed: ${results.failed}, Skipped: ${results.skipped}, Total: $${results.totalAmount}`);
    return results;

  } catch (error) {
    console.error("[Payout] Error processing scheduled payouts:", error);
    return results;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Trust proxy for secure cookies behind Replit proxy
  app.set("trust proxy", 1);

  // Session configuration
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 7 days
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });

  app.use(session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: sessionTtl,
    },
  }));

  // Initialize Passport
  app.use(passport.initialize());
  app.use(passport.session());

  // Hostname-based storefront middleware - check for custom domain or subdomain
  app.use(async (req: any, res, next) => {
    const hostname = req.hostname;
    
    // Skip if it's an API route or static asset
    if (req.path.startsWith('/api/') || req.path.startsWith('/assets/')) {
      return next();
    }
    
    // Check if this is a custom domain or subdomain
    let restaurant = null;
    
    // First, check for custom domain (exact match)
    restaurant = await storage.getRestaurantByCustomDomain(hostname);
    
    // If not found, check for subdomain (e.g., restaurant.eatout.app)
    if (!restaurant && hostname.includes('.')) {
      const subdomain = hostname.split('.')[0];
      // Exclude common subdomains like www, api, app
      if (!['www', 'api', 'app'].includes(subdomain)) {
        restaurant = await storage.getRestaurantBySubdomain(subdomain);
      }
    }
    
    // If restaurant found via domain/subdomain, store in request for later use
    if (restaurant && restaurant.isActive) {
      req.storefrontRestaurant = restaurant;
      // If not already on storefront route, we can optionally serve storefront here
      // For now, just pass along - the frontend will handle rendering
    }
    
    next();
  });

  // Auth routes
  
  // Signup with email/password
  app.post('/api/signup', async (req, res) => {
    try {
      const { email, password, firstName, lastName } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email.toLowerCase());
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }

      // Hash password
      const hashedPassword = await hashPassword(password);

      // Calculate trial end date (7 days from now)
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 7);

      // Create user
      const user = await storage.createUser({
        email: email.toLowerCase(),
        password: hashedPassword,
        firstName: firstName || null,
        lastName: lastName || null,
        role: email.toLowerCase() === 'jebbario23@gmail.com' ? 'admin' : 'owner',
        subscriptionStatus: 'trial',
        trialEndsAt,
      });

      // Log the user in
      req.login(user, (err) => {
        if (err) {
          console.error("Login error after signup:", err);
          return res.status(500).json({ message: "Failed to login after signup" });
        }
        res.json(user);
      });
    } catch (error) {
      console.error("Signup error:", error);
      res.status(500).json({ message: "Failed to create account" });
    }
  });

  // Login with email/password
  app.post('/api/login', (req, res, next) => {
    passport.authenticate('local', (err: any, user: any, info: any) => {
      if (err) {
        console.error("Login error:", err);
        return res.status(500).json({ message: "Login failed" });
      }
      if (!user) {
        return res.status(401).json({ message: info?.message || "Invalid credentials" });
      }
      req.login(user, (err) => {
        if (err) {
          console.error("Session login error:", err);
          return res.status(500).json({ message: "Failed to establish session" });
        }
        res.json(user);
      });
    })(req, res, next);
  });

  // Google OAuth routes (Restaurant Owners)
  app.get('/api/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
  );

  app.get('/api/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/login' }),
    (req, res) => {
      // Successful authentication, redirect to dashboard
      res.redirect('/dashboard');
    }
  );

  // Google OAuth routes (Drivers)
  app.get('/api/auth/google/driver',
    passport.authenticate('google-driver', { scope: ['profile', 'email'] })
  );

  app.get('/api/auth/google/driver/callback',
    passport.authenticate('google-driver', { failureRedirect: '/driver/login?error=auth_failed' }),
    (req, res) => {
      // Successful authentication, redirect to driver dashboard
      res.redirect('/driver/dashboard');
    }
  );

  // Driver email/password authentication
  const driverSignupSchema = z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
  });

  app.post('/api/driver/signup', async (req, res) => {
    try {
      const validatedData = driverSignupSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(validatedData.email.toLowerCase());
      if (existingUser) {
        return res.status(400).json({ message: "Email already registered" });
      }

      // Hash password
      const hashedPassword = await hashPassword(validatedData.password);

      // Create driver user
      const newUser = await storage.createUser({
        email: validatedData.email.toLowerCase(),
        password: hashedPassword,
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        role: 'driver',
        profileComplete: false,
        adminApproved: false,
      });

      // Auto-login the user
      req.login(newUser, (err) => {
        if (err) {
          console.error("Session login error:", err);
          return res.status(500).json({ message: "Account created but failed to login" });
        }
        
        const { password, ...userWithoutPassword } = newUser;
        res.status(201).json(userWithoutPassword);
      });
    } catch (error: any) {
      console.error("Driver signup error:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Failed to create account" });
    }
  });

  const driverLoginSchema = z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(1, "Password is required"),
  });

  app.post('/api/driver/login', async (req, res) => {
    try {
      const validatedData = driverLoginSchema.parse(req.body);
      
      // Get user by email
      const user = await storage.getUserByEmail(validatedData.email.toLowerCase());
      if (!user || !user.password) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Verify user is a driver
      if (user.role !== 'driver') {
        return res.status(403).json({ message: "This account is not registered as a driver" });
      }

      // Verify password
      const { verifyPassword } = await import('./auth');
      const isValidPassword = await verifyPassword(validatedData.password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Login the user
      req.login(user, (err) => {
        if (err) {
          console.error("Session login error:", err);
          return res.status(500).json({ message: "Failed to establish session" });
        }
        
        const { password, ...userWithoutPassword } = user;
        res.json(userWithoutPassword);
      });
    } catch (error: any) {
      console.error("Driver login error:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Failed to login" });
    }
  });

  // Get current user
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    const { password, ...userWithoutPassword } = req.user;
    res.json(userWithoutPassword);
  });

  // Logout
  app.post('/api/logout', (req: any, res) => {
    req.logout((err: any) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ message: "Failed to logout" });
      }
      req.session.destroy((err: any) => {
        if (err) {
          console.error("Session destroy error:", err);
          return res.status(500).json({ message: "Failed to destroy session" });
        }
        res.clearCookie('connect.sid');
        res.json({ message: "Logged out successfully" });
      });
    });
  });

  // Object Storage Upload URL
  app.post('/api/object-storage/upload-url', isAuthenticated, async (req: any, res) => {
    try {
      const { objectPath } = req.body;
      
      if (!objectPath) {
        return res.status(400).json({ message: "objectPath is required" });
      }

      const objectStorageService = new ObjectStorageService();
      
      // Get private object directory and construct full path
      const privateDir = objectStorageService.getPrivateObjectDir();
      const fullPath = `${privateDir}/${objectPath}`;
      
      // Parse the full path to get bucket and object names
      const pathParts = fullPath.split("/").filter(p => p);
      if (pathParts.length < 2) {
        return res.status(400).json({ message: "Invalid object path" });
      }
      
      const bucketName = pathParts[0];
      const objectName = pathParts.slice(1).join("/");
      
      // Generate signed URL
      const signedUrl = await signObjectURL({
        bucketName,
        objectName,
        method: "PUT",
        ttlSec: 900,
      });
      
      res.json({
        method: 'PUT',
        url: signedUrl,
        objectPath: objectPath,
      });
    } catch (error) {
      console.error("Error generating upload URL:", error);
      res.status(500).json({ message: "Failed to generate upload URL" });
    }
  });

  // Subscription routes
  app.post('/api/create-subscription', isAuthenticated, async (req: any, res) => {
    try {
      if (!stripe) {
        return res.status(503).json({ message: "Payment processing is not configured" });
      }

      const userId = req.user.id;
      const { planType } = req.body; // 'withTrial' or 'immediate'
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check if already has a subscription
      if (user.stripeSubscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId, {
          expand: ['latest_invoice.payment_intent'],
        });
        
        // Reuse active, past_due, or unpaid subscriptions
        if (['active', 'past_due', 'unpaid'].includes(subscription.status)) {
          const updateData: any = {
            subscriptionStatus: subscription.status,
          };
          
          const currentPeriodEnd = (subscription as any).current_period_end;
          if (currentPeriodEnd && !isNaN(currentPeriodEnd)) {
            updateData.subscriptionEndsAt = new Date(currentPeriodEnd * 1000);
          }
            
          await storage.updateUserSubscription(userId, updateData);
          
          const clientSecret = (subscription.latest_invoice as any)?.payment_intent?.client_secret;
          return res.json({ 
            subscriptionId: subscription.id,
            clientSecret,
            status: subscription.status,
          });
        }
        
        // Cancel incomplete or incomplete_expired subscriptions and create new one
        if (['incomplete', 'incomplete_expired'].includes(subscription.status)) {
          await stripe.subscriptions.cancel(subscription.id);
        }
      }

      // Create Stripe customer if doesn't exist
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email || undefined,
          name: `${user.firstName} ${user.lastName}`.trim() || undefined,
          metadata: { userId: user.id },
        });
        customerId = customer.id;
        await storage.updateUserSubscription(userId, { stripeCustomerId: customerId });
      }

      // Reuse existing product and price or create if doesn't exist
      let priceId = process.env.STRIPE_PRICE_ID;
      
      if (!priceId) {
        // Search for existing product
        const products = await stripe.products.list({ 
          active: true, 
          limit: 100 
        });
        let product = products.data.find(p => p.name === 'EatOut Monthly Subscription');
        
        if (!product) {
          product = await stripe.products.create({
            name: 'EatOut Monthly Subscription',
          });
        }
        
        // Search for existing price
        const prices = await stripe.prices.list({ 
          product: product.id,
          active: true,
          limit: 100
        });
        let price = prices.data.find(p => 
          p.currency === 'usd' && 
          p.recurring?.interval === 'month' && 
          p.unit_amount === 7900
        );
        
        if (!price) {
          price = await stripe.prices.create({
            product: product.id,
            currency: 'usd',
            recurring: { interval: 'month' },
            unit_amount: 7900, // $79 in cents
          });
        }
        
        priceId = price.id;
      }

      // Create subscription with or without trial based on plan type
      const subscriptionParams: any = {
        customer: customerId,
        items: [{ price: priceId }],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
        metadata: { 
          plan: planType === 'withTrial' ? 'eatout-monthly-trial' : 'eatout-monthly-immediate'
        },
      };

      // Add trial period only for 'withTrial' plan
      if (planType === 'withTrial') {
        subscriptionParams.trial_period_days = 7;
      }

      const subscription = await stripe.subscriptions.create(subscriptionParams);

      // Update user with subscription ID
      // Note: subscriptionEndsAt will be set later when subscription becomes active
      await storage.updateUserSubscription(userId, {
        stripeSubscriptionId: subscription.id,
        subscriptionStatus: subscription.status,
      });

      const clientSecret = (subscription.latest_invoice as any)?.payment_intent?.client_secret;
      
      res.json({
        subscriptionId: subscription.id,
        clientSecret,
        status: subscription.status,
      });
    } catch (error: any) {
      console.error("Error creating subscription:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/subscription-status', isAuthenticated, async (req: any, res) => {
    try {
      if (!stripe) {
        return res.status(503).json({ message: "Payment processing is not configured" });
      }

      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check if admin manually granted access - this overrides all subscription checks
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      const manualAccessGranted = restaurant?.manuallyGrantedAccess || false;
      
      if (manualAccessGranted) {
        return res.json({
          hasAccess: true,
          status: 'active',
          trialEndsAt: user.trialEndsAt,
          subscriptionEndsAt: user.subscriptionEndsAt,
          isTrialActive: false,
          isSubscriptionActive: false,
          manualAccessGranted: true,
        });
      }

      const now = new Date();
      const trialActive = user.trialEndsAt && user.trialEndsAt > now;
      
      // Only grant subscription access if Stripe confirms active status
      const subscriptionActive = user.subscriptionStatus === 'active' && 
                                  user.subscriptionEndsAt && user.subscriptionEndsAt > now;

      // If subscription exists, always check Stripe for latest status
      let actualSubscriptionActive = subscriptionActive;
      let freshSubscriptionEndsAt = user.subscriptionEndsAt;
      let freshStatus = user.subscriptionStatus;
      
      if (user.stripeSubscriptionId) {
        try {
          const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
          freshStatus = subscription.status;
          const currentPeriodEnd = (subscription as any).current_period_end;
          
          // Only set endsAt if we have a valid period
          if (currentPeriodEnd && !isNaN(currentPeriodEnd)) {
            freshSubscriptionEndsAt = new Date(currentPeriodEnd * 1000);
          }
          
          // ALWAYS update local data to match Stripe
          const updateData: any = {
            subscriptionStatus: subscription.status,
          };
          
          if (currentPeriodEnd && !isNaN(currentPeriodEnd)) {
            updateData.subscriptionEndsAt = freshSubscriptionEndsAt;
          }
          
          await storage.updateUserSubscription(userId, updateData);
          
          // Recalculate access based on fresh Stripe data
          actualSubscriptionActive = subscription.status === 'active' && 
                                      freshSubscriptionEndsAt !== null && 
                                      freshSubscriptionEndsAt > now;
        } catch (error) {
          console.error("Error checking subscription status:", error);
        }
      }

      res.json({
        hasAccess: trialActive || actualSubscriptionActive,
        status: freshStatus,
        trialEndsAt: user.trialEndsAt,
        subscriptionEndsAt: freshSubscriptionEndsAt,
        isTrialActive: trialActive,
        isSubscriptionActive: actualSubscriptionActive,
        manualAccessGranted: false,
      });
    } catch (error) {
      console.error("Error fetching subscription status:", error);
      res.status(500).json({ message: "Failed to fetch subscription status" });
    }
  });

  app.post('/api/cancel-subscription', isAuthenticated, async (req: any, res) => {
    try {
      if (!stripe) {
        return res.status(503).json({ message: "Payment processing is not configured" });
      }

      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!user?.stripeSubscriptionId) {
        return res.status(400).json({ message: "No active subscription" });
      }

      await stripe.subscriptions.cancel(user.stripeSubscriptionId);
      await storage.updateUserSubscription(userId, { 
        subscriptionStatus: 'canceled',
      });

      res.json({ message: "Subscription canceled successfully" });
    } catch (error) {
      console.error("Error canceling subscription:", error);
      res.status(500).json({ message: "Failed to cancel subscription" });
    }
  });

  // Stripe webhook endpoint for subscription events
  app.post('/api/webhooks/stripe', async (req, res) => {
    if (!stripe) {
      return res.status(503).send('Payment processing is not configured');
    }

    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!endpointSecret) {
      console.error('Missing STRIPE_WEBHOOK_SECRET');
      return res.status(500).send('Webhook secret not configured');
    }

    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig as string, endpointSecret);
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      switch (event.type) {
        case 'invoice.payment_succeeded': {
          const invoice = event.data.object as any;
          const subscriptionId = invoice.subscription;
          const customerId = invoice.customer;

          // Find user by Stripe customer ID
          const user = await storage.getUserByStripeCustomerId(customerId);
          if (user) {
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);
            const currentPeriodEnd = new Date((subscription as any).current_period_end * 1000);

            await storage.updateUserSubscription(user.id, {
              subscriptionStatus: 'active',
              subscriptionEndsAt: currentPeriodEnd,
            });
            console.log(`Subscription activated for user ${user.id}`);
          }
          break;
        }

        case 'invoice.payment_failed': {
          const invoice = event.data.object as any;
          const customerId = invoice.customer;

          const user = await storage.getUserByStripeCustomerId(customerId);
          if (user) {
            await storage.updateUserSubscription(user.id, {
              subscriptionStatus: 'past_due',
            });
            console.log(`Payment failed for user ${user.id}`);
          }
          break;
        }

        case 'customer.subscription.deleted': {
          const subscription = event.data.object as any;
          const customerId = subscription.customer;

          const user = await storage.getUserByStripeCustomerId(customerId);
          if (user) {
            await storage.updateUserSubscription(user.id, {
              subscriptionStatus: 'canceled',
            });
            console.log(`Subscription canceled for user ${user.id}`);
          }
          break;
        }

        case 'customer.subscription.updated': {
          const subscription = event.data.object as any;
          const customerId = subscription.customer;
          
          const user = await storage.getUserByStripeCustomerId(customerId);
          if (user) {
            const currentPeriodEnd = new Date((subscription as any).current_period_end * 1000);
            
            await storage.updateUserSubscription(user.id, {
              subscriptionStatus: subscription.status,
              subscriptionEndsAt: currentPeriodEnd,
            });
            console.log(`Subscription updated for user ${user.id}: ${subscription.status}`);
          }
          break;
        }

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      res.json({ received: true });
    } catch (error) {
      console.error('Error processing webhook:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  });

  // Restaurant routes
  app.get('/api/restaurants/me', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      
      if (!restaurant) {
        return res.json(null);
      }

      // Fetch payout account data
      const payoutAccount = await storage.getPayoutAccount(restaurant.id);
      
      res.json({
        ...restaurant,
        payoutAccount: payoutAccount || null
      });
    } catch (error) {
      console.error("Error fetching restaurant:", error);
      res.status(500).json({ message: "Failed to fetch restaurant" });
    }
  });

  app.post('/api/restaurants', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const data = insertRestaurantSchema.parse({ ...req.body, ownerId: userId });
      
      // Convert empty strings to null for optional unique fields
      if (data.customDomain === '') data.customDomain = null;
      if (data.subdomain === '') data.subdomain = null;
      
      // Generate unique slug if conflict exists
      let slug = data.slug;
      let counter = 1;
      while (await storage.getRestaurantBySlug(slug)) {
        slug = `${data.slug}-${counter}`;
        counter++;
      }
      data.slug = slug;
      
      const restaurant = await storage.createRestaurant(data);
      res.json(restaurant);
    } catch (error) {
      console.error("Error creating restaurant:", error);
      res.status(400).json({ message: "Failed to create restaurant" });
    }
  });

  app.put('/api/restaurants/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      
      if (!restaurant || restaurant.id !== req.params.id) {
        return res.status(403).json({ message: "Forbidden: You can only update your own restaurant" });
      }
      
      const data = insertRestaurantSchema.partial().parse(req.body);
      
      // Convert empty strings to null for optional unique fields
      if (data.customDomain === '') data.customDomain = null;
      if (data.subdomain === '') data.subdomain = null;
      
      const updated = await storage.updateRestaurant(req.params.id, data);
      res.json(updated);
    } catch (error) {
      console.error("Error updating restaurant:", error);
      res.status(400).json({ message: "Failed to update restaurant" });
    }
  });

  app.put('/api/restaurants/:id/marketing', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      
      if (!restaurant || restaurant.id !== req.params.id) {
        return res.status(403).json({ message: "Forbidden: You can only update your own restaurant" });
      }
      
      // Update marketing settings in the restaurant's marketingSettings JSONB field
      const updated = await storage.updateRestaurant(req.params.id, {
        marketingSettings: req.body
      });
      res.json(updated);
    } catch (error) {
      console.error("Error updating marketing settings:", error);
      res.status(400).json({ message: "Failed to update marketing settings" });
    }
  });

  // Menu category routes
  app.get('/api/menu/categories', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.json([]);
      }
      const categories = await storage.getMenuCategories(restaurant.id);
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  app.post('/api/menu/categories', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }
      const data = insertMenuCategorySchema.parse({ ...req.body, restaurantId: restaurant.id });
      const category = await storage.createMenuCategory(data);
      res.json(category);
    } catch (error) {
      console.error("Error creating category:", error);
      res.status(400).json({ message: "Failed to create category" });
    }
  });

  app.put('/api/menu/categories/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }
      const data = insertMenuCategorySchema.partial().parse(req.body);
      const updated = await storage.updateMenuCategory(req.params.id, data);
      res.json(updated);
    } catch (error) {
      console.error("Error updating category:", error);
      res.status(400).json({ message: "Failed to update category" });
    }
  });

  app.delete('/api/menu/categories/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }
      await storage.deleteMenuCategory(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting category:", error);
      res.status(400).json({ message: "Failed to delete category" });
    }
  });

  // Menu item routes
  app.get('/api/menu/items', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.json([]);
      }
      const items = await storage.getMenuItems(restaurant.id);
      res.json(items);
    } catch (error) {
      console.error("Error fetching items:", error);
      res.status(500).json({ message: "Failed to fetch items" });
    }
  });

  app.post('/api/menu/items', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }
      const data = insertMenuItemSchema.parse({ ...req.body, restaurantId: restaurant.id });
      
      // If imageUrl is provided, make it publicly accessible
      if (data.imageUrl) {
        console.log("[MENU ITEM CREATE] Original imageUrl:", data.imageUrl);
        const objectStorageService = new ObjectStorageService();
        const publicImagePath = await objectStorageService.trySetObjectEntityAclPolicy(
          data.imageUrl,
          { owner: userId, visibility: "public" }
        );
        console.log("[MENU ITEM CREATE] Public imageUrl:", publicImagePath);
        data.imageUrl = publicImagePath;
      }
      
      const item = await storage.createMenuItem(data);
      res.json(item);
    } catch (error) {
      console.error("Error creating item:", error);
      res.status(400).json({ message: "Failed to create item" });
    }
  });

  app.put('/api/menu/items/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }
      const data = insertMenuItemSchema.partial().parse(req.body);
      
      // If imageUrl is provided, make it publicly accessible
      if (data.imageUrl) {
        console.log("[MENU ITEM UPDATE] Original imageUrl:", data.imageUrl);
        const objectStorageService = new ObjectStorageService();
        const publicImagePath = await objectStorageService.trySetObjectEntityAclPolicy(
          data.imageUrl,
          { owner: userId, visibility: "public" }
        );
        console.log("[MENU ITEM UPDATE] Public imageUrl:", publicImagePath);
        data.imageUrl = publicImagePath;
      }
      
      const updatedItem = await storage.updateMenuItem(req.params.id, data);
      res.json(updatedItem);
    } catch (error) {
      console.error("Error updating menu item:", error);
      res.status(400).json({ message: "Failed to update menu item" });
    }
  });

  app.delete('/api/menu/items/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }
      
      // Verify the item belongs to the user's restaurant
      const item = await storage.getMenuItem(req.params.id);
      if (!item) {
        return res.status(404).json({ message: "Menu item not found" });
      }
      if (item.restaurantId !== restaurant.id) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      await storage.deleteMenuItem(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting menu item:", error);
      res.status(400).json({ message: "Failed to delete menu item" });
    }
  });

  app.post('/api/menu/items/:id/duplicate', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }
      
      // Get the original item
      const originalItem = await storage.getMenuItem(req.params.id);
      if (!originalItem) {
        return res.status(404).json({ message: "Menu item not found" });
      }
      
      // Verify the item belongs to the user's restaurant
      if (originalItem.restaurantId !== restaurant.id) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      // Create duplicate with " (Copy)" appended to name
      const duplicateData = {
        name: `${originalItem.name} (Copy)`,
        description: originalItem.description,
        price: originalItem.price,
        priceCents: originalItem.priceCents,
        categoryId: originalItem.categoryId,
        imageUrl: originalItem.imageUrl,
        isAvailable: originalItem.isAvailable,
        restaurantId: restaurant.id,
        currency: originalItem.currency,
        options: originalItem.options,
        allergens: originalItem.allergens,
        spicyLevel: originalItem.spicyLevel,
        isVegetarian: originalItem.isVegetarian,
        isVegan: originalItem.isVegan,
        isGlutenFree: originalItem.isGlutenFree,
      };
      
      const newItem = await storage.createMenuItem(duplicateData);
      res.json(newItem);
    } catch (error) {
      console.error("Error duplicating menu item:", error);
      res.status(400).json({ message: "Failed to duplicate menu item" });
    }
  });

  // Promo routes
  app.get('/api/promos', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.json([]);
      }
      const promos = await storage.getPromos(restaurant.id);
      res.json(promos);
    } catch (error) {
      console.error("Error fetching promos:", error);
      res.status(500).json({ message: "Failed to fetch promos" });
    }
  });

  app.post('/api/promos', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }
      const data = { ...req.body, restaurantId: restaurant.id };
      const promo = await storage.createPromo(data);
      res.json(promo);
    } catch (error) {
      console.error("Error creating promo:", error);
      res.status(400).json({ message: "Failed to create promo" });
    }
  });

  app.put('/api/promos/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }
      
      // Verify the promo belongs to the user's restaurant
      const promo = await storage.getPromo(req.params.id);
      if (!promo) {
        return res.status(404).json({ message: "Promo not found" });
      }
      if (promo.restaurantId !== restaurant.id) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      const updated = await storage.updatePromo(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Error updating promo:", error);
      res.status(400).json({ message: "Failed to update promo" });
    }
  });

  app.delete('/api/promos/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }
      
      // Verify the promo belongs to the user's restaurant
      const promo = await storage.getPromo(req.params.id);
      if (!promo) {
        return res.status(404).json({ message: "Promo not found" });
      }
      if (promo.restaurantId !== restaurant.id) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      await storage.deletePromo(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting promo:", error);
      res.status(400).json({ message: "Failed to delete promo" });
    }
  });

  // Table routes
  app.get('/api/tables', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.json([]);
      }
      const tables = await storage.getTables(restaurant.id);
      res.json(tables);
    } catch (error) {
      console.error("Error fetching tables:", error);
      res.status(500).json({ message: "Failed to fetch tables" });
    }
  });

  app.post('/api/tables', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }
      const data = insertTableSchema.parse({ ...req.body, restaurantId: restaurant.id });
      const table = await storage.createTable(data);
      res.json(table);
    } catch (error) {
      console.error("Error creating table:", error);
      res.status(400).json({ message: "Failed to create table" });
    }
  });

  app.put('/api/tables/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }
      const { id } = req.params;
      const data = insertTableSchema.partial().parse(req.body);
      const table = await storage.updateTable(id, data);
      res.json(table);
    } catch (error) {
      console.error("Error updating table:", error);
      res.status(400).json({ message: "Failed to update table" });
    }
  });

  app.delete('/api/tables/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }
      
      // Verify the table belongs to the user's restaurant
      const table = await storage.getTable(req.params.id);
      if (!table) {
        return res.status(404).json({ message: "Table not found" });
      }
      if (table.restaurantId !== restaurant.id) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      await storage.deleteTable(req.params.id);
      res.json({ message: "Table deleted successfully" });
    } catch (error) {
      console.error("Error deleting table:", error);
      res.status(400).json({ message: "Failed to delete table" });
    }
  });

  app.post('/api/tables/:id/duplicate', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }
      
      // Get the original table
      const originalTable = await storage.getTable(req.params.id);
      if (!originalTable) {
        return res.status(404).json({ message: "Table not found" });
      }
      
      // Verify the table belongs to the user's restaurant
      if (originalTable.restaurantId !== restaurant.id) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      // Create duplicate with " (Copy)" appended to table number
      const duplicateData = {
        tableNumber: `${originalTable.tableNumber} (Copy)`,
        capacity: originalTable.capacity,
        category: originalTable.category,
        restaurantId: restaurant.id,
      };
      
      const newTable = await storage.createTable(duplicateData);
      res.json(newTable);
    } catch (error) {
      console.error("Error duplicating table:", error);
      res.status(400).json({ message: "Failed to duplicate table" });
    }
  });

  // Reservation routes
  app.get('/api/reservations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.json([]);
      }
      const reservations = await storage.getReservations(restaurant.id);
      res.json(reservations);
    } catch (error) {
      console.error("Error fetching reservations:", error);
      res.status(500).json({ message: "Failed to fetch reservations" });
    }
  });

  app.post('/api/reservations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }
      const data = insertReservationSchema.parse({ 
        ...req.body,
        reservationDate: req.body.reservationDate ? new Date(req.body.reservationDate) : undefined,
        restaurantId: restaurant.id,
        status: 'pending'
      });
      const reservation = await storage.createReservation(data);
      res.json(reservation);
    } catch (error) {
      console.error("Error creating reservation:", error);
      res.status(400).json({ message: "Failed to create reservation" });
    }
  });

  app.put('/api/reservations/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }
      const data = insertReservationSchema.partial().parse({
        ...req.body,
        reservationDate: req.body.reservationDate ? new Date(req.body.reservationDate) : undefined,
      });
      const updatedReservation = await storage.updateReservation(req.params.id, data);
      res.json(updatedReservation);
    } catch (error) {
      console.error("Error updating reservation:", error);
      res.status(400).json({ message: "Failed to update reservation" });
    }
  });

  app.delete('/api/reservations/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }
      await storage.deleteReservation(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting reservation:", error);
      res.status(400).json({ message: "Failed to delete reservation" });
    }
  });

  app.patch('/api/reservations/:id/status', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const userId = req.user.id;
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }
      
      // Verify reservation belongs to this restaurant
      const reservation = await storage.getReservations(restaurant.id);
      const targetReservation = reservation.find(r => r.id === id);
      if (!targetReservation) {
        return res.status(404).json({ message: "Reservation not found" });
      }
      
      const updated = await storage.updateReservation(id, { status });
      res.json(updated);
    } catch (error) {
      console.error("Error updating reservation status:", error);
      res.status(400).json({ message: "Failed to update reservation status" });
    }
  });

  // Order routes
  app.get('/api/orders', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.json([]);
      }
      const orders = await storage.getOrders(restaurant.id);
      res.json(orders);
    } catch (error) {
      console.error("Error fetching orders:", error);
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  app.get('/api/orders/recent', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.json([]);
      }
      const orders = await storage.getRecentOrders(restaurant.id, 5);
      res.json(orders);
    } catch (error) {
      console.error("Error fetching recent orders:", error);
      res.status(500).json({ message: "Failed to fetch recent orders" });
    }
  });

  app.get('/api/orders/new-count', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.json({ count: 0 });
      }
      
      // Get all pending orders for the restaurant
      const orders = await storage.getOrders(restaurant.id);
      const newOrders = orders.filter(order => order.status === 'pending');
      
      res.json({ count: newOrders.length });
    } catch (error) {
      console.error("Error fetching new orders count:", error);
      res.status(500).json({ message: "Failed to fetch new orders count" });
    }
  });

  app.post('/api/orders', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }
      
      const data = orderSchema.parse(req.body);
      const orderNumber = await generateOrderNumber(restaurant.id, 'ORD');
      
      const order = await storage.createOrder({
        restaurantId: restaurant.id,
        orderNumber,
        orderType: data.orderType,
        tableId: data.tableId || null,
        customerName: data.customerName || null,
        customerPhone: data.customerPhone || null,
        customerEmail: data.customerEmail || null,
        paymentMethod: data.paymentMethod || null,
        subtotal: data.subtotal,
        tax: data.tax,
        total: data.total,
        status: 'pending',
        paymentStatus: 'pending',
      }, data.items.map(item => ({
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: (parseFloat(item.unitPrice) * item.quantity).toFixed(2),
        notes: item.notes || null,
      })));
      
      res.json(order);
    } catch (error) {
      console.error("Error creating order:", error);
      res.status(400).json({ message: "Failed to create order" });
    }
  });

  app.get('/api/orders/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }
      
      const orderData = await storage.getOrderWithItems(id);
      if (!orderData) {
        return res.status(404).json({ message: "Order not found" });
      }
      
      // Verify order belongs to this restaurant
      if (orderData.order.restaurantId !== restaurant.id) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      res.json(orderData);
    } catch (error) {
      console.error("Error fetching order:", error);
      res.status(500).json({ message: "Failed to fetch order" });
    }
  });

  app.patch('/api/orders/:id/status', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const userId = req.user.id;
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }
      
      // Get order to verify ownership
      const orderData = await storage.getOrderWithItems(id);
      if (!orderData) {
        return res.status(404).json({ message: "Order not found" });
      }
      
      if (orderData.order.restaurantId !== restaurant.id) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      const updated = await storage.updateOrderStatus(id, status);
      res.json(updated);
    } catch (error) {
      console.error("Error updating order status:", error);
      res.status(400).json({ message: "Failed to update order status" });
    }
  });

  // Inbox & Reviews routes
  app.get('/api/inbox/messages', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.json([]);
      }
      const messages = await storage.getInboxMessages(restaurant.id);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching inbox messages:", error);
      res.status(500).json({ message: "Failed to fetch inbox messages" });
    }
  });

  app.post('/api/inbox/messages/:id/respond', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { response } = req.body;
      const userId = req.user.id;
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }

      const updated = await storage.respondToMessage(id, response);
      res.json(updated);
    } catch (error) {
      console.error("Error responding to message:", error);
      res.status(400).json({ message: "Failed to respond to message" });
    }
  });

  app.patch('/api/inbox/messages/:id/status', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const userId = req.user.id;
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }

      const updated = await storage.updateMessageStatus(id, status);
      res.json(updated);
    } catch (error) {
      console.error("Error updating message status:", error);
      res.status(400).json({ message: "Failed to update message status" });
    }
  });

  app.get('/api/reviews', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.json([]);
      }
      const reviews = await storage.getCustomerReviews(restaurant.id);
      res.json(reviews);
    } catch (error) {
      console.error("Error fetching reviews:", error);
      res.status(500).json({ message: "Failed to fetch reviews" });
    }
  });

  app.post('/api/reviews/:id/respond', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { response } = req.body;
      const userId = req.user.id;
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }

      const updated = await storage.respondToReview(id, response);
      res.json(updated);
    } catch (error) {
      console.error("Error responding to review:", error);
      res.status(400).json({ message: "Failed to respond to review" });
    }
  });

  // Bundle routes
  app.get('/api/bundles', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.json([]);
      }
      const bundles = await storage.getBundles(restaurant.id);
      res.json(bundles);
    } catch (error) {
      console.error("Error fetching bundles:", error);
      res.status(500).json({ message: "Failed to fetch bundles" });
    }
  });

  app.post('/api/bundles', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }
      const bundle = await storage.createBundle({
        ...req.body,
        restaurantId: restaurant.id,
        sales: req.body.sales || 0,
      });
      res.json(bundle);
    } catch (error) {
      console.error("Error creating bundle:", error);
      res.status(400).json({ message: "Failed to create bundle" });
    }
  });

  app.put('/api/bundles/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }
      const { id } = req.params;
      const bundle = await storage.updateBundle(id, req.body);
      res.json(bundle);
    } catch (error) {
      console.error("Error updating bundle:", error);
      res.status(400).json({ message: "Failed to update bundle" });
    }
  });

  app.delete('/api/bundles/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }
      const { id } = req.params;
      await storage.deleteBundle(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting bundle:", error);
      res.status(400).json({ message: "Failed to delete bundle" });
    }
  });

  // Staff routes
  app.get('/api/staff', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.json([]);
      }
      const staff = await storage.getStaff(restaurant.id);
      res.json(staff);
    } catch (error) {
      console.error("Error fetching staff:", error);
      res.status(500).json({ message: "Failed to fetch staff" });
    }
  });

  app.post('/api/staff', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }
      const data = insertStaffSchema.parse({ ...req.body, restaurantId: restaurant.id });
      const staff = await storage.createStaff(data);
      res.json(staff);
    } catch (error) {
      console.error("Error creating staff:", error);
      res.status(400).json({ message: "Failed to create staff" });
    }
  });

  app.put('/api/staff/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }
      const data = insertStaffSchema.partial().parse(req.body);
      const updatedStaff = await storage.updateStaff(req.params.id, data);
      res.json(updatedStaff);
    } catch (error) {
      console.error("Error updating staff:", error);
      res.status(400).json({ message: "Failed to update staff" });
    }
  });

  app.delete('/api/staff/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }
      await storage.deleteStaff(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting staff:", error);
      res.status(400).json({ message: "Failed to delete staff" });
    }
  });

  // Inventory routes
  app.get('/api/inventory', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.json([]);
      }
      const inventory = await storage.getInventory(restaurant.id);
      res.json(inventory);
    } catch (error) {
      console.error("Error fetching inventory:", error);
      res.status(500).json({ message: "Failed to fetch inventory" });
    }
  });

  app.post('/api/inventory', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }
      const data = insertInventorySchema.parse({ ...req.body, restaurantId: restaurant.id });
      const inventory = await storage.createInventory(data);
      res.json(inventory);
    } catch (error) {
      console.error("Error creating inventory:", error);
      res.status(400).json({ message: "Failed to create inventory" });
    }
  });

  app.put('/api/inventory/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }
      const data = insertInventorySchema.partial().parse(req.body);
      const updatedInventory = await storage.updateInventory(req.params.id, data);
      res.json(updatedInventory);
    } catch (error) {
      console.error("Error updating inventory:", error);
      res.status(400).json({ message: "Failed to update inventory" });
    }
  });

  app.delete('/api/inventory/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }
      await storage.deleteInventory(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting inventory:", error);
      res.status(400).json({ message: "Failed to delete inventory" });
    }
  });

  // Delivery zone routes
  app.get('/api/delivery-zones', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.json([]);
      }
      const zones = await storage.getDeliveryZones(restaurant.id);
      res.json(zones);
    } catch (error) {
      console.error("Error fetching delivery zones:", error);
      res.status(500).json({ message: "Failed to fetch delivery zones" });
    }
  });

  app.post('/api/delivery-zones', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }
      const data = insertDeliveryZoneSchema.parse({ ...req.body, restaurantId: restaurant.id });
      const zone = await storage.createDeliveryZone(data);
      res.json(zone);
    } catch (error) {
      console.error("Error creating delivery zone:", error);
      res.status(400).json({ message: "Failed to create delivery zone" });
    }
  });

  app.patch('/api/delivery-zones/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }
      
      // Get zone to verify ownership
      const zones = await storage.getDeliveryZones(restaurant.id);
      const zone = zones.find(z => z.id === id);
      if (!zone) {
        return res.status(404).json({ message: "Delivery zone not found" });
      }
      
      const updated = await storage.updateDeliveryZone(id, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Error updating delivery zone:", error);
      res.status(400).json({ message: "Failed to update delivery zone" });
    }
  });

  app.delete('/api/delivery-zones/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }
      
      // Get zone to verify ownership
      const zones = await storage.getDeliveryZones(restaurant.id);
      const zone = zones.find(z => z.id === id);
      if (!zone) {
        return res.status(404).json({ message: "Delivery zone not found" });
      }
      
      await storage.deleteDeliveryZone(id);
      res.json({ message: "Delivery zone deleted" });
    } catch (error) {
      console.error("Error deleting delivery zone:", error);
      res.status(400).json({ message: "Failed to delete delivery zone" });
    }
  });

  // Payout routes
  app.get('/api/earnings-ledger', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.json([]);
      }
      const ledger = await storage.getEarningsLedger(restaurant.id);
      res.json(ledger);
    } catch (error) {
      console.error("Error fetching earnings ledger:", error);
      res.status(500).json({ message: "Failed to fetch earnings ledger" });
    }
  });

  app.get('/api/payout-runs', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.json([]);
      }
      const runs = await storage.getPayoutRuns(restaurant.id);
      res.json(runs);
    } catch (error) {
      console.error("Error fetching payout runs:", error);
      res.status(500).json({ message: "Failed to fetch payout runs" });
    }
  });

  app.get('/api/pending-earnings', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.json({ total: '0', count: 0 });
      }
      const pending = await storage.getPendingEarnings(restaurant.id);
      res.json(pending);
    } catch (error) {
      console.error("Error fetching pending earnings:", error);
      res.status(500).json({ message: "Failed to fetch pending earnings" });
    }
  });

  // Driver routes
  app.get('/api/drivers', isAuthenticated, async (req: any, res) => {
    try {
      const drivers = await storage.getAllDrivers();
      res.json(drivers);
    } catch (error) {
      console.error("Error fetching drivers:", error);
      res.status(500).json({ message: "Failed to fetch drivers" });
    }
  });

  app.get('/api/drivers/:id', isAuthenticated, async (req: any, res) => {
    try {
      const driver = await storage.getDriver(req.params.id);
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }
      res.json(driver);
    } catch (error) {
      console.error("Error fetching driver:", error);
      res.status(500).json({ message: "Failed to fetch driver" });
    }
  });

  app.put('/api/drivers/:id/availability', isAuthenticated, async (req: any, res) => {
    try {
      const { isAvailable } = req.body;
      const updatedDriver = await storage.updateDriverAvailability(req.params.id, isAvailable);
      res.json(updatedDriver);
    } catch (error) {
      console.error("Error updating driver availability:", error);
      res.status(400).json({ message: "Failed to update driver availability" });
    }
  });

  app.get('/api/driver-assignments', isAuthenticated, async (req: any, res) => {
    try {
      const assignments = await storage.getDriverAssignments();
      res.json(assignments);
    } catch (error) {
      console.error("Error fetching driver assignments:", error);
      res.status(500).json({ message: "Failed to fetch driver assignments" });
    }
  });

  app.get('/api/driver-performance', isAuthenticated, async (req: any, res) => {
    try {
      const performance = await storage.getDriverPerformance();
      res.json(performance);
    } catch (error) {
      console.error("Error fetching driver performance:", error);
      res.status(500).json({ message: "Failed to fetch driver performance" });
    }
  });

  // Driver Application Routes
  app.post('/api/driver/apply', async (req: any, res) => {
    try {
      // Server-side validation using the driver profile insert schema
      const applicationData = req.body;
      
      // Validate required fields
      if (!applicationData.firstName || !applicationData.lastName || !applicationData.email || !applicationData.phone) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      
      // Check if driver already applied with this email
      const existing = await storage.getDriverByEmail(applicationData.email);
      if (existing) {
        return res.status(400).json({ message: "Application already exists with this email" });
      }
      
      const application = await storage.createDriverApplication(applicationData);
      res.status(201).json(application);
    } catch (error) {
      console.error("Error submitting driver application:", error);
      res.status(500).json({ message: "Failed to submit application" });
    }
  });

  app.get('/api/driver/applications/pending', isAuthenticated, async (req: any, res) => {
    try {
      // Only admins can view pending applications
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      const pending = await storage.getPendingDriverApplications();
      res.json(pending);
    } catch (error) {
      console.error("Error fetching pending applications:", error);
      res.status(500).json({ message: "Failed to fetch pending applications" });
    }
  });

  app.post('/api/driver/applications/:id/approve', isAuthenticated, async (req: any, res) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      const approved = await storage.approveDriverApplication(req.params.id, req.user.id);
      res.json(approved);
    } catch (error) {
      console.error("Error approving driver application:", error);
      res.status(500).json({ message: "Failed to approve application" });
    }
  });

  app.post('/api/driver/applications/:id/reject', isAuthenticated, async (req: any, res) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      const { reason } = req.body;
      const rejected = await storage.rejectDriverApplication(req.params.id, reason || "Application rejected");
      res.json(rejected);
    } catch (error) {
      console.error("Error rejecting driver application:", error);
      res.status(500).json({ message: "Failed to reject application" });
    }
  });

  // Helper function to check and update profile completion
  async function updateProfileCompletion(userId: string) {
    const user = await storage.getUser(userId);
    if (!user) return false;

    const isComplete = !!(
      user.phone &&
      user.dateOfBirth &&
      user.address &&
      user.city &&
      user.country &&
      user.postalCode &&
      user.emergencyContactName &&
      user.emergencyContactPhone &&
      user.vehicleType &&
      user.vehicleMake &&
      user.vehicleModel &&
      user.vehicleYear &&
      user.vehiclePlate &&
      user.vehicleColor &&
      user.licenseNumber &&
      user.licenseExpiry &&
      user.idProofUrl &&
      user.insuranceUrl &&
      user.stripeAccountId
    );

    if (user.profileComplete !== isComplete) {
      await storage.updateUser(userId, { profileComplete: isComplete });
    }

    return isComplete;
  }

  // Driver Profile
  app.get('/api/driver/profile', isAuthenticated, async (req: any, res) => {
    try {
      const driver = await storage.getDriverByUserId(req.user.id);
      if (!driver) {
        return res.status(404).json({ message: "Driver profile not found" });
      }
      res.json(driver);
    } catch (error) {
      console.error("Error fetching driver profile:", error);
      res.status(500).json({ message: "Failed to fetch driver profile" });
    }
  });

  // Update driver personal info
  const personalInfoSchema = z.object({
    phone: z.string().min(10, "Phone number is required"),
    dateOfBirth: z.string().min(1, "Date of birth is required"),
    address: z.string().min(1, "Address is required"),
    city: z.string().min(1, "City is required"),
    country: z.string().min(1, "Country is required"),
    postalCode: z.string().min(1, "Postal code is required"),
    emergencyContactName: z.string().min(1, "Emergency contact name is required"),
    emergencyContactPhone: z.string().min(10, "Emergency contact phone is required"),
  });

  app.patch('/api/driver/personal-info', isAuthenticated, async (req: any, res) => {
    try {
      if (req.user.role !== 'driver') {
        return res.status(403).json({ message: "Only drivers can update their profile" });
      }

      const validatedData = personalInfoSchema.parse(req.body);
      
      const updated = await storage.updateUser(req.user.id, validatedData);
      
      // Recalculate and update profile completion
      await updateProfileCompletion(req.user.id);
      
      const { password, ...userWithoutPassword } = updated;
      res.json(userWithoutPassword);
    } catch (error: any) {
      console.error("Error updating personal info:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Failed to update personal info" });
    }
  });

  // Update driver vehicle info
  const vehicleInfoSchema = z.object({
    vehicleType: z.enum(["car", "motorcycle", "bicycle", "scooter"]),
    vehicleMake: z.string().min(1, "Vehicle make is required"),
    vehicleModel: z.string().min(1, "Vehicle model is required"),
    vehicleYear: z.string().min(4, "Vehicle year is required"),
    vehiclePlate: z.string().min(1, "License plate is required"),
    vehicleColor: z.string().min(1, "Vehicle color is required"),
    licenseNumber: z.string().min(1, "Driver's license number is required"),
    licenseExpiry: z.string().min(1, "License expiry date is required"),
  });

  app.patch('/api/driver/vehicle-info', isAuthenticated, async (req: any, res) => {
    try {
      if (req.user.role !== 'driver') {
        return res.status(403).json({ message: "Only drivers can update their profile" });
      }

      const validatedData = vehicleInfoSchema.parse(req.body);
      
      const updated = await storage.updateUser(req.user.id, validatedData);
      
      // Recalculate and update profile completion
      await updateProfileCompletion(req.user.id);
      
      const { password, ...userWithoutPassword } = updated;
      res.json(userWithoutPassword);
    } catch (error: any) {
      console.error("Error updating vehicle info:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Failed to update vehicle info" });
    }
  });

  // Update driver documents
  const documentsSchema = z.object({
    idProofUrl: z.string().url("Invalid ID proof URL").optional(),
    insuranceUrl: z.string().url("Invalid insurance URL").optional(),
  });

  app.patch('/api/driver/documents', isAuthenticated, async (req: any, res) => {
    try {
      if (req.user.role !== 'driver') {
        return res.status(403).json({ message: "Only drivers can update their profile" });
      }

      const validatedData = documentsSchema.parse(req.body);
      
      const updated = await storage.updateUser(req.user.id, validatedData);
      
      // Recalculate and update profile completion
      await updateProfileCompletion(req.user.id);
      
      const { password, ...userWithoutPassword } = updated;
      res.json(userWithoutPassword);
    } catch (error: any) {
      console.error("Error updating documents:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Failed to update documents" });
    }
  });

  // Check profile completion and update status
  app.get('/api/driver/check-completion', isAuthenticated, async (req: any, res) => {
    try {
      if (req.user.role !== 'driver') {
        return res.status(403).json({ message: "Only drivers can check their profile" });
      }

      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check if all required fields are filled
      const isComplete = !!(
        user.phone &&
        user.dateOfBirth &&
        user.address &&
        user.city &&
        user.country &&
        user.postalCode &&
        user.emergencyContactName &&
        user.emergencyContactPhone &&
        user.vehicleType &&
        user.vehicleMake &&
        user.vehicleModel &&
        user.vehicleYear &&
        user.vehiclePlate &&
        user.vehicleColor &&
        user.licenseNumber &&
        user.licenseExpiry &&
        user.idProofUrl &&
        user.insuranceUrl &&
        user.stripeAccountId // Must have connected bank account
      );

      // Update profile completion status if changed
      if (user.profileComplete !== isComplete) {
        await storage.updateUser(req.user.id, { profileComplete: isComplete });
      }

      res.json({ 
        profileComplete: isComplete,
        adminApproved: user.adminApproved || false,
      });
    } catch (error) {
      console.error("Error checking profile completion:", error);
      res.status(500).json({ message: "Failed to check profile completion" });
    }
  });

  // Driver Order Routes
  app.get('/api/driver/my-orders', isAuthenticated, async (req: any, res) => {
    try {
      // Get driver profile for authenticated user
      const driver = await storage.getDriverByUserId(req.user.id);
      if (!driver) {
        return res.status(404).json({ message: "Driver profile not found" });
      }
      
      if (driver.applicationStatus !== 'approved') {
        return res.status(403).json({ message: "Driver account not approved" });
      }
      
      const orders = await storage.getDriverOrders(driver.id);
      res.json(orders);
    } catch (error) {
      console.error("Error fetching driver orders:", error);
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  app.put('/api/driver/orders/:id/tracking', isAuthenticated, async (req: any, res) => {
    try {
      const orderId = req.params.id;
      const { pickupTime, deliveryTime, location } = req.body;
      
      // Get order and verify driver is assigned to it
      const orderData = await storage.getOrderWithItems(orderId);
      if (!orderData) {
        return res.status(404).json({ message: "Order not found" });
      }
      
      // Get driver profile for authenticated user
      const driver = await storage.getDriverByUserId(req.user.id);
      if (!driver) {
        return res.status(403).json({ message: "Driver profile not found" });
      }
      
      // Verify this driver is assigned to the order
      if (orderData.order.assignedDriverId !== driver.id) {
        return res.status(403).json({ message: "You are not assigned to this order" });
      }
      
      const trackingData: any = {};
      if (pickupTime) trackingData.pickupTime = new Date(pickupTime);
      if (deliveryTime) trackingData.deliveryTime = new Date(deliveryTime);
      if (location) trackingData.driverLocation = location;
      
      const updated = await storage.updateOrderDeliveryTracking(orderId, trackingData);
      res.json(updated);
    } catch (error) {
      console.error("Error updating delivery tracking:", error);
      res.status(500).json({ message: "Failed to update delivery tracking" });
    }
  });

  app.post('/api/orders/:id/assign-driver', isAuthenticated, async (req: any, res) => {
    try {
      const { driverId } = req.body;
      const orderId = req.params.id;
      
      // Verify user is restaurant owner or admin
      const order = await storage.getOrderWithItems(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      
      const restaurant = await storage.getRestaurant(order.order.restaurantId);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }
      
      if (req.user.role !== 'admin' && restaurant.ownerId !== req.user.id) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      const updated = await storage.assignDriverToOrder(orderId, driverId);
      res.json(updated);
    } catch (error) {
      console.error("Error assigning driver to order:", error);
      res.status(500).json({ message: "Failed to assign driver" });
    }
  });

  // Stripe Connect for Drivers: Create Express Connected Account
  app.post("/api/driver/connect/create-account", isAuthenticated, async (req: any, res) => {
    try {
      if (!stripe) {
        return res.status(503).json({ error: "Stripe is not configured" });
      }

      // Get driver profile
      const driver = await storage.getDriverByUserId(req.user.id);
      if (!driver) {
        return res.status(404).json({ error: "Driver profile not found" });
      }

      if (driver.applicationStatus !== 'approved') {
        return res.status(403).json({ error: "Driver application not approved yet" });
      }

      // Check if already has a connected account
      if (driver.stripeConnectAccountId) {
        return res.status(400).json({ error: "Stripe account already connected" });
      }

      // Create Stripe Express account for driver
      const account = await stripe.accounts.create({
        type: 'express',
        country: driver.country === 'United States' ? 'US' : 'US', // Default to US, expand later
        email: driver.email,
        capabilities: {
          transfers: { requested: true },
        },
        business_type: 'individual',
        individual: {
          first_name: driver.firstName,
          last_name: driver.lastName,
          email: driver.email,
          phone: driver.phone,
        },
      });

      // Save account ID to driver profile
      await storage.updateDriverProfile(driver.id, {
        stripeConnectAccountId: account.id,
      });

      res.json({
        accountId: account.id,
        success: true,
      });
    } catch (error: any) {
      console.error("Error creating driver Stripe Connect account:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  // Stripe Connect for Drivers: Generate onboarding link
  app.post("/api/driver/connect/onboarding-link", isAuthenticated, async (req: any, res) => {
    try {
      if (!stripe) {
        return res.status(503).json({ error: "Stripe is not configured" });
      }

      const driver = await storage.getDriverByUserId(req.user.id);
      if (!driver) {
        return res.status(404).json({ error: "Driver profile not found" });
      }

      if (!driver.stripeConnectAccountId) {
        return res.status(400).json({ error: "No Stripe account found. Create one first." });
      }

      const baseUrl = process.env.NODE_ENV === 'production' 
        ? `https://${process.env.REPLIT_DOMAINS}` 
        : `http://localhost:5000`;

      const accountLink = await stripe.accountLinks.create({
        account: driver.stripeConnectAccountId,
        refresh_url: `${baseUrl}/driver/dashboard?connect=refresh`,
        return_url: `${baseUrl}/driver/dashboard?connect=success`,
        type: 'account_onboarding',
      });

      res.json({
        url: accountLink.url,
      });
    } catch (error: any) {
      console.error("Error creating driver onboarding link:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  // Stripe Connect for Drivers: Check account status
  app.get("/api/driver/connect/status", isAuthenticated, async (req: any, res) => {
    try {
      if (!stripe) {
        return res.status(503).json({ error: "Stripe is not configured" });
      }

      const driver = await storage.getDriverByUserId(req.user.id);
      if (!driver) {
        return res.status(404).json({ error: "Driver profile not found" });
      }

      if (!driver.stripeConnectAccountId) {
        return res.json({
          connected: false,
          payoutsEnabled: false,
        });
      }

      const account = await stripe.accounts.retrieve(driver.stripeConnectAccountId);

      // Update onboarding completed status
      if (account.payouts_enabled && !driver.stripeOnboardingCompleted) {
        await storage.updateDriverProfile(driver.id, {
          stripeOnboardingCompleted: true,
        });
      }

      res.json({
        connected: true,
        payoutsEnabled: account.payouts_enabled,
        requirementsCurrentlyDue: account.requirements?.currently_due || [],
        requirementsEventuallyDue: account.requirements?.eventually_due || [],
      });
    } catch (error: any) {
      console.error("Error checking driver account status:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  // Calculate delivery fee based on customer address
  app.get('/api/storefront/delivery-fee/:restaurantId', async (req: any, res) => {
    try {
      const { restaurantId } = req.params;
      const { country, city, neighborhood } = req.query;

      if (!country || !city) {
        return res.status(400).json({ message: "Country and city are required" });
      }

      // Normalize inputs for case-insensitive comparison
      const normalizedCountry = String(country).trim().toLowerCase();
      const normalizedCity = String(city).trim().toLowerCase();
      const normalizedNeighborhood = neighborhood ? String(neighborhood).trim().toLowerCase() : null;

      // Get all active delivery zones for the restaurant
      const zones = await storage.getDeliveryZones(restaurantId);
      const activeZones = zones.filter(z => z.isActive);

      if (activeZones.length === 0) {
        return res.status(404).json({ 
          message: "Delivery not available",
          deliveryAvailable: false 
        });
      }

      let matchedZone = null;

      // If neighborhood provided, match exact neighborhood
      if (normalizedNeighborhood) {
        matchedZone = activeZones.find(z => 
          z.country?.trim().toLowerCase() === normalizedCountry && 
          z.city?.trim().toLowerCase() === normalizedCity && 
          z.neighborhood?.trim().toLowerCase() === normalizedNeighborhood
        );
        
        // If neighborhood provided but no match found, delivery not available
        if (!matchedZone) {
          return res.status(404).json({ 
            message: "Delivery not available to this neighborhood",
            deliveryAvailable: false 
          });
        }
      } else {
        // No neighborhood provided, match city-level zones (zones without specific neighborhood)
        matchedZone = activeZones.find(z => 
          z.country?.trim().toLowerCase() === normalizedCountry && 
          z.city?.trim().toLowerCase() === normalizedCity && 
          !z.neighborhood
        );
      }

      if (!matchedZone) {
        return res.status(404).json({ 
          message: "Delivery not available to this location",
          deliveryAvailable: false 
        });
      }

      res.json({
        deliveryAvailable: true,
        deliveryFee: matchedZone.deliveryFee,
        minimumOrderAmount: matchedZone.minimumOrder,
        zone: {
          id: matchedZone.id,
          country: matchedZone.country,
          city: matchedZone.city,
          neighborhood: matchedZone.neighborhood,
        }
      });
    } catch (error) {
      console.error("Error calculating delivery fee:", error);
      res.status(500).json({ message: "Failed to calculate delivery fee" });
    }
  });

  // Driver Delivery API Routes
  
  // 1. GET /api/driver/available-orders - Fetch unassigned delivery orders
  app.get('/api/driver/available-orders', isAuthenticated, async (req: any, res) => {
    try {
      // Verify user is a driver
      if (req.user.role !== 'driver') {
        return res.status(403).json({ message: "Only drivers can access this endpoint" });
      }

      // Get driver profile
      const driver = await storage.getDriverByUserId(req.user.id);
      if (!driver) {
        return res.status(404).json({ message: "Driver profile not found" });
      }

      // Check if driver is approved
      if (driver.applicationStatus !== 'approved') {
        return res.status(403).json({ message: "Driver account not approved" });
      }

      // Get available orders
      const availableOrders = await storage.getAvailableDeliveryOrders();

      // Calculate estimated earnings for each order (80% of delivery fee)
      const ordersWithEarnings = availableOrders.map(order => {
        const deliveryFee = parseFloat(order.deliveryFee || '0');
        const driverShare = (deliveryFee * 0.8).toFixed(2);
        
        return {
          ...order,
          estimatedEarnings: driverShare,
        };
      });

      res.json(ordersWithEarnings);
    } catch (error) {
      console.error("Error fetching available orders:", error);
      res.status(500).json({ message: "Failed to fetch available orders" });
    }
  });

  // 2. POST /api/driver/orders/:orderId/accept - Driver accepts an order
  app.post('/api/driver/orders/:orderId/accept', isAuthenticated, async (req: any, res) => {
    try {
      const { orderId } = req.params;

      // Verify user is a driver
      if (req.user.role !== 'driver') {
        return res.status(403).json({ message: "Only drivers can accept orders" });
      }

      // Get driver profile
      const driver = await storage.getDriverByUserId(req.user.id);
      if (!driver) {
        return res.status(404).json({ message: "Driver profile not found" });
      }

      // Check if driver is approved
      if (driver.applicationStatus !== 'approved') {
        return res.status(403).json({ message: "Driver account not approved" });
      }

      // Check if driver is available
      if (!driver.isAvailable) {
        return res.status(403).json({ message: "Please set your status to available before accepting orders" });
      }

      // Get order details
      const orderData = await storage.getOrderWithItems(orderId);
      if (!orderData) {
        return res.status(404).json({ message: "Order not found" });
      }

      const order = orderData.order;

      // Validate order is available
      if (order.assignedDriverId) {
        return res.status(400).json({ message: "Order already assigned to another driver" });
      }

      if (order.status !== 'confirmed') {
        return res.status(400).json({ message: "Order is not available for pickup" });
      }

      if (order.orderType !== 'delivery') {
        return res.status(400).json({ message: "This is not a delivery order" });
      }

      if (order.paymentStatus !== 'paid') {
        return res.status(400).json({ message: "Payment not confirmed for this order" });
      }

      // Calculate driver earnings (80% of delivery fee)
      const deliveryFee = parseFloat(order.deliveryFee || '0');
      const driverShare = (deliveryFee * 0.8).toFixed(2);

      // Update order with driver assignment and earnings
      const updatedOrder = await storage.updateOrder(orderId, {
        assignedDriverId: driver.id,
        driverAcceptedAt: new Date(),
        driverShare: driverShare,
      });

      // Create driver delivery status record
      await storage.createDriverDeliveryStatus({
        orderId,
        driverId: driver.id,
        restaurantId: order.restaurantId,
      });

      // WebSocket broadcast to restaurant and admins
      wsManager.broadcastToRestaurant(order.restaurantId, {
        type: 'driver_assigned',
        data: {
          orderId,
          driverId: driver.id,
          driverName: `${driver.firstName} ${driver.lastName}`,
          driverPhone: driver.phone,
        },
      });

      wsManager.broadcastToAdmins({
        type: 'driver_assigned',
        data: {
          orderId,
          driverId: driver.id,
          restaurantId: order.restaurantId,
        },
      });

      res.json({
        ...updatedOrder,
        driver: {
          id: driver.id,
          firstName: driver.firstName,
          lastName: driver.lastName,
          phone: driver.phone,
        },
      });
    } catch (error) {
      console.error("Error accepting order:", error);
      res.status(500).json({ message: "Failed to accept order" });
    }
  });

  // 3. POST /api/driver/orders/:orderId/status - Update delivery status
  app.post('/api/driver/orders/:orderId/status', isAuthenticated, async (req: any, res) => {
    try {
      const { orderId } = req.params;
      const { status } = req.body;

      // Validate status
      const validStatuses = ['en_route_to_pickup', 'arrived_at_restaurant', 'picked_up', 'en_route_to_customer', 'delivered'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      // Verify user is a driver
      if (req.user.role !== 'driver') {
        return res.status(403).json({ message: "Only drivers can update delivery status" });
      }

      // Get driver profile
      const driver = await storage.getDriverByUserId(req.user.id);
      if (!driver) {
        return res.status(404).json({ message: "Driver profile not found" });
      }

      // Get order and verify driver owns it
      const orderData = await storage.getOrderWithItems(orderId);
      if (!orderData) {
        return res.status(404).json({ message: "Order not found" });
      }

      if (orderData.order.assignedDriverId !== driver.id) {
        return res.status(403).json({ message: "You are not assigned to this order" });
      }

      // Prepare update data based on status
      const updateData: any = { status };
      const now = new Date();

      switch (status) {
        case 'en_route_to_pickup':
          updateData.enRouteToPickupAt = now;
          break;
        case 'arrived_at_restaurant':
          updateData.arrivedAtRestaurantAt = now;
          break;
        case 'picked_up':
          updateData.pickedUpAt = now;
          break;
        case 'en_route_to_customer':
          updateData.enRouteToCustomerAt = now;
          break;
        case 'delivered':
          updateData.deliveredAt = now;
          break;
      }

      // Update driver delivery status
      const updatedStatus = await storage.updateDriverDeliveryStatus(orderId, updateData);

      // Update order status based on delivery status
      if (status === 'picked_up') {
        await storage.updateOrder(orderId, { status: 'out_for_delivery' });
      } else if (status === 'delivered') {
        await storage.updateOrder(orderId, { 
          status: 'delivered',
          deliveryTime: now,
        });
      }

      // WebSocket broadcast to restaurant, customer, and admins
      wsManager.broadcastToRestaurant(orderData.order.restaurantId, {
        type: 'delivery_status_updated',
        data: {
          orderId,
          status,
          timestamp: now,
        },
      });

      wsManager.broadcastToAdmins({
        type: 'delivery_status_updated',
        data: {
          orderId,
          status,
          driverId: driver.id,
          restaurantId: orderData.order.restaurantId,
        },
      });

      res.json(updatedStatus);
    } catch (error) {
      console.error("Error updating delivery status:", error);
      res.status(500).json({ message: "Failed to update delivery status" });
    }
  });

  // 4. GET /api/driver/active-delivery - Get current active delivery
  app.get('/api/driver/active-delivery', isAuthenticated, async (req: any, res) => {
    try {
      // Verify user is a driver
      if (req.user.role !== 'driver') {
        return res.status(403).json({ message: "Only drivers can access this endpoint" });
      }

      // Get driver profile
      const driver = await storage.getDriverByUserId(req.user.id);
      if (!driver) {
        return res.status(404).json({ message: "Driver profile not found" });
      }

      // Get active delivery
      const activeDelivery = await storage.getDriverActiveDelivery(driver.id);

      if (!activeDelivery) {
        return res.json(null);
      }

      // Get order items
      const orderWithItems = await storage.getOrderWithItems(activeDelivery.orderId);

      res.json({
        ...activeDelivery,
        items: orderWithItems?.items || [],
      });
    } catch (error) {
      console.error("Error fetching active delivery:", error);
      res.status(500).json({ message: "Failed to fetch active delivery" });
    }
  });

  // 5. GET /api/driver/stats - Get driver performance stats
  app.get('/api/driver/stats', isAuthenticated, async (req: any, res) => {
    try {
      // Verify user is a driver
      if (req.user.role !== 'driver') {
        return res.status(403).json({ message: "Only drivers can access this endpoint" });
      }

      // Get driver profile
      const driver = await storage.getDriverByUserId(req.user.id);
      if (!driver) {
        return res.status(404).json({ message: "Driver profile not found" });
      }

      // Get stats
      const stats = await storage.getDriverStats(driver.id);

      res.json({
        ...stats,
        acceptanceRate: '100%', // Placeholder - would need tracking
        onTimeRate: '95%', // Placeholder - would need tracking
      });
    } catch (error) {
      console.error("Error fetching driver stats:", error);
      res.status(500).json({ message: "Failed to fetch driver stats" });
    }
  });

  // 6. POST /api/driver/status - Toggle driver online/offline status
  app.post('/api/driver/status', isAuthenticated, async (req: any, res) => {
    try {
      const { isAvailable } = req.body;

      if (typeof isAvailable !== 'boolean') {
        return res.status(400).json({ message: "isAvailable must be a boolean" });
      }

      // Verify user is a driver
      if (req.user.role !== 'driver') {
        return res.status(403).json({ message: "Only drivers can update their status" });
      }

      // Get driver profile
      const driver = await storage.getDriverByUserId(req.user.id);
      if (!driver) {
        return res.status(404).json({ message: "Driver profile not found" });
      }

      // Update availability
      const updatedDriver = await storage.updateDriverProfile(driver.id, { isAvailable });

      // WebSocket broadcast to admins
      wsManager.broadcastToAdmins({
        type: 'driver_availability_changed',
        data: {
          driverId: driver.id,
          driverName: `${driver.firstName} ${driver.lastName}`,
          isAvailable,
        },
      });

      res.json({
        id: updatedDriver.id,
        isAvailable: updatedDriver.isAvailable,
      });
    } catch (error) {
      console.error("Error updating driver status:", error);
      res.status(500).json({ message: "Failed to update driver status" });
    }
  });

  // 7. GET /api/driver/earnings - Get detailed earnings breakdown
  app.get('/api/driver/earnings', isAuthenticated, async (req: any, res) => {
    try {
      // Verify user is a driver
      if (req.user.role !== 'driver') {
        return res.status(403).json({ message: "Only drivers can access this endpoint" });
      }

      // Get driver profile
      const driver = await storage.getDriverByUserId(req.user.id);
      if (!driver) {
        return res.status(404).json({ message: "Driver profile not found" });
      }

      // Get earnings breakdown
      const earnings = await storage.getDriverEarnings(driver.id);

      res.json(earnings);
    } catch (error) {
      console.error("Error fetching driver earnings:", error);
      res.status(500).json({ message: "Failed to fetch driver earnings" });
    }
  });

  // Analytics routes
  app.get('/api/analytics/stats', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.json({});
      }
      
      const orders = await storage.getOrders(restaurant.id);
      const staff = await storage.getStaff(restaurant.id);
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const todayOrders = orders.filter(o => new Date(o.createdAt!) >= today);
      const todayRevenue = todayOrders.reduce((sum, o) => sum + parseFloat(o.total), 0).toFixed(2);
      const pendingOrders = orders.filter(o => o.status === 'pending').length;
      const averageOrder = orders.length > 0 
        ? (orders.reduce((sum, o) => sum + parseFloat(o.total), 0) / orders.length).toFixed(2)
        : "0";
      
      res.json({
        todayRevenue,
        todayOrders: todayOrders.length,
        pendingOrders,
        averageOrder,
        activeStaff: staff.filter(s => s.isActive).length,
        totalStaff: staff.length,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  app.get('/api/analytics/detailed', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.json({});
      }
      
      // Get date filter from query params (default to 'year')
      const dateFilter = req.query.dateFilter || 'year';
      
      // Calculate date range based on filter
      const now = new Date();
      let startDate = new Date();
      let endDate: Date | null = null;
      
      switch (dateFilter) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          startDate.setHours(0, 0, 0, 0); // Start of today
          break;
        case 'yesterday':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
          startDate.setHours(0, 0, 0, 0); // Start of yesterday
          endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
          endDate.setHours(23, 59, 59, 999); // End of yesterday
          break;
        case 'last-7-days':
          startDate.setDate(now.getDate() - 7);
          startDate.setHours(0, 0, 0, 0); // Normalize to midnight
          break;
        case 'this-month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          startDate.setHours(0, 0, 0, 0); // Normalize to midnight
          break;
        case 'last-month':
          startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          startDate.setHours(0, 0, 0, 0); // Normalize to midnight
          endDate = new Date(now.getFullYear(), now.getMonth(), 0);
          endDate.setHours(23, 59, 59, 999);
          break;
        case 'year':
        default:
          startDate.setFullYear(now.getFullYear() - 1);
          startDate.setHours(0, 0, 0, 0); // Normalize to midnight
          break;
      }
      
      const allOrders = await storage.getOrders(restaurant.id);
      
      // Filter orders by date range
      const orders = allOrders.filter(order => {
        if (!order.createdAt) return false;
        const orderDate = new Date(order.createdAt);
        
        if (endDate) {
          // For date ranges with both start and end (like last-month)
          return orderDate >= startDate && orderDate <= endDate;
        }
        
        // For date ranges with only start date (like year, this-month, last-7-days)
        return orderDate >= startDate;
      });
      
      // Calculate revenue metrics and breakdown in a single pass
      let totalRevenue = 0;
      let dineInRevenue = 0;
      let takeoutRevenue = 0;
      let deliveryRevenue = 0;
      let onlineRevenue = 0;
      
      for (const order of orders) {
        const orderTotal = parseFloat(order.total);
        totalRevenue += orderTotal;
        
        switch (order.orderType) {
          case 'dine-in':
            dineInRevenue += orderTotal;
            break;
          case 'takeout':
            takeoutRevenue += orderTotal;
            break;
          case 'delivery':
            deliveryRevenue += orderTotal;
            break;
          case 'online':
            onlineRevenue += orderTotal;
            break;
        }
      }
      
      const averageOrder = orders.length > 0 
        ? (totalRevenue / orders.length).toFixed(2)
        : "0";
      
      // Fetch all order items in one batched query
      const allOrderItems = await storage.getAllOrderItems(restaurant.id);
      
      // Create a Set of filtered order IDs for efficient lookup
      const filteredOrderIds = new Set(orders.map(order => order.id));
      
      // Filter order items to only include those from filtered orders
      const filteredOrderItems = allOrderItems.filter(item => 
        filteredOrderIds.has(item.orderId)
      );
      
      // Calculate popular menu items from filtered order items
      const itemStats = new Map<string, { 
        menuItemId: string;
        name: string; 
        orders: Set<string>;
        quantity: number;
        revenue: number;
      }>();
      
      for (const item of filteredOrderItems) {
        const key = item.menuItemId;
        const existing = itemStats.get(key);
        const itemRevenue = parseFloat(item.subtotal);
        
        if (existing) {
          existing.orders.add(item.orderId);
          existing.quantity += item.quantity;
          existing.revenue += itemRevenue;
        } else {
          itemStats.set(key, {
            menuItemId: key,
            name: item.menuItem.name,
            orders: new Set([item.orderId]),
            quantity: item.quantity,
            revenue: itemRevenue,
          });
        }
      }
      
      // Convert to array and sort by quantity (most popular first)
      const popularItems = Array.from(itemStats.values())
        .sort((a, b) => b.quantity - a.quantity)
        .map(item => ({
          name: item.name,
          orders: item.orders.size,
          revenue: item.revenue.toFixed(2),
        }));
      
      res.json({
        totalRevenue: totalRevenue.toFixed(2),
        totalOrders: orders.length,
        averageOrder,
        popularItemsCount: popularItems.length,
        popularItems,
        dineInRevenue: dineInRevenue.toFixed(2),
        takeoutRevenue: takeoutRevenue.toFixed(2),
        deliveryRevenue: deliveryRevenue.toFixed(2),
        onlineRevenue: onlineRevenue.toFixed(2),
      });
    } catch (error) {
      console.error("Error fetching detailed analytics:", error);
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  // Public storefront routes (no auth required)
  
  // Get restaurant by current hostname (for subdomain/custom domain)
  app.get('/api/storefront/by-hostname', async (req: any, res) => {
    try {
      if (req.storefrontRestaurant) {
        return res.json(req.storefrontRestaurant);
      }
      res.status(404).json({ message: "No restaurant found for this domain" });
    } catch (error) {
      console.error("Error fetching restaurant by hostname:", error);
      res.status(500).json({ message: "Failed to fetch restaurant" });
    }
  });

  app.get('/api/storefront/:slug', async (req, res) => {
    try {
      const restaurant = await storage.getRestaurantBySlug(req.params.slug);
      if (!restaurant || !restaurant.isActive) {
        return res.status(404).json({ message: "Restaurant not found" });
      }
      res.json(restaurant);
    } catch (error) {
      console.error("Error fetching storefront:", error);
      res.status(500).json({ message: "Failed to fetch restaurant" });
    }
  });

  app.get('/api/storefront/:slug/categories', async (req, res) => {
    try {
      const restaurant = await storage.getRestaurantBySlug(req.params.slug);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }
      const categories = await storage.getMenuCategories(restaurant.id);
      res.json(categories.filter(c => c.isActive));
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  app.get('/api/storefront/:slug/items', async (req, res) => {
    try {
      const restaurant = await storage.getRestaurantBySlug(req.params.slug);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }
      const items = await storage.getMenuItems(restaurant.id);
      res.json(items.filter(i => i.isAvailable));
    } catch (error) {
      console.error("Error fetching items:", error);
      res.status(500).json({ message: "Failed to fetch items" });
    }
  });

  app.get('/api/storefront/recent-purchases/:restaurantId', async (req, res) => {
    try {
      const { restaurantId } = req.params;
      
      const orders = await storage.getOrders(restaurantId);
      const recentOrders = orders
        .filter(order => order.status === 'completed' || order.status === 'confirmed')
        .sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime())
        .slice(0, 10);

      const allOrderItems = await storage.getAllOrderItems(restaurantId);

      const notifications = recentOrders.map((order) => {
        const orderItems = allOrderItems.filter(item => item.orderId === order.id);
        const firstItem = orderItems[0];
        
        const getTimeAgo = (date: Date) => {
          const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
          if (seconds < 60) return 'just now';
          const minutes = Math.floor(seconds / 60);
          if (minutes < 60) return `${minutes}m ago`;
          const hours = Math.floor(minutes / 60);
          if (hours < 24) return `${hours}h ago`;
          const days = Math.floor(hours / 24);
          return `${days}d ago`;
        };

        const timeAgo = order.createdAt 
          ? getTimeAgo(new Date(order.createdAt))
          : 'recently';

        return {
          id: order.id,
          customerName: order.customerName || 'Someone',
          itemName: firstItem?.menuItem?.name || 'an item',
          timeAgo,
        };
      });

      res.json(notifications);
    } catch (error) {
      console.error("Error fetching recent purchases:", error);
      res.status(500).json({ message: "Failed to fetch recent purchases" });
    }
  });

  // Get reviews for a restaurant
  app.get('/api/storefront/:slug/reviews', async (req, res) => {
    try {
      const restaurant = await storage.getRestaurantBySlug(req.params.slug);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }
      const reviews = await storage.getCustomerReviews(restaurant.id);
      res.json(reviews);
    } catch (error) {
      console.error("Error fetching reviews:", error);
      res.status(500).json({ message: "Failed to fetch reviews" });
    }
  });

  // Submit a review
  app.post('/api/storefront/:slug/reviews', async (req, res) => {
    try {
      const restaurant = await storage.getRestaurantBySlug(req.params.slug);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }

      const { customerName, rating, comment, orderId } = req.body;

      if (!customerName || !rating || rating < 1 || rating > 5) {
        return res.status(400).json({ message: "Invalid review data" });
      }

      const review = await storage.createCustomerReview({
        restaurantId: restaurant.id,
        customerName,
        rating,
        comment: comment || null,
        orderId: orderId || null,
        isPublished: true,
      });

      res.json(review);
    } catch (error) {
      console.error("Error submitting review:", error);
      res.status(500).json({ message: "Failed to submit review" });
    }
  });

  // Submit a contact message
  app.post('/api/storefront/:slug/contact', async (req, res) => {
    try {
      const restaurant = await storage.getRestaurantBySlug(req.params.slug);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }

      const { customerName, customerEmail, customerPhone, subject, message } = req.body;

      if (!customerName || !message) {
        return res.status(400).json({ message: "Name and message are required" });
      }

      const inboxMessage = await storage.createInboxMessage({
        restaurantId: restaurant.id,
        customerName,
        customerEmail: customerEmail || null,
        customerPhone: customerPhone || null,
        subject: subject || null,
        message,
        status: 'new',
      });

      res.json(inboxMessage);
    } catch (error) {
      console.error("Error submitting contact message:", error);
      res.status(500).json({ message: "Failed to submit message" });
    }
  });

  // Get active auto-apply promos for a restaurant
  app.get('/api/storefront/:slug/promos', async (req, res) => {
    try {
      const restaurant = await storage.getRestaurantBySlug(req.params.slug);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }
      const promos = await storage.getActiveAutoApplyPromos(restaurant.id);
      res.json(promos);
    } catch (error) {
      console.error("Error fetching promos:", error);
      res.status(500).json({ message: "Failed to fetch promos" });
    }
  });

  // Validate a promo code
  app.post('/api/storefront/:slug/validate-promo', async (req, res) => {
    try {
      const restaurant = await storage.getRestaurantBySlug(req.params.slug);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }

      const { promoCode, orderTotal } = req.body;

      if (!promoCode) {
        return res.status(400).json({ message: "Promo code is required" });
      }

      const promo = await storage.validatePromoCode(restaurant.id, promoCode);

      if (!promo) {
        return res.status(404).json({ message: "Invalid or expired promo code" });
      }

      // Check minimum order amount if specified
      const conditions = promo.conditions as any;
      if (conditions?.minOrderAmount && orderTotal < parseFloat(conditions.minOrderAmount)) {
        return res.status(400).json({ 
          message: `Minimum order amount of ${restaurant.currency} ${conditions.minOrderAmount} required` 
        });
      }

      res.json(promo);
    } catch (error) {
      console.error("Error validating promo:", error);
      res.status(500).json({ message: "Failed to validate promo code" });
    }
  });

  // Get active bundles for storefront
  app.get('/api/storefront/:slug/bundles', async (req, res) => {
    try {
      const restaurant = await storage.getRestaurantBySlug(req.params.slug);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }
      const bundles = await storage.getActiveBundles(restaurant.id);
      res.json(bundles);
    } catch (error) {
      console.error("Error fetching bundles:", error);
      res.status(500).json({ message: "Failed to fetch bundles" });
    }
  });

  app.get('/api/storefront/:slug/upsell-rules', async (req, res) => {
    try {
      const restaurant = await storage.getRestaurantBySlug(req.params.slug);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }
      const upsellRules = await storage.getActiveUpsellRules(restaurant.id);
      res.json(upsellRules);
    } catch (error) {
      console.error("Error fetching upsell rules:", error);
      res.status(500).json({ message: "Failed to fetch upsell rules" });
    }
  });

  // Get active boosts for storefront
  app.get('/api/storefront/:slug/boosts', async (req, res) => {
    try {
      const restaurant = await storage.getRestaurantBySlug(req.params.slug);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }
      
      // Get active boosts that are currently running
      const boosts = await db
        .select()
        .from(boostSlots)
        .where(
          and(
            eq(boostSlots.restaurantId, restaurant.id),
            eq(boostSlots.status, 'active')
          )
        );
      
      // Filter by current time using timestamps
      const now = new Date();
      
      const activeBoosts = boosts.filter((boost: any) => {
        const startedAt = new Date(boost.startedAt);
        const endsAt = new Date(boost.endsAt);
        return startedAt <= now && endsAt >= now;
      });
      
      res.json(activeBoosts);
    } catch (error) {
      console.error("Error fetching boosts:", error);
      res.status(500).json({ message: "Failed to fetch boosts" });
    }
  });

  // Get active promo codes for storefront
  app.get('/api/storefront/:slug/promos', async (req, res) => {
    try {
      const restaurant = await storage.getRestaurantBySlug(req.params.slug);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }
      
      const now = new Date();
      
      // Get active promo codes with all necessary fields including BOGO
      const promos = await db
        .select({
          id: promoRules.id,
          code: promoRules.promoCode,
          type: promoRules.promoType,
          value: promoRules.discountValue,
          description: promoRules.description,
          startsAt: promoRules.startsAt,
          expiresAt: promoRules.endsAt,
          redemptionLimit: promoRules.redemptionLimit,
          buyItemId: promoRules.buyItemId,
          getItemId: promoRules.getItemId,
          buyQuantity: promoRules.buyQuantity,
          getQuantity: promoRules.getQuantity,
        })
        .from(promoRules)
        .where(
          and(
            eq(promoRules.restaurantId, restaurant.id),
            eq(promoRules.isActive, true),
            // Only include promos with codes (exclude auto-apply promos)
            isNotNull(promoRules.promoCode)
          )
        );
      
      // Filter by date validity, time window, and usage limits
      const activePromos = promos
        .filter((promo: any) => {
          // Check if promo has started
          if (promo.startsAt && new Date(promo.startsAt) > now) {
            return false;
          }
          
          // Check if promo has expired
          if (promo.expiresAt && new Date(promo.expiresAt) < now) {
            return false;
          }
          
          // Check if promo has reached redemption limit
          if (promo.redemptionLimit && promo.redemptionCount >= promo.redemptionLimit) {
            return false;
          }
          
          return true;
        })
        .map((promo: any) => ({
          id: promo.id,
          code: promo.code,
          type: promo.type,
          value: promo.value ? parseFloat(promo.value) : 0,
          description: promo.description,
          expiresAt: promo.expiresAt,
          isActive: true,
          buyItemId: promo.buyItemId,
          getItemId: promo.getItemId,
          buyQuantity: promo.buyQuantity,
          getQuantity: promo.getQuantity,
        }));
      
      res.json(activePromos);
    } catch (error) {
      console.error("Error fetching promo codes:", error);
      res.status(500).json({ message: "Failed to fetch promo codes" });
    }
  });

  app.post('/api/storefront/:slug/checkout', async (req, res) => {
    try {
      const restaurant = await storage.getRestaurantBySlug(req.params.slug);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }
      
      const data = onlineOrderSchema.parse(req.body);
      const orderNumber = await generateOrderNumber(restaurant.id, 'WEB');
      
      const order = await storage.createOrder({
        restaurantId: restaurant.id,
        orderNumber,
        orderType: data.orderType,
        customerName: data.customerName || null,
        customerPhone: data.customerPhone || null,
        customerEmail: data.customerEmail || null,
        shippingAddress: data.shippingAddress || null,
        deliveryCountry: data.deliveryCountry || null,
        deliveryCity: data.deliveryCity || null,
        deliveryAddress: data.deliveryAddress || null,
        deliveryFee: data.deliveryFee || '0',
        paymentMethod: data.paymentMethod || null,
        subtotal: data.subtotal,
        promoCode: data.promoCode || null,
        promoDiscount: data.promoDiscount || '0',
        tax: data.tax,
        total: data.total,
        status: 'pending',
        paymentStatus: 'pending',
      }, data.items.map(item => ({
        menuItemId: item.menuItemId || null,
        bundleId: item.bundleId || null,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: (parseFloat(item.unitPrice) * item.quantity).toFixed(2),
        selectedOptions: item.selectedOptions || null,
      })));
      
      // Increment bundle sales count for any bundles in the order
      for (const item of data.items) {
        if (item.bundleId) {
          await storage.incrementBundleSales(item.bundleId, item.quantity);
        }
      }
      
      if (data.paymentMethod === 'cash') {
        // Cash on delivery - mark order as confirmed, payment will be collected on delivery
        res.json({ orderId: order.id, paymentMethod: 'cash', success: true });
      } else if (data.paymentMethod === 'paypal') {
        res.json({ orderId: order.id, paymentMethod: 'paypal' });
      } else if (data.paymentMethod === 'apple' || data.paymentMethod === 'google' || data.paymentMethod === 'stripe') {
        // Apple Pay, Google Pay, or Stripe payment - all use Stripe
        // TODO: Create Stripe checkout session
        res.json({ orderId: order.id, checkoutUrl: null });
      } else {
        // Default to stripe for unknown payment methods
        res.json({ orderId: order.id, checkoutUrl: null });
      }
    } catch (error) {
      console.error("Error creating online order:", error);
      res.status(400).json({ message: "Failed to create order" });
    }
  });

  // Object Storage routes
  // Note: This route does NOT require authentication - public objects can be accessed by anyone
  app.get("/objects/:objectPath(*)", async (req: any, res) => {
    // Get userId if authenticated, undefined otherwise
    const userId = req.user?.claims?.sub;
    const objectStorageService = new ObjectStorageService();
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      const canAccess = await objectStorageService.canAccessObjectEntity({
        objectFile,
        userId: userId,
      });
      if (!canAccess) {
        return res.sendStatus(401);
      }
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error checking object access:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  app.post("/api/objects/upload", isAuthenticated, async (req, res) => {
    const objectStorageService = new ObjectStorageService();
    const { uploadURL, objectPath } = await objectStorageService.getObjectEntityUploadURL();
    res.json({ uploadURL, objectPath });
  });

  app.put("/api/restaurant/logo", isAuthenticated, async (req: any, res) => {
    const userId = req.user.id;
    if (!req.body.logoUrl) {
      return res.status(400).json({ error: "logoUrl is required" });
    }

    try {
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }

      const objectStorageService = new ObjectStorageService();
      const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
        req.body.logoUrl,
        { owner: userId, visibility: "public" }
      );

      await storage.updateRestaurant(restaurant.id, { logoUrl: objectPath });
      res.status(200).json({ objectPath });
    } catch (error) {
      console.error("Error setting logo:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/restaurant/cover-image", isAuthenticated, async (req: any, res) => {
    const userId = req.user.id;
    if (!req.body.coverImageUrl) {
      return res.status(400).json({ error: "coverImageUrl is required" });
    }

    try {
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }

      const objectStorageService = new ObjectStorageService();
      const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
        req.body.coverImageUrl,
        { owner: userId, visibility: "public" }
      );

      await storage.updateRestaurant(restaurant.id, { coverImageUrl: objectPath });
      res.status(200).json({ objectPath });
    } catch (error) {
      console.error("Error setting cover image:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/restaurant/opening-hours", isAuthenticated, async (req: any, res) => {
    const userId = req.user.id;
    if (!req.body.openingHours) {
      return res.status(400).json({ error: "openingHours is required" });
    }

    try {
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }

      await storage.updateRestaurant(restaurant.id, { openingHours: req.body.openingHours });
      res.status(200).json({ success: true });
    } catch (error) {
      console.error("Error updating opening hours:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/restaurant/payment-settings", isAuthenticated, async (req: any, res) => {
    const userId = req.user.id;
    const { stripePublicKey, stripeSecretKey, paypalClientId, paypalClientSecret } = req.body;

    try {
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }

      await storage.updateRestaurant(restaurant.id, {
        stripePublicKey,
        stripeSecretKey,
        paypalClientId,
        paypalClientSecret
      });
      res.status(200).json({ success: true });
    } catch (error) {
      console.error("Error updating payment settings:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/restaurant/payment-methods", isAuthenticated, async (req: any, res) => {
    const userId = req.user.id;
    if (!req.body.paymentMethods) {
      return res.status(400).json({ error: "paymentMethods is required" });
    }

    try {
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }

      await storage.updateRestaurant(restaurant.id, { paymentMethods: req.body.paymentMethods });
      res.status(200).json({ success: true });
    } catch (error) {
      console.error("Error updating payment methods:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/restaurant/order-types", isAuthenticated, async (req: any, res) => {
    const userId = req.user.id;
    if (!req.body.orderTypes) {
      return res.status(400).json({ error: "orderTypes is required" });
    }

    const { pickup, delivery } = req.body.orderTypes;

    // Validate that at least one order type is enabled
    if (!pickup && !delivery) {
      return res.status(400).json({ error: "At least one order type must be enabled" });
    }

    try {
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }

      await storage.updateRestaurant(restaurant.id, { orderTypes: req.body.orderTypes });
      res.status(200).json({ success: true });
    } catch (error) {
      console.error("Error updating order types:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/restaurant/regional-settings", isAuthenticated, async (req: any, res) => {
    const userId = req.user.id;
    const { currency, country, platformLanguage, storefrontLanguage } = req.body;

    if (!currency || !country) {
      return res.status(400).json({ error: "currency and country are required" });
    }

    try {
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }

      await storage.updateRestaurant(restaurant.id, { 
        currency, 
        country,
        ...(platformLanguage && { platformLanguage }),
        ...(storefrontLanguage && { storefrontLanguage })
      });
      res.status(200).json({ success: true });
    } catch (error) {
      console.error("Error updating regional settings:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/restaurant/tax-settings", isAuthenticated, async (req: any, res) => {
    const userId = req.user.id;
    const { taxRate, taxIncludedInPrice, taxLabel } = req.body;

    try {
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }

      await storage.updateRestaurant(restaurant.id, { 
        taxRate: taxRate || "0.00",
        taxIncludedInPrice: taxIncludedInPrice || false,
        taxLabel: taxLabel || "Tax"
      });
      res.status(200).json({ success: true });
    } catch (error) {
      console.error("Error updating tax settings:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Stripe Connect: Create Express Connected Account
  app.post("/api/restaurant/connect/create-account", isAuthenticated, async (req: any, res) => {
    const userId = req.user.id;

    try {
      if (!stripe) {
        return res.status(503).json({ error: "Stripe is not configured" });
      }

      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }

      // Check if already has a connected account
      if (restaurant.stripeAccountId) {
        return res.status(400).json({ error: "Stripe account already connected" });
      }

      // Create Stripe Express account
      const account = await stripe.accounts.create({
        type: 'express',
        country: restaurant.country === 'United States' ? 'US' : 'US', // Default to US, expand later
        email: restaurant.email || req.user.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: 'individual', // Can be made dynamic
        business_profile: {
          name: restaurant.name,
          url: restaurant.customDomain || `https://${restaurant.subdomain}.${process.env.REPLIT_DOMAINS}`,
        },
      });

      // Save account ID to restaurant
      await storage.updateRestaurant(restaurant.id, {
        stripeAccountId: account.id,
      });

      res.json({
        accountId: account.id,
        success: true,
      });
    } catch (error: any) {
      console.error("Error creating Stripe Connect account:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  // Stripe Connect: Generate onboarding link
  app.post("/api/restaurant/connect/onboarding-link", isAuthenticated, async (req: any, res) => {
    const userId = req.user.id;

    try {
      if (!stripe) {
        return res.status(503).json({ error: "Stripe is not configured" });
      }

      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }

      if (!restaurant.stripeAccountId) {
        return res.status(400).json({ error: "No Stripe account found. Create one first." });
      }

      const baseUrl = process.env.NODE_ENV === 'production' 
        ? `https://${process.env.REPLIT_DOMAINS}` 
        : `http://localhost:5000`;

      const accountLink = await stripe.accountLinks.create({
        account: restaurant.stripeAccountId,
        refresh_url: `${baseUrl}/settings?connect=refresh`,
        return_url: `${baseUrl}/settings?connect=success`,
        type: 'account_onboarding',
      });

      res.json({
        url: accountLink.url,
      });
    } catch (error: any) {
      console.error("Error creating onboarding link:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  // Stripe Connect: Check account status
  app.get("/api/restaurant/connect/status", isAuthenticated, async (req: any, res) => {
    const userId = req.user.id;

    try {
      if (!stripe) {
        return res.status(503).json({ error: "Stripe is not configured" });
      }

      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }

      if (!restaurant.stripeAccountId) {
        return res.json({
          connected: false,
          chargesEnabled: false,
          payoutsEnabled: false,
        });
      }

      const account = await stripe.accounts.retrieve(restaurant.stripeAccountId);

      res.json({
        connected: true,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        requirementsCurrentlyDue: account.requirements?.currently_due || [],
        requirementsEventuallyDue: account.requirements?.eventually_due || [],
      });
    } catch (error: any) {
      console.error("Error checking account status:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.get("/api/restaurant/payout-settings", isAuthenticated, async (req: any, res) => {
    const userId = req.user.id;

    try {
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }

      const payoutAccount = await storage.getPayoutAccount(restaurant.id);
      res.json({ payoutSchedule: payoutAccount?.payoutSchedule || "weekly" });
    } catch (error) {
      console.error("Error fetching payout settings:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/restaurant/payout-settings", isAuthenticated, async (req: any, res) => {
    const userId = req.user.id;
    const { payoutSchedule } = req.body;

    try {
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }

      // Update only the payout schedule (bank details are in Stripe Connect)
      const existingAccount = await storage.getPayoutAccount(restaurant.id);
      
      if (existingAccount) {
        await storage.createOrUpdatePayoutAccount(restaurant.id, {
          ...existingAccount,
          payoutSchedule: payoutSchedule || "weekly"
        });
      } else {
        // Create minimal payout account with just schedule
        await storage.createOrUpdatePayoutAccount(restaurant.id, {
          accountHolderName: "",
          bankName: "",
          accountNumber: "",
          routingNumber: "",
          iban: "",
          swiftCode: "",
          country: "",
          payoutSchedule: payoutSchedule || "weekly"
        });
      }
      
      res.status(200).json({ success: true });
    } catch (error) {
      console.error("Error saving payout settings:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get pending earnings for restaurant
  app.get("/api/restaurant/payouts/pending", isAuthenticated, async (req: any, res) => {
    const userId = req.user.id;

    try {
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }

      const pendingEarnings = await storage.getPendingEarnings(restaurant.id);
      const payoutAccount = await storage.getPayoutAccount(restaurant.id);

      res.json({
        pendingAmount: pendingEarnings.total,
        orderCount: pendingEarnings.count,
        hasPayoutAccount: !!payoutAccount,
        payoutSchedule: payoutAccount?.payoutSchedule || 'weekly',
      });
    } catch (error) {
      console.error("Error fetching pending earnings:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get payout history for restaurant
  app.get("/api/restaurant/payouts/history", isAuthenticated, async (req: any, res) => {
    const userId = req.user.id;

    try {
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }

      const payoutHistory = await storage.getPayoutRuns(restaurant.id);
      res.json(payoutHistory);
    } catch (error) {
      console.error("Error fetching payout history:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Process payout for restaurant (manual trigger or automated)
  app.post("/api/restaurant/payouts/process", isAuthenticated, async (req: any, res) => {
    const userId = req.user.id;

    try {
      if (!stripe) {
        return res.status(503).json({ error: "Stripe payout processing is not configured" });
      }

      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }

      // Check if restaurant has Stripe Connect account set up
      if (!restaurant.stripeAccountId) {
        return res.status(400).json({ error: "Please connect your bank account via Stripe first" });
      }

      // Verify Connect account is fully onboarded
      const connectedAccount = await stripe.accounts.retrieve(restaurant.stripeAccountId);
      if (!connectedAccount.payouts_enabled) {
        return res.status(400).json({ error: "Your Stripe account is not fully set up. Please complete onboarding." });
      }

      // Get pending earnings
      const pendingEarnings = await storage.getPendingEarnings(restaurant.id);
      const amountInDollars = parseFloat(pendingEarnings.total);

      if (amountInDollars <= 0) {
        return res.status(400).json({ error: "No pending earnings to process" });
      }

      // Minimum payout amount (e.g., $10)
      if (amountInDollars < 10) {
        return res.status(400).json({ error: "Minimum payout amount is $10" });
      }

      // Get pending ledger entries to mark as paid
      const ledgerEntries = await storage.getEarningsLedger(restaurant.id);
      const pendingEntries = ledgerEntries.filter((entry: any) => entry.restaurantPayoutStatus === 'pending');
      const ledgerEntryIds = pendingEntries.map((entry: any) => entry.id);

      if (ledgerEntryIds.length === 0) {
        return res.status(400).json({ error: "No pending ledger entries found" });
      }

      // Create payout run record
      const payoutRun = await storage.createPayoutRun(
        restaurant.id,
        amountInDollars,
        'stripe',
        new Date()
      );

      try {
        // Create Stripe Transfer to connected account (proper Connect flow)
        const amountInCents = Math.round(amountInDollars * 100);
        
        const transfer = await stripe.transfers.create({
          amount: amountInCents,
          currency: 'usd',
          destination: restaurant.stripeAccountId,
          description: `Payout for ${restaurant.name}`,
          metadata: {
            restaurantId: restaurant.id,
            payoutRunId: payoutRun.id,
            restaurantName: restaurant.name,
          },
        });

        // Complete payout transaction (atomic operation)
        await storage.completePayoutTransaction(payoutRun.id, ledgerEntryIds, transfer.id);

        res.json({
          success: true,
          transferId: transfer.id,
          amount: amountInDollars,
          message: 'Transfer successful. Funds will be paid out to your bank account based on your payout schedule.',
        });

      } catch (stripeError: any) {
        console.error('Stripe transfer error:', stripeError);
        
        // Update payout run as failed
        await storage.updatePayoutRunStatus(
          payoutRun.id,
          'failed',
          undefined,
          stripeError.message
        );

        res.status(500).json({
          error: 'Failed to process transfer',
          message: stripeError.message,
        });
      }

    } catch (error) {
      console.error("Error processing payout:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Process scheduled payouts (automated cron job endpoint)
  app.post("/api/admin/payouts/process-scheduled", isAuthenticated, async (req: any, res) => {
    const userId = req.user.id;

    try {
      // Verify admin access
      const user = await storage.getUser(userId);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: "Admin access required" });
      }

      if (!stripe) {
        return res.status(503).json({ error: "Stripe payout processing is not configured" });
      }

      // Call the shared service function
      const results = await processScheduledPayouts(storage, stripe);

      res.json({
        success: true,
        summary: {
          processed: results.processed,
          failed: results.failed,
          skipped: results.skipped,
          totalAmount: results.totalAmount,
        },
        details: results.details,
      });

    } catch (error) {
      console.error("Error processing scheduled payouts:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/menu-item/:id/image", isAuthenticated, async (req: any, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    if (!req.body.imageUrl) {
      return res.status(400).json({ error: "imageUrl is required" });
    }

    try {
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }

      const objectStorageService = new ObjectStorageService();
      const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
        req.body.imageUrl,
        { owner: userId, visibility: "public" }
      );

      await storage.updateMenuItem(id, { imageUrl: objectPath });
      res.status(200).json({ objectPath });
    } catch (error) {
      console.error("Error setting menu item image:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });


  // Stripe checkout endpoint - platform-managed payments
  app.post('/api/checkout/stripe', async (req, res) => {
    try {
      if (!stripe) {
        return res.status(503).json({ error: "Stripe payment processing is not configured" });
      }

      const { restaurantId, amount, currency, orderId } = req.body;

      if (!restaurantId || !amount || !currency) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const restaurant = await storage.getRestaurant(restaurantId);
      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }

      const amountInCents = Math.round(parseFloat(amount) * 100);

      // Create payment intent directly to platform account (platform-managed payments)
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: currency.toLowerCase(),
        metadata: {
          restaurantId,
          orderId: orderId || '',
        },
      });

      res.json({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      });
    } catch (error) {
      console.error("Error creating Stripe payment:", error);
      res.status(500).json({ error: "Failed to create payment" });
    }
  });


  // PayPal create order
  app.post('/api/paypal/create-order', async (req, res) => {
    try {
      if (!paypalOrdersController) {
        return res.status(503).json({ message: "PayPal payment processing is not configured" });
      }

      const { orderId, total } = req.body;
      
      const orderRequest = {
        body: {
          intent: CheckoutPaymentIntent.Capture,
          purchaseUnits: [
            {
              referenceId: orderId,
              amount: {
                currencyCode: 'USD',
                value: parseFloat(total).toFixed(2)
              },
              description: 'Restaurant order payment'
            }
          ],
          applicationContext: {
            brandName: 'EatOut',
            landingPage: OrderApplicationContextLandingPage.NoPreference,
            userAction: OrderApplicationContextUserAction.PayNow
          }
        }
      };

      const paypalOrder = await paypalOrdersController.createOrder(orderRequest);
      res.json({ paypalOrderId: paypalOrder.result.id });
    } catch (error) {
      console.error('PayPal create order error:', error);
      res.status(500).json({ message: 'Failed to create PayPal order' });
    }
  });

  // PayPal capture payment - platform-managed payments
  app.post('/api/paypal/capture-order/:paypalOrderId', async (req, res) => {
    try {
      if (!paypalOrdersController) {
        return res.status(503).json({ message: "PayPal payment processing is not configured" });
      }

      const { paypalOrderId } = req.params;
      const { orderId, totalAmount, deliveryFee } = req.body;

      const captureRequest = {
        id: paypalOrderId,
        prefer: 'return=representation'
      };

      const capture = await paypalOrdersController.captureOrder(captureRequest);
      
      if (capture.result.status === 'COMPLETED') {
        const captureId = capture.result.purchaseUnits?.[0]?.payments?.captures?.[0]?.id || paypalOrderId;
        
        // Confirm order with payment tracking and ledger entry creation
        await storage.confirmOrderWithPayment(
          orderId,
          'paypal',
          captureId,
          parseFloat(totalAmount) || 0,
          parseFloat(deliveryFee) || 0
        );
        
        res.json({ 
          success: true,
          orderId,
          captureId
        });
      } else {
        res.status(400).json({ message: 'Payment not completed' });
      }
    } catch (error) {
      console.error('PayPal capture error:', error);
      res.status(500).json({ message: 'Failed to capture PayPal payment' });
    }
  });

  // Admin Routes - Platform Management
  app.get('/api/admin/restaurants', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const restaurants = await storage.getAllRestaurants();
      res.json(restaurants);
    } catch (error) {
      console.error("Error fetching all restaurants:", error);
      res.status(500).json({ message: "Failed to fetch restaurants" });
    }
  });

  app.patch('/api/admin/restaurants/:id', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { name, subdomain, isActive } = req.body;
      
      const updates: any = {};
      if (name !== undefined) {
        if (typeof name !== 'string' || name.trim().length === 0) {
          return res.status(400).json({ message: "Name must be a non-empty string" });
        }
        updates.name = name.trim();
      }
      if (subdomain !== undefined) {
        if (typeof subdomain !== 'string' || subdomain.trim().length === 0) {
          return res.status(400).json({ message: "Subdomain must be a non-empty string" });
        }
        // Check subdomain uniqueness
        const existing = await storage.getRestaurantBySubdomain(subdomain.trim());
        if (existing && existing.id !== id) {
          return res.status(400).json({ message: "Subdomain already in use" });
        }
        updates.subdomain = subdomain.trim();
      }
      if (isActive !== undefined) {
        if (typeof isActive !== 'boolean') {
          return res.status(400).json({ message: "isActive must be a boolean" });
        }
        updates.isActive = isActive;
      }

      const restaurant = await storage.updateRestaurant(id, updates);
      res.json(restaurant);
    } catch (error) {
      console.error("Error updating restaurant:", error);
      res.status(500).json({ message: "Failed to update restaurant" });
    }
  });

  app.delete('/api/admin/restaurants/:id', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.deleteRestaurant(id);
      res.json({ message: "Restaurant deleted successfully" });
    } catch (error) {
      console.error("Error deleting restaurant:", error);
      res.status(500).json({ message: "Failed to delete restaurant" });
    }
  });

  app.get('/api/admin/users', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.post('/api/admin/users/:userId/role', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const { role } = req.body;

      if (!role || !['owner', 'admin'].includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }

      const updated = await storage.updateUserRole(userId, role);
      res.json(updated);
    } catch (error) {
      console.error("Error updating user role:", error);
      res.status(500).json({ message: "Failed to update user role" });
    }
  });

  app.get('/api/admin/analytics', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const users = await storage.getAllUsers();
      const restaurants = await storage.getAllRestaurants();
      
      // Calculate platform metrics
      const totalRestaurants = restaurants.length;
      const activeSubscriptions = users.filter(u => u.subscriptionStatus === 'active').length;
      const activeTrials = users.filter(u => u.subscriptionStatus === 'trial').length;
      const mrr = activeSubscriptions * 79; // $79/month per restaurant
      
      // Calculate commission revenue (this would need actual order data)
      // For now, return 0 - will be calculated from actual transactions
      const commissionRevenue = 0;
      
      res.json({
        totalRestaurants,
        activeSubscriptions,
        activeTrials,
        mrr,
        commissionRevenue,
        recentSignups: restaurants.slice(-10).reverse(), // Last 10 signups
      });
    } catch (error) {
      console.error("Error fetching admin analytics:", error);
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  // Admin: Get financial dashboard data
  app.get('/api/admin/financials', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const summary = await storage.getFinancialSummary();
      const restaurantBreakdown = await storage.getRestaurantFinancialBreakdown();
      const recentPayouts = await storage.getRecentPayoutRuns(20);

      res.json({
        totalRevenue: summary.totalRevenue,
        totalCommissions: summary.totalCommissions,
        totalPayouts: summary.totalPayouts,
        pendingPayouts: summary.pendingPayouts,
        restaurantBreakdown,
        recentPayouts,
      });
    } catch (error) {
      console.error("Error fetching financial data:", error);
      res.status(500).json({ message: "Failed to fetch financial data" });
    }
  });

  // Admin: Get all payout runs with optional status filter
  app.get('/api/admin/payouts', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const status = req.query.status as string | undefined;
      const payouts = await storage.getAllPayoutRunsForAdmin(status);
      res.json(payouts);
    } catch (error) {
      console.error("Error fetching payout runs:", error);
      res.status(500).json({ message: "Failed to fetch payout runs" });
    }
  });

  // Admin: Retry failed payout
  app.post('/api/admin/payouts/:id/retry', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const payout = await storage.retryFailedPayout(id);
      res.json(payout);
    } catch (error) {
      console.error("Error retrying payout:", error);
      res.status(500).json({ message: "Failed to retry payout" });
    }
  });

  // Admin: Cancel payout run
  app.post('/api/admin/payouts/:id/cancel', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const payout = await storage.cancelPayoutRun(id);
      res.json(payout);
    } catch (error) {
      console.error("Error cancelling payout:", error);
      res.status(500).json({ message: "Failed to cancel payout" });
    }
  });

  // Admin: Manually mark payout as paid
  app.post('/api/admin/payouts/:id/mark-paid', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { transactionId } = req.body;
      
      if (!transactionId) {
        return res.status(400).json({ message: "Transaction ID is required" });
      }

      const payout = await storage.manuallyMarkPayoutAsPaid(id, transactionId);
      res.json(payout);
    } catch (error) {
      console.error("Error marking payout as paid:", error);
      res.status(500).json({ message: "Failed to mark payout as paid" });
    }
  });

  // Admin: Get all reviews with optional status filter
  app.get('/api/admin/reviews', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const status = req.query.status as string | undefined;
      const reviews = await storage.getAllReviewsForAdmin(status);
      res.json(reviews);
    } catch (error) {
      console.error("Error fetching reviews:", error);
      res.status(500).json({ message: "Failed to fetch reviews" });
    }
  });

  // Admin: Publish/hide review
  app.post('/api/admin/reviews/:id/status', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { isPublished } = req.body;
      
      if (typeof isPublished !== 'boolean') {
        return res.status(400).json({ message: "isPublished must be a boolean" });
      }

      const review = await storage.updateReviewStatus(id, isPublished);
      res.json(review);
    } catch (error) {
      console.error("Error updating review status:", error);
      res.status(500).json({ message: "Failed to update review status" });
    }
  });

  // Admin: Delete review
  app.delete('/api/admin/reviews/:id', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.deleteReview(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting review:", error);
      res.status(500).json({ message: "Failed to delete review" });
    }
  });

  // Admin: Respond to review
  app.post('/api/admin/reviews/:id/respond', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { response } = req.body;
      
      if (!response || typeof response !== 'string') {
        return res.status(400).json({ message: "Response is required" });
      }

      const review = await storage.respondToReview(id, response);
      res.json(review);
    } catch (error) {
      console.error("Error responding to review:", error);
      res.status(500).json({ message: "Failed to respond to review" });
    }
  });

  // Admin: Get all activity logs
  app.get('/api/admin/activity-logs', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const filters = {
        actionCategory: req.query.actionCategory as string | undefined,
        userId: req.query.userId as string | undefined,
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
      };
      const logs = await storage.getAllActivityLogs(filters);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching activity logs:", error);
      res.status(500).json({ message: "Failed to fetch activity logs" });
    }
  });

  // Admin: Get all drivers
  app.get('/api/admin/drivers', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      // Filter for driver role only
      const drivers = allUsers.filter(u => u.role === 'driver');
      
      // Remove password from response
      const driversWithoutPassword = drivers.map(({ password, ...driver }) => driver);
      
      res.json(driversWithoutPassword);
    } catch (error) {
      console.error("Error fetching drivers:", error);
      res.status(500).json({ message: "Failed to fetch drivers" });
    }
  });

  // Admin: Approve driver
  app.post('/api/admin/drivers/:id/approve', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      
      // Update driver approval status
      const updated = await storage.updateUser(id, {
        adminApproved: true,
        adminApprovedAt: new Date(),
        approvedBy: req.user.id,
        applicationStatus: 'approved',
        rejectionReason: null, // Clear any previous rejection reason
      });
      
      // Log the action
      await logAdminActivity({
        userId: req.user.id,
        userEmail: req.user.email,
        actionType: 'driver_approved',
        actionCategory: 'driver',
        description: `Approved driver application for ${updated.email}`,
        targetId: id,
        targetType: 'user',
        targetName: `${updated.firstName || ''} ${updated.lastName || ''}`.trim() || updated.email,
        metadata: { driverId: id, driverEmail: updated.email },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
      
      res.json(updated);
    } catch (error) {
      console.error("Error approving driver:", error);
      res.status(500).json({ message: "Failed to approve driver" });
    }
  });

  // Admin: Reject driver
  app.post('/api/admin/drivers/:id/reject', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      
      // Update driver approval status to rejected with reason
      const updated = await storage.updateUser(id, {
        adminApproved: false,
        adminApprovedAt: new Date(),
        approvedBy: req.user.id,
        applicationStatus: 'rejected',
        rejectionReason: reason || 'No reason provided',
      });
      
      // TODO: Send rejection email to driver with reason
      
      res.json(updated);
    } catch (error) {
      console.error("Error rejecting driver:", error);
      res.status(500).json({ message: "Failed to reject driver" });
    }
  });

  // Admin: Get driver activity (comprehensive monitoring)
  app.get('/api/admin/drivers/activity', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      // Get comprehensive driver stats
      const stats = await storage.getDriverActivityStats();
      
      // Get active deliveries
      const activeDeliveries = await storage.getActiveDeliveries();
      
      res.json({
        totalDrivers: stats.totalDrivers,
        onlineDrivers: stats.onlineDrivers,
        approvedDrivers: stats.approvedDrivers,
        pendingDrivers: stats.pendingDrivers,
        activeDeliveries,
        todaysDeliveries: stats.todaysDeliveries,
        todaysEarnings: stats.todaysEarnings,
      });
    } catch (error) {
      console.error("Error fetching driver activity:", error);
      res.status(500).json({ message: "Failed to fetch driver activity" });
    }
  });

  // Admin: Get all subscriptions
  app.get('/api/admin/subscriptions', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const restaurants = await storage.getAllRestaurants();
      const users = await storage.getAllUsers();
      
      // Combine restaurant and user subscription data
      const subscriptions = restaurants.map(restaurant => {
        const owner = users.find(u => u.id === restaurant.ownerId);
        return {
          id: restaurant.id,
          name: restaurant.name,
          subdomain: restaurant.subdomain,
          ownerEmail: owner?.email || 'Unknown',
          subscriptionStatus: owner?.subscriptionStatus || 'inactive',
          trialEndsAt: owner?.trialEndsAt || null,
          subscriptionEndsAt: owner?.subscriptionEndsAt || null,
          manuallyGrantedAccess: restaurant.manuallyGrantedAccess || false,
          accessGrantedBy: restaurant.accessGrantedBy || null,
          accessGrantedAt: restaurant.accessGrantedAt || null,
          accessNotes: restaurant.accessNotes || null,
          createdAt: restaurant.createdAt,
        };
      });
      
      res.json(subscriptions);
    } catch (error) {
      console.error("Error fetching subscriptions:", error);
      res.status(500).json({ message: "Failed to fetch subscriptions" });
    }
  });

  // Admin: Grant manual access to restaurant
  app.post('/api/admin/restaurants/:id/grant-access', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { notes } = req.body;
      
      const updated = await storage.updateRestaurant(id, {
        manuallyGrantedAccess: true,
        accessGrantedBy: req.user.id,
        accessGrantedAt: new Date(),
        accessNotes: notes || null,
      });
      
      res.json(updated);
    } catch (error) {
      console.error("Error granting manual access:", error);
      res.status(500).json({ message: "Failed to grant manual access" });
    }
  });

  // Admin: Revoke manual access from restaurant
  app.post('/api/admin/restaurants/:id/revoke-access', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      
      const updated = await storage.updateRestaurant(id, {
        manuallyGrantedAccess: false,
        accessGrantedBy: null,
        accessGrantedAt: null,
        accessNotes: null,
      });
      
      res.json(updated);
    } catch (error) {
      console.error("Error revoking manual access:", error);
      res.status(500).json({ message: "Failed to revoke manual access" });
    }
  });

  // Admin: Cancel restaurant subscription
  app.post('/api/admin/restaurants/:id/cancel-subscription', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      
      const updated = await storage.updateRestaurant(id, {
        subscriptionStatus: 'cancelled',
        subscriptionEndsAt: new Date(), // End immediately
      });
      
      // Log the action
      await logAdminActivity({
        userId: req.user.id,
        userEmail: req.user.email,
        actionType: 'subscription_cancelled',
        actionCategory: 'subscription',
        description: `Cancelled subscription for restaurant "${updated.name}"`,
        targetId: id,
        targetType: 'restaurant',
        targetName: updated.name,
        metadata: { restaurantId: id, restaurantName: updated.name },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
      
      res.json(updated);
    } catch (error) {
      console.error("Error cancelling subscription:", error);
      res.status(500).json({ message: "Failed to cancel subscription" });
    }
  });

  // Admin: Extend restaurant trial
  app.post('/api/admin/restaurants/:id/extend-trial', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { days } = req.body;
      
      if (!days || days < 1) {
        return res.status(400).json({ message: "Days must be at least 1" });
      }
      
      const restaurant = await storage.getRestaurant(id);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }
      
      // Calculate new trial end date
      const currentTrialEnd = restaurant.trialEndsAt ? new Date(restaurant.trialEndsAt) : new Date();
      const newTrialEnd = new Date(currentTrialEnd);
      newTrialEnd.setDate(newTrialEnd.getDate() + parseInt(days));
      
      const updated = await storage.updateRestaurant(id, {
        trialEndsAt: newTrialEnd,
      });
      
      res.json(updated);
    } catch (error) {
      console.error("Error extending trial:", error);
      res.status(500).json({ message: "Failed to extend trial" });
    }
  });

  // Admin: Delete restaurant and all associated data
  app.delete('/api/admin/restaurants/:id', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      
      // Get restaurant details before deleting for logging
      const restaurant = await storage.getRestaurant(id);
      
      // Delete all associated data
      await storage.deleteRestaurantCompletely(id);
      
      // Log the action
      await logAdminActivity({
        userId: req.user.id,
        userEmail: req.user.email,
        actionType: 'restaurant_deleted',
        actionCategory: 'restaurant',
        description: `Deleted restaurant "${restaurant?.name || id}" and all associated data`,
        targetId: id,
        targetType: 'restaurant',
        targetName: restaurant?.name,
        metadata: { restaurantId: id, restaurantName: restaurant?.name },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
      
      res.json({ message: "Restaurant deleted successfully" });
    } catch (error) {
      console.error("Error deleting restaurant:", error);
      res.status(500).json({ message: "Failed to delete restaurant" });
    }
  });

  // Admin: Get all platform settings
  app.get('/api/admin/settings', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const settings = await storage.getPlatformSettings();
      res.json(settings);
    } catch (error) {
      console.error("Error fetching platform settings:", error);
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  // Admin: Update platform setting
  app.patch('/api/admin/settings/:key', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { key } = req.params;
      const { value } = req.body;
      
      if (value === undefined || value === null) {
        return res.status(400).json({ message: "Value is required" });
      }
      
      const updated = await storage.updatePlatformSetting(key, String(value), req.user.id);
      res.json(updated);
    } catch (error) {
      console.error("Error updating platform setting:", error);
      res.status(500).json({ message: "Failed to update setting" });
    }
  });

  // Admin: Get all users
  app.get('/api/admin/users', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const users = await storage.getAllUsersForAdmin();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Admin: Suspend user
  app.post('/api/admin/users/:id/suspend', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const updated = await storage.updateUser(id, { isActive: false });
      res.json(updated);
    } catch (error) {
      console.error("Error suspending user:", error);
      res.status(500).json({ message: "Failed to suspend user" });
    }
  });

  // Admin: Activate user
  app.post('/api/admin/users/:id/activate', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const updated = await storage.updateUser(id, { isActive: true });
      res.json(updated);
    } catch (error) {
      console.error("Error activating user:", error);
      res.status(500).json({ message: "Failed to activate user" });
    }
  });

  // Admin: Delete user
  app.delete('/api/admin/users/:id', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      
      // Prevent deleting yourself
      if (id === req.user.id) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }
      
      await storage.deleteUser(id);
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Admin: Reset user password (send reset email)
  app.post('/api/admin/users/:id/reset-password', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const user = await storage.getUser(id);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // In a real app, you'd send a password reset email here
      // For now, just return success
      res.json({ message: "Password reset email sent (simulated)" });
    } catch (error) {
      console.error("Error resetting password:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  // Update restaurant pixels
  app.patch('/api/restaurants/:id/pixels', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const restaurant = await storage.getRestaurant(id);
      
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }
      
      // Verify ownership (unless admin)
      if (req.user.role !== 'admin' && restaurant.ownerId !== req.user.id) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      const { metaPixelId, tiktokPixelId, googleAnalyticsId, googleAdsId } = req.body;
      
      const updates: any = {};
      if (metaPixelId !== undefined) updates.metaPixelId = metaPixelId || null;
      if (tiktokPixelId !== undefined) updates.tiktokPixelId = tiktokPixelId || null;
      if (googleAnalyticsId !== undefined) updates.googleAnalyticsId = googleAnalyticsId || null;
      if (googleAdsId !== undefined) updates.googleAdsId = googleAdsId || null;
      
      const updated = await storage.updateRestaurant(id, updates);
      res.json(updated);
    } catch (error) {
      console.error("Error updating pixels:", error);
      res.status(500).json({ message: "Failed to update pixels" });
    }
  });

  // Update restaurant domain verification
  app.patch('/api/restaurants/:id/domain-verification', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const restaurant = await storage.getRestaurant(id);
      
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }
      
      // Verify ownership (unless admin)
      if (req.user.role !== 'admin' && restaurant.ownerId !== req.user.id) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      const { metaVerificationCode } = req.body;
      
      const updates: any = {};
      if (metaVerificationCode !== undefined) {
        updates.metaVerificationCode = metaVerificationCode || null;
      }
      
      const updated = await storage.updateRestaurant(id, updates);
      res.json(updated);
    } catch (error) {
      console.error("Error updating domain verification:", error);
      res.status(500).json({ message: "Failed to update domain verification" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
