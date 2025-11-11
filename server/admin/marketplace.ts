import { Router } from 'express';
import type { Request, Response } from 'express';
import { db } from '../db';
import { 
  marketplaceSliders, 
  cuisineTypes, 
  restaurantCuisines,
  featuredRestaurants,
  marketplaceBanners,
  marketplaceSettings,
  restaurants,
  type InsertMarketplaceSlider,
  type InsertCuisineType,
  type InsertFeaturedRestaurant,
  type InsertMarketplaceBanner,
  type InsertMarketplaceSetting,
} from '@shared/schema';
import { eq, and, desc, asc, sql } from 'drizzle-orm';
import { logError, logInfo } from '../logger';

const router = Router();

// ============================================
// HERO SLIDERS
// ============================================

// GET /api/admin/marketplace/sliders - List all sliders
router.get('/sliders', async (req: Request, res: Response) => {
  try {
    const sliders = await db
      .select()
      .from(marketplaceSliders)
      .orderBy(asc(marketplaceSliders.displayOrder), desc(marketplaceSliders.createdAt));
    
    res.json(sliders);
  } catch (error) {
    logError('Error fetching marketplace sliders', error);
    res.status(500).json({ message: 'Failed to fetch sliders' });
  }
});

// POST /api/admin/marketplace/sliders - Create slider
router.post('/sliders', async (req: Request, res: Response) => {
  try {
    const data = req.body as InsertMarketplaceSlider;
    
    const [slider] = await db
      .insert(marketplaceSliders)
      .values({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    
    logInfo('[Admin] Marketplace slider created', { sliderId: slider.id });
    res.json(slider);
  } catch (error) {
    logError('Error creating marketplace slider', error);
    res.status(500).json({ message: 'Failed to create slider' });
  }
});

// PUT /api/admin/marketplace/sliders/:id - Update slider
router.put('/sliders/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = req.body;
    
    const [slider] = await db
      .update(marketplaceSliders)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(marketplaceSliders.id, id))
      .returning();
    
    if (!slider) {
      return res.status(404).json({ message: 'Slider not found' });
    }
    
    logInfo('[Admin] Marketplace slider updated', { sliderId: id });
    res.json(slider);
  } catch (error) {
    logError('Error updating marketplace slider', error);
    res.status(500).json({ message: 'Failed to update slider' });
  }
});

// DELETE /api/admin/marketplace/sliders/:id - Delete slider
router.delete('/sliders/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    await db
      .delete(marketplaceSliders)
      .where(eq(marketplaceSliders.id, id));
    
    logInfo('[Admin] Marketplace slider deleted', { sliderId: id });
    res.json({ message: 'Slider deleted successfully' });
  } catch (error) {
    logError('Error deleting marketplace slider', error);
    res.status(500).json({ message: 'Failed to delete slider' });
  }
});

// PUT /api/admin/marketplace/sliders/:id/toggle - Toggle slider active status
router.put('/sliders/:id/toggle', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const [current] = await db
      .select()
      .from(marketplaceSliders)
      .where(eq(marketplaceSliders.id, id))
      .limit(1);
    
    if (!current) {
      return res.status(404).json({ message: 'Slider not found' });
    }
    
    const [slider] = await db
      .update(marketplaceSliders)
      .set({ 
        isActive: !current.isActive,
        updatedAt: new Date(),
      })
      .where(eq(marketplaceSliders.id, id))
      .returning();
    
    res.json(slider);
  } catch (error) {
    logError('Error toggling slider status', error);
    res.status(500).json({ message: 'Failed to toggle slider status' });
  }
});

// ============================================
// CUISINE TYPES
// ============================================

// GET /api/admin/marketplace/cuisines - List all cuisines
router.get('/cuisines', async (req: Request, res: Response) => {
  try {
    // Get cuisines with restaurant count
    const cuisines = await db
      .select({
        id: cuisineTypes.id,
        name: cuisineTypes.name,
        slug: cuisineTypes.slug,
        description: cuisineTypes.description,
        iconUrl: cuisineTypes.iconUrl,
        imageUrl: cuisineTypes.imageUrl,
        displayOrder: cuisineTypes.displayOrder,
        isActive: cuisineTypes.isActive,
        createdAt: cuisineTypes.createdAt,
        updatedAt: cuisineTypes.updatedAt,
        restaurantCount: sql<number>`count(${restaurantCuisines.restaurantId})::int`,
      })
      .from(cuisineTypes)
      .leftJoin(restaurantCuisines, eq(cuisineTypes.id, restaurantCuisines.cuisineId))
      .groupBy(cuisineTypes.id)
      .orderBy(asc(cuisineTypes.displayOrder), asc(cuisineTypes.name));
    
    res.json(cuisines);
  } catch (error) {
    logError('Error fetching cuisines', error);
    res.status(500).json({ message: 'Failed to fetch cuisines' });
  }
});

