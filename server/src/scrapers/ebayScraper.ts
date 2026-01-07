import { AlertConfig, ScrapedItem } from '../services/scraperService.js';

// eBay Browse API - 5,000 free calls per day
// Register at developer.ebay.com to get credentials
const EBAY_API_URL = 'https://api.ebay.com/buy/browse/v1/item_summary/search';
const EBAY_AUTH_URL = 'https://api.ebay.com/identity/v1/oauth2/token';

// Cache token with expiry
let cachedToken: { token: string; expiresAt: number } | null = null;

// Get OAuth access token
const getAccessToken = async (): Promise<string | null> => {
  const appId = process.env.EBAY_APP_ID;
  const certId = process.env.EBAY_CERT_ID;

  if (!appId || !certId) {
    console.log('eBay API credentials not configured (EBAY_APP_ID, EBAY_CERT_ID)');
    return null;
  }

  // Check if we have a valid cached token
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }

  try {
    const credentials = Buffer.from(`${appId}:${certId}`).toString('base64');

    const response = await fetch(EBAY_AUTH_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope',
    });

    if (!response.ok) {
      console.error('eBay auth failed:', response.status);
      return null;
    }

    const data = await response.json();

    // Cache token (expires in ~2 hours, refresh 5 min early)
    cachedToken = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in - 300) * 1000,
    };

    return data.access_token;
  } catch (error) {
    console.error('eBay auth error:', error);
    return null;
  }
};

// Build API search parameters
const buildSearchParams = (config: AlertConfig): URLSearchParams => {
  const params = new URLSearchParams();
  params.set('q', config.keywords.join(' '));
  params.set('limit', '50');
  params.set('sort', 'newlyListed');

  // Build filter string
  let filterParts: string[] = ['buyingOptions:{FIXED_PRICE}'];

  // Price filter
  if (config.price_min && config.price_max) {
    filterParts.push(`price:[${config.price_min}..${config.price_max}]`);
  } else if (config.price_min) {
    filterParts.push(`price:[${config.price_min}..]`);
  } else if (config.price_max) {
    filterParts.push(`price:[..${config.price_max}]`);
  }

  filterParts.push('priceCurrency:GBP');

  params.set('filter', filterParts.join(','));

  return params;
};

// Parse API response
const parseApiResponse = (data: any): ScrapedItem[] => {
  const items: ScrapedItem[] = [];

  if (!data.itemSummaries || !Array.isArray(data.itemSummaries)) {
    return items;
  }

  for (const item of data.itemSummaries) {
    try {
      const imageUrls: string[] = [];
      if (item.image?.imageUrl) {
        imageUrls.push(item.image.imageUrl);
      }
      if (item.additionalImages) {
        for (const img of item.additionalImages.slice(0, 4)) {
          if (img.imageUrl) {
            imageUrls.push(img.imageUrl);
          }
        }
      }

      // Parse price
      let price = 0;
      if (item.price?.value) {
        price = parseFloat(item.price.value);
      }

      // Parse condition
      let condition = null;
      if (item.condition) {
        condition = item.conditionId === '1000' ? 'New' :
                   item.conditionId === '3000' ? 'Used' : item.condition;
      }

      items.push({
        external_id: `ebay-${item.itemId}`,
        platform: 'eBay',
        title: item.title || '',
        description: item.shortDescription || null,
        price,
        currency: item.price?.currency || 'GBP',
        location: item.itemLocation?.postalCode || item.itemLocation?.city || null,
        condition,
        image_urls: imageUrls,
        url: item.itemWebUrl || item.itemHref || '',
        seller_name: item.seller?.username || null,
        posted_at: item.itemCreationDate || null,
      });
    } catch (err) {
      console.error('Error parsing eBay API item:', err);
    }
  }

  return items;
};

// Main scrape function using Browse API
export const scrapeEbay = async (config: AlertConfig): Promise<ScrapedItem[]> => {
  try {
    const token = await getAccessToken();

    if (!token) {
      console.log('eBay API not available, skipping');
      return [];
    }

    const params = buildSearchParams(config);
    const url = `${EBAY_API_URL}?${params.toString()}`;

    console.log(`Scraping eBay via API: ${config.keywords.join(' ')}`);

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_GB', // Critical for UK results
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`eBay API returned ${response.status}:`, errorText);
      return [];
    }

    const data = await response.json();
    const items = parseApiResponse(data);

    console.log(`Found ${items.length} items on eBay`);
    return items;
  } catch (error) {
    console.error('eBay API error:', error);
    return [];
  }
};

export default scrapeEbay;
