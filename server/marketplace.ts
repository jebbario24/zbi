import { Router } from 'express';
import type { Request, Response } from 'express';
import { storage } from './storage';
import { db } from './db';
import { getBaseUrl } from './env';
import { logError, logInfo } from './logger';
import { 
  restaurants, 
  menuItems, 
  menuCategories, 
  orders, 
  orderItems, 
  deliveryZones, 
  itemOptions, 
  bundles, 
  promoRules,
  marketplaceSliders,
  cuisineTypes,
  restaurantCuisines,
  featuredRestaurants,
  marketplaceBanners,
  marketplaceSettings,
} from '@shared/schema';
import { eq, and, sql, inArray, lte, gte, or, isNull } from 'drizzle-orm';

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
    const baseUrl = getBaseUrl();
    const enrichedResults = results.map((restaurant) => ({
      ...restaurant,
      // Convert relative image URLs to absolute URLs
      logoUrl: restaurant.logoUrl?.startsWith('http') ? restaurant.logoUrl : `${baseUrl}${restaurant.logoUrl}`,
      coverImageUrl: restaurant.coverImageUrl?.startsWith('http') ? restaurant.coverImageUrl : `${baseUrl}${restaurant.coverImageUrl}`,
      rating: 4.5,
      reviewCount: Math.floor(Math.random() * 200) + 50,
      deliveryTime: '25-35 min',
      deliveryFee: 299, // $2.99 in cents
      minimumOrder: 1500, // $15 in cents
      isOpen: true,
      cuisine: 'Restaurant',
    }));

    logInfo('[Marketplace] Fetched restaurants', { count: enrichedResults.length });
    res.json(enrichedResults);
  } catch (error) {
    logError('Error fetching marketplace restaurants', error);
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
    const baseUrl = getBaseUrl();
    const enrichedRestaurant = {
      ...restaurant,
      logoUrl: restaurant.logoUrl?.startsWith('http') ? restaurant.logoUrl : `${baseUrl}${restaurant.logoUrl}`,
      coverImageUrl: restaurant.coverImageUrl?.startsWith('http') ? restaurant.coverImageUrl : `${baseUrl}${restaurant.coverImageUrl}`,
      rating: 4.5,
      reviewCount: 120,
      deliveryTime: '25-35 min',
      deliveryFee: 299,
      minimumOrder: 1500,
      isOpen: true,
    };

    res.json(enrichedRestaurant);
  } catch (error) {
    logError('Error fetching marketplace restaurant', error);
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
        imageUrl: item.imageUrl?.startsWith('http') ? item.imageUrl : `${getBaseUrl()}${item.imageUrl}`,
        // Add options from itemOptions table, fallback to JSONB options field
        options: optionsMap.get(item.id) || item.options || [],
      })),
    }));

    res.json(menuWithItems);
  } catch (error) {
    logError('Error fetching marketplace menu', error);
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
    logError('Error fetching delivery zones', error);
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
      imageUrl: bundle.imageUrl?.startsWith('http') ? bundle.imageUrl : `${getBaseUrl()}${bundle.imageUrl}`,
    }));

    res.json(enrichedBundles);
  } catch (error) {
    logError('Error fetching marketplace bundles', error);
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
    logError('Error validating marketplace promo', error);
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

    logInfo('[Marketplace] Order created', { orderId: order.id, restaurantId, total });
    res.json({
      ...order,
      message: 'Order placed successfully',
    });
  } catch (error) {
    logError('Error creating marketplace order', error);
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
    logError('Error fetching marketplace order', error);
    res.status(500).json({ message: 'Failed to fetch order' });
  }
});

// ============================================
// PUBLIC MARKETPLACE FEATURES
// ============================================

// GET /api/marketplace/sliders - Get active sliders
router.get('/sliders', async (req: Request, res: Response) => {
  try {
    const now = new Date();
    
    const sliders = await db
      .select()
      .from(marketplaceSliders)
      .where(
        and(
          eq(marketplaceSliders.isActive, true),
          or(
            isNull(marketplaceSliders.startsAt),
            lte(marketplaceSliders.startsAt, now)
          ),
          or(
            isNull(marketplaceSliders.endsAt),
            gte(marketplaceSliders.endsAt, now)
          )
        )
      )
      .orderBy(sql`${marketplaceSliders.displayOrder} ASC`);
    
    // Fix image URLs
    const baseUrl = getBaseUrl();
    const enrichedSliders = sliders.map(slider => ({
      ...slider,
      desktopImageUrl: slider.desktopImageUrl?.startsWith('http') 
        ? slider.desktopImageUrl 
        : `${baseUrl}${slider.desktopImageUrl}`,
      mobileImageUrl: slider.mobileImageUrl?.startsWith('http')
        ? slider.mobileImageUrl
        : slider.mobileImageUrl 
          ? `${baseUrl}${slider.mobileImageUrl}`
          : null,
    }));
    
    res.json(enrichedSliders);
  } catch (error) {
    logError('Error fetching marketplace sliders', error);
    res.status(500).json({ message: 'Failed to fetch sliders' });
  }
});

