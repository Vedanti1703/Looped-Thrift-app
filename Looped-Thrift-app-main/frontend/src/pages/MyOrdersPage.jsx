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
