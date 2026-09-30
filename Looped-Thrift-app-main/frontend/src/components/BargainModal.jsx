import React, { useState } from 'react';
import { formatPrice } from '../utils/helpers';
import { createOffer, respondToOffer } from '../services/bargainService';
import Spinner from './Spinner';

export default function BargainModal({
  isOpen,
  onClose,
  product,
  existingOffer,
  onOfferUpdated
}) {
  if (!isOpen || !product) return null;

  const minOffer = Math.round(product.price * 0.3);
  const [offeredPrice, setOfferedPrice] = useState(
    existingOffer ? existingOffer.offeredPrice : Math.round(product.price * 0.8)
  );
  const [message, setMessage] = useState(existingOffer ? existingOffer.message : '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmitOffer = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const priceNum = Number(offeredPrice);
    if (!priceNum || priceNum < minOffer) {
      setError(`Minimum offer is ${formatPrice(minOffer)} (30% of original price)`);
      return;
    }

    if (priceNum >= product.price) {
      setError(`Your offer should be less than the current price of ${formatPrice(product.price)}`);
      return;
    }

    setLoading(true);
    try {
      const result = await createOffer(product._id || product.id, priceNum, message);
      setSuccess('Your offer has been sent to the seller! ✦');
      if (onOfferUpdated) onOfferUpdated(result);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit offer. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRespondCounter = async (action) => {
    if (!existingOffer) return;
    setLoading(true);
    setError('');
    try {
      const result = await respondToOffer(existingOffer._id, action);
      setSuccess(action === 'accept' ? 'Counter offer accepted! ✦' : 'Counter offer declined.');
      if (onOfferUpdated) onOfferUpdated(result);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to respond to counter offer.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        className="w-full max-w-md rounded-3xl p-6 shadow-2xl border relative overflow-hidden"
        style={{
          backgroundColor: 'var(--ivory)',
          borderColor: 'var(--pink-cotton)',
          boxShadow: 'var(--shadow)'
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 transition"
          style={{ backgroundColor: 'var(--pink-blush)' }}
        >
          ✕
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl shadow-xs"
            style={{ backgroundColor: 'var(--pink-blush)', color: 'var(--pink-deep)' }}
          >
            🏷️
          </div>
          <div>
            <h2 className="text-xl font-bold leading-tight" style={{ fontFamily: "'Playfair Display', serif", color: 'var(--pink-mauve)' }}>
              Make an Offer ✦
            </h2>
            <p className="text-xs" style={{ color: '#6b5560' }}>
              Bargain directly with {product.sellerName || 'the seller'}
            </p>
          </div>
        </div>

        {/* Product summary card */}
        <div
          className="rounded-2xl p-3 mb-4 flex items-center gap-3 border"
          style={{ backgroundColor: 'var(--cream)', borderColor: 'var(--pink-cotton)' }}
        >
          <img
            src={product.image}
            alt={product.title}
            className="w-14 h-14 object-cover rounded-xl border flex-shrink-0"
            style={{ borderColor: 'var(--pink-cotton)' }}
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold truncate" style={{ color: 'var(--ink)' }}>{product.title}</p>
            <p className="text-xs text-gray-500">Original Listed Price:</p>
            <p className="text-sm font-bold" style={{ color: 'var(--pink-deep)', fontFamily: "'Fredoka', sans-serif" }}>
              {formatPrice(product.price)}
            </p>
          </div>
        </div>

        {/* Active offer notice if already exists */}
        {existingOffer && (
          <div
            className="rounded-2xl p-3.5 mb-4 text-xs border"
            style={{
              backgroundColor:
                existingOffer.status === 'accepted' ? '#DCEEDC' :
                existingOffer.status === 'countered' ? '#B7D2E6' :
                existingOffer.status === 'declined' ? '#FBE9EF' : 'var(--pink-blush)',
              borderColor: 'var(--pink-cotton)'
            }}
          >
            <div className="flex items-center justify-between font-bold mb-1">
              <span style={{ fontFamily: "'Fredoka', sans-serif" }}>
                Current Status: <span className="uppercase">{existingOffer.status}</span>
              </span>
              <span>Your offer: {formatPrice(existingOffer.offeredPrice)}</span>
            </div>

            {existingOffer.status === 'countered' && existingOffer.counterPrice && (
              <div className="mt-2 pt-2 border-t border-blue-200">
                <p className="font-semibold text-blue-900 mb-2">
                  Seller countered with: <span className="text-base font-bold">{formatPrice(existingOffer.counterPrice)}</span>
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleRespondCounter('accept')}
                    disabled={loading}
                    className="flex-1 py-1.5 rounded-full text-white text-xs font-bold transition"
                    style={{ backgroundColor: 'var(--green-sage)', fontFamily: "'Fredoka', sans-serif" }}
                  >
                    Accept Counter
                  </button>
                  <button
                    onClick={() => handleRespondCounter('decline')}
                    disabled={loading}
                    className="flex-1 py-1.5 rounded-full text-xs font-bold border transition"
                    style={{ borderColor: 'var(--pink-hot)', color: 'var(--pink-deep)', fontFamily: "'Fredoka', sans-serif" }}
                  >
                    Decline
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-600 text-xs p-3 rounded-xl mb-3">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs p-3 rounded-xl mb-3 font-semibold text-center">
            {success}
          </div>
        )}

        {/* Offer Form */}
        {(!existingOffer || existingOffer.status === 'declined' || existingOffer.status === 'pending') && (
          <form onSubmit={handleSubmitOffer} className="space-y-3">
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-bold" style={{ color: 'var(--pink-mauve)', fontFamily: "'Fredoka', sans-serif" }}>
                  Your Offered Price (₹)
                </label>
                <span className="text-[11px] text-gray-400">Min 30%: {formatPrice(minOffer)}</span>
              </div>
              <input
                type="number"
                value={offeredPrice}
                onChange={e => setOfferedPrice(e.target.value)}
                min={minOffer}
                max={product.price - 1}
                className="input text-base font-bold"
                placeholder={`e.g. ${Math.round(product.price * 0.8)}`}
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold block mb-1" style={{ color: 'var(--pink-mauve)', fontFamily: "'Fredoka', sans-serif" }}>
                Message for Seller (Optional)
              </label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="e.g. Hi! I love this piece, would you accept this offer?"
                rows={3}
                className="input text-xs"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 text-sm flex items-center justify-center gap-2 shadow-md mt-2"
            >
              {loading ? <Spinner size="sm" /> : existingOffer ? 'Update Offer ✦' : 'Send Offer ✦'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