// GET /api/marketplace/cuisines - Get active cuisines
router.get('/cuisines', async (req: Request, res: Response) => {
  try {
    const cuisines = await db
      .select({
        id: cuisineTypes.id,
        name: cuisineTypes.name,
        slug: cuisineTypes.slug,
        description: cuisineTypes.description,
        iconUrl: cuisineTypes.iconUrl,
        imageUrl: cuisineTypes.imageUrl,
        displayOrder: cuisineTypes.displayOrder,
        restaurantCount: sql<number>`count(distinct ${restaurantCuisines.restaurantId})::int`,
      })
      .from(cuisineTypes)
      .leftJoin(
        restaurantCuisines, 
        eq(cuisineTypes.id, restaurantCuisines.cuisineId)
      )
      .where(eq(cuisineTypes.isActive, true))
      .groupBy(cuisineTypes.id)
      .orderBy(sql`${cuisineTypes.displayOrder} ASC`);
    
    // Fix image URLs
    const baseUrl = getBaseUrl();
    const enrichedCuisines = cuisines.map(cuisine => ({
      ...cuisine,
      iconUrl: cuisine.iconUrl?.startsWith('http')
        ? cuisine.iconUrl
        : cuisine.iconUrl
          ? `${baseUrl}${cuisine.iconUrl}`
          : null,
      imageUrl: cuisine.imageUrl?.startsWith('http')
        ? cuisine.imageUrl
        : cuisine.imageUrl
          ? `${baseUrl}${cuisine.imageUrl}`
          : null,
    }));
    
    res.json(enrichedCuisines);
  } catch (error) {
    logError('Error fetching cuisines', error);
    res.status(500).json({ message: 'Failed to fetch cuisines' });
  }
});

// GET /api/marketplace/cuisines/:slug/restaurants - Get restaurants by cuisine
router.get('/cuisines/:slug/restaurants', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    
    // Get cuisine by slug
    const [cuisine] = await db
      .select()
      .from(cuisineTypes)
      .where(
        and(
          eq(cuisineTypes.slug, slug),
          eq(cuisineTypes.isActive, true)
        )
      )
      .limit(1);
    
    if (!cuisine) {
      return res.status(404).json({ message: 'Cuisine not found' });
    }
    
    // Get restaurants with this cuisine
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
      .innerJoin(restaurantCuisines, eq(restaurants.id, restaurantCuisines.restaurantId))
      .where(
        and(
          eq(restaurantCuisines.cuisineId, cuisine.id),
          eq(restaurants.isActive, true)
        )
      );
    
    // Enrich results
    const baseUrl = getBaseUrl();
    const enrichedResults = results.map((restaurant) => ({
      ...restaurant,
      logoUrl: restaurant.logoUrl?.startsWith('http') 
        ? restaurant.logoUrl 
        : `${baseUrl}${restaurant.logoUrl}`,
      coverImageUrl: restaurant.coverImageUrl?.startsWith('http')
        ? restaurant.coverImageUrl
        : `${baseUrl}${restaurant.coverImageUrl}`,
      rating: 4.5,
      reviewCount: Math.floor(Math.random() * 200) + 50,
      deliveryTime: '25-35 min',
      deliveryFee: 299,
      minimumOrder: 1500,
      isOpen: true,
      cuisine: cuisine.name,
    }));
    
    res.json(enrichedResults);
  } catch (error) {
    logError('Error fetching restaurants by cuisine', error);
    res.status(500).json({ message: 'Failed to fetch restaurants' });
  }
});

