import { create } from 'zustand';
import { api, User } from '../lib/api';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;

  // Actions
  login: (email: string, password: string) => Promise<boolean>;
  signup: (email: string, password: string, fullName?: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  clearError: () => void;
  forgotPassword: (email: string) => Promise<{ success: boolean; message: string; debugToken?: string }>;
  resetPassword: (token: string, password: string) => Promise<{ success: boolean; message: string }>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  error: null,

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });

    const response = await api.login(email, password);

    if (response.success && response.data) {
      api.setToken(response.data.token);
      api.setRefreshToken(response.data.refreshToken);
      set({
        user: response.data.user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
      return true;
    }

    set({
      isLoading: false,
      error: response.error?.message || 'Login failed',
    });
    return false;
  },

  signup: async (email: string, password: string, fullName?: string) => {
    set({ isLoading: true, error: null });

    const response = await api.signup(email, password, fullName);

    if (response.success && response.data) {
      api.setToken(response.data.token);
      api.setRefreshToken(response.data.refreshToken);
      set({
        user: response.data.user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
      return true;
    }

    set({
      isLoading: false,
      error: response.error?.message || 'Signup failed',
    });
    return false;
  },

  logout: async () => {
    await api.logout();
    set({
      user: null,
      isAuthenticated: false,
      error: null,
    });
  },

  checkAuth: async () => {
    const token = api.getToken();
    if (!token) {
      set({ isLoading: false, isAuthenticated: false, user: null });
      return;
    }

    set({ isLoading: true });

    const response = await api.getMe();

    if (response.success && response.data) {
      set({
        user: response.data,
        isAuthenticated: true,
        isLoading: false,
      });
    } else {
      api.setToken(null);
      api.setRefreshToken(null);
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },

  clearError: () => {
    set({ error: null });
  },

  forgotPassword: async (email: string) => {
    set({ isLoading: true, error: null });

    const response = await api.forgotPassword(email);

    set({ isLoading: false });

    if (response.success && response.data) {
      return {
        success: true,
        message: response.data.message,
        debugToken: response.data.debug_token,
      };
    }

    return {
      success: false,
      message: response.error?.message || 'Request failed',
    };
  },

  resetPassword: async (token: string, password: string) => {
    set({ isLoading: true, error: null });

    const response = await api.resetPassword(token, password);

    set({ isLoading: false });

    if (response.success && response.data) {
      return {
        success: true,
        message: response.data.message,
      };
    }

    return {
      success: false,
      message: response.error?.message || 'Password reset failed',
    };
  },
}));
