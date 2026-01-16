/**
 * Arbitrage Scanner Service
 * Real-time cross-platform arbitrage opportunity detection
 * Finds items cheap on one platform that sell for more on another
 */

import * as cheerio from 'cheerio';
import supabase from '../config/supabase.js';
import { calculateFees } from './feeCalculatorService.js';

export interface ArbitrageOpportunity {
  id: string;
  buy_platform: string;
  buy_price: number;
  buy_url: string;
  buy_title: string;
  buy_image: string | null;
  buy_location: string | null;
  buy_condition: string | null;
  buy_seller: string | null;

  sell_platform: string;
  sell_price: number; // Median sold price
  sell_price_range: { min: number; max: number };
  sold_count: number;

  profit: number;
  profit_after_fees: number;
  roi_percent: number;
  fee_breakdown: {
    platform_fee: number;
    payment_fee: number;
    total_fees: number;
  };

  confidence: 'high' | 'medium' | 'low';
  score: number; // 0-100

  // For map view
  coordinates: { lat: number; lng: number } | null;
  distance_miles: number | null;

  found_at: string;
  expires_at: string;
}

export interface ArbitrageScanResult {
  query: string;
  buy_platform: string;
  sell_platform: string;
  opportunities: ArbitrageOpportunity[];
  stats: {
    listings_scanned: number;
    opportunities_found: number;
    best_profit: number;
    best_roi: number;
    avg_profit: number;
  };
  scan_duration_ms: number;
  scanned_at: string;
}

export interface ScannerConfig {
  min_profit: number;
  min_roi: number;
  max_buy_price: number;
  include_shipping: boolean;
  local_only: boolean;
  user_location?: { lat: number; lng: number; postcode: string };
  max_distance_miles?: number;
}

// UK location lookup for postcode -> coordinates
const UK_CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  'london': { lat: 51.5074, lng: -0.1278 },
  'manchester': { lat: 53.4808, lng: -2.2426 },
  'birmingham': { lat: 52.4862, lng: -1.8904 },
  'leeds': { lat: 53.8008, lng: -1.5491 },
  'liverpool': { lat: 53.4084, lng: -2.9916 },
  'bristol': { lat: 51.4545, lng: -2.5879 },
  'sheffield': { lat: 53.3811, lng: -1.4701 },
  'newcastle': { lat: 54.9783, lng: -1.6178 },
  'nottingham': { lat: 52.9548, lng: -1.1581 },
  'glasgow': { lat: 55.8642, lng: -4.2518 },
  'edinburgh': { lat: 55.9533, lng: -3.1883 },
  'cardiff': { lat: 51.4816, lng: -3.1791 },
  'belfast': { lat: 54.5973, lng: -5.9301 },
  'brighton': { lat: 50.8225, lng: -0.1372 },
  'reading': { lat: 51.4543, lng: -0.9781 },
  'coventry': { lat: 52.4068, lng: -1.5197 },
  'leicester': { lat: 52.6369, lng: -1.1398 },
};

// Estimate coordinates from location string
function estimateCoordinates(location: string | null): { lat: number; lng: number } | null {
  if (!location) return null;

  const locationLower = location.toLowerCase();

  for (const [city, coords] of Object.entries(UK_CITY_COORDS)) {
    if (locationLower.includes(city)) {
      return coords;
    }
  }

  // Try to match UK postcode area
  const postcodeMatch = location.match(/([A-Z]{1,2})\d/i);
  if (postcodeMatch) {
    const area = postcodeMatch[1].toUpperCase();
    // Basic postcode area mapping
    const postcodeAreas: Record<string, { lat: number; lng: number }> = {
      'SW': { lat: 51.47, lng: -0.17 },
      'SE': { lat: 51.48, lng: -0.05 },
      'NW': { lat: 51.55, lng: -0.20 },
      'N': { lat: 51.57, lng: -0.10 },
      'E': { lat: 51.53, lng: 0.02 },
      'W': { lat: 51.51, lng: -0.22 },
      'EC': { lat: 51.52, lng: -0.09 },
      'WC': { lat: 51.52, lng: -0.12 },
      'M': { lat: 53.48, lng: -2.24 },
      'B': { lat: 52.48, lng: -1.89 },
      'L': { lat: 53.41, lng: -2.99 },
      'S': { lat: 53.38, lng: -1.47 },
      'LS': { lat: 53.80, lng: -1.55 },
      'BS': { lat: 51.45, lng: -2.59 },
      'G': { lat: 55.86, lng: -4.25 },
      'EH': { lat: 55.95, lng: -3.19 },
      'CF': { lat: 51.48, lng: -3.18 },
      'BT': { lat: 54.60, lng: -5.93 },
    };

    if (postcodeAreas[area]) {
      return postcodeAreas[area];
    }
  }

  return null;
}

