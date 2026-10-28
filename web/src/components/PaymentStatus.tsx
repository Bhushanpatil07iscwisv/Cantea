import { useEffect, useState } from 'react'
import { api } from '../api'
import type { PaymentConfig } from '../types'
export function PaymentStatus() {
  const [config, setConfig] = useState<PaymentConfig | null>(null)
  const [error, setError] = useState('')
  const load = () => { setError(''); api.fetchPaymentConfig().then(setConfig).catch(e => setError(e.message)) }
  useEffect(() => { api.fetchPaymentConfig().then(setConfig).catch(e => setError(e.message)) }, [])
  return <details className="my-4 bg-white border border-[#E8E2D5] p-4 rounded-2xl">
    <summary className="font-bold cursor-pointer">Online payments · {config ? (config.online_available ? (config.razorpay_key_id?.startsWith('rzp_test_') ? 'Test mode' : 'Enabled') : 'Setup required') : 'Checking…'}</summary>
    <div className="text-sm mt-3 space-y-2">
      <p>Students can choose Pay online in checkout, or Pay at counter. Razorpay handles the available payment methods. Only verified captured payments are marked paid.</p>
      <p>To activate: open your hosting dashboard → Environment. Add RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET and RAZORPAY_WEBHOOK_SECRET, then restart the service. Keep secrets out of the frontend and GitHub.</p>
      <p>In Razorpay, configure a payment.captured webhook pointing to your website address followed by <code>/api/payments/webhook</code>. Start with test keys before enabling live payments.</p>
      <p>Local use: put the same settings in backend/.env and restart Cantea. All ordering and payment actions happen in the browser.</p>
      {error && <p role="alert">{error}</p>}
      <button onClick={load} className="underline text-[#1B5747]">Refresh payment status</button>
    </div>
  </details>
}
