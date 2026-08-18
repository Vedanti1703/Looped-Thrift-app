import { useState } from 'react'

export default function StarRating({
  rating = 0,
  max = 5,
  interactive = false,
  onChange,
  size = 'md'
}) {
  const [hoverRating, setHoverRating] = useState(0)

  const sizeClasses = {
    sm: 'w-3.5 h-3.5',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  }

  const iconSize = sizeClasses[size] || sizeClasses.md

  const currentRating = interactive && hoverRating > 0 ? hoverRating : rating

  return (
    <div className="flex items-center gap-0.5" role={interactive ? 'radiogroup' : 'img'}>
      {Array.from({ length: max }).map((_, index) => {
        const starValue = index + 1
        const fillAmount = Math.max(0, Math.min(1, currentRating - index))

        return (
          <button
            key={index}
            type={interactive ? 'button' : undefined}
            disabled={!interactive}
            onClick={() => interactive && onChange && onChange(starValue)}
            onMouseEnter={() => interactive && setHoverRating(starValue)}
            onMouseLeave={() => interactive && setHoverRating(0)}
            className={`${interactive ? 'cursor-pointer p-0.5 hover:scale-110 transition-transform' : 'cursor-default'} focus:outline-none`}
            title={interactive ? `${starValue} star${starValue > 1 ? 's' : ''}` : `${rating} out of 5 stars`}
          >
            <div className="relative">
              {/* Empty background star */}
              <svg
                className={`${iconSize} text-gray-300`}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              {/* Filled star foreground */}
              {fillAmount > 0 && (
                <div
                  className="absolute top-0 left-0 overflow-hidden"
                  style={{ width: `${fillAmount * 100}%` }}
                >
                  <svg
                    className={`${iconSize} text-amber-400`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                </div>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}
