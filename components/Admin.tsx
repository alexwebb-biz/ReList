import { useState, useEffect } from 'react';

const API_URL = import.meta.env.DEV ? 'http://localhost:3001/api' : '/api';

interface User {
  id: string;
  email: string;
  full_name: string | null;
  subscription_tier: string | null;
  subscription_status: string | null;
  created_at: string;
  last_login_at: string | null;
  alert_count: number;
  results_count: number;
}

interface Alert {
  id: string;
  name: string;
  marketplace: string;
  search_query: string;
  price_min: number | null;
  price_max: number | null;
  is_active: boolean;
  check_interval: number;
  created_at: string;
  last_checked_at: string | null;
  results_count: number;
}

interface Stats {
  totalUsers: number;
  activeSubscriptions: number;
  totalAlerts: number;
  activeAlerts: number;
  totalResults: number;
  subscriptionTiers: Record<string, number>;
}

export default function Admin() {
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [userAlerts, setUserAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');

      // Fetch stats
      const statsRes = await fetch(`${API_URL}/admin/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      // Fetch users
      const usersRes = await fetch(`${API_URL}/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!usersRes.ok) {
        if (usersRes.status === 403) {
          throw new Error('Access denied. Admin privileges required.');
        }
        throw new Error('Failed to fetch users');
      }

      const usersData = await usersRes.json();
      setUsers(usersData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserAlerts = async (userId: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/admin/users/${userId}/alerts`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setUserAlerts(data);
        setSelectedUser(userId);
      }
    } catch (err) {
      console.error('Failed to fetch user alerts:', err);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <p className="text-slate-600 dark:text-neutral-400">Loading admin panel...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-300">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <div className="bg-white dark:bg-neutral-900/80 rounded-lg shadow dark:shadow-neutral-800/50 p-6">
            <h3 className="text-sm font-medium text-slate-500 dark:text-neutral-400">Total Users</h3>
            <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">{stats.totalUsers}</p>
          </div>
          <div className="bg-white dark:bg-neutral-900/80 rounded-lg shadow dark:shadow-neutral-800/50 p-6">
            <h3 className="text-sm font-medium text-slate-500 dark:text-neutral-400">Active Subscriptions</h3>
            <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-2">{stats.activeSubscriptions}</p>
          </div>
          <div className="bg-white dark:bg-neutral-900/80 rounded-lg shadow dark:shadow-neutral-800/50 p-6">
            <h3 className="text-sm font-medium text-slate-500 dark:text-neutral-400">Total Alerts</h3>
            <p className="text-3xl font-bold text-violet-600 dark:text-violet-400 mt-2">{stats.totalAlerts}</p>
          </div>
          <div className="bg-white dark:bg-neutral-900/80 rounded-lg shadow dark:shadow-neutral-800/50 p-6">
            <h3 className="text-sm font-medium text-slate-500 dark:text-neutral-400">Active Alerts</h3>
            <p className="text-3xl font-bold text-purple-600 dark:text-purple-400 mt-2">{stats.activeAlerts}</p>
          </div>
          <div className="bg-white dark:bg-neutral-900/80 rounded-lg shadow dark:shadow-neutral-800/50 p-6">
            <h3 className="text-sm font-medium text-slate-500 dark:text-neutral-400">Total Results</h3>
            <p className="text-3xl font-bold text-orange-600 dark:text-orange-400 mt-2">{stats.totalResults}</p>
          </div>
        </div>
      )}

      {/* Subscription Tiers */}
      {stats && Object.keys(stats.subscriptionTiers).length > 0 && (
        <div className="bg-white dark:bg-neutral-900/80 rounded-lg shadow dark:shadow-neutral-800/50 p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Subscription Breakdown</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(stats.subscriptionTiers).map(([tier, count]) => (
              <div key={tier} className="text-center">
                <p className="text-sm text-slate-500 dark:text-neutral-400 capitalize">{tier}</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{count}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Users Section */}
      <div className="bg-white dark:bg-neutral-900/80 rounded-lg shadow dark:shadow-neutral-800/50 overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-neutral-700">
          <h2 className="text-xl font-semibold">All Users ({users.length})</h2>
        </div>

        {/* Mobile Card View */}
        <div className="block md:hidden p-4 space-y-4">
          {users.map((user) => (
            <div key={user.id} className="bg-slate-50 dark:bg-neutral-800/50 rounded-lg p-4 border border-slate-200 dark:border-neutral-700">
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <p className="font-medium text-slate-900 dark:text-white">{user.email}</p>
                  <p className="text-sm text-slate-600 dark:text-neutral-400">{user.full_name || 'No name'}</p>
                </div>
                <button
                  onClick={() => fetchUserAlerts(user.id)}
                  className="text-violet-600 dark:text-violet-400 hover:text-violet-800 dark:hover:text-violet-300 font-medium text-sm"
                >
                  View Alerts
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <p className="text-xs text-slate-500 dark:text-neutral-400">Subscription</p>
                  <span className={`inline-block mt-1 px-2 py-1 rounded-full text-xs font-medium ${
                    user.subscription_tier === 'business' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300' :
                    user.subscription_tier === 'pro' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300' :
                    user.subscription_tier === 'starter' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' :
                    'bg-slate-100 dark:bg-neutral-700 text-slate-800 dark:text-neutral-300'
                  }`}>
                    {user.subscription_tier || 'free'}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-neutral-400">Status</p>
                  <span className={`inline-block mt-1 px-2 py-1 rounded-full text-xs font-medium ${
                    user.subscription_status === 'active' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' :
                    user.subscription_status === 'canceled' ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300' :
                    'bg-slate-100 dark:bg-neutral-700 text-slate-800 dark:text-neutral-300'
                  }`}>
                    {user.subscription_status || 'none'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-slate-500 dark:text-neutral-400">Alerts</p>
                  <p className="font-medium text-slate-900 dark:text-white">{user.alert_count}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-neutral-400">Results</p>
                  <p className="font-medium text-slate-900 dark:text-white">{user.results_count}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-neutral-400">Created</p>
                  <p className="font-medium text-slate-900 dark:text-white">{new Date(user.created_at).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-neutral-400">Last Login</p>
                  <p className="font-medium text-slate-900 dark:text-white">{user.last_login_at ? new Date(user.last_login_at).toLocaleDateString() : 'Never'}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-neutral-700">
            <thead className="bg-slate-50 dark:bg-neutral-800/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-neutral-400 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-neutral-400 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-neutral-400 uppercase">Subscription</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-neutral-400 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-neutral-400 uppercase">Alerts</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-neutral-400 uppercase">Results</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-neutral-400 uppercase">Created</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-neutral-400 uppercase">Last Login</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-neutral-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-neutral-900/80 divide-y divide-slate-200 dark:divide-neutral-700">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-neutral-800/50">
                  <td className="px-6 py-4 text-sm text-slate-900 dark:text-white">{user.email}</td>
                  <td className="px-6 py-4 text-sm text-slate-900 dark:text-white">{user.full_name || '-'}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      user.subscription_tier === 'business' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300' :
                      user.subscription_tier === 'pro' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300' :
                      user.subscription_tier === 'starter' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' :
                      'bg-slate-100 dark:bg-neutral-700 text-slate-800 dark:text-neutral-300'
                    }`}>
                      {user.subscription_tier || 'free'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      user.subscription_status === 'active' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' :
                      user.subscription_status === 'canceled' ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300' :
                      'bg-slate-100 dark:bg-neutral-700 text-slate-800 dark:text-neutral-300'
                    }`}>
                      {user.subscription_status || 'none'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-900 dark:text-white">{user.alert_count}</td>
                  <td className="px-6 py-4 text-sm text-slate-900 dark:text-white">{user.results_count}</td>
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-neutral-400">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-neutral-400">
                    {user.last_login_at ? new Date(user.last_login_at).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <button
                      onClick={() => fetchUserAlerts(user.id)}
                      className="text-violet-600 dark:text-violet-400 hover:text-violet-800 dark:hover:text-violet-300 font-medium"
                    >
                      View Alerts
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Alerts Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-black dark:bg-opacity-70 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-neutral-900 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-xl dark:shadow-2xl border border-slate-200 dark:border-neutral-700">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-neutral-700 flex justify-between items-center">
              <h2 className="text-xl font-semibold">
                User Alerts ({userAlerts.length})
              </h2>
              <button
                onClick={() => {
                  setSelectedUser(null);
                  setUserAlerts([]);
                }}
                className="text-slate-400 dark:text-neutral-500 hover:text-slate-600 dark:hover:text-neutral-300"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
              {userAlerts.length === 0 ? (
                <p className="text-slate-500 dark:text-neutral-400 text-center py-8">No alerts found for this user.</p>
              ) : (
                <div className="space-y-4">
                  {userAlerts.map((alert) => (
                    <div key={alert.id} className="border border-slate-200 dark:border-neutral-700 rounded-lg p-4 bg-slate-50 dark:bg-neutral-800/50">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold text-lg text-slate-900 dark:text-white">{alert.name}</h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          alert.is_active ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' : 'bg-slate-100 dark:bg-neutral-700 text-slate-800 dark:text-neutral-300'
                        }`}>
                          {alert.is_active ? 'Active' : 'Paused'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-slate-500 dark:text-neutral-400">Marketplace:</span>
                          <span className="ml-2 font-medium text-slate-900 dark:text-white capitalize">{alert.marketplace}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 dark:text-neutral-400">Query:</span>
                          <span className="ml-2 font-medium text-slate-900 dark:text-white">{alert.search_query}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 dark:text-neutral-400">Price Range:</span>
                          <span className="ml-2 font-medium text-slate-900 dark:text-white">
                            {alert.price_min && alert.price_max
                              ? `£${alert.price_min} - £${alert.price_max}`
                              : alert.price_min
                              ? `From £${alert.price_min}`
                              : alert.price_max
                              ? `Up to £${alert.price_max}`
                              : 'Any'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 dark:text-neutral-400">Results Found:</span>
                          <span className="ml-2 font-medium text-slate-900 dark:text-white">{alert.results_count}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 dark:text-neutral-400">Check Interval:</span>
                          <span className="ml-2 font-medium text-slate-900 dark:text-white">{alert.check_interval} min</span>
                        </div>
                        <div>
                          <span className="text-slate-500 dark:text-neutral-400">Last Checked:</span>
                          <span className="ml-2 font-medium text-slate-900 dark:text-white">
                            {alert.last_checked_at
                              ? new Date(alert.last_checked_at).toLocaleString()
                              : 'Never'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
