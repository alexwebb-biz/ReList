import puppeteer, { Browser, Page } from 'puppeteer';
import { AlertConfig, ScrapedItem } from '../services/scraperService.js';
import { getRandomProxy, getProxyUrl } from '../config/proxies.js';

const DEPOP_BASE_URL = 'https://www.depop.com';

// Browser instance cache (reuse browser across scrapes)
let browserInstance: Browser | null = null;

// Get or create browser instance
const getBrowser = async (proxyUrl?: string): Promise<Browser> => {
  if (browserInstance && browserInstance.connected) {
    return browserInstance;
  }

  const launchOptions: any = {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
    ],
  };

  // Add proxy if available
  if (proxyUrl) {
    const url = new URL(proxyUrl);
    launchOptions.args.push(`--proxy-server=${url.host}`);
  }

  browserInstance = await puppeteer.launch(launchOptions);
  return browserInstance;
};

// Build Depop search URL
const buildSearchUrl = (config: AlertConfig): string => {
  const keywords = config.keywords.join(' ');
  const encodedKeywords = encodeURIComponent(keywords);

  let url = `${DEPOP_BASE_URL}/search/?q=${encodedKeywords}`;

  // Add price filters if specified
  if (config.price_min) {
    url += `&priceMin=${config.price_min}`;
  }
  if (config.price_max) {
    url += `&priceMax=${config.price_max}`;
  }

  // Sort by newest
  url += '&sort=newlyListed';

  return url;
};

// Scrape a single page
const scrapePage = async (page: Page, config: AlertConfig): Promise<ScrapedItem[]> => {
  const items: ScrapedItem[] = [];

  try {
    const searchUrl = buildSearchUrl(config);
    console.log(`Navigating to: ${searchUrl}`);

    // Navigate to search page with extended timeout
    await page.goto(searchUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    // Wait for products to load
    await page.waitForSelector('article[data-testid*="product"]', { timeout: 10000 });

    // Scroll to load more items
    await page.evaluate(() => {
      window.scrollBy(0, window.innerHeight * 2);
    });
    await new Promise(r => setTimeout(r, 2000));

    // Extract product data
    const products = await page.evaluate(() => {
      const productCards = document.querySelectorAll('article[data-testid*="product"]');
      const results: any[] = [];

      productCards.forEach((card) => {
        try {
          // Get product link
          const linkEl = card.querySelector('a[href*="/products/"]') as HTMLAnchorElement;
          if (!linkEl) return;

          const url = linkEl.href;
          const slug = url.split('/products/')[1]?.split('?')[0];
          if (!slug) return;

          // Get title/description
          const titleEl = card.querySelector('p[data-testid="product__title"]');
          const title = titleEl?.textContent?.trim() || '';

          // Get price
          const priceEl = card.querySelector('p[data-testid="product__price"]');
          const priceText = priceEl?.textContent?.trim() || '';
          const priceMatch = priceText.match(/£([\d.]+)/);
          const price = priceMatch ? parseFloat(priceMatch[1]) : 0;

          // Get image
          const imgEl = card.querySelector('img') as HTMLImageElement;
          const imageUrl = imgEl?.src || imgEl?.dataset?.src || null;

          // Get seller (if available)
          const sellerEl = card.querySelector('p[data-testid="product__seller"]');
          const seller = sellerEl?.textContent?.trim() || null;

          results.push({
            slug,
            title,
            price,
            imageUrl,
            seller,
            url,
          });
        } catch (err) {
          console.error('Error extracting product:', err);
        }
      });

      return results;
    });

    console.log(`Extracted ${products.length} products from Depop`);

    // Convert to ScrapedItem format
    for (const product of products) {
      if (!product.slug || product.price <= 0) continue;

      items.push({
        external_id: `depop-${product.slug}`,
        platform: 'Depop',
        title: product.title,
        description: null,
        price: product.price,
        currency: 'GBP',
        location: null,
        condition: null,
        image_urls: product.imageUrl ? [product.imageUrl] : [],
        url: product.url,
        seller_name: product.seller,
        posted_at: null,
      });
    }

    return items;
  } catch (error) {
    console.error('Error scraping Depop page:', error);
    return items;
  }
};

// Main scrape function
export const scrapeDepop = async (config: AlertConfig): Promise<ScrapedItem[]> => {
  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    // Get proxy
    const proxy = getRandomProxy();
    const proxyUrl = proxy ? getProxyUrl(proxy) : undefined;

    if (proxy) {
      console.log(`Depop using proxy: ${proxy.host}:${proxy.port}`);
    } else {
      console.warn('Depop: No proxies available, making direct request');
    }

    console.log(`Scraping Depop: ${config.keywords.join(' ')}`);

    // Launch browser
    browser = await getBrowser(proxyUrl);
    page = await browser.newPage();

    // Set viewport
    await page.setViewport({ width: 1920, height: 1080 });

    // Set realistic user agent
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    );

    // Authenticate proxy if needed
    if (proxy) {
      await page.authenticate({
        username: proxy.username,
        password: proxy.password,
      });
    }

    // Scrape products
    const items = await scrapePage(page, config);

    // Apply filters
    let filteredItems = items;

    // Filter by price range
    if (config.price_min || config.price_max) {
      filteredItems = filteredItems.filter(item => {
        if (config.price_min && item.price < config.price_min) return false;
        if (config.price_max && item.price > config.price_max) return false;
        return true;
      });
    }

    // Filter by exclude keywords
    if (config.exclude_keywords && config.exclude_keywords.length > 0) {
      const excludePattern = new RegExp(config.exclude_keywords.join('|'), 'i');
      filteredItems = filteredItems.filter(item => {
        return !excludePattern.test(item.title);
      });
    }

    console.log(`Found ${filteredItems.length} items on Depop (${items.length} before filtering)`);

    await page.close();
    return filteredItems;
  } catch (error) {
    console.error('Depop scraping error:', error);
    if (page) await page.close();
    return [];
  }
};

// Cleanup function - call this on server shutdown
export const closeBrowser = async (): Promise<void> => {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
};

export default scrapeDepop;
