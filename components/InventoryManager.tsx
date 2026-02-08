import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useInventoryStore } from '../stores/inventoryStore';
import { CreateInventoryData, InventoryItem, api } from '../lib/api';
import {
  Plus, Wand2, Tag, Upload, Trash2, DollarSign, Loader2, Edit2, X,
  ChevronLeft, ChevronRight, ExternalLink, Calendar, Package, Check,
  MoreHorizontal, CheckSquare, Square, Calculator, Image as ImageIcon, Clock, AlertTriangle
} from 'lucide-react';
import { generateItemDescription, estimatePrice } from '../services/geminiService';
import { Card, Button, Badge, Input } from './ui/UIComponents';
import { ActivityLog } from './ActivityLog';

const PLATFORMS = ['eBay', 'Depop', 'Vinted', 'Facebook Marketplace', 'Gumtree', 'Shpock'];
const CONDITIONS = ['New with tags', 'Like New', 'Good', 'Fair', 'Poor'];
const STATUSES = ['draft', 'listed', 'sold'];

// Platform fee percentages for profit calculator
const PLATFORM_FEES: Record<string, number> = {
  'eBay': 12.8,
  'Depop': 10,
  'Vinted': 0, // Buyer pays
  'Facebook Marketplace': 0,
  'Gumtree': 0,
  'Shpock': 10,
};

