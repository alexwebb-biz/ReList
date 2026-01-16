import { Router, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase.js';
import { authenticateToken } from '../middleware/auth.js';
import { success, error as sendError, paginated } from '../utils/response.js';
import { AuthenticatedRequest } from '../types/index.js';

const router = Router();

// Validation schemas - matching existing DB structure
const createListingSchema = z.object({
  inventory_id: z.string().uuid(),
  platform: z.string().min(1).max(50),
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  price: z.number().positive(),
  url: z.string().url().optional(),
  external_id: z.string().optional(),
  status: z.enum(['active', 'ended', 'sold']).default('active'),
  notes: z.string().max(500).optional(),
});

const updateListingSchema = z.object({
  platform: z.string().min(1).max(50).optional(),
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  price: z.number().positive().optional(),
  url: z.string().url().optional(),
  external_id: z.string().optional(),
  status: z.enum(['active', 'ended', 'sold']).optional(),
  notes: z.string().max(500).optional(),
});

// GET /api/listings - Get all listings for user
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { page = '1', per_page = '20', status, inventory_id } = req.query;
    const pageNum = parseInt(page as string);
    const perPage = Math.min(parseInt(per_page as string), 100);
    const offset = (pageNum - 1) * perPage;

    let query = supabase
      .from('listings')
      .select(`
        *,
        inventory:inventory_id (
          id,
          title,
          images,
          status
        )
      `, { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    // Filter by status
    if (status && typeof status === 'string') {
      query = query.eq('status', status);
    }

    // Filter by inventory item
    if (inventory_id && typeof inventory_id === 'string') {
      query = query.eq('inventory_id', inventory_id);
    }

    const { data, error, count } = await query.range(offset, offset + perPage - 1);

    if (error) {
      console.error('Error fetching listings:', error);
      return res.status(500).json(sendError('DATABASE_ERROR', 'Failed to fetch listings'));
    }

    res.json(paginated(data || [], pageNum, perPage, count || 0));
  } catch (err) {
    console.error('Error in GET /listings:', err);
    res.status(500).json(sendError('SERVER_ERROR', 'Internal server error'));
  }
});

// GET /api/listings/:id - Get single listing
router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const { data, error } = await supabase
      .from('listings')
      .select(`
        *,
        inventory:inventory_id (
          id,
          title,
          description,
          images,
          status,
          purchase_price,
          selling_price
        )
      `)
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return res.status(404).json(sendError('NOT_FOUND', 'Listing not found'));
    }

    res.json(success(data));
  } catch (err) {
    console.error('Error in GET /listings/:id:', err);
    res.status(500).json(sendError('SERVER_ERROR', 'Internal server error'));
  }
});

// POST /api/listings - Create new listing
router.post('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    // Validate input
    const validatedData = createListingSchema.parse(req.body);

    // Verify inventory item belongs to user
    const { data: inventoryItem, error: invError } = await supabase
      .from('inventory')
      .select('id, title')
      .eq('id', validatedData.inventory_id)
      .eq('user_id', userId)
      .single();

    if (invError || !inventoryItem) {
      return res.status(404).json(sendError('NOT_FOUND', 'Inventory item not found'));
    }

    // Check for duplicate active listing on same platform
    const { data: existing } = await supabase
      .from('listings')
      .select('id')
      .eq('inventory_id', validatedData.inventory_id)
      .eq('platform', validatedData.platform)
      .eq('status', 'active')
      .single();

    if (existing) {
      return res.status(400).json(sendError('DUPLICATE', 'An active listing already exists on this platform'));
    }

    // Create listing
    const { data, error } = await supabase
      .from('listings')
      .insert({
        user_id: userId,
        ...validatedData,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating listing:', error);
      return res.status(500).json(sendError('DATABASE_ERROR', 'Failed to create listing'));
    }

    // Update inventory item status to 'listed' if it's still draft
    await supabase
      .from('inventory')
      .update({ status: 'listed', updated_at: new Date().toISOString() })
      .eq('id', validatedData.inventory_id)
      .eq('status', 'draft');

    res.status(201).json(success(data));
  } catch (err) {
    if (err instanceof z.ZodError) {
      const firstError = err.issues[0];
      return res.status(400).json(sendError('VALIDATION_ERROR', firstError.message, firstError.path?.[0] as string));
    }
    console.error('Error in POST /listings:', err);
    res.status(500).json(sendError('SERVER_ERROR', 'Internal server error'));
  }
});

// PATCH /api/listings/:id - Update listing
router.patch('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    // Validate input
    const validatedData = updateListingSchema.parse(req.body);

    // Verify listing belongs to user
    const { data: existing, error: findError } = await supabase
      .from('listings')
      .select('id, inventory_id')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (findError || !existing) {
      return res.status(404).json(sendError('NOT_FOUND', 'Listing not found'));
    }

    // Update listing
    const { data, error } = await supabase
      .from('listings')
      .update({
        ...validatedData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating listing:', error);
      return res.status(500).json(sendError('DATABASE_ERROR', 'Failed to update listing'));
    }

    res.json(success(data));
  } catch (err) {
    if (err instanceof z.ZodError) {
      const firstError = err.issues[0];
      return res.status(400).json(sendError('VALIDATION_ERROR', firstError.message, firstError.path?.[0] as string));
    }
    console.error('Error in PATCH /listings/:id:', err);
    res.status(500).json(sendError('SERVER_ERROR', 'Internal server error'));
  }
});

// DELETE /api/listings/:id - Delete listing
router.delete('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    // Verify listing belongs to user
    const { data: existing, error: findError } = await supabase
      .from('listings')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (findError || !existing) {
      return res.status(404).json(sendError('NOT_FOUND', 'Listing not found'));
    }

    // Delete listing
    const { error } = await supabase
      .from('listings')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting listing:', error);
      return res.status(500).json(sendError('DATABASE_ERROR', 'Failed to delete listing'));
    }

    res.json(success({ deleted: true }));
  } catch (err) {
    console.error('Error in DELETE /listings/:id:', err);
    res.status(500).json(sendError('SERVER_ERROR', 'Internal server error'));
  }
});

// GET /api/inventory/:id/listings - Get all listings for an inventory item
router.get('/inventory/:inventoryId', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { inventoryId } = req.params;

    // Verify inventory item belongs to user
    const { data: inventoryItem, error: invError } = await supabase
      .from('inventory')
      .select('id')
      .eq('id', inventoryId)
      .eq('user_id', userId)
      .single();

    if (invError || !inventoryItem) {
      return res.status(404).json(sendError('NOT_FOUND', 'Inventory item not found'));
    }

    // Get all listings for this inventory item
    const { data, error } = await supabase
      .from('listings')
      .select('*')
      .eq('inventory_id', inventoryId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching listings for inventory:', error);
      return res.status(500).json(sendError('DATABASE_ERROR', 'Failed to fetch listings'));
    }

    res.json(success(data || []));
  } catch (err) {
    console.error('Error in GET /listings/inventory/:inventoryId:', err);
    res.status(500).json(sendError('SERVER_ERROR', 'Internal server error'));
  }
});

export default router;
