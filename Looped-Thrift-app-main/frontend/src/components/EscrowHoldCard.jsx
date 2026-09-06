import { useState } from 'react'
import { formatPrice } from '../utils/helpers'

const STATUS_META = {
  PENDING: {
    label: 'Escrow Hold: Pending Shipment',
    desc: 'Refund is held in escrow. Waiting for customer to ship return parcel.',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    badge: 'bg-amber-100 text-amber-800',
    icon: '⏳'
  },
  IN_TRANSIT: {
    label: 'Escrow Hold: Return In Transit',
    desc: 'Parcel is on its way to the seller. Refund remains securely locked in escrow.',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-700',
    badge: 'bg-blue-100 text-blue-800',
    icon: '🚚'
  },
  DELIVERED_PENDING_CONFIRMATION: {
    label: 'Escrow Hold: Delivered to Seller',
    desc: 'Courier delivered parcel. Awaiting seller physical inspection & confirmation.',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    text: 'text-purple-700',
    badge: 'bg-purple-100 text-purple-800',
    icon: '📦'
  },
  RELEASED: {
    label: 'Escrow Hold: Released & Refunded',
    desc: 'Seller confirmed receipt. Refund disbursed to customer & settled from seller balance.',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-700',
    badge: 'bg-emerald-100 text-emerald-800',
    icon: '💰'
  },
  DISPUTED: {
    label: 'Escrow Hold: Condition Disputed',
    desc: 'Seller reported condition issue. Hold is locked for Looped Admin arbitration.',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    text: 'text-rose-700',
    badge: 'bg-rose-100 text-rose-800',
    icon: '⚠️'
  },
  EXPIRED: {
    label: 'Escrow Hold: Expired',
    desc: 'Customer did not ship parcel within deadline. Hold cancelled & seller payout released.',
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    text: 'text-gray-700',
    badge: 'bg-gray-100 text-gray-800',
    icon: '⏱️'
  },
  CANCELLED: {
    label: 'Escrow Hold: Cancelled',
    desc: 'Return request was cancelled. No refund issued.',
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    text: 'text-gray-700',
    badge: 'bg-gray-100 text-gray-800',
    icon: '🚫'
  }
}

function formatDate(dt) {
  if (!dt) return '—'
  return new Date(dt).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export default function EscrowHoldCard({ hold }) {
  const [showHistory, setShowHistory] = useState(false)

  if (!hold) return null

  const meta = STATUS_META[hold.status] || STATUS_META.PENDING

  return (
    <div className={`rounded-2xl border p-4 ${meta.bg} ${meta.border} shadow-xs space-y-3`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xl flex-shrink-0">{meta.icon}</span>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-gray-900 text-xs">{meta.label}</h4>
              <span className={`text-[10px] font-bold px-2 py-0.2 rounded-full ${meta.badge}`}>
                {hold.status}
              </span>
            </div>
            <p className="text-[11px] text-gray-600 mt-0.5 leading-snug">{meta.desc}</p>
          </div>
        </div>
      </div>

      {/* Escrow Financials Summary */}
      <div className="bg-white/80 backdrop-blur-xs rounded-xl p-3 border border-white/60 grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Amount in Escrow</p>
          <p className="font-extrabold text-gray-900 text-sm">{formatPrice(hold.amount)}</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Disbursed Refund</p>
          <p className={`font-extrabold text-sm ${hold.refundedAmount > 0 ? 'text-emerald-600' : 'text-gray-400'}`}>
            {hold.refundedAmount > 0 ? formatPrice(hold.refundedAmount) : 'Pending Confirmation'}
          </p>
        </div>

        {hold.returnTrackingNumber && (
          <div className="col-span-2 pt-1 border-t border-gray-100 flex items-center justify-between text-[11px]">
            <span className="text-gray-500">Return Courier:</span>
            <span className="font-mono font-bold text-gray-800">
              {hold.returnCarrier} — {hold.returnTrackingNumber}
            </span>
          </div>
        )}

        {hold.expiresAt && hold.status === 'PENDING' && (
          <div className="col-span-2 pt-1 border-t border-gray-100 flex items-center justify-between text-[11px] text-amber-800">
            <span>Shipping Deadline:</span>
            <span className="font-semibold">{formatDate(hold.expiresAt)}</span>
          </div>
        )}
      </div>

      {/* Audit Trail Toggle */}
      {hold.transitions && hold.transitions.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            className="text-[11px] font-bold text-gray-600 hover:text-gray-900 flex items-center gap-1 transition-colors"
          >
            <span>📜 Transition Audit Trail ({hold.transitions.length})</span>
            <span className="text-[9px]">{showHistory ? '▲' : '▼'}</span>
          </button>

          {showHistory && (
            <div className="mt-2 space-y-2 bg-white/90 rounded-xl p-3 border border-gray-100 max-h-48 overflow-y-auto">
              {hold.transitions.map((t, idx) => (
                <div key={idx} className="text-[11px] border-b border-gray-50 pb-1.5 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-800">
                      {t.fromStatus} → {t.toStatus}
                    </span>
                    <span className="text-[10px] text-gray-400">{formatDate(t.timestamp)}</span>
                  </div>
                  <p className="text-gray-600 mt-0.5">{t.reason}</p>
                  <span className="text-[9px] text-gray-400 uppercase">By {t.actorRole}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
