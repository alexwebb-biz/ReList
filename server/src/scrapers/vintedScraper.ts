import { AlertConfig, ScrapedItem } from '../services/scraperService.js';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { getRandomProxy, getProxyUrl } from '../config/proxies.js';

const VINTED_BASE_URL = 'https://www.vinted.co.uk';
const VINTED_API_URL = `${VINTED_BASE_URL}/api/v2/catalog/items`;

// Session token cache (tokens expire in ~2 hours)
let sessionCache: {
  accessToken: string | null;
  cookies: string;
  expiresAt: number;
  proxyAgent: HttpsProxyAgent<string> | null;
} | null = null;

// Initialize session to get access token and cookies
const initializeSession = async (): Promise<{ accessToken: string | null; cookies: string; proxyAgent: HttpsProxyAgent<string> | null } | null> => {
  // Check if we have a valid cached session
  if (sessionCache && sessionCache.expiresAt > Date.now()) {
    return { accessToken: sessionCache.accessToken, cookies: sessionCache.cookies, proxyAgent: sessionCache.proxyAgent };
  }

  try {
    // Get a random proxy for this session
    const proxy = getRandomProxy();
    const fetchOptions: any = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
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
      },
    };

    // Add proxy if available
    if (proxy) {
      const proxyUrl = getProxyUrl(proxy);
      fetchOptions.agent = new HttpsProxyAgent(proxyUrl);
      console.log(`Using proxy: ${proxy.host}:${proxy.port}`);
    } else {
      console.warn('No proxies available, making direct request');
    }

    // First, hit the main page to get session cookies
    const response = await fetch(VINTED_BASE_URL, fetchOptions);

    if (!response.ok) {
      console.log('Vinted session init failed:', response.status);
      if (response.status === 403) {
        console.warn('⚠️  Vinted 403 - Proxy may be blocked or fingerprint detected');
      }
      return null;
    }

    // Add delay to simulate human behavior
    await new Promise(r => setTimeout(r, 1000 + Math.random() * 1000));

    // Extract cookies from response - improved parsing
    // Note: Standard fetch Headers don't support getSetCookie() in Node.js yet
    // So we'll use a workaround by getting all set-cookie headers
    const setCookieHeader = response.headers.get('set-cookie') || '';
    const cookieMap = new Map<string, string>();

    // Split by comma but be careful of expires dates which also contain commas
    const cookieParts = setCookieHeader.split(/,(?=\s*\w+=)/);

    for (const cookieStr of cookieParts) {
      const parts = cookieStr.split(';')[0].trim();
      const equalsIndex = parts.indexOf('=');
      if (equalsIndex > 0) {
        const key = parts.substring(0, equalsIndex);
        const value = parts.substring(equalsIndex + 1);
        if (key && value) {
          cookieMap.set(key, value);
        }
      }
    }

    // Add essential cookies if missing (Vinted requires these)
    if (!cookieMap.has('_vinted_fr_session')) {
      // Generate a session-like value
      const sessionId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      cookieMap.set('_vinted_fr_session', sessionId);
    }

    const cookies = Array.from(cookieMap.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');

    // Try to extract access token from cookies
    const accessToken = cookieMap.get('access_token_web') || null;

    // Get the proxy agent to reuse for subsequent requests
    const proxyAgent = proxy ? new HttpsProxyAgent(getProxyUrl(proxy)) : null;

    // Cache session for 1.5 hours (tokens expire in 2 hours)
    sessionCache = {
      accessToken,
      cookies,
      expiresAt: Date.now() + 90 * 60 * 1000,
      proxyAgent,
    };

    return { accessToken, cookies, proxyAgent };
  } catch (error) {
    console.error('Vinted session init error:', error);
    return null;
  }
};

// Build Vinted API request
const buildSearchParams = (config: AlertConfig, page: number = 1): URLSearchParams => {
  const params = new URLSearchParams();
  params.set('search_text', config.keywords.join(' '));
  params.set('order', 'newest_first');
  params.set('per_page', '96'); // Max allowed per page
  params.set('page', page.toString());

  if (config.price_min) {
    params.set('price_from', config.price_min.toString());
  }
  if (config.price_max) {
    params.set('price_to', config.price_max.toString());
  }

  return params;
};

// Extract price from various Vinted API response formats
const extractPrice = (item: any): number => {
  // Try different price field formats
  if (typeof item.price === 'number') {
    return item.price;
  }
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
  if (item.total_item_price?.amount) {
    const parsed = parseFloat(item.total_item_price.amount);
    if (!isNaN(parsed)) return parsed;
  }
  // Return 0 as fallback (will be filtered out)
  return 0;
};