// Calculate distance between two coordinates (Haversine formula)
function calculateDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Generate unique ID for opportunity
function generateOpportunityId(platform: string, url: string): string {
  const hash = url.split('/').pop() || Math.random().toString(36).substr(2, 9);
  return `${platform.toLowerCase()}-${hash}`;
}

// Scrape active listings from various platforms
async function scrapeActiveListings(
  query: string,
  platform: string,
  maxResults: number = 30
): Promise<Array<{
  title: string;
  price: number;
  url: string;
  image: string | null;
  location: string | null;
  condition: string | null;
  seller: string | null;
}>> {
  const encodedQuery = encodeURIComponent(query);

  switch (platform.toLowerCase()) {
    case 'ebay': {
      const url = `https://www.ebay.co.uk/sch/i.html?_nkw=${encodedQuery}&_sop=15&rt=nc&_ipg=60`;
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html',
          }
        });

        if (!response.ok) return [];

        const html = await response.text();
        const $ = cheerio.load(html);
        const listings: any[] = [];

        $('li.s-item').each((_, el) => {
          if (listings.length >= maxResults) return false;

          const $item = $(el);
          const title = $item.find('.s-item__title span').first().text().trim() ||
                       $item.find('.s-item__title').first().text().trim();

          if (!title || title.includes('Shop on eBay')) return;

          const priceText = $item.find('.s-item__price').first().text();
          const priceMatch = priceText.match(/£([\d,]+\.?\d*)/);
          if (!priceMatch) return;

          const price = parseFloat(priceMatch[1].replace(/,/g, ''));
          if (isNaN(price) || price <= 0) return;

          // Skip auctions
          if ($item.find('.s-item__bids').text().toLowerCase().includes('bid')) return;

          listings.push({
            title,
            price,
            url: $item.find('a.s-item__link').attr('href') || '',
            image: $item.find('.s-item__image-img').attr('src') || null,
            location: $item.find('.s-item__location').text().replace('from ', '') || null,
            condition: $item.find('.SECONDARY_INFO').first().text() || null,
            seller: null,
          });
        });

        return listings;
      } catch (err) {
        console.error('eBay scrape error:', err);
        return [];
      }
    }

    case 'vinted': {
      const url = `https://www.vinted.co.uk/catalog?search_text=${encodedQuery}&order=price_low_to_high`;
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html',
          }
        });

        if (!response.ok) return [];

        const html = await response.text();
        const $ = cheerio.load(html);
        const listings: any[] = [];

        $('[data-testid="grid-item"], .feed-grid__item').each((_, el) => {
          if (listings.length >= maxResults) return false;

          const $item = $(el);

          // Skip sold
          if ($item.text().toLowerCase().includes('sold')) return;

          const title = $item.find('[data-testid="item-title"], h3').text().trim() ||
                       $item.find('a').attr('title') || '';
          if (!title) return;

          const priceText = $item.find('[data-testid="item-price"], [class*="price"]').text();
          const priceMatch = priceText.match(/£([\d,]+\.?\d*)/);
          if (!priceMatch) return;

          const price = parseFloat(priceMatch[1].replace(/,/g, ''));
          if (isNaN(price) || price <= 0) return;

          let itemUrl = $item.find('a').first().attr('href') || '';
          if (itemUrl && !itemUrl.startsWith('http')) {
            itemUrl = `https://www.vinted.co.uk${itemUrl}`;
          }

          listings.push({
            title,
            price,
            url: itemUrl,
            image: $item.find('img').attr('src') || null,
            location: null, // Vinted doesn't show location in grid
            condition: null,
            seller: null,
          });
        });

        return listings;
      } catch (err) {
        console.error('Vinted scrape error:', err);
        return [];
      }
    }

    case 'gumtree': {
      const url = `https://www.gumtree.com/search?search_category=all&q=${encodedQuery}&sort=price_lowest_first`;
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html',
          }
        });

        if (!response.ok) return [];

        const html = await response.text();
        const $ = cheerio.load(html);
        const listings: any[] = [];

        $('[data-q="search-result"], .listing-link').each((_, el) => {
          if (listings.length >= maxResults) return false;

          const $item = $(el);
          const title = $item.find('[data-q="tile-title"], .listing-title').text().trim();
          if (!title) return;

          const priceText = $item.find('[data-q="tile-price"], .listing-price').text();
          const priceMatch = priceText.match(/£([\d,]+\.?\d*)/);
          if (!priceMatch) return;

          const price = parseFloat(priceMatch[1].replace(/,/g, ''));
          if (isNaN(price) || price <= 0) return;

          let itemUrl = $item.attr('href') || $item.find('a').first().attr('href') || '';
          if (itemUrl && !itemUrl.startsWith('http')) {
            itemUrl = `https://www.gumtree.com${itemUrl}`;
          }

          listings.push({
            title,
            price,
            url: itemUrl,
            image: $item.find('img').attr('src') || null,
            location: $item.find('[data-q="tile-location"], .listing-location').text().trim() || null,
            condition: null,
            seller: null,
          });
        });

        return listings;
      } catch (err) {
        console.error('Gumtree scrape error:', err);
        return [];
      }
    }

    case 'facebook':
    case 'shpock':
    case 'depop':
    default:
      console.log(`Platform ${platform} scraper not implemented`);
      return [];
  }
}

