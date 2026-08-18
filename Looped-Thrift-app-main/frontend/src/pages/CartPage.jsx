import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import { useCart } from '../context/CartContext'
import { formatPrice } from '../utils/helpers'

export default function CartPage() {
  const navigate = useNavigate()
  const { cartItems, removeFromCart, total } = useCart()
  const [checkedOut, setCheckedOut] = useState(false)

  if (checkedOut) return (
    <div className="min-h-screen bg-pink-50 flex flex-col items-center justify-center pb-24 text-center px-6">
      <div className="text-6xl mb-4">🎊</div>
      <h2 className="font-bold text-2xl text-gray-800 mb-2">Order Placed!</h2>
      <p className="text-gray-500 mb-6">Thanks for shopping sustainably with Looped ♻️</p>
      <button onClick={() => navigate('/')} className="btn-primary max-w-xs">Back to Home</button>
    </div>
  )

  return (
    <div className="min-h-screen bg-pink-50 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white border-b border-pink-100 px-4 py-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m15 18-6-6 6-6"/>
          </svg>
        </button>
        <h1 className="font-bold text-gray-900 text-lg flex-1">My Cart</h1>
        <span className="text-sm text-gray-500">{cartItems.length} item{cartItems.length !== 1 ? 's' : ''}</span>
      </div>

      {cartItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center px-6">
          <div className="text-5xl mb-4">🛍️</div>
          <p className="font-semibold text-gray-700 mb-1">Your cart is empty</p>
          <p className="text-gray-400 text-sm mb-6">Browse and add items you love</p>
          <button onClick={() => navigate('/discover')} className="btn-primary max-w-xs">
            Start Shopping
          </button>
        </div>
      ) : (
        <div className="px-4 pt-4 space-y-3">
          {cartItems.map((item, i) => (
            <div key={item.productId || i} className="card flex gap-3 p-3">
              <img
                src={item.image}
                alt={item.title}
                className="w-20 h-20 rounded-xl object-cover bg-pink-50 flex-shrink-0"
                onError={e => { e.target.src = 'https://picsum.photos/seed/cart/200/200' }}
              />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800 text-sm leading-snug mb-1 truncate">{item.title}</p>
                <p className="text-xs text-gray-400 mb-2">{item.condition}</p>
                <p className="text-pink-600 font-bold text-base">{formatPrice(item.price)}</p>
              </div>
              <button
                onClick={() => removeFromCart(item.productId)}
                className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0 self-start p-1"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>
                  <path d="M9 6V4h6v2"/>
                </svg>
              </button>
            </div>
          ))}

          {/* Order summary */}
          <div className="bg-white rounded-2xl border border-pink-100 p-4 mt-4">
            <h3 className="font-bold text-gray-800 mb-3">Order Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal ({cartItems.length} items)</span>
                <span>{formatPrice(total)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Delivery</span>
                <span className="text-green-600 font-medium">Free 🎉</span>
              </div>
              <div className="flex justify-between font-bold text-gray-900 border-t border-pink-100 pt-2 mt-2">
                <span>Total</span>
                <span className="text-pink-600 text-lg">{formatPrice(total)}</span>
              </div>
            </div>
          </div>

          {/* Sustainability note */}
          <div className="bg-green-50 rounded-2xl p-3 flex items-start gap-2">
            <span className="text-lg">♻️</span>
            <p className="text-xs text-green-700">
              By buying thrift, you're giving clothes a second life and reducing fashion waste!
            </p>
          </div>

          <button
            onClick={() => setCheckedOut(true)}
            className="btn-primary mt-2"
          >
            Proceed to Checkout
          </button>
        </div>
      )}
    </div>
  )
}
