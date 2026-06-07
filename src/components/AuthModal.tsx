import { useEffect, useState, type FormEvent } from 'react'
import { useApp } from '../context/AppContext'
import { AlertIcon, CheckIcon, CloseIcon, CloudIcon } from './ui/icons'
import { Spinner } from './ui/Spinner'

export function AuthModal({ onClose }: { onClose: () => void }) {
  const { user, syncStatus, signIn, signUp, signOut } = useApp()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const inputClass =
    'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-herb-400 focus:ring-2 focus:ring-herb-100'

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setInfo(null)
    if (!email.trim() || !password) {
      setError('Enter your email and a password.')
      return
    }
    setBusy(true)
    try {
      if (mode === 'signup') {
        const { needsConfirmation } = await signUp(email.trim(), password)
        if (needsConfirmation) {
          setInfo('Account created! Check your email to confirm, then sign in.')
          setMode('signin')
        }
        // Otherwise the auth listener logs us in and the view switches below.
      } else {
        await signIn(email.trim(), password)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const handleSignOut = async () => {
    setBusy(true)
    try {
      await signOut()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 animate-fade-in overflow-y-auto bg-slate-900/50 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Account"
    >
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="w-full max-w-md animate-slide-up rounded-3xl bg-cream p-5 shadow-2xl sm:p-6"
          onClick={(e) => e.stopPropagation()}
        >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-herb-100 text-herb-600">
              <CloudIcon width={20} height={20} />
            </span>
            <div>
              <h2 className="text-lg font-extrabold leading-tight tracking-tight text-slate-800">
                {user ? 'Your account' : 'Sync your recipes'}
              </h2>
              <p className="text-sm text-slate-500">
                {user ? 'Signed in — synced across your devices' : 'Sign in so your recipes follow you everywhere'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="tap-target flex shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>

        {user ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-xl border border-herb-200 bg-herb-50 px-3 py-2.5 text-sm text-herb-800">
              <CheckIcon width={18} height={18} className="shrink-0" />
              <span className="min-w-0 flex-1 truncate">{user.email}</span>
              <SyncBadge status={syncStatus} />
            </div>
            <p className="text-sm text-slate-500">
              Your recipes, shopping list, and cooking journal are saved to your account and will
              appear on any device you sign in to.
            </p>
            <button onClick={handleSignOut} disabled={busy} className="btn-secondary w-full">
              {busy ? <Spinner size={16} /> : null} Sign out
            </button>
            <p className="text-center text-xs text-slate-400">
              Signing out keeps your recipes on this device; they just stop syncing.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-slate-500">Email</span>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-slate-500">Password</span>
              <input
                type="password"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className={inputClass}
              />
            </label>

            {info && (
              <div className="flex items-start gap-2 rounded-lg border border-herb-200 bg-herb-50 px-3 py-2 text-sm text-herb-800">
                <CheckIcon width={16} height={16} className="mt-0.5 shrink-0" />
                <span>{info}</span>
              </div>
            )}
            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                <AlertIcon width={16} height={16} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button type="submit" disabled={busy} className="btn-primary w-full">
              {busy ? <Spinner size={16} /> : null}
              {mode === 'signup' ? 'Create account' : 'Sign in'}
            </button>

            <p className="text-center text-sm text-slate-500">
              {mode === 'signup' ? 'Already have an account?' : 'New here?'}{' '}
              <button
                type="button"
                onClick={() => {
                  setMode(mode === 'signup' ? 'signin' : 'signup')
                  setError(null)
                  setInfo(null)
                }}
                className="font-semibold text-herb-600 hover:underline"
              >
                {mode === 'signup' ? 'Sign in' : 'Create one'}
              </button>
            </p>
          </form>
        )}
        </div>
      </div>
    </div>
  )
}

function SyncBadge({ status }: { status: string }) {
  const label =
    status === 'syncing'
      ? 'Syncing…'
      : status === 'synced'
        ? 'Synced'
        : status === 'error'
          ? 'Sync error'
          : ''
  if (!label) return null
  const tone =
    status === 'error' ? 'bg-red-100 text-red-700' : 'bg-white text-herb-700 border border-herb-200'
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone}`}>{label}</span>
}
