/**
 * Deal Sharing Service
 * Community-powered deal sharing marketplace
 * Users share deals, earn reputation, and get commissions when others profit
 */

import supabase from '../config/supabase.js';

export interface SharedDeal {
  id: string;
  user_id: string;

  // Deal details
  title: string;
  description: string | null;
  url: string;
  image_url: string | null;
  platform: string;
  buy_price: number;
  estimated_sell_price: number;
  estimated_profit: number;
  category: string;
  location: string | null;
  condition: string | null;

  // Status
  status: 'active' | 'claimed' | 'sold' | 'expired' | 'removed';
  claimed_by: string | null;
  claimed_at: string | null;

  // Outcome tracking
  actual_sell_price: number | null;
  actual_profit: number | null;
  commission_paid: number | null;
  outcome_reported_at: string | null;

  // Community voting
  upvotes: number;
  downvotes: number;

  // Timestamps
  expires_at: string;
  created_at: string;
  updated_at: string;

  // Joined data
  sharer?: {
    id: string;
    full_name: string | null;
    email: string;
    reputation_score: number;
    deals_shared: number;
    successful_deals: number;
  };
}

export interface UserReputation {
  user_id: string;
  reputation_score: number;
  deals_shared: number;
  deals_claimed: number;
  successful_deals: number;
  total_profit_generated: number;
  total_commission_earned: number;
  badges: string[];
  level: 'newcomer' | 'contributor' | 'trusted' | 'expert' | 'legend';
  created_at: string;
  updated_at: string;
}

export interface DealVote {
  id: string;
  deal_id: string;
  user_id: string;
  vote_type: 'up' | 'down';
  created_at: string;
}

// Commission rate (5% of profit)
const COMMISSION_RATE = 0.05;

// Reputation points
const REP_POINTS = {
  SHARE_DEAL: 5,
  DEAL_CLAIMED: 10,
  SUCCESSFUL_SALE: 25,
  UPVOTE_RECEIVED: 2,
  DOWNVOTE_RECEIVED: -3,
  DEAL_EXPIRED: -5,
};

// Badge thresholds
const BADGES = {
  FIRST_SHARE: { name: 'First Share', description: 'Shared your first deal', threshold: 1, field: 'deals_shared' },
  DEAL_FINDER: { name: 'Deal Finder', description: 'Shared 10 deals', threshold: 10, field: 'deals_shared' },
  DEAL_HUNTER: { name: 'Deal Hunter', description: 'Shared 50 deals', threshold: 50, field: 'deals_shared' },
  TRUSTED_SOURCE: { name: 'Trusted Source', description: '10 successful deals', threshold: 10, field: 'successful_deals' },
  PROFIT_MAKER: { name: 'Profit Maker', description: 'Generated £500+ profit for community', threshold: 500, field: 'total_profit_generated' },
  TOP_EARNER: { name: 'Top Earner', description: 'Earned £100+ in commissions', threshold: 100, field: 'total_commission_earned' },
};

// Level thresholds based on reputation score
function calculateLevel(score: number): UserReputation['level'] {
  if (score >= 1000) return 'legend';
  if (score >= 500) return 'expert';
  if (score >= 200) return 'trusted';
  if (score >= 50) return 'contributor';
  return 'newcomer';
}

/**
 * Get or create user reputation
 */
export async function getUserReputation(userId: string): Promise<UserReputation> {
  const { data, error } = await supabase
    .from('user_reputation')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    // Create new reputation record
    const newRep: Partial<UserReputation> = {
      user_id: userId,
      reputation_score: 0,
      deals_shared: 0,
      deals_claimed: 0,
      successful_deals: 0,
      total_profit_generated: 0,
      total_commission_earned: 0,
      badges: [],
      level: 'newcomer',
    };

    const { data: created, error: createError } = await supabase
      .from('user_reputation')
      .insert(newRep)
      .select()
      .single();

    if (createError) {
      console.error('Failed to create reputation:', createError);
      return newRep as UserReputation;
    }

    return created;
  }

  return data;
}

/**
 * Update user reputation
 */
