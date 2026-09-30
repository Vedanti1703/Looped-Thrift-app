import api from './api'

export const getProducts = (params = {}) =>
  api.get('/products', { params }).then(r => r.data)

export const getProduct = (id) =>
  api.get(`/products/${id}`).then(r => r.data)

export const createProduct = (data) =>
  api.post('/products', data).then(r => r.data)

export const seedProducts = () =>
  api.post('/products/admin/seed').then(r => r.data)

export const getNaturalSearchResults = (query, limit = 12) =>
  api.post('/products/search-natural', { query, limit }).then(r => r.data)

export const getVisualSearchResults = (imageUrl) =>
  api.post('/products/search-visual', { imageUrl }).then(r => r.data)
