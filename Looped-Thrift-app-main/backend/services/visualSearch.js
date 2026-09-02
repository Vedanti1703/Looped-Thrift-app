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

module.exports = { searchByImage, describeImageForSearch };
