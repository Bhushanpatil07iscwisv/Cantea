import React, { useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import confetti from 'canvas-confetti'
import { CheckCircle2, Clock, ArrowRight, Copy, Check } from 'lucide-react'
import type { Order } from '../types'


interface OrderConfirmedModalProps {
  order: Order | null
  onClose: () => void
  onViewOrders: () => void
}

export const OrderConfirmedModal: React.FC<OrderConfirmedModalProps> = ({
  order,
  onClose,
  onViewOrders,
}) => {
  const [copied, setCopied] = React.useState(false)

  useEffect(() => {
    if (order) {
      // Fire confetti burst
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#1B5747', '#E07A5F', '#D97706', '#10B981'],
        })
      } catch {
        // Confetti optional
      }
    }
  }, [order])

  if (!order) return null

  const copyToken = () => {
    navigator.clipboard.writeText(order.token)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/50 backdrop-blur-xs"
        />

        {/* Modal Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="relative bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-[#E2DBD0] text-center space-y-5 z-10"
        >
          {/* Success Check Icon */}
          <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-800 mx-auto flex items-center justify-center shadow-xs">
            <CheckCircle2 className="w-9 h-9" />
          </div>

          <div>
            <h2 className="text-2xl font-black text-[#162B23]">Order Placed!</h2>
            <p className="text-xs sm:text-sm text-[#5B6D66] mt-1">
              Your meal is scheduled for counter pickup without waiting in line.
            </p>
          </div>

          {/* Prominent Token Display */}
          <div className="p-4 rounded-2xl bg-[#1B5747] text-white shadow-md relative overflow-hidden text-left space-y-3">
            <div className="flex items-center justify-between border-b border-white/15 pb-2.5">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-white/70 block">
                  Pickup Token
                </span>
                <span className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-white">
                  {order.token}
                </span>
              </div>
              <button
                onClick={copyToken}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                title="Copy Token"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex items-center justify-between pt-1">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/70 block">
                  Secret Collection Code
                </span>
                <span className="text-lg font-black font-mono text-[#E07A5F] bg-white/10 px-2 py-0.5 rounded inline-block mt-0.5">
                  {order.pickup_code}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/70 block">
                  Payment
                </span>
                <span className="text-xs font-black capitalize text-emerald-300">
                  {order.payment_mode === 'cash' ? 'Pay at Counter' : 'Online'} (
                  {order.payment_status})
                </span>
              </div>
            </div>
          </div>

          {/* Pickup Window Info */}
          {order.slot && (
            <div className="p-3.5 rounded-xl bg-[#FAF6EC] border border-[#E8DFC8] flex items-center justify-between text-xs text-left">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#1B5747] shrink-0" />
                <div>
                  <span className="font-bold text-[#2A3C34] block">
                    {formatSlotDate(order.slot.starts)}
                  </span>
                  <span className="text-[11px] text-[#63746D]">
                    {formatSlotTime(order.slot.starts)} – {formatSlotTime(order.slot.ends)} IST
                  </span>
                </div>
              </div>
              <span className="font-mono font-bold text-sm text-[#1B5747]">
                ₹{(order.total / 100).toFixed(2)}
              </span>
            </div>
          )}

          {/* Stepper overview */}
          <div className="py-2">
            <div className="flex items-center justify-between text-[11px] font-bold text-[#556760] relative">
              <div className="flex flex-col items-center z-10">
                <span className="w-6 h-6 rounded-full bg-[#1B5747] text-white flex items-center justify-center text-xs">
                  ✓
                </span>
                <span className="mt-1 text-[#1B5747]">Placed</span>
              </div>
              <div className="flex flex-col items-center z-10">
                <span className="w-6 h-6 rounded-full bg-[#E5DFD4] text-[#70807A] flex items-center justify-center text-xs">
                  2
                </span>
                <span className="mt-1">Preparing</span>
              </div>
              <div className="flex flex-col items-center z-10">
                <span className="w-6 h-6 rounded-full bg-[#E5DFD4] text-[#70807A] flex items-center justify-center text-xs">
                  3
                </span>
                <span className="mt-1">Ready</span>
              </div>
              <div className="flex flex-col items-center z-10">
                <span className="w-6 h-6 rounded-full bg-[#E5DFD4] text-[#70807A] flex items-center justify-center text-xs">
                  4
                </span>
                <span className="mt-1">Collected</span>
              </div>

              {/* Connecting line */}
              <div className="absolute top-3 left-4 right-4 h-0.5 bg-[#E5DFD4] z-0" />
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <button
              onClick={() => {
                onClose()
                onViewOrders()
              }}
              className="w-full py-3 rounded-xl bg-[#1B5747] hover:bg-[#144236] text-white font-bold text-sm shadow-xs flex items-center justify-center gap-2 transition-all"
            >
              <span>Track in My Orders</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl text-xs font-semibold text-[#5B6D66] hover:bg-[#F3EFE6] transition-colors"
            >
              Order More Items
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
