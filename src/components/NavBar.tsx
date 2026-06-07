import { useApp, type Section } from '../context/AppContext'
import { aggregateKey } from '../context/AppContext'
import { BookIcon, CartIcon, ChefIcon, JournalIcon, UserIcon } from './ui/icons'
import { useMemo, useState } from 'react'
import { AuthModal } from './AuthModal'

const NAV: { id: Section; label: string; Icon: typeof BookIcon }[] = [
  { id: 'repository', label: 'Repository', Icon: BookIcon },
  { id: 'shopping', label: 'Shopping', Icon: CartIcon },
  { id: 'cook', label: 'Cook', Icon: ChefIcon },
  { id: 'journal', label: 'Journal', Icon: JournalIcon },
]

export function NavBar() {
  const { section, setSection, shopping, checkedKeys, cookQueue, cloudEnabled, user, syncStatus } =
    useApp()
  const [authOpen, setAuthOpen] = useState(false)

  const shoppingRemaining = useMemo(() => {
    const keys = new Set(shopping.map((e) => aggregateKey(e.name, e.unit, e.category)))
    let remaining = 0
    keys.forEach((k) => {
      if (!checkedKeys.includes(k)) remaining += 1
    })
    return remaining
  }, [shopping, checkedKeys])

  const badge = (id: Section): number | null => {
    if (id === 'shopping') return shoppingRemaining > 0 ? shoppingRemaining : null
    if (id === 'cook') return cookQueue.length > 0 ? cookQueue.length : null
    return null
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-cream/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 sm:px-6">
        <button
          onClick={() => setSection('repository')}
          className="flex shrink-0 items-center gap-2 py-3 pr-2 text-left"
          aria-label="Recipe Manager home"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-herb-500 text-white">
            <ChefIcon width={18} height={18} />
          </span>
          <span className="hidden text-base font-extrabold tracking-tight text-slate-800 sm:block">
            Recipe<span className="text-herb-600">Manager</span>
          </span>
        </button>

        <nav className="flex flex-1 items-center justify-center gap-1 sm:flex-none sm:justify-end">
          {NAV.map(({ id, label, Icon }) => {
            const active = section === id
            const count = badge(id)
            return (
              <button
                key={id}
                onClick={() => setSection(id)}
                aria-current={active ? 'page' : undefined}
                className={`tap-target relative flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-3 py-2 text-xs font-semibold transition-colors sm:flex-none sm:flex-row sm:gap-2 sm:text-sm ${
                  active
                    ? 'bg-herb-500 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span className="relative">
                  <Icon width={20} height={20} />
                  {count != null && (
                    <span
                      className={`absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                        active ? 'bg-white text-herb-600' : 'bg-herb-500 text-white'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </span>
                <span>{label}</span>
              </button>
            )
          })}
        </nav>

        {cloudEnabled && (
          <button
            onClick={() => setAuthOpen(true)}
            className="tap-target relative flex shrink-0 items-center justify-center rounded-xl px-2 text-slate-600 hover:bg-slate-100"
            aria-label={user ? 'Account' : 'Sign in to sync'}
            title={user ? `Signed in as ${user.email}` : 'Sign in to sync'}
          >
            <UserIcon width={20} height={20} />
            {user && (
              <span
                className={`absolute right-1 top-1.5 h-2 w-2 rounded-full ${
                  syncStatus === 'error' ? 'bg-red-500' : 'bg-herb-500'
                }`}
              />
            )}
          </button>
        )}
      </div>

      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
    </header>
  )
}
