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
        <p className="text-gray-600">Loading admin panel...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
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
          <div className="bg-white dark:bg-neutral-900/80 rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Total Users</h3>
            <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalUsers}</p>
          </div>
          <div className="bg-white dark:bg-neutral-900/80 rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Active Subscriptions</h3>
            <p className="text-3xl font-bold text-green-600 mt-2">{stats.activeSubscriptions}</p>
          </div>
          <div className="bg-white dark:bg-neutral-900/80 rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Total Alerts</h3>
            <p className="text-3xl font-bold text-violet-600 dark:text-violet-400 mt-2">{stats.totalAlerts}</p>
          </div>
          <div className="bg-white dark:bg-neutral-900/80 rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Active Alerts</h3>
            <p className="text-3xl font-bold text-purple-600 mt-2">{stats.activeAlerts}</p>
          </div>
          <div className="bg-white dark:bg-neutral-900/80 rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Total Results</h3>
            <p className="text-3xl font-bold text-orange-600 mt-2">{stats.totalResults}</p>
          </div>
        </div>
      )}

      {/* Subscription Tiers */}
      {stats && Object.keys(stats.subscriptionTiers).length > 0 && (
        <div className="bg-white dark:bg-neutral-900/80 rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Subscription Breakdown</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(stats.subscriptionTiers).map(([tier, count]) => (
              <div key={tier} className="text-center">
                <p className="text-sm text-gray-500 capitalize">{tier}</p>
                <p className="text-2xl font-bold text-gray-900">{count}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white dark:bg-neutral-900/80 rounded-lg shadow overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold">All Users ({users.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subscription</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Alerts</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Results</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Login</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">{user.email}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{user.full_name || '-'}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      user.subscription_tier === 'business' ? 'bg-purple-100 text-purple-800' :
                      user.subscription_tier === 'pro' ? 'bg-blue-100 text-blue-800' :
                      user.subscription_tier === 'starter' ? 'bg-green-100 text-green-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {user.subscription_tier || 'free'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      user.subscription_status === 'active' ? 'bg-green-100 text-green-800' :
                      user.subscription_status === 'canceled' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {user.subscription_status || 'none'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{user.alert_count}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{user.results_count}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {user.last_login_at ? new Date(user.last_login_at).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <button
                      onClick={() => fetchUserAlerts(user.id)}
                      className="text-violet-600 dark:text-violet-400 hover:text-blue-800 font-medium"
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-neutral-900/80 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-semibold">
                User Alerts ({userAlerts.length})
              </h2>
              <button
                onClick={() => {
                  setSelectedUser(null);
                  setUserAlerts([]);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
              {userAlerts.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No alerts found for this user.</p>
              ) : (
                <div className="space-y-4">
                  {userAlerts.map((alert) => (
                    <div key={alert.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold text-lg">{alert.name}</h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          alert.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {alert.is_active ? 'Active' : 'Paused'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Marketplace:</span>
                          <span className="ml-2 font-medium capitalize">{alert.marketplace}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Query:</span>
                          <span className="ml-2 font-medium">{alert.search_query}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Price Range:</span>
                          <span className="ml-2 font-medium">
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
                          <span className="text-gray-500">Results Found:</span>
                          <span className="ml-2 font-medium">{alert.results_count}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Check Interval:</span>
                          <span className="ml-2 font-medium">{alert.check_interval} min</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Last Checked:</span>
                          <span className="ml-2 font-medium">
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
