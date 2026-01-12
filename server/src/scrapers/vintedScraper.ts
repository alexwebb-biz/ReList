import { AlertConfig, ScrapedItem } from '../services/scraperService.js';
import { gotScraping } from 'got-scraping';
import { getRandomProxy, ProxyConfig } from '../config/proxies.js';
import { CookieJar } from 'tough-cookie'; // Add this

const VINTED_BASE_URL = 'https://www.vinted.co.uk';
const VINTED_API_URL = `${VINTED_BASE_URL}/api/v2/catalog/items`;

let sessionCache: {
  accessToken: string | null;
  csrfToken: string | null;
  cookies: string;
  expiresAt: number;
} | null = null;

// Use a cookie jar for automatic cookie handling
const cookieJar = new CookieJar();

const buildProxyUrl = (proxy: ProxyConfig): string => {
  return `http://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`;
};

// Enhanced CSRF token extraction from HTML
const extractCsrfTokenFromHtml = (html: string): string | null => {
  // Try multiple patterns
  const patterns = [
    /<meta[^>]*name=["']csrf-token["'][^>]*content=["']([^"']+)["']/i,
    /"_csrf_token"\s*:\s*"([^"]+)"/i,
    /csrfToken\s*:\s*"([^"]+)"/i,
  ];
  
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
};

const initializeSession = async () => {
  if (sessionCache?.expiresAt > Date.now()) {
    return sessionCache;
  }

  try {
    const proxy = getRandomProxy();
    console.log(`Initializing Vinted session${proxy ? ' with proxy' : ''}...`);
    
    const response = await gotScraping.get(VINTED_BASE_URL, {
      headerGeneratorOptions: {
        browsers: [{ name: 'chrome', minVersion: 131 }],
        operatingSystems: ['windows'],
        locales: ['en-GB'],
      },
      proxyUrl: proxy ? buildProxyUrl(proxy) : undefined,
      cookieJar, // Use cookie jar
      timeout: { request: 30000 },
      throwHttpErrors: false,
    });

    if (response.statusCode !== 200) {
      console.error(`❌ Vinted session init failed: ${response.statusCode}`);
      if (response.statusCode === 403) {
        console.error('Cloudflare block detected');
        console.error('Response body:', response.body.substring(0, 300));
      }
      return null;
    }

    // Wait longer for page load
    await new Promise(r => setTimeout(r, 3000 + Math.random() * 2000));

    // Extract cookies from jar
    const cookies = await cookieJar.getCookieString(VINTED_BASE_URL);
    
    // Extract CSRF token from HTML (most reliable method)
    const csrfToken = extractCsrfTokenFromHtml(response.body);
    const accessToken = null; // Usually not needed for search

    if (!csrfToken) {
      console.warn('⚠️ Could not extract CSRF token - requests may fail');
    } else {
      console.log('✅ CSRF token extracted:', csrfToken.substring(0, 10) + '...');
    }

    sessionCache = {
      accessToken,
      csrfToken,
      cookies,
      expiresAt: Date.now() + 90 * 60 * 1000,
    };

    return sessionCache;
  } catch (error) {
    console.error('Session init error:', error);
    return null;
  }
};

const generateSessionId = (): string => {
  const rand = () => Math.random().toString(36).substring(2, 15);
  return `${rand()}${rand()}`.substring(0, 43);
};

const buildSearchParams = (config: AlertConfig, page: number = 1) => {
  // Validate keywords
  const searchText = config.keywords.join(' ').trim();
  if (!searchText) {
    throw new Error('No search keywords provided');
  }

  const params = new URLSearchParams({
    search_text: searchText,
    order: 'newest_first',
    per_page: '96',
    page: page.toString(),
    currency: 'GBP',
    time: Date.now().toString(),
  });

  if (config.price_min) params.set('price_from', config.price_min.toString());
  if (config.price_max) params.set('price_to', config.price_max.toString());

  return params;
};

const humanDelay = (min: number, max: number) =>
  new Promise(r => setTimeout(r, min + Math.random() * (max - min)));

