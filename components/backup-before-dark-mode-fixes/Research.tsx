import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import {
  Eye, TrendingDown, TrendingUp, Search, Loader2, Clock, AlertTriangle,
  ChevronDown, ExternalLink, X, Target, Bell, BarChart3, RefreshCw,
  CheckCircle, XCircle, Minus, DollarSign, Package, Zap, ArrowRight,
  Percent, ShieldCheck, ShieldAlert, Shield, Sparkles, Copy, Check, Wand2
} from 'lucide-react';

// Types
interface WatchedItem {
  id: string;
  title: string;
  platform: string;
  url: string;
  image_url: string | null;
  initial_price: number;
  current_price: number;
  target_price: number | null;
  currency: string;
  price_change: number;
  price_change_percent: number;
  created_at: string;
  price_history?: { price: number; recorded_at: string }[];
}

interface SoldItem {
  title: string;
  sold_price: number;
  currency: string;
  sold_date: string;
  condition: string;
  url: string;
  image_url: string | null;
  platform: string;
}

interface MarketResearchResult {
  query: string;
  platform: string;
  sold_items: SoldItem[];
  stats: {
    average_price: number;
    median_price: number;
    lowest_price: number;
    highest_price: number;
    total_sold: number;
  };
}

interface AgingItem {
  id: string;
  title: string;
  images: string[];
  purchase_price: number;
  selling_price: number;
  status: string;
  days_listed: number;
  aging_status: 'fresh' | 'aging' | 'stale' | 'critical';
  suggested_price?: number;
  suggested_reduction?: number;
}

interface AgingStats {
  total_listed: number;
  fresh_count: number;
  aging_count: number;
  stale_count: number;
  critical_count: number;
  total_value_at_risk: number;
  avg_days_listed: number;
}

interface FlipOpportunity {
  listing: {
    title: string;
    price: number;
    currency: string;
    url: string;
    image_url: string | null;
    platform: string;
    condition?: string;
    location?: string;
  };
  market_data: {
    avg_sold_price: number;
    median_sold_price: number;
    min_sold_price: number;
    max_sold_price: number;
    sold_count: number;
  };
  profit_analysis: {
    estimated_profit: number;
    profit_margin_percent: number;
    roi_percent: number;
    confidence: 'high' | 'medium' | 'low';
    risk_level: 'low' | 'medium' | 'high';
  };
  recommendation: string;
  score: number;
}

interface FlipFinderResult {
  query: string;
  platform: string;
  opportunities: FlipOpportunity[];
  stats: {
    listings_analyzed: number;
    opportunities_found: number;
    avg_profit_margin: number;
    best_roi: number;
  };
  fetched_at: string;
}

interface ArbitrageOpportunity {
  buy_listing: {
    title: string;
    price: number;
    url: string;
    image_url: string | null;
    platform: string;
  };
  sell_on: string;
  estimated_sell_price: number;
  estimated_profit: number;
  roi_percent: number;
}

interface ListingAnalysis {
  original: {
    title: string;
    description?: string;
  };
  suggestions: {
    optimized_title: string;
    title_improvements: string[];
    keyword_suggestions: string[];
    description_tips: string[];
    pricing_insight?: {
      suggested_price: number;
      price_range: { min: number; max: number };
      based_on: number;
    };
  };
  score: {
    current: number;
    potential: number;
    improvement_areas: string[];
  };
}

interface KeywordAnalysis {
  query: string;
  top_keywords: Array<{
    keyword: string;
    frequency: number;
    avg_price: number;
  }>;
  trending_terms: string[];
  avoid_terms: string[];
}

interface GeneratedDescription {
  description: string;
  provider: string;
  sections: {
    intro: string;
    details: string;
    condition: string;
    callToAction: string;
  };
}

type TabType = 'watchlist' | 'research' | 'aging' | 'flipfinder' | 'optimizer';

