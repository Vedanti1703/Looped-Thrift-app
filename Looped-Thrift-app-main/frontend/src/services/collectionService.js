import api from './api'

export const getCollections = () =>
  api.get('/collections').then(r => r.data)

export const getCollection = (id) =>
  api.get(`/collections/${id}`).then(r => r.data)

export const createCollection = (name, productId) =>
  api.post('/collections', { name, productId }).then(r => r.data)

export const addItemToCollection = (collectionId, productId) =>
  api.post(`/collections/${collectionId}/items`, { productId }).then(r => r.data)

export const removeItemFromCollection = (collectionId, productId) =>
  api.delete(`/collections/${collectionId}/items/${productId}`).then(r => r.data)

export const deleteCollection = (collectionId) =>
  api.delete(`/collections/${collectionId}`).then(r => r.data)
