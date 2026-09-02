const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), override: true });
const OpenAI = require('openai');

/**
 * Checks if the provided API key is empty, undefined, or a placeholder.
 * @param {string} key
 * @returns {boolean}
 */
function isInvalidKey(key) {
  if (!key || typeof key !== 'string' || !key.trim()) return true;
  const k = key.trim().toLowerCase();
  return k.includes('your_') || k.includes('placeholder') || k.includes('xxxx') || k === 'your_openai_api_key';
}

/**
 * Generates vector embedding (1536 dimensions) for a given text using OpenAI text-embedding-3-small model.
 * @param {string} text - The input text to embed.
 * @returns {Promise<number[]>} Array of floating-point numbers representing the embedding vector.
 */
async function getEmbedding(text) {
  if (!text || typeof text !== 'string' || !text.trim()) {
    throw new Error('Input text is required for generating embeddings');
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (isInvalidKey(apiKey)) {
    throw new Error('OPENAI_API_KEY not found in environment or is a placeholder — check your backend/.env file');
  }

  const openai = new OpenAI({ apiKey: apiKey.trim() });

  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text.trim(),
    });

    if (!response || !response.data || !response.data[0] || !response.data[0].embedding) {
      throw new Error('Invalid response structure received from OpenAI embeddings API');
    }

    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error.message);
    throw new Error(`Embedding generation failed: ${error.message}`);
  }
}

module.exports = { getEmbedding };
