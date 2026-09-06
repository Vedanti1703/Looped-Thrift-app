import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'
import { formatPrice } from '../utils/helpers'
import {
  loadRazorpayScript,
  createPaymentOrder,
  verifyPayment,
  recordPaymentFailure
} from '../services/paymentService'
import Spinner from '../components/Spinner'
import CheckoutStepper from '../components/checkout/CheckoutStepper'
import CheckoutAddressStep from '../components/checkout/CheckoutAddressStep'
import CheckoutReviewStep from '../components/checkout/CheckoutReviewStep'
import CheckoutPaymentStep from '../components/checkout/CheckoutPaymentStep'

export default function CartPage() {
  const navigate = useNavigate()
  const { user, token } = useAuth()
  const { cartItems, removeFromCart, clearCart, total } = useCart()

  // Checkout Modal & Step State (1: Address, 2: Review, 3: Payment)
  const [showCheckoutModal, setShowCheckoutModal] = useState(false)
  const [checkoutStep, setCheckoutStep] = useState(1)
  const [processing, setProcessing] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')
  const [notice, setNotice] = useState('')

  // Delivery Address State
  const [addressForm, setAddressForm] = useState({
    name: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    pincode: ''
  })

  // Prefill address form from logged-in user profile
  useEffect(() => {
    if (user) {
      setAddressForm(prev => ({
        ...prev,
        name: prev.name || user.name || '',
        phone: prev.phone || user.phone || ''
      }))
    }
  }, [user])

  const handleOpenCheckout = () => {
    if (!token) {
      navigate('/login', { state: { from: '/cart' } })
      return
    }
    setCheckoutError('')
    setNotice('')
    setCheckoutStep(1)
    setShowCheckoutModal(true)
  }

  const handleAddressSelect = (selectedAddr) => {
    setAddressForm({
      name: selectedAddr.name || '',
      phone: selectedAddr.phone || '',
      address: selectedAddr.address || '',
      city: selectedAddr.city || '',
      state: selectedAddr.state || '',
      pincode: selectedAddr.pincode || ''
    })
    if (checkoutError) setCheckoutError('')
  }

  const handlePayNow = async () => {
    setCheckoutError('')
    setNotice('')

    if (!addressForm.name.trim() || !addressForm.phone.trim() || !addressForm.address.trim()) {
      setCheckoutError('Please provide complete shipping details before proceeding.')
      setCheckoutStep(1)
      return
    }

    setProcessing(true)

    try {
      // 1. Load Razorpay Checkout SDK script
      const scriptLoaded = await loadRazorpayScript()
      if (!scriptLoaded) {
        throw new Error('Razorpay Payment Gateway failed to load. Please check your network.')
      }

      // 2. Initialize Order on Backend (server recalculates price from database)
      const orderData = await createPaymentOrder(addressForm)

      if (!orderData || !orderData.success) {
        throw new Error(orderData?.message || 'Failed to initialize payment order.')
      }

      // 3. Configure and Launch Razorpay Checkout Modal
      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency || 'INR',
        name: 'Looped Thrift Marketplace',
        description: `Order #${orderData.orderId}`,
        image: 'https://cdn-icons-png.flaticon.com/512/3081/3081840.png',
        order_id: orderData.razorpayOrderId,
        handler: async function (response) {
          try {
            setVerifying(true)
            const verifyRes = await verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              orderId: orderData.orderId
            })

            if (verifyRes.success) {
              clearCart()
              setShowCheckoutModal(false)
              navigate(`/order-confirmation/${orderData.orderId}`)
            } else {
              setCheckoutError(verifyRes.message || 'Payment signature verification failed.')
            }
          } catch (verifyErr) {
            console.error('Payment verification error:', verifyErr)
            setCheckoutError(
              verifyErr.response?.data?.message ||
              'Payment verification failed. If your account was debited, please contact support.'
            )
          } finally {
            setVerifying(false)
            setProcessing(false)
          }
        },
        prefill: {
          name: addressForm.name.trim(),
          email: user?.email || '',
          contact: addressForm.phone.trim()
        },
        notes: {
          orderId: orderData.orderId,
          deliveryAddress: addressForm.address.trim()
        },
        theme: {
          color: '#ec4899'
        },
        modal: {
          ondismiss: async function () {
            setProcessing(false)
            setNotice('Payment window was closed. Your items and delivery address are still saved.')
            try {
              await recordPaymentFailure({
                razorpay_order_id: orderData.razorpayOrderId,
                orderId: orderData.orderId,
                error: { description: 'User closed Razorpay checkout modal' }
              })
            } catch (failErr) {
              console.warn('Could not record cancel status:', failErr)
            }
          }
        }
      }

      const rzpInstance = new window.Razorpay(options)

      rzpInstance.on('payment.failed', async function (response) {
        setProcessing(false)
        const errorDesc = response.error?.description || response.error?.reason || 'Payment transaction failed'
        setCheckoutError(`Payment failed: ${errorDesc}. You can try again or change payment method.`)

        try {
          await recordPaymentFailure({
            razorpay_order_id: orderData.razorpayOrderId,
            orderId: orderData.orderId,
            error: response.error
          })
        } catch (failErr) {
          console.warn('Could not record failure status:', failErr)
        }
      })

      rzpInstance.open()
    } catch (err) {
      console.error('Checkout error:', err)
      setProcessing(false)
      setCheckoutError(
        err.response?.data?.message || err.message || 'Could not process checkout. Please try again.'
      )
    }
  }

  return (
    <div className="min-h-screen bg-pink-50 pb-28">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white border-b border-pink-100 px-4 py-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1 hover:bg-pink-50 rounded-full transition">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m15 18-6-6 6-6"/>
          </svg>
        </button>
        <h1 className="font-bold text-gray-900 text-lg flex-1">My Cart</h1>
        <span className="text-xs bg-pink-100 text-pink-700 font-semibold px-2.5 py-1 rounded-full">
          {cartItems.length} item{cartItems.length !== 1 ? 's' : ''}
        </span>
      </div>

      {notice && (
        <div className="mx-4 mt-3 bg-blue-50 border border-blue-200 text-blue-700 text-xs px-4 py-3 rounded-2xl flex items-center justify-between shadow-xs">
          <span>{notice}</span>
          <button onClick={() => setNotice('')} className="text-blue-500 font-bold ml-2">✕</button>
        </div>
      )}

      {cartItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center px-6">
          <div className="text-5xl mb-4">🛍️</div>
          <p className="font-semibold text-gray-700 mb-1">Your cart is empty</p>
          <p className="text-gray-400 text-sm mb-6">Browse unique secondhand pieces and add items you love</p>
          <button onClick={() => navigate('/discover')} className="btn-primary max-w-xs">
            Start Shopping
          </button>
        </div>
      ) : (
        <div className="px-4 pt-4 space-y-3 max-w-lg mx-auto">
          {/* Cart Item Cards */}
          {cartItems.map((item, i) => (
            <div key={item.productId || i} className="card flex gap-3 p-3 items-center">
              <img
                src={item.image}
                alt={item.title}
                className="w-20 h-20 rounded-xl object-cover bg-pink-50 flex-shrink-0"
                onError={e => { e.target.src = 'https://picsum.photos/seed/cart/200/200' }}
              />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800 text-sm leading-snug mb-0.5 truncate">{item.title}</p>
                <p className="text-xs text-gray-400 mb-1.5">{item.condition || 'Pre-loved'}</p>
                <p className="text-pink-600 font-bold text-base">{formatPrice(item.price)}</p>
              </div>
              <button
                onClick={() => removeFromCart(item.productId)}
                className="text-gray-300 hover:text-red-500 transition-colors p-2 self-center rounded-xl hover:bg-red-50"
                title="Remove item"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>
                  <path d="M9 6V4h6v2"/>
                </svg>
              </button>
            </div>
          ))}

          {/* Order summary */}
          <div className="bg-white rounded-2xl border border-pink-100 p-4 mt-4 space-y-3">
            <h3 className="font-bold text-gray-800 text-sm">Order Summary</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal ({cartItems.length} items)</span>
                <span>{formatPrice(total)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Delivery Shipping</span>
                <span className="text-emerald-600 font-semibold">Free 🎉</span>
              </div>
              <div className="flex justify-between font-bold text-gray-900 border-t border-pink-100 pt-2.5 mt-2 text-sm">
                <span>Total Amount</span>
                <span className="text-pink-600 text-lg font-extrabold">{formatPrice(total)}</span>
              </div>
            </div>
          </div>

          {/* Sustainability note */}
          <div className="bg-emerald-50 rounded-2xl p-3 flex items-start gap-2 border border-emerald-100">
            <span className="text-lg">♻️</span>
            <p className="text-xs text-emerald-800 leading-relaxed">
              By buying thrift on Looped, you're giving clothes a second life and preventing fashion landfill waste!
            </p>
          </div>

          {/* Proceed Button */}
          <button
            onClick={handleOpenCheckout}
            className="btn-primary mt-2 flex items-center justify-center gap-2 shadow-sm py-3.5 text-base"
          >
            <span>💳</span> Proceed to Checkout • {formatPrice(total)}
          </button>
        </div>
      )}

      {/* ── Amazon / Meesho Style Multi-Step Checkout Modal ── */}
      {showCheckoutModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[92vh] flex flex-col shadow-2xl border border-pink-100 overflow-hidden">
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-pink-100 flex items-center justify-between bg-white">
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-gray-900">Checkout</span>
                <span className="text-xs text-gray-400">• Looped Thrift</span>
              </div>
              <button
                onClick={() => !processing && !verifying && setShowCheckoutModal(false)}
                disabled={processing || verifying}
                className="w-8 h-8 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-800 disabled:opacity-50"
              >
                ✕
              </button>
            </div>

            {/* Stepper Progress Bar */}
            <CheckoutStepper
              currentStep={checkoutStep}
              onStepClick={(step) => {
                if (!processing && !verifying) setCheckoutStep(step)
              }}
            />

            {/* Modal Step Content */}
            <div className="p-4 sm:p-5 overflow-y-auto flex-1">
              {checkoutStep === 1 && (
                <CheckoutAddressStep
                  user={user}
                  address={addressForm}
                  onAddressSelect={handleAddressSelect}
                  onNext={() => setCheckoutStep(2)}
                  disabled={processing || verifying}
                />
              )}

              {checkoutStep === 2 && (
                <CheckoutReviewStep
                  cartItems={cartItems}
                  total={total}
                  address={addressForm}
                  onChangeAddress={() => setCheckoutStep(1)}
                  onNext={() => setCheckoutStep(3)}
                  disabled={processing || verifying}
                />
              )}

              {checkoutStep === 3 && (
                <CheckoutPaymentStep
                  total={total}
                  onPayNow={handlePayNow}
                  onBack={() => setCheckoutStep(2)}
                  processing={processing}
                  verifying={verifying}
                  checkoutError={checkoutError}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
