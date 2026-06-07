import { useEffect } from 'react'
import type { Recipe } from '../../types'
import { useApp } from '../../context/AppContext'
import { formatQuantity, proteinLabel } from '../../lib/util'
import { CartIcon, ChefIcon, ClockIcon, CloseIcon, TrashIcon } from '../ui/icons'
import { Thumbnail } from './Thumbnail'

export function RecipeDetailModal({
  recipe,
  onClose,
}: {
  recipe: Recipe
  onClose: () => void
}) {
  const { addRecipeToShopping, addToCookQueue, startCooking, pushToast, deleteRecipe } = useApp()

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

          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-600">
            <span className="inline-flex items-center gap-1.5">
              <ClockIcon width={16} height={16} /> Prep {recipe.prepTime}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ClockIcon width={16} height={16} /> Cook {recipe.cookTime}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ChefIcon width={16} height={16} /> Serves {recipe.servings}
            </span>
          </div>

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

          {/* Ingredients */}
          <section className="mt-6">
            <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">
              Ingredients
            </h3>
            <ul className="divide-y divide-slate-200/70 rounded-xl border border-slate-200/70 bg-white">
              {recipe.ingredients.map((ing) => (
                <li key={ing.id} className="flex items-baseline justify-between gap-3 px-4 py-2.5">
                  <span className="text-slate-700">{ing.name}</span>
                  <span className="shrink-0 text-sm font-semibold text-slate-500">
                    {formatQuantity(ing.quantity)} {ing.unit}
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
