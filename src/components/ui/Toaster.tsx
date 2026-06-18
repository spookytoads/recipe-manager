import { useApp } from '../../context/AppContext'
import { AlertIcon, CheckIcon, CloseIcon } from './icons'

export function Toaster() {
  const { toasts, dismissToast } = useApp()

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-3">
      {toasts.map((t) => {
        const tone =
          t.type === 'error'
            ? 'border-red-200 bg-red-50 text-red-800'
            : t.type === 'info'
              ? 'border-slate-200 bg-white text-slate-800'
              : 'border-royal/20 bg-white text-royal-ink'
        return (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex w-full max-w-sm animate-toast-in items-start gap-2.5 rounded-xl border px-4 py-3 shadow-lg ${tone}`}
          >
            <span className="mt-0.5 shrink-0">
              {t.type === 'error' ? <AlertIcon width={18} height={18} /> : <CheckIcon width={18} height={18} />}
            </span>
            <p className="flex-1 text-sm font-medium leading-snug">{t.message}</p>
            <button
              onClick={() => dismissToast(t.id)}
              className="shrink-0 rounded-md p-0.5 opacity-60 transition-opacity hover:opacity-100"
              aria-label="Dismiss"
            >
              <CloseIcon width={16} height={16} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
