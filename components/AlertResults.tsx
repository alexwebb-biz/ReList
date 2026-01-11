import React, { useState, useEffect } from 'react';
import { api, AlertResult, Alert } from '../lib/api';
import { ExternalLink, Check, Bookmark, Trash2, Filter, Loader2, ChevronDown, Eye, X, Package, DollarSign, Binoculars } from 'lucide-react';

interface QuickSaveData {
  result: AlertResult;
  purchase_price: number;
  target_price: number;
  notes: string;
}

interface WatchData {
  result: AlertResult;
  target_price: number;
}

export const AlertResults: React.FC = () => {
  const [results, setResults] = useState<AlertResult[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAlert, setSelectedAlert] = useState<string>('');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const PLATFORMS = ['eBay', 'Vinted', 'Depop', 'Gumtree', 'Facebook Marketplace'];

  // Quick save modal state
  const [quickSaveModal, setQuickSaveModal] = useState<QuickSaveData | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Watch modal state
  const [watchModal, setWatchModal] = useState<WatchData | null>(null);
  const [isWatching, setIsWatching] = useState(false);
  const [watchedIds, setWatchedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadAlerts();
  }, []);

  useEffect(() => {
    loadResults();
  }, [selectedAlert, selectedPlatform, showUnreadOnly, page]);

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
    if (selectedPlatform) {
      url += `&platform=${encodeURIComponent(selectedPlatform)}`;
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

  // Open quick save modal
  const openQuickSaveModal = (result: AlertResult) => {
    setQuickSaveModal({
      result,
      purchase_price: result.price,
      target_price: Math.round(result.price * 1.3), // 30% markup default
      notes: `Sourced from ${result.platform}`
    });
  };

  // Quick save with purchase price
  const handleQuickSave = async () => {
    if (!quickSaveModal) return;

    setIsSaving(true);

    const response = await api.post(`/results/${quickSaveModal.result.id}/save`, {
      purchase_price: quickSaveModal.purchase_price,
      selling_price: quickSaveModal.target_price,
      notes: quickSaveModal.notes
    });

    if (response.success) {
      setResults(results.map(r =>
        r.id === quickSaveModal.result.id ? { ...r, is_saved: true } : r
      ));
      setQuickSaveModal(null);
    }

    setIsSaving(false);
  };

  // Simple save (legacy)
  const handleSaveToInventory = async (result: AlertResult) => {
    const response = await api.post(`/results/${result.id}/save`, {});
    if (response.success) {
      setResults(results.map(r => r.id === result.id ? { ...r, is_saved: true } : r));
    }
  };

  // Open watch modal
  const openWatchModal = (result: AlertResult) => {
    setWatchModal({
      result,
      target_price: Math.round(result.price * 0.8) // Default target: 20% below current
    });
  };

  // Add item to watchlist
  const handleAddToWatchlist = async () => {
    if (!watchModal) return;

    setIsWatching(true);

    const response = await api.post('/watchlist', {
      alert_result_id: watchModal.result.id,
      external_id: watchModal.result.external_id,
      platform: watchModal.result.platform,
      title: watchModal.result.title,
      url: watchModal.result.url,
      image_url: watchModal.result.image_urls?.[0],
      price: watchModal.result.price,
      target_price: watchModal.target_price || undefined,
      currency: watchModal.result.currency
    });

    if (response.success) {
      setWatchedIds(prev => new Set(prev).add(watchModal.result.id));
      setWatchModal(null);
    }

    setIsWatching(false);
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

  // Calculate potential profit
  const calculateProfit = () => {
    if (!quickSaveModal) return { profit: 0, margin: 0 };
    const profit = quickSaveModal.target_price - quickSaveModal.purchase_price;
    const margin = quickSaveModal.target_price > 0
      ? (profit / quickSaveModal.target_price) * 100
      : 0;
    return { profit, margin };
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

        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 flex-1 flex-wrap">
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

          <div className="relative flex-1 sm:flex-initial">
            <select
              value={selectedPlatform}
              onChange={(e) => { setSelectedPlatform(e.target.value); setPage(1); }}
              className="w-full sm:w-auto appearance-none pl-4 pr-10 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            >
              <option value="">All Platforms</option>
              {PLATFORMS.map(platform => (
                <option key={platform} value={platform}>{platform}</option>
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
                        onClick={() => openQuickSaveModal(result)}
                        className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                        title="Quick save to inventory"
                      >
                        <Package size={18} />
                      </button>
                    ) : (
                      <div className="p-2 text-emerald-500" title="Saved to inventory">
                        <Check size={18} />
                      </div>
                    )}

                    {!watchedIds.has(result.id) ? (
                      <button
                        onClick={() => openWatchModal(result)}
                        className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                        title="Watch for price drops"
                      >
                        <Binoculars size={18} />
                      </button>
                    ) : (
                      <div className="p-2 text-amber-500" title="Watching">
                        <Binoculars size={18} />
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

      {/* Quick Save Modal */}
      {quickSaveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl p-4 md:p-6 w-full sm:max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Package size={20} />
                Quick Save to Inventory
              </h3>
              <button
                onClick={() => setQuickSaveModal(null)}
                className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            {/* Item Preview */}
            <div className="flex gap-3 p-3 bg-slate-50 rounded-lg mb-4">
              {quickSaveModal.result.image_urls?.[0] && (
                <img
                  src={quickSaveModal.result.image_urls[0]}
                  alt=""
                  className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                />
              )}
              <div className="min-w-0 flex-1">
                <h4 className="font-medium text-slate-800 text-sm line-clamp-2">{quickSaveModal.result.title}</h4>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${getPlatformColor(quickSaveModal.result.platform)}`}>
                    {quickSaveModal.result.platform}
                  </span>
                  <span className="text-emerald-600 font-bold text-sm">
                    {formatPrice(quickSaveModal.result.price, quickSaveModal.result.currency)}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Purchase Price (£)
                </label>
                <input
                  type="number"
                  value={quickSaveModal.purchase_price || ''}
                  onChange={(e) => setQuickSaveModal({
                    ...quickSaveModal,
                    purchase_price: parseFloat(e.target.value) || 0
                  })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="What you'll pay"
                />
                <p className="text-xs text-slate-400 mt-1">Listed price: £{quickSaveModal.result.price}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Target Sell Price (£)
                </label>
                <input
                  type="number"
                  value={quickSaveModal.target_price || ''}
                  onChange={(e) => setQuickSaveModal({
                    ...quickSaveModal,
                    target_price: parseFloat(e.target.value) || 0
                  })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="What you'll sell for"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Notes (optional)
                </label>
                <input
                  value={quickSaveModal.notes}
                  onChange={(e) => setQuickSaveModal({
                    ...quickSaveModal,
                    notes: e.target.value
                  })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Any notes about this item..."
                />
              </div>

              {/* Profit Preview */}
              <div className="bg-emerald-50 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-emerald-700">Potential Profit:</span>
                  <span className={`font-bold text-lg ${calculateProfit().profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    £{calculateProfit().profit.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-xs text-emerald-600">Profit Margin:</span>
                  <span className={`font-medium text-sm ${calculateProfit().margin >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {calculateProfit().margin.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-3 mt-6">
              <button
                onClick={() => setQuickSaveModal(null)}
                className="flex-1 px-4 py-2.5 rounded-lg text-slate-600 hover:bg-slate-50 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleQuickSave}
                disabled={isSaving || !quickSaveModal.purchase_price}
                className="flex-1 bg-emerald-600 text-white px-4 py-2.5 rounded-lg hover:bg-emerald-700 font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSaving && <Loader2 size={16} className="animate-spin" />}
                Save to Inventory
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Watch Modal */}
      {watchModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl p-4 md:p-6 w-full sm:max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Binoculars size={20} className="text-amber-600" />
                Watch for Price Drops
              </h3>
              <button
                onClick={() => setWatchModal(null)}
                className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            {/* Item Preview */}
            <div className="flex gap-3 p-3 bg-slate-50 rounded-lg mb-4">
              {watchModal.result.image_urls?.[0] && (
                <img
                  src={watchModal.result.image_urls[0]}
                  alt=""
                  className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                />
              )}
              <div className="min-w-0 flex-1">
                <h4 className="font-medium text-slate-800 text-sm line-clamp-2">{watchModal.result.title}</h4>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${getPlatformColor(watchModal.result.platform)}`}>
                    {watchModal.result.platform}
                  </span>
                  <span className="text-emerald-600 font-bold text-sm">
                    {formatPrice(watchModal.result.price, watchModal.result.currency)}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm text-amber-800">
                  We'll track this item and notify you when the price drops. Set an optional target price to get alerts only when it reaches your desired price.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Current Price
                </label>
                <div className="px-3 py-2 bg-slate-100 rounded-lg text-slate-700 font-medium">
                  {formatPrice(watchModal.result.price, watchModal.result.currency)}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Target Price (optional)
                </label>
                <input
                  type="number"
                  value={watchModal.target_price || ''}
                  onChange={(e) => setWatchModal({
                    ...watchModal,
                    target_price: parseFloat(e.target.value) || 0
                  })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
                  placeholder="Alert me when price drops to..."
                />
                <p className="text-xs text-slate-400 mt-1">
                  Leave empty to get notified on any price drop
                </p>
              </div>

              {watchModal.target_price > 0 && (
                <div className="bg-emerald-50 rounded-lg p-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-emerald-700">Target Savings:</span>
                    <span className="font-bold text-emerald-600">
                      {formatPrice(watchModal.result.price - watchModal.target_price, watchModal.result.currency)}
                      <span className="text-xs ml-1">
                        ({Math.round((1 - watchModal.target_price / watchModal.result.price) * 100)}% off)
                      </span>
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-3 mt-6">
              <button
                onClick={() => setWatchModal(null)}
                className="flex-1 px-4 py-2.5 rounded-lg text-slate-600 hover:bg-slate-50 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleAddToWatchlist}
                disabled={isWatching}
                className="flex-1 bg-amber-600 text-white px-4 py-2.5 rounded-lg hover:bg-amber-700 font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isWatching && <Loader2 size={16} className="animate-spin" />}
                <Binoculars size={16} />
                Start Watching
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AlertResults;
