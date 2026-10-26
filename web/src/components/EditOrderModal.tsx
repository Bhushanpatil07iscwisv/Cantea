import React, { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { X, Plus, Minus, AlertCircle, Save } from 'lucide-react'
import { api } from '../api'
import type { Order } from '../types'

interface EditOrderModalProps {
  order: Order | null
  onClose: () => void
  onSuccess: () => void
}

export const EditOrderModal: React.FC<EditOrderModalProps> = (props) => {
  if (!props.order) return null
  return <EditOrderModalForm key={props.order.id} {...props} order={props.order} />
}

const EditOrderModalForm: React.FC<Omit<EditOrderModalProps, 'order'> & { order: Order }> = ({
  order,
  onClose,
  onSuccess,
}) => {
  const [items, setItems] = useState<{ menu_id: string; name: string; price: number; quantity: number }[]>(
    () => order.items.map((i) => ({ ...i }))
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const updateQuantity = (menuId: string, quantity: number) => {
    if (quantity <= 0) {
      setItems((prev) => prev.filter((i) => i.menu_id !== menuId))
    } else {
      setItems((prev) =>
        prev.map((i) => (i.menu_id === menuId ? { ...i, quantity } : i))
      )
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (items.length === 0) {
      setError('An order must contain at least 1 item.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      await api.editOrderItems(
        order.id,
        items.map((i) => ({ menu_id: i.menu_id, quantity: i.quantity }))
      )
      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to update order items.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const totalPaise = items.reduce((sum, i) => sum + i.price * i.quantity, 0)

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
          className="relative bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-[#E8E2D5] space-y-5 z-10"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-black text-[#162B23]">
                Edit Order {order.token}
              </h3>
              <p className="text-xs text-[#5C6E66]">
                Adjust quantities before the kitchen begins preparation.
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-[#73827C] hover:text-[#162B23] rounded-lg hover:bg-[#F2ECE1]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
            {items.map((item) => (
              <div
                key={item.menu_id}
                className="p-3 rounded-xl bg-[#FAF8F3] border border-[#EFEAE0] flex items-center justify-between"
              >
                <div>
                  <h4 className="text-sm font-bold text-[#162B23]">{item.name}</h4>
                  <span className="text-xs text-[#1B5747] font-mono font-bold">
                    ₹{(item.price / 100).toFixed(2)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 bg-white border border-[#E2DBD0] rounded-lg p-0.5">
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.menu_id, item.quantity - 1)}
                      className="w-6 h-6 rounded flex items-center justify-center text-[#2C3E36] hover:bg-gray-100"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-5 text-center text-xs font-black font-mono">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.menu_id, item.quantity + 1)}
                      className="w-6 h-6 rounded flex items-center justify-center text-[#2C3E36] hover:bg-gray-100"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <span className="w-14 text-right text-xs font-black font-mono">
                    ₹{((item.price * item.quantity) / 100).toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-[#F0EBE1] flex items-center justify-between text-sm font-bold">
            <span className="text-[#556760]">Revised Total</span>
            <span className="text-base font-black font-mono text-[#1B5747]">
              ₹{(totalPaise / 100).toFixed(2)}
            </span>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-[#556760] hover:bg-[#F0EBE1]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSubmitting || items.length === 0}
              className="px-5 py-2.5 rounded-xl bg-[#1B5747] hover:bg-[#144236] text-white text-xs font-bold shadow-xs flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
