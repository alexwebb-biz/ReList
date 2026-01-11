import * as cheerio from 'cheerio';

export interface SoldItem {
  title: string;
  sold_price: number;
  currency: string;
  sold_date: string;
  condition: string;
  url: string;
  image_url: string | null;
  platform: string;
}

export interface MarketResearchResult {
  query: string;
  platform: string;
  sold_items: SoldItem[];
  stats: {
    average_price: number;
    median_price: number;
    lowest_price: number;
    highest_price: number;
    total_sold: number;
    avg_days_to_sell?: number;
  };
  fetched_at: string;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Random delay to avoid detection
const randomDelay = () => delay(1000 + Math.random() * 2000);

// Rotate user agents
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
];

const getRandomUA = () => USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

// Fetch sold listings from eBay UK using their search results page
export const searchEbaySoldListings = async (
  query: string,
  maxResults = 30
): Promise<MarketResearchResult> => {
  const encodedQuery = encodeURIComponent(query);
  // LH_Sold=1 and LH_Complete=1 filters for sold items
  // _sop=13 sorts by end date (newest first)
  const url = `https://www.ebay.co.uk/sch/i.html?_nkw=${encodedQuery}&LH_Sold=1&LH_Complete=1&_sop=13&_ipg=60`;

  console.log(`Fetching eBay sold listings for: "${query}"`);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': getRandomUA(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-GB,en;q=0.9,en-US;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0',
      }
    });

    if (!response.ok) {
      console.error(`eBay returned status ${response.status}`);
      throw new Error(`eBay returned ${response.status}`);
    }

    const html = await response.text();

    // Debug: log first bit of HTML to see what we're getting
    console.log(`eBay response length: ${html.length} chars`);

    const $ = cheerio.load(html);
    const soldItems: SoldItem[] = [];

    // Try multiple selector strategies
    // Strategy 1: Standard s-item elements
    $('li.s-item, div.s-item__wrapper').each((_, element) => {
      if (soldItems.length >= maxResults) return false;

      const $item = $(element);

      // Skip the "Shop on eBay" placeholder
      const itemInfo = $item.text();
      if (itemInfo.includes('Shop on eBay') || itemInfo.includes('Results matching fewer words')) {
        return;
      }

      // Get title - multiple selectors for different page layouts
      let title = '';
      const titleSelectors = [
        '.s-item__title span[role="heading"]',
        '.s-item__title span',
        '.s-item__title',
        'h3.s-item__title',
        '[data-testid="item-title"]',
      ];

      for (const sel of titleSelectors) {
        title = $item.find(sel).first().text().trim();
        if (title && !title.includes('Shop on eBay')) break;
      }

      if (!title) return;

      // Get sold price
      let priceText = '';
      const priceSelectors = [
        '.s-item__price .POSITIVE',
        '.s-item__price span.POSITIVE',
        '.s-item__price',
        '[data-testid="item-price"]',
      ];

      for (const sel of priceSelectors) {
        priceText = $item.find(sel).first().text().trim();
        if (priceText && priceText.includes('£')) break;
      }

      // Extract numeric price
      const priceMatch = priceText.match(/£([\d,]+\.?\d*)/);
      if (!priceMatch) return;

      const soldPrice = parseFloat(priceMatch[1].replace(/,/g, ''));
      if (isNaN(soldPrice) || soldPrice <= 0) return;

      // Get sold date
      let soldDateText = 'Recently';
      $item.find('.s-item__title--tagblock, .s-item__caption, .POSITIVE').each((_, el) => {
        const text = $(el).text();
        if (text.toLowerCase().includes('sold')) {
          soldDateText = text.trim();
          return false;
        }
      });

      // Get condition
      const condition = $item.find('.SECONDARY_INFO, .s-item__subtitle').first().text().trim() || 'Unknown';

      // Get URL
      let itemUrl = $item.find('a.s-item__link, a[href*="/itm/"]').first().attr('href') || '';
      if (itemUrl) {
        try {
          const urlObj = new URL(itemUrl);
          // Keep the item ID path but remove tracking params
          itemUrl = `https://www.ebay.co.uk${urlObj.pathname}`;
        } catch {
          // Keep original URL if parsing fails
        }
      }

      // Get image
      const imageUrl =
        $item.find('.s-item__image-img, img.s-item__image-img').attr('src') ||
        $item.find('.s-item__image-img, img.s-item__image-img').attr('data-src') ||
        $item.find('img').first().attr('src') ||
        null;

      soldItems.push({
        title,
        sold_price: soldPrice,
        currency: 'GBP',
        sold_date: soldDateText,
        condition: condition.substring(0, 50),
        url: itemUrl,
        image_url: imageUrl && !imageUrl.includes('s-l64') ? imageUrl : null,
        platform: 'eBay'
      });
    });

    // If no items found with first strategy, try srp-results
    if (soldItems.length === 0) {
      console.log('Trying alternate eBay selectors...');

      $('[data-testid="srp-results"] li, .srp-results li').each((_, element) => {
        if (soldItems.length >= maxResults) return false;

        const $item = $(element);
        const title = $item.find('h3, .s-item__title').first().text().trim();
        if (!title || title.includes('Shop on eBay')) return;

        const priceText = $item.find('.s-item__price, [data-testid="item-price"]').text();
        const priceMatch = priceText.match(/£([\d,]+\.?\d*)/);
        if (!priceMatch) return;

        const soldPrice = parseFloat(priceMatch[1].replace(/,/g, ''));
        if (isNaN(soldPrice) || soldPrice <= 0) return;

        const itemUrl = $item.find('a[href*="/itm/"]').first().attr('href') || '';
        const imageUrl = $item.find('img').first().attr('src') || null;

        soldItems.push({
          title,
          sold_price: soldPrice,
          currency: 'GBP',
          sold_date: 'Recently',
          condition: 'Unknown',
          url: itemUrl,
          image_url: imageUrl,
          platform: 'eBay'
        });
      });
    }

    console.log(`eBay sold search for "${query}": found ${soldItems.length} items`);

    const prices = soldItems.map(item => item.sold_price);
    const stats = calculateStats(prices);

    return {
      query,
      platform: 'eBay',
      sold_items: soldItems,
      stats: {
        ...stats,
        total_sold: soldItems.length
      },
      fetched_at: new Date().toISOString()
    };
  } catch (error) {
    console.error('eBay sold listings scrape error:', error);
    return {
      query,
      platform: 'eBay',
      sold_items: [],
      stats: {
        average_price: 0,
        median_price: 0,
        lowest_price: 0,
        highest_price: 0,
        total_sold: 0
      },
      fetched_at: new Date().toISOString()
    };
  }
};

