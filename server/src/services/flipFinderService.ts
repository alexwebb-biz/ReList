import * as cheerio from 'cheerio';
import { searchEbaySoldListings, searchVintedSoldListings } from './marketResearchService.js';

export interface ActiveListing {
  title: string;
  price: number;
  currency: string;
  url: string;
  image_url: string | null;
  platform: string;
  location?: string;
  condition?: string;
  seller?: string;
  listed_date?: string;
}

export interface FlipOpportunity {
  listing: ActiveListing;
  market_data: {
    avg_sold_price: number;
    median_sold_price: number;
    min_sold_price: number;
    max_sold_price: number;
    sold_count: number;
  };
  profit_analysis: {
    estimated_profit: number;
    profit_margin_percent: number;
    roi_percent: number;
    confidence: 'high' | 'medium' | 'low';
    risk_level: 'low' | 'medium' | 'high';
  };
  recommendation: string;
  score: number; // 0-100 flip score
}

export interface FlipFinderResult {
  query: string;
  platform: string;
  opportunities: FlipOpportunity[];
  stats: {
    listings_analyzed: number;
    opportunities_found: number;
    avg_profit_margin: number;
    best_roi: number;
  };
  fetched_at: string;
}

// Platform fee percentages for profit calculation
const PLATFORM_FEES: Record<string, number> = {
  'eBay': 0.128, // 12.8% + PayPal
  'Vinted': 0.05, // Buyer pays, but factor in some buffer
  'Depop': 0.10, // 10%
  'Facebook Marketplace': 0.05, // 5% for shipped items
  'Gumtree': 0, // Free listings
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Search active eBay listings (not sold)
async function searchEbayActiveListings(
  query: string,
  maxResults = 30
): Promise<ActiveListing[]> {
  const encodedQuery = encodeURIComponent(query);
  // Remove LH_Sold=1 to get active listings, sort by price ascending
  const url = `https://www.ebay.co.uk/sch/i.html?_nkw=${encodedQuery}&_sop=15&rt=nc&_ipg=60`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-GB,en;q=0.9',
      }
    });

    if (!response.ok) {
      throw new Error(`eBay returned ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const listings: ActiveListing[] = [];

    $('li.s-item').each((_, element) => {
      if (listings.length >= maxResults) return false;

      const $item = $(element);

      // Get title
      const title = $item.find('.s-item__title span').first().text().trim() ||
                    $item.find('.s-item__title').first().text().trim();

      if (!title || title.includes('Shop on eBay') || title === 'Results matching fewer words') return;

      // Get price - take the first/main price (not "to" price for ranges)
      const priceText = $item.find('.s-item__price').first().text().trim();
      const priceMatch = priceText.match(/£([\d,]+\.?\d*)/);
      if (!priceMatch) return;

      const price = parseFloat(priceMatch[1].replace(/,/g, ''));
      if (isNaN(price) || price <= 0) return;

      // Skip auctions (look for "bids" text)
      const bidText = $item.find('.s-item__bids, .s-item__bid').text().toLowerCase();
      if (bidText.includes('bid')) return;

      // Get condition
      const condition = $item.find('.SECONDARY_INFO').first().text().trim() || 'Unknown';

      // Get URL
      let itemUrl = $item.find('a.s-item__link').attr('href') || '';
      if (itemUrl) {
        try {
          const urlObj = new URL(itemUrl);
          urlObj.search = '';
          itemUrl = urlObj.toString();
        } catch {}
      }

      // Get image
      const imageUrl = $item.find('.s-item__image-img').attr('data-src') ||
                       $item.find('.s-item__image-img').attr('src') || null;

      // Get location
      const location = $item.find('.s-item__location').text().replace('from ', '').trim() || undefined;

      listings.push({
        title,
        price,
        currency: 'GBP',
        url: itemUrl,
        image_url: imageUrl,
        platform: 'eBay',
        location,
        condition,
      });
    });

    return listings;
  } catch (error) {
    console.error('eBay active listings scrape error:', error);
    return [];
  }
}

// Search active Vinted listings
async function searchVintedActiveListings(
  query: string,
  maxResults = 30
): Promise<ActiveListing[]> {
  const encodedQuery = encodeURIComponent(query);
  // Sort by price ascending to find cheapest first
  const url = `https://www.vinted.co.uk/catalog?search_text=${encodedQuery}&order=price_low_to_high`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-GB,en;q=0.9',
      }
    });

    if (!response.ok) {
      throw new Error(`Vinted returned ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const listings: ActiveListing[] = [];

    $('[data-testid="grid-item"], .feed-grid__item, .ItemBox_container__wrapper').each((_, element) => {
      if (listings.length >= maxResults) return false;

      const $item = $(element);

      // Skip sold items
      const isSold = $item.find('[data-testid="item-sold-badge"], .ItemBox_overlay').length > 0 ||
                     $item.text().toLowerCase().includes('sold');
      if (isSold) return;

      // Get title
      const title = $item.find('[data-testid="item-title"], .ItemBox_title, h3').text().trim() ||
                    $item.find('a').attr('title') || '';
      if (!title) return;

      // Get price
      const priceText = $item.find('[data-testid="item-price"], .ItemBox_price, [class*="price"]').text().trim();
      const priceMatch = priceText.match(/£([\d,]+\.?\d*)/);
      if (!priceMatch) return;

      const price = parseFloat(priceMatch[1].replace(/,/g, ''));
      if (isNaN(price) || price <= 0) return;

      // Get URL
      let itemUrl = $item.find('a').first().attr('href') || '';
      if (itemUrl && !itemUrl.startsWith('http')) {
        itemUrl = `https://www.vinted.co.uk${itemUrl}`;
      }

      // Get image
      const imageUrl = $item.find('img').attr('src') ||
                       $item.find('img').attr('data-src') || null;

      listings.push({
        title,
        price,
        currency: 'GBP',
        url: itemUrl,
        image_url: imageUrl,
        platform: 'Vinted',
      });
    });

    return listings;
  } catch (error) {
    console.error('Vinted active listings scrape error:', error);
    return [];
  }
}