async function updateReputation(
  userId: string,
  updates: Partial<UserReputation>
): Promise<void> {
  const current = await getUserReputation(userId);

  const newScore = (current.reputation_score || 0) + (updates.reputation_score || 0);
  const newLevel = calculateLevel(newScore);

  // Check for new badges
  const newBadges = [...(current.badges || [])];
  const updatedStats = {
    deals_shared: (current.deals_shared || 0) + (updates.deals_shared || 0),
    deals_claimed: (current.deals_claimed || 0) + (updates.deals_claimed || 0),
    successful_deals: (current.successful_deals || 0) + (updates.successful_deals || 0),
    total_profit_generated: (current.total_profit_generated || 0) + (updates.total_profit_generated || 0),
    total_commission_earned: (current.total_commission_earned || 0) + (updates.total_commission_earned || 0),
  };

  for (const [key, badge] of Object.entries(BADGES)) {
    const fieldValue = updatedStats[badge.field as keyof typeof updatedStats] || 0;
    if (fieldValue >= badge.threshold && !newBadges.includes(key)) {
      newBadges.push(key);
    }
  }

  await supabase
    .from('user_reputation')
    .update({
      reputation_score: newScore,
      level: newLevel,
      badges: newBadges,
      ...updatedStats,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);
}

/**
 * Share a new deal
 */
export async function shareDeal(
  userId: string,
  dealData: {
    title: string;
    description?: string;
    url: string;
    image_url?: string;
    platform: string;
    buy_price: number;
    estimated_sell_price: number;
    category: string;
    location?: string;
    condition?: string;
  }
): Promise<SharedDeal> {
  const estimatedProfit = dealData.estimated_sell_price - dealData.buy_price;

  // Deal expires in 24 hours
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('shared_deals')
    .insert({
      user_id: userId,
      title: dealData.title,
      description: dealData.description || null,
      url: dealData.url,
      image_url: dealData.image_url || null,
      platform: dealData.platform,
      buy_price: dealData.buy_price,
      estimated_sell_price: dealData.estimated_sell_price,
      estimated_profit: estimatedProfit,
      category: dealData.category,
      location: dealData.location || null,
      condition: dealData.condition || null,
      status: 'active',
      upvotes: 0,
      downvotes: 0,
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to share deal');
  }

  // Update sharer reputation
  await updateReputation(userId, {
    reputation_score: REP_POINTS.SHARE_DEAL,
    deals_shared: 1,
  });

  return data;
}

/**
 * Get active deals feed
 */
export async function getDealsFeed(
  options: {
    category?: string;
    platform?: string;
    min_profit?: number;
    sort_by?: 'newest' | 'profit' | 'upvotes' | 'expiring';
    page?: number;
    per_page?: number;
  } = {}
): Promise<{ deals: SharedDeal[]; total: number }> {
  const {
    category,
    platform,
    min_profit = 0,
    sort_by = 'newest',
    page = 1,
    per_page = 20,
  } = options;

  const offset = (page - 1) * per_page;

  let query = supabase
    .from('shared_deals')
    .select(`
      *,
      sharer:user_id (
        id,
        full_name,
        email
      )
    `, { count: 'exact' })
    .eq('status', 'active')
    .gte('estimated_profit', min_profit)
    .gt('expires_at', new Date().toISOString());

  if (category) {
    query = query.eq('category', category);
  }

  if (platform) {
    query = query.eq('platform', platform);
  }

  // Sorting
  switch (sort_by) {
    case 'profit':
      query = query.order('estimated_profit', { ascending: false });
      break;
    case 'upvotes':
      query = query.order('upvotes', { ascending: false });
      break;
    case 'expiring':
      query = query.order('expires_at', { ascending: true });
      break;
    default:
      query = query.order('created_at', { ascending: false });
  }

  const { data, error, count } = await query.range(offset, offset + per_page - 1);

  if (error) {
    throw new Error(`Failed to fetch deals: ${error.message}`);
  }

  // Enrich with reputation data
  const deals = await Promise.all((data || []).map(async (deal) => {
    if (deal.sharer) {
      const rep = await getUserReputation(deal.user_id);
      deal.sharer = {
        ...deal.sharer,
        reputation_score: rep.reputation_score,
        deals_shared: rep.deals_shared,
        successful_deals: rep.successful_deals,
      };
    }
    return deal;
  }));

  return {
    deals,
    total: count || 0,
  };
}

/**
 * Get a specific deal
 */
export async function getDealById(dealId: string): Promise<SharedDeal | null> {
  const { data, error } = await supabase
    .from('shared_deals')
    .select(`
      *,
      sharer:user_id (
        id,
        full_name,
        email
      )
    `)
    .eq('id', dealId)
    .single();

  if (error || !data) {
    return null;
  }

  if (data.sharer) {
    const rep = await getUserReputation(data.user_id);
    data.sharer = {
      ...data.sharer,
      reputation_score: rep.reputation_score,
      deals_shared: rep.deals_shared,
      successful_deals: rep.successful_deals,
    };
  }

  return data;
}

/**
 * Claim a deal
 */
export async function claimDeal(
  dealId: string,
  userId: string
): Promise<SharedDeal> {
  // Check if deal is still available
  const deal = await getDealById(dealId);

  if (!deal) {
    throw new Error('Deal not found');
  }

  if (deal.status !== 'active') {
    throw new Error('Deal is no longer available');
  }

  if (deal.user_id === userId) {
    throw new Error('You cannot claim your own deal');
  }

  if (new Date(deal.expires_at) < new Date()) {
    throw new Error('Deal has expired');
  }

  // Claim the deal
  const { data, error } = await supabase
    .from('shared_deals')
    .update({
      status: 'claimed',
      claimed_by: userId,
      claimed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', dealId)
    .eq('status', 'active')
    .select()
    .single();

  if (error || !data) {
    throw new Error('Failed to claim deal - it may have been claimed by someone else');
  }

  // Update sharer reputation (deal was claimed)
  await updateReputation(deal.user_id, {
    reputation_score: REP_POINTS.DEAL_CLAIMED,
  });

  // Update claimer reputation
  await updateReputation(userId, {
    deals_claimed: 1,
  });

  return data;
}

/**
 * Report outcome of a claimed deal
 */
export async function reportDealOutcome(
  dealId: string,
  userId: string,
  outcome: {
    sold: boolean;
    actual_sell_price?: number;
  }
): Promise<SharedDeal> {
  const deal = await getDealById(dealId);

  if (!deal) {
    throw new Error('Deal not found');
  }

  if (deal.claimed_by !== userId) {
    throw new Error('You did not claim this deal');
  }

  if (deal.status !== 'claimed') {
    throw new Error('Deal outcome already reported');
  }

  let actualProfit = 0;
  let commission = 0;
  let newStatus: SharedDeal['status'] = 'expired';

  if (outcome.sold && outcome.actual_sell_price) {
    actualProfit = outcome.actual_sell_price - deal.buy_price;
    commission = Math.max(0, actualProfit * COMMISSION_RATE);
    newStatus = 'sold';

    // Update sharer reputation for successful sale
    await updateReputation(deal.user_id, {
      reputation_score: REP_POINTS.SUCCESSFUL_SALE,
      successful_deals: 1,
      total_profit_generated: actualProfit,
      total_commission_earned: commission,
    });
  }

  const { data, error } = await supabase
    .from('shared_deals')
    .update({
      status: newStatus,
      actual_sell_price: outcome.actual_sell_price || null,
      actual_profit: actualProfit,
      commission_paid: commission,
      outcome_reported_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', dealId)
    .select()
    .single();

  if (error || !data) {
    throw new Error('Failed to report outcome');
  }

  return data;
}

/**
 * Vote on a deal
 */
export async function voteDeal(
  dealId: string,
  userId: string,
  voteType: 'up' | 'down'
): Promise<{ upvotes: number; downvotes: number }> {
  const deal = await getDealById(dealId);

  if (!deal) {
    throw new Error('Deal not found');
  }

  if (deal.user_id === userId) {
    throw new Error('You cannot vote on your own deal');
  }

  // Check for existing vote
  const { data: existingVote } = await supabase
    .from('deal_votes')
    .select('*')
    .eq('deal_id', dealId)
    .eq('user_id', userId)
    .single();

  if (existingVote) {
    if (existingVote.vote_type === voteType) {
      throw new Error('You have already voted');
    }

    // Change vote
    await supabase
      .from('deal_votes')
      .update({ vote_type: voteType })
      .eq('id', existingVote.id);

    // Update counts (swing of 2)
    const upvoteChange = voteType === 'up' ? 1 : -1;
    const downvoteChange = voteType === 'down' ? 1 : -1;

    await supabase
      .from('shared_deals')
      .update({
        upvotes: deal.upvotes + upvoteChange,
        downvotes: deal.downvotes + downvoteChange,
      })
      .eq('id', dealId);

    // Update reputation (swing)
    const repChange = voteType === 'up'
      ? REP_POINTS.UPVOTE_RECEIVED - REP_POINTS.DOWNVOTE_RECEIVED
      : REP_POINTS.DOWNVOTE_RECEIVED - REP_POINTS.UPVOTE_RECEIVED;

    await updateReputation(deal.user_id, {
      reputation_score: repChange,
    });

    return {
      upvotes: deal.upvotes + upvoteChange,
      downvotes: deal.downvotes + downvoteChange,
    };
  }

  // New vote
  await supabase
    .from('deal_votes')
    .insert({
      deal_id: dealId,
      user_id: userId,
      vote_type: voteType,
    });

  const upvoteChange = voteType === 'up' ? 1 : 0;
  const downvoteChange = voteType === 'down' ? 1 : 0;

  await supabase
    .from('shared_deals')
    .update({
      upvotes: deal.upvotes + upvoteChange,
      downvotes: deal.downvotes + downvoteChange,
    })
    .eq('id', dealId);

  // Update reputation
  await updateReputation(deal.user_id, {
    reputation_score: voteType === 'up' ? REP_POINTS.UPVOTE_RECEIVED : REP_POINTS.DOWNVOTE_RECEIVED,
  });

  return {
    upvotes: deal.upvotes + upvoteChange,
    downvotes: deal.downvotes + downvoteChange,
  };
}

/**
 * Get user's shared deals
 */
export async function getUserDeals(
  userId: string,
  type: 'shared' | 'claimed' = 'shared'
): Promise<SharedDeal[]> {
  const column = type === 'shared' ? 'user_id' : 'claimed_by';

  const { data, error } = await supabase
    .from('shared_deals')
    .select('*')
    .eq(column, userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch deals: ${error.message}`);
  }

  return data || [];
}

/**
 * Get leaderboard
 */
export async function getLeaderboard(
  sortBy: 'reputation' | 'deals' | 'profit' = 'reputation',
  limit: number = 20
): Promise<UserReputation[]> {
  let orderColumn = 'reputation_score';
  if (sortBy === 'deals') orderColumn = 'successful_deals';
  if (sortBy === 'profit') orderColumn = 'total_profit_generated';

  const { data, error } = await supabase
    .from('user_reputation')
    .select('*')
    .order(orderColumn, { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch leaderboard: ${error.message}`);
  }

  return data || [];
}

/**
 * Get deal categories with counts
 */
export async function getDealCategories(): Promise<Array<{ category: string; count: number }>> {
  const { data, error } = await supabase
    .from('shared_deals')
    .select('category')
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString());

  if (error) {
    return [];
  }

  const counts: Record<string, number> = {};
  for (const deal of data || []) {
    counts[deal.category] = (counts[deal.category] || 0) + 1;
  }

  return Object.entries(counts)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Expire old deals (run periodically)
 */
export async function expireOldDeals(): Promise<number> {
  const { data, error } = await supabase
    .from('shared_deals')
    .update({
      status: 'expired',
      updated_at: new Date().toISOString(),
    })
    .eq('status', 'active')
    .lt('expires_at', new Date().toISOString())
    .select('user_id');

  if (error) {
    console.error('Failed to expire deals:', error);
    return 0;
  }

  // Penalize reputation for expired deals
  for (const deal of data || []) {
    await updateReputation(deal.user_id, {
      reputation_score: REP_POINTS.DEAL_EXPIRED,
    });
  }

  return data?.length || 0;
}
