/**
 * Cross-Platform Listing Service
 * Manages listings across multiple marketplaces (eBay, Vinted, Depop, etc.)
 * Handles sync, cross-posting, and auto-delisting when sold
 */

import supabase from '../config/supabase.js';
import { InventoryItem, Listing } from '../types/index.js';
import { generateListingDescription, DescriptionInput } from './aiService.js';
import { calculateFees } from './feeCalculatorService.js';

export type Platform = 'eBay' | 'Vinted' | 'Depop' | 'Facebook' | 'Gumtree' | 'Shpock';

export interface CrossListing {
  id: string;
  inventory_id: string;
  user_id: string;
  platform: Platform;
  external_listing_id: string | null;
  title: string;
  description: string | null;
  price: number;
  url: string | null;
  status: 'draft' | 'active' | 'sold' | 'ended' | 'error';
  error_message: string | null;
  listed_at: string | null;
  synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrossListingGroup {
  inventory_id: string;
  inventory: InventoryItem;
  listings: CrossListing[];
  active_platforms: Platform[];
  total_views: number;
}

// Platform-specific configuration
export const PLATFORM_CONFIG: Record<Platform, {
  name: string;
  maxTitleLength: number;
  maxDescriptionLength: number;
  feePercentage: number;
  supportsDirectPosting: boolean;
  seoKeywords: string[];
}> = {
  eBay: {
    name: 'eBay',
    maxTitleLength: 80,
    maxDescriptionLength: 4000,
    feePercentage: 12.8,
    supportsDirectPosting: true,
    seoKeywords: ['free shipping', 'fast dispatch', 'authentic', 'genuine'],
  },
  Vinted: {
    name: 'Vinted',
    maxTitleLength: 100,
    maxDescriptionLength: 2000,
    feePercentage: 0, // Buyer pays
    supportsDirectPosting: false,
    seoKeywords: ['vintage', 'y2k', 'retro', 'preloved'],
  },
  Depop: {
    name: 'Depop',
    maxTitleLength: 150,
    maxDescriptionLength: 1000,
    feePercentage: 10,
    supportsDirectPosting: false,
    seoKeywords: ['vintage', 'streetwear', 'rare', 'deadstock'],
  },
  Facebook: {
    name: 'Facebook Marketplace',
    maxTitleLength: 100,
    maxDescriptionLength: 2500,
    feePercentage: 5,
    supportsDirectPosting: false,
    seoKeywords: ['local pickup', 'collection only', 'like new'],
  },
  Gumtree: {
    name: 'Gumtree',
    maxTitleLength: 60,
    maxDescriptionLength: 4000,
    feePercentage: 0,
    supportsDirectPosting: false,
    seoKeywords: ['local', 'collection', 'bargain'],
  },
  Shpock: {
    name: 'Shpock',
    maxTitleLength: 100,
    maxDescriptionLength: 1000,
    feePercentage: 10,
    supportsDirectPosting: false,
    seoKeywords: ['nearly new', 'great condition', 'bargain'],
  },
};

/**
 * Get all cross-listings for a user
 */
export async function getUserCrossListings(
  userId: string,
  status?: string
): Promise<CrossListingGroup[]> {
  let query = supabase
    .from('cross_listings')
    .select(`
      *,
      inventory:inventory_id (*)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch cross-listings: ${error.message}`);
  }

  // Group by inventory_id
  const groups = new Map<string, CrossListingGroup>();

  for (const listing of data || []) {
    const inventoryId = listing.inventory_id;

    if (!groups.has(inventoryId)) {
      groups.set(inventoryId, {
        inventory_id: inventoryId,
        inventory: listing.inventory,
        listings: [],
        active_platforms: [],
        total_views: 0,
      });
    }

    const group = groups.get(inventoryId)!;
    group.listings.push(listing);

    if (listing.status === 'active') {
      group.active_platforms.push(listing.platform);
    }
  }

  return Array.from(groups.values());
}

/**
 * Get cross-listings for a specific inventory item
 */
