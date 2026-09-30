import api from './api';

// ── Buyer API Methods ─────────────────────────────────────────

export async function getBuyerOrders() {
  const res = await api.get('/protection/buyer/orders');
  return res.data;
}

export async function confirmReceiptOk(orderId) {
  const res = await api.post(`/protection/buyer/order/${orderId}/confirm-ok`);
  return res.data;
}

export async function requestReturn(orderId, payload) {
  const res = await api.post(`/protection/buyer/order/${orderId}/request-return`, payload);
  return res.data;
}

export async function submitReturnTracking(orderId, payload) {
  const res = await api.post(`/protection/buyer/order/${orderId}/return-tracking`, payload);
  return res.data;
}

// ── Seller API Methods ────────────────────────────────────────

export async function getSellerOrders() {
  const res = await api.get('/protection/seller/orders');
  return res.data;
}

export async function markOrderShipped(orderId, payload) {
  const res = await api.post(`/protection/seller/order/${orderId}/ship`, payload);
  return res.data;
}

export async function markOrderDelivered(orderId) {
  const res = await api.post(`/protection/seller/order/${orderId}/deliver`);
  return res.data;
}

export async function reviewReturnRequest(orderId, payload) {
  const res = await api.post(`/protection/seller/order/${orderId}/review-return`, payload);
  return res.data;
}

export async function confirmReturnReceived(orderId) {
  const res = await api.post(`/protection/seller/order/${orderId}/confirm-return`);
  return res.data;
}

export async function reportReturnProblem(orderId, payload) {
  const res = await api.post(`/protection/seller/order/${orderId}/report-problem`, payload);
  return res.data;
}

// ── Admin API Methods ─────────────────────────────────────────

export async function getAdminDisputes() {
  const res = await api.get('/protection/admin/disputes');
  return res.data;
}

export async function resolveDispute(orderId, payload) {
  const res = await api.post(`/protection/admin/disputes/${orderId}/resolve`, payload);
  return res.data;
}

// ── Notifications API Methods ─────────────────────────────────

export async function getNotifications() {
  const res = await api.get('/protection/notifications');
  return res.data;
}

export async function markNotificationRead(id) {
  const res = await api.put(`/protection/notifications/${id}/read`);
  return res.data;
}
