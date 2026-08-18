// Format price in INR
export const formatPrice = (price) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(price)

// Condition color map
export const conditionColor = {
  'New with tags': 'bg-green-100 text-green-700',
  'Like New':      'bg-blue-100 text-blue-700',
  'Good':          'bg-yellow-100 text-yellow-700',
  'Fair':          'bg-orange-100 text-orange-700',
  'Well Loved':    'bg-red-100 text-red-700',
}

// Tag color — cycles through a palette
const TAG_COLORS = [
  'bg-pink-100 text-pink-700',
  'bg-purple-100 text-purple-700',
  'bg-indigo-100 text-indigo-700',
  'bg-rose-100 text-rose-700',
  'bg-fuchsia-100 text-fuchsia-700',
]
export const tagColor = (tag) => TAG_COLORS[tag.charCodeAt(0) % TAG_COLORS.length]

// Truncate text
export const truncate = (str, n = 40) => str.length > n ? str.slice(0, n) + '…' : str

// Relative date formatter
export const formatRelativeTime = (dateStr) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return ''
  const now = new Date()
  const diffInSecs = Math.floor((now - date) / 1000)
  if (diffInSecs < 60) return 'Just now'
  const diffInMins = Math.floor(diffInSecs / 60)
  if (diffInMins < 60) return `${diffInMins}m ago`
  const diffInHours = Math.floor(diffInMins / 60)
  if (diffInHours < 24) return `${diffInHours}h ago`
  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays < 30) return `${diffInDays}d ago`
  const diffInMonths = Math.floor(diffInDays / 30)
  if (diffInMonths < 12) return `${diffInMonths}mo ago`
  const diffInYears = Math.floor(diffInDays / 365)
  return `${diffInYears}y ago`
}