// GET /api/marketplace/featured - Get featured restaurants
router.get('/featured', async (req: Request, res: Response) => {
  try {
    const now = new Date();
    
    const featured = await db
      .select({
        id: restaurants.id,
        name: restaurants.name,
        slug: restaurants.slug,
        description: restaurants.description,
        logoUrl: restaurants.logoUrl,
        coverImageUrl: restaurants.coverImageUrl,
        address: restaurants.address,
        phone: restaurants.phone,
        primaryColor: restaurants.primaryColor,
        secondaryColor: restaurants.secondaryColor,
        accentColor: restaurants.accentColor,
        featuredPosition: featuredRestaurants.featuredPosition,
      })
      .from(featuredRestaurants)
      .innerJoin(restaurants, eq(featuredRestaurants.restaurantId, restaurants.id))
      .where(
        and(
          eq(featuredRestaurants.isActive, true),
          eq(restaurants.isActive, true),
          lte(featuredRestaurants.startsAt, now),
          or(
            isNull(featuredRestaurants.endsAt),
            gte(featuredRestaurants.endsAt, now)
          )
        )
      )
      .orderBy(sql`${featuredRestaurants.featuredPosition} ASC`)
      .limit(10);
    
    // Enrich and fix image URLs
    const baseUrl = getBaseUrl();
    const enrichedFeatured = featured.map((restaurant) => ({
      ...restaurant,
      logoUrl: restaurant.logoUrl?.startsWith('http')
        ? restaurant.logoUrl
        : `${baseUrl}${restaurant.logoUrl}`,
      coverImageUrl: restaurant.coverImageUrl?.startsWith('http')
        ? restaurant.coverImageUrl
        : `${baseUrl}${restaurant.coverImageUrl}`,
      rating: 4.5,
      reviewCount: Math.floor(Math.random() * 200) + 50,
      deliveryTime: '25-35 min',
      deliveryFee: 299,
      minimumOrder: 1500,
      isOpen: true,
      isFeatured: true,
    }));
    
    res.json(enrichedFeatured);
  } catch (error) {
    logError('Error fetching featured restaurants', error);
    res.status(500).json({ message: 'Failed to fetch featured restaurants' });
  }
});

// GET /api/marketplace/banners - Get active banners
router.get('/banners', async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const { type } = req.query; // Optional filter by banner type
    
    // Build WHERE conditions
    const conditions = [
      eq(marketplaceBanners.isActive, true),
      or(
        isNull(marketplaceBanners.startsAt),
        lte(marketplaceBanners.startsAt, now)
      ),
      or(
        isNull(marketplaceBanners.endsAt),
        gte(marketplaceBanners.endsAt, now)
      )
    ];
    
    // Add type filter if provided
    if (type && typeof type === 'string') {
      conditions.push(eq(marketplaceBanners.bannerType, type));
    }
    
    const banners = await db
      .select()
      .from(marketplaceBanners)
      .where(and(...conditions))
      .orderBy(sql`${marketplaceBanners.displayOrder} ASC`);
    
    // Fix image URLs
    const baseUrl = getBaseUrl();
    const enrichedBanners = banners.map(banner => ({
      ...banner,
      imageUrl: banner.imageUrl?.startsWith('http')
        ? banner.imageUrl
        : banner.imageUrl
          ? `${baseUrl}${banner.imageUrl}`
          : null,
    }));
    
    res.json(enrichedBanners);
  } catch (error) {
    logError('Error fetching marketplace banners', error);
    res.status(500).json({ message: 'Failed to fetch banners' });
  }
});

// GET /api/marketplace/settings - Get public marketplace settings
router.get('/settings', async (req: Request, res: Response) => {
  try {
    const settings = await db
      .select({
        key: marketplaceSettings.key,
        value: marketplaceSettings.value,
        valueType: marketplaceSettings.valueType,
        category: marketplaceSettings.category,
      })
      .from(marketplaceSettings)
      .where(eq(marketplaceSettings.isEditable, true));
    
    // Convert to key-value object
    const settingsObject = settings.reduce((acc, setting) => {
      let value: any = setting.value;
      
      // Parse value based on type
      if (setting.valueType === 'number') {
        value = parseFloat(value);
      } else if (setting.valueType === 'boolean') {
        value = value === 'true';
      } else if (setting.valueType === 'json') {
        try {
          value = JSON.parse(value);
        } catch (e) {
          // Keep as string if parsing fails
        }
      }
      
      acc[setting.key] = value;
      return acc;
    }, {} as Record<string, any>);
    
    res.json(settingsObject);
  } catch (error) {
    logError('Error fetching marketplace settings', error);
    res.status(500).json({ message: 'Failed to fetch settings' });
  }
});

export default router;
