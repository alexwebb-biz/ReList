import supabase from '../config/supabase.js';
import { scrapeEbay } from '../scrapers/ebayScraper.js';
import { scrapeVinted } from '../scrapers/vintedScraper.js';
import { scrapeGumtree } from '../scrapers/gumtreeScraper.js';
import { scrapeDepop } from '../scrapers/depopScraper.js';
import { scrapeFacebookMarketplace } from '../scrapers/facebookScraper.js';
import { scrapeShpock } from '../scrapers/shpockScraper.js';
import { notifyAlertMatches } from './notificationService.js';

export interface ScrapedItem {
  external_id: string;
  platform: string;
  title: string;
  description: string | null;
  price: number;
  currency: string;
  location: string | null;
  condition: string | null;
  image_urls: string[];
  url: string;
  seller_name: string | null;
  posted_at: string | null;
}

export interface AlertConfig {
  id: string;
  keywords: string[];
  exclude_keywords: string[] | null;
  platforms: string[];
  price_min: number | null;
  price_max: number | null;
  condition: string[] | null;
  radius_miles: number;
  location_postcode: string | null;
}

// Main function to process an alert
export const processAlert = async (alertId: string, userId: string): Promise<ScrapedItem[]> => {
  // Get alert configuration
  const { data: alert, error } = await supabase
    .from('alerts')
    .select('*')
    .eq('id', alertId)
    .eq('user_id', userId)
    .single();

  if (error || !alert) {
    throw new Error('Alert not found');
  }

  if (!alert.is_active) {
    console.log(`Alert ${alertId} is paused, skipping`);
    return [];
  }

  const config: AlertConfig = {
    id: alert.id,
    keywords: alert.keywords,
    exclude_keywords: alert.exclude_keywords,
    platforms: alert.platforms,
    price_min: alert.price_min,
    price_max: alert.price_max,
    condition: alert.condition,
    radius_miles: alert.radius_miles,
    location_postcode: alert.location_postcode,
  };

  // Scrape each platform in parallel
  const scrapingPromises = config.platforms.map((platform) => {
    switch (platform.toLowerCase()) {
      case 'ebay':
        return scrapeEbay(config);
      case 'vinted':
        return scrapeVinted(config);
      case 'gumtree':
        return scrapeGumtree(config);
      case 'depop':
        return scrapeDepop(config);
      case 'facebook marketplace':
        return scrapeFacebookMarketplace(config);
      case 'shpock':
        return scrapeShpock(config);
      default:
        console.log(`Unknown platform: ${platform}`);
        return Promise.resolve([]);
    }
  });

  const results = await Promise.allSettled(scrapingPromises);
  const allItems: ScrapedItem[] = [];

  for (const result of results) {
    if (result.status === 'fulfilled') {
      allItems.push(...result.value);
    } else {
      console.error('Scraping error:', result.reason);
    }
  }

  // Filter items based on alert criteria
  const filteredItems = filterItems(allItems, config);

  // Deduplicate against existing results
  const newItems = await deduplicateResults(alertId, filteredItems);

  // Save new results to database
  if (newItems.length > 0) {
    await saveResults(alertId, newItems);

    // Send notifications for new matches
    try {
      await notifyAlertMatches(userId, alert.name, newItems.map(item => ({
        title: item.title,
        price: item.price,
        platform: item.platform,
        url: item.url,
        image: item.image_urls?.[0] || null, // First image for Telegram carousel
      })));
      console.log(`Notifications sent for ${newItems.length} new items`);
    } catch (notifyError) {
      console.error('Failed to send notifications:', notifyError);
      // Don't throw - we still want to return the results even if notification fails
    }
  }

  // Update last checked timestamp
  await supabase
    .from('alerts')
    .update({ last_checked_at: new Date().toISOString() })
    .eq('id', alertId);

  return newItems;
};

// Filter items based on alert configuration
const filterItems = (items: ScrapedItem[], config: AlertConfig): ScrapedItem[] => {
  return items.filter((item) => {
    const titleLower = item.title.toLowerCase();
    const descLower = (item.description || '').toLowerCase();
    const combinedText = `${titleLower} ${descLower}`;

    // KEYWORD MATCHING - item must contain at least one keyword
    // This filters out sponsored/recommended items that don't match the search
    if (config.keywords && config.keywords.length > 0) {
      const hasKeywordMatch = config.keywords.some((keyword) => {
        const keywordLower = keyword.toLowerCase();
        // Split multi-word keywords and check if all words are present
        const words = keywordLower.split(/\s+/);
        return words.every(word => combinedText.includes(word));
      });

      if (!hasKeywordMatch) {
        return false;
      }
    }

    // Price filter
    if (config.price_min && item.price < config.price_min) return false;
    if (config.price_max && item.price > config.price_max) return false;

    // Exclude keywords filter
    if (config.exclude_keywords && config.exclude_keywords.length > 0) {
      for (const keyword of config.exclude_keywords) {
        if (titleLower.includes(keyword.toLowerCase()) || descLower.includes(keyword.toLowerCase())) {
          return false;
        }
      }
    }

    // Condition filter
    if (config.condition && config.condition.length > 0 && item.condition) {
      const itemCondition = item.condition.toLowerCase();
      const matchesCondition = config.condition.some((c) =>
        itemCondition.includes(c.toLowerCase())
      );
      if (!matchesCondition) return false;
    }

    return true;
  });
};

// Check for duplicates in existing results
const deduplicateResults = async (alertId: string, items: ScrapedItem[]): Promise<ScrapedItem[]> => {
  if (items.length === 0) return [];

  const externalIds = items.map((i) => i.external_id);

  const { data: existing } = await supabase
    .from('alert_results')
    .select('external_id')
    .eq('alert_id', alertId)
    .in('external_id', externalIds);

  const existingIds = new Set((existing || []).map((e) => e.external_id));

  return items.filter((item) => !existingIds.has(item.external_id));
};

// Save results to database
const saveResults = async (alertId: string, items: ScrapedItem[]): Promise<void> => {
  const results = items.map((item) => ({
    alert_id: alertId,
    external_id: item.external_id,
    platform: item.platform,
    title: item.title,
    description: item.description,
    price: item.price,
    currency: item.currency,
    location: item.location,
    condition: item.condition,
    image_urls: item.image_urls,
    url: item.url,
    seller_name: item.seller_name,
    posted_at: item.posted_at,
    is_read: false,
    is_saved: false,
  }));

  const { error } = await supabase.from('alert_results').insert(results);

  if (error) {
    console.error('Error saving results:', error);
    throw error;
  }

  console.log(`Saved ${items.length} new results for alert ${alertId}`);
};

export default processAlert;