// POST /api/admin/marketplace/cuisines - Create cuisine
router.post('/cuisines', async (req: Request, res: Response) => {
  try {
    const data = req.body as InsertCuisineType;
    
    // Generate slug from name if not provided
    const slug = data.slug || data.name.toLowerCase().replace(/\s+/g, '-');
    
    const [cuisine] = await db
      .insert(cuisineTypes)
      .values({
        ...data,
        slug,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    
    logInfo('[Admin] Cuisine type created', { cuisineId: cuisine.id, name: cuisine.name });
    res.json(cuisine);
  } catch (error) {
    logError('Error creating cuisine type', error);
    res.status(500).json({ message: 'Failed to create cuisine type' });
  }
});

// PUT /api/admin/marketplace/cuisines/:id - Update cuisine
router.put('/cuisines/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = req.body;
    
    const [cuisine] = await db
      .update(cuisineTypes)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(cuisineTypes.id, id))
      .returning();
    
    if (!cuisine) {
      return res.status(404).json({ message: 'Cuisine not found' });
    }
    
    logInfo('[Admin] Cuisine type updated', { cuisineId: id });
    res.json(cuisine);
  } catch (error) {
    logError('Error updating cuisine type', error);
    res.status(500).json({ message: 'Failed to update cuisine type' });
  }
});

// DELETE /api/admin/marketplace/cuisines/:id - Delete cuisine
router.delete('/cuisines/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    await db
      .delete(cuisineTypes)
      .where(eq(cuisineTypes.id, id));
    
    logInfo('[Admin] Cuisine type deleted', { cuisineId: id });
    res.json({ message: 'Cuisine deleted successfully' });
  } catch (error) {
    logError('Error deleting cuisine type', error);
    res.status(500).json({ message: 'Failed to delete cuisine type' });
  }
});

// PUT /api/admin/marketplace/cuisines/:id/toggle - Toggle cuisine active status
router.put('/cuisines/:id/toggle', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const [current] = await db
      .select()
      .from(cuisineTypes)
      .where(eq(cuisineTypes.id, id))
      .limit(1);
    
    if (!current) {
      return res.status(404).json({ message: 'Cuisine not found' });
    }
    
    const [cuisine] = await db
      .update(cuisineTypes)
      .set({ 
        isActive: !current.isActive,
        updatedAt: new Date(),
      })
      .where(eq(cuisineTypes.id, id))
      .returning();
    
    res.json(cuisine);
  } catch (error) {
    logError('Error toggling cuisine status', error);
    res.status(500).json({ message: 'Failed to toggle cuisine status' });
  }
});

// ============================================
// RESTAURANT CUISINES
// ============================================

// GET /api/admin/restaurants/:id/cuisines - Get restaurant cuisines
router.get('/restaurants/:id/cuisines', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const cuisines = await db
      .select({
        id: cuisineTypes.id,
        name: cuisineTypes.name,
        slug: cuisineTypes.slug,
        iconUrl: cuisineTypes.iconUrl,
      })
      .from(restaurantCuisines)
      .innerJoin(cuisineTypes, eq(restaurantCuisines.cuisineId, cuisineTypes.id))
      .where(eq(restaurantCuisines.restaurantId, id));
    
    res.json(cuisines);
  } catch (error) {
    logError('Error fetching restaurant cuisines', error);
    res.status(500).json({ message: 'Failed to fetch restaurant cuisines' });
  }
});

// PUT /api/admin/restaurants/:id/cuisines - Update restaurant cuisines
router.put('/restaurants/:id/cuisines', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { cuisineIds } = req.body as { cuisineIds: string[] };
    
    // Delete existing cuisines
    await db
      .delete(restaurantCuisines)
      .where(eq(restaurantCuisines.restaurantId, id));
    
    // Insert new cuisines
    if (cuisineIds && cuisineIds.length > 0) {
      await db
        .insert(restaurantCuisines)
        .values(
          cuisineIds.map(cuisineId => ({
            restaurantId: id,
            cuisineId,
            createdAt: new Date(),
          }))
        );
    }
    
    logInfo('[Admin] Restaurant cuisines updated', { restaurantId: id, cuisineCount: cuisineIds.length });
    res.json({ message: 'Cuisines updated successfully' });
  } catch (error) {
    logError('Error updating restaurant cuisines', error);
    res.status(500).json({ message: 'Failed to update cuisines' });
  }
});

