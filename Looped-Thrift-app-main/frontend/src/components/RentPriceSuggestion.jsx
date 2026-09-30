import { useState, useEffect, useRef } from 'react'
import { getRentPriceEstimate } from '../services/rentalService'

export default function RentPriceSuggestion({
  brand,
  category,
  condition,
  originalPrice,
  resalePrice,
  onAccept,
}) {
  const [result, setResult]   = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(false)
  const debounceRef           = useRef(null)

  useEffect(() => {
    if (!category || !condition) return

    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchEstimate()
    }, 600)

    return () => clearTimeout(debounceRef.current)
  }, [brand, category, condition, originalPrice, resalePrice])

  const fetchEstimate = async () => {
    setLoading(true)
    setError(false)
    try {
      const data = await getRentPriceEstimate({
        brand,
        category,
        condition,
        originalPrice,
        resalePrice,
      })
      setResult(data)
    } catch {
      setError(true)
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  if (!category || !condition || error) return null

  return (
    <div className="rounded-2xl border border-pink-200 bg-pink-50/70 overflow-hidden my-3">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-pink-100/80 border-b border-pink-200">
        <span className="text-base">🤖</span>
        <p className="text-xs font-semibold text-pink-800">AI Daily Rent Estimate</p>
        <span className="ml-auto text-[10px] text-pink-500 font-medium">
          Rental Valuation Engine
        </span>
      </div>

      <div className="px-4 py-3">
        {loading ? (
          <div className="flex items-center gap-3 py-1">
            <div className="w-4 h-4 border-2 border-pink-400 border-t-pink-600 rounded-full animate-spin flex-shrink-0" />
            <p className="text-xs text-pink-600">Calculating fair daily rental rate…</p>
          </div>
        ) : result ? (
          <>
            {/* Rent range display */}
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-pink-600 text-xs font-medium">Suggested Rate:</span>
              <span className="text-pink-700 font-bold text-xl">
                ₹{result.price_low?.toLocaleString('en-IN')}
              </span>
              <span className="text-pink-400 text-sm">–</span>
              <span className="text-pink-700 font-bold text-xl">
                ₹{result.price_high?.toLocaleString('en-IN')}
                <span className="text-xs font-normal text-pink-500"> /day</span>
              </span>
            </div>

            {/* Recommended Deposit */}
            {result.suggested_deposit > 0 && (
              <p className="text-xs text-gray-600 mb-2">
                Suggested Deposit: <strong className="text-gray-800">₹{result.suggested_deposit.toLocaleString('en-IN')}</strong>
              </p>
            )}

            {/* Confidence & Accuracy */}
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full
                ${result.confidence === 'high'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-amber-100 text-amber-700'}`}>
                {result.confidence === 'high' ? '● High confidence' : '● Medium confidence'}
              </span>
              {result.model_r2 && (
                <span className="text-[10px] text-pink-400">
                  Accuracy: {Math.round(result.model_r2 * 100)}%
                </span>
              )}
            </div>

            {/* Message */}
            <p className="text-[11px] text-pink-600 leading-relaxed mb-3">
              {result.message}
            </p>

            {/* Accept button */}
            {onAccept && (
              <button
                type="button"
                onClick={() => onAccept(result.predicted_rent_per_day, result.suggested_deposit)}
                className="w-full bg-pink-500 text-white text-xs font-semibold
                           py-2 rounded-xl hover:bg-pink-600 active:scale-95
                           transition-all shadow-2xs"
              >
                Apply ₹{result.predicted_rent_per_day?.toLocaleString('en-IN')}/day & ₹{result.suggested_deposit?.toLocaleString('en-IN')} Deposit
              </button>
            )}
          </>
        ) : null}
      </div>
    </div>
  )
}
