export default function RentalStatusBadge({ status }) {
  const configs = {
    rented: {
      label: 'Active Rental',
      bg: 'bg-blue-100 text-blue-700 border-blue-200',
      icon: '⏳',
    },
    return_pending: {
      label: 'Return Pending',
      bg: 'bg-amber-100 text-amber-800 border-amber-200',
      icon: '📦',
    },
    returned: {
      label: 'Returned',
      bg: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      icon: '✓',
    },
    disputed: {
      label: 'Disputed',
      bg: 'bg-rose-100 text-rose-700 border-rose-200',
      icon: '⚠️',
    },
    cancelled: {
      label: 'Cancelled',
      bg: 'bg-gray-100 text-gray-600 border-gray-200',
      icon: '✕',
    },
  }

  const config = configs[status] || {
    label: status || 'Unknown',
    bg: 'bg-gray-100 text-gray-700 border-gray-200',
    icon: '•',
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${config.bg}`}>
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </span>
  )
}
