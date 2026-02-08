import React, { useState, useEffect } from 'react';
import {
  Globe, Plus, Check, X, Copy, ExternalLink, Loader2,
  AlertCircle, CheckCircle2, Clock, Edit2, Trash2,
  DollarSign, RefreshCw, Eye, Package, ChevronDown,
  ChevronUp, Store, Zap
} from 'lucide-react';
import { Card, Button, Badge, Input } from './ui/UIComponents';
import { api } from '../lib/api';

// Types
interface Platform {
  id: string;
  name: string;
  maxTitleLength: number;
  maxDescriptionLength: number;
  feePercentage: number;
  supportsDirectPosting: boolean;
  seoKeywords: string[];
}

interface CrossListing {
  id: string;
  inventory_id: string;
  platform: string;
  title: string;
  description: string | null;
  price: number;
  url: string | null;
  status: 'draft' | 'active' | 'sold' | 'ended' | 'error';
  error_message: string | null;
  listed_at: string | null;
  synced_at: string | null;
  created_at: string;
}

interface InventoryItem {
  id: string;
  title: string;
  description: string | null;
  images: string[] | null;
  selling_price: number | null;
  purchase_price: number | null;
  condition: string | null;
  brand: string | null;
  status: string;
}

interface CrossListingGroup {
  inventory_id: string;
  inventory: InventoryItem;
  listings: CrossListing[];
  active_platforms: string[];
}

interface CrossListingStats {
  total_listings: number;
  active_listings: number;
  platforms_used: string[];
  listings_by_platform: Record<string, number>;
  items_cross_listed: number;
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Helper to get auth headers
const getAuthHeaders = () => ({
  Authorization: `Bearer ${api.getToken()}`,
});

const PLATFORM_ICONS: Record<string, string> = {
  eBay: '🛒',
  Vinted: '👗',
  Depop: '🛍️',
  Facebook: '📘',
  Gumtree: '🌳',
  Shpock: '📱',
};

const PLATFORM_COLORS: Record<string, string> = {
  eBay: 'bg-blue-500',
  Vinted: 'bg-teal-500',
  Depop: 'bg-red-500',
  Facebook: 'bg-indigo-500',
  Gumtree: 'bg-green-500',
  Shpock: 'bg-purple-500',
};

const STATUS_STYLES: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  draft: { bg: 'bg-gray-100 dark:bg-neutral-700', text: 'text-gray-600 dark:text-neutral-300', icon: <Clock className="w-3 h-3" /> },
  active: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-600 dark:text-green-400', icon: <CheckCircle2 className="w-3 h-3" /> },
  sold: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400', icon: <DollarSign className="w-3 h-3" /> },
  ended: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-600 dark:text-orange-400', icon: <X className="w-3 h-3" /> },
  error: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-600 dark:text-red-400', icon: <AlertCircle className="w-3 h-3" /> },
};

