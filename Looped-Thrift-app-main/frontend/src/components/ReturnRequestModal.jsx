import { useState } from 'react'
import { requestReturn } from '../services/protectionService'

const REASONS = [
  'Item is damaged',
  'Item does not match the description',
  'Wrong item received',
  'Size/Fit issue',
  'Other',
]

export default function ReturnRequestModal({ orderId, onClose, onSuccess }) {
  const [reason, setReason] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!reason) { setError('Please select a return reason.'); return }
    if (!description.trim() || description.trim().length < 15) { setError('Please provide at least 15 characters of description.'); return }
    setLoading(true); setError('')
    try {
      await requestReturn(orderId, { returnReason: reason, returnDescription: description.trim() })
      onSuccess()
    } catch (e) {
      setError(e?.response?.data?.message || 'Could not submit return request. Please try again.')
    } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-5 pt-5 pb-3 flex items-center justify-between border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">🔄 Request Return</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">Your payment remains protected throughout the return process.</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 text-lg">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          {/* Return Reason */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-2">Return Reason *</label>
            <div className="space-y-2">
              {REASONS.map(r => (
                <label key={r} className={"flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all " + (reason === r ? 'border-rose-300 bg-rose-50' : 'border-gray-100 hover:border-rose-200')}>
                  <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="accent-rose-400" />
                  <span className="text-sm text-gray-700">{r}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">Detailed Description *</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe the issue in detail (minimum 15 characters)..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none h-24 focus:outline-none focus:ring-2 focus:ring-rose-300"
            />
            <p className="text-[10px] text-gray-400 mt-1 text-right">{description.length} characters</p>
          </div>

          {error && <p className="text-rose-500 text-xs bg-rose-50 p-2.5 rounded-xl">{error}</p>}

          <div className="bg-amber-50 rounded-xl p-3 text-[11px] text-amber-700 border border-amber-100">
            🔒 After submission, your seller payout protection will remain active while the return is reviewed.
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 bg-gray-100 text-gray-600 text-sm font-bold rounded-xl">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 bg-rose-400 text-white text-sm font-bold rounded-xl hover:bg-rose-500 disabled:opacity-50">
              {loading ? 'Submitting…' : 'Submit Return Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