// Search active Facebook Marketplace listings
async function searchFacebookActiveListings(
  query: string,
  maxResults = 20
): Promise<ActiveListing[]> {
  // Facebook Marketplace is harder to scrape - placeholder for future
  // Would need authenticated requests or use their unofficial API
  console.log(`Facebook Marketplace search not implemented for: ${query}`);
  return [];
}

// Analyze a listing against sold data to determine flip potential
function analyzeFlipOpportunity(
  listing: ActiveListing,
  soldPrices: number[],
  soldCount: number
): FlipOpportunity | null {
  if (soldPrices.length === 0) return null;

  const sorted = [...soldPrices].sort((a, b) => a - b);
  const sum = soldPrices.reduce((a, b) => a + b, 0);
  const avgPrice = sum / soldPrices.length;
  const medianPrice = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)];

  // Get platform fee
  const feeRate = PLATFORM_FEES[listing.platform] || 0.10;

  // Calculate potential profit using median (more reliable than average)
  const sellingPrice = medianPrice;
  const fees = sellingPrice * feeRate;
  const estimatedProfit = sellingPrice - listing.price - fees;
  const profitMargin = (estimatedProfit / sellingPrice) * 100;
  const roi = (estimatedProfit / listing.price) * 100;

  // Skip if not profitable
  if (estimatedProfit < 5 || profitMargin < 15) return null;

  // Determine confidence based on sold sample size
  let confidence: 'high' | 'medium' | 'low' = 'low';
  if (soldCount >= 20) confidence = 'high';
  else if (soldCount >= 10) confidence = 'medium';

  // Determine risk level
  let riskLevel: 'low' | 'medium' | 'high' = 'medium';
  const priceVariance = (sorted[sorted.length - 1] - sorted[0]) / medianPrice;

  if (priceVariance < 0.3 && confidence === 'high') {
    riskLevel = 'low';
  } else if (priceVariance > 0.5 || confidence === 'low') {
    riskLevel = 'high';
  }

  // Calculate flip score (0-100)
  let score = 0;

  // Profit margin contribution (up to 40 points)
  score += Math.min(40, profitMargin * 0.8);

  // ROI contribution (up to 30 points)
  score += Math.min(30, roi * 0.3);

  // Confidence contribution (up to 20 points)
  if (confidence === 'high') score += 20;
  else if (confidence === 'medium') score += 10;
  else score += 5;

  // Risk adjustment (up to -10 points)
  if (riskLevel === 'high') score -= 10;
  else if (riskLevel === 'low') score += 10;

  score = Math.round(Math.min(100, Math.max(0, score)));

  // Generate recommendation
  let recommendation = '';
  if (score >= 80) {
    recommendation = 'Excellent flip opportunity! Strong profit potential with low risk.';
  } else if (score >= 60) {
    recommendation = 'Good flip potential. Consider buying if item condition matches.';
  } else if (score >= 40) {
    recommendation = 'Moderate opportunity. Do additional research before committing.';
  } else {
    recommendation = 'Marginal opportunity. Profit margins are tight.';
  }

  return {
    listing,
    market_data: {
      avg_sold_price: Math.round(avgPrice * 100) / 100,
      median_sold_price: Math.round(medianPrice * 100) / 100,
      min_sold_price: sorted[0],
      max_sold_price: sorted[sorted.length - 1],
      sold_count: soldCount,
    },
    profit_analysis: {
      estimated_profit: Math.round(estimatedProfit * 100) / 100,
      profit_margin_percent: Math.round(profitMargin * 10) / 10,
      roi_percent: Math.round(roi * 10) / 10,
      confidence,
      risk_level: riskLevel,
    },
    recommendation,
    score,
  };
}

