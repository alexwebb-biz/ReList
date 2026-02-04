import { Request } from 'express';

// Database types
export interface User {
  id: string;
  email: string;
  password_hash: string;
  full_name: string | null;
  location_postcode: string | null;
  location_lat: number | null;
  location_lng: number | null;
  subscription_tier: string;
  subscription_status: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  ai_credits_remaining: number;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
  reset_token_hash: string | null;
  reset_token_expires: string | null;
  notification_email: boolean;
  notification_push: boolean;
  notification_telegram: boolean;
  telegram_chat_id: string | null;
  notification_discord: boolean;
  discord_webhook_url: string | null;
}

export interface Alert {
  id: string;
  user_id: string;
  name: string;
  keywords: string[];
  exclude_keywords: string[] | null;
  platforms: string[];
  categories: string[] | null;
  price_min: number | null;
  price_max: number | null;
  condition: string[] | null;
  radius_miles: number;
  location_postcode: string | null;
  check_frequency_minutes: number;
  is_active: boolean;
  notification_channels: string[];
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AlertResult {
  id: string;
  alert_id: string;
  external_id: string;
  platform: string;
  title: string;
  description: string | null;
  price: number;
  currency: string;
  location: string | null;
  condition: string | null;
  image_urls: string[] | null;
  url: string;
  seller_name: string | null;
  posted_at: string | null;
  notified_at: string | null;
  is_read: boolean;
  is_saved: boolean;
  created_at: string;
}

export interface InventoryItem {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  category: string | null;
  brand: string | null;
  condition: string | null;
  purchase_price: number | null;
  purchase_date: string | null;
  purchase_platform: string | null;
  purchase_location: string | null;
  selling_price: number | null;
  sold_price: number | null;
  sold_date: string | null;
  sold_platform: string | null;
  fees_total: number;
  postage_cost: number;
  status: string;
  images: string[] | null;
  notes: string | null;
  first_listed_at: string | null;
  listing_count: number;
  created_at: string;
  updated_at: string;
}

export interface Listing {
  id: string;
  inventory_id: string;
  user_id: string;
  platform: string;
  external_id: string | null;
  title: string;
  description: string | null;
  price: number;
  url: string | null;
  status: string;
  listed_at: string;
  sold_at: string | null;
  views_count: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string | null;
  data: Record<string, unknown> | null;
  channels: string[] | null;
  is_read: boolean;
  sent_at: string;
}

export type Platform = 'eBay' | 'Vinted' | 'Depop' | 'Facebook' | 'Gumtree' | 'Shpock';

export interface CrossListing {
  id: string;
  inventory_id: string;
  user_id: string;
  platform: Platform;
  external_listing_id: string | null;
  title: string;
  description: string | null;
  price: number;
  url: string | null;
  status: 'draft' | 'active' | 'sold' | 'ended' | 'error';
  error_message: string | null;
  listed_at: string | null;
  synced_at: string | null;
  created_at: string;
  updated_at: string;
}

// Request types
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    field?: string;
  };
  meta?: {
    timestamp: string;
  };
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination?: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
    has_next: boolean;
  };
}
