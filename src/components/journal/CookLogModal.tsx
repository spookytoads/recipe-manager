import { useEffect, useState } from 'react'
import type { Recipe } from '../../types'
import { useApp } from '../../context/AppContext'
import { todayISO } from '../../lib/util'
import { CloseIcon, JournalIcon } from '../ui/icons'
import { StarRating } from './StarRating'

/**
 * Quick "mark cooked" capture popup. Pre-filled for one recipe; saves a journal
 * entry without leaving the current screen.
 */
export function CookLogModal({ recipe, onClose }: { recipe: Recipe; onClose: () => void }) {
  const { addCookLog, pushToast } = useApp()
  const [dateCooked, setDateCooked] = useState(todayISO())
  const [rating, setRating] = useState(0)
  const [notes, setNotes] = useState('')

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

  const handleSave = () => {
    addCookLog({
      recipeId: recipe.id,
      recipeTitle: recipe.title,
      dateCooked,
      rating,
      notes: notes.trim(),
    })
    pushToast(`Logged "${recipe.title}" to your journal`)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex animate-fade-in items-end justify-center bg-slate-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Log ${recipe.title}`}
    >
      <div
        className="w-full max-w-md animate-slide-up rounded-t-3xl bg-cream p-5 shadow-2xl sm:rounded-3xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-herb-100 text-herb-600">
              <JournalIcon width={20} height={20} />
            </span>
            <div className="min-w-0">
              <h2 className="text-lg font-extrabold leading-tight tracking-tight text-slate-800">
                Mark as cooked
              </h2>
              <p className="truncate text-sm text-slate-500">{recipe.title}</p>
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

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-slate-500">Date cooked</span>
          <input
            type="date"
            value={dateCooked}
            max={todayISO()}
            onChange={(e) => setDateCooked(e.target.value)}
            className="tap-target rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-800 outline-none focus:border-herb-400"
          />
        </label>

        <div className="mt-4 flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-slate-500">Rating</span>
          <StarRating value={rating} onChange={setRating} size={28} />
        </div>

        <label className="mt-4 flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-slate-500">Notes</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="How did it turn out? Any tweaks for next time?"
            className="resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-800 outline-none placeholder:text-slate-400 focus:border-herb-400"
          />
        </label>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button onClick={handleSave} className="btn-primary">
            Save to journal
          </button>
        </div>
      </div>
    </div>
  )
}
