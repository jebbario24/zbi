import { Router } from 'express';
import type { Request, Response } from 'express';
import { storage } from '../storage';
import { db } from '../db';
import { restaurants, menuItems, menuCategories, orders, orderItems, deliveryZones, itemOptions, bundles, promoRules } from '@shared/schema';
import { eq, and, sql, inArray } from 'drizzle-orm';

const router = Router();

// GET /api/marketplace/restaurants - Get all active restaurants
router.get('/restaurants', async (req: Request, res: Response) => {
  try {
    const { city, cuisine, minRating, sortBy } = req.query;

    // Simple query without complex conditions for now
    const results = await db
      .select({
        id: restaurants.id,
        name: restaurants.name,
        slug: restaurants.slug,
        description: restaurants.description,
        logoUrl: restaurants.logoUrl,
        coverImageUrl: restaurants.coverImageUrl,
        address: restaurants.address,
        phone: restaurants.phone,
        email: restaurants.email,
        currency: restaurants.currency,
        country: restaurants.country,
        taxRate: restaurants.taxRate,
        isActive: restaurants.isActive,
        primaryColor: restaurants.primaryColor,
        secondaryColor: restaurants.secondaryColor,
        accentColor: restaurants.accentColor,
        openingHours: restaurants.openingHours,
        createdAt: restaurants.createdAt,
      })
      .from(restaurants)
      .where(eq(restaurants.isActive, true));

    // Add mock data for demo (rating, reviews, delivery time)
    const enrichedResults = results.map((restaurant) => ({
      ...restaurant,
      // Convert relative image URLs to absolute URLs
      logoUrl: restaurant.logoUrl?.startsWith('http') ? restaurant.logoUrl : `https://api.eatout.cloud${restaurant.logoUrl}`,
      coverImageUrl: restaurant.coverImageUrl?.startsWith('http') ? restaurant.coverImageUrl : `https://api.eatout.cloud${restaurant.coverImageUrl}`,
      rating: 4.5,
      reviewCount: Math.floor(Math.random() * 200) + 50,
      deliveryTime: '25-35 min',
      deliveryFee: 299, // $2.99 in cents
      minimumOrder: 1500, // $15 in cents
      isOpen: true,
      cuisine: 'Restaurant',
    }));

    res.json(enrichedResults);
  } catch (error) {
    console.error('Error fetching restaurants:', error);
    res.status(500).json({ message: 'Failed to fetch restaurants' });
  }
});

// GET /api/marketplace/restaurants/:id - Get single restaurant
router.get('/restaurants/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const [restaurant] = await db
      .select()
      .from(restaurants)
      .where(
        and(
          eq(restaurants.id, id),
          eq(restaurants.isActive, true)
        )
      )
      .limit(1);

    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found' });
    }

    // Add mock data and fix image URLs
    const enrichedRestaurant = {
      ...restaurant,
      logoUrl: restaurant.logoUrl?.startsWith('http') ? restaurant.logoUrl : `https://api.eatout.cloud${restaurant.logoUrl}`,
      coverImageUrl: restaurant.coverImageUrl?.startsWith('http') ? restaurant.coverImageUrl : `https://api.eatout.cloud${restaurant.coverImageUrl}`,
      rating: 4.5,
      reviewCount: 120,
      deliveryTime: '25-35 min',
      deliveryFee: 299,
      minimumOrder: 1500,
      isOpen: true,
    };

    res.json(enrichedRestaurant);
  } catch (error) {
    console.error('Error fetching restaurant:', error);
    res.status(500).json({ message: 'Failed to fetch restaurant' });
  }
});

