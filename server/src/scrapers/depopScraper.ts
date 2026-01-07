import { randomUUID } from 'crypto';
import { AlertConfig, ScrapedItem } from '../services/scraperService.js';

const DEPOP_API_URL = 'https://webapi.depop.com/api/v2/search/products';

// Depop requires specific UUID headers to bypass Cloudflare
// ~10% success rate with raw HTTP, may need scraping service for production
const generateDepopHeaders = () => ({
  'accept': '*/*',
  'content-type': 'application/json',
  'depop-device-id': randomUUID(),     // Required UUID
  'depop-search-id': randomUUID(),     // Required UUID
  'depop-session-id': randomUUID(),    // Required UUID
  'origin': 'https://www.depop.com',
  'referer': 'https://www.depop.com/',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'accept-language': 'en-GB,en;q=0.9',
});

// Build Depop API request
const buildSearchParams = (config: AlertConfig): URLSearchParams => {
  const params = new URLSearchParams();
  params.set('what', config.keywords.join(' '));
  params.set('sort', 'newlyListed');
  params.set('itemsPerPage', '24');
  params.set('country', 'gb');
  params.set('currency', 'GBP');

  if (config.price_min) {
    params.set('priceMin', config.price_min.toString());
  }
  if (config.price_max) {
    params.set('priceMax', config.price_max.toString());
  }

  return params;
};

// Parse Depop API response
const parseResponse = (data: any): ScrapedItem[] => {
  const items: ScrapedItem[] = [];

  if (!data.products || !Array.isArray(data.products)) {
    return items;
  }

  for (const product of data.products) {
    try {
      const imageUrls: string[] = [];
      if (product.preview?.url) {
        imageUrls.push(product.preview.url);
      }
      if (product.pictures) {
        for (const pic of product.pictures.slice(0, 5)) {
          if (pic.url && !imageUrls.includes(pic.url)) {
            imageUrls.push(pic.url);
          }
        }
      }

      // Get price
      let price = 0;
      if (product.price?.priceAmount) {
        price = parseFloat(product.price.priceAmount);
      } else if (product.priceAmount) {
        price = parseFloat(product.priceAmount);
      }

      items.push({
        external_id: `depop-${product.id || product.slug}`,
        platform: 'Depop',
        title: product.description?.substring(0, 100) || product.slug || '',
        description: product.description || null,
        price,
        currency: product.price?.currencyName || 'GBP',
        location: product.seller?.city || null,
        condition: product.condition || null,
        image_urls: imageUrls,
        url: `https://www.depop.com/products/${product.slug || product.id}`,
        seller_name: product.seller?.username || null,
        posted_at: product.pub_date || null,
      });
    } catch (err) {
      console.error('Error parsing Depop item:', err);
    }
  }

  return items;
};

// Fetch with exponential backoff retry
const fetchWithRetry = async (url: string, maxRetries = 3): Promise<Response | null> => {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Generate fresh headers for each attempt (new UUIDs)
      const headers = generateDepopHeaders();

      const response = await fetch(url, { headers });

      if (response.status === 403 || response.status === 503) {
        // Cloudflare blocked - exponential backoff with jitter
        const backoffDelay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
        console.log(`Depop Cloudflare block (${response.status}), retry in ${Math.round(backoffDelay)}ms...`);
        await new Promise(r => setTimeout(r, backoffDelay));
        continue;
      }

      if (response.status === 429) {
        const backoffDelay = Math.pow(2, attempt) * 2000 + Math.random() * 1000;
        console.log(`Depop rate limited, waiting ${Math.round(backoffDelay)}ms...`);
        await new Promise(r => setTimeout(r, backoffDelay));
        continue;
      }

      return response;
    } catch (error) {
      if (attempt === maxRetries - 1) {
        console.error('Depop fetch failed after retries:', error);
        return null;
      }
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }

  return null;
};

// Main scrape function
export const scrapeDepop = async (config: AlertConfig): Promise<ScrapedItem[]> => {
  try {
    const params = buildSearchParams(config);
    const url = `${DEPOP_API_URL}?${params.toString()}`;
    console.log(`Scraping Depop: ${config.keywords.join(' ')}`);

    const response = await fetchWithRetry(url);

    if (!response) {
      console.log('Depop: No response after retries');
      return [];
    }

    if (!response.ok) {
      console.log(`Depop API returned ${response.status} - Cloudflare protection likely active`);
      return [];
    }

    const data = await response.json();
    const items = parseResponse(data);

    console.log(`Found ${items.length} items on Depop`);
    return items;
  } catch (error) {
    console.error('Depop scraping error:', error);
    return [];
  }
};

export default scrapeDepop;
