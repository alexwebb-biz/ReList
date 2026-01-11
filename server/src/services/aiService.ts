/**
 * AI Service for generating listing descriptions
 * Uses free AI APIs: Groq (Llama), Hugging Face, or local Ollama
 */

export interface AIProvider {
  name: string;
  generateDescription: (input: DescriptionInput) => Promise<string>;
  isAvailable: () => Promise<boolean>;
}

export interface DescriptionInput {
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
}

export interface GeneratedDescription {
  description: string;
  provider: string;
  sections: {
    intro: string;
    details: string;
    condition: string;
    callToAction: string;
  };
}

// Groq API (free tier available)
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

// Hugging Face Inference API (free tier)
const HF_API_URL = 'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2';

// Ollama local API
const OLLAMA_API_URL = 'http://localhost:11434/api/generate';

function buildPrompt(input: DescriptionInput): string {
  const parts = [
    `Write a compelling eBay listing description for: ${input.title}`,
    '',
    'Item Details:',
  ];

  if (input.brand) parts.push(`- Brand: ${input.brand}`);
  if (input.category) parts.push(`- Category: ${input.category}`);
  if (input.condition) parts.push(`- Condition: ${input.condition}`);
  if (input.size) parts.push(`- Size: ${input.size}`);
  if (input.color) parts.push(`- Color: ${input.color}`);
  if (input.material) parts.push(`- Material: ${input.material}`);
  if (input.features?.length) parts.push(`- Features: ${input.features.join(', ')}`);
  if (input.flaws?.length) parts.push(`- Flaws to mention: ${input.flaws.join(', ')}`);
  if (input.keywords?.length) parts.push(`- Include keywords: ${input.keywords.join(', ')}`);

  parts.push('');
  parts.push('Requirements:');
  parts.push('- Write in a professional but friendly tone');
  parts.push('- Keep it concise (150-250 words)');
  parts.push('- Include relevant keywords naturally for SEO');
  parts.push('- Highlight key selling points');
  parts.push('- Be honest about condition and any flaws');
  parts.push('- End with a call to action');
  parts.push('- Format with clear paragraphs');
  parts.push('- Do NOT use markdown formatting, just plain text');

  return parts.join('\n');
}

