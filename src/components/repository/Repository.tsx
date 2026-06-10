import { useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { PROTEIN_FILTERS, type ProteinFilter, type Recipe } from '../../types'
import { matchesProtein, matchesSearch } from '../../lib/util'
import { cookStats, type CookStats } from '../../lib/reviews'
import { BookIcon, PlusIcon, SearchIcon, UploadIcon } from '../ui/icons'
import { RecipeCard, RecipeCardSkeleton } from './RecipeCard'
import { RecipeDetailModal } from './RecipeDetailModal'
import { PdfUpload } from './PdfUpload'
import { AddRecipeModal } from './AddRecipeModal'

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
  const [sortKey, setSortKey] = useState<SortKey>('newest')
  const [selected, setSelected] = useState<Recipe | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [adding, setAdding] = useState(false)

  // Per-recipe cook count + average rating from the journal.
  const stats = useMemo(() => {
    const m = new Map<string, CookStats>()
    for (const r of recipes) m.set(r.id, cookStats(cookLog, r))
    return m
  }, [recipes, cookLog])

  const filtered = useMemo(() => {
    const statFor = (r: Recipe): CookStats => stats.get(r.id) ?? { count: 0, avg: 0 }
    let list = recipes.filter((r) => matchesSearch(r, query) && matchesProtein(r, filter))
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
  }, [recipes, query, filter, cookedFilter, sortKey, stats])

  const hasRecipes = recipes.length > 0

  return (
    <div className="mx-auto max-w-6xl px-3 py-5 sm:px-6 sm:py-8">
      {/* Header row */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-800 sm:text-3xl">
            Recipe Repository
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {recipes.length} {recipes.length === 1 ? 'recipe' : 'recipes'} in your library
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-start">
          <button onClick={() => setAdding(true)} className="btn-secondary">
            <PlusIcon width={18} height={18} /> Add manually
          </button>
          <PdfUpload onExtractingChange={setExtracting} />
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <SearchIcon
          width={18}
          height={18}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by title, tag, or cuisine…"
          className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-slate-800 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-herb-400 focus:ring-2 focus:ring-herb-100"
        />
      </div>

      {/* Protein filter chips */}
      <div className="mb-3 flex flex-wrap gap-2">
        {PROTEIN_FILTERS.map((f) => {
          const active = filter === f
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`chip ${
                active
                  ? 'border-herb-500 bg-herb-500 text-white shadow-sm'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-herb-300 hover:text-herb-700'
              }`}
            >
              {f}
            </button>
          )
        })}
      </div>

      {/* Cooked filter + sort */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {COOKED_FILTERS.map(({ id, label }) => {
          const active = cookedFilter === id
          return (
            <button
              key={id}
              onClick={() => setCookedFilter(id)}
              className={`chip ${
                active
                  ? 'border-slate-700 bg-slate-700 text-white shadow-sm'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-800'
              }`}
            >
              {label}
            </button>
          )
        })}
        <label className="ml-auto flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Sort</span>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="tap-target rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm outline-none focus:border-herb-400"
          >
            <option value="newest">Newest first</option>
            <option value="rating">Highest rated</option>
            <option value="title">Title A–Z</option>
          </select>
        </label>
      </div>

      {/* Grid / states */}
      {extracting && !hasRecipes ? (
        <SkeletonGrid />
      ) : !hasRecipes ? (
        <EmptyLibrary onAdd={() => setAdding(true)} />
      ) : filtered.length === 0 ? (
        <NoMatches onReset={() => { setQuery(''); setFilter('All'); setCookedFilter('all') }} />
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
    </div>
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
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white/60 px-6 py-16 text-center">
      <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-herb-50 text-herb-500">
        <BookIcon width={32} height={32} />
      </span>
      <h2 className="text-lg font-bold text-slate-800">No recipes yet</h2>
      <p className="mt-1 max-w-xs text-sm text-slate-500">
        Upload a recipe PDF and we'll extract it for you — or add one by hand.
      </p>
      <div className="mt-4 flex flex-col items-center gap-2 sm:flex-row">
        <button onClick={onAdd} className="btn-secondary">
          <PlusIcon width={16} height={16} /> Add manually
        </button>
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-herb-600">
          <UploadIcon width={16} height={16} /> or use “Upload PDF” above
        </span>
      </div>
    </div>
  )
}

function NoMatches({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white/60 px-6 py-16 text-center">
      <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        <SearchIcon width={32} height={32} />
      </span>
      <h2 className="text-lg font-bold text-slate-800">No matching recipes</h2>
      <p className="mt-1 text-sm text-slate-500">Try a different search or filter.</p>
      <button onClick={onReset} className="btn-secondary mt-4">
        Clear filters
      </button>
    </div>
  )
}
