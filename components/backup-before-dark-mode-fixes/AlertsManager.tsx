import React, { useState, useEffect } from 'react';
import { useAlertsStore } from '../stores/alertsStore';
import { CreateAlertData } from '../lib/api';
import { Bell, Trash2, Plus, Filter, Search, Pause, Play, Loader2, Zap, X, Radar } from 'lucide-react';
import { Card, Button, Badge, Input, Select } from './ui/UIComponents';

const PLATFORMS = ['eBay', 'Depop', 'Vinted', 'Facebook Marketplace', 'Gumtree', 'Shpock'];

const formatFrequency = (minutes: number): string => {
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) {
    const hours = Math.floor(minutes / 60);
    return `${hours}h`;
  }
  const days = Math.floor(minutes / 1440);
  return `${days}d`;
};

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
    check_frequency_minutes: 5,
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
      check_frequency_minutes: newAlert.check_frequency_minutes || 5,
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
    <div className="space-y-6 md:space-y-8">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-400 px-4 py-3 rounded-xl flex justify-between items-center text-sm shadow-sm">
          <span className="truncate">{error}</span>
          <button onClick={clearError} className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 ml-2 flex-shrink-0 text-xl">&times;</button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Smart Alerts</h2>
          <p className="text-sm text-slate-600 dark:text-neutral-400 mt-1">Monitor marketplaces for deals in real-time.</p>
        </div>
        <Button
          onClick={() => setIsCreating(!isCreating)}
          variant={isCreating ? "secondary" : "primary"}
          className="w-full sm:w-auto"
        >
          {isCreating ? (
            <>
              <X size={18} /> Cancel
            </>
          ) : (
            <>
              <Plus size={18} /> Create Alert
            </>
          )}
        </Button>
      </div>

      {isCreating && (
        <Card className="border-l-4 border-l-violet-500 dark:border-l-violet-400 shadow-lg animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-500/20 flex items-center justify-center">
              <Radar className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            </div>
            <h3 className="font-bold text-lg md:text-xl text-slate-900 dark:text-white">New Search Monitor</h3>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            <div className="space-y-3 md:space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-2">Alert Name</label>
                <Input
                  type="text"
                  value={newAlert.name}
                  onChange={(e) => setNewAlert({...newAlert, name: e.target.value})}
                  placeholder="e.g. Vintage Nike Deals"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-2">Keywords (include)</label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={keywordInput}
                    onChange={(e) => setKeywordInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddKeyword())}
                    placeholder="Add a keyword"
                    className="flex-1"
                  />
                  <Button
                    onClick={handleAddKeyword}
                    variant="secondary"
                    className="px-4"
                  >
                    Add
                  </Button>
                </div>
                {(newAlert.keywords?.length || 0) > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {newAlert.keywords?.map((keyword, i) => (
                      <Badge key={i} variant="violet" className="flex items-center gap-1.5">
                        {keyword}
                        <button onClick={() => handleRemoveKeyword(keyword)} className="hover:text-violet-900 dark:hover:text-violet-200 ml-1">&times;</button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-2">Exclude Keywords</label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={excludeKeywordInput}
                    onChange={(e) => setExcludeKeywordInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddExcludeKeyword())}
                    placeholder="e.g. damaged, broken"
                    className="flex-1"
                  />
                  <Button
                    onClick={handleAddExcludeKeyword}
                    variant="secondary"
                    className="px-4"
                  >
                    Add
                  </Button>
                </div>
                {(newAlert.exclude_keywords?.length || 0) > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {newAlert.exclude_keywords?.map((keyword, i) => (
                      <Badge key={i} variant="error" className="flex items-center gap-1.5">
                        <X size={12} />
                        {keyword}
                        <button onClick={() => handleRemoveExcludeKeyword(keyword)} className="hover:text-red-900 dark:hover:text-red-200 ml-1">&times;</button>
                      </Badge>
                    ))}
                  </div>
                )}
                <p className="text-xs text-slate-500 dark:text-neutral-500 mt-2">Items containing these words will be filtered out</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-2">Min Price</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-neutral-500 text-sm">£</span>
                    <Input
                      type="number"
                      value={newAlert.price_min}
                      onChange={(e) => setNewAlert({...newAlert, price_min: Number(e.target.value)})}
                      className="pl-7"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-2">Max Price</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-neutral-500 text-sm">£</span>
                    <Input
                      type="number"
                      value={newAlert.price_max}
                      onChange={(e) => setNewAlert({...newAlert, price_max: Number(e.target.value)})}
                      className="pl-7"
                    />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-2">Check Frequency</label>
                <Select
                  value={newAlert.check_frequency_minutes || 5}
                  onChange={(e) => setNewAlert({...newAlert, check_frequency_minutes: Number(e.target.value)})}
                >
                  <option value="5">Every 5 minutes</option>
                  <option value="10">Every 10 minutes</option>
                  <option value="15">Every 15 minutes</option>
                  <option value="30">Every 30 minutes</option>
                  <option value="60">Every hour</option>
                  <option value="120">Every 2 hours</option>
                  <option value="180">Every 3 hours</option>
                  <option value="360">Every 6 hours</option>
                  <option value="720">Every 12 hours</option>
                  <option value="1440">Once a day</option>
                </Select>
                <p className="text-xs text-slate-500 dark:text-neutral-500 mt-2">How often this alert checks for new items</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-3">Platforms</label>
              <div className="grid grid-cols-2 gap-2">
                {PLATFORMS.map((p) => (
                  <button
                    key={p}
                    onClick={() => handlePlatformToggle(p)}
                    className={`px-3 py-2.5 rounded-xl text-sm text-left transition-all duration-200 flex items-center gap-2
                      ${newAlert.platforms?.includes(p)
                        ? 'bg-violet-50 dark:bg-violet-500/20 border-2 border-violet-500 dark:border-violet-400 text-violet-700 dark:text-violet-300 font-semibold shadow-sm'
                        : 'bg-slate-50 dark:bg-neutral-800 border-2 border-slate-200 dark:border-neutral-700 text-slate-600 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-700'}`}
                  >
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${newAlert.platforms?.includes(p) ? 'bg-violet-500 dark:bg-violet-400' : 'bg-slate-300 dark:bg-neutral-600'}`} />
                    <span className="truncate">{p}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-6 flex flex-col-reverse sm:flex-row justify-end gap-3">
            <Button
              onClick={() => setIsCreating(false)}
              variant="ghost"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateAlert}
              disabled={isLoading}
              variant="primary"
              isLoading={isLoading}
            >
              <Radar className="w-4 h-4" />
              Start Monitoring
            </Button>
          </div>
        </Card>
      )}

      <Card className="p-0 overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-white/5 bg-slate-50/50 dark:bg-neutral-900/50 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-neutral-500 w-4 h-4" />
            <input
              type="text"
              placeholder="Search your alerts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/50 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-neutral-500"
            />
          </div>
          <button className="hidden sm:flex px-4 py-2 border border-slate-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-slate-600 dark:text-neutral-400 text-sm hover:bg-slate-50 dark:hover:bg-neutral-700 items-center gap-2 transition-colors">
            <Filter className="w-4 h-4" /> Filter
          </button>
        </div>

        {isLoading && alerts.length === 0 ? (
          <div className="p-8 text-center text-slate-500 dark:text-neutral-500">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-violet-600 dark:text-violet-400" />
            Loading alerts...
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="p-8 text-center text-slate-500 dark:text-neutral-500 text-sm">
            {alerts.length === 0 ? 'No alerts yet. Create your first alert to start monitoring!' : 'No alerts match your search.'}
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <table className="hidden lg:table w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-neutral-900/50 text-slate-600 dark:text-neutral-400 font-medium border-b border-slate-200 dark:border-white/5">
                <tr>
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">Keywords</th>
                  <th className="px-6 py-4">Price Range</th>
                  <th className="px-6 py-4">Platforms</th>
                  <th className="px-6 py-4">Frequency</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {filteredAlerts.map(alertItem => (
                  <tr key={alertItem.id} className={`hover:bg-slate-50 dark:hover:bg-white/5 transition-colors ${alertItem.is_active ? 'border-l-4 border-l-violet-500 dark:border-l-violet-400' : ''}`}>
                    <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">{alertItem.name}</td>
                    <td className="px-6 py-4 text-slate-600 dark:text-neutral-400">
                      <div className="flex flex-wrap gap-1.5">
                        {alertItem.keywords.slice(0, 3).map((k, i) => (
                          <Badge key={i} variant="neutral" className="text-xs">{k}</Badge>
                        ))}
                        {alertItem.keywords.length > 3 && (
                          <span className="text-slate-400 dark:text-neutral-500 text-xs">+{alertItem.keywords.length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-neutral-400 font-medium">
                      £{alertItem.price_min || 0} - £{alertItem.price_max || '∞'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex -space-x-2">
                        {alertItem.platforms.slice(0, 3).map((p, i) => (
                          <div key={i} title={p} className="w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-500/20 border-2 border-white dark:border-neutral-900 flex items-center justify-center text-[10px] text-violet-700 dark:text-violet-400 font-bold uppercase">
                            {p[0]}
                          </div>
                        ))}
                        {alertItem.platforms.length > 3 && (
                          <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-neutral-800 border-2 border-white dark:border-neutral-900 flex items-center justify-center text-[10px] text-slate-600 dark:text-neutral-400 font-bold">
                            +{alertItem.platforms.length - 3}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 rounded-md text-xs font-medium">
                        <Radar size={12} />
                        Every {formatFrequency(alertItem.check_frequency_minutes)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`flex items-center gap-1.5 font-medium ${alertItem.is_active ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-neutral-500'}`}>
                        <span className={`w-2 h-2 rounded-full ${alertItem.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300 dark:bg-neutral-600'}`} />
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
                          className="p-2 text-slate-400 dark:text-neutral-500 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-500/10 rounded-lg transition-all disabled:opacity-50"
                          title="Run scraper now"
                        >
                          {runningAlertId === alertItem.id ? (
                            <Loader2 size={18} className="animate-spin" />
                          ) : (
                            <Zap size={18} className="fill-current" />
                          )}
                        </button>
                        <button
                          onClick={() => handleToggleActive(alertItem.id, alertItem.is_active)}
                          className="p-2 text-slate-400 dark:text-neutral-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition-all"
                          title={alertItem.is_active ? 'Pause alert' : 'Resume alert'}
                        >
                          {alertItem.is_active ? <Pause size={18} /> : <Play size={18} />}
                        </button>
                        <button
                          onClick={() => handleDeleteAlert(alertItem.id)}
                          className="p-2 text-slate-400 dark:text-neutral-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all"
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
            <div className="lg:hidden divide-y divide-slate-100 dark:divide-white/5">
              {filteredAlerts.map(alertItem => (
                <div key={alertItem.id} className={`p-4 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors ${alertItem.is_active ? 'border-l-4 border-l-violet-500 dark:border-l-violet-400' : ''}`}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0 flex-1">
                      <h4 className="font-semibold text-slate-900 dark:text-white text-sm truncate">{alertItem.name}</h4>
                      <span className={`inline-flex items-center gap-1 text-xs mt-1 font-medium ${alertItem.is_active ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-neutral-500'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${alertItem.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300 dark:bg-neutral-600'}`} />
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
                        className="p-1.5 text-slate-400 dark:text-neutral-500 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-500/10 rounded-lg transition-all disabled:opacity-50"
                      >
                        {runningAlertId === alertItem.id ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Zap size={16} className="fill-current" />
                        )}
                      </button>
                      <button
                        onClick={() => handleToggleActive(alertItem.id, alertItem.is_active)}
                        className="p-1.5 text-slate-400 dark:text-neutral-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition-all"
                      >
                        {alertItem.is_active ? <Pause size={16} /> : <Play size={16} />}
                      </button>
                      <button
                        onClick={() => handleDeleteAlert(alertItem.id)}
                        className="p-1.5 text-slate-400 dark:text-neutral-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {alertItem.keywords.slice(0, 3).map((k, i) => (
                      <Badge key={i} variant="neutral" className="text-xs">{k}</Badge>
                    ))}
                    {alertItem.keywords.length > 3 && (
                      <span className="text-slate-400 dark:text-neutral-500 text-xs">+{alertItem.keywords.length - 3}</span>
                    )}
                  </div>
                  <div className="mb-2">
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 rounded-md text-xs font-medium">
                      <Radar size={10} />
                      Every {formatFrequency(alertItem.check_frequency_minutes)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-600 dark:text-neutral-400 font-medium">
                    <span>£{alertItem.price_min || 0} - £{alertItem.price_max || '∞'}</span>
                    <div className="flex -space-x-1.5">
                      {alertItem.platforms.slice(0, 3).map((p, i) => (
                        <div key={i} className="w-5 h-5 rounded-full bg-violet-100 dark:bg-violet-500/20 border border-white dark:border-neutral-900 flex items-center justify-center text-[9px] text-violet-700 dark:text-violet-400 font-bold uppercase">
                          {p[0]}
                        </div>
                      ))}
                      {alertItem.platforms.length > 3 && (
                        <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-neutral-800 border border-white dark:border-neutral-900 flex items-center justify-center text-[9px] text-slate-600 dark:text-neutral-400 font-bold">
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
      </Card>
    </div>
  );
};
