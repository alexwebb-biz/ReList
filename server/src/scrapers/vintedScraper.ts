import { AlertConfig, ScrapedItem } from '../services/scraperService.js';
import got from 'got';
import { HttpsProxyAgent } from 'https-proxy-agent';

const VINTED_BASE_URL = 'https://www.vinted.co.uk';
const VINTED_API_URL = `${VINTED_BASE_URL}/api/v2/catalog/items`;

// 🔒 Proxy configuration
const proxyAgent = new HttpsProxyAgent(
  'http://prgqtyce:i12swgzmfjc4@198.105.121.200:6462'
);

// Session token cache
let sessionCache: {
  accessToken: string | null;
  cookies: string;
  expiresAt: number;
} | null = null;

/**
 * Initialize session (cookies + optional access token)
 */
const initializeSession = async (): Promise<{ accessToken: string | null; cookies: string } | null> => {
  if (sessionCache && sessionCache.expiresAt > Date.now()) {
    return { accessToken: sessionCache.accessToken, cookies: sessionCache.cookies };
  }

  try {
    const response = await got(VINTED_BASE_URL, {
      agent: { https: proxyAgent },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-GB,en;q=0.9',
      },
      http2: false,
    });

    const rawCookies = response.headers['set-cookie'] || [];
    const cookies = rawCookies
      .map(c => c.split(';')[0])
      .join('; ');

    const accessTokenMatch = cookies.match(/access_token_web=([^;]+)/);
    const accessToken = accessTokenMatch ? accessTokenMatch[1] : null;

    sessionCache = {
      accessToken,
      cookies,
      expiresAt: Date.now() + 90 * 60 * 1000,
    };

    return { accessToken, cookies };
  } catch (error) {
    console.error('Vinted session init error:', error);
    return null;
  }
};

const buildSearchParams = (config: AlertConfig, page = 1): URLSearchParams => {
  const params = new URLSearchParams();
  params.set('search_text', config.keywords.join(' '));
  params.set('order', 'newest_first');
  params.set('per_page', '96');
  params.set('page', page.toString());

  if (config.price_min) params.set('price_from', config.price_min.toString());
  if (config.price_max) params.set('price_to', config.price_max.toString());

  return params;
};

const extractPrice = (item: any): number => {
  if (typeof item.price === 'number') return item.price;
  if (typeof item.price === 'string') return parseFloat(item.price) || 0;
  if (item.price?.amount) return parseFloat(item.price.amount) || 0;
  if (item.total_item_price?.amount) return parseFloat(item.total_item_price.amount) || 0;
  return 0;
};

const parseResponse = (data: any): ScrapedItem[] => {
  if (!Array.isArray(data?.items)) return [];

  return data.items
    .map((item: any) => {
      const price = extractPrice(item);
      if (price <= 0) return null;

      const imageUrls = [
        item.photo?.url,
        ...(item.photos?.slice(0, 4).map((p: any) => p.url) || []),
      ].filter(Boolean);

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
        url: `${VINTED_BASE_URL}/items/${item.id}`,
        seller_name: item.user?.login || null,
        posted_at: item.created_at_ts
          ? new Date(item.created_at_ts * 1000).toISOString()
          : null,
      };
    })
    .filter(Boolean) as ScrapedItem[];
};

const fetchWithRetry = async (
  url: string,
  headers: Record<string, string>,
  maxRetries = 3
): Promise<any | null> => {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await got(url, {
        agent: { https: proxyAgent },
        headers,
        http2: false,
        responseType: 'json',
      });

      return response.body;
    } catch (error: any) {
      const status = error.response?.statusCode;

      if (status === 401 || status === 403) {
        sessionCache = null;
        const session = await initializeSession();
        if (!session) return null;

        headers.Cookie = session.cookies;
        if (session.accessToken) {
          headers.Authorization = `Bearer ${session.accessToken}`;
        }
        continue;
      }

      if (status === 429) {
        await new Promise(r => setTimeout(r, 2500 + Math.random() * 1000));
        continue;
      }

      if (attempt === maxRetries - 1) {
        console.error('Vinted fetch failed:', error.message);
        return null;
      }

      await new Promise(r => setTimeout(r, 1500));
    }
  }

  return null;
};

const fetchPage = async (
  config: AlertConfig,
  page: number,
  session: { accessToken: string | null; cookies: string }
): Promise<ScrapedItem[]> => {
  const url = `${VINTED_API_URL}?${buildSearchParams(config, page)}`;

  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    'Accept': 'application/json',
    'Accept-Language': 'en-GB,en;q=0.9',
    'X-Requested-With': 'XMLHttpRequest',
    'Referer': VINTED_BASE_URL,
    'Origin': VINTED_BASE_URL,
    'Cookie': session.cookies,
  };

  if (session.accessToken) {
    headers.Authorization = `Bearer ${session.accessToken}`;
  }

  const data = await fetchWithRetry(url, headers);
  if (!data) return [];

  return parseResponse(data);
};

export const scrapeVinted = async (config: AlertConfig): Promise<ScrapedItem[]> => {
  const session = await initializeSession();
  if (!session) return [];

  const allItems: ScrapedItem[] = [];
  const seenIds = new Set<string>();

  for (let page = 1; page <= 3; page++) {
    const items = await fetchPage(config, page, session);
    if (!items.length) break;

    for (const item of items) {
      if (!seenIds.has(item.external_id)) {
        seenIds.add(item.external_id);
        allItems.push(item);
      }
    }

    await new Promise(r => setTimeout(r, 2500));
  }

  return allItems;
};

export default scrapeVinted;
