import type { CookLogEntry, Recipe } from '../types'

/**
 * Journal entries for a recipe, matched by exact id or case-insensitive title.
 * Title matching keeps cooking history attached across re-uploads, which
 * assign the recipe a new id.
 */
export function reviewsForRecipe(cookLog: CookLogEntry[], recipe: Recipe): CookLogEntry[] {
  const title = recipe.title.trim().toLowerCase()
  return cookLog.filter(
    (e) => e.recipeId === recipe.id || e.recipeTitle.trim().toLowerCase() === title
  )
}

export interface CookStats {
  /** How many times the recipe has been cooked (journal entries). */
  count: number
  /** Average star rating across rated cooks, or 0 when none are rated. */
  avg: number
}

/** Cook count + average rating for a recipe. */
export function cookStats(cookLog: CookLogEntry[], recipe: Recipe): CookStats {
  const entries = reviewsForRecipe(cookLog, recipe)
  const rated = entries.filter((e) => e.rating > 0)
  return {
    count: entries.length,
    avg: rated.length ? rated.reduce((s, e) => s + e.rating, 0) / rated.length : 0,
  }
}
