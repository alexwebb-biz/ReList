import { AlertConfig, ScrapedItem } from '../services/scraperService.js';
import { gotScraping } from 'got-scraping';
import { CookieJar } from 'tough-cookie';
import { chromium, Browser, Page } from 'playwright';
import { getRandomProxy, getProxyUrl, ProxyConfig } from '../config/proxies.js';

const DEPOB_BASE_URL = 'https://www.depop.com';
const DEPOB_API_URL = 'https://webapi.depop.com/api/v3/search/products/';

// Generate random UUID-like string
const generateId = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

/**
 * Primary API-based scraper for Depop
 */
class DepopApiScraper {
  private cookieJar = new CookieJar();

  private buildProxyUrl(proxy: ProxyConfig): string {
    return `http://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`;
  }

  private delay = (min: number, max: number) =>
    new Promise(r => setTimeout(r, min + Math.random() * (max - min)));

  async scrape(config: AlertConfig): Promise<{ items: ScrapedItem[]; hadAuthError: boolean }> {
    const proxy = getRandomProxy();
    const deviceId = generateId();
    const sessionId = generateId();

    console.log(`🔌 API: Initializing session${proxy ? ' with proxy' : ''}...`);

    try {
      // Get cookies first
      const response = await gotScraping.get(DEPOB_BASE_URL, {
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
        return { items: [], hadAuthError: true };
      }

      await this.delay(2000, 3000);

      const searchText = config.keywords.join(' ').trim();
      if (!searchText) {
        throw new Error('No search keywords provided');
      }

      const items: ScrapedItem[] = [];
      let cursor: string | null = null;
      let hasMore = true;
      let pageCount = 0;
      const maxPages = 10;

      while (hasMore && pageCount < maxPages) {
        const params = new URLSearchParams({
          what: searchText,
          items_per_page: '48',
          country: 'gb',
          currency: 'GBP',
          sort: 'newest_first',
          ...(cursor && { cursor }),
        });

        if (config.price_min) {
          params.set('price_from', config.price_min.toString());
        }
        if (config.price_max) {
          params.set('price_to', config.price_max.toString());
        }

        const url = `${DEPOB_API_URL}?${params.toString()}`;

        const apiResponse = await gotScraping.get(url, {
          headers: {
            'depop-device-id': deviceId,
            'depop-session-id': sessionId,
            'depop-search-id': generateId(),
            'accept': 'application/json, text/plain, */*',
            'accept-language': 'en-GB,en;q=0.9',
            'referer': `${DEPOB_BASE_URL}/search/?q=${encodeURIComponent(searchText)}`,
            'user-agent': response.request.options.headers['user-agent'] as string,
            'origin': DEPOB_BASE_URL,
            'dnt': '1',
          },
          proxyUrl: proxy ? this.buildProxyUrl(proxy) : undefined,
          cookieJar: this.cookieJar,
          timeout: { request: 30000 },
          throwHttpErrors: false,
        });

        if (apiResponse.statusCode === 401 || apiResponse.statusCode === 403 || apiResponse.statusCode === 429) {
          console.error(`❌ API HTTP ${apiResponse.statusCode} - Will fallback to browser`);
          return { items, hadAuthError: true };
        }

        if (apiResponse.statusCode !== 200) {
          throw new Error(`HTTP ${apiResponse.statusCode}`);
        }

        const data = JSON.parse(apiResponse.body);
        const pageItems = this.parseItems(data);
        items.push(...pageItems);

        cursor = data.meta?.cursor || null;
        hasMore = data.meta?.has_more || false;
        pageCount++;

        console.log(`✅ API: Page ${pageCount} - Found ${pageItems.length} items (Total: ${items.length})`);
        await this.delay(1500, 2500);
      }

      return { items, hadAuthError: false };

    } catch (error) {
      console.error('API scrape error:', error);
      return { items: [], hadAuthError: true };
    }
  }

  private parseItems(data: any): ScrapedItem[] {
    if (!data?.products?.length) {
      return [];
    }

    return data.products.map((product: any) => {
      try {
        const imageUrls: string[] = [];
        if (product.preview) {
          const resolutions = ['1280', '960', '640', '480', '320', '210', '150'];
          for (const res of resolutions) {
            if (product.preview[res]) {
              imageUrls.push(product.preview[res]);
              break;
            }
          }
        }

        const price = this.extractPrice(product.price);
        if (price <= 0) {
          return null;
        }

        return {
          external_id: `depop-${product.id}`,
          platform: 'Depop',
          title: product.slug ? product.slug.replace(/-/g, ' ') : '',
          description: product.description || null,
          price: price,
          currency: 'GBP',
          location: null,
          condition: product.status || null,
          image_urls: imageUrls,
          url: `${DEPOB_BASE_URL}/products/${product.slug || product.id}/`,
          seller_name: null,
          posted_at: null,
        };
      } catch (err) {
        console.error('Error parsing product:', err);
        return null;
      }
    }).filter(Boolean);
  }

  private extractPrice(productPrice: any): number {
    try {
      if (typeof productPrice === 'number') {
        return productPrice;
      }
      if (productPrice?.priceAmount) {
        return parseFloat(productPrice.priceAmount);
      }
      if (productPrice?.nationalShippingCost) {
        return parseFloat(productPrice.nationalShippingCost);
      }
      return 0;
    } catch (error) {
      console.error('Error extracting price:', error);
      return 0;
    }
  }
}

/**
 * Fallback browser scraper using Playwright
 */
class DepopBrowserScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;

