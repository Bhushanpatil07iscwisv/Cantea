import type {
  Canteen,
  MenuItem,
  Order,
  OwnerSettings,
  OwnerSummary,
  PaymentConfig,
  Slot,
  SlotsInfo,
  User,
} from './types'

export const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

function getToken(): string | null {
  return localStorage.getItem('cantea_token')
}

export function setStoredToken(token: string | null) {
  if (token) {
    localStorage.setItem('cantea_token', token)
  } else {
    localStorage.removeItem('cantea_token')
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  customToken?: string
): Promise<T> {
  const token = customToken !== undefined ? customToken : getToken()
  const headers = new Headers(options.headers || {})

  if (options.body && !headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  let response: Response
  try {
    response = await fetch(`${API_BASE}${endpoint}`, { ...options, headers })
  } catch {
    throw new ApiError(0, 'Cannot connect to Cantea. Keep the Cantea server window open and try again.')
  }

  if (!response.ok) {
    let errorMsg = `HTTP Error ${response.status}`
    try {
      const data = await response.json()
      if (typeof data.detail === 'string') {
        errorMsg = data.detail
      } else if (Array.isArray(data.detail)) {
        errorMsg = data.detail.map((e: any) => e.msg || JSON.stringify(e)).join(', ')
      } else if (data.message) {
        errorMsg = data.message
      }
    } catch {
      // Non-JSON response
    }
    throw new ApiError(response.status, errorMsg)
  }

  return response.json() as Promise<T>
}

export const api = {
  changePassword: (current_password: string, new_password: string) => request<{ok: boolean}>('/me/password', {method: 'POST', body: JSON.stringify({current_password, new_password})}),
  // Public
  fetchCanteens: () => request<Canteen[]>('/canteens'),
  fetchPaymentConfig: () => request<PaymentConfig>('/payment-config'),

  // Auth
  register: (body: { name: string; email: string; password: string; canteen_id: string }) =>
    request<{ token: string; user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  login: (body: { email: string; password: string }) =>
    request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  logout: () =>
    request<{ ok: boolean }>('/auth/logout', {
      method: 'POST',
    }),

  getMe: () => request<User>('/me'),
  deleteMe: () => request<{ ok: boolean; message: string }>('/me', { method: 'DELETE' }),

  // Menu & Slots
  fetchMenu: (canteenId?: string) =>
    request<MenuItem[]>(`/menu${canteenId ? `?canteen_id=${encodeURIComponent(canteenId)}` : ''}`),
  fetchSlots: (canteenId?: string) =>
    request<Slot[]>(`/slots${canteenId ? `?canteen_id=${encodeURIComponent(canteenId)}` : ''}`),
  fetchSlotsInfo: (canteenId?: string) =>
    request<SlotsInfo>(`/slots/info${canteenId ? `?canteen_id=${encodeURIComponent(canteenId)}` : ''}`),

  // Orders
  createOrder: (body: { slot_id: string; items: { menu_id: string; quantity: number }[]; payment_mode: 'cash' | 'online' }, idempotencyKey: string) =>
    request<Order>('/orders', {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify(body),
    }),

  fetchOrders: () => request<Order[]>('/orders'),

  editOrderItems: (orderId: string, items: { menu_id: string; quantity: number }[]) =>
    request<Order>(`/orders/${orderId}/items`, {
      method: 'PUT',
      body: JSON.stringify({ items }),
    }),

  requestCancellation: (orderId: string, reason: string) =>
    request<{ ok: boolean }>(`/orders/${orderId}/cancel-request`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  startCheckout: (orderId: string) =>
    request<{ url: string }>(`/orders/${orderId}/checkout`, {
      method: 'POST',
    }),

  ownerInventoryHistory: () => request<Array<{id: number; item_name: string; delta: number; balance: number; reason: string; created: number}>>('/owner/inventory/history'),
  ownerAdjustInventory: (id: string, delta: number, reason: string, requestId: string) =>
    request<{stock: number}>(`/owner/inventory/${id}/adjust`, {method: 'POST', body: JSON.stringify({delta, reason, request_id: requestId})}),
  ownerAddSuggestions: () => request<{added: number}>('/owner/menu-suggestions', {method: 'POST'}),

  // Owner Operations
  ownerChangeStatus: (orderId: string, status: 'preparing' | 'ready' | 'collected', pickup_code = '') =>
    request<{ ok: boolean }>(`/owner/orders/${orderId}/status`, {
      method: 'POST',
      body: JSON.stringify({ status, pickup_code }),
    }),

  ownerRecordCash: (orderId: string) =>
    request<{ ok: boolean }>(`/owner/orders/${orderId}/cash`, {
      method: 'POST',
    }),

  ownerCancelDecision: (orderId: string, approve: boolean) =>
    request<{ ok: boolean }>(`/owner/orders/${orderId}/cancel-decision`, {
      method: 'POST',
      body: JSON.stringify({ approve }),
    }),

  ownerRefundConfirm: (orderId: string, reference: string) =>
    request<{ ok: boolean }>(`/owner/orders/${orderId}/refund-confirm`, {
      method: 'POST',
      body: JSON.stringify({ reference }),
    }),

  ownerAddMenu: (meal: Omit<MenuItem, 'id' | 'canteen_id'>) =>
    request<{ id: string }>('/owner/menu', {
      method: 'POST',
      body: JSON.stringify({
        ...meal,
        active: Boolean(meal.active),
        vegetarian: Boolean(meal.vegetarian),
      }),
    }),

  ownerUpdateMenu: (id: string, meal: Omit<MenuItem, 'id' | 'canteen_id'>) =>
    request<{ ok: boolean }>(`/owner/menu/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        ...meal,
        active: Boolean(meal.active),
        vegetarian: Boolean(meal.vegetarian),
      }),
    }),

  ownerDeleteMenu: (id: string) =>
    request<{ ok: boolean; message: string }>(`/owner/menu/${id}`, {
      method: 'DELETE',
    }),

  ownerUpdateStock: (id: string, stock: number) =>
    request<{ ok: boolean; stock: number }>(`/owner/menu/${id}/stock`, {
      method: 'POST',
      body: JSON.stringify({ stock }),
    }),

  ownerGetSettings: () => request<OwnerSettings>('/owner/settings'),
  ownerUpdateSettings: (settings: Omit<OwnerSettings, 'canteen_id' | 'name' | 'organization' | 'kind' | 'timezone'>) =>
    request<{ ok: boolean }>('/owner/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    }),

  ownerGenerateSlots: (days = 7) =>
    request<{ ok: boolean; created: number; total_future_slots: number }>('/owner/slots/generate', {
      method: 'POST',
      body: JSON.stringify({ days }),
    }),

  ownerGetSummary: () => request<OwnerSummary>('/owner/summary'),
}
