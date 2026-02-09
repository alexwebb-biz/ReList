import React, { useState, useEffect, useRef } from 'react';
import {
  Search, TrendingUp, MapPin, DollarSign, Zap, Loader2, RefreshCw,
  ExternalLink, Plus, Bookmark, ChevronDown, ChevronUp, Target,
  AlertCircle, CheckCircle2, Filter, X, Map as MapIcon, List,
  ArrowRight, Clock, Star, Package
} from 'lucide-react';
import { Card, Button, Badge, Input } from './ui/UIComponents';
import { api } from '../lib/api';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Helper to get auth headers
const getAuthHeaders = () => ({
  Authorization: `Bearer ${api.getToken()}`,
});

interface ArbitrageOpportunity {
  id: string;
  buy_platform: string;
  buy_price: number;
  buy_url: string;
  buy_title: string;
  buy_image: string | null;
  buy_location: string | null;
  buy_condition: string | null;
  sell_platform: string;
  sell_price: number;
  sell_price_range: { min: number; max: number };
  sold_count: number;
  profit: number;
  profit_after_fees: number;
  roi_percent: number;
  fee_breakdown: {
    platform_fee: number;
    payment_fee: number;
    total_fees: number;
  };
  confidence: 'high' | 'medium' | 'low';
  score: number;
  coordinates: { lat: number; lng: number } | null;
  distance_miles: number | null;
  found_at: string;
  expires_at: string;
}

interface PopularSearch {
  query: string;
  category: string;
  avg_roi: number;
}

const PLATFORM_COLORS: Record<string, string> = {
  eBay: 'bg-blue-500',
  Vinted: 'bg-teal-500',
  Depop: 'bg-red-500',
  Facebook: 'bg-indigo-500',
  Gumtree: 'bg-green-500',
  Shpock: 'bg-purple-500',
};

const PLATFORM_ICONS: Record<string, string> = {
  eBay: '🛒',
  Vinted: '👗',
  Depop: '🛍️',
  Facebook: '📘',
  Gumtree: '🌳',
  Shpock: '📱',
};

const CONFIDENCE_STYLES: Record<string, { bg: string; text: string }> = {
  high: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-600 dark:text-green-400' },
  medium: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-600 dark:text-yellow-400' },
  low: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-600 dark:text-red-400' },
};

