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
  insertDeliveryZoneSchema,
} from "@shared/schema";
import { z } from "zod";
import Stripe from "stripe";
import { Client, Environment, OrdersController } from '@paypal/paypal-server-sdk';
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-09-30.clover",
});

if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
  throw new Error('Missing required PayPal secrets: PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET');
}
const paypalClient = new Client({
  clientCredentialsAuthCredentials: {
    oAuthClientId: process.env.PAYPAL_CLIENT_ID,
    oAuthClientSecret: process.env.PAYPAL_CLIENT_SECRET
  },
  timeout: 0,
  environment: Environment.Sandbox,
});
const paypalOrdersController = new OrdersController(paypalClient);

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

const orderSchema = z.object({
  orderType: z.string(),
  tableId: z.string().nullable().optional(),
  customerName: z.string().nullable().optional(),
  customerPhone: z.string().nullable().optional(),
  customerEmail: z.string().nullable().optional(),
  paymentMethod: z.enum(['stripe', 'paypal', 'cash']).optional().default('cash'),
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

const onlineOrderSchema = z.object({
  customerName: z.string().nullable().optional(),
  customerPhone: z.string().nullable().optional(),
  customerEmail: z.string().nullable().optional(),
  shippingAddress: z.string().nullable().optional(),
  paymentMethod: z.enum(['stripe', 'paypal', 'cash']).optional().default('cash'),
  items: z.array(z.object({
    menuItemId: z.string(),
    quantity: z.number(),
    unitPrice: z.string(),
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

      // Create subscription ($79/month)
      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
        metadata: { plan: 'eatout-monthly' },
      });

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

  app.put('/api/tables/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }
      const { id } = req.params;
      await storage.deleteTable(id);
      res.json({ message: "Table deleted successfully" });
    } catch (error) {
      console.error("Error deleting table:", error);
      res.status(400).json({ message: "Failed to delete table" });
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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

  app.put('/api/staff/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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

  // Delivery zone routes
  app.get('/api/delivery-zones', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
      
      const data = onlineOrderSchema.parse(req.body);
      const orderNumber = await generateOrderNumber(restaurant.id, 'WEB');
      
      const order = await storage.createOrder({
        restaurantId: restaurant.id,
        orderNumber,
        orderType: 'online',
        customerName: data.customerName || null,
        customerPhone: data.customerPhone || null,
        customerEmail: data.customerEmail || null,
        shippingAddress: data.shippingAddress || null,
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
      })));
      
      if (data.paymentMethod === 'cash') {
        // Cash on delivery - mark order as confirmed, payment will be collected on delivery
        res.json({ orderId: order.id, paymentMethod: 'cash', success: true });
      } else if (data.paymentMethod === 'paypal') {
        res.json({ orderId: order.id, paymentMethod: 'paypal' });
      } else {
        // Stripe payment
        res.json({ orderId: order.id, checkoutUrl: null });
      }
    } catch (error) {
      console.error("Error creating online order:", error);
      res.status(400).json({ message: "Failed to create order" });
    }
  });

  // Object Storage routes
  app.get("/objects/:objectPath(*)", isAuthenticated, async (req: any, res) => {
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
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    res.json({ uploadURL });
  });

  app.put("/api/restaurant/logo", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
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
    const userId = req.user.claims.sub;
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
    const userId = req.user.claims.sub;
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
    const userId = req.user.claims.sub;
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
    const userId = req.user.claims.sub;
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

  app.put("/api/restaurant/regional-settings", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const { currency, country } = req.body;

    if (!currency || !country) {
      return res.status(400).json({ error: "currency and country are required" });
    }

    try {
      const restaurant = await storage.getRestaurantByOwnerId(userId);
      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }

      await storage.updateRestaurant(restaurant.id, { currency, country });
      res.status(200).json({ success: true });
    } catch (error) {
      console.error("Error updating regional settings:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/menu-item/:id/image", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
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

  // PayPal create order
  app.post('/api/paypal/create-order', async (req, res) => {
    try {
      const { orderId, total } = req.body;
      
      const orderRequest = {
        body: {
          intent: 'CAPTURE',
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
            landingPage: 'NO_PREFERENCE',
            userAction: 'PAY_NOW'
          }
        }
      };

      const paypalOrder = await paypalOrdersController.ordersCreate(orderRequest);
      res.json({ paypalOrderId: paypalOrder.result.id });
    } catch (error) {
      console.error('PayPal create order error:', error);
      res.status(500).json({ message: 'Failed to create PayPal order' });
    }
  });

  // PayPal capture payment
  app.post('/api/paypal/capture-order/:paypalOrderId', async (req, res) => {
    try {
      const { paypalOrderId } = req.params;
      const { orderId } = req.body;

      const captureRequest = {
        id: paypalOrderId,
        prefer: 'return=representation'
      };

      const capture = await paypalOrdersController.ordersCapture(captureRequest);
      
      if (capture.result.status === 'COMPLETED') {
        // Update order payment status
        await storage.updateOrder(orderId, { 
          paymentStatus: 'paid',
          status: 'confirmed'
        });
        
        res.json({ 
          success: true,
          orderId,
          captureId: capture.result.purchaseUnits[0].payments.captures[0].id
        });
      } else {
        res.status(400).json({ message: 'Payment not completed' });
      }
    } catch (error) {
      console.error('PayPal capture error:', error);
      res.status(500).json({ message: 'Failed to capture PayPal payment' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