export const CrossListingManager: React.FC = () => {
  const [groups, setGroups] = useState<CrossListingGroup[]>([]);
  const [stats, setStats] = useState<CrossListingStats | null>(null);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedInventoryId, setSelectedInventoryId] = useState<string | null>(null);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  // Edit modal
  const [editingListing, setEditingListing] = useState<CrossListing | null>(null);
  const [editForm, setEditForm] = useState({ title: '', description: '', price: 0 });

  // Sell modal
  const [sellModalItem, setSellModalItem] = useState<CrossListingGroup | null>(null);
  const [sellForm, setSellForm] = useState({ platform: '', price: 0 });

  // Copy modal
  const [copyModalListing, setCopyModalListing] = useState<{ text: string; listing: CrossListing } | null>(null);

  // Expanded items
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  // Inventory for create modal
  const [availableInventory, setAvailableInventory] = useState<InventoryItem[]>([]);

  // Fetch data
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const headers = getAuthHeaders();

      const [groupsRes, statsRes, platformsRes] = await Promise.all([
        fetch(`${API_BASE}/api/cross-listings`, { headers }),
        fetch(`${API_BASE}/api/cross-listings/stats`, { headers }),
        fetch(`${API_BASE}/api/cross-listings/platforms`, { headers }),
      ]);

      if (groupsRes.ok) {
        const data = await groupsRes.json();
        setGroups(data.data || []);
      }

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data.data);
      }

      if (platformsRes.ok) {
        const data = await platformsRes.json();
        setPlatforms(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching cross-listings:', err);
      setError('Failed to load cross-listings');
    }
    setIsLoading(false);
  };

  const fetchInventoryForCreate = async () => {
    try {
      // Fetch both draft and listed items (exclude sold items)
      const res = await fetch(`${API_BASE}/api/inventory?per_page=100`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        // Filter out sold items, keep draft and listed
        const availableItems = (data.data || []).filter(
          (item: InventoryItem) => item.status !== 'sold'
        );
        setAvailableInventory(availableItems);
      }
    } catch (err) {
      console.error('Error fetching inventory:', err);
    }
  };

  const handleCreateCrossListings = async () => {
    if (!selectedInventoryId || selectedPlatforms.length === 0) return;

    setIsCreating(true);
    try {
      const res = await fetch(`${API_BASE}/api/cross-listings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          inventory_id: selectedInventoryId,
          platforms: selectedPlatforms,
        }),
      });

      if (res.ok) {
        setShowCreateModal(false);
        setSelectedInventoryId(null);
        setSelectedPlatforms([]);
        fetchData();
      } else {
        const data = await res.json();
        setError(data.error?.message || 'Failed to create listings');
      }
    } catch (err) {
      setError('Failed to create cross-listings');
    }
    setIsCreating(false);
  };

  const handleUpdateListing = async () => {
    if (!editingListing) return;

    try {
      const res = await fetch(`${API_BASE}/api/cross-listings/${editingListing.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(editForm),
      });

      if (res.ok) {
        setEditingListing(null);
        fetchData();
      }
    } catch (err) {
      setError('Failed to update listing');
    }
  };

  const handleDeleteListing = async (listingId: string) => {
    if (!confirm('Are you sure you want to delete this listing?')) return;

    try {
      const res = await fetch(`${API_BASE}/api/cross-listings/${listingId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      setError('Failed to delete listing');
    }
  };

  const handleMarkSold = async () => {
    if (!sellModalItem || !sellForm.platform || !sellForm.price) return;

    try {
      const res = await fetch(`${API_BASE}/api/cross-listings/mark-sold`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          inventory_id: sellModalItem.inventory_id,
          sold_platform: sellForm.platform,
          sold_price: sellForm.price,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSellModalItem(null);
        setSellForm({ platform: '', price: 0 });
        fetchData();
        // Show success message
        if (data.data?.delisted_platforms?.length > 0) {
          alert(`Item sold! Auto-delisted from: ${data.data.delisted_platforms.join(', ')}`);
        }
      }
    } catch (err) {
      setError('Failed to mark as sold');
    }
  };

  const handleGetCopyPaste = async (listing: CrossListing) => {
    try {
      const res = await fetch(`${API_BASE}/api/cross-listings/${listing.id}/copy-paste`, {
        headers: getAuthHeaders(),
      });

      if (res.ok) {
        const data = await res.json();
        setCopyModalListing({ text: data.data.text, listing });
      }
    } catch (err) {
      setError('Failed to get listing details');
    }
  };

  const handleActivateListing = async (listingId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/cross-listings/${listingId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ status: 'active' }),
      });

      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      setError('Failed to activate listing');
    }
  };

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Globe className="w-7 h-7 text-primary-500" />
            Cross-Platform Autopilot
          </h1>
          <p className="text-gray-600 dark:text-neutral-400 mt-1">
            List once, sell everywhere. Auto-sync when sold.
          </p>
        </div>
        <Button
          onClick={() => {
            fetchInventoryForCreate();
            setShowCreateModal(true);
          }}
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Cross-Post Item
        </Button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <span className="text-red-700 dark:text-red-400">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
                <Package className="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-neutral-400">Items Listed</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{stats.items_cross_listed}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-neutral-400">Active Listings</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{stats.active_listings}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Store className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-neutral-400">Total Listings</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{stats.total_listings}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Globe className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-neutral-400">Platforms</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{stats.platforms_used.length}</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Listings by Inventory */}
      <div className="space-y-4">
        {groups.length === 0 ? (
          <Card className="p-8 text-center">
            <Globe className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No cross-listings yet
            </h3>
            <p className="text-gray-600 dark:text-neutral-400 mb-4">
              Start cross-posting your inventory to multiple platforms
            </p>
            <Button onClick={() => { fetchInventoryForCreate(); setShowCreateModal(true); }}>
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Cross-Listing
            </Button>
          </Card>
        ) : (
          groups.map((group) => (
            <Card key={group.inventory_id} className="overflow-hidden">
              {/* Item Header */}
              <div
                className="p-4 flex items-center gap-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-neutral-800/50"
                onClick={() => toggleExpanded(group.inventory_id)}
              >
                {/* Image */}
                <div className="w-16 h-16 bg-gray-100 dark:bg-neutral-700 rounded-lg overflow-hidden flex-shrink-0">
                  {group.inventory.images?.[0] ? (
                    <img
                      src={group.inventory.images[0]}
                      alt={group.inventory.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-6 h-6 text-gray-400" />
                    </div>
                  )}
                </div>

                {/* Item Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 dark:text-white truncate">
                    {group.inventory.title}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-neutral-400">
                    £{group.inventory.selling_price?.toFixed(2) || '0.00'}
                    {group.inventory.condition && ` • ${group.inventory.condition}`}
                  </p>
                </div>

                {/* Platform Badges */}
                <div className="flex items-center gap-1 flex-wrap">
                  {group.listings.map((listing) => (
                    <span
                      key={listing.id}
                      className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${ listing.status === 'active' ? PLATFORM_COLORS[listing.platform] + ' text-white' : 'bg-gray-200 dark:bg-neutral-700 text-gray-600 dark:text-neutral-400' }`}
                      title={`${listing.platform}: ${listing.status}`}
                    >
                      {PLATFORM_ICONS[listing.platform]} {listing.platform}
                    </span>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSellModalItem(group);
                      setSellForm({ platform: group.active_platforms[0] || '', price: group.inventory.selling_price || 0 });
                    }}
                    className="text-sm"
                  >
                    <DollarSign className="w-4 h-4" />
                    Sold
                  </Button>
                  {expandedItems.has(group.inventory_id) ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </div>

              {/* Expanded Listings */}
              {expandedItems.has(group.inventory_id) && (
                <div className="border-t border-gray-200 dark:border-neutral-700">
                  {group.listings.map((listing) => (
                    <div
                      key={listing.id}
                      className="p-4 border-b last:border-b-0 border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-neutral-800/30"
                    >
                      <div className="flex items-start gap-4">
                        {/* Platform Icon */}
                        <div className={`p-2 rounded-lg ${PLATFORM_COLORS[listing.platform]} text-white text-xl`}>
                          {PLATFORM_ICONS[listing.platform]}
                        </div>

                        {/* Listing Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-gray-900 dark:text-white">
                              {listing.platform}
                            </span>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${STATUS_STYLES[listing.status].bg} ${STATUS_STYLES[listing.status].text}`}>
                              {STATUS_STYLES[listing.status].icon}
                              {listing.status.charAt(0).toUpperCase() + listing.status.slice(1)}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-neutral-400 truncate">
                            {listing.title}
                          </p>
                          <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                            £{listing.price.toFixed(2)}
                          </p>
                          {listing.synced_at && (
                            <p className="text-xs text-gray-500 mt-1">
                              Last synced: {new Date(listing.synced_at).toLocaleDateString()}
                            </p>
                          )}
                          {listing.error_message && (
                            <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              {listing.error_message}
                            </p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          {listing.status === 'draft' && (
                            <Button
                              variant="secondary"
                              onClick={() => handleActivateListing(listing.id)}
                              className="text-xs"
                            >
                              <Zap className="w-3 h-3 mr-1" />
                              Activate
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            onClick={() => handleGetCopyPaste(listing)}
                            title="Copy listing for manual posting"
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                          {listing.url && (
                            <Button
                              variant="ghost"
                              onClick={() => window.open(listing.url!, '_blank')}
                              title="View on platform"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            onClick={() => {
                              setEditingListing(listing);
                              setEditForm({
                                title: listing.title,
                                description: listing.description || '',
                                price: listing.price,
                              });
                            }}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => handleDeleteListing(listing.id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Add to More Platforms */}
                  <div className="p-4 bg-gray-50 dark:bg-neutral-800/50">
                    <p className="text-sm text-gray-600 dark:text-neutral-400 mb-2">
                      Add to more platforms:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {Object.keys(PLATFORM_ICONS).map((platform) => {
                        const isListed = group.listings.some((l) => l.platform === platform);
                        if (isListed) return null;
                        return (
                          <Button
                            key={platform}
                            variant="secondary"
                            onClick={async () => {
                              setIsCreating(true);
                              try {
                                const res = await fetch(`${API_BASE}/api/cross-listings`, {
                                  method: 'POST',
                                  headers: {
                                    'Content-Type': 'application/json',
                                    ...getAuthHeaders(),
                                  },
                                  body: JSON.stringify({
                                    inventory_id: group.inventory_id,
                                    platforms: [platform],
                                  }),
                                });
                                if (res.ok) {
                                  fetchData();
                                }
                              } catch (err) {
                                setError('Failed to add listing');
                              }
                              setIsCreating(false);
                            }}
                            disabled={isCreating}
                            className="text-sm"
                          >
                            {PLATFORM_ICONS[platform]} {platform}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </Card>
          ))
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Cross-Post Item
              </h2>

              {/* Select Inventory */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">
                  Select Item
                </label>
                <select
                  value={selectedInventoryId || ''}
                  onChange={(e) => setSelectedInventoryId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-gray-900 dark:text-white"
                >
                  <option value="">Select an item...</option>
                  {availableInventory.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title} - £{item.selling_price?.toFixed(2) || '0.00'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Select Platforms */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">
                  Select Platforms
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {platforms.map((platform) => (
                    <button
                      key={platform.id}
                      onClick={() => {
                        if (selectedPlatforms.includes(platform.id)) {
                          setSelectedPlatforms(selectedPlatforms.filter((p) => p !== platform.id));
                        } else {
                          setSelectedPlatforms([...selectedPlatforms, platform.id]);
                        }
                      }}
                      className={`p-3 rounded-lg border-2 flex items-center gap-2 transition-all ${ selectedPlatforms.includes(platform.id) ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-gray-200 dark:border-neutral-700 hover:border-gray-300' }`}
                    >
                      <span className="text-xl">{PLATFORM_ICONS[platform.id]}</span>
                      <div className="text-left">
                        <p className="font-medium text-gray-900 dark:text-white text-sm">
                          {platform.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {platform.feePercentage > 0 ? `${platform.feePercentage}% fee` : 'No seller fees'}
                        </p>
                      </div>
                      {selectedPlatforms.includes(platform.id) && (
                        <Check className="w-5 h-5 text-primary-500 ml-auto" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowCreateModal(false);
                    setSelectedInventoryId(null);
                    setSelectedPlatforms([]);
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateCrossListings}
                  disabled={!selectedInventoryId || selectedPlatforms.length === 0 || isCreating}
                  className="flex-1"
                >
                  {isCreating ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Plus className="w-4 h-4 mr-2" />
                  )}
                  Create {selectedPlatforms.length} Listing{selectedPlatforms.length !== 1 ? 's' : ''}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingListing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-xl max-w-lg w-full">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Edit {editingListing.platform} Listing
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">
                    Title
                  </label>
                  <Input
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">
                    Price (£)
                  </label>
                  <Input
                    type="number"
                    value={editForm.price}
                    onChange={(e) => setEditForm({ ...editForm, price: parseFloat(e.target.value) || 0 })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">
                    Description
                  </label>
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <Button variant="secondary" onClick={() => setEditingListing(null)} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={handleUpdateListing} className="flex-1">
                  Save Changes
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sell Modal */}
      {sellModalItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Mark as Sold
              </h2>
              <p className="text-gray-600 dark:text-neutral-400 mb-4">
                Other platform listings will be automatically delisted.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">
                    Sold On
                  </label>
                  <select
                    value={sellForm.platform}
                    onChange={(e) => setSellForm({ ...sellForm, platform: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-gray-900 dark:text-white"
                  >
                    <option value="">Select platform...</option>
                    {sellModalItem.listings.filter((l) => l.status === 'active').map((l) => (
                      <option key={l.platform} value={l.platform}>
                        {PLATFORM_ICONS[l.platform]} {l.platform}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">
                    Sold Price (£)
                  </label>
                  <Input
                    type="number"
                    value={sellForm.price}
                    onChange={(e) => setSellForm({ ...sellForm, price: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <Button variant="secondary" onClick={() => setSellModalItem(null)} className="flex-1">
                  Cancel
                </Button>
                <Button
                  onClick={handleMarkSold}
                  disabled={!sellForm.platform || !sellForm.price}
                  className="flex-1"
                >
                  <DollarSign className="w-4 h-4 mr-2" />
                  Mark as Sold
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Copy Modal */}
      {copyModalListing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Copy Listing for {copyModalListing.listing.platform}
                </h2>
                <Button variant="ghost" onClick={() => setCopyModalListing(null)}>
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <div className="bg-gray-100 dark:bg-neutral-700 rounded-lg p-4 font-mono text-sm whitespace-pre-wrap">
                {copyModalListing.text}
              </div>

              <div className="flex gap-3 mt-6">
                <Button variant="secondary" onClick={() => setCopyModalListing(null)} className="flex-1">
                  Close
                </Button>
                <Button
                  onClick={() => {
                    copyToClipboard(copyModalListing.text);
                    setCopyModalListing(null);
                  }}
                  className="flex-1"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy to Clipboard
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CrossListingManager;
