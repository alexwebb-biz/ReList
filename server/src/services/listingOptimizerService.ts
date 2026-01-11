import { searchEbaySoldListings } from './marketResearchService.js';
import { generateListingDescription, quickGenerateDescription, getAvailableProviders, type DescriptionInput, type GeneratedDescription } from './aiService.js';

export interface ListingAnalysis {
  original: {
    title: string;
    description?: string;
  };
  suggestions: {
    optimized_title: string;
    title_improvements: string[];
    keyword_suggestions: string[];
    description_tips: string[];
    pricing_insight?: {
      suggested_price: number;
      price_range: { min: number; max: number };
      based_on: number;
    };
  };
  score: {
    current: number;
    potential: number;
    improvement_areas: string[];
  };
}

export interface KeywordAnalysis {
  query: string;
  top_keywords: Array<{
    keyword: string;
    frequency: number;
    avg_price: number;
  }>;
  trending_terms: string[];
  avoid_terms: string[];
}

// Common words to exclude from keyword analysis
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
  'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need',
  'this', 'that', 'these', 'those', 'it', 'its', 'i', 'you', 'he', 'she',
  'we', 'they', 'what', 'which', 'who', 'when', 'where', 'why', 'how',
  'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some',
  'such', 'no', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
  'just', 'also', 'now', 'new', 'used', 'item', 'items', 'free', 'post',
  'postage', 'shipping', 'uk', 'gb', 'sold', 'listing', 'sale', 'buy',
]);

// Keywords that typically increase sale price
const VALUE_KEYWORDS = [
  'vintage', 'rare', 'limited edition', 'authentic', 'genuine', 'original',
  'designer', 'luxury', 'premium', 'mint', 'excellent', 'pristine',
  'collectible', 'retro', 'classic', 'bnwt', 'bnib', 'nwt', 'nib',
  'deadstock', 'exclusive', 'special edition', 'discontinued', 'htf',
  'hard to find', 'unworn', 'brand new', 'sealed', 'complete',
];

// Keywords that may decrease perceived value
const AVOID_KEYWORDS = [
  'cheap', 'worn', 'damaged', 'broken', 'stained', 'faded', 'ripped',
  'faulty', 'spares', 'repairs', 'bundle', 'job lot', 'clearance',
  'must go', 'quick sale', 'need gone', 'offers', 'ono', 'or best offer',
];

// Extract keywords from title
function extractKeywords(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !STOP_WORDS.has(word));
}

// Analyze sold listings to find best-performing keywords
export async function analyzeKeywords(query: string): Promise<KeywordAnalysis> {
  const soldData = await searchEbaySoldListings(query, 50);

  if (soldData.sold_items.length === 0) {
    return {
      query,
      top_keywords: [],
      trending_terms: [],
      avoid_terms: [],
    };
  }

  // Extract and count keywords from all sold titles
  const keywordStats = new Map<string, { count: number; totalPrice: number }>();

  for (const item of soldData.sold_items) {
    const keywords = extractKeywords(item.title);
    for (const keyword of keywords) {
      const existing = keywordStats.get(keyword) || { count: 0, totalPrice: 0 };
      keywordStats.set(keyword, {
        count: existing.count + 1,
        totalPrice: existing.totalPrice + item.sold_price,
      });
    }
  }

  // Convert to array and calculate averages
  const keywordArray = Array.from(keywordStats.entries())
    .map(([keyword, stats]) => ({
      keyword,
      frequency: stats.count,
      avg_price: Math.round((stats.totalPrice / stats.count) * 100) / 100,
    }))
    .filter(k => k.frequency >= 2) // Minimum occurrence
    .sort((a, b) => b.avg_price - a.avg_price);

  // Find trending terms (appear frequently in high-priced listings)
  const avgPrice = soldData.stats.average_price;
  const highPricedItems = soldData.sold_items.filter(i => i.sold_price > avgPrice);
  const trendingSet = new Set<string>();

  for (const item of highPricedItems) {
    const keywords = extractKeywords(item.title);
    for (const keyword of keywords) {
      if (VALUE_KEYWORDS.some(vk => keyword.includes(vk) || vk.includes(keyword))) {
        trendingSet.add(keyword);
      }
    }
  }

  return {
    query,
    top_keywords: keywordArray.slice(0, 15),
    trending_terms: Array.from(trendingSet).slice(0, 10),
    avoid_terms: AVOID_KEYWORDS.slice(0, 10),
  };
}