// Groq Provider (free Llama models)
async function generateWithGroq(input: DescriptionInput, apiKey: string): Promise<string> {
  const prompt = buildPrompt(input);

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.1-70b-versatile',
      messages: [
        {
          role: 'system',
          content: 'You are an expert eBay seller who writes compelling product descriptions that convert browsers into buyers. You focus on SEO-friendly, honest, and persuasive copy.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Groq API error: ${error}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}

// Hugging Face Provider (free inference API)
async function generateWithHuggingFace(input: DescriptionInput, apiKey: string): Promise<string> {
  const prompt = buildPrompt(input);
  const fullPrompt = `<s>[INST] ${prompt} [/INST]`;

  const response = await fetch(HF_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      inputs: fullPrompt,
      parameters: {
        max_new_tokens: 500,
        temperature: 0.7,
        do_sample: true,
        return_full_text: false,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Hugging Face API error: ${error}`);
  }

  const data = await response.json();
  return data[0]?.generated_text || '';
}

// Ollama Provider (local, completely free)
async function generateWithOllama(input: DescriptionInput, model: string = 'llama3.2'): Promise<string> {
  const prompt = buildPrompt(input);

  const response = await fetch(OLLAMA_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model,
      prompt: prompt,
      system: 'You are an expert eBay seller who writes compelling product descriptions that convert browsers into buyers. You focus on SEO-friendly, honest, and persuasive copy.',
      stream: false,
      options: {
        temperature: 0.7,
        num_predict: 500,
      },
    }),
  });

  if (!response.ok) {
    throw new Error('Ollama not available - is it running locally?');
  }

  const data = await response.json();
  return data.response || '';
}

// Check if Ollama is running locally
async function isOllamaAvailable(): Promise<boolean> {
  try {
    const response = await fetch('http://localhost:11434/api/tags', {
      method: 'GET',
      signal: AbortSignal.timeout(2000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

// Template-based fallback (no AI required)
function generateTemplateDescription(input: DescriptionInput): string {
  const lines: string[] = [];

  // Intro
  if (input.brand) {
    lines.push(`Authentic ${input.brand} ${input.title.replace(input.brand, '').trim()} now available!`);
  } else {
    lines.push(`${input.title} - Great addition to your collection!`);
  }
  lines.push('');

  // Details section
  lines.push('ITEM DETAILS:');
  if (input.brand) lines.push(`• Brand: ${input.brand}`);
  if (input.size) lines.push(`• Size: ${input.size}`);
  if (input.color) lines.push(`• Color: ${input.color}`);
  if (input.material) lines.push(`• Material: ${input.material}`);
  if (input.category) lines.push(`• Category: ${input.category}`);
  lines.push('');

  // Features
  if (input.features?.length) {
    lines.push('KEY FEATURES:');
    input.features.forEach(f => lines.push(`• ${f}`));
    lines.push('');
  }

  // Condition
  lines.push('CONDITION:');
  if (input.condition) {
    lines.push(`This item is in ${input.condition.toLowerCase()} condition.`);
  } else {
    lines.push('Please see photos for condition details.');
  }
  if (input.flaws?.length) {
    lines.push(`Please note: ${input.flaws.join('. ')}`);
  }
  lines.push('');

  // Call to action
  lines.push('Feel free to message with any questions. Check out my other listings for more great items!');
  lines.push('');
  lines.push('Fast dispatch • Secure packaging • Buyer satisfaction guaranteed');

  return lines.join('\n');
}

// Parse description into sections
function parseIntoSections(description: string): GeneratedDescription['sections'] {
  const paragraphs = description.split('\n\n').filter(p => p.trim());

  return {
    intro: paragraphs[0] || '',
    details: paragraphs.slice(1, -1).join('\n\n') || '',
    condition: paragraphs.find(p =>
      p.toLowerCase().includes('condition') ||
      p.toLowerCase().includes('flaw') ||
      p.toLowerCase().includes('wear')
    ) || '',
    callToAction: paragraphs[paragraphs.length - 1] || '',
  };
}

// Main function to generate description
export async function generateListingDescription(
  input: DescriptionInput,
  preferredProvider?: 'groq' | 'huggingface' | 'ollama' | 'template'
): Promise<GeneratedDescription> {
  const groqKey = process.env.GROQ_API_KEY;
  const hfKey = process.env.HUGGINGFACE_API_KEY;

  // Try providers in order of preference
  const providers: Array<{ name: string; fn: () => Promise<string> }> = [];

  // Add preferred provider first if specified
  if (preferredProvider === 'groq' && groqKey) {
    providers.push({ name: 'Groq (Llama 3.1)', fn: () => generateWithGroq(input, groqKey) });
  } else if (preferredProvider === 'huggingface' && hfKey) {
    providers.push({ name: 'Hugging Face (Mistral)', fn: () => generateWithHuggingFace(input, hfKey) });
  } else if (preferredProvider === 'ollama') {
    providers.push({ name: 'Ollama (Local)', fn: () => generateWithOllama(input) });
  } else if (preferredProvider === 'template') {
    return {
      description: generateTemplateDescription(input),
      provider: 'Template',
      sections: parseIntoSections(generateTemplateDescription(input)),
    };
  }

  // Add remaining providers as fallbacks
  if (groqKey && preferredProvider !== 'groq') {
    providers.push({ name: 'Groq (Llama 3.1)', fn: () => generateWithGroq(input, groqKey) });
  }

  // Check Ollama availability
  const ollamaAvailable = await isOllamaAvailable();
  if (ollamaAvailable && preferredProvider !== 'ollama') {
    providers.push({ name: 'Ollama (Local)', fn: () => generateWithOllama(input) });
  }

  if (hfKey && preferredProvider !== 'huggingface') {
    providers.push({ name: 'Hugging Face (Mistral)', fn: () => generateWithHuggingFace(input, hfKey) });
  }

  // Try each provider
  for (const provider of providers) {
    try {
      console.log(`Trying AI provider: ${provider.name}`);
      const description = await provider.fn();

      if (description && description.length > 50) {
        return {
          description: description.trim(),
          provider: provider.name,
          sections: parseIntoSections(description.trim()),
        };
      }
    } catch (error) {
      console.warn(`Provider ${provider.name} failed:`, error);
      continue;
    }
  }

  // Fallback to template
  console.log('All AI providers failed, using template fallback');
  const templateDesc = generateTemplateDescription(input);
  return {
    description: templateDesc,
    provider: 'Template (Fallback)',
    sections: parseIntoSections(templateDesc),
  };
}

// Get available providers
export async function getAvailableProviders(): Promise<string[]> {
  const available: string[] = ['template'];

  if (process.env.GROQ_API_KEY) {
    available.push('groq');
  }

  if (process.env.HUGGINGFACE_API_KEY) {
    available.push('huggingface');
  }

  if (await isOllamaAvailable()) {
    available.push('ollama');
  }

  return available;
}

// Quick description generation for simple titles
export async function quickGenerateDescription(title: string): Promise<GeneratedDescription> {
  // Extract info from title
  const titleLower = title.toLowerCase();

  // Try to detect brand (common brands)
  const brands = ['nike', 'adidas', 'gucci', 'prada', 'levis', 'zara', 'h&m', 'north face', 'ralph lauren', 'tommy hilfiger', 'calvin klein', 'versace', 'armani'];
  const detectedBrand = brands.find(b => titleLower.includes(b));

  // Try to detect size
  const sizeMatch = title.match(/\b(XXS|XS|S|M|L|XL|XXL|XXXL|UK\s*\d+|US\s*\d+|EU\s*\d+|\d+\/\d+)\b/i);
  const detectedSize = sizeMatch ? sizeMatch[0] : undefined;

  // Try to detect color
  const colors = ['black', 'white', 'red', 'blue', 'green', 'yellow', 'pink', 'purple', 'orange', 'brown', 'grey', 'gray', 'navy', 'beige', 'cream'];
  const detectedColor = colors.find(c => titleLower.includes(c));

  // Try to detect condition from common terms
  let detectedCondition = 'Good';
  if (titleLower.includes('bnwt') || titleLower.includes('new with tags') || titleLower.includes('brand new')) {
    detectedCondition = 'New with Tags';
  } else if (titleLower.includes('nwot') || titleLower.includes('new without tags')) {
    detectedCondition = 'New without Tags';
  } else if (titleLower.includes('excellent')) {
    detectedCondition = 'Excellent';
  } else if (titleLower.includes('vintage')) {
    detectedCondition = 'Vintage';
  }

  return generateListingDescription({
    title,
    brand: detectedBrand ? detectedBrand.charAt(0).toUpperCase() + detectedBrand.slice(1) : undefined,
    size: detectedSize,
    color: detectedColor ? detectedColor.charAt(0).toUpperCase() + detectedColor.slice(1) : undefined,
    condition: detectedCondition,
  });
}
