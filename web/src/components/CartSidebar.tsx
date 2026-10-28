import { formatClock } from '../time'
import React, { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  X,
  Trash2,
  Plus,
  Minus,
  Clock,
  CreditCard,
  Banknote,
  AlertCircle,
  ArrowRight,
  Info,
} from 'lucide-react'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'
import { api } from '../api'
import type { Order, PaymentConfig, Slot, SlotsInfo } from '../types'

interface CartSidebarProps {
  onOrderSuccess: (order: Order) => void
  openAuthModal: () => void
  slotsInfo: SlotsInfo | null
}

export const CartSidebar: React.FC<CartSidebarProps> = ({
  onOrderSuccess,
  openAuthModal,
  slotsInfo,
}) => {
  const {
    cartItems,
    selectedSlotId,
    paymentMode,
    isCartOpen,
    totalRupees,
    updateQty,
    clearCart,
    setSelectedSlotId,
    setPaymentMode,
    setIsCartOpen,
  } = useCart()


  const { user } = useAuth()
  const [slots, setSlots] = useState<Slot[]>([])
  const [isLoadingSlots, setIsLoadingSlots] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig | null>(null)

  const attemptRef = useRef<{ fingerprint: string; key: string } | null>(null)

  // Fetch slots and payment config when cart opens
  useEffect(() => {
    if (isCartOpen) {
      setCheckoutError(null)
      setIsLoadingSlots(true)

      Promise.all([
        api.fetchSlots().catch(() => []),
        api.fetchPaymentConfig().catch(() => ({
          online_available: false,
          razorpay_key_id: null,
          currency: 'INR',
        })),
      ])
        .then(([slotsData, configData]) => {
          setSlots(slotsData)
          setPaymentConfig(configData)

          // Auto-select first slot if none selected
          if (!slotsData.some((slot) => slot.id === selectedSlotId)) {
            setSelectedSlotId(slotsData[0]?.id || '')
          }
        })
        .finally(() => setIsLoadingSlots(false))
    }
  }, [isCartOpen, user?.id])

  // Format UTC ISO string to IST local time
  const formatSlotTime = (isoString: string) => {
    try {
      const date = new Date(isoString)
      return date.toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      })
    } catch {
      return isoString
    }
  }

  const formatSlotDate = (isoString: string) => {
    try {
      const date = new Date(isoString)
      return date.toLocaleDateString('en-IN', {
        timeZone: 'Asia/Kolkata',
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
    } catch {
      return ''
    }
  }

  const handleCheckout = async () => {
    setCheckoutError(null)

    if (!user) {
      openAuthModal()
      return
    }

    if (cartItems.length === 0) {
      setCheckoutError('Your cart is empty.')
      return
    }

    if (!selectedSlotId) {
      setCheckoutError('Please select an available pickup time window.')
      return
    }

    setIsSubmitting(true)

    try {
      // Generate a unique idempotency key for this checkout attempt


      const payload = {
        slot_id: selectedSlotId,
        items: cartItems.map((item) => ({
          menu_id: item.meal.id,
          quantity: item.quantity,
        })),
        payment_mode: paymentMode,
      }

      const fingerprint = JSON.stringify({ user: user.id, ...payload })
      if (attemptRef.current?.fingerprint !== fingerprint) {
        attemptRef.current = { fingerprint, key: crypto.randomUUID() }
      }
      const order = await api.createOrder(payload, attemptRef.current.key)

      // If user chose online payment and it's configured, redirect to payment URL
      if (paymentMode === 'online') {
        try {
          const checkoutRes = await api.startCheckout(order.id)
          if (checkoutRes.url) {
            attemptRef.current = null
            clearCart()
            setIsCartOpen(false)
            window.location.href = checkoutRes.url
            return
          }
        } catch (checkoutErr: any) {
          throw new Error(`Order ${order.token} is reserved, but payment could not open: ${checkoutErr.message}. Retry, or manage it from My Orders.`)
        }
      }

      attemptRef.current = null
      clearCart()
      setIsCartOpen(false)
      onOrderSuccess(order)
    } catch (err: any) {
      setCheckoutError(err.message || 'Checkout failed. Please review your selections.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AnimatePresence>
      {isCartOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setIsCartOpen(false)}
            className="absolute inset-0 bg-black/40 backdrop-blur-xs"
          />

          {/* Drawer / Sidebar Panel */}
          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="w-screen max-w-md bg-[#FBF9F4] shadow-2xl flex flex-col border-l border-[#E5DFD4]"
            >
              {/* Header */}
              <div className="p-4 sm:p-5 border-b border-[#E8E2D5] bg-white flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-black text-[#162B23]">Your Cart</h2>
                  <p className="text-xs text-[#63736D]">
                    {cartItems.length} {cartItems.length === 1 ? 'item' : 'items'} selected
                  </p>
                </div>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="p-2 text-[#73827C] hover:text-[#162B23] rounded-lg hover:bg-[#F2ECE1] transition-colors"
                  aria-label="Close cart"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Body */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
                {/* Error Banner */}
                {checkoutError && (
                  <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs sm:text-sm font-semibold flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <span>{checkoutError}</span>
                  </div>
                )}

                {/* Cart Items List */}
                {cartItems.length === 0 ? (
                  <div className="text-center py-12 px-4 space-y-3">
                    <div className="w-16 h-16 mx-auto rounded-full bg-[#EBF3F0] text-[#1B5747] flex items-center justify-center">
                      <Clock className="w-8 h-8 opacity-60" />
                    </div>
                    <h3 className="font-extrabold text-[#1B5747] text-base">Your cart is empty</h3>
                    <p className="text-xs text-[#6C7D76] max-w-xs mx-auto">
                      Explore fresh snacks, meals, and hot drinks from the menu to build your order.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#63736D]">
                        Selected Items
                      </span>
                      <button
                        onClick={clearCart}
                        className="text-xs font-semibold text-red-600 hover:text-red-700 flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Clear All
                      </button>
                    </div>

                    <div className="space-y-2.5">
                      {cartItems.map((item) => (
                        <div
                          key={item.meal.id}
                          className="p-3 rounded-xl bg-white border border-[#E8E2D5] flex items-center justify-between gap-3 shadow-2xs"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {item.meal.image_url ? (
                              <img
                                src={item.meal.image_url}
                                alt={item.meal.name}
                                className="w-12 h-12 rounded-lg object-cover shrink-0"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-lg bg-[#EBF3F0] text-[#1B5747] flex items-center justify-center font-bold text-xs shrink-0">
                                {item.meal.name.slice(0, 2)}
                              </div>
                            )}
                            <div className="min-w-0">
                              <h4 className="text-sm font-bold text-[#162B23] truncate">
                                {item.meal.name}
                              </h4>
                              <p className="text-xs text-[#1B5747] font-semibold font-mono">
                                ₹{(item.meal.price / 100).toFixed(2)} each
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <div className="flex items-center gap-1 bg-[#F5F1E8] rounded-lg p-0.5 border border-[#E2DBD0]">
                              <button
                                onClick={() => updateQty(item.meal.id, item.quantity - 1)}
                                className="w-6 h-6 rounded flex items-center justify-center text-[#2A3B34] hover:bg-white"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="w-4 text-center text-xs font-black font-mono">
                                {item.quantity}
                              </span>
                              <button
                                onClick={() => updateQty(item.meal.id, item.quantity + 1)}
                                disabled={item.quantity >= item.meal.stock}
                                className="w-6 h-6 rounded flex items-center justify-center text-[#2A3B34] hover:bg-white disabled:opacity-30"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                            <span className="w-16 text-right text-xs font-black text-[#162B23] font-mono">
                              ₹{((item.meal.price * item.quantity) / 100).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Pickup Window Selection */}
                {cartItems.length > 0 && (
                  <div className="space-y-2.5 pt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#63736D]">
                        Choose Pickup Window
                      </span>
                      <span className="text-[11px] font-semibold text-[#1B5747]">
                        Asia/Kolkata (IST)
                      </span>
                    </div>

                    {isLoadingSlots ? (
                      <div className="p-4 rounded-xl bg-white border border-[#E8E2D5] text-center text-xs text-[#63736D] animate-pulse">
                        Loading upcoming pickup slots...
                      </div>
                    ) : slots.length === 0 ? (
                      <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1.5">
                        <div className="flex items-center gap-1.5 font-bold">
                          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>No upcoming slots currently available</span>
                        </div>
                        <p className="text-[11px] text-amber-800 leading-relaxed">
                          {formatClock(slotsInfo?.status_message || 'Canteen is currently closed for orders.')}{' '}
                          {slotsInfo?.next_opening && (
                            <span>
                              Next order window opens:{' '}
                              <strong>
                                {new Date(slotsInfo.next_opening).toLocaleDateString('en-IN', {
                                  weekday: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </strong>
                            </span>
                          )}
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                        {slots.map((slot) => {
                          const isSelected = selectedSlotId === slot.id
                          return (
                            <button
                              key={slot.id}
                              type="button"
                              onClick={() => setSelectedSlotId(slot.id)}
                              className={`p-2.5 rounded-xl border text-left transition-all ${
                                isSelected
                                  ? 'bg-[#1B5747] text-white border-[#1B5747] shadow-xs'
                                  : 'bg-white border-[#E2DBD0] text-[#1F3028] hover:bg-[#F7F3EA]'
                              }`}
                            >
                              <div
                                className={`text-[10px] font-bold uppercase ${
                                  isSelected ? 'text-emerald-200' : 'text-[#6C7E76]'
                                }`}
                              >
                                {formatSlotDate(slot.starts)}
                              </div>
                              <div className="font-extrabold text-xs font-mono mt-0.5">
                                {formatSlotTime(slot.starts)}
                              </div>
                              <div
                                className={`text-[10px] font-medium mt-1 ${
                                  isSelected ? 'text-white/80' : 'text-[#7A8B84]'
                                }`}
                              >
                                {slot.remaining} {slot.remaining === 1 ? 'spot' : 'spots'} left
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Payment Mode Selection */}
                {cartItems.length > 0 && (
                  <div className="space-y-2.5 pt-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#63736D] block">
                      Payment Method
                    </span>

                    <div className="space-y-2">
                      {/* Cash at Counter Option */}
                      <label
                        className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                          paymentMode === 'cash'
                            ? 'bg-[#EBF3F0] border-[#1B5747] text-[#1B5747] shadow-2xs'
                            : 'bg-white border-[#E2DBD0] text-[#2C3E36] hover:bg-[#FAF8F3]'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="payment_mode"
                            value="cash"
                            checked={paymentMode === 'cash'}
                            onChange={() => setPaymentMode('cash')}
                            className="text-[#1B5747] focus:ring-[#1B5747]"
                          />
                          <div className="flex items-center gap-2">
                            <Banknote className="w-4 h-4 text-[#1B5747]" />
                            <div>
                              <span className="font-extrabold text-sm block">Pay at Counter</span>
                              <span className="text-[11px] text-[#63736D] block">
                                Pay cash when picking up your food
                              </span>
                            </div>
                          </div>
                        </div>
                        <span className="text-xs font-black text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded">
                          Active
                        </span>
                      </label>

                      {/* Online Razorpay Option */}
                      <label
                        className={`p-3.5 rounded-xl border flex items-center justify-between transition-all ${
                          !paymentConfig?.online_available
                            ? 'opacity-65 bg-gray-50 border-gray-200 cursor-not-allowed'
                            : paymentMode === 'online'
                            ? 'bg-[#EBF3F0] border-[#1B5747] text-[#1B5747] shadow-2xs cursor-pointer'
                            : 'bg-white border-[#E2DBD0] text-[#2C3E36] hover:bg-[#FAF8F3] cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="payment_mode"
                            value="online"
                            checked={paymentMode === 'online'}
                            disabled={!paymentConfig?.online_available}
                            onChange={() => setPaymentMode('online')}
                            className="text-[#1B5747] focus:ring-[#1B5747]"
                          />
                          <div className="flex items-center gap-2">
                            <CreditCard className="w-4 h-4 text-[#1B5747]" />
                            <div>
                              <span className="font-extrabold text-sm block">Online Payment</span>
                              <span className="text-[11px] text-[#63736D] block">
                                UPI, Card, Net Banking (Razorpay)
                              </span>
                            </div>
                          </div>
                        </div>

                        {!paymentConfig?.online_available ? (
                          <span className="text-[10px] font-bold text-gray-500 bg-gray-200/80 px-2 py-0.5 rounded">
                            Not Configured
                          </span>
                        ) : (
                          <span className="text-xs font-black text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded">
                            Available
                          </span>
                        )}
                      </label>
                    </div>

                    {!paymentConfig?.online_available && (
                      <p className="text-[11px] text-[#70807A] flex items-center gap-1.5 px-1">
                        <Info className="w-3.5 h-3.5 shrink-0 text-[#1B5747]" />
                        <span>Online payments are disabled. Pay at Counter is active.</span>
                      </p>
                    )}
                  </div>
                )}

                {/* Important Notice regarding locked orders & add-ons */}
                {cartItems.length > 0 && (
                  <div className="p-3.5 rounded-xl bg-[#FAF6EC] border border-[#E8DFC8] text-xs text-[#5C4F35] space-y-1">
                    <span className="font-extrabold block text-[#4A3D24]">
                      ⚡ Locked Order Invariant
                    </span>
                    <p className="leading-relaxed">
                      Orders cannot be modified once preparation begins or payment is processed. If you need extras later, you can easily place a separate order with its own token!
                    </p>
                  </div>
                )}
              </div>

              {/* Checkout Footer */}
              {cartItems.length > 0 && (
                <div className="p-4 sm:p-5 border-t border-[#E8E2D5] bg-white space-y-3">
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center justify-between text-[#5C6E66]">
                      <span>Items Subtotal</span>
                      <span className="font-mono font-semibold">₹{totalRupees}</span>
                    </div>
                    <div className="flex items-center justify-between text-[#5C6E66]">
                      <span>Convenience / Queue Skip Fee</span>
                      <span className="font-bold text-emerald-700">₹0.00 (Free)</span>
                    </div>
                    <div className="pt-2 border-t border-[#F2ECE1] flex items-center justify-between text-base font-extrabold text-[#162B23]">
                      <span>Total Payable</span>
                      <span className="text-lg text-[#1B5747] font-mono">₹{totalRupees}</span>
                    </div>
                  </div>

                  <button
                    onClick={handleCheckout}
                    disabled={isSubmitting || slots.length === 0}
                    className="w-full py-3.5 rounded-xl bg-[#1B5747] hover:bg-[#144236] disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-extrabold text-sm sm:text-base shadow-sm hover:shadow-md flex items-center justify-center gap-2 transition-all focus:outline-none"
                  >
                    {isSubmitting ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Generating Token...
                      </span>
                    ) : (
                      <>
                        <span>{user ? 'Confirm & Get Token' : 'Sign In to Order'}</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  )
}