// GET /api/marketplace/restaurants/:id/menu - Get restaurant menu
router.get('/restaurants/:id/menu', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get categories for this restaurant
    const categories = await db
      .select()
      .from(menuCategories)
      .where(
        and(
          eq(menuCategories.restaurantId, id),
          eq(menuCategories.isActive, true)
        )
      )
      .orderBy(menuCategories.displayOrder);

    // Get all items for this restaurant
    const items = await db
      .select()
      .from(menuItems)
      .where(
        and(
          eq(menuItems.restaurantId, id),
          eq(menuItems.isAvailable, true),
          eq(menuItems.visibleOnline, true)
        )
      )
      .orderBy(menuItems.orderIndex);

    // Get item IDs to fetch their options
    const itemIds = items.map(item => item.id);

    // Get all options for these items from itemOptions table
    const allOptions = itemIds.length > 0 ? await db
      .select()
      .from(itemOptions)
      .where(inArray(itemOptions.menuItemId, itemIds))
      .orderBy(itemOptions.displayOrder)
      : [];

    // Create a map of item options
    const optionsMap = new Map<string, any[]>();
    allOptions.forEach(option => {
      if (!optionsMap.has(option.menuItemId)) {
        optionsMap.set(option.menuItemId, []);
      }
      optionsMap.get(option.menuItemId)!.push(option);
    });

    // Group items by category and fix image URLs
    const menuWithItems = categories.map((category) => ({
      ...category,
      items: items.filter((item) => item.categoryId === category.id).map((item) => ({
        ...item,
        imageUrl: item.imageUrl?.startsWith('http') ? item.imageUrl : `https://api.eatout.cloud${item.imageUrl}`,
        // Add options from itemOptions table, fallback to JSONB options field
        options: optionsMap.get(item.id) || item.options || [],
      })),
    }));

    res.json(menuWithItems);
  } catch (error) {
    console.error('Error fetching menu:', error);
    res.status(500).json({ message: 'Failed to fetch menu' });
  }
});

// GET /api/marketplace/delivery-zones/:restaurantId - Get delivery zones
router.get('/delivery-zones/:restaurantId', async (req: Request, res: Response) => {
  try {
    const { restaurantId } = req.params;

    const zones = await db
      .select()
      .from(deliveryZones)
      .where(
        and(
          eq(deliveryZones.restaurantId, restaurantId),
          eq(deliveryZones.isActive, true)
        )
      );

    res.json(zones);
  } catch (error) {
    console.error('Error fetching delivery zones:', error);
    res.status(500).json({ message: 'Failed to fetch delivery zones' });
  }
});

// GET /api/marketplace/restaurants/:id/bundles - Get active bundles
router.get('/restaurants/:id/bundles', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get active bundles
    const activeBundles = await db
      .select()
      .from(bundles)
      .where(
        and(
          eq(bundles.restaurantId, id),
          eq(bundles.isActive, true)
        )
      )
      .orderBy(bundles.displayPriority);

    // Fix image URLs
    const enrichedBundles = activeBundles.map(bundle => ({
      ...bundle,
      imageUrl: bundle.imageUrl?.startsWith('http') ? bundle.imageUrl : `https://api.eatout.cloud${bundle.imageUrl}`,
    }));

    res.json(enrichedBundles);
  } catch (error) {
    console.error('Error fetching bundles:', error);
    res.status(500).json({ message: 'Failed to fetch bundles' });
  }
});

// POST /api/marketplace/validate-promo - Validate promo code
router.post('/validate-promo', async (req: Request, res: Response) => {
  try {
    const { restaurantId, promoCode, orderTotal } = req.body;

    if (!restaurantId || !promoCode) {
      return res.status(400).json({ message: 'Restaurant ID and promo code are required' });
    }

    // Get promo by code
    const [promo] = await db
      .select()
      .from(promoRules)
      .where(
        and(
          eq(promoRules.restaurantId, restaurantId),
          eq(promoRules.promoCode, promoCode),
          eq(promoRules.isActive, true)
        )
      )
      .limit(1);

    if (!promo) {
      return res.status(404).json({ message: 'Invalid or expired promo code' });
    }

    // Check if promo has started
    const now = new Date();
    if (promo.startsAt && new Date(promo.startsAt) > now) {
      return res.status(400).json({ message: 'This promo code is not yet active' });
    }

    // Check if promo has expired
    if (promo.endsAt && new Date(promo.endsAt) < now) {
      return res.status(400).json({ message: 'This promo code has expired' });
    }

    // Check minimum order amount
    const conditions = promo.conditions as any;
    if (conditions?.minOrderAmount && orderTotal < parseFloat(conditions.minOrderAmount)) {
      return res.status(400).json({ 
        message: `Minimum order amount of $${conditions.minOrderAmount} required` 
      });
    }

    // Calculate discount
    let discountAmount = 0;
    if (promo.promoType === 'percentage') {
      discountAmount = (orderTotal * parseFloat(promo.discountValue || '0')) / 100;
      // Apply max discount cap if set
      if (conditions?.maxDiscount) {
        discountAmount = Math.min(discountAmount, parseFloat(conditions.maxDiscount));
      }
    } else if (promo.promoType === 'fixed_amount') {
      discountAmount = parseFloat(promo.discountValue || '0');
    }

    res.json({
      id: promo.id,
      code: promo.promoCode,
      name: promo.name,
      description: promo.description,
      type: promo.promoType,
      discountAmount,
    });
  } catch (error) {
    console.error('Error validating promo:', error);
    res.status(500).json({ message: 'Failed to validate promo code' });
  }
});

