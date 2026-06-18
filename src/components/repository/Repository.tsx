import { useMemo, useState, type ReactNode } from 'react'
import { useApp } from '../../context/AppContext'
import { PROTEIN_FILTERS, type ProteinFilter, type Recipe } from '../../types'
import { matchesProtein, matchesSearch, sourceLabel } from '../../lib/util'
import { cookStats, type CookStats } from '../../lib/reviews'
import {
  BookIcon,
  ChevronDownIcon,
  CloseIcon,
  DiceIcon,
  FilterIcon,
  PlusIcon,
  SearchIcon,
  UploadIcon,
} from '../ui/icons'
import { RecipeCard, RecipeCardSkeleton } from './RecipeCard'
import { RecipeDetailModal } from './RecipeDetailModal'
import { PdfUpload } from './PdfUpload'
import { AddRecipeModal } from './AddRecipeModal'
import { ImportExport } from './ImportExport'
import { RouletteModal } from '../roulette/RouletteModal'

type CookedFilter = 'all' | 'cooked' | 'uncooked'
type SortKey = 'newest' | 'rating' | 'title'

const COOKED_FILTERS: { id: CookedFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'cooked', label: 'Cooked ✓' },
  { id: 'uncooked', label: 'Not cooked' },
]

export function Repository() {
  const { recipes, cookLog } = useApp()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<ProteinFilter>('All')
  const [cookedFilter, setCookedFilter] = useState<CookedFilter>('all')
  const [calMin, setCalMin] = useState<number | null>(null)
  const [calMax, setCalMax] = useState<number | null>(null)
  const [cookbook, setCookbook] = useState<string>('All')
  const [sortKey, setSortKey] = useState<SortKey>('newest')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [selected, setSelected] = useState<Recipe | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [adding, setAdding] = useState(false)
  const [roulette, setRoulette] = useState(false)

  // Per-recipe cook count + average rating from the journal.
  const stats = useMemo(() => {
    const m = new Map<string, CookStats>()
    for (const r of recipes) m.set(r.id, cookStats(cookLog, r))
    return m
  }, [recipes, cookLog])

  // Distinct cookbook/source names for the filter dropdown.
  const cookbooks = useMemo(() => {
    const set = new Set<string>()
    for (const r of recipes) set.add(sourceLabel(r.sourceFile))
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [recipes])

  // Calorie range filter (per serving). When a bound is set, recipes without a
  // calorie value are excluded since they can't be compared.
  const inCalorieRange = (r: Recipe): boolean => {
    if (calMin === null && calMax === null) return true
    const c = r.nutrition?.calories
    if (typeof c !== 'number') return false
    if (calMin !== null && c < calMin) return false
    if (calMax !== null && c > calMax) return false
    return true
  }

  const filtered = useMemo(() => {
    const statFor = (r: Recipe): CookStats => stats.get(r.id) ?? { count: 0, avg: 0 }
    let list = recipes.filter(
      (r) =>
        matchesSearch(r, query) &&
        matchesProtein(r, filter) &&
        inCalorieRange(r) &&
        (cookbook === 'All' || sourceLabel(r.sourceFile) === cookbook)
    )
    if (cookedFilter !== 'all') {
      list = list.filter((r) => (statFor(r).count > 0) === (cookedFilter === 'cooked'))
    }
    if (sortKey === 'rating') {
      list = [...list].sort(
        (a, b) =>
          statFor(b).avg - statFor(a).avg ||
          statFor(b).count - statFor(a).count ||
          a.title.localeCompare(b.title)
      )
    } else if (sortKey === 'title') {
      list = [...list].sort((a, b) => a.title.localeCompare(b.title))
    }
    return list
  }, [recipes, query, filter, cookedFilter, calMin, calMax, cookbook, sortKey, stats])

  const hasRecipes = recipes.length > 0

  // Active-filter bookkeeping for the collapsible filter panel.
  const calorieActive = calMin !== null || calMax !== null
  const calorieSummary =
    calMin !== null && calMax !== null
      ? `${calMin}–${calMax} cal`
      : calMax !== null
        ? `≤ ${calMax} cal`
        : calMin !== null
          ? `≥ ${calMin} cal`
          : ''
  const activeFilterCount =
    (filter !== 'All' ? 1 : 0) +
    (cookedFilter !== 'all' ? 1 : 0) +
    (calorieActive ? 1 : 0) +
    (cookbook !== 'All' ? 1 : 0)

  const clearAllFilters = () => {
    setFilter('All')
    setCookedFilter('all')
    setCalMin(null)
    setCalMax(null)
    setCookbook('All')
  }

  return (
    <div className="mx-auto max-w-6xl px-3 py-5 sm:px-6 sm:py-8">
      {/* Header row */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-medium tracking-tight text-choc sm:text-4xl">
            repository
          </h1>
          <p className="mt-1 text-sm text-royal-mute">
            {recipes.length} {recipes.length === 1 ? 'recipe' : 'recipes'} in your library
          </p>
          <button
            onClick={() => setRoulette(true)}
            disabled={recipes.length === 0}
            className="btn-line mt-3"
            title="Roll the dice for three random dinner ideas"
          >
            <DiceIcon width={18} height={18} className="text-pumpkin" /> feeling frisky?
          </button>
        </div>
        <div className="flex flex-col items-stretch gap-2">
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-start">
            <button onClick={() => setAdding(true)} className="btn-line">
              <PlusIcon width={18} height={18} className="text-pumpkin" /> add manually
            </button>
            <PdfUpload onExtractingChange={setExtracting} />
          </div>
          <ImportExport />
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <SearchIcon
          width={18}
          height={18}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-pumpkin"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="search by title, tag, or cuisine…"
          className="w-full rounded-lg border-0 bg-royal-deep py-3 pl-11 pr-4 text-white shadow-sm outline-none transition placeholder:text-white/55 focus:ring-2 focus:ring-white/15"
        />
      </div>

      {/* Filter toolbar: a single Filters button (with active count) + Sort */}
      <div className="mb-3 flex items-center gap-2">
        <button
          onClick={() => setFiltersOpen((o) => !o)}
          aria-expanded={filtersOpen}
          className={`btn-line ${filtersOpen ? 'bg-white/10' : ''}`}
        >
          <FilterIcon width={18} height={18} className="text-pumpkin" />
          filters
          {activeFilterCount > 0 && (
            <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-pumpkin px-1.5 text-xs font-bold text-white">
              {activeFilterCount}
            </span>
          )}
          <ChevronDownIcon
            width={16}
            height={16}
            className={`transition-transform ${filtersOpen ? 'rotate-180' : ''}`}
          />
        </button>

        <label className="ml-auto flex items-center gap-2">
          <span className="hidden text-xs font-semibold tracking-wide text-royal-mute sm:inline">
            sort
          </span>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="tap-target rounded-lg border border-choc/40 bg-transparent px-3 py-2 text-sm font-medium text-choc shadow-sm outline-none focus:border-choc/70"
          >
            <option value="newest">newest first</option>
            <option value="rating">highest rated</option>
            <option value="title">title a–z</option>
          </select>
        </label>
      </div>

      {/* Active filters — visible at a glance, individually removable */}
      {activeFilterCount > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {filter !== 'All' && (
            <ActiveFilterChip label={filter} onClear={() => setFilter('All')} />
          )}
          {calorieActive && (
            <ActiveFilterChip
              label={calorieSummary}
              onClear={() => {
                setCalMin(null)
                setCalMax(null)
              }}
            />
          )}
          {cookedFilter !== 'all' && (
            <ActiveFilterChip
              label={cookedFilter === 'cooked' ? 'Cooked' : 'Not cooked'}
              onClear={() => setCookedFilter('all')}
            />
          )}
          {cookbook !== 'All' && (
            <ActiveFilterChip label={cookbook} onClear={() => setCookbook('All')} />
          )}
          <button
            onClick={clearAllFilters}
            className="text-xs font-semibold text-royal-mute underline-offset-2 hover:text-choc hover:underline"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Collapsible filter panel — white card with grouped controls */}
      {filtersOpen && (
        <div className="mb-6 animate-slide-up space-y-4 rounded-xl bg-choc p-4 shadow-lg">
          <FilterGroup label="Protein">
            {PROTEIN_FILTERS.map((f) => {
              const active = filter === f
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`chip ${
                    active
                      ? 'border-royal bg-royal text-white shadow-sm'
                      : 'border-royal/25 bg-transparent text-royal-soft hover:border-royal/50 hover:text-royal-ink'
                  }`}
                >
                  {f}
                </button>
              )
            })}
          </FilterGroup>

          <FilterGroup label="Calories per serving">
            <div className="flex flex-wrap items-center gap-1.5">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={calMin ?? ''}
                onChange={(e) => setCalMin(e.target.value === '' ? null : Number(e.target.value))}
                placeholder="min"
                aria-label="Minimum calories"
                className="w-20 rounded-lg border border-royal/20 bg-white px-2.5 py-2 text-sm text-royal-ink shadow-sm outline-none placeholder:text-royal-faint focus:border-pumpkin focus:ring-2 focus:ring-pumpkin/20"
              />
              <span className="text-royal-faint">–</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={calMax ?? ''}
                onChange={(e) => setCalMax(e.target.value === '' ? null : Number(e.target.value))}
                placeholder="max"
                aria-label="Maximum calories"
                className="w-20 rounded-lg border border-royal/20 bg-white px-2.5 py-2 text-sm text-royal-ink shadow-sm outline-none placeholder:text-royal-faint focus:border-pumpkin focus:ring-2 focus:ring-pumpkin/20"
              />
              <span className="text-xs font-medium text-royal-faint">cal · leave min blank for “under”</span>
            </div>
          </FilterGroup>

          <FilterGroup label="Status">
            {COOKED_FILTERS.map(({ id, label }) => {
              const active = cookedFilter === id
              return (
                <button
                  key={id}
                  onClick={() => setCookedFilter(id)}
                  className={`chip ${
                    active
                      ? 'border-royal bg-royal text-white shadow-sm'
                      : 'border-royal/25 bg-transparent text-royal-soft hover:border-royal/50 hover:text-royal-ink'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </FilterGroup>

          <FilterGroup label="Cookbook">
            <select
              value={cookbook}
              onChange={(e) => setCookbook(e.target.value)}
              className="tap-target w-full max-w-xs rounded-lg border border-royal/20 bg-white px-3 py-2 text-sm font-medium text-royal-ink shadow-sm outline-none focus:border-pumpkin"
            >
              <option value="All">All cookbooks</option>
              {cookbooks.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </FilterGroup>

          {activeFilterCount > 0 && (
            <div className="flex justify-end pt-1">
              <button
                onClick={clearAllFilters}
                className="text-sm font-semibold text-royal-soft hover:text-royal-ink"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* Grid / states */}
      {extracting && !hasRecipes ? (
        <SkeletonGrid />
      ) : !hasRecipes ? (
        <EmptyLibrary onAdd={() => setAdding(true)} />
      ) : filtered.length === 0 ? (
        <NoMatches
          onReset={() => {
            setQuery('')
            setFilter('All')
            setCookedFilter('all')
            setCalMin(null)
            setCalMax(null)
            setCookbook('All')
          }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {extracting && <RecipeCardSkeleton />}
          {filtered.map((r) => (
            <RecipeCard key={r.id} recipe={r} onClick={() => setSelected(r)} cooked={stats.get(r.id)} />
          ))}
        </div>
      )}

      {selected && (
        <RecipeDetailModal recipe={selected} onClose={() => setSelected(null)} />
      )}

      {adding && <AddRecipeModal onClose={() => setAdding(false)} />}

      {roulette && (
        <RouletteModal
          onClose={() => setRoulette(false)}
          onPick={(r) => {
            setRoulette(false)
            setSelected(r)
          }}
        />
      )}
    </div>
  )
}

function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-royal-faint">{label}</p>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  )
}

function ActiveFilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-choc/30 bg-white/5 py-1 pl-3 pr-1 text-sm font-medium text-choc">
      {label}
      <button
        onClick={onClear}
        className="flex h-5 w-5 items-center justify-center rounded-full text-royal-mute transition-colors hover:bg-white/10 hover:text-choc"
        aria-label={`Remove ${label} filter`}
      >
        <CloseIcon width={13} height={13} />
      </button>
    </span>
  )
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <RecipeCardSkeleton key={i} />
      ))}
    </div>
  )
}

function EmptyLibrary({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-choc/25 bg-white/5 px-6 py-16 text-center">
      <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-choc">
        <BookIcon width={32} height={32} />
      </span>
      <h2 className="text-lg font-bold text-choc">No recipes yet</h2>
      <p className="mt-1 max-w-xs text-sm text-royal-mute">
        Upload a recipe PDF and we'll extract it for you — or add one by hand.
      </p>
      <div className="mt-4 flex flex-col items-center gap-2 sm:flex-row">
        <button onClick={onAdd} className="btn-line">
          <PlusIcon width={16} height={16} className="text-pumpkin" /> add manually
        </button>
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-royal-mute">
          <UploadIcon width={16} height={16} className="text-pumpkin" /> or use “upload pdf” above
        </span>
      </div>
    </div>
  )
}

function NoMatches({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-choc/25 bg-white/5 px-6 py-16 text-center">
      <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-royal-mute">
        <SearchIcon width={32} height={32} />
      </span>
      <h2 className="text-lg font-bold text-choc">No matching recipes</h2>
      <p className="mt-1 text-sm text-royal-mute">Try a different search or filter.</p>
      <button onClick={onReset} className="btn-line mt-4">
        Clear filters
      </button>
    </div>
  )
}
