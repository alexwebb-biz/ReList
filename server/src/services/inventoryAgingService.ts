import supabase from '../config/supabase.js';
import { getSuggestedPrice } from './marketResearchService.js';

export interface AgingItem {
  id: string;
  title: string;
  images: string[];
  purchase_price: number;
  selling_price: number;
  status: string;
  created_at: string;
  days_listed: number;
  aging_status: 'fresh' | 'aging' | 'stale' | 'critical';
  suggested_price?: number;
  suggested_reduction?: number;
  price_suggestion_confidence?: 'high' | 'medium' | 'low';
}

export interface AgingStats {
  total_listed: number;
  fresh_count: number;      // 0-7 days
  aging_count: number;      // 8-14 days
  stale_count: number;      // 15-30 days
  critical_count: number;   // 30+ days
  total_value_at_risk: number;
  avg_days_listed: number;
}

// Get aging status based on days listed
function getAgingStatus(daysListed: number): 'fresh' | 'aging' | 'stale' | 'critical' {
  if (daysListed <= 7) return 'fresh';
  if (daysListed <= 14) return 'aging';
  if (daysListed <= 30) return 'stale';
  return 'critical';
}

// Calculate suggested price reduction based on aging
function getSuggestedReduction(daysListed: number): number {
  if (daysListed <= 7) return 0;
  if (daysListed <= 14) return 5;   // 5% reduction
  if (daysListed <= 21) return 10;  // 10% reduction
  if (daysListed <= 30) return 15;  // 15% reduction
  if (daysListed <= 45) return 20;  // 20% reduction
  return 25; // 25% reduction for 45+ days
}

// Get inventory items with aging information
export const getAgingInventory = async (
  userId: string,
  filterStatus?: 'fresh' | 'aging' | 'stale' | 'critical'
): Promise<AgingItem[]> => {
  // Get all listed items (not sold, not draft)
  const { data, error } = await supabase
    .from('inventory')
    .select('id, title, images, purchase_price, selling_price, status, created_at')
    .eq('user_id', userId)
    .eq('status', 'listed')
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch inventory: ${error.message}`);
  }

  const now = new Date();
  const agingItems: AgingItem[] = (data || []).map(item => {
    const createdAt = new Date(item.created_at);
    const daysListed = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
    const agingStatus = getAgingStatus(daysListed);
    const suggestedReduction = getSuggestedReduction(daysListed);

    return {
      ...item,
      days_listed: daysListed,
      aging_status: agingStatus,
      suggested_reduction: suggestedReduction,
      suggested_price: suggestedReduction > 0
        ? Math.round(item.selling_price * (1 - suggestedReduction / 100) * 100) / 100
        : undefined
    };
  });

  // Filter by aging status if specified
  if (filterStatus) {
    return agingItems.filter(item => item.aging_status === filterStatus);
  }

  return agingItems;
};

// Get aging statistics
export const getAgingStats = async (userId: string): Promise<AgingStats> => {
  const items = await getAgingInventory(userId);

  const stats: AgingStats = {
    total_listed: items.length,
    fresh_count: 0,
    aging_count: 0,
    stale_count: 0,
    critical_count: 0,
    total_value_at_risk: 0,
    avg_days_listed: 0
  };

  if (items.length === 0) {
    return stats;
  }

  let totalDays = 0;

  items.forEach(item => {
    totalDays += item.days_listed;

    switch (item.aging_status) {
      case 'fresh':
        stats.fresh_count++;
        break;
      case 'aging':
        stats.aging_count++;
        stats.total_value_at_risk += item.selling_price || 0;
        break;
      case 'stale':
        stats.stale_count++;
        stats.total_value_at_risk += item.selling_price || 0;
        break;
      case 'critical':
        stats.critical_count++;
        stats.total_value_at_risk += item.selling_price || 0;
        break;
    }
  });

  stats.avg_days_listed = Math.round(totalDays / items.length);

  return stats;
};

// Get smart repricing suggestions for an item using market research
export const getSmartRepricingSuggestion = async (
  userId: string,
  itemId: string
): Promise<{
  item: AgingItem;
  market_suggestion: {
    suggested_price: number;
    price_range: { min: number; max: number };
    confidence: 'high' | 'medium' | 'low';
    based_on: number;
  };
  aging_suggestion: {
    suggested_price: number;
    reduction_percent: number;
  };
  recommended_price: number;
  potential_profit: number;
}> => {
  // Get the item
  const { data: item, error } = await supabase
    .from('inventory')
    .select('*')
    .eq('id', itemId)
    .eq('user_id', userId)
    .single();

  if (error || !item) {
    throw new Error('Item not found');
  }

  const now = new Date();
  const createdAt = new Date(item.created_at);
  const daysListed = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
  const agingStatus = getAgingStatus(daysListed);
  const suggestedReduction = getSuggestedReduction(daysListed);

  const agingItem: AgingItem = {
    ...item,
    days_listed: daysListed,
    aging_status: agingStatus,
    suggested_reduction: suggestedReduction
  };

  // Get market-based suggestion
  const marketSuggestion = await getSuggestedPrice(item.title, item.condition);

  // Calculate aging-based suggestion
  const agingPrice = Math.round(item.selling_price * (1 - suggestedReduction / 100) * 100) / 100;

  // Determine recommended price (use market data if confident, otherwise use aging)
  let recommendedPrice: number;
  if (marketSuggestion.confidence === 'high' && marketSuggestion.suggested_price > 0) {
    // Use market price, but don't go below aging suggestion
    recommendedPrice = Math.max(marketSuggestion.suggested_price, agingPrice);
  } else if (marketSuggestion.confidence === 'medium' && marketSuggestion.suggested_price > 0) {
    // Average of market and aging
    recommendedPrice = Math.round((marketSuggestion.suggested_price + agingPrice) / 2 * 100) / 100;
  } else {
    // Use aging suggestion
    recommendedPrice = agingPrice;
  }

  // Ensure we don't go below purchase price (unless critical)
  if (agingStatus !== 'critical' && recommendedPrice < item.purchase_price) {
    recommendedPrice = item.purchase_price;
  }

  const potentialProfit = recommendedPrice - (item.purchase_price || 0);

  return {
    item: agingItem,
    market_suggestion: marketSuggestion,
    aging_suggestion: {
      suggested_price: agingPrice,
      reduction_percent: suggestedReduction
    },
    recommended_price: recommendedPrice,
    potential_profit: Math.round(potentialProfit * 100) / 100
  };
};

// Apply price reduction to an item
export const applyPriceReduction = async (
  userId: string,
  itemId: string,
  newPrice: number
): Promise<void> => {
  const { error } = await supabase
    .from('inventory')
    .update({
      selling_price: newPrice,
      updated_at: new Date().toISOString()
    })
    .eq('id', itemId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to update price: ${error.message}`);
  }
};

// Bulk apply suggested prices
export const bulkApplyAgingSuggestions = async (
  userId: string,
  items: Array<{ id: string; new_price: number }>
): Promise<{ updated: number; failed: number }> => {
  let updated = 0;
  let failed = 0;

  for (const item of items) {
    try {
      await applyPriceReduction(userId, item.id, item.new_price);
      updated++;
    } catch (error) {
      console.error(`Failed to update item ${item.id}:`, error);
      failed++;
    }
  }

  return { updated, failed };
};
