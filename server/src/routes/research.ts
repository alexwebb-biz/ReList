import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticateToken } from '../middleware/auth.js';
import { success, error as sendError } from '../utils/response.js';
import { AuthenticatedRequest } from '../types/index.js';
import * as marketResearchService from '../services/marketResearchService.js';
import * as inventoryAgingService from '../services/inventoryAgingService.js';
import * as flipFinderService from '../services/flipFinderService.js';
import * as listingOptimizerService from '../services/listingOptimizerService.js';

const router = Router();

// Validation schemas
const searchSchema = z.object({
  query: z.string().min(2).max(200),
  platforms: z.array(z.string()).optional().default(['eBay']),
});

const suggestPriceSchema = z.object({
  query: z.string().min(2).max(200),
  condition: z.string().optional().default('Good'),
});

// ============== MARKET RESEARCH ==============

// POST /api/research/sold - Search sold listings
router.post('/sold', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { query, platforms } = searchSchema.parse(req.body);

    const results = await marketResearchService.searchSoldListings(query, platforms);
    res.json(success(results));
  } catch (err) {
    if (err instanceof z.ZodError) {
      const firstError = err.issues[0];
      return res.status(400).json(sendError('VALIDATION_ERROR', firstError.message));
    }
    console.error('Error in POST /research/sold:', err);
    res.status(500).json(sendError('SERVER_ERROR', 'Failed to search sold listings'));
  }
});

// POST /api/research/suggest-price - Get suggested price for an item
router.post('/suggest-price', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { query, condition } = suggestPriceSchema.parse(req.body);

    const suggestion = await marketResearchService.getSuggestedPrice(query, condition);
    res.json(success(suggestion));
  } catch (err) {
    if (err instanceof z.ZodError) {
      const firstError = err.issues[0];
      return res.status(400).json(sendError('VALIDATION_ERROR', firstError.message));
    }
    console.error('Error in POST /research/suggest-price:', err);
    res.status(500).json(sendError('SERVER_ERROR', 'Failed to get price suggestion'));
  }
});

// ============== INVENTORY AGING ==============

// GET /api/research/aging - Get inventory aging report
router.get('/aging', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const filter = req.query.status as 'fresh' | 'aging' | 'stale' | 'critical' | undefined;

    const items = await inventoryAgingService.getAgingInventory(userId, filter);
    res.json(success(items));
  } catch (err) {
    console.error('Error in GET /research/aging:', err);
    res.status(500).json(sendError('SERVER_ERROR', 'Failed to fetch aging inventory'));
  }
});

// GET /api/research/aging/stats - Get aging statistics
router.get('/aging/stats', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const stats = await inventoryAgingService.getAgingStats(userId);
    res.json(success(stats));
  } catch (err) {
    console.error('Error in GET /research/aging/stats:', err);
    res.status(500).json(sendError('SERVER_ERROR', 'Failed to fetch aging stats'));
  }
});

// GET /api/research/aging/:id/suggestion - Get smart repricing suggestion for an item
router.get('/aging/:id/suggestion', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const suggestion = await inventoryAgingService.getSmartRepricingSuggestion(userId, id);
    res.json(success(suggestion));
  } catch (err) {
    if (err instanceof Error && err.message === 'Item not found') {
      return res.status(404).json(sendError('NOT_FOUND', 'Item not found'));
    }
    console.error('Error in GET /research/aging/:id/suggestion:', err);
    res.status(500).json(sendError('SERVER_ERROR', 'Failed to get repricing suggestion'));
  }
});

// POST /api/research/aging/:id/apply - Apply price reduction to an item
router.post('/aging/:id/apply', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { new_price } = z.object({ new_price: z.number().positive() }).parse(req.body);

    await inventoryAgingService.applyPriceReduction(userId, id, new_price);
    res.json(success({ updated: true, new_price }));
  } catch (err) {
    if (err instanceof z.ZodError) {
      const firstError = err.issues[0];
      return res.status(400).json(sendError('VALIDATION_ERROR', firstError.message));
    }
    console.error('Error in POST /research/aging/:id/apply:', err);
    res.status(500).json(sendError('SERVER_ERROR', 'Failed to apply price reduction'));
  }
});

