import api from './api'

/**
 * styleMeService.js
 * Reuses the existing api.js axios instance (same auth headers, base URL)
 */

/**
 * POST /style-me
 * @param {string} query - Natural language outfit description
 * @returns {Promise<{ query, preferences, outfits, generatedAt }>}
 */
export const styleMeQuery = (query) =>
  api.post('/style-me', { query }).then(r => r.data)
