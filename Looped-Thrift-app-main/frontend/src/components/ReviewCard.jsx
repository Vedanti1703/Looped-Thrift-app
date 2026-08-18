import StarRating from './StarRating'
import { formatRelativeTime } from '../utils/helpers'

export default function ReviewCard({ review, onDelete, canDelete = false }) {
  if (!review) return null

  const reviewerName = review.user?.name || review.userName || review.user?.email || 'Anonymous Reviewer'
  const initial = reviewerName[0]?.toUpperCase() || 'U'
  const createdAt = review.createdAt || review.date

  return (
    <div className="bg-white rounded-2xl border border-pink-100 p-4 shadow-sm space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-rose-400 text-white font-bold text-xs flex items-center justify-center shadow-xs">
            {initial}
          </div>
          <div>
            <p className="text-xs font-bold text-gray-900 leading-tight">{reviewerName}</p>
            <p className="text-[10px] text-gray-400">{formatRelativeTime(createdAt) || 'Recently'}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <StarRating rating={review.rating || 5} size="sm" />
          {canDelete && onDelete && (
            <button
              onClick={() => onDelete(review._id)}
              className="text-gray-400 hover:text-red-500 transition-colors p-1 text-xs"
              title="Delete review"
            >
              🗑️
            </button>
          )}
        </div>
      </div>

      {review.comment && (
        <p className="text-xs text-gray-600 leading-relaxed pl-1 pt-1">
          {review.comment}
        </p>
      )}
    </div>
  )
}
