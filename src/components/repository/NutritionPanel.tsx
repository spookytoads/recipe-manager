import { NUTRITION_FIELDS, type Nutrition } from '../../types'
import { formatQuantity } from '../../lib/util'

/** True if a nutrition object has at least one populated value. */
export function hasNutrition(n: Nutrition | undefined): n is Nutrition {
  return !!n && NUTRITION_FIELDS.some(({ key }) => typeof n[key] === 'number')
}

/**
 * Per-serving nutrition as a row of stat pills. Pass `multiplier` to also show
 * the total for a scaled number of servings (used in the Cook view).
 */
export function NutritionPanel({
  nutrition,
  servings,
  multiplier = 1,
}: {
  nutrition: Nutrition
  servings?: number
  multiplier?: number
}) {
  const showTotal = multiplier > 1 && servings != null
  return (
    <div>
      <h3 className="mb-2 flex flex-wrap items-center gap-x-2 text-sm font-bold uppercase tracking-wide text-slate-500">
        Nutrition
        <span className="text-xs font-medium normal-case tracking-normal text-slate-400">
          per serving{showTotal ? ` · total shown for ${multiplier} servings` : ''}
        </span>
      </h3>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {NUTRITION_FIELDS.map(({ key, label, unit }) => {
          const value = nutrition[key]
          if (typeof value !== 'number') return null
          return (
            <div
              key={key}
              className="rounded-xl border border-slate-200/70 bg-white px-3 py-2 text-center"
            >
              <div className="text-base font-bold text-slate-800">
                {formatQuantity(value)}
                {unit && <span className="text-xs font-medium text-slate-400"> {unit}</span>}
              </div>
              <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                {label}
              </div>
              {showTotal && (
                <div className="mt-0.5 text-[11px] text-pumpkin-ink">
                  {formatQuantity(value * multiplier)}
                  {unit ? ` ${unit}` : ''} total
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
