import { useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import type { CookLogEntry } from '../../types'
import { formatDate, todayISO } from '../../lib/util'
import { CalendarIcon, EditIcon, JournalIcon, PlusIcon, TrashIcon } from '../ui/icons'
import { StarRating } from './StarRating'

interface FormState {
  recipeId: string
  dateCooked: string
  rating: number
  notes: string
}

export function Journal() {
  const { cookLog, recipes, addCookLog, updateCookLog, deleteCookLog, pushToast, setSection } =
    useApp()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(blankForm(recipes[0]?.id))

  const entries = useMemo(
    () => [...cookLog].sort((a, b) => b.dateCooked.localeCompare(a.dateCooked)),
    [cookLog]
  )

  const avgRating = useMemo(() => {
    const rated = cookLog.filter((e) => e.rating > 0)
    if (!rated.length) return 0
    return rated.reduce((sum, e) => sum + e.rating, 0) / rated.length
  }, [cookLog])

  const openNew = () => {
    setEditingId(null)
    setForm(blankForm(recipes[0]?.id))
    setShowForm(true)
  }

  const openEdit = (entry: CookLogEntry) => {
    setEditingId(entry.id)
    setForm({
      recipeId: entry.recipeId,
      dateCooked: entry.dateCooked,
      rating: entry.rating,
      notes: entry.notes,
    })
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingId(null)
  }

  const handleSave = () => {
    const recipe = recipes.find((r) => r.id === form.recipeId)
    const recipeTitle = recipe?.title ?? 'Unknown recipe'
    if (editingId) {
      updateCookLog(editingId, {
        recipeId: form.recipeId,
        recipeTitle,
        dateCooked: form.dateCooked,
        rating: form.rating,
        notes: form.notes.trim(),
      })
      pushToast('Journal entry updated')
    } else {
      addCookLog({
        recipeId: form.recipeId,
        recipeTitle,
        dateCooked: form.dateCooked,
        rating: form.rating,
        notes: form.notes.trim(),
      })
      pushToast('Logged to your cooking journal')
    }
    closeForm()
  }

  const handleDelete = (entry: CookLogEntry) => {
    if (!window.confirm(`Delete this journal entry for "${entry.recipeTitle}"?`)) return
    deleteCookLog(entry.id)
    if (editingId === entry.id) closeForm()
    pushToast('Journal entry deleted', 'info')
  }

  const canLog = recipes.length > 0

  return (
    <div className="mx-auto max-w-3xl px-3 py-5 sm:px-6 sm:py-8">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-800 sm:text-3xl">
            Cooking Journal
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            {cookLog.length === 0
              ? 'Track what you cook, when, and how it went'
              : `${cookLog.length} ${cookLog.length === 1 ? 'cook' : 'cooks'} logged${
                  avgRating > 0 ? ` · ${avgRating.toFixed(1)}★ average` : ''
                }`}
          </p>
        </div>
        {!showForm && canLog && (
          <button onClick={openNew} className="btn-primary">
            <PlusIcon width={18} height={18} /> Log a cook
          </button>
        )}
      </div>

      {/* Add / edit form */}
      {showForm && (
        <div className="card mb-5 animate-slide-up p-4 sm:p-5">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
            {editingId ? 'Edit entry' : 'New entry'}
          </h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-slate-500">Recipe</span>
              <select
                value={form.recipeId}
                onChange={(e) => setForm((f) => ({ ...f, recipeId: e.target.value }))}
                className="tap-target rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-800 outline-none focus:border-herb-400"
              >
                {recipes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-slate-500">Date cooked</span>
              <input
                type="date"
                value={form.dateCooked}
                max={todayISO()}
                onChange={(e) => setForm((f) => ({ ...f, dateCooked: e.target.value }))}
                className="tap-target rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-800 outline-none focus:border-herb-400"
              />
            </label>
          </div>

          <div className="mt-4 flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-slate-500">Rating</span>
            <StarRating
              value={form.rating}
              onChange={(rating) => setForm((f) => ({ ...f, rating }))}
              size={26}
            />
          </div>

          <label className="mt-4 flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-slate-500">Notes</span>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={3}
              placeholder="How did it turn out? Any tweaks for next time?"
              className="resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-800 outline-none placeholder:text-slate-400 focus:border-herb-400"
            />
          </label>

          <div className="mt-4 flex justify-end gap-2">
            <button onClick={closeForm} className="btn-secondary">
              Cancel
            </button>
            <button onClick={handleSave} disabled={!form.recipeId} className="btn-primary">
              {editingId ? 'Save changes' : 'Save entry'}
            </button>
          </div>
        </div>
      )}

      {/* Entries / empty state */}
      {entries.length === 0 && !showForm ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white/60 px-6 py-16 text-center">
          <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-herb-50 text-herb-500">
            <JournalIcon width={32} height={32} />
          </span>
          <h2 className="text-lg font-bold text-slate-800">No cooks logged yet</h2>
          <p className="mt-1 max-w-xs text-sm text-slate-500">
            Made something? Log the date, rate it, and jot down notes so next time is even better.
          </p>
          {canLog ? (
            <button onClick={openNew} className="btn-primary mt-4">
              <PlusIcon width={16} height={16} /> Log your first cook
            </button>
          ) : (
            <button onClick={() => setSection('repository')} className="btn-primary mt-4">
              Browse recipes
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <article key={entry.id} className="card p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-bold text-slate-800">{entry.recipeTitle}</h3>
                  <p className="mt-0.5 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
                    <CalendarIcon width={14} height={14} /> {formatDate(entry.dateCooked)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => openEdit(entry)}
                    className="tap-target flex items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                    aria-label="Edit entry"
                  >
                    <EditIcon width={18} height={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(entry)}
                    className="tap-target flex items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                    aria-label="Delete entry"
                  >
                    <TrashIcon width={18} height={18} />
                  </button>
                </div>
              </div>

              {entry.rating > 0 && (
                <div className="mt-2">
                  <StarRating value={entry.rating} size={18} />
                </div>
              )}

              {entry.notes && (
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
                  {entry.notes}
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

function blankForm(recipeId: string | undefined): FormState {
  return { recipeId: recipeId ?? '', dateCooked: todayISO(), rating: 0, notes: '' }
}
