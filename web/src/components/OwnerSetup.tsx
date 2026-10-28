import { useEffect, useState } from 'react'
import { API_BASE } from '../api'
import { useAuth } from '../context/AuthContext'

export function OwnerSetup() {
  const { canteens } = useAuth()
  const [open, setOpen] = useState(location.hash.startsWith('#setup'))
  const [key, setKey] = useState(() => {
    const value = new URLSearchParams(location.hash.slice(1)).get('setup') || ''
    return value
  })
  useEffect(() => { if (location.hash.startsWith('#setup=')) history.replaceState(null, '', location.pathname + location.search) }, [])
  const [privateLink] = useState(Boolean(key))
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  if (!open) return null
  return <div className="fixed inset-0 z-[70] bg-black/50 overflow-y-auto p-4 flex items-start justify-center">
    <form className="bg-[#FAF8F3] rounded-3xl p-6 my-8 w-full max-w-lg space-y-4 shadow-xl" onSubmit={async e => {
      e.preventDefault(); setBusy(true); setMessage('')
      const data = Object.fromEntries(new FormData(e.currentTarget))
      if (data.password !== data.confirm) { setMessage('Passwords do not match.'); setBusy(false); return }
      delete data.confirm
      try {
        const response = await fetch(API_BASE + '/setup/owner', {method: 'POST', headers: {'Content-Type': 'application/json', 'X-Setup-Token': key}, body: JSON.stringify(data)})
        const result = await response.json()
        if (!response.ok) throw new Error(typeof result.detail === 'string' ? result.detail : 'Check the form fields.')
        setKey(''); setMessage('Owner account saved. Close this form, then select Owner Login and sign in with your email and new password.')
      } catch (error) { setMessage(error instanceof Error ? error.message : 'Cannot connect to the server.') }
      finally { setBusy(false) }
    }}>
      <div className="flex justify-between"><h2 className="text-xl font-bold">Owner setup & recovery</h2><button type="button" aria-label="Close setup" onClick={() => { setOpen(false); history.replaceState(null, '', location.pathname); location.reload() }}>✕</button></div>
      <p className="text-sm">Create an owner account or reset an existing owner's password. Your orders and inventory stay saved.</p>
      {!privateLink && <label className="block text-sm">Private setup key<input required type="password" value={key} onChange={e => setKey(e.target.value)} className="w-full border p-3 rounded-xl" /><span className="text-xs">On your computer, open OWNER_ACCOUNT.bat for a private setup link. For hosted apps, use the OWNER_SETUP_TOKEN set in your hosting dashboard.</span></label>}
      {canteens.length ? <label className="block text-sm">Canteen<select name="canteen_id" className="w-full border p-3 rounded-xl">{canteens.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}</select></label> : <><input name="canteen_name" required placeholder="Canteen name" className="w-full border p-3 rounded-xl" /><input name="organization" required placeholder="College / organization" className="w-full border p-3 rounded-xl" /></>}
      <input name="name" required placeholder="Owner name" maxLength={100} className="w-full border p-3 rounded-xl" />
      <input name="email" type="email" required placeholder="Owner email" autoComplete="username" className="w-full border p-3 rounded-xl" />
      <input name="password" type="password" required minLength={10} maxLength={128} placeholder="New password (10+ characters)" autoComplete="new-password" className="w-full border p-3 rounded-xl" />
      <input name="confirm" type="password" required minLength={10} maxLength={128} placeholder="Confirm password" autoComplete="new-password" className="w-full border p-3 rounded-xl" />
      <p role="status" className="text-sm font-medium">{message}</p>
      <button disabled={busy || !key} className="w-full bg-[#1B5747] text-white p-3 rounded-xl disabled:opacity-50">{busy ? 'Saving…' : 'Save owner account'}</button>
    </form>
  </div>
}
