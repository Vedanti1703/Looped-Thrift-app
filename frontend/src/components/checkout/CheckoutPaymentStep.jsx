import { useState } from 'react'
import { formatPrice } from '../../utils/helpers'
import Spinner from '../Spinner'

export default function CheckoutPaymentStep({
  total,
  onPayNow,
  onBack,
  processing,
  verifying,
  checkoutError
}) {
  const [selectedMethod, setSelectedMethod] = useState('upi')

  const PAYMENT_METHODS = [
    {
      id: 'upi',
      name: 'UPI / QR Code',
      desc: 'Google Pay, PhonePe, Paytm, BHIM or Scan QR',
      icon: '📱',
      badge: 'Fast & Recommended'
    },
    {
      id: 'card',
      name: 'Credit / Debit Card',
      desc: 'Visa, Mastercard, RuPay, Maestro',
      icon: '💳'
    },
    {
      id: 'netbanking',
      name: 'Net Banking',
      desc: 'SBI, HDFC, ICICI, Axis and 50+ banks',
      icon: '🏦'
    },
    {
      id: 'wallet',
      name: 'Wallets & More',
      desc: 'Paytm, Amazon Pay, Mobikwik',
      icon: '👛'
    }
  ]

  return (
    <div className="space-y-4">
      {/* Step Header */}
      <div>
        <h3 className="font-bold text-gray-900 text-sm flex items-center gap-1.5">
          <span>💳</span> Select Payment Method
        </h3>
        <p className="text-[11px] text-gray-500">Secure 256-bit encrypted transaction powered by Razorpay</p>
      </div>

      {checkoutError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-2xl flex items-start gap-2">
          <span className="text-base flex-shrink-0">⚠️</span>
          <div className="flex-1">
            <p className="font-bold">Payment could not be completed</p>
            <p className="text-[11px] mt-0.5">{checkoutError}</p>
          </div>
        </div>
      )}

      {/* Visual Payment Methods List (Amazon / Meesho style) */}
      <div className="space-y-2.5">
        {PAYMENT_METHODS.map((method) => {
          const isSelected = selectedMethod === method.id

          return (
            <div
              key={method.id}
              onClick={() => setSelectedMethod(method.id)}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                isSelected
                  ? 'border-pink-500 bg-pink-50/50 ring-1 ring-pink-500 shadow-xs'
                  : 'border-gray-200 bg-white hover:border-pink-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl flex-shrink-0">{method.icon}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900 text-sm">{method.name}</span>
                    {method.badge && (
                      <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.2 rounded-full">
                        {method.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-gray-500 text-[11px] mt-0.5">{method.desc}</p>
                </div>
              </div>
              <input
                type="radio"
                name="paymentMethod"
                checked={isSelected}
                onChange={() => setSelectedMethod(method.id)}
                className="accent-pink-500 w-4 h-4 ml-2"
              />
            </div>
          )
        })}
      </div>

      {/* Payment Security Assurance */}
      <div className="bg-gray-50 rounded-2xl p-3 border border-gray-100 space-y-2">
        <div className="grid grid-cols-3 gap-2 text-center text-[10px] text-gray-500">
          <div className="flex flex-col items-center">
            <span className="text-base mb-0.5">🔒</span>
            <span className="font-semibold text-gray-700">256-Bit SSL</span>
            <span>Bank-grade security</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-base mb-0.5">🛡️</span>
            <span className="font-semibold text-gray-700">Buyer Protection</span>
            <span>Payout on hold</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-base mb-0.5">↩️</span>
            <span className="font-semibold text-gray-700">7-Day Returns</span>
            <span>Hassle-free refunds</span>
          </div>
        </div>
      </div>

      {/* Pay Button */}
      <div className="space-y-2 pt-1">
        <button
          type="button"
          onClick={onPayNow}
          disabled={processing || verifying}
          className="btn-primary w-full py-3.5 text-base font-bold flex items-center justify-center gap-2 shadow-sm disabled:opacity-60"
        >
          {verifying ? (
            <>
              <Spinner size="sm" />
              <span>Verifying Payment...</span>
            </>
          ) : processing ? (
            <>
              <Spinner size="sm" />
              <span>Opening Razorpay Gateway...</span>
            </>
          ) : (
            <>
              <span>🔒</span>
              <span>Pay {formatPrice(total)} Securely</span>
              <span>→</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={onBack}
          disabled={processing || verifying}
          className="w-full py-2 text-xs text-gray-500 hover:text-gray-800 font-semibold"
        >
          ← Back to Order Review
        </button>
      </div>
    </div>
  )
}
