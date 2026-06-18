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
      className="fixed inset-0 z-50 animate-fade-in overflow-y-auto bg-slate-900/50 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Log ${recipe.title}`}
    >
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="w-full max-w-md animate-slide-up rounded-3xl bg-choc p-5 shadow-2xl sm:p-6"
          onClick={(e) => e.stopPropagation()}
        >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-pumpkin/15 text-pumpkin-ink">
              <JournalIcon width={20} height={20} />
            </span>
            <div className="min-w-0">
              <h2 className="font-serif text-lg font-medium leading-tight tracking-tight text-royal-ink">
                Mark as cooked
              </h2>
              <p className="truncate text-sm text-royal-soft">{recipe.title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="tap-target flex shrink-0 items-center justify-center rounded-full text-royal-faint hover:bg-royal/5 hover:text-royal"
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-royal-soft">Date cooked</span>
          <input
            type="date"
            value={dateCooked}
            max={todayISO()}
            onChange={(e) => setDateCooked(e.target.value)}
            className="tap-target rounded-xl border border-royal/20 bg-white px-3 py-2.5 text-royal-ink outline-none focus:border-pumpkin"
          />
        </label>

        <div className="mt-4 flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-royal-soft">Rating</span>
          <StarRating value={rating} onChange={setRating} size={28} />
        </div>

        <label className="mt-4 flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-royal-soft">Notes</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="How did it turn out? Any tweaks for next time?"
            className="resize-y rounded-xl border border-royal/20 bg-white px-3 py-2.5 text-royal-ink outline-none placeholder:text-royal-faint focus:border-pumpkin"
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
    </div>
  )
}
