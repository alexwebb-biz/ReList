import React, { useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { Activity, DollarSign, Package, ShoppingCart, TrendingUp, Target, Loader2, Bell, Calendar, Zap, ArrowUpRight } from 'lucide-react';
import { useDashboardStore } from '../stores/dashboardStore';
import { useAlertsStore } from '../stores/alertsStore';
import { useInventoryStore } from '../stores/inventoryStore';
import { Card, Badge, Button } from './ui/UIComponents';

const DATE_RANGES = [
  { label: '7 Days', value: 7 },
  { label: '30 Days', value: 30 },
  { label: '90 Days', value: 90 },
  { label: 'All Time', value: null },
];

const GOAL_COLORS = ['#10b981', '#e2e8f0'];

const StatCard = ({ title, value, subtext, icon: Icon, colorClass, delay, isLoading }: {
  title: string;
  value: string | number;
  subtext: string;
  icon: React.FC<{ className?: string }>;
  colorClass: string;
  delay?: string;
  isLoading?: boolean;
}) => (
  <Card className={`relative overflow-hidden group hover:border-violet-500/30 dark:hover:border-violet-500/30 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4`} style={{ animationDelay: delay }}>
    <div className="flex justify-between items-start mb-4">
      <div className={`p-3 rounded-2xl ${colorClass} bg-opacity-10 dark:bg-opacity-20 group-hover:bg-opacity-20 dark:group-hover:bg-opacity-30 transition-all`}>
        <Icon className={`w-6 h-6 ${colorClass.replace('bg-', 'text-')}`} />
      </div>
      <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-medium bg-emerald-100 dark:bg-emerald-500/10 px-2 py-1 rounded-full">
        <TrendingUp className="w-3 h-3" /> {subtext}
      </div>
    </div>
    <div>
      {isLoading ? (
        <div className="mt-1">
          <Loader2 className="w-6 h-6 animate-spin text-slate-300 dark:text-neutral-600" />
        </div>
      ) : (
        <>
          <h3 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">{value}</h3>
          <p className="text-slate-500 dark:text-neutral-500 text-sm font-medium mt-1">{title}</p>
        </>
      )}
    </div>
    <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-slate-100/50 dark:bg-white/5 blur-[50px] rounded-full group-hover:bg-violet-200/50 dark:group-hover:bg-violet-500/10 transition-colors"></div>
  </Card>
);

interface DashboardProps {
  onViewChange?: (view: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onViewChange }) => {
  const { stats: dashboardStats, isLoading: dashboardLoading, fetchStats: fetchDashboardStats, dateRange, setDateRange } = useDashboardStore();
  const { alerts, fetchAlerts } = useAlertsStore();
  const { stats: inventoryStats, fetchStats: fetchInventoryStats } = useInventoryStore();

  useEffect(() => {
    fetchDashboardStats(dateRange ?? undefined);
    fetchAlerts();
    fetchInventoryStats();
  }, [fetchDashboardStats, fetchAlerts, fetchInventoryStats, dateRange]);

  const handleDateRangeChange = (days: number | null) => {
    setDateRange(days);
    fetchDashboardStats(days ?? undefined);
  };

  // Calculate goal progress (example: monthly revenue goal of £5000)
  const monthlyGoal = 5000;
  const currentRevenue = dashboardStats?.total_revenue || 0;
  const goalPercentage = Math.min(100, Math.round((currentRevenue / monthlyGoal) * 100));
  const goalRemaining = Math.max(0, monthlyGoal - currentRevenue);

  const goalData = [
    { name: 'Achieved', value: currentRevenue },
    { name: 'Remaining', value: goalRemaining },
  ];

  // Generate mock chart data (in a real app, this would come from the API)
  const chartData = [
    { name: 'Mon', sales: Math.floor(Math.random() * 500), listings: Math.floor(Math.random() * 300) },
    { name: 'Tue', sales: Math.floor(Math.random() * 500), listings: Math.floor(Math.random() * 300) },
    { name: 'Wed', sales: Math.floor(Math.random() * 500), listings: Math.floor(Math.random() * 300) },
    { name: 'Thu', sales: Math.floor(Math.random() * 500), listings: Math.floor(Math.random() * 300) },
    { name: 'Fri', sales: Math.floor(Math.random() * 500), listings: Math.floor(Math.random() * 300) },
    { name: 'Sat', sales: Math.floor(Math.random() * 500), listings: Math.floor(Math.random() * 300) },
    { name: 'Sun', sales: Math.floor(Math.random() * 500), listings: Math.floor(Math.random() * 300) },
  ];

  const activeAlerts = alerts.filter(a => a.is_active);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Dashboard Overview</h1>
          <p className="text-slate-600 dark:text-neutral-400 mt-1">Real-time performance metrics and alerts.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => onViewChange?.('inventory')}>
            <Package className="w-4 h-4" /> Add Inventory
          </Button>
          <Button onClick={() => onViewChange?.('alerts')}>
            <Zap className="w-4 h-4 fill-current" /> Quick Scan
          </Button>
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400 dark:text-neutral-500" />
          <span className="text-sm font-medium text-slate-600 dark:text-neutral-400">Date Range:</span>
        </div>
        <div className="flex gap-1 sm:gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {DATE_RANGES.map((range) => (
            <button
              key={range.label}
              onClick={() => handleDateRangeChange(range.value)}
              className={`px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap flex-shrink-0 ${
                dateRange === range.value
                  ? 'bg-violet-600 text-white'
                  : 'bg-white dark:bg-neutral-900 text-slate-600 dark:text-neutral-300 hover:bg-slate-100 dark:hover:bg-neutral-800 border border-slate-200 dark:border-neutral-700'
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        <StatCard
          title="Total Revenue"
          value={`£${(dashboardStats?.total_revenue || 0).toLocaleString()}`}
          subtext={`+12%`}
          icon={Target}
          colorClass="bg-violet-500"
          delay="0ms"
          isLoading={dashboardLoading}
        />
        <StatCard
          title="Active Listings"
          value={dashboardStats?.listed_items || inventoryStats?.listed_count || 0}
          subtext={`+5%`}
          icon={Package}
          colorClass="bg-blue-500"
          delay="100ms"
          isLoading={dashboardLoading}
        />
        <StatCard
          title="Items Sold"
          value={dashboardStats?.sold_items || inventoryStats?.sold_count || 0}
          subtext={`+18%`}
          icon={ShoppingCart}
          colorClass="bg-emerald-500"
          delay="200ms"
          isLoading={dashboardLoading}
        />
        <StatCard
          title="Active Alerts"
          value={dashboardStats?.active_alerts || activeAlerts.length}
          subtext={`Active`}
          icon={Bell}
          colorClass="bg-amber-500"
          delay="300ms"
          isLoading={dashboardLoading}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Chart */}
        <Card className="lg:col-span-2 min-h-[400px]">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Revenue Trend</h3>
            <select className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-neutral-400 text-xs rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-violet-500/50">
              <option>Last 7 Days</option>
              <option>Last 30 Days</option>
            </select>
          </div>
          <div className="h-64 md:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{fill: '#94a3b8', fontSize: 11}}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{fill: '#94a3b8', fontSize: 11}}
                  width={40}
                />
                <Tooltip
                  cursor={{fill: '#f8fafc'}}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="sales" name="Sales (£)" fill="#0ea5e9" radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="listings" name="New Listings (£)" fill="#cbd5e1" radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Side Column: Recent Hits & Goals */}
        <div className="space-y-6">
          <Card className="h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Recent Hits</h3>
              <button
                onClick={() => onViewChange?.('alerts')}
                className="text-violet-600 dark:text-violet-400 text-xs font-semibold hover:text-violet-500 dark:hover:text-violet-300 flex items-center gap-1"
              >
                View All <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>
            <div className="space-y-4 flex-1">
              {activeAlerts.length === 0 ? (
                <p className="text-slate-400 dark:text-neutral-500 text-sm">No active alerts. Create one to start monitoring!</p>
              ) : activeAlerts.slice(0, 3).map((alert, i) => (
                <div
                  key={alert.id}
                  className="flex items-center justify-between p-4 bg-slate-50 dark:bg-neutral-950/50 border border-slate-100 dark:border-white/5 rounded-xl group hover:border-violet-500/30 dark:hover:border-violet-500/30 transition-all cursor-pointer"
                >
                  <div className="flex gap-3 items-center">
                    <div className="w-2 h-2 rounded-full bg-violet-500"></div>
                    <div>
                      <div className="font-semibold text-slate-800 dark:text-neutral-200 text-sm group-hover:text-slate-900 dark:group-hover:text-white">{alert.name}</div>
                      <div className="text-xs text-slate-500 dark:text-neutral-500 flex gap-2">
                        <span>{alert.platforms[0]}</span>
                        <span>•</span>
                        <span>Active</span>
                      </div>
                    </div>
                  </div>
                  <Badge variant="violet">{alert.keywords.length} keywords</Badge>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-6 border-t border-slate-200 dark:border-white/5">
              <div className="flex justify-between items-end mb-2">
                <span className="text-sm font-medium text-slate-600 dark:text-neutral-400">Monthly Goal</span>
                <span className="text-sm font-bold text-slate-900 dark:text-white">{goalPercentage}%</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-neutral-800 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-violet-600 to-indigo-500 h-2 rounded-full shadow-[0_0_10px_rgba(124,58,237,0.5)]"
                  style={{ width: `${goalPercentage}%` }}
                ></div>
              </div>
              <p className="text-xs text-slate-500 dark:text-neutral-500 mt-2 text-right">
                {goalRemaining > 0 ? (
                  <>£{goalRemaining.toLocaleString()} to reach £{monthlyGoal.toLocaleString()}</>
                ) : (
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">Goal achieved!</span>
                )}
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
