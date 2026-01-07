import { Router, Response } from 'express';
import { z } from 'zod';
import supabase from '../config/supabase.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { authenticateToken } from '../middleware/auth.js';
import { AuthenticatedRequest } from '../types/index.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Validation schemas
const updateProfileSchema = z.object({
  full_name: z.string().min(1).optional(),
  location_postcode: z.string().max(10).optional(),
});

const notificationSettingsSchema = z.object({
  notification_email: z.boolean().optional(),
  notification_push: z.boolean().optional(),
  notification_telegram: z.boolean().optional(),
  telegram_chat_id: z.string().nullable().optional(),
  alert_frequency: z.enum(['instant', 'hourly', 'daily']).optional(),
});

// GET /api/user/profile - Get user profile
router.get('/profile', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      sendError(res, 'UNAUTHORIZED', 'User not authenticated', 401);
      return;
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, full_name, location_postcode, subscription_tier, subscription_status, ai_credits_remaining, created_at, last_login_at')
      .eq('id', req.user.id)
      .single();

    if (error || !user) {
      sendError(res, 'NOT_FOUND', 'User not found', 404);
      return;
    }

    sendSuccess(res, user);
  } catch (error) {
    sendError(res, 'FETCH_ERROR', error instanceof Error ? error.message : 'Failed to fetch profile', 500);
  }
});

// PATCH /api/user/profile - Update profile
router.patch('/profile', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      sendError(res, 'UNAUTHORIZED', 'User not authenticated', 401);
      return;
    }

    const validatedData = updateProfileSchema.parse(req.body);

    const { data: user, error } = await supabase
      .from('users')
      .update({
        ...validatedData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.user.id)
      .select('id, email, full_name, location_postcode, subscription_tier, subscription_status, ai_credits_remaining, created_at, last_login_at')
      .single();

    if (error || !user) {
      sendError(res, 'UPDATE_ERROR', error?.message || 'Failed to update profile', 500);
      return;
    }

    sendSuccess(res, user);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0];
      sendError(res, 'VALIDATION_ERROR', firstError.message, 400, firstError.path[0] as string);
      return;
    }
    sendError(res, 'UPDATE_ERROR', error instanceof Error ? error.message : 'Failed to update profile', 500);
  }
});

// GET /api/user/subscription - Get subscription details
router.get('/subscription', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      sendError(res, 'UNAUTHORIZED', 'User not authenticated', 401);
      return;
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('subscription_tier, subscription_status, stripe_customer_id, stripe_subscription_id, ai_credits_remaining')
      .eq('id', req.user.id)
      .single();

    if (error || !user) {
      sendError(res, 'NOT_FOUND', 'User not found', 404);
      return;
    }

    // Define plan limits
    const planLimits: Record<string, { alerts: number; ai_credits_monthly: number }> = {
      free: { alerts: 3, ai_credits_monthly: 10 },
      starter: { alerts: 10, ai_credits_monthly: 50 },
      pro: { alerts: 50, ai_credits_monthly: 200 },
      business: { alerts: -1, ai_credits_monthly: 1000 }, // -1 = unlimited
    };

    const limits = planLimits[user.subscription_tier] || planLimits.free;

    sendSuccess(res, {
      tier: user.subscription_tier,
      status: user.subscription_status,
      ai_credits_remaining: user.ai_credits_remaining,
      limits,
    });
  } catch (error) {
    sendError(res, 'FETCH_ERROR', error instanceof Error ? error.message : 'Failed to fetch subscription', 500);
  }
});

// GET /api/user/notification-settings - Get notification preferences
router.get('/notification-settings', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      sendError(res, 'UNAUTHORIZED', 'User not authenticated', 401);
      return;
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('notification_email, notification_push, notification_telegram, telegram_chat_id')
      .eq('id', req.user.id)
      .single();

    if (error || !user) {
      sendError(res, 'NOT_FOUND', 'User not found', 404);
      return;
    }

    sendSuccess(res, user);
  } catch (error) {
    sendError(res, 'FETCH_ERROR', error instanceof Error ? error.message : 'Failed to fetch notification settings', 500);
  }
});

// PATCH /api/user/notification-settings - Update notification preferences
router.patch('/notification-settings', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      sendError(res, 'UNAUTHORIZED', 'User not authenticated', 401);
      return;
    }

    const validatedData = notificationSettingsSchema.parse(req.body);

    const { data: user, error } = await supabase
      .from('users')
      .update({
        ...validatedData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.user.id)
      .select('notification_email, notification_push, notification_telegram, telegram_chat_id')
      .single();

    if (error || !user) {
      sendError(res, 'UPDATE_ERROR', error?.message || 'Failed to update notification settings', 500);
      return;
    }

    sendSuccess(res, user);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0];
      sendError(res, 'VALIDATION_ERROR', firstError.message, 400, firstError.path[0] as string);
      return;
    }
    sendError(res, 'UPDATE_ERROR', error instanceof Error ? error.message : 'Failed to update settings', 500);
  }
});

