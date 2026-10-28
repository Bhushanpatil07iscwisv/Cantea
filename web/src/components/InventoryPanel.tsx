import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import type { MenuItem } from '../types'

export function InventoryPanel({ onChange }: { onChange: () => void }) {
  const [items, setItems] = useState<MenuItem[]>([])
  const [history, setHistory] = useState<Awaited<ReturnType<typeof api.ownerInventoryHistory>>>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState('')
  const [quantity, setQuantity] = useState('10')
  const [operation, setOperation] = useState('receive')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const pending = useRef<{payload: string; key: string} | null>(null)
  const locked = useRef(false)
  const refresh = async () => {
    const [menu, movements] = await Promise.all([api.fetchMenu(), api.ownerInventoryHistory()])
    setItems(menu); setHistory(movements)
  }
  useEffect(() => {
    const load = () => refresh().catch((e: Error) => setNotice(e.message))
    load()
    const timer = setInterval(load, 8000)
    return () => clearInterval(timer)
  }, [])
  const adjust = async (e: React.FormEvent) => {
    e.preventDefault()
    if (locked.current) return
    const count = Number(quantity)
    if (!selected || !Number.isInteger(count) || count < 1 || count > 100000) {
      setNotice('Choose an item and a whole quantity between 1 and 100000.'); return
    }
    const delta = operation === 'receive' ? count : -count
    const description = `${operation === 'receive' ? 'Received' : operation === 'waste' ? 'Wastage' : 'Removed'}: ${reason.trim()}`
    const payload = JSON.stringify([selected, delta, description])
    if (pending.current?.payload !== payload) pending.current = {payload, key: crypto.randomUUID()}
    locked.current = true; setBusy(true)
    try {
      await api.ownerAdjustInventory(selected, delta, description, pending.current.key)
      pending.current = null
      setNotice('Stock updated. The student menu will refresh automatically.')
      setReason(''); await refresh(); onChange()
    } catch (error) { setNotice((error as Error).message) }
    finally { locked.current = false; setBusy(false) }
  }
  const suggestions = async () => {
    if (locked.current) return
    locked.current = true; setBusy(true)
    try {
      const result = await api.ownerAddSuggestions()
      setNotice(`Added ${result.added} items. Review prices and allergens in Menu & Stock, then receive stock here. Existing items were kept.`)
      await refresh(); onChange()
    } catch (error) { setNotice((error as Error).message) }
    finally { locked.current = false; setBusy(false) }
  }
  const input = 'w-full px-3 py-2 rounded-xl border border-[#E2DBD0] bg-white text-sm'
  const visible = items.filter(item => `${item.name} ${item.category}`.toLowerCase().includes(search.toLowerCase()) &&
    (filter === 'all' || (filter === 'low' && item.stock > 0 && item.stock <= 10) || (filter === 'out' && item.stock === 0) || (filter === 'inactive' && !item.active)))
  return <section className="space-y-5 text-[#162B23]">
    <div><h2 className="text-2xl font-bold">Inventory</h2><p className="text-sm text-[#556760]">Track available meal portions. Orders reserve stock; cancellations return it. Refreshes every 8 seconds.</p></div>
    {notice && <div role="status" className="p-4 rounded-xl bg-[#EBF3F0] border border-[#CCDCD4]">{notice}</div>}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {[['Menu items', items.length], ['Available portions', items.reduce((n, m) => n + m.stock, 0)], ['Low stock (1–10)', items.filter(m => m.stock > 0 && m.stock <= 10).length], ['Out of stock', items.filter(m => m.stock === 0).length]].map(([label, value]) =>
        <div key={label} className="p-4 bg-white rounded-2xl border border-[#E8E2D5]"><p className="text-xs text-[#556760]">{label}</p><strong className="text-3xl">{value}</strong></div>)}
    </div>
    <form onSubmit={adjust} className="bg-white rounded-2xl border border-[#E8E2D5] p-5 space-y-4">
      <h3 className="font-bold text-lg">Receive or remove stock</h3>
      <div className="grid sm:grid-cols-3 gap-3">
        <label className="text-sm">Menu item<select required className={input} value={selected} onChange={e => setSelected(e.target.value)}><option value="">Select item</option>{items.map(m => <option key={m.id} value={m.id}>{m.name} ({m.stock} available)</option>)}</select></label>
        <label className="text-sm">Action<select className={input} value={operation} onChange={e => setOperation(e.target.value)}><option value="receive">Receive / prepare portions</option><option value="waste">Record wastage</option><option value="remove">Remove portions</option></select></label>
        <label className="text-sm">Quantity<input required type="number" min="1" max="100000" step="1" className={input} value={quantity} onChange={e => setQuantity(e.target.value)} /></label>
      </div>
      <label className="block text-sm">Reason or delivery reference<input required maxLength={170} pattern=".*\S.*" className={input} value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Morning preparation or damaged portions" /></label>
      <button disabled={busy} className="px-5 py-2 rounded-xl bg-[#1B5747] text-white font-bold disabled:opacity-50">{busy ? 'Saving…' : 'Save stock adjustment'}</button>
    </form>
    <div className="flex flex-col sm:flex-row gap-3">
      <input aria-label="Search inventory" className={input} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search items or categories" />
      <select aria-label="Stock filter" className={input} value={filter} onChange={e => setFilter(e.target.value)}><option value="all">All items</option><option value="low">Low stock</option><option value="out">Out of stock</option><option value="inactive">Inactive</option></select>
    </div>
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{visible.map(m => <button key={m.id} onClick={() => setSelected(m.id)} className={`p-4 rounded-2xl bg-white border text-left ${selected === m.id ? 'border-[#1B5747] ring-1 ring-[#1B5747]' : 'border-[#E8E2D5]'}`}><span className="font-bold block">{m.name}</span><span className="text-xs text-[#556760]">{m.category} · ₹{(m.price / 100).toFixed(2)}{!m.active && ' · Inactive'}</span><span className={`block text-lg font-bold mt-2 ${m.stock <= 10 ? 'text-amber-700' : 'text-[#1B5747]'}`}>{m.stock === 0 ? 'Out of stock' : `${m.stock} portions available`}</span></button>)}</div>
    {!visible.length && <p className="text-sm">No items match this filter.</p>}
    <div className="p-5 rounded-2xl border border-[#E8E2D5] bg-[#FAF8F3]"><h3 className="font-bold">Expand your menu</h3><p className="text-sm my-2">Add 12 suggestions including misal pav, dosa, rajma rice, vada pav and cold coffee. New items start with zero stock so students cannot book food you have not prepared.</p><button disabled={busy} onClick={suggestions} className="px-4 py-2 bg-[#1B5747] text-white rounded-xl disabled:opacity-50">Add menu suggestions</button></div>
    <div className="bg-white rounded-2xl border border-[#E8E2D5] p-4"><h3 className="font-bold text-lg">Recent stock changes</h3><p className="text-xs text-[#556760] mb-3">Latest 100 changes recorded since this update, including order reservations and returns.</p><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{['Time (IST)', 'Item', 'Change', 'Balance', 'Reason'].map(h => <th key={h} className="p-2 whitespace-nowrap">{h}</th>)}</tr></thead><tbody>{history.map(h => <tr key={h.id} className="border-t border-[#E8E2D5]"><td className="p-2 whitespace-nowrap">{new Date(h.created * 1000).toLocaleString('en-IN', {timeZone: 'Asia/Kolkata'})}</td><td className="p-2">{h.item_name}</td><td className="p-2 font-bold">{h.delta > 0 ? '+' : ''}{h.delta}</td><td className="p-2">{h.balance}</td><td className="p-2">{h.reason}</td></tr>)}</tbody></table></div>{!history.length && <p>No stock changes recorded yet.</p>}</div>
  </section>
}