export async function getInventoryCrossListings(
  inventoryId: string,
  userId: string
): Promise<CrossListing[]> {
  const { data, error } = await supabase
    .from('cross_listings')
    .select('*')
    .eq('inventory_id', inventoryId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch cross-listings: ${error.message}`);
  }

  return data || [];
}

/**
 * Generate platform-optimized listing content
 */
export async function generatePlatformListing(
  inventory: InventoryItem,
  platform: Platform
): Promise<{ title: string; description: string; price: number }> {
  const config = PLATFORM_CONFIG[platform];

  // Generate AI description with platform-specific keywords
  const descInput: DescriptionInput = {
    title: inventory.title,
    category: inventory.category || undefined,
    condition: inventory.condition || undefined,
    brand: inventory.brand || undefined,
    keywords: config.seoKeywords,
  };

  const generated = await generateListingDescription(descInput);

  // Truncate title to platform max length
  let optimizedTitle = inventory.title;
  if (optimizedTitle.length > config.maxTitleLength) {
    optimizedTitle = optimizedTitle.substring(0, config.maxTitleLength - 3) + '...';
  }

  // Add platform-specific prefixes for SEO
  if (platform === 'Depop' || platform === 'Vinted') {
    // These platforms favor certain keywords
    const condition = inventory.condition?.toLowerCase() || '';
    if (!optimizedTitle.toLowerCase().includes(condition) && condition) {
      const prefix = condition.includes('new') ? '🏷️ ' : '✨ ';
      optimizedTitle = prefix + optimizedTitle;
    }
  }

  // Truncate description to platform max
  let description = generated.description;
  if (description.length > config.maxDescriptionLength) {
    description = description.substring(0, config.maxDescriptionLength - 3) + '...';
  }

  // Calculate platform-optimized price
  let price = inventory.selling_price || 0;
  if (config.feePercentage > 0) {
    // Slightly adjust price to account for fees in perception
    // e.g., round to .99 or .95 for psychological pricing
    const roundedPrice = Math.ceil(price) - 0.01;
    price = roundedPrice > 0 ? roundedPrice : price;
  }

  return {
    title: optimizedTitle,
    description,
    price,
  };
}

/**
 * Create cross-listings for multiple platforms at once
 */
export async function createCrossListings(
  inventoryId: string,
  userId: string,
  platforms: Platform[],
  customData?: Partial<{
    title: string;
    description: string;
    price: number;
  }>
): Promise<CrossListing[]> {
  // Get inventory item
  const { data: inventory, error: invError } = await supabase
    .from('inventory')
    .select('*')
    .eq('id', inventoryId)
    .eq('user_id', userId)
    .single();

  if (invError || !inventory) {
    throw new Error('Inventory item not found');
  }

  // Check for existing active listings on these platforms
  const { data: existing } = await supabase
    .from('cross_listings')
    .select('platform')
    .eq('inventory_id', inventoryId)
    .eq('status', 'active');

  const existingPlatforms = new Set(existing?.map(e => e.platform) || []);
  const newPlatforms = platforms.filter(p => !existingPlatforms.has(p));

  if (newPlatforms.length === 0) {
    throw new Error('Listings already exist on all selected platforms');
  }

  // Generate platform-specific content for each
  const listings: Omit<CrossListing, 'id' | 'created_at' | 'updated_at'>[] = [];

  for (const platform of newPlatforms) {
    const generated = await generatePlatformListing(inventory, platform);

    listings.push({
      inventory_id: inventoryId,
      user_id: userId,
      platform,
      external_listing_id: null,
      title: customData?.title || generated.title,
      description: customData?.description || generated.description,
      price: customData?.price || generated.price,
      url: null,
      status: 'draft',
      error_message: null,
      listed_at: null,
      synced_at: new Date().toISOString(),
    });
  }

  // Insert all listings
  const { data, error } = await supabase
    .from('cross_listings')
    .insert(listings)
    .select();

  if (error) {
    throw new Error(`Failed to create cross-listings: ${error.message}`);
  }

  // Update inventory status if draft
  await supabase
    .from('inventory')
    .update({ status: 'listed', updated_at: new Date().toISOString() })
    .eq('id', inventoryId)
    .eq('status', 'draft');

  return data || [];
}

/**
 * Update a cross-listing
 */
export async function updateCrossListing(
  listingId: string,
  userId: string,
  updateData: Partial<Pick<CrossListing, 'title' | 'description' | 'price' | 'status' | 'url' | 'external_listing_id'>>
): Promise<CrossListing> {
  // Verify ownership
  const { data: existing, error: findError } = await supabase
    .from('cross_listings')
    .select('*')
    .eq('id', listingId)
    .eq('user_id', userId)
    .single();

  if (findError || !existing) {
    throw new Error('Cross-listing not found');
  }

  const { data, error } = await supabase
    .from('cross_listings')
    .update({
      ...updateData,
      updated_at: new Date().toISOString(),
      synced_at: new Date().toISOString(),
    })
    .eq('id', listingId)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to update cross-listing: ${error?.message}`);
  }

  return data;
}

/**
 * Mark an item as sold and auto-delist from other platforms
 */
