import { Router, Response } from 'express';
import { z } from 'zod';
import * as resultsService from '../services/resultsService.js';
import { sendSuccess, sendError, sendPaginated } from '../utils/response.js';
import { authenticateToken } from '../middleware/auth.js';
import { AuthenticatedRequest } from '../types/index.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// GET /api/results - Get all results across alerts
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      sendError(res, 'UNAUTHORIZED', 'User not authenticated', 401);
      return;
    }

    const page = parseInt(req.query.page as string) || 1;
    const perPage = parseInt(req.query.per_page as string) || 20;
    const unreadOnly = req.query.unread === 'true';
    const platform = req.query.platform as string | undefined;

    const { results, total } = await resultsService.getAllResults(
      req.user.id,
      page,
      perPage,
      unreadOnly,
      platform
    );

    sendPaginated(res, results, { page, per_page: perPage, total });
  } catch (error) {
    sendError(res, 'FETCH_ERROR', error instanceof Error ? error.message : 'Failed to fetch results', 500);
  }
});

// GET /api/results/unread-count - Get count of unread results
router.get('/unread-count', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      sendError(res, 'UNAUTHORIZED', 'User not authenticated', 401);
      return;
    }

    const count = await resultsService.getUnreadCount(req.user.id);
    sendSuccess(res, { count });
  } catch (error) {
    sendError(res, 'FETCH_ERROR', error instanceof Error ? error.message : 'Failed to fetch count', 500);
  }
});

// GET /api/results/:id - Get single result
router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      sendError(res, 'UNAUTHORIZED', 'User not authenticated', 401);
      return;
    }

    const result = await resultsService.getResultById(req.params.id, req.user.id);
    if (!result) {
      sendError(res, 'NOT_FOUND', 'Result not found', 404);
      return;
    }

    sendSuccess(res, result);
  } catch (error) {
    sendError(res, 'FETCH_ERROR', error instanceof Error ? error.message : 'Failed to fetch result', 500);
  }
});

// PATCH /api/results/:id/read - Mark as read
router.patch('/:id/read', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      sendError(res, 'UNAUTHORIZED', 'User not authenticated', 401);
      return;
    }

    const result = await resultsService.markAsRead(req.params.id, req.user.id);
    sendSuccess(res, result);
  } catch (error) {
    if (error instanceof Error && error.message === 'Result not found') {
      sendError(res, 'NOT_FOUND', error.message, 404);
      return;
    }
    sendError(res, 'UPDATE_ERROR', error instanceof Error ? error.message : 'Failed to mark as read', 500);
  }
});

// POST /api/results/mark-read - Mark multiple as read
router.post('/mark-read', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      sendError(res, 'UNAUTHORIZED', 'User not authenticated', 401);
      return;
    }

    const schema = z.object({
      ids: z.array(z.string()).min(1, 'At least one ID required'),
    });

    const { ids } = schema.parse(req.body);
    const count = await resultsService.markMultipleAsRead(ids, req.user.id);
    sendSuccess(res, { marked_count: count });
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, 'VALIDATION_ERROR', error.issues[0].message, 400);
      return;
    }
    sendError(res, 'UPDATE_ERROR', error instanceof Error ? error.message : 'Failed to mark as read', 500);
  }
});

// POST /api/results/:id/save - Save to inventory
router.post('/:id/save', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      sendError(res, 'UNAUTHORIZED', 'User not authenticated', 401);
      return;
    }

    // Optional parameters for quick save with custom prices
    const options = {
      purchase_price: req.body.purchase_price,
      selling_price: req.body.selling_price,
      notes: req.body.notes,
    };

    const { inventoryId } = await resultsService.saveToInventory(req.params.id, req.user.id, options);
    sendSuccess(res, { inventory_id: inventoryId, message: 'Saved to inventory' }, 201);
  } catch (error) {
    if (error instanceof Error && error.message === 'Result not found') {
      sendError(res, 'NOT_FOUND', error.message, 404);
      return;
    }
    sendError(res, 'SAVE_ERROR', error instanceof Error ? error.message : 'Failed to save to inventory', 500);
  }
});

export default router;
