import React, { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { X, AlertCircle, ShieldCheck } from 'lucide-react'
import { api } from '../api'
import type { Order } from '../types'

interface RefundModalProps {
  order: Order | null
  onClose: () => void
  onSuccess: () => void
}

export const RefundModal: React.FC<RefundModalProps> = (props) => {
  if (!props.order) return null
  return <RefundModalForm key={props.order.id} {...props} order={props.order} />
}

const RefundModalForm: React.FC<Omit<RefundModalProps, 'order'> & { order: Order }> = ({
  order,
  onClose,
  onSuccess,
}) => {
  const [reference, setReference] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reference.trim() || reference.trim().length < 5) {
      setError('Enter a valid refund reference (min 5 characters).')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      await api.ownerRefundConfirm(order.id, reference.trim())
      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Refund verification failed.')
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
          className="relative bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-[#E8E2D5] space-y-4 z-10"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black text-[#162B23]">
              Reconcile Refund
            </h3>
            <button
              onClick={onClose}
              className="p-2 text-[#73827C] hover:text-[#162B23] rounded-lg hover:bg-[#F2ECE1]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <p className="text-xs text-[#5C6E66]">
            Enter the Razorpay refund ID (e.g. <code>rfnd_...</code>) or your cash return receipt reference for order <strong>{order.token}</strong> (₹{(order.total / 100).toFixed(2)}).
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
                Refund Reference / Transaction ID
              </label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="e.g. rfnd_ABC12345 or CASH-RETURN-849"
                className="w-full font-mono text-sm px-3.5 py-2.5 rounded-xl border border-[#E2DBD0] focus:border-purple-600 outline-none"
                required
                minLength={5}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-bold text-[#556760] hover:bg-[#F0EBE1]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || reference.trim().length < 5}
                className="px-5 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold shadow-xs flex items-center gap-1.5"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Confirming...' : 'Mark Refunded'}</span>
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
