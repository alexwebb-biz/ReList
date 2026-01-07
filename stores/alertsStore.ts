import { create } from 'zustand';
import { api, Alert, CreateAlertData } from '../lib/api';

interface AlertsState {
  alerts: Alert[];
  isLoading: boolean;
  error: string | null;
  runningAlertId: string | null;

  // Actions
  fetchAlerts: () => Promise<void>;
  createAlert: (data: CreateAlertData) => Promise<Alert | null>;
  updateAlert: (id: string, data: Partial<CreateAlertData>) => Promise<Alert | null>;
  deleteAlert: (id: string) => Promise<boolean>;
  pauseAlert: (id: string) => Promise<boolean>;
  resumeAlert: (id: string) => Promise<boolean>;
  runAlert: (id: string) => Promise<{ success: boolean; resultsFound?: number }>;
  clearError: () => void;
}

export const useAlertsStore = create<AlertsState>((set) => ({
  alerts: [],
  isLoading: false,
  runningAlertId: null,
  error: null,

  fetchAlerts: async () => {
    set({ isLoading: true, error: null });

    const response = await api.getAlerts();

    if (response.success && response.data) {
      set({ alerts: response.data, isLoading: false });
    } else {
      set({
        isLoading: false,
        error: response.error?.message || 'Failed to fetch alerts',
      });
    }
  },

  createAlert: async (data: CreateAlertData) => {
    set({ isLoading: true, error: null });

    const response = await api.createAlert(data);

    if (response.success && response.data) {
      set((state) => ({
        alerts: [response.data!, ...state.alerts],
        isLoading: false,
      }));
      return response.data;
    }

    set({
      isLoading: false,
      error: response.error?.message || 'Failed to create alert',
    });
    return null;
  },

  updateAlert: async (id: string, data: Partial<CreateAlertData>) => {
    set({ isLoading: true, error: null });

    const response = await api.updateAlert(id, data);

    if (response.success && response.data) {
      set((state) => ({
        alerts: state.alerts.map((a) => (a.id === id ? response.data! : a)),
        isLoading: false,
      }));
      return response.data;
    }

    set({
      isLoading: false,
      error: response.error?.message || 'Failed to update alert',
    });
    return null;
  },

  deleteAlert: async (id: string) => {
    set({ isLoading: true, error: null });

    const response = await api.deleteAlert(id);

    if (response.success) {
      set((state) => ({
        alerts: state.alerts.filter((a) => a.id !== id),
        isLoading: false,
      }));
      return true;
    }

    set({
      isLoading: false,
      error: response.error?.message || 'Failed to delete alert',
    });
    return false;
  },

  pauseAlert: async (id: string) => {
    const response = await api.pauseAlert(id);

    if (response.success && response.data) {
      set((state) => ({
        alerts: state.alerts.map((a) => (a.id === id ? response.data! : a)),
      }));
      return true;
    }
    return false;
  },

  resumeAlert: async (id: string) => {
    const response = await api.resumeAlert(id);

    if (response.success && response.data) {
      set((state) => ({
        alerts: state.alerts.map((a) => (a.id === id ? response.data! : a)),
      }));
      return true;
    }
    return false;
  },

  runAlert: async (id: string) => {
    set({ runningAlertId: id });

    const response = await api.runAlert(id);

    set({ runningAlertId: null });

    if (response.success && response.data) {
      return { success: true, resultsFound: response.data.resultsFound };
    }
    return { success: false };
  },

  clearError: () => {
    set({ error: null });
  },
}));
