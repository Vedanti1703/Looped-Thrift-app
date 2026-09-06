import { formatPrice } from '../../utils/helpers'

export default function CheckoutReviewStep({
  cartItems,
  total,
  address,
  onChangeAddress,
  onNext,
  disabled
}) {
  return (
    <div className="space-y-4">
      {/* Step Header */}
      <div>
        <h3 className="font-bold text-gray-900 text-sm flex items-center gap-1.5">
          <span>📦</span> Review Order & Delivery
        </h3>
        <p className="text-[11px] text-gray-500">Please review items and shipping address before payment</p>
      </div>

      {/* Shipping Address Summary Card */}
      <div className="bg-white rounded-2xl border border-pink-100 p-3.5 flex items-start justify-between shadow-xs">
        <div className="text-xs text-gray-600 space-y-0.5 min-w-0 pr-2">
          <div className="flex items-center gap-1.5 font-bold text-gray-900">
            <span>📍</span>
            <span>Delivering to: {address?.name || 'Customer'}</span>
          </div>
          <p className="text-gray-700 pl-4">{address?.address}</p>
          <p className="text-gray-500 pl-4">
            {address?.city}, {address?.state} - {address?.pincode}
          </p>
          <p className="text-gray-500 pl-4">📞 {address?.phone}</p>
        </div>
        <button
          type="button"
          onClick={onChangeAddress}
          disabled={disabled}
          className="text-xs text-pink-600 font-bold hover:underline flex-shrink-0 px-2 py-1 bg-pink-50 rounded-lg hover:bg-pink-100 transition-colors"
        >
          Change
        </button>
      </div>

      {/* Item List (Read-only thrift pieces) */}
      <div className="bg-white rounded-2xl border border-pink-100 p-3.5 space-y-3 shadow-xs">
        <div className="flex items-center justify-between border-b border-pink-50 pb-2">
          <span className="text-xs font-bold text-gray-800">
            Items ({cartItems.length})
          </span>
          <span className="text-[11px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full">
            Ready to dispatch
          </span>
        </div>

        <div className="divide-y divide-pink-50 max-h-56 overflow-y-auto">
          {cartItems.map((item, idx) => (
            <div key={item.productId || idx} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
              <img
                src={item.image || 'https://picsum.photos/seed/review/200/200'}
                alt={item.title}
                className="w-14 h-14 rounded-xl object-cover bg-pink-50 border border-pink-100 flex-shrink-0"
                onError={(e) => { e.target.src = 'https://picsum.photos/seed/review/200/200' }}
              />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 text-xs truncate">{item.title}</p>
                <div className="flex items-center gap-2 text-[10px] text-gray-500 mt-0.5">
                  <span className="bg-pink-50 text-pink-700 px-1.5 py-0.2 rounded-md font-medium">
                    {item.condition || 'Pre-loved'}
                  </span>
                  {item.size && <span>Size: <strong>{item.size}</strong></span>}
                  <span>Qty: 1</span>
                </div>
                {item.sellerName && (
                  <p className="text-[10px] text-gray-400 mt-0.5">Sold by @{item.sellerName}</p>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-pink-600 font-bold text-sm">{formatPrice(item.price)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Buyer Protection Banner */}
      <div className="bg-pink-50/80 border border-pink-200/70 rounded-2xl p-3.5 space-y-1.5">
        <div className="flex items-center gap-2 text-xs font-bold text-pink-900">
          <span>🔒</span>
          <span>Looped Buyer Protection Active</span>
        </div>
        <p className="text-[11px] text-gray-600 leading-snug">
          Your payment is held safely until you receive & verify your pre-loved outfits. 7-Day return policy included.
        </p>
      </div>

      {/* Price Summary */}
      <div className="bg-white rounded-2xl border border-pink-100 p-3.5 space-y-2 text-xs shadow-xs">
        <div className="flex justify-between text-gray-600">
          <span>Items Subtotal</span>
          <span>{formatPrice(total)}</span>
        </div>
        <div className="flex justify-between text-gray-600">
          <span>Delivery Fee</span>
          <span className="text-emerald-600 font-semibold">FREE 🎉</span>
        </div>
        <div className="flex justify-between text-gray-600">
          <span>Buyer Protection</span>
          <span className="text-pink-600 font-semibold">FREE 🔒</span>
        </div>
        <div className="flex justify-between font-bold text-gray-900 border-t border-pink-100 pt-2.5 text-sm">
          <span>Total Payable</span>
          <span className="text-pink-600 text-base font-extrabold">{formatPrice(total)}</span>
        </div>
      </div>

      {/* Action Button */}
      <button
        type="button"
        onClick={onNext}
        disabled={disabled}
        className="btn-primary w-full py-3.5 text-base font-bold flex items-center justify-center gap-2 shadow-sm"
      >
        <span>Continue to Payment</span>
        <span>→</span>
      </button>
    </div>
  )
}
