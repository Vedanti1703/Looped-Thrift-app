export default function Skeleton({ height = '16px', width = '100%', className = '' }) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{ height, width }}
    />
  )
}

export function ProductCardSkeleton() {
  return (
    <div className="card overflow-hidden">
      <div className="skeleton h-52 w-full" />
      <div className="p-3 space-y-2">
        <div className="skeleton h-4 w-3/4" />
        <div className="skeleton h-4 w-1/3" />
        <div className="skeleton h-3 w-1/2" />
      </div>
    </div>
  )
}

export function GridSkeleton({ count = 4 }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  )
}