  async initialize(): Promise<boolean> {
    try {
      console.log('🎭 Browser: Launching Playwright...');
      
      const proxy = getRandomProxy();
      
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--disable-web-security',
        ],
      });

      const context = await this.browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        proxy: proxy ? {
          server: `http://${proxy.host}:${proxy.port}`,
          username: proxy.username,
          password: proxy.password,
        } : undefined,
        extraHTTPHeaders: {
          'Accept-Language': 'en-GB,en;q=0.9',
        },
      });

      this.page = await context.newPage();
      
      await this.page.setExtraHTTPHeaders({
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-GB,en;q=0.9',
      });

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

      const params = new URLSearchParams({
        q: searchText,
        sort: 'newlyListed',
      });

      if (config.price_min) {
        params.set('priceMin', config.price_min.toString());
      }
      if (config.price_max) {
        params.set('priceMax', config.price_max.toString());
      }

      const searchUrl = `${DEPOB_BASE_URL}/search/?${params.toString()}`;
      
      await this.page!.goto(searchUrl, { 
        waitUntil: 'networkidle',
        timeout: 60000 
      });
      
      await this.page!.waitForLoadState('domcontentloaded');
      await this.delay(3000, 4000);

      const items: ScrapedItem[] = [];
      let previousItemCount = 0;
      let scrollAttempts = 0;
      const maxScrollAttempts = 5;

      while (scrollAttempts < maxScrollAttempts) {
        const pageItems = await this.extractItemsFromPage();
        
        for (const item of pageItems) {
          if (!items.find(existing => existing.external_id === item.external_id)) {
            items.push(item);
          }
        }

        console.log(`🎭 Browser: Scroll ${scrollAttempts + 1} - Found ${items.length} total items`);

        if (items.length === previousItemCount) {
          scrollAttempts++;
        } else {
          scrollAttempts = 0;
          previousItemCount = items.length;
        }

        await this.page!.evaluate(() => {
          window.scrollBy(0, window.innerHeight * 2);
        });
        
        await this.delay(2000, 3000);

        try {
          const loadMoreButton = await this.page!.$('button[data-testid*="load-more"], button[class*="load-more"]');
          if (loadMoreButton) {
            await loadMoreButton.click();
            await this.delay(1500, 2500);
          }
        } catch (e) {
          // No load more button found
        }
      }

      console.log(`✅ Browser: Found ${items.length} items total`);
      return items;

    } catch (error) {
      console.error('Browser scrape error:', error);
      return [];
    }
  }

  private async extractItemsFromPage(): Promise<ScrapedItem[]> {
    if (!this.page) return [];

    const selectors = [
      'article[data-testid*="product"]',
      '[data-testid="product-card"]',
      'article[class*="product"]',
      '[class*="ProductCard"]',
      'a[href*="/products/"]'
    ];

    for (const selector of selectors) {
      try {
        const items = await this.page.$$eval(selector, (elements: Element[]) => {
          return elements.map((el: Element) => {
            try {
              let linkEl: HTMLAnchorElement | null = null;
              let titleEl: HTMLElement | null = null;
              let priceEl: HTMLElement | null = null;
              let imgEl: HTMLImageElement | null = null;

              if (el.tagName === 'A') {
                linkEl = el as HTMLAnchorElement;
              } else {
                linkEl = el.querySelector('a[href*="/products/"]') as HTMLAnchorElement;
              }

              if (!linkEl || !linkEl.href) return null;

              const url = linkEl.href;
              const slug = url.split('/products/')[1]?.split('?')[0];
              if (!slug) return null;

              titleEl = el.querySelector('p[data-testid="product__title"], h3, p[class*="title"]') as HTMLElement;
              const title = titleEl?.textContent?.trim() || slug.replace(/-/g, ' ');

              priceEl = el.querySelector('p[data-testid="product__price"], p[class*="price"], span[class*="price"]') as HTMLElement;
              const priceText = priceEl?.textContent?.trim() || '';
              const priceMatch = priceText.match(/£?([\d.]+)/);
              const price = priceMatch ? parseFloat(priceMatch[1]) : 0;

              imgEl = el.querySelector('img') as HTMLImageElement;
              const imageUrl = imgEl?.src || imgEl?.dataset?.src || null;

              return { slug, title, price, imageUrl, url };
            } catch (err) {
              console.error('Error extracting item:', err);
              return null;
            }
          }).filter(Boolean);
        });

        if (items.length > 0) {
          return items.map((item: any) => ({
            external_id: `depop-${item.slug}`,
            platform: 'Depop',
            title: item.title,
            description: null,
            price: item.price,
            currency: 'GBP',
            location: null,
            condition: null,
            image_urls: item.imageUrl ? [item.imageUrl] : [],
            url: item.url,
            seller_name: null,
            posted_at: null,
          }));
        }
      } catch (e) {
        continue;
      }
    }

    return [];
  }

  private delay = (min: number, max: number) =>
    new Promise(r => setTimeout(r, min + Math.random() * (max - min)));

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
}

