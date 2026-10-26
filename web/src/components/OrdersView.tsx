import React, { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import {
  Clock,
  AlertCircle,
  Copy,
  Check,
  RefreshCw,
  Edit3,
  XCircle,
  PlusCircle,
} from 'lucide-react'
import { api } from '../api'

import { useAuth } from '../context/AuthContext'
import type { Order, OrderStatus } from '../types'

interface OrdersViewProps {
  onOrderExtras: () => void
  onEditOrder: (order: Order) => void
  onRequestCancel: (order: Order) => void
  openAuthModal: () => void
}

const STATUS_STEPS: OrderStatus[] = ['placed', 'preparing', 'ready', 'collected']

export const OrdersView: React.FC<OrdersViewProps> = ({
  onOrderExtras,
  onEditOrder,
  onRequestCancel,
  openAuthModal,
}) => {
  const { user } = useAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [filter, setFilter] = useState<'active' | 'history'>('active')
  const [copiedToken, setCopiedToken] = useState<string | null>(null)

  const loadOrders = async (silent = false) => {
    if (!user) return
    if (!silent) setIsRefreshing(true)
    try {
      const data = await api.fetchOrders()
      setOrders(data)
    } catch (err) {
      console.error('Failed to load orders:', err)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    if (user) {
      loadOrders()
      // Auto refresh every 8 seconds for real-time tracking
      const interval = setInterval(() => {
        loadOrders(true)
      }, 8000)
      return () => clearInterval(interval)
    } else {
      setIsLoading(false)
    }
  }, [user])

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedToken(text)
    setTimeout(() => setCopiedToken(null), 2000)
  }

  const formatSlotTime = (isoString?: string) => {
    if (!isoString) return ''
    try {
      return new Date(isoString).toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      })
    } catch {
      return isoString
    }
  }

  const formatSlotDate = (isoString?: string) => {
    if (!isoString) return ''
    try {
      return new Date(isoString).toLocaleDateString('en-IN', {
        timeZone: 'Asia/Kolkata',
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
    } catch {
      return ''
    }
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto py-16 px-4 text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-[#EBF3F0] text-[#1B5747] flex items-center justify-center">
          <Clock className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-black text-[#162B23]">Sign In to View Your Orders</h2>
        <p className="text-xs sm:text-sm text-[#5B6D66]">
          View your active tokens, track kitchen preparation, and manage pickup times.
        </p>
        <button
          onClick={openAuthModal}
          className="px-6 py-3 rounded-xl bg-[#1B5747] hover:bg-[#144236] text-white font-bold text-sm shadow-xs transition-colors"
        >
          Sign In Now
        </button>
      </div>
    )
  }

  const activeOrders = orders.filter((o) =>
    ['placed', 'preparing', 'ready'].includes(o.status)
  )
  const pastOrders = orders.filter((o) =>
    ['collected', 'cancelled'].includes(o.status)
  )

  const displayedOrders = filter === 'active' ? activeOrders : pastOrders

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Top Header & Tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-[#E8E2D5]">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#162B23] tracking-tight">
            My Orders & Tokens
          </h1>
          <p className="text-xs sm:text-sm text-[#5C6E66] mt-0.5">
            Real-time tracking for college canteen counter pickup
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => loadOrders()}
            disabled={isRefreshing}
            className="p-2 rounded-xl bg-white border border-[#E2DBD0] text-[#4A5D55] hover:text-[#1B5747] transition-colors"
            title="Refresh orders"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#1B5747]' : ''}`} />
          </button>

          {/* Active vs History Filter */}
          <div className="flex items-center bg-[#F0EBE1] p-1 rounded-xl">
            <button
              onClick={() => setFilter('active')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filter === 'active' ? 'bg-[#1B5747] text-white shadow-xs' : 'text-[#4A5D55]'
              }`}
            >
              Active ({activeOrders.length})
            </button>
            <button
              onClick={() => setFilter('history')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filter === 'history' ? 'bg-[#1B5747] text-white shadow-xs' : 'text-[#4A5D55]'
              }`}
            >
              History ({pastOrders.length})
            </button>
          </div>
        </div>
      </div>

      {/* Orders List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="p-6 rounded-3xl bg-white border border-[#E8E2D5] animate-pulse space-y-4"
            >
              <div className="h-6 bg-gray-200 rounded w-1/3" />
              <div className="h-20 bg-gray-100 rounded-xl" />
            </div>
          ))}
        </div>
      ) : displayedOrders.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-[#E8E2D5] p-6 space-y-3">
          <div className="w-16 h-16 mx-auto rounded-full bg-[#EBF3F0] text-[#1B5747] flex items-center justify-center">
            <Clock className="w-8 h-8 opacity-60" />
          </div>
          <h3 className="font-extrabold text-[#1B5747] text-lg">
            {filter === 'active' ? 'No active orders in progress' : 'No past order history'}
          </h3>
          <p className="text-xs sm:text-sm text-[#6A7B74] max-w-sm mx-auto">
            {filter === 'active'
              ? 'When you order meals or drinks, your pickup tokens and real-time status will appear here.'
              : 'Completed and cancelled orders will be archived here for your records.'}
          </p>
          <button
            onClick={onOrderExtras}
            className="mt-2 px-6 py-2.5 rounded-xl bg-[#1B5747] hover:bg-[#144236] text-white font-bold text-xs sm:text-sm shadow-xs transition-colors"
          >
            Browse Today's Menu
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {displayedOrders.map((order) => {
            const isPlaced = order.status === 'placed'
            const isPreparing = order.status === 'preparing'
            const isReady = order.status === 'ready'
            const isCollected = order.status === 'collected'
            const isCancelled = order.status === 'cancelled'

            const currentStepIdx = STATUS_STEPS.indexOf(order.status)
            const canEdit = isPlaced && order.payment_status === 'due' && !order.cancel_requested
            const canCancel = isPlaced && !order.cancel_requested
            const isLocked = isPreparing || isReady || order.payment_status === 'paid'

            return (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="bg-white rounded-3xl border border-[#E8E2D5] shadow-xs overflow-hidden"
              >
                {/* Order Top Banner */}
                <div className="p-4 sm:p-6 border-b border-[#F0EBE1] bg-[#FAF8F3] flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-black text-xl sm:text-2xl text-[#1B5747] tracking-tight">
                      {order.token}
                    </span>
                    <button
                      onClick={() => copyText(order.token)}
                      className="p-1.5 rounded-lg bg-white border border-[#E2DBD0] text-[#556760] hover:text-[#1B5747] transition-colors"
                      title="Copy token"
                    >
                      {copiedToken === order.token ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Status Badge */}
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wide ${
                        isReady
                          ? 'bg-emerald-100 text-emerald-800 animate-pulse'
                          : isPreparing
                          ? 'bg-amber-100 text-amber-900'
                          : isCancelled
                          ? 'bg-red-100 text-red-800'
                          : isCollected
                          ? 'bg-gray-100 text-gray-700'
                          : 'bg-[#EBF3F0] text-[#1B5747]'
                      }`}
                    >
                      {order.status}
                    </span>

                    {/* Payment Badge */}
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold capitalize ${
                        order.payment_status === 'paid'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : order.payment_status === 'refund_due'
                          ? 'bg-purple-50 text-purple-800 border border-purple-200'
                          : order.payment_status === 'refunded'
                          ? 'bg-gray-50 text-gray-700 border border-gray-200'
                          : 'bg-amber-50 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {order.payment_status === 'refund_due'
                        ? 'Refund Due'
                        : `${order.payment_status} (${order.payment_mode})`}
                    </span>
                  </div>
                </div>

                {/* Progress Stepper (for non-cancelled orders) */}
                {!isCancelled && (
                  <div className="px-5 py-4 border-b border-[#F0EBE1] bg-white">
                    <div className="max-w-md mx-auto relative flex items-center justify-between text-xs font-bold">
                      {STATUS_STEPS.map((step, idx) => {
                        const isDone = currentStepIdx >= idx
                        const isCurrent = currentStepIdx === idx
                        return (
                          <div key={step} className="flex flex-col items-center z-10">
                            <span
                              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                                isCurrent
                                  ? 'bg-[#1B5747] text-white ring-4 ring-[#1B5747]/15'
                                  : isDone
                                  ? 'bg-[#1B5747] text-white'
                                  : 'bg-[#F0EBE1] text-[#7A8A84]'
                              }`}
                            >
                              {isDone ? '✓' : idx + 1}
                            </span>
                            <span
                              className={`mt-1.5 capitalize text-[11px] ${
                                isCurrent
                                  ? 'text-[#1B5747] font-black'
                                  : isDone
                                  ? 'text-[#2C3E36]'
                                  : 'text-[#8A9A94]'
                              }`}
                            >
                              {step}
                            </span>
                          </div>
                        )
                      })}

                      {/* Line background */}
                      <div className="absolute top-3.5 left-5 right-5 h-0.5 bg-[#E8E2D5] z-0" />
                    </div>
                  </div>
                )}

                {/* Body Details */}
                <div className="p-5 sm:p-6 space-y-4">
                  {/* Collection code and pickup window card */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-2xl bg-[#FBF9F4] border border-[#E8E2D5]">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#63736D] block">
                        Collection Code (Show at counter)
                      </span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-2xl font-black font-mono text-[#E07A5F] tracking-wider">
                          {order.pickup_code}
                        </span>
                        <button
                          onClick={() => copyText(order.pickup_code)}
                          className="p-1 rounded text-[#73827C] hover:text-[#1B5747]"
                          title="Copy pickup code"
                        >
                          {copiedToken === order.pickup_code ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                      <span className="text-[10px] text-[#70807A] block mt-1">
                        Do not reveal until you reach the pickup counter.
                      </span>
                    </div>

                    {order.slot && (
                      <div className="p-3.5 rounded-2xl bg-[#FBF9F4] border border-[#E8E2D5] flex flex-col justify-between">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#63736D] block">
                            Pickup Window (IST)
                          </span>
                          <span className="font-extrabold text-sm text-[#1B5747] block mt-0.5">
                            {formatSlotDate(order.slot.starts)}
                          </span>
                          <span className="text-xs font-mono font-bold text-[#3E4F47]">
                            {formatSlotTime(order.slot.starts)} – {formatSlotTime(order.slot.ends)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Items List */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#63736D] block">
                      Order Summary
                    </span>
                    <div className="divide-y divide-[#F0EBE1] border border-[#F0EBE1] rounded-2xl p-2 sm:p-3 bg-white">
                      {order.items.map((item) => (
                        <div
                          key={item.menu_id}
                          className="py-2 flex items-center justify-between text-xs sm:text-sm"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-[#1B5747]">
                              {item.quantity}×
                            </span>
                            <span className="font-semibold text-[#1A2621]">{item.name}</span>
                          </div>
                          <span className="font-mono font-bold text-[#1A2621]">
                            ₹{((item.price * item.quantity) / 100).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-1 px-1">
                      <span className="text-xs font-bold text-[#556760]">Grand Total</span>
                      <span className="text-lg font-black font-mono text-[#1B5747]">
                        ₹{(order.total / 100).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Cancellation Alert / Note */}
                  {order.cancel_requested === 1 && (
                    <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="block">Cancellation Pending Owner Approval</strong>
                        <span>Reason: "{order.cancel_reason}"</span>
                      </div>
                    </div>
                  )}

                  {isCancelled && (
                    <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2">
                      <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="block">This order was cancelled</strong>
                        <span>Stock portions have been returned to inventory.</span>
                        {order.refund_reference && (
                          <span className="block mt-1 font-mono">
                            Refund Ref: {order.refund_reference}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Locked order add-on banner */}
                  {isLocked && !isCancelled && !isCollected && (
                    <div className="p-3.5 rounded-2xl bg-[#FAF6EC] border border-[#E5DFD4] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-[#52635D]">
                      <div>
                        <strong className="text-[#32453D] block">
                          ⚡ Kitchen is preparing this order
                        </strong>
                        <span>
                          Items cannot be modified after preparation starts. Need extra snacks or tea?
                        </span>
                      </div>
                      <button
                        onClick={onOrderExtras}
                        className="px-3.5 py-1.5 rounded-xl bg-[#1B5747] hover:bg-[#144236] text-white font-bold text-xs shrink-0 flex items-center gap-1.5 transition-colors"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>Order Extras</span>
                      </button>
                    </div>
                  )}

                  {/* Actions for placed unpaid order */}
                  <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-[#F0EBE1]">
                    {canEdit && (
                      <button
                        onClick={() => onEditOrder(order)}
                        className="px-4 py-2 rounded-xl bg-white border border-[#1B5747] text-[#1B5747] hover:bg-[#EBF3F0] font-bold text-xs flex items-center gap-1.5 transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit Items</span>
                      </button>
                    )}

                    {canCancel && (
                      <button
                        onClick={() => onRequestCancel(order)}
                        className="px-4 py-2 rounded-xl bg-white border border-red-300 text-red-700 hover:bg-red-50 font-bold text-xs flex items-center gap-1.5 transition-colors"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Request Cancellation</span>
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