// ============================================
// FEATURED RESTAURANTS
// ============================================

// GET /api/admin/marketplace/featured - List all featured restaurants
router.get('/featured', async (req: Request, res: Response) => {
  try {
    const featured = await db
      .select({
        id: featuredRestaurants.id,
        restaurantId: featuredRestaurants.restaurantId,
        featuredPosition: featuredRestaurants.featuredPosition,
        startsAt: featuredRestaurants.startsAt,
        endsAt: featuredRestaurants.endsAt,
        isActive: featuredRestaurants.isActive,
        createdBy: featuredRestaurants.createdBy,
        createdAt: featuredRestaurants.createdAt,
        updatedAt: featuredRestaurants.updatedAt,
        restaurant: {
          id: restaurants.id,
          name: restaurants.name,
          slug: restaurants.slug,
          logoUrl: restaurants.logoUrl,
          coverImageUrl: restaurants.coverImageUrl,
        },
      })
      .from(featuredRestaurants)
      .leftJoin(restaurants, eq(featuredRestaurants.restaurantId, restaurants.id))
      .orderBy(asc(featuredRestaurants.featuredPosition));
    
    res.json(featured);
  } catch (error) {
    logError('Error fetching featured restaurants', error);
    res.status(500).json({ message: 'Failed to fetch featured restaurants' });
  }
});

// POST /api/admin/marketplace/featured - Add featured restaurant
router.post('/featured', async (req: any, res: Response) => {
  try {
    const data = req.body as InsertFeaturedRestaurant;
    const userId = req.user?.id;
    
    const [featured] = await db
      .insert(featuredRestaurants)
      .values({
        ...data,
        createdBy: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    
    logInfo('[Admin] Restaurant featured', { restaurantId: data.restaurantId, position: data.featuredPosition });
    res.json(featured);
  } catch (error) {
    logError('Error featuring restaurant', error);
    res.status(500).json({ message: 'Failed to feature restaurant' });
  }
});

// PUT /api/admin/marketplace/featured/:id - Update featured restaurant
router.put('/featured/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = req.body;
    
    const [featured] = await db
      .update(featuredRestaurants)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(featuredRestaurants.id, id))
      .returning();
    
    if (!featured) {
      return res.status(404).json({ message: 'Featured restaurant not found' });
    }
    
    logInfo('[Admin] Featured restaurant updated', { featuredId: id });
    res.json(featured);
  } catch (error) {
    logError('Error updating featured restaurant', error);
    res.status(500).json({ message: 'Failed to update featured restaurant' });
  }
});

// DELETE /api/admin/marketplace/featured/:id - Remove featured restaurant
router.delete('/featured/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    await db
      .delete(featuredRestaurants)
      .where(eq(featuredRestaurants.id, id));
    
    logInfo('[Admin] Featured restaurant removed', { featuredId: id });
    res.json({ message: 'Featured restaurant removed successfully' });
  } catch (error) {
    logError('Error removing featured restaurant', error);
    res.status(500).json({ message: 'Failed to remove featured restaurant' });
  }
});

// PUT /api/admin/marketplace/featured/:id/toggle - Toggle featured status
router.put('/featured/:id/toggle', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const [current] = await db
      .select()
      .from(featuredRestaurants)
      .where(eq(featuredRestaurants.id, id))
      .limit(1);
    
    if (!current) {
      return res.status(404).json({ message: 'Featured restaurant not found' });
    }
    
    const [featured] = await db
      .update(featuredRestaurants)
      .set({ 
        isActive: !current.isActive,
        updatedAt: new Date(),
      })
      .where(eq(featuredRestaurants.id, id))
      .returning();
    
    res.json(featured);
  } catch (error) {
    logError('Error toggling featured status', error);
    res.status(500).json({ message: 'Failed to toggle featured status' });
  }
});

// ============================================
// PROMOTIONAL BANNERS
// ============================================

