import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, CheckCheck, Trash2, X, AlertCircle, TrendingDown, ShoppingBag, Info } from 'lucide-react';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/authStore';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string | null;
  data: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
}

export const NotificationBell: React.FC = () => {
  const { isAuthenticated } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isAuthenticated) {
      fetchUnreadCount();
      // Poll for new notifications every 30 seconds
      const interval = setInterval(fetchUnreadCount, 30000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    // Close dropdown when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchUnreadCount = async () => {
    const response = await api.get<{ count: number }>('/notifications/unread-count');
    if (response.success && response.data) {
      setUnreadCount(response.data.count);
    }
  };

  const fetchNotifications = async () => {
    setIsLoading(true);
    const response = await api.get<Notification[]>('/notifications?per_page=10');
    if (response.success && response.data) {
      setNotifications(response.data);
    }
    setIsLoading(false);
  };

  const handleOpen = () => {
    if (!isOpen) {
      fetchNotifications();
    }
    setIsOpen(!isOpen);
  };

  const markAsRead = async (id: string) => {
    await api.patch(`/notifications/${id}/read`, {});
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, is_read: true } : n))
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllAsRead = async () => {
    await api.post('/notifications/mark-all-read', {});
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const deleteNotification = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await api.delete(`/notifications/${id}`);
    const notification = notifications.find(n => n.id === id);
    setNotifications(prev => prev.filter(n => n.id !== id));
    if (notification && !notification.is_read) {
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'alert_match':
        return <AlertCircle className="w-4 h-4 text-blue-500" />;
      case 'price_drop':
        return <TrendingDown className="w-4 h-4 text-green-500" />;
      case 'item_sold':
        return <ShoppingBag className="w-4 h-4 text-purple-500" />;
      default:
        return <Info className="w-4 h-4 text-slate-500 dark:text-neutral-500" />;
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (!isAuthenticated) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={handleOpen}
        className="relative p-2 text-slate-400 dark:text-neutral-500 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 sm:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Dropdown */}
      {isOpen && (
        <div className="fixed sm:absolute inset-x-0 sm:inset-x-auto bottom-0 sm:bottom-auto sm:right-0 sm:mt-2 w-full sm:w-80 bg-white dark:bg-neutral-900/80 rounded-t-xl sm:rounded-xl shadow-xl border border-slate-200 dark:border-white/5 overflow-hidden z-50">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-200 dark:border-white/5 flex items-center justify-between bg-slate-50 dark:bg-neutral-900">
            <h3 className="font-semibold text-slate-900 dark:text-white text-sm sm:text-base">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:text-violet-400 flex items-center gap-1"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 dark:text-neutral-500 hover:text-slate-600 dark:text-neutral-400 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Notification List */}
          <div className="max-h-[60vh] sm:max-h-96 overflow-y-auto">
            {isLoading ? (
              <div className="px-4 py-8 text-center text-slate-500 dark:text-neutral-500">
                <div className="animate-spin w-6 h-6 border-2 border-violet-500 dark:border-violet-400 border-t-transparent rounded-full mx-auto mb-2" />
                Loading...
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-slate-500 dark:text-neutral-500">
                <Bell className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p>No notifications yet</p>
              </div>
            ) : (
              notifications.map(notification => (
                <div
                  key={notification.id}
                  onClick={() => !notification.is_read && markAsRead(notification.id)}
                  className={`px-4 py-3 border-b border-slate-100 hover:bg-slate-50 dark:bg-neutral-900 cursor-pointer transition-colors ${
                    !notification.is_read ? 'bg-blue-50/50' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm ${!notification.is_read ? 'font-semibold text-slate-900 dark:text-white' : 'text-slate-700'}`}>
                          {notification.title}
                        </p>
                        <button
                          onClick={(e) => deleteNotification(notification.id, e)}
                          className="text-slate-400 dark:text-neutral-500 hover:text-red-500 flex-shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {notification.message && (
                        <p className="text-xs text-slate-500 dark:text-neutral-500 mt-0.5 line-clamp-2">
                          {notification.message}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-slate-400 dark:text-neutral-500">
                          {formatTimeAgo(notification.created_at)}
                        </span>
                        {!notification.is_read && (
                          <span className="w-2 h-2 bg-blue-500 rounded-full" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-3 sm:py-2 border-t border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-neutral-900">
              <button
                onClick={() => {
                  setIsOpen(false);
                  // Navigate to notifications page or alerts results
                }}
                className="text-sm text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:text-violet-400 w-full text-center py-1"
              >
                View all notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
