import { useNavigate } from 'react'
import { formatPrice, truncate } from '../utils/helpers'

export default function ChatProductCard({ product }) {
  const navigate = useNavigate()

  if (!product || !product._id) return null

  return (
    <div
      onClick={() => navigate(`/product/${product._id}`)}
      className="flex-shrink-0 w-36 bg-white rounded-2xl overflow-hidden border border-rose-100/80 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer group select-none"
    >
      {/* Image container with price badge */}
      <div className="relative h-32 bg-rose-50/50 overflow-hidden">
        <img
          src={product.image}
          alt={product.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          onError={(e) => {
            e.target.src = `https://picsum.photos/seed/${product._id}/300/400`
          }}
        />
        {/* Condition tag badge */}
        {product.condition && (
          <span className="absolute top-1.5 left-1.5 bg-black/60 backdrop-blur-xs text-white text-[9px] font-semibold px-2 py-0.5 rounded-full">
            {product.condition}
          </span>
        )}
        {/* Price tag badge */}
        <div className="absolute bottom-1.5 right-1.5 bg-rose-500 text-white font-bold text-xs px-2 py-0.5 rounded-full shadow-xs">
          {formatPrice(product.price)}
        </div>
      </div>

      {/* Details */}
      <div className="p-2.5">
        <p className="text-xs font-semibold text-gray-800 leading-tight line-clamp-1 group-hover:text-rose-600 transition-colors">
          {product.title}
        </p>
        <div className="flex items-center justify-between mt-1 text-[10px] text-gray-400">
          <span>{product.brand || product.category || 'Thrift'}</span>
          {product.size && <span className="font-medium text-gray-600">Size {product.size}</span>}
        </div>
      </div>
    </div>
  )
}