// Search Vinted via their web interface
// Note: Vinted heavily relies on JavaScript rendering, so we use their API directly
export const searchVintedSoldListings = async (
  query: string,
  maxResults = 30
): Promise<MarketResearchResult> => {
  console.log(`Fetching Vinted listings for: "${query}"`);

  // Vinted's catalog API endpoint (discovered from their web app)
  const encodedQuery = encodeURIComponent(query);

  // Try the API approach first
  try {
    // First, we need to get a session cookie from the main page
    const sessionResponse = await fetch('https://www.vinted.co.uk', {
      headers: {
        'User-Agent': getRandomUA(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-GB,en;q=0.9',
      }
    });

    const cookies = sessionResponse.headers.get('set-cookie') || '';

    await randomDelay();

    // Now try to fetch the catalog API
    const apiUrl = `https://www.vinted.co.uk/api/v2/catalog/items?page=1&per_page=48&search_text=${encodedQuery}&order=newest_first`;

    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': getRandomUA(),
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-GB,en;q=0.9',
        'Referer': `https://www.vinted.co.uk/catalog?search_text=${encodedQuery}`,
        'Cookie': cookies,
        'X-Requested-With': 'XMLHttpRequest',
      }
    });

    if (response.ok) {
      const data = await response.json();
      const soldItems: SoldItem[] = [];

      if (data.items && Array.isArray(data.items)) {
        for (const item of data.items) {
          if (soldItems.length >= maxResults) break;

          // Check if item is sold (has is_closed or sold status)
          const isSold = item.is_closed || item.status === 'sold' || item.transaction_status;

          // For Vinted, we'll include both sold AND active items since finding sold-only is tricky
          // The prices still give good market reference
          const price = parseFloat(item.price?.amount || item.price || 0);
          if (price <= 0) continue;

          soldItems.push({
            title: item.title || 'Unknown',
            sold_price: price,
            currency: item.price?.currency_code || 'GBP',
            sold_date: isSold ? 'Sold' : 'Listed',
            condition: item.status || 'Unknown',
            url: item.url ? `https://www.vinted.co.uk${item.url}` : '',
            image_url: item.photo?.url || item.photos?.[0]?.url || null,
            platform: 'Vinted'
          });
        }
      }

      console.log(`Vinted API search for "${query}": found ${soldItems.length} items`);

      const prices = soldItems.map(item => item.sold_price);
      const stats = calculateStats(prices);

      return {
        query,
        platform: 'Vinted',
        sold_items: soldItems,
        stats: { ...stats, total_sold: soldItems.length },
        fetched_at: new Date().toISOString()
      };
    }
  } catch (apiError) {
    console.log('Vinted API failed, trying HTML scrape:', apiError);
  }

  // Fallback to HTML scraping
  try {
    const url = `https://www.vinted.co.uk/catalog?search_text=${encodedQuery}&order=newest_first`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': getRandomUA(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-GB,en;q=0.9',
      }
    });

    if (!response.ok) {
      throw new Error(`Vinted returned ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const soldItems: SoldItem[] = [];

    // Try to extract data from script tags (Vinted embeds initial data)
    const scripts = $('script').toArray();
    for (const script of scripts) {
      const content = $(script).html() || '';

      // Look for JSON data in script tags
      if (content.includes('"items"') || content.includes('catalog')) {
        try {
          // Try to extract JSON from various patterns
          const jsonMatch = content.match(/\{[\s\S]*"items"[\s\S]*\}/);
          if (jsonMatch) {
            const data = JSON.parse(jsonMatch[0]);
            if (data.items && Array.isArray(data.items)) {
              for (const item of data.items) {
                if (soldItems.length >= maxResults) break;

                const price = parseFloat(item.price?.amount || item.price || 0);
                if (price <= 0) continue;

                soldItems.push({
                  title: item.title || 'Unknown',
                  sold_price: price,
                  currency: 'GBP',
                  sold_date: item.is_closed ? 'Sold' : 'Listed',
                  condition: 'Unknown',
                  url: item.url ? `https://www.vinted.co.uk${item.url}` : '',
                  image_url: item.photo?.url || null,
                  platform: 'Vinted'
                });
              }
            }
          }
        } catch {
          // JSON parse failed, continue
        }
      }
    }

    // If script extraction didn't work, try DOM scraping
    if (soldItems.length === 0) {
      // Vinted uses various class names, try multiple
      $('[class*="ItemBox"], [class*="item-card"], [data-testid*="item"]').each((_, element) => {
        if (soldItems.length >= maxResults) return false;

        const $item = $(element);
        const title = $item.find('[class*="title"], h3, [data-testid*="title"]').first().text().trim();

        if (!title) return;

        const priceText = $item.find('[class*="price"], [data-testid*="price"]').first().text();
        const priceMatch = priceText.match(/[£€$]([\d,]+\.?\d*)/);
        if (!priceMatch) return;

        const price = parseFloat(priceMatch[1].replace(/,/g, ''));
        if (price <= 0) return;

        const itemUrl = $item.find('a[href*="/items/"], a[href*="/item/"]').first().attr('href') || '';
        const imageUrl = $item.find('img').first().attr('src') || null;

        soldItems.push({
          title,
          sold_price: price,
          currency: 'GBP',
          sold_date: 'Recently',
          condition: 'Unknown',
          url: itemUrl.startsWith('http') ? itemUrl : `https://www.vinted.co.uk${itemUrl}`,
          image_url: imageUrl,
          platform: 'Vinted'
        });
      });
    }

    console.log(`Vinted HTML scrape for "${query}": found ${soldItems.length} items`);

    const prices = soldItems.map(item => item.sold_price);
    const stats = calculateStats(prices);

    return {
      query,
      platform: 'Vinted',
      sold_items: soldItems,
      stats: { ...stats, total_sold: soldItems.length },
      fetched_at: new Date().toISOString()
    };
  } catch (error) {
    console.error('Vinted scrape error:', error);
    return {
      query,
      platform: 'Vinted',
      sold_items: [],
      stats: {
        average_price: 0,
        median_price: 0,
        lowest_price: 0,
        highest_price: 0,
        total_sold: 0
      },
      fetched_at: new Date().toISOString()
    };
  }
};

