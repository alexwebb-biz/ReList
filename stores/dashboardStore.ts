import { create } from 'zustand';
import { api, UserStats } from '../lib/api';

interface DashboardState {
  stats: UserStats | null;
  isLoading: boolean;
  error: string | null;
  dateRange: number | null; // null = all time, number = days

  // Actions
  fetchStats: (days?: number) => Promise<void>;
  setDateRange: (days: number | null) => void;
  clearError: () => void;
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  stats: null,
  isLoading: false,
  error: null,
  dateRange: null,

  fetchStats: async (days?: number) => {
    set({ isLoading: true, error: null });

    // Use provided days or current dateRange
    const daysToUse = days !== undefined ? days : (get().dateRange ?? undefined);
    const response = await api.getUserStats(daysToUse);

    if (response.success && response.data) {
      set({ stats: response.data, isLoading: false });
    } else {
      set({
        isLoading: false,
        error: response.error?.message || 'Failed to fetch stats',
      });
    }
  },

  setDateRange: (days: number | null) => {
    set({ dateRange: days });
  },

  clearError: () => {
    set({ error: null });
  },
}));