/**
 * Main hybrid scraper function
 * Tries API first, then falls back to browser scraping
 */
export const scrapeDepop = async (config: AlertConfig): Promise<ScrapedItem[]> => {
  console.log(`\n=== Starting Depop scrape: "${config.keywords.join(' ')}" ===`);
  
  // Try API first
  const apiScraper = new DepopApiScraper();
  const apiResult = await apiScraper.scrape(config);
  
  if (!apiResult.hadAuthError && apiResult.items.length > 0) {
    console.log(`✅ API scraper successful - found ${apiResult.items.length} items`);
    
    // Apply filters
    let filteredItems = apiResult.items;
    
    if (config.price_min || config.price_max) {
      filteredItems = filteredItems.filter(item => {
        if (config.price_min && item.price < config.price_min) return false;
        if (config.price_max && item.price > config.price_max) return false;
        return true;
      });
    }

    if (config.exclude_keywords && config.exclude_keywords.length > 0) {
      const excludePattern = new RegExp(config.exclude_keywords.join('|'), 'i');
      filteredItems = filteredItems.filter(item => {
        return !excludePattern.test(item.title);
      });
    }

    console.log(`✅ After filtering: ${filteredItems.length} items`);
    return filteredItems;
  }

  // Fallback to browser if API fails
  console.log('⚠️  API failed or was blocked, falling back to browser...');
  const browserScraper = new DepopBrowserScraper();
  
  try {
    const items = await browserScraper.scrape(config);
    
    // Apply same filters
    let filteredItems = items;
    
    if (config.price_min || config.price_max) {
      filteredItems = filteredItems.filter(item => {
        if (config.price_min && item.price < config.price_min) return false;
        if (config.price_max && item.price > config.price_max) return false;
        return true;
      });
    }

    if (config.exclude_keywords && config.exclude_keywords.length > 0) {
      const excludePattern = new RegExp(config.exclude_keywords.join('|'), 'i');
      filteredItems = filteredItems.filter(item => {
        return !excludePattern.test(item.title);
      });
    }

    console.log(`✅ Browser scraper - found ${filteredItems.length} items after filtering`);
    return filteredItems;
  } finally {
    await browserScraper.close();
  }
};

export default scrapeDepop;