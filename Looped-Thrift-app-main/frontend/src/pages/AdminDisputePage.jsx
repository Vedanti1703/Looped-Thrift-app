import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAdminDisputes, resolveDispute } from '../services/protectionService'
import Spinner from '../components/Spinner'

function fmtDate(dt) {
  if (!dt) return '—'
  return new Date(dt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function fmtPrice(n) { return '₹' + Number(n || 0).toLocaleString('en-IN') }

export default function AdminDisputePage() {
  const navigate = useNavigate()
  const [disputes, setDisputes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState(null)
  const [resolveState, setResolveState] = useState({})

  useEffect(() => { loadDisputes() }, [])

  async function loadDisputes() {
    setLoading(true); setError('')
    try { const data = await getAdminDisputes(); setDisputes(data.disputes || []) }
    catch (e) {
      const msg = e?.response?.data?.message || 'Could not load disputes.'
      const code = e?.response?.status
      setError(code === 403 ? 'Access denied: Admin privileges required.' : msg)
    }
    finally { setLoading(false) }
  }

  async function handleResolve(disputeId, decision) {
    const notes = resolveState[disputeId]?.notes || ''
    if (!notes.trim() || notes.trim().length < 10) { alert('Please provide resolution notes (at least 10 characters).'); return }
    if (!window.confirm('Confirm resolution decision: ' + decision + '?')) return
    try {
      await resolveDispute(disputeId, { decision, resolutionNotes: notes })
      await loadDisputes()
    } catch (e) { alert(e?.response?.data?.message || 'Could not resolve dispute.') }
  }

  function setNotes(id, notes) { setResolveState(prev => ({ ...prev, [id]: { ...prev[id], notes } })) }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Spinner /></div>

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50/50 via-white to-pink-50/30 pb-24">
      <div className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-pink-100 px-4 py-3.5 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-pink-50 text-gray-600 text-lg">←</button>
        <div>
          <h1 className="text-[15px] font-bold text-gray-900">⚖️ Dispute Management</h1>
          <p className="text-[10px] text-rose-500 font-semibold">Admin Only · Looped Marketplace</p>
        </div>
        <span className="ml-auto text-[10px] font-bold px-2 py-1 bg-rose-50 text-rose-600 rounded-full">{disputes.length} open</span>
      </div>

      <div className="px-4 pt-4 space-y-3">
        {error && <div className="bg-rose-50 text-rose-600 text-sm rounded-xl p-4 text-center font-semibold">{error}</div>}
        {!error && disputes.length === 0 && (
          <div className="text-center py-16 space-y-3">
            <div className="text-5xl">⚖️</div>
            <p className="text-gray-700 font-semibold">No active disputes</p>
            <p className="text-gray-400 text-sm">All disputes have been resolved.</p>
          </div>
        )}
        {disputes.map(d => {
          const isExp = expanded === d._id
          const disputeId = d.orderId || d._id
          return (
            <div key={d._id} className="bg-white rounded-2xl border border-rose-100/80 shadow-sm overflow-hidden">
              <button className="w-full text-left px-4 py-3.5 flex items-start gap-3" onClick={() => setExpanded(isExp ? null : d._id)}>
                {d.items?.[0]?.image && <img src={d.items[0].image} alt="" className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-[12px] font-bold text-gray-900 truncate">{d.items?.[0]?.title || d.productName || 'Order'}</p>
                    <span className="text-xs font-bold">{fmtPrice(d.totalAmount)}</span>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5">#{d.orderId}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600">⚠️ {d.orderStatus}</span>
                    <span className="text-[10px] text-gray-400">{fmtDate(d.disputeOpenedAt)}</span>
                  </div>
                </div>
                <span className="text-gray-300 text-xs mt-2">{isExp ? '▲' : '▼'}</span>
              </button>

              {isExp && (
                <div className="px-4 pb-4 space-y-3 border-t border-rose-50 pt-3">
                  {/* Parties */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-blue-50 rounded-xl p-2.5 text-xs">
                      <p className="text-[10px] font-bold text-blue-700 uppercase mb-1">Buyer</p>
                      <p className="font-semibold">{d.buyerId?.name || d.buyerName || '—'}</p>
                      <p className="text-gray-500">{d.buyerId?.email || d.buyerEmail || '—'}</p>
                    </div>
                    <div className="bg-amber-50 rounded-xl p-2.5 text-xs">
                      <p className="text-[10px] font-bold text-amber-700 uppercase mb-1">Seller</p>
                      <p className="font-semibold">{d.sellerId?.name || d.sellerName || '—'}</p>
                      <p className="text-gray-500">{d.sellerId?.email || '—'}</p>
                    </div>
                  </div>

                  {/* Order details */}
                  <div className="bg-gray-50 rounded-xl p-2.5 text-xs space-y-1">
                    <p className="font-bold text-gray-800">Order Details</p>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                      <p><span className="text-gray-400">Amount: </span>{fmtPrice(d.totalAmount)}</p>
                      <p><span className="text-gray-400">Paid: </span>{fmtDate(d.paidAt)}</p>
                      <p><span className="text-gray-400">Payment: </span>{d.paymentStatus}</p>
                      <p><span className="text-gray-400">Payout: </span>{d.payoutStatus}</p>
                      {d.trackingNumber && <p><span className="text-gray-400">Shipped: </span>{d.carrier} {d.trackingNumber}</p>}
                      {d.returnTrackingNumber && <p><span className="text-gray-400">Return: </span>{d.returnCarrier} {d.returnTrackingNumber}</p>}
                    </div>
                  </div>

                  {/* Buyer evidence */}
                  {d.returnReason && (
                    <div className="bg-blue-50 rounded-xl p-2.5 text-xs border border-blue-100">
                      <p className="font-bold text-blue-800 mb-1">Buyer — Return Reason</p>
                      <p>{d.returnReason}</p>
                      {d.returnDescription && <p className="text-gray-600 mt-0.5">{d.returnDescription}</p>}
                    </div>
                  )}

                  {/* Seller evidence */}
                  {d.returnProblemReason && (
                    <div className="bg-amber-50 rounded-xl p-2.5 text-xs border border-amber-100">
                      <p className="font-bold text-amber-800 mb-1">Seller — Return Problem</p>
                      <p>{d.returnProblemReason}</p>
                      {d.returnProblemDescription && <p className="text-gray-600 mt-0.5">{d.returnProblemDescription}</p>}
                    </div>
                  )}

                  {/* Admin Resolution Form */}
                  {d.disputeResolution ? (
                    <div className="bg-emerald-50 rounded-xl p-2.5 text-xs border border-emerald-100">
                      <p className="font-bold text-emerald-700">Resolved: {d.disputeResolution}</p>
                      <p className="text-gray-600 mt-0.5">{d.disputeResolutionNotes}</p>
                    </div>
                  ) : (
                    <div className="bg-rose-50 rounded-xl p-3 space-y-2 border border-rose-100">
                      <p className="text-xs font-bold text-rose-800">Admin Resolution</p>
                      <textarea
                        className="w-full border border-rose-200 rounded-lg px-3 py-2 text-sm bg-white h-20 resize-none"
                        placeholder="Provide detailed resolution notes justifying your decision…"
                        value={resolveState[d._id]?.notes || ''}
                        onChange={e => setNotes(d._id, e.target.value)}
                      />
                      <div className="flex gap-2">
                        <button onClick={() => handleResolve(disputeId, 'REFUND_BUYER')} className="flex-1 py-2 bg-purple-500 text-white text-xs font-bold rounded-xl hover:bg-purple-600">
                          💰 Refund Buyer
                        </button>
                        <button onClick={() => handleResolve(disputeId, 'RELEASE_PAYOUT')} className="flex-1 py-2 bg-emerald-500 text-white text-xs font-bold rounded-xl hover:bg-emerald-600">
                          💸 Release Payout
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
