import { AlertConfig, ScrapedItem } from '../services/scraperService.js';
import { gotScraping } from 'got-scraping';
import { getRandomProxy, ProxyConfig } from '../config/proxies.js';
import { CookieJar } from 'tough-cookie';
import { chromium, Browser, Page } from 'playwright';

// FIX: Remove trailing space
const VINTED_BASE_URL = 'https://www.vinted.co.uk';
const VINTED_API_URL = `${VINTED_BASE_URL}/api/v2/catalog/items`;

interface SessionData {
  csrfToken: string | null;
  cookies: string;
  userAgent: string;
}

// Primary API scraper (fixed version)
class VintedApiScraper {
  private cookieJar = new CookieJar();
  private sessionCache: SessionData | null = null;

  async initializeSession(): Promise<SessionData | null> {
    try {
      const proxy = getRandomProxy();
      console.log(`🔌 API: Initializing session${proxy ? ' with proxy' : ''}...`);
      
      const response = await gotScraping.get(VINTED_BASE_URL, {
        headerGeneratorOptions: {
          browsers: [{ name: 'chrome', minVersion: 131 }],
          operatingSystems: ['windows'],
          locales: ['en-GB'],
        },
        proxyUrl: proxy ? this.buildProxyUrl(proxy) : undefined,
        cookieJar: this.cookieJar,
        timeout: { request: 30000 },
        throwHttpErrors: false,
      });

      if (response.statusCode !== 200) {
        throw new Error(`HTTP ${response.statusCode}`);
      }

      await this.delay(3000, 5000);
      
      const cookies = await this.cookieJar.getCookieString(VINTED_BASE_URL);
      const csrfToken = this.extractCsrfToken(response.body);

      return {
        csrfToken,
        cookies,
        userAgent: response.request.options.headers['user-agent'] as string,
      };
    } catch (error) {
      console.error('API session init failed:', error);
      return null;
    }
  }

  private buildProxyUrl(proxy: ProxyConfig): string {
    return `http://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`;
  }

