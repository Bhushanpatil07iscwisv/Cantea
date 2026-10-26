import React from 'react'
import { motion } from 'motion/react'
import { Search, X, Coffee, UtensilsCrossed, Sparkles, Sun, Sandwich } from 'lucide-react'

interface CategoryFilterProps {
  categories: string[]
  selectedCategory: string
  onSelectCategory: (category: string) => void
  searchQuery: string
  onSearchChange: (query: string) => void
  vegOnly: boolean
  onToggleVegOnly: () => void
  mealCounts: Record<string, number>
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  All: <Sparkles className="w-4 h-4" />,
  Breakfast: <Sun className="w-4 h-4" />,
  Lunch: <UtensilsCrossed className="w-4 h-4" />,
  Snacks: <Sandwich className="w-4 h-4" />,
  Drinks: <Coffee className="w-4 h-4" />,
}

export const CategoryFilter: React.FC<CategoryFilterProps> = ({
  categories,
  selectedCategory,
  onSelectCategory,
  searchQuery,
  onSearchChange,
  vegOnly,
  onToggleVegOnly,
  mealCounts,
}) => {
  return (
    <div className="space-y-4">
      {/* Top Search & Veg Switch Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7A8A84]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search meals, snacks, or ingredients..."
            className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-white border border-[#E2DBD0] focus:border-[#1B5747] focus:ring-2 focus:ring-[#1B5747]/10 text-sm text-[#1A2621] placeholder-[#8A9A94] outline-none transition-all shadow-2xs"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-[#7A8A84] hover:text-[#1A2621]"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Veg Only Toggle */}
        <button
          onClick={onToggleVegOnly}
          className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
            vegOnly
              ? 'bg-emerald-50 border-emerald-500/50 text-emerald-800 shadow-2xs'
              : 'bg-white border-[#E2DBD0] text-[#4A5D55] hover:bg-[#FAF8F3]'
          }`}
        >
          <span
            className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center ${
              vegOnly ? 'border-emerald-600 bg-white' : 'border-gray-400'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                vegOnly ? 'bg-emerald-600' : 'bg-transparent'
              }`}
            />
          </span>
          <span>Pure Vegetarian Only</span>
        </button>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {categories.map((cat) => {
          const isSelected = selectedCategory === cat
          const count = mealCounts[cat] || 0
          return (
            <motion.button
              key={cat}
              whileTap={{ scale: 0.97 }}
              onClick={() => onSelectCategory(cat)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold shrink-0 transition-all ${
                isSelected
                  ? 'bg-[#1B5747] text-white shadow-xs'
                  : 'bg-white text-[#3E4F47] border border-[#E2DBD0] hover:bg-[#F3EFE6]'
              }`}
            >
              <span className={isSelected ? 'text-[#E07A5F]' : 'text-[#657670]'}>
                {CATEGORY_ICONS[cat] || <Sparkles className="w-4 h-4" />}
              </span>
              <span>{cat}</span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                  isSelected
                    ? 'bg-white/20 text-white'
                    : 'bg-[#F2ECE1] text-[#556961]'
                }`}
              >
                {count}
              </span>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
