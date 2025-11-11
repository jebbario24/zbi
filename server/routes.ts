import type { Express } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { env, getBaseUrl } from "./env";
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
import { ObjectStorageService, ObjectNotFoundError, signObjectURL, parseObjectPath } from "./objectStorage";
import { db } from "./db";
import { boostSlots, promoRules } from "@shared/schema";
import { eq, and, isNotNull } from "drizzle-orm";
import { wsManager } from "./websocket";
import { authLimiter, apiLimiter, storefrontLimiter, webhookLimiter, uploadLimiter } from "./rateLimiter";
import { logError, logWarn, logInfo } from "./logger";
import marketplaceRouter from "./marketplace";

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

// Middleware to check if user is driver
const isDriver = async (req: any, res: any, next: any) => {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  if (req.user.role !== 'driver') {
    return res.status(403).json({ message: "Forbidden: Driver access required" });
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
    logError('[Payout] Stripe is not configured - automated payouts disabled');
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
      sameSite: process.env.NODE_ENV === 'production' ? 'lax' : 'lax',
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
  app.post('/api/signup', authLimiter, async (req, res) => {
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
      logError("Signup error", error);
      res.status(500).json({ message: "Failed to create account" });
    }
  });

  // Login with email/password
  app.post('/api/login', authLimiter, (req, res, next) => {
    passport.authenticate('local', (err: any, user: any, info: any) => {
      if (err) {
        logError("Login error", err);
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

  app.post('/api/driver/signup', authLimiter, async (req, res) => {
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

      // Create driver profile with minimal required fields
      await storage.createDriverApplication({
        userId: newUser.id,
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        email: validatedData.email.toLowerCase(),
        phone: '', // Will be filled during profile completion
        applicationStatus: 'incomplete',
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

  app.post('/api/driver/login', authLimiter, async (req, res) => {
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
  app.post('/api/object-storage/upload-url', isAuthenticated, uploadLimiter, async (req: any, res) => {
    try {
      const { objectPath } = req.body;
      
      if (!objectPath) {
        return res.status(400).json({ message: "objectPath is required" });
      }

      // Get private object directory and construct full path
      const objectStorageService = new ObjectStorageService();
      const privateDir = objectStorageService.getPrivateObjectDir();
      const fullPath = `${privateDir}/${objectPath}`;
      
      // Parse the full path to get bucket and object names
      const { bucketName, objectName } = parseObjectPath(fullPath);
      
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
        logError('STRIPE_PRICE_ID not configured - subscription creation will fail');
        return res.status(500).json({ message: 'Subscription service not configured. Please contact support.' });
      }
      
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
  app.post('/api/webhooks/stripe', webhookLimiter, async (req, res) => {
    if (!stripe) {
      return res.status(503).send('Payment processing is not configured');
    }

    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!endpointSecret) {
      logError('Missing STRIPE_WEBHOOK_SECRET - webhooks will fail');
      return res.status(500).send('Webhook secret not configured');
    }

    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig as string, endpointSecret);
    } catch (err: any) {
      logError('Webhook signature verification failed', err);
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
      
      // Validate subdomain format if provided
      if (data.subdomain && !/^[a-z0-9-]+$/.test(data.subdomain)) {
        return res.status(400).json({ message: "Subdomain can only contain lowercase letters, numbers, and hyphens" });
      }
      
      // Check subdomain uniqueness if provided and different from current
      if (data.subdomain && data.subdomain !== restaurant.subdomain) {
        const existing = await storage.getRestaurantBySubdomain(data.subdomain);
        if (existing && existing.id !== restaurant.id) {
          return res.status(400).json({ message: "This subdomain is already taken" });
        }
      }
      
      // Check custom domain uniqueness if provided and different from current
      if (data.customDomain && data.customDomain !== restaurant.customDomain) {
        const existing = await storage.getRestaurantByCustomDomain(data.customDomain);
        if (existing && existing.id !== restaurant.id) {
          return res.status(400).json({ message: "This custom domain is already in use" });
        }
      }
      
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
      console.log("[MENU ITEM CREATE] Request body received:", JSON.stringify(req.body, null, 2));
      
      // Handle price conversion if priceCents is not provided but price is
      let requestData = { ...req.body };

      // Handle price conversion in either direction
      if (!requestData.priceCents && requestData.price) {
        // price exists but priceCents doesn't
        const priceValue = parseFloat(requestData.price);
        if (!isNaN(priceValue)) {
          requestData.priceCents = Math.round(priceValue * 100);
          requestData.price = priceValue.toFixed(2);
        }
      } else if (requestData.priceCents && !requestData.price) {
        // priceCents exists but price doesn't - convert back
        const priceValue = requestData.priceCents / 100;
        requestData.price = priceValue.toFixed(2);
        console.log(`[MENU ITEM CREATE] Generated price ${requestData.price} from priceCents ${requestData.priceCents}`);
      }

      
      const data = insertMenuItemSchema.parse({ ...requestData, restaurantId: restaurant.id });
      
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
      
      // Get the original item before updating to check for content changes
      const originalItem = await storage.getMenuItem(req.params.id);
      if (!originalItem) {
        return res.status(404).json({ message: "Menu item not found" });
      }
      if (originalItem.restaurantId !== restaurant.id) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      // Handle price conversion if priceCents is not provided but price is
      let requestData = { ...req.body };
      if (!requestData.priceCents && requestData.price) {
        const priceValue = parseFloat(requestData.price);
        if (!isNaN(priceValue)) {
          requestData.priceCents = Math.round(priceValue * 100);
          requestData.price = priceValue.toFixed(2); // Ensure price is a decimal string with 2 places
        }
      }
      
      const data = insertMenuItemSchema.partial().parse(requestData);
      
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
      
      // Check if name or description changed - if so, mark translations as needing review
      const nameChanged = data.name !== undefined && data.name !== originalItem.name;
      const descriptionChanged = data.description !== undefined && data.description !== originalItem.description;
      
      if (nameChanged || descriptionChanged) {
        await storage.markTranslationsAsNeedingReview(restaurant.id, 'menu_item', req.params.id);
        console.log(`[TRANSLATION SYNC] Marked translations for menu item ${req.params.id} as needing review`);
      }
      
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

  // Translation routes
  app.get('/api/translations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }

      const { entityType, entityId, locale } = req.query;
      if (!entityType || !entityId) {
        return res.status(400).json({ message: "entityType and entityId are required" });
      }

      const translations = await storage.getTranslations(
        restaurant.id,
        entityType as string,
        entityId as string,
        locale as string | undefined
      );
      res.json(translations);
    } catch (error) {
      console.error("Error fetching translations:", error);
      res.status(500).json({ message: "Failed to fetch translations" });
    }
  });

  app.get('/api/translations/locale/:locale', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }

      const translations = await storage.getTranslationsByLocale(restaurant.id, req.params.locale);
      res.json(translations);
    } catch (error) {
      console.error("Error fetching translations by locale:", error);
      res.status(500).json({ message: "Failed to fetch translations" });
    }
  });

  app.post('/api/translations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }

      const { entityType, entityId, locale, field, value } = req.body;
      if (!entityType || !entityId || !locale || !field || value === undefined) {
        return res.status(400).json({ message: "entityType, entityId, locale, field, and value are required" });
      }

      const translation = await storage.createOrUpdateTranslation(restaurant.id, {
        entityType,
        entityId,
        locale,
        field,
        value,
        lastUpdatedBy: userId,
      });
      res.json(translation);
    } catch (error) {
      console.error("Error creating/updating translation:", error);
      res.status(500).json({ message: "Failed to save translation" });
    }
  });

  app.post('/api/translations/bulk', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }

      const { translations } = req.body;
      if (!Array.isArray(translations)) {
        return res.status(400).json({ message: "translations must be an array" });
      }

      await storage.bulkUpsertTranslations(restaurant.id, translations);
      res.json({ success: true, count: translations.length });
    } catch (error) {
      console.error("Error bulk upserting translations:", error);
      res.status(500).json({ message: "Failed to save translations" });
    }
  });

  app.delete('/api/translations/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }

      // Get the translation to verify ownership
      const translation = await storage.getTranslationById(req.params.id);
      if (!translation || translation.restaurantId !== restaurant.id) {
        return res.status(404).json({ message: "Translation not found" });
      }

      await storage.deleteTranslation(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting translation:", error);
      res.status(500).json({ message: "Failed to delete translation" });
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

    // Validate required fields - match what frontend sends
    const { name, promoCode, promoType, discountValue, scope, redemptionLimit, isActive, startsAt, endsAt, buyItemId, getItemId, buyQuantity, getQuantity, autoApply, perCustomerLimit, priority, description } = req.body;
    
    if (!name || !promoCode) {
      return res.status(400).json({ 
        message: "Promo name and code are required" 
      });
    }

    // Build promo data with correct field names matching database schema
    const promoData = { 
      restaurantId: restaurant.id,
      name,
      description: description || null,
      promoCode,
      promoType: promoType || 'percentage',
      discountValue: discountValue ? discountValue.toString() : '0',
      scope: scope || 'order',
      redemptionLimit: redemptionLimit || null,
      isActive: isActive !== undefined ? isActive : true,
      startsAt: startsAt ? new Date(startsAt) : new Date(),
      endsAt: endsAt ? new Date(endsAt) : null,
      buyItemId: buyItemId || null,
      getItemId: getItemId || null,
      buyQuantity: buyQuantity || null,
      getQuantity: getQuantity || null,
      autoApply: autoApply !== undefined ? autoApply : false,
      perCustomerLimit: perCustomerLimit || 1,
      priority: priority || 0,
    };
    
    const promo = await storage.createPromo(promoData);
    res.json(promo);
  } catch (error: any) {
    console.error("Error creating promo:", error);
    res.status(400).json({ 
      message: `Failed to create promo: ${error.message}` 
    });
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

      // PHASE 6: Make prep time prediction when order is created
      try {
        const { prepTimePredictionService } = await import('./services/prepTimePrediction');
        const prediction = await prepTimePredictionService.predictPrepTime(restaurant.id, {
          itemCount: data.items.length,
          orderValue: data.total,
          hasSpecialInstructions: data.items.some((item: any) => item.notes),
        });
        await prepTimePredictionService.savePrediction(order.id, restaurant.id, prediction, {
          itemCount: data.items.length,
          orderValue: data.total,
        });
        logInfo(`Prep time prediction for order ${order.id}: ${prediction.predictedMinutes} min (${prediction.confidence}% confidence)`);
      } catch (error) {
        logError('Error making prep time prediction (non-critical)', error);
      }
      
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
      user.stripeConnectAccountId
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
    idProofUrl: z.string().min(1, "ID proof URL is required").optional(),
    insuranceUrl: z.string().min(1, "Insurance URL is required").optional(),
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

      // Step 1: Personal Information (20%)
      const personalInfoComplete = !!(
        user.phone &&
        user.dateOfBirth &&
        user.address &&
        user.city &&
        user.country &&
        user.postalCode &&
        user.emergencyContactName &&
        user.emergencyContactPhone
      );

      // Step 2: Vehicle Details (40%)
      const vehicleInfoComplete = !!(
        user.vehicleType &&
        user.vehicleMake &&
        user.vehicleModel &&
        user.vehicleYear &&
        user.vehiclePlate &&
        user.vehicleColor &&
        user.licenseNumber &&
        user.licenseExpiry
      );

      // Step 3: Documents (60%)
      const documentsComplete = !!(
        user.idProofUrl &&
        user.insuranceUrl
      );

      // Step 4: Bank Account (100%)
      const bankAccountConnected = !!user.stripeConnectAccountId;

      // Calculate completion percentage
      let completionPercentage = 0;
      if (personalInfoComplete) completionPercentage = 20;
      if (vehicleInfoComplete) completionPercentage = 40;
      if (documentsComplete) completionPercentage = 60;
      if (bankAccountConnected) completionPercentage = 100;

      // Profile is fully complete when all 4 steps are done
      const isComplete = completionPercentage === 100;

      // Update profile completion status if changed
      if (user.profileComplete !== isComplete) {
        await storage.updateUser(req.user.id, { profileComplete: isComplete });
      }

      res.json({ 
        profileComplete: isComplete,
        completionPercentage,
        personalInfoComplete,
        vehicleInfoComplete,
        documentsComplete,
        bankAccountConnected,
        adminApproved: user.adminApproved || false,
      });
    } catch (error) {
      console.error("Error checking profile completion:", error);
      res.status(500).json({ message: "Failed to check profile completion" });
    }
  });

  // Driver Zone Management APIs
  // GET /api/driver/available-zones - Get all delivery zones across all restaurants
  app.get('/api/driver/available-zones', isAuthenticated, async (req: any, res) => {
    try {
      if (req.user.role !== 'driver') {
        return res.status(403).json({ message: "Only drivers can access this endpoint" });
      }

      // Get all active delivery zones from all restaurants
      const zones = await storage.getAllActiveDeliveryZones();
      res.json(zones);
    } catch (error) {
      console.error("Error fetching available zones:", error);
      res.status(500).json({ message: "Failed to fetch available zones" });
    }
  });

  // GET /api/driver/service-zones - Get driver's selected service zones
  app.get('/api/driver/service-zones', isAuthenticated, async (req: any, res) => {
    try {
      if (req.user.role !== 'driver') {
        return res.status(403).json({ message: "Only drivers can access this endpoint" });
      }

      const driver = await storage.getDriverByUserId(req.user.id);
      if (!driver) {
        return res.status(404).json({ message: "Driver profile not found" });
      }

      res.json({ serviceZones: driver.serviceZones || [] });
    } catch (error) {
      console.error("Error fetching driver service zones:", error);
      res.status(500).json({ message: "Failed to fetch service zones" });
    }
  });

  // PUT /api/driver/service-zones - Update driver's service zones
  app.put('/api/driver/service-zones', isAuthenticated, async (req: any, res) => {
    try {
      if (req.user.role !== 'driver') {
        return res.status(403).json({ message: "Only drivers can update service zones" });
      }

      const { zoneIds } = req.body;
      if (!Array.isArray(zoneIds)) {
        return res.status(400).json({ message: "zoneIds must be an array" });
      }

      const driver = await storage.getDriverByUserId(req.user.id);
      if (!driver) {
        return res.status(404).json({ message: "Driver profile not found" });
      }

      await storage.updateDriverServiceZones(driver.id, zoneIds);
      res.json({ message: "Service zones updated successfully", serviceZones: zoneIds });
    } catch (error) {
      console.error("Error updating driver service zones:", error);
      res.status(500).json({ message: "Failed to update service zones" });
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

      // Validate required fields for Stripe Connect
      if (!driver.phone || !driver.phone.match(/^\+[1-9]\d{1,14}$/)) {
        return res.status(400).json({ error: "Valid phone number in international format is required. Please complete your Personal Information tab first." });
      }

      if (!driver.firstName || !driver.lastName) {
        return res.status(400).json({ error: "First name and last name are required. Please complete your Personal Information tab first." });
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

      const baseUrl = getBaseUrl();

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

  // ==========================================
  // REAL-TIME LOCATION TRACKING ENDPOINTS
  // ==========================================

  // Update driver location (high-frequency updates)
  app.post("/api/driver/location/update", isAuthenticated, async (req: any, res) => {
    try {
      const { locationTrackingService } = await import('./services/locationTracking');
      const { lat, lng, accuracy, speed, heading, altitude, orderId } = req.body;

      if (!lat || !lng) {
        return res.status(400).json({ error: "Latitude and longitude are required" });
      }

      await locationTrackingService.updateLocation({
        driverId: req.user.id,
        orderId: orderId || undefined,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        accuracy: accuracy ? parseFloat(accuracy) : undefined,
        speed: speed ? parseFloat(speed) : undefined,
        heading: heading ? parseFloat(heading) : undefined,
        altitude: altitude ? parseFloat(altitude) : undefined,
        timestamp: new Date(),
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error updating driver location:", error);
      res.status(500).json({ error: error.message || "Failed to update location" });
    }
  });

  // Get driver's current location
  app.get("/api/driver/location/current", isAuthenticated, async (req: any, res) => {
    try {
      const { locationTrackingService } = await import('./services/locationTracking');
      const location = await locationTrackingService.getCurrentLocation(req.user.id);

      if (!location) {
        return res.status(404).json({ error: "No location data found" });
      }

      res.json(location);
    } catch (error: any) {
      console.error("Error getting current location:", error);
      res.status(500).json({ error: error.message || "Failed to get location" });
    }
  });

  // Get driver's location history
  app.get("/api/driver/location/history", isAuthenticated, async (req: any, res) => {
    try {
      const { locationTrackingService } = await import('./services/locationTracking');
      const { since, orderId } = req.query;

      const sinceDate = since ? new Date(String(since)) : new Date(Date.now() - 60 * 60 * 1000); // Default: last hour
      const history = await locationTrackingService.getLocationHistory(
        req.user.id,
        sinceDate,
        orderId ? parseInt(String(orderId)) : undefined
      );

      res.json(history);
    } catch (error: any) {
      console.error("Error getting location history:", error);
      res.status(500).json({ error: error.message || "Failed to get location history" });
    }
  });

  // Get ETA for active delivery
  app.get("/api/driver/delivery/:orderId/eta", isAuthenticated, async (req: any, res) => {
    try {
      const { locationTrackingService } = await import('./services/locationTracking');
      const orderId = parseInt(req.params.orderId);

      // Get driver's current location
      const driverLocation = await locationTrackingService.getCurrentLocation(req.user.id);
      if (!driverLocation) {
        return res.status(404).json({ error: "Driver location not available" });
      }

      // Calculate ETA
      const eta = await locationTrackingService.updateETA(orderId, driverLocation);
      if (!eta) {
        return res.status(404).json({ error: "Unable to calculate ETA" });
      }

      res.json(eta);
    } catch (error: any) {
      console.error("Error calculating ETA:", error);
      res.status(500).json({ error: error.message || "Failed to calculate ETA" });
    }
  });

  // Get ETA history for an order
  app.get("/api/driver/delivery/:orderId/eta/history", isAuthenticated, async (req: any, res) => {
    try {
      const { locationTrackingService } = await import('./services/locationTracking');
      const orderId = parseInt(req.params.orderId);

      const history = await locationTrackingService.getETAHistory(orderId);
      res.json(history);
    } catch (error: any) {
      console.error("Error getting ETA history:", error);
      res.status(500).json({ error: error.message || "Failed to get ETA history" });
    }
  });

  // Get all active drivers with locations (admin/dispatcher only)
  app.get("/api/admin/drivers/locations", isAuthenticated, async (req: any, res) => {
    try {
      if (req.user.role !== 'admin' && req.user.role !== 'dispatcher') {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const { locationTrackingService } = await import('./services/locationTracking');
      const locations = await locationTrackingService.getActiveDriverLocations();
      res.json(locations);
    } catch (error: any) {
      console.error("Error getting driver locations:", error);
      res.status(500).json({ error: error.message || "Failed to get driver locations" });
    }
  });

  // ==========================================
  // ROUTE OPTIMIZATION ENDPOINTS
  // ==========================================

  // Create optimized route for single delivery
  app.post("/api/driver/route/create", isAuthenticated, async (req: any, res) => {
    try {
      const { routeOptimizationService } = await import('./services/routeOptimization');
      const { locationTrackingService } = await import('./services/locationTracking');
      const { orderId } = req.body;

      if (!orderId) {
        return res.status(400).json({ error: "Order ID is required" });
      }

      // Get driver's current location
      const driverLocation = await locationTrackingService.getCurrentLocation(req.user.id);
      if (!driverLocation) {
        return res.status(400).json({ error: "Driver location not available. Please enable location tracking." });
      }

      // Create route
      const routeId = await routeOptimizationService.createSingleDeliveryRoute(
        req.user.id,
        parseInt(orderId),
        driverLocation
      );

      res.json({ routeId, success: true });
    } catch (error: any) {
      console.error("Error creating route:", error);
      res.status(500).json({ error: error.message || "Failed to create route" });
    }
  });

  // Create optimized route for batch delivery
  app.post("/api/driver/route/batch", isAuthenticated, async (req: any, res) => {
    try {
      const { routeOptimizationService } = await import('./services/routeOptimization');
      const { locationTrackingService } = await import('./services/locationTracking');
      const { orderIds } = req.body;

      if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
        return res.status(400).json({ error: "Order IDs array is required" });
      }

      // Get driver's current location
      const driverLocation = await locationTrackingService.getCurrentLocation(req.user.id);
      if (!driverLocation) {
        return res.status(400).json({ error: "Driver location not available. Please enable location tracking." });
      }

      // Create optimized batch route
      const route = await routeOptimizationService.createBatchDeliveryRoute(
        req.user.id,
        orderIds.map((id: any) => parseInt(id)),
        driverLocation
      );

      res.json(route);
    } catch (error: any) {
      console.error("Error creating batch route:", error);
      res.status(500).json({ error: error.message || "Failed to create batch route" });
    }
  });

  // Find batch delivery opportunities
  app.get("/api/driver/batch-opportunities", isAuthenticated, async (req: any, res) => {
    try {
      const { routeOptimizationService } = await import('./services/routeOptimization');
      const { locationTrackingService } = await import('./services/locationTracking');

      // Get driver's current location
      const driverLocation = await locationTrackingService.getCurrentLocation(req.user.id);
      if (!driverLocation) {
        return res.json({ opportunities: [] });
      }

      // Find batch opportunities
      const opportunities = await routeOptimizationService.findBatchOpportunities(
        req.user.id,
        driverLocation
      );

      res.json({ opportunities });
    } catch (error: any) {
      console.error("Error finding batch opportunities:", error);
      res.status(500).json({ error: error.message || "Failed to find batch opportunities" });
    }
  });

  // ==========================================
  // ADVANCED ROUTE OPTIMIZATION (PHASE 2)
  // ==========================================

  // Create advanced optimized batch route with constraints
  app.post("/api/driver/route/batch/advanced", isAuthenticated, async (req: any, res) => {
    try {
      const { advancedRouteOptimizationService } = await import('./services/advancedRouteOptimization');
      const { locationTrackingService } = await import('./services/locationTracking');
      const { orderIds, optimizeFor, respectConstraints } = req.body;

      if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
        return res.status(400).json({ error: "Order IDs array is required" });
      }

      // Get driver's current location
      const driverLocation = await locationTrackingService.getCurrentLocation(req.user.id);
      if (!driverLocation) {
        return res.status(400).json({ error: "Driver location not available" });
      }

      // Create advanced batch route
      const result = await advancedRouteOptimizationService.createOptimizedBatchRoute(
        req.user.id,
        orderIds.map((id: any) => parseInt(id)),
        driverLocation,
        {
          optimizeFor: optimizeFor || 'time',
          respectConstraints: respectConstraints !== false,
        }
      );

      res.json(result);
    } catch (error: any) {
      console.error("Error creating advanced batch route:", error);
      res.status(500).json({ error: error.message || "Failed to create advanced route" });
    }
  });

  // Add time window constraint to order
  app.post("/api/orders/:orderId/constraints/time-window", isAuthenticated, async (req: any, res) => {
    try {
      const { advancedRouteOptimizationService } = await import('./services/advancedRouteOptimization');
      const { orderId } = req.params;
      const { earliestTime, latestTime, constraintType, priority, isHard, reason } = req.body;

      if (!earliestTime || !latestTime) {
        return res.status(400).json({ error: "earliestTime and latestTime are required" });
      }

      const constraintId = await advancedRouteOptimizationService.addTimeWindowConstraint(
        parseInt(orderId),
        new Date(earliestTime),
        new Date(latestTime),
        { constraintType, priority, isHard, reason }
      );

      res.json({ constraintId, success: true });
    } catch (error: any) {
      console.error("Error adding time window constraint:", error);
      res.status(500).json({ error: error.message || "Failed to add constraint" });
    }
  });

  // Get constraints for an order
  app.get("/api/orders/:orderId/constraints", isAuthenticated, async (req: any, res) => {
    try {
      const { advancedRouteOptimizationService } = await import('./services/advancedRouteOptimization');
      const { orderId } = req.params;

      const constraints = await advancedRouteOptimizationService.getOrderConstraints(parseInt(orderId));
      res.json(constraints);
    } catch (error: any) {
      console.error("Error getting order constraints:", error);
      res.status(500).json({ error: error.message || "Failed to get constraints" });
    }
  });

  // Remove constraint
  app.delete("/api/constraints/:constraintId", isAuthenticated, async (req: any, res) => {
    try {
      const { advancedRouteOptimizationService } = await import('./services/advancedRouteOptimization');
      const { constraintId } = req.params;

      await advancedRouteOptimizationService.removeConstraint(constraintId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error removing constraint:", error);
      res.status(500).json({ error: error.message || "Failed to remove constraint" });
    }
  });

  // Get route optimization history
  app.get("/api/driver/route-optimization/history", isAuthenticated, async (req: any, res) => {
    try {
      const { limit = 50 } = req.query;
      const history = await storage.getRouteOptimizationHistory(req.user.id, parseInt(String(limit)));
      res.json(history);
    } catch (error: any) {
      console.error("Error getting optimization history:", error);
      res.status(500).json({ error: error.message || "Failed to get history" });
    }
  });

  // Get driver capabilities/vehicle settings
  app.get("/api/driver/capabilities", isAuthenticated, async (req: any, res) => {
    try {
      const capabilities = await storage.getDriverCapabilities(req.user.id);
      res.json(capabilities);
    } catch (error: any) {
      console.error("Error getting driver capabilities:", error);
      res.status(500).json({ error: error.message || "Failed to get capabilities" });
    }
  });

  // Update driver capabilities/vehicle settings
  app.put("/api/driver/capabilities", isAuthenticated, async (req: any, res) => {
    try {
      const capabilities = await storage.upsertDriverCapabilities(req.user.id, req.body);
      res.json(capabilities);
    } catch (error: any) {
      console.error("Error updating driver capabilities:", error);
      res.status(500).json({ error: error.message || "Failed to update capabilities" });
    }
  });

  // ========================================
  // PHASE 3: AUTOMATED DISPATCHING ENDPOINTS
  // ========================================

  // Get driver dispatch preferences
  app.get("/api/driver/dispatch/preferences", isAuthenticated, async (req: any, res) => {
    try {
      if (req.user.role !== 'driver') {
        return res.status(403).json({ error: "Only drivers can access dispatch preferences" });
      }

      const preferences = await storage.getDispatchPreferences(req.user.id);
      res.json(preferences || {
        autoAcceptEnabled: false,
        notificationSound: true,
        vibration: true,
        maxConcurrentOrders: 1,
      });
    } catch (error: any) {
      console.error("Error getting dispatch preferences:", error);
      res.status(500).json({ error: error.message || "Failed to get preferences" });
    }
  });

  // Update driver dispatch preferences
  app.put("/api/driver/dispatch/preferences", isAuthenticated, async (req: any, res) => {
    try {
      if (req.user.role !== 'driver') {
        return res.status(403).json({ error: "Only drivers can access dispatch preferences" });
      }

      const preferences = await storage.upsertDispatchPreferences(req.user.id, req.body);
      res.json(preferences);
    } catch (error: any) {
      console.error("Error updating dispatch preferences:", error);
      res.status(500).json({ error: error.message || "Failed to update preferences" });
    }
  });

  // Accept an assignment
  app.post("/api/driver/dispatch/assignments/:assignmentId/accept", isAuthenticated, async (req: any, res) => {
    try {
      if (req.user.role !== 'driver') {
        return res.status(403).json({ error: "Only drivers can accept assignments" });
      }

      const { assignmentId } = req.params;
      const { automatedDispatchService } = await import('./services/automatedDispatch');
      
      // Calculate response time (would need assignment timestamp from DB)
      const assignment = await storage.getDispatchAssignment(assignmentId);
      if (!assignment) {
        return res.status(404).json({ error: "Assignment not found" });
      }

      if (assignment.status !== 'pending') {
        return res.status(400).json({ error: "Assignment is no longer available" });
      }

      const responseTime = Math.floor((Date.now() - assignment.assignedAt.getTime()) / 1000);
      
      await automatedDispatchService.handleAcceptance(assignmentId, req.user.id, responseTime);
      
      res.json({ success: true, message: "Assignment accepted" });
    } catch (error: any) {
      console.error("Error accepting assignment:", error);
      res.status(500).json({ error: error.message || "Failed to accept assignment" });
    }
  });

  // Reject an assignment
  app.post("/api/driver/dispatch/assignments/:assignmentId/reject", isAuthenticated, async (req: any, res) => {
    try {
      if (req.user.role !== 'driver') {
        return res.status(403).json({ error: "Only drivers can reject assignments" });
      }

      const { assignmentId } = req.params;
      const { reason, category } = req.body;
      const { automatedDispatchService } = await import('./services/automatedDispatch');
      
      const assignment = await storage.getDispatchAssignment(assignmentId);
      if (!assignment) {
        return res.status(404).json({ error: "Assignment not found" });
      }

      const responseTime = Math.floor((Date.now() - assignment.assignedAt.getTime()) / 1000);
      
      await automatedDispatchService.handleRejection(
        assignmentId, 
        req.user.id, 
        reason || 'No reason provided',
        category || 'other',
        responseTime
      );
      
      res.json({ success: true, message: "Assignment rejected" });
    } catch (error: any) {
      console.error("Error rejecting assignment:", error);
      res.status(500).json({ error: error.message || "Failed to reject assignment" });
    }
  });

  // Get driver's assignment history
  app.get("/api/driver/dispatch/history", isAuthenticated, async (req: any, res) => {
    try {
      if (req.user.role !== 'driver') {
        return res.status(403).json({ error: "Only drivers can access assignment history" });
      }

      const { limit = 20, offset = 0 } = req.query;
      const history = await storage.getDriverAssignmentHistory(req.user.id, Number(limit), Number(offset));
      
      res.json(history);
    } catch (error: any) {
      console.error("Error getting assignment history:", error);
      res.status(500).json({ error: error.message || "Failed to get assignment history" });
    }
  });

  // Get driver score/stats
  app.get("/api/driver/dispatch/score", isAuthenticated, async (req: any, res) => {
    try {
      if (req.user.role !== 'driver') {
        return res.status(403).json({ error: "Only drivers can access their score" });
      }

      const score = await storage.getDriverScore(req.user.id);
      res.json(score || {
        reliabilityScore: 100,
        acceptanceRate: 100,
        completionRate: 100,
        onTimeRate: 100,
        customerRating: 5.0,
        totalDeliveries: 0,
        activePenalties: 0,
      });
    } catch (error: any) {
      console.error("Error getting driver score:", error);
      res.status(500).json({ error: error.message || "Failed to get driver score" });
    }
  });

  // Get driver penalties
  app.get("/api/driver/dispatch/penalties", isAuthenticated, async (req: any, res) => {
    try {
      if (req.user.role !== 'driver') {
        return res.status(403).json({ error: "Only drivers can access their penalties" });
      }

      const penalties = await storage.getDriverPenalties(req.user.id);
      res.json(penalties);
    } catch (error: any) {
      console.error("Error getting driver penalties:", error);
      res.status(500).json({ error: error.message || "Failed to get penalties" });
    }
  });

  // Admin: Get dispatch queue
  app.get("/api/admin/dispatch/queue", isAuthenticated, async (req: any, res) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: "Only admins can access dispatch queue" });
      }

      const { status = 'pending' } = req.query;
      const queue = await storage.getDispatchQueue(status as string);
      
      res.json(queue);
    } catch (error: any) {
      console.error("Error getting dispatch queue:", error);
      res.status(500).json({ error: error.message || "Failed to get dispatch queue" });
    }
  });

  // Admin: Manually assign order to driver
  app.post("/api/admin/dispatch/assign", isAuthenticated, async (req: any, res) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: "Only admins can manually assign orders" });
      }

      const { orderId, driverId } = req.body;
      const { driverMatchingService } = await import('./services/driverMatching');
      
      // Get order and driver info for scoring
      const order = await storage.getOrder(orderId);
      const driver = await storage.getDriverLocation(driverId);
      
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }

      // Create manual assignment
      const assignment = await storage.createDispatchAssignment({
        orderId,
        driverId,
        assignmentType: 'manual',
        assignedBy: req.user.id,
        status: 'pending',
      });

      res.json({ success: true, assignment });
    } catch (error: any) {
      console.error("Error manually assigning order:", error);
      res.status(500).json({ error: error.message || "Failed to assign order" });
    }
  });

  // Admin: Process dispatch queue manually (trigger auto-dispatch)
  app.post("/api/admin/dispatch/process", isAuthenticated, async (req: any, res) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: "Only admins can process dispatch queue" });
      }

      const { automatedDispatchService } = await import('./services/automatedDispatch');
      await automatedDispatchService.processQueue();
      
      res.json({ success: true, message: "Dispatch queue processed" });
    } catch (error: any) {
      console.error("Error processing dispatch queue:", error);
      res.status(500).json({ error: error.message || "Failed to process queue" });
    }
  });

  // Admin: Get all driver scores
  app.get("/api/admin/dispatch/driver-scores", isAuthenticated, async (req: any, res) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: "Only admins can access driver scores" });
      }

      const scores = await storage.getAllDriverScores();
      res.json(scores);
    } catch (error: any) {
      console.error("Error getting driver scores:", error);
      res.status(500).json({ error: error.message || "Failed to get driver scores" });
    }
  });

  // ========================================
  // PHASE 4: BATCH DELIVERY ENDPOINTS
  // ========================================

  // Create a new batch
  app.post("/api/driver/batch/create", isAuthenticated, async (req: any, res) => {
    try {
      if (req.user.role !== 'driver') {
        return res.status(403).json({ error: "Only drivers can create batches" });
      }

      const { orderIds, optimize = true } = req.body;
      const { batchManagementService } = await import('./services/batchManagement');

      if (!orderIds || !Array.isArray(orderIds) || orderIds.length < 2) {
        return res.status(400).json({ error: "At least 2 orders required for batch" });
      }

      const result = await batchManagementService.createBatch(req.user.id, orderIds, optimize);
      res.json(result);
    } catch (error: any) {
      console.error("Error creating batch:", error);
      res.status(500).json({ error: error.message || "Failed to create batch" });
    }
  });

  // Start batch delivery
  app.post("/api/driver/batch/:batchId/start", isAuthenticated, async (req: any, res) => {
    try {
      if (req.user.role !== 'driver') {
        return res.status(403).json({ error: "Only drivers can start batches" });
      }

      const { batchId } = req.params;
      const { batchManagementService } = await import('./services/batchManagement');

      await batchManagementService.startBatch(batchId);
      res.json({ success: true, message: "Batch started" });
    } catch (error: any) {
      console.error("Error starting batch:", error);
      res.status(500).json({ error: error.message || "Failed to start batch" });
    }
  });

  // Complete a stop
  app.post("/api/driver/batch/:batchId/stop/:stopId/complete", isAuthenticated, async (req: any, res) => {
    try {
      if (req.user.role !== 'driver') {
        return res.status(403).json({ error: "Only drivers can complete stops" });
      }

      const { batchId, stopId } = req.params;
      const { arrivalTime, duration, hasIssues = false, issueDescription } = req.body;
      const { batchManagementService } = await import('./services/batchManagement');

      await batchManagementService.completeStop(
        batchId,
        stopId,
        arrivalTime ? new Date(arrivalTime) : new Date(),
        duration || 5,
        hasIssues,
        issueDescription
      );

      // Check if batch is now complete
      const activeBatch = await storage.getBatchById(batchId);
      const batchCompleted = activeBatch?.batchStatus === 'completed';

      res.json({ success: true, batchCompleted });
    } catch (error: any) {
      console.error("Error completing stop:", error);
      res.status(500).json({ error: error.message || "Failed to complete stop" });
    }
  });

  // Reorder stops
  app.post("/api/driver/batch/:batchId/reorder", isAuthenticated, async (req: any, res) => {
    try {
      if (req.user.role !== 'driver') {
        return res.status(403).json({ error: "Only drivers can reorder stops" });
      }

      const { batchId } = req.params;
      const { newSequence, reason = "driver_decision" } = req.body;
      const { batchManagementService } = await import('./services/batchManagement');

      if (!newSequence || !Array.isArray(newSequence)) {
        return res.status(400).json({ error: "newSequence array required" });
      }

      const result = await batchManagementService.reorderStops(
        batchId,
        req.user.id,
        newSequence,
        reason
      );

      res.json(result);
    } catch (error: any) {
      console.error("Error reordering stops:", error);
      res.status(500).json({ error: error.message || "Failed to reorder stops" });
    }
  });

  // Add order to batch
  app.post("/api/driver/batch/:batchId/add", isAuthenticated, async (req: any, res) => {
    try {
      if (req.user.role !== 'driver') {
        return res.status(403).json({ error: "Only drivers can add to batches" });
      }

      const { batchId } = req.params;
      const { orderId, position } = req.body;
      const { batchManagementService } = await import('./services/batchManagement');

      if (!orderId) {
        return res.status(400).json({ error: "orderId required" });
      }

      await batchManagementService.addOrderToBatch(batchId, req.user.id, orderId, position);
      res.json({ success: true, message: "Order added to batch" });
    } catch (error: any) {
      console.error("Error adding order to batch:", error);
      res.status(500).json({ error: error.message || "Failed to add order to batch" });
    }
  });

  // Remove order from batch
  app.post("/api/driver/batch/:batchId/remove/:orderId", isAuthenticated, async (req: any, res) => {
    try {
      if (req.user.role !== 'driver') {
        return res.status(403).json({ error: "Only drivers can remove from batches" });
      }

      const { batchId, orderId } = req.params;
      const { reason = "driver_decision" } = req.body;
      const { batchManagementService } = await import('./services/batchManagement');

      await batchManagementService.removeOrderFromBatch(batchId, req.user.id, orderId, reason);
      res.json({ success: true, message: "Order removed from batch" });
    } catch (error: any) {
      console.error("Error removing order from batch:", error);
      res.status(500).json({ error: error.message || "Failed to remove order from batch" });
    }
  });

  // Get active batch
  app.get("/api/driver/batch/active", isAuthenticated, async (req: any, res) => {
    try {
      if (req.user.role !== 'driver') {
        return res.status(403).json({ error: "Only drivers can access batch info" });
      }

      const { batchManagementService } = await import('./services/batchManagement');
      const batch = await batchManagementService.getActiveBatch(req.user.id);
      
      res.json(batch);
    } catch (error: any) {
      console.error("Error getting active batch:", error);
      res.status(500).json({ error: error.message || "Failed to get active batch" });
    }
  });

  // Admin: Get batch details
  app.get("/api/admin/batch/:batchId", isAuthenticated, async (req: any, res) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: "Only admins can access batch details" });
      }

      const { batchId } = req.params;
      const batch = await storage.getBatchById(batchId);
      const stops = await storage.getBatchStops(batchId);
      const modifications = await storage.getBatchModifications(batchId);
      const performance = await storage.getBatchPerformance(batchId);

      res.json({ batch, stops, modifications, performance });
    } catch (error: any) {
      console.error("Error getting batch details:", error);
      res.status(500).json({ error: error.message || "Failed to get batch details" });
    }
  });

  // Admin: Get batch performance analytics
  app.get("/api/admin/batch/performance", isAuthenticated, async (req: any, res) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: "Only admins can access batch performance" });
      }

      const { driverId, limit = 50 } = req.query;
      const performance = await storage.getBatchPerformanceList(driverId as string, Number(limit));

      res.json(performance);
    } catch (error: any) {
      console.error("Error getting batch performance:", error);
      res.status(500).json({ error: error.message || "Failed to get batch performance" });
    }
  });

  // ========================================
  // PHASE 5: ANALYTICS & PERFORMANCE ENDPOINTS
  // ========================================

  // Get earnings summary
  app.get("/api/driver/analytics/earnings/summary", isAuthenticated, async (req: any, res) => {
    try {
      if (req.user.role !== 'driver') {
        return res.status(403).json({ error: "Only drivers can access earnings analytics" });
      }

      const { period = 'week' } = req.query;
      const { earningsAnalyticsService } = await import('./services/earningsAnalytics');

      // Calculate date range
      const endDate = new Date().toISOString().split('T')[0];
      let startDate: string;
      switch (period) {
        case 'week':
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          startDate = weekAgo.toISOString().split('T')[0];
          break;
        case 'month':
          const monthAgo = new Date();
          monthAgo.setMonth(monthAgo.getMonth() - 1);
          startDate = monthAgo.toISOString().split('T')[0];
          break;
        case 'year':
          const yearAgo = new Date();
          yearAgo.setFullYear(yearAgo.getFullYear() - 1);
          startDate = yearAgo.toISOString().split('T')[0];
          break;
        default:
          startDate = endDate;
      }

      const summary = await earningsAnalyticsService.getEarningsSummary(
        req.user.id,
        startDate,
        endDate
      );

      res.json(summary);
    } catch (error: any) {
      console.error("Error getting earnings summary:", error);
      res.status(500).json({ error: error.message || "Failed to get earnings summary" });
    }
  });

  // Get earnings trend
  app.get("/api/driver/analytics/earnings/trend", isAuthenticated, async (req: any, res) => {
    try {
      if (req.user.role !== 'driver') {
        return res.status(403).json({ error: "Only drivers can access earnings analytics" });
      }

      const { period = 'week' } = req.query;
      const { earningsAnalyticsService } = await import('./services/earningsAnalytics');

      const trend = await earningsAnalyticsService.getEarningsTrend(
        req.user.id,
        period as 'week' | 'month' | 'year'
      );

      res.json(trend);
    } catch (error: any) {
      console.error("Error getting earnings trend:", error);
      res.status(500).json({ error: error.message || "Failed to get earnings trend" });
    }
  });

  // Get earnings by time of day
  app.get("/api/driver/analytics/earnings/by-time", isAuthenticated, async (req: any, res) => {
    try {
      if (req.user.role !== 'driver') {
        return res.status(403).json({ error: "Only drivers can access earnings analytics" });
      }

      const { earningsAnalyticsService } = await import('./services/earningsAnalytics');
      const timeSlots = await earningsAnalyticsService.getEarningsByTimeOfDay(req.user.id);

      res.json(timeSlots);
    } catch (error: any) {
      console.error("Error getting earnings by time:", error);
      res.status(500).json({ error: error.message || "Failed to get earnings by time" });
    }
  });

  // Get earnings forecast
  app.get("/api/driver/analytics/earnings/forecast", isAuthenticated, async (req: any, res) => {
    try {
      if (req.user.role !== 'driver') {
        return res.status(403).json({ error: "Only drivers can access earnings analytics" });
      }

      const { days = 7 } = req.query;
      const { earningsAnalyticsService } = await import('./services/earningsAnalytics');

      const forecast = await earningsAnalyticsService.calculateEarningsForecast(
        req.user.id,
        Number(days)
      );

      res.json(forecast);
    } catch (error: any) {
      console.error("Error getting earnings forecast:", error);
      res.status(500).json({ error: error.message || "Failed to get earnings forecast" });
    }
  });

  // Get top earning hours
  app.get("/api/driver/analytics/insights/best-hours", isAuthenticated, async (req: any, res) => {
    try {
      if (req.user.role !== 'driver') {
        return res.status(403).json({ error: "Only drivers can access insights" });
      }

      const { limit = 5 } = req.query;
      const { earningsAnalyticsService } = await import('./services/earningsAnalytics');

      const topHours = await earningsAnalyticsService.getTopEarningHours(req.user.id, Number(limit));

      res.json(topHours);
    } catch (error: any) {
      console.error("Error getting best hours:", error);
      res.status(500).json({ error: error.message || "Failed to get best hours" });
    }
  });

  // Get performance summary
  app.get("/api/driver/analytics/performance/summary", isAuthenticated, async (req: any, res) => {
    try {
      if (req.user.role !== 'driver') {
        return res.status(403).json({ error: "Only drivers can access performance analytics" });
      }

      const { period = 'week' } = req.query;
      const { performanceTrackingService } = await import('./services/performanceTracking');

      // Calculate date range
      const endDate = new Date().toISOString().split('T')[0];
      let startDate: string;
      switch (period) {
        case 'week':
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          startDate = weekAgo.toISOString().split('T')[0];
          break;
        case 'month':
          const monthAgo = new Date();
          monthAgo.setMonth(monthAgo.getMonth() - 1);
          startDate = monthAgo.toISOString().split('T')[0];
          break;
        default:
          startDate = endDate;
      }

      const summary = await performanceTrackingService.getPerformanceSummary(
        req.user.id,
        startDate,
        endDate
      );

      res.json(summary);
    } catch (error: any) {
      console.error("Error getting performance summary:", error);
      res.status(500).json({ error: error.message || "Failed to get performance summary" });
    }
  });

  // Get performance trends
  app.get("/api/driver/analytics/performance/trends", isAuthenticated, async (req: any, res) => {
    try {
      if (req.user.role !== 'driver') {
        return res.status(403).json({ error: "Only drivers can access performance analytics" });
      }

      const { period = 'week' } = req.query;
      const { performanceTrackingService } = await import('./services/performanceTracking');

      const trends = await performanceTrackingService.getPerformanceTrend(
        req.user.id,
        period as 'week' | 'month' | 'year'
      );

      res.json(trends);
    } catch (error: any) {
      console.error("Error getting performance trends:", error);
      res.status(500).json({ error: error.message || "Failed to get performance trends" });
    }
  });

  // Get delivery heat map
  app.get("/api/driver/analytics/heatmap/deliveries", isAuthenticated, async (req: any, res) => {
    try {
      if (req.user.role !== 'driver') {
        return res.status(403).json({ error: "Only drivers can access heat maps" });
      }

      const { north, south, east, west, date, hour } = req.query;
      const { heatMapAggregationService } = await import('./services/heatMapAggregation');

      if (!north || !south || !east || !west) {
        return res.status(400).json({ error: "Bounds (north, south, east, west) required" });
      }

      const bounds = {
        north: parseFloat(north as string),
        south: parseFloat(south as string),
        east: parseFloat(east as string),
        west: parseFloat(west as string),
      };

      const heatMap = await heatMapAggregationService.getDeliveryHeatMap(
        bounds,
        date as string | undefined,
        hour ? Number(hour) : undefined
      );

      res.json(heatMap);
    } catch (error: any) {
      console.error("Error getting delivery heat map:", error);
      res.status(500).json({ error: error.message || "Failed to get delivery heat map" });
    }
  });

  // Get earnings heat map
  app.get("/api/driver/analytics/heatmap/earnings", isAuthenticated, async (req: any, res) => {
    try {
      if (req.user.role !== 'driver') {
        return res.status(403).json({ error: "Only drivers can access heat maps" });
      }

      const { north, south, east, west, date, hour } = req.query;
      const { heatMapAggregationService } = await import('./services/heatMapAggregation');

      if (!north || !south || !east || !west) {
        return res.status(400).json({ error: "Bounds (north, south, east, west) required" });
      }

      const bounds = {
        north: parseFloat(north as string),
        south: parseFloat(south as string),
        east: parseFloat(east as string),
        west: parseFloat(west as string),
      };

      const heatMap = await heatMapAggregationService.getEarningsHeatMap(
        bounds,
        date as string | undefined,
        hour ? Number(hour) : undefined
      );

      res.json(heatMap);
    } catch (error: any) {
      console.error("Error getting earnings heat map:", error);
      res.status(500).json({ error: error.message || "Failed to get earnings heat map" });
    }
  });

  // Get demand prediction heat map
  app.get("/api/driver/analytics/heatmap/demand", isAuthenticated, async (req: any, res) => {
    try {
      if (req.user.role !== 'driver') {
        return res.status(403).json({ error: "Only drivers can access heat maps" });
      }

      const { north, south, east, west, hour } = req.query;
      const { heatMapAggregationService } = await import('./services/heatMapAggregation');

      if (!north || !south || !east || !west) {
        return res.status(400).json({ error: "Bounds (north, south, east, west) required" });
      }

      const bounds = {
        north: parseFloat(north as string),
        south: parseFloat(south as string),
        east: parseFloat(east as string),
        west: parseFloat(west as string),
      };

      const targetHour = hour ? Number(hour) : new Date().getHours();
      const heatMap = await heatMapAggregationService.getDemandPredictionHeatMap(bounds, targetHour);

      res.json(heatMap);
    } catch (error: any) {
      console.error("Error getting demand prediction:", error);
      res.status(500).json({ error: error.message || "Failed to get demand prediction" });
    }
  });

  // Get hotspots
  app.get("/api/driver/analytics/hotspots", isAuthenticated, async (req: any, res) => {
    try {
      if (req.user.role !== 'driver') {
        return res.status(403).json({ error: "Only drivers can access hotspots" });
      }

      const { north, south, east, west, threshold = 70 } = req.query;
      const { heatMapAggregationService } = await import('./services/heatMapAggregation');

      if (!north || !south || !east || !west) {
        return res.status(400).json({ error: "Bounds (north, south, east, west) required" });
      }

      const bounds = {
        north: parseFloat(north as string),
        south: parseFloat(south as string),
        east: parseFloat(east as string),
        west: parseFloat(west as string),
      };

      const hotspots = await heatMapAggregationService.calculateHotspots(bounds, Number(threshold));

      res.json(hotspots);
    } catch (error: any) {
      console.error("Error getting hotspots:", error);
      res.status(500).json({ error: error.message || "Failed to get hotspots" });
    }
  });

  // Get driver goals
  app.get("/api/driver/goals", isAuthenticated, async (req: any, res) => {
    try {
      if (req.user.role !== 'driver') {
        return res.status(403).json({ error: "Only drivers can access goals" });
      }

      const goals = await storage.getDriverGoals(req.user.id);
      res.json(goals);
    } catch (error: any) {
      console.error("Error getting driver goals:", error);
      res.status(500).json({ error: error.message || "Failed to get driver goals" });
    }
  });

  // Create driver goal
  app.post("/api/driver/goals", isAuthenticated, async (req: any, res) => {
    try {
      if (req.user.role !== 'driver') {
        return res.status(403).json({ error: "Only drivers can create goals" });
      }

      const { goalType, targetValue, startDate, endDate } = req.body;

      if (!goalType || !targetValue || !startDate || !endDate) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const goal = await storage.createDriverGoal({
        driverId: req.user.id,
        goalType,
        targetValue: targetValue.toString(),
        currentValue: '0',
        startDate,
        endDate,
        status: 'in_progress',
      });

      res.json(goal);
    } catch (error: any) {
      console.error("Error creating goal:", error);
      res.status(500).json({ error: error.message || "Failed to create goal" });
    }
  });

  // Update driver goal
  app.put("/api/driver/goals/:goalId", isAuthenticated, async (req: any, res) => {
    try {
      if (req.user.role !== 'driver') {
        return res.status(403).json({ error: "Only drivers can update goals" });
      }

      const { goalId } = req.params;
      const updates = req.body;

      const goal = await storage.updateDriverGoal(goalId, req.user.id, updates);
      res.json(goal);
    } catch (error: any) {
      console.error("Error updating goal:", error);
      res.status(500).json({ error: error.message || "Failed to update goal" });
    }
  });

  // Delete driver goal
  app.delete("/api/driver/goals/:goalId", isAuthenticated, async (req: any, res) => {
    try {
      if (req.user.role !== 'driver') {
        return res.status(403).json({ error: "Only drivers can delete goals" });
      }

      const { goalId } = req.params;

      await storage.deleteDriverGoal(goalId, req.user.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting goal:", error);
      res.status(500).json({ error: error.message || "Failed to delete goal" });
    }
  });

  // Get available delivery zones for a restaurant (public endpoint for storefront)
  app.get('/api/storefront/delivery-zones/:restaurantId', async (req: any, res) => {
    try {
      const { restaurantId } = req.params;

      // Get all active delivery zones for the restaurant
      const zones = await storage.getDeliveryZones(restaurantId);
      const activeZones = zones.filter(z => z.isActive);

      // Return only the fields needed for the storefront dropdowns
      const publicZones = activeZones.map(z => ({
        id: z.id,
        country: z.country,
        city: z.city,
        neighborhood: z.neighborhood,
      }));

      res.json(publicZones);
    } catch (error) {
      console.error("Error fetching delivery zones for storefront:", error);
      res.status(500).json({ message: "Failed to fetch delivery zones" });
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

      // Get available orders filtered by driver's service zones
      const availableOrders = await storage.getAvailableDeliveryOrders(driver.id);

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

        // PHASE 6: Record prep time when order is picked up (ready_for_pickup → picked_up)
        try {
          const { prepTimePredictionService } = await import('./services/prepTimePrediction');
          await prepTimePredictionService.recordActualPrepTime(orderId, now);
        } catch (error) {
          logError('Error recording prep time (non-critical)', error);
        }
      } else if (status === 'delivered') {
        await storage.updateOrder(orderId, { 
          status: 'delivered',
          deliveryTime: now,
        });

        // PHASE 5: Update analytics after delivery completion
        try {
          const order = await storage.getOrder(orderId);
          if (order && order.driverId) {
            const { earningsAnalyticsService } = await import('./services/earningsAnalytics');
            const { heatMapAggregationService } = await import('./services/heatMapAggregation');
            const { performanceTrackingService } = await import('./services/performanceTracking');

            // Update time slot earnings
            const deliveryDate = new Date();
            const earnings = parseFloat(order.deliveryFee || '0');
            const durationMinutes = order.pickedUpAt && order.deliveredAt 
              ? (new Date(order.deliveredAt).getTime() - new Date(order.pickedUpAt).getTime()) / 60000 
              : 30; // Default 30 min if missing

            await earningsAnalyticsService.updateTimeSlotEarnings(
              order.driverId,
              deliveryDate,
              earnings,
              durationMinutes
            );

            // Update heat map data
            if (order.deliveryLat && order.deliveryLng) {
              await heatMapAggregationService.updateHeatMapData({
                lat: parseFloat(order.deliveryLat),
                lng: parseFloat(order.deliveryLng),
                earnings,
                deliveryTimeMinutes: Math.round(durationMinutes),
                timestamp: deliveryDate,
              });
            }

            // Aggregate daily earnings (check if it's a new day)
            const today = deliveryDate.toISOString().split('T')[0];
            await earningsAnalyticsService.aggregateDailyEarnings(order.driverId, today);

            // Calculate daily performance
            await performanceTrackingService.calculateDailyPerformance(order.driverId, today);

            console.log(`Analytics updated for order ${orderId}`);
          }
        } catch (error) {
          console.error('Error updating analytics:', error);
          // Don't fail the delivery if analytics fail
        }
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
        acceptanceRate: 100, // Placeholder - would need tracking
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

      // Get delivery history for analytics
      const orders = await storage.getDriverOrders(driver.id);
      const completedOrders = orders.filter(o => o.status === 'completed' || o.status === 'delivered');
      
      // Calculate daily breakdown (last 7 days)
      const dailyBreakdown: Array<{ date: string; earnings: string; deliveries: number }> = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        const nextDay = new Date(date);
        nextDay.setDate(nextDay.getDate() + 1);
        
        const dayOrders = completedOrders.filter(o => {
          const orderDate = new Date(o.deliveryTime || o.updatedAt || o.createdAt);
          return orderDate >= date && orderDate < nextDay;
        });
        
        const dayEarnings = dayOrders.reduce((sum, o) => {
          const deliveryFee = parseFloat(o.deliveryFee || '0');
          return sum + (deliveryFee * 0.8);
        }, 0);
        
        dailyBreakdown.push({
          date: date.toISOString(),
          earnings: dayEarnings.toFixed(2),
          deliveries: dayOrders.length,
        });
      }

      // Calculate weekly breakdown (last 4 weeks)
      const weeklyBreakdown: Array<{ week: string; earnings: string; deliveries: number }> = [];
      for (let i = 3; i >= 0; i--) {
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - (i * 7 + 7));
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);
        
        const weekOrders = completedOrders.filter(o => {
          const orderDate = new Date(o.deliveryTime || o.updatedAt || o.createdAt);
          return orderDate >= weekStart && orderDate < weekEnd;
        });
        
        const weekEarnings = weekOrders.reduce((sum, o) => {
          const deliveryFee = parseFloat(o.deliveryFee || '0');
          return sum + (deliveryFee * 0.8);
        }, 0);
        
        weeklyBreakdown.push({
          week: `Week ${4 - i}`,
          earnings: weekEarnings.toFixed(2),
          deliveries: weekOrders.length,
        });
      }

      // Calculate performance metrics
      const totalDeliveries = completedOrders.length;
      const totalEarnings = completedOrders.reduce((sum, o) => {
        const deliveryFee = parseFloat(o.deliveryFee || '0');
        return sum + (deliveryFee * 0.8);
      }, 0);
      
      const avgEarningsPerDelivery = totalDeliveries > 0 ? totalEarnings / totalDeliveries : 0;
      
      // Estimate hours worked (assuming 30 min per delivery average)
      const totalHours = totalDeliveries * 0.5;
      const avgEarningsPerHour = totalHours > 0 ? totalEarnings / totalHours : 0;
      
      // Find best day
      const bestDayData = dailyBreakdown.reduce((best, day) => {
        return parseFloat(day.earnings) > parseFloat(best.earnings) ? day : best;
      }, dailyBreakdown[0] || { date: '', earnings: '0', deliveries: 0 });
      
      const bestDayDate = bestDayData.date ? new Date(bestDayData.date) : null;
      const bestDay = bestDayDate ? bestDayDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }) : 'N/A';

      res.json({
        ...earnings,
        dailyBreakdown,
        weeklyBreakdown,
        performance: {
          avgEarningsPerDelivery: avgEarningsPerDelivery.toFixed(2),
          avgEarningsPerHour: avgEarningsPerHour.toFixed(2),
          totalDeliveries,
          totalHours: Math.round(totalHours),
          bestDay,
          bestDayEarnings: bestDayData.earnings,
        },
      });
    } catch (error) {
      console.error("Error fetching driver earnings:", error);
      res.status(500).json({ message: "Failed to fetch driver earnings" });
    }
  });

  // Get driver delivery history
  app.get('/api/driver/history', isAuthenticated, async (req: any, res) => {
    try {
      if (req.user.role !== 'driver') {
        return res.status(403).json({ message: "Only drivers can access this endpoint" });
      }

      const driver = await storage.getDriverByUserId(req.user.id);
      if (!driver) {
        return res.status(404).json({ message: "Driver profile not found" });
      }

      const orders = await storage.getDriverOrders(driver.id);
      const completedOrders = orders
        .filter(o => o.status === 'completed' || o.status === 'delivered')
        .map(async (order) => {
          const restaurant = await storage.getRestaurant(order.restaurantId);
          return {
            id: order.id,
            orderNumber: order.orderNumber,
            total: order.total,
            deliveryAddress: order.deliveryAddress,
            driverShare: (parseFloat(order.deliveryFee || '0') * 0.8).toFixed(2),
            status: order.status,
            deliveryTime: order.deliveryTime || order.updatedAt || order.createdAt,
            restaurant: {
              id: restaurant?.id || '',
              name: restaurant?.name || 'Unknown',
            },
          };
        });

      const history = await Promise.all(completedOrders);
      res.json(history.sort((a, b) => new Date(b.deliveryTime).getTime() - new Date(a.deliveryTime).getTime()));
    } catch (error) {
      console.error("Error fetching driver history:", error);
      res.status(500).json({ message: "Failed to fetch driver history" });
    }
  });

  // Upload delivery proof
  app.post('/api/driver/orders/:orderId/proof', isAuthenticated, async (req: any, res) => {
    try {
      if (req.user.role !== 'driver') {
        return res.status(403).json({ message: "Only drivers can upload delivery proof" });
      }

      const { orderId } = req.params;
      const { photoUrl, signature, notes } = req.body;

      const driver = await storage.getDriverByUserId(req.user.id);
      if (!driver) {
        return res.status(404).json({ message: "Driver profile not found" });
      }

      const orderData = await storage.getOrderWithItems(orderId);
      if (!orderData) {
        return res.status(404).json({ message: "Order not found" });
      }

      if (orderData.order.assignedDriverId !== driver.id) {
        return res.status(403).json({ message: "You are not assigned to this order" });
      }

      // Update driver delivery status with proof
      const deliveryStatus = await storage.getDriverDeliveryStatus(orderId);
      if (deliveryStatus) {
        await storage.updateDriverDeliveryStatus(orderId, {
          deliveryProofUrl: photoUrl,
          customerSignature: signature,
          deliveryNotes: notes,
        });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error uploading delivery proof:", error);
      res.status(500).json({ message: "Failed to upload delivery proof" });
    }
  });

  // Send SMS message
  app.post('/api/driver/send-message', isAuthenticated, async (req: any, res) => {
    try {
      if (req.user.role !== 'driver') {
        return res.status(403).json({ message: "Only drivers can send messages" });
      }

      const { phone, message, type } = req.body;

      if (!phone || !message) {
        return res.status(400).json({ message: "Phone and message are required" });
      }

      // In production, integrate with SMS service like Twilio
      // For now, we'll just log it and return success
      console.log(`[SMS] Sending message to ${phone} (${type}): ${message}`);
      
      // TODO: Integrate with Twilio or similar SMS service
      // const twilio = require('twilio');
      // const client = twilio(accountSid, authToken);
      // await client.messages.create({
      //   body: message,
      //   to: phone,
      //   from: process.env.TWILIO_PHONE_NUMBER,
      // });

      res.json({ success: true, message: "Message sent successfully" });
    } catch (error) {
      console.error("Error sending message:", error);
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  // Update driver availability schedule
  app.put('/api/driver/schedule', isAuthenticated, async (req: any, res) => {
    try {
      if (req.user.role !== 'driver') {
        return res.status(403).json({ message: "Only drivers can update schedule" });
      }

      const { schedule } = req.body;
      const driver = await storage.getDriverByUserId(req.user.id);
      if (!driver) {
        return res.status(404).json({ message: "Driver profile not found" });
      }

      // Store schedule in user preferences or driver profile
      // For now, we'll store it in a JSON field
      await storage.updateDriverProfile(driver.id, {
        availabilitySchedule: JSON.stringify(schedule),
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error updating schedule:", error);
      res.status(500).json({ message: "Failed to update schedule" });
    }
  });

  // Get zone performance analytics
  app.get('/api/driver/zone-analytics', isAuthenticated, async (req: any, res) => {
    try {
      if (req.user.role !== 'driver') {
        return res.status(403).json({ message: "Only drivers can access zone analytics" });
      }

      const driver = await storage.getDriverByUserId(req.user.id);
      if (!driver) {
        return res.status(404).json({ message: "Driver profile not found" });
      }

      const orders = await storage.getDriverOrders(driver.id);
      const completedOrders = orders.filter(o => o.status === 'completed' || o.status === 'delivered');

      // Group by delivery zone
      const zoneStats: Record<string, any> = {};
      
      for (const order of completedOrders) {
        const zoneId = order.deliveryZoneId;
        if (!zoneId) continue;

        if (!zoneStats[zoneId]) {
          const zone = await storage.getDeliveryZone(zoneId);
          zoneStats[zoneId] = {
            zoneId,
            zoneName: zone ? `${zone.city}${zone.neighborhood ? ` - ${zone.neighborhood}` : ''}` : zoneId,
            totalEarnings: 0,
            totalDeliveries: 0,
            successRate: 100,
          };
        }

        const deliveryFee = parseFloat(order.deliveryFee || '0');
        zoneStats[zoneId].totalEarnings += deliveryFee * 0.8;
        zoneStats[zoneId].totalDeliveries += 1;
      }

      const analytics = Object.values(zoneStats).sort((a: any, b: any) => 
        Number(b.totalEarnings) - Number(a.totalEarnings)
      );

      res.json(analytics);
    } catch (error) {
      console.error("Error fetching zone analytics:", error);
      res.status(500).json({ message: "Failed to fetch zone analytics" });
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

  // Public marketplace routes (no auth required)
  // Marketplace API for customer-facing restaurant discovery and ordering
  app.use('/api/marketplace', storefrontLimiter, marketplaceRouter);
  
  // Public storefront routes (no auth required)
  
  // Apply rate limiting to all storefront routes
  app.use('/api/storefront', storefrontLimiter);

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
      
      // Find matching delivery zone for delivery orders
      let deliveryZoneId: string | null = null;
      if (data.orderType === 'delivery') {
        const matchingZone = await storage.findMatchingDeliveryZone(
          restaurant.id,
          data.deliveryCity || null,
          data.deliveryAddress || null
        );
        deliveryZoneId = matchingZone?.id || null;
      }
      
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
        deliveryZoneId,
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

      // PHASE 6: Make prep time prediction when order is created
      try {
        const { prepTimePredictionService } = await import('./services/prepTimePrediction');
        const prediction = await prepTimePredictionService.predictPrepTime(restaurant.id, {
          itemCount: data.items.length,
          orderValue: data.total,
          hasSpecialInstructions: data.items.some((item: any) => item.selectedOptions),
        });
        await prepTimePredictionService.savePrediction(order.id, restaurant.id, prediction, {
          itemCount: data.items.length,
          orderValue: data.total,
        });
        logInfo(`Prep time prediction for order ${order.id}: ${prediction.predictedMinutes} min (${prediction.confidence}% confidence)`);
      } catch (error) {
        logError('Error making prep time prediction (non-critical)', error);
      }
      
      // Increment bundle sales count for any bundles in the order
      for (const item of data.items) {
        if (item.bundleId) {
          await storage.incrementBundleSales(item.bundleId, item.quantity);
        }
      }
      
      if (data.paymentMethod === 'cash') {
        // Cash on delivery - mark order as confirmed, payment will be collected on delivery
        const confirmedOrder = await storage.confirmOrderWithPayment(
          order.id,
          'cash',
          `cash-${order.orderNumber}`,
          parseFloat(data.total),
          parseFloat(data.deliveryFee || '0')
        );
        
        // Broadcast to restaurant
        wsManager.broadcastToRestaurant(restaurant.id, {
          type: 'new_order',
          data: confirmedOrder
        });
        
        // ONLY broadcast to drivers if this is a delivery order and has a zone
        if (confirmedOrder.orderType === 'delivery' && confirmedOrder.deliveryZoneId) {
          wsManager.broadcastToDriversInZone(confirmedOrder.deliveryZoneId, {
            type: 'new_delivery_order',
            data: {
              orderId: confirmedOrder.id,
              orderNumber: confirmedOrder.orderNumber,
              restaurantId: restaurant.id,
              restaurantName: restaurant.name,
              deliveryAddress: confirmedOrder.deliveryAddress,
              customerName: confirmedOrder.customerName,
              customerPhone: confirmedOrder.customerPhone,
              deliveryFee: confirmedOrder.deliveryFee,
              total: confirmedOrder.total,
              estimatedEarnings: (parseFloat(confirmedOrder.deliveryFee || '0') * 0.8).toFixed(2),
            }
          });
        }
        
        res.json({ orderId: order.id, paymentMethod: 'cash', success: true });
      } else if (data.paymentMethod === 'paypal') {
        // PayPal payment - require PayPal to be configured
        if (!paypalClient) {
          logError('PayPal payment requested but PayPal is not configured');
          return res.status(503).json({ 
            message: "PayPal payments are not available. Please contact the restaurant or use another payment method." 
          });
        }
        
        logInfo('PayPal payment flow initiated', { orderId: order.id });
        res.json({ orderId: order.id, paymentMethod: 'paypal' });
      } else if (data.paymentMethod === 'apple' || data.paymentMethod === 'google' || data.paymentMethod === 'stripe') {
        // Apple Pay, Google Pay, or Stripe payment - all use Stripe
        if (!stripe) {
          logError(`${data.paymentMethod} payment requested but Stripe is not configured`);
          return res.status(503).json({ 
            message: "Online payments are not available. Please contact the restaurant or use cash on delivery." 
          });
        }
        
        logWarn(`${data.paymentMethod} payment flow not fully implemented`, { orderId: order.id });
        // TODO: Create Stripe checkout session or PaymentIntent
        res.json({ 
          orderId: order.id, 
          paymentMethod: data.paymentMethod,
          checkoutUrl: null,
          message: 'Payment processing not yet implemented. Please use cash on delivery.' 
        });
      } else {
        // Unknown payment method
        logWarn('Unknown payment method requested', { 
          paymentMethod: data.paymentMethod, 
          orderId: order.id 
        });
        res.status(400).json({ 
          message: `Payment method '${data.paymentMethod}' is not supported. Please use cash, stripe, or paypal.` 
        });
      }
    } catch (error) {
      logError("Error creating online order", error);
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
      const r2Object = await objectStorageService.getObjectEntityFile(req.path);
      const canAccess = await objectStorageService.canAccessObjectEntity({
        r2Object,
        userId: userId,
      });
      if (!canAccess) {
        logWarn('Object access denied', { 
          path: req.path, 
          userId: userId || 'anonymous',
          key: r2Object.key 
        });
        return res.sendStatus(401);
      }
      objectStorageService.downloadObject(r2Object, res);
    } catch (error) {
      logError("Error accessing object", error, { path: req.path, userId });
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  app.post("/api/objects/upload", isAuthenticated, uploadLimiter, async (req, res) => {
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

  app.put("/api/restaurant/brand-colors", isAuthenticated, async (req: any, res) => {
    const userId = req.user.id;
    const { primaryColor, secondaryColor, accentColor } = req.body;

    // Validate hex color format
    const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;
    
    if (primaryColor && !hexColorRegex.test(primaryColor)) {
      return res.status(400).json({ error: "Invalid primary color format. Must be a hex color (e.g., #ff0000)" });
    }
    if (secondaryColor && !hexColorRegex.test(secondaryColor)) {
      return res.status(400).json({ error: "Invalid secondary color format. Must be a hex color (e.g., #ff0000)" });
    }
    if (accentColor && !hexColorRegex.test(accentColor)) {
      return res.status(400).json({ error: "Invalid accent color format. Must be a hex color (e.g., #ff0000)" });
    }

    try {
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }

      await storage.updateRestaurant(restaurant.id, {
        primaryColor,
        secondaryColor,
        accentColor
      });
      res.status(200).json({ success: true });
    } catch (error) {
      console.error("Error updating brand colors:", error);
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
      logError("Error updating payment methods", error);
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
          url: restaurant.customDomain ? `https://${restaurant.customDomain}` : `${getBaseUrl()}`,
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
        logError("Stripe not configured for connect onboarding");
        return res.status(503).json({ error: "Stripe is not configured" });
      }

      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }

      let stripeAccountId = restaurant.stripeAccountId;

      // Create Stripe account if doesn't exist
      if (!stripeAccountId) {
        logInfo("Creating new Stripe Connect account", { restaurantId: restaurant.id });
        
        const account = await stripe.accounts.create({
          type: 'express',
          country: restaurant.country === 'United States' ? 'US' : 'US', // Default to US
          email: restaurant.email || req.user.email,
          capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
          },
          business_type: 'individual',
          business_profile: {
            name: restaurant.name,
            url: restaurant.customDomain ? `https://${restaurant.customDomain}` : `${getBaseUrl()}`,
          },
        });

        stripeAccountId = account.id;

        // Save to database
        await storage.updateRestaurant(restaurant.id, {
          stripeAccountId: stripeAccountId,
        });

        logInfo("Stripe Connect account created", { 
          restaurantId: restaurant.id, 
          stripeAccountId 
        });
      }

      const baseUrl = getBaseUrl();

      const accountLink = await stripe.accountLinks.create({
        account: stripeAccountId,
        refresh_url: `${baseUrl}/settings?connect=refresh`,
        return_url: `${baseUrl}/settings?connect=success`,
        type: 'account_onboarding',
      });

      logInfo("Stripe onboarding link generated", { 
        restaurantId: restaurant.id,
        stripeAccountId 
      });

      res.json({
        url: accountLink.url,
      });
    } catch (error: any) {
      logError("Error creating onboarding link", error, { userId });
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
        const confirmedOrder = await storage.confirmOrderWithPayment(
          orderId,
          'paypal',
          captureId,
          parseFloat(totalAmount) || 0,
          parseFloat(deliveryFee) || 0
        );
        
        // Broadcast to restaurant
        const restaurant = await storage.getRestaurant(confirmedOrder.restaurantId);
        if (restaurant) {
          wsManager.broadcastToRestaurant(restaurant.id, {
            type: 'new_order',
            data: confirmedOrder
          });
          
          // ONLY broadcast to drivers if this is a delivery order and has a zone
          if (confirmedOrder.orderType === 'delivery' && confirmedOrder.deliveryZoneId) {
            wsManager.broadcastToDriversInZone(confirmedOrder.deliveryZoneId, {
              type: 'new_delivery_order',
              data: {
                orderId: confirmedOrder.id,
                orderNumber: confirmedOrder.orderNumber,
                restaurantId: restaurant.id,
                restaurantName: restaurant.name,
                deliveryAddress: confirmedOrder.deliveryAddress,
                customerName: confirmedOrder.customerName,
                customerPhone: confirmedOrder.customerPhone,
                deliveryFee: confirmedOrder.deliveryFee,
                total: confirmedOrder.total,
                estimatedEarnings: (parseFloat(confirmedOrder.deliveryFee || '0') * 0.8).toFixed(2),
              }
            });
          }
        }
        
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

  // Admin: Get all orders across all restaurants
  app.get('/api/admin/orders', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const allOrders = await storage.getAllOrders();
      res.json(allOrders);
    } catch (error) {
      console.error("Error fetching all orders:", error);
      res.status(500).json({ message: "Failed to fetch all orders" });
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
      
      // WebSocket broadcast to all admins and the driver
      wsManager.broadcastToAdmins({
        type: 'driver_application_updated',
        data: {
          driverId: id,
          driverName: `${updated.firstName || ''} ${updated.lastName || ''}`.trim() || updated.email,
          action: 'approved',
          status: 'approved',
        },
      });
      
      // Notify the specific driver that they're approved
      wsManager.broadcastToUser(id, {
        type: 'application_status_changed',
        data: {
          status: 'approved',
          message: 'Your driver application has been approved! You can now start accepting deliveries.',
        },
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
      
      // Log the action
      await logAdminActivity({
        userId: req.user.id,
        userEmail: req.user.email,
        actionType: 'driver_rejected',
        actionCategory: 'driver',
        description: `Rejected driver application for ${updated.email}: ${reason || 'No reason provided'}`,
        targetId: id,
        targetType: 'user',
        targetName: `${updated.firstName || ''} ${updated.lastName || ''}`.trim() || updated.email,
        metadata: { driverId: id, driverEmail: updated.email, reason: reason || 'No reason provided' },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
      
      // WebSocket broadcast to all admins
      wsManager.broadcastToAdmins({
        type: 'driver_application_updated',
        data: {
          driverId: id,
          driverName: `${updated.firstName || ''} ${updated.lastName || ''}`.trim() || updated.email,
          action: 'rejected',
          status: 'rejected',
        },
      });
      
      res.json(updated);
    } catch (error) {
      console.error("Error rejecting driver:", error);
      res.status(500).json({ message: "Failed to reject driver" });
    }
  });

  // Admin: Update driver information
  app.patch('/api/admin/drivers/:id', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      // Get driver info to verify it's a driver
      const driver = await storage.getUser(id);
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }
      
      if (driver.role !== 'driver') {
        return res.status(400).json({ message: "User is not a driver" });
      }
      
      // Update allowed fields only
      const allowedFields = [
        'firstName', 'lastName', 'email', 'phone', 'dateOfBirth',
        'address', 'city', 'country', 'postalCode',
        'emergencyContactName', 'emergencyContactPhone',
        'vehicleType', 'vehicleMake', 'vehicleModel', 'vehicleYear',
        'vehicleColor', 'vehiclePlate',
        'licenseNumber', 'licenseExpiry',
        'applicationStatus', 'profileComplete'
      ];
      
      const filteredData: any = {};
      for (const field of allowedFields) {
        if (updateData[field] !== undefined) {
          filteredData[field] = updateData[field];
        }
      }
      
      // Validate: Cannot approve without complete profile
      const finalProfileComplete = filteredData.profileComplete !== undefined 
        ? filteredData.profileComplete 
        : driver.profileComplete;
      
      const finalStatus = filteredData.applicationStatus !== undefined
        ? filteredData.applicationStatus
        : driver.applicationStatus;
      
      // Prevent approving incomplete profiles
      if (filteredData.applicationStatus === 'approved' && !finalProfileComplete) {
        return res.status(400).json({ 
          message: "Cannot approve driver with incomplete profile. Please mark profile as complete first." 
        });
      }
      
      // Prevent marking approved drivers as incomplete
      if (finalStatus === 'approved' && filteredData.profileComplete === false) {
        return res.status(400).json({
          message: "Cannot mark an approved driver as incomplete. Please change status first."
        });
      }
      
      // If status is being changed to approved, update approval fields
      if (filteredData.applicationStatus === 'approved' && driver.applicationStatus !== 'approved') {
        filteredData.adminApproved = true;
        filteredData.adminApprovedAt = new Date();
        filteredData.approvedBy = req.user.id;
        filteredData.rejectionReason = null;
      }
      
      // If status is being changed to rejected, update rejection fields
      if (filteredData.applicationStatus === 'rejected' && driver.applicationStatus !== 'rejected') {
        filteredData.adminApproved = false;
        filteredData.adminApprovedAt = new Date();
        filteredData.approvedBy = req.user.id;
      }
      
      // If status is being changed to pending, clear approval/rejection fields
      if (filteredData.applicationStatus === 'pending' && driver.applicationStatus !== 'pending') {
        filteredData.adminApproved = false;
        filteredData.adminApprovedAt = null;
        filteredData.approvedBy = null;
        filteredData.rejectionReason = null;
      }
      
      // Update the driver
      const updated = await storage.updateUser(id, filteredData);
      
      // Log the action
      await logAdminActivity({
        userId: req.user.id,
        userEmail: req.user.email,
        actionType: 'driver_updated',
        actionCategory: 'driver',
        description: `Updated driver information for ${updated.email}`,
        targetId: id,
        targetType: 'user',
        targetName: `${updated.firstName || ''} ${updated.lastName || ''}`.trim() || updated.email,
        metadata: { driverId: id, driverEmail: updated.email, updatedFields: Object.keys(filteredData) },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
      
      // WebSocket broadcast to all admins
      wsManager.broadcastToAdmins({
        type: 'driver_application_updated',
        data: {
          driverId: id,
          driverName: `${updated.firstName || ''} ${updated.lastName || ''}`.trim() || updated.email,
          action: 'updated',
          status: updated.applicationStatus,
        },
      });
      
      // If status changed to approved, notify the driver
      if (filteredData.applicationStatus === 'approved' && driver.applicationStatus !== 'approved') {
        wsManager.broadcastToUser(id, {
          type: 'application_status_changed',
          data: {
            status: 'approved',
            message: 'Your driver application has been approved! You can now start accepting deliveries.',
          },
        });
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating driver:", error);
      res.status(500).json({ message: "Failed to update driver" });
    }
  });

  // Admin: Delete driver application
  app.delete('/api/admin/drivers/:id', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      
      // Get driver info before deletion for logging
      const driver = await storage.getUser(id);
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }
      
      if (driver.role !== 'driver') {
        return res.status(400).json({ message: "User is not a driver" });
      }
      
      // Delete the driver account
      await storage.deleteUser(id);
      
      // Log the action
      await logAdminActivity({
        userId: req.user.id,
        userEmail: req.user.email,
        actionType: 'driver_deleted',
        actionCategory: 'driver',
        description: `Deleted driver application for ${driver.email}`,
        targetId: id,
        targetType: 'user',
        targetName: `${driver.firstName || ''} ${driver.lastName || ''}`.trim() || driver.email,
        metadata: { driverId: id, driverEmail: driver.email },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
      
      // WebSocket broadcast to all admins
      wsManager.broadcastToAdmins({
        type: 'driver_application_deleted',
        data: {
          driverId: id,
          driverName: `${driver.firstName || ''} ${driver.lastName || ''}`.trim() || driver.email,
        },
      });
      
      res.json({ message: "Driver application deleted successfully" });
    } catch (error) {
      console.error("Error deleting driver:", error);
      res.status(500).json({ message: "Failed to delete driver" });
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

  // Update restaurant subdomain
  app.patch('/api/restaurants/:id/subdomain', isAuthenticated, async (req: any, res) => {
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
      
      const { subdomain } = req.body;
      
      // Validate subdomain format (alphanumeric and hyphens only, no spaces)
      if (subdomain && !/^[a-z0-9-]+$/.test(subdomain)) {
        return res.status(400).json({ message: "Subdomain can only contain lowercase letters, numbers, and hyphens" });
      }
      
      // Check if subdomain is already taken (compare against restaurant.id, not id param for security)
      if (subdomain && subdomain !== restaurant.subdomain) {
        const existing = await storage.getRestaurantBySubdomain(subdomain);
        if (existing && existing.id !== restaurant.id) {
          return res.status(400).json({ message: "This subdomain is already taken" });
        }
      }
      
      const updated = await storage.updateRestaurant(id, { 
        subdomain: subdomain || null 
      });
      res.json(updated);
    } catch (error) {
      console.error("Error updating subdomain:", error);
      res.status(500).json({ message: "Failed to update subdomain" });
    }
  });

  // Update restaurant custom domain
  app.patch('/api/restaurants/:id/custom-domain', isAuthenticated, async (req: any, res) => {
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
      
      const { customDomain } = req.body;
      
      // Check if custom domain is already taken (compare against restaurant.id, not id param for security)
      if (customDomain && customDomain !== restaurant.customDomain) {
        const existing = await storage.getRestaurantByCustomDomain(customDomain);
        if (existing && existing.id !== restaurant.id) {
          return res.status(400).json({ message: "This custom domain is already in use" });
        }
      }
      
      const updated = await storage.updateRestaurant(id, { 
        customDomain: customDomain || null 
      });
      res.json(updated);
    } catch (error) {
      console.error("Error updating custom domain:", error);
      res.status(500).json({ message: "Failed to update custom domain" });
    }
  });

  // Verify custom domain DNS configuration
  app.post('/api/restaurants/:id/verify-domain', isAuthenticated, async (req: any, res) => {
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
      
      if (!restaurant.customDomain) {
        return res.status(400).json({ message: "No custom domain configured" });
      }
      
      if (!restaurant.subdomain) {
        return res.status(400).json({ message: "Subdomain must be configured before verifying custom domain" });
      }
      
      // Simple DNS verification: try to resolve the domain
      // In production, you'd use dns.promises.resolveCname() from Node.js
      // For now, we'll return a success response indicating manual verification is needed
      res.json({ 
        verified: false,
        message: "Please configure your DNS CNAME record and allow 24-48 hours for propagation",
        instructions: {
          type: "CNAME",
          host: restaurant.customDomain.replace(/^www\./, ''),
          value: new URL(getBaseUrl()).hostname,
          note: "Point your custom domain to this hostname. If using www subdomain, point it to your apex domain."
        }
      });
    } catch (error) {
      console.error("Error verifying domain:", error);
      res.status(500).json({ message: "Failed to verify domain" });
    }
  });

  // Push Notification Endpoints (Driver)
  
  // Get VAPID public key for push subscription (Driver)
  app.get('/api/push/vapid-public-key', isAuthenticated, (req, res) => {
    // Generate VAPID keys using web-push library
    // For now, return a placeholder - you'll need to generate real VAPID keys
    const publicKey = process.env.VAPID_PUBLIC_KEY || '';
    
    if (!publicKey) {
      return res.status(503).json({ 
        message: 'Push notifications not configured. Set VAPID_PUBLIC_KEY in environment.' 
      });
    }
    
    res.json({ publicKey });
  });

  // Subscribe to push notifications
  app.post('/api/push/subscribe', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const subscription = req.body;
      
      // Store subscription in database
      // For now, we'll just log it - you can add a pushSubscriptions table later
      console.log('[Push] User subscribed:', userId, subscription);
      
      // TODO: Store in database
      // await storage.savePushSubscription(userId, subscription);
      
      res.json({ success: true });
    } catch (error) {
      logError('Error saving push subscription', error);
      res.status(500).json({ message: 'Failed to save subscription' });
    }
  });

  // Unsubscribe from push notifications
  app.post('/api/push/unsubscribe', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      // Remove subscription from database
      console.log('[Push] User unsubscribed:', userId);
      
      // TODO: Remove from database
      // await storage.removePushSubscription(userId);
      
      res.json({ success: true });
    } catch (error) {
      logError('Error removing push subscription', error);
      res.status(500).json({ message: 'Failed to unsubscribe' });
    }
  });

  // Push Notification Endpoints (Restaurant)
  
  // Get VAPID public key for restaurant push subscription
  app.get('/api/restaurant/push/vapid-public-key', isAuthenticated, (req, res) => {
    const publicKey = process.env.VAPID_PUBLIC_KEY || '';
    
    if (!publicKey) {
      return res.status(503).json({ 
        message: 'Push notifications not configured. Set VAPID_PUBLIC_KEY in environment.' 
      });
    }
    
    res.json({ publicKey });
  });

  // Subscribe restaurant to push notifications
  app.post('/api/restaurant/push/subscribe', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const subscription = req.body;
      
      // Get restaurant
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.status(404).json({ message: 'Restaurant not found' });
      }
      
      // Store subscription
      logInfo('[Push] Restaurant subscribed to notifications', { 
        restaurantId: restaurant.id,
        userId 
      });
      
      // TODO: Store in database
      // await storage.saveRestaurantPushSubscription(restaurant.id, subscription);
      
      res.json({ success: true });
    } catch (error) {
      logError('Error saving restaurant push subscription', error);
      res.status(500).json({ message: 'Failed to save subscription' });
    }
  });

  // Unsubscribe restaurant from push notifications
  app.post('/api/restaurant/push/unsubscribe', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.status(404).json({ message: 'Restaurant not found' });
      }
      
      logInfo('[Push] Restaurant unsubscribed from notifications', { 
        restaurantId: restaurant.id 
      });
      
      // TODO: Remove from database
      // await storage.removeRestaurantPushSubscription(restaurant.id);
      
      res.json({ success: true });
    } catch (error) {
      logError('Error removing restaurant push subscription', error);
      res.status(500).json({ message: 'Failed to unsubscribe' });
    }
  });

  // Test endpoint to send push notification to restaurant
  app.post('/api/restaurant/push/test', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      
      if (!restaurant) {
        return res.status(404).json({ message: 'Restaurant not found' });
      }

      // TODO: Get subscription from database and send test notification
      // const subscription = await storage.getRestaurantPushSubscription(restaurant.id);
      // await sendPushNotification(subscription, {
      //   title: '🔔 Test Notification',
      //   body: 'Your restaurant notifications are working!',
      //   icon: '/icons/restaurant-icon-192.png'
      // });

      logInfo('[Push] Test notification sent', { restaurantId: restaurant.id });
      res.json({ success: true, message: 'Test notification sent' });
    } catch (error) {
      logError('Error sending test notification', error);
      res.status(500).json({ message: 'Failed to send test notification' });
    }
  });

  // ==========================================
  // PHASE 6: AI & MACHINE LEARNING ENDPOINTS
  // ==========================================

  // Import Phase 6 services
  const { smartRecommendationsService } = await import('./services/smartRecommendations');
  const { prepTimePredictionService } = await import('./services/prepTimePrediction');
  const { driverBehaviorAnalysisService } = await import('./services/driverBehaviorAnalysis');
  const { trafficAwareETAService } = await import('./services/trafficAwareETA');
  const { surgePricingEngineService } = await import('./services/surgePricingEngine');

  // Get smart recommendations for driver
  app.get('/api/driver/ai/recommendations', isAuthenticated, isDriver, async (req: any, res) => {
    try {
      const driverId = req.user.id;

      // Generate fresh recommendations
      const recommendations = await smartRecommendationsService.generateRecommendations(driverId);

      // Save to database
      if (recommendations.length > 0) {
        await smartRecommendationsService.saveRecommendations(driverId, recommendations);
      }

      // Get all active recommendations
      const activeRecs = await smartRecommendationsService.getActiveRecommendations(driverId);

      res.json(activeRecs);
    } catch (error) {
      logError('Error getting AI recommendations', error);
      res.status(500).json({ message: 'Failed to get recommendations' });
    }
  });

  // Dismiss a recommendation
  app.post('/api/driver/ai/recommendations/:id/dismiss', isAuthenticated, isDriver, async (req: any, res) => {
    try {
      const driverId = req.user.id;
      const recommendationId = req.params.id;

      await smartRecommendationsService.dismissRecommendation(recommendationId, driverId);
      res.json({ success: true });
    } catch (error) {
      logError('Error dismissing recommendation', error);
      res.status(500).json({ message: 'Failed to dismiss recommendation' });
    }
  });

  // Mark recommendation as acted upon
  app.post('/api/driver/ai/recommendations/:id/act', isAuthenticated, isDriver, async (req: any, res) => {
    try {
      const driverId = req.user.id;
      const recommendationId = req.params.id;

      await smartRecommendationsService.actOnRecommendation(recommendationId, driverId);
      res.json({ success: true });
    } catch (error) {
      logError('Error acting on recommendation', error);
      res.status(500).json({ message: 'Failed to mark as acted upon' });
    }
  });

  // Get driver behavior insights
  app.get('/api/driver/ai/insights/behavior', isAuthenticated, isDriver, async (req: any, res) => {
    try {
      const driverId = req.user.id;
      const insights = await driverBehaviorAnalysisService.generateInsights(driverId);
      res.json(insights);
    } catch (error) {
      logError('Error getting behavior insights', error);
      res.status(500).json({ message: 'Failed to get insights' });
    }
  });

  // Get driver speed score
  app.get('/api/driver/ai/insights/speed-score', isAuthenticated, isDriver, async (req: any, res) => {
    try {
      const driverId = req.user.id;
      const period = (req.query.period as 'day' | 'week' | 'month') || 'week';
      const speedData = await driverBehaviorAnalysisService.analyzeDriverSpeed(driverId, period);
      res.json(speedData);
    } catch (error) {
      logError('Error getting speed score', error);
      res.status(500).json({ message: 'Failed to get speed score' });
    }
  });

  // Get driver zone mastery
  app.get('/api/driver/ai/insights/zone-mastery', isAuthenticated, isDriver, async (req: any, res) => {
    try {
      const driverId = req.user.id;
      const zones = await driverBehaviorAnalysisService.calculateZoneMastery(driverId);
      res.json(zones);
    } catch (error) {
      logError('Error getting zone mastery', error);
      res.status(500).json({ message: 'Failed to get zone mastery' });
    }
  });

  // Get driver best performance times
  app.get('/api/driver/ai/insights/best-times', isAuthenticated, isDriver, async (req: any, res) => {
    try {
      const driverId = req.user.id;
      const times = await driverBehaviorAnalysisService.findBestPerformanceTimes(driverId);
      res.json(times);
    } catch (error) {
      logError('Error getting best times', error);
      res.status(500).json({ message: 'Failed to get best times' });
    }
  });

  // Predict prep time for restaurant
  app.get('/api/driver/ai/prep-time/:restaurantId', isAuthenticated, isDriver, async (req: any, res) => {
    try {
      const restaurantId = req.params.restaurantId;
      const stats = await prepTimePredictionService.getRestaurantPrepTimeStats(restaurantId);
      res.json(stats);
    } catch (error) {
      logError('Error getting prep time stats', error);
      res.status(500).json({ message: 'Failed to get prep time' });
    }
  });

  // Get "work now" score - current demand level
  app.get('/api/driver/ai/work-now-score', isAuthenticated, isDriver, async (req: any, res) => {
    try {
      const driverId = req.user.id;
      const lat = req.query.lat ? parseFloat(req.query.lat as string) : undefined;
      const lng = req.query.lng ? parseFloat(req.query.lng as string) : undefined;

      const location = lat && lng ? { lat, lng } : undefined;
      const recommendations = await smartRecommendationsService.generateRecommendations(driverId, location);

      // Find work_now recommendation
      const workNowRec = recommendations.find((r) => r.type === 'work_now');
      const score = workNowRec ? workNowRec.priority * 20 : 50; // Convert priority 1-5 to score 0-100

      res.json({ score, recommendation: workNowRec || null });
    } catch (error) {
      logError('Error getting work now score', error);
      res.status(500).json({ message: 'Failed to get work now score' });
    }
  });

  // Get best zones to work in right now
  app.get('/api/driver/ai/best-zones', isAuthenticated, isDriver, async (req: any, res) => {
    try {
      const driverId = req.user.id;
      const zones = await driverBehaviorAnalysisService.calculateZoneMastery(driverId);
      res.json(zones);
    } catch (error) {
      logError('Error getting best zones', error);
      res.status(500).json({ message: 'Failed to get best zones' });
    }
  });

  // Calculate traffic-aware ETA
  app.post('/api/driver/ai/eta/calculate', isAuthenticated, isDriver, async (req: any, res) => {
    try {
      const driverId = req.user.id;
      const { from, to } = req.body;

      if (!from || !to || !from.lat || !from.lng || !to.lat || !to.lng) {
        return res.status(400).json({ message: 'Invalid coordinates' });
      }

      const eta = await trafficAwareETAService.calculateSmartETA(
        driverId,
        { lat: from.lat, lng: from.lng },
        { lat: to.lat, lng: to.lng }
      );

      res.json(eta);
    } catch (error) {
      logError('Error calculating ETA', error);
      res.status(500).json({ message: 'Failed to calculate ETA' });
    }
  });

  // Get driver's ETA accuracy stats
  app.get('/api/driver/ai/eta/accuracy', isAuthenticated, isDriver, async (req: any, res) => {
    try {
      const driverId = req.user.id;
      const days = parseInt(req.query.days as string) || 30;
      const accuracy = await trafficAwareETAService.getETAAccuracy(driverId, days);
      res.json(accuracy);
    } catch (error) {
      logError('Error getting ETA accuracy', error);
      res.status(500).json({ message: 'Failed to get ETA accuracy' });
    }
  });

  // ADMIN: Get surge pricing recommendations
  app.get('/api/admin/ai/surge-recommendations', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const zoneId = req.query.zoneId as string | undefined;
      const recommendations = await surgePricingEngineService.calculateSurgeRecommendation(zoneId);
      res.json(recommendations);
    } catch (error) {
      logError('Error getting surge recommendations', error);
      res.status(500).json({ message: 'Failed to get recommendations' });
    }
  });

  // ADMIN: Apply surge pricing
  app.post('/api/admin/ai/surge/apply', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { zoneId, multiplier, demandScore, supplyScore, activeOrders, availableDrivers } = req.body;

      if (!multiplier || multiplier < 1.0 || multiplier > 3.0) {
        return res.status(400).json({ message: 'Invalid multiplier (must be 1.0-3.0)' });
      }

      await surgePricingEngineService.applySurge(
        zoneId || null,
        multiplier,
        demandScore,
        supplyScore,
        activeOrders,
        availableDrivers
      );

      res.json({ success: true, message: `Surge pricing ${multiplier}x applied` });
    } catch (error) {
      logError('Error applying surge', error);
      res.status(500).json({ message: 'Failed to apply surge' });
    }
  });

  // ADMIN: End surge pricing
  app.post('/api/admin/ai/surge/end', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { zoneId } = req.body;
      await surgePricingEngineService.endSurge(zoneId || null);
      res.json({ success: true, message: 'Surge pricing ended' });
    } catch (error) {
      logError('Error ending surge', error);
      res.status(500).json({ message: 'Failed to end surge' });
    }
  });

  // ADMIN: Get surge pricing history
  app.get('/api/admin/ai/surge/history', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const zoneId = req.query.zoneId as string | undefined;
      const days = parseInt(req.query.days as string) || 30;
      const history = await surgePricingEngineService.getSurgeHistory(zoneId, days);
      res.json(history);
    } catch (error) {
      logError('Error getting surge history', error);
      res.status(500).json({ message: 'Failed to get history' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