  private extractCsrfToken(html: string): string | null {
    const metaMatch = html.match(/<meta[^>]*name=["']csrf-token["'][^>]*content=["']([^"']+)["']/i);
    if (metaMatch?.[1]) return metaMatch[1];
    
    const jsMatch = html.match(/["_]csrf_token["']\s*:\s*"([^"]+)"/i);
    if (jsMatch?.[1]) return jsMatch[1];
    
    return null;
  }

  private delay = (min: number, max: number) =>
    new Promise(r => setTimeout(r, min + Math.random() * (max - min)));

  async scrape(config: AlertConfig): Promise<{ items: ScrapedItem[]; hadAuthError: boolean }> {
    const session = await this.initializeSession();
    if (!session) return { items: [], hadAuthError: true };

    const searchText = config.keywords.join(' ').trim();
    if (!searchText) throw new Error('No search keywords provided');

    const params = new URLSearchParams({
      search_text: searchText,
      order: 'newest_first',
      per_page: '96',
      page: '1',
      currency: 'GBP',
      time: Math.floor(Date.now() / 1000).toString(),
    });

    if (config.price_min) params.set('price_from', config.price_min.toString());
    if (config.price_max) params.set('price_to', config.price_max.toString());

    const url = `${VINTED_API_URL}?${params.toString()}`;
    const referer = `${VINTED_BASE_URL}/catalog?${params.toString()}`;

    try {
      const proxy = getRandomProxy();
      const response = await gotScraping.get(url, {
        headers: {
          'referer': referer,
          'x-csrf-token': session.csrfToken || '',
          'accept': 'application/json, text/plain, */*',
          'accept-language': 'en-GB,en;q=0.9',
          'user-agent': session.userAgent,
        },
        proxyUrl: proxy ? this.buildProxyUrl(proxy) : undefined,
        cookieJar: this.cookieJar,
        timeout: { request: 30000 },
        throwHttpErrors: false,
      });

      // Check for auth/rate limit errors
      if (response.statusCode === 401 || response.statusCode === 403 || response.statusCode === 429) {
        console.error(`❌ API HTTP ${response.statusCode} - Will fallback to browser`);
        return { items: [], hadAuthError: true };
      }

      if (response.statusCode !== 200) {
        throw new Error(`HTTP ${response.statusCode}`);
      }

      const data = JSON.parse(response.body);
      const items = this.parseItems(data);
      
      console.log(`✅ API: Found ${items.length} items`);
      return { items, hadAuthError: false };

    } catch (error) {
      console.error('API scrape error:', error);
      return { items: [], hadAuthError: true };
    }
  }

  private parseItems(data: any): ScrapedItem[] {
    if (!data?.items?.length) return [];

    return data.items.map((item: any) => {
      const imageUrls: string[] = [];
      if (item.photo?.url) imageUrls.push(item.photo.url);
      if (item.photos) {
        item.photos.slice(0, 5).forEach((photo: any) => {
          if (photo.url && !imageUrls.includes(photo.url)) {
            imageUrls.push(photo.url);
          }
        });
      }

      const price = this.extractPrice(item);
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
        url: `https://www.vinted.co.uk/items/${item.id}`, // FIX: Removed space
        seller_name: item.user?.login || null,
        posted_at: item.created_at_ts ? new Date(item.created_at_ts * 1000).toISOString() : null,
      };
    }).filter(Boolean) as ScrapedItem[];
  }

  private extractPrice(item: any): number {
    if (typeof item.price === 'number') return item.price;
    if (item.price?.amount) return parseFloat(item.price.amount);
    if (item.total_item_price) return parseFloat(item.total_item_price);
    return 0;
  }
}

// Fallback Playwright scraper
class VintedBrowserScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;

  async initialize(): Promise<boolean> {
    try {
      console.log('🎭 Browser: Launching Playwright...');
      
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
        ],
      });

      const proxy = getRandomProxy();
      const context = await this.browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 720 },
        proxy: proxy ? {
          server: `http://${proxy.host}:${proxy.port}`,
          username: proxy.username,
          password: proxy.password,
        } : undefined,
      });

      this.page = await context.newPage();
      await this.page.goto(VINTED_BASE_URL, { waitUntil: 'networkidle' });
      await this.delay(3000, 5000);
      
      console.log('✅ Browser: Session initialized');
      return true;
    } catch (error) {
      console.error('Browser init failed:', error);
      await this.close();
      return false;
    }
  }

  async scrape(config: AlertConfig): Promise<ScrapedItem[]> {
    if (!this.page) {
      const ok = await this.initialize();
      if (!ok) return [];
    }

    try {
      const searchText = config.keywords.join(' ').trim();
      console.log(`🎭 Browser: Searching "${searchText}"...`);

      // Navigate to search page
      const params = new URLSearchParams({
        search_text: searchText,
        order: 'newest_first',
        currency: 'GBP',
      });
      if (config.price_min) params.set('price_from', config.price_min.toString());
      if (config.price_max) params.set('price_to', config.price_max.toString());

      const searchUrl = `${VINTED_BASE_URL}/catalog?${params.toString()}`;
      await this.page!.goto(searchUrl, { waitUntil: 'networkidle' });
      await this.delay(4000, 6000);

      // Scroll to load items
      await this.page!.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      await this.delay(2000, 3000);

      // Extract items from the page
      const items = await this.page!.evaluate(() => {
        const extracted: any[] = [];
        document.querySelectorAll('[data-testid="item-box"], .feed-grid__item').forEach((el, index) => {
          if (index >= 96) return; // Limit per page

          const linkEl = el.querySelector('a[href*="/items/"]') as HTMLAnchorElement;
          const imgEl = el.querySelector('img') as HTMLImageElement;
          const titleEl = el.querySelector('h3, .item-title, [class*="title"]') as HTMLElement;
          const priceEl = el.querySelector('.price, [class*="price"]') as HTMLElement;

          if (!linkEl) return;

          const href = linkEl.href;
          const idMatch = href.match(/\/items\/(\d+)/);
          const id = idMatch ? idMatch[1] : null;

          if (!id) return;

          const priceText = priceEl?.textContent?.replace(/[^\d.]/g, '') || '0';
          const price = parseFloat(priceText);

          extracted.push({
            id,
            title: titleEl?.textContent?.trim() || '',
            price,
            currency: 'GBP',
            url: href,
            image_url: imgEl?.src,
          });
        });
        return extracted;
      });

      const formattedItems: ScrapedItem[] = items.map(item => ({
        external_id: `vinted-${item.id}`,
        platform: 'Vinted',
        title: item.title,
        description: null,
        price: item.price,
        currency: item.currency,
        location: null,
        condition: null,
        image_urls: item.image_url ? [item.image_url] : [],
        url: item.url,
        seller_name: null,
        posted_at: null,
      }));

      console.log(`✅ Browser: Found ${formattedItems.length} items`);
      return formattedItems;

    } catch (error) {
      console.error('Browser scrape error:', error);
      return [];
    }
  }

  async close(): Promise<void> {
    if (this.page) {
      await this.page.close();
      this.page = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  private delay = (min: number, max: number) =>
    new Promise(r => setTimeout(r, min + Math.random() * (max - min)));
}

// Hybrid scraper - tries API first, then falls back to browser
export const scrapeVinted = async (config: AlertConfig): Promise<ScrapedItem[]> => {
  console.log(`\n=== Starting Vinted scrape: "${config.keywords.join(' ')}" ===`);
  
  // Attempt 1: API scraper
  const apiScraper = new VintedApiScraper();
  const apiResult = await apiScraper.scrape(config);
  
  if (!apiResult.hadAuthError && apiResult.items.length > 0) {
    return apiResult.items;
  }

  // Attempt 2: Browser scraper
  console.log('⚠️  API failed, falling back to browser...');
  const browserScraper = new VintedBrowserScraper();
  
  try {
    const items = await browserScraper.scrape(config);
    return items;
  } finally {
    await browserScraper.close();
  }
};

export default scrapeVinted;