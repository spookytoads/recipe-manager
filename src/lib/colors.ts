/**
 * A fixed palette of distinct, legible color sets, plus a deterministic mapping
 * from a recipe (by title) to one of them. Used to give each recipe its own
 * color on the shopping list and the roulette wheel so you can trace at a glance
 * which item came from which recipe.
 *
 * Colors are returned as hex strings (not Tailwind classes) so they can be used
 * in inline styles without worrying about the Tailwind purge step.
 */
export interface RecipeColor {
  /** light background tint for a chip/pill */
  bg: string
  /** readable foreground text on `bg` */
  text: string
  /** slightly stronger border to match */
  border: string
  /** saturated accent (e.g. a dot or wheel slice) */
  accent: string
}

export const RECIPE_PALETTE: RecipeColor[] = [
  { bg: '#fef3c7', text: '#92400e', border: '#fcd34d', accent: '#f59e0b' }, // amber
  { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd', accent: '#3b82f6' }, // blue
  { bg: '#fce7f3', text: '#9d174d', border: '#f9a8d4', accent: '#ec4899' }, // pink
  { bg: '#ede9fe', text: '#5b21b6', border: '#c4b5fd', accent: '#8b5cf6' }, // violet
  { bg: '#d1fae5', text: '#065f46', border: '#6ee7b7', accent: '#10b981' }, // emerald
  { bg: '#ffedd5', text: '#9a3412', border: '#fdba74', accent: '#f97316' }, // orange
  { bg: '#cffafe', text: '#155e75', border: '#67e8f9', accent: '#06b6d4' }, // cyan
  { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5', accent: '#ef4444' }, // red
  { bg: '#e0e7ff', text: '#3730a3', border: '#a5b4fc', accent: '#6366f1' }, // indigo
  { bg: '#ecfccb', text: '#3f6212', border: '#bef264', accent: '#84cc16' }, // lime
  { bg: '#f3e8ff', text: '#6b21a8', border: '#d8b4fe', accent: '#a855f7' }, // purple
  { bg: '#fae8ff', text: '#86198f', border: '#f0abfc', accent: '#d946ef' }, // fuchsia
  { bg: '#ccfbf1', text: '#115e59', border: '#5eead4', accent: '#14b8a6' }, // teal
  { bg: '#ffe4e6', text: '#9f1239', border: '#fda4af', accent: '#f43f5e' }, // rose
]

function hashString(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

/** Deterministic color for a recipe, keyed by its title (stable across reloads). */
export function recipeColor(key: string): RecipeColor {
  return RECIPE_PALETTE[hashString(key.trim().toLowerCase()) % RECIPE_PALETTE.length]
}
