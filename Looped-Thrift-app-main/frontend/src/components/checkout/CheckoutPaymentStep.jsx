import { useState, useEffect, useRef } from 'react'
import { formatPrice } from '../../utils/helpers'
import Spinner from '../Spinner'

// Build a real UPI deep-link QR code image URL using free qrserver.com API
function buildUpiQrUrl(amount, orderId) {
  const vpa = import.meta.env.VITE_MERCHANT_UPI_VPA || 'looped@razorpay'
  const name = import.meta.env.VITE_MERCHANT_NAME || 'Looped+Thrift+Marketplace'
  const tn = encodeURIComponent(`Order #${orderId}`)
  const upiLink = `upi://pay?pa=${encodeURIComponent(vpa)}&pn=${name}&am=${amount}&cu=INR&tn=${tn}`
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=12&data=${encodeURIComponent(upiLink)}`
  return { qrApiUrl, upiLink }
}

const QR_DURATION_SECS = 600 // 10 minutes

export default function CheckoutPaymentStep({
  total,
  address,
  onPayNow,
  onBack,
  processing,
  verifying,
  checkoutError,
  onPaymentSuccess
}) {
  const [selectedMethod, setSelectedMethod] = useState('upi')
  const [showQrView, setShowQrView] = useState(false)
  const [qrUrls, setQrUrls] = useState(null)
  const [qrLoading, setQrLoading] = useState(false)
  const [qrExpired, setQrExpired] = useState(false)
  const [timeLeft, setTimeLeft] = useState(QR_DURATION_SECS)

  const countdownRef = useRef(null)
  const qrRefId = useRef(`QR-${Date.now()}`)

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

  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [])

  const startCountdown = () => {
    if (countdownRef.current) clearInterval(countdownRef.current)
    setTimeLeft(QR_DURATION_SECS)
    setQrExpired(false)
    countdownRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(countdownRef.current)
          setQrExpired(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const handleShowQr = () => {
    setQrLoading(true)
    qrRefId.current = `QR-${Date.now()}`
    const { qrApiUrl, upiLink } = buildUpiQrUrl(total, qrRefId.current)
    setQrUrls({ qrApiUrl, upiLink })
    startCountdown()
    setShowQrView(true)
    setQrLoading(false)
  }

  const handleRefreshQr = () => {
    handleShowQr()
  }

  const handleCancelQr = () => {
    if (countdownRef.current) clearInterval(countdownRef.current)
    setShowQrView(false)
    setQrUrls(null)
  }

  const formatCountdown = (secs) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${s < 10 ? '0' : ''}${s}`
  }

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
            <p className="font-bold">Payment notice</p>
            <p className="text-[11px] mt-0.5">{checkoutError}</p>
          </div>
        </div>
      )}

      {/* UPI QR Scan In-App View */}
      {showQrView ? (
        <div className="bg-white border-2 border-pink-200 rounded-2xl overflow-hidden shadow-md">
          {/* Header */}
          <div className="bg-gradient-to-r from-pink-500 to-rose-500 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">📱</span>
              <div>
                <p className="text-white font-bold text-sm">Scan & Pay via UPI</p>
                <p className="text-pink-100 text-[11px]">Open any UPI app and scan the code below</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-pink-100 text-[10px]">Amount</p>
              <p className="text-white font-extrabold text-base">{formatPrice(total)}</p>
            </div>
          </div>

          {/* QR Body */}
          <div className="px-4 py-4 flex flex-col items-center space-y-3">
            {qrExpired ? (
              /* Expired state */
              <div className="flex flex-col items-center py-6 space-y-3 text-center">
                <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
                  <span className="text-3xl">⌛</span>
                </div>
                <div>
                  <p className="font-bold text-gray-800 text-sm">QR Code Expired</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">This QR session has ended. Generate a fresh code to continue.</p>
                </div>
                <button
                  type="button"
                  onClick={handleRefreshQr}
                  className="btn-primary mt-1 text-xs py-2 px-5 font-bold flex items-center gap-1.5"
                >
                  <span>↻</span> Generate New QR Code
                </button>
              </div>
            ) : (
              <>
                {/* QR Code image */}
                <div className="relative">
                  <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100">
                    <img
                      src={qrUrls?.qrApiUrl}
                      alt="UPI QR Code — Scan to pay"
                      className="w-52 h-52 sm:w-56 sm:h-56 object-contain block"
                      onLoad={() => setQrLoading(false)}
                    />
                  </div>
                  {/* Looped badge on QR */}
                  <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-gradient-to-r from-pink-500 to-rose-500 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-sm whitespace-nowrap">
                    <span>🛍️</span> Looped Thrift
                  </div>
                </div>

                {/* UPI App logos */}
                <div className="flex items-center gap-3 mt-4 pt-2">
                  {['GPay', 'PhonePe', 'Paytm', 'BHIM'].map((app) => (
                    <div key={app} className="flex flex-col items-center gap-0.5">
                      <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-base">
                        {app === 'GPay' ? '🔵' : app === 'PhonePe' ? '🟣' : app === 'Paytm' ? '🔷' : '🇮🇳'}
                      </div>
                      <span className="text-[9px] text-gray-500 font-medium">{app}</span>
                    </div>
                  ))}
                </div>

                {/* Countdown timer */}
                <div className="w-full bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    <span className="text-[11px] font-semibold text-amber-800">QR expires in</span>
                  </div>
                  <span className="text-sm font-extrabold text-amber-700 tabular-nums">
                    {formatCountdown(timeLeft)}
                  </span>
                </div>

                {/* Instruction text */}
                <p className="text-[11px] text-gray-500 text-center leading-relaxed">
                  Open <strong>Google Pay, PhonePe, Paytm</strong> or any UPI app.<br />
                  Tap <em>Scan QR</em> and point your camera at the code above.
                </p>
              </>
            )}
          </div>

          {/* Actions */}
          <div className="px-4 pb-4 space-y-2">
            <button
              type="button"
              onClick={() => {
                handleCancelQr()
                onPayNow('upi')
              }}
              disabled={processing || verifying}
              className="btn-primary w-full py-2.5 text-xs font-bold flex items-center justify-center gap-2"
            >
              <span>⚡</span>
              <span>Pay via UPI App Instead (Razorpay)</span>
            </button>
            <button
              type="button"
              onClick={handleCancelQr}
              className="w-full py-1.5 text-xs text-gray-500 hover:text-gray-800 font-semibold"
            >
              ← Choose a Different Payment Method
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Payment Methods List */}
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
                          <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
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

          {/* Security assurance */}
          <div className="bg-gray-50 rounded-2xl p-3 border border-gray-100">
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
          <div className="space-y-2.5 pt-1">
            <button
              type="button"
              onClick={() => onPayNow(selectedMethod)}
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

            {/* Show QR to scan — only when UPI is selected */}
            {selectedMethod === 'upi' && (
              <button
                type="button"
                onClick={handleShowQr}
                disabled={processing || verifying || qrLoading}
                className="w-full py-2.5 text-xs font-bold text-pink-700 bg-pink-50 hover:bg-pink-100/80 border border-pink-200 rounded-xl flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {qrLoading ? (
                  <>
                    <Spinner size="xs" />
                    <span>Generating QR...</span>
                  </>
                ) : (
                  <>
                    <span>📷</span>
                    <span>Show QR Code to scan</span>
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={onBack}
              disabled={processing || verifying}
              className="w-full py-2 text-xs text-gray-500 hover:text-gray-800 font-semibold"
            >
              ← Back to Order Review
            </button>
          </div>
        </>
      )}
    </div>
  )
}