// Get sold price data for a platform
async function getSoldPriceData(
  query: string,
  platform: string
): Promise<{
  prices: number[];
  count: number;
  median: number;
  min: number;
  max: number;
}> {
  const encodedQuery = encodeURIComponent(query);

  switch (platform.toLowerCase()) {
    case 'ebay': {
      const url = `https://www.ebay.co.uk/sch/i.html?_nkw=${encodedQuery}&LH_Sold=1&LH_Complete=1&_sop=13&_ipg=60`;
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html',
          }
        });

        if (!response.ok) return { prices: [], count: 0, median: 0, min: 0, max: 0 };

        const html = await response.text();
        const $ = cheerio.load(html);
        const prices: number[] = [];

        $('li.s-item').each((_, el) => {
          const priceText = $(el).find('.s-item__price').first().text();
          const priceMatch = priceText.match(/£([\d,]+\.?\d*)/);
          if (priceMatch) {
            const price = parseFloat(priceMatch[1].replace(/,/g, ''));
            if (!isNaN(price) && price > 0) {
              prices.push(price);
            }
          }
        });

        if (prices.length === 0) return { prices: [], count: 0, median: 0, min: 0, max: 0 };

        const sorted = [...prices].sort((a, b) => a - b);
        const median = sorted.length % 2 === 0
          ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
          : sorted[Math.floor(sorted.length / 2)];

        return {
          prices,
          count: prices.length,
          median: Math.round(median * 100) / 100,
          min: sorted[0],
          max: sorted[sorted.length - 1],
        };
      } catch (err) {
        console.error('eBay sold data error:', err);
        return { prices: [], count: 0, median: 0, min: 0, max: 0 };
      }
    }

    default:
      // Default to eBay sold data for comparison
      return getSoldPriceData(query, 'ebay');
  }
}

