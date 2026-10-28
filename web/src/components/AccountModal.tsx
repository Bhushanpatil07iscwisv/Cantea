import { api } from '../api'
import React, { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { X, AlertTriangle, LogOut, Trash2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'


interface AccountModalProps {
  isOpen: boolean
  onClose: () => void
}

export const AccountModal: React.FC<AccountModalProps> = (props) => {
  if (!props.isOpen) return null
  return <AccountModalForm key={'open'} {...props} />
}

const AccountModalForm: React.FC<AccountModalProps> = ({ isOpen, onClose }) => {
  const { user, selectedCanteen, logout, deleteAccount } = useAuth()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  if (!isOpen || !user) return null

  const handleDelete = async () => {
    setIsDeleting(true)
    setDeleteError(null)
    try {
      await deleteAccount()
      onClose()
    } catch (err: any) {
      setDeleteError(err.message || 'Could not delete account. Make sure active orders are settled.')
    } finally {
      setIsDeleting(false)
    }
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
          className="relative bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-[#E8E2D5] space-y-5 z-10"
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black text-[#162B23]">Account Details</h3>
            <button
              onClick={onClose}
              className="p-2 text-[#73827C] hover:text-[#162B23] rounded-lg hover:bg-[#F2ECE1] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* User Details Card */}
          <div className="p-4 rounded-2xl bg-[#FAF8F3] border border-[#EFEAE0] space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-[#1B5747] text-white flex items-center justify-center font-bold text-lg">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h4 className="font-extrabold text-base text-[#162B23]">{user.name}</h4>
                <p className="text-xs text-[#5F716A]">{user.email}</p>
              </div>
            </div>

            <div className="pt-2 border-t border-[#ECE5D8] grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-[#7E8F88] block">Role</span>
                <span className="font-bold text-[#162B23] capitalize">{user.role}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-[#7E8F88] block">Canteen</span>
                <span className="font-bold text-[#162B23] truncate block">
                  {selectedCanteen?.name || user.canteen_id}
                </span>
              </div>
            </div>
          </div>

          <form className="space-y-3 border-t pt-4" onSubmit={async e => {
            e.preventDefault(); setPasswordMessage('')
            if (newPassword !== confirmation) { setPasswordMessage('New passwords do not match.'); return }
            setSavingPassword(true)
            try { await api.changePassword(currentPassword, newPassword); setCurrentPassword(''); setNewPassword(''); setConfirmation(''); setPasswordMessage('Password updated. Other devices have been signed out.') }
            catch (error) { setPasswordMessage(error instanceof Error ? error.message : 'Could not change password.') }
            finally { setSavingPassword(false) }
          }}>
            <h4 className="font-bold">Change password</h4>
            {[[currentPassword, setCurrentPassword, 'Current password'], [newPassword, setNewPassword, 'New password'], [confirmation, setConfirmation, 'Confirm new password']].map(([value, setter, label], i) => <label className="block text-xs" key={i}>{label as string}<input className="block w-full border rounded-xl p-2 mt-1" type="password" required minLength={i ? 10 : 1} maxLength={128} autoComplete={i ? 'new-password' : 'current-password'} value={value as string} onChange={e => (setter as (s: string) => void)(e.target.value)} /></label>)}
            <p role="status" className="text-sm">{passwordMessage}</p>
            <button disabled={savingPassword} className="rounded-xl bg-[#1B5747] text-white px-4 py-2 disabled:opacity-50">{savingPassword ? 'Saving…' : 'Update password'}</button>
          </form>
          {/* Delete Account Safeguard */}
          <div className="pt-3 border-t border-[#F0EBE1] space-y-3">
            {deleteError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-semibold flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{deleteError}</span>
              </div>
            )}

            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="text-xs font-semibold text-red-600 hover:text-red-700 flex items-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Account</span>
              </button>
            ) : (
              <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-xs space-y-2 text-red-900">
                <p className="font-bold">Are you sure you want to delete your account?</p>
                <p className="text-[11px] text-red-800 leading-relaxed">
                  Personal profile details and sessions will be removed immediately. In accordance with policy, active orders must be completed or settled first.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition-colors"
                  >
                    {isDeleting ? 'Deleting...' : 'Yes, Delete My Account'}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="px-3 py-1.5 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold text-xs transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="pt-2 flex justify-end">
            <button
              onClick={() => {
                logout()
                onClose()
              }}
              className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
