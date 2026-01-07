import React, { useState, useEffect } from 'react';
import { api, AlertResult, Alert } from '../lib/api';
import { ExternalLink, Check, Bookmark, Trash2, Filter, Loader2, ChevronDown, Eye } from 'lucide-react';

export const AlertResults: React.FC = () => {
  const [results, setResults] = useState<AlertResult[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAlert, setSelectedAlert] = useState<string>('');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    loadAlerts();
  }, []);

  useEffect(() => {
    loadResults();
  }, [selectedAlert, showUnreadOnly, page]);

  const loadAlerts = async () => {
    const response = await api.getAlerts();
    if (response.success && response.data) {
      setAlerts(response.data);
    }
  };

  const loadResults = async () => {
    setIsLoading(true);

    let url = `/results?page=${page}&per_page=20`;
    if (selectedAlert) {
      url = `/alerts/${selectedAlert}/results?page=${page}&per_page=20`;
    }
    if (showUnreadOnly) {
      url += '&unread=true';
    }

    const response = await api.get<AlertResult[]>(url);

    if (response.success && response.data) {
      setResults(response.data);
      if (response.pagination) {
        setTotalPages(response.pagination.total_pages);
      }
    }

    setIsLoading(false);
  };

  const handleMarkAsRead = async (id: string) => {
    const response = await api.patch(`/results/${id}/read`, {});
    if (response.success) {
      setResults(results.map(r => r.id === id ? { ...r, is_read: true } : r));
    }
  };

  const handleMarkAllAsRead = async () => {
    const unreadIds = results.filter(r => !r.is_read).map(r => r.id);
    if (unreadIds.length === 0) return;

    const response = await api.post('/results/mark-read', { ids: unreadIds });
    if (response.success) {
      setResults(results.map(r => ({ ...r, is_read: true })));
    }
  };

  const handleSaveToInventory = async (result: AlertResult) => {
    const response = await api.post(`/results/${result.id}/save`, {});
    if (response.success) {
      setResults(results.map(r => r.id === result.id ? { ...r, is_saved: true } : r));
    }
  };

  const formatPrice = (price: number, currency: string) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currency || 'GBP',
    }).format(price);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Unknown';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getPlatformColor = (platform: string) => {
    const colors: Record<string, string> = {
      'eBay': 'bg-blue-100 text-blue-700',
      'Vinted': 'bg-teal-100 text-teal-700',
      'Depop': 'bg-red-100 text-red-700',
      'Gumtree': 'bg-green-100 text-green-700',
      'Facebook Marketplace': 'bg-indigo-100 text-indigo-700',
    };
    return colors[platform] || 'bg-slate-100 text-slate-700';
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-800">Alert Results</h2>
          <p className="text-sm md:text-base text-slate-500">Items found matching your alerts.</p>
        </div>
        <button
          onClick={handleMarkAllAsRead}
          className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1 self-start sm:self-auto"
        >
          <Check size={16} /> Mark all as read
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 sm:items-center bg-white p-3 md:p-4 rounded-xl border border-slate-200">
        <div className="flex items-center gap-2">
          <Filter size={18} className="text-slate-400" />
          <span className="text-sm font-medium text-slate-600">Filters:</span>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 flex-1">
          <div className="relative flex-1 sm:flex-initial">
            <select
              value={selectedAlert}
              onChange={(e) => { setSelectedAlert(e.target.value); setPage(1); }}
              className="w-full sm:w-auto appearance-none pl-4 pr-10 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            >
              <option value="">All Alerts</option>
              {alerts.map(alert => (
                <option key={alert.id} value={alert.id}>{alert.name}</option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showUnreadOnly}
              onChange={(e) => { setShowUnreadOnly(e.target.checked); setPage(1); }}
              className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
            />
            <span className="text-sm text-slate-600">Unread only</span>
          </label>
        </div>
      </div>

      {/* Results Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : results.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 md:p-12 text-center">
          <div className="w-12 h-12 md:w-16 md:h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Eye size={24} className="md:hidden text-slate-400" />
            <Eye size={32} className="hidden md:block text-slate-400" />
          </div>
          <h3 className="text-base md:text-lg font-medium text-slate-800 mb-2">No results found</h3>
          <p className="text-sm md:text-base text-slate-500">
            {selectedAlert
              ? 'No items match this alert yet. Check back later!'
              : 'Create alerts to start finding deals.'}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {results.map(result => (
              <div
                key={result.id}
                className={`bg-white rounded-xl border overflow-hidden hover:shadow-md transition-all ${
                  result.is_read ? 'border-slate-200' : 'border-blue-200 ring-1 ring-blue-100'
                }`}
              >
                {/* Image */}
                <div className="relative aspect-video bg-slate-100">
                  {result.image_urls && result.image_urls.length > 0 ? (
                    <img
                      src={result.image_urls[0]}
                      alt={result.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                      No Image
                    </div>
                  )}

                  {/* Platform badge */}
                  <div className={`absolute top-2 left-2 px-2 py-1 rounded-full text-xs font-medium ${getPlatformColor(result.platform)}`}>
                    {result.platform}
                  </div>

                  {/* Unread indicator */}
                  {!result.is_read && (
                    <div className="absolute top-2 right-2 w-3 h-3 bg-blue-500 rounded-full animate-pulse" />
                  )}
                </div>

                {/* Content */}
                <div className="p-3 md:p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-slate-800 line-clamp-2 flex-1 text-sm md:text-base" title={result.title}>
                      {result.title}
                    </h3>
                  </div>

                  <div className="flex items-center justify-between mb-2 md:mb-3">
                    <span className="text-lg md:text-xl font-bold text-emerald-600">
                      {formatPrice(result.price, result.currency)}
                    </span>
                    <span className="text-xs text-slate-400">
                      {formatDate(result.posted_at || result.created_at)}
                    </span>
                  </div>

                  {result.location && (
                    <p className="text-xs md:text-sm text-slate-500 mb-2 md:mb-3 truncate">{result.location}</p>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-1 md:gap-2 pt-2 md:pt-3 border-t border-slate-100">
                    <a
                      href={result.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 bg-blue-600 text-white px-2 md:px-3 py-2 rounded-lg text-xs md:text-sm font-medium hover:bg-blue-700 flex items-center justify-center gap-1"
                    >
                      View <ExternalLink size={14} />
                    </a>

                    {!result.is_saved ? (
                      <button
                        onClick={() => handleSaveToInventory(result)}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Save to inventory"
                      >
                        <Bookmark size={18} />
                      </button>
                    ) : (
                      <div className="p-2 text-emerald-500" title="Saved to inventory">
                        <Check size={18} />
                      </div>
                    )}

                    {!result.is_read && (
                      <button
                        onClick={() => handleMarkAsRead(result.id)}
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                        title="Mark as read"
                      >
                        <Eye size={18} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1 sm:gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-xs sm:text-sm text-slate-500 px-2">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AlertResults;
