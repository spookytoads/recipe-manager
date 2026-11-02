/**
 * Thin, typed wrapper around localStorage. All app state is persisted here so
 * the grocery list survives a refresh — even on spotty in-store signal.
 *
 * Values are LZ-compressed before writing: a large recipe library (~5MB of JSON)
 * blows past iOS Safari's ~5MB localStorage quota uncompressed, which silently
 * drops the save and makes the library vanish on the next load. Compression
 * shrinks it ~5-30x so it fits with huge headroom.
 */
import { compressToUTF16, decompressFromUTF16 } from 'lz-string'

const PREFIX = 'recipe-manager:'
// Leading marker (a control char JSON never starts with) tags a compressed value.
const COMPRESSED = '\u0001'

export const KEYS = {
  recipes: `${PREFIX}recipes`,
  shopping: `${PREFIX}shopping`,
  checked: `${PREFIX}shopping-checked`,
  multiplier: `${PREFIX}shopping-multiplier`,
  cookQueue: `${PREFIX}cook-queue`,
  cookProgress: `${PREFIX}cook-progress`,
  cookLog: `${PREFIX}cook-log`,
  seeded: `${PREFIX}seeded`,
  updatedAt: `${PREFIX}updated-at`,
  deleted: `${PREFIX}deleted-titles`,
  activityUpdatedAt: `${PREFIX}activity-updated-at`,
} as const

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw == null) return fallback
    // Compressed values start with the marker; older values are plain JSON.
    const json = raw[0] === COMPRESSED ? decompressFromUTF16(raw.slice(1)) : raw
    if (json == null) return fallback
    return JSON.parse(json) as T
  } catch {
    return fallback
  }
}

export function save<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, COMPRESSED + compressToUTF16(JSON.stringify(value)))
  } catch {
    // Quota exceeded or storage unavailable (private mode). Fail silently —
    // the in-memory state still works for this session.
  }
}
