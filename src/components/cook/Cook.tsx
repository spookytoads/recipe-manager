import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { formatMeasure, proteinLabel } from '../../lib/util'
import { CheckIcon, ChefIcon, ChevronDownIcon, ClockIcon, CloseIcon, JournalIcon } from '../ui/icons'
import { Timer } from './Timer'
import { CookLogModal } from '../journal/CookLogModal'
import { hasNutrition, NutritionPanel } from '../repository/NutritionPanel'

export function Cook() {
  const {
    recipes,
    cookQueue,
    activeCookId,
    setActiveCookId,
    removeFromQueue,
    getCookProgress,
    toggleCookIngredient,
    toggleCookStep,
    setSection,
  } = useApp()

  const [showLogModal, setShowLogModal] = useState(false)

  const queuedRecipes = useMemo(
    () => cookQueue.map((id) => recipes.find((r) => r.id === id)).filter(Boolean),
    [cookQueue, recipes]
  )

  const recipe = useMemo(
    () => recipes.find((r) => r.id === activeCookId) ?? queuedRecipes[0] ?? null,
    [recipes, activeCookId, queuedRecipes]
  )

  const [servings, setServings] = useState(recipe?.servings ?? 4)

  // Reset servings when switching recipes.
  useEffect(() => {
    if (recipe) setServings(recipe.servings)
  }, [recipe?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!recipe) {
    return (
      <div className="mx-auto max-w-3xl px-3 py-5 sm:px-6 sm:py-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-800 sm:text-3xl">Cook</h1>
        <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white/60 px-6 py-16 text-center">
          <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-herb-50 text-herb-500">
            <ChefIcon width={32} height={32} />
          </span>
          <h2 className="text-lg font-bold text-slate-800">Nothing queued to cook</h2>
          <p className="mt-1 max-w-xs text-sm text-slate-500">
            Open a recipe and tap “Start Cooking” to load it into a focused, step-by-step view.
          </p>
          <button onClick={() => setSection('repository')} className="btn-primary mt-4">
            Browse recipes
          </button>
        </div>
      </div>
    )
  }

  const progress = getCookProgress(recipe.id)
  const scale = recipe.servings > 0 ? servings / recipe.servings : 1
  const completedSteps = recipe.steps.filter((s) => progress.completedSteps.includes(s.id)).length

  return (
    <div className="mx-auto max-w-6xl px-3 py-5 sm:px-6 sm:py-8">
      {/* Top controls */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          {queuedRecipes.length > 1 ? (
            <div className="relative inline-block">
              <select
                value={recipe.id}
                onChange={(e) => setActiveCookId(e.target.value)}
                className="tap-target w-full max-w-full appearance-none truncate rounded-xl border border-slate-200 bg-white py-2.5 pl-4 pr-10 text-lg font-extrabold tracking-tight text-slate-800 shadow-sm outline-none focus:border-herb-400 sm:text-2xl"
                aria-label="Select recipe to cook"
              >
                {queuedRecipes.map(
                  (r) => r && (
                    <option key={r.id} value={r.id}>
                      {r.title}
                    </option>
                  )
                )}
              </select>
              <ChevronDownIcon
                width={20}
                height={20}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
            </div>
          ) : (
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-800 sm:text-3xl">
              {recipe.title}
            </h1>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-sm text-slate-500">
            <span className="font-medium text-herb-600">{recipe.cuisine}</span>
            <span className="inline-flex items-center gap-1">
              <ClockIcon width={14} height={14} /> {recipe.cookTime}
            </span>
            {recipe.protein.map((p) => (
              <span key={p} className="text-slate-400">
                {proteinLabel(p)}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Servings adjuster */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Servings
            </span>
            <div className="flex items-center rounded-xl border border-slate-200 bg-white">
              <button
                onClick={() => setServings((s) => Math.max(1, s - 1))}
                className="tap-target rounded-l-xl px-3 text-lg font-bold text-slate-500 hover:bg-slate-100"
                aria-label="Decrease servings"
              >
                −
              </button>
              <span className="w-8 text-center text-sm font-bold tabular-nums text-slate-800">
                {servings}
              </span>
              <button
                onClick={() => setServings((s) => Math.min(99, s + 1))}
                className="tap-target rounded-r-xl px-3 text-lg font-bold text-slate-500 hover:bg-slate-100"
                aria-label="Increase servings"
              >
                +
              </button>
            </div>
          </div>

          <button
            onClick={() => setShowLogModal(true)}
            className="btn-secondary"
            title="Log this cook to your journal"
          >
            <JournalIcon width={18} height={18} /> Mark cooked
          </button>

          <button
            onClick={() => removeFromQueue(recipe.id)}
            className="btn-ghost text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Remove from cook queue"
            title="Remove from cook queue"
          >
            <CloseIcon width={18} height={18} />
          </button>
        </div>
      </div>

      {/* Two-pane layout: stacks on mobile, side-by-side on lg */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Ingredients */}
        <section className="card flex flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200/70 px-5 py-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Ingredients</h2>
            <span className="text-xs font-semibold text-slate-400">
              {progress.checkedIngredients.length}/{recipe.ingredients.length} prepped
            </span>
          </div>
          <ul className="divide-y divide-slate-200/70">
            {recipe.ingredients.map((ing) => {
              const checked = progress.checkedIngredients.includes(ing.id)
              return (
                <li key={ing.id}>
                  <button
                    onClick={() => toggleCookIngredient(recipe.id, ing.id)}
                    className="tap-target flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-slate-50"
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
                        checked ? 'border-herb-500 bg-herb-500 text-white' : 'border-slate-300 bg-white'
                      }`}
                    >
                      {checked && <CheckIcon width={16} height={16} />}
                    </span>
                    <span
                      className={`flex-1 transition-colors ${
                        checked ? 'text-slate-300 line-through' : 'text-slate-800'
                      }`}
                    >
                      {ing.name}
                    </span>
                    <span
                      className={`shrink-0 text-sm font-bold tabular-nums transition-colors ${
                        checked ? 'text-slate-300' : 'text-slate-500'
                      }`}
                    >
                      {formatMeasure(ing.quantity, ing.unit, ing.altQuantity, ing.altUnit, scale)}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>

        {/* Steps */}
        <section className="card flex flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200/70 px-5 py-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Steps</h2>
            <span className="text-xs font-semibold text-slate-400">
              {completedSteps}/{recipe.steps.length} done
            </span>
          </div>
          <ol className="divide-y divide-slate-200/70">
            {recipe.steps.map((step) => {
              const done = progress.completedSteps.includes(step.id)
              return (
                <li key={step.id} className="px-5 py-4">
                  <div className="flex gap-3">
                    <button
                      onClick={() => toggleCookStep(recipe.id, step.id)}
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold transition-colors ${
                        done
                          ? 'border-herb-500 bg-herb-500 text-white'
                          : 'border-slate-300 bg-white text-slate-500'
                      }`}
                      aria-label={done ? 'Mark step incomplete' : 'Mark step complete'}
                    >
                      {done ? <CheckIcon width={16} height={16} /> : step.order}
                    </button>
                    <div className="flex-1">
                      <p
                        className={`leading-relaxed transition-colors ${
                          done ? 'text-slate-300 line-through' : 'text-slate-700'
                        }`}
                      >
                        {step.instruction}
                      </p>
                      {step.timerSeconds != null && step.timerSeconds > 0 && !done && (
                        <Timer seconds={step.timerSeconds} />
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
        </section>
      </div>

      {/* Per-serving nutrition (only when the recipe provides it) */}
      {hasNutrition(recipe.nutrition) && (
        <section className="card mt-4 p-4 sm:p-5">
          <NutritionPanel nutrition={recipe.nutrition} servings={recipe.servings} multiplier={servings} />
        </section>
      )}

      {showLogModal && (
        <CookLogModal recipe={recipe} onClose={() => setShowLogModal(false)} />
      )}
    </div>
  )
}