export const InventoryManager: React.FC = () => {
  const {
    items,
    stats,
    activityLogs,
    isLoading,
    error,
    fetchInventory,
    fetchStats,
    createItem,
    updateItem,
    deleteItem,
    markAsSold,
    fetchActivityLogs,
    addNote,
    deleteActivityLog,
    clearError
  } = useInventoryStore();

  const [isAdding, setIsAdding] = useState(false);
  const [loadingAI, setLoadingAI] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [sellModalItem, setSellModalItem] = useState<InventoryItem | null>(null);
  const [detailModalItem, setDetailModalItem] = useState<InventoryItem | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [showProfitCalculator, setShowProfitCalculator] = useState(false);
  const [detailTab, setDetailTab] = useState<'details' | 'activity'>('details');

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
    tags: '',
    images: []
  });

  const [editItem, setEditItem] = useState<CreateInventoryData & { tags: string }>({
    title: '',
    description: '',
    selling_price: undefined,
    purchase_price: undefined,
    purchase_platform: '',
    condition: 'Good',
    tags: '',
    images: []
  });

  // Profit calculator state
  const [calcData, setCalcData] = useState({
    purchase_price: 0,
    selling_price: 0,
    platform: 'eBay',
    postage_cost: 0,
    custom_fees: 0
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

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

  // Update selected items visibility
  useEffect(() => {
    setShowBulkActions(selectedItems.size > 0);
  }, [selectedItems]);

  const handleAIHelp = async (isEdit = false) => {
    const item = isEdit ? editItem : newItem;
    const setItem = isEdit ? setEditItem : setNewItem;

    if (!item.title) {
      alert("Please enter a title first!");
      return;
    }
    setLoadingAI(true);

    try {
      const [desc, estPrice] = await Promise.all([
        generateItemDescription(item.title, item.condition || 'Good', item.tags.split(',')),
        estimatePrice(item.title, item.purchase_platform || 'eBay')
      ]);

      setItem(prev => ({
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

  // Image upload handler
  const handleImageUpload = async (files: FileList, isEdit = false) => {
    if (files.length === 0) return;

    setUploadingImages(true);
    const setItem = isEdit ? setEditItem : setNewItem;
    const currentImages = isEdit ? (editItem.images || []) : (newItem.images || []);

    try {
      const formData = new FormData();
      Array.from(files).forEach(file => {
        formData.append('images', file);
      });

      const response = await fetch(
        import.meta.env.DEV ? 'http://localhost:3001/api/upload/images' : '/api/upload/images',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${api.getToken()}`
          },
          body: formData
        }
      );

      const data = await response.json();

      if (data.success && data.data?.files) {
        const newUrls = data.data.files.map((f: { url: string }) => f.url);
        setItem(prev => ({
          ...prev,
          images: [...(prev.images || []), ...newUrls]
        }));
      }
    } catch (err) {
      console.error('Image upload failed:', err);
    }

    setUploadingImages(false);
  };

  const removeImage = (index: number, isEdit = false) => {
    const setItem = isEdit ? setEditItem : setNewItem;
    setItem(prev => ({
      ...prev,
      images: (prev.images || []).filter((_, i) => i !== index)
    }));
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
      notes: newItem.tags,
      images: newItem.images
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
        tags: '',
        images: []
      });
    }
  };

  const handleSaveEdit = async () => {
    if (!detailModalItem || !editItem.title) return;

    const itemData: Partial<CreateInventoryData> = {
      title: editItem.title,
      description: editItem.description,
      condition: editItem.condition,
      purchase_price: editItem.purchase_price,
      purchase_platform: editItem.purchase_platform,
      selling_price: editItem.selling_price,
      notes: editItem.tags,
      images: editItem.images
    };

    const result = await updateItem(detailModalItem.id, itemData);
    if (result) {
      setDetailModalItem(result);
      setIsEditMode(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this item?')) {
      await deleteItem(id);
      if (detailModalItem?.id === id) {
        setDetailModalItem(null);
      }
    }
  };

  // Bulk actions
  const handleBulkDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedItems.size} items?`)) return;

    for (const id of selectedItems) {
      await deleteItem(id);
    }
    setSelectedItems(new Set());
  };

  const toggleSelectItem = (id: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedItems.size === items.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(items.map(i => i.id)));
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
      if (detailModalItem?.id === sellModalItem.id) {
        setDetailModalItem(result);
      }
    }
  };

  const openDetailModal = (item: InventoryItem) => {
    setDetailModalItem(item);
    setEditItem({
      title: item.title,
      description: item.description || '',
      selling_price: item.selling_price || undefined,
      purchase_price: item.purchase_price || undefined,
      purchase_platform: item.purchase_platform || '',
      condition: item.condition || 'Good',
      tags: item.notes || '',
      images: item.images || []
    });
    setIsEditMode(false);
    setDetailTab('details');
    // Fetch activity logs for this item
    fetchActivityLogs(item.id);
  };

  // Calculate profit for profit calculator
  const calculateProfit = useCallback(() => {
    const feePercent = PLATFORM_FEES[calcData.platform] || 0;
    const platformFee = (calcData.selling_price * feePercent) / 100;
    const totalFees = platformFee + calcData.custom_fees;
    const profit = calcData.selling_price - calcData.purchase_price - totalFees - calcData.postage_cost;
    const margin = calcData.selling_price > 0 ? (profit / calcData.selling_price) * 100 : 0;
    return { platformFee, totalFees, profit, margin };
  }, [calcData]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-slate-100 dark:bg-neutral-800 dark:bg-neutral-800 text-slate-600 dark:text-neutral-400 dark:text-neutral-400';
      case 'listed': return 'bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-400';
      case 'sold': return 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 dark:text-emerald-400';
      default: return 'bg-slate-100 dark:bg-neutral-800 dark:bg-neutral-800 text-slate-600 dark:text-neutral-400 dark:text-neutral-400';
    }
  };

  const getStatusBadgeVariant = (status: string): 'neutral' | 'violet' | 'success' => {
    switch (status) {
      case 'listed': return 'violet';
      case 'sold': return 'success';
      default: return 'neutral';
    }
  };

  // Image gallery component for detail modal
  const ImageGallery = ({ images, isEdit = false }: { images: string[], isEdit?: boolean }) => {
    const [currentIndex, setCurrentIndex] = useState(0);

    if (!images || images.length === 0) {
      return (
        <div className="aspect-square bg-slate-100 dark:bg-neutral-800 dark:bg-neutral-800 rounded-xl flex flex-col items-center justify-center text-slate-400 dark:text-neutral-500 dark:text-neutral-500">
          <ImageIcon size={48} />
          <span className="mt-2 text-sm">No images</span>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <div className="relative aspect-square bg-slate-100 dark:bg-neutral-800 dark:bg-neutral-800 rounded-xl overflow-hidden">
          <img
            src={images[currentIndex]}
            alt="Product"
            className="w-full h-full object-cover"
          />
          {images.length > 1 && (
            <>
              <button
                onClick={() => setCurrentIndex(i => (i - 1 + images.length) % images.length)}
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 dark:bg-neutral-900/90 hover:bg-white dark:hover:bg-neutral-900 p-2 rounded-full shadow-lg transition-colors text-slate-900 dark:text-white"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={() => setCurrentIndex(i => (i + 1) % images.length)}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 dark:bg-neutral-900/90 hover:bg-white dark:hover:bg-neutral-900 p-2 rounded-full shadow-lg transition-colors text-slate-900 dark:text-white"
              >
                <ChevronRight size={20} />
              </button>
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                {images.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentIndex(i)}
                    className={`w-2 h-2 rounded-full transition-colors ${i === currentIndex ? 'bg-white' : 'bg-white/50'}`}
                  />
                ))}
              </div>
            </>
          )}
          {isEdit && (
            <button
              onClick={() => removeImage(currentIndex, true)}
              className="absolute top-2 right-2 bg-red-500 dark:bg-red-600 text-white p-1.5 rounded-full hover:bg-red-600 dark:hover:bg-red-700 transition-colors"
            >
              <X size={16} />
            </button>
          )}
        </div>
        {/* Thumbnails */}
        {images.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {images.map((img, i) => (
              <button
                key={i}
                onClick={() => setCurrentIndex(i)}
                className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${
                  i === currentIndex ? 'border-violet-500 dark:border-violet-400' : 'border-transparent'
                }`}
              >
                <img src={img} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 md:space-y-8">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-400 px-4 py-3 rounded-xl flex justify-between items-center shadow-sm">
          <span>{error}</span>
          <button onClick={clearError} className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-xl">&times;</button>
        </div>
      )}

      {/* Stats Row */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <Card className="hover:border-violet-500/30 dark:hover:border-violet-500/30 transition-colors">
            <p className="text-sm text-slate-500 dark:text-neutral-500 font-medium">Total Items</p>
            <p className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mt-1">{stats.total_items}</p>
          </Card>
          <Card className="hover:border-violet-500/30 dark:hover:border-violet-500/30 transition-colors">
            <p className="text-sm text-slate-500 dark:text-neutral-500 font-medium">Listed</p>
            <p className="text-2xl md:text-3xl font-bold text-violet-600 dark:text-violet-400 mt-1">{stats.listed_count}</p>
          </Card>
          <Card className="hover:border-violet-500/30 dark:hover:border-violet-500/30 transition-colors">
            <p className="text-sm text-slate-500 dark:text-neutral-500 font-medium">Sold</p>
            <p className="text-2xl md:text-3xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{stats.sold_count}</p>
          </Card>
          <Card className={`hover:border-violet-500/30 dark:hover:border-violet-500/30 transition-colors ${
            (stats.stale_items_count || 0) > 0 ? 'border-red-200 dark:border-red-500/30' : ''
          }`}>
            <p className="text-sm text-slate-500 dark:text-neutral-500 font-medium">Stale Items</p>
            <p className={`text-2xl md:text-3xl font-bold mt-1 ${
              (stats.stale_items_count || 0) > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'
            }`}>{stats.stale_items_count || 0}</p>
            {(stats.stale_items_count || 0) > 0 && (
              <p className="text-xs text-red-500 dark:text-red-400 mt-1">Listed &gt;30 days</p>
            )}
          </Card>
          <Card className="hover:border-violet-500/30 dark:hover:border-violet-500/30 transition-colors">
            <p className="text-sm text-slate-500 dark:text-neutral-500 font-medium">Avg Days to Sell</p>
            <p className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mt-1">{stats.avg_days_to_sell || 0}</p>
          </Card>
          <Card className="hover:border-violet-500/30 dark:hover:border-violet-500/30 transition-colors">
            <p className="text-sm text-slate-500 dark:text-neutral-500 font-medium">Total Profit</p>
            <p className="text-2xl md:text-3xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">£{stats.total_profit.toFixed(2)}</p>
          </Card>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Inventory</h2>
          <p className="text-sm text-slate-600 dark:text-neutral-400 dark:text-neutral-400 mt-1">Track listings, costs, and profit margins.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button
            onClick={() => setShowProfitCalculator(true)}
            variant="secondary"
            className="flex-shrink-0"
          >
            <Calculator size={18} />
            <span className="hidden sm:inline">Calculator</span>
          </Button>
          <Button
            onClick={() => setIsAdding(!isAdding)}
            variant={isAdding ? "secondary" : "primary"}
            className="flex-1 sm:flex-none"
          >
            {isAdding ? (
              <>
                <X size={18} /> Cancel
              </>
            ) : (
              <>
                <Plus size={18} /> Add Item
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Status Filter & Bulk Select */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setStatusFilter('')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${!statusFilter ? 'bg-violet-600 dark:bg-violet-500 text-white shadow-sm' : 'bg-slate-100 dark:bg-neutral-800 dark:bg-neutral-800 text-slate-600 dark:text-neutral-400 dark:text-neutral-400 hover:bg-slate-200 dark:hover:bg-neutral-700 dark:hover:bg-neutral-700'}`}
        >
          All
        </button>
        {STATUSES.map(status => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-4 py-2 rounded-xl text-sm font-medium capitalize transition-all whitespace-nowrap ${statusFilter === status ? 'bg-violet-600 dark:bg-violet-500 text-white shadow-sm' : 'bg-slate-100 dark:bg-neutral-800 dark:bg-neutral-800 text-slate-600 dark:text-neutral-400 dark:text-neutral-400 hover:bg-slate-200 dark:hover:bg-neutral-700 dark:hover:bg-neutral-700'}`}
          >
            {status}
          </button>
        ))}
        <div className="flex-1" />
        {items.length > 0 && (
          <button
            onClick={toggleSelectAll}
            className="px-3 py-2 rounded-lg text-xs md:text-sm font-medium text-slate-600 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-700 dark:bg-neutral-800 flex items-center gap-2"
          >
            {selectedItems.size === items.length ? <CheckSquare size={16} /> : <Square size={16} />}
            Select All
          </button>
        )}
      </div>

      {/* Bulk Actions Bar */}
      {showBulkActions && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-4 z-40">
          <span className="text-sm font-medium">{selectedItems.size} selected</span>
          <div className="h-6 w-px bg-slate-700" />
          <button
            onClick={handleBulkDelete}
            className="flex items-center gap-2 text-red-400 hover:text-red-300 text-sm font-medium"
          >
            <Trash2 size={16} />
            Delete
          </button>
          <button
            onClick={() => setSelectedItems(new Set())}
            className="text-slate-400 dark:text-neutral-500 hover:text-white p-1"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* Add Item Form */}
      {isAdding && (
        <div className="bg-white dark:bg-neutral-900/80 p-4 md:p-6 rounded-xl shadow-lg border border-violet-100 dark:border-violet-500/20 grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-8">
          <div className="lg:col-span-1 space-y-4 order-2 lg:order-1">
            {/* Image Upload Area */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="aspect-square bg-slate-50 dark:bg-neutral-800 border-2 border-dashed border-slate-300 dark:border-neutral-700 rounded-xl flex flex-col items-center justify-center text-slate-400 dark:text-neutral-500 hover:bg-slate-100 dark:hover:bg-neutral-700 dark:bg-neutral-800 cursor-pointer transition-colors group overflow-hidden"
            >
              {uploadingImages ? (
                <Loader2 className="w-8 h-8 animate-spin text-violet-500 dark:text-violet-400" />
              ) : newItem.images && newItem.images.length > 0 ? (
                <div className="w-full h-full relative">
                  <img src={newItem.images[0]} alt="" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-white text-sm font-medium">Change Photo</span>
                  </div>
                  <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                    {newItem.images.length} photos
                  </div>
                </div>
              ) : (
                <>
                  <Upload className="w-8 md:w-10 h-8 md:h-10 mb-2 group-hover:text-violet-500 dark:text-violet-400" />
                  <span className="text-sm font-medium">Upload Photos</span>
                  <span className="text-xs text-slate-400 dark:text-neutral-500">Click or drag & drop</span>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/*"
                multiple
                onChange={(e) => e.target.files && handleImageUpload(e.target.files, false)}
              />
            </div>
            {/* Image thumbnails */}
            {newItem.images && newItem.images.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {newItem.images.map((img, i) => (
                  <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden group">
                    <img src={img} alt="" className="w-full h-full object-cover" />
                    <button
                      onClick={(e) => { e.stopPropagation(); removeImage(i, false); }}
                      className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                    >
                      <X size={16} className="text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-2 space-y-4 order-1 lg:order-2">
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-1">Item Title</label>
                <input
                  value={newItem.title}
                  onChange={e => setNewItem({...newItem, title: e.target.value})}
                  className="w-full px-3 md:px-4 py-2 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 dark:focus:border-violet-400 outline-none text-sm md:text-base text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-neutral-500"
                  placeholder="e.g. Sony PlayStation 5 Console"
                />
              </div>
              <div className="sm:w-1/3">
                <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-1">Source Platform</label>
                <select
                  value={newItem.purchase_platform}
                  onChange={e => setNewItem({...newItem, purchase_platform: e.target.value})}
                  className="w-full px-3 md:px-4 py-2 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 dark:focus:border-violet-400 outline-none text-sm md:text-base text-slate-900 dark:text-white"
                >
                  <option value="">Select...</option>
                  {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-1">Condition</label>
                <select
                  value={newItem.condition}
                  onChange={e => setNewItem({...newItem, condition: e.target.value})}
                  className="w-full px-3 md:px-4 py-2 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 dark:focus:border-violet-400 outline-none text-sm md:text-base text-slate-900 dark:text-white"
                >
                  {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-1">Tags</label>
                <input
                  value={newItem.tags}
                  onChange={e => setNewItem({...newItem, tags: e.target.value})}
                  className="w-full px-3 md:px-4 py-2 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 dark:focus:border-violet-400 outline-none text-sm md:text-base text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-neutral-500"
                  placeholder="gaming, console"
                />
              </div>
            </div>

            <div>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 mb-1">
                <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300">Description</label>
                <button
                  onClick={() => handleAIHelp(false)}
                  disabled={loadingAI}
                  className={`text-xs flex items-center gap-1 px-2 py-1 rounded-md transition-colors ${loadingAI ? 'bg-slate-100 dark:bg-neutral-800 text-slate-400 dark:text-neutral-500' : 'bg-purple-100 text-purple-700 hover:bg-purple-200'}`}
                >
                  <Wand2 size={12} />
                  {loadingAI ? 'Generating...' : 'Auto-Generate with AI'}
                </button>
              </div>
              <textarea
                value={newItem.description}
                onChange={e => setNewItem({...newItem, description: e.target.value})}
                className="w-full px-3 md:px-4 py-2 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 dark:focus:border-violet-400 outline-none min-h-[80px] md:min-h-[100px] text-sm md:text-base text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-neutral-500"
                placeholder="Detailed item description..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3 md:gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-1">Cost Price (£)</label>
                <input
                  type="number"
                  value={newItem.purchase_price || ''}
                  onChange={e => setNewItem({...newItem, purchase_price: parseFloat(e.target.value) || undefined})}
                  className="w-full px-3 md:px-4 py-2 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 dark:focus:border-violet-400 outline-none text-sm md:text-base text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-neutral-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-1">Listing Price (£)</label>
                <input
                  type="number"
                  value={newItem.selling_price || ''}
                  onChange={e => setNewItem({...newItem, selling_price: parseFloat(e.target.value) || undefined})}
                  className="w-full px-3 md:px-4 py-2 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 dark:focus:border-violet-400 outline-none text-sm md:text-base text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-neutral-500"
                />
              </div>
            </div>

            <div className="pt-4 flex flex-col-reverse sm:flex-row justify-end gap-3">
              <button
                onClick={() => setIsAdding(false)}
                className="px-6 py-2 rounded-lg text-slate-600 dark:text-neutral-400 hover:bg-slate-50 dark:bg-neutral-800 font-medium text-sm md:text-base"
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

      {/* Inventory Grid */}
      {isLoading && items.length === 0 ? (
        <div className="p-8 text-center text-slate-500 dark:text-neutral-500">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
          Loading inventory...
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-xl p-6 md:p-8 text-center text-slate-500 dark:text-neutral-500 border border-slate-200 dark:border-white/5 text-sm md:text-base">
          No items in your inventory yet. Add your first item to get started!
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6">
          {items.map(item => (
            <div
              key={item.id}
              className={`bg-white rounded-xl shadow-sm border overflow-hidden hover:shadow-md transition-all group cursor-pointer ${
                selectedItems.has(item.id) ? 'border-violet-500 dark:border-violet-400 ring-2 ring-blue-200' : 'border-slate-200 dark:border-white/5'
              }`}
              onClick={() => openDetailModal(item)}
            >
              <div className="relative aspect-square bg-slate-100 dark:bg-neutral-800">
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

                {/* Selection checkbox */}
                <button
                  onClick={(e) => { e.stopPropagation(); toggleSelectItem(item.id); }}
                  className={`absolute top-1.5 left-1.5 md:top-2 md:left-2 w-6 h-6 rounded border-2 flex items-center justify-center transition-all ${
                    selectedItems.has(item.id)
                      ? 'bg-violet-50 dark:bg-violet-500/200 border-violet-500 dark:border-violet-400 text-white'
                      : 'bg-white/80 border-slate-300 dark:border-neutral-700 opacity-0 group-hover:opacity-100'
                  }`}
                >
                  {selectedItems.has(item.id) && <Check size={14} />}
                </button>

                {/* Actions - always visible on mobile */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 md:p-4 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                  <div className="flex gap-1.5 md:gap-2 justify-end">
                    {item.status !== 'sold' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSellModalItem(item);
                          setSellData({
                            sold_price: item.selling_price || 0,
                            sold_platform: item.purchase_platform || '',
                            fees_total: 0,
                            postage_cost: 0
                          });
                        }}
                        className="bg-white dark:bg-neutral-900/80 p-1.5 md:p-2 rounded-full text-slate-900 dark:text-white hover:bg-emerald-50 hover:text-emerald-600 dark:text-emerald-400"
                        title="Mark as Sold"
                      >
                        <DollarSign size={14} className="md:w-4 md:h-4" />
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                      className="bg-white dark:bg-neutral-900/80 p-1.5 md:p-2 rounded-full text-slate-900 dark:text-white hover:bg-red-50 hover:text-red-600"
                      title="Delete"
                    >
                      <Trash2 size={14} className="md:w-4 md:h-4" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="p-2.5 md:p-4">
                <div className="flex justify-between items-start mb-1.5 md:mb-2">
                  <span className="text-[10px] md:text-xs font-semibold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/20 px-1.5 md:px-2 py-0.5 rounded truncate max-w-[60%]">
                    {item.purchase_platform || 'No platform'}
                  </span>
                  {/* Days Listed Badge */}
                  {item.status !== 'draft' && (
                    <span className={`inline-flex items-center gap-1 text-[10px] md:text-xs px-1.5 md:px-2 py-0.5 rounded font-medium ${
                      item.is_stale
                        ? 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400'
                        : (item.days_listed || 0) > 14
                        ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400'
                        : 'bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-400'
                    }`}>
                      {item.is_stale ? <AlertTriangle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                      {item.days_listed}d
                    </span>
                  )}
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-white truncate mb-1 text-xs md:text-base" title={item.title}>{item.title}</h3>
                <p className="text-[10px] md:text-sm text-slate-500 dark:text-neutral-500 truncate mb-2 md:mb-3 hidden sm:block">{item.description || 'No description'}</p>

                <div className="flex justify-between items-center pt-2 md:pt-3 border-t border-slate-100">
                  <div>
                    <span className="block text-[10px] md:text-xs text-slate-400 dark:text-neutral-500">
                      {item.status === 'sold' ? 'Sold' : 'Price'}
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white text-xs md:text-base">
                      £{item.status === 'sold' ? item.sold_price : item.selling_price || 0}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="block text-[10px] md:text-xs text-slate-400 dark:text-neutral-500">
                      Profit
                    </span>
                    <span className={`font-bold text-xs md:text-base ${
                      ((item.status === 'sold' ? item.sold_price : item.selling_price) || 0) - (item.purchase_price || 0) - (item.fees_total || 0) - (item.postage_cost || 0) >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
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

      {/* Item Detail Modal */}
      {detailModalItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-4 md:px-6 py-4 border-b border-slate-200 dark:border-white/5 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white truncate">{detailModalItem.title}</h3>
              <div className="flex items-center gap-2">
                {!isEditMode && (
                  <button
                    onClick={() => setIsEditMode(true)}
                    className="p-2 text-slate-500 dark:text-neutral-500 hover:text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:bg-violet-500/20 rounded-lg"
                  >
                    <Edit2 size={18} />
                  </button>
                )}
                <button
                  onClick={() => { setDetailModalItem(null); setIsEditMode(false); }}
                  className="p-2 text-slate-500 dark:text-neutral-500 hover:text-slate-700 dark:text-neutral-300 hover:bg-slate-100 dark:hover:bg-neutral-700 dark:bg-neutral-800 rounded-lg"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6">
              {/* Tabs */}
              {!isEditMode && (
                <div className="flex gap-1 mb-4 bg-slate-100 dark:bg-neutral-800 p-1 rounded-lg">
                  <button
                    onClick={() => setDetailTab('details')}
                    className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                      detailTab === 'details'
                        ? 'bg-white dark:bg-neutral-700 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:text-white'
                    }`}
                  >
                    Details
                  </button>
                  <button
                    onClick={() => setDetailTab('activity')}
                    className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                      detailTab === 'activity'
                        ? 'bg-white dark:bg-neutral-700 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:text-white'
                    }`}
                  >
                    Activity Log
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left - Images */}
                <div>
                  {isEditMode ? (
                    <div className="space-y-4">
                      <ImageGallery images={editItem.images || []} isEdit={true} />
                      <button
                        onClick={() => editFileInputRef.current?.click()}
                        className="w-full py-2 border-2 border-dashed border-slate-300 dark:border-neutral-700 rounded-lg text-slate-500 dark:text-neutral-500 hover:border-blue-400 hover:text-violet-500 dark:text-violet-400 flex items-center justify-center gap-2"
                      >
                        <ImageIcon size={18} />
                        Add More Photos
                      </button>
                      <input
                        ref={editFileInputRef}
                        type="file"
                        className="hidden"
                        accept="image/*"
                        multiple
                        onChange={(e) => e.target.files && handleImageUpload(e.target.files, true)}
                      />
                    </div>
                  ) : (
                    <ImageGallery images={detailModalItem.images || []} />
                  )}
                </div>

                {/* Right - Details or Activity Log */}
                <div className="space-y-4">
                  {/* Activity Log Tab */}
                  {!isEditMode && detailTab === 'activity' && (
                    <ActivityLog
                      logs={activityLogs[detailModalItem.id] || []}
                      onAddNote={(content) => addNote(detailModalItem.id, content)}
                      onDeleteLog={(logId) => deleteActivityLog(detailModalItem.id, logId)}
                    />
                  )}

                  {/* Details Tab or Edit Mode */}
                  (isEditMode || detailTab === 'details') && (
                  isEditMode ? (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-1">Title</label>
                        <input
                          value={editItem.title}
                          onChange={e => setEditItem({...editItem, title: e.target.value})}
                          className="w-full px-3 py-2 border border-slate-200 dark:border-white/5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-1">Description</label>
                        <textarea
                          value={editItem.description}
                          onChange={e => setEditItem({...editItem, description: e.target.value})}
                          className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 dark:focus:border-violet-400 outline-none min-h-[100px] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-neutral-500"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-1">Cost Price (£)</label>
                          <input
                            type="number"
                            value={editItem.purchase_price || ''}
                            onChange={e => setEditItem({...editItem, purchase_price: parseFloat(e.target.value) || undefined})}
                            className="w-full px-3 py-2 border border-slate-200 dark:border-white/5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-1">Selling Price (£)</label>
                          <input
                            type="number"
                            value={editItem.selling_price || ''}
                            onChange={e => setEditItem({...editItem, selling_price: parseFloat(e.target.value) || undefined})}
                            className="w-full px-3 py-2 border border-slate-200 dark:border-white/5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-1">Condition</label>
                          <select
                            value={editItem.condition}
                            onChange={e => setEditItem({...editItem, condition: e.target.value})}
                            className="w-full px-3 py-2 border border-slate-200 dark:border-white/5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                          >
                            {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-1">Source</label>
                          <select
                            value={editItem.purchase_platform}
                            onChange={e => setEditItem({...editItem, purchase_platform: e.target.value})}
                            className="w-full px-3 py-2 border border-slate-200 dark:border-white/5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                          >
                            <option value="">Select...</option>
                            {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-1">Notes</label>
                        <input
                          value={editItem.tags}
                          onChange={e => setEditItem({...editItem, tags: e.target.value})}
                          className="w-full px-3 py-2 border border-slate-200 dark:border-white/5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white"
                          placeholder="Any notes..."
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Status Badge */}
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium capitalize ${getStatusColor(detailModalItem.status)}`}>
                          {detailModalItem.status}
                        </span>
                        {detailModalItem.condition && (
                          <span className="px-3 py-1 rounded-full text-sm font-medium bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-400">
                            {detailModalItem.condition}
                          </span>
                        )}
                      </div>

                      {/* Description */}
                      {detailModalItem.description && (
                        <div>
                          <h4 className="text-sm font-medium text-slate-500 dark:text-neutral-500 mb-1">Description</h4>
                          <p className="text-slate-700 dark:text-neutral-300">{detailModalItem.description}</p>
                        </div>
                      )}

                      {/* Purchase Details */}
                      <div className="bg-slate-50 dark:bg-neutral-800 rounded-lg p-4 space-y-2">
                        <h4 className="text-sm font-medium text-slate-700 dark:text-neutral-300">Purchase Details</h4>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-slate-500 dark:text-neutral-500">Cost:</span>
                            <span className="ml-2 font-medium">£{detailModalItem.purchase_price?.toFixed(2) || '0.00'}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 dark:text-neutral-500">Source:</span>
                            <span className="ml-2 font-medium">{detailModalItem.purchase_platform || '-'}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 dark:text-neutral-500">Added:</span>
                            <span className="ml-2 font-medium">{new Date(detailModalItem.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>

                      {/* Pricing */}
                      <div className="bg-violet-50 dark:bg-violet-500/20 rounded-lg p-4 space-y-2">
                        <h4 className="text-sm font-medium text-violet-700 dark:text-violet-400">Pricing</h4>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-violet-600 dark:text-violet-400">Listing Price:</span>
                            <span className="font-medium">£{detailModalItem.selling_price?.toFixed(2) || '0.00'}</span>
                          </div>
                          {detailModalItem.status === 'sold' && (
                            <>
                              <div className="flex justify-between">
                                <span className="text-violet-600 dark:text-violet-400">Sold For:</span>
                                <span className="font-medium">£{detailModalItem.sold_price?.toFixed(2) || '0.00'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-violet-600 dark:text-violet-400">Fees:</span>
                                <span className="font-medium">-£{(detailModalItem.fees_total + detailModalItem.postage_cost).toFixed(2)}</span>
                              </div>
                            </>
                          )}
                          <div className="flex justify-between pt-2 border-t border-violet-200 dark:border-violet-500/30">
                            <span className="font-medium text-violet-700 dark:text-violet-400">
                              {detailModalItem.status === 'sold' ? 'Net Profit:' : 'Est. Profit:'}
                            </span>
                            <span className={`font-bold ${
                              ((detailModalItem.status === 'sold' ? detailModalItem.sold_price : detailModalItem.selling_price) || 0) -
                              (detailModalItem.purchase_price || 0) -
                              (detailModalItem.fees_total || 0) -
                              (detailModalItem.postage_cost || 0) >= 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-red-600'
                            }`}>
                              £{(
                                ((detailModalItem.status === 'sold' ? detailModalItem.sold_price : detailModalItem.selling_price) || 0) -
                                (detailModalItem.purchase_price || 0) -
                                (detailModalItem.fees_total || 0) -
                                (detailModalItem.postage_cost || 0)
                              ).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Notes */}
                      {detailModalItem.notes && (
                        <div>
                          <h4 className="text-sm font-medium text-slate-500 dark:text-neutral-500 mb-1">Notes</h4>
                          <p className="text-slate-700 dark:text-neutral-300 text-sm">{detailModalItem.notes}</p>
                        </div>
                      )}

                      {/* Days Listed Info */}
                      {detailModalItem.status !== 'draft' && (
                        <div className={`p-3 rounded-lg ${
                          detailModalItem.is_stale
                            ? 'bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20'
                            : 'bg-slate-50 dark:bg-neutral-800'
                        }`}>
                          <div className="flex items-center gap-2">
                            {detailModalItem.is_stale ? (
                              <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
                            ) : (
                              <Clock className="w-4 h-4 text-slate-500 dark:text-neutral-400" />
                            )}
                            <span className={`text-sm font-medium ${
                              detailModalItem.is_stale
                                ? 'text-red-700 dark:text-red-400'
                                : 'text-slate-700 dark:text-neutral-300'
                            }`}>
                              Listed for {detailModalItem.days_listed} days
                              {detailModalItem.is_stale && ' — Consider lowering price or relisting'}
                            </span>
                          </div>
                        </div>
                      )}
                    </>
                  )
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-4 md:px-6 py-4 border-t border-slate-200 dark:border-white/5 flex flex-col-reverse sm:flex-row gap-3 justify-between">
              {isEditMode ? (
                <>
                  <button
                    onClick={() => {
                      setIsEditMode(false);
                      setEditItem({
                        title: detailModalItem.title,
                        description: detailModalItem.description || '',
                        selling_price: detailModalItem.selling_price || undefined,
                        purchase_price: detailModalItem.purchase_price || undefined,
                        purchase_platform: detailModalItem.purchase_platform || '',
                        condition: detailModalItem.condition || 'Good',
                        tags: detailModalItem.notes || '',
                        images: detailModalItem.images || []
                      });
                    }}
                    className="px-4 py-2 text-slate-600 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-700 dark:bg-neutral-800 rounded-lg font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    disabled={isLoading}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 font-medium flex items-center justify-center gap-2"
                  >
                    {isLoading && <Loader2 size={16} className="animate-spin" />}
                    Save Changes
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => handleDelete(detailModalItem.id)}
                    className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg font-medium flex items-center gap-2"
                  >
                    <Trash2 size={16} />
                    Delete
                  </button>
                  {detailModalItem.status !== 'sold' && (
                    <button
                      onClick={() => {
                        setSellModalItem(detailModalItem);
                        setSellData({
                          sold_price: detailModalItem.selling_price || 0,
                          sold_platform: detailModalItem.purchase_platform || '',
                          fees_total: 0,
                          postage_cost: 0
                        });
                      }}
                      className="bg-emerald-600 text-white px-6 py-2 rounded-lg hover:bg-emerald-700 font-medium flex items-center gap-2"
                    >
                      <DollarSign size={16} />
                      Mark as Sold
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sell Modal */}
      {sellModalItem && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl p-4 md:p-6 w-full sm:max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-base md:text-lg font-bold text-slate-900 dark:text-white mb-2 md:mb-4">Mark as Sold</h3>
            <p className="text-slate-500 dark:text-neutral-500 mb-4 text-sm truncate">Recording sale for: <strong>{sellModalItem.title}</strong></p>

            <div className="space-y-3 md:space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-1">Sold Price (£)</label>
                <input
                  type="number"
                  value={sellData.sold_price}
                  onChange={e => setSellData({...sellData, sold_price: parseFloat(e.target.value) || 0})}
                  className="w-full px-3 md:px-4 py-2 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 dark:focus:border-violet-400 outline-none text-sm md:text-base text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-neutral-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-1">Platform</label>
                <select
                  value={sellData.sold_platform}
                  onChange={e => setSellData({...sellData, sold_platform: e.target.value})}
                  className="w-full px-3 md:px-4 py-2 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 dark:focus:border-violet-400 outline-none text-sm md:text-base text-slate-900 dark:text-white"
                >
                  <option value="">Select...</option>
                  {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3 md:gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-1">Fees (£)</label>
                  <input
                    type="number"
                    value={sellData.fees_total}
                    onChange={e => setSellData({...sellData, fees_total: parseFloat(e.target.value) || 0})}
                    className="w-full px-3 md:px-4 py-2 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 dark:focus:border-violet-400 outline-none text-sm md:text-base text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-neutral-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-1">Postage (£)</label>
                  <input
                    type="number"
                    value={sellData.postage_cost}
                    onChange={e => setSellData({...sellData, postage_cost: parseFloat(e.target.value) || 0})}
                    className="w-full px-3 md:px-4 py-2 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 dark:focus:border-violet-400 outline-none text-sm md:text-base text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-neutral-500"
                  />
                </div>
              </div>

              {/* Profit Preview */}
              <div className="bg-slate-50 dark:bg-neutral-800 p-3 md:p-4 rounded-lg">
                <div className="flex justify-between text-xs md:text-sm">
                  <span className="text-slate-500 dark:text-neutral-500">Sale Price:</span>
                  <span className="font-medium">£{sellData.sold_price.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs md:text-sm">
                  <span className="text-slate-500 dark:text-neutral-500">Cost:</span>
                  <span className="font-medium">-£{(sellModalItem.purchase_price || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs md:text-sm">
                  <span className="text-slate-500 dark:text-neutral-500">Fees & Postage:</span>
                  <span className="font-medium">-£{(sellData.fees_total + sellData.postage_cost).toFixed(2)}</span>
                </div>
                <div className="border-t border-slate-200 dark:border-white/5 mt-2 pt-2 flex justify-between">
                  <span className="font-medium text-slate-700 dark:text-neutral-300 text-xs md:text-sm">Net Profit:</span>
                  <span className={`font-bold text-sm md:text-base ${
                    sellData.sold_price - (sellModalItem.purchase_price || 0) - sellData.fees_total - sellData.postage_cost >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
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
                className="flex-1 px-4 py-2.5 rounded-lg text-slate-600 dark:text-neutral-400 hover:bg-slate-50 dark:bg-neutral-800 font-medium text-sm md:text-base"
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

      {/* Profit Calculator Modal */}
      {showProfitCalculator && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl p-4 md:p-6 w-full sm:max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Calculator size={20} />
                Profit Calculator
              </h3>
              <button
                onClick={() => setShowProfitCalculator(false)}
                className="p-2 text-slate-500 dark:text-neutral-500 hover:text-slate-700 dark:text-neutral-300 hover:bg-slate-100 dark:hover:bg-neutral-700 dark:bg-neutral-800 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-1">Purchase Price (£)</label>
                <input
                  type="number"
                  value={calcData.purchase_price || ''}
                  onChange={e => setCalcData({...calcData, purchase_price: parseFloat(e.target.value) || 0})}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-white/5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white"
                  placeholder="What you paid"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-1">Selling Price (£)</label>
                <input
                  type="number"
                  value={calcData.selling_price || ''}
                  onChange={e => setCalcData({...calcData, selling_price: parseFloat(e.target.value) || 0})}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-white/5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white"
                  placeholder="What you'll sell for"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-1">Platform</label>
                <select
                  value={calcData.platform}
                  onChange={e => setCalcData({...calcData, platform: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-white/5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                >
                  {PLATFORMS.map(p => (
                    <option key={p} value={p}>
                      {p} ({PLATFORM_FEES[p]}% fee)
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-1">Postage (£)</label>
                  <input
                    type="number"
                    value={calcData.postage_cost || ''}
                    onChange={e => setCalcData({...calcData, postage_cost: parseFloat(e.target.value) || 0})}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-white/5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-1">Other Fees (£)</label>
                  <input
                    type="number"
                    value={calcData.custom_fees || ''}
                    onChange={e => setCalcData({...calcData, custom_fees: parseFloat(e.target.value) || 0})}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-white/5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Results */}
              <div className="bg-slate-50 dark:bg-neutral-800 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 dark:text-neutral-500">Selling Price:</span>
                  <span className="font-medium">£{calcData.selling_price.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 dark:text-neutral-500">Purchase Price:</span>
                  <span className="font-medium">-£{calcData.purchase_price.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 dark:text-neutral-500">Platform Fee ({PLATFORM_FEES[calcData.platform]}%):</span>
                  <span className="font-medium">-£{calculateProfit().platformFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 dark:text-neutral-500">Postage & Other:</span>
                  <span className="font-medium">-£{(calcData.postage_cost + calcData.custom_fees).toFixed(2)}</span>
                </div>
                <div className="border-t border-slate-200 dark:border-white/5 pt-2 mt-2">
                  <div className="flex justify-between">
                    <span className="font-semibold text-slate-700 dark:text-neutral-300">Net Profit:</span>
                    <span className={`font-bold text-lg ${calculateProfit().profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600'}`}>
                      £{calculateProfit().profit.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-slate-500 dark:text-neutral-500">Profit Margin:</span>
                    <span className={`font-medium ${calculateProfit().margin >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600'}`}>
                      {calculateProfit().margin.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
