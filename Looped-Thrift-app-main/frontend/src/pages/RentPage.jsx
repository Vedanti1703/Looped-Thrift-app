import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getRentableFeed } from '../services/rentalService'
import ProductCard from '../components/ProductCard'
import Skeleton from '../components/Skeleton'
import { formatPrice, conditionColor, truncate } from '../utils/helpers'

export default function RentPage() {
  const navigate = useNavigate()
  const [items, setItems]     = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    fetchFeed()
  }, [])

  const fetchFeed = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getRentableFeed()
      setItems(Array.isArray(data) ? data : data?.products || [])
    } catch (err) {
      setError('Could not load rentable items. Please pull down to refresh.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-pink-50 pb-28">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-pink-100 px-4 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">👗</span>
          <div>
            <h1 className="font-bold text-gray-900 text-base leading-none">Rent Fashion</h1>
            <p className="text-[10px] text-pink-500 font-semibold mt-0.5">AI-Valuated Daily Rentals</p>
          </div>
        </div>
        <button
          onClick={fetchFeed}
          className="text-xs text-gray-400 hover:text-pink-500 font-medium transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Main Content */}
      <div className="px-4 pt-4">
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="card p-3 space-y-2">
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
          <div className="text-center py-20 bg-white rounded-3xl border border-pink-100 p-6 my-4 shadow-2xs">
            <div className="text-5xl mb-3">👗</div>
            <h3 className="font-bold text-gray-800 text-base mb-1">No items available for rent yet</h3>
            <p className="text-xs text-gray-500 mb-5 max-w-xs mx-auto">
              Be the first to list your closet items for daily rental and earn extra income!
            </p>
            <button
              onClick={() => navigate('/upload')}
              className="btn-primary max-w-xs mx-auto text-xs py-2.5"
            >
              List an Item for Rent
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {items.map(product => {
              const isFairPrice = product.rentPriceMatchScore > 0.85

              return (
                <div
                  key={product._id || product.id}
                  onClick={() => navigate(`/product/${product._id || product.id}`)}
                  className="card cursor-pointer hover:shadow-md transition-all group overflow-hidden relative flex flex-col justify-between"
                >
                  {/* Image Container */}
                  <div className="relative h-48 bg-pink-50 overflow-hidden">
                    <img
                      src={product.image}
                      alt={product.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={e => { e.target.src = `https://picsum.photos/seed/${product._id}/400/500` }}
                    />

                    {/* AI Fair Price Badge */}
                    {isFairPrice && (
                      <div className="absolute top-2 left-2 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs flex items-center gap-1 z-10">
                        <span>⚡</span> Fair Price
                      </div>
                    )}

                    {/* Daily Rent Overlay Pill */}
                    <div className="absolute bottom-2 right-2 bg-black/75 backdrop-blur-xs text-white text-xs font-bold px-2.5 py-1 rounded-xl shadow-xs">
                      ₹{product.rentPricePerDay || 0}<span className="text-[10px] font-normal text-gray-300">/day</span>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-3 flex-1 flex flex-col justify-between">
                    <div>
                      <p className="text-xs font-bold text-gray-900 leading-snug mb-1">
                        {truncate(product.title, 32)}
                      </p>
                      <div className="flex items-center gap-1.5 flex-wrap text-[11px] mb-2">
                        <span className={`tag-badge ${conditionColor[product.condition] || 'bg-gray-100 text-gray-600'}`}>
                          {product.condition}
                        </span>
                        {product.brand && (
                          <span className="text-gray-400 font-medium truncate max-w-[80px]">{product.brand}</span>
                        )}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-pink-50 flex items-center justify-between text-[11px] text-gray-500">
                      <span>Deposit:</span>
                      <strong className="text-gray-800 font-semibold">{formatPrice(product.securityDeposit || 0)}</strong>
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
