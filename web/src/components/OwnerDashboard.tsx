import { PaymentStatus } from './PaymentStatus'
import { InventoryPanel } from './InventoryPanel'
import React, { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  ChefHat,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Edit2,
  RefreshCw,
  Search,
  Banknote,
  Calendar,
  Save,
  DollarSign,
} from 'lucide-react'
import { api } from '../api'

import type {
  MenuItem,
  Order,
  OwnerSettings,
  OwnerSummary,
  Slot,
} from '../types'

interface OwnerDashboardProps {
  onOpenAddMeal: () => void
  onOpenEditMeal: (meal: MenuItem) => void
  onConfirmCollection: (order: Order) => void
  onConfirmRefund: (order: Order) => void
}

export const OwnerDashboard: React.FC<OwnerDashboardProps> = ({
  onOpenAddMeal,
  onOpenEditMeal,
  onConfirmCollection,
  onConfirmRefund,
}) => {
  const [activeTab, setActiveTab] = useState<'queue' | 'menu' | 'inventory' | 'slots'>('queue')
  const [orders, setOrders] = useState<Order[]>([])
  const [menu, setMenu] = useState<MenuItem[]>([])
  const [slots, setSlots] = useState<Slot[]>([])
  const [summary, setSummary] = useState<OwnerSummary | null>(null)
  const [settings, setSettings] = useState<OwnerSettings | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [timeFilter, setTimeFilter] = useState<'today' | 'upcoming' | 'all'>('today')
  const [menuSearch, setMenuSearch] = useState('')

  // Settings form state
  const [settingsForm, updateSettingsForm] = useState({
    open_time: '08:00',
    close_time: '17:00',
    slot_duration: 15,
    slot_capacity: 20,
    closed_days: 'Sunday',
    is_closed: false,
    closure_reason: '',
  })
  const [isSavingSettings, setIsSavingSettings] = useState(false)
  const [isGeneratingSlots, setIsGeneratingSlots] = useState(false)

  const settingsDirty = useRef(false)
  const setSettingsForm = (value: typeof settingsForm) => {
    settingsDirty.current = true
    updateSettingsForm(value)
  }

  const loadData = async (silent = false) => {
    if (!silent) setIsRefreshing(true)
    try {
      const [ordersData, menuData, summaryData, settingsData, slotsData] = await Promise.all([
        api.fetchOrders(),
        api.fetchMenu(),
        api.ownerGetSummary(),
        api.ownerGetSettings(),
        api.fetchSlots(),
      ])

      setOrders(ordersData)
      setMenu(menuData)
      setSummary(summaryData)
      setSettings(settingsData)
      setSlots(slotsData)

      if (!settingsDirty.current) updateSettingsForm({
        open_time: settingsData.open_time || '08:00',
        close_time: settingsData.close_time || '17:00',
        slot_duration: settingsData.slot_duration || 15,
        slot_capacity: settingsData.slot_capacity || 20,
        closed_days: settingsData.closed_days ?? 'Sunday',
        is_closed: settingsData.is_closed,
        closure_reason: settingsData.closure_reason || '',
      })
    } catch (err: any) {
      console.error('Failed to load owner dashboard:', err)
      setMessage({ type: 'error', text: err.message || 'Error loading dashboard data.' })
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    loadData()
    // Live polling every 8 seconds
    const interval = setInterval(() => loadData(true), 8000)
    return () => clearInterval(interval)
  }, [])

  // Order Actions
  const handleStatusChange = async (orderId: string, nextStatus: 'preparing' | 'ready') => {
    try {
      await api.ownerChangeStatus(orderId, nextStatus)
      setMessage({ type: 'success', text: `Order updated to ${nextStatus}.` })
      await loadData(true)
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Status update failed.' })
    }
  }

  const handleRecordCash = async (orderId: string) => {
    try {
      await api.ownerRecordCash(orderId)
      setMessage({ type: 'success', text: 'Cash payment confirmed and recorded.' })
      await loadData(true)
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Cash confirmation failed.' })
    }
  }

  const handleCancelDecision = async (orderId: string, approve: boolean) => {
    try {
      await api.ownerCancelDecision(orderId, approve)
      setMessage({
        type: 'success',
        text: approve ? 'Cancellation approved. Stock restored.' : 'Cancellation rejected.',
      })
      await loadData(true)
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Action failed.' })
    }
  }

  const stockBusy = useRef(new Set<string>())

  // Stock Adjustment
  const handleQuickStock = async (mealId: string, _currentStock: number, delta: number) => {
    if (stockBusy.current.has(mealId)) return
    stockBusy.current.add(mealId)
    try {
      await api.ownerAdjustInventory(mealId, delta, 'Quick menu stock adjustment', crypto.randomUUID())
      await loadData(true)
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Stock adjustment failed.' })
    } finally { stockBusy.current.delete(mealId) }
  }

  // Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSavingSettings(true)
    setMessage(null)
    try {
      await api.ownerUpdateSettings({
        open_time: settingsForm.open_time,
        close_time: settingsForm.close_time,
        slot_duration: Number(settingsForm.slot_duration),
        slot_capacity: Number(settingsForm.slot_capacity),
        closed_days: settingsForm.closed_days,
        is_closed: settingsForm.is_closed,
        closure_reason: settingsForm.closure_reason,
      })
      settingsDirty.current = false
      setMessage({ type: 'success', text: 'Opening hours and pickup settings updated! Future slots synced.' })
      await loadData(true)
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to update settings.' })
    } finally {
      setIsSavingSettings(false)
    }
  }

  // Manual Slot Generation
  const handleManualSlotGen = async () => {
    setIsGeneratingSlots(true)
    setMessage(null)
    try {
      const res = await api.ownerGenerateSlots(7)
      setMessage({
        type: 'success',
        text: `Generated 7 days of rolling slots. ${res.created} new windows added (${res.total_future_slots} total future slots).`,
      })
      await loadData(true)
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Slot generation failed.' })
    } finally {
      setIsGeneratingSlots(false)
    }
  }

  // Filter orders
  const filteredOrders = orders.filter((order) => {
    if (statusFilter !== 'all' && order.status !== statusFilter) return false

    if (timeFilter === 'today' && order.slot) {
      const todayIST = new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })
      const orderDateIST = new Date(order.slot.starts).toLocaleDateString('en-IN', {
        timeZone: 'Asia/Kolkata',
      })
      if (todayIST !== orderDateIST) return false
    }

    return true
  })

  const cancellationPendingOrders = orders.filter((o) => o.cancel_requested === 1)
  const refundDueOrders = orders.filter((o) => o.payment_status === 'refund_due')

  if (isLoading && !summary) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8 animate-pulse">
        <div className="h-12 bg-[#EAE3D6] rounded-2xl w-1/3" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-[#EAE3D6] rounded-2xl" />
          ))}
        </div>
        <div className="h-96 bg-[#EAE3D6] rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#E8E2D5]">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#E07A5F] text-white flex items-center justify-center shadow-xs">
            <ChefHat className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#162B23] tracking-tight">
              Kitchen & Canteen Management
            </h1>
            <p className="text-xs sm:text-sm text-[#556760]">
              {settings?.name || 'Campus Canteen'} • Owner Portal
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => loadData()}
            disabled={isRefreshing}
            className="p-2.5 rounded-xl bg-white border border-[#E2DBD0] text-[#4A5D55] hover:text-[#1B5747] shadow-2xs transition-colors"
            title="Refresh dashboard"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#1B5747]' : ''}`} />
          </button>

          {/* Navigation Tabs */}
          <div className="flex flex-wrap items-center bg-[#F0EBE1] p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('queue')}
              className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all ${
                activeTab === 'queue' ? 'bg-[#1B5747] text-white shadow-xs' : 'text-[#4A5D55]'
              }`}
            >
              Order Queue
            </button>
            <button
              onClick={() => setActiveTab('menu')}
              className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all ${
                activeTab === 'menu' ? 'bg-[#1B5747] text-white shadow-xs' : 'text-[#4A5D55]'
              }`}
            >
              Menu & Stock
            </button>
            <button onClick={() => setActiveTab('inventory')}
              className={`px-3 py-2 rounded-lg text-xs sm:text-sm font-bold ${activeTab === 'inventory' ? 'bg-[#1B5747] text-white' : 'text-[#4A5D55]'}`}>
              Inventory
            </button>
            <button
              onClick={() => setActiveTab('slots')}
              className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all ${
                activeTab === 'slots' ? 'bg-[#1B5747] text-white shadow-xs' : 'text-[#4A5D55]'
              }`}
            >
              Hours & Slots
            </button>
          </div>
        </div>
      </div>

      {/* Global Message Banner */}
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`p-4 rounded-2xl text-xs sm:text-sm font-semibold flex items-center justify-between shadow-2xs ${
              message.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                : 'bg-red-50 text-red-900 border border-red-200'
            }`}
          >
            <span>{message.text}</span>
            <button onClick={() => setMessage(null)} className="text-xs font-bold underline ml-4">
              Dismiss
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Real-time DB Analytics Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#E8E2D5] shadow-2xs">
          <div className="flex items-center justify-between text-[#6B7D76]">
            <span className="text-xs font-bold uppercase tracking-wider">Today's Orders</span>
            <Clock className="w-4 h-4 text-[#1B5747]" />
          </div>
          <span className="text-2xl sm:text-3xl font-black text-[#162B23] font-mono block mt-1">
            {summary?.today_orders ?? 0}
          </span>
          <span className="text-[11px] text-[#7A8A84] mt-1 block">
            {summary?.total_orders ?? 0} all-time orders
          </span>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#E8E2D5] shadow-2xs">
          <div className="flex items-center justify-between text-[#6B7D76]">
            <span className="text-xs font-bold uppercase tracking-wider">Today's Revenue</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <span className="text-2xl sm:text-3xl font-black text-[#1B5747] font-mono block mt-1">
            ₹{(((summary?.today_revenue ?? 0) / 100)).toFixed(2)}
          </span>
          <span className="text-[11px] text-[#7A8A84] mt-1 block">
            ₹{(((summary?.total_revenue ?? 0) / 100)).toFixed(2)} all-time collected
          </span>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#E8E2D5] shadow-2xs">
          <div className="flex items-center justify-between text-[#6B7D76]">
            <span className="text-xs font-bold uppercase tracking-wider">Active in Kitchen</span>
            <ChefHat className="w-4 h-4 text-[#E07A5F]" />
          </div>
          <span className="text-2xl sm:text-3xl font-black text-[#E07A5F] font-mono block mt-1">
            {summary?.active_orders ?? 0}
          </span>
          <span className="text-[11px] text-[#7A8A84] mt-1 block">
            {cancellationPendingOrders.length} cancellations pending
          </span>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#E8E2D5] shadow-2xs">
          <div className="flex items-center justify-between text-[#6B7D76]">
            <span className="text-xs font-bold uppercase tracking-wider">Low Stock Alerts</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <span className="text-2xl sm:text-3xl font-black text-amber-600 font-mono block mt-1">
            {summary?.low_stock_count ?? 0}
          </span>
          <span className="text-[11px] text-[#7A8A84] mt-1 block">
            Active meals with &le; 10 portions
          </span>
        </div>
      </div>

      {/* TAB 1: ORDER QUEUE */}
      {activeTab === 'queue' && (
        <div className="space-y-6">
          {/* Action Alerts: Cancellation Requests & Refunds */}
          {cancellationPendingOrders.length > 0 && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 space-y-3 shadow-2xs">
              <div className="flex items-center gap-2 font-black text-sm">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>
                  {cancellationPendingOrders.length} Cancellation{' '}
                  {cancellationPendingOrders.length === 1 ? 'Request' : 'Requests'} Requiring Review
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {cancellationPendingOrders.map((ord) => (
                  <div
                    key={ord.id}
                    className="p-3.5 rounded-xl bg-white border border-amber-200 text-xs flex flex-col justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-center justify-between font-bold">
                        <span className="font-mono text-[#1B5747]">{ord.token}</span>
                        <span>₹{(ord.total / 100).toFixed(2)}</span>
                      </div>
                      <p className="mt-1 text-[#6C5B32]">
                        Reason: <em>"{ord.cancel_reason}"</em>
                      </p>
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-amber-100">
                      <button
                        onClick={() => handleCancelDecision(ord.id, false)}
                        className="px-3 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => handleCancelDecision(ord.id, true)}
                        className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold"
                      >
                        Approve (Restore Stock)
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {refundDueOrders.length > 0 && (
            <div className="p-4 rounded-2xl bg-purple-50 border border-purple-200 text-purple-900 space-y-3 shadow-2xs">
              <div className="flex items-center gap-2 font-black text-sm">
                <AlertTriangle className="w-4 h-4 text-purple-600" />
                <span>{refundDueOrders.length} Cancelled Paid Order(s) Awaiting Refund Reference</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {refundDueOrders.map((ord) => (
                  <div
                    key={ord.id}
                    className="p-3.5 rounded-xl bg-white border border-purple-200 text-xs flex items-center justify-between"
                  >
                    <div>
                      <span className="font-mono font-bold text-[#1B5747]">{ord.token}</span>
                      <span className="block text-[#6D548F]">
                        Amount to refund: ₹{(ord.total / 100).toFixed(2)}
                      </span>
                    </div>
                    <button
                      onClick={() => onConfirmRefund(ord)}
                      className="px-3.5 py-1.5 rounded-lg bg-purple-700 hover:bg-purple-800 text-white font-bold"
                    >
                      Enter Refund Ref
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Queue Filter Controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-2xl bg-white border border-[#E8E2D5]">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              {['all', 'placed', 'preparing', 'ready', 'collected', 'cancelled'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-colors ${
                    statusFilter === st
                      ? 'bg-[#1B5747] text-white shadow-2xs'
                      : 'text-[#5B6D66] hover:bg-[#F0EBE1]'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#6B7D76]">Time:</span>
              <select
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value as any)}
                className="px-3 py-1.5 rounded-lg bg-[#FAF8F3] border border-[#E2DBD0] text-xs font-bold text-[#162B23] outline-none"
              >
                <option value="today">Today's Pickups</option>
                <option value="upcoming">All Upcoming</option>
                <option value="all">All Dates</option>
              </select>
            </div>
          </div>

          {/* Orders Cards Grid */}
          {filteredOrders.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-3xl border border-[#E8E2D5] p-6 space-y-2">
              <ChefHat className="w-12 h-12 text-[#1B5747] mx-auto opacity-50" />
              <h3 className="font-extrabold text-[#1B5747] text-base">No orders in this view</h3>
              <p className="text-xs text-[#70807A]">
                Try changing status or time filters to view other orders.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredOrders.map((ord) => {
                const isPaid = ord.payment_status === 'paid'
                const isReady = ord.status === 'ready'
                const isPreparing = ord.status === 'preparing'
                const isPlaced = ord.status === 'placed'
                const isCollected = ord.status === 'collected'

                return (
                  <div
                    key={ord.id}
                    className="p-5 rounded-2xl bg-white border border-[#E8E2D5] shadow-xs flex flex-col justify-between space-y-4"
                  >
                    <div>
                      {/* Card Top */}
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="font-mono font-black text-xl text-[#1B5747]">
                            {ord.token}
                          </span>
                          <span className="text-xs text-[#63736D] block mt-0.5">
                            Code: <strong className="font-mono text-[#E07A5F]">{ord.pickup_code}</strong>
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="text-base font-black font-mono text-[#162B23]">
                            ₹{(ord.total / 100).toFixed(2)}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-black uppercase block mt-1 ${
                              isPaid
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-900'
                            }`}
                          >
                            {ord.payment_status} ({ord.payment_mode})
                          </span>
                        </div>
                      </div>

                      {/* Pickup Window */}
                      {ord.slot && (
                        <div className="mt-3 p-2.5 rounded-xl bg-[#FAF8F3] border border-[#EFEAE0] text-xs flex items-center justify-between text-[#4D5E56]">
                          <span className="font-semibold">
                            {new Date(ord.slot.starts).toLocaleTimeString('en-IN', {
                              timeZone: 'Asia/Kolkata',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}{' '}
                            –{' '}
                            {new Date(ord.slot.ends).toLocaleTimeString('en-IN', {
                              timeZone: 'Asia/Kolkata',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          <span className="text-[11px] text-[#7A8B84]">
                            {new Date(ord.slot.starts).toLocaleDateString('en-IN', {
                              timeZone: 'Asia/Kolkata',
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        </div>
                      )}

                      {/* Items */}
                      <div className="mt-3 space-y-1 text-xs">
                        {ord.items.map((it) => (
                          <div key={it.menu_id} className="flex justify-between text-[#2D3E36]">
                            <span>
                              <strong>{it.quantity}×</strong> {it.name}
                            </span>
                            <span className="font-mono text-[#6C7D76]">
                              ₹{((it.price * it.quantity) / 100).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Operational Action Buttons */}
                    <div className="pt-3 border-t border-[#F0EBE1] flex flex-wrap items-center justify-end gap-2">
                      {/* Cash Receipt Confirmation Button */}
                      {!isPaid && ord.payment_mode === 'cash' && !['cancelled', 'collected'].includes(ord.status) && (
                        <button
                          onClick={() => handleRecordCash(ord.id)}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 shadow-2xs"
                        >
                          <Banknote className="w-3.5 h-3.5" />
                          <span>Record Cash</span>
                        </button>
                      )}

                      {/* Workflow Transitions */}
                      {isPlaced && (
                        <button
                          onClick={() => handleStatusChange(ord.id, 'preparing')}
                          className="px-4 py-1.5 rounded-xl bg-[#1B5747] hover:bg-[#144236] text-white font-bold text-xs"
                        >
                          Start Preparing
                        </button>
                      )}

                      {isPreparing && (
                        <button
                          onClick={() => handleStatusChange(ord.id, 'ready')}
                          className="px-4 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs"
                        >
                          Mark Ready
                        </button>
                      )}

                      {isReady && (
                        <button
                          onClick={() => onConfirmCollection(ord)}
                          className="px-4 py-1.5 rounded-xl bg-[#E07A5F] hover:bg-[#CB674D] text-white font-bold text-xs flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Confirm Collection</span>
                        </button>
                      )}

                      {isCollected && (
                        <span className="text-xs font-bold text-gray-400">Collected ✓</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      <PaymentStatus />
      {activeTab === 'inventory' && <InventoryPanel onChange={() => loadData(true)} />}

      {/* TAB 2: MENU & INVENTORY */}
      {activeTab === 'menu' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-[#7A8A84] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={menuSearch}
                onChange={(e) => setMenuSearch(e.target.value)}
                placeholder="Search menu items..."
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-white border border-[#E2DBD0] text-xs sm:text-sm outline-none focus:border-[#1B5747]"
              />
            </div>

            <button
              onClick={onOpenAddMeal}
              className="px-4 py-2.5 rounded-xl bg-[#1B5747] hover:bg-[#144236] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Meal</span>
            </button>
          </div>

          <div className="bg-white rounded-3xl border border-[#E8E2D5] overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-[#FAF8F3] border-b border-[#E8E2D5] text-[#556760] font-bold uppercase text-[11px] tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Item</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Price</th>
                    <th className="py-3 px-4">Stock</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0EBE1]">
                  {menu
                    .filter((m) => m.name.toLowerCase().includes(menuSearch.toLowerCase()))
                    .map((meal) => {
                      const isLow = meal.stock <= 10
                      return (
                        <tr key={meal.id} className="hover:bg-[#FCFAF7] transition-colors">
                          <td className="py-3.5 px-4 font-bold text-[#162B23]">
                            <div className="flex items-center gap-3">
                              {meal.image_url ? (
                                <img
                                  src={meal.image_url}
                                  alt={meal.name}
                                  className="w-9 h-9 rounded-lg object-cover"
                                />
                              ) : (
                                <div className="w-9 h-9 rounded-lg bg-[#EBF3F0] text-[#1B5747] flex items-center justify-center font-bold text-xs">
                                  {meal.name.slice(0, 2)}
                                </div>
                              )}
                              <div>
                                <span>{meal.name}</span>
                                {meal.vegetarian ? (
                                  <span className="ml-2 text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-bold">
                                    Veg
                                  </span>
                                ) : (
                                  <span className="ml-2 text-[10px] text-red-700 bg-red-50 px-1.5 py-0.5 rounded font-bold">
                                    Non-Veg
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-[#556760]">{meal.category}</td>
                          <td className="py-3.5 px-4 font-mono font-bold text-[#1B5747]">
                            ₹{(meal.price / 100).toFixed(2)}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <span
                                className={`font-mono font-extrabold ${
                                  isLow ? 'text-amber-600' : 'text-[#162B23]'
                                }`}
                              >
                                {meal.stock}
                              </span>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleQuickStock(meal.id, meal.stock, -5)}
                                  className="w-5 h-5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center font-bold text-xs"
                                  title="Reduce 5"
                                >
                                  -
                                </button>
                                <button
                                  onClick={() => handleQuickStock(meal.id, meal.stock, +10)}
                                  className="w-5 h-5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center font-bold text-xs"
                                  title="Add 10"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            {meal.active ? (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                                Active
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs font-bold">
                                Inactive
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => onOpenEditMeal(meal)}
                              className="p-1.5 rounded-lg text-[#556760] hover:text-[#1B5747] hover:bg-[#F2ECE1]"
                              title="Edit meal"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: OPENING HOURS & SLOTS */}
      {activeTab === 'slots' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Settings Form */}
            <form
              onSubmit={handleSaveSettings}
              className="lg:col-span-7 bg-white rounded-3xl border border-[#E8E2D5] p-6 space-y-5 shadow-xs"
            >
              <div>
                <h3 className="text-lg font-black text-[#162B23]">Canteen Hours & Slot Policies</h3>
                <p className="text-xs text-[#5E7068] mt-0.5">
                  Settings automatically roll forward 15-minute pickup slots while preserving all existing student bookings.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-[#42544C] block mb-1">
                    Opening Time (IST)
                  </label>
                  <input
                    type="time"
                    value={settingsForm.open_time}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, open_time: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2DBD0] text-sm font-semibold"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#42544C] block mb-1">
                    Closing Time (IST)
                  </label>
                  <input
                    type="time"
                    value={settingsForm.close_time}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, close_time: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2DBD0] text-sm font-semibold"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#42544C] block mb-1">
                    Slot Duration (Minutes)
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="60"
                    step="5"
                    value={settingsForm.slot_duration}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        slot_duration: parseInt(e.target.value) || 15,
                      })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2DBD0] text-sm font-semibold"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#42544C] block mb-1">
                    Order Capacity Per Window
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="200"
                    value={settingsForm.slot_capacity}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        slot_capacity: parseInt(e.target.value) || 20,
                      })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2DBD0] text-sm font-semibold"
                    required
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-[#42544C] block mb-1">
                    Closed Days (Comma-separated)
                  </label>
                  <input
                    type="text"
                    value={settingsForm.closed_days}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, closed_days: e.target.value })
                    }
                    placeholder="e.g. Sunday, Saturday"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2DBD0] text-sm"
                  />
                </div>

                <div className="sm:col-span-2 pt-2 border-t border-[#F0EBE1] flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-[#162B23] block">
                      Temporary Canteen Closure
                    </span>
                    <span className="text-[11px] text-[#63736D] block">
                      Stops new slot reservations while preserving past orders.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settingsForm.is_closed}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, is_closed: e.target.checked })
                    }
                    className="w-5 h-5 text-[#1B5747] rounded focus:ring-[#1B5747]"
                  />
                </div>

                {settingsForm.is_closed && (
                  <div className="sm:col-span-2">
                    <label className="text-xs font-bold text-[#42544C] block mb-1">
                      Reason for Closure
                    </label>
                    <input
                      type="text"
                      value={settingsForm.closure_reason}
                      onChange={(e) =>
                        setSettingsForm({ ...settingsForm, closure_reason: e.target.value })
                      }
                      placeholder="e.g. Annual campus maintenance, Public Holiday"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2DBD0] text-sm"
                    />
                  </div>
                )}
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="submit"
                  disabled={isSavingSettings}
                  className="px-6 py-2.5 rounded-xl bg-[#1B5747] hover:bg-[#144236] text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-xs transition-colors"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSavingSettings ? 'Saving...' : 'Save Settings'}</span>
                </button>
              </div>
            </form>

            {/* Quick Slot Generation & Status */}
            <div className="lg:col-span-5 space-y-4">
              <div className="p-6 rounded-3xl bg-white border border-[#E8E2D5] space-y-4 shadow-xs">
                <div>
                  <h4 className="font-black text-sm text-[#162B23]">
                    Rolling Slot Generator
                  </h4>
                  <p className="text-xs text-[#5E7068] mt-1 leading-relaxed">
                    Automatic generation runs rolling 7-day pickup slots. You can also trigger an idempotent manual sync at any time.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#FAF8F3] border border-[#EFEAE0] space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#63736D]">Total Upcoming Slots:</span>
                    <strong className="font-mono text-[#1B5747]">{slots.length}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#63736D]">Slot Interval:</span>
                    <span className="font-semibold">{settings?.slot_duration || 15} minutes</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#63736D]">Capacity Per Window:</span>
                    <span className="font-semibold">{settings?.slot_capacity || 20} orders</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleManualSlotGen}
                  disabled={isGeneratingSlots}
                  className="w-full py-3 rounded-xl bg-[#E07A5F] hover:bg-[#CB674D] text-white font-bold text-xs sm:text-sm shadow-xs flex items-center justify-center gap-2 transition-colors"
                >
                  <Calendar className="w-4 h-4" />
                  <span>{isGeneratingSlots ? 'Syncing...' : 'Generate Next 7 Days of Slots'}</span>
                </button>
              </div>

              {/* Sample Upcoming Slots preview list */}
              <div className="p-5 rounded-3xl bg-white border border-[#E8E2D5] space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-[#63736D] block">
                  Next Available Windows
                </span>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {slots.slice(0, 10).map((s) => (
                    <div
                      key={s.id}
                      className="p-2 rounded-xl bg-[#FAF8F3] border border-[#EFEAE0] text-xs flex items-center justify-between font-mono"
                    >
                      <span className="text-[#162B23] font-semibold">
                        {new Date(s.starts).toLocaleDateString('en-IN', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}{' '}
                        {new Date(s.starts).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <span className="text-[11px] font-bold text-[#1B5747]">
                        {s.remaining} left
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
