import { Router, Response } from 'express';
import { z } from 'zod';
import * as inventoryService from '../services/inventoryService.js';
import { calculateFees, getSupportedPlatforms } from '../services/feeCalculatorService.js';
import { sendSuccess, sendError, sendPaginated } from '../utils/response.js';
import { authenticateToken } from '../middleware/auth.js';
import { AuthenticatedRequest } from '../types/index.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Validation schemas
const createInventorySchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  category: z.string().optional(),
  brand: z.string().optional(),
  condition: z.string().optional(),
  purchase_price: z.number().min(0).optional(),
  purchase_date: z.string().optional(),
  purchase_platform: z.string().optional(),
  purchase_location: z.string().optional(),
  selling_price: z.number().min(0).optional(),
  images: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

const updateInventorySchema = createInventorySchema.partial().extend({
  status: z.enum(['draft', 'listed', 'sold', 'archived']).optional(),
  sold_price: z.number().min(0).optional(),
  sold_date: z.string().optional(),
  sold_platform: z.string().optional(),
  fees_total: z.number().min(0).optional(),
  postage_cost: z.number().min(0).optional(),
});

const markSoldSchema = z.object({
  sold_price: z.number().min(0, 'Sold price is required'),
  sold_platform: z.string().optional(),
  sold_date: z.string().optional(),
  fees_total: z.number().min(0).optional(),
  postage_cost: z.number().min(0).optional(),
});

// GET /api/inventory - List inventory items
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      sendError(res, 'UNAUTHORIZED', 'User not authenticated', 401);
      return;
    }

    const page = parseInt(req.query.page as string) || 1;
    const perPage = parseInt(req.query.per_page as string) || 20;
    const status = req.query.status as string | undefined;

    const { items, total } = await inventoryService.getInventory(
      req.user.id,
      status,
      page,
      perPage
    );

    sendPaginated(res, items, { page, per_page: perPage, total });
  } catch (error) {
    sendError(res, 'FETCH_ERROR', error instanceof Error ? error.message : 'Failed to fetch inventory', 500);
  }
});

// GET /api/inventory/stats - Get inventory statistics
router.get('/stats', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      sendError(res, 'UNAUTHORIZED', 'User not authenticated', 401);
      return;
    }

    const stats = await inventoryService.getInventoryStats(req.user.id);
    sendSuccess(res, stats);
  } catch (error) {
    sendError(res, 'FETCH_ERROR', error instanceof Error ? error.message : 'Failed to fetch stats', 500);
  }
});

// GET /api/inventory/fees/platforms - Get supported platforms and their fee info
router.get('/fees/platforms', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const platforms = getSupportedPlatforms();
    sendSuccess(res, platforms);
  } catch (error) {
    sendError(res, 'FETCH_ERROR', error instanceof Error ? error.message : 'Failed to fetch platforms', 500);
  }
});

// POST /api/inventory/fees/calculate - Calculate fees for a sale
router.post('/fees/calculate', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const schema = z.object({
      price: z.number().min(0),
      platform: z.string().min(1),
      postage: z.number().min(0).optional(),
    });

    const { price, platform, postage } = schema.parse(req.body);
    const breakdown = calculateFees(price, platform, postage || 0);
    sendSuccess(res, breakdown);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.issues[0];
      sendError(res, 'VALIDATION_ERROR', firstError.message, 400);
      return;
    }
    sendError(res, 'CALCULATION_ERROR', error instanceof Error ? error.message : 'Failed to calculate fees', 500);
  }
});

// POST /api/inventory - Add inventory item
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      sendError(res, 'UNAUTHORIZED', 'User not authenticated', 401);
      return;
    }

    const validatedData = createInventorySchema.parse(req.body);
    const item = await inventoryService.createInventoryItem(req.user.id, validatedData);
    sendSuccess(res, item, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.issues[0];
      sendError(res, 'VALIDATION_ERROR', firstError.message, 400, firstError.path[0] as string);
      return;
    }
    sendError(res, 'CREATE_ERROR', error instanceof Error ? error.message : 'Failed to create item', 500);
  }
});

// GET /api/inventory/:id - Get single item
router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      sendError(res, 'UNAUTHORIZED', 'User not authenticated', 401);
      return;
    }

    const item = await inventoryService.getInventoryById(req.params.id, req.user.id);
    if (!item) {
      sendError(res, 'NOT_FOUND', 'Item not found', 404);
      return;
    }

    sendSuccess(res, item);
  } catch (error) {
    sendError(res, 'FETCH_ERROR', error instanceof Error ? error.message : 'Failed to fetch item', 500);
  }
});

// PATCH /api/inventory/:id - Update item
router.patch('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      sendError(res, 'UNAUTHORIZED', 'User not authenticated', 401);
      return;
    }

    const validatedData = updateInventorySchema.parse(req.body);
    const item = await inventoryService.updateInventoryItem(req.params.id, req.user.id, validatedData);
    sendSuccess(res, item);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.issues[0];
      sendError(res, 'VALIDATION_ERROR', firstError.message, 400, firstError.path[0] as string);
      return;
    }
    if (error instanceof Error && error.message === 'Item not found') {
      sendError(res, 'NOT_FOUND', error.message, 404);
      return;
    }
    sendError(res, 'UPDATE_ERROR', error instanceof Error ? error.message : 'Failed to update item', 500);
  }
});

// DELETE /api/inventory/:id - Delete item
router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      sendError(res, 'UNAUTHORIZED', 'User not authenticated', 401);
      return;
    }

    await inventoryService.deleteInventoryItem(req.params.id, req.user.id);
    sendSuccess(res, { message: 'Item deleted successfully' });
  } catch (error) {
    if (error instanceof Error && error.message === 'Item not found') {
      sendError(res, 'NOT_FOUND', error.message, 404);
      return;
    }
    sendError(res, 'DELETE_ERROR', error instanceof Error ? error.message : 'Failed to delete item', 500);
  }
});

// POST /api/inventory/:id/sell - Mark as sold
router.post('/:id/sell', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      sendError(res, 'UNAUTHORIZED', 'User not authenticated', 401);
      return;
    }

    const validatedData = markSoldSchema.parse(req.body);
    const item = await inventoryService.markAsSold(req.params.id, req.user.id, validatedData);
    sendSuccess(res, item);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.issues[0];
      sendError(res, 'VALIDATION_ERROR', firstError.message, 400, firstError.path[0] as string);
      return;
    }
    if (error instanceof Error && error.message === 'Item not found') {
      sendError(res, 'NOT_FOUND', error.message, 404);
      return;
    }
    sendError(res, 'UPDATE_ERROR', error instanceof Error ? error.message : 'Failed to mark as sold', 500);
  }
});

export default router;
