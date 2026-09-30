// ─────────────────────────────────────────────────────────────
//  PriceSuggestion.jsx
//  Calls the ML service and shows a suggested price range
//  inline inside the upload form.
//  Triggers whenever brand / category / condition / originalPrice changes.
// ─────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react'
import api from '../services/api'

export default function PriceSuggestion({ brand, category, condition, originalPrice, onAccept }) {
  const [result,   setResult]   = useState(null)   // prediction result
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(false)
  const debounceRef = useRef(null)

  // Re-run whenever any input changes, with 600ms debounce
  // so we don't spam the API on every keystroke
  useEffect(() => {
    // Need at least category + condition to make a prediction
    if (!category || !condition) return

    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchPrediction()
    }, 600)

    return () => clearTimeout(debounceRef.current)
  }, [brand, category, condition, originalPrice])

  const fetchPrediction = async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await api.post('/ml/predict-price', {
        brand:          brand          || 'Unknown',
        category:       category       || "Women's Tops",
        condition:      condition      || 'Good',
        original_price: originalPrice  || 0,
      })
      setResult(res.data)
    } catch {
      setError(true)
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  // Don't show anything until we have category + condition
  if (!category || !condition) return null

  // ML service is down — don't show the widget at all, silent fail
  if (error) return null

  return (
    <div className="rounded-2xl border border-purple-200 bg-purple-50 overflow-hidden">

      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-purple-100 border-b border-purple-200">
        <span className="text-base">🤖</span>
        <p className="text-xs font-semibold text-purple-700">AI Price Suggestion</p>
        <span className="ml-auto text-[10px] text-purple-400 font-medium">
          Random Forest Model
        </span>
      </div>

      <div className="px-4 py-3">
        {loading ? (
          // Loading state
          <div className="flex items-center gap-3 py-1">
            <div className="w-4 h-4 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin flex-shrink-0" />
            <p className="text-xs text-purple-500">Analysing {brand || category} market data…</p>
          </div>
        ) : result ? (
          <>
            {/* Price range display */}
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-purple-500 text-sm font-medium">Suggested:</span>
              <span className="text-purple-700 font-bold text-xl">
                ₹{result.price_low?.toLocaleString('en-IN')}
              </span>
              <span className="text-purple-400 text-sm">–</span>
              <span className="text-purple-700 font-bold text-xl">
                ₹{result.price_high?.toLocaleString('en-IN')}
              </span>
            </div>

            {/* Confidence badge */}
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full
                ${result.confidence === 'high'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-amber-100 text-amber-700'}`}>
                {result.confidence === 'high' ? '● High confidence' : '● Medium confidence'}
              </span>
              {result.model_r2 && (
                <span className="text-[10px] text-purple-400">
                  Model accuracy: {Math.round(result.model_r2 * 100)}%
                </span>
              )}
            </div>

            {/* Source message */}
            <p className="text-[11px] text-purple-500 leading-relaxed mb-3">
              {result.message}
            </p>

            {/* Accept button */}
            <button
              type="button"
              onClick={() => onAccept(result.predicted_price)}
              className="w-full bg-purple-500 text-white text-sm font-semibold
                         py-2 rounded-xl hover:bg-purple-600 active:scale-95
                         transition-all"
            >
              Use ₹{result.predicted_price?.toLocaleString('en-IN')} as my price
            </button>
          </>
        ) : null}
      </div>
    </div>
  )
}
