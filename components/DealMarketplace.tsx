import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  TrendingUp,
  Trophy,
  Users,
  Plus,
  ThumbsUp,
  ThumbsDown,
  ExternalLink,
  Clock,
  MapPin,
  Tag,
  DollarSign,
  Star,
  Award,
  ChevronDown,
  ChevronUp,
  Filter,
  Search,
  Loader2,
  CheckCircle2,
  XCircle,
  Share2,
  Crown,
  Flame,
  Zap,
  Gift,
  Target,
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import api from '../lib/api';

// Types
interface Deal {
  id: string;
  user_id: string;
  sharer_name?: string;
  sharer_email?: string;
  sharer_reputation?: number;
  sharer_badges?: string[];
  title: string;
  description?: string;
  url: string;
  image_url?: string;
  platform: string;
  buy_price: number;
  estimated_sell_price: number;
  estimated_profit: number;
  estimated_roi: number;
  category: string;
  location?: string;
  condition?: string;
  status: string;
  claimed_by?: string;
  claimed_at?: string;
  upvotes: number;
  downvotes: number;
  views: number;
  user_vote?: 'up' | 'down' | null;
  created_at: string;
  expires_at: string;
}

interface UserReputation {
  reputation_score: number;
  reputation_level: string;
  deals_shared: number;
  deals_claimed: number;
  successful_sales: number;
  total_profit_generated: number;
  total_commission_earned: number;
  upvotes_received: number;
  downvotes_received: number;
  badges: string[];
}

interface LeaderboardEntry {
  user_id: string;
  full_name?: string;
  email: string;
  reputation_score: number;
  deals_shared: number;
  successful_sales: number;
  total_profit_generated: number;
  badges: string[];
}

interface Category {
  category: string;
  count: number;
}

// Badge icons mapping
const BADGE_ICONS: Record<string, React.ReactNode> = {
  'First Deal': <Gift className="w-3 h-3" />,
  'Deal Hunter': <Target className="w-3 h-3" />,
  'Profit Master': <DollarSign className="w-3 h-3" />,
  'Community Star': <Star className="w-3 h-3" />,
  'Rising Star': <TrendingUp className="w-3 h-3" />,
  'Top Contributor': <Crown className="w-3 h-3" />,
  'Trusted Seller': <CheckCircle2 className="w-3 h-3" />,
  'Hot Streak': <Flame className="w-3 h-3" />,
};

// Reputation level colors
const REP_LEVEL_COLORS: Record<string, string> = {
  'newcomer': 'text-slate-500 bg-slate-500/10',
  'contributor': 'text-blue-500 bg-blue-500/10',
  'trusted': 'text-emerald-500 bg-emerald-500/10',
  'expert': 'text-violet-500 bg-violet-500/10',
  'legend': 'text-amber-500 bg-amber-500/10',
};

