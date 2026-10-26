import React, { createContext, useContext, useEffect, useState } from 'react'
import type { CartItem, MenuItem, PaymentMode } from '../types'

interface CartContextType {
  cartItems: CartItem[]
  selectedSlotId: string
  paymentMode: PaymentMode
  isCartOpen: boolean
  itemCount: number
  totalPaise: number
  totalRupees: string
  addItem: (meal: MenuItem, quantity?: number) => void
  removeItem: (mealId: string) => void
  updateQty: (mealId: string, quantity: number) => void
  clearCart: () => void
  setSelectedSlotId: (slotId: string) => void
  setPaymentMode: (mode: PaymentMode) => void
  setIsCartOpen: (open: boolean) => void
}

const CartContext = createContext<CartContextType | undefined>(undefined)

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cartItems, setCartItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('cantea_cart')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  const [selectedSlotId, setSelectedSlotId] = useState<string>(() => {
    return localStorage.getItem('cantea_slot_id') || ''
  })

  const [paymentMode, setPaymentMode] = useState<PaymentMode>('cash')
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false)

  // Sync cart to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('cantea_cart', JSON.stringify(cartItems))
    } catch (e) {
      console.error('Failed to save cart:', e)
    }
  }, [cartItems])

  useEffect(() => {
    if (selectedSlotId) {
      localStorage.setItem('cantea_slot_id', selectedSlotId)
    } else {
      localStorage.removeItem('cantea_slot_id')
    }
  }, [selectedSlotId])

  const addItem = (meal: MenuItem, quantity = 1) => {
    setCartItems((prev) => {
      const existing = prev.find((item) => item.meal.id === meal.id)
      if (existing) {
        const newQty = Math.min(meal.stock, existing.quantity + quantity)
        return prev.map((item) =>
          item.meal.id === meal.id ? { ...item, quantity: newQty, meal } : item
        )
      }
      const initialQty = Math.min(meal.stock, Math.max(1, quantity))
      return [...prev, { meal, quantity: initialQty }]
    })
  }

  const removeItem = (mealId: string) => {
    setCartItems((prev) => prev.filter((item) => item.meal.id !== mealId))
  }

  const updateQty = (mealId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(mealId)
      return
    }
    setCartItems((prev) =>
      prev.map((item) => {
        if (item.meal.id === mealId) {
          const clamped = Math.min(item.meal.stock, quantity)
          return { ...item, quantity: clamped }
        }
        return item
      })
    )
  }

  const clearCart = () => {
    setCartItems([])
    setSelectedSlotId('')
    localStorage.removeItem('cantea_cart')
    localStorage.removeItem('cantea_slot_id')
  }

  const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0)
  const totalPaise = cartItems.reduce((sum, item) => sum + item.meal.price * item.quantity, 0)
  const totalRupees = (totalPaise / 100).toFixed(2)

  return (
    <CartContext.Provider
      value={{
        cartItems,
        selectedSlotId,
        paymentMode,
        isCartOpen,
        itemCount,
        totalPaise,
        totalRupees,
        addItem,
        removeItem,
        updateQty,
        clearCart,
        setSelectedSlotId,
        setPaymentMode,
        setIsCartOpen,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export const useCart = () => {
  const context = useContext(CartContext)
  if (!context) throw new Error('useCart must be used within a CartProvider')
  return context
}
