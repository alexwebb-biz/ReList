import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Package,
  ShoppingBag,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  PieChart,
  BarChart3
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPie,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend
} from 'recharts';

interface InventoryStats {
  total_items: number;
  draft_count: number;
  listed_count: number;
  sold_count: number;
  total_invested: number;
  total_revenue: number;
  total_profit: number;
}

interface InventoryItem {
  id: string;
  title: string;
  status: string;
  purchase_price: number | null;
  sold_price: number | null;
  sold_date: string | null;
  sold_platform: string | null;
  fees_total: number;
  postage_cost: number;
  created_at: string;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export const Analytics: React.FC = () => {
  const [stats, setStats] = useState<InventoryStats | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);

    const [statsRes, itemsRes] = await Promise.all([
      api.get<InventoryStats>('/inventory/stats'),
      api.get<InventoryItem[]>('/inventory?per_page=500'),
    ]);

    if (statsRes.success && statsRes.data) {
      setStats(statsRes.data);
    }

    if (itemsRes.success && itemsRes.data) {
      setItems(itemsRes.data);
    }

    setIsLoading(false);
  };

  // Filter items by date range
  const getFilteredItems = () => {
    const now = new Date();
    let cutoffDate = new Date(0);

    switch (dateRange) {
      case '7d':
        cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        cutoffDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case 'all':
      default:
        cutoffDate = new Date(0);
    }

    return items.filter(item => new Date(item.created_at) >= cutoffDate);
  };

  const filteredItems = getFilteredItems();
  const soldItems = filteredItems.filter(i => i.status === 'sold');

  // Calculate metrics
  const calculateProfitMargin = () => {
    if (!stats || stats.total_revenue === 0) return 0;
    return ((stats.total_profit / stats.total_revenue) * 100).toFixed(1);
  };

  const calculateAverageProfit = () => {
    if (soldItems.length === 0) return 0;
    const totalProfit = soldItems.reduce((sum, item) => {
      const revenue = item.sold_price || 0;
      const cost = item.purchase_price || 0;
      const fees = item.fees_total || 0;
      const postage = item.postage_cost || 0;
      return sum + (revenue - cost - fees - postage);
    }, 0);
    return (totalProfit / soldItems.length).toFixed(2);
  };

  // Prepare chart data
  const getPlatformData = () => {
    const platformCounts: Record<string, number> = {};
    soldItems.forEach(item => {
      const platform = item.sold_platform || 'Unknown';
      platformCounts[platform] = (platformCounts[platform] || 0) + 1;
    });
    return Object.entries(platformCounts).map(([name, value]) => ({ name, value }));
  };

  const getProfitByMonth = () => {
    const monthlyData: Record<string, { revenue: number; profit: number; count: number }> = {};

    soldItems.forEach(item => {
      if (!item.sold_date) return;
      const date = new Date(item.sold_date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { revenue: 0, profit: 0, count: 0 };
      }

      const revenue = item.sold_price || 0;
      const cost = item.purchase_price || 0;
      const fees = item.fees_total || 0;
      const postage = item.postage_cost || 0;
      const profit = revenue - cost - fees - postage;

      monthlyData[monthKey].revenue += revenue;
      monthlyData[monthKey].profit += profit;
      monthlyData[monthKey].count += 1;
    });

    return Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, data]) => ({
        month: new Date(month + '-01').toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
        revenue: Number(data.revenue.toFixed(2)),
        profit: Number(data.profit.toFixed(2)),
        count: data.count,
      }));
  };

  const getTopPerformers = () => {
    return soldItems
      .map(item => ({
        ...item,
        profit: (item.sold_price || 0) - (item.purchase_price || 0) - item.fees_total - item.postage_cost,
      }))
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 5);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const platformData = getPlatformData();
  const monthlyData = getProfitByMonth();
  const topPerformers = getTopPerformers();

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white">Analytics</h2>
          <p className="text-sm md:text-base text-slate-500 dark:text-neutral-500">Track your reselling performance and profitability.</p>
        </div>
        <div className="flex gap-1 sm:gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {(['7d', '30d', '90d', 'all'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={`px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
                dateRange === range
                  ? 'bg-violet-600 text-white'
                  : 'bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-400 hover:bg-slate-200 dark:hover:bg-neutral-700'
              }`}
            >
              {range === 'all' ? 'All Time' : range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
            </button>
          ))}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-white dark:bg-neutral-900/80 p-3 md:p-6 rounded-xl shadow-sm border border-slate-200 dark:border-white/5">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs md:text-sm text-slate-500 dark:text-neutral-500">Total Revenue</p>
              <p className="text-lg md:text-2xl font-bold text-slate-900 dark:text-white truncate">£{stats?.total_revenue?.toFixed(2) || '0.00'}</p>
            </div>
            <div className="w-10 h-10 md:w-12 md:h-12 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <DollarSign className="w-5 h-5 md:w-6 md:h-6 text-green-600" />
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1 text-xs md:text-sm">
            <ArrowUpRight className="w-3 h-3 md:w-4 md:h-4 text-green-500" />
            <span className="text-green-600 font-medium">{soldItems.length} sales</span>
          </div>
        </div>

        <div className="bg-white dark:bg-neutral-900/80 p-3 md:p-6 rounded-xl shadow-sm border border-slate-200 dark:border-white/5">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs md:text-sm text-slate-500 dark:text-neutral-500">Total Profit</p>
              <p className={`text-lg md:text-2xl font-bold truncate ${(stats?.total_profit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                £{stats?.total_profit?.toFixed(2) || '0.00'}
              </p>
            </div>
            <div className={`w-10 h-10 md:w-12 md:h-12 ${(stats?.total_profit || 0) >= 0 ? 'bg-green-100' : 'bg-red-100'} rounded-xl flex items-center justify-center flex-shrink-0`}>
              {(stats?.total_profit || 0) >= 0 ? (
                <TrendingUp className="w-5 h-5 md:w-6 md:h-6 text-green-600" />
              ) : (
                <TrendingDown className="w-5 h-5 md:w-6 md:h-6 text-red-600" />
              )}
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1 text-xs md:text-sm">
            <span className="text-slate-500 dark:text-neutral-500">{calculateProfitMargin()}% margin</span>
          </div>
        </div>

        <div className="bg-white dark:bg-neutral-900/80 p-3 md:p-6 rounded-xl shadow-sm border border-slate-200 dark:border-white/5">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs md:text-sm text-slate-500 dark:text-neutral-500">Avg. Profit/Item</p>
              <p className="text-lg md:text-2xl font-bold text-slate-900 dark:text-white truncate">£{calculateAverageProfit()}</p>
            </div>
            <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <BarChart3 className="w-5 h-5 md:w-6 md:h-6 text-violet-600 dark:text-violet-400" />
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1 text-xs md:text-sm">
            <span className="text-slate-500 dark:text-neutral-500">per sold item</span>
          </div>
        </div>

        <div className="bg-white dark:bg-neutral-900/80 p-3 md:p-6 rounded-xl shadow-sm border border-slate-200 dark:border-white/5">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs md:text-sm text-slate-500 dark:text-neutral-500">Inventory Value</p>
              <p className="text-lg md:text-2xl font-bold text-slate-900 dark:text-white truncate">£{stats?.total_invested?.toFixed(2) || '0.00'}</p>
            </div>
            <div className="w-10 h-10 md:w-12 md:h-12 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Package className="w-5 h-5 md:w-6 md:h-6 text-purple-600" />
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1 text-xs md:text-sm">
            <span className="text-slate-500 dark:text-neutral-500">{stats?.listed_count || 0} items listed</span>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Revenue & Profit Over Time */}
        <div className="bg-white dark:bg-neutral-900/80 p-4 md:p-6 rounded-xl shadow-sm border border-slate-200 dark:border-white/5">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-3 md:mb-4 text-sm md:text-base">Revenue & Profit Over Time</h3>
          {monthlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250} className="md:!h-[300px]">
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="#64748b" />
                <YAxis tick={{ fontSize: 10 }} stroke="#64748b" tickFormatter={(v) => `£${v}`} width={45} />
                <Tooltip
                  formatter={(value: number) => [`£${value.toFixed(2)}`, '']}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="revenue" name="Revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="profit" name="Profit" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 md:h-64 flex items-center justify-center text-slate-400 dark:text-neutral-500 text-sm">
              No sales data yet
            </div>
          )}
        </div>

        {/* Sales by Platform */}
        <div className="bg-white dark:bg-neutral-900/80 p-4 md:p-6 rounded-xl shadow-sm border border-slate-200 dark:border-white/5">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-3 md:mb-4 text-sm md:text-base">Sales by Platform</h3>
          {platformData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250} className="md:!h-[300px]">
              <RechartsPie>
                <Pie
                  data={platformData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {platformData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </RechartsPie>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 md:h-64 flex items-center justify-center text-slate-400 dark:text-neutral-500">
              <div className="text-center">
                <PieChart className="w-10 h-10 md:w-12 md:h-12 mx-auto mb-2 text-slate-300" />
                <span className="text-sm">No platform data yet</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Top Performers */}
      <div className="bg-white dark:bg-neutral-900/80 p-4 md:p-6 rounded-xl shadow-sm border border-slate-200 dark:border-white/5">
        <h3 className="font-semibold text-slate-900 dark:text-white mb-3 md:mb-4 text-sm md:text-base">Top Performing Items</h3>
        {topPerformers.length > 0 ? (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-neutral-900 text-slate-500 dark:text-neutral-500 font-medium">
                  <tr>
                    <th className="px-4 py-3 rounded-l-lg">Item</th>
                    <th className="px-4 py-3">Platform</th>
                    <th className="px-4 py-3">Cost</th>
                    <th className="px-4 py-3">Sold For</th>
                    <th className="px-4 py-3">Fees</th>
                    <th className="px-4 py-3 rounded-r-lg">Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {topPerformers.map((item, index) => (
                    <tr key={item.id} className="hover:bg-slate-50 dark:bg-neutral-900">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            index === 0 ? 'bg-yellow-100 text-yellow-700' :
                            index === 1 ? 'bg-slate-200 text-slate-600 dark:text-neutral-400' :
                            index === 2 ? 'bg-orange-100 text-orange-700' :
                            'bg-slate-100 dark:bg-neutral-800 text-slate-500 dark:text-neutral-500'
                          }`}>
                            {index + 1}
                          </span>
                          <span className="font-medium text-slate-900 dark:text-white truncate max-w-[200px]">{item.title}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-neutral-400">{item.sold_platform || '-'}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-neutral-400">£{(item.purchase_price || 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-neutral-400">£{(item.sold_price || 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-neutral-400">£{(item.fees_total + item.postage_cost).toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <span className={`font-semibold ${item.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          £{item.profit.toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List */}
            <div className="md:hidden space-y-3">
              {topPerformers.map((item, index) => (
                <div key={item.id} className="bg-slate-50 dark:bg-neutral-900 rounded-lg p-3">
                  <div className="flex items-start gap-2 mb-2">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      index === 0 ? 'bg-yellow-100 text-yellow-700' :
                      index === 1 ? 'bg-slate-200 text-slate-600 dark:text-neutral-400' :
                      index === 2 ? 'bg-orange-100 text-orange-700' :
                      'bg-slate-100 dark:bg-neutral-800 text-slate-500 dark:text-neutral-500'
                    }`}>
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-900 dark:text-white text-sm truncate">{item.title}</p>
                      <p className="text-xs text-slate-500 dark:text-neutral-500">{item.sold_platform || 'Unknown platform'}</p>
                    </div>
                    <span className={`font-bold text-sm ${item.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      £{item.profit.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-500 dark:text-neutral-500 pl-8">
                    <span>Cost: £{(item.purchase_price || 0).toFixed(2)}</span>
                    <span>Sold: £{(item.sold_price || 0).toFixed(2)}</span>
                    <span>Fees: £{(item.fees_total + item.postage_cost).toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="py-6 md:py-8 text-center text-slate-400 dark:text-neutral-500">
            <ShoppingBag className="w-10 h-10 md:w-12 md:h-12 mx-auto mb-2 text-slate-300" />
            <span className="text-sm">No sold items yet. Start selling to see your top performers!</span>
          </div>
        )}
      </div>

      {/* Inventory Summary */}
      <div className="grid grid-cols-3 gap-2 md:gap-4">
        <div className="bg-slate-50 dark:bg-neutral-900 p-3 md:p-4 rounded-xl border border-slate-200 dark:border-white/5">
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 md:w-10 md:h-10 bg-slate-200 rounded-lg flex items-center justify-center">
              <Package className="w-4 h-4 md:w-5 md:h-5 text-slate-600 dark:text-neutral-400" />
            </div>
            <div className="text-center sm:text-left">
              <p className="text-xs md:text-sm text-slate-500 dark:text-neutral-500">Draft</p>
              <p className="text-lg md:text-xl font-bold text-slate-900 dark:text-white">{stats?.draft_count || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-blue-50 dark:bg-blue-500/10 p-3 md:p-4 rounded-xl border border-blue-200 dark:border-blue-500/20">
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 md:w-10 md:h-10 bg-blue-200 dark:bg-blue-500/20 rounded-lg flex items-center justify-center">
              <ShoppingBag className="w-4 h-4 md:w-5 md:h-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div className="text-center sm:text-left">
              <p className="text-xs md:text-sm text-violet-600 dark:text-violet-400">Listed</p>
              <p className="text-lg md:text-xl font-bold text-blue-800 dark:text-blue-300">{stats?.listed_count || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-green-50 dark:bg-green-500/10 p-3 md:p-4 rounded-xl border border-green-200 dark:border-green-500/20">
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 md:w-10 md:h-10 bg-green-200 dark:bg-green-500/20 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-green-600 dark:text-green-400" />
            </div>
            <div className="text-center sm:text-left">
              <p className="text-xs md:text-sm text-green-600 dark:text-green-400">Sold</p>
              <p className="text-lg md:text-xl font-bold text-green-800 dark:text-green-300">{stats?.sold_count || 0}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
