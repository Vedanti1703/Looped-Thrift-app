import React from 'react'

export default function ProtectionTimeline({ order }) {
  if (!order) return null

  const isPaid = order.paymentStatus === 'PAID' || order.paymentStatus === 'paid'
  const isShipped = ['SHIPPED', 'DELIVERED', 'COMPLETED', 'RETURN_REQUESTED', 'RETURN_APPROVED', 'RETURN_SHIPPED', 'RETURN_DELIVERED', 'DISPUTED'].includes(order.orderStatus)
  const isDelivered = ['DELIVERED', 'COMPLETED', 'RETURN_REQUESTED', 'RETURN_APPROVED', 'RETURN_SHIPPED', 'RETURN_DELIVERED', 'DISPUTED'].includes(order.orderStatus)
  const isCompleted = order.orderStatus === 'COMPLETED' || order.payoutStatus === 'RELEASED'
  const isReturnFlow = ['RETURN_REQUESTED', 'RETURN_APPROVED', 'RETURN_REJECTED', 'RETURN_SHIPPED', 'RETURN_DELIVERED', 'CONFIRMED'].includes(order.returnStatus) || order.orderStatus?.startsWith('RETURN_')
  const isDisputed = order.orderStatus === 'DISPUTED' || order.returnStatus === 'DISPUTED'
  const isRefunded = order.paymentStatus === 'REFUNDED' || order.paymentStatus === 'refunded'

  return (
    <div className="bg-pink-50/70 border border-pink-100/80 rounded-2xl p-3.5 space-y-3">
      {/* Protection Badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-bold text-gray-800">
          <span>🔒</span>
          <span>Looped Buyer Protection</span>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
          order.payoutStatus === 'RELEASED'
            ? 'bg-emerald-100 text-emerald-700'
            : isRefunded
            ? 'bg-purple-100 text-purple-700'
            : isDisputed
            ? 'bg-rose-100 text-rose-700'
            : 'bg-amber-100 text-amber-800'
        }`}>
          {order.payoutStatus === 'RELEASED'
            ? '💸 Payout Released'
            : isRefunded
            ? '💰 Refunded'
            : isDisputed
            ? '⚠️ Under Dispute'
            : '🔒 Payout On Hold'}
        </span>
      </div>

      <p className="text-[11px] text-gray-500 leading-snug">
        {order.payoutStatus === 'RELEASED'
          ? 'Transaction completed successfully. Seller payout has been released.'
          : isRefunded
          ? 'Full refund processed back to buyer. Seller payout was not released.'
          : isDisputed
          ? 'Dispute is currently under review by Looped Admin.'
          : isReturnFlow
          ? 'Return is in progress. Seller payout remains protected on hold.'
          : 'Seller payout is held securely until you receive and verify the item.'}
      </p>

      {/* Visual Stepper */}
      <div className="relative flex items-center justify-between pt-1">
        {/* Step 1: Paid */}
        <div className="flex flex-col items-center z-10">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
            isPaid ? 'bg-emerald-500 text-white shadow-xs' : 'bg-gray-200 text-gray-500'
          }`}>
            ✓
          </div>
          <span className="text-[10px] font-semibold text-gray-700 mt-1">Paid</span>
        </div>

        {/* Step 2: Shipped */}
        <div className="flex flex-col items-center z-10">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
            isShipped ? 'bg-emerald-500 text-white shadow-xs' : 'bg-gray-200 text-gray-500'
          }`}>
            {isShipped ? '✓' : '2'}
          </div>
          <span className="text-[10px] font-semibold text-gray-700 mt-1">Shipped</span>
        </div>

        {/* Step 3: Delivered */}
        <div className="flex flex-col items-center z-10">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
            isDelivered ? 'bg-emerald-500 text-white shadow-xs' : 'bg-gray-200 text-gray-500'
          }`}>
            {isDelivered ? '✓' : '3'}
          </div>
          <span className="text-[10px] font-semibold text-gray-700 mt-1">Delivered</span>
        </div>

        {/* Step 4: Verification / Completed / Return */}
        <div className="flex flex-col items-center z-10">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
            isCompleted
              ? 'bg-emerald-500 text-white shadow-xs'
              : isRefunded
              ? 'bg-purple-500 text-white shadow-xs'
              : isDisputed
              ? 'bg-rose-500 text-white shadow-xs'
              : isReturnFlow
              ? 'bg-amber-500 text-white shadow-xs'
              : 'bg-gray-200 text-gray-500'
          }`}>
            {isCompleted ? '✓' : isRefunded ? '↩' : isDisputed ? '!' : isReturnFlow ? '🔄' : '4'}
          </div>
          <span className="text-[10px] font-semibold text-gray-700 mt-1">
            {isCompleted ? 'Completed' : isRefunded ? 'Refunded' : isDisputed ? 'Dispute' : isReturnFlow ? 'Return' : 'Verified'}
          </span>
        </div>

        {/* Connecting Line Background */}
        <div className="absolute top-4 left-3 right-3 h-0.5 bg-gray-200 -z-0" />
      </div>

      {/* Shipment info if present */}
      {order.trackingNumber && (
        <div className="bg-white rounded-xl p-2.5 border border-pink-100 flex items-center justify-between text-xs">
          <div>
            <span className="text-gray-400 text-[10px] uppercase font-bold tracking-wider block">Tracking ({order.carrier || 'Courier'})</span>
            <span className="font-mono font-bold text-gray-800 text-[11px]">{order.trackingNumber}</span>
          </div>
          <span className="text-[10px] bg-pink-50 text-pink-700 font-semibold px-2 py-0.5 rounded-full">
            {order.orderStatus}
          </span>
        </div>
      )}
    </div>
  )
}
