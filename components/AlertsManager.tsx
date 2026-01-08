import React, { useState, useEffect } from 'react';
import { useAlertsStore } from '../stores/alertsStore';
import { CreateAlertData } from '../lib/api';
import { Bell, Trash2, Plus, Filter, Search, Pause, Play, Loader2, Zap, X } from 'lucide-react';

const PLATFORMS = ['eBay', 'Depop', 'Vinted', 'Facebook Marketplace', 'Gumtree', 'Shpock'];

export const AlertsManager: React.FC = () => {
  const {
    alerts,
    isLoading,
    error,
    runningAlertId,
    fetchAlerts,
    createAlert,
    deleteAlert,
    pauseAlert,
    resumeAlert,
    runAlert,
    clearError
  } = useAlertsStore();

  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [newAlert, setNewAlert] = useState<Partial<CreateAlertData>>({
    name: '',
    keywords: [],
    exclude_keywords: [],
    price_min: 0,
    price_max: 10000,
    platforms: [],
  });
  const [keywordInput, setKeywordInput] = useState('');
  const [excludeKeywordInput, setExcludeKeywordInput] = useState('');

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  useEffect(() => {
    if (error) {
      // Auto-clear error after 5 seconds
      const timer = setTimeout(() => clearError(), 5000);
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  const handlePlatformToggle = (platform: string) => {
    setNewAlert(prev => {
      const current = prev.platforms || [];
      if (current.includes(platform)) {
        return { ...prev, platforms: current.filter(p => p !== platform) };
      }
      return { ...prev, platforms: [...current, platform] };
    });
  };

  const handleCreateAlert = async () => {
    if (!newAlert.name || (newAlert.keywords?.length || 0) === 0 || (newAlert.platforms?.length || 0) === 0) {
      return;
    }

    const alertData: CreateAlertData = {
      name: newAlert.name!,
      keywords: newAlert.keywords!,
      platforms: newAlert.platforms!,
      price_min: newAlert.price_min,
      price_max: newAlert.price_max,
      exclude_keywords: newAlert.exclude_keywords,
    };

    const result = await createAlert(alertData);
    if (result) {
      setIsCreating(false);
      setNewAlert({
        name: '',
        keywords: [],
        exclude_keywords: [],
        price_min: 0,
        price_max: 10000,
        platforms: [],
      });
      setKeywordInput('');
      setExcludeKeywordInput('');
    }
  };

  const handleDeleteAlert = async (id: string) => {
    if (confirm('Are you sure you want to delete this alert?')) {
      await deleteAlert(id);
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    if (isActive) {
      await pauseAlert(id);
    } else {
      await resumeAlert(id);
    }
  };

  const handleAddKeyword = () => {
    if (keywordInput.trim()) {
      setNewAlert(prev => ({
        ...prev,
        keywords: [...(prev.keywords || []), keywordInput.trim()]
      }));
      setKeywordInput('');
    }
  };

  const handleRemoveKeyword = (keyword: string) => {
    setNewAlert(prev => ({
      ...prev,
      keywords: (prev.keywords || []).filter(k => k !== keyword)
    }));
  };

  const handleAddExcludeKeyword = () => {
    if (excludeKeywordInput.trim()) {
      setNewAlert(prev => ({
        ...prev,
        exclude_keywords: [...(prev.exclude_keywords || []), excludeKeywordInput.trim()]
      }));
      setExcludeKeywordInput('');
    }
  };

  const handleRemoveExcludeKeyword = (keyword: string) => {
    setNewAlert(prev => ({
      ...prev,
      exclude_keywords: (prev.exclude_keywords || []).filter(k => k !== keyword)
    }));
  };

  const filteredAlerts = alerts.filter(alert =>
    alert.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    alert.keywords.some(k => k.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-4 md:space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 md:px-4 py-3 rounded-lg flex justify-between items-center text-sm">
          <span className="truncate">{error}</span>
          <button onClick={clearError} className="text-red-500 hover:text-red-700 ml-2 flex-shrink-0">&times;</button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-800">Alerts Manager</h2>
          <p className="text-sm text-slate-500">Monitor marketplaces for deals in real-time.</p>
        </div>
        <button
          onClick={() => setIsCreating(!isCreating)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors text-sm md:text-base w-full sm:w-auto justify-center"
        >
          {isCreating ? 'Cancel' : <><Plus size={18} /> Create Alert</>}
        </button>
      </div>

      {isCreating && (
        <div className="bg-white p-4 md:p-6 rounded-xl shadow-lg border border-blue-100 animate-in fade-in slide-in-from-top-4 duration-300">
          <h3 className="font-semibold text-base md:text-lg mb-4 text-slate-800">New Search Monitor</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            <div className="space-y-3 md:space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Alert Name</label>
                <input
                  type="text"
                  value={newAlert.name}
                  onChange={(e) => setNewAlert({...newAlert, name: e.target.value})}
                  className="w-full px-3 md:px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm md:text-base"
                  placeholder="e.g. Vintage Nike Deals"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Keywords (include)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={keywordInput}
                    onChange={(e) => setKeywordInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddKeyword())}
                    className="flex-1 px-3 md:px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm md:text-base"
                    placeholder="Add a keyword"
                  />
                  <button
                    onClick={handleAddKeyword}
                    className="px-3 md:px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600 text-sm"
                  >
                    Add
                  </button>
                </div>
                {(newAlert.keywords?.length || 0) > 0 && (
                  <div className="flex flex-wrap gap-1.5 md:gap-2 mt-2">
                    {newAlert.keywords?.map((keyword, i) => (
                      <span key={i} className="bg-blue-100 text-blue-700 px-2 py-0.5 md:py-1 rounded-full text-xs md:text-sm flex items-center gap-1">
                        {keyword}
                        <button onClick={() => handleRemoveKeyword(keyword)} className="hover:text-blue-900">&times;</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Exclude Keywords</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={excludeKeywordInput}
                    onChange={(e) => setExcludeKeywordInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddExcludeKeyword())}
                    className="flex-1 px-3 md:px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm md:text-base"
                    placeholder="e.g. damaged, broken"
                  />
                  <button
                    onClick={handleAddExcludeKeyword}
                    className="px-3 md:px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600 text-sm"
                  >
                    Add
                  </button>
                </div>
                {(newAlert.exclude_keywords?.length || 0) > 0 && (
                  <div className="flex flex-wrap gap-1.5 md:gap-2 mt-2">
                    {newAlert.exclude_keywords?.map((keyword, i) => (
                      <span key={i} className="bg-red-100 text-red-700 px-2 py-0.5 md:py-1 rounded-full text-xs md:text-sm flex items-center gap-1">
                        <X size={12} />
                        {keyword}
                        <button onClick={() => handleRemoveExcludeKeyword(keyword)} className="hover:text-red-900">&times;</button>
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-xs text-slate-400 mt-1">Items containing these words will be filtered out</p>
              </div>
              <div className="grid grid-cols-2 gap-3 md:gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Min Price</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-slate-400 text-sm">£</span>
                    <input
                      type="number"
                      value={newAlert.price_min}
                      onChange={(e) => setNewAlert({...newAlert, price_min: Number(e.target.value)})}
                      className="w-full pl-7 md:pl-8 pr-3 md:pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm md:text-base"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Max Price</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-slate-400 text-sm">£</span>
                    <input
                      type="number"
                      value={newAlert.price_max}
                      onChange={(e) => setNewAlert({...newAlert, price_max: Number(e.target.value)})}
                      className="w-full pl-7 md:pl-8 pr-3 md:pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm md:text-base"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Platforms</label>
              <div className="grid grid-cols-2 gap-2">
                {PLATFORMS.map((p) => (
                  <button
                    key={p}
                    onClick={() => handlePlatformToggle(p)}
                    className={`px-2 md:px-3 py-2 rounded-lg text-xs md:text-sm text-left transition-colors flex items-center gap-2
                      ${newAlert.platforms?.includes(p)
                        ? 'bg-blue-50 border border-blue-200 text-blue-700 font-medium'
                        : 'bg-slate-50 border border-slate-100 text-slate-600 hover:bg-slate-100'}`}
                  >
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${newAlert.platforms?.includes(p) ? 'bg-blue-500' : 'bg-slate-300'}`} />
                    <span className="truncate">{p}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4 md:mt-6 flex flex-col-reverse sm:flex-row justify-end gap-3">
            <button
              onClick={() => setIsCreating(false)}
              className="px-6 py-2 rounded-lg text-slate-600 hover:bg-slate-50 font-medium text-sm md:text-base"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateAlert}
              disabled={isLoading}
              className="bg-slate-800 text-white px-6 py-2 rounded-lg hover:bg-slate-900 transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2 text-sm md:text-base"
            >
              {isLoading && <Loader2 size={16} className="animate-spin" />}
              Start Monitoring
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-3 md:p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row gap-2 sm:gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search your alerts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400"
            />
          </div>
          <button className="hidden sm:flex px-4 py-2 border border-slate-200 rounded-lg bg-white text-slate-600 text-sm hover:bg-slate-50 items-center gap-2">
            <Filter className="w-4 h-4" /> Filter
          </button>
        </div>

        {isLoading && alerts.length === 0 ? (
          <div className="p-6 md:p-8 text-center text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
            Loading alerts...
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="p-6 md:p-8 text-center text-slate-500 text-sm">
            {alerts.length === 0 ? 'No alerts yet. Create your first alert to start monitoring!' : 'No alerts match your search.'}
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <table className="hidden lg:table w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">Keywords</th>
                  <th className="px-6 py-4">Price Range</th>
                  <th className="px-6 py-4">Platforms</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAlerts.map(alertItem => (
                  <tr key={alertItem.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-semibold text-slate-800">{alertItem.name}</td>
                    <td className="px-6 py-4 text-slate-600">
                      <div className="flex flex-wrap gap-1">
                        {alertItem.keywords.slice(0, 3).map((k, i) => (
                          <span key={i} className="bg-slate-100 px-2 py-0.5 rounded text-xs">{k}</span>
                        ))}
                        {alertItem.keywords.length > 3 && (
                          <span className="text-slate-400 text-xs">+{alertItem.keywords.length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      £{alertItem.price_min || 0} - £{alertItem.price_max || '∞'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex -space-x-2">
                        {alertItem.platforms.slice(0, 3).map((p, i) => (
                          <div key={i} title={p} className="w-6 h-6 rounded-full bg-blue-100 border border-white flex items-center justify-center text-[10px] text-blue-700 font-bold uppercase">
                            {p[0]}
                          </div>
                        ))}
                        {alertItem.platforms.length > 3 && (
                          <div className="w-6 h-6 rounded-full bg-slate-100 border border-white flex items-center justify-center text-[10px] text-slate-600 font-bold">
                            +{alertItem.platforms.length - 3}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`flex items-center gap-1.5 ${alertItem.is_active ? 'text-green-600' : 'text-slate-400'}`}>
                        <span className={`w-2 h-2 rounded-full ${alertItem.is_active ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`} />
                        {alertItem.is_active ? 'Active' : 'Paused'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={async () => {
                            const result = await runAlert(alertItem.id);
                            if (result.success) {
                              window.alert(`Found ${result.resultsFound || 0} new items!`);
                            }
                          }}
                          disabled={runningAlertId === alertItem.id}
                          className="text-slate-400 hover:text-yellow-500 transition-colors disabled:opacity-50"
                          title="Run scraper now"
                        >
                          {runningAlertId === alertItem.id ? (
                            <Loader2 size={18} className="animate-spin" />
                          ) : (
                            <Zap size={18} />
                          )}
                        </button>
                        <button
                          onClick={() => handleToggleActive(alertItem.id, alertItem.is_active)}
                          className="text-slate-400 hover:text-blue-500 transition-colors"
                          title={alertItem.is_active ? 'Pause alert' : 'Resume alert'}
                        >
                          {alertItem.is_active ? <Pause size={18} /> : <Play size={18} />}
                        </button>
                        <button
                          onClick={() => handleDeleteAlert(alertItem.id)}
                          className="text-slate-400 hover:text-red-500 transition-colors"
                          title="Delete alert"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile Card List */}
            <div className="lg:hidden divide-y divide-slate-100">
              {filteredAlerts.map(alertItem => (
                <div key={alertItem.id} className="p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0 flex-1">
                      <h4 className="font-semibold text-slate-800 text-sm truncate">{alertItem.name}</h4>
                      <span className={`inline-flex items-center gap-1 text-xs mt-1 ${alertItem.is_active ? 'text-green-600' : 'text-slate-400'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${alertItem.is_active ? 'bg-green-500' : 'bg-slate-300'}`} />
                        {alertItem.is_active ? 'Active' : 'Paused'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={async () => {
                          const result = await runAlert(alertItem.id);
                          if (result.success) {
                            window.alert(`Found ${result.resultsFound || 0} new items!`);
                          }
                        }}
                        disabled={runningAlertId === alertItem.id}
                        className="p-1.5 text-slate-400 hover:text-yellow-500 transition-colors disabled:opacity-50"
                      >
                        {runningAlertId === alertItem.id ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Zap size={16} />
                        )}
                      </button>
                      <button
                        onClick={() => handleToggleActive(alertItem.id, alertItem.is_active)}
                        className="p-1.5 text-slate-400 hover:text-blue-500 transition-colors"
                      >
                        {alertItem.is_active ? <Pause size={16} /> : <Play size={16} />}
                      </button>
                      <button
                        onClick={() => handleDeleteAlert(alertItem.id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {alertItem.keywords.slice(0, 3).map((k, i) => (
                      <span key={i} className="bg-slate-100 px-2 py-0.5 rounded text-xs text-slate-600">{k}</span>
                    ))}
                    {alertItem.keywords.length > 3 && (
                      <span className="text-slate-400 text-xs">+{alertItem.keywords.length - 3}</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>£{alertItem.price_min || 0} - £{alertItem.price_max || '∞'}</span>
                    <div className="flex -space-x-1.5">
                      {alertItem.platforms.slice(0, 3).map((p, i) => (
                        <div key={i} className="w-5 h-5 rounded-full bg-blue-100 border border-white flex items-center justify-center text-[9px] text-blue-700 font-bold uppercase">
                          {p[0]}
                        </div>
                      ))}
                      {alertItem.platforms.length > 3 && (
                        <div className="w-5 h-5 rounded-full bg-slate-100 border border-white flex items-center justify-center text-[9px] text-slate-600 font-bold">
                          +{alertItem.platforms.length - 3}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
