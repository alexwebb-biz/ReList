import { Router, Request, Response } from 'express';
import supabase from '../config/supabase.js';
import { sendSuccess, sendError } from '../utils/response.js';

const router = Router();

// GET /api/health - Basic health check
router.get('/', (_req: Request, res: Response) => {
  sendSuccess(res, {
    status: 'healthy',
    service: 'relist-api',
    version: '1.0.0',
  });
});

// GET /api/health/db - Database connection check
router.get('/db', async (_req: Request, res: Response) => {
  try {
    const startTime = Date.now();

    // Simple query to test database connection
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1);

    const responseTime = Date.now() - startTime;

    if (error) {
      sendError(res, 'DB_ERROR', `Database error: ${error.message}`, 500);
      return;
    }

    sendSuccess(res, {
      status: 'connected',
      database: 'supabase',
      response_time_ms: responseTime,
    });
  } catch (error) {
    sendError(res, 'DB_CONNECTION_FAILED', 'Failed to connect to database', 500);
  }
});

export default router;
