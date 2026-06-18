import type { Recipe } from '../../types'
import type { CookStats } from '../../lib/reviews'
import { BookIcon, ClockIcon } from '../ui/icons'
import { proteinLabel, sourceLabel } from '../../lib/util'
import { recipeColor } from '../../lib/colors'

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
      className="group flex flex-col overflow-hidden rounded-lg bg-choc text-left shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-pumpkin"
    >
      <div className="h-1.5 w-full" style={{ backgroundColor: recipeColor(recipe.title).accent }} />

      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-royal-faint">
          {recipe.cuisine}
        </p>
        <h3 className="font-serif text-lg font-medium leading-tight tracking-tight text-royal-ink line-clamp-2">
          {recipe.title}
        </h3>

        <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
          {recipe.protein.length > 0 ? (
            recipe.protein.map((p) => (
              <span
                key={p}
                className="rounded-md bg-junebud px-2 py-0.5 text-[11px] font-semibold text-royal-ink"
              >
                {proteinLabel(p)}
              </span>
            ))
          ) : (
            <span className="rounded-md bg-royal/10 px-2 py-0.5 text-[11px] font-semibold text-royal-soft">
              No protein
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-xs text-royal-soft">
          <span className="inline-flex items-center gap-1">
            <ClockIcon width={14} height={14} /> Prep {recipe.prepTime}
          </span>
          <span className="inline-flex items-center gap-1">
            <ClockIcon width={14} height={14} /> Cook {recipe.cookTime}
          </span>
          {typeof recipe.nutrition?.calories === 'number' && (
            <span className="rounded-full bg-pumpkin/15 px-2 py-0.5 font-semibold text-pumpkin-ink">
              {recipe.nutrition.calories} cal
            </span>
          )}
          {cooked && cooked.count > 0 && (
            cooked.avg > 0 ? (
              <span className="rounded-full bg-royal/10 px-2 py-0.5 font-semibold text-royal-soft">
                ★ {cooked.avg.toFixed(1)} ({cooked.count})
              </span>
            ) : (
              <span className="rounded-full bg-royal/10 px-2 py-0.5 font-semibold text-royal-soft">
                Cooked ×{cooked.count}
              </span>
            )
          )}
        </div>

        <p
          className="flex items-center gap-1 pt-0.5 text-[11px] text-royal-faint"
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
    <div className="overflow-hidden rounded-lg bg-choc shadow-lg">
      <div className="h-1.5 w-full bg-royal/15" />
      <div className="flex flex-col gap-3 p-4">
        <div className="h-3 w-1/3 animate-pulse rounded bg-royal/10" />
        <div className="h-4 w-3/4 animate-pulse rounded bg-royal/10" />
        <div className="flex gap-1.5">
          <div className="h-5 w-14 animate-pulse rounded-full bg-royal/10" />
        </div>
        <div className="h-3 w-1/2 animate-pulse rounded bg-royal/10" />
      </div>
    </div>
  )
}
