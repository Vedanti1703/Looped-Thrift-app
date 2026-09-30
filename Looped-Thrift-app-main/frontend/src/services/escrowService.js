import api from './api';

// ── Customer Escrow Methods ────────────────────────────────────

/**
 * Initiates return and creates a refund escrow hold.
 * @param {Object} data { orderId, returnReason, returnDescription, returnEvidencePhotos, amount }
 */
export async function createRefundHold(data) {
  const res = await api.post('/escrow/hold/create', data);
  return res.data;
}

/**
 * Submits return shipping courier & tracking info (transitions to IN_TRANSIT).
 * @param {string} holdId
 * @param {Object} data { returnCarrier, returnTrackingNumber }
 */
export async function submitReturnShipment(holdId, data) {
  const res = await api.post(`/escrow/hold/${holdId}/ship`, data);
  return res.data;
}

/**
 * Fetches all refund holds for the logged-in customer.
 */
export async function getCustomerHolds() {
  const res = await api.get('/escrow/holds/customer');
  return res.data;
}

// ── Seller Escrow Methods ──────────────────────────────────────

/**
 * Seller confirms physical receipt of returned parcel -> releases refund to customer & settles seller payout.
 * @param {string} holdId
 * @param {Object} data { partialAmount, confirmationNotes }
 */
export async function confirmReceiptAndReleaseRefund(holdId, data = {}) {
  const res = await api.post(`/escrow/hold/${holdId}/confirm-receipt`, data);
  return res.data;
}

/**
 * Seller disputes returned item condition (damaged/wrong item) -> locks hold in DISPUTED.
 * @param {string} holdId
 * @param {Object} data { disputeReason, disputeDescription, disputePhotos }
 */
export async function disputeRefundHold(holdId, data) {
  const res = await api.post(`/escrow/hold/${holdId}/dispute`, data);
  return res.data;
}

/**
 * Fetches all return refund holds for the logged-in seller.
 */
export async function getSellerHolds() {
  const res = await api.get('/escrow/holds/seller');
  return res.data;
}

// ── Shared & Tracking Methods ──────────────────────────────────

/**
 * Fetches refund hold and audit transition trail for a specific order.
 * @param {string} orderId
 */
export async function getHoldByOrderId(orderId) {
  const res = await api.get(`/escrow/hold/order/${orderId}`);
  return res.data;
}

/**
 * Courier simulation / trigger marking return parcel as delivered.
 * @param {string} holdId
 */
export async function markReturnDeliveredByCourier(holdId) {
  const res = await api.post(`/escrow/hold/${holdId}/courier-delivered`);
  return res.data;
}

// ── Admin Arbitration Methods ──────────────────────────────────

/**
 * Fetches all disputed refund holds for Admin portal.
 */
export async function getAdminDisputedHolds() {
  const res = await api.get('/escrow/admin/disputes');
  return res.data;
}

/**
 * Admin resolves disputed refund hold (REFUND_BUYER / SETTLE_WITH_SELLER / PARTIAL_REFUND).
 * @param {string} holdId
 * @param {Object} data { decision, partialAmount, resolutionNotes }
 */
export async function adminResolveDispute(holdId, data) {
  const res = await api.post(`/escrow/admin/hold/${holdId}/resolve`, data);
  return res.data;
}
