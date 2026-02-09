import supabase from '../config/supabase.js';
import { InventoryItem } from '../types/index.js';
import { calculateFees } from './feeCalculatorService.js';
import * as activityLogService from './activityLogService.js';

export interface CreateInventoryData {
  title: string;
  description?: string;
  category?: string;
  brand?: string;
  condition?: string;
  purchase_price?: number;
  purchase_date?: string;
  purchase_platform?: string;
  purchase_location?: string;
  selling_price?: number;
  images?: string[];
  notes?: string;
}

export interface UpdateInventoryData extends Partial<CreateInventoryData> {
  status?: string;
  sold_price?: number;
  sold_date?: string;
  sold_platform?: string;
  fees_total?: number;
  postage_cost?: number;
}

// Extended inventory item with computed fields
export interface InventoryItemWithStats extends InventoryItem {
  days_listed: number;
  days_since_created: number;
  is_stale: boolean;
  profit_potential: number | null;
}

// Calculate days between two dates
const calculateDays = (startDate: string | null, endDate: Date = new Date()): number => {
  if (!startDate) return 0;
  const start = new Date(startDate);
  const diffTime = endDate.getTime() - start.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
};

// Add computed stats to an inventory item
const addItemStats = (item: InventoryItem): InventoryItemWithStats => {
  const now = new Date();
  const daysSinceCreated = calculateDays(item.created_at, now);
  
  // Days listed: from first_listed_at (if set) or created_at if status is listed/sold
  let daysListed = 0;
  if (item.status === 'listed' || item.status === 'sold') {
    const listStartDate = (item as any).first_listed_at || item.created_at;
    daysListed = calculateDays(listStartDate, now);
  }

  // Stale inventory: listed for more than 30 days without selling
  const isStale = item.status === 'listed' && daysListed > 30;

  // Profit potential (for unsold items)
  let profitPotential: number | null = null;
  if (item.status !== 'sold' && item.selling_price && item.purchase_price !== null) {
    profitPotential = item.selling_price - item.purchase_price;
  }

  return {
    ...item,
    days_listed: daysListed,
    days_since_created: daysSinceCreated,
    is_stale: isStale,
    profit_potential: profitPotential,
  };
};

export const getInventory = async (
  userId: string,
  status?: string,
  page: number = 1,
  perPage: number = 20
): Promise<{ items: InventoryItemWithStats[]; total: number }> => {
  const offset = (page - 1) * perPage;

  let countQuery = supabase
    .from('inventory')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  let dataQuery = supabase
    .from('inventory')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + perPage - 1);

  if (status) {
    countQuery = countQuery.eq('status', status);
    dataQuery = dataQuery.eq('status', status);
  }

  const { count } = await countQuery;
  const { data, error } = await dataQuery;

  if (error) {
    throw new Error(`Failed to fetch inventory: ${error.message}`);
  }

  // Add computed stats to each item
  const itemsWithStats = (data || []).map(addItemStats);

  return {
    items: itemsWithStats,
    total: count || 0,
  };
};

export const getInventoryById = async (
  itemId: string,
  userId: string
): Promise<InventoryItemWithStats | null> => {
  const { data, error } = await supabase
    .from('inventory')
    .select('*')
    .eq('id', itemId)
    .eq('user_id', userId)
    .single();

  if (error) {
    return null;
  }

  return data ? addItemStats(data) : null;
};

