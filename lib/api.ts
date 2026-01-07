const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

interface ApiResponse<T> {
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
  pagination?: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
    has_next: boolean;
  };
}

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    // Load token from localStorage on init
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('token');
    }
  }

  setToken(token: string | null) {
    this.token = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('token', token);
      } else {
        localStorage.removeItem('token');
      }
    }
  }

  getToken(): string | null {
    return this.token;
  }

  setRefreshToken(token: string | null) {
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('refreshToken', token);
      } else {
        localStorage.removeItem('refreshToken');
      }
    }
  }

  getRefreshToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('refreshToken');
    }
    return null;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers,
      });

      const data: ApiResponse<T> = await response.json();

      // Handle token expiration
      if (response.status === 403 && data.error?.code === 'INVALID_TOKEN') {
        const refreshed = await this.refreshToken();
        if (refreshed) {
          // Retry the request with new token
          (headers as Record<string, string>)['Authorization'] = `Bearer ${this.token}`;
          const retryResponse = await fetch(`${this.baseUrl}${endpoint}`, {
            ...options,
            headers,
          });
          return await retryResponse.json();
        }
      }

      return data;
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: error instanceof Error ? error.message : 'Network request failed',
        },
      };
    }
  }

  private async refreshToken(): Promise<boolean> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) return false;

    try {
      const response = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      const data = await response.json();
      if (data.success && data.data) {
        this.setToken(data.data.token);
        this.setRefreshToken(data.data.refreshToken);
        return true;
      }
    } catch {
      // Refresh failed
    }

    // Clear tokens on refresh failure
    this.setToken(null);
    this.setRefreshToken(null);
    return false;
  }

  // Auth endpoints
  async signup(email: string, password: string, fullName?: string) {
    return this.request<{
      user: User;
      token: string;
      refreshToken: string;
    }>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, full_name: fullName }),
    });
  }

  async login(email: string, password: string) {
    return this.request<{
      user: User;
      token: string;
      refreshToken: string;
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async logout() {
    const result = await this.request('/auth/logout', { method: 'POST' });
    this.setToken(null);
    this.setRefreshToken(null);
    return result;
  }

  async getMe() {
    return this.request<User>('/auth/me');
  }

  async forgotPassword(email: string) {
    return this.request<{ message: string; debug_token?: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async resetPassword(token: string, password: string) {
    return this.request<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
  }

  // Alerts endpoints
  async getAlerts() {
    return this.request<Alert[]>('/alerts');
  }

  async createAlert(alert: CreateAlertData) {
    return this.request<Alert>('/alerts', {
      method: 'POST',
      body: JSON.stringify(alert),
    });
  }

  async getAlert(id: string) {
    return this.request<Alert>(`/alerts/${id}`);
  }

  async updateAlert(id: string, data: Partial<CreateAlertData>) {
    return this.request<Alert>(`/alerts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteAlert(id: string) {
    return this.request(`/alerts/${id}`, { method: 'DELETE' });
  }

  async pauseAlert(id: string) {
    return this.request<Alert>(`/alerts/${id}/pause`, { method: 'POST' });
  }

  async resumeAlert(id: string) {
    return this.request<Alert>(`/alerts/${id}/resume`, { method: 'POST' });
  }

  async runAlert(id: string) {
    return this.request<{ message: string; queued: boolean; resultsFound?: number }>(`/alerts/${id}/run`, { method: 'POST' });
  }

  async getAlertResults(id: string, page = 1, perPage = 20) {
    return this.request<AlertResult[]>(`/alerts/${id}/results?page=${page}&per_page=${perPage}`);
  }

  // Inventory endpoints
  async getInventory(status?: string, page = 1, perPage = 20) {
    let url = `/inventory?page=${page}&per_page=${perPage}`;
    if (status) url += `&status=${status}`;
    return this.request<InventoryItem[]>(url);
  }

  async createInventoryItem(item: CreateInventoryData) {
    return this.request<InventoryItem>('/inventory', {
      method: 'POST',
      body: JSON.stringify(item),
    });
  }

  async getInventoryItem(id: string) {
    return this.request<InventoryItem>(`/inventory/${id}`);
  }

  async updateInventoryItem(id: string, data: Partial<CreateInventoryData>) {
    return this.request<InventoryItem>(`/inventory/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteInventoryItem(id: string) {
    return this.request(`/inventory/${id}`, { method: 'DELETE' });
  }

  async markItemAsSold(id: string, soldData: MarkSoldData) {
    return this.request<InventoryItem>(`/inventory/${id}/sell`, {
      method: 'POST',
      body: JSON.stringify(soldData),
    });
  }

  async getInventoryStats() {
    return this.request<InventoryStats>('/inventory/stats');
  }

  // User endpoints
  async getUserStats(days?: number) {
    const params = days ? `?days=${days}` : '';
    return this.request<UserStats>(`/user/stats${params}`);
  }

  async updateProfile(data: { full_name?: string; location_postcode?: string }) {
    return this.request<User>('/user/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // Generic methods for other endpoints
  async get<T>(endpoint: string) {
    return this.request<T>(endpoint);
  }

  async post<T>(endpoint: string, body: unknown) {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async patch<T>(endpoint: string, body: unknown) {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  async delete<T>(endpoint: string) {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

// Types for frontend
export interface User {
  id: string;
  email: string;
  full_name: string | null;
  location_postcode: string | null;
  subscription_tier: string;
  subscription_status: string;
  ai_credits_remaining: number;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
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
  created_at: string;
  updated_at: string;
}

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

export interface MarkSoldData {
  sold_price: number;
  sold_platform?: string;
  sold_date?: string;
  fees_total?: number;
  postage_cost?: number;
}

export interface InventoryStats {
  total_items: number;
  draft_count: number;
  listed_count: number;
  sold_count: number;
  total_invested: number;
  total_revenue: number;
  total_profit: number;
}

export interface UserStats {
  active_alerts: number;
  unread_matches: number;
  total_items: number;
  listed_items: number;
  sold_items: number;
  total_revenue: number;
  total_profit: number;
}

// Export singleton instance
export const api = new ApiClient(API_BASE_URL);
export default api;
