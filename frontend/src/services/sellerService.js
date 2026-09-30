import api from './api'

export const getSellerDashboard = () =>
  api.get('/seller/dashboard').then(r => r.data)
