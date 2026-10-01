import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { CookLogEntry, CookProgress, Recipe, ShoppingEntry } from '../types'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/** Whether cloud sync is wired up (both env vars present). When false, the app runs local-only. */
export const isSupabaseConfigured = Boolean(url && anonKey)

/** The Supabase client, or null when cloud sync isn't configured. */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null

/** The full set of user data we sync to the cloud (mirrors what lives in localStorage). */
export interface SyncState {
  recipes: Recipe[]
  shopping: ShoppingEntry[]
  checked: string[]
  multiplier: number
  cookQueue: string[]
  cookProgress: Record<string, CookProgress>
  cookLog: CookLogEntry[]
}

/** A user's cloud state plus when it was last written (for last-write-wins). */
export interface CloudSnapshot {
  state: SyncState
  updatedAt: string | null
}

/** Fetch a user's saved state (with its last-updated time), or null if none yet. */
export async function fetchCloudState(userId: string): Promise<CloudSnapshot | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('app_state')
    .select('data, updated_at')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  const state = data?.data as SyncState | undefined
  if (!state) return null
  return { state, updatedAt: (data?.updated_at as string | undefined) ?? null }
}

/**
 * Merge a local and cloud snapshot so sync never destroys library data.
 *
 * Recipes and the cooking journal are treated as additive: the result is the
 * union of both sides (by recipe title / log id), so an empty or stale device
 * can never wipe the other's recipes. Volatile "current activity" (shopping
 * list, checkmarks, multiplier, cook queue/progress) is taken wholesale from
 * whichever side was edited more recently.
 */
export function mergeSyncStates(local: SyncState, remote: SyncState, localIsNewer: boolean): SyncState {
  // Recipes: union by title. On a title collision keep the newer side's copy.
  const recipesByTitle = new Map<string, Recipe>()
  const firstPass = localIsNewer ? remote.recipes : local.recipes
  const secondPass = localIsNewer ? local.recipes : remote.recipes
  for (const r of firstPass ?? []) recipesByTitle.set(r.title.trim().toLowerCase(), r)
  for (const r of secondPass ?? []) recipesByTitle.set(r.title.trim().toLowerCase(), r)

  // Cooking journal: union by entry id.
  const logById = new Map<string, CookLogEntry>()
  for (const e of remote.cookLog ?? []) logById.set(e.id, e)
  for (const e of local.cookLog ?? []) logById.set(e.id, e)

  // Current activity: from the more-recently-edited side.
  const activity = localIsNewer ? local : remote

  return {
    recipes: [...recipesByTitle.values()],
    cookLog: [...logById.values()],
    shopping: activity.shopping ?? [],
    checked: activity.checked ?? [],
    multiplier: activity.multiplier ?? 1,
    cookQueue: activity.cookQueue ?? [],
    cookProgress: activity.cookProgress ?? {},
  }
}

/** Upsert a user's full state. */
export async function saveCloudState(userId: string, state: SyncState): Promise<void> {
  if (!supabase) return
  const { error } = await supabase
    .from('app_state')
    .upsert({ user_id: userId, data: state, updated_at: new Date().toISOString() })
  if (error) throw error
}
