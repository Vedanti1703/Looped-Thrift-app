const axios = require('axios');
const fs = require('fs');
const path = require('path');
const Product = require('../models/Product');
const { getEmbedding } = require('../utils/embeddings');

/**
 * Converts a local /uploads/ image URL to a base64 data URL so OpenAI Vision API can process it regardless of localhost environment.
 */
function resolveImagePayloadUrl(imageUrl) {
  if (!imageUrl) return '';
  if (imageUrl.startsWith('data:image/')) return imageUrl;

  if (imageUrl.includes('/uploads/')) {
    const filename = imageUrl.split('/uploads/').pop().split('?')[0];
    const filePath = path.join(__dirname, '../uploads', filename);
    if (fs.existsSync(filePath)) {
      const fileBuf = fs.readFileSync(filePath);
      const ext = path.extname(filePath).replace('.', '') || 'jpeg';
      const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      return `data:${mime};base64,${fileBuf.toString('base64')}`;
    }
  }

  return imageUrl;
}

/**
 * Uses GPT-4o-mini Vision to analyze an image URL and generate a short, structured description.
 * @param {string} imageUrl 
 * @returns {Promise<string>} Short fashion description string suitable for vector search.
 */
async function describeImageForSearch(imageUrl) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY missing in environment');
  }

  const payloadUrl = resolveImagePayloadUrl(imageUrl);

  const response = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: 'gpt-4o-mini',
      max_tokens: 150,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Describe this clothing item in a short phrase suitable for a product search query. Include category, color, and style (e.g. "oversized beige hoodie, streetwear style, cotton fabric"). Do not mention the image itself, just describe the item.',
            },
            { type: 'image_url', image_url: { url: payloadUrl, detail: 'low' } },
          ],
        },
      ],
    },
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      timeout: 15000
    }
  );

  return response.data?.choices?.[0]?.message?.content?.trim() || '';
}

/**
 * Main Visual Search Pipeline: Image URL -> GPT-4o Vision Description -> OpenAI Embedding -> MongoDB Vector Search
 * @param {string} imageUrl 
 * @returns {Promise<{ success: boolean, description?: string, products?: any[], message?: string, error?: string }>}
 */
async function searchByImage(imageUrl) {
  try {
    const description = await describeImageForSearch(imageUrl);
    if (!description) {
      return { success: false, message: 'Could not analyze the image.' };
    }

    const queryVector = await getEmbedding(description);

    const results = await Product.aggregate([
      {
        $vectorSearch: {
          index: 'product_vector_index',
          path: 'embedding',
          queryVector,
          numCandidates: 100,
          limit: 6,
        },
      },
      { $addFields: { score: { $meta: 'vectorSearchScore' } } },
    ]);

    return { success: true, description, products: results };
  } catch (err) {
    const detail = err.response?.data?.error?.message || err.message;
    console.error('Visual Search error:', detail);
    return { success: false, error: detail };
  }
}

/**
 * Master CV analysis using OpenAI Vision on the backend (securely keeping API key on server).
 * Accepts an image URL (or base64 data URL) and returns structured fashion CV results.
 */
async function analyseClothingPhoto(imageUrl) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      isClothing: true,
      hasPerson: false,
      damageWarnings: [],
      autoTags: [],
      shotType: 'unknown',
      dominantColors: [],
      qualityIssues: [],
      isGoodPhoto: true,
      rawResponse: ''
    };
  }

  const payloadUrl = resolveImagePayloadUrl(imageUrl);
  const prompt = `You are a quality checker for a fashion thrift marketplace app called Looped.
Analyse this clothing photo and respond with ONLY a valid JSON object — no extra text, no markdown.

Return exactly this structure:
{
  "isClothing": true or false,
  "hasPerson": true or false,
  "damageWarnings": ["array of warning strings if stains/damage/tears visible, empty array if none"],
  "autoTags": ["array of relevant fashion tags from this list only: denim, floral, black, white, patterned, striped, plaid, leather, silk, cotton, wool, lace, embroidered, vintage, casual, formal, dress, jacket, coat, tops, bottoms, skirt, footwear, bags, jewelry, pink, red, blue, green, yellow, orange, purple, brown, grey, minimalist, streetwear, traditional, oversized, fitted, sheer, velvet, knit, printed, solid, dark, light, pastel, bold"],
  "shotType": "full-front or full-back or closeup or on-model or unknown",
  "dominantColors": ["top 3 color names visible in the image"],
  "qualityIssues": ["any quality issues like blur, bad lighting, messy background — empty array if fine"],
  "isGoodPhoto": true or false
}

Be strict about damage detection — buyers rely on honest listings.
Be generous with tags — more tags help buyers discover items.`;

  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        max_tokens: 500,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: payloadUrl, detail: 'low' } }
            ]
          }
        ]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        timeout: 20000
      }
    );

    const rawText = response.data?.choices?.[0]?.message?.content || '';
    const clean = rawText.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    return {
      isClothing: parsed.isClothing ?? true,
      hasPerson: parsed.hasPerson ?? false,
      damageWarnings: parsed.damageWarnings ?? [],
      autoTags: parsed.autoTags ?? [],
      shotType: parsed.shotType ?? 'unknown',
      dominantColors: parsed.dominantColors ?? [],
      qualityIssues: parsed.qualityIssues ?? [],
      isGoodPhoto: parsed.isGoodPhoto ?? true,
      rawResponse: rawText
    };
  } catch (err) {
    console.warn('Backend Vision Analysis error:', err.response?.data?.error?.message || err.message);
    return {
      isClothing: true,
      hasPerson: false,
      damageWarnings: [],
      autoTags: [],
      shotType: 'unknown',
      dominantColors: [],
      qualityIssues: [],
      isGoodPhoto: true,
      rawResponse: ''
    };
  }
}

module.exports = { searchByImage, describeImageForSearch, analyseClothingPhoto };

