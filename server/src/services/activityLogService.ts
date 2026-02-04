import supabase from '../config/supabase.js';

export interface ActivityLogEntry {
  id: string;
  inventory_id: string;
  user_id: string;
  activity_type: 'note' | 'status_change' | 'price_change' | 'listed' | 'sold' | 'relisted' | 'created';
  content: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface CreateActivityLogData {
  activity_type: ActivityLogEntry['activity_type'];
  content: string;
  metadata?: Record<string, unknown>;
}

export const getActivityLogs = async (
  inventoryId: string,
  userId: string,
  limit: number = 50
): Promise<ActivityLogEntry[]> => {
  // First verify the user owns this inventory item
  const { data: item, error: itemError } = await supabase
    .from('inventory')
    .select('id')
    .eq('id', inventoryId)
    .eq('user_id', userId)
    .single();

  if (itemError || !item) {
    throw new Error('Item not found or access denied');
  }

  const { data, error } = await supabase
    .from('inventory_activity_logs')
    .select('*')
    .eq('inventory_id', inventoryId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch activity logs: ${error.message}`);
  }

  return data || [];
};

export const addActivityLog = async (
  inventoryId: string,
  userId: string,
  data: CreateActivityLogData
): Promise<ActivityLogEntry> => {
  // First verify the user owns this inventory item
  const { data: item, error: itemError } = await supabase
    .from('inventory')
    .select('id')
    .eq('id', inventoryId)
    .eq('user_id', userId)
    .single();

  if (itemError || !item) {
    throw new Error('Item not found or access denied');
  }

  const { data: log, error } = await supabase
    .from('inventory_activity_logs')
    .insert({
      inventory_id: inventoryId,
      user_id: userId,
      activity_type: data.activity_type,
      content: data.content,
      metadata: data.metadata || null,
    })
    .select()
    .single();

  if (error || !log) {
    throw new Error(`Failed to add activity log: ${error?.message}`);
  }

  return log;
};

export const addNote = async (
  inventoryId: string,
  userId: string,
  noteContent: string
): Promise<ActivityLogEntry> => {
  return addActivityLog(inventoryId, userId, {
    activity_type: 'note',
    content: noteContent,
  });
};

export const deleteActivityLog = async (
  logId: string,
  userId: string
): Promise<void> => {
  const { error } = await supabase
    .from('inventory_activity_logs')
    .delete()
    .eq('id', logId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to delete activity log: ${error.message}`);
  }
};

// Helper to automatically log status changes
export const logStatusChange = async (
  inventoryId: string,
  userId: string,
  oldStatus: string,
  newStatus: string,
  additionalMetadata?: Record<string, unknown>
): Promise<void> => {
  const statusMessages: Record<string, string> = {
    draft: 'Moved to drafts',
    listed: 'Item listed for sale',
    sold: 'Item sold',
    archived: 'Item archived',
  };

  await addActivityLog(inventoryId, userId, {
    activity_type: 'status_change',
    content: statusMessages[newStatus] || `Status changed from ${oldStatus} to ${newStatus}`,
    metadata: {
      old_status: oldStatus,
      new_status: newStatus,
      ...additionalMetadata,
    },
  });
};

// Helper to log price changes
export const logPriceChange = async (
  inventoryId: string,
  userId: string,
  oldPrice: number | null,
  newPrice: number | null,
  priceType: 'selling' | 'sold'
): Promise<void> => {
  const formattedOld = oldPrice ? `£${oldPrice.toFixed(2)}` : 'not set';
  const formattedNew = newPrice ? `£${newPrice.toFixed(2)}` : 'not set';

  await addActivityLog(inventoryId, userId, {
    activity_type: 'price_change',
    content: `${priceType === 'selling' ? 'Selling' : 'Sold'} price changed from ${formattedOld} to ${formattedNew}`,
    metadata: {
      price_type: priceType,
      old_price: oldPrice,
      new_price: newPrice,
    },
  });
};

// Helper to log sales
export const logSale = async (
  inventoryId: string,
  userId: string,
  soldPrice: number,
  platform: string,
  fees: number,
  profit: number
): Promise<void> => {
  await addActivityLog(inventoryId, userId, {
    activity_type: 'sold',
    content: `Sold for £${soldPrice.toFixed(2)} on ${platform}`,
    metadata: {
      sold_price: soldPrice,
      platform,
      fees,
      profit,
    },
  });
};
