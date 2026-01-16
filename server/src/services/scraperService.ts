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
  id?: string;
  keywords: string[];
  exclude_keywords?: string[] | null;
  platforms: string[];
  price_min: number | null;
  price_max: number | null;
  condition?: string[] | null;
  radius_miles?: number | null;
  location_postcode?: string | null;
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

// Normalize text for better keyword matching
// Handles common variations like "I phone" → "iphone", removes extra spaces/punctuation
const normalizeText = (text: string): string => {
  return text
    .toLowerCase()
    // Common brand name fixes - handle spaces in brand names
    .replace(/i\s*-?\s*phone/gi, 'iphone')
    .replace(/i\s*-?\s*pad/gi, 'ipad')
    .replace(/i\s*-?\s*watch/gi, 'iwatch')
    .replace(/air\s*-?\s*pods/gi, 'airpods')
    .replace(/play\s*-?\s*station/gi, 'playstation')
    .replace(/x\s*-?\s*box/gi, 'xbox')
    .replace(/mac\s*-?\s*book/gi, 'macbook')
    .replace(/game\s*-?\s*boy/gi, 'gameboy')
    .replace(/north\s*-?\s*face/gi, 'northface')
    .replace(/air\s*-?\s*max/gi, 'airmax')
    .replace(/air\s*-?\s*force/gi, 'airforce')
    .replace(/new\s*-?\s*balance/gi, 'newbalance')
    // Remove common separators that might break matching
    .replace(/[-–—_]/g, ' ')
    // Normalize multiple spaces to single
    .replace(/\s+/g, ' ')
    .trim();
};

// Check if a keyword matches in the text
// Uses smarter matching for numbers vs text
const keywordMatches = (text: string, keyword: string): boolean => {
  const normalizedText = normalizeText(text);
  const normalizedKeyword = normalizeText(keyword);

  // For purely numeric keywords, use word boundary matching
  // This ensures "15" matches "iphone 15" but not "airmax 95" or "150"
  if (/^\d+$/.test(normalizedKeyword)) {
    // Match number with word boundaries (spaces, start/end, or non-digit chars)
    const pattern = new RegExp(`(^|[^0-9])${normalizedKeyword}([^0-9]|$)`);
    return pattern.test(normalizedText);
  }

  // For alphanumeric keywords like "15pro", check exact contains
  if (/\d/.test(normalizedKeyword) && /[a-z]/i.test(normalizedKeyword)) {
    // For mixed keywords, also try without spaces
    const noSpaceText = normalizedText.replace(/\s/g, '');
    const noSpaceKeyword = normalizedKeyword.replace(/\s/g, '');
    return normalizedText.includes(normalizedKeyword) || noSpaceText.includes(noSpaceKeyword);
  }

  // For text keywords, check if it exists in the normalized text
  return normalizedText.includes(normalizedKeyword);
};

// Filter items based on alert configuration
const filterItems = (items: ScrapedItem[], config: AlertConfig): ScrapedItem[] => {
  console.log(`Filtering ${items.length} items with config:`, {
    keywords: config.keywords,
    price_min: config.price_min,
    price_max: config.price_max,
    exclude_keywords: config.exclude_keywords || [],
  });

  let filteredOutCount = 0;

  const filtered = items.filter((item) => {
    const combinedText = `${item.title} ${item.description || ''}`;

    // KEYWORD MATCHING - item must contain ALL keywords
    if (config.keywords && config.keywords.length > 0) {
      const allKeywordsMatch = config.keywords.every((keyword) => {
        return keywordMatches(combinedText, keyword);
      });

      if (!allKeywordsMatch) {
        filteredOutCount++;
        return false;
      }
    }

    // Price filter
    if (config.price_min && item.price < config.price_min) {
      return false;
    }
    if (config.price_max && item.price > config.price_max) {
      return false;
    }

    // Exclude keywords filter - check against normalized text
    if (config.exclude_keywords && config.exclude_keywords.length > 0) {
      const normalizedCombined = normalizeText(combinedText);
      for (const keyword of config.exclude_keywords) {
        const normalizedExclude = normalizeText(keyword);
        if (normalizedCombined.includes(normalizedExclude)) {
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
      if (!matchesCondition) {
        return false;
      }
    }

    return true;
  });

  console.log(`Filter result: ${filtered.length} of ${items.length} items passed (${filteredOutCount} keyword mismatches)`);
  return filtered;
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
