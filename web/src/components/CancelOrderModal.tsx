import React, { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { X, AlertCircle, XCircle } from 'lucide-react'
import { api } from '../api'
import type { Order } from '../types'

interface CancelOrderModalProps {
  order: Order | null
  onClose: () => void
  onSuccess: () => void
}

export const CancelOrderModal: React.FC<CancelOrderModalProps> = (props) => {
  if (!props.order) return null
  return <CancelOrderModalForm key={props.order.id} {...props} order={props.order} />
}

const CancelOrderModalForm: React.FC<Omit<CancelOrderModalProps, 'order'> & { order: Order }> = ({
  order,
  onClose,
  onSuccess,
}) => {
  const [reason, setReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (reason.trim().length < 3) {
      setError('Please provide a reason of at least 3 characters.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      await api.requestCancellation(order.id, reason.trim())
      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to submit cancellation request.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/40 backdrop-blur-xs"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-[#E8E2D5] space-y-4 z-10"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black text-[#162B23]">
              Cancel Order {order.token}
            </h3>
            <button
              onClick={onClose}
              className="p-2 text-[#73827C] hover:text-[#162B23] rounded-lg hover:bg-[#F2ECE1]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <p className="text-xs text-[#5C6E66] leading-relaxed">
            Cancellation requests are submitted to the canteen owner before kitchen preparation begins. Approved cancellations restore meal portions to inventory immediately.
          </p>

          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-[#3B4D45] block mb-1">
                Reason for cancellation
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Class schedule changed, ordered duplicate item by mistake..."
                rows={3}
                className="w-full p-3 rounded-xl border border-[#E2DBD0] text-xs sm:text-sm outline-none focus:border-red-500"
                required
                minLength={3}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-bold text-[#556760] hover:bg-[#F0EBE1]"
              >
                Keep Order
              </button>
              <button
                type="submit"
                disabled={isSubmitting || reason.trim().length < 3}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs flex items-center gap-1.5"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Submitting...' : 'Submit Request'}</span>
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
