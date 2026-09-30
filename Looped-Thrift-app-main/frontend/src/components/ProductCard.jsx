import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import SaveToCollectionModal from './SaveToCollectionModal'
import CarbonSavingsBadge from './CarbonSavingsBadge'
import { formatPrice, conditionColor, tagColor, truncate } from '../utils/helpers'

export default function ProductCard({ product, size = 'md' }) {
  const navigate = useNavigate()
  const [showSaveModal, setShowSaveModal] = useState(false)

  if (!product) return null

  const isSmall = size === 'sm'

  const handleOpenSaveModal = (e) => {
    e.stopPropagation()
    setShowSaveModal(true)
  }

  return (
    <>
      <div
        onClick={() => navigate(`/product/${product._id}`)}
        className="card cursor-pointer hover:shadow-md transition-shadow duration-200 flex-shrink-0 relative group"
        style={{ width: isSmall ? '160px' : '100%' }}
      >
        {/* Image */}
        <div className={`relative overflow-hidden bg-pink-50 ${isSmall ? 'h-40' : 'h-52'}`}>
          <img
            src={product.image}
            alt={product.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={e => { e.target.src = `https://picsum.photos/seed/${product._id || 'x'}/400/500` }}
          />
          {/* Discount badge */}
          {product.originalPrice && (
            <div className="absolute top-2 left-2 bg-pink-500 text-white text-xs font-bold px-2 py-0.5 rounded-full z-10">
              {Math.round((1 - product.price / product.originalPrice) * 100)}% off
            </div>
          )}

          {/* Bookmark / Save to Collection affordance */}
          <button
            onClick={handleOpenSaveModal}
            className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full bg-white/80 backdrop-blur-xs text-gray-600 hover:text-pink-500 hover:bg-white flex items-center justify-center shadow-xs transition-all"
            title="Save to collection"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
            </svg>
          </button>
        </div>

        {/* Info */}
        <div className="p-3.5">
          <p className="text-sm font-semibold leading-snug mb-1.5 line-clamp-2" style={{ color: 'var(--ink)', fontFamily: "'Quicksand', sans-serif" }}>
            {truncate(product.title, isSmall ? 22 : 45)}
          </p>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="font-bold text-sm" style={{ color: 'var(--pink-deep)', fontFamily: "'Fredoka', sans-serif" }}>{formatPrice(product.price)}</span>
            {product.originalPrice && (
              <span className="text-xs line-through" style={{ color: '#a08590' }}>{formatPrice(product.originalPrice)}</span>
            )}
          </div>
          {/* Condition badge & Carbon badge */}
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <span className={`tag-badge ${conditionColor[product.condition] || 'bg-pink-100 text-pink-700'}`}>
              {product.condition}
            </span>
            <CarbonSavingsBadge category={product.category} condition={product.condition} />
          </div>
          {/* Top tags */}
          {!isSmall && product.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {product.tags.slice(0, 3).map(tag => (
                <span key={tag} className={`tag-badge ${tagColor(tag)}`}>#{tag}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Save to collection modal */}
      <SaveToCollectionModal
        productId={product._id}
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
      />
    </>
  )
}