// Main arbitrage scan function
export async function scanForArbitrage(
  query: string,
  buyPlatform: string,
  sellPlatform: string,
  config: ScannerConfig
): Promise<ArbitrageScanResult> {
  const startTime = Date.now();
  const opportunities: ArbitrageOpportunity[] = [];

  console.log(`Scanning arbitrage: "${query}" | Buy: ${buyPlatform} → Sell: ${sellPlatform}`);

  // Scrape active listings from buy platform
  const activeListings = await scrapeActiveListings(query, buyPlatform, 40);

  // Get sold price data from sell platform
  const soldData = await getSoldPriceData(query, sellPlatform);

  if (activeListings.length === 0 || soldData.count === 0) {
    return {
      query,
      buy_platform: buyPlatform,
      sell_platform: sellPlatform,
      opportunities: [],
      stats: {
        listings_scanned: activeListings.length,
        opportunities_found: 0,
        best_profit: 0,
        best_roi: 0,
        avg_profit: 0,
      },
      scan_duration_ms: Date.now() - startTime,
      scanned_at: new Date().toISOString(),
    };
  }

  // Analyze each listing for arbitrage potential
  for (const listing of activeListings) {
    // Skip if above max buy price
    if (config.max_buy_price && listing.price > config.max_buy_price) continue;

    // Calculate fees on sell platform
    const feeResult = calculateFees(soldData.median, sellPlatform, 0);

    // Calculate profit
    const grossProfit = soldData.median - listing.price;
    const netProfit = grossProfit - feeResult.total_fees;
    const roi = (netProfit / listing.price) * 100;

    // Skip if doesn't meet thresholds
    if (netProfit < config.min_profit) continue;
    if (roi < config.min_roi) continue;

    // Get coordinates for map
    const coordinates = estimateCoordinates(listing.location);
    let distanceMiles: number | null = null;

    if (coordinates && config.user_location) {
      distanceMiles = calculateDistance(
        config.user_location.lat,
        config.user_location.lng,
        coordinates.lat,
        coordinates.lng
      );

      // Skip if too far for local-only mode
      if (config.local_only && config.max_distance_miles && distanceMiles > config.max_distance_miles) {
        continue;
      }
    }

    // Calculate confidence based on sold data
    let confidence: 'high' | 'medium' | 'low' = 'low';
    if (soldData.count >= 20) confidence = 'high';
    else if (soldData.count >= 10) confidence = 'medium';

    // Calculate score (0-100)
    let score = 0;
    // ROI contribution (40 points max)
    score += Math.min(40, roi * 0.4);
    // Profit margin contribution (30 points max)
    score += Math.min(30, (netProfit / soldData.median) * 100);
    // Confidence contribution (20 points max)
    score += confidence === 'high' ? 20 : confidence === 'medium' ? 10 : 5;
    // Local bonus (10 points)
    if (distanceMiles && distanceMiles < 30) score += 10;

    score = Math.round(Math.min(100, Math.max(0, score)));

    opportunities.push({
      id: generateOpportunityId(buyPlatform, listing.url),
      buy_platform: buyPlatform,
      buy_price: listing.price,
      buy_url: listing.url,
      buy_title: listing.title,
      buy_image: listing.image,
      buy_location: listing.location,
      buy_condition: listing.condition,
      buy_seller: listing.seller,

      sell_platform: sellPlatform,
      sell_price: soldData.median,
      sell_price_range: { min: soldData.min, max: soldData.max },
      sold_count: soldData.count,

      profit: Math.round(grossProfit * 100) / 100,
      profit_after_fees: Math.round(netProfit * 100) / 100,
      roi_percent: Math.round(roi * 10) / 10,
      fee_breakdown: {
        platform_fee: feeResult.platform_fee,
        payment_fee: feeResult.payment_processing_fee,
        total_fees: feeResult.total_fees,
      },

      confidence,
      score,

      coordinates,
      distance_miles: distanceMiles ? Math.round(distanceMiles * 10) / 10 : null,

      found_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(), // 6 hours
    });
  }

  // Sort by score (best first)
  opportunities.sort((a, b) => b.score - a.score);

  // Calculate stats
  const topOpps = opportunities.slice(0, 30);
  const avgProfit = topOpps.length > 0
    ? topOpps.reduce((sum, o) => sum + o.profit_after_fees, 0) / topOpps.length
    : 0;

  return {
    query,
    buy_platform: buyPlatform,
    sell_platform: sellPlatform,
    opportunities: topOpps,
    stats: {
      listings_scanned: activeListings.length,
      opportunities_found: opportunities.length,
      best_profit: opportunities[0]?.profit_after_fees || 0,
      best_roi: opportunities[0]?.roi_percent || 0,
      avg_profit: Math.round(avgProfit * 100) / 100,
    },
    scan_duration_ms: Date.now() - startTime,
    scanned_at: new Date().toISOString(),
  };
}

// Quick scan across multiple platform combinations
export async function multiPlatformScan(
  query: string,
  config: ScannerConfig
): Promise<ArbitrageScanResult[]> {
  const platformPairs = [
    { buy: 'Vinted', sell: 'eBay' },
    { buy: 'Gumtree', sell: 'eBay' },
    { buy: 'eBay', sell: 'eBay' }, // Same platform, different pricing
  ];

  const results: ArbitrageScanResult[] = [];

  for (const pair of platformPairs) {
    const result = await scanForArbitrage(query, pair.buy, pair.sell, config);
    results.push(result);

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return results;
}

// Save opportunity to user's watchlist
export async function saveOpportunityToWatchlist(
  userId: string,
  opportunity: ArbitrageOpportunity
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('watchlist')
      .insert({
        user_id: userId,
        title: opportunity.buy_title,
        url: opportunity.buy_url,
        platform: opportunity.buy_platform,
        current_price: opportunity.buy_price,
        target_price: opportunity.sell_price,
        notes: `Arbitrage opportunity: Buy for £${opportunity.buy_price}, sell on ${opportunity.sell_platform} for ~£${opportunity.sell_price}. Expected profit: £${opportunity.profit_after_fees}`,
        created_at: new Date().toISOString(),
      });

    return !error;
  } catch (err) {
    console.error('Failed to save to watchlist:', err);
    return false;
  }
}

// Create inventory draft from opportunity
export async function createDraftFromOpportunity(
  userId: string,
  opportunity: ArbitrageOpportunity
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('inventory')
      .insert({
        user_id: userId,
        title: opportunity.buy_title,
        description: `Arbitrage opportunity found on ${opportunity.buy_platform}`,
        purchase_price: opportunity.buy_price,
        purchase_platform: opportunity.buy_platform,
        selling_price: opportunity.sell_price,
        condition: opportunity.buy_condition || 'Good',
        status: 'draft',
        notes: `ROI: ${opportunity.roi_percent}% | Profit: £${opportunity.profit_after_fees} | Source: ${opportunity.buy_url}`,
        images: opportunity.buy_image ? [opportunity.buy_image] : null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    return data?.id || null;
  } catch (err) {
    console.error('Failed to create draft:', err);
    return null;
  }
}