// Generate optimized title suggestions
function generateOptimizedTitle(
  originalTitle: string,
  topKeywords: Array<{ keyword: string; frequency: number }>,
  category?: string
): { title: string; improvements: string[] } {
  const improvements: string[] = [];
  let optimizedTitle = originalTitle;

  // Check title length (eBay allows 80 chars)
  if (originalTitle.length > 80) {
    improvements.push('Title exceeds 80 characters - consider shortening');
  } else if (originalTitle.length < 40) {
    improvements.push('Title is short - add more descriptive keywords');
  }

  // Check for value keywords
  const titleLower = originalTitle.toLowerCase();
  const hasValueKeyword = VALUE_KEYWORDS.some(vk => titleLower.includes(vk));
  if (!hasValueKeyword) {
    improvements.push('Consider adding value keywords like "genuine", "authentic", or condition descriptors');
  }

  // Check for avoid keywords
  const hasAvoidKeyword = AVOID_KEYWORDS.some(ak => titleLower.includes(ak));
  if (hasAvoidKeyword) {
    improvements.push('Remove negative terms that may deter buyers (e.g., "cheap", "offers")');
  }

  // Check capitalization
  const allCaps = originalTitle === originalTitle.toUpperCase();
  if (allCaps) {
    improvements.push('Avoid ALL CAPS - use proper capitalization for readability');
    optimizedTitle = originalTitle
      .toLowerCase()
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  // Check for brand/model at start
  const startsWithBrand = /^[A-Z][a-z]+\s/.test(originalTitle);
  if (!startsWithBrand) {
    improvements.push('Consider starting with brand name for better search visibility');
  }

  // Suggest adding top keywords if missing
  const titleKeywords = extractKeywords(originalTitle);
  const missingKeywords = topKeywords
    .filter(k => !titleKeywords.includes(k.keyword))
    .slice(0, 3)
    .map(k => k.keyword);

  if (missingKeywords.length > 0) {
    improvements.push(`Consider adding popular keywords: ${missingKeywords.join(', ')}`);
  }

  return { title: optimizedTitle, improvements };
}

// Generate description tips
function generateDescriptionTips(
  description: string | undefined,
  category?: string
): string[] {
  const tips: string[] = [];

  if (!description || description.length < 50) {
    tips.push('Add a detailed description - listings with descriptions sell faster');
    tips.push('Include item condition, measurements, and any flaws');
    tips.push('Mention brand history or item provenance if relevant');
    return tips;
  }

  const descLower = description.toLowerCase();

  // Check for key information
  if (!descLower.includes('condition')) {
    tips.push('Clearly state the item condition');
  }

  if (!descLower.includes('size') && !descLower.includes('dimension') && !descLower.includes('measure')) {
    tips.push('Include size or dimensions where applicable');
  }

  if (!descLower.includes('return') && !descLower.includes('refund')) {
    tips.push('Mention your returns policy to build buyer confidence');
  }

  if (descLower.includes('no returns') || descLower.includes('sold as seen')) {
    tips.push('Consider offering returns - it can increase buyer confidence and sales');
  }

  // Structure tips
  if (!description.includes('\n') && description.length > 200) {
    tips.push('Break description into paragraphs for better readability');
  }

  if (description.length < 150) {
    tips.push('Expand description - aim for at least 150-200 words');
  }

  // SEO tips
  tips.push('Include relevant keywords naturally throughout the description');
  tips.push('Mention what makes this item special or unique');

  return tips.slice(0, 6);
}

// Calculate listing score
function calculateListingScore(
  title: string,
  description: string | undefined,
  topKeywords: Array<{ keyword: string }>
): { current: number; potential: number; improvement_areas: string[] } {
  let score = 50; // Base score
  const improvementAreas: string[] = [];

  // Title scoring (up to 35 points)
  const titleKeywords = extractKeywords(title);

  // Title length (10 points)
  if (title.length >= 40 && title.length <= 80) {
    score += 10;
  } else {
    improvementAreas.push('Title length');
  }

  // Keyword density (15 points)
  const matchingKeywords = topKeywords.filter(k =>
    titleKeywords.includes(k.keyword)
  ).length;
  score += Math.min(15, matchingKeywords * 3);
  if (matchingKeywords < 3) {
    improvementAreas.push('Keyword optimization');
  }

  // Value keywords (10 points)
  const titleLower = title.toLowerCase();
  if (VALUE_KEYWORDS.some(vk => titleLower.includes(vk))) {
    score += 10;
  } else {
    improvementAreas.push('Value keywords');
  }

  // Description scoring (up to 15 points)
  if (description) {
    if (description.length >= 150) score += 5;
    if (description.length >= 300) score += 5;
    if (description.includes('\n')) score += 2; // Formatted
    if (description.toLowerCase().includes('condition')) score += 3;
  } else {
    improvementAreas.push('Missing description');
  }

  // Penalty for negative keywords
  if (AVOID_KEYWORDS.some(ak => titleLower.includes(ak))) {
    score -= 10;
    improvementAreas.push('Negative keywords');
  }

  // Cap score
  const currentScore = Math.max(0, Math.min(100, score));

  // Calculate potential (what score could be with improvements)
  const potentialScore = Math.min(100, currentScore + improvementAreas.length * 10);

  return {
    current: currentScore,
    potential: potentialScore,
    improvement_areas: improvementAreas,
  };
}

// Main listing analysis function
export async function analyzeListing(
  title: string,
  description?: string,
  category?: string
): Promise<ListingAnalysis> {
  // Get keyword data from sold listings
  const keywordData = await analyzeKeywords(title);

  // Generate optimized title
  const { title: optimizedTitle, improvements } = generateOptimizedTitle(
    title,
    keywordData.top_keywords,
    category
  );

  // Generate description tips
  const descriptionTips = generateDescriptionTips(description, category);

  // Calculate listing score
  const score = calculateListingScore(title, description, keywordData.top_keywords);

  // Get pricing insight from sold data
  const soldData = await searchEbaySoldListings(title, 30);
  let pricingInsight: ListingAnalysis['suggestions']['pricing_insight'];

  if (soldData.sold_items.length >= 5) {
    pricingInsight = {
      suggested_price: soldData.stats.median_price,
      price_range: {
        min: soldData.stats.lowest_price,
        max: soldData.stats.highest_price,
      },
      based_on: soldData.stats.total_sold,
    };
  }

  return {
    original: {
      title,
      description,
    },
    suggestions: {
      optimized_title: optimizedTitle,
      title_improvements: improvements,
      keyword_suggestions: keywordData.trending_terms,
      description_tips: descriptionTips,
      pricing_insight: pricingInsight,
    },
    score,
  };
}

// Batch analyze multiple listings
export async function analyzeMultipleListings(
  listings: Array<{ title: string; description?: string }>
): Promise<ListingAnalysis[]> {
  const results: ListingAnalysis[] = [];

  for (const listing of listings) {
    const analysis = await analyzeListing(listing.title, listing.description);
    results.push(analysis);

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return results;
}

// Get keyword suggestions for a category/search term
export async function getKeywordSuggestions(
  searchTerm: string
): Promise<{
  primary_keywords: string[];
  secondary_keywords: string[];
  long_tail_keywords: string[];
  avoid: string[];
}> {
  const keywordData = await analyzeKeywords(searchTerm);

  // Primary keywords (high frequency, high price)
  const primaryKeywords = keywordData.top_keywords
    .filter(k => k.frequency >= 5)
    .slice(0, 5)
    .map(k => k.keyword);

  // Secondary keywords (medium frequency)
  const secondaryKeywords = keywordData.top_keywords
    .filter(k => k.frequency >= 2 && k.frequency < 5)
    .slice(0, 5)
    .map(k => k.keyword);

  // Long-tail (combinations)
  const longTail = keywordData.top_keywords
    .slice(0, 3)
    .flatMap((k1, i) =>
      keywordData.top_keywords.slice(i + 1, i + 3).map(k2 => `${k1.keyword} ${k2.keyword}`)
    )
    .slice(0, 5);

  return {
    primary_keywords: primaryKeywords,
    secondary_keywords: secondaryKeywords,
    long_tail_keywords: longTail,
    avoid: AVOID_KEYWORDS.slice(0, 8),
  };
}

// Quick title suggestions without full analysis
export function quickTitleSuggestions(title: string): string[] {
  const suggestions: string[] = [];
  const titleLower = title.toLowerCase();

  if (title.length < 30) {
    suggestions.push('Title is too short - expand with more details');
  }

  if (title.length > 80) {
    suggestions.push('Title exceeds 80 characters - prioritize important keywords');
  }

  if (title === title.toUpperCase()) {
    suggestions.push('Avoid ALL CAPS - it looks spammy');
  }

  if (title === title.toLowerCase()) {
    suggestions.push('Use proper capitalization for each word');
  }

  if (!titleLower.includes('size') && (titleLower.includes('shirt') || titleLower.includes('dress') || titleLower.includes('jeans'))) {
    suggestions.push('Include size for clothing items');
  }

  if (!titleLower.includes('colour') && !titleLower.includes('color')) {
    suggestions.push('Consider adding color to the title');
  }

  if (title.includes('!!!') || title.includes('***') || title.includes('£££')) {
    suggestions.push('Remove excessive punctuation/symbols');
  }

  const hasValueKeyword = VALUE_KEYWORDS.some(vk => titleLower.includes(vk));
  if (!hasValueKeyword) {
    suggestions.push('Add value keywords like "genuine", "vintage", "rare" if applicable');
  }

  return suggestions.slice(0, 5);
}

// ============== AI DESCRIPTION GENERATION ==============

export interface DescriptionGenerationInput {
  title: string;
  category?: string;
  condition?: string;
  brand?: string;
  size?: string;
  color?: string;
  material?: string;
  features?: string[];
  flaws?: string[];
  keywords?: string[];
  provider?: 'groq' | 'huggingface' | 'ollama' | 'template';
}

// Generate AI-powered listing description
export async function generateDescription(
  input: DescriptionGenerationInput
): Promise<GeneratedDescription> {
  return generateListingDescription(
    {
      title: input.title,
      category: input.category,
      condition: input.condition,
      brand: input.brand,
      size: input.size,
      color: input.color,
      material: input.material,
      features: input.features,
      flaws: input.flaws,
      keywords: input.keywords,
    },
    input.provider
  );
}

// Quick description from just title
export async function generateQuickDescription(title: string): Promise<GeneratedDescription> {
  return quickGenerateDescription(title);
}

// Get available AI providers
export async function getDescriptionProviders(): Promise<string[]> {
  return getAvailableProviders();
}

// Re-export types for use in routes
export type { GeneratedDescription };