// Parse Vinted API response
const parseResponse = (data: any): ScrapedItem[] => {
  const items: ScrapedItem[] = [];

  if (!data.items || !Array.isArray(data.items)) {
    return items;
  }

  for (const item of data.items) {
    try {
      const imageUrls: string[] = [];
      if (item.photo?.url) {
        imageUrls.push(item.photo.url);
      }
      if (item.photos) {
        for (const photo of item.photos.slice(0, 5)) {
          if (photo.url && !imageUrls.includes(photo.url)) {
            imageUrls.push(photo.url);
          }
        }
      }

      const price = extractPrice(item);

      // Skip items without valid prices
      if (price <= 0 || isNaN(price)) {
        continue;
      }

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

// Fetch with exponential backoff retry
const fetchWithRetry = async (
  url: string,
  headers: Record<string, string>,
  proxyAgent: HttpsProxyAgent<string> | null,
  maxRetries = 3
): Promise<Response | null> => {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const fetchOptions: any = { headers };
      if (proxyAgent) {
        fetchOptions.agent = proxyAgent;
      }
      const response = await fetch(url, fetchOptions);

      if (response.status === 401 || response.status === 403) {
        // Session expired or blocked - clear cache and retry with new session
        console.log(`Vinted auth failed (${response.status}), refreshing session...`);
        sessionCache = null;
        const session = await initializeSession();
        if (session) {
          // Retry with new session
          const newHeaders = { ...headers };
          if (session.accessToken) {
            newHeaders['Authorization'] = `Bearer ${session.accessToken}`;
          }
          newHeaders['Cookie'] = session.cookies;
          continue;
        }
        return null;
      }

      if (response.status === 429) {
        // Rate limited - exponential backoff with jitter
        const backoffDelay = Math.pow(2, attempt) * 2000 + Math.random() * 1000;
        console.log(`Vinted rate limited, waiting ${Math.round(backoffDelay)}ms...`);
        await new Promise(r => setTimeout(r, backoffDelay));
        continue;
      }

      return response;
    } catch (error) {
      if (attempt === maxRetries - 1) {
        console.error('Vinted fetch failed after retries:', error);
        return null;
      }
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }

  return null;
};

// Fetch a single page of results
const fetchPage = async (
  config: AlertConfig,
  page: number,
  session: { accessToken: string | null; cookies: string; proxyAgent: HttpsProxyAgent<string> | null }
): Promise<ScrapedItem[]> => {
  const params = buildSearchParams(config, page);
  const url = `${VINTED_API_URL}?${params.toString()}`;

  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br, zstd',
    'Referer': 'https://www.vinted.co.uk/catalog',
    'Origin': 'https://www.vinted.co.uk',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
    'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'DNT': '1',
    'Connection': 'keep-alive',
    'Priority': 'u=1, i',
    'Cookie': session.cookies,
  };

  if (session.accessToken) {
    headers['Authorization'] = `Bearer ${session.accessToken}`;
  }

  const response = await fetchWithRetry(url, headers, session.proxyAgent);

  if (!response || !response.ok) {
    return [];
  }

  const data = await response.json();
  return parseResponse(data);
};

// Main scrape function - fetches multiple pages
export const scrapeVinted = async (config: AlertConfig): Promise<ScrapedItem[]> => {
  const MAX_PAGES = 3; // Fetch up to 3 pages (288 items max)
  const PAGE_DELAY = 2000 + Math.random() * 1000; // 2-3s randomized delay between pages

  try {
    // Initialize session first
    const session = await initializeSession();
    if (!session) {
      console.log('Vinted: Failed to initialize session');
      return [];
    }

    console.log(`Scraping Vinted: ${config.keywords.join(' ')}`);

    const allItems: ScrapedItem[] = [];
    const seenIds = new Set<string>();

    for (let page = 1; page <= MAX_PAGES; page++) {
      const items = await fetchPage(config, page, session);

      if (items.length === 0) {
        // No more results
        break;
      }

      // Deduplicate within this scrape
      for (const item of items) {
        if (!seenIds.has(item.external_id)) {
          seenIds.add(item.external_id);
          allItems.push(item);
        }
      }

      console.log(`Vinted page ${page}: ${items.length} items (total: ${allItems.length})`);

      // If we got fewer items than per_page, there's no next page
      if (items.length < 96) {
        break;
      }

      // Delay before next page (if not last page)
      if (page < MAX_PAGES) {
        await new Promise(r => setTimeout(r, PAGE_DELAY));
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
