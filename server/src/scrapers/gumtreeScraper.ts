import * as cheerio from 'cheerio';
import { AlertConfig, ScrapedItem } from '../services/scraperService.js';
import { gotScraping } from 'got-scraping';
import { getRandomProxy, ProxyConfig } from '../config/proxies.js';
import { CookieJar } from 'tough-cookie';

const GUMTREE_BASE_URL = 'https://www.gumtree.com';

// Enhanced configuration
const CONFIG = {
  initialDelay: { min: 2000, max: 4000 },
  pageDelay: { min: 3000, max: 7000 },
  retryDelay: { min: 1000, max: 3000 },
  maxRetries: 3,
  maxPages: 3,
};

let sessionCache: {
  cookies: string;
  expiresAt: number;
  userAgent: string;
} | null = null;

const cookieJar = new CookieJar();

const buildProxyUrl = (proxy: ProxyConfig): string => {
  return `http://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`;
};

const humanDelay = (min: number, max: number) =>
  new Promise(r => setTimeout(r, min + Math.random() * (max - min)));

// Initialize session
const initializeSession = async () => {
  if (sessionCache?.expiresAt > Date.now()) {
    return sessionCache;
  }

  try {
    const proxy = getRandomProxy();
    console.log(`Initializing Gumtree session${proxy ? ' with proxy' : ''}...`);

    const response = await gotScraping.get(GUMTREE_BASE_URL, {
      headerGeneratorOptions: {
        browsers: [{ name: 'chrome', minVersion: 120 }],
        operatingSystems: ['windows'],
        locales: ['en-GB'],
      },
      proxyUrl: proxy ? buildProxyUrl(proxy) : undefined,
      cookieJar,
      timeout: { request: 30000 },
      throwHttpErrors: false,
    });

    if (response.statusCode !== 200) {
      console.error(`❌ Gumtree session init failed: ${response.statusCode}`);
      if (response.statusCode === 403) {
        console.error('Cloudflare blocked session init');
      }
      return null;
    }

    await humanDelay(CONFIG.initialDelay.min, CONFIG.initialDelay.max);

    const cookies = await cookieJar.getCookieString(GUMTREE_BASE_URL);
    const userAgent = response.request.options.headers['user-agent'] as string;

    sessionCache = {
      cookies,
      expiresAt: Date.now() + 60 * 60 * 1000,
      userAgent,
    };

    console.log('✅ Gumtree session initialized');
    return sessionCache;
  } catch (error) {
    console.error('Session init error:', error);
    return null;
  }
};

// Build search URL
const buildSearchUrl = (config: AlertConfig, page: number = 1): string => {
  const query = config.keywords.join(' ').trim();
  if (!query) {
    throw new Error('No search keywords provided');
  }

  const params = new URLSearchParams({
    search_category: 'all',
    q: query,
    search_location: 'United Kingdom',
    sort: 'date',
    page: page.toString(),
  });

  if (config.price_min) {
    params.set('min_price', config.price_min.toString());
  }
  if (config.price_max) {
    params.set('max_price', config.price_max.toString());
  }

  return `${GUMTREE_BASE_URL}/search?${params.toString()}`;
};