export async function markSoldAndSync(
  inventoryId: string,
  userId: string,
  soldPlatform: Platform,
  soldPrice: number
): Promise<{
  inventory: InventoryItem;
  delistedPlatforms: Platform[];
}> {
  // Get all active listings for this inventory
  const { data: activeListings, error: listingsError } = await supabase
    .from('cross_listings')
    .select('*')
    .eq('inventory_id', inventoryId)
    .eq('user_id', userId)
    .eq('status', 'active');

  if (listingsError) {
    throw new Error(`Failed to fetch listings: ${listingsError.message}`);
  }

  const delistedPlatforms: Platform[] = [];

  // Mark all other listings as ended
  for (const listing of activeListings || []) {
    if (listing.platform === soldPlatform) {
      // Mark this one as sold
      await supabase
        .from('cross_listings')
        .update({
          status: 'sold',
          updated_at: new Date().toISOString(),
        })
        .eq('id', listing.id);
    } else {
      // Mark others as ended (delisted)
      await supabase
        .from('cross_listings')
        .update({
          status: 'ended',
          updated_at: new Date().toISOString(),
        })
        .eq('id', listing.id);
      delistedPlatforms.push(listing.platform);
    }
  }

  // Calculate fees
  const fees = calculateFees(soldPrice, soldPlatform, 0);

  // Update inventory item to sold
  const { data: inventory, error: invError } = await supabase
    .from('inventory')
    .update({
      status: 'sold',
      sold_price: soldPrice,
      sold_platform: soldPlatform,
      sold_date: new Date().toISOString().split('T')[0],
      fees_total: fees.total_fees,
      updated_at: new Date().toISOString(),
    })
    .eq('id', inventoryId)
    .eq('user_id', userId)
    .select()
    .single();

  if (invError || !inventory) {
    throw new Error(`Failed to update inventory: ${invError?.message}`);
  }

  return {
    inventory,
    delistedPlatforms,
  };
}

/**
 * Delete a cross-listing
 */
export async function deleteCrossListing(
  listingId: string,
  userId: string
): Promise<void> {
  // Verify ownership
  const { data: existing, error: findError } = await supabase
    .from('cross_listings')
    .select('id')
    .eq('id', listingId)
    .eq('user_id', userId)
    .single();

  if (findError || !existing) {
    throw new Error('Cross-listing not found');
  }

  const { error } = await supabase
    .from('cross_listings')
    .delete()
    .eq('id', listingId);

  if (error) {
    throw new Error(`Failed to delete cross-listing: ${error.message}`);
  }
}

/**
 * Bulk update listings across platforms
 */
export async function bulkUpdateListings(
  inventoryId: string,
  userId: string,
  updateData: {
    price?: number;
    status?: 'active' | 'ended';
  },
  platforms?: Platform[]
): Promise<CrossListing[]> {
  let query = supabase
    .from('cross_listings')
    .update({
      ...updateData,
      updated_at: new Date().toISOString(),
      synced_at: new Date().toISOString(),
    })
    .eq('inventory_id', inventoryId)
    .eq('user_id', userId);

  if (platforms && platforms.length > 0) {
    query = query.in('platform', platforms);
  }

  const { data, error } = await query.select();

  if (error) {
    throw new Error(`Failed to bulk update listings: ${error.message}`);
  }

  return data || [];
}

/**
 * Get statistics for cross-platform listings
 */
export async function getCrossListingStats(userId: string): Promise<{
  total_listings: number;
  active_listings: number;
  platforms_used: Platform[];
  listings_by_platform: Record<Platform, number>;
  items_cross_listed: number;
}> {
  const { data, error } = await supabase
    .from('cross_listings')
    .select('platform, status, inventory_id')
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to fetch stats: ${error.message}`);
  }

  const listings = data || [];
  const platformCounts: Record<string, number> = {};
  const inventoryIds = new Set<string>();

  for (const listing of listings) {
    platformCounts[listing.platform] = (platformCounts[listing.platform] || 0) + 1;
    inventoryIds.add(listing.inventory_id);
  }

  return {
    total_listings: listings.length,
    active_listings: listings.filter(l => l.status === 'active').length,
    platforms_used: Object.keys(platformCounts) as Platform[],
    listings_by_platform: platformCounts as Record<Platform, number>,
    items_cross_listed: inventoryIds.size,
  };
}

/**
 * Generate copy-paste ready listing for manual posting
 */
export function generateCopyPasteListing(
  listing: CrossListing,
  inventory: InventoryItem
): string {
  const lines: string[] = [];

  lines.push(`📋 ${listing.platform} LISTING`);
  lines.push('═'.repeat(40));
  lines.push('');
  lines.push(`TITLE:`);
  lines.push(listing.title);
  lines.push('');
  lines.push(`PRICE: £${listing.price.toFixed(2)}`);
  lines.push('');
  lines.push(`DESCRIPTION:`);
  lines.push(listing.description || '');
  lines.push('');

  if (inventory.condition) {
    lines.push(`CONDITION: ${inventory.condition}`);
  }
  if (inventory.brand) {
    lines.push(`BRAND: ${inventory.brand}`);
  }
  if (inventory.category) {
    lines.push(`CATEGORY: ${inventory.category}`);
  }

  lines.push('');
  lines.push('═'.repeat(40));
  lines.push('Copy the above to paste into ' + listing.platform);

  return lines.join('\n');
}
