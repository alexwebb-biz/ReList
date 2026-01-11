import supabase from '../config/supabase.js';
import { notifyPriceDrop, notifyPriceDropsBatch } from './notificationService.js';

export interface WatchedItem {
  id: string;
  user_id: string;
  alert_result_id: string | null;
  external_id: string;
  platform: string;
  title: string;
  url: string;
  image_url: string | null;
  initial_price: number;
  current_price: number;
  target_price: number | null;
  currency: string;
  last_checked_at: string;
  is_active: boolean;
  created_at: string;
  price_change?: number;
  price_change_percent?: number;
  price_history?: PricePoint[];
}

export interface PricePoint {
  price: number;
  recorded_at: string;
}

export interface CreateWatchedItemData {
  alert_result_id?: string;
  external_id: string;
  platform: string;
  title: string;
  url: string;
  image_url?: string;
  price: number;
  target_price?: number;
  currency?: string;
}

// Get all watched items for a user
export const getWatchedItems = async (
  userId: string,
  activeOnly = true
): Promise<WatchedItem[]> => {
  let query = supabase
    .from('watched_items')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (activeOnly) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch watched items: ${error.message}`);
  }

  // Calculate price changes
  const itemsWithChanges = (data || []).map(item => ({
    ...item,
    price_change: item.current_price - item.initial_price,
    price_change_percent: ((item.current_price - item.initial_price) / item.initial_price) * 100
  }));

  return itemsWithChanges;
};

// Get a single watched item with price history
export const getWatchedItemWithHistory = async (
  itemId: string,
  userId: string
): Promise<WatchedItem | null> => {
  const { data: item, error: itemError } = await supabase
    .from('watched_items')
    .select('*')
    .eq('id', itemId)
    .eq('user_id', userId)
    .single();

  if (itemError || !item) {
    return null;
  }

  // Get price history
  const { data: history } = await supabase
    .from('price_history')
    .select('price, recorded_at')
    .eq('watched_item_id', itemId)
    .order('recorded_at', { ascending: true });

  return {
    ...item,
    price_change: item.current_price - item.initial_price,
    price_change_percent: ((item.current_price - item.initial_price) / item.initial_price) * 100,
    price_history: history || []
  };
};

// Add item to watchlist
export const addToWatchlist = async (
  userId: string,
  data: CreateWatchedItemData
): Promise<WatchedItem> => {
  // Check if already watching
  const { data: existing } = await supabase
    .from('watched_items')
    .select('id')
    .eq('user_id', userId)
    .eq('platform', data.platform)
    .eq('external_id', data.external_id)
    .eq('is_active', true)
    .single();

  if (existing) {
    throw new Error('Already watching this item');
  }

  // Create watched item
  const { data: watchedItem, error } = await supabase
    .from('watched_items')
    .insert({
      user_id: userId,
      alert_result_id: data.alert_result_id,
      external_id: data.external_id,
      platform: data.platform,
      title: data.title,
      url: data.url,
      image_url: data.image_url,
      initial_price: data.price,
      current_price: data.price,
      target_price: data.target_price,
      currency: data.currency || 'GBP',
    })
    .select()
    .single();

  if (error || !watchedItem) {
    throw new Error(error?.message || 'Failed to add to watchlist');
  }

  // Record initial price in history
  await supabase.from('price_history').insert({
    watched_item_id: watchedItem.id,
    price: data.price,
  });

  return watchedItem;
};

// Update target price
export const updateTargetPrice = async (
  itemId: string,
  userId: string,
  targetPrice: number | null
): Promise<WatchedItem> => {
  const { data, error } = await supabase
    .from('watched_items')
    .update({
      target_price: targetPrice,
      updated_at: new Date().toISOString()
    })
    .eq('id', itemId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to update target price');
  }

  return data;
};

// Remove from watchlist (soft delete)
export const removeFromWatchlist = async (
  itemId: string,
  userId: string
): Promise<void> => {
  const { error } = await supabase
    .from('watched_items')
    .update({
      is_active: false,
      updated_at: new Date().toISOString()
    })
    .eq('id', itemId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(error.message);
  }
};

// Update price for a watched item (called by price checker job)
export const updateWatchedItemPrice = async (
  itemId: string,
  newPrice: number
): Promise<{ priceDropped: boolean; item: WatchedItem }> => {
  // Get current item
  const { data: item, error: fetchError } = await supabase
    .from('watched_items')
    .select('*')
    .eq('id', itemId)
    .single();

  if (fetchError || !item) {
    throw new Error('Item not found');
  }

  const priceDropped = newPrice < item.current_price;
  const hitTarget = item.target_price && newPrice <= item.target_price;

  // Update price
  const { data: updatedItem, error } = await supabase
    .from('watched_items')
    .update({
      current_price: newPrice,
      last_checked_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', itemId)
    .select()
    .single();

  if (error || !updatedItem) {
    throw new Error(error?.message || 'Failed to update price');
  }

  // Record in price history (only if price changed)
  if (newPrice !== item.current_price) {
    await supabase.from('price_history').insert({
      watched_item_id: itemId,
      price: newPrice,
    });
  }

  return {
    priceDropped: priceDropped || hitTarget,
    item: {
      ...updatedItem,
      price_change: newPrice - item.initial_price,
      price_change_percent: ((newPrice - item.initial_price) / item.initial_price) * 100
    }
  };
};

// Get items with price drops
export const getItemsWithPriceDrops = async (
  userId: string
): Promise<WatchedItem[]> => {
  const { data, error } = await supabase
    .from('watched_items')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .lt('current_price', supabase.rpc('get_initial_price'));  // This won't work, need raw SQL

  // Simpler approach - get all and filter in memory
  const items = await getWatchedItems(userId);
  return items.filter(item => item.current_price < item.initial_price);
};

// Get count of watched items
export const getWatchlistCount = async (userId: string): Promise<number> => {
  const { count, error } = await supabase
    .from('watched_items')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_active', true);

  if (error) {
    throw new Error(error.message);
  }

  return count || 0;
};

// Check prices for all active watched items and send notifications
// This should be called by a scheduled job
export const checkPricesAndNotify = async (): Promise<{
  checked: number;
  drops: number;
  errors: number;
}> => {
  const stats = { checked: 0, drops: 0, errors: 0 };

  // Get all active watched items grouped by user
  const { data: items, error } = await supabase
    .from('watched_items')
    .select('*')
    .eq('is_active', true);

  if (error || !items) {
    console.error('Failed to fetch watched items:', error);
    return stats;
  }

  // Group items by user for batch notifications
  const itemsByUser = new Map<string, typeof items>();
  for (const item of items) {
    const userItems = itemsByUser.get(item.user_id) || [];
    userItems.push(item);
    itemsByUser.set(item.user_id, userItems);
  }

  // Process each user's items
  for (const [userId, userItems] of itemsByUser) {
    const priceDrops: Array<{
      title: string;
      url: string;
      image_url?: string;
      platform: string;
      previous_price: number;
      current_price: number;
      target_price?: number;
      price_drop_percent: number;
    }> = [];

    for (const item of userItems) {
      try {
        // In a real implementation, we would scrape the actual page
        // For now, this is a placeholder that would be called with actual price data
        // The actual scraping would be done by a separate job that calls updateWatchedItemPrice
        stats.checked++;

        // Check if current_price has changed (would be set by scraper)
        if (item.current_price < item.initial_price) {
          const dropPercent = ((item.initial_price - item.current_price) / item.initial_price) * 100;

          priceDrops.push({
            title: item.title,
            url: item.url,
            image_url: item.image_url,
            platform: item.platform,
            previous_price: item.initial_price,
            current_price: item.current_price,
            target_price: item.target_price,
            price_drop_percent: dropPercent,
          });
          stats.drops++;
        }
      } catch (err) {
        console.error(`Error processing watched item ${item.id}:`, err);
        stats.errors++;
      }
    }

    // Send batch notification for this user
    if (priceDrops.length > 0) {
      try {
        await notifyPriceDropsBatch(userId, priceDrops);
      } catch (err) {
        console.error(`Failed to send notifications to user ${userId}:`, err);
      }
    }
  }

  return stats;
};

// Update price and send notification if dropped (called after scraping)
export const updatePriceAndNotify = async (
  itemId: string,
  newPrice: number
): Promise<void> => {
  const { priceDropped, item } = await updateWatchedItemPrice(itemId, newPrice);

  if (priceDropped && item.user_id) {
    const dropPercent = Math.abs(item.price_change_percent || 0);

    await notifyPriceDrop(item.user_id, {
      title: item.title,
      url: item.url,
      image_url: item.image_url || undefined,
      platform: item.platform,
      previous_price: item.initial_price,
      current_price: newPrice,
      target_price: item.target_price || undefined,
      price_drop_percent: dropPercent,
    });
  }
};
