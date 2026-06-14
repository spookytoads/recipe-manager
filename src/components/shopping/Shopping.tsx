import { useMemo } from 'react'
import { aggregateKey, useApp } from '../../context/AppContext'
import { CATEGORIES, type Category } from '../../types'
import { formatMeasure } from '../../lib/util'
import { recipeColor } from '../../lib/colors'
import { CartIcon, CheckIcon, CloseIcon, ListChecksIcon } from '../ui/icons'

interface AggregatedItem {
  key: string
  name: string
  unit: string
  category: Category
  quantity: number
  /** Second measurement, only kept when every merged entry has the same alt unit. */
  altUnit?: string
  altQuantity?: number
  altOk: boolean
  sources: string[]
}

const MULTIPLIERS = [1, 2, 3]

export function Shopping() {
  const {
    shopping,
    checkedKeys,
    multiplier,
    setMultiplier,
    toggleChecked,
    clearChecked,
    clearAllShopping,
    removeRecipeFromShopping,
    pushToast,
    setSection,
  } = useApp()

  // Distinct recipes currently contributing to the list (for per-recipe removal).
  const sourceRecipes = useMemo(() => {
    const seen = new Map<string, string>()
    for (const e of shopping) {
      if (!seen.has(e.recipeId)) seen.set(e.recipeId, e.recipeTitle)
    }
    return [...seen.entries()].map(([id, title]) => ({ id, title }))
  }, [shopping])

  // Aggregate identical ingredients (same name + unit + category) and sum quantities.
  const grouped = useMemo(() => {
    const map = new Map<string, AggregatedItem>()
    for (const entry of shopping) {
      const key = aggregateKey(entry.name, entry.unit, entry.category)
      const entryHasAlt = typeof entry.altQuantity === 'number' && !!entry.altUnit
      const existing = map.get(key)
      if (existing) {
        existing.quantity += entry.quantity
        if (!existing.sources.includes(entry.recipeTitle)) {
          existing.sources.push(entry.recipeTitle)
        }
        // Keep the second measurement only if every merged entry agrees on its unit.
        if (existing.altOk && entryHasAlt && entry.altUnit === existing.altUnit) {
          existing.altQuantity = (existing.altQuantity ?? 0) + (entry.altQuantity ?? 0)
        } else {
          existing.altOk = false
          existing.altUnit = undefined
          existing.altQuantity = undefined
        }
      } else {
        map.set(key, {
          key,
          name: entry.name,
          unit: entry.unit,
          category: entry.category,
          quantity: entry.quantity,
          altOk: entryHasAlt,
          altUnit: entryHasAlt ? entry.altUnit : undefined,
          altQuantity: entryHasAlt ? entry.altQuantity : undefined,
          sources: [entry.recipeTitle],
        })
      }
    }

    const byCategory = new Map<Category, AggregatedItem[]>()
    for (const item of map.values()) {
      const list = byCategory.get(item.category) ?? []
      list.push(item)
      byCategory.set(item.category, list)
    }
    for (const list of byCategory.values()) {
      list.sort((a, b) => a.name.localeCompare(b.name))
    }
    return byCategory
  }, [shopping])

  const allItems = useMemo(() => Array.from(grouped.values()).flat(), [grouped])
  const totalCount = allItems.length
  const checkedCount = allItems.filter((i) => checkedKeys.includes(i.key)).length
  const remaining = totalCount - checkedCount

  if (totalCount === 0) {
    return (
      <div className="mx-auto max-w-3xl px-3 py-5 sm:px-6 sm:py-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-800 sm:text-3xl">
          Shopping List
        </h1>
        <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white/60 px-6 py-16 text-center">
          <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-herb-50 text-herb-500">
            <CartIcon width={32} height={32} />
          </span>
          <h2 className="text-lg font-bold text-slate-800">Your shopping list is empty</h2>
          <p className="mt-1 max-w-xs text-sm text-slate-500">
            Open a recipe and tap “Add to Shopping List” to start building your grocery run.
          </p>
          <button onClick={() => setSection('repository')} className="btn-primary mt-4">
            Browse recipes
          </button>
        </div>
      </div>
    )
  }

  const orderedCategories = CATEGORIES.filter((c) => grouped.has(c))

  // Build a checklist and hand it to Apple Notes via the share sheet (iOS/iPadOS/
  // macOS show "Notes" there). Falls back to copying when sharing isn't available.
  const handleExportToNotes = async () => {
    const lines: string[] = [`Shopping List${multiplier > 1 ? ` (${multiplier}×)` : ''}`, '']
    for (const category of orderedCategories) {
      const items = grouped.get(category)!
      lines.push(category.toUpperCase())
      for (const item of items) {
        const checked = checkedKeys.includes(item.key)
        const amount = formatMeasure(
          item.quantity,
          item.unit,
          item.altOk ? item.altQuantity : undefined,
          item.altOk ? item.altUnit : undefined,
          multiplier
        )
        lines.push(`${checked ? '☑' : '☐'} ${item.name}${amount ? ` — ${amount}` : ''}`)
      }
      lines.push('')
    }
    const text = lines.join('\n').trimEnd()

    const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> }
    if (nav.share) {
      try {
        await nav.share({ title: 'Shopping List', text })
        return
      } catch (err) {
        // User dismissed the share sheet — nothing to do.
        if ((err as DOMException)?.name === 'AbortError') return
        // Otherwise fall through to the clipboard fallback.
      }
    }
    try {
      await navigator.clipboard.writeText(text)
      pushToast('Checklist copied — paste into Apple Notes, then tap the checklist button', 'success')
    } catch {
      pushToast('Could not export the list on this device', 'error')
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-3 py-5 sm:px-6 sm:py-8">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-800 sm:text-3xl">
            Shopping List
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            {totalCount} {totalCount === 1 ? 'item' : 'items'} · {remaining} remaining
          </p>
        </div>

        {/* Servings multiplier */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Scale
          </span>
          <div className="flex rounded-xl border border-slate-200 bg-white p-1">
            {MULTIPLIERS.map((m) => (
              <button
                key={m}
                onClick={() => setMultiplier(m)}
                className={`tap-target rounded-lg px-3 text-sm font-bold transition-colors ${
                  multiplier === m
                    ? 'bg-herb-500 text-white shadow-sm'
                    : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                {m}×
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="mr-auto h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-herb-500 transition-all duration-300"
            style={{ width: `${totalCount ? (checkedCount / totalCount) * 100 : 0}%` }}
          />
        </div>
        <button
          onClick={handleExportToNotes}
          className="btn-secondary"
          title="Export to Apple Notes as a checklist"
        >
          <ListChecksIcon width={16} height={16} /> Apple Notes
        </button>
        <button
          onClick={clearChecked}
          disabled={checkedCount === 0}
          className="btn-secondary"
        >
          Clear Checked
        </button>
        <button onClick={clearAllShopping} className="btn-ghost text-red-500 hover:bg-red-50">
          Clear All
        </button>
      </div>

      {/* Recipes contributing to this list — remove one if you change your mind */}
      {sourceRecipes.length > 0 && (
        <div className="mb-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            From {sourceRecipes.length} {sourceRecipes.length === 1 ? 'recipe' : 'recipes'}
          </p>
          <div className="flex flex-wrap gap-2">
            {sourceRecipes.map((r) => {
              const color = recipeColor(r.title)
              return (
                <span
                  key={r.id}
                  className="inline-flex items-center gap-1.5 rounded-full border py-1 pl-3 pr-1 text-sm font-semibold"
                  style={{ backgroundColor: color.bg, color: color.text, borderColor: color.border }}
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: color.accent }}
                  />
                  {r.title}
                  <button
                    onClick={() => {
                      removeRecipeFromShopping(r.id)
                      pushToast(`Removed "${r.title}" from your shopping list`, 'info')
                    }}
                    className="tap-target flex h-7 w-7 items-center justify-center rounded-full opacity-60 transition-colors hover:bg-red-50 hover:text-red-500 hover:opacity-100"
                    aria-label={`Remove ${r.title} from shopping list`}
                    title={`Remove ${r.title}`}
                  >
                    <CloseIcon width={15} height={15} />
                  </button>
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* Grouped list */}
      <div className="space-y-5">
        {orderedCategories.map((category) => {
          const items = grouped.get(category)!
          return (
            <section key={category}>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500">
                {category}
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-600">
                  {items.length}
                </span>
              </h2>
              <ul className="card divide-y divide-slate-200/70 overflow-hidden">
                {items.map((item) => {
                  const checked = checkedKeys.includes(item.key)
                  return (
                    <li key={item.key}>
                      <button
                        onClick={() => toggleChecked(item.key)}
                        className="tap-target flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50"
                      >
                        <span
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
                            checked
                              ? 'border-herb-500 bg-herb-500 text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {checked && <CheckIcon width={16} height={16} />}
                        </span>

                        <div className="min-w-0 flex-1">
                          <p
                            className={`font-medium transition-colors ${
                              checked ? 'text-slate-400 line-through' : 'text-slate-800'
                            }`}
                          >
                            {item.name}
                          </p>
                          {item.sources.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {item.sources.map((s) => {
                                const color = recipeColor(s)
                                return (
                                  <span
                                    key={s}
                                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold transition-opacity ${
                                      checked ? 'opacity-40' : ''
                                    }`}
                                    style={{ backgroundColor: color.bg, color: color.text }}
                                  >
                                    {s}
                                  </span>
                                )
                              })}
                            </div>
                          )}
                        </div>

                        <span
                          className={`shrink-0 text-sm font-bold tabular-nums transition-colors ${
                            checked ? 'text-slate-300' : 'text-slate-600'
                          }`}
                        >
                          {formatMeasure(
                            item.quantity,
                            item.unit,
                            item.altOk ? item.altQuantity : undefined,
                            item.altOk ? item.altUnit : undefined,
                            multiplier
                          )}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          )
        })}
      </div>
    </div>
  )
}
