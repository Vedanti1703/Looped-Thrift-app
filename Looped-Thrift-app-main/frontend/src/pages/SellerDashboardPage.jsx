import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSellerOrders, markOrderShipped, markOrderDelivered, reviewReturnRequest, confirmReturnReceived, reportReturnProblem } from '../services/protectionService'
import Spinner from '../components/Spinner'

function fmtDate(dt) {
  if (!dt) return '—'
  return new Date(dt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}
function fmtPrice(n) { return '₹' + Number(n || 0).toLocaleString('en-IN') }

const STATUS_COLOR = {
  CONFIRMED: 'bg-emerald-50 text-emerald-700',
  SHIPPED: 'bg-blue-50 text-blue-700',
  DELIVERED: 'bg-indigo-50 text-indigo-700',
  COMPLETED: 'bg-emerald-100 text-emerald-800',
  RETURN_REQUESTED: 'bg-amber-50 text-amber-700',
  RETURN_APPROVED: 'bg-teal-50 text-teal-700',
  RETURN_SHIPPED: 'bg-purple-50 text-purple-700',
  RETURN_DELIVERED: 'bg-teal-100 text-teal-800',
  DISPUTED: 'bg-rose-50 text-rose-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
}

function ShipForm({ orderId, onDone }) {
  const [open, setOpen] = useState(false)
  const [carrier, setCarrier] = useState('')
  const [tracking, setTracking] = useState('')
  const [est, setEst] = useState('3-5 business days')
  const [loading, setLoading] = useState(false)
  async function submit() {
    if (!carrier.trim() || !tracking.trim()) { alert('Please fill in carrier and tracking.'); return }
    setLoading(true)
    try { await markOrderShipped(orderId, { carrier, trackingNumber: tracking, estimatedDelivery: est }); onDone() }
    catch (e) { alert(e?.response?.data?.message || 'Could not update.') }
    finally { setLoading(false) }
  }
  if (!open) return <button onClick={() => setOpen(true)} className="w-full py-2 bg-blue-500 text-white text-sm font-bold rounded-xl">📦 Mark as Shipped</button>
  return (
    <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 space-y-2">
      <p className="text-xs font-bold text-blue-800">Shipping Details</p>
      <input className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm bg-white" placeholder="Carrier (e.g. BlueDart)" value={carrier} onChange={e => setCarrier(e.target.value)} />
      <input className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm bg-white" placeholder="Tracking Number" value={tracking} onChange={e => setTracking(e.target.value)} />
      <input className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm bg-white" placeholder="Estimated Delivery" value={est} onChange={e => setEst(e.target.value)} />
      <button onClick={submit} disabled={loading} className="w-full py-2 bg-blue-600 text-white text-sm font-bold rounded-lg disabled:opacity-50">{loading ? 'Updating…' : 'Confirm Shipment'}</button>
    </div>
  )
}

function RejectForm({ orderId, onDone }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  async function submit() {
    if (!reason.trim()) { alert('Please provide a rejection reason.'); return }
    setLoading(true)
    try { await reviewReturnRequest(orderId, { action: 'REJECT', rejectionReason: reason }); onDone() }
    catch (e) { alert(e?.response?.data?.message || 'Could not reject.') }
    finally { setLoading(false) }
  }
  if (!open) return <button onClick={() => setOpen(true)} className="flex-1 py-2 bg-red-50 text-red-600 border border-red-200 text-sm font-bold rounded-xl">❌ Reject</button>
  return (
    <div className="bg-red-50 border border-red-100 rounded-xl p-3 space-y-2">
      <p className="text-xs font-bold text-red-700">Rejection Reason</p>
      <textarea className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm bg-white h-20 resize-none" placeholder="Explain why you are declining this return request…" value={reason} onChange={e => setReason(e.target.value)} />
      <button onClick={submit} disabled={loading} className="w-full py-2 bg-red-500 text-white text-sm font-bold rounded-lg disabled:opacity-50">{loading ? 'Rejecting…' : 'Confirm Rejection'}</button>
    </div>
  )
}

function ProblemForm({ orderId, onDone }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [desc, setDesc] = useState('')
  const [loading, setLoading] = useState(false)
  const PROBLEMS = ['Returned item is damaged', 'Wrong item returned', 'Missing item', 'Item condition different', 'Other']
  async function submit() {
    if (!reason || !desc.trim()) { alert('Please fill in all fields.'); return }
    setLoading(true)
    try { await reportReturnProblem(orderId, { problemReason: reason, problemDescription: desc }); onDone() }
    catch (e) { alert(e?.response?.data?.message || 'Could not submit.') }
    finally { setLoading(false) }
  }
  if (!open) return <button onClick={() => setOpen(true)} className="flex-1 py-2 bg-rose-50 text-rose-600 border border-rose-200 text-sm font-bold rounded-xl">⚠️ Report Problem</button>
  return (
    <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 space-y-2">
      <p className="text-xs font-bold text-rose-700">Report Return Problem</p>
      <select className="w-full border border-rose-200 rounded-lg px-3 py-2 text-sm bg-white" value={reason} onChange={e => setReason(e.target.value)}>
        <option value="">Select problem type…</option>
        {PROBLEMS.map(p => <option key={p} value={p}>{p}</option>)}
      </select>
      <textarea className="w-full border border-rose-200 rounded-lg px-3 py-2 text-sm bg-white h-20 resize-none" placeholder="Describe the problem in detail…" value={desc} onChange={e => setDesc(e.target.value)} />
      <button onClick={submit} disabled={loading} className="w-full py-2 bg-rose-500 text-white text-sm font-bold rounded-lg disabled:opacity-50">{loading ? 'Submitting…' : 'Escalate to Admin Dispute'}</button>
    </div>
  )
}

export default function SellerDashboardPage() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState(null)
  const [actionLoading, setActionLoading] = useState('')

  useEffect(() => { loadOrders() }, [])

  async function loadOrders() {
    setLoading(true); setError('')
    try { const data = await getSellerOrders(); setOrders(data.orders || []) }
    catch (e) { setError(e?.response?.data?.message || 'Could not load orders.') }
    finally { setLoading(false) }
  }

  async function handleApproveReturn(orderId) {
    if (!window.confirm('Approve return? Buyer will be instructed to ship item back.')) return
    setActionLoading(orderId + '_approve')
    try { await reviewReturnRequest(orderId, { action: 'APPROVE' }); await loadOrders() }
    catch (e) { alert(e?.response?.data?.message || 'Could not approve.') }
    finally { setActionLoading('') }
  }

  async function handleConfirmReturn(orderId) {
    if (!window.confirm('Confirm you received the return in acceptable condition? This will initiate a full refund to the buyer.')) return
    setActionLoading(orderId + '_confirm')
    try { await confirmReturnReceived(orderId); await loadOrders() }
    catch (e) { alert(e?.response?.data?.message || 'Could not confirm.') }
    finally { setActionLoading('') }
  }

  async function handleMarkDelivered(orderId) {
    setActionLoading(orderId + '_deliver')
    try { await markOrderDelivered(orderId); await loadOrders() }
    catch (e) { alert(e?.response?.data?.message || 'Could not update.') }
    finally { setActionLoading('') }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Spinner /></div>

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50/50 via-white to-pink-50/30 pb-24">
      <div className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-pink-100 px-4 py-3.5 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-pink-50 text-gray-600 text-lg">←</button>
        <div>
          <h1 className="text-[15px] font-bold text-gray-900">Seller Orders</h1>
          <p className="text-[10px] text-amber-500 font-semibold">🔒 Payouts protected until buyer confirms</p>
        </div>
        <div className="ml-auto">
          <span className="text-[10px] font-bold px-2 py-1 bg-amber-50 text-amber-700 rounded-full">{orders.length} orders</span>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-3">
        {error && <div className="bg-rose-50 text-rose-600 text-sm rounded-xl p-3 text-center">{error}</div>}
        {!error && orders.length === 0 && (
          <div className="text-center py-16 space-y-3">
            <div className="text-5xl">📦</div>
            <p className="text-gray-700 font-semibold">No orders yet</p>
            <p className="text-gray-400 text-sm">Orders for your listed items will appear here.</p>
          </div>
        )}
        {orders.map(order => {
          const isExp = expanded === order._id
          const orderId = order.orderId || order._id
          const statusClass = STATUS_COLOR[order.orderStatus] || 'bg-gray-100 text-gray-600'

          return (
            <div key={order._id} className="bg-white rounded-2xl border border-pink-100/80 shadow-sm overflow-hidden">
              <button className="w-full text-left px-4 py-3.5 flex items-start gap-3" onClick={() => setExpanded(isExp ? null : order._id)}>
                {order.items?.[0]?.image && <img src={order.items[0].image} alt="" className="w-14 h-14 rounded-xl object-cover flex-shrink-0 border border-pink-50" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[12px] font-bold text-gray-900 truncate">{order.items?.[0]?.title || order.productName || 'Order'}</p>
                    <span className="text-xs font-bold text-gray-800">{fmtPrice(order.totalAmount)}</span>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5">#{order.orderId} · Buyer: {order.buyerName || 'Buyer'} · {fmtDate(order.createdAt)}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className={"text-[10px] font-bold px-2 py-0.5 rounded-full " + statusClass}>{order.orderStatus}</span>
                    <span className={"text-[10px] font-bold px-2 py-0.5 rounded-full " + (order.payoutStatus === 'RELEASED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-50 text-amber-700')}>{order.payoutStatus === 'RELEASED' ? '💸 Payout Released' : '🔒 On Hold'}</span>
                  </div>
                </div>
                <span className="text-gray-300 text-xs mt-2">{isExp ? '▲' : '▼'}</span>
              </button>

              {isExp && (
                <div className="px-4 pb-4 space-y-3 border-t border-pink-50 pt-3">
                  {/* Summary */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-gray-50 rounded-xl p-2.5">
                      <p className="text-gray-400 text-[10px] font-bold uppercase mb-0.5">Payment</p>
                      <p className="font-bold text-gray-800">{order.paymentStatus}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-2.5">
                      <p className="text-gray-400 text-[10px] font-bold uppercase mb-0.5">Payout</p>
                      <p className={"font-bold " + (order.payoutStatus === 'RELEASED' ? 'text-emerald-600' : 'text-amber-600')}>{order.payoutStatus}</p>
                    </div>
                  </div>

                  {/* Buyer info */}
                  <div className="bg-blue-50 rounded-xl p-2.5 text-xs space-y-0.5">
                    <p className="font-bold text-blue-800">Buyer / Shipping To</p>
                    <p>{order.name} · {order.phone}</p>
                    <p className="text-gray-500">{order.address}{order.city ? ', ' + order.city : ''} {order.pincode}</p>
                  </div>

                  {/* Outbound tracking if shipped */}
                  {order.trackingNumber && (
                    <div className="bg-green-50 rounded-xl p-2.5 text-xs border border-green-100">
                      <p className="font-bold text-green-800">Shipped via {order.carrier}</p>
                      <p className="font-mono text-gray-600 mt-0.5">{order.trackingNumber}</p>
                    </div>
                  )}

                  {/* Return details if any */}
                  {order.returnStatus && order.returnStatus !== 'NONE' && (
                    <div className="bg-amber-50 rounded-xl p-3 text-xs space-y-1 border border-amber-100">
                      <p className="font-bold text-amber-800">Return Request</p>
                      <p><span className="text-gray-500">Reason: </span>{order.returnReason}</p>
                      {order.returnDescription && <p><span className="text-gray-500">Details: </span>{order.returnDescription}</p>}
                      {order.returnTrackingNumber && <p><span className="text-gray-500">Return Tracking: </span>{order.returnCarrier} — {order.returnTrackingNumber}</p>}
                    </div>
                  )}

                  {/* Seller Actions */}
                  <div className="space-y-2 pt-1">
                    {/* Confirmed → Ship */}
                    {(order.orderStatus === 'CONFIRMED' || order.orderStatus === 'PROCESSING') && (
                      <ShipForm orderId={orderId} onDone={loadOrders} />
                    )}

                    {/* Shipped → Mark Delivered */}
                    {order.orderStatus === 'SHIPPED' && (
                      <button onClick={() => handleMarkDelivered(orderId)} disabled={actionLoading === orderId + '_deliver'} className="w-full py-2 bg-indigo-500 text-white text-sm font-bold rounded-xl hover:bg-indigo-600 disabled:opacity-50">
                        {actionLoading === orderId + '_deliver' ? 'Updating…' : '🚚 Mark as Delivered'}
                      </button>
                    )}

                    {/* Return Requested → Approve or Reject */}
                    {order.orderStatus === 'RETURN_REQUESTED' && order.returnStatus === 'REQUESTED' && (
                      <div className="space-y-2">
                        <p className="text-xs font-bold text-amber-700 text-center">Buyer Requested a Return</p>
                        <div className="flex gap-2">
                          <button onClick={() => handleApproveReturn(orderId)} disabled={actionLoading === orderId + '_approve'} className="flex-1 py-2 bg-teal-500 text-white text-sm font-bold rounded-xl disabled:opacity-50">
                            {actionLoading === orderId + '_approve' ? '…' : '✅ Approve'}
                          </button>
                          <RejectForm orderId={orderId} onDone={loadOrders} />
                        </div>
                      </div>
                    )}

                    {/* Return Shipped/Delivered → Confirm or Dispute */}
                    {(order.orderStatus === 'RETURN_SHIPPED' || order.orderStatus === 'RETURN_DELIVERED' || order.returnStatus === 'SHIPPED' || order.returnStatus === 'DELIVERED') && (
                      <div className="space-y-2">
                        <p className="text-xs font-bold text-teal-700 text-center">Return Package Delivered — What would you like to do?</p>
                        <button onClick={() => handleConfirmReturn(orderId)} disabled={actionLoading === orderId + '_confirm'} className="w-full py-2 bg-teal-500 text-white text-sm font-bold rounded-xl disabled:opacity-50">
                          {actionLoading === orderId + '_confirm' ? '…' : '✅ Confirm Return & Refund Buyer'}
                        </button>
                        <ProblemForm orderId={orderId} onDone={loadOrders} />
                      </div>
                    )}

                    {/* Payout status */}
                    {order.payoutStatus === 'RELEASED' && (
                      <div className="text-center text-[11px] text-emerald-600 font-semibold bg-emerald-50 p-2 rounded-xl">💸 Your payout of {fmtPrice(order.totalAmount)} has been released.</div>
                    )}
                    {order.paymentStatus === 'REFUNDED' && (
                      <div className="text-center text-[11px] text-purple-600 font-semibold bg-purple-50 p-2 rounded-xl">💰 Buyer has been refunded for this order.</div>
                    )}
                    {order.orderStatus === 'DISPUTED' && (
                      <div className="text-center text-[11px] text-rose-600 font-semibold bg-rose-50 p-2.5 rounded-xl">⚠️ Dispute is being reviewed by Looped Admin.</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
