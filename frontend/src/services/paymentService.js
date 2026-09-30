import api from './api';

/**
 * Loads the Razorpay checkout.js script asynchronously if not already present in the DOM.
 * @returns {Promise<boolean>}
 */
export function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      return resolve(true);
    }
    const existingScript = document.getElementById('razorpay-checkout-script');
    if (existingScript) {
      existingScript.onload = () => resolve(true);
      existingScript.onerror = () => resolve(false);
      return;
    }
    const script = document.createElement('script');
    script.id = 'razorpay-checkout-script';
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      console.error('Failed to load Razorpay Checkout SDK script.');
      resolve(false);
    };
    document.body.appendChild(script);
  });
}

/**
 * Creates an order in Razorpay and backend DB.
 * Recalculates total server-side.
 * @param {Object} deliveryAddress { name, phone, address, city, state, pincode }
 */
export async function createPaymentOrder(deliveryAddress) {
  const response = await api.post('/payment/create-order', { deliveryAddress });
  return response.data;
}

/**
 * Verifies Razorpay payment signature after successful checkout modal transaction.
 * @param {Object} paymentData { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId }
 */
export async function verifyPayment(paymentData) {
  const response = await api.post('/payment/verify', paymentData);
  return response.data;
}

/**
 * Records a payment failure or user cancellation for a pending order.
 * @param {Object} failureData { razorpay_order_id, orderId, error }
 */
export async function recordPaymentFailure(failureData) {
  const response = await api.post('/payment/failure', failureData);
  return response.data;
}

/**
 * Fetches order details by order ID or MongoDB ObjectId.
 * @param {string} orderId
 */
export async function getOrderDetails(orderId) {
  const response = await api.get(`/payment/order/${orderId}`);
  return response.data;
}

/**
 * Fetches order history for current logged in user.
 */
export async function getMyOrders() {
  const response = await api.get('/payment/my-orders');
  return response.data;
}

/**
 * Fetches public Razorpay key ID from server config.
 */
export async function getRazorpayKey() {
  const response = await api.get('/payment/key');
  return response.data;
}
