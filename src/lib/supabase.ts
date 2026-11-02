import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { compressToBase64, decompressFromBase64 } from 'lz-string'
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
  /** Normalized titles of recipes the user deleted — so deletions propagate. */
  deletedTitles?: string[]
  /** When the activity bundle (shopping/checked/queue/progress) last changed. */
  activityUpdatedAt?: string
}

const normTitle = (t: string) => t.trim().toLowerCase()

/** A user's cloud state plus when it was last written (for last-write-wins). */
export interface CloudSnapshot {
  state: SyncState
  updatedAt: string | null
}

/**
 * Cheap "has anything changed?" check: fetch only the row's updated_at, not the
 * (potentially multi-MB) data blob. Used to skip the full pull when nothing new.
 */
export async function fetchCloudUpdatedAt(userId: string): Promise<string | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('app_state')
    .select('updated_at')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return (data?.updated_at as string | undefined) ?? null
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
  const raw = data?.data
  if (raw == null) return null
  // New rows store the state LZ-compressed (a string, ~4x smaller to transfer);
  // older rows stored the raw JSON object. Handle both.
  const state =
    typeof raw === 'string'
      ? (JSON.parse(decompressFromBase64(raw) || 'null') as SyncState | null)
      : (raw as SyncState)
  if (!state) return null
  return { state, updatedAt: (data?.updated_at as string | undefined) ?? null }
}

/**
 * Merge a local and cloud snapshot so sync never destroys library data.
 *
 * Recipes and the cooking journal are treated as additive: the result is the
 * union of both sides (by recipe title / log id), so an empty or stale device
 * can never wipe the other's recipes. The "activity" bundle (shopping list,
 * checkmarks, serving multiplier, cook queue and cook progress) is taken as a
 * whole from whichever side touched *activity* most recently — tracked by its
 * own `activityUpdatedAt` stamp, independent of recipe edits, so editing a
 * recipe on one device never overwrites shopping/cook state changed on another.
 */
export function mergeSyncStates(local: SyncState, remote: SyncState, localIsNewer: boolean): SyncState {
  const newer = localIsNewer ? local : remote
  const older = localIsNewer ? remote : local

  // Recipes: union by title. On a title collision keep the newer side's copy.
  const recipesByTitle = new Map<string, Recipe>()
  for (const r of older.recipes ?? []) recipesByTitle.set(normTitle(r.title), r)
  for (const r of newer.recipes ?? []) recipesByTitle.set(normTitle(r.title), r)

  // Deletions: union both sides' tombstones, but let the more-recent side's
  // intent win a conflict — if the newer side currently *has* a title (and did
  // not tombstone it) it was re-added after the delete, so un-tombstone it.
  const tomb = new Set<string>([...(local.deletedTitles ?? []), ...(remote.deletedTitles ?? [])].map(normTitle))
  const newerTomb = new Set((newer.deletedTitles ?? []).map(normTitle))
  const newerTitles = new Set((newer.recipes ?? []).map((r) => normTitle(r.title)))
  for (const t of [...tomb]) {
    if (newerTitles.has(t) && !newerTomb.has(t)) tomb.delete(t)
  }

  // Drop any recipe whose title is tombstoned.
  const recipes = [...recipesByTitle.values()].filter((r) => !tomb.has(normTitle(r.title)))

  // Cooking journal: union by entry id.
  const logById = new Map<string, CookLogEntry>()
  for (const e of remote.cookLog ?? []) logById.set(e.id, e)
  for (const e of local.cookLog ?? []) logById.set(e.id, e)

  // Activity bundle: whichever side changed activity most recently wins the
  // whole bundle. This uses activityUpdatedAt (not the global stamp), so a
  // recipe edit or a stale device can't clobber shopping/cook state. Falls back
  // to the global order when a side has no activity stamp yet (legacy data).
  const la = local.activityUpdatedAt ?? ''
  const ra = remote.activityUpdatedAt ?? ''
  const activityLocalNewer = la && ra ? la >= ra : la ? true : ra ? false : localIsNewer
  const activity = activityLocalNewer ? local : remote

  return {
    recipes,
    cookLog: [...logById.values()],
    deletedTitles: [...tomb],
    shopping: activity.shopping ?? [],
    checked: activity.checked ?? [],
    multiplier: activity.multiplier ?? 1,
    cookQueue: activity.cookQueue ?? [],
    cookProgress: activity.cookProgress ?? {},
    activityUpdatedAt: (la > ra ? la : ra) || undefined,
  }
}

/** Upsert a user's full state. Returns the updated_at stamp it wrote (or ''). */
export async function saveCloudState(userId: string, state: SyncState): Promise<string> {
  if (!supabase) return ''
  const updatedAt = new Date().toISOString()
  // Store compressed (~4x smaller) so the transfer is quick even on a weak phone
  // connection; fetchCloudState handles both compressed strings and legacy JSON.
  const data = compressToBase64(JSON.stringify(state))
  const { error } = await supabase
    .from('app_state')
    .upsert({ user_id: userId, data, updated_at: updatedAt })
  if (error) throw error
  return updatedAt
}
