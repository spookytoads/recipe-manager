import type { Ingredient, ProteinFilter, Recipe } from '../types'

/**
 * Split a recipe's ingredients into ordered component groups (e.g. "Marinade",
 * "Sauce"). Ingredients with no group fall under `group: null`. Returns a single
 * `null` group when the recipe has no component sections at all.
 */
export function groupIngredients(
  ingredients: Ingredient[]
): { group: string | null; items: Ingredient[] }[] {
  const order: (string | null)[] = []
  const map = new Map<string | null, Ingredient[]>()
  for (const ing of ingredients) {
    const g = ing.group?.trim() || null
    if (!map.has(g)) {
      map.set(g, [])
      order.push(g)
    }
    map.get(g)!.push(ing)
  }
  return order.map((g) => ({ group: g, items: map.get(g)! }))
}

let counter = 0
/** Reasonably unique id without pulling in a uuid dependency. */
export function uid(prefix = 'id'): string {
  counter += 1
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}-${Math.floor(
    Math.random() * 1e6
  ).toString(36)}`
}

/** Format a possibly-fractional quantity nicely (e.g. 0.5 -> "½", 1.5 -> "1½"). */
export function formatQuantity(qty: number): string {
  if (!isFinite(qty)) return ''
  const rounded = Math.round(qty * 100) / 100
  const whole = Math.floor(rounded)
  const frac = rounded - whole

  const fractions: Record<string, string> = {
    '0.25': '¼',
    '0.33': '⅓',
    '0.5': '½',
    '0.67': '⅔',
    '0.75': '¾',
  }
  const key = frac.toFixed(2).replace(/0$/, '').replace(/\.$/, '')
  const fracSymbol = fractions[frac.toFixed(2)] ?? fractions[key]

  if (fracSymbol) {
    return whole > 0 ? `${whole}${fracSymbol}` : fracSymbol
  }
  // Trim trailing zeros for clean decimals.
  return String(rounded)
}

const PROTEIN_KEYWORDS: Record<Exclude<ProteinFilter, 'All'>, string[]> = {
  Chicken: ['chicken', 'poultry', 'turkey'],
  Beef: ['beef', 'steak', 'ground beef'],
  Pork: ['pork', 'bacon', 'ham', 'sausage'],
  Seafood: ['fish', 'salmon', 'shrimp', 'seafood', 'tuna', 'cod', 'crab', 'scallop'],
  Vegetarian: ['vegetarian', 'vegan', 'veggie', 'plant', 'tofu'],
}

/** Does a recipe match a protein filter chip? */
export function matchesProtein(recipe: Recipe, filter: ProteinFilter): boolean {
  if (filter === 'All') return true
  const haystack = recipe.protein.join(' ').toLowerCase()
  const keywords = PROTEIN_KEYWORDS[filter]
  return keywords.some((k) => haystack.includes(k))
}

/** Does a recipe match the free-text search (title, tags, cuisine)? */
export function matchesSearch(recipe: Recipe, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return (
    recipe.title.toLowerCase().includes(q) ||
    recipe.cuisine.toLowerCase().includes(q) ||
    recipe.tags.some((t) => t.toLowerCase().includes(q)) ||
    recipe.protein.some((p) => p.toLowerCase().includes(q))
  )
}

/** Format seconds as M:SS or H:MM:SS. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }
  return `${m}:${String(sec).padStart(2, '0')}`
}

/** Title-cased, readable protein label for display. */
export function proteinLabel(p: string): string {
  return p.charAt(0).toUpperCase() + p.slice(1)
}

/**
 * Render an ingredient amount, including a second measurement when present,
 * e.g. "200 g (1 cup)". Both measurements scale by the same `scale` factor.
 */
export function formatMeasure(
  quantity: number,
  unit: string,
  altQuantity?: number,
  altUnit?: string,
  scale = 1
): string {
  const main = `${formatQuantity(quantity * scale)}${unit ? ` ${unit}` : ''}`.trim()
  if (typeof altQuantity === 'number' && altUnit) {
    return `${main} (${formatQuantity(altQuantity * scale)} ${altUnit})`
  }
  return main
}

/**
 * Human-friendly label for where a recipe came from. Each recipe carries a
 * `sourceFile`: a PDF/cookbook filename, a JSON import filename, or a sentinel
 * for hand-entered / pasted recipes.
 */
export function sourceLabel(sourceFile: string | undefined): string {
  const s = (sourceFile ?? '').trim()
  if (!s || s === 'manual-entry') return 'Added manually'
  if (s === 'pasted-text') return 'Pasted text'
  // Strip the file extension, tidy separators, and drop our "- recipes" export suffix.
  return (
    s
      .replace(/\.[a-z0-9]+$/i, '')
      .replace(/_+/g, ' ')
      .replace(/\s*-\s*recipes$/i, '')
      .replace(/\s{2,}/g, ' ')
      .trim() || 'Added manually'
  )
}

/** Today's local calendar date as 'YYYY-MM-DD' (for date inputs). */
export function todayISO(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Format an ISO 'YYYY-MM-DD' as a friendly local date, e.g. "Jun 6, 2026". */
export function formatDate(iso: string): string {
  const parts = iso.split('-').map(Number)
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return iso
  const [y, m, d] = parts
  // Construct in local time to avoid UTC off-by-one shifts.
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}
