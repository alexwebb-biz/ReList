import { Router, Response } from 'express';
import { z } from 'zod';
import * as alertsService from '../services/alertsService.js';
import { sendSuccess, sendError, sendPaginated } from '../utils/response.js';
import { authenticateToken } from '../middleware/auth.js';
import { AuthenticatedRequest } from '../types/index.js';
import { processAlert } from '../services/scraperService.js';
import { queueAlert, isQueueEnabled } from '../queues/alertQueue.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Validation schemas
const createAlertSchema = z.object({
  name: z.string().min(1, 'Alert name is required'),
  keywords: z.array(z.string()).min(1, 'At least one keyword is required'),
  exclude_keywords: z.array(z.string()).optional(),
  platforms: z.array(z.string()).min(1, 'At least one platform is required'),
  categories: z.array(z.string()).optional(),
  price_min: z.number().min(0).optional(),
  price_max: z.number().min(0).optional(),
  condition: z.array(z.string()).optional(),
  radius_miles: z.number().min(1).max(100).optional(),
  location_postcode: z.string().optional(),
  check_frequency_minutes: z.number().min(15).max(1440).optional(),
  notification_channels: z.array(z.string()).optional(),
});

const updateAlertSchema = createAlertSchema.partial().extend({
  is_active: z.boolean().optional(),
});

// GET /api/alerts - List user's alerts
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      sendError(res, 'UNAUTHORIZED', 'User not authenticated', 401);
      return;
    }

    const alerts = await alertsService.getAlerts(req.user.id);
    sendSuccess(res, alerts);
  } catch (error) {
    sendError(res, 'FETCH_ERROR', error instanceof Error ? error.message : 'Failed to fetch alerts', 500);
  }
});

// POST /api/alerts - Create new alert
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      sendError(res, 'UNAUTHORIZED', 'User not authenticated', 401);
      return;
    }

    const validatedData = createAlertSchema.parse(req.body);
    const alert = await alertsService.createAlert(req.user.id, validatedData);
    sendSuccess(res, alert, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0];
      sendError(res, 'VALIDATION_ERROR', firstError.message, 400, firstError.path[0] as string);
      return;
    }
    sendError(res, 'CREATE_ERROR', error instanceof Error ? error.message : 'Failed to create alert', 500);
  }
});

// GET /api/alerts/:id - Get single alert
router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      sendError(res, 'UNAUTHORIZED', 'User not authenticated', 401);
      return;
    }

    const alert = await alertsService.getAlertById(req.params.id, req.user.id);
    if (!alert) {
      sendError(res, 'NOT_FOUND', 'Alert not found', 404);
      return;
    }

    sendSuccess(res, alert);
  } catch (error) {
    sendError(res, 'FETCH_ERROR', error instanceof Error ? error.message : 'Failed to fetch alert', 500);
  }
});

// PATCH /api/alerts/:id - Update alert
router.patch('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      sendError(res, 'UNAUTHORIZED', 'User not authenticated', 401);
      return;
    }

    const validatedData = updateAlertSchema.parse(req.body);
    const alert = await alertsService.updateAlert(req.params.id, req.user.id, validatedData);
    sendSuccess(res, alert);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0];
      sendError(res, 'VALIDATION_ERROR', firstError.message, 400, firstError.path[0] as string);
      return;
    }
    if (error instanceof Error && error.message === 'Alert not found') {
      sendError(res, 'NOT_FOUND', error.message, 404);
      return;
    }
    sendError(res, 'UPDATE_ERROR', error instanceof Error ? error.message : 'Failed to update alert', 500);
  }
});

// DELETE /api/alerts/:id - Delete alert
router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      sendError(res, 'UNAUTHORIZED', 'User not authenticated', 401);
      return;
    }

    await alertsService.deleteAlert(req.params.id, req.user.id);
    sendSuccess(res, { message: 'Alert deleted successfully' });
  } catch (error) {
    if (error instanceof Error && error.message === 'Alert not found') {
      sendError(res, 'NOT_FOUND', error.message, 404);
      return;
    }
    sendError(res, 'DELETE_ERROR', error instanceof Error ? error.message : 'Failed to delete alert', 500);
  }
});

// POST /api/alerts/:id/pause - Pause alert
router.post('/:id/pause', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      sendError(res, 'UNAUTHORIZED', 'User not authenticated', 401);
      return;
    }

    const alert = await alertsService.pauseAlert(req.params.id, req.user.id);
    sendSuccess(res, alert);
  } catch (error) {
    if (error instanceof Error && error.message === 'Alert not found') {
      sendError(res, 'NOT_FOUND', error.message, 404);
      return;
    }
    sendError(res, 'UPDATE_ERROR', error instanceof Error ? error.message : 'Failed to pause alert', 500);
  }
});

// POST /api/alerts/:id/resume - Resume alert
router.post('/:id/resume', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      sendError(res, 'UNAUTHORIZED', 'User not authenticated', 401);
      return;
    }

    const alert = await alertsService.resumeAlert(req.params.id, req.user.id);
    sendSuccess(res, alert);
  } catch (error) {
    if (error instanceof Error && error.message === 'Alert not found') {
      sendError(res, 'NOT_FOUND', error.message, 404);
      return;
    }
    sendError(res, 'UPDATE_ERROR', error instanceof Error ? error.message : 'Failed to resume alert', 500);
  }
});

// POST /api/alerts/:id/run - Manually trigger scraping for an alert
router.post('/:id/run', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      sendError(res, 'UNAUTHORIZED', 'User not authenticated', 401);
      return;
    }

    // Check alert exists and belongs to user
    const alert = await alertsService.getAlertById(req.params.id, req.user.id);
    if (!alert) {
      sendError(res, 'NOT_FOUND', 'Alert not found', 404);
      return;
    }

    // If Redis/queue is available, use it; otherwise run directly
    if (isQueueEnabled()) {
      await queueAlert(req.params.id, req.user.id);
      sendSuccess(res, { message: 'Alert queued for processing', queued: true });
    } else {
      // Run scraper directly (synchronous for dev without Redis)
      console.log(`Manually running scraper for alert ${req.params.id}`);
      const results = await processAlert(req.params.id, req.user.id);
      sendSuccess(res, {
        message: `Scraping complete. Found ${results.length} new items.`,
        queued: false,
        resultsFound: results.length
      });
    }
  } catch (error) {
    console.error('Error running alert:', error);
    sendError(res, 'SCRAPE_ERROR', error instanceof Error ? error.message : 'Failed to run alert', 500);
  }
});

// GET /api/alerts/:id/results - Get alert results (paginated)
router.get('/:id/results', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      sendError(res, 'UNAUTHORIZED', 'User not authenticated', 401);
      return;
    }

    const page = parseInt(req.query.page as string) || 1;
    const perPage = parseInt(req.query.per_page as string) || 20;

    const { results, total } = await alertsService.getAlertResults(
      req.params.id,
      req.user.id,
      page,
      perPage
    );

    sendPaginated(res, results, { page, per_page: perPage, total });
  } catch (error) {
    if (error instanceof Error && error.message === 'Alert not found') {
      sendError(res, 'NOT_FOUND', error.message, 404);
      return;
    }
    sendError(res, 'FETCH_ERROR', error instanceof Error ? error.message : 'Failed to fetch results', 500);
  }
});

export default router;
