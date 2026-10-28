import React, { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { X, Save, Trash2, AlertCircle } from 'lucide-react'
import { api } from '../api'

import type { MenuItem } from '../types'

interface MealModalProps {
  isOpen: boolean
  meal: MenuItem | null
  onClose: () => void
  onSuccess: () => void
}

const CATEGORIES = ['Breakfast', 'Lunch', 'Snacks', 'Drinks']

export const MealModal: React.FC<MealModalProps> = (props) => {
  if (!props.isOpen) return null
  return <MealModalForm key={props.meal?.id || 'new'} {...props} />
}

const MealModalForm: React.FC<MealModalProps> = ({
  meal,
  onClose,
  onSuccess,
}) => {
  const isEditing = Boolean(meal)

  const [name, setName] = useState(meal?.name || '')
  const [category, setCategory] = useState(meal?.category || 'Breakfast')
  const [priceRupees, setPriceRupees] = useState(
    meal ? (meal.price / 100).toString() : '40'
  )
  const [stock, setStock] = useState(meal ? meal.stock.toString() : '30')
  const [vegetarian, setVegetarian] = useState(meal ? Boolean(meal.vegetarian) : true)
  const [active, setActive] = useState(meal ? Boolean(meal.active) : true)
  const [allergens, setAllergens] = useState(meal?.allergens || '')
  const [imageUrl, setImageUrl] = useState(meal?.image_url || '')
  const [description, setDescription] = useState(meal?.description || '')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const parsedPrice = parseFloat(priceRupees)
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      setError('Please enter a valid price in rupees.')
      return
    }

    const pricePaise = Math.round(parsedPrice * 100)
    const parsedStock = parseInt(stock) || 0

    setIsSubmitting(true)

    try {
      const payload = {
        name: name.trim(),
        category: category.trim(),
        price: pricePaise,
        stock: parsedStock,
        expected_stock: meal?.stock,
        active,
        vegetarian,
        allergens: allergens.trim(),
        image_url: imageUrl.trim(),
        description: description.trim(),
      }

      if (isEditing && meal) {
        await api.ownerUpdateMenu(meal.id, payload)
      } else {
        await api.ownerAddMenu(payload)
      }

      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to save meal.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!meal) return
    if (!window.confirm(`Are you sure you want to delete/archive "${meal.name}"?`)) return

    setIsSubmitting(true)
    setError(null)
    try {
      await api.ownerDeleteMenu(meal.id)
      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to delete meal.')
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
          className="relative bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-[#E8E2D5] space-y-4 z-10"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black text-[#162B23]">
              {isEditing ? 'Edit Meal' : 'Add New Meal'}
            </h3>
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

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-[#3B4D45] block mb-1">Meal Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Masala Dosa, Paneer Wrap"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2DBD0] text-sm focus:border-[#1B5747] outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#3B4D45] block mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2DBD0] text-sm bg-white focus:border-[#1B5747] outline-none"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-[#3B4D45] block mb-1">Price (₹ INR)</label>
                <input
                  type="number"
                  step="0.5"
                  min="1"
                  value={priceRupees}
                  onChange={(e) => setPriceRupees(e.target.value)}
                  placeholder="e.g. 40"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2DBD0] text-sm font-mono focus:border-[#1B5747] outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#3B4D45] block mb-1">Portions / Stock</label>
                <input
                  type="number"
                  min="0"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  placeholder="e.g. 50"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2DBD0] text-sm font-mono focus:border-[#1B5747] outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#3B4D45] block mb-1">Allergens</label>
                <input
                  type="text"
                  value={allergens}
                  onChange={(e) => setAllergens(e.target.value)}
                  placeholder="e.g. Peanuts, Wheat, Dairy"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2DBD0] text-sm focus:border-[#1B5747] outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-[#3B4D45] block mb-1">
                  Food Photograph URL
                </label>
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/photo-..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2DBD0] text-xs focus:border-[#1B5747] outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-[#3B4D45] block mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of ingredients, flavor and preparation..."
                  rows={2}
                  className="w-full p-3 rounded-xl border border-[#E2DBD0] text-xs outline-none focus:border-[#1B5747]"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="veg"
                  checked={vegetarian}
                  onChange={(e) => setVegetarian(e.target.checked)}
                  className="w-4 h-4 text-[#1B5747] rounded"
                />
                <label htmlFor="veg" className="text-xs font-bold text-[#3B4D45] cursor-pointer">
                  Pure Vegetarian
                </label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="active"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="w-4 h-4 text-[#1B5747] rounded"
                />
                <label htmlFor="active" className="text-xs font-bold text-[#3B4D45] cursor-pointer">
                  Available on Menu
                </label>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[#F0EBE1]">
              {isEditing ? (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="px-3 py-2 rounded-xl text-red-600 hover:bg-red-50 text-xs font-bold flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-[#556760] hover:bg-[#F0EBE1]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-[#1B5747] hover:bg-[#144236] text-white text-xs font-bold shadow-xs flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Saving...' : 'Save Meal'}</span>
                </button>
              </div>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
