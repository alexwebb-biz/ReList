import supabase from '../config/supabase.js';
import { Alert } from '../types/index.js';

export interface CreateAlertData {
  name: string;
  keywords: string[];
  exclude_keywords?: string[];
  platforms: string[];
  categories?: string[];
  price_min?: number;
  price_max?: number;
  condition?: string[];
  radius_miles?: number;
  location_postcode?: string;
  check_frequency_minutes?: number;
  notification_channels?: string[];
}

export interface UpdateAlertData extends Partial<CreateAlertData> {
  is_active?: boolean;
}

export const getAlerts = async (userId: string): Promise<Alert[]> => {
  const { data, error } = await supabase
    .from('alerts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch alerts: ${error.message}`);
  }

  return data || [];
};

export const getAlertById = async (alertId: string, userId: string): Promise<Alert | null> => {
  const { data, error } = await supabase
    .from('alerts')
    .select('*')
    .eq('id', alertId)
    .eq('user_id', userId)
    .single();

  if (error) {
    return null;
  }

  return data;
};

export const createAlert = async (userId: string, alertData: CreateAlertData): Promise<Alert> => {
  const { data, error } = await supabase
    .from('alerts')
    .insert({
      user_id: userId,
      name: alertData.name,
      keywords: alertData.keywords,
      exclude_keywords: alertData.exclude_keywords || null,
      platforms: alertData.platforms,
      categories: alertData.categories || null,
      price_min: alertData.price_min || null,
      price_max: alertData.price_max || null,
      condition: alertData.condition || null,
      radius_miles: alertData.radius_miles || 25,
      location_postcode: alertData.location_postcode || null,
      check_frequency_minutes: alertData.check_frequency_minutes || 60,
      notification_channels: alertData.notification_channels || ['email'],
      is_active: true,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to create alert');
  }

  return data;
};

export const updateAlert = async (
  alertId: string,
  userId: string,
  updateData: UpdateAlertData
): Promise<Alert> => {
  // First verify the alert belongs to the user
  const existing = await getAlertById(alertId, userId);
  if (!existing) {
    throw new Error('Alert not found');
  }

  const { data, error } = await supabase
    .from('alerts')
    .update({
      ...updateData,
      updated_at: new Date().toISOString(),
    })
    .eq('id', alertId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to update alert');
  }

  return data;
};

export const deleteAlert = async (alertId: string, userId: string): Promise<void> => {
  // First verify the alert belongs to the user
  const existing = await getAlertById(alertId, userId);
  if (!existing) {
    throw new Error('Alert not found');
  }

  const { error } = await supabase
    .from('alerts')
    .delete()
    .eq('id', alertId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to delete alert: ${error.message}`);
  }
};

export const pauseAlert = async (alertId: string, userId: string): Promise<Alert> => {
  return updateAlert(alertId, userId, { is_active: false });
};

export const resumeAlert = async (alertId: string, userId: string): Promise<Alert> => {
  return updateAlert(alertId, userId, { is_active: true });
};

export const getAlertResults = async (
  alertId: string,
  userId: string,
  page: number = 1,
  perPage: number = 20
): Promise<{ results: any[]; total: number }> => {
  // First verify the alert belongs to the user
  const existing = await getAlertById(alertId, userId);
  if (!existing) {
    throw new Error('Alert not found');
  }

  const offset = (page - 1) * perPage;

  // Get total count
  const { count } = await supabase
    .from('alert_results')
    .select('*', { count: 'exact', head: true })
    .eq('alert_id', alertId);

  // Get paginated results
  const { data, error } = await supabase
    .from('alert_results')
    .select('*')
    .eq('alert_id', alertId)
    .order('created_at', { ascending: false })
    .range(offset, offset + perPage - 1);

  if (error) {
    throw new Error(`Failed to fetch alert results: ${error.message}`);
  }

  return {
    results: data || [],
    total: count || 0,
  };
};
