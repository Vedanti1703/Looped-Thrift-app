// Format price in INR
export const formatPrice = (price) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(price)

// Condition color map adhering to Coquette Style Guide:
// Condition "Like New": background var(--blue-sky), color #2d5a7b
// Condition "New with tags": background #DCEEDC, color var(--green-forest)
// Condition "Good": background var(--pink-blush), color var(--pink-mauve)
// Condition "Fair": background var(--paper), color #8a6a3d
// Condition "Well Loved": background var(--pink-cotton), color var(--pink-deep)
export const conditionColor = {
  'New with tags': 'condition-nwt',
  'Like New':      'condition-like-new',
  'Good':          'condition-good',
  'Fair':          'condition-fair',
  'Well Loved':    'condition-well-loved',
}

// Tag color — chips use var(--pink-blush), color var(--pink-deep), Fredoka font
export const tagColor = () => 'bg-[var(--pink-blush)] text-[var(--pink-deep)] font-fredoka'

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