// POST /api/research/aging/bulk-apply - Bulk apply price reductions
router.post('/aging/bulk-apply', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { items } = z.object({
      items: z.array(z.object({
        id: z.string().uuid(),
        new_price: z.number().positive()
      }))
    }).parse(req.body);

    const result = await inventoryAgingService.bulkApplyAgingSuggestions(userId, items);
    res.json(success(result));
  } catch (err) {
    if (err instanceof z.ZodError) {
      const firstError = err.issues[0];
      return res.status(400).json(sendError('VALIDATION_ERROR', firstError.message));
    }
    console.error('Error in POST /research/aging/bulk-apply:', err);
    res.status(500).json(sendError('SERVER_ERROR', 'Failed to apply bulk price reductions'));
  }
});

// ============== FLIP FINDER ==============

const flipFinderSchema = z.object({
  query: z.string().min(2).max(200),
  platforms: z.array(z.string()).optional().default(['eBay']),
  min_profit_margin: z.number().min(0).max(100).optional().default(20),
  min_score: z.number().min(0).max(100).optional().default(40),
});

const arbitrageSchema = z.object({
  query: z.string().min(2).max(200),
  buy_platform: z.string().optional().default('Vinted'),
  sell_platform: z.string().optional().default('eBay'),
  min_profit: z.number().min(0).optional().default(10),
});

// POST /api/research/flip-finder - Find flip opportunities
router.post('/flip-finder', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { query, platforms, min_profit_margin, min_score } = flipFinderSchema.parse(req.body);

    const results = await flipFinderService.findFlipOpportunities(
      query,
      platforms,
      min_profit_margin,
      min_score
    );
    res.json(success(results));
  } catch (err) {
    if (err instanceof z.ZodError) {
      const firstError = err.issues[0];
      return res.status(400).json(sendError('VALIDATION_ERROR', firstError.message));
    }
    console.error('Error in POST /research/flip-finder:', err);
    res.status(500).json(sendError('SERVER_ERROR', 'Failed to find flip opportunities'));
  }
});

// POST /api/research/arbitrage - Find cross-platform arbitrage opportunities
router.post('/arbitrage', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { query, buy_platform, sell_platform, min_profit } = arbitrageSchema.parse(req.body);

    const results = await flipFinderService.findArbitrageOpportunities(
      query,
      buy_platform,
      sell_platform,
      min_profit
    );
    res.json(success(results));
  } catch (err) {
    if (err instanceof z.ZodError) {
      const firstError = err.issues[0];
      return res.status(400).json(sendError('VALIDATION_ERROR', firstError.message));
    }
    console.error('Error in POST /research/arbitrage:', err);
    res.status(500).json(sendError('SERVER_ERROR', 'Failed to find arbitrage opportunities'));
  }
});

// GET /api/research/trending-flips - Get trending categories with flip potential
router.get('/trending-flips', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Default trending categories, can be customized via query params
    const categoriesParam = req.query.categories as string | undefined;
    const categories = categoriesParam
      ? categoriesParam.split(',').map(c => c.trim())
      : ['vintage clothing', 'retro games', 'designer bags', 'rare vinyl', 'vintage toys'];

    const limit = parseInt(req.query.limit as string) || 10;

    const results = await flipFinderService.getTrendingFlips(categories, limit);
    res.json(success(results));
  } catch (err) {
    console.error('Error in GET /research/trending-flips:', err);
    res.status(500).json(sendError('SERVER_ERROR', 'Failed to fetch trending flips'));
  }
});

// ============== LISTING OPTIMIZER ==============

const analyzeListingSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  category: z.string().optional(),
});

const keywordSuggestionsSchema = z.object({
  search_term: z.string().min(2).max(100),
});

// POST /api/research/optimize-listing - Analyze and optimize a listing
router.post('/optimize-listing', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { title, description, category } = analyzeListingSchema.parse(req.body);

    const analysis = await listingOptimizerService.analyzeListing(title, description, category);
    res.json(success(analysis));
  } catch (err) {
    if (err instanceof z.ZodError) {
      const firstError = err.issues[0];
      return res.status(400).json(sendError('VALIDATION_ERROR', firstError.message));
    }
    console.error('Error in POST /research/optimize-listing:', err);
    res.status(500).json(sendError('SERVER_ERROR', 'Failed to analyze listing'));
  }
});

