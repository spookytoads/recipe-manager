import { useEffect, useMemo } from 'react'
import type { Recipe } from '../../types'
import { useApp } from '../../context/AppContext'
import { formatDate, formatMeasure, proteinLabel, sourceLabel } from '../../lib/util'
import { BookIcon, CalendarIcon, CartIcon, ChefIcon, ClockIcon, CloseIcon, TrashIcon } from '../ui/icons'
import { Thumbnail } from './Thumbnail'
import { hasNutrition, NutritionPanel } from './NutritionPanel'
import { StarRating } from '../journal/StarRating'
import { reviewsForRecipe } from '../../lib/reviews'

export function RecipeDetailModal({
  recipe,
  onClose,
}: {
  recipe: Recipe
  onClose: () => void
}) {
  const { addRecipeToShopping, addToCookQueue, startCooking, pushToast, deleteRecipe, cookLog } =
    useApp()

  // Past cooks of this recipe, newest first, for the rating summary + reviews.
  const reviews = useMemo(
    () => reviewsForRecipe(cookLog, recipe).sort((a, b) => b.dateCooked.localeCompare(a.dateCooked)),
    [cookLog, recipe]
  )
  const rated = reviews.filter((e) => e.rating > 0)
  const avgRating = rated.length ? rated.reduce((s, e) => s + e.rating, 0) / rated.length : 0
  const withNotes = reviews.filter((e) => e.notes.trim() || e.rating > 0)

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

  const handleAddToShopping = () => {
    addRecipeToShopping(recipe)
    addToCookQueue(recipe)
    pushToast(
      `Added ${recipe.ingredients.length} ingredients to your shopping list · queued for cooking`
    )
    onClose()
  }

  const handleStartCooking = () => {
    startCooking(recipe)
    onClose()
  }

  const handleDelete = () => {
    if (recipe.id.startsWith('seed-')) {
      if (!window.confirm('Delete this sample recipe? It will be removed from your library.')) return
    } else if (!window.confirm(`Delete "${recipe.title}"? This cannot be undone.`)) {
      return
    }
    deleteRecipe(recipe.id)
    pushToast('Recipe deleted', 'info')
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex animate-fade-in items-end justify-center bg-slate-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={recipe.title}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-2xl animate-slide-up flex-col overflow-hidden rounded-t-3xl bg-cream shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative shrink-0">
          <Thumbnail seed={recipe.id} label={recipe.title} className="h-32 w-full sm:h-40" />
          <button
            onClick={onClose}
            className="tap-target absolute right-3 top-3 flex items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-sm transition-colors hover:bg-white"
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 sm:px-7">
          <p className="text-xs font-semibold uppercase tracking-wide text-herb-600">
            {recipe.cuisine}
          </p>
          <h2 className="mt-0.5 text-2xl font-extrabold tracking-tight text-slate-800">
            {recipe.title}
          </h2>

          {reviews.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
              {avgRating > 0 && (
                <>
                  <StarRating value={Math.round(avgRating)} size={18} />
                  <span className="text-sm font-bold text-slate-700">{avgRating.toFixed(1)}</span>
                </>
              )}
              <span className="text-sm text-slate-500">
                {avgRating > 0 ? '·' : ''} Cooked {reviews.length}{' '}
                {reviews.length === 1 ? 'time' : 'times'}
                {avgRating === 0 ? ' · not rated yet' : ''}
              </span>
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-600">
            <span className="inline-flex items-center gap-1.5">
              <ClockIcon width={16} height={16} /> Prep {recipe.prepTime}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ClockIcon width={16} height={16} /> Cook {recipe.cookTime}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ChefIcon width={16} height={16} /> Serves {recipe.servings}
              {recipe.servingSize ? ` · ${recipe.servingSize}` : ''}
            </span>
          </div>

          <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-slate-400">
            <BookIcon width={14} height={14} /> {sourceLabel(recipe.sourceFile)}
          </p>

          {(recipe.protein.length > 0 || recipe.tags.length > 0) && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {recipe.protein.map((p) => (
                <span
                  key={p}
                  className="rounded-full bg-herb-100 px-2.5 py-1 text-xs font-semibold text-herb-700"
                >
                  {proteinLabel(p)}
                </span>
              ))}
              {recipe.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600"
                >
                  #{t}
                </span>
              ))}
            </div>
          )}

          {/* Nutrition (only when the recipe provides it) */}
          {hasNutrition(recipe.nutrition) && (
            <section className="mt-5">
              <NutritionPanel nutrition={recipe.nutrition} />
            </section>
          )}

          {/* Ingredients */}
          <section className="mt-6">
            <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">
              Ingredients
            </h3>
            <ul className="divide-y divide-slate-200/70 rounded-xl border border-slate-200/70 bg-white">
              {recipe.ingredients.map((ing) => (
                <li key={ing.id} className="flex items-baseline justify-between gap-3 px-4 py-2.5">
                  <span className="text-slate-700">{ing.name}</span>
                  <span className="shrink-0 text-right text-sm font-semibold text-slate-500">
                    {formatMeasure(ing.quantity, ing.unit, ing.altQuantity, ing.altUnit)}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {/* Steps */}
          <section className="mt-6">
            <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">Steps</h3>
            <ol className="space-y-3">
              {recipe.steps.map((step) => (
                <li key={step.id} className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-herb-500 text-sm font-bold text-white">
                    {step.order}
                  </span>
                  <p className="pt-0.5 leading-relaxed text-slate-700">{step.instruction}</p>
                </li>
              ))}
            </ol>
          </section>

          {/* Past reviews from the cooking journal */}
          {withNotes.length > 0 && (
            <section className="mt-6">
              <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">
                Reviews
              </h3>
              <ul className="space-y-2">
                {withNotes.map((entry) => (
                  <li key={entry.id} className="rounded-xl border border-slate-200/70 bg-white p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      {entry.rating > 0 ? (
                        <StarRating value={entry.rating} size={16} />
                      ) : (
                        <span className="text-xs font-medium text-slate-400">Not rated</span>
                      )}
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400">
                        <CalendarIcon width={13} height={13} /> {formatDate(entry.dateCooked)}
                      </span>
                    </div>
                    {entry.notes.trim() && (
                      <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
                        {entry.notes}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <button
            onClick={handleDelete}
            className="btn-ghost mt-6 text-sm text-red-500 hover:bg-red-50 hover:text-red-600"
          >
            <TrashIcon width={16} height={16} /> Delete recipe
          </button>
        </div>

        {/* Sticky actions */}
        <div className="grid shrink-0 grid-cols-1 gap-2 border-t border-slate-200/70 bg-white p-4 sm:grid-cols-2">
          <button onClick={handleAddToShopping} className="btn-secondary">
            <CartIcon width={18} height={18} /> Add to Shopping List
          </button>
          <button onClick={handleStartCooking} className="btn-primary">
            <ChefIcon width={18} height={18} /> Start Cooking
          </button>
        </div>
      </div>
    </div>
  )
}