export const ArbitrageScanner: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [opportunities, setOpportunities] = useState<ArbitrageOpportunity[]>([]);
  const [popularSearches, setPopularSearches] = useState<PopularSearch[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  // Filter state
  const [showFilters, setShowFilters] = useState(false);
  const [minProfit, setMinProfit] = useState(5);
  const [minRoi, setMinRoi] = useState(20);
  const [maxBuyPrice, setMaxBuyPrice] = useState(500);
  const [localOnly, setLocalOnly] = useState(false);
  const [buyPlatform, setBuyPlatform] = useState('Vinted');
  const [sellPlatform, setSellPlatform] = useState('eBay');

  // Stats
  const [scanStats, setScanStats] = useState<{
    listings_scanned: number;
    opportunities_found: number;
    best_profit: number;
    best_roi: number;
    scan_duration_ms: number;
  } | null>(null);

  // Selected opportunity for detail view
  const [selectedOpp, setSelectedOpp] = useState<ArbitrageOpportunity | null>(null);

  // Map ref for Leaflet
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  // Fetch popular searches on mount
  useEffect(() => {
    fetchPopularSearches();
  }, []);

  // Initialize map when switching to map view
  useEffect(() => {
    if (viewMode === 'map' && mapRef.current && !mapInstanceRef.current) {
      initializeMap();
    }
  }, [viewMode]);

  // Update map markers when opportunities change
  useEffect(() => {
    if (mapInstanceRef.current && viewMode === 'map') {
      updateMapMarkers();
    }
  }, [opportunities, viewMode]);

  const fetchPopularSearches = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/arbitrage/popular-searches`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setPopularSearches(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch popular searches:', err);
    }
  };

  const initializeMap = async () => {
    // Dynamically import Leaflet
    const L = await import('leaflet');
    await import('leaflet/dist/leaflet.css');

    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current).setView([53.5, -2.5], 6);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(map);

    mapInstanceRef.current = map;
    updateMapMarkers();
  };

  const updateMapMarkers = async () => {
    if (!mapInstanceRef.current) return;

    const L = await import('leaflet');
    const map = mapInstanceRef.current;

    // Clear existing markers
    map.eachLayer((layer: any) => {
      if (layer instanceof L.Marker) {
        map.removeLayer(layer);
      }
    });

    // Add markers for opportunities with coordinates
    const oppsWithCoords = opportunities.filter(o => o.coordinates);

    oppsWithCoords.forEach((opp) => {
      if (!opp.coordinates) return;

      const icon = L.divIcon({
        className: 'custom-marker',
        html: `
          <div class="flex items-center justify-center w-8 h-8 rounded-full ${
            opp.score >= 70 ? 'bg-green-500' : opp.score >= 50 ? 'bg-yellow-500' : 'bg-red-500'
          } text-white text-xs font-bold shadow-lg">
            £${Math.round(opp.profit_after_fees)}
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([opp.coordinates.lat, opp.coordinates.lng], { icon })
        .addTo(map)
        .bindPopup(`
          <div class="p-2">
            <h3 class="font-bold text-sm">${opp.buy_title.substring(0, 40)}...</h3>
            <p class="text-green-600 font-bold">£${opp.profit_after_fees} profit</p>
            <p class="text-gray-600 text-xs">Buy: £${opp.buy_price} → Sell: £${opp.sell_price}</p>
            <p class="text-gray-500 text-xs">${opp.buy_location || 'Unknown location'}</p>
          </div>
        `);

      marker.on('click', () => setSelectedOpp(opp));
    });

    // Fit bounds if we have markers
    if (oppsWithCoords.length > 0) {
      const bounds = L.latLngBounds(
        oppsWithCoords.map(o => [o.coordinates!.lat, o.coordinates!.lng])
      );
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  };

  const handleScan = async (query?: string) => {
    const searchTerm = query || searchQuery;
    if (!searchTerm.trim()) return;

    setIsScanning(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/arbitrage/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          query: searchTerm,
          buy_platform: buyPlatform,
          sell_platform: sellPlatform,
          min_profit: minProfit,
          min_roi: minRoi,
          max_buy_price: maxBuyPrice,
          local_only: localOnly,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setOpportunities(data.data.opportunities || []);
        setScanStats(data.data.stats);
      } else {
        const data = await res.json();
        setError(data.error?.message || 'Scan failed');
      }
    } catch (err) {
      setError('Failed to scan for opportunities');
    }

    setIsScanning(false);
  };

  const handleMultiScan = async (query?: string) => {
    const searchTerm = query || searchQuery;
    if (!searchTerm.trim()) return;

    setIsScanning(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/arbitrage/multi-scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          query: searchTerm,
          min_profit: minProfit,
          min_roi: minRoi,
          max_buy_price: maxBuyPrice,
          local_only: localOnly,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setOpportunities(data.data.opportunities || []);
        setScanStats({
          listings_scanned: data.data.stats.total_scanned,
          opportunities_found: data.data.stats.total_found,
          best_profit: data.data.stats.best_profit,
          best_roi: data.data.stats.best_roi,
          scan_duration_ms: 0,
        });
      } else {
        const data = await res.json();
        setError(data.error?.message || 'Scan failed');
      }
    } catch (err) {
      setError('Failed to scan for opportunities');
    }

    setIsScanning(false);
  };

  const handleSaveToWatchlist = async (opp: ArbitrageOpportunity) => {
    try {
      const res = await fetch(`${API_BASE}/api/arbitrage/save-watchlist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ opportunity: opp }),
      });

      if (res.ok) {
        alert('Saved to watchlist!');
      }
    } catch (err) {
      setError('Failed to save to watchlist');
    }
  };

  const handleCreateDraft = async (opp: ArbitrageOpportunity) => {
    try {
      const res = await fetch(`${API_BASE}/api/arbitrage/create-draft`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ opportunity: opp }),
      });

      if (res.ok) {
        const data = await res.json();
        alert(`Draft created! ID: ${data.data.draft_id}`);
      }
    } catch (err) {
      setError('Failed to create draft');
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-500';
    if (score >= 50) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getScoreBg = (score: number) => {
    if (score >= 70) return 'bg-green-500';
    if (score >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <TrendingUp className="w-7 h-7 text-green-500" />
            Arbitrage Scanner
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Find items to flip across platforms. Buy low, sell high.
          </p>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'list'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            <List className="w-4 h-4 inline mr-1" />
            List
          </button>
          <button
            onClick={() => setViewMode('map')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'map'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            <MapIcon className="w-4 h-4 inline mr-1" />
            Map
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleMultiScan()}
              placeholder="Search for items (e.g., Nike Air Max, North Face Nuptse)"
              className="w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <Button
            onClick={() => handleMultiScan()}
            disabled={isScanning || !searchQuery.trim()}
            className="flex items-center gap-2 px-6"
          >
            {isScanning ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Zap className="w-5 h-5" />
            )}
            Scan
          </Button>
          <Button
            variant="secondary"
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2"
          >
            <Filter className="w-4 h-4" />
            Filters
          </Button>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Min Profit (£)
              </label>
              <Input
                type="number"
                value={minProfit}
                onChange={(e) => setMinProfit(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Min ROI (%)
              </label>
              <Input
                type="number"
                value={minRoi}
                onChange={(e) => setMinRoi(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Max Buy Price (£)
              </label>
              <Input
                type="number"
                value={maxBuyPrice}
                onChange={(e) => setMaxBuyPrice(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Buy Platform
              </label>
              <select
                value={buyPlatform}
                onChange={(e) => setBuyPlatform(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              >
                <option value="Vinted">Vinted</option>
                <option value="Gumtree">Gumtree</option>
                <option value="eBay">eBay</option>
              </select>
            </div>
          </div>
        )}
      </Card>

      {/* Popular Searches */}
      {opportunities.length === 0 && !isScanning && (
        <Card className="p-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Popular Searches
          </h3>
          <div className="flex flex-wrap gap-2">
            {popularSearches.map((ps) => (
              <button
                key={ps.query}
                onClick={() => {
                  setSearchQuery(ps.query);
                  handleMultiScan(ps.query);
                }}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full text-sm transition-colors"
              >
                <span>{ps.query}</span>
                <span className="text-green-500 font-medium">{ps.avg_roi}% ROI</span>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <span className="text-red-700 dark:text-red-400">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="w-4 h-4 text-red-500" />
          </button>
        </div>
      )}

      {/* Stats Bar */}
      {scanStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">Scanned</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{scanStats.listings_scanned}</p>
          </Card>
          <Card className="p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">Opportunities</p>
            <p className="text-xl font-bold text-green-500">{scanStats.opportunities_found}</p>
          </Card>
          <Card className="p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">Best Profit</p>
            <p className="text-xl font-bold text-green-500">£{scanStats.best_profit}</p>
          </Card>
          <Card className="p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">Best ROI</p>
            <p className="text-xl font-bold text-green-500">{scanStats.best_roi}%</p>
          </Card>
        </div>
      )}

      {/* Loading State */}
      {isScanning && (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="w-12 h-12 text-primary-500 animate-spin mb-4" />
          <p className="text-gray-600 dark:text-gray-400">
            Scanning platforms for arbitrage opportunities...
          </p>
        </div>
      )}

      {/* Map View */}
      {viewMode === 'map' && !isScanning && (
        <div className="relative">
          <div
            ref={mapRef}
            className="w-full h-[500px] rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700"
            style={{ zIndex: 0 }}
          />
          {opportunities.filter(o => o.coordinates).length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-xl">
              <div className="text-center">
                <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600 dark:text-gray-400">
                  No opportunities with location data found
                </p>
                <p className="text-sm text-gray-500">
                  Try searching for items with local pickup
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && !isScanning && opportunities.length > 0 && (
        <div className="space-y-4">
          {opportunities.map((opp) => (
            <Card
              key={opp.id}
              className="p-4 hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => setSelectedOpp(selectedOpp?.id === opp.id ? null : opp)}
            >
              <div className="flex items-start gap-4">
                {/* Image */}
                <div className="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden flex-shrink-0">
                  {opp.buy_image ? (
                    <img src={opp.buy_image} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-8 h-8 text-gray-400" />
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 dark:text-white truncate mb-1">
                    {opp.buy_title}
                  </h3>

                  <div className="flex items-center gap-3 text-sm mb-2">
                    <span className={`px-2 py-0.5 rounded ${PLATFORM_COLORS[opp.buy_platform]} text-white`}>
                      {PLATFORM_ICONS[opp.buy_platform]} Buy £{opp.buy_price}
                    </span>
                    <ArrowRight className="w-4 h-4 text-gray-400" />
                    <span className={`px-2 py-0.5 rounded ${PLATFORM_COLORS[opp.sell_platform]} text-white`}>
                      {PLATFORM_ICONS[opp.sell_platform]} Sell ~£{opp.sell_price}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                    {opp.buy_location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {opp.buy_location}
                        {opp.distance_miles && ` (${opp.distance_miles}mi)`}
                      </span>
                    )}
                    {opp.buy_condition && (
                      <span>{opp.buy_condition}</span>
                    )}
                  </div>
                </div>

                {/* Profit & Score */}
                <div className="text-right flex-shrink-0">
                  <div className={`text-2xl font-bold ${getScoreColor(opp.score)}`}>
                    £{opp.profit_after_fees}
                  </div>
                  <div className="text-sm text-gray-500">
                    {opp.roi_percent}% ROI
                  </div>
                  <div className="flex items-center justify-end gap-1 mt-1">
                    <span className={`px-2 py-0.5 rounded text-xs ${CONFIDENCE_STYLES[opp.confidence].bg} ${CONFIDENCE_STYLES[opp.confidence].text}`}>
                      {opp.confidence}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs text-white ${getScoreBg(opp.score)}`}>
                      {opp.score}/100
                    </span>
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {selectedOpp?.id === opp.id && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Buy Price</p>
                      <p className="font-bold text-gray-900 dark:text-white">£{opp.buy_price}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Sell Price (Median)</p>
                      <p className="font-bold text-gray-900 dark:text-white">£{opp.sell_price}</p>
                      <p className="text-xs text-gray-500">
                        Range: £{opp.sell_price_range.min} - £{opp.sell_price_range.max}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Fees ({opp.sell_platform})</p>
                      <p className="font-bold text-red-500">-£{opp.fee_breakdown.total_fees.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Net Profit</p>
                      <p className="font-bold text-green-500">£{opp.profit_after_fees}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(opp.buy_url, '_blank');
                      }}
                      className="flex items-center gap-2"
                    >
                      <ExternalLink className="w-4 h-4" />
                      View Listing
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSaveToWatchlist(opp);
                      }}
                      className="flex items-center gap-2"
                    >
                      <Bookmark className="w-4 h-4" />
                      Save
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCreateDraft(opp);
                      }}
                      className="flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Create Draft
                    </Button>
                  </div>

                  <p className="text-xs text-gray-500 mt-3">
                    Based on {opp.sold_count} sold items on {opp.sell_platform}. Found {new Date(opp.found_at).toLocaleTimeString()}.
                  </p>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isScanning && opportunities.length === 0 && searchQuery && (
        <Card className="p-8 text-center">
          <Target className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No opportunities found
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Try adjusting your filters or searching for different items
          </p>
        </Card>
      )}
    </div>
  );
};

export default ArbitrageScanner;
