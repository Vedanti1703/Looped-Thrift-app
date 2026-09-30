import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getOrderDetails } from '../services/paymentService'
import { formatPrice } from '../utils/helpers'
import Spinner from '../components/Spinner'

export default function OrderConfirmationPage() {
  const { orderId } = useParams()
  const navigate = useNavigate()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    window.scrollTo(0, 0)
    if (orderId) {
      fetchOrder()
    }
  }, [orderId])

  const fetchOrder = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await getOrderDetails(orderId)
      if (data.success && data.order) {
        setOrder(data.order)
      } else {
        setError(data.message || 'Unable to find order details.')
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load order confirmation.')
    } finally {
      setLoading(false)
    }
  }

  const handleCopyOrderId = () => {
    if (order?.orderId) {
      navigator.clipboard.writeText(order.orderId)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-pink-50 flex flex-col items-center justify-center p-6 text-center">
        <Spinner size="lg" />
        <p className="text-gray-500 font-medium text-sm mt-4">Loading your order confirmation...</p>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-pink-50 flex flex-col items-center justify-center p-6 text-center pb-24">
        <div className="text-5xl mb-4">🔍</div>
        <h2 className="font-bold text-xl text-gray-800 mb-2">Order Not Found</h2>
        <p className="text-gray-500 text-sm mb-6 max-w-xs">{error || 'We could not locate this order.'}</p>
        <button onClick={() => navigate('/discover')} className="btn-primary max-w-xs">
          Explore Thrift Finds
        </button>
      </div>
    )
  }

  const isPaid = (order.paymentStatus || '').toLowerCase() === 'paid'
  const isRefunded = (order.paymentStatus || '').toLowerCase() === 'refunded'
  const isFailed = (order.paymentStatus || '').toLowerCase() === 'failed'

  return (
    <div className="min-h-screen bg-pink-50 pb-28">
      {/* Top Bar */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-pink-100 px-4 py-3.5 flex items-center justify-between">
        <button onClick={() => navigate('/')} className="text-gray-600 hover:text-gray-900 p-1">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m15 18-6-6 6-6"/>
          </svg>
        </button>
        <h1 className="font-bold text-gray-900 text-base">Order Confirmation</h1>
        <div className="w-8" />
      </div>

      <div className="px-4 pt-4 space-y-4 max-w-lg mx-auto">
        {/* Celebration Banner */}
        <div className="bg-gradient-to-br from-pink-500 to-rose-500 text-white rounded-3xl p-6 text-center shadow-sm relative overflow-hidden">
          <div className="text-5xl mb-2 animate-bounce">🎊</div>
          <h2 className="font-display italic text-2xl font-bold mb-1">
            {isPaid ? 'Payment Successful!' : isFailed ? 'Payment Failed' : 'Order Placed!'}
          </h2>
          <p className="text-white/90 text-xs">
            {isPaid
              ? 'Your payment is verified & protected under Looped Buyer Protection 🔒'
              : 'Thank you for circular shopping and saving pre-loved fashion ♻️'}
          </p>
        </div>

        {/* Order ID & Payment Details Card */}
        <div className="card p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-pink-100 pb-3">
            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Order ID</p>
              <p className="font-bold text-gray-900 text-base font-mono">{order.orderId}</p>
            </div>
            <button
              onClick={handleCopyOrderId}
              className="text-xs bg-pink-50 hover:bg-pink-100 text-pink-600 font-semibold px-3 py-1.5 rounded-full transition flex items-center gap-1 active:scale-95"
            >
              {copied ? (
                <><span>✓</span> Copied</>
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                  </svg>
                  Copy
                </>
              )}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs pt-1">
            <div>
              <p className="text-gray-400 font-medium">Payment Status</p>
              <span className={`inline-block mt-0.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                isPaid
                  ? 'bg-emerald-100 text-emerald-700'
                  : isRefunded
                  ? 'bg-purple-100 text-purple-700'
                  : isFailed
                  ? 'bg-rose-100 text-rose-700'
                  : 'bg-amber-100 text-amber-700'
              }`}>
                {isPaid ? '● Paid (Razorpay)' : isRefunded ? '● Refunded' : isFailed ? '● Failed' : '● Pending'}
              </span>
            </div>
            <div>
              <p className="text-gray-400 font-medium">Order Status</p>
              <span className="inline-block mt-0.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-pink-100 text-pink-700">
                ● {order.orderStatus || order.status || 'Confirmed'}
              </span>
            </div>
            <div className="col-span-2 bg-amber-50/80 border border-amber-100/80 rounded-xl p-2.5 flex items-center justify-between">
              <div>
                <p className="text-[10px] text-amber-700 font-bold uppercase tracking-wider flex items-center gap-1">
                  <span>🔒</span> Seller Payout Status
                </p>
                <p className="text-xs font-semibold text-gray-800 mt-0.5">
                  {order.payoutStatus === 'RELEASED' ? '💸 Released to Seller' : 'Protected / On Hold'}
                </p>
              </div>
              <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">
                {order.payoutStatus || 'ON_HOLD'}
              </span>
            </div>
            {order.razorpayPaymentId && (
              <div className="col-span-2 bg-gray-50 rounded-xl p-2.5">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">Razorpay Payment ID</p>
                <p className="text-xs font-mono font-medium text-gray-700 break-all">{order.razorpayPaymentId}</p>
              </div>
            )}
            <div className="col-span-2 flex items-center justify-between text-gray-600 bg-pink-50/50 rounded-xl p-2.5 border border-pink-100/50">
              <span className="flex items-center gap-1.5 font-medium">
                <span>🚚</span> Estimated Delivery
              </span>
              <span className="font-bold text-gray-800">{order.estimatedDelivery || '3-5 business days'}</span>
            </div>
          </div>
        </div>

        {/* Delivery Address Card */}
        <div className="card p-4">
          <h3 className="font-bold text-gray-800 text-sm mb-2 flex items-center gap-1.5">
            <span>📍</span> Shipping Address
          </h3>
          <div className="text-xs text-gray-600 space-y-1">
            <p className="font-bold text-gray-900 text-sm">{order.name}</p>
            <p className="text-gray-500">📞 {order.phone}</p>
            <p className="leading-relaxed">
              {order.address}
              {order.city ? `, ${order.city}` : ''}
              {order.state ? `, ${order.state}` : ''}
              {order.pincode ? ` - ${order.pincode}` : ''}
            </p>
          </div>
        </div>

        {/* Items Summary */}
        <div className="card p-4 space-y-3">
          <h3 className="font-bold text-gray-800 text-sm flex items-center justify-between">
            <span>Purchased Items</span>
            <span className="text-xs text-gray-400 font-normal">
              {order.items?.length || 1} item{order.items?.length !== 1 ? 's' : ''}
            </span>
          </h3>

          <div className="divide-y divide-pink-100">
            {order.items && order.items.length > 0 ? (
              order.items.map((item, idx) => (
                <div key={idx} className="flex gap-3 py-2.5 first:pt-0 last:pb-0">
                  <img
                    src={item.image || 'https://picsum.photos/seed/order/200/200'}
                    alt={item.title}
                    className="w-14 h-14 rounded-xl object-cover bg-pink-50 flex-shrink-0"
                    onError={e => { e.target.src = 'https://picsum.photos/seed/order/200/200' }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-xs truncate">{item.title}</p>
                    <p className="text-[11px] text-gray-400">
                      {item.condition ? `${item.condition} • ` : ''}Qty: {item.quantity || 1}
                    </p>
                    <p className="text-pink-600 font-bold text-xs mt-0.5">{formatPrice(item.price)}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-2">
                <p className="font-semibold text-gray-900 text-xs">{order.productName || 'Thrift Product'}</p>
                <p className="text-pink-600 font-bold text-xs mt-0.5">{formatPrice(order.totalAmount)}</p>
              </div>
            )}
          </div>

          {/* Price Breakdown */}
          <div className="border-t border-pink-100 pt-3 space-y-1.5 text-xs">
            <div className="flex justify-between text-gray-500">
              <span>Subtotal</span>
              <span>{formatPrice(order.totalAmount)}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>Shipping</span>
              <span className="text-green-600 font-medium">FREE</span>
            </div>
            <div className="flex justify-between font-bold text-gray-900 text-sm border-t border-pink-100 pt-2">
              <span>Total Paid</span>
              <span className="text-pink-600 text-base">{formatPrice(order.totalAmount)}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-2">
          <button
            onClick={() => navigate('/discover')}
            className="btn-primary flex items-center justify-center gap-2"
          >
            <span>✨</span> Continue Shopping
          </button>
          <button
            onClick={() => navigate('/')}
            className="btn-outline flex items-center justify-center gap-2"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  )
}
