const fs = require('fs');
const path = require('path');

const frontend = path.resolve(__dirname, '../../frontend/src');

// ── MyOrdersPage.jsx ─────────────────────────────────────────────────────────
const myOrdersPage = `
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getBuyerOrders, confirmReceiptOk, submitReturnTracking } from '../services/protectionService'
import ReturnRequestModal from '../components/ReturnRequestModal'
import ProtectionTimeline from '../components/ProtectionTimeline'
import Spinner from '../components/Spinner'

const STATUS_META = {
  CONFIRMED:        { icon: '✅', label: 'Order Confirmed',  color: 'text-emerald-600', bg: 'bg-emerald-50' },
  PROCESSING:       { icon: '⏳', label: 'Processing',        color: 'text-amber-600',   bg: 'bg-amber-50' },
  SHIPPED:          { icon: '📦', label: 'Shipped',           color: 'text-blue-600',    bg: 'bg-blue-50' },
  DELIVERED:        { icon: '🚚', label: 'Delivered',         color: 'text-indigo-600',  bg: 'bg-indigo-50' },
  COMPLETED:        { icon: '💚', label: 'Completed',         color: 'text-emerald-700', bg: 'bg-emerald-50' },
  RETURN_REQUESTED: { icon: '🔄', label: 'Return Requested',  color: 'text-amber-700',   bg: 'bg-amber-50' },
  RETURN_APPROVED:  { icon: '✅', label: 'Return Approved',   color: 'text-teal-600',    bg: 'bg-teal-50' },
  RETURN_REJECTED:  { icon: '❌', label: 'Return Declined',   color: 'text-red-600',     bg: 'bg-red-50' },
  RETURN_SHIPPED:   { icon: '📮', label: 'Return Shipped',    color: 'text-purple-600',  bg: 'bg-purple-50' },
  RETURN_DELIVERED: { icon: '📦', label: 'Return Delivered',  color: 'text-teal-700',    bg: 'bg-teal-50' },
  DISPUTED:         { icon: '⚠️', label: 'Under Dispute',     color: 'text-rose-600',    bg: 'bg-rose-50' },
  CANCELLED:        { icon: '🚫', label: 'Cancelled',         color: 'text-gray-500',    bg: 'bg-gray-100' },
}

function fmtDate(dt) {
  if (!dt) return '—'
  return new Date(dt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}
function fmtPrice(n) { return '₹' + Number(n || 0).toLocaleString('en-IN') }

function ReturnTrackingForm({ orderId, onDone }) {
  const [open, setOpen] = useState(false)
  const [carrier, setCarrier] = useState('')
  const [tracking, setTracking] = useState('')
  const [loading, setLoading] = useState(false)
  async function handleSubmit() {
    if (!carrier.trim() || !tracking.trim()) { alert('Please fill both fields.'); return }
    setLoading(true)
    try { await submitReturnTracking(orderId, { returnCarrier: carrier, returnTrackingNumber: tracking }); onDone() }
    catch (e) { alert(e?.response?.data?.message || 'Could not submit.') }
    finally { setLoading(false) }
  }
  if (!open) return <button onClick={() => setOpen(true)} className="w-full py-2.5 bg-teal-50 text-teal-700 border border-teal-200 text-sm font-bold rounded-xl">📮 Submit Return Shipment</button>
  return (
    <div className="bg-teal-50 border border-teal-100 rounded-xl p-3 space-y-2">
      <p className="text-xs font-bold text-teal-800">Return Shipment Details</p>
      <input className="w-full border border-teal-200 rounded-lg px-3 py-2 text-sm bg-white" placeholder="Carrier (e.g. India Post)" value={carrier} onChange={e => setCarrier(e.target.value)} />
      <input className="w-full border border-teal-200 rounded-lg px-3 py-2 text-sm bg-white" placeholder="Tracking Number" value={tracking} onChange={e => setTracking(e.target.value)} />
      <button onClick={handleSubmit} disabled={loading} className="w-full py-2 bg-teal-500 text-white text-sm font-bold rounded-lg disabled:opacity-50">{loading ? 'Submitting…' : 'Submit Tracking'}</button>
    </div>
  )
}

export default function MyOrdersPage() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState(null)
  const [actionLoading, setActionLoading] = useState('')
  const [returnTarget, setReturnTarget] = useState(null)

  useEffect(() => { loadOrders() }, [])

  async function loadOrders() {
    setLoading(true); setError('')
    try { const data = await getBuyerOrders(); setOrders(data.orders || []) }
    catch (e) { setError(e?.response?.data?.message || 'Could not load orders.') }
    finally { setLoading(false) }
  }

  async function handleConfirmOk(orderId) {
    if (!window.confirm('Confirm everything is OK? This completes the order and releases the seller payout.')) return
    setActionLoading(orderId + '_ok')
    try { await confirmReceiptOk(orderId); await loadOrders() }
    catch (e) { alert(e?.response?.data?.message || 'Could not confirm receipt.') }
    finally { setActionLoading('') }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Spinner /></div>

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50/60 via-white to-rose-50/40 pb-24">
      <div className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-pink-100 px-4 py-3.5 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-pink-50 text-gray-600 text-lg">←</button>
        <div>
          <h1 className="text-[15px] font-bold text-gray-900">My Orders</h1>
          <p className="text-[10px] text-pink-500 font-semibold">🔒 Protected by Looped Buyer Protection</p>
        </div>
      </div>
      <div className="px-4 pt-4 space-y-3">
        {error && <div className="bg-rose-50 text-rose-600 text-sm rounded-xl p-3 text-center">{error}</div>}
        {!error && orders.length === 0 && (
          <div className="text-center py-16 space-y-3">
            <div className="text-5xl">🛍️</div>
            <p className="text-gray-700 font-semibold">No orders yet</p>
            <button onClick={() => navigate('/')} className="mt-2 px-6 py-2 bg-rose-400 text-white text-sm font-bold rounded-full">Start Shopping</button>
          </div>
        )}
        {orders.map(order => {
          const meta = STATUS_META[order.orderStatus] || STATUS_META['CONFIRMED']
          const isExp = expanded === order._id
          const showConfirmOk = order.orderStatus === 'DELIVERED' && order.returnStatus === 'NONE'
          const showReturnBtn = order.orderStatus === 'DELIVERED' && order.isReturnWindowOpen && order.returnStatus === 'NONE'
          const orderId = order.orderId || order._id
          return (
            <div key={order._id} className="bg-white rounded-2xl border border-pink-100/80 shadow-sm overflow-hidden">
              <button className="w-full text-left px-4 py-3.5 flex items-start gap-3" onClick={() => setExpanded(isExp ? null : order._id)}>
                {order.items?.[0]?.image && <img src={order.items[0].image} alt="" className="w-14 h-14 rounded-xl object-cover flex-shrink-0 border border-pink-50" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[12px] font-bold text-gray-900 truncate">{order.items?.length > 1 ? order.items[0].title + ' + ' + (order.items.length - 1) + ' more' : order.items?.[0]?.title || order.productName || 'Order'}</p>
                    <span className="text-xs font-bold text-gray-800">{fmtPrice(order.totalAmount)}</span>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5">#{order.orderId} · {fmtDate(order.createdAt)}</p>
                  <div className={"inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold " + meta.bg + " " + meta.color}>
                    <span>{meta.icon}</span><span>{meta.label}</span>
                  </div>
                </div>
                <span className="text-gray-300 text-xs mt-2">{isExp ? '▲' : '▼'}</span>
              </button>
              {isExp && (
                <div className="px-4 pb-4 space-y-3 border-t border-pink-50 pt-3">
                  <ProtectionTimeline order={order} />
                  <div className="space-y-2">
                    <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Items</p>
                    {order.items?.map((item, i) => (
                      <div key={i} className="flex items-center gap-2.5">
                        {item.image && <img src={item.image} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-800 truncate">{item.title}</p>
                          <p className="text-[10px] text-gray-400">{item.condition} · Size {item.size || '—'}</p>
                        </div>
                        <span className="text-xs font-bold">{fmtPrice(item.price)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="bg-gray-50 rounded-xl p-2.5 text-xs text-gray-600 space-y-0.5">
                    <p className="font-bold text-gray-800">Delivery Address</p>
                    <p>{order.name} · {order.phone}</p>
                    <p>{order.address}{order.city ? ', ' + order.city : ''}{order.state ? ', ' + order.state : ''} {order.pincode}</p>
                  </div>
                  {order.returnStatus && order.returnStatus !== 'NONE' && (
                    <div className="bg-amber-50 rounded-xl p-3 text-xs space-y-1 border border-amber-100">
                      <p className="font-bold text-amber-800">Return Details</p>
                      <p><span className="text-gray-500">Reason: </span>{order.returnReason}</p>
                      {order.returnDescription && <p><span className="text-gray-500">Description: </span>{order.returnDescription}</p>}
                      {order.returnTrackingNumber && <p><span className="text-gray-500">Return Tracking: </span>{order.returnCarrier} — {order.returnTrackingNumber}</p>}
                      {order.returnRejectionReason && <p className="text-red-600"><span className="font-bold">Seller note: </span>{order.returnRejectionReason}</p>}
                    </div>
                  )}
                  <div className="space-y-2">
                    {showConfirmOk && (
                      <button onClick={() => handleConfirmOk(orderId)} disabled={actionLoading === orderId + '_ok'} className="w-full py-2.5 bg-emerald-500 text-white text-sm font-bold rounded-xl hover:bg-emerald-600 active:scale-[0.98] transition-all disabled:opacity-50">
                        {actionLoading === orderId + '_ok' ? 'Processing…' : '✅ Everything is OK — Complete Order'}
                      </button>
                    )}
                    {showReturnBtn && (
                      <button onClick={() => setReturnTarget(orderId)} className="w-full py-2.5 bg-amber-50 text-amber-700 border border-amber-200 text-sm font-bold rounded-xl hover:bg-amber-100 active:scale-[0.98] transition-all">
                        🔄 Request Return
                      </button>
                    )}
                    {order.returnStatus === 'APPROVED' && <ReturnTrackingForm orderId={orderId} onDone={loadOrders} />}
                    {order.orderStatus === 'COMPLETED' && <div className="text-center text-[11px] text-emerald-600 font-semibold bg-emerald-50 p-2 rounded-xl">💚 Transaction Completed · Seller Payout Released</div>}
                    {(order.paymentStatus === 'REFUNDED' || order.paymentStatus === 'refunded') && <div className="text-center text-[11px] text-purple-600 font-semibold bg-purple-50 p-2.5 rounded-xl">💰 Full Refund Processed · Check your payment method in 3-7 days.</div>}
                    {order.orderStatus === 'DISPUTED' && <div className="text-center text-[11px] text-rose-600 font-semibold bg-rose-50 p-2.5 rounded-xl">⚠️ Dispute under Looped Admin review. We will notify you of the resolution.</div>}
                  </div>
                  {order.isReturnWindowOpen && order.daysRemaining > 0 && (
                    <p className="text-[10px] text-center text-gray-400">Return window closes in <span className="font-bold text-amber-500">{order.daysRemaining} day{order.daysRemaining !== 1 ? 's' : ''}</span></p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
      {returnTarget && <ReturnRequestModal orderId={returnTarget} onClose={() => setReturnTarget(null)} onSuccess={() => { setReturnTarget(null); loadOrders() }} />}
    </div>
  )
}
`.trimStart();