const fetchWithRetry = async (url: string, session: any, maxRetries = 3) => {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const proxy = getRandomProxy();
      
      // Build dynamic Referer that matches the search page
      const refererUrl = `${VINTED_BASE_URL}/catalog?${buildSearchParams(session.config, 1).toString()}`;
      
      const response = await gotScraping.get(url, {
        headers: {
          // Use lowercase headers for consistency
          'referer': refererUrl,
          'x-csrf-token': session.csrfToken || '',
          // Don't pass Cookie header - cookieJar handles it automatically
          ...(session.accessToken ? { 'authorization': `Bearer ${session.accessToken}` } : {}),
        },
        proxyUrl: proxy ? buildProxyUrl(proxy) : undefined,
        cookieJar, // Use the same cookie jar
        headerGeneratorOptions: {
          browsers: [{ name: 'chrome', minVersion: 131 }],
          operatingSystems: ['windows'],
          locales: ['en-GB'],
        },
        timeout: { request: 30000 },
        throwHttpErrors: false,
      });

      // ENHANCED ERROR LOGGING
      if (response.statusCode === 400) {
        console.error('❌ Vinted 400 Bad Request - DEBUG INFO:');
        console.error('URL:', url);
        console.error('Request headers:', response.request.options.headers);
        console.error('Response body:', response.body.substring(0, 500));
        console.error('Cookies:', await cookieJar.getCookieString(VINTED_BASE_URL));
        
        // Try to extract any error message from response
        try {
          const errorData = JSON.parse(response.body);
          console.error('API Error details:', errorData);
        } catch {
          // Not JSON
        }
        
        throw new Error(`HTTP 400 - Bad Request: ${response.body.substring(0, 200)}`);
      }

      if (response.statusCode === 403) {
        console.error('Cloudflare block detected on API request');
        sessionCache = null;
        if (attempt < maxRetries - 1) {
          const newSession = await initializeSession();
          if (newSession) {
            session = newSession;
            await humanDelay(2000, 4000);
            continue;
          }
        }
        return null;
      }

      if (response.statusCode === 429) {
        const delay = Math.pow(2, attempt) * 3000 + Math.random() * 2000;
        console.log(`Rate limited, waiting ${Math.round(delay)}ms`);
        await humanDelay(delay, delay + 1000);
        continue;
      }

      if (response.statusCode !== 200) {
        throw new Error(`HTTP ${response.statusCode}: ${response.body.substring(0, 200)}`);
      }

      return response;
    } catch (error) {
      console.error(`Attempt ${attempt + 1} failed:`, error);
      if (attempt === maxRetries - 1) return null;
      await humanDelay(1000 * (attempt + 1), 2000 * (attempt + 1));
    }
  }
  return null;
};

const extractPrice = (item: any): number => {
  if (typeof item.price === 'number') return item.price;
  if (typeof item.price === 'string') {
    const parsed = parseFloat(item.price);
    if (!isNaN(parsed)) return parsed;
  }
  if (item.price?.amount) {
    const parsed = parseFloat(item.price.amount);
    if (!isNaN(parsed)) return parsed;
  }
  if (item.total_item_price) {
    if (typeof item.total_item_price === 'number') return item.total_item_price;
    const parsed = parseFloat(item.total_item_price);
    if (!isNaN(parsed)) return parsed;
  }
  return 0;
};

const parseResponse = (data: any): ScrapedItem[] => {
  if (!data?.items?.length) return [];

  return data.items
    .map((item: any) => {
      try {
        const imageUrls: string[] = [];
        if (item.photo?.url) imageUrls.push(item.photo.url);
        if (item.photos) {
          for (const photo of item.photos.slice(0, 5)) {
            if (photo.url && !imageUrls.includes(photo.url)) {
              imageUrls.push(photo.url);
            }
          }
        }

        const price = extractPrice(item);
        if (price <= 0) return null;

        return {
          external_id: `vinted-${item.id}`,
          platform: 'Vinted',
          title: item.title || '',
          description: item.description || null,
          price,
          currency: item.currency || 'GBP',
          location: item.user?.city || null,
          condition: item.status || null,
          image_urls: imageUrls,
          url: `https://www.vinted.co.uk/items/${item.id}`,
          seller_name: item.user?.login || null,
          posted_at: item.created_at_ts ? new Date(item.created_at_ts * 1000).toISOString() : null,
        };
      } catch (err) {
        console.error('Error parsing item:', err);
        return null;
      }
    })
    .filter(Boolean) as ScrapedItem[];
};

export const scrapeVinted = async (config: AlertConfig): Promise<ScrapedItem[]> => {
  const MAX_PAGES = 3;
  const session = await initializeSession();
  if (!session) return [];

  // Store config in session for Referer building
  (session as any).config = config;

  console.log(`Scraping Vinted: ${config.keywords.join(' ')}`);

  const allItems: ScrapedItem[] = [];
  const seenIds = new Set<string>();

  for (let page = 1; page <= MAX_PAGES; page++) {
    const params = buildSearchParams(config, page);
    const url = `${VINTED_API_URL}?${params.toString()}`;

    const response = await fetchWithRetry(url, session);
    if (!response) break;

    const items = parseResponse(JSON.parse(response.body));
    if (!items.length) break;

    items.forEach(item => {
      if (!seenIds.has(item.external_id)) {
        seenIds.add(item.external_id);
        allItems.push(item);
      }
    });

    console.log(`Page ${page}: ${items.length} items (total: ${allItems.length})`);

    if (items.length < 96 || page === MAX_PAGES) break;

    await humanDelay(3000, 7000);
  }

  console.log(`Found ${allItems.length} total items`);
  return allItems;
};

export default scrapeVinted;