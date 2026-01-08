import { AlertConfig, ScrapedItem } from '../services/scraperService.js';

// eBay Browse API - 5,000 free calls per day
// Register at developer.ebay.com to get credentials

// Determine if using sandbox or production based on environment
const IS_SANDBOX = process.env.EBAY_ENV === 'SANDBOX';
const EBAY_API_URL = IS_SANDBOX
  ? 'https://api.sandbox.ebay.com/buy/browse/v1/item_summary/search'
  : 'https://api.ebay.com/buy/browse/v1/item_summary/search';
const EBAY_AUTH_URL = IS_SANDBOX
  ? 'https://api.sandbox.ebay.com/identity/v1/oauth2/token'
  : 'https://api.ebay.com/identity/v1/oauth2/token';

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

    console.log(`Authenticating with eBay ${IS_SANDBOX ? 'Sandbox' : 'Production'} API...`);

    const response = await fetch(EBAY_AUTH_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope',
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('eBay auth failed:', response.status, errorText);
      return null;
    }

    const data = await response.json();

    if (!data.access_token) {
      console.error('eBay auth response missing access_token:', data);
      return null;
    }

    console.log('eBay authentication successful!');
    console.log('Token expires in:', data.expires_in, 'seconds');

    // Cache token (expires in ~2 hours, refresh 5 min early)
    cachedToken = {
      token: data.access_token,
      expiresAt: Date.now() + ((data.expires_in || 7200) - 300) * 1000,
    };

    return data.access_token;
  } catch (error) {
    console.error('eBay auth error:', error);
    return null;
  }
};

// Build API search parameters
const buildSearchParams = (config: AlertConfig, offset: number = 0): URLSearchParams => {
  const params = new URLSearchParams();
  params.set('q', config.keywords.join(' '));
  params.set('limit', '200'); // Max allowed per request
  params.set('offset', offset.toString());
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

// Fetch a single page of results
const fetchPage = async (
  config: AlertConfig,
  offset: number,
  token: string
): Promise<{ items: ScrapedItem[]; total: number }> => {
  const params = buildSearchParams(config, offset);
  const url = `${EBAY_API_URL}?${params.toString()}`;

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
    return { items: [], total: 0 };
  }

  const data = await response.json();
  const items = parseApiResponse(data);
  const total = data.total || 0;

  return { items, total };
};

// Main scrape function using Browse API - fetches multiple pages if needed
export const scrapeEbay = async (config: AlertConfig): Promise<ScrapedItem[]> => {
  const MAX_ITEMS = 400; // Get up to 400 items (2 API calls)
  const ITEMS_PER_PAGE = 200;

  try {
    const token = await getAccessToken();

    if (!token) {
      console.log('eBay API not available, skipping');
      return [];
    }

    console.log(`Scraping eBay via API: ${config.keywords.join(' ')}`);

    const allItems: ScrapedItem[] = [];
    const seenIds = new Set<string>();
    let offset = 0;

    // Fetch first page
    const firstPage = await fetchPage(config, 0, token);

    for (const item of firstPage.items) {
      if (!seenIds.has(item.external_id)) {
        seenIds.add(item.external_id);
        allItems.push(item);
      }
    }

    console.log(`eBay page 1: ${firstPage.items.length} items (total available: ${firstPage.total})`);

    // Fetch more pages if there are more results and we haven't hit our limit
    if (firstPage.total > ITEMS_PER_PAGE && allItems.length < MAX_ITEMS) {
      offset = ITEMS_PER_PAGE;

      while (offset < firstPage.total && allItems.length < MAX_ITEMS) {
        // Small delay between API calls
        await new Promise(r => setTimeout(r, 500));

        const page = await fetchPage(config, offset, token);

        if (page.items.length === 0) break;

        for (const item of page.items) {
          if (!seenIds.has(item.external_id) && allItems.length < MAX_ITEMS) {
            seenIds.add(item.external_id);
            allItems.push(item);
          }
        }

        console.log(`eBay offset ${offset}: ${page.items.length} items (total: ${allItems.length})`);
        offset += ITEMS_PER_PAGE;
      }
    }

    console.log(`Found ${allItems.length} total items on eBay`);
    return allItems;
  } catch (error) {
    console.error('eBay API error:', error);
    return [];
  }
};

export default scrapeEbay;
