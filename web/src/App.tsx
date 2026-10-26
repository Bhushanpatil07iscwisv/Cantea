import React, { useEffect, useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { CartProvider } from './context/CartContext'
import { Navbar } from './components/Navbar'
import { Hero } from './components/Hero'
import { CategoryFilter } from './components/CategoryFilter'
import { MealCard } from './components/MealCard'
import { CartSidebar } from './components/CartSidebar'
import { OrderConfirmedModal } from './components/OrderConfirmedModal'
import { OrdersView } from './components/OrdersView'
import { OwnerDashboard } from './components/OwnerDashboard'
import { AuthModal } from './components/AuthModal'
import { AccountModal } from './components/AccountModal'
import { EditOrderModal } from './components/EditOrderModal'
import { CancelOrderModal } from './components/CancelOrderModal'
import { CollectionModal } from './components/CollectionModal'
import { RefundModal } from './components/RefundModal'
import { MealModal } from './components/MealModal'
import { api, API_BASE } from './api'
import type { MenuItem, Order, SlotsInfo } from './types'
import { Coffee, ShieldAlert, Utensils } from 'lucide-react'

const CATEGORIES = ['All', 'Breakfast', 'Lunch', 'Snacks', 'Drinks']

const MainApp: React.FC = () => {
  const { user } = useAuth()


  const [currentView, setCurrentView] = useState<'menu' | 'orders' | 'owner'>('menu')
  const [menu, setMenu] = useState<MenuItem[]>([])
  const [slotsInfo, setSlotsInfo] = useState<SlotsInfo | null>(null)
  const [isLoadingMenu, setIsLoadingMenu] = useState(true)

  // Filters
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [vegOnly, setVegOnly] = useState(false)

  // Modals state
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [accountModalOpen, setAccountModalOpen] = useState(false)
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null)
  const [editingOrder, setEditingOrder] = useState<Order | null>(null)
  const [cancellingOrder, setCancellingOrder] = useState<Order | null>(null)
  const [collectingOrder, setCollectingOrder] = useState<Order | null>(null)
  const [refundingOrder, setRefundingOrder] = useState<Order | null>(null)
  const [mealModalOpen, setMealModalOpen] = useState(false)
  const [editingMeal, setEditingMeal] = useState<MenuItem | null>(null)

  const loadMenuAndInfo = async () => {
    try {
      const [menuData, infoData] = await Promise.all([
        api.fetchMenu().catch(() => []),
        api.fetchSlotsInfo().catch(() => null),
      ])
      setMenu(menuData)
      setSlotsInfo(infoData)
    } catch (err) {
      console.error('Failed to load menu/slots info:', err)
    } finally {
      setIsLoadingMenu(false)
    }
  }

  useEffect(() => {
    loadMenuAndInfo()
    // Periodic refresh every 10 seconds to keep stock and slot info live
    const interval = setInterval(loadMenuAndInfo, 10000)
    return () => clearInterval(interval)
  }, [user])

  // Compute category item counts
  const mealCounts: Record<string, number> = {
    All: menu.length,
    Breakfast: menu.filter((m) => m.category === 'Breakfast').length,
    Lunch: menu.filter((m) => m.category === 'Lunch').length,
    Snacks: menu.filter((m) => m.category === 'Snacks').length,
    Drinks: menu.filter((m) => m.category === 'Drinks').length,
  }

  // Filtered meals
  const filteredMeals = menu.filter((meal) => {
    if (selectedCategory !== 'All' && meal.category !== selectedCategory) {
      return false
    }
    if (vegOnly && !meal.vegetarian) {
      return false
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const matchName = meal.name.toLowerCase().includes(q)
      const matchDesc = meal.description?.toLowerCase().includes(q)
      const matchAllergens = meal.allergens?.toLowerCase().includes(q)
      if (!matchName && !matchDesc && !matchAllergens) return false
    }
    return true
  })

  return (
    <div className="min-h-screen flex flex-col bg-[#FBF9F4] text-[#1A2621]">
      {/* Top Navigation */}
      <Navbar
        currentView={currentView}
        setCurrentView={setCurrentView}
        openAuthModal={() => setAuthModalOpen(true)}
        openAccountModal={() => setAccountModalOpen(true)}
        slotsInfo={slotsInfo}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {currentView === 'menu' && (
          <div>
            {/* Hero Section */}
            <Hero
              onOrderClick={() => {
                const el = document.getElementById('menu-section')
                el?.scrollIntoView({ behavior: 'smooth' })
              }}
              slotsInfo={slotsInfo}
            />

            {/* Menu Section */}
            <section id="menu-section" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
              <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-2 border-b border-[#E8E2D5] pb-4">
                <div>
                  <span className="text-xs font-black uppercase tracking-wider text-[#1B5747]">
                    Freshly Prepared Daily
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-[#162B23] tracking-tight">
                    Canteen Menu & Portions
                  </h2>
                </div>
                <span className="text-xs font-semibold text-[#6C7D76]">
                  Showing {filteredMeals.length} available items
                </span>
              </div>

              {/* Filters */}
              <CategoryFilter
                categories={CATEGORIES}
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                vegOnly={vegOnly}
                onToggleVegOnly={() => setVegOnly(!vegOnly)}
                mealCounts={mealCounts}
              />

              {/* Meals Grid */}
              {isLoadingMenu ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="aspect-4/5 rounded-2xl bg-white border border-[#E8E2D5] animate-pulse p-4 space-y-4"
                    >
                      <div className="h-40 bg-gray-200 rounded-xl" />
                      <div className="h-5 bg-gray-200 rounded w-2/3" />
                      <div className="h-4 bg-gray-100 rounded w-full" />
                    </div>
                  ))}
                </div>
              ) : filteredMeals.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-3xl border border-[#E8E2D5] p-6 space-y-3">
                  <Utensils className="w-12 h-12 text-[#1B5747] mx-auto opacity-50" />
                  <h3 className="font-extrabold text-[#1B5747] text-lg">No meals found</h3>
                  <p className="text-xs sm:text-sm text-[#70807A] max-w-sm mx-auto">
                    No items match your search or dietary filter. Try clearing your filters or search term.
                  </p>
                  <button
                    onClick={() => {
                      setSearchQuery('')
                      setSelectedCategory('All')
                      setVegOnly(false)
                    }}
                    className="mt-2 px-5 py-2 rounded-xl bg-[#EBF3F0] text-[#1B5747] font-bold text-xs hover:bg-[#1B5747] hover:text-white transition-colors"
                  >
                    Reset All Filters
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {filteredMeals.map((meal) => (
                    <MealCard key={meal.id} meal={meal} />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {currentView === 'orders' && (
          <OrdersView
            onOrderExtras={() => setCurrentView('menu')}
            onEditOrder={(order) => setEditingOrder(order)}
            onRequestCancel={(order) => setCancellingOrder(order)}
            openAuthModal={() => setAuthModalOpen(true)}
          />
        )}

        {currentView === 'owner' && (
          <div>
            {user?.role === 'owner' ? (
              <OwnerDashboard
                onOpenAddMeal={() => {
                  setEditingMeal(null)
                  setMealModalOpen(true)
                }}
                onOpenEditMeal={(meal) => {
                  setEditingMeal(meal)
                  setMealModalOpen(true)
                }}
                onConfirmCollection={(order) => setCollectingOrder(order)}
                onConfirmRefund={(order) => setRefundingOrder(order)}
              />
            ) : (
              <div className="max-w-md mx-auto py-20 px-4 text-center space-y-4">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center">
                  <ShieldAlert className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-black text-[#162B23]">Owner Access Required</h2>
                <p className="text-xs sm:text-sm text-[#5B6D66] leading-relaxed">
                  The Kitchen & Canteen dashboard is restricted to authorized canteen owners and staff.
                </p>
                <div className="pt-2">
                  <button
                    onClick={() => setAuthModalOpen(true)}
                    className="px-6 py-3 rounded-xl bg-[#1B5747] hover:bg-[#144236] text-white font-bold text-sm shadow-xs transition-colors"
                  >
                    Sign In with Owner Account
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#E8E2D5] bg-[#F5F1E6] py-10 mt-16 text-xs text-[#63736D]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#1B5747] text-white flex items-center justify-center font-bold text-xs">
              <Coffee className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-[#162B23] text-sm block">Cantea</span>
              <span>College Canteen Pre-order & Token System</span>
            </div>
          </div>

          <div className="flex items-center gap-6 font-semibold">
            <button
              onClick={() => {
                setCurrentView('menu')
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
              className="hover:text-[#162B23]"
            >
              Menu
            </button>
            <button onClick={() => setCurrentView('orders')} className="hover:text-[#162B23]">
              My Orders
            </button>
            {user?.role === 'owner' ? (
              <button onClick={() => setCurrentView('owner')} className="hover:text-[#162B23]">
                Kitchen Dashboard
              </button>
            ) : (
              <button onClick={() => setAuthModalOpen(true)} className="hover:text-[#162B23]">
                Owner Portal
              </button>
            )}
            <a
              href={`${API_BASE}/privacy`}
              target="_blank"
              rel="noreferrer"
              className="hover:text-[#162B23]"
            >
              Privacy Policy
            </a>
          </div>

          <div className="text-right">
            <span>The Bhushan Patil Website @all rights reserved by me.</span>
          </div>
        </div>
      </footer>

      {/* Modals & Drawers */}
      <CartSidebar
        onOrderSuccess={(order) => setConfirmedOrder(order)}
        openAuthModal={() => setAuthModalOpen(true)}
        slotsInfo={slotsInfo}
      />

      <OrderConfirmedModal
        order={confirmedOrder}
        onClose={() => setConfirmedOrder(null)}
        onViewOrders={() => setCurrentView('orders')}
      />

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
      />

      <AccountModal
        isOpen={accountModalOpen}
        onClose={() => setAccountModalOpen(false)}
      />

      <EditOrderModal
        order={editingOrder}
        onClose={() => setEditingOrder(null)}
        onSuccess={() => loadMenuAndInfo()}
      />

      <CancelOrderModal
        order={cancellingOrder}
        onClose={() => setCancellingOrder(null)}
        onSuccess={() => loadMenuAndInfo()}
      />

      <CollectionModal
        order={collectingOrder}
        onClose={() => setCollectingOrder(null)}
        onSuccess={() => loadMenuAndInfo()}
      />

      <RefundModal
        order={refundingOrder}
        onClose={() => setRefundingOrder(null)}
        onSuccess={() => loadMenuAndInfo()}
      />

      <MealModal
        isOpen={mealModalOpen}
        meal={editingMeal}
        onClose={() => {
          setMealModalOpen(false)
          setEditingMeal(null)
        }}
        onSuccess={() => loadMenuAndInfo()}
      />
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <MainApp />
      </CartProvider>
    </AuthProvider>
  )
}
