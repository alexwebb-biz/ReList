/**
 * Arbitrage Scanner API Routes
 * Real-time cross-platform arbitrage opportunity detection
 */

import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticateToken } from '../middleware/auth.js';
import { success, error as sendError } from '../utils/response.js';
import { AuthenticatedRequest } from '../types/index.js';
import {
  scanForArbitrage,
  multiPlatformScan,
  saveOpportunityToWatchlist,
  createDraftFromOpportunity,
  ArbitrageOpportunity,
  ScannerConfig,
} from '../services/arbitrageScannerService.js';

const router = Router();

// Validation schemas
const scanConfigSchema = z.object({
  query: z.string().min(2).max(100),
  buy_platform: z.string().optional().default('Vinted'),
  sell_platform: z.string().optional().default('eBay'),
  min_profit: z.number().optional().default(5),
  min_roi: z.number().optional().default(20),
  max_buy_price: z.number().optional(),
  include_shipping: z.boolean().optional().default(true),
  local_only: z.boolean().optional().default(false),
  user_lat: z.number().optional(),
  user_lng: z.number().optional(),
  user_postcode: z.string().optional(),
  max_distance_miles: z.number().optional().default(50),
});

const multiScanSchema = z.object({
  query: z.string().min(2).max(100),
  min_profit: z.number().optional().default(5),
  min_roi: z.number().optional().default(20),
  max_buy_price: z.number().optional(),
  local_only: z.boolean().optional().default(false),
  user_lat: z.number().optional(),
  user_lng: z.number().optional(),
  max_distance_miles: z.number().optional().default(50),
});

const saveOpportunitySchema = z.object({
  opportunity: z.object({
    id: z.string(),
    buy_platform: z.string(),
    buy_price: z.number(),
    buy_url: z.string(),
    buy_title: z.string(),
    buy_image: z.string().nullable(),
    buy_location: z.string().nullable(),
    buy_condition: z.string().nullable(),
    buy_seller: z.string().nullable(),
    sell_platform: z.string(),
    sell_price: z.number(),
    sell_price_range: z.object({ min: z.number(), max: z.number() }),
    sold_count: z.number(),
    profit: z.number(),
    profit_after_fees: z.number(),
    roi_percent: z.number(),
    fee_breakdown: z.object({
      platform_fee: z.number(),
      payment_fee: z.number(),
      total_fees: z.number(),
    }),
    confidence: z.enum(['high', 'medium', 'low']),
    score: z.number(),
    coordinates: z.object({ lat: z.number(), lng: z.number() }).nullable(),
    distance_miles: z.number().nullable(),
    found_at: z.string(),
    expires_at: z.string(),
  }),
});

// POST /api/arbitrage/scan - Scan for arbitrage opportunities
router.post('/scan', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = scanConfigSchema.parse(req.body);

    const config: ScannerConfig = {
      min_profit: data.min_profit,
      min_roi: data.min_roi,
      max_buy_price: data.max_buy_price || Infinity,
      include_shipping: data.include_shipping,
      local_only: data.local_only,
      user_location: data.user_lat && data.user_lng
        ? { lat: data.user_lat, lng: data.user_lng, postcode: data.user_postcode || '' }
        : undefined,
      max_distance_miles: data.max_distance_miles,
    };

    const result = await scanForArbitrage(
      data.query,
      data.buy_platform,
      data.sell_platform,
      config
    );

    res.json(success(result));
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json(sendError('VALIDATION_ERROR', err.issues[0].message));
    }
    console.error('Arbitrage scan error:', err);
    res.status(500).json(sendError('SCAN_ERROR', 'Failed to scan for opportunities'));
  }
});

