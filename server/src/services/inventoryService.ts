import supabase from '../config/supabase.js';
import { InventoryItem } from '../types/index.js';
import { calculateFees } from './feeCalculatorService.js';

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

export const getInventory = async (
  userId: string,
  status?: string,
  page: number = 1,
  perPage: number = 20
): Promise<{ items: InventoryItem[]; total: number }> => {
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

  return {
    items: data || [],
    total: count || 0,
  };
};

export const getInventoryById = async (
  itemId: string,
  userId: string
): Promise<InventoryItem | null> => {
  const { data, error } = await supabase
    .from('inventory')
    .select('*')
    .eq('id', itemId)
    .eq('user_id', userId)
    .single();

  if (error) {
    return null;
  }

  return data;
};

export const createInventoryItem = async (
  userId: string,
  itemData: CreateInventoryData
): Promise<InventoryItem> => {
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
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to create inventory item');
  }

  return data;
};

export const updateInventoryItem = async (
  itemId: string,
  userId: string,
  updateData: UpdateInventoryData
): Promise<InventoryItem> => {
  // Verify ownership
  const existing = await getInventoryById(itemId, userId);
  if (!existing) {
    throw new Error('Item not found');
  }

  const { data, error } = await supabase
    .from('inventory')
    .update({
      ...updateData,
      updated_at: new Date().toISOString(),
    })
    .eq('id', itemId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to update item');
  }

  return data;
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

export interface MarkAsSoldResult extends InventoryItem {
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
    auto_calculate_fees?: boolean; // If true, calculate fees automatically
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
    // User provided fees - still calculate breakdown for reference
    if (soldData.sold_platform) {
      const breakdown = calculateFees(
        soldData.sold_price,
        soldData.sold_platform,
        soldData.postage_cost || 0
      );
      feeBreakdown = {
        ...breakdown,
        total_fees: feesToUse, // Use user's value
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

  return {
    ...data,
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
}> => {
  const { data, error } = await supabase
    .from('inventory')
    .select('status, purchase_price, sold_price, fees_total, postage_cost')
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to fetch stats: ${error.message}`);
  }

  const items = data || [];

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
  };

  // Calculate profit (revenue - cost - fees - postage)
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
