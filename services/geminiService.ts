import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.API_KEY || '';

// Initialize only if key exists to avoid immediate errors, handle gracefully in calls
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export const generateItemDescription = async (title: string, condition: string, tags: string[]): Promise<string> => {
  if (!ai) {
    console.warn("Gemini API Key missing");
    return "API Key missing. Please configure your environment.";
  }

  try {
    const prompt = `
      Write a professional, SEO-optimized sales description for a reseller listing.
      Item Title: ${title}
      Condition: ${condition}
      Key Features/Tags: ${tags.join(', ')}

      Structure the response with:
      1. A catchy hook sentence.
      2. Bullet points for features.
      3. A condition statement.
      4. A polite shipping/reseller policy note.
      Keep it under 150 words. No markdown formatting, just plain text with line breaks.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || "Could not generate description.";
  } catch (error) {
    console.error("Error generating description:", error);
    return "Error connecting to AI service. Please try again.";
  }
};

export const estimatePrice = async (title: string, platform: string): Promise<string> => {
    if (!ai) return "N/A";

    try {
        const prompt = `
          Provide a single estimated price range (e.g., "$20 - $30") for a used item titled "${title}" being sold on ${platform}.
          Return ONLY the price range string.
        `;
        
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt
        });

        return response.text?.trim() || "Unknown";
    } catch (e) {
        return "Unknown";
    }
}
