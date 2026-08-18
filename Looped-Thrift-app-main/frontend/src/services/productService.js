import api from './api'

export const getProducts = (params = {}) =>
  api.get('/products', { params }).then(r => r.data)

export const getProduct = (id) =>
  api.get(`/products/${id}`).then(r => r.data)

export const createProduct = (data) =>
  api.post('/products', data).then(r => r.data)

export const seedProducts = () =>
  api.post('/products/admin/seed').then(r => r.data)
