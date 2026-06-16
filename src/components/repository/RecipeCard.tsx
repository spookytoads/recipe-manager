import type { Recipe } from '../../types'
import type { CookStats } from '../../lib/reviews'
import { BookIcon, ClockIcon } from '../ui/icons'
import { proteinLabel, sourceLabel } from '../../lib/util'
import { Thumbnail } from './Thumbnail'

export function RecipeCard({
  recipe,
  onClick,
  cooked,
}: {
  recipe: Recipe
  onClick: () => void
  cooked?: CookStats
}) {
  return (
    <button
      onClick={onClick}
      className="card group flex flex-col overflow-hidden text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-herb-400"
    >
      <Thumbnail seed={recipe.id} label={recipe.title} className="h-36 w-full" />

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold leading-tight text-slate-800 line-clamp-2">{recipe.title}</h3>
        </div>
        <p className="text-xs font-medium uppercase tracking-wide text-herb-600">
          {recipe.cuisine}
        </p>

        <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
          {recipe.protein.length > 0 ? (
            recipe.protein.map((p) => (
              <span
                key={p}
                className="rounded-full bg-herb-50 px-2 py-0.5 text-[11px] font-semibold text-herb-700"
              >
                {proteinLabel(p)}
              </span>
            ))
          ) : (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
              No protein
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1">
            <ClockIcon width={14} height={14} /> Prep {recipe.prepTime}
          </span>
          <span className="inline-flex items-center gap-1">
            <ClockIcon width={14} height={14} /> Cook {recipe.cookTime}
          </span>
          {typeof recipe.nutrition?.calories === 'number' && (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-700">
              {recipe.nutrition.calories} cal
            </span>
          )}
          {cooked && cooked.count > 0 && (
            cooked.avg > 0 ? (
              <span className="rounded-full bg-herb-50 px-2 py-0.5 font-semibold text-herb-700">
                ★ {cooked.avg.toFixed(1)} ({cooked.count})
              </span>
            ) : (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-500">
                Cooked ×{cooked.count}
              </span>
            )
          )}
        </div>

        <p
          className="flex items-center gap-1 pt-0.5 text-[11px] text-slate-400"
          title={sourceLabel(recipe.sourceFile)}
        >
          <BookIcon width={12} height={12} className="shrink-0" />
          <span className="truncate">{sourceLabel(recipe.sourceFile)}</span>
        </p>
      </div>
    </button>
  )
}

export function RecipeCardSkeleton() {
  return (
    <div className="card overflow-hidden">
      <div className="h-36 w-full animate-pulse bg-slate-200" />
      <div className="flex flex-col gap-3 p-4">
        <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200" />
        <div className="h-3 w-1/3 animate-pulse rounded bg-slate-200" />
        <div className="flex gap-1.5">
          <div className="h-5 w-14 animate-pulse rounded-full bg-slate-200" />
          <div className="h-5 w-14 animate-pulse rounded-full bg-slate-200" />
        </div>
        <div className="h-3 w-1/2 animate-pulse rounded bg-slate-200" />
      </div>
    </div>
  )
}
