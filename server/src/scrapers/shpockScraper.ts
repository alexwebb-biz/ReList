import { AlertConfig, ScrapedItem } from '../services/scraperService.js';

/**
 * Shpock Scraper
 *
 * Shpock uses a GraphQL API but has anti-bot protection.
 * Similar to other platforms, it requires session handling.
 */

const SHPOCK_API_URL = 'https://www.shpock.com/graphql';

// Build GraphQL query for Shpock search
const buildSearchQuery = (config: AlertConfig): string => {
  return JSON.stringify({
    operationName: 'ItemSearch',
    variables: {
      trackingSource: 'Search',
      pagination: { limit: 30, offset: 0 },
      searchQuery: config.keywords.join(' '),
      sort: 'NEWEST_FIRST',
      filters: {
        ...(config.price_min || config.price_max ? {
          price: {
            ...(config.price_min && { from: config.price_min }),
            ...(config.price_max && { to: config.price_max }),
          }
        } : {}),
      },
    },
    query: `
      query ItemSearch($searchQuery: String!, $pagination: Pagination!, $sort: SearchSort, $filters: SearchFilters) {
        itemSearch(searchQuery: $searchQuery, pagination: $pagination, sort: $sort, filters: $filters) {
          items {
            id
            title
            description
            price {
              amount
              currency
            }
            media {
              images {
                url
              }
            }
            location {
              city
            }
            user {
              id
              name
            }
            createdAt
          }
        }
      }
    `,
  });
};

// Parse Shpock API response
const parseResponse = (data: any): ScrapedItem[] => {
  const items: ScrapedItem[] = [];

  const searchItems = data?.data?.itemSearch?.items;
  if (!searchItems || !Array.isArray(searchItems)) {
    return items;
  }

  for (const item of searchItems) {
    try {
      const price = item.price?.amount ? parseFloat(item.price.amount) : 0;

      // Skip items without valid prices
      if (!price || isNaN(price) || price <= 0) {
        continue;
      }

      const imageUrls: string[] = [];
      if (item.media?.images) {
        for (const img of item.media.images.slice(0, 5)) {
          if (img.url) {
            imageUrls.push(img.url);
          }
        }
      }

      items.push({
        external_id: `shpock-${item.id}`,
        platform: 'Shpock',
        title: item.title || '',
        description: item.description || null,
        price,
        currency: item.price?.currency || 'GBP',
        location: item.location?.city || null,
        condition: null,
        image_urls: imageUrls,
        url: `https://www.shpock.com/en-gb/i/${item.id}`,
        seller_name: item.user?.name || null,
        posted_at: item.createdAt || null,
      });
    } catch (err) {
      console.error('Error parsing Shpock item:', err);
    }
  }

  return items;
};

// Fetch with exponential backoff retry
const fetchWithRetry = async (url: string, body: string, maxRetries = 3): Promise<Response | null> => {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'en-GB,en;q=0.9',
          'Origin': 'https://www.shpock.com',
          'Referer': 'https://www.shpock.com/',
        },
        body,
      });

      if (response.status === 429) {
        const backoffDelay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
        console.log(`Shpock rate limited, waiting ${Math.round(backoffDelay)}ms...`);
        await new Promise(r => setTimeout(r, backoffDelay));
        continue;
      }

      if (response.status === 403) {
        console.log('Shpock blocked request - may need additional headers or session');
        return null;
      }

      return response;
    } catch (error) {
      if (attempt === maxRetries - 1) {
        console.error('Shpock fetch failed after retries:', error);
        return null;
      }
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }

  return null;
};

// Main scrape function
export const scrapeShpock = async (config: AlertConfig): Promise<ScrapedItem[]> => {
  try {
    const query = buildSearchQuery(config);
    console.log(`Scraping Shpock: ${config.keywords.join(' ')}`);

    const response = await fetchWithRetry(SHPOCK_API_URL, query);

    if (!response) {
      console.log('Shpock: No response after retries');
      return [];
    }

    if (!response.ok) {
      console.log(`Shpock API returned ${response.status}`);
      return [];
    }

    const data = await response.json();
    const items = parseResponse(data);

    console.log(`Found ${items.length} items on Shpock`);
    return items;
  } catch (error) {
    console.error('Shpock scraping error:', error);
    return [];
  }
};

export default scrapeShpock;
