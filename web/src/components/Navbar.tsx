import React, { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  ShoppingBag,
  ChefHat,
  Menu as MenuIcon,
  X,
  Coffee,
  LogOut,
  Clock,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

import { useCart } from '../context/CartContext'
import type { SlotsInfo } from '../types'

interface NavbarProps {
  currentView: 'menu' | 'orders' | 'owner'
  setCurrentView: (view: 'menu' | 'orders' | 'owner') => void
  openAuthModal: () => void
  openAccountModal: () => void
  slotsInfo: SlotsInfo | null
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  setCurrentView,
  openAuthModal,
  openAccountModal,
  slotsInfo,
}) => {
  const { user, logout, selectedCanteen } = useAuth()
  const { itemCount, setIsCartOpen } = useCart()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const isOwner = user?.role === 'owner'

  return (
    <header className="sticky top-0 z-40 bg-[#FBF9F4]/90 backdrop-blur-md border-b border-[#E8E2D5]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Logo & Canteen Name */}
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              onClick={() => {
                setCurrentView('menu')
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
              className="flex items-center gap-2.5 text-left group focus:outline-none"
            >
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-[#1B5747] flex items-center justify-center text-[#FBF9F4] shadow-sm group-hover:bg-[#144236] transition-colors">
                <Coffee className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <span className="font-extrabold text-xl sm:text-2xl tracking-tight text-[#1B5747] block leading-none">
                  Cantea
                </span>
                <span className="text-[11px] sm:text-xs text-[#63736D] font-medium block mt-0.5 truncate max-w-35 sm:max-w-50">
                  {selectedCanteen?.name || 'Campus Canteen'}
                </span>
              </div>
            </button>

            {/* Live Status Pill */}
            {slotsInfo && (
              <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#EBF3F0] text-[#1B5747] text-xs font-semibold border border-[#D5E5DE]">
                <span
                  className={`w-2 h-2 rounded-full ${
                    slotsInfo.is_closed || slotsInfo.available_slots_count === 0
                      ? 'bg-amber-500'
                      : 'bg-emerald-500 animate-pulse'
                  }`}
                />
                <span className="truncate max-w-42.5">{slotsInfo.status_message}</span>
              </div>
            )}
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => setCurrentView('menu')}
              className={`px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors ${
                currentView === 'menu'
                  ? 'bg-[#1B5747] text-white shadow-sm'
                  : 'text-[#3E4F47] hover:bg-[#F0EBE1]'
              }`}
            >
              Menu
            </button>

            <button
              onClick={() => setCurrentView('orders')}
              className={`px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors ${
                currentView === 'orders'
                  ? 'bg-[#1B5747] text-white shadow-sm'
                  : 'text-[#3E4F47] hover:bg-[#F0EBE1]'
              }`}
            >
              My Orders
            </button>

            {isOwner && (
              <button
                onClick={() => setCurrentView('owner')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  currentView === 'owner'
                    ? 'bg-[#E07A5F] text-white shadow-sm'
                    : 'text-[#C55D42] hover:bg-[#FDEEE9]'
                }`}
              >
                <ChefHat className="w-4 h-4" />
                <span>Kitchen Dashboard</span>
              </button>
            )}
          </nav>

          {/* Right Action Icons: Cart & Account */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Cart Button */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsCartOpen(true)}
              className="relative p-2.5 sm:px-4 sm:py-2.5 rounded-xl bg-white border border-[#E2DBD0] hover:border-[#1B5747]/40 text-[#1B5747] flex items-center gap-2 shadow-xs hover:shadow-sm transition-all focus:outline-none"
              aria-label="Shopping Cart"
            >
              <ShoppingBag className="w-5 h-5 text-[#1B5747]" />
              <span className="hidden sm:inline font-bold text-sm">Cart</span>
              <AnimatePresence mode="popLayout">
                {itemCount > 0 && (
                  <motion.span
                    key={itemCount}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.5, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="min-w-5 h-5 px-1.5 rounded-full bg-[#E07A5F] text-white text-xs font-black flex items-center justify-center leading-none"
                  >
                    {itemCount}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>

            {/* User Profile / Auth Button */}
            {user ? (
              <div className="flex items-center gap-1 sm:gap-2">
                <button
                  onClick={openAccountModal}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-[#E2DBD0] hover:border-[#1B5747]/40 text-[#1A2621] text-sm font-semibold shadow-xs transition-all"
                  title="Account Details"
                >
                  <div className="w-6 h-6 rounded-full bg-[#EBF3F0] text-[#1B5747] flex items-center justify-center font-bold text-xs">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="hidden sm:inline truncate max-w-27.5">{user.name.split(' ')[0]}</span>
                  {user.role === 'owner' && (
                    <span className="hidden md:inline px-1.5 py-0.5 rounded text-[10px] bg-[#E07A5F]/15 text-[#C55D42] font-black uppercase">
                      Owner
                    </span>
                  )}
                </button>

                <button
                  onClick={() => logout()}
                  className="p-2 text-[#73827C] hover:text-[#B91C1C] rounded-lg hover:bg-red-50 transition-colors"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>
            ) : (
              <button
                onClick={openAuthModal}
                className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl bg-[#1B5747] hover:bg-[#144236] text-white text-sm font-bold shadow-xs hover:shadow-sm transition-all focus:outline-none"
              >
                Sign In
              </button>
            )}

            {/* Mobile Menu Hamburger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-[#2D3A34] hover:bg-[#F0EBE1] rounded-lg md:hidden"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <MenuIcon className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-[#E8E2D5] bg-[#FBF9F4] px-4 pt-3 pb-6 space-y-2"
          >
            <button
              onClick={() => {
                setCurrentView('menu')
                setMobileMenuOpen(false)
              }}
              className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-bold ${
                currentView === 'menu' ? 'bg-[#1B5747] text-white' : 'text-[#3E4F47] hover:bg-[#F0EBE1]'
              }`}
            >
              Browse Menu
            </button>

            <button
              onClick={() => {
                setCurrentView('orders')
                setMobileMenuOpen(false)
              }}
              className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-bold ${
                currentView === 'orders' ? 'bg-[#1B5747] text-white' : 'text-[#3E4F47] hover:bg-[#F0EBE1]'
              }`}
            >
              My Orders & Tokens
            </button>

            {isOwner && (
              <button
                onClick={() => {
                  setCurrentView('owner')
                  setMobileMenuOpen(false)
                }}
                className={`w-full text-left flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold ${
                  currentView === 'owner' ? 'bg-[#E07A5F] text-white' : 'text-[#C55D42] hover:bg-[#FDEEE9]'
                }`}
              >
                <ChefHat className="w-4 h-4" />
                Kitchen & Canteen Management
              </button>
            )}

            {slotsInfo && (
              <div className="pt-2 border-t border-[#E8E2D5] text-xs text-[#52635D] flex items-center gap-1.5 px-4 py-1">
                <Clock className="w-3.5 h-3.5 text-[#1B5747]" />
                <span>{slotsInfo.status_message}</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