// POST /api/research/keyword-suggestions - Get keyword suggestions for a search term
router.post('/keyword-suggestions', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { search_term } = keywordSuggestionsSchema.parse(req.body);

    const suggestions = await listingOptimizerService.getKeywordSuggestions(search_term);
    res.json(success(suggestions));
  } catch (err) {
    if (err instanceof z.ZodError) {
      const firstError = err.issues[0];
      return res.status(400).json(sendError('VALIDATION_ERROR', firstError.message));
    }
    console.error('Error in POST /research/keyword-suggestions:', err);
    res.status(500).json(sendError('SERVER_ERROR', 'Failed to get keyword suggestions'));
  }
});

// POST /api/research/analyze-keywords - Analyze keywords from sold listings
router.post('/analyze-keywords', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { query } = z.object({ query: z.string().min(2).max(100) }).parse(req.body);

    const analysis = await listingOptimizerService.analyzeKeywords(query);
    res.json(success(analysis));
  } catch (err) {
    if (err instanceof z.ZodError) {
      const firstError = err.issues[0];
      return res.status(400).json(sendError('VALIDATION_ERROR', firstError.message));
    }
    console.error('Error in POST /research/analyze-keywords:', err);
    res.status(500).json(sendError('SERVER_ERROR', 'Failed to analyze keywords'));
  }
});

// POST /api/research/quick-title-check - Quick title suggestions without full analysis
router.post('/quick-title-check', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { title } = z.object({ title: z.string().min(1).max(200) }).parse(req.body);

    const suggestions = listingOptimizerService.quickTitleSuggestions(title);
    res.json(success({ suggestions }));
  } catch (err) {
    if (err instanceof z.ZodError) {
      const firstError = err.issues[0];
      return res.status(400).json(sendError('VALIDATION_ERROR', firstError.message));
    }
    console.error('Error in POST /research/quick-title-check:', err);
    res.status(500).json(sendError('SERVER_ERROR', 'Failed to check title'));
  }
});

// ============== AI DESCRIPTION GENERATION ==============

const generateDescriptionSchema = z.object({
  title: z.string().min(1).max(200),
  category: z.string().optional(),
  condition: z.string().optional(),
  brand: z.string().optional(),
  size: z.string().optional(),
  color: z.string().optional(),
  material: z.string().optional(),
  features: z.array(z.string()).optional(),
  flaws: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
  provider: z.enum(['groq', 'huggingface', 'ollama', 'template']).optional(),
});

// POST /api/research/generate-description - Generate AI-powered listing description
router.post('/generate-description', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const input = generateDescriptionSchema.parse(req.body);

    const result = await listingOptimizerService.generateDescription(input);
    res.json(success(result));
  } catch (err) {
    if (err instanceof z.ZodError) {
      const firstError = err.issues[0];
      return res.status(400).json(sendError('VALIDATION_ERROR', firstError.message));
    }
    console.error('Error in POST /research/generate-description:', err);
    res.status(500).json(sendError('SERVER_ERROR', 'Failed to generate description'));
  }
});

// POST /api/research/quick-description - Quick description from just title
router.post('/quick-description', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { title } = z.object({ title: z.string().min(1).max(200) }).parse(req.body);

    const result = await listingOptimizerService.generateQuickDescription(title);
    res.json(success(result));
  } catch (err) {
    if (err instanceof z.ZodError) {
      const firstError = err.issues[0];
      return res.status(400).json(sendError('VALIDATION_ERROR', firstError.message));
    }
    console.error('Error in POST /research/quick-description:', err);
    res.status(500).json(sendError('SERVER_ERROR', 'Failed to generate description'));
  }
});

// GET /api/research/ai-providers - Get available AI providers
router.get('/ai-providers', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const providers = await listingOptimizerService.getDescriptionProviders();
    res.json(success({ providers }));
  } catch (err) {
    console.error('Error in GET /research/ai-providers:', err);
    res.status(500).json(sendError('SERVER_ERROR', 'Failed to get AI providers'));
  }
});

export default router;