// Parse listings with multiple fallback selectors
const parseListings = (html: string): ScrapedItem[] => {
  const $ = cheerio.load(html);
  const items: ScrapedItem[] = [];

  // Main selector (current Gumtree structure)
  $('article[data-q="search-result"]').each((_, element) => {
    try {
      const $item = $(element);

      const titleEl = $item.find('div[data-q="tile-title"]');
      const title = titleEl.text().trim();
      if (!title) return;

      const linkEl = $item.find('a[data-q="search-result-anchor"]');
      let url = linkEl.attr('href') || '';
      if (url && !url.startsWith('http')) {
        url = `https://www.gumtree.com${url}`;
      }

      const itemIdMatch = url.match(/\/(\d+)$/);
      const external_id = itemIdMatch ? `gumtree-${itemIdMatch[1]}` : `gumtree-${Date.now()}-${Math.random()}`;

      const priceEl = $item.find('div[data-testid="price"]');
      const priceText = priceEl.text().replace(/[£$,]/g, '').trim();
      const price = parseFloat(priceText);

      if (!price || isNaN(price) || price <= 0) {
        return;
      }

      const imageUrls: string[] = [];
      const imageEl = $item.find('img');
      const mainImage = imageEl.attr('src') || imageEl.attr('data-src');
      if (mainImage) {
        imageUrls.push(mainImage);
        // Try higher res version
        const highRes = mainImage.replace(/\/\d+x\d+\//, '/800x600/');
        if (highRes !== mainImage) {
          imageUrls.push(highRes);
        }
      }

      const locationEl = $item.find('div[data-q="tile-location"]');
      const location = locationEl.text().trim() || null;

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
        image_urls: imageUrls,
        url,
        seller_name: null,
        posted_at: null,
      });
    } catch (err) {
      console.error('Error parsing Gumtree item:', err);
    }
  });

  // Fallback selectors
  if (items.length === 0) {
    console.log('No items found with main selectors, trying fallback...');
    
    $('article.listing-maxi, .natural-listing, [data-listing-id]').each((_, element) => {
      try {
        const $item = $(element);

        const titleEl = $item.find('h2 a, .listing-title, [data-q="title"]');
        const title = titleEl.text().trim();
        if (!title) return;

        const linkEl = $item.find('a.listing-link, h2 a');
        let url = linkEl.attr('href') || '';
        if (url && !url.startsWith('http')) {
          url = `https://www.gumtree.com${url}`;
        }

        const itemIdMatch = url.match(/\/(\d+)$/);
        const external_id = itemIdMatch ? `gumtree-${itemIdMatch[1]}` : `gumtree-${Date.now()}-${Math.random()}`;

        const priceEl = $item.find('.listing-price, .ad-price, [data-testid="price"]');
        const priceText = priceEl.text().replace(/[£$,]/g, '').trim();
        const price = parseFloat(priceText);

        if (!price || isNaN(price) || price <= 0) {
          return;
        }

        const imageUrls: string[] = [];
        const imageEl = $item.find('img.listing-thumbnail, img');
        const mainImage = imageEl.attr('src') || imageEl.attr('data-src');
        if (mainImage) {
          imageUrls.push(mainImage);
        }

        const locationEl = $item.find('.listing-location, .ad-location, [data-q="location"]');
        const location = locationEl.text().trim() || null;

        const descEl = $item.find('.listing-description, .ad-description, [data-q="description"]');
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
          image_urls: imageUrls,
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

// Enhanced fetch with retry
const fetchWithRetry = async (url: string, session: any, maxRetries = CONFIG.maxRetries): Promise<cheerio.Root | null> => {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const proxy = getRandomProxy();
      
      const response = await gotScraping.get(url, {
        headerGeneratorOptions: {
          browsers: [{ name: 'chrome', minVersion: 120 }],
          operatingSystems: ['windows'],
          locales: ['en-GB'],
        },
        headers: {
          'referer': `${GUMTREE_BASE_URL}/`,
          // Cookie jar handles cookies automatically
        },
        proxyUrl: proxy ? buildProxyUrl(proxy) : undefined,
        cookieJar,
        timeout: { request: 30000 },
        throwHttpErrors: false,
      });

      // ENHANCED ERROR HANDLING
      if (response.statusCode === 403) {
        console.error('❌ Gumtree 403 - Cloudflare block detected');
        if (attempt < maxRetries - 1) {
          await humanDelay(CONFIG.retryDelay.min, CONFIG.retryDelay.max);
          continue;
        }
        return null;
      }

      if (response.statusCode === 429) {
        console.warn(`⚠️ Gumtree rate limited (429) - attempt ${attempt + 1}`);
        const delay = Math.pow(2, attempt) * 2000 + Math.random() * 1000;
        await humanDelay(delay, delay + 1000);
        continue;
      }

      if (response.statusCode !== 200) {
        console.error(`❌ HTTP ${response.statusCode}: ${response.body.substring(0, 200)}`);
        if (attempt < maxRetries - 1) {
          await humanDelay(CONFIG.retryDelay.min, CONFIG.retryDelay.max);
          continue;
        }
        return null;
      }

      // Check for Cloudflare challenge
      const body = response.body;
      if (body.includes('Enable JavaScript and cookies to continue') || 
          body.includes('Checking your browser') ||
          body.length < 5000) {
        console.warn('⚠️ Likely blocked by Cloudflare challenge');
        if (attempt < maxRetries - 1) {
          // Rotate proxy and retry
          await humanDelay(CONFIG.retryDelay.min * 2, CONFIG.retryDelay.max * 2);
          continue;
        }
        return null;
      }

      return cheerio.load(body);
    } catch (error) {
      console.error(`Attempt ${attempt + 1} failed:`, error);
      if (attempt === maxRetries - 1) return null;
      await humanDelay(CONFIG.retryDelay.min, CONFIG.retryDelay.max);
    }
  }
  return null;
};

// Main scrape function
export const scrapeGumtree = async (config: AlertConfig): Promise<ScrapedItem[]> => {
  try {
    const session = await initializeSession();
    if (!session) {
      console.error('Gumtree: Failed to initialize session');
      return [];
    }

    console.log(`Scraping Gumtree: ${config.keywords.join(' ')}`);

    const allItems: ScrapedItem[] = [];
    const seenIds = new Set<string>();

    for (let page = 1; page <= CONFIG.maxPages; page++) {
      const url = buildSearchUrl(config, page);
      
      // Human-like delay between page requests
      if (page > 1) {
        await humanDelay(CONFIG.pageDelay.min, CONFIG.pageDelay.max);
      }

      console.log(`Fetching page ${page}: ${url}`);

      const $ = await fetchWithRetry(url, session);
      if (!$) {
        console.error(`Failed to fetch page ${page}`);
        break;
      }

      const items = parseListings($.html());
      
      if (items.length === 0) {
        console.log(`No items found on page ${page}, stopping`);
        break;
      }

      // Deduplicate and collect
      for (const item of items) {
        if (!seenIds.has(item.external_id)) {
          seenIds.add(item.external_id);
          allItems.push(item);
        }
      }

      console.log(`Page ${page}: ${items.length} items (total: ${allItems.length})`);

      // Stop if low item count (likely last page)
      if (items.length < 20) {
        break;
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