// Main flip finder function
export async function findFlipOpportunities(
  query: string,
  platforms: string[] = ['eBay'],
  minProfitMargin = 20,
  minScore = 40
): Promise<FlipFinderResult[]> {
  const results: FlipFinderResult[] = [];

  for (const platform of platforms) {
    console.log(`Finding flip opportunities for "${query}" on ${platform}...`);

    let activeListings: ActiveListing[] = [];
    let soldPrices: number[] = [];
    let soldCount = 0;

    // Get active listings and sold data based on platform
    switch (platform.toLowerCase()) {
      case 'ebay': {
        const [active, sold] = await Promise.all([
          searchEbayActiveListings(query, 40),
          searchEbaySoldListings(query, 50),
        ]);
        activeListings = active;
        soldPrices = sold.sold_items.map(i => i.sold_price);
        soldCount = sold.stats.total_sold;
        break;
      }
      case 'vinted': {
        const [active, sold] = await Promise.all([
          searchVintedActiveListings(query, 40),
          searchVintedSoldListings(query, 50),
        ]);
        activeListings = active;
        soldPrices = sold.sold_items.map(i => i.sold_price);
        soldCount = sold.stats.total_sold;
        break;
      }
      default:
        console.log(`Platform ${platform} not supported for flip finder`);
        continue;
    }

    await delay(500); // Rate limiting

    if (activeListings.length === 0 || soldPrices.length === 0) {
      results.push({
        query,
        platform,
        opportunities: [],
        stats: {
          listings_analyzed: activeListings.length,
          opportunities_found: 0,
          avg_profit_margin: 0,
          best_roi: 0,
        },
        fetched_at: new Date().toISOString(),
      });
      continue;
    }

    // Analyze each active listing for flip potential
    const opportunities: FlipOpportunity[] = [];

    for (const listing of activeListings) {
      const opportunity = analyzeFlipOpportunity(listing, soldPrices, soldCount);

      if (opportunity &&
          opportunity.profit_analysis.profit_margin_percent >= minProfitMargin &&
          opportunity.score >= minScore) {
        opportunities.push(opportunity);
      }
    }

    // Sort by score (best opportunities first)
    opportunities.sort((a, b) => b.score - a.score);

    // Calculate stats
    const avgMargin = opportunities.length > 0
      ? opportunities.reduce((sum, o) => sum + o.profit_analysis.profit_margin_percent, 0) / opportunities.length
      : 0;
    const bestRoi = opportunities.length > 0
      ? Math.max(...opportunities.map(o => o.profit_analysis.roi_percent))
      : 0;

    results.push({
      query,
      platform,
      opportunities: opportunities.slice(0, 20), // Top 20
      stats: {
        listings_analyzed: activeListings.length,
        opportunities_found: opportunities.length,
        avg_profit_margin: Math.round(avgMargin * 10) / 10,
        best_roi: Math.round(bestRoi * 10) / 10,
      },
      fetched_at: new Date().toISOString(),
    });
  }

  return results;
}

