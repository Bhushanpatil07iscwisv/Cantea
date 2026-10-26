export type Role = 'student' | 'owner'

export interface User {
  id: string
  name: string
  email: string
  role: Role
  canteen_id: string
}

export interface Canteen {
  id: string
  name: string
  organization: string
  kind: string
  timezone: string
}

export interface MenuItem {
  id: string
  canteen_id: string
  name: string
  category: string
  price: number // in integer paise
  stock: number
  active: number | boolean
  vegetarian: number | boolean
  allergens: string
  image_url?: string
  description?: string
}

export interface Slot {
  id: string
  canteen_id: string
  starts: string // ISO string in UTC
  ends: string   // ISO string in UTC
  capacity: number
  remaining: number
}

export interface OrderItem {
  order_id: string
  menu_id: string
  name: string
  price: number // in integer paise
  quantity: number
}

export type OrderStatus = 'placed' | 'preparing' | 'ready' | 'collected' | 'cancelled'
export type PaymentMode = 'cash' | 'online'
export type PaymentStatus = 'due' | 'paid' | 'refund_due' | 'refunded'

export interface Order {
  id: string
  user_id: string
  canteen_id: string
  slot_id: string
  token: string
  pickup_code: string
  status: OrderStatus
  payment_mode: PaymentMode
  payment_status: PaymentStatus
  total: number // in integer paise
  created: number
  expires: number
  cancel_requested: number
  cancel_reason: string
  refund_reference?: string
  items: OrderItem[]
  slot: Slot
}

export interface CartItem {
  meal: MenuItem
  quantity: number
}

export interface SlotsInfo {
  canteen_name: string
  timezone: string
  open_time: string
  close_time: string
  slot_duration: number
  slot_capacity: number
  closed_days: string[]
  is_closed: boolean
  closure_reason: string
  available_slots_count: number
  next_opening: string | null
  status_message: string
  earliest_slot: string | null
}

export interface OwnerSettings {
  canteen_id: string
  name: string
  organization: string
  kind: string
  timezone: string
  open_time: string
  close_time: string
  slot_duration: number
  slot_capacity: number
  closed_days: string
  is_closed: boolean
  closure_reason: string
}

export interface OwnerSummary {
  orders: number
  paid: number
  refund_due: number
  total_orders: number
  total_revenue: number
  today_orders: number
  today_revenue: number
  active_orders: number
  cancellation_requests: number
  low_stock_count: number
  low_stock_items: MenuItem[]
}

export interface PaymentConfig {
  online_available: boolean
  razorpay_key_id: string | null
  currency: string
}