export const createInventoryItem = async (
  userId: string,
  itemData: CreateInventoryData
): Promise<InventoryItemWithStats> => {
  const { data, error } = await supabase
    .from('inventory')
    .insert({
      user_id: userId,
      title: itemData.title,
      description: itemData.description || null,
      category: itemData.category || null,
      brand: itemData.brand || null,
      condition: itemData.condition || null,
      purchase_price: itemData.purchase_price || null,
      purchase_date: itemData.purchase_date || null,
      purchase_platform: itemData.purchase_platform || null,
      purchase_location: itemData.purchase_location || null,
      selling_price: itemData.selling_price || null,
      images: itemData.images || null,
      notes: itemData.notes || null,
      status: 'draft',
      listing_count: 0,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to create inventory item');
  }

  // Log the creation
  await activityLogService.addActivityLog(data.id, userId, {
    activity_type: 'created',
    content: `Item created: "${itemData.title}"`,
    metadata: {
      purchase_price: itemData.purchase_price,
      condition: itemData.condition,
    },
  });

  // Add initial note if provided
  if (itemData.notes) {
    await activityLogService.addNote(data.id, userId, itemData.notes);
  }

  return addItemStats(data);
};

export const updateInventoryItem = async (
  itemId: string,
  userId: string,
  updateData: UpdateInventoryData
): Promise<InventoryItemWithStats> => {
  // Verify ownership
  const existing = await getInventoryById(itemId, userId);
  if (!existing) {
    throw new Error('Item not found');
  }

  const updates: any = {
    ...updateData,
    updated_at: new Date().toISOString(),
  };

  // Track if status is changing to listed for the first time
  let isFirstListing = false;
  if (updateData.status === 'listed' && existing.status !== 'listed') {
    isFirstListing = !(existing as any).first_listed_at;
    if (isFirstListing) {
      updates.first_listed_at = new Date().toISOString();
    }
    updates.listing_count = ((existing as any).listing_count || 0) + 1;
  }

  // Track status change for relisting
  if (updateData.status === 'listed' && existing.status === 'sold') {
    updates.listing_count = ((existing as any).listing_count || 0) + 1;
  }

  const { data, error } = await supabase
    .from('inventory')
    .update(updates)
    .eq('id', itemId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to update item');
  }

  // Log status changes
  if (updateData.status && updateData.status !== existing.status) {
    await activityLogService.logStatusChange(
      itemId,
      userId,
      existing.status,
      updateData.status,
      isFirstListing ? { first_listing: true } : undefined
    );
  }

  // Log price changes
  if (updateData.selling_price !== undefined && updateData.selling_price !== existing.selling_price) {
    await activityLogService.logPriceChange(
      itemId,
      userId,
      existing.selling_price,
      updateData.selling_price,
      'selling'
    );
  }

  // Add note if notes field was updated
  if (updateData.notes && updateData.notes !== existing.notes) {
    await activityLogService.addNote(userId, itemId, `Updated notes: ${updateData.notes}`);
  }

  return addItemStats(data);
};

export const deleteInventoryItem = async (
  itemId: string,
  userId: string
): Promise<void> => {
  // Verify ownership
  const existing = await getInventoryById(itemId, userId);
  if (!existing) {
    throw new Error('Item not found');
  }

  const { error } = await supabase
    .from('inventory')
    .delete()
    .eq('id', itemId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to delete item: ${error.message}`);
  }
};

export interface MarkAsSoldResult extends InventoryItemWithStats {
  fee_breakdown?: {
    platform_fee: number;
    payment_processing_fee: number;
    final_value_fee: number;
    total_fees: number;
    net_proceeds: number;
    fee_percentage: number;
    was_auto_calculated: boolean;
  };
}

export const markAsSold = async (
  itemId: string,
  userId: string,
  soldData: {
    sold_price: number;
    sold_platform?: string;
    sold_date?: string;
    fees_total?: number;
    postage_cost?: number;
    auto_calculate_fees?: boolean;
  }
): Promise<MarkAsSoldResult> => {
  // Verify ownership
  const existing = await getInventoryById(itemId, userId);
  if (!existing) {
    throw new Error('Item not found');
  }

  let feesToUse = soldData.fees_total;
  let feeBreakdown = null;
  const wasAutoCalculated = feesToUse === undefined || soldData.auto_calculate_fees;

  // Auto-calculate fees if not provided or if explicitly requested
  if (wasAutoCalculated && soldData.sold_platform) {
    const breakdown = calculateFees(
      soldData.sold_price,
      soldData.sold_platform,
      soldData.postage_cost || 0
    );
    feesToUse = breakdown.total_fees;
    feeBreakdown = {
      ...breakdown,
      was_auto_calculated: true,
    };
  } else if (feesToUse !== undefined) {
    if (soldData.sold_platform) {
      const breakdown = calculateFees(
        soldData.sold_price,
        soldData.sold_platform,
        soldData.postage_cost || 0
      );
      feeBreakdown = {
        ...breakdown,
        total_fees: feesToUse,
        net_proceeds: soldData.sold_price - feesToUse,
        was_auto_calculated: false,
      };
    }
  }

  const { data, error } = await supabase
    .from('inventory')
    .update({
      status: 'sold',
      sold_price: soldData.sold_price,
      sold_platform: soldData.sold_platform || null,
      sold_date: soldData.sold_date || new Date().toISOString().split('T')[0],
      fees_total: feesToUse || 0,
      postage_cost: soldData.postage_cost || 0,
      updated_at: new Date().toISOString(),
    })
    .eq('id', itemId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to mark as sold');
  }

  // Calculate profit
  const profit = soldData.sold_price - (existing.purchase_price || 0) - (feesToUse || 0) - (soldData.postage_cost || 0);

  // Log the sale
  await activityLogService.logSale(
    itemId,
    userId,
    soldData.sold_price,
    soldData.sold_platform || 'Unknown',
    feesToUse || 0,
    profit
  );

  return {
    ...addItemStats(data),
    fee_breakdown: feeBreakdown || undefined,
  };
};

export const getInventoryStats = async (userId: string): Promise<{
  total_items: number;
  draft_count: number;
  listed_count: number;
  sold_count: number;
  total_invested: number;
  total_revenue: number;
  total_profit: number;
  stale_items_count: number;
  avg_days_to_sell: number;
}> => {
  const { data, error } = await supabase
    .from('inventory')
    .select('status, purchase_price, sold_price, fees_total, postage_cost, first_listed_at, sold_date, created_at')
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to fetch stats: ${error.message}`);
  }

  const items = data || [];

  // Calculate stale items (listed for >30 days)
  const now = new Date();
  const staleItemsCount = items.filter(i => {
    if (i.status !== 'listed') return false;
    const listDate = i.first_listed_at || i.created_at;
    const daysListed = calculateDays(listDate, now);
    return daysListed > 30;
  }).length;

  // Calculate average days to sell
  const soldItems = items.filter(i => i.status === 'sold' && i.sold_date);
  let avgDaysToSell = 0;
  if (soldItems.length > 0) {
    const totalDays = soldItems.reduce((sum, i) => {
      const listDate = i.first_listed_at || i.created_at;
      return sum + calculateDays(listDate, new Date(i.sold_date!));
    }, 0);
    avgDaysToSell = Math.round(totalDays / soldItems.length);
  }

  const stats = {
    total_items: items.length,
    draft_count: items.filter(i => i.status === 'draft').length,
    listed_count: items.filter(i => i.status === 'listed').length,
    sold_count: items.filter(i => i.status === 'sold').length,
    total_invested: items.reduce((sum, i) => sum + (i.purchase_price || 0), 0),
    total_revenue: items
      .filter(i => i.status === 'sold')
      .reduce((sum, i) => sum + (i.sold_price || 0), 0),
    total_profit: 0,
    stale_items_count: staleItemsCount,
    avg_days_to_sell: avgDaysToSell,
  };

  // Calculate profit
  stats.total_profit = items
    .filter(i => i.status === 'sold')
    .reduce((sum, i) => {
      const revenue = i.sold_price || 0;
      const cost = i.purchase_price || 0;
      const fees = i.fees_total || 0;
      const postage = i.postage_cost || 0;
      return sum + (revenue - cost - fees - postage);
    }, 0);

  return stats;
};

// Get stale inventory items (listed >30 days)
export const getStaleInventory = async (
  userId: string,
  daysThreshold: number = 30
): Promise<InventoryItemWithStats[]> => {
  const { data, error } = await supabase
    .from('inventory')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'listed')
    .order('first_listed_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch stale inventory: ${error.message}`);
  }

  const now = new Date();
  const staleItems = (data || [])
    .map(addItemStats)
    .filter(item => {
      const listDate = (item as any).first_listed_at || item.created_at;
      const daysListed = calculateDays(listDate, now);
      return daysListed > daysThreshold;
    });

  return staleItems;
};
