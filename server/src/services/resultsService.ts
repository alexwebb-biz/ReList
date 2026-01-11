import supabase from '../config/supabase.js';
import { AlertResult } from '../types/index.js';

export const getAllResults = async (
  userId: string,
  page: number = 1,
  perPage: number = 20,
  unreadOnly: boolean = false,
  platform?: string
): Promise<{ results: AlertResult[]; total: number }> => {
  const offset = (page - 1) * perPage;

  // First get all alert IDs for this user
  const { data: userAlerts } = await supabase
    .from('alerts')
    .select('id')
    .eq('user_id', userId);

  if (!userAlerts || userAlerts.length === 0) {
    return { results: [], total: 0 };
  }

  const alertIds = userAlerts.map(a => a.id);

  // Build query
  let countQuery = supabase
    .from('alert_results')
    .select('*', { count: 'exact', head: true })
    .in('alert_id', alertIds);

  let dataQuery = supabase
    .from('alert_results')
    .select('*')
    .in('alert_id', alertIds)
    .order('created_at', { ascending: false })
    .range(offset, offset + perPage - 1);

  if (unreadOnly) {
    countQuery = countQuery.eq('is_read', false);
    dataQuery = dataQuery.eq('is_read', false);
  }

  if (platform) {
    countQuery = countQuery.eq('platform', platform);
    dataQuery = dataQuery.eq('platform', platform);
  }

  const { count } = await countQuery;
  const { data, error } = await dataQuery;

  if (error) {
    throw new Error(`Failed to fetch results: ${error.message}`);
  }

  return {
    results: data || [],
    total: count || 0,
  };
};

export const getResultById = async (
  resultId: string,
  userId: string
): Promise<AlertResult | null> => {
  // First verify the result belongs to an alert owned by the user
  const { data: result, error } = await supabase
    .from('alert_results')
    .select('*, alerts!inner(user_id)')
    .eq('id', resultId)
    .single();

  if (error || !result) {
    return null;
  }

  // Check ownership
  if ((result as any).alerts?.user_id !== userId) {
    return null;
  }

  // Remove the joined alerts data
  const { alerts: _, ...resultData } = result as any;
  return resultData;
};

export const markAsRead = async (
  resultId: string,
  userId: string
): Promise<AlertResult> => {
  // Verify ownership first
  const existing = await getResultById(resultId, userId);
  if (!existing) {
    throw new Error('Result not found');
  }

  const { data, error } = await supabase
    .from('alert_results')
    .update({ is_read: true })
    .eq('id', resultId)
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to mark as read');
  }

  return data;
};

export const markMultipleAsRead = async (
  resultIds: string[],
  userId: string
): Promise<number> => {
  // Get user's alert IDs
  const { data: userAlerts } = await supabase
    .from('alerts')
    .select('id')
    .eq('user_id', userId);

  if (!userAlerts) {
    return 0;
  }

  const alertIds = userAlerts.map(a => a.id);

  const { data, error } = await supabase
    .from('alert_results')
    .update({ is_read: true })
    .in('id', resultIds)
    .in('alert_id', alertIds)
    .select();

  if (error) {
    throw new Error(`Failed to mark as read: ${error.message}`);
  }

  return data?.length || 0;
};

export interface SaveToInventoryOptions {
  purchase_price?: number;
  selling_price?: number;
  notes?: string;
}

export const saveToInventory = async (
  resultId: string,
  userId: string,
  options?: SaveToInventoryOptions
): Promise<{ inventoryId: string }> => {
  // Get the result
  const result = await getResultById(resultId, userId);
  if (!result) {
    throw new Error('Result not found');
  }

  // Build notes - combine custom notes with source URL
  const sourceNote = `Sourced from alert. Original URL: ${result.url}`;
  const finalNotes = options?.notes
    ? `${options.notes}\n\n${sourceNote}`
    : sourceNote;

  // Create inventory item from result
  const { data: inventoryItem, error } = await supabase
    .from('inventory')
    .insert({
      user_id: userId,
      title: result.title,
      description: result.description,
      purchase_price: options?.purchase_price ?? result.price,
      selling_price: options?.selling_price,
      purchase_platform: result.platform,
      purchase_location: result.location,
      condition: result.condition,
      images: result.image_urls,
      status: 'draft',
      notes: finalNotes,
    })
    .select('id')
    .single();

  if (error || !inventoryItem) {
    throw new Error(error?.message || 'Failed to save to inventory');
  }

  // Mark the result as saved
  await supabase
    .from('alert_results')
    .update({ is_saved: true })
    .eq('id', resultId);

  return { inventoryId: inventoryItem.id };
};

export const getUnreadCount = async (userId: string): Promise<number> => {
  // Get user's alert IDs
  const { data: userAlerts } = await supabase
    .from('alerts')
    .select('id')
    .eq('user_id', userId);

  if (!userAlerts || userAlerts.length === 0) {
    return 0;
  }

  const alertIds = userAlerts.map(a => a.id);

  const { count } = await supabase
    .from('alert_results')
    .select('*', { count: 'exact', head: true })
    .in('alert_id', alertIds)
    .eq('is_read', false);

  return count || 0;
};
