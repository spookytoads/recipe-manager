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
        <h1 className="font-serif text-3xl font-medium tracking-tight text-choc sm:text-4xl">cook</h1>
        <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-choc/25 bg-white/5 px-6 py-16 text-center">
          <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-choc">
            <ChefIcon width={32} height={32} />
          </span>
          <h2 className="text-lg font-bold text-choc">Nothing queued to cook</h2>
          <p className="mt-1 max-w-xs text-sm text-royal-mute">
            Open a recipe and tap “Start Cooking” to load it into a focused, step-by-step view.
          </p>
          <button onClick={() => setSection('repository')} className="btn-line mt-4">
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
                className="tap-target w-full max-w-full appearance-none truncate rounded-xl border border-white/15 bg-white/10 py-2.5 pl-4 pr-10 font-serif text-lg font-medium tracking-tight text-choc shadow-sm outline-none focus:border-choc/50 sm:text-2xl"
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
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-royal-mute"
              />
            </div>
          ) : (
            <h1 className="font-serif text-2xl font-medium tracking-tight text-choc sm:text-3xl">
              {recipe.title}
            </h1>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-sm text-royal-mute">
            <span className="font-medium text-choc">{recipe.cuisine}</span>
            <span className="inline-flex items-center gap-1">
              <ClockIcon width={14} height={14} /> {recipe.cookTime}
            </span>
            {recipe.protein.map((p) => (
              <span key={p} className="text-royal-faint">
                {proteinLabel(p)}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Servings adjuster */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-royal-mute">
              Servings
            </span>
            <div className="flex items-center rounded-xl border border-white/15 bg-white/10">
              <button
                onClick={() => setServings((s) => Math.max(1, s - 1))}
                className="tap-target rounded-l-xl px-3 text-lg font-bold text-royal-mute hover:bg-white/10 hover:text-choc"
                aria-label="Decrease servings"
              >
                −
              </button>
              <span className="w-8 text-center text-sm font-bold tabular-nums text-choc">
                {servings}
              </span>
              <button
                onClick={() => setServings((s) => Math.min(99, s + 1))}
                className="tap-target rounded-r-xl px-3 text-lg font-bold text-royal-mute hover:bg-white/10 hover:text-choc"
                aria-label="Increase servings"
              >
                +
              </button>
            </div>
          </div>

          <button
            onClick={() => setShowLogModal(true)}
            className="btn-line"
            title="Log this cook to your journal"
          >
            <JournalIcon width={18} height={18} className="text-pumpkin" /> Mark cooked
          </button>

          <button
            onClick={() => removeFromQueue(recipe.id)}
            className="btn-ghost text-royal-mute hover:bg-white/10 hover:text-choc"
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
          <div className="flex items-center justify-between border-b border-royal/10 px-5 py-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-pumpkin-ink">Ingredients</h2>
            <span className="text-xs font-semibold text-royal-faint">
              {progress.checkedIngredients.length}/{recipe.ingredients.length} prepped
            </span>
          </div>
          <ul className="divide-y divide-royal/10">
            {recipe.ingredients.map((ing) => {
              const checked = progress.checkedIngredients.includes(ing.id)
              return (
                <li key={ing.id}>
                  <button
                    onClick={() => toggleCookIngredient(recipe.id, ing.id)}
                    className="tap-target flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-royal/5"
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
                        checked ? 'border-pumpkin bg-pumpkin text-white' : 'border-royal/30 bg-white'
                      }`}
                    >
                      {checked && <CheckIcon width={16} height={16} />}
                    </span>
                    <span
                      className={`flex-1 transition-colors ${
                        checked ? 'text-royal-faint line-through' : 'text-royal-ink'
                      }`}
                    >
                      {ing.name}
                    </span>
                    <span
                      className={`shrink-0 text-sm font-bold tabular-nums transition-colors ${
                        checked ? 'text-royal-faint' : 'text-royal-soft'
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
          <div className="flex items-center justify-between border-b border-royal/10 px-5 py-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-pumpkin-ink">Steps</h2>
            <span className="text-xs font-semibold text-royal-faint">
              {completedSteps}/{recipe.steps.length} done
            </span>
          </div>
          <ol className="divide-y divide-royal/10">
            {recipe.steps.map((step) => {
              const done = progress.completedSteps.includes(step.id)
              return (
                <li key={step.id} className="px-5 py-4">
                  <div className="flex gap-3">
                    <button
                      onClick={() => toggleCookStep(recipe.id, step.id)}
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold transition-colors ${
                        done
                          ? 'border-pumpkin bg-pumpkin text-white'
                          : 'border-royal/30 bg-white text-royal-soft'
                      }`}
                      aria-label={done ? 'Mark step incomplete' : 'Mark step complete'}
                    >
                      {done ? <CheckIcon width={16} height={16} /> : step.order}
                    </button>
                    <div className="flex-1">
                      <p
                        className={`leading-relaxed transition-colors ${
                          done ? 'text-royal-faint line-through' : 'text-royal-ink'
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