// ── ReturnRequestModal.jsx ────────────────────────────────────────────────────
const returnRequestModal = `
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
`.trimStart();

// ── SellerDashboardPage.jsx ───────────────────────────────────────────────────
const sellerDashboard = `
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
`.trimStart();

// ── AdminDisputePage.jsx ──────────────────────────────────────────────────────
const adminDisputePage = `
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
`.trimStart();

fs.writeFileSync(path.join(frontend, 'pages', 'MyOrdersPage.jsx'), myOrdersPage, 'utf8');
fs.writeFileSync(path.join(frontend, 'components', 'ReturnRequestModal.jsx'), returnRequestModal, 'utf8');
fs.writeFileSync(path.join(frontend, 'pages', 'SellerDashboardPage.jsx'), sellerDashboard, 'utf8');
fs.writeFileSync(path.join(frontend, 'pages', 'AdminDisputePage.jsx'), adminDisputePage, 'utf8');

console.log('✅ All 4 frontend files written successfully');
console.log('  - MyOrdersPage.jsx:', fs.statSync(path.join(frontend, 'pages', 'MyOrdersPage.jsx')).size, 'bytes');
console.log('  - ReturnRequestModal.jsx:', fs.statSync(path.join(frontend, 'components', 'ReturnRequestModal.jsx')).size, 'bytes');
console.log('  - SellerDashboardPage.jsx:', fs.statSync(path.join(frontend, 'pages', 'SellerDashboardPage.jsx')).size, 'bytes');
console.log('  - AdminDisputePage.jsx:', fs.statSync(path.join(frontend, 'pages', 'AdminDisputePage.jsx')).size, 'bytes');