// POST /api/user/test-telegram - Send a test Telegram message
router.post('/test-telegram', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      sendError(res, 'UNAUTHORIZED', 'User not authenticated', 401);
      return;
    }

    const { telegram_chat_id } = req.body;
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (!botToken) {
      sendError(res, 'CONFIG_ERROR', 'Telegram bot is not configured', 500);
      return;
    }

    if (!telegram_chat_id) {
      sendError(res, 'VALIDATION_ERROR', 'Chat ID is required', 400);
      return;
    }

    // Send test message via Telegram API using the ReList bot
    const text = `✅ *ReList Connected!*\n\nYour Telegram notifications are configured correctly. You'll receive alerts for your saved searches here.`;
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: telegram_chat_id,
        text,
        parse_mode: 'Markdown',
      }),
    });

    const result = await response.json();

    if (!response.ok || !result.ok) {
      let errorMsg = result.description || 'Failed to send message';
      // Provide helpful error messages
      if (errorMsg.includes('chat not found')) {
        errorMsg = 'Chat not found. Make sure you\'ve started a conversation with @ReListBot first.';
      } else if (errorMsg.includes('bot was blocked')) {
        errorMsg = 'You\'ve blocked @ReListBot. Please unblock it and try again.';
      } else if (errorMsg.includes('need to be admin')) {
        errorMsg = 'For channels, @ReListBot must be added as an admin with permission to post messages.';
      }
      sendError(res, 'TELEGRAM_ERROR', errorMsg, 400);
      return;
    }

    sendSuccess(res, { message: 'Test message sent successfully' });
  } catch (error) {
    sendError(res, 'TELEGRAM_ERROR', error instanceof Error ? error.message : 'Failed to send test message', 500);
  }
});

// GET /api/user/stats - Get user dashboard stats
router.get('/stats', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      sendError(res, 'UNAUTHORIZED', 'User not authenticated', 401);
      return;
    }

    // Parse date range from query params
    const days = req.query.days ? parseInt(req.query.days as string) : null;
    let dateFilter: Date | null = null;
    if (days && days > 0) {
      dateFilter = new Date();
      dateFilter.setDate(dateFilter.getDate() - days);
    }

    // Get alerts count
    const { count: alertsCount } = await supabase
      .from('alerts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.user.id)
      .eq('is_active', true);

    // Get unread results count
    const { data: userAlerts } = await supabase
      .from('alerts')
      .select('id')
      .eq('user_id', req.user.id);

    let unreadCount = 0;
    if (userAlerts && userAlerts.length > 0) {
      const { count } = await supabase
        .from('alert_results')
        .select('*', { count: 'exact', head: true })
        .in('alert_id', userAlerts.map(a => a.id))
        .eq('is_read', false);
      unreadCount = count || 0;
    }

    // Get inventory stats - apply date filter to sold items based on sold_date
    let inventoryQuery = supabase
      .from('inventory')
      .select('status, purchase_price, sold_price, fees_total, postage_cost, sold_date, created_at')
      .eq('user_id', req.user.id);

    const { data: inventory } = await inventoryQuery;

    const items = inventory || [];

    // For total items count, we don't filter by date
    const totalItems = items.length;
    const listedItems = items.filter(i => i.status === 'listed').length;

    // For sold items and revenue, apply date filter if specified
    let soldItems = items.filter(i => i.status === 'sold');
    if (dateFilter) {
      soldItems = soldItems.filter(i => {
        const soldDate = i.sold_date ? new Date(i.sold_date) : (i.created_at ? new Date(i.created_at) : null);
        return soldDate && soldDate >= dateFilter;
      });
    }

    const totalRevenue = soldItems.reduce((sum, i) => sum + (i.sold_price || 0), 0);
    const totalProfit = soldItems.reduce((sum, i) => {
      const revenue = i.sold_price || 0;
      const cost = i.purchase_price || 0;
      const fees = i.fees_total || 0;
      const postage = i.postage_cost || 0;
      return sum + (revenue - cost - fees - postage);
    }, 0);

    sendSuccess(res, {
      active_alerts: alertsCount || 0,
      unread_matches: unreadCount,
      total_items: totalItems,
      listed_items: listedItems,
      sold_items: soldItems.length,
      total_revenue: totalRevenue,
      total_profit: totalProfit,
    });
  } catch (error) {
    sendError(res, 'FETCH_ERROR', error instanceof Error ? error.message : 'Failed to fetch stats', 500);
  }
});

export default router;
