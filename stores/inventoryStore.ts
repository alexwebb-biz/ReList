import { create } from 'zustand';
import { api, InventoryItem, CreateInventoryData, MarkSoldData, InventoryStats, ActivityLogEntry } from '../lib/api';

interface InventoryState {
  items: InventoryItem[];
  stats: InventoryStats | null;
  activityLogs: Record<string, ActivityLogEntry[]>; // keyed by inventory item ID
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchInventory: (status?: string) => Promise<void>;
  fetchStats: () => Promise<void>;
  createItem: (data: CreateInventoryData) => Promise<InventoryItem | null>;
  updateItem: (id: string, data: Partial<CreateInventoryData>) => Promise<InventoryItem | null>;
  deleteItem: (id: string) => Promise<boolean>;
  markAsSold: (id: string, soldData: MarkSoldData) => Promise<InventoryItem | null>;
  fetchActivityLogs: (inventoryId: string) => Promise<void>;
  addNote: (inventoryId: string, content: string) => Promise<ActivityLogEntry | null>;
  deleteActivityLog: (inventoryId: string, logId: string) => Promise<boolean>;
  clearError: () => void;
}

export const useInventoryStore = create<InventoryState>((set, get) => ({
  items: [],
  stats: null,
  activityLogs: {},
  isLoading: false,
  error: null,

  fetchInventory: async (status?: string) => {
    set({ isLoading: true, error: null });

    const response = await api.getInventory(status);

    if (response.success && response.data) {
      set({ items: response.data, isLoading: false });
    } else {
      set({
        isLoading: false,
        error: response.error?.message || 'Failed to fetch inventory',
      });
    }
  },

  fetchStats: async () => {
    const response = await api.getInventoryStats();

    if (response.success && response.data) {
      set({ stats: response.data });
    }
  },

  createItem: async (data: CreateInventoryData) => {
    set({ isLoading: true, error: null });

    const response = await api.createInventoryItem(data);

    if (response.success && response.data) {
      set((state) => ({
        items: [response.data!, ...state.items],
        isLoading: false,
      }));
      return response.data;
    }

    set({
      isLoading: false,
      error: response.error?.message || 'Failed to create item',
    });
    return null;
  },

  updateItem: async (id: string, data: Partial<CreateInventoryData>) => {
    set({ isLoading: true, error: null });

    const response = await api.updateInventoryItem(id, data);

    if (response.success && response.data) {
      set((state) => ({
        items: state.items.map((i) => (i.id === id ? response.data! : i)),
        isLoading: false,
      }));
      return response.data;
    }

    set({
      isLoading: false,
      error: response.error?.message || 'Failed to update item',
    });
    return null;
  },

  deleteItem: async (id: string) => {
    set({ isLoading: true, error: null });

    const response = await api.deleteInventoryItem(id);

    if (response.success) {
      set((state) => ({
        items: state.items.filter((i) => i.id !== id),
        isLoading: false,
      }));
      return true;
    }

    set({
      isLoading: false,
      error: response.error?.message || 'Failed to delete item',
    });
    return false;
  },

  markAsSold: async (id: string, soldData: MarkSoldData) => {
    set({ isLoading: true, error: null });

    const response = await api.markItemAsSold(id, soldData);

    if (response.success && response.data) {
      set((state) => ({
        items: state.items.map((i) => (i.id === id ? response.data! : i)),
        isLoading: false,
      }));
      // Refresh activity logs for this item
      get().fetchActivityLogs(id);
      return response.data;
    }

    set({
      isLoading: false,
      error: response.error?.message || 'Failed to mark as sold',
    });
    return null;
  },

  fetchActivityLogs: async (inventoryId: string) => {
    const response = await api.getActivityLogs(inventoryId);

    if (response.success && response.data) {
      set((state) => ({
        activityLogs: {
          ...state.activityLogs,
          [inventoryId]: response.data!,
        },
      }));
    }
  },

  addNote: async (inventoryId: string, content: string) => {
    const response = await api.addNote(inventoryId, content);

    if (response.success && response.data) {
      set((state) => ({
        activityLogs: {
          ...state.activityLogs,
          [inventoryId]: [response.data!, ...(state.activityLogs[inventoryId] || [])],
        },
      }));
      return response.data;
    }

    return null;
  },

  deleteActivityLog: async (inventoryId: string, logId: string) => {
    const response = await api.deleteActivityLog(logId);

    if (response.success) {
      set((state) => ({
        activityLogs: {
          ...state.activityLogs,
          [inventoryId]: (state.activityLogs[inventoryId] || []).filter(
            (log) => log.id !== logId
          ),
        },
      }));
      return true;
    }

    return false;
  },

  clearError: () => {
    set({ error: null });
  },
}));
