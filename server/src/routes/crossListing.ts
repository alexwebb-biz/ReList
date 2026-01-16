/**
 * Cross-Platform Listing Routes
 * API endpoints for managing listings across multiple marketplaces
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticateToken } from '../middleware/auth.js';
import { success, error as sendError, paginated } from '../utils/response.js';
import {
  getUserCrossListings,
  getInventoryCrossListings,
  createCrossListings,
  updateCrossListing,
  deleteCrossListing,
  markSoldAndSync,
  bulkUpdateListings,
  getCrossListingStats,
  generatePlatformListing,
  generateCopyPasteListing,
  Platform,
  PLATFORM_CONFIG,
} from '../services/crossListingService.js';
import supabase from '../config/supabase.js';

const router = Router();

// Validation schemas
const createCrossListingSchema = z.object({
  inventory_id: z.string().uuid(),
  platforms: z.array(z.enum(['eBay', 'Vinted', 'Depop', 'Facebook', 'Gumtree', 'Shpock'])).min(1),
  custom_title: z.string().optional(),
  custom_description: z.string().optional(),
  custom_price: z.number().positive().optional(),
});

const updateCrossListingSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  price: z.number().positive().optional(),
  status: z.enum(['draft', 'active', 'ended']).optional(),
  url: z.string().url().optional(),
  external_listing_id: z.string().optional(),
});

const markSoldSchema = z.object({
  inventory_id: z.string().uuid(),
  sold_platform: z.enum(['eBay', 'Vinted', 'Depop', 'Facebook', 'Gumtree', 'Shpock']),
  sold_price: z.number().positive(),
});

const bulkUpdateSchema = z.object({
  inventory_id: z.string().uuid(),
  price: z.number().positive().optional(),
  status: z.enum(['active', 'ended']).optional(),
  platforms: z.array(z.enum(['eBay', 'Vinted', 'Depop', 'Facebook', 'Gumtree', 'Shpock'])).optional(),
});

// GET /api/cross-listings - Get all cross-listings grouped by inventory
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { status } = req.query;

    const groups = await getUserCrossListings(
      userId,
      status as string | undefined
    );

    res.json(success(groups));
  } catch (err) {
    console.error('Error in GET /cross-listings:', err);
    res.status(500).json(sendError('SERVER_ERROR', 'Failed to fetch cross-listings'));
  }
});

// GET /api/cross-listings/stats - Get cross-listing statistics
router.get('/stats', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const stats = await getCrossListingStats(userId);
    res.json(success(stats));
  } catch (err) {
    console.error('Error in GET /cross-listings/stats:', err);
    res.status(500).json(sendError('SERVER_ERROR', 'Failed to fetch stats'));
  }
});

// GET /api/cross-listings/platforms - Get platform configuration
router.get('/platforms', authenticateToken, async (_req: Request, res: Response) => {
  try {
    const platforms = Object.entries(PLATFORM_CONFIG).map(([key, config]) => ({
      id: key,
      ...config,
    }));
    res.json(success(platforms));
  } catch (err) {
    console.error('Error in GET /cross-listings/platforms:', err);
    res.status(500).json(sendError('SERVER_ERROR', 'Failed to fetch platforms'));
  }
});

// GET /api/cross-listings/inventory/:inventoryId - Get cross-listings for an inventory item
router.get('/inventory/:inventoryId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { inventoryId } = req.params;

    const listings = await getInventoryCrossListings(inventoryId, userId);
    res.json(success(listings));
  } catch (err) {
    console.error('Error in GET /cross-listings/inventory/:id:', err);
    res.status(500).json(sendError('SERVER_ERROR', 'Failed to fetch cross-listings'));
  }
});

// POST /api/cross-listings - Create cross-listings for multiple platforms
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const validatedData = createCrossListingSchema.parse(req.body);

    const listings = await createCrossListings(
      validatedData.inventory_id,
      userId,
      validatedData.platforms as Platform[],
      {
        title: validatedData.custom_title,
        description: validatedData.custom_description,
        price: validatedData.custom_price,
      }
    );

    res.status(201).json(success(listings));
  } catch (err) {
    if (err instanceof z.ZodError) {
      const firstError = err.issues[0];
      return res.status(400).json(sendError('VALIDATION_ERROR', firstError.message, 400, firstError.path?.[0] as string));
    }
    if (err instanceof Error) {
      return res.status(400).json(sendError('CREATE_ERROR', err.message));
    }
    console.error('Error in POST /cross-listings:', err);
    res.status(500).json(sendError('SERVER_ERROR', 'Failed to create cross-listings'));
  }
});

// POST /api/cross-listings/preview - Preview generated listing for a platform
router.post('/preview', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { inventory_id, platform } = req.body;

    if (!inventory_id || !platform) {
      return res.status(400).json(sendError('VALIDATION_ERROR', 'inventory_id and platform are required'));
    }

    // Get inventory item
    const { data: inventory, error: invError } = await supabase
      .from('inventory')
      .select('*')
      .eq('id', inventory_id)
      .eq('user_id', userId)
      .single();

    if (invError || !inventory) {
      return res.status(404).json(sendError('NOT_FOUND', 'Inventory item not found'));
    }

    const preview = await generatePlatformListing(inventory, platform as Platform);

    res.json(success({
      ...preview,
      platform,
      platform_config: PLATFORM_CONFIG[platform as Platform],
    }));
  } catch (err) {
    console.error('Error in POST /cross-listings/preview:', err);
    res.status(500).json(sendError('SERVER_ERROR', 'Failed to generate preview'));
  }
});

// PATCH /api/cross-listings/:id - Update a cross-listing
router.patch('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const validatedData = updateCrossListingSchema.parse(req.body);

    const listing = await updateCrossListing(id, userId, validatedData);
    res.json(success(listing));
  } catch (err) {
    if (err instanceof z.ZodError) {
      const firstError = err.issues[0];
      return res.status(400).json(sendError('VALIDATION_ERROR', firstError.message, 400, firstError.path?.[0] as string));
    }
    if (err instanceof Error && err.message.includes('not found')) {
      return res.status(404).json(sendError('NOT_FOUND', err.message));
    }
    console.error('Error in PATCH /cross-listings/:id:', err);
    res.status(500).json(sendError('SERVER_ERROR', 'Failed to update cross-listing'));
  }
});

// DELETE /api/cross-listings/:id - Delete a cross-listing
router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    await deleteCrossListing(id, userId);
    res.json(success({ deleted: true }));
  } catch (err) {
    if (err instanceof Error && err.message.includes('not found')) {
      return res.status(404).json(sendError('NOT_FOUND', err.message));
    }
    console.error('Error in DELETE /cross-listings/:id:', err);
    res.status(500).json(sendError('SERVER_ERROR', 'Failed to delete cross-listing'));
  }
});

// POST /api/cross-listings/mark-sold - Mark item as sold and sync across platforms
router.post('/mark-sold', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const validatedData = markSoldSchema.parse(req.body);

    const result = await markSoldAndSync(
      validatedData.inventory_id,
      userId,
      validatedData.sold_platform as Platform,
      validatedData.sold_price
    );

    res.json(success({
      inventory: result.inventory,
      delisted_platforms: result.delistedPlatforms,
      message: result.delistedPlatforms.length > 0
        ? `Item marked as sold. Auto-delisted from: ${result.delistedPlatforms.join(', ')}`
        : 'Item marked as sold.',
    }));
  } catch (err) {
    if (err instanceof z.ZodError) {
      const firstError = err.issues[0];
      return res.status(400).json(sendError('VALIDATION_ERROR', firstError.message, 400, firstError.path?.[0] as string));
    }
    console.error('Error in POST /cross-listings/mark-sold:', err);
    res.status(500).json(sendError('SERVER_ERROR', 'Failed to mark as sold'));
  }
});

// POST /api/cross-listings/bulk-update - Bulk update listings
router.post('/bulk-update', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const validatedData = bulkUpdateSchema.parse(req.body);

    const listings = await bulkUpdateListings(
      validatedData.inventory_id,
      userId,
      {
        price: validatedData.price,
        status: validatedData.status,
      },
      validatedData.platforms as Platform[] | undefined
    );

    res.json(success({
      updated_count: listings.length,
      listings,
    }));
  } catch (err) {
    if (err instanceof z.ZodError) {
      const firstError = err.issues[0];
      return res.status(400).json(sendError('VALIDATION_ERROR', firstError.message, 400, firstError.path?.[0] as string));
    }
    console.error('Error in POST /cross-listings/bulk-update:', err);
    res.status(500).json(sendError('SERVER_ERROR', 'Failed to bulk update'));
  }
});

// GET /api/cross-listings/:id/copy-paste - Get copy-paste ready listing
router.get('/:id/copy-paste', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    // Get listing with inventory
    const { data: listing, error: listingError } = await supabase
      .from('cross_listings')
      .select(`
        *,
        inventory:inventory_id (*)
      `)
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (listingError || !listing) {
      return res.status(404).json(sendError('NOT_FOUND', 'Cross-listing not found'));
    }

    const copyPasteText = generateCopyPasteListing(listing, listing.inventory);

    res.json(success({
      text: copyPasteText,
      listing,
    }));
  } catch (err) {
    console.error('Error in GET /cross-listings/:id/copy-paste:', err);
    res.status(500).json(sendError('SERVER_ERROR', 'Failed to generate copy-paste listing'));
  }
});

export default router;
