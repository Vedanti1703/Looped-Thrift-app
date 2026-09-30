import api from './api';

let sessionId = null;
function getSessionId() {
  if (!sessionId) {
    sessionId = sessionStorage.getItem('looped_session_id');
    if (!sessionId) {
      sessionId = 'sess_' + Math.random().toString(36).substring(2, 11) + Date.now();
      sessionStorage.setItem('looped_session_id', sessionId);
    }
  }
  return sessionId;
}

/**
 * Log an interaction event (views, dwell time, cart adds, purchases) to the recommendation engine.
 * @param {Object} eventData
 * @param {string} eventData.productId - Product ID
 * @param {'view'|'dwell'|'swipe_right'|'swipe_left'|'like'|'cart_add'|'purchase'} eventData.eventType - Event action
 * @param {number} [eventData.dwellTimeMs=0] - Dwell time in milliseconds
 * @param {string} [eventData.page='feed'] - Originating page
 * @param {Object} [eventData.metadata={}] - Additional context
 */
export async function trackEvent({ productId, eventType, dwellTimeMs = 0, page = 'feed', metadata = {} }) {
  if (!productId || !eventType) return;

  try {
    const payload = {
      productId,
      eventType,
      dwellTimeMs,
      page,
      sessionId: getSessionId(),
      metadata
    };

    // Non-blocking fire-and-forget
    api.post('/events', payload).catch(() => {});
  } catch (err) {
    // Fail silently so tracking never interferes with user experience
  }
}

export function trackView(productId, page = 'feed', metadata = {}) {
  return trackEvent({ productId, eventType: 'view', page, metadata });
}

export function trackDwell(productId, dwellTimeMs, page = 'product_detail', metadata = {}) {
  if (dwellTimeMs < 1000) return; // Only log meaningful dwell (>1s)
  return trackEvent({ productId, eventType: 'dwell', dwellTimeMs, page, metadata });
}

export function trackCartAdd(productId, page = 'product_detail', metadata = {}) {
  return trackEvent({ productId, eventType: 'cart_add', page, metadata });
}
