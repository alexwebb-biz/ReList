import * as cheerio from 'cheerio';
import { AlertConfig, ScrapedItem } from '../services/scraperService.js';

const GUMTREE_BASE_URL = 'https://www.gumtree.com/search';

// Rate limiting configuration
const CONFIG = {
  baseDelay: 3000,      // 3 seconds base delay
  randomDelay: 2000,    // Up to 2 seconds additional random delay
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-GB,en;q=0.9',
  }
};

// Rate limiting delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Build Gumtree search URL
const buildSearchUrl = (config: AlertConfig, page: number = 1): string => {
  // Match exact Gumtree URL format from browser
  const query = encodeURIComponent(config.keywords.join(' '));
  // Sort by date (newest first) and add pagination
  let url = `${GUMTREE_BASE_URL}?search_category=all&q=${query}&search_location=United%20Kingdom&sort=date&page=${page}`;

  if (config.price_min) {
    url += `&min_price=${config.price_min}`;
  }
  if (config.price_max) {
    url += `&max_price=${config.price_max}`;
  }

  return url;
};

// Parse Gumtree listing from HTML using updated selectors (late 2024)
const parseListings = (html: string): ScrapedItem[] => {
  const $ = cheerio.load(html);
  const items: ScrapedItem[] = [];

  // Updated selectors based on docs
  $('article[data-q="search-result"]').each((_, element) => {
    try {
      const $item = $(element);

      // Title - updated selector
      const titleEl = $item.find('div[data-q="tile-title"]');
      const title = titleEl.text().trim();
      if (!title) return;

      // Link - updated selector
      const linkEl = $item.find('a[data-q="search-result-anchor"]');
      let url = linkEl.attr('href') || '';
      if (url && !url.startsWith('http')) {
        url = `https://www.gumtree.com${url}`;
      }

      // Extract item ID from URL
      const itemIdMatch = url.match(/\/(\d+)$/);
      const external_id = itemIdMatch ? `gumtree-${itemIdMatch[1]}` : `gumtree-${Date.now()}-${Math.random()}`;

      // Price - updated selector
      const priceEl = $item.find('div[data-testid="price"]');
      const priceText = priceEl.text().replace(/[£$,]/g, '').trim();
      const price = parseFloat(priceText);

      // Skip items without valid prices
      if (!price || isNaN(price) || price <= 0) {
        return;
      }

      // Image
      const imageEl = $item.find('img');
      const imageUrl = imageEl.attr('src') || imageEl.attr('data-src') || '';

      // Location - updated selector
      const locationEl = $item.find('div[data-q="tile-location"]');
      const location = locationEl.text().trim() || null;

      // Description
      const descEl = $item.find('div[data-q="tile-description"], p[data-q="tile-description"]');
      const description = descEl.text().trim() || null;

      items.push({
        external_id,
        platform: 'Gumtree',
        title,
        description,
        price,
        currency: 'GBP',
        location,
        condition: null,
        image_urls: imageUrl ? [imageUrl] : [],
        url,
        seller_name: null,
        posted_at: null,
      });
    } catch (err) {
      console.error('Error parsing Gumtree item:', err);
    }
  });

  // Fallback to older selectors if new ones don't work
  if (items.length === 0) {
    $('article.listing-maxi, .natural-listing').each((_, element) => {
      try {
        const $item = $(element);

        const titleEl = $item.find('.listing-title, h2 a');
        const title = titleEl.text().trim();
        if (!title) return;

        const linkEl = $item.find('a.listing-link, h2 a');
        let url = linkEl.attr('href') || '';
        if (url && !url.startsWith('http')) {
          url = `https://www.gumtree.com${url}`;
        }

        const itemIdMatch = url.match(/\/(\d+)$/);
        const external_id = itemIdMatch ? `gumtree-${itemIdMatch[1]}` : `gumtree-${Date.now()}-${Math.random()}`;

        const priceEl = $item.find('.listing-price, .ad-price');
        const priceText = priceEl.text().replace(/[£$,]/g, '').trim();
        const price = parseFloat(priceText);

        // Skip items without valid prices
        if (!price || isNaN(price) || price <= 0) {
          return;
        }

        const imageEl = $item.find('img.listing-thumbnail, img');
        const imageUrl = imageEl.attr('src') || imageEl.attr('data-src') || '';

        const locationEl = $item.find('.listing-location, .ad-location');
        const location = locationEl.text().trim() || null;

        const descEl = $item.find('.listing-description, .ad-description');
        const description = descEl.text().trim() || null;

        items.push({
          external_id,
          platform: 'Gumtree',
          title,
          description,
          price,
          currency: 'GBP',
          location,
          condition: null,
          image_urls: imageUrl ? [imageUrl] : [],
          url,
          seller_name: null,
          posted_at: null,
        });
      } catch (err) {
        console.error('Error parsing Gumtree item (fallback):', err);
      }
    });
  }

  return items;
};

// Fetch with exponential backoff retry
const fetchWithRetry = async (url: string, maxRetries = 3): Promise<Response> => {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, { headers: CONFIG.headers });

      if (response.status === 429) {
        // Rate limited - exponential backoff with jitter
        const backoffDelay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
        console.log(`Gumtree rate limited, waiting ${Math.round(backoffDelay)}ms...`);
        await delay(backoffDelay);
        continue;
      }

      return response;
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      await delay(1000 * (attempt + 1));
    }
  }

  throw new Error('Max retries exceeded');
};

// Fetch a single page of results
const fetchPage = async (config: AlertConfig, page: number): Promise<ScrapedItem[]> => {
  const url = buildSearchUrl(config, page);

  try {
    const response = await fetchWithRetry(url);

    if (!response.ok) {
      console.error(`Gumtree page ${page} returned ${response.status}`);
      return [];
    }

    const html = await response.text();

    // Check for blocked response
    if (html.length < 5000) {
      console.log(`Gumtree page ${page}: Short response (${html.length} chars) - may be blocked`);
      return [];
    }

    return parseListings(html);
  } catch (error) {
    console.error(`Gumtree page ${page} error:`, error);
    return [];
  }
};

// Main scrape function - fetches multiple pages
export const scrapeGumtree = async (config: AlertConfig): Promise<ScrapedItem[]> => {
  const MAX_PAGES = 3; // Fetch up to 3 pages
  const PAGE_DELAY = 4000; // 4s delay between pages to avoid rate limits

  try {
    console.log(`Scraping Gumtree: ${config.keywords.join(' ')}`);

    const allItems: ScrapedItem[] = [];
    const seenIds = new Set<string>();

    for (let page = 1; page <= MAX_PAGES; page++) {
      // Add randomized delay before each request
      await delay(CONFIG.baseDelay + Math.random() * CONFIG.randomDelay);

      const items = await fetchPage(config, page);

      if (items.length === 0) {
        // No more results or blocked
        break;
      }

      // Deduplicate within this scrape
      for (const item of items) {
        if (!seenIds.has(item.external_id)) {
          seenIds.add(item.external_id);
          allItems.push(item);
        }
      }

      console.log(`Gumtree page ${page}: ${items.length} items (total: ${allItems.length})`);

      // If we got significantly fewer items, there might be no next page
      if (items.length < 20) {
        break;
      }

      // Delay before next page (if not last page)
      if (page < MAX_PAGES) {
        await delay(PAGE_DELAY);
      }
    }

    console.log(`Found ${allItems.length} total items on Gumtree`);
    return allItems;
  } catch (error) {
    console.error('Gumtree scraping error:', error);
    return [];
  }
};

export default scrapeGumtree;
