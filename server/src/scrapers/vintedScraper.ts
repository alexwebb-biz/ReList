import { AlertConfig, ScrapedItem } from '../services/scraperService.js';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { getRandomProxy, getProxyUrl } from '../config/proxies.js';

const VINTED_BASE_URL = 'https://www.vinted.co.uk';
const VINTED_API_URL = `${VINTED_BASE_URL}/api/v2/catalog/items`;

// Enhanced session cache with CSRF token
let sessionCache: {
  accessToken: string | null;
  csrfToken: string | null;
  cookies: string;
  expiresAt: number;
} | null = null;

// Robust cookie parser
const parseSetCookies = (header: string): Map<string, string> => {
  const cookieMap = new Map<string, string>();
  if (!header) return cookieMap;

  // Split by comma, but ignore commas inside dates
  const parts = header.split(/,(?=\s*\w+=)/);
  for (const part of parts) {
    const [cookie] = part.split(';');
    const [key, ...valueParts] = cookie.trim().split('=');
    if (key && valueParts.length > 0) {
      cookieMap.set(key, valueParts.join('='));
    }
  }
  return cookieMap;
};

// Extract CSRF token from multiple sources
const extractCsrfToken = async (response: Response, cookieMap: Map<string, string>): Promise<string | null> => {
  // 1. Check response headers first
  const headerToken = response.headers.get('x-csrf-token');
  if (headerToken) return headerToken;

  // 2. Check cookies
  const cookieToken = cookieMap.get('_csrf_token');
  if (cookieToken) return cookieToken;

  // 3. Extract from HTML meta tag
  try {
    const html = await response.text();
    const match = html.match(/<meta[^>]*name=["']csrf-token["'][^>]*content=["']([^"']+)["']/i);
    return match?.[1] || null;
  } catch {
    return null;
  }
};

// Rotate proxy for each request
const getProxyAgent = (): HttpsProxyAgent<string> | null => {
  const proxy = getRandomProxy();
  if (!proxy) {
    console.warn('No proxies available');
    return null;
  }
  return new HttpsProxyAgent(getProxyUrl(proxy));
};

// Initialize session with CSRF token
const initializeSession = async (): Promise<{
  accessToken: string | null;
  csrfToken: string | null;
  cookies: string;
} | null> => {
  if (sessionCache && sessionCache.expiresAt > Date.now()) {
    return {
      accessToken: sessionCache.accessToken,
      csrfToken: sessionCache.csrfToken,
      cookies: sessionCache.cookies,
    };
  }

  try {
    const agent = getProxyAgent();
    const fetchOptions: RequestInit & { agent?: any } = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-GB,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': 'https://www.google.com/',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'cross-site',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-ch-ua-arch': '"x86"',
        'sec-ch-ua-bitness': '"64"',
        'sec-ch-ua-full-version': '"131.0.0.0"',
        'sec-ch-ua-full-version-list': '"Google Chrome";v="131.0.0.0", "Chromium";v="131.0.0.0"',
      },
    };

    if (agent) {
      fetchOptions.agent = agent;
      console.log(`Initializing session with proxy`);
    }

    const response = await fetch(VINTED_BASE_URL, fetchOptions);

    if (!response.ok) {
      console.error(`Vinted session init failed: ${response.status}`);
      if (response.status === 403) {
        const body = await response.text();
        console.error('403 details:', body.substring(0, 200));
      }
      return null;
    }

    // More realistic initial delay
    await new Promise(r => setTimeout(r, 2000 + Math.random() * 2000));

    // Parse cookies properly
    const setCookieHeader = response.headers.get('set-cookie') || '';
    const cookieMap = parseSetCookies(setCookieHeader);

    // Ensure session cookie exists
    if (!cookieMap.has('_vinted_fr_session')) {
      cookieMap.set('_vinted_fr_session', generateSessionId());
    }

    const cookies = Array.from(cookieMap.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');

    // Extract tokens
    const accessToken = cookieMap.get('access_token_web') || null;
    const csrfToken = await extractCsrfToken(response, cookieMap);

    // Cache session
    sessionCache = {
      accessToken,
      csrfToken,
      cookies,
      expiresAt: Date.now() + 90 * 60 * 1000, // 1.5 hours
    };

    console.log('Vinted session initialized successfully');
    return { accessToken, csrfToken, cookies };
  } catch (error) {
    console.error('Vinted session init error:', error);
    return null;
  }
};

// Generate realistic session ID
const generateSessionId = (): string => {
  const rand = () => Math.random().toString(36).substring(2, 15);
  return `${rand()}${rand()}${rand()}`.substring(0, 43);
};

// Enhanced API headers with full fingerprint
const buildApiHeaders = (session: {
  accessToken: string | null;
  csrfToken: string | null;
  cookies: string;
}): Record<string, string> => ({
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-GB,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br, zstd',
  'Referer': 'https://www.vinted.co.uk/catalog',
  'Origin': 'https://www.vinted.co.uk',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-origin',
  'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'sec-ch-ua-arch': '"x86"',
  'sec-ch-ua-bitness': '"64"',
  'sec-ch-ua-full-version': '"131.0.0.0"',
  'sec-ch-ua-full-version-list': '"Google Chrome";v="131.0.0.0", "Chromium";v="131.0.0.0"',
  'DNT': '1',
  'Connection': 'keep-alive',
  'Priority': 'u=1, i',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'Cookie': session.cookies,
  'x-csrf-token': session.csrfToken || '',
  ...(session.accessToken ? { 'Authorization': `Bearer ${session.accessToken}` } : {}),
});

// Human-like delay with jitter
const humanDelay = (minMs: number, maxMs: number): Promise<void> =>
  new Promise(r => setTimeout(r, minMs + Math.random() * (maxMs - minMs)));

// Enhanced retry with session refresh and proper backoff
const fetchWithRetry = async (
  url: string,
  session: {
    accessToken: string | null;
    csrfToken: string | null;
    cookies: string;
  },
  maxRetries = 3
): Promise<Response | null> => {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const agent = getProxyAgent();
      const headers = buildApiHeaders(session);
      const fetchOptions: RequestInit & { agent?: any } = { headers };
      if (agent) fetchOptions.agent = agent;

      const response = await fetch(url, fetchOptions);

      // Log detailed errors
      if (response.status === 403 || response.status === 401) {
        const body = await response.text();
        console.error(`Vinted auth error (${response.status}):`, {
          attempt: attempt + 1,
          hasCloudflare: body.includes('cloudflare'),
          hasChallenge: body.includes('challenge'),
          bodyPreview: body.substring(0, 300),
        });
      }

      if (response.status === 401 || response.status === 403) {
        // Clear cache and refresh session
        sessionCache = null;
        const newSession = await initializeSession();
        if (newSession && attempt < maxRetries - 1) {
          console.log('Session refreshed, retrying...');
          session = newSession; // Use new session for next attempt
          await humanDelay(1000, 2000);
          continue;
        }
        return null;
      }

      if (response.status === 429) {
        const backoffDelay = Math.pow(2, attempt) * 3000 + Math.random() * 2000;
        console.log(`Rate limited, waiting ${Math.round(backoffDelay)}ms...`);
        await humanDelay(backoffDelay, backoffDelay + 1000);
        continue;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
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

// Build search params with cache busting
const buildSearchParams = (config: AlertConfig, page: number = 1): URLSearchParams => {
  const params = new URLSearchParams({
    search_text: config.keywords.join(' '),
    order: 'newest_first',
    per_page: '96',
    page: page.toString(),
    currency: 'GBP',
    time: Date.now().toString(), // Cache buster
    ab_tests: 'catalog_cards:v3,catalog_inline_filters:true',
  });

  if (config.price_min) params.set('price_from', config.price_min.toString());
  if (config.price_max) params.set('price_to', config.price_max.toString());

  return params;
};

// Unchanged helper functions
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
  const items: ScrapedItem[] = [];
  if (!data?.items?.length) return items;

  for (const item of data.items) {
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
      if (price <= 0) continue;

      items.push({
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
      });
    } catch (err) {
      console.error('Error parsing Vinted item:', err);
    }
  }
  return items;
};

// Fetch a single page
const fetchPage = async (
  config: AlertConfig,
  page: number,
  session: {
    accessToken: string | null;
    csrfToken: string | null;
    cookies: string;
  }
): Promise<ScrapedItem[]> => {
  const params = buildSearchParams(config, page);
  const url = `${VINTED_API_URL}?${params.toString()}`;

  const response = await fetchWithRetry(url, session);
  if (!response) return [];

  const data = await response.json();
  return parseResponse(data);
};

// Main scrape function
export const scrapeVinted = async (config: AlertConfig): Promise<ScrapedItem[]> => {
  const MAX_PAGES = 3;
  const PAGE_DELAY_MIN = 3000;
  const PAGE_DELAY_MAX = 7000;

  try {
    const session = await initializeSession();
    if (!session) {
      console.error('Vinted: Failed to initialize session');
      return [];
    }

    console.log(`Scraping Vinted: ${config.keywords.join(' ')}`);

    const allItems: ScrapedItem[] = [];
    const seenIds = new Set<string>();

    for (let page = 1; page <= MAX_PAGES; page++) {
      const items = await fetchPage(config, page, session);

      if (!items.length) break;

      for (const item of items) {
        if (!seenIds.has(item.external_id)) {
          seenIds.add(item.external_id);
          allItems.push(item);
        }
      }

      console.log(`Vinted page ${page}: ${items.length} items (total: ${allItems.length})`);

      if (items.length < 96) break;

      if (page < MAX_PAGES) {
        await humanDelay(PAGE_DELAY_MIN, PAGE_DELAY_MAX);
      }
    }

    console.log(`Found ${allItems.length} total items on Vinted`);
    return allItems;
  } catch (error) {
    console.error('Vinted scraping error:', error);
    return [];
  }
};

export default scrapeVinted;