// Combined search across platforms
export const searchSoldListings = async (
  query: string,
  platforms: string[] = ['eBay']
): Promise<MarketResearchResult[]> => {
  const results: MarketResearchResult[] = [];

  for (const platform of platforms) {
    if (results.length > 0) {
      await randomDelay(); // Rate limiting between platforms
    }

    switch (platform.toLowerCase()) {
      case 'ebay':
        results.push(await searchEbaySoldListings(query));
        break;
      case 'vinted':
        results.push(await searchVintedSoldListings(query));
        break;
      default:
        console.log(`Unsupported platform for sold listings: ${platform}`);
    }
  }

  return results;
};

// Get suggested price based on sold data
export const getSuggestedPrice = async (
  query: string,
  condition: string = 'Good'
): Promise<{
  suggested_price: number;
  price_range: { min: number; max: number };
  confidence: 'high' | 'medium' | 'low';
  based_on: number;
}> => {
  const results = await searchEbaySoldListings(query, 50);

  if (results.sold_items.length === 0) {
    return {
      suggested_price: 0,
      price_range: { min: 0, max: 0 },
      confidence: 'low',
      based_on: 0
    };
  }

  // Filter by similar condition if possible
  const conditionMap: Record<string, string[]> = {
    'New with tags': ['new', 'bnwt', 'brand new'],
    'Like New': ['like new', 'excellent', 'mint'],
    'Good': ['good', 'very good'],
    'Fair': ['fair', 'used'],
    'Poor': ['poor', 'for parts']
  };

  const conditionKeywords = conditionMap[condition] || [];
  let filteredItems = results.sold_items.filter(item =>
    conditionKeywords.some(kw => item.condition.toLowerCase().includes(kw))
  );

  // If not enough condition matches, use all items
  if (filteredItems.length < 5) {
    filteredItems = results.sold_items;
  }

  const prices = filteredItems.map(i => i.sold_price);
  const stats = calculateStats(prices);

  // Confidence based on sample size
  let confidence: 'high' | 'medium' | 'low' = 'low';
  if (filteredItems.length >= 20) confidence = 'high';
  else if (filteredItems.length >= 10) confidence = 'medium';

  return {
    suggested_price: Math.round(stats.median_price * 100) / 100,
    price_range: {
      min: Math.round(stats.lowest_price * 100) / 100,
      max: Math.round(stats.highest_price * 100) / 100
    },
    confidence,
    based_on: filteredItems.length
  };
};

// Helper to calculate price statistics
function calculateStats(prices: number[]): {
  average_price: number;
  median_price: number;
  lowest_price: number;
  highest_price: number;
} {
  if (prices.length === 0) {
    return {
      average_price: 0,
      median_price: 0,
      lowest_price: 0,
      highest_price: 0
    };
  }

  const sorted = [...prices].sort((a, b) => a - b);
  const sum = prices.reduce((a, b) => a + b, 0);

  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)];

  return {
    average_price: Math.round((sum / prices.length) * 100) / 100,
    median_price: Math.round(median * 100) / 100,
    lowest_price: sorted[0],
    highest_price: sorted[sorted.length - 1]
  };
}
