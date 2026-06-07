/**
 * Thin, typed wrapper around localStorage. All app state is persisted here so
 * the grocery list survives a refresh — even on spotty in-store signal.
 */

const PREFIX = 'recipe-manager:'

export const KEYS = {
  recipes: `${PREFIX}recipes`,
  shopping: `${PREFIX}shopping`,
  checked: `${PREFIX}shopping-checked`,
  multiplier: `${PREFIX}shopping-multiplier`,
  cookQueue: `${PREFIX}cook-queue`,
  cookProgress: `${PREFIX}cook-progress`,
  cookLog: `${PREFIX}cook-log`,
  seeded: `${PREFIX}seeded`,
} as const

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw == null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function save<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Quota exceeded or storage unavailable (private mode). Fail silently —
    // the in-memory state still works for this session.
  }
}
