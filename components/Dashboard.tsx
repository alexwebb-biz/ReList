import React, { useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Activity, DollarSign, Package, ShoppingCart, TrendingUp, Target, Loader2, Bell, Calendar } from 'lucide-react';
import { useDashboardStore } from '../stores/dashboardStore';
import { useAlertsStore } from '../stores/alertsStore';
import { useInventoryStore } from '../stores/inventoryStore';

const GOAL_COLORS = ['#10b981', '#e2e8f0'];

const DATE_RANGES = [
  { label: '7 Days', value: 7 },
  { label: '30 Days', value: 30 },
  { label: '90 Days', value: 90 },
  { label: 'All Time', value: null },
];

const StatCard = ({ title, value, subtext, icon: Icon, color, isLoading }: {
  title: string;
  value: string | number;
  subtext: string;
  icon: React.FC<{ className?: string }>;
  color: string;
  isLoading?: boolean;
}) => (
  <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-slate-100 flex items-start justify-between hover:shadow-md transition-shadow group">
    <div className="min-w-0 flex-1">
      <p className="text-xs md:text-sm font-medium text-slate-500 group-hover:text-slate-600 transition-colors">{title}</p>
      {isLoading ? (
        <div className="mt-1">
          <Loader2 className="w-5 h-5 md:w-6 md:h-6 animate-spin text-slate-300" />
        </div>
      ) : (
        <>
          <h3 className="text-xl md:text-2xl font-bold text-slate-800 mt-1 truncate">{value}</h3>
          <p className="text-xs text-green-500 mt-1 font-medium flex items-center gap-1 truncate">
            <TrendingUp size={12} className="flex-shrink-0" />
            <span className="truncate">{subtext}</span>
          </p>
        </>
      )}
    </div>
    <div className={`p-2 md:p-3 rounded-lg ${color} bg-opacity-90 group-hover:bg-opacity-100 transition-all flex-shrink-0 ml-2`}>
      <Icon className="w-5 h-5 md:w-6 md:h-6 text-white" />
    </div>
  </div>
);

export const Dashboard: React.FC = () => {
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
    <div className="space-y-4 md:space-y-6">
      {/* Date Range Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-600">Date Range:</span>
        </div>
        <div className="flex gap-1 sm:gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {DATE_RANGES.map((range) => (
            <button
              key={range.label}
              onClick={() => handleDateRangeChange(range.value)}
              className={`px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap flex-shrink-0 ${
                dateRange === range.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
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
          subtext={`£${(dashboardStats?.total_profit || 0).toLocaleString()} profit`}
          icon={DollarSign}
          color="bg-emerald-500"
          isLoading={dashboardLoading}
        />
        <StatCard
          title="Active Listings"
          value={dashboardStats?.listed_items || inventoryStats?.listed_count || 0}
          subtext={`${inventoryStats?.draft_count || 0} in draft`}
          icon={Package}
          color="bg-blue-500"
          isLoading={dashboardLoading}
        />
        <StatCard
          title="Items Sold"
          value={dashboardStats?.sold_items || inventoryStats?.sold_count || 0}
          subtext={`${inventoryStats?.total_items || 0} total items`}
          icon={ShoppingCart}
          color="bg-indigo-500"
          isLoading={dashboardLoading}
        />
        <StatCard
          title="Active Alerts"
          value={dashboardStats?.active_alerts || activeAlerts.length}
          subtext={`${dashboardStats?.unread_matches || 0} unread matches`}
          icon={Activity}
          color="bg-rose-500"
          isLoading={dashboardLoading}
        />
      </div>

      {/* Charts Section - Stack on mobile, side by side on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-white p-4 md:p-6 rounded-xl shadow-sm border border-slate-100">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4 md:mb-6">
            <h3 className="text-base md:text-lg font-bold text-slate-800">Performance Overview</h3>
            <select className="text-sm border-slate-200 border rounded-md px-2 py-1 text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
              <option>This Week</option>
              <option>Last Week</option>
              <option>This Month</option>
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
        </div>

        {/* Side Column: Goals & Alerts */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4 md:gap-6">
          {/* Monthly Goal Card */}
          <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col items-center justify-center relative overflow-hidden min-h-[240px]">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-blue-500"></div>
            <div className="w-full flex justify-between items-center mb-2">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm md:text-base">
                <Target className="w-4 h-4 text-emerald-500" /> Monthly Goal
              </h3>
              <span className="text-[10px] md:text-xs font-medium text-slate-400">£{monthlyGoal.toLocaleString()}</span>
            </div>

            <div className="relative w-32 h-32 md:w-40 md:h-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={goalData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={60}
                    startAngle={90}
                    endAngle={-270}
                    dataKey="value"
                  >
                    {goalData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={GOAL_COLORS[index % GOAL_COLORS.length]} strokeWidth={0} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xl md:text-2xl font-bold text-slate-800">{goalPercentage}%</span>
                <span className="text-[9px] md:text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Complete</span>
              </div>
            </div>
            <p className="text-xs text-center text-slate-500 mt-2">
              {goalRemaining > 0 ? (
                <>You're <strong>£{goalRemaining.toLocaleString()}</strong> away from your goal!</>
              ) : (
                <span className="text-emerald-600 font-medium">Goal achieved!</span>
              )}
            </p>
          </div>

          {/* Recent Alerts */}
          <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col overflow-hidden min-h-[240px]">
            <h3 className="text-xs md:text-sm font-bold text-slate-800 mb-3 uppercase tracking-wider flex items-center gap-2">
              <Bell className="w-4 h-4" /> Active Alerts
            </h3>
            <div className="flex-1 overflow-y-auto space-y-2 md:space-y-3 pr-1 custom-scrollbar">
              {activeAlerts.length === 0 ? (
                <p className="text-slate-400 text-xs md:text-sm">No active alerts. Create one to start monitoring!</p>
              ) : activeAlerts.slice(0, 5).map(alert => (
                <div key={alert.id} className="p-2 bg-slate-50 rounded border border-slate-100 hover:border-blue-200 transition-all cursor-pointer group">
                  <div className="flex justify-between items-start">
                    <span className="font-medium text-slate-700 text-xs truncate w-2/3 group-hover:text-blue-600 transition-colors">
                      {alert.name}
                    </span>
                    <span className="text-[10px] bg-white border border-slate-200 text-slate-500 px-1.5 rounded shadow-sm">
                      {alert.platforms[0]?.substring(0, 4) || 'N/A'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {alert.keywords.slice(0, 2).map((k, i) => (
                      <span key={i} className="text-[10px] text-slate-400">{k}</span>
                    ))}
                    {alert.keywords.length > 2 && (
                      <span className="text-[10px] text-slate-400">+{alert.keywords.length - 2}</span>
                    )}
                  </div>
                </div>
              ))}
              {activeAlerts.length > 5 && (
                <p className="text-xs text-slate-400 text-center">+{activeAlerts.length - 5} more alerts</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