export const Research: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('watchlist');

  // Watchlist state
  const [watchlist, setWatchlist] = useState<WatchedItem[]>([]);
  const [watchlistLoading, setWatchlistLoading] = useState(true);
  const [selectedWatch, setSelectedWatch] = useState<WatchedItem | null>(null);

  // Research state
  const [searchQuery, setSearchQuery] = useState('');
  const [researchResults, setResearchResults] = useState<MarketResearchResult[]>([]);
  const [researchLoading, setResearchLoading] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['eBay']);
  const RESEARCH_PLATFORMS = ['eBay', 'Vinted'];

  // Aging state
  const [agingItems, setAgingItems] = useState<AgingItem[]>([]);
  const [agingStats, setAgingStats] = useState<AgingStats | null>(null);
  const [agingLoading, setAgingLoading] = useState(true);
  const [agingFilter, setAgingFilter] = useState<string>('');
  const [applyingPrice, setApplyingPrice] = useState<string | null>(null);

  // Flip Finder state
  const [flipQuery, setFlipQuery] = useState('');
  const [flipResults, setFlipResults] = useState<FlipFinderResult[]>([]);
  const [flipLoading, setFlipLoading] = useState(false);
  const [flipPlatforms, setFlipPlatforms] = useState<string[]>(['eBay']);
  const [minProfitMargin, setMinProfitMargin] = useState(20);
  const [arbitrageResults, setArbitrageResults] = useState<ArbitrageOpportunity[]>([]);
  const [arbitrageMode, setArbitrageMode] = useState(false);
  const FLIP_PLATFORMS = ['eBay', 'Vinted'];

  // Listing Optimizer state
  const [optimizerTitle, setOptimizerTitle] = useState('');
  const [optimizerDescription, setOptimizerDescription] = useState('');
  const [listingAnalysis, setListingAnalysis] = useState<ListingAnalysis | null>(null);
  const [keywordAnalysis, setKeywordAnalysis] = useState<KeywordAnalysis | null>(null);
  const [optimizerLoading, setOptimizerLoading] = useState(false);
  const [optimizerMode, setOptimizerMode] = useState<'analyze' | 'keywords' | 'generate'>('analyze');

  // AI Description Generator state
  const [aiTitle, setAiTitle] = useState('');
  const [aiBrand, setAiBrand] = useState('');
  const [aiCondition, setAiCondition] = useState('Good');
  const [aiSize, setAiSize] = useState('');
  const [aiColor, setAiColor] = useState('');
  const [aiMaterial, setAiMaterial] = useState('');
  const [aiFeatures, setAiFeatures] = useState('');
  const [aiFlaws, setAiFlaws] = useState('');
  const [aiProvider, setAiProvider] = useState<string>('');
  const [generatedDescription, setGeneratedDescription] = useState<GeneratedDescription | null>(null);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiProviders, setAiProviders] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadWatchlist();
    loadAgingData();
    loadAiProviders();
  }, []);

  const loadAiProviders = async () => {
    const response = await api.get<{ providers: string[] }>('/research/ai-providers');
    if (response.success && response.data) {
      setAiProviders(response.data.providers);
    }
  };

  // ============== WATCHLIST ==============
  const loadWatchlist = async () => {
    setWatchlistLoading(true);
    const response = await api.get<WatchedItem[]>('/watchlist');
    if (response.success && response.data) {
      setWatchlist(response.data);
    }
    setWatchlistLoading(false);
  };

  const removeFromWatchlist = async (id: string) => {
    const response = await api.delete(`/watchlist/${id}`);
    if (response.success) {
      setWatchlist(watchlist.filter(w => w.id !== id));
      if (selectedWatch?.id === id) setSelectedWatch(null);
    }
  };

  const updateTargetPrice = async (id: string, price: number | null) => {
    const response = await api.patch(`/watchlist/${id}/target`, { target_price: price });
    if (response.success) {
      setWatchlist(watchlist.map(w => w.id === id ? { ...w, target_price: price } : w));
    }
  };

  // ============== MARKET RESEARCH ==============
  const handleSearch = async () => {
    if (!searchQuery.trim() || selectedPlatforms.length === 0) return;

    setResearchLoading(true);
    const response = await api.post<MarketResearchResult[]>('/research/sold', {
      query: searchQuery,
      platforms: selectedPlatforms
    });

    if (response.success && response.data) {
      setResearchResults(response.data);
    }
    setResearchLoading(false);
  };

  const togglePlatform = (platform: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(platform)
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    );
  };

  // ============== INVENTORY AGING ==============
  const loadAgingData = async () => {
    setAgingLoading(true);

    const [itemsRes, statsRes] = await Promise.all([
      api.get<AgingItem[]>(`/research/aging${agingFilter ? `?status=${agingFilter}` : ''}`),
      api.get<AgingStats>('/research/aging/stats')
    ]);

    if (itemsRes.success && itemsRes.data) {
      setAgingItems(itemsRes.data);
    }
    if (statsRes.success && statsRes.data) {
      setAgingStats(statsRes.data);
    }

    setAgingLoading(false);
  };

  const applyPriceReduction = async (id: string, newPrice: number) => {
    setApplyingPrice(id);
    const response = await api.post(`/research/aging/${id}/apply`, { new_price: newPrice });
    if (response.success) {
      setAgingItems(agingItems.map(item =>
        item.id === id ? { ...item, selling_price: newPrice, suggested_price: undefined } : item
      ));
    }
    setApplyingPrice(null);
  };

  useEffect(() => {
    if (activeTab === 'aging') {
      loadAgingData();
    }
  }, [agingFilter]);

  // ============== FLIP FINDER ==============
  const findFlipOpportunities = async () => {
    if (!flipQuery.trim() || flipPlatforms.length === 0) return;

    setFlipLoading(true);
    setArbitrageResults([]);

    if (arbitrageMode) {
      // Cross-platform arbitrage
      const response = await api.post<{ opportunities: ArbitrageOpportunity[]; stats: any }>('/research/arbitrage', {
        query: flipQuery,
        buy_platform: 'Vinted',
        sell_platform: 'eBay',
        min_profit: 10,
      });

      if (response.success && response.data) {
        setArbitrageResults(response.data.opportunities);
        setFlipResults([]);
      }
    } else {
      // Standard flip finder
      const response = await api.post<FlipFinderResult[]>('/research/flip-finder', {
        query: flipQuery,
        platforms: flipPlatforms,
        min_profit_margin: minProfitMargin,
        min_score: 40,
      });

      if (response.success && response.data) {
        setFlipResults(response.data);
      }
    }

    setFlipLoading(false);
  };

  const toggleFlipPlatform = (platform: string) => {
    setFlipPlatforms(prev =>
      prev.includes(platform)
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    );
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'bg-emerald-500';
    if (score >= 60) return 'bg-blue-500';
    if (score >= 40) return 'bg-yellow-500';
    return 'bg-slate-400';
  };

  const getConfidenceIcon = (confidence: string) => {
    switch (confidence) {
      case 'high': return <ShieldCheck size={14} className="text-emerald-600 dark:text-emerald-400" />;
      case 'medium': return <Shield size={14} className="text-yellow-600" />;
      default: return <ShieldAlert size={14} className="text-slate-400 dark:text-neutral-500" />;
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'text-emerald-600 dark:text-emerald-400 bg-emerald-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'high': return 'text-red-600 bg-red-50';
      default: return 'text-slate-600 dark:text-neutral-400 bg-slate-50 dark:bg-neutral-900';
    }
  };

  // ============== LISTING OPTIMIZER ==============
  const analyzeListingOptimization = async () => {
    if (!optimizerTitle.trim()) return;

    setOptimizerLoading(true);
    setListingAnalysis(null);
    setKeywordAnalysis(null);

    if (optimizerMode === 'analyze') {
      const response = await api.post<ListingAnalysis>('/research/optimize-listing', {
        title: optimizerTitle,
        description: optimizerDescription || undefined,
      });

      if (response.success && response.data) {
        setListingAnalysis(response.data);
      }
    } else {
      const response = await api.post<KeywordAnalysis>('/research/analyze-keywords', {
        query: optimizerTitle,
      });

      if (response.success && response.data) {
        setKeywordAnalysis(response.data);
      }
    }

    setOptimizerLoading(false);
  };

  const getListingScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-600 dark:text-emerald-400';
    if (score >= 60) return 'text-violet-600 dark:text-violet-400';
    if (score >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getListingScoreBgColor = (score: number) => {
    if (score >= 80) return 'bg-emerald-500';
    if (score >= 60) return 'bg-blue-500';
    if (score >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  // ============== AI DESCRIPTION GENERATOR ==============
  const generateAiDescription = async () => {
    if (!aiTitle.trim()) return;

    setAiGenerating(true);
    setGeneratedDescription(null);

    const response = await api.post<GeneratedDescription>('/research/generate-description', {
      title: aiTitle,
      brand: aiBrand || undefined,
      condition: aiCondition || undefined,
      size: aiSize || undefined,
      color: aiColor || undefined,
      material: aiMaterial || undefined,
      features: aiFeatures ? aiFeatures.split(',').map(f => f.trim()).filter(Boolean) : undefined,
      flaws: aiFlaws ? aiFlaws.split(',').map(f => f.trim()).filter(Boolean) : undefined,
      provider: aiProvider || undefined,
    });

    if (response.success && response.data) {
      setGeneratedDescription(response.data);
    }

    setAiGenerating(false);
  };

  const quickGenerateDescription = async () => {
    if (!aiTitle.trim()) return;

    setAiGenerating(true);
    setGeneratedDescription(null);

    const response = await api.post<GeneratedDescription>('/research/quick-description', {
      title: aiTitle,
    });

    if (response.success && response.data) {
      setGeneratedDescription(response.data);
    }

    setAiGenerating(false);
  };

  const copyDescription = () => {
    if (generatedDescription) {
      navigator.clipboard.writeText(generatedDescription.description);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // ============== HELPERS ==============
  const formatPrice = (price: number, currency = 'GBP') => {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(price);
  };

  const getAgingColor = (status: string) => {
    switch (status) {
      case 'fresh': return 'bg-emerald-100 text-emerald-700';
      case 'aging': return 'bg-yellow-100 text-yellow-700';
      case 'stale': return 'bg-orange-100 text-orange-700';
      case 'critical': return 'bg-red-100 text-red-700';
      default: return 'bg-slate-100 dark:bg-neutral-800 text-slate-700';
    }
  };

  const getPlatformColor = (platform: string) => {
    const colors: Record<string, string> = {
      'eBay': 'bg-blue-100 text-violet-700 dark:text-violet-400',
      'Vinted': 'bg-teal-100 text-teal-700',
      'Depop': 'bg-red-100 text-red-700',
      'Gumtree': 'bg-green-100 text-green-700',
    };
    return colors[platform] || 'bg-slate-100 dark:bg-neutral-800 text-slate-700';
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Research & Tools</h2>
        <p className="text-slate-500 dark:text-neutral-500">Price tracking, market research, and inventory insights.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-white/5">
        <button
          onClick={() => setActiveTab('watchlist')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'watchlist'
              ? 'border-blue-600 text-violet-600 dark:text-violet-400'
              : 'border-transparent text-slate-500 dark:text-neutral-500 hover:text-slate-700'
          }`}
        >
          <Eye size={16} className="inline mr-2" />
          Price Watch
        </button>
        <button
          onClick={() => setActiveTab('research')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'research'
              ? 'border-blue-600 text-violet-600 dark:text-violet-400'
              : 'border-transparent text-slate-500 dark:text-neutral-500 hover:text-slate-700'
          }`}
        >
          <Search size={16} className="inline mr-2" />
          Market Research
        </button>
        <button
          onClick={() => setActiveTab('aging')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'aging'
              ? 'border-blue-600 text-violet-600 dark:text-violet-400'
              : 'border-transparent text-slate-500 dark:text-neutral-500 hover:text-slate-700'
          }`}
        >
          <Clock size={16} className="inline mr-2" />
          Inventory Aging
        </button>
        <button
          onClick={() => setActiveTab('flipfinder')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'flipfinder'
              ? 'border-blue-600 text-violet-600 dark:text-violet-400'
              : 'border-transparent text-slate-500 dark:text-neutral-500 hover:text-slate-700'
          }`}
        >
          <Zap size={16} className="inline mr-2" />
          Flip Finder
        </button>
        <button
          onClick={() => setActiveTab('optimizer')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'optimizer'
              ? 'border-blue-600 text-violet-600 dark:text-violet-400'
              : 'border-transparent text-slate-500 dark:text-neutral-500 hover:text-slate-700'
          }`}
        >
          <Target size={16} className="inline mr-2" />
          Listing Optimizer
        </button>
      </div>

      {/* ============== WATCHLIST TAB ============== */}
      {activeTab === 'watchlist' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-slate-500 dark:text-neutral-500">
              Track prices on items you're interested in. Get notified when they drop.
            </p>
            <button
              onClick={loadWatchlist}
              className="text-sm text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:text-violet-400 flex items-center gap-1"
            >
              <RefreshCw size={14} /> Refresh
            </button>
          </div>

          {watchlistLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-violet-600 dark:text-violet-400" />
            </div>
          ) : watchlist.length === 0 ? (
            <div className="bg-white dark:bg-neutral-900/80 rounded-xl border border-slate-200 dark:border-white/5 p-8 text-center">
              <Eye size={48} className="mx-auto text-slate-300 mb-4" />
              <h3 className="font-medium text-slate-900 dark:text-white mb-2">No items being watched</h3>
              <p className="text-sm text-slate-500 dark:text-neutral-500">
                Click the eye icon on Alert Results to start watching items for price drops.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {watchlist.map(item => (
                <div
                  key={item.id}
                  className="bg-white dark:bg-neutral-900/80 rounded-xl border border-slate-200 dark:border-white/5 overflow-hidden hover:shadow-md transition-all"
                >
                  <div className="relative aspect-video bg-slate-100 dark:bg-neutral-800">
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-300">
                        <Package size={32} />
                      </div>
                    )}
                    <span className={`absolute top-2 left-2 px-2 py-1 rounded-full text-xs font-medium ${getPlatformColor(item.platform)}`}>
                      {item.platform}
                    </span>

                    {/* Price change badge */}
                    {item.price_change !== 0 && (
                      <span className={`absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${
                        item.price_change < 0 ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
                      }`}>
                        {item.price_change < 0 ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
                        {Math.abs(item.price_change_percent).toFixed(1)}%
                      </span>
                    )}
                  </div>

                  <div className="p-4">
                    <h3 className="font-semibold text-slate-900 dark:text-white text-sm line-clamp-2 mb-2">{item.title}</h3>

                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <span className="text-xs text-slate-400 dark:text-neutral-500 block">Current</span>
                        <span className="text-lg font-bold text-slate-900 dark:text-white">{formatPrice(item.current_price)}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-slate-400 dark:text-neutral-500 block">Was</span>
                        <span className="text-sm text-slate-500 dark:text-neutral-500 line-through">{formatPrice(item.initial_price)}</span>
                      </div>
                    </div>

                    {item.target_price && (
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-neutral-500 mb-3">
                        <Target size={12} />
                        Target: {formatPrice(item.target_price)}
                        {item.current_price <= item.target_price && (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">Target reached!</span>
                        )}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 bg-violet-600 text-white px-3 py-2 rounded-lg text-xs font-medium hover:bg-violet-500 flex items-center justify-center gap-1"
                      >
                        View <ExternalLink size={12} />
                      </a>
                      <button
                        onClick={() => removeFromWatchlist(item.id)}
                        className="p-2 text-slate-400 dark:text-neutral-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                        title="Stop watching"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============== MARKET RESEARCH TAB ============== */}
      {activeTab === 'research' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-neutral-900/80 rounded-xl border border-slate-200 dark:border-white/5 p-4">
            <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-2">
              Search for sold items to see market prices
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="e.g. iPhone 15 Pro Max 256GB"
                className="flex-1 px-4 py-2 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 dark:focus:border-violet-400 outline-none text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-neutral-500"
              />
              <button
                onClick={handleSearch}
                disabled={researchLoading || !searchQuery.trim() || selectedPlatforms.length === 0}
                className="bg-violet-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-violet-500 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {researchLoading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                Search
              </button>
            </div>

            {/* Platform Selection */}
            <div className="mt-3 pt-3 border-t border-slate-100">
              <span className="text-xs font-medium text-slate-500 dark:text-neutral-500 block mb-2">Search platforms:</span>
              <div className="flex flex-wrap gap-2">
                {RESEARCH_PLATFORMS.map(platform => (
                  <button
                    key={platform}
                    onClick={() => togglePlatform(platform)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      selectedPlatforms.includes(platform)
                        ? 'bg-violet-600 text-white'
                        : 'bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-400 hover:bg-slate-200 dark:hover:bg-neutral-700'
                    }`}
                  >
                    {platform}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {researchResults.length > 0 && (
            <div className="space-y-6">
              {researchResults.map((result, idx) => (
                <div key={idx} className="bg-white dark:bg-neutral-900/80 rounded-xl border border-slate-200 dark:border-white/5 overflow-hidden">
                  {/* Stats Header */}
                  <div className="p-4 bg-slate-50 dark:bg-neutral-900 border-b border-slate-200 dark:border-white/5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-slate-900 dark:text-white">
                        {result.platform} - "{result.query}"
                      </h3>
                      <span className="text-sm text-slate-500 dark:text-neutral-500">
                        {result.stats.total_sold} sold items found
                      </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-white dark:bg-neutral-900/80 rounded-lg p-3 border border-slate-200 dark:border-white/5">
                        <span className="text-xs text-slate-500 dark:text-neutral-500 block">Average</span>
                        <span className="text-lg font-bold text-slate-900 dark:text-white">{formatPrice(result.stats.average_price)}</span>
                      </div>
                      <div className="bg-white dark:bg-neutral-900/80 rounded-lg p-3 border border-slate-200 dark:border-white/5">
                        <span className="text-xs text-slate-500 dark:text-neutral-500 block">Median</span>
                        <span className="text-lg font-bold text-violet-600 dark:text-violet-400">{formatPrice(result.stats.median_price)}</span>
                      </div>
                      <div className="bg-white dark:bg-neutral-900/80 rounded-lg p-3 border border-slate-200 dark:border-white/5">
                        <span className="text-xs text-slate-500 dark:text-neutral-500 block">Lowest</span>
                        <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{formatPrice(result.stats.lowest_price)}</span>
                      </div>
                      <div className="bg-white dark:bg-neutral-900/80 rounded-lg p-3 border border-slate-200 dark:border-white/5">
                        <span className="text-xs text-slate-500 dark:text-neutral-500 block">Highest</span>
                        <span className="text-lg font-bold text-slate-900 dark:text-white">{formatPrice(result.stats.highest_price)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Sold Items List */}
                  <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                    {result.sold_items.slice(0, 20).map((item, i) => (
                      <div key={i} className="flex items-center gap-4 p-3 hover:bg-slate-50 dark:bg-neutral-900">
                        {item.image_url && (
                          <img src={item.image_url} alt="" className="w-12 h-12 rounded object-cover flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{item.title}</p>
                          <p className="text-xs text-slate-500 dark:text-neutral-500">{item.condition} · {item.sold_date}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatPrice(item.sold_price)}</span>
                        </div>
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-slate-400 dark:text-neutral-500 hover:text-violet-600 dark:text-violet-400"
                        >
                          <ExternalLink size={14} />
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!researchLoading && researchResults.length === 0 && searchQuery && (
            <div className="bg-white dark:bg-neutral-900/80 rounded-xl border border-slate-200 dark:border-white/5 p-8 text-center">
              <Search size={48} className="mx-auto text-slate-300 mb-4" />
              <h3 className="font-medium text-slate-900 dark:text-white mb-2">Search for sold items</h3>
              <p className="text-sm text-slate-500 dark:text-neutral-500">
                Enter a product name to see what similar items have sold for.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ============== INVENTORY AGING TAB ============== */}
      {activeTab === 'aging' && (
        <div className="space-y-4">
          {/* Stats Cards */}
          {agingStats && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              <div className="bg-white dark:bg-neutral-900/80 rounded-xl border border-slate-200 dark:border-white/5 p-4">
                <span className="text-xs text-slate-500 dark:text-neutral-500 block">Total Listed</span>
                <span className="text-2xl font-bold text-slate-900 dark:text-white">{agingStats.total_listed}</span>
              </div>
              <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4">
                <span className="text-xs text-emerald-600 dark:text-emerald-400 block">Fresh (0-7d)</span>
                <span className="text-2xl font-bold text-emerald-700">{agingStats.fresh_count}</span>
              </div>
              <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-4">
                <span className="text-xs text-yellow-600 block">Aging (8-14d)</span>
                <span className="text-2xl font-bold text-yellow-700">{agingStats.aging_count}</span>
              </div>
              <div className="bg-orange-50 rounded-xl border border-orange-200 p-4">
                <span className="text-xs text-orange-600 block">Stale (15-30d)</span>
                <span className="text-2xl font-bold text-orange-700">{agingStats.stale_count}</span>
              </div>
              <div className="bg-red-50 rounded-xl border border-red-200 p-4">
                <span className="text-xs text-red-600 block">Critical (30d+)</span>
                <span className="text-2xl font-bold text-red-700">{agingStats.critical_count}</span>
              </div>
              <div className="bg-slate-50 dark:bg-neutral-900 rounded-xl border border-slate-200 dark:border-white/5 p-4">
                <span className="text-xs text-slate-500 dark:text-neutral-500 block">Avg. Days Listed</span>
                <span className="text-2xl font-bold text-slate-900 dark:text-white">{agingStats.avg_days_listed}</span>
              </div>
            </div>
          )}

          {/* Value at Risk Alert */}
          {agingStats && agingStats.total_value_at_risk > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
              <AlertTriangle className="text-amber-600 flex-shrink-0" size={24} />
              <div>
                <p className="font-medium text-amber-800">
                  {formatPrice(agingStats.total_value_at_risk)} at risk
                </p>
                <p className="text-sm text-amber-600">
                  {agingStats.aging_count + agingStats.stale_count + agingStats.critical_count} items may need price reductions to sell.
                </p>
              </div>
            </div>
          )}

          {/* Filter */}
          <div className="flex gap-2 flex-wrap">
            {['', 'fresh', 'aging', 'stale', 'critical'].map(status => (
              <button
                key={status}
                onClick={() => setAgingFilter(status)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  agingFilter === status
                    ? 'bg-slate-800 text-white'
                    : 'bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-400 hover:bg-slate-200 dark:hover:bg-neutral-700'
                }`}
              >
                {status === '' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>

          {/* Items List */}
          {agingLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-violet-600 dark:text-violet-400" />
            </div>
          ) : agingItems.length === 0 ? (
            <div className="bg-white dark:bg-neutral-900/80 rounded-xl border border-slate-200 dark:border-white/5 p-8 text-center">
              <Clock size={48} className="mx-auto text-slate-300 mb-4" />
              <h3 className="font-medium text-slate-900 dark:text-white mb-2">No listed items</h3>
              <p className="text-sm text-slate-500 dark:text-neutral-500">
                Items will appear here once you list them for sale.
              </p>
            </div>
          ) : (
            <div className="bg-white dark:bg-neutral-900/80 rounded-xl border border-slate-200 dark:border-white/5 overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-neutral-900 border-b border-slate-200 dark:border-white/5">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 dark:text-neutral-500">Item</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 dark:text-neutral-500 hidden md:table-cell">Days Listed</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 dark:text-neutral-500">Status</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 dark:text-neutral-500">Current Price</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 dark:text-neutral-500">Suggested</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 dark:text-neutral-500">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {agingItems.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50 dark:bg-neutral-900">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {item.images?.[0] && (
                            <img src={item.images[0]} alt="" className="w-10 h-10 rounded object-cover" />
                          )}
                          <span className="font-medium text-slate-900 dark:text-white text-sm line-clamp-1">{item.title}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-neutral-400 hidden md:table-cell">
                        {item.days_listed} days
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${getAgingColor(item.aging_status)}`}>
                          {item.aging_status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-900 dark:text-white">
                        {formatPrice(item.selling_price)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {item.suggested_price ? (
                          <div>
                            <span className="font-medium text-emerald-600 dark:text-emerald-400">{formatPrice(item.suggested_price)}</span>
                            <span className="text-xs text-slate-400 dark:text-neutral-500 block">-{item.suggested_reduction}%</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 dark:text-neutral-500">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {item.suggested_price && item.suggested_price < item.selling_price && (
                          <button
                            onClick={() => applyPriceReduction(item.id, item.suggested_price!)}
                            disabled={applyingPrice === item.id}
                            className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-emerald-700 disabled:opacity-50"
                          >
                            {applyingPrice === item.id ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              'Apply'
                            )}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ============== FLIP FINDER TAB ============== */}
      {activeTab === 'flipfinder' && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl p-6 text-white">
            <div className="flex items-center gap-3 mb-2">
              <Zap size={24} />
              <h3 className="text-xl font-bold">Flip Finder</h3>
            </div>
            <p className="text-purple-100 text-sm">
              Find underpriced items with high resale potential. Compare active listings against sold prices to discover profitable flip opportunities.
            </p>
          </div>

          {/* Search Form */}
          <div className="bg-white dark:bg-neutral-900/80 rounded-xl border border-slate-200 dark:border-white/5 p-4">
            <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-2">
              Search for items to flip
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={flipQuery}
                onChange={(e) => setFlipQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && findFlipOpportunities()}
                placeholder="e.g. vintage Levi's 501, Nike Dunk Low, Casio G-Shock"
                className="flex-1 px-4 py-2 border border-slate-200 dark:border-white/5 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-slate-900 dark:text-white"
              />
              <button
                onClick={findFlipOpportunities}
                disabled={flipLoading || !flipQuery.trim()}
                className="bg-purple-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {flipLoading ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                Find Flips
              </button>
            </div>

            {/* Options */}
            <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Mode Toggle */}
              <div>
                <span className="text-xs font-medium text-slate-500 dark:text-neutral-500 block mb-2">Mode:</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setArbitrageMode(false)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      !arbitrageMode ? 'bg-purple-600 text-white' : 'bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-400 hover:bg-slate-200 dark:hover:bg-neutral-700'
                    }`}
                  >
                    Same Platform
                  </button>
                  <button
                    onClick={() => setArbitrageMode(true)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${
                      arbitrageMode ? 'bg-purple-600 text-white' : 'bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-400 hover:bg-slate-200 dark:hover:bg-neutral-700'
                    }`}
                  >
                    <ArrowRight size={14} />
                    Cross-Platform (Vinted → eBay)
                  </button>
                </div>
              </div>

              {/* Platform Selection (only for same platform mode) */}
              {!arbitrageMode && (
                <div>
                  <span className="text-xs font-medium text-slate-500 dark:text-neutral-500 block mb-2">Platforms:</span>
                  <div className="flex gap-2">
                    {FLIP_PLATFORMS.map(platform => (
                      <button
                        key={platform}
                        onClick={() => toggleFlipPlatform(platform)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          flipPlatforms.includes(platform)
                            ? 'bg-purple-600 text-white'
                            : 'bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-400 hover:bg-slate-200 dark:hover:bg-neutral-700'
                        }`}
                      >
                        {platform}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Min Profit Margin */}
              {!arbitrageMode && (
                <div>
                  <span className="text-xs font-medium text-slate-500 dark:text-neutral-500 block mb-2">
                    Min Profit Margin: {minProfitMargin}%
                  </span>
                  <input
                    type="range"
                    min="10"
                    max="50"
                    value={minProfitMargin}
                    onChange={(e) => setMinProfitMargin(parseInt(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Results - Standard Flip Finder */}
          {!arbitrageMode && flipResults.length > 0 && (
            <div className="space-y-6">
              {flipResults.map((result, idx) => (
                <div key={idx} className="bg-white dark:bg-neutral-900/80 rounded-xl border border-slate-200 dark:border-white/5 overflow-hidden">
                  {/* Stats Header */}
                  <div className="p-4 bg-slate-50 dark:bg-neutral-900 border-b border-slate-200 dark:border-white/5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-slate-900 dark:text-white">
                        {result.platform} - "{result.query}"
                      </h3>
                      <span className="text-sm text-slate-500 dark:text-neutral-500">
                        {result.stats.opportunities_found} opportunities from {result.stats.listings_analyzed} listings
                      </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-white dark:bg-neutral-900/80 rounded-lg p-3 border border-slate-200 dark:border-white/5">
                        <span className="text-xs text-slate-500 dark:text-neutral-500 block">Opportunities</span>
                        <span className="text-lg font-bold text-purple-600">{result.stats.opportunities_found}</span>
                      </div>
                      <div className="bg-white dark:bg-neutral-900/80 rounded-lg p-3 border border-slate-200 dark:border-white/5">
                        <span className="text-xs text-slate-500 dark:text-neutral-500 block">Avg Margin</span>
                        <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{result.stats.avg_profit_margin}%</span>
                      </div>
                      <div className="bg-white dark:bg-neutral-900/80 rounded-lg p-3 border border-slate-200 dark:border-white/5">
                        <span className="text-xs text-slate-500 dark:text-neutral-500 block">Best ROI</span>
                        <span className="text-lg font-bold text-violet-600 dark:text-violet-400">{result.stats.best_roi}%</span>
                      </div>
                      <div className="bg-white dark:bg-neutral-900/80 rounded-lg p-3 border border-slate-200 dark:border-white/5">
                        <span className="text-xs text-slate-500 dark:text-neutral-500 block">Analyzed</span>
                        <span className="text-lg font-bold text-slate-900 dark:text-white">{result.stats.listings_analyzed}</span>
                      </div>
                    </div>
                  </div>

                  {/* Opportunities List */}
                  {result.opportunities.length === 0 ? (
                    <div className="p-8 text-center">
                      <Zap size={32} className="mx-auto text-slate-300 mb-2" />
                      <p className="text-slate-500 dark:text-neutral-500">No flip opportunities found matching your criteria.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {result.opportunities.map((opp, i) => (
                        <div key={i} className="p-4 hover:bg-slate-50 dark:bg-neutral-900">
                          <div className="flex items-start gap-4">
                            {/* Image */}
                            {opp.listing.image_url ? (
                              <img src={opp.listing.image_url} alt="" className="w-20 h-20 rounded-lg object-cover flex-shrink-0" />
                            ) : (
                              <div className="w-20 h-20 rounded-lg bg-slate-100 dark:bg-neutral-800 flex items-center justify-center flex-shrink-0">
                                <Package size={24} className="text-slate-300" />
                              </div>
                            )}

                            {/* Details */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <h4 className="font-medium text-slate-900 dark:text-white line-clamp-2">{opp.listing.title}</h4>
                                  <p className="text-xs text-slate-500 dark:text-neutral-500 mt-1">
                                    {opp.listing.condition && `${opp.listing.condition} · `}
                                    {opp.listing.location && `${opp.listing.location} · `}
                                    {opp.market_data.sold_count} sold recently
                                  </p>
                                </div>

                                {/* Score Badge */}
                                <div className={`px-3 py-1 rounded-full text-white text-sm font-bold flex-shrink-0 ${getScoreColor(opp.score)}`}>
                                  {opp.score}
                                </div>
                              </div>

                              {/* Price Analysis */}
                              <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div>
                                  <span className="text-xs text-slate-400 dark:text-neutral-500 block">Buy For</span>
                                  <span className="font-bold text-slate-900 dark:text-white">{formatPrice(opp.listing.price)}</span>
                                </div>
                                <div>
                                  <span className="text-xs text-slate-400 dark:text-neutral-500 block">Sell For (median)</span>
                                  <span className="font-bold text-slate-900 dark:text-white">{formatPrice(opp.market_data.median_sold_price)}</span>
                                </div>
                                <div>
                                  <span className="text-xs text-slate-400 dark:text-neutral-500 block">Est. Profit</span>
                                  <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatPrice(opp.profit_analysis.estimated_profit)}</span>
                                </div>
                                <div>
                                  <span className="text-xs text-slate-400 dark:text-neutral-500 block">ROI</span>
                                  <span className="font-bold text-violet-600 dark:text-violet-400">{opp.profit_analysis.roi_percent}%</span>
                                </div>
                              </div>

                              {/* Confidence & Risk */}
                              <div className="mt-3 flex items-center gap-3 flex-wrap">
                                <div className="flex items-center gap-1 text-xs">
                                  {getConfidenceIcon(opp.profit_analysis.confidence)}
                                  <span className="capitalize">{opp.profit_analysis.confidence} confidence</span>
                                </div>
                                <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${getRiskColor(opp.profit_analysis.risk_level)}`}>
                                  {opp.profit_analysis.risk_level} risk
                                </span>
                                <span className="text-xs text-slate-500 dark:text-neutral-500 flex items-center gap-1">
                                  <Percent size={12} />
                                  {opp.profit_analysis.profit_margin_percent}% margin
                                </span>
                              </div>

                              {/* Recommendation */}
                              <p className="mt-2 text-sm text-slate-600 dark:text-neutral-400 italic">{opp.recommendation}</p>

                              {/* Action */}
                              <div className="mt-3">
                                <a
                                  href={opp.listing.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700"
                                >
                                  View Listing <ExternalLink size={14} />
                                </a>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Results - Arbitrage Mode */}
          {arbitrageMode && arbitrageResults.length > 0 && (
            <div className="bg-white dark:bg-neutral-900/80 rounded-xl border border-slate-200 dark:border-white/5 overflow-hidden">
              <div className="p-4 bg-gradient-to-r from-teal-500 to-blue-500 text-white">
                <h3 className="font-semibold flex items-center gap-2">
                  <ArrowRight size={18} />
                  Cross-Platform Arbitrage: Buy on Vinted → Sell on eBay
                </h3>
                <p className="text-sm text-white/80 mt-1">
                  Found {arbitrageResults.length} arbitrage opportunities
                </p>
              </div>

              <div className="divide-y divide-slate-100">
                {arbitrageResults.map((arb, i) => (
                  <div key={i} className="p-4 hover:bg-slate-50 dark:bg-neutral-900">
                    <div className="flex items-start gap-4">
                      {arb.buy_listing.image_url ? (
                        <img src={arb.buy_listing.image_url} alt="" className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-16 h-16 rounded-lg bg-slate-100 dark:bg-neutral-800 flex items-center justify-center flex-shrink-0">
                          <Package size={20} className="text-slate-300" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-slate-900 dark:text-white line-clamp-1">{arb.buy_listing.title}</h4>

                        <div className="mt-2 flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-teal-100 text-teal-700 text-xs font-medium">Vinted</span>
                            <span className="font-bold">{formatPrice(arb.buy_listing.price)}</span>
                          </div>
                          <ArrowRight size={16} className="text-slate-400 dark:text-neutral-500" />
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-blue-100 text-violet-700 dark:text-violet-400 text-xs font-medium">eBay</span>
                            <span className="font-bold">{formatPrice(arb.estimated_sell_price)}</span>
                          </div>
                        </div>

                        <div className="mt-2 flex items-center gap-4">
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                            +{formatPrice(arb.estimated_profit)} profit
                          </span>
                          <span className="text-violet-600 dark:text-violet-400 font-medium text-sm">
                            {arb.roi_percent}% ROI
                          </span>
                        </div>
                      </div>

                      <a
                        href={arb.buy_listing.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 bg-teal-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-teal-700 flex items-center gap-1"
                      >
                        Buy Now <ExternalLink size={12} />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {!flipLoading && flipResults.length === 0 && arbitrageResults.length === 0 && (
            <div className="bg-white dark:bg-neutral-900/80 rounded-xl border border-slate-200 dark:border-white/5 p-8 text-center">
              <Zap size={48} className="mx-auto text-purple-200 mb-4" />
              <h3 className="font-medium text-slate-900 dark:text-white mb-2">Search for flip opportunities</h3>
              <p className="text-sm text-slate-500 dark:text-neutral-500 max-w-md mx-auto">
                Enter a product name to find underpriced listings. We'll compare active listings against recent sold prices to find the best profit opportunities.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ============== LISTING OPTIMIZER TAB ============== */}
      {activeTab === 'optimizer' && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl p-6 text-white">
            <div className="flex items-center gap-3 mb-2">
              <Target size={24} />
              <h3 className="text-xl font-bold">Listing Optimizer</h3>
            </div>
            <p className="text-amber-100 text-sm">
              Analyze your listing titles and descriptions to maximize visibility and sales. Get keyword suggestions based on what sells best.
            </p>
          </div>

          {/* Input Form */}
          <div className="bg-white dark:bg-neutral-900/80 rounded-xl border border-slate-200 dark:border-white/5 p-4">
            {/* Mode Toggle */}
            <div className="flex gap-2 mb-4 flex-wrap">
              <button
                onClick={() => setOptimizerMode('analyze')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  optimizerMode === 'analyze'
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-400 hover:bg-slate-200 dark:hover:bg-neutral-700'
                }`}
              >
                Analyze Listing
              </button>
              <button
                onClick={() => setOptimizerMode('keywords')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  optimizerMode === 'keywords'
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-400 hover:bg-slate-200 dark:hover:bg-neutral-700'
                }`}
              >
                Keyword Research
              </button>
              <button
                onClick={() => setOptimizerMode('generate')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                  optimizerMode === 'generate'
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-400 hover:bg-slate-200 dark:hover:bg-neutral-700'
                }`}
              >
                <Sparkles size={14} />
                AI Description Writer
              </button>
            </div>

            {/* Analyze / Keywords Form */}
            {(optimizerMode === 'analyze' || optimizerMode === 'keywords') && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-1">
                    {optimizerMode === 'analyze' ? 'Listing Title' : 'Search Term / Category'}
                  </label>
                  <input
                    type="text"
                    value={optimizerTitle}
                    onChange={(e) => setOptimizerTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && analyzeListingOptimization()}
                    placeholder={optimizerMode === 'analyze'
                      ? "e.g. Vintage Levi's 501 Jeans W32 L34 Blue"
                      : "e.g. vintage denim jeans"
                    }
                    className="w-full px-4 py-2 border border-slate-200 dark:border-white/5 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-slate-900 dark:text-white"
                  />
                </div>

                {optimizerMode === 'analyze' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-1">
                      Description (optional)
                    </label>
                    <textarea
                      value={optimizerDescription}
                      onChange={(e) => setOptimizerDescription(e.target.value)}
                      placeholder="Paste your listing description for more detailed analysis..."
                      rows={4}
                      className="w-full px-4 py-2 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-amber-500 dark:focus:ring-amber-500/50 outline-none resize-none text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-neutral-500"
                    />
                  </div>
                )}

                <button
                  onClick={analyzeListingOptimization}
                  disabled={optimizerLoading || !optimizerTitle.trim()}
                  className="w-full bg-amber-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-amber-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {optimizerLoading ? <Loader2 size={16} className="animate-spin" /> : <Target size={16} />}
                  {optimizerMode === 'analyze' ? 'Analyze Listing' : 'Research Keywords'}
                </button>
              </div>
            )}

            {/* AI Description Generator Form */}
            {optimizerMode === 'generate' && (
              <div className="space-y-4">
                {/* Quick Generate */}
                <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Wand2 size={16} className="text-purple-600" />
                    <span className="font-medium text-purple-800">Quick Generate</span>
                  </div>
                  <p className="text-sm text-purple-600 mb-3">
                    Just enter your item title and we'll auto-detect details to generate a description.
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={aiTitle}
                      onChange={(e) => setAiTitle(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && quickGenerateDescription()}
                      placeholder="e.g. Nike Air Max 90 Size UK 9 White"
                      className="flex-1 px-4 py-2 border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-slate-900 dark:text-white"
                    />
                    <button
                      onClick={quickGenerateDescription}
                      disabled={aiGenerating || !aiTitle.trim()}
                      className="bg-purple-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
                    >
                      {aiGenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                      Quick
                    </button>
                  </div>
                </div>

                {/* Detailed Form */}
                <div className="border-t border-slate-200 dark:border-white/5 pt-4">
                  <h4 className="font-medium text-slate-700 dark:text-neutral-300 mb-3">Or provide details for a better description:</h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 dark:text-neutral-500 mb-1">Item Title *</label>
                      <input
                        type="text"
                        value={aiTitle}
                        onChange={(e) => setAiTitle(e.target.value)}
                        placeholder="e.g. Vintage Levi's 501 Jeans"
                        className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-500/50 outline-none text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 dark:text-neutral-500 mb-1">Brand</label>
                      <input
                        type="text"
                        value={aiBrand}
                        onChange={(e) => setAiBrand(e.target.value)}
                        placeholder="e.g. Levi's, Nike, Gucci"
                        className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-500/50 outline-none text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 dark:text-neutral-500 mb-1">Condition</label>
                      <select
                        value={aiCondition}
                        onChange={(e) => setAiCondition(e.target.value)}
                        className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-500/50 outline-none text-slate-900 dark:text-white"
                      >
                        <option value="New with Tags">New with Tags</option>
                        <option value="New without Tags">New without Tags</option>
                        <option value="Excellent">Excellent</option>
                        <option value="Very Good">Very Good</option>
                        <option value="Good">Good</option>
                        <option value="Fair">Fair</option>
                        <option value="Vintage">Vintage</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 dark:text-neutral-500 mb-1">Size</label>
                      <input
                        type="text"
                        value={aiSize}
                        onChange={(e) => setAiSize(e.target.value)}
                        placeholder="e.g. M, UK 10, W32 L34"
                        className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-500/50 outline-none text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 dark:text-neutral-500 mb-1">Color</label>
                      <input
                        type="text"
                        value={aiColor}
                        onChange={(e) => setAiColor(e.target.value)}
                        placeholder="e.g. Blue, Black, Multicolor"
                        className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-500/50 outline-none text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 dark:text-neutral-500 mb-1">Material</label>
                      <input
                        type="text"
                        value={aiMaterial}
                        onChange={(e) => setAiMaterial(e.target.value)}
                        placeholder="e.g. Cotton, Leather, Denim"
                        className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-500/50 outline-none text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 dark:text-neutral-500 mb-1">
                        Features (comma separated)
                      </label>
                      <input
                        type="text"
                        value={aiFeatures}
                        onChange={(e) => setAiFeatures(e.target.value)}
                        placeholder="e.g. Rare, Limited Edition, Original box"
                        className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-500/50 outline-none text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 dark:text-neutral-500 mb-1">
                        Flaws (comma separated)
                      </label>
                      <input
                        type="text"
                        value={aiFlaws}
                        onChange={(e) => setAiFlaws(e.target.value)}
                        placeholder="e.g. Small stain on collar, Minor wear"
                        className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-500/50 outline-none text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  {/* AI Provider Selection */}
                  {aiProviders.length > 1 && (
                    <div className="mt-3">
                      <label className="block text-xs font-medium text-slate-500 dark:text-neutral-500 mb-1">
                        AI Provider (optional)
                      </label>
                      <div className="flex gap-2 flex-wrap">
                        {aiProviders.map(provider => (
                          <button
                            key={provider}
                            onClick={() => setAiProvider(provider === aiProvider ? '' : provider)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                              aiProvider === provider
                                ? 'bg-purple-600 text-white'
                                : 'bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-400 hover:bg-slate-200 dark:hover:bg-neutral-700'
                            }`}
                          >
                            {provider === 'groq' && 'Groq (Llama)'}
                            {provider === 'huggingface' && 'Hugging Face'}
                            {provider === 'ollama' && 'Ollama (Local)'}
                            {provider === 'template' && 'Template'}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={generateAiDescription}
                    disabled={aiGenerating || !aiTitle.trim()}
                    className="w-full mt-4 bg-purple-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {aiGenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                    Generate Description
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Generated Description Result */}
          {generatedDescription && optimizerMode === 'generate' && (
            <div className="bg-white dark:bg-neutral-900/80 rounded-xl border border-slate-200 dark:border-white/5 overflow-hidden">
              <div className="p-4 bg-purple-50 border-b border-purple-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles size={18} className="text-purple-600" />
                  <h3 className="font-semibold text-purple-800">Generated Description</h3>
                  <span className="px-2 py-0.5 bg-purple-200 text-purple-700 rounded text-xs font-medium">
                    {generatedDescription.provider}
                  </span>
                </div>
                <button
                  onClick={copyDescription}
                  className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>

              <div className="p-4">
                <div className="bg-slate-50 dark:bg-neutral-900 rounded-lg p-4 font-mono text-sm text-slate-700 whitespace-pre-wrap">
                  {generatedDescription.description}
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100">
                  <p className="text-xs text-slate-500 dark:text-neutral-500">
                    💡 Tip: Review and personalize this description before using it. Add any specific details about your item that the AI might have missed.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Analysis Results */}
          {listingAnalysis && optimizerMode !== 'generate' && (
            <div className="space-y-4">
              {/* Score Card */}
              <div className="bg-white dark:bg-neutral-900/80 rounded-xl border border-slate-200 dark:border-white/5 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-slate-900 dark:text-white">Listing Score</h3>
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <span className="text-xs text-slate-500 dark:text-neutral-500 block">Current</span>
                      <span className={`text-3xl font-bold ${getListingScoreColor(listingAnalysis.score.current)}`}>
                        {listingAnalysis.score.current}
                      </span>
                    </div>
                    <ArrowRight size={20} className="text-slate-400 dark:text-neutral-500" />
                    <div className="text-center">
                      <span className="text-xs text-slate-500 dark:text-neutral-500 block">Potential</span>
                      <span className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                        {listingAnalysis.score.potential}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Score Bar */}
                <div className="relative h-3 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`absolute left-0 top-0 h-full ${getListingScoreBgColor(listingAnalysis.score.current)} transition-all duration-500`}
                    style={{ width: `${listingAnalysis.score.current}%` }}
                  />
                  <div
                    className="absolute top-0 h-full bg-emerald-200 opacity-50"
                    style={{
                      left: `${listingAnalysis.score.current}%`,
                      width: `${listingAnalysis.score.potential - listingAnalysis.score.current}%`
                    }}
                  />
                </div>

                {listingAnalysis.score.improvement_areas.length > 0 && (
                  <div className="mt-4">
                    <span className="text-xs font-medium text-slate-500 dark:text-neutral-500">Areas to improve:</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {listingAnalysis.score.improvement_areas.map((area, i) => (
                        <span key={i} className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-medium">
                          {area}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Title Improvements */}
              <div className="bg-white dark:bg-neutral-900/80 rounded-xl border border-slate-200 dark:border-white/5 p-4">
                <h3 className="font-semibold text-slate-900 dark:text-white mb-3">Title Improvements</h3>

                {listingAnalysis.suggestions.title_improvements.length > 0 ? (
                  <ul className="space-y-2">
                    {listingAnalysis.suggestions.title_improvements.map((improvement, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <AlertTriangle size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
                        <span className="text-slate-600 dark:text-neutral-400">{improvement}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                    <CheckCircle size={16} />
                    Your title looks great!
                  </p>
                )}

                {listingAnalysis.suggestions.keyword_suggestions.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <span className="text-xs font-medium text-slate-500 dark:text-neutral-500 block mb-2">Suggested keywords to add:</span>
                    <div className="flex flex-wrap gap-2">
                      {listingAnalysis.suggestions.keyword_suggestions.map((keyword, i) => (
                        <span key={i} className="px-2 py-1 bg-blue-100 text-violet-700 dark:text-violet-400 rounded text-xs font-medium">
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Description Tips */}
              <div className="bg-white dark:bg-neutral-900/80 rounded-xl border border-slate-200 dark:border-white/5 p-4">
                <h3 className="font-semibold text-slate-900 dark:text-white mb-3">Description Tips</h3>
                <ul className="space-y-2">
                  {listingAnalysis.suggestions.description_tips.map((tip, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle size={16} className="text-blue-500 mt-0.5 flex-shrink-0" />
                      <span className="text-slate-600 dark:text-neutral-400">{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Pricing Insight */}
              {listingAnalysis.suggestions.pricing_insight && (
                <div className="bg-white dark:bg-neutral-900/80 rounded-xl border border-slate-200 dark:border-white/5 p-4">
                  <h3 className="font-semibold text-slate-900 dark:text-white mb-3">Pricing Insight</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-3 bg-slate-50 dark:bg-neutral-900 rounded-lg">
                      <span className="text-xs text-slate-500 dark:text-neutral-500 block">Suggested Price</span>
                      <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                        {formatPrice(listingAnalysis.suggestions.pricing_insight.suggested_price)}
                      </span>
                    </div>
                    <div className="text-center p-3 bg-slate-50 dark:bg-neutral-900 rounded-lg">
                      <span className="text-xs text-slate-500 dark:text-neutral-500 block">Price Range</span>
                      <span className="text-lg font-bold text-slate-900 dark:text-white">
                        {formatPrice(listingAnalysis.suggestions.pricing_insight.price_range.min)} - {formatPrice(listingAnalysis.suggestions.pricing_insight.price_range.max)}
                      </span>
                    </div>
                    <div className="text-center p-3 bg-slate-50 dark:bg-neutral-900 rounded-lg">
                      <span className="text-xs text-slate-500 dark:text-neutral-500 block">Based On</span>
                      <span className="text-lg font-bold text-slate-900 dark:text-white">
                        {listingAnalysis.suggestions.pricing_insight.based_on} sold
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Keyword Analysis Results */}
          {keywordAnalysis && optimizerMode !== 'generate' && (
            <div className="space-y-4">
              <div className="bg-white dark:bg-neutral-900/80 rounded-xl border border-slate-200 dark:border-white/5 p-4">
                <h3 className="font-semibold text-slate-900 dark:text-white mb-3">Top Keywords for "{keywordAnalysis.query}"</h3>

                {keywordAnalysis.top_keywords.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-white/5">
                          <th className="text-left py-2 text-slate-500 dark:text-neutral-500 font-medium">Keyword</th>
                          <th className="text-center py-2 text-slate-500 dark:text-neutral-500 font-medium">Frequency</th>
                          <th className="text-right py-2 text-slate-500 dark:text-neutral-500 font-medium">Avg. Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {keywordAnalysis.top_keywords.map((kw, i) => (
                          <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 dark:bg-neutral-900">
                            <td className="py-2 font-medium text-slate-900 dark:text-white">{kw.keyword}</td>
                            <td className="py-2 text-center">
                              <span className="px-2 py-0.5 bg-blue-100 text-violet-700 dark:text-violet-400 rounded text-xs">
                                {kw.frequency}x
                              </span>
                            </td>
                            <td className="py-2 text-right text-emerald-600 dark:text-emerald-400 font-medium">
                              {formatPrice(kw.avg_price)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 dark:text-neutral-500">No keyword data found for this search term.</p>
                )}
              </div>

              {keywordAnalysis.trending_terms.length > 0 && (
                <div className="bg-white dark:bg-neutral-900/80 rounded-xl border border-slate-200 dark:border-white/5 p-4">
                  <h3 className="font-semibold text-slate-900 dark:text-white mb-3">Trending Terms</h3>
                  <p className="text-sm text-slate-500 dark:text-neutral-500 mb-2">These terms appear frequently in higher-priced sold listings:</p>
                  <div className="flex flex-wrap gap-2">
                    {keywordAnalysis.trending_terms.map((term, i) => (
                      <span key={i} className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium">
                        {term}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-white dark:bg-neutral-900/80 rounded-xl border border-slate-200 dark:border-white/5 p-4">
                <h3 className="font-semibold text-slate-900 dark:text-white mb-3">Terms to Avoid</h3>
                <p className="text-sm text-slate-500 dark:text-neutral-500 mb-2">These terms may lower perceived value or deter buyers:</p>
                <div className="flex flex-wrap gap-2">
                  {keywordAnalysis.avoid_terms.map((term, i) => (
                    <span key={i} className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                      {term}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!optimizerLoading && !listingAnalysis && !keywordAnalysis && !generatedDescription && optimizerMode !== 'generate' && (
            <div className="bg-white dark:bg-neutral-900/80 rounded-xl border border-slate-200 dark:border-white/5 p-8 text-center">
              <Target size={48} className="mx-auto text-amber-200 mb-4" />
              <h3 className="font-medium text-slate-900 dark:text-white mb-2">Optimize your listings</h3>
              <p className="text-sm text-slate-500 dark:text-neutral-500 max-w-md mx-auto">
                Enter your listing title to get optimization suggestions, or research keywords to find the best terms to use in your listings.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Research;
