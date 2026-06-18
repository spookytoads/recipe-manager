import { useRef, useState } from 'react'
import { useApp } from '../../context/AppContext'
import type { CookLogEntry, Recipe } from '../../types'
import { normalizeRecipe } from '../../lib/extraction'
import { Spinner } from '../ui/Spinner'

/**
 * Import recipes from a JSON file (and restore journal entries from backups),
 * plus export the whole library as a backup file. The import accepts a bare
 * array of recipes, { recipes: [...] }, or a full export from this app.
 */
export function ImportExport() {
  const { recipes, cookLog, importRecipes, mergeCookLog, pushToast } = useApp()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  const handleExport = () => {
    const payload = {
      app: 'recipe-manager',
      exportedAt: new Date().toISOString(),
      recipes,
      cookLog,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `recipes-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    pushToast(`Exported ${recipes.length} recipes to a backup file`)
  }

  const handleImport = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    try {
      const text = await file.text()
      let parsed: unknown
      try {
        parsed = JSON.parse(text)
      } catch {
        pushToast("That file isn't valid JSON.", 'error')
        return
      }
      const obj = parsed as Record<string, unknown>
      const rawList: unknown[] = Array.isArray(parsed)
        ? parsed
        : Array.isArray(obj?.recipes)
          ? (obj.recipes as unknown[])
          : []
      if (!rawList.length) {
        pushToast('No recipes found in that file.', 'error')
        return
      }

      const imported: Recipe[] = []
      for (const item of rawList) {
        try {
          imported.push(normalizeRecipe(item, file.name))
        } catch {
          /* skip malformed entries */
        }
      }
      const { added, updated } = importRecipes(imported)

      if (Array.isArray(obj?.cookLog)) {
        mergeCookLog(obj.cookLog as CookLogEntry[])
      }

      if (added === 0 && updated === 0) {
        pushToast('No recipes found in that file.', 'info')
      } else {
        const parts: string[] = []
        if (added > 0) parts.push(`added ${added}`)
        if (updated > 0) parts.push(`refreshed ${updated}`)
        pushToast(`Import complete — ${parts.join(' · ')}`)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          void handleImport(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="btn-ghost py-1.5 text-xs text-royal-mute hover:bg-white/10 hover:text-choc"
        title="Import recipes from a JSON file"
      >
        {busy ? <Spinner size={14} /> : null} import file
      </button>
      <span className="text-choc/30">·</span>
      <button
        onClick={handleExport}
        className="btn-ghost py-1.5 text-xs text-royal-mute hover:bg-white/10 hover:text-choc"
        title="Download a backup of all recipes and journal entries"
      >
        export backup
      </button>
    </div>
  )
}
