/**
 * Deal Sharing Marketplace API Routes
 * Community-powered deal sharing with reputation and commissions
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticateToken } from '../middleware/auth.js';
import { success, error as sendError, paginated } from '../utils/response.js';
import {
  shareDeal,
  getDealsFeed,
  getDealById,
  claimDeal,
  reportDealOutcome,
  voteDeal,
  getUserDeals,
  getUserReputation,
  getLeaderboard,
  getDealCategories,
} from '../services/dealSharingService.js';

const router = Router();

// Validation schemas
const shareDealSchema = z.object({
  title: z.string().min(5).max(200),
  description: z.string().max(1000).optional(),
  url: z.string().url(),
  image_url: z.string().url().optional(),
  platform: z.string().min(1).max(50),
  buy_price: z.number().positive(),
  estimated_sell_price: z.number().positive(),
  category: z.string().min(1).max(50),
  location: z.string().max(100).optional(),
  condition: z.string().max(50).optional(),
});

const reportOutcomeSchema = z.object({
  sold: z.boolean(),
  actual_sell_price: z.number().positive().optional(),
});

const voteSchema = z.object({
  vote_type: z.enum(['up', 'down']),
});

// GET /api/deals - Get deals feed
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const {
      category,
      platform,
      min_profit,
      sort_by = 'newest',
      page = '1',
      per_page = '20',
    } = req.query;

    const result = await getDealsFeed({
      category: category as string | undefined,
      platform: platform as string | undefined,
      min_profit: min_profit ? parseFloat(min_profit as string) : undefined,
      sort_by: sort_by as 'newest' | 'profit' | 'upvotes' | 'expiring',
      page: parseInt(page as string),
      per_page: Math.min(parseInt(per_page as string), 50),
    });

    res.json(paginated(
      result.deals,
      parseInt(page as string),
      parseInt(per_page as string),
      result.total
    ));
  } catch (err) {
    console.error('Error fetching deals:', err);
    res.status(500).json(sendError('FETCH_ERROR', 'Failed to fetch deals'));
  }
});

// GET /api/deals/categories - Get deal categories
router.get('/categories', authenticateToken, async (_req: Request, res: Response) => {
  try {
    const categories = await getDealCategories();

    // Add some default categories if empty
    const defaultCategories = [
      'Clothing', 'Electronics', 'Sneakers', 'Designer',
      'Vintage', 'Gaming', 'Sports', 'Home', 'Other'
    ];

    const allCategories = categories.length > 0
      ? categories
      : defaultCategories.map(c => ({ category: c, count: 0 }));

    res.json(success(allCategories));
  } catch (err) {
    console.error('Error fetching categories:', err);
    res.status(500).json(sendError('FETCH_ERROR', 'Failed to fetch categories'));
  }
});

// GET /api/deals/leaderboard - Get reputation leaderboard
router.get('/leaderboard', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { sort_by = 'reputation', limit = '20' } = req.query;

    const leaderboard = await getLeaderboard(
      sort_by as 'reputation' | 'deals' | 'profit',
      Math.min(parseInt(limit as string), 100)
    );

    res.json(success(leaderboard));
  } catch (err) {
    console.error('Error fetching leaderboard:', err);
    res.status(500).json(sendError('FETCH_ERROR', 'Failed to fetch leaderboard'));
  }
});

// GET /api/deals/my-deals - Get current user's deals
router.get('/my-deals', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { type = 'shared' } = req.query;

    const deals = await getUserDeals(userId, type as 'shared' | 'claimed');
    res.json(success(deals));
  } catch (err) {
    console.error('Error fetching user deals:', err);
    res.status(500).json(sendError('FETCH_ERROR', 'Failed to fetch your deals'));
  }
});

// GET /api/deals/my-reputation - Get current user's reputation
router.get('/my-reputation', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const reputation = await getUserReputation(userId);
    res.json(success(reputation));
  } catch (err) {
    console.error('Error fetching reputation:', err);
    res.status(500).json(sendError('FETCH_ERROR', 'Failed to fetch reputation'));
  }
});

// GET /api/deals/:id - Get a specific deal
router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deal = await getDealById(id);

    if (!deal) {
      return res.status(404).json(sendError('NOT_FOUND', 'Deal not found'));
    }

    res.json(success(deal));
  } catch (err) {
    console.error('Error fetching deal:', err);
    res.status(500).json(sendError('FETCH_ERROR', 'Failed to fetch deal'));
  }
});

// POST /api/deals - Share a new deal
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const data = shareDealSchema.parse(req.body);

    // Validate profit margin
    if (data.estimated_sell_price <= data.buy_price) {
      return res.status(400).json(sendError(
        'VALIDATION_ERROR',
        'Estimated sell price must be higher than buy price'
      ));
    }

    const deal = await shareDeal(userId, data);
    res.status(201).json(success(deal));
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json(sendError('VALIDATION_ERROR', err.issues[0].message));
    }
    console.error('Error sharing deal:', err);
    res.status(500).json(sendError('CREATE_ERROR', 'Failed to share deal'));
  }
});

// POST /api/deals/:id/claim - Claim a deal
router.post('/:id/claim', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const deal = await claimDeal(id, userId);
    res.json(success({
      deal,
      message: 'Deal claimed successfully! Go get it before someone else does.',
    }));
  } catch (err) {
    if (err instanceof Error) {
      return res.status(400).json(sendError('CLAIM_ERROR', err.message));
    }
    console.error('Error claiming deal:', err);
    res.status(500).json(sendError('CLAIM_ERROR', 'Failed to claim deal'));
  }
});

// POST /api/deals/:id/outcome - Report deal outcome
router.post('/:id/outcome', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const data = reportOutcomeSchema.parse(req.body);

    if (data.sold && !data.actual_sell_price) {
      return res.status(400).json(sendError(
        'VALIDATION_ERROR',
        'Actual sell price is required when marking as sold'
      ));
    }

    const deal = await reportDealOutcome(id, userId, data);

    let message = 'Outcome recorded.';
    if (deal.commission_paid && deal.commission_paid > 0) {
      message = `Outcome recorded! The deal sharer earned £${deal.commission_paid.toFixed(2)} commission.`;
    }

    res.json(success({
      deal,
      message,
    }));
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json(sendError('VALIDATION_ERROR', err.issues[0].message));
    }
    if (err instanceof Error) {
      return res.status(400).json(sendError('OUTCOME_ERROR', err.message));
    }
    console.error('Error reporting outcome:', err);
    res.status(500).json(sendError('OUTCOME_ERROR', 'Failed to report outcome'));
  }
});

// POST /api/deals/:id/vote - Vote on a deal
router.post('/:id/vote', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { vote_type } = voteSchema.parse(req.body);

    const result = await voteDeal(id, userId, vote_type);
    res.json(success(result));
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json(sendError('VALIDATION_ERROR', err.issues[0].message));
    }
    if (err instanceof Error) {
      return res.status(400).json(sendError('VOTE_ERROR', err.message));
    }
    console.error('Error voting:', err);
    res.status(500).json(sendError('VOTE_ERROR', 'Failed to vote'));
  }
});

export default router;
