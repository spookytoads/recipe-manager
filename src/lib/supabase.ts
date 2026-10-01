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

/** Upsert a user's full state. */
export async function saveCloudState(userId: string, state: SyncState): Promise<void> {
  if (!supabase) return
  const { error } = await supabase
    .from('app_state')
    .upsert({ user_id: userId, data: state, updated_at: new Date().toISOString() })
  if (error) throw error
}
