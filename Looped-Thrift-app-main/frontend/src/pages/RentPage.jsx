import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getRentableFeed } from '../services/rentalService'
import Skeleton from '../components/Skeleton'
import { formatPrice, conditionColor, truncate } from '../utils/helpers'

export default function RentPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [occasionFilter, setOccasionFilter] = useState('all') // 'all' | 'Wedding' | 'Party' | 'Formal'

  useEffect(() => {
    fetchFeed()
  }, [occasionFilter])

  const fetchFeed = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getRentableFeed()
      let feed = Array.isArray(data) ? data : data?.products || []
      if (occasionFilter !== 'all') {
        feed = feed.filter(p => (p.occasion || '').toLowerCase() === occasionFilter.toLowerCase())
      }
      setItems(feed)
    } catch (err) {
      setError('Could not load rentable items. Please pull down to refresh.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen pb-28" style={{ backgroundColor: 'var(--cream)' }}>
      {/* Header */}
      <div
        className="sticky top-0 z-40 border-b px-4 py-3.5 flex items-center justify-between"
        style={{
          backgroundColor: 'rgba(251, 244, 236, 0.94)',
          backdropFilter: 'blur(12px)',
          borderColor: 'var(--pink-cotton)'
        }}
      >
        <div className="flex items-center gap-2">
          <span className="text-2xl">👗</span>
          <div>
            <h1 className="font-bold text-base leading-none" style={{ fontFamily: "'Playfair Display', serif", color: 'var(--pink-mauve)' }}>
              Luxury Occasion Rentals ✦
            </h1>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--pink-deep)', fontFamily: "'Fredoka', sans-serif" }}>
              Designer Bridal, Cocktail & Formal Wear by the Day
            </p>
          </div>
        </div>
        <button
          onClick={fetchFeed}
          className="text-xs font-semibold px-2.5 py-1.5 rounded-full border transition"
          style={{ backgroundColor: 'var(--pink-blush)', borderColor: 'var(--pink-cotton)', color: 'var(--pink-deep)', fontFamily: "'Fredoka', sans-serif" }}
        >
          🔄 Refresh
        </button>
      </div>

      {/* Occasion Filter Chips */}
      <div className="flex gap-2 overflow-x-auto px-4 py-3 scrollbar-none">
        {[
          { key: 'all', label: 'All Premium Rentals' },
          { key: 'Wedding', label: '💍 Wedding & Bridal' },
          { key: 'Party', label: '🍸 Party & Cocktail' },
          { key: 'Formal', label: '👔 Formal & Black Tie' },
        ].map(chip => (
          <button
            key={chip.key}
            onClick={() => setOccasionFilter(chip.key)}
            className={`text-xs px-3.5 py-1.5 rounded-full font-bold flex-shrink-0 transition-all ${
              occasionFilter === chip.key ? 'text-white shadow-xs' : 'border'
            }`}
            style={{
              backgroundColor: occasionFilter === chip.key ? 'var(--pink-hot)' : 'var(--ivory)',
              borderColor: 'var(--pink-cotton)',
              color: occasionFilter === chip.key ? '#fff' : 'var(--pink-mauve)',
              fontFamily: "'Fredoka', sans-serif"
            }}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Main Content */}
      <div className="px-4">
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="card p-3 space-y-2" style={{ backgroundColor: 'var(--ivory)', borderColor: 'var(--pink-cotton)' }}>
                <Skeleton height="180px" />
                <Skeleton height="16px" width="80%" />
                <Skeleton height="14px" width="50%" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="bg-rose-50 border border-rose-200 text-rose-600 text-xs p-4 rounded-2xl text-center my-6">
            {error}
          </div>
        ) : items.length === 0 ? (
          <div
            className="text-center py-16 rounded-3xl border border-dashed p-6 my-4 space-y-3"
            style={{ backgroundColor: 'var(--ivory)', borderColor: 'var(--pink-cotton)' }}
          >
            <div className="text-4xl animate-bounce">👗</div>
            <h3 className="font-bold text-base" style={{ fontFamily: "'Playfair Display', serif", color: 'var(--pink-mauve)' }}>
              No occasion items found
            </h3>
            <p className="text-xs text-gray-500 max-w-xs mx-auto">
              Only authentic designer occasion pieces (value ≥ ₹3,000) are listed for rental on Looped.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {items.map(product => {
              return (
                <div
                  key={product._id || product.id}
                  onClick={() => navigate(`/product/${product._id || product.id}`)}
                  className="card cursor-pointer hover:shadow-md transition-all group overflow-hidden relative flex flex-col justify-between"
                  style={{
                    backgroundColor: 'var(--ivory)',
                    borderColor: 'var(--pink-cotton)',
                    borderRadius: '20px'
                  }}
                >
                  {/* Image Container */}
                  <div className="relative h-52 overflow-hidden" style={{ backgroundColor: 'var(--pink-blush)' }}>
                    <img
                      src={product.image}
                      alt={product.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />

                    {/* Occasion Badge */}
                    {product.occasion && (
                      <div className="absolute top-2 left-2 bg-pink-600/90 backdrop-blur-xs text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-xs flex items-center gap-1 z-10">
                        {product.occasion === 'Wedding' ? '💍' : product.occasion === 'Party' ? '🍸' : '👔'} {product.occasion}
                      </div>
                    )}

                    {/* Daily Rent Pill */}
                    <div className="absolute bottom-2 right-2 bg-black/80 backdrop-blur-xs text-white text-xs font-bold px-2.5 py-1 rounded-xl shadow-xs">
                      ₹{product.rentPricePerDay || 0}<span className="text-[10px] font-normal text-gray-300">/day</span>
                    </div>
                  </div>

                  {/* Info Details */}
                  <div className="p-3 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="font-extrabold uppercase text-pink-700 truncate max-w-[90px]">
                          {product.brand || 'Designer'}
                        </span>
                        {product.dryCleaningIncluded && (
                          <span className="text-[9px] text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded">
                            Cleaned ✓
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-bold leading-snug mb-2" style={{ fontFamily: "'Playfair Display', serif", color: 'var(--ink)' }}>
                        {truncate(product.title, 34)}
                      </p>
                    </div>

                    <div className="pt-2 border-t flex items-center justify-between text-[11px] text-gray-500" style={{ borderColor: 'var(--pink-cotton)' }}>
                      <span>Security Deposit:</span>
                      <strong className="text-gray-900 font-bold" style={{ fontFamily: "'Fredoka', sans-serif" }}>
                        {formatPrice(product.securityDeposit || 0)}
                      </strong>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
