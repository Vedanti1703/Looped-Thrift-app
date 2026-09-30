const Razorpay = require('razorpay');

function getRazorpayInstance() {
  const key_id = (process.env.RAZORPAY_KEY_ID || '').trim();
  const key_secret = (process.env.RAZORPAY_KEY_SECRET || '').trim();

  if (!key_id || !key_secret || key_id === 'rzp_test_your_key_id_here' || key_secret === 'your_razorpay_key_secret_here') {
    console.warn('⚠️ Razorpay credentials not configured or set to placeholder. Please check RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in backend/.env');
  }

  // Always instantiate with the active environment variables to prevent stale caching
  return new Razorpay({
    key_id: key_id || 'rzp_test_placeholder',
    key_secret: key_secret || 'placeholder_secret',
  });
}

module.exports = {
  getRazorpayInstance,
};
