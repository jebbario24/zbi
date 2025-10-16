import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import {
  insertRestaurantSchema,
  insertMenuCategorySchema,
  insertMenuItemSchema,
  insertTableSchema,
  insertReservationSchema,
  insertStaffSchema,
  insertInventorySchema,
} from "@shared/schema";
import { z } from "zod";
import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-09-30.clover",
});

const orderSchema = z.object({
  orderType: z.string(),
  tableId: z.string().nullable().optional(),
  customerName: z.string().nullable().optional(),
  customerPhone: z.string().nullable().optional(),
  customerEmail: z.string().nullable().optional(),
  items: z.array(z.object({
    menuItemId: z.string(),
    quantity: z.number(),
    unitPrice: z.string(),
    notes: z.string().optional(),
  })),
  subtotal: z.string(),
  tax: z.string(),
  total: z.string(),
});

export async function registerRoutes(app: Express): Promise<Server> {
  await setupAuth(app);

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
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Subscription routes
  app.post('/api/create-subscription', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check if already has a subscription - reuse any non-canceled subscription!
      if (user.stripeSubscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId, {
          expand: ['latest_invoice.payment_intent'],  // Must expand to get client secret!
        });
        
        // Reuse any existing subscription except canceled/incomplete_expired
        // This prevents duplicate subscriptions for past_due, unpaid, etc.
        if (subscription.status !== 'canceled' && subscription.status !== 'incomplete_expired') {
          // Always update to fresh Stripe data
          await storage.updateUserSubscription(userId, {
            subscriptionStatus: subscription.status,
            subscriptionEndsAt: new Date((subscription as any).current_period_end * 1000),
          });
          
          return res.json({ 
            subscriptionId: subscription.id,
            clientSecret: (subscription.latest_invoice as any)?.payment_intent?.client_secret,
            status: subscription.status,
          });
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

      // Create subscription ($79/month)
      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ 
          price_data: {
            currency: 'usd',
            product_data: { name: 'EatOut Monthly Subscription' },
            recurring: { interval: 'month' },
            unit_amount: 7900, // $79 in cents
          } as any
        }],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
      });

      // Update user with subscription ID (status will be updated via webhook or on next check)
      await storage.updateUserSubscription(userId, { 
        stripeSubscriptionId: subscription.id,
        subscriptionStatus: subscription.status,  // Use actual Stripe status (incomplete, active, etc)
        subscriptionEndsAt: new Date((subscription as any).current_period_end * 1000),
      });

      res.json({
        subscriptionId: subscription.id,
        clientSecret: (subscription.latest_invoice as any)?.payment_intent?.client_secret,
        status: subscription.status,
      });
    } catch (error: any) {
      console.error("Error creating subscription:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/subscription-status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
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
          freshSubscriptionEndsAt = new Date((subscription as any).current_period_end * 1000);
          
          // ALWAYS update local data to match Stripe (not just when status changes)
          await storage.updateUserSubscription(userId, {
            subscriptionStatus: subscription.status,
            subscriptionEndsAt: freshSubscriptionEndsAt,
          });
          
          // Recalculate access based on fresh Stripe data
          actualSubscriptionActive = subscription.status === 'active' && freshSubscriptionEndsAt > now;
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
      });
    } catch (error) {
      console.error("Error fetching subscription status:", error);
      res.status(500).json({ message: "Failed to fetch subscription status" });
    }
  });

  app.post('/api/cancel-subscription', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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

  // Restaurant routes
  app.get('/api/restaurants/me', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      res.json(restaurant || null);
    } catch (error) {
      console.error("Error fetching restaurant:", error);
      res.status(500).json({ message: "Failed to fetch restaurant" });
    }
  });

  app.post('/api/restaurants', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const data = insertRestaurantSchema.parse({ ...req.body, ownerId: userId });
      const restaurant = await storage.createRestaurant(data);
      res.json(restaurant);
    } catch (error) {
      console.error("Error creating restaurant:", error);
      res.status(400).json({ message: "Failed to create restaurant" });
    }
  });

  app.put('/api/restaurants/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      
      if (!restaurant || restaurant.id !== req.params.id) {
        return res.status(403).json({ message: "Forbidden: You can only update your own restaurant" });
      }
      
      const data = insertRestaurantSchema.partial().parse(req.body);
      const updated = await storage.updateRestaurant(req.params.id, data);
      res.json(updated);
    } catch (error) {
      console.error("Error updating restaurant:", error);
      res.status(400).json({ message: "Failed to update restaurant" });
    }
  });

  // Menu category routes
  app.get('/api/menu/categories', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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

  // Menu item routes
  app.get('/api/menu/items', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }
      const data = insertMenuItemSchema.parse({ ...req.body, restaurantId: restaurant.id });
      const item = await storage.createMenuItem(data);
      res.json(item);
    } catch (error) {
      console.error("Error creating item:", error);
      res.status(400).json({ message: "Failed to create item" });
    }
  });

  // Table routes
  app.get('/api/tables', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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

  // Reservation routes
  app.get('/api/reservations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }
      const data = insertReservationSchema.parse({ 
        ...req.body, 
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

  // Order routes
  app.get('/api/orders', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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

  app.post('/api/orders', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }
      
      const data = orderSchema.parse(req.body);
      const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      
      const order = await storage.createOrder({
        restaurantId: restaurant.id,
        orderNumber,
        orderType: data.orderType,
        tableId: data.tableId || null,
        customerName: data.customerName || null,
        customerPhone: data.customerPhone || null,
        customerEmail: data.customerEmail || null,
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

  // Staff routes
  app.get('/api/staff', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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

  // Inventory routes
  app.get('/api/inventory', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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

  // Analytics routes
  app.get('/api/analytics/stats', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.json({});
      }
      
      const orders = await storage.getOrders(restaurant.id);
      const totalRevenue = orders.reduce((sum, o) => sum + parseFloat(o.total), 0).toFixed(2);
      const averageOrder = orders.length > 0 
        ? (orders.reduce((sum, o) => sum + parseFloat(o.total), 0) / orders.length).toFixed(2)
        : "0";
      
      res.json({
        totalRevenue,
        totalOrders: orders.length,
        averageOrder,
        popularItemsCount: 0,
        popularItems: [],
        dineInRevenue: "0",
        takeoutRevenue: "0",
        deliveryRevenue: "0",
        onlineRevenue: "0",
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

  app.post('/api/storefront/:slug/checkout', async (req, res) => {
    try {
      const restaurant = await storage.getRestaurantBySlug(req.params.slug);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }
      
      const data = orderSchema.parse(req.body);
      const orderNumber = `WEB-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      
      const order = await storage.createOrder({
        restaurantId: restaurant.id,
        orderNumber,
        orderType: 'online',
        customerName: data.customerName || null,
        customerPhone: data.customerPhone || null,
        customerEmail: data.customerEmail || null,
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
      })));
      
      res.json({ orderId: order.id, checkoutUrl: null });
    } catch (error) {
      console.error("Error creating online order:", error);
      res.status(400).json({ message: "Failed to create order" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
