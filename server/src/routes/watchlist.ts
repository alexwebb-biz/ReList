import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticateToken } from '../middleware/auth.js';
import { success, error as sendError } from '../utils/response.js';
import * as watchlistService from '../services/watchlistService.js';

const router = Router();

// Validation schemas
const addToWatchlistSchema = z.object({
  alert_result_id: z.string().uuid().optional(),
  external_id: z.string().min(1),
  platform: z.string().min(1).max(50),
  title: z.string().min(1).max(500),
  url: z.string().url(),
  image_url: z.string().url().optional(),
  price: z.number().positive(),
  target_price: z.number().positive().optional(),
  currency: z.string().max(10).optional(),
});

const updateTargetPriceSchema = z.object({
  target_price: z.number().positive().nullable(),
});

// GET /api/watchlist - Get all watched items
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const activeOnly = req.query.active !== 'false';

    const items = await watchlistService.getWatchedItems(userId, activeOnly);
    res.json(success(items));
  } catch (err) {
    console.error('Error in GET /watchlist:', err);
    res.status(500).json(sendError('SERVER_ERROR', 'Failed to fetch watchlist'));
  }
});

// GET /api/watchlist/count - Get watchlist count
router.get('/count', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const count = await watchlistService.getWatchlistCount(userId);
    res.json(success({ count }));
  } catch (err) {
    console.error('Error in GET /watchlist/count:', err);
    res.status(500).json(sendError('SERVER_ERROR', 'Failed to fetch count'));
  }
});

// GET /api/watchlist/price-drops - Get items with price drops
router.get('/price-drops', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const items = await watchlistService.getWatchedItems(userId, true);
    const priceDrops = items.filter(item => item.current_price < item.initial_price);
    res.json(success(priceDrops));
  } catch (err) {
    console.error('Error in GET /watchlist/price-drops:', err);
    res.status(500).json(sendError('SERVER_ERROR', 'Failed to fetch price drops'));
  }
});

// GET /api/watchlist/:id - Get single watched item with history
router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const item = await watchlistService.getWatchedItemWithHistory(id, userId);

    if (!item) {
      return res.status(404).json(sendError('NOT_FOUND', 'Item not found'));
    }

    res.json(success(item));
  } catch (err) {
    console.error('Error in GET /watchlist/:id:', err);
    res.status(500).json(sendError('SERVER_ERROR', 'Failed to fetch item'));
  }
});

// POST /api/watchlist - Add item to watchlist
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const validatedData = addToWatchlistSchema.parse(req.body);

    const item = await watchlistService.addToWatchlist(userId, validatedData);
    res.status(201).json(success(item));
  } catch (err) {
    if (err instanceof z.ZodError) {
      const firstError = err.issues[0];
      return res.status(400).json(sendError('VALIDATION_ERROR', firstError.message));
    }
    if (err instanceof Error && err.message === 'Already watching this item') {
      return res.status(400).json(sendError('DUPLICATE', err.message));
    }
    console.error('Error in POST /watchlist:', err);
    res.status(500).json(sendError('SERVER_ERROR', 'Failed to add to watchlist'));
  }
});

// PATCH /api/watchlist/:id/target - Update target price
router.patch('/:id/target', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { target_price } = updateTargetPriceSchema.parse(req.body);

    const item = await watchlistService.updateTargetPrice(id, userId, target_price);
    res.json(success(item));
  } catch (err) {
    if (err instanceof z.ZodError) {
      const firstError = err.issues[0];
      return res.status(400).json(sendError('VALIDATION_ERROR', firstError.message));
    }
    console.error('Error in PATCH /watchlist/:id/target:', err);
    res.status(500).json(sendError('SERVER_ERROR', 'Failed to update target price'));
  }
});

// DELETE /api/watchlist/:id - Remove from watchlist
router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    await watchlistService.removeFromWatchlist(id, userId);
    res.json(success({ removed: true }));
  } catch (err) {
    console.error('Error in DELETE /watchlist/:id:', err);
    res.status(500).json(sendError('SERVER_ERROR', 'Failed to remove from watchlist'));
  }
});

export default router;
