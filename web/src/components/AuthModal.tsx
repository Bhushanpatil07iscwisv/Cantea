import React, { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { X, Lock, Mail, User as UserIcon, Building, ArrowRight, AlertCircle, Sparkles } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  owner?: boolean
  onSuccess?: (role: string) => void
}

export const AuthModal: React.FC<AuthModalProps> = (props) => {
  if (!props.isOpen) return null
  return <AuthModalForm key={'open'} {...props} />
}

const AuthModalForm: React.FC<AuthModalProps> = ({ isOpen, onClose, owner = false, onSuccess }) => {
  const { login, register, canteens, selectedCanteen } = useAuth()
  const [ownerMode, setOwnerMode] = useState(owner)
  const [mode, setMode] = useState<'login' | 'register'>('login')

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [canteenId, setCanteenId] = useState(selectedCanteen?.id || (canteens[0]?.id || 'campus-demo'))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      if (mode === 'login') {
        const signedIn = await login(email, password)
        onSuccess?.(signedIn.role)
      } else {
        if (!name.trim()) throw new Error('Please enter your full name')
        await register(name, email, password, canteenId)
      }
      onClose()
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your credentials.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const fillDemo = (role: 'student' | 'owner') => {
    setOwnerMode(role === 'owner')
    setEmail('')
    setPassword('')
    setMode(role === 'student' ? 'register' : 'login')
    setError(null)
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/40 backdrop-blur-xs"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="relative bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-[#E8E2D5] space-y-5 z-10"
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-black text-[#162B23]">
                {mode === 'login' ? (ownerMode ? 'Owner Login' : 'Welcome Back') : 'Create Student Account'}
              </h3>
              <p className="text-xs text-[#5C6E66] mt-0.5">
                {mode === 'login'
                  ? (ownerMode ? 'Manage inventory, menu, orders and opening hours.' : 'Sign in to access your tokens and order history.')
                  : 'Register to pre-order food and avoid queues.'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-[#73827C] hover:text-[#162B23] rounded-lg hover:bg-[#F2ECE1] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex items-center p-1 rounded-xl bg-[#F0EBE1]">
            <button
              type="button"
              onClick={() => {
                setMode('login')
                setError(null)
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                mode === 'login' ? 'bg-[#1B5747] text-white shadow-2xs' : 'text-[#4A5D55]'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setOwnerMode(false)
                setMode('register')
                setError(null)
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                mode === 'register' ? 'bg-[#1B5747] text-white shadow-2xs' : 'text-[#4A5D55]'
              }`}
            >
              Register
            </button>
          </div>

          {/* Quick access */}
          <div className="p-3 rounded-2xl bg-[#FAF8F3] border border-[#EFEAE0] space-y-2 text-xs">
            <span className="font-bold text-[#556760] flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-[#E07A5F]" />
              Choose your account type:
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fillDemo('student')}
                className="flex-1 py-1.5 px-2 rounded-lg bg-white border border-[#E2DBD0] hover:border-[#1B5747] text-[#1B5747] font-semibold text-[11px] transition-colors"
              >
                Student Sign Up
              </button>
              <button
                type="button"
                onClick={() => fillDemo('owner')}
                className="flex-1 py-1.5 px-2 rounded-lg bg-white border border-[#E2DBD0] hover:border-[#E07A5F] text-[#C55D42] font-semibold text-[11px] transition-colors"
              >
                Owner Sign In
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {ownerMode && <a href="#setup" onClick={e => { e.preventDefault(); location.hash = 'setup'; location.reload() }} className="block text-sm text-[#1B5747] underline">Set up or recover owner account</a>}
          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === 'register' && (
              <div>
                <label className="text-xs font-bold text-[#3B4D45] block mb-1">Full Name</label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-[#7A8A84] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Bhushan Patil"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-[#E2DBD0] text-sm focus:border-[#1B5747] outline-none"
                    required
                  />
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-[#3B4D45] block mb-1">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#7A8A84] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-[#E2DBD0] text-sm focus:border-[#1B5747] outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-[#3B4D45] block mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#7A8A84] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="10+ characters"
                  minLength={10}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-[#E2DBD0] text-sm focus:border-[#1B5747] outline-none"
                  required
                />
              </div>
            </div>

            {mode === 'register' && canteens.length > 0 && (
              <div>
                <label className="text-xs font-bold text-[#3B4D45] block mb-1">
                  Select Canteen
                </label>
                <div className="relative">
                  <Building className="w-4 h-4 text-[#7A8A84] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <select
                    value={canteenId}
                    onChange={(e) => setCanteenId(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-[#E2DBD0] text-sm focus:border-[#1B5747] outline-none bg-white font-medium"
                  >
                    {canteens.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.organization})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 rounded-xl bg-[#1B5747] hover:bg-[#144236] text-white font-bold text-sm shadow-xs flex items-center justify-center gap-2 transition-all mt-4"
            >
              {isSubmitting ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Processing...
                </span>
              ) : (
                <>
                  <span>{mode === 'login' ? 'Sign In' : 'Create Account'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