// Find cross-platform arbitrage opportunities
export async function findArbitrageOpportunities(
  query: string,
  buyPlatform: string = 'Vinted',
  sellPlatform: string = 'eBay',
  minProfit = 10
): Promise<{
  opportunities: Array<{
    buy_listing: ActiveListing;
    sell_on: string;
    estimated_sell_price: number;
    estimated_profit: number;
    roi_percent: number;
  }>;
  stats: {
    listings_checked: number;
    opportunities_found: number;
  };
}> {
  console.log(`Finding arbitrage: buy on ${buyPlatform}, sell on ${sellPlatform}...`);

  // Get listings from buy platform
  let buyListings: ActiveListing[] = [];
  switch (buyPlatform.toLowerCase()) {
    case 'ebay':
      buyListings = await searchEbayActiveListings(query, 30);
      break;
    case 'vinted':
      buyListings = await searchVintedActiveListings(query, 30);
      break;
  }

  await delay(500);

  // Get sold prices from sell platform
  let sellPrices: number[] = [];
  switch (sellPlatform.toLowerCase()) {
    case 'ebay': {
      const sold = await searchEbaySoldListings(query, 50);
      sellPrices = sold.sold_items.map(i => i.sold_price);
      break;
    }
    case 'vinted': {
      const sold = await searchVintedSoldListings(query, 50);
      sellPrices = sold.sold_items.map(i => i.sold_price);
      break;
    }
  }

  if (buyListings.length === 0 || sellPrices.length === 0) {
    return {
      opportunities: [],
      stats: { listings_checked: buyListings.length, opportunities_found: 0 }
    };
  }

  // Calculate median sell price
  const sorted = [...sellPrices].sort((a, b) => a - b);
  const medianSellPrice = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)];

  // Get sell platform fee
  const sellFeeRate = PLATFORM_FEES[sellPlatform] || 0.10;

  const opportunities: Array<{
    buy_listing: ActiveListing;
    sell_on: string;
    estimated_sell_price: number;
    estimated_profit: number;
    roi_percent: number;
  }> = [];

  for (const listing of buyListings) {
    const fees = medianSellPrice * sellFeeRate;
    const profit = medianSellPrice - listing.price - fees;
    const roi = (profit / listing.price) * 100;

    if (profit >= minProfit) {
      opportunities.push({
        buy_listing: listing,
        sell_on: sellPlatform,
        estimated_sell_price: Math.round(medianSellPrice * 100) / 100,
        estimated_profit: Math.round(profit * 100) / 100,
        roi_percent: Math.round(roi * 10) / 10,
      });
    }
  }

  // Sort by profit
  opportunities.sort((a, b) => b.estimated_profit - a.estimated_profit);

  return {
    opportunities: opportunities.slice(0, 15),
    stats: {
      listings_checked: buyListings.length,
      opportunities_found: opportunities.length,
    },
  };
}

// Get trending items with high flip potential
export async function getTrendingFlips(
  categories: string[] = ['vintage clothing', 'retro games', 'designer bags', 'rare vinyl'],
  limit = 10
): Promise<Array<{
  category: string;
  best_opportunity: FlipOpportunity | null;
  avg_roi: number;
}>> {
  const results: Array<{
    category: string;
    best_opportunity: FlipOpportunity | null;
    avg_roi: number;
  }> = [];

  for (const category of categories) {
    const flipResults = await findFlipOpportunities(category, ['eBay'], 15, 30);

    if (flipResults.length > 0 && flipResults[0].opportunities.length > 0) {
      const opportunities = flipResults[0].opportunities;
      const avgRoi = opportunities.reduce((sum, o) => sum + o.profit_analysis.roi_percent, 0) / opportunities.length;

      results.push({
        category,
        best_opportunity: opportunities[0],
        avg_roi: Math.round(avgRoi * 10) / 10,
      });
    } else {
      results.push({
        category,
        best_opportunity: null,
        avg_roi: 0,
      });
    }

    await delay(1500); // Rate limiting between categories
  }

  // Sort by ROI
  results.sort((a, b) => b.avg_roi - a.avg_roi);

  return results.slice(0, limit);
}
