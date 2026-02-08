import { Router, Response } from 'express';
import { z } from 'zod';
import * as activityLogService from '../services/activityLogService.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { authenticateToken } from '../middleware/auth.js';
import { AuthenticatedRequest } from '../types/index.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Validation schemas
const createNoteSchema = z.object({
  content: z.string().min(1, 'Note content is required').max(2000, 'Note must be under 2000 characters'),
});

// GET /api/inventory/:id/activity-logs - Get activity logs for an item
router.get('/:id/activity-logs', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      sendError(res, 'UNAUTHORIZED', 'User not authenticated', 401);
      return;
    }

    const limit = parseInt(req.query.limit as string) || 50;
    const logs = await activityLogService.getActivityLogs(req.params.id, req.user.id, limit);
    sendSuccess(res, logs);
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      sendError(res, 'NOT_FOUND', error.message, 404);
      return;
    }
    sendError(res, 'FETCH_ERROR', error instanceof Error ? error.message : 'Failed to fetch activity logs', 500);
  }
});

// POST /api/inventory/:id/notes - Add a note to an item
router.post('/:id/notes', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      sendError(res, 'UNAUTHORIZED', 'User not authenticated', 401);
      return;
    }

    const validatedData = createNoteSchema.parse(req.body);
    const note = await activityLogService.addNote(req.params.id, req.user.id, validatedData.content);
    sendSuccess(res, note, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.issues[0];
      sendError(res, 'VALIDATION_ERROR', firstError.message, 400, firstError.path[0] as string);
      return;
    }
    if (error instanceof Error && error.message.includes('not found')) {
      sendError(res, 'NOT_FOUND', error.message, 404);
      return;
    }
    sendError(res, 'CREATE_ERROR', error instanceof Error ? error.message : 'Failed to add note', 500);
  }
});

// DELETE /api/inventory/activity-logs/:logId - Delete an activity log
router.delete('/activity-logs/:logId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      sendError(res, 'UNAUTHORIZED', 'User not authenticated', 401);
      return;
    }

    await activityLogService.deleteActivityLog(req.params.logId, req.user.id);
    sendSuccess(res, { message: 'Activity log deleted successfully' });
  } catch (error) {
    sendError(res, 'DELETE_ERROR', error instanceof Error ? error.message : 'Failed to delete activity log', 500);
  }
});

export default router;