// POST /api/arbitrage/multi-scan - Scan across multiple platform combinations
router.post('/multi-scan', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = multiScanSchema.parse(req.body);

    const config: ScannerConfig = {
      min_profit: data.min_profit,
      min_roi: data.min_roi,
      max_buy_price: data.max_buy_price || Infinity,
      include_shipping: true,
      local_only: data.local_only,
      user_location: data.user_lat && data.user_lng
        ? { lat: data.user_lat, lng: data.user_lng, postcode: '' }
        : undefined,
      max_distance_miles: data.max_distance_miles,
    };

    const results = await multiPlatformScan(data.query, config);

    // Combine all opportunities and sort by score
    const allOpportunities = results
      .flatMap(r => r.opportunities)
      .sort((a, b) => b.score - a.score);

    // Calculate combined stats
    const totalScanned = results.reduce((sum, r) => sum + r.stats.listings_scanned, 0);
    const totalFound = allOpportunities.length;
    const bestProfit = allOpportunities[0]?.profit_after_fees || 0;
    const bestRoi = allOpportunities[0]?.roi_percent || 0;

    res.json(success({
      query: data.query,
      opportunities: allOpportunities.slice(0, 50),
      by_platform: results,
      stats: {
        total_scanned: totalScanned,
        total_found: totalFound,
        best_profit: bestProfit,
        best_roi: bestRoi,
        platforms_checked: results.length,
      },
      scanned_at: new Date().toISOString(),
    }));
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json(sendError('VALIDATION_ERROR', err.issues[0].message));
    }
    console.error('Multi-scan error:', err);
    res.status(500).json(sendError('SCAN_ERROR', 'Failed to run multi-platform scan'));
  }
});

// POST /api/arbitrage/save-watchlist - Save opportunity to watchlist
router.post('/save-watchlist', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { opportunity } = saveOpportunitySchema.parse(req.body);

    const saved = await saveOpportunityToWatchlist(userId, opportunity as ArbitrageOpportunity);

    if (saved) {
      res.json(success({ saved: true, message: 'Opportunity saved to watchlist' }));
    } else {
      res.status(500).json(sendError('SAVE_ERROR', 'Failed to save to watchlist'));
    }
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json(sendError('VALIDATION_ERROR', err.issues[0].message));
    }
    console.error('Save to watchlist error:', err);
    res.status(500).json(sendError('SAVE_ERROR', 'Failed to save opportunity'));
  }
});

// POST /api/arbitrage/create-draft - Create inventory draft from opportunity
router.post('/create-draft', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { opportunity } = saveOpportunitySchema.parse(req.body);

    const draftId = await createDraftFromOpportunity(userId, opportunity as ArbitrageOpportunity);

    if (draftId) {
      res.json(success({
        created: true,
        draft_id: draftId,
        message: 'Inventory draft created',
      }));
    } else {
      res.status(500).json(sendError('CREATE_ERROR', 'Failed to create draft'));
    }
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json(sendError('VALIDATION_ERROR', err.issues[0].message));
    }
    console.error('Create draft error:', err);
    res.status(500).json(sendError('CREATE_ERROR', 'Failed to create inventory draft'));
  }
});

// GET /api/arbitrage/popular-searches - Get popular arbitrage searches
router.get('/popular-searches', authenticateToken, async (_req: AuthenticatedRequest, res: Response) => {
  const popularSearches = [
    { query: 'Nike Air Max', category: 'Sneakers', avg_roi: 45 },
    { query: 'North Face Nuptse', category: 'Jackets', avg_roi: 60 },
    { query: 'Vintage Levis 501', category: 'Jeans', avg_roi: 55 },
    { query: 'PlayStation 5', category: 'Gaming', avg_roi: 25 },
    { query: 'iPhone 14 Pro', category: 'Electronics', avg_roi: 20 },
    { query: 'Carhartt WIP', category: 'Streetwear', avg_roi: 40 },
    { query: 'Ralph Lauren Polo', category: 'Designer', avg_roi: 50 },
    { query: 'Nintendo Switch', category: 'Gaming', avg_roi: 30 },
    { query: 'Dyson V15', category: 'Appliances', avg_roi: 35 },
    { query: 'Stussy hoodie', category: 'Streetwear', avg_roi: 45 },
  ];

  res.json(success(popularSearches));
});

export default router;
