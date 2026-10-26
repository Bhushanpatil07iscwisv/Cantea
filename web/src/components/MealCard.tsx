import React from 'react'
import { motion } from 'motion/react'
import { Plus, Minus, AlertCircle } from 'lucide-react'
import type { MenuItem } from '../types'

import { useCart } from '../context/CartContext'

interface MealCardProps {
  meal: MenuItem
}

// Default fallback images for common canteen items
const FALLBACK_IMAGES: Record<string, string> = {
  Poha: 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?w=600&auto=format&fit=crop&q=80',
  'Idli Sambar': 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600&auto=format&fit=crop&q=80',
  'Veg Thali': 'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?w=600&auto=format&fit=crop&q=80',
  'Masala Chai': 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=600&auto=format&fit=crop&q=80',
  'Veg Sandwich': 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=600&auto=format&fit=crop&q=80',
  'Samosa': 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=600&auto=format&fit=crop&q=80',
  'Cold Coffee': 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=600&auto=format&fit=crop&q=80',
  default: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80',
}

export const MealCard: React.FC<MealCardProps> = ({ meal }) => {
  const { cartItems, addItem, updateQty } = useCart()
  const cartItem = cartItems.find((item) => item.meal.id === meal.id)
  const quantityInCart = cartItem?.quantity || 0

  const priceRupees = (meal.price / 100).toFixed(2)
  const isSoldOut = meal.stock <= 0
  const isLowStock = meal.stock > 0 && meal.stock <= 5

  const imageUrl = meal.image_url || FALLBACK_IMAGES[meal.name] || FALLBACK_IMAGES.default

  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={`group bg-white rounded-2xl overflow-hidden border border-[#E8E2D5] shadow-2xs hover:shadow-md transition-shadow flex flex-col h-full ${
        isSoldOut ? 'opacity-80' : ''
      }`}
    >
      {/* Meal Image with Badges */}
      <div className="relative aspect-16/10 overflow-hidden bg-[#F3EFE6]">
        <img
          src={imageUrl}
          alt={meal.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
          onError={(e) => {
            ;(e.target as HTMLImageElement).src = FALLBACK_IMAGES.default
          }}
        />

        {/* Veg Dot Badge */}
        {meal.vegetarian ? (
          <div
            className="absolute top-3 left-3 w-5 h-5 rounded-md bg-white/95 backdrop-blur-xs border border-emerald-600 flex items-center justify-center shadow-xs"
            title="Pure Vegetarian"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
          </div>
        ) : (
          <div
            className="absolute top-3 left-3 w-5 h-5 rounded-md bg-white/95 backdrop-blur-xs border border-red-600 flex items-center justify-center shadow-xs"
            title="Non-Vegetarian"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-red-600" />
          </div>
        )}

        {/* Category Tag */}
        <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-black/55 backdrop-blur-md text-white text-[11px] font-bold">
          {meal.category}
        </div>

        {/* Sold out overlay */}
        {isSoldOut && (
          <div className="absolute inset-0 bg-black/45 backdrop-blur-2xs flex items-center justify-center">
            <span className="px-3.5 py-1.5 rounded-full bg-white text-red-600 font-extrabold text-xs shadow-md">
              Sold Out For Today
            </span>
          </div>
        )}
      </div>

      {/* Content Section */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3">
        <div>
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-extrabold text-base sm:text-lg text-[#162B23] tracking-tight group-hover:text-[#1B5747] transition-colors leading-snug">
              {meal.name}
            </h3>
            <span className="font-extrabold text-base sm:text-lg text-[#1B5747] shrink-0 font-mono">
              ₹{priceRupees}
            </span>
          </div>

          {meal.description && (
            <p className="mt-1 text-xs sm:text-sm text-[#61736C] line-clamp-2 leading-relaxed">
              {meal.description}
            </p>
          )}

          {/* Allergens Information */}
          {meal.allergens && (
            <div className="mt-2 text-[11px] text-[#7A8A84] flex items-center gap-1">
              <span className="font-bold">Allergens:</span>
              <span className="truncate">{meal.allergens}</span>
            </div>
          )}
        </div>

        {/* Footer: Stock & Add To Cart */}
        <div className="pt-2 border-t border-[#F2ECE1] flex items-center justify-between gap-2">
          {/* Stock state */}
          <div>
            {isSoldOut ? (
              <span className="text-xs font-bold text-red-600">0 portions</span>
            ) : isLowStock ? (
              <span className="inline-flex items-center gap-1 text-xs font-extrabold text-[#D97706] bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                <AlertCircle className="w-3 h-3" />
                Only {meal.stock} left
              </span>
            ) : (
              <span className="text-xs font-semibold text-[#5B6D66]">
                {meal.stock} portions available
              </span>
            )}
          </div>

          {/* Action buttons */}
          <div>
            {isSoldOut ? (
              <button
                disabled
                className="px-3.5 py-1.5 rounded-xl bg-gray-100 text-gray-400 text-xs font-bold cursor-not-allowed"
              >
                Unavailable
              </button>
            ) : quantityInCart > 0 ? (
              <div className="flex items-center gap-1.5 bg-[#1B5747] text-white rounded-xl p-1 shadow-2xs">
                <button
                  onClick={() => updateQty(meal.id, quantityInCart - 1)}
                  className="w-7 h-7 rounded-lg hover:bg-[#144236] flex items-center justify-center transition-colors focus:outline-none"
                  aria-label="Decrease quantity"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="w-5 text-center text-xs font-black font-mono">
                  {quantityInCart}
                </span>
                <button
                  onClick={() => updateQty(meal.id, quantityInCart + 1)}
                  disabled={quantityInCart >= meal.stock}
                  className="w-7 h-7 rounded-lg hover:bg-[#144236] disabled:opacity-40 flex items-center justify-center transition-colors focus:outline-none"
                  aria-label="Increase quantity"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => addItem(meal, 1)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#EBF3F0] hover:bg-[#1B5747] text-[#1B5747] hover:text-white font-bold text-xs sm:text-sm border border-[#D1E2DB] hover:border-[#1B5747] transition-all shadow-2xs focus:outline-none"
              >
                <Plus className="w-4 h-4" />
                <span>Add</span>
              </motion.button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