// POST /api/marketplace/orders - Create new order
router.post('/orders', async (req: Request, res: Response) => {
  try {
    const {
      restaurantId,
      customerName,
      customerPhone,
      customerEmail,
      deliveryAddress,
      deliveryCity,
      deliveryCountry,
      paymentMethod,
      items: orderItemsData,
      subtotal,
      tax,
      deliveryFee,
      total,
      notes,
      promoCode,
      promoDiscount,
    } = req.body;

    // Validate required fields
    if (!restaurantId || !customerName || !customerPhone || !orderItemsData || orderItemsData.length === 0) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Generate order number
    const orderNumber = `WEB-${Date.now().toString().slice(-8)}`;

    // Create order
    const [order] = await db
      .insert(orders)
      .values({
        restaurantId,
        orderNumber,
        orderType: 'delivery',
        customerName,
        customerPhone,
        customerEmail: customerEmail || null,
        deliveryAddress: deliveryAddress || null,
        deliveryCity: deliveryCity || null,
        deliveryCountry: deliveryCountry || null,
        deliveryFee: deliveryFee?.toString() || '0',
        subtotal: subtotal?.toString() || '0',
        promoCode: promoCode || null,
        promoDiscount: promoDiscount?.toString() || '0',
        tax: tax?.toString() || '0',
        total: total?.toString() || '0',
        status: 'pending',
        paymentStatus: paymentMethod === 'cash' ? 'pending' : 'paid',
        paymentMethod,
        paymentProvider: paymentMethod === 'card' ? 'stripe' : paymentMethod === 'paypal' ? 'paypal' : null,
        notes: notes || null,
      })
      .returning();

    // Create order items
    for (const item of orderItemsData) {
      await db.insert(orderItems).values({
        orderId: order.id,
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        unitPrice: (item.unitPrice / 100).toString(), // Convert cents to dollars
        subtotal: ((item.unitPrice * item.quantity) / 100).toString(),
        selectedOptions: item.selectedOptions ? JSON.stringify(item.selectedOptions) : null,
        notes: item.notes || null,
      });
    }

    // TODO: Send notifications to restaurant
    // TODO: Assign driver if delivery
    // TODO: Process payment if card/paypal

    res.json({
      ...order,
      message: 'Order placed successfully',
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ message: 'Failed to create order' });
  }
});

// GET /api/marketplace/orders/:id - Get order details
router.get('/orders/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, id))
      .limit(1);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Get order items with menu item details
    const items = await db
      .select({
        id: orderItems.id,
        menuItemId: orderItems.menuItemId,
        quantity: orderItems.quantity,
        unitPrice: orderItems.unitPrice,
        subtotal: orderItems.subtotal,
        selectedOptions: orderItems.selectedOptions,
        notes: orderItems.notes,
        menuItem: {
          id: menuItems.id,
          name: menuItems.name,
          imageUrl: menuItems.imageUrl,
        },
      })
      .from(orderItems)
      .leftJoin(menuItems, eq(orderItems.menuItemId, menuItems.id))
      .where(eq(orderItems.orderId, id));

    res.json({
      ...order,
      items,
    });
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ message: 'Failed to fetch order' });
  }
});

export default router;
