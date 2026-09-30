import { useState, useEffect, useRef } from 'react'
import { formatPrice } from '../../utils/helpers'
import Spinner from '../Spinner'
import { createUpiQr, getUpiQrStatus } from '../../services/paymentService'

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
  const [qrLoading, setQrLoading] = useState(false)
  const [qrData, setQrData] = useState(null)
  const [qrExpired, setQrExpired] = useState(false)
  const [qrDisabled, setQrDisabled] = useState(false)
  const [qrError, setQrError] = useState('')
  const [timeLeft, setTimeLeft] = useState(600)

  const pollingRef = useRef(null)
  const countdownRef = useRef(null)

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

  // Clear timers on unmount or view change
  const stopTimers = () => {
    if (pollingRef.current) clearInterval(pollingRef.current)
    if (countdownRef.current) clearInterval(countdownRef.current)
  }

  useEffect(() => {
    return () => stopTimers()
  }, [])

  const startPolling = (qrId, orderId) => {
    stopTimers()

    // Countdown timer (every second)
    countdownRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(countdownRef.current)
          if (pollingRef.current) clearInterval(pollingRef.current)
          setQrExpired(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    // Status polling (every 3 seconds)
    pollingRef.current = setInterval(async () => {
      try {
        const res = await getUpiQrStatus(qrId, orderId)
        if (res && res.status === 'paid') {
          stopTimers()
          if (onPaymentSuccess) {
            onPaymentSuccess(res.orderId || orderId)
          }
        } else if (res && res.status === 'expired') {
          stopTimers()
          setQrExpired(true)
        }
      } catch (err) {
        console.warn('QR polling error:', err?.message || err)
      }
    }, 3000)
  }

  const handleShowQr = async () => {
    setQrError('')
    setQrLoading(true)
    setQrExpired(false)

    try {
      const data = await createUpiQr({ deliveryAddress: address })

      if (data && data.qrDisabled) {
        setQrDisabled(true)
        console.warn('Razorpay QR Codes not enabled on this account')
        return
      }

      if (!data || !data.success || !data.imageUrl) {
        setQrError(data?.message || 'Could not generate UPI QR Code. Please use UPI App option.')
        return
      }

      setQrData(data)
      setShowQrView(true)
      const secondsLeft = data.expiresAt ? Math.max(10, Math.floor((data.expiresAt - Date.now()) / 1000)) : 600
      setTimeLeft(secondsLeft)
      startPolling(data.qrId, data.orderId)
    } catch (err) {
      console.warn('Razorpay QR Codes not enabled on this account:', err?.response?.data?.message || err?.message)
      setQrDisabled(true)
      setQrError('Razorpay QR Codes not enabled on this account. Please use standard UPI button.')
    } finally {
      setQrLoading(false)
    }
  }

  const handleCancelQr = () => {
    stopTimers()
    setShowQrView(false)
    setQrError('')
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

      {(checkoutError || qrError) && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-2xl flex items-start gap-2">
          <span className="text-base flex-shrink-0">⚠️</span>
          <div className="flex-1">
            <p className="font-bold">Payment notice</p>
            <p className="text-[11px] mt-0.5">{checkoutError || qrError}</p>
          </div>
        </div>
      )}

      {/* QR Code In-App Display View */}
      {showQrView && qrData ? (
        <div className="bg-white border-2 border-pink-200 rounded-2xl p-4 text-center space-y-3.5 shadow-sm animate-fadeIn">
          <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
            <div className="text-left">
              <span className="text-xs font-bold text-gray-900 flex items-center gap-1">
                <span>📱</span> Scan & Pay with UPI
              </span>
              <p className="text-[11px] text-gray-500">Scan using any UPI app</p>
            </div>
            <div className="text-right">
              <span className="text-sm font-extrabold text-pink-600">{formatPrice(total)}</span>
            </div>
          </div>

          {/* QR Code Container */}
          <div className="flex flex-col items-center justify-center p-3 bg-gray-50 rounded-xl border border-gray-200/80">
            {qrExpired ? (
              <div className="py-8 px-4 text-center space-y-2">
                <span className="text-3xl">⌛</span>
                <p className="font-bold text-gray-800 text-sm">QR Code Expired</p>
                <p className="text-[11px] text-gray-500">This QR session has ended. Generate a fresh QR to proceed.</p>
                <button
                  type="button"
                  onClick={handleShowQr}
                  disabled={qrLoading}
                  className="btn-primary mt-2 text-xs py-2 px-4 font-bold"
                >
                  {qrLoading ? 'Generating...' : '↻ Generate New QR'}
                </button>
              </div>
            ) : (
              <>
                <div className="relative bg-white p-2.5 rounded-xl shadow-xs border border-gray-100">
                  <img
                    src={qrData.imageUrl}
                    alt="UPI QR Code"
                    className="w-48 h-48 sm:w-52 sm:h-52 object-contain rounded-lg"
                  />
                  <div className="absolute inset-x-0 -bottom-2 flex justify-center">
                    <span className="bg-pink-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs">
                      UPI QR
                    </span>
                  </div>
                </div>

                <div className="mt-3.5 flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
                  <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <span>Expires in: {formatCountdown(timeLeft)}</span>
                </div>

                <p className="text-xs font-semibold text-gray-700 mt-2">
                  Scan with Google Pay, PhonePe, Paytm or any UPI app
                </p>
                <div className="flex items-center gap-1.5 text-[11px] text-gray-400 mt-1">
                  <Spinner size="xs" />
                  <span>Awaiting payment confirmation...</span>
                </div>
              </>
            )}
          </div>

          {/* Action options */}
          <div className="space-y-2 pt-1">
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
              <span>Pay via UPI App Instead</span>
            </button>

            <button
              type="button"
              onClick={handleCancelQr}
              className="w-full py-1.5 text-xs text-gray-500 hover:text-gray-800 font-semibold"
            >
              Cancel QR & Choose Other Method
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Visual Payment Methods List */}
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

          {/* Pay Actions */}
          <div className="space-y-2.5 pt-1">
            {/* Primary Pay Button */}
            <button
              type="button"
              onClick={() => onPayNow(selectedMethod)}
              disabled={processing || verifying || qrLoading}
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

            {/* In-app QR Scan option (Only when UPI is selected and QR is not disabled) */}
            {selectedMethod === 'upi' && !qrDisabled && (
              <button
                type="button"
                onClick={handleShowQr}
                disabled={processing || verifying || qrLoading}
                className="w-full py-2.5 text-xs font-bold text-pink-700 bg-pink-50 hover:bg-pink-100/80 border border-pink-200 rounded-xl flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {qrLoading ? (
                  <>
                    <Spinner size="xs" />
                    <span>Preparing UPI QR Code...</span>
                  </>
                ) : (
                  <>
                    <span>📷</span>
                    <span>Show QR to scan</span>
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={onBack}
              disabled={processing || verifying || qrLoading}
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