// GET /api/admin/marketplace/banners - List all banners
router.get('/banners', async (req: Request, res: Response) => {
  try {
    const banners = await db
      .select()
      .from(marketplaceBanners)
      .orderBy(asc(marketplaceBanners.displayOrder), desc(marketplaceBanners.createdAt));
    
    res.json(banners);
  } catch (error) {
    logError('Error fetching marketplace banners', error);
    res.status(500).json({ message: 'Failed to fetch banners' });
  }
});

// POST /api/admin/marketplace/banners - Create banner
router.post('/banners', async (req: Request, res: Response) => {
  try {
    const data = req.body as InsertMarketplaceBanner;
    
    const [banner] = await db
      .insert(marketplaceBanners)
      .values({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    
    logInfo('[Admin] Marketplace banner created', { bannerId: banner.id });
    res.json(banner);
  } catch (error) {
    logError('Error creating marketplace banner', error);
    res.status(500).json({ message: 'Failed to create banner' });
  }
});

// PUT /api/admin/marketplace/banners/:id - Update banner
router.put('/banners/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = req.body;
    
    const [banner] = await db
      .update(marketplaceBanners)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(marketplaceBanners.id, id))
      .returning();
    
    if (!banner) {
      return res.status(404).json({ message: 'Banner not found' });
    }
    
    logInfo('[Admin] Marketplace banner updated', { bannerId: id });
    res.json(banner);
  } catch (error) {
    logError('Error updating marketplace banner', error);
    res.status(500).json({ message: 'Failed to update banner' });
  }
});

// DELETE /api/admin/marketplace/banners/:id - Delete banner
router.delete('/banners/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    await db
      .delete(marketplaceBanners)
      .where(eq(marketplaceBanners.id, id));
    
    logInfo('[Admin] Marketplace banner deleted', { bannerId: id });
    res.json({ message: 'Banner deleted successfully' });
  } catch (error) {
    logError('Error deleting marketplace banner', error);
    res.status(500).json({ message: 'Failed to delete banner' });
  }
});

// PUT /api/admin/marketplace/banners/:id/toggle - Toggle banner active status
router.put('/banners/:id/toggle', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const [current] = await db
      .select()
      .from(marketplaceBanners)
      .where(eq(marketplaceBanners.id, id))
      .limit(1);
    
    if (!current) {
      return res.status(404).json({ message: 'Banner not found' });
    }
    
    const [banner] = await db
      .update(marketplaceBanners)
      .set({ 
        isActive: !current.isActive,
        updatedAt: new Date(),
      })
      .where(eq(marketplaceBanners.id, id))
      .returning();
    
    res.json(banner);
  } catch (error) {
    logError('Error toggling banner status', error);
    res.status(500).json({ message: 'Failed to toggle banner status' });
  }
});

// ============================================
// MARKETPLACE SETTINGS
// ============================================

// GET /api/admin/marketplace/settings - Get all settings
router.get('/settings', async (req: Request, res: Response) => {
  try {
    const settings = await db
      .select()
      .from(marketplaceSettings)
      .orderBy(asc(marketplaceSettings.category), asc(marketplaceSettings.key));
    
    res.json(settings);
  } catch (error) {
    logError('Error fetching marketplace settings', error);
    res.status(500).json({ message: 'Failed to fetch settings' });
  }
});

// PUT /api/admin/marketplace/settings - Update settings
router.put('/settings', async (req: any, res: Response) => {
  try {
    const settings = req.body as Array<{ key: string; value: string }>;
    const userId = req.user?.id;
    
    // Update each setting
    for (const setting of settings) {
      await db
        .update(marketplaceSettings)
        .set({
          value: setting.value,
          updatedBy: userId,
          updatedAt: new Date(),
        })
        .where(eq(marketplaceSettings.key, setting.key));
    }
    
    logInfo('[Admin] Marketplace settings updated', { count: settings.length });
    res.json({ message: 'Settings updated successfully' });
  } catch (error) {
    logError('Error updating marketplace settings', error);
    res.status(500).json({ message: 'Failed to update settings' });
  }
});

// POST /api/admin/marketplace/settings - Create new setting
router.post('/settings', async (req: any, res: Response) => {
  try {
    const data = req.body as InsertMarketplaceSetting;
    const userId = req.user?.id;
    
    const [setting] = await db
      .insert(marketplaceSettings)
      .values({
        ...data,
        updatedBy: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    
    logInfo('[Admin] Marketplace setting created', { key: setting.key });
    res.json(setting);
  } catch (error) {
    logError('Error creating marketplace setting', error);
    res.status(500).json({ message: 'Failed to create setting' });
  }
});

export default router;
