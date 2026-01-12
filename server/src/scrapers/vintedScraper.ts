import { AlertConfig, ScrapedItem } from '../services/scraperService.js';
import { gotScraping } from 'got-scraping'; // Replaces node-fetch
import { getRandomProxy } from '../config/proxies.js';

const VINTED_BASE_URL = 'https://www.vinted.co.uk';
const VINTED_API_URL = `${VINTED_BASE_URL}/api/v2/catalog/items`;

let sessionCache: {
  accessToken: string | null;
  csrfToken: string | null;
  cookies: string;
  expiresAt: number;
} | null = null;

// Parse cookies from got-scraping response
const parseCookies = (cookieHeader: string[]): Map<string, string> => {
  const map = new Map<string, string>();
  for (const cookie of cookieHeader) {
    const [keyValue] = cookie.split(';');
    const [key, ...valueParts] = keyValue.trim().split('=');
    if (key && valueParts.length) {
      map.set(key, valueParts.join('='));
    }
  }
  return map;
};

const initializeSession = async () => {
  if (sessionCache?.expiresAt > Date.now()) {
    return sessionCache;
  }

  try {
    const proxy = getRandomProxy();
    
    const response = await gotScraping.get(VINTED_BASE_URL, {
      headerGeneratorOptions: {
        browsers: [{ name: 'chrome', minVersion: 131 }],
        operatingSystems: ['windows'],
        locales: ['en-GB'],
      },
      proxyUrl: proxy ? `http://${proxy.user}:${proxy.pass}@${proxy.host}:${proxy.port}` : undefined,
      timeout: { request: 30000 },
      throwHttpErrors: false, // Don't throw on 403
    });

    if (response.statusCode !== 200) {
      console.error(`Vinted session init failed: ${response.statusCode}`);
      if (response.statusCode === 403) {
        console.error('Cloudflare blocked session init');
        console.error('Body preview:', response.body.substring(0, 300));
      }
      return null;
    }

    await new Promise(r => setTimeout(r, 2000 + Math.random() * 2000));

    // got-scraping automatically handles cookies, but we can extract them
    const cookieMap = parseCookies(response.headers['set-cookie'] || []);
    
    if (!cookieMap.has('_vinted_fr_session')) {
      cookieMap.set('_vinted_fr_session', generateSessionId());
    }

    const cookies = Array.from(cookieMap.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');

    const accessToken = cookieMap.get('access_token_web') || null;
    const csrfToken = cookieMap.get('_csrf_token') || null;

    sessionCache = {
      accessToken,
      csrfToken,
      cookies,
      expiresAt: Date.now() + 90 * 60 * 1000,
    };

    console.log('Vinted session initialized');
    return sessionCache;
  } catch (error) {
    console.error('Session init error:', error);
    return null;
  }
};

const generateSessionId = () => {
  const rand = () => Math.random().toString(36).substring(2, 15);
  return `${rand()}${rand()}`.substring(0, 43);
};

const buildSearchParams = (config: AlertConfig, page: number = 1) => {
  const params = new URLSearchParams({
    search_text: config.keywords.join(' '),
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
      
      const response = await gotScraping.get(url, {
        headers: {
          Cookie: session.cookies,
          'x-csrf-token': session.csrfToken || '',
          ...(session.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}),
        },
        proxyUrl: proxy ? `http://${proxy.user}:${proxy.pass}@${proxy.host}:${proxy.port}` : undefined,
        headerGeneratorOptions: {
          browsers: [{ name: 'chrome', minVersion: 131 }],
          operatingSystems: ['windows'],
          locales: ['en-GB'],
        },
        timeout: { request: 30000 },
        throwHttpErrors: false,
      });

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
        throw new Error(`HTTP ${response.statusCode}`);
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