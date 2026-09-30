import api from './api'

export const getProductReviews = (productId) =>
  api.get(`/reviews/product/${productId}`).then(r => r.data)

export const getSellerReviews = (sellerId) =>
  api.get(`/reviews/seller/${sellerId}`).then(r => r.data)

export const createReview = (productId, rating, comment) =>
  api.post('/reviews', { productId, rating, comment }).then(r => r.data)

export const deleteReview = (reviewId) =>
  api.delete(`/reviews/${reviewId}`).then(r => r.data)
