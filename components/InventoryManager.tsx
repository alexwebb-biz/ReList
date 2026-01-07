import React, { useState, useEffect } from 'react';
import { useInventoryStore } from '../stores/inventoryStore';
import { CreateInventoryData, InventoryItem } from '../lib/api';
import { Plus, Wand2, Tag, Upload, MoreHorizontal, Trash2, DollarSign, Loader2, Edit2 } from 'lucide-react';
import { generateItemDescription, estimatePrice } from '../services/geminiService';

const PLATFORMS = ['eBay', 'Depop', 'Vinted', 'Facebook Marketplace', 'Gumtree', 'Shpock'];
const CONDITIONS = ['New with tags', 'Like New', 'Good', 'Fair', 'Poor'];
const STATUSES = ['draft', 'listed', 'sold'];

export const InventoryManager: React.FC = () => {
  const {
    items,
    stats,
    isLoading,
    error,
    fetchInventory,
    fetchStats,
    createItem,
    updateItem,
    deleteItem,
    markAsSold,
    clearError
  } = useInventoryStore();

  const [isAdding, setIsAdding] = useState(false);
  const [loadingAI, setLoadingAI] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [sellModalItem, setSellModalItem] = useState<InventoryItem | null>(null);
  const [sellData, setSellData] = useState({
    sold_price: 0,
    sold_platform: '',
    fees_total: 0,
    postage_cost: 0
  });

  const [newItem, setNewItem] = useState<CreateInventoryData & { tags: string }>({
    title: '',
    description: '',
    selling_price: undefined,
    purchase_price: undefined,
    purchase_platform: '',
    condition: 'Good',
    tags: ''
  });

  useEffect(() => {
    fetchInventory(statusFilter || undefined);
    fetchStats();
  }, [fetchInventory, fetchStats, statusFilter]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => clearError(), 5000);
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  const handleAIHelp = async () => {
    if (!newItem.title) {
      alert("Please enter a title first!");
      return;
    }
    setLoadingAI(true);

    try {
      const [desc, estPrice] = await Promise.all([
        generateItemDescription(newItem.title, newItem.condition || 'Good', newItem.tags.split(',')),
        estimatePrice(newItem.title, newItem.purchase_platform || 'eBay')
      ]);

      setNewItem(prev => ({
        ...prev,
        description: desc,
        selling_price: estPrice !== "Unknown" && !prev.selling_price
          ? parseFloat(estPrice.replace(/[^0-9.]/g, ''))
          : prev.selling_price
      }));
    } catch (err) {
      console.error('AI generation failed:', err);
    }

    setLoadingAI(false);
  };

  const addItem = async () => {
    if (!newItem.title) return;

    const itemData: CreateInventoryData = {
      title: newItem.title,
      description: newItem.description,
      condition: newItem.condition,
      purchase_price: newItem.purchase_price,
      purchase_platform: newItem.purchase_platform,
      selling_price: newItem.selling_price,
      notes: newItem.tags
    };

    const result = await createItem(itemData);
    if (result) {
      setIsAdding(false);
      setNewItem({
        title: '',
        description: '',
        selling_price: undefined,
        purchase_price: undefined,
        purchase_platform: '',
        condition: 'Good',
        tags: ''
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this item?')) {
      await deleteItem(id);
    }
  };

  const handleMarkAsSold = async () => {
    if (!sellModalItem || !sellData.sold_price) return;

    const result = await markAsSold(sellModalItem.id, {
      sold_price: sellData.sold_price,
      sold_platform: sellData.sold_platform || undefined,
      fees_total: sellData.fees_total || undefined,
      postage_cost: sellData.postage_cost || undefined
    });

    if (result) {
      setSellModalItem(null);
      setSellData({ sold_price: 0, sold_platform: '', fees_total: 0, postage_cost: 0 });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-slate-100 text-slate-600';
      case 'listed': return 'bg-blue-100 text-blue-700';
      case 'sold': return 'bg-emerald-100 text-emerald-700';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex justify-between items-center">
          <span>{error}</span>
          <button onClick={clearError} className="text-red-500 hover:text-red-700">&times;</button>
        </div>
      )}

      {/* Stats Row */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <div className="bg-white p-3 md:p-4 rounded-xl border border-slate-200">
            <p className="text-xs md:text-sm text-slate-500">Total Items</p>
            <p className="text-xl md:text-2xl font-bold text-slate-800">{stats.total_items}</p>
          </div>
          <div className="bg-white p-3 md:p-4 rounded-xl border border-slate-200">
            <p className="text-xs md:text-sm text-slate-500">Listed</p>
            <p className="text-xl md:text-2xl font-bold text-blue-600">{stats.listed_count}</p>
          </div>
          <div className="bg-white p-3 md:p-4 rounded-xl border border-slate-200">
            <p className="text-xs md:text-sm text-slate-500">Sold</p>
            <p className="text-xl md:text-2xl font-bold text-emerald-600">{stats.sold_count}</p>
          </div>
          <div className="bg-white p-3 md:p-4 rounded-xl border border-slate-200">
            <p className="text-xs md:text-sm text-slate-500">Total Profit</p>
            <p className="text-xl md:text-2xl font-bold text-emerald-600">£{stats.total_profit.toFixed(2)}</p>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-800">Inventory</h2>
          <p className="text-sm text-slate-500">Track listings, costs, and profit margins.</p>
        </div>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors text-sm md:text-base w-full sm:w-auto justify-center"
        >
          {isAdding ? 'Cancel' : <><Plus size={18} /> Add Item</>}
        </button>
      </div>

      {/* Status Filter */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        <button
          onClick={() => setStatusFilter('')}
          className={`px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 ${!statusFilter ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
        >
          All
        </button>
        {STATUSES.map(status => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-medium capitalize transition-colors whitespace-nowrap flex-shrink-0 ${statusFilter === status ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            {status}
          </button>
        ))}
      </div>

      {isAdding && (
        <div className="bg-white p-4 md:p-6 rounded-xl shadow-lg border border-blue-100 grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-8">
          <div className="lg:col-span-1 space-y-4 order-2 lg:order-1">
            <div className="aspect-square bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center text-slate-400 hover:bg-slate-100 cursor-pointer transition-colors group">
              <Upload className="w-8 md:w-10 h-8 md:h-10 mb-2 group-hover:text-blue-500" />
              <span className="text-sm font-medium">Upload Photos</span>
              <input type="file" className="hidden" />
            </div>
          </div>

          <div className="lg:col-span-2 space-y-4 order-1 lg:order-2">
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">Item Title</label>
                <input
                  value={newItem.title}
                  onChange={e => setNewItem({...newItem, title: e.target.value})}
                  className="w-full px-3 md:px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm md:text-base"
                  placeholder="e.g. Sony PlayStation 5 Console"
                />
              </div>
              <div className="sm:w-1/3">
                <label className="block text-sm font-medium text-slate-700 mb-1">Platform</label>
                <select
                  value={newItem.purchase_platform}
                  onChange={e => setNewItem({...newItem, purchase_platform: e.target.value})}
                  className="w-full px-3 md:px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-sm md:text-base"
                >
                  <option value="">Select...</option>
                  {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Condition</label>
                <select
                  value={newItem.condition}
                  onChange={e => setNewItem({...newItem, condition: e.target.value})}
                  className="w-full px-3 md:px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-sm md:text-base"
                >
                  {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tags</label>
                <input
                  value={newItem.tags}
                  onChange={e => setNewItem({...newItem, tags: e.target.value})}
                  className="w-full px-3 md:px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm md:text-base"
                  placeholder="gaming, console"
                />
              </div>
            </div>

            <div>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 mb-1">
                <label className="block text-sm font-medium text-slate-700">Description</label>
                <button
                  onClick={handleAIHelp}
                  disabled={loadingAI}
                  className={`text-xs flex items-center gap-1 px-2 py-1 rounded-md transition-colors ${loadingAI ? 'bg-slate-100 text-slate-400' : 'bg-purple-100 text-purple-700 hover:bg-purple-200'}`}
                >
                  <Wand2 size={12} />
                  {loadingAI ? 'Generating...' : 'Auto-Generate with AI'}
                </button>
              </div>
              <textarea
                value={newItem.description}
                onChange={e => setNewItem({...newItem, description: e.target.value})}
                className="w-full px-3 md:px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none min-h-[80px] md:min-h-[100px] text-sm md:text-base"
                placeholder="Detailed item description..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3 md:gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Cost Price (£)</label>
                <input
                  type="number"
                  value={newItem.purchase_price || ''}
                  onChange={e => setNewItem({...newItem, purchase_price: parseFloat(e.target.value) || undefined})}
                  className="w-full px-3 md:px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm md:text-base"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Listing Price (£)</label>
                <input
                  type="number"
                  value={newItem.selling_price || ''}
                  onChange={e => setNewItem({...newItem, selling_price: parseFloat(e.target.value) || undefined})}
                  className="w-full px-3 md:px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm md:text-base"
                />
              </div>
            </div>

            <div className="pt-4 flex flex-col-reverse sm:flex-row justify-end gap-3">
              <button
                onClick={() => setIsAdding(false)}
                className="px-6 py-2 rounded-lg text-slate-600 hover:bg-slate-50 font-medium text-sm md:text-base"
              >
                Cancel
              </button>
              <button
                onClick={addItem}
                disabled={isLoading}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 font-medium shadow-sm hover:shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm md:text-base"
              >
                {isLoading && <Loader2 size={16} className="animate-spin" />}
                Save Item
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoading && items.length === 0 ? (
        <div className="p-8 text-center text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
          Loading inventory...
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-xl p-6 md:p-8 text-center text-slate-500 border border-slate-200 text-sm md:text-base">
          No items in your inventory yet. Add your first item to get started!
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6">
          {items.map(item => (
            <div key={item.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-all group">
              <div className="relative aspect-square bg-slate-100">
                {item.images && item.images.length > 0 ? (
                  <img src={item.images[0]} alt={item.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300">
                    <Tag size={32} className="md:w-12 md:h-12" />
                  </div>
                )}
                <div className={`absolute top-1.5 right-1.5 md:top-2 md:right-2 px-1.5 md:px-2 py-0.5 md:py-1 rounded text-[10px] md:text-xs font-bold capitalize ${getStatusColor(item.status)}`}>
                  {item.status}
                </div>
                {/* Actions - always visible on mobile */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 md:p-4 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                  <div className="flex gap-1.5 md:gap-2 justify-end">
                    {item.status !== 'sold' && (
                      <button
                        onClick={() => {
                          setSellModalItem(item);
                          setSellData({
                            sold_price: item.selling_price || 0,
                            sold_platform: item.purchase_platform || '',
                            fees_total: 0,
                            postage_cost: 0
                          });
                        }}
                        className="bg-white p-1.5 md:p-2 rounded-full text-slate-800 hover:bg-emerald-50 hover:text-emerald-600"
                        title="Mark as Sold"
                      >
                        <DollarSign size={14} className="md:w-4 md:h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="bg-white p-1.5 md:p-2 rounded-full text-slate-800 hover:bg-red-50 hover:text-red-600"
                      title="Delete"
                    >
                      <Trash2 size={14} className="md:w-4 md:h-4" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="p-2.5 md:p-4">
                <div className="flex justify-between items-start mb-1.5 md:mb-2">
                  <span className="text-[10px] md:text-xs font-semibold text-blue-600 bg-blue-50 px-1.5 md:px-2 py-0.5 rounded truncate max-w-[60%]">
                    {item.purchase_platform || 'No platform'}
                  </span>
                  <span className="text-[10px] md:text-xs text-slate-400 hidden sm:block">
                    {new Date(item.created_at).toLocaleDateString()}
                  </span>
                </div>
                <h3 className="font-semibold text-slate-800 truncate mb-1 text-xs md:text-base" title={item.title}>{item.title}</h3>
                <p className="text-[10px] md:text-sm text-slate-500 truncate mb-2 md:mb-3 hidden sm:block">{item.description || 'No description'}</p>

                <div className="flex justify-between items-center pt-2 md:pt-3 border-t border-slate-100">
                  <div>
                    <span className="block text-[10px] md:text-xs text-slate-400">
                      {item.status === 'sold' ? 'Sold' : 'Price'}
                    </span>
                    <span className="font-bold text-slate-800 text-xs md:text-base">
                      £{item.status === 'sold' ? item.sold_price : item.selling_price || 0}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="block text-[10px] md:text-xs text-slate-400">
                      Profit
                    </span>
                    <span className={`font-bold text-xs md:text-base ${
                      ((item.status === 'sold' ? item.sold_price : item.selling_price) || 0) - (item.purchase_price || 0) - (item.fees_total || 0) - (item.postage_cost || 0) >= 0
                        ? 'text-emerald-600'
                        : 'text-red-600'
                    }`}>
                      £{(
                        ((item.status === 'sold' ? item.sold_price : item.selling_price) || 0) -
                        (item.purchase_price || 0) -
                        (item.fees_total || 0) -
                        (item.postage_cost || 0)
                      ).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sell Modal */}
      {sellModalItem && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl p-4 md:p-6 w-full sm:max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-base md:text-lg font-bold text-slate-800 mb-2 md:mb-4">Mark as Sold</h3>
            <p className="text-slate-500 mb-4 text-sm truncate">Recording sale for: <strong>{sellModalItem.title}</strong></p>

            <div className="space-y-3 md:space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Sold Price (£)</label>
                <input
                  type="number"
                  value={sellData.sold_price}
                  onChange={e => setSellData({...sellData, sold_price: parseFloat(e.target.value) || 0})}
                  className="w-full px-3 md:px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm md:text-base"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Platform</label>
                <select
                  value={sellData.sold_platform}
                  onChange={e => setSellData({...sellData, sold_platform: e.target.value})}
                  className="w-full px-3 md:px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-sm md:text-base"
                >
                  <option value="">Select...</option>
                  {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3 md:gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Fees (£)</label>
                  <input
                    type="number"
                    value={sellData.fees_total}
                    onChange={e => setSellData({...sellData, fees_total: parseFloat(e.target.value) || 0})}
                    className="w-full px-3 md:px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm md:text-base"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Postage (£)</label>
                  <input
                    type="number"
                    value={sellData.postage_cost}
                    onChange={e => setSellData({...sellData, postage_cost: parseFloat(e.target.value) || 0})}
                    className="w-full px-3 md:px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm md:text-base"
                  />
                </div>
              </div>

              {/* Profit Preview */}
              <div className="bg-slate-50 p-3 md:p-4 rounded-lg">
                <div className="flex justify-between text-xs md:text-sm">
                  <span className="text-slate-500">Sale Price:</span>
                  <span className="font-medium">£{sellData.sold_price.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs md:text-sm">
                  <span className="text-slate-500">Cost:</span>
                  <span className="font-medium">-£{(sellModalItem.purchase_price || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs md:text-sm">
                  <span className="text-slate-500">Fees & Postage:</span>
                  <span className="font-medium">-£{(sellData.fees_total + sellData.postage_cost).toFixed(2)}</span>
                </div>
                <div className="border-t border-slate-200 mt-2 pt-2 flex justify-between">
                  <span className="font-medium text-slate-700 text-xs md:text-sm">Net Profit:</span>
                  <span className={`font-bold text-sm md:text-base ${
                    sellData.sold_price - (sellModalItem.purchase_price || 0) - sellData.fees_total - sellData.postage_cost >= 0
                      ? 'text-emerald-600'
                      : 'text-red-600'
                  }`}>
                    £{(sellData.sold_price - (sellModalItem.purchase_price || 0) - sellData.fees_total - sellData.postage_cost).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-3 mt-4 md:mt-6">
              <button
                onClick={() => setSellModalItem(null)}
                className="flex-1 px-4 py-2.5 rounded-lg text-slate-600 hover:bg-slate-50 font-medium text-sm md:text-base"
              >
                Cancel
              </button>
              <button
                onClick={handleMarkAsSold}
                disabled={isLoading || !sellData.sold_price}
                className="flex-1 bg-emerald-600 text-white px-4 py-2.5 rounded-lg hover:bg-emerald-700 font-medium disabled:opacity-50 flex items-center justify-center gap-2 text-sm md:text-base"
              >
                {isLoading && <Loader2 size={16} className="animate-spin" />}
                Record Sale
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