export const DealMarketplace: React.FC = () => {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [myReputation, setMyReputation] = useState<UserReputation | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'feed' | 'my-deals' | 'leaderboard'>('feed');
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [sortBy, setSortBy] = useState<'newest' | 'profit' | 'upvotes'>('newest');
  const [myDeals, setMyDeals] = useState<Deal[]>([]);
  const [myDealsType, setMyDealsType] = useState<'shared' | 'claimed'>('shared');

  // Auth helper
  const getAuthHeaders = () => ({
    Authorization: `Bearer ${api.getToken()}`
  });

  // Fetch deals feed
  const fetchDeals = async () => {
    try {
      const params = new URLSearchParams({
        sort_by: sortBy,
        per_page: '50',
      });
      if (selectedCategory) params.append('category', selectedCategory);

      const response = await fetch(`/api/deals?${params}`, {
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (data.success) {
        setDeals(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching deals:', error);
    }
  };

  // Fetch user reputation
  const fetchMyReputation = async () => {
    try {
      const response = await fetch('/api/deals/my-reputation', {
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (data.success) {
        setMyReputation(data.data);
      }
    } catch (error) {
      console.error('Error fetching reputation:', error);
    }
  };

  // Fetch leaderboard
  const fetchLeaderboard = async () => {
    try {
      const response = await fetch('/api/deals/leaderboard?limit=10', {
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (data.success) {
        setLeaderboard(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    }
  };

  // Fetch categories
  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/deals/categories', {
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (data.success) {
        setCategories(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  // Fetch my deals
  const fetchMyDeals = async () => {
    try {
      const response = await fetch(`/api/deals/my-deals?type=${myDealsType}`, {
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (data.success) {
        setMyDeals(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching my deals:', error);
    }
  };

  // Vote on deal
  const voteDeal = async (dealId: string, voteType: 'up' | 'down') => {
    try {
      const response = await fetch(`/api/deals/${dealId}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ vote_type: voteType }),
      });
      const data = await response.json();
      if (data.success) {
        // Update local state
        setDeals(prev => prev.map(d =>
          d.id === dealId
            ? { ...d, upvotes: data.data.upvotes, downvotes: data.data.downvotes, user_vote: data.data.user_vote }
            : d
        ));
      }
    } catch (error) {
      console.error('Error voting:', error);
    }
  };

  // Claim deal
  const claimDeal = async (dealId: string) => {
    try {
      const response = await fetch(`/api/deals/${dealId}/claim`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
      });
      const data = await response.json();
      if (data.success) {
        // Refresh deals
        fetchDeals();
        fetchMyDeals();
      }
    } catch (error) {
      console.error('Error claiming deal:', error);
    }
  };

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([
        fetchDeals(),
        fetchMyReputation(),
        fetchLeaderboard(),
        fetchCategories(),
      ]);
      setIsLoading(false);
    };
    loadData();
  }, []);

  // Refetch when filters change
  useEffect(() => {
    fetchDeals();
  }, [selectedCategory, sortBy]);

  // Refetch my deals when type changes
  useEffect(() => {
    if (activeTab === 'my-deals') {
      fetchMyDeals();
    }
  }, [activeTab, myDealsType]);

  // Format currency
  const formatCurrency = (amount: number) => `£${amount.toFixed(2)}`;

  // Format time ago
  const timeAgo = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  // Get reputation level color
  const getRepLevelColor = (level: string) => REP_LEVEL_COLORS[level] || REP_LEVEL_COLORS.newcomer;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-violet-600 to-indigo-700 rounded-2xl p-5 text-white shadow-xl shadow-violet-500/20">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Trophy className="w-5 h-5" />
            </div>
            <span className="text-sm font-medium text-white/80">Your Reputation</span>
          </div>
          <div className="text-3xl font-bold">{myReputation?.reputation_score || 0}</div>
          <div className={`text-xs font-medium mt-1 px-2 py-0.5 rounded-full inline-block ${getRepLevelColor(myReputation?.reputation_level || 'newcomer')}`}>
            {myReputation?.reputation_level || 'newcomer'}
          </div>
        </div>

        <div className="bg-white dark:bg-neutral-900 rounded-2xl p-5 border border-slate-200 dark:border-white/5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <Share2 className="w-5 h-5 text-emerald-500" />
            </div>
            <span className="text-sm font-medium text-slate-500 dark:text-neutral-400">Deals Shared</span>
          </div>
          <div className="text-3xl font-bold text-slate-900 dark:text-white">{myReputation?.deals_shared || 0}</div>
        </div>

        <div className="bg-white dark:bg-neutral-900 rounded-2xl p-5 border border-slate-200 dark:border-white/5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-blue-500" />
            </div>
            <span className="text-sm font-medium text-slate-500 dark:text-neutral-400">Commission Earned</span>
          </div>
          <div className="text-3xl font-bold text-slate-900 dark:text-white">{formatCurrency(myReputation?.total_commission_earned || 0)}</div>
        </div>

        <div className="bg-white dark:bg-neutral-900 rounded-2xl p-5 border border-slate-200 dark:border-white/5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <Award className="w-5 h-5 text-amber-500" />
            </div>
            <span className="text-sm font-medium text-slate-500 dark:text-neutral-400">Badges</span>
          </div>
          <div className="flex gap-1 flex-wrap">
            {(myReputation?.badges || []).slice(0, 4).map((badge, i) => (
              <span key={i} className="px-2 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-medium flex items-center gap-1">
                {BADGE_ICONS[badge] || <Star className="w-3 h-3" />}
                {badge}
              </span>
            ))}
            {(!myReputation?.badges || myReputation.badges.length === 0) && (
              <span className="text-slate-400 dark:text-neutral-500 text-sm">None yet</span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-white/5 pb-4">
        <button
          onClick={() => setActiveTab('feed')}
          className={`px-4 py-2 rounded-xl font-medium transition-all ${ activeTab === 'feed' ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/25' : 'text-slate-600 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-white/5' }`}
        >
          <Sparkles className="w-4 h-4 inline mr-2" />
          Deal Feed
        </button>
        <button
          onClick={() => setActiveTab('my-deals')}
          className={`px-4 py-2 rounded-xl font-medium transition-all ${ activeTab === 'my-deals' ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/25' : 'text-slate-600 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-white/5' }`}
        >
          <Target className="w-4 h-4 inline mr-2" />
          My Deals
        </button>
        <button
          onClick={() => setActiveTab('leaderboard')}
          className={`px-4 py-2 rounded-xl font-medium transition-all ${ activeTab === 'leaderboard' ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/25' : 'text-slate-600 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-white/5' }`}
        >
          <Trophy className="w-4 h-4 inline mr-2" />
          Leaderboard
        </button>

        <button
          onClick={() => setShowShareModal(true)}
          className="ml-auto px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-medium shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30 transition-all flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Share a Deal
        </button>
      </div>

      {/* Feed Tab */}
      {activeTab === 'feed' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2 rounded-xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-white/10 text-sm font-medium text-slate-700 dark:text-neutral-300"
              >
                <option value="">All Categories</option>
                {categories.map(cat => (
                  <option key={cat.category} value={cat.category}>
                    {cat.category} ({cat.count})
                  </option>
                ))}
              </select>
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'newest' | 'profit' | 'upvotes')}
              className="px-3 py-2 rounded-xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-white/10 text-sm font-medium text-slate-700 dark:text-neutral-300"
            >
              <option value="newest">Newest First</option>
              <option value="profit">Highest Profit</option>
              <option value="upvotes">Most Popular</option>
            </select>

            <button
              onClick={fetchDeals}
              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Deal Cards */}
          <div className="grid gap-4">
            {deals.map(deal => (
              <DealCard
                key={deal.id}
                deal={deal}
                onVote={voteDeal}
                onClaim={claimDeal}
                formatCurrency={formatCurrency}
                timeAgo={timeAgo}
              />
            ))}

            {deals.length === 0 && (
              <div className="text-center py-16 bg-white dark:bg-neutral-900 rounded-2xl border border-slate-200 dark:border-white/5">
                <Sparkles className="w-12 h-12 mx-auto text-slate-300 dark:text-neutral-600 mb-4" />
                <h3 className="text-lg font-semibold text-slate-700 dark:text-neutral-300 mb-2">No deals yet</h3>
                <p className="text-slate-500 dark:text-neutral-500 mb-4">Be the first to share a deal with the community!</p>
                <button
                  onClick={() => setShowShareModal(true)}
                  className="px-4 py-2 bg-violet-600 text-white rounded-xl font-medium hover:bg-violet-500 transition-colors"
                >
                  Share a Deal
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* My Deals Tab */}
      {activeTab === 'my-deals' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <button
              onClick={() => setMyDealsType('shared')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${ myDealsType === 'shared' ? 'bg-slate-200 dark:bg-white/10 text-slate-900 dark:text-white' : 'text-slate-500 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-white/5' }`}
            >
              Shared by Me
            </button>
            <button
              onClick={() => setMyDealsType('claimed')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${ myDealsType === 'claimed' ? 'bg-slate-200 dark:bg-white/10 text-slate-900 dark:text-white' : 'text-slate-500 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-white/5' }`}
            >
              Claimed by Me
            </button>
          </div>

          <div className="grid gap-4">
            {myDeals.map(deal => (
              <DealCard
                key={deal.id}
                deal={deal}
                onVote={voteDeal}
                onClaim={claimDeal}
                formatCurrency={formatCurrency}
                timeAgo={timeAgo}
                showOutcomeButton={myDealsType === 'claimed' && deal.status === 'claimed'}
              />
            ))}

            {myDeals.length === 0 && (
              <div className="text-center py-16 bg-white dark:bg-neutral-900 rounded-2xl border border-slate-200 dark:border-white/5">
                <Target className="w-12 h-12 mx-auto text-slate-300 dark:text-neutral-600 mb-4" />
                <h3 className="text-lg font-semibold text-slate-700 dark:text-neutral-300 mb-2">
                  {myDealsType === 'shared' ? 'No deals shared yet' : 'No deals claimed yet'}
                </h3>
                <p className="text-slate-500 dark:text-neutral-500">
                  {myDealsType === 'shared'
                    ? 'Share deals to earn commissions and reputation!'
                    : 'Browse the feed to find profitable deals.'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Leaderboard Tab */}
      {activeTab === 'leaderboard' && (
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-slate-200 dark:border-white/5 overflow-hidden">
          <div className="p-6 border-b border-slate-200 dark:border-white/5">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              Top Deal Hunters
            </h3>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-white/5">
            {leaderboard.map((entry, index) => (
              <div key={entry.user_id} className="p-4 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${ index === 0 ? 'bg-amber-500 text-white' : 1 'bg-slate-400 2 'bg-amber-700 'bg-slate-200 dark:bg-neutral-800 text-slate-600 dark:text-neutral-400' }`}>
                  {index + 1}
                </div>

                <div className="flex-1">
                  <div className="font-semibold text-slate-900 dark:text-white">
                    {entry.full_name || entry.email.split('@')[0]}
                  </div>
                  <div className="text-sm text-slate-500 dark:text-neutral-400">
                    {entry.deals_shared} deals shared · {formatCurrency(entry.total_profit_generated)} profit generated
                  </div>
                </div>

                <div className="flex gap-1">
                  {entry.badges.slice(0, 3).map((badge, i) => (
                    <span key={i} className="w-6 h-6 rounded-full bg-amber-500/10 flex items-center justify-center" title={badge}>
                      {BADGE_ICONS[badge] || <Star className="w-3 h-3 text-amber-500" />}
                    </span>
                  ))}
                </div>

                <div className="text-right">
                  <div className="text-2xl font-bold text-violet-600">{entry.reputation_score}</div>
                  <div className="text-xs text-slate-500 dark:text-neutral-500">reputation</div>
                </div>
              </div>
            ))}

            {leaderboard.length === 0 && (
              <div className="p-8 text-center text-slate-500 dark:text-neutral-500">
                No leaderboard data yet. Be the first to share deals!
              </div>
            )}
          </div>
        </div>
      )}

      {/* Share Deal Modal */}
      {showShareModal && (
        <ShareDealModal
          onClose={() => setShowShareModal(false)}
          onSuccess={() => {
            setShowShareModal(false);
            fetchDeals();
            fetchMyReputation();
          }}
          categories={categories.map(c => c.category)}
          getAuthHeaders={getAuthHeaders}
        />
      )}
    </div>
  );
};

// Deal Card Component
interface DealCardProps {
  deal: Deal;
  onVote: (id: string, type: 'up' | 'down') => void;
  onClaim: (id: string) => void;
  formatCurrency: (amount: number) => string;
  timeAgo: (date: string) => string;
  showOutcomeButton?: boolean;
}

const DealCard: React.FC<DealCardProps> = ({ deal, onVote, onClaim, formatCurrency, timeAgo, showOutcomeButton }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showOutcome, setShowOutcome] = useState(false);

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-slate-200 dark:border-white/5 overflow-hidden hover:shadow-lg transition-all">
      <div className="p-5">
        <div className="flex gap-4">
          {/* Image */}
          {deal.image_url && (
            <div className="w-24 h-24 rounded-xl overflow-hidden bg-slate-100 dark:bg-neutral-800 flex-shrink-0">
              <img src={deal.image_url} alt={deal.title} className="w-full h-full object-cover" />
            </div>
          )}

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white line-clamp-1">{deal.title}</h3>
                <div className="flex items-center gap-2 mt-1 text-sm text-slate-500 dark:text-neutral-400">
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/5">{deal.platform}</span>
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/5">{deal.category}</span>
                  {deal.location && (
                    <>
                      <MapPin className="w-3 h-3" />
                      <span>{deal.location}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Profit Badge */}
              <div className="text-right flex-shrink-0">
                <div className="text-lg font-bold text-emerald-600">{formatCurrency(deal.estimated_profit)}</div>
                <div className="text-xs text-emerald-500">+{deal.estimated_roi.toFixed(0)}% ROI</div>
              </div>
            </div>

            {/* Prices */}
            <div className="flex items-center gap-4 mt-3">
              <div>
                <div className="text-xs text-slate-500 dark:text-neutral-500">Buy Price</div>
                <div className="font-semibold text-slate-900 dark:text-white">{formatCurrency(deal.buy_price)}</div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400" />
              <div>
                <div className="text-xs text-slate-500 dark:text-neutral-500">Sell For</div>
                <div className="font-semibold text-slate-900 dark:text-white">{formatCurrency(deal.estimated_sell_price)}</div>
              </div>
            </div>

            {/* Sharer Info */}
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 dark:border-white/5">
              <div className="flex items-center gap-2 text-sm">
                <div className="w-6 h-6 rounded-full bg-violet-500/10 flex items-center justify-center">
                  <Users className="w-3 h-3 text-violet-500" />
                </div>
                <span className="text-slate-600 dark:text-neutral-400">
                  {deal.sharer_name || 'Anonymous'}
                </span>
                {deal.sharer_reputation && (
                  <span className="px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 text-xs font-medium">
                    {deal.sharer_reputation} rep
                  </span>
                )}
                <span className="text-slate-400 dark:text-neutral-500">·</span>
                <Clock className="w-3 h-3 text-slate-400" />
                <span className="text-slate-500 dark:text-neutral-500">{timeAgo(deal.created_at)}</span>
              </div>

              {/* Voting */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onVote(deal.id, 'up')}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition-colors ${ deal.user_vote === 'up' ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-neutral-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 hover:text-emerald-600' }`}
                >
                  <ThumbsUp className="w-4 h-4" />
                  <span className="text-sm font-medium">{deal.upvotes}</span>
                </button>
                <button
                  onClick={() => onVote(deal.id, 'down')}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition-colors ${ deal.user_vote === 'down' ? 'bg-red-500 text-white' : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-neutral-400 hover:bg-red-100 dark:hover:bg-red-500/20 hover:text-red-600' }`}
                >
                  <ThumbsDown className="w-4 h-4" />
                  <span className="text-sm font-medium">{deal.downvotes}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Expanded Description */}
        {isExpanded && deal.description && (
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/5">
            <p className="text-sm text-slate-600 dark:text-neutral-400">{deal.description}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-5 py-3 bg-slate-50 dark:bg-white/5 flex items-center justify-between gap-3">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-sm text-slate-500 dark:text-neutral-400 hover:text-slate-700 dark:hover:text-white flex items-center gap-1"
        >
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          {isExpanded ? 'Less' : 'More'}
        </button>

        <div className="flex items-center gap-2">
          <a
            href={deal.url}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-white font-medium text-sm hover:bg-slate-300 dark:hover:bg-white/15 transition-colors flex items-center gap-2"
          >
            <ExternalLink className="w-4 h-4" />
            View Deal
          </a>

          {deal.status === 'active' && !deal.claimed_by && (
            <button
              onClick={() => onClaim(deal.id)}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-medium text-sm hover:shadow-lg hover:shadow-violet-500/25 transition-all flex items-center gap-2"
            >
              <Zap className="w-4 h-4" />
              Claim Deal
            </button>
          )}

          {showOutcomeButton && (
            <button
              onClick={() => setShowOutcome(true)}
              className="px-4 py-2 rounded-xl bg-emerald-500 text-white font-medium text-sm hover:bg-emerald-400 transition-colors flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              Report Outcome
            </button>
          )}
        </div>
      </div>

      {/* Outcome Modal */}
      {showOutcome && (
        <ReportOutcomeModal
          deal={deal}
          onClose={() => setShowOutcome(false)}
          onSuccess={() => {
            setShowOutcome(false);
            window.location.reload();
          }}
        />
      )}
    </div>
  );
};

// Share Deal Modal
interface ShareDealModalProps {
  onClose: () => void;
  onSuccess: () => void;
  categories: string[];
  getAuthHeaders: () => { Authorization: string };
}

const ShareDealModal: React.FC<ShareDealModalProps> = ({ onClose, onSuccess, categories, getAuthHeaders }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    url: '',
    image_url: '',
    platform: 'eBay',
    buy_price: '',
    estimated_sell_price: '',
    category: 'Other',
    location: '',
    condition: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/deals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          ...formData,
          buy_price: parseFloat(formData.buy_price),
          estimated_sell_price: parseFloat(formData.estimated_sell_price),
        }),
      });

      const data = await response.json();

      if (data.success) {
        onSuccess();
      } else {
        setError(data.error?.message || 'Failed to share deal');
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const platforms = ['eBay', 'Vinted', 'Depop', 'Facebook Marketplace', 'Gumtree', 'Shpock', 'Other'];
  const defaultCategories = ['Clothing', 'Electronics', 'Sneakers', 'Designer', 'Vintage', 'Gaming', 'Sports', 'Home', 'Other'];
  const allCategories = [...new Set([...categories, ...defaultCategories])];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200 dark:border-white/5 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-500" />
            Share a Deal
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
            <XCircle className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-1">Title *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Nike Air Max 90 - Great Flip Opportunity"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
              required
              minLength={5}
              maxLength={200}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-1">Deal URL *</label>
            <input
              type="url"
              value={formData.url}
              onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
              placeholder="https://ebay.co.uk/itm/..."
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-1">Platform *</label>
              <select
                value={formData.platform}
                onChange={(e) => setFormData(prev => ({ ...prev, platform: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
              >
                {platforms.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-1">Category *</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
              >
                {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-1">Buy Price *</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">£</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.buy_price}
                  onChange={(e) => setFormData(prev => ({ ...prev, buy_price: e.target.value }))}
                  placeholder="50.00"
                  className="w-full pl-8 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-1">Estimated Sell Price *</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">£</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.estimated_sell_price}
                  onChange={(e) => setFormData(prev => ({ ...prev, estimated_sell_price: e.target.value }))}
                  placeholder="120.00"
                  className="w-full pl-8 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                  required
                />
              </div>
            </div>
          </div>

          {formData.buy_price && formData.estimated_sell_price && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <div className="flex justify-between text-sm">
                <span className="text-emerald-600 dark:text-emerald-400">Estimated Profit:</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  £{(parseFloat(formData.estimated_sell_price) - parseFloat(formData.buy_price)).toFixed(2)}
                  {' '}
                  ({(((parseFloat(formData.estimated_sell_price) - parseFloat(formData.buy_price)) / parseFloat(formData.buy_price)) * 100).toFixed(0)}% ROI)
                </span>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-1">Image URL (optional)</label>
            <input
              type="url"
              value={formData.image_url}
              onChange={(e) => setFormData(prev => ({ ...prev, image_url: e.target.value }))}
              placeholder="https://..."
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-1">Description (optional)</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Why is this a good deal? Any tips for the buyer?"
              rows={3}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-1">Location (optional)</label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                placeholder="London, UK"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-1">Condition (optional)</label>
              <input
                type="text"
                value={formData.condition}
                onChange={(e) => setFormData(prev => ({ ...prev, condition: e.target.value }))}
                placeholder="New with tags"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-700 dark:text-neutral-300 font-medium hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-medium hover:shadow-lg hover:shadow-violet-500/25 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sharing...
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4" />
                  Share Deal
                </>
              )}
            </button>
          </div>

          <p className="text-xs text-slate-500 dark:text-neutral-500 text-center">
            You'll earn 5% commission if someone profits from this deal!
          </p>
        </form>
      </div>
    </div>
  );
};

// Report Outcome Modal
interface ReportOutcomeModalProps {
  deal: Deal;
  onClose: () => void;
  onSuccess: () => void;
}

const ReportOutcomeModal: React.FC<ReportOutcomeModalProps> = ({ deal, onClose, onSuccess }) => {
  const [sold, setSold] = useState(true);
  const [actualPrice, setActualPrice] = useState(deal.estimated_sell_price.toString());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/deals/${deal.id}/outcome`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${api.getToken()}`,
        },
        body: JSON.stringify({
          sold,
          actual_sell_price: sold ? parseFloat(actualPrice) : undefined,
        }),
      });

      const data = await response.json();
      if (data.success) {
        onSuccess();
      }
    } catch (error) {
      console.error('Error reporting outcome:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const profit = sold ? parseFloat(actualPrice) - deal.buy_price : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl w-full max-w-md">
        <div className="p-6 border-b border-slate-200 dark:border-white/5">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Report Outcome</h2>
          <p className="text-sm text-slate-500 dark:text-neutral-400 mt-1">{deal.title}</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => setSold(true)}
              className={`flex-1 p-4 rounded-xl border-2 transition-all ${ sold ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-200 dark:border-white/10' }`}
            >
              <CheckCircle2 className={`w-8 h-8 mx-auto mb-2 ${sold ? 'text-emerald-500' : 'text-slate-400'}`} />
              <div className={`font-medium ${sold ? 'text-emerald-600' : 'text-slate-500'}`}>Sold</div>
            </button>
            <button
              type="button"
              onClick={() => setSold(false)}
              className={`flex-1 p-4 rounded-xl border-2 transition-all ${ !sold ? 'border-red-500 bg-red-500/10' : 'border-slate-200 dark:border-white/10' }`}
            >
              <XCircle className={`w-8 h-8 mx-auto mb-2 ${!sold ? 'text-red-500' : 'text-slate-400'}`} />
              <div className={`font-medium ${!sold ? 'text-red-600' : 'text-slate-500'}`}>Not Sold</div>
            </button>
          </div>

          {sold && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-1">Actual Sell Price</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">£</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={actualPrice}
                  onChange={(e) => setActualPrice(e.target.value)}
                  className="w-full pl-8 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                  required
                />
              </div>
            </div>
          )}

          {sold && actualPrice && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 dark:text-neutral-400">Your Profit:</span>
                <span className="font-semibold text-emerald-600">£{profit.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 dark:text-neutral-400">Commission to Sharer (5%):</span>
                <span className="font-semibold text-violet-600">£{(profit * 0.05).toFixed(2)}</span>
              </div>
            </div>
          )}

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-700 dark:text-neutral-300 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2.5 rounded-xl bg-violet-600 text-white font-medium disabled:opacity-50"
            >
              {isSubmitting ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DealMarketplace;
