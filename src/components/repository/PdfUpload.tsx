import { useRef, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { extractRecipesFromPdf, RecipeExtractionError } from '../../lib/extraction'
import { AlertIcon, ResetIcon, UploadIcon } from '../ui/icons'
import { Spinner } from '../ui/Spinner'

export function PdfUpload({
  onExtractingChange,
}: {
  onExtractingChange?: (extracting: boolean) => void
}) {
  const { addRecipe, pushToast, recipes: existingRecipes } = useApp()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const lastFile = useRef<File | null>(null)

  const runExtraction = async (file: File) => {
    lastFile.current = file
    setError(null)
    setStatus(null)
    setBusy(true)
    onExtractingChange?.(true)
    try {
      const { recipes, failedPages, expectedCount } = await extractRecipesFromPdf(file, (msg) =>
        setStatus(msg)
      )

      // Skip recipes whose title is already in the library (makes re-uploading
      // the same cookbook safe — only the missing ones get added).
      const have = new Set(existingRecipes.map((r) => r.title.trim().toLowerCase()))
      const fresh = recipes.filter((r) => !have.has(r.title.trim().toLowerCase()))
      const skipped = recipes.length - fresh.length

      // Add in reverse so the first recipe in the document ends up on top.
      for (const recipe of [...fresh].reverse()) addRecipe(recipe)

      let message: string
      if (fresh.length === 0) {
        message = `Those ${recipes.length} recipes are already in your library`
      } else if (fresh.length === 1) {
        message = `"${fresh[0].title}" extracted and added to your library`
      } else {
        message = `Added ${fresh.length} recipes from ${file.name}`
      }
      if (skipped > 0 && fresh.length > 0) {
        message += ` (${skipped} already in your library)`
      }
      if (failedPages > 0) {
        message += ` — ${failedPages} page${failedPages > 1 ? 's' : ''} couldn't be read`
      }
      const shortfall = expectedCount ? expectedCount - recipes.length : 0
      if (shortfall > 0) {
        message += ` — the book lists ~${expectedCount}; re-upload to retry the ${shortfall} still missing`
      }
      pushToast(message, failedPages > 0 || shortfall > 0 ? 'info' : 'success')
    } catch (err) {
      const message =
        err instanceof RecipeExtractionError
          ? err.message
          : 'Something went wrong during extraction.'
      setError(message)
    } finally {
      setBusy(false)
      setStatus(null)
      onExtractingChange?.(false)
    }
  }

  const handleFile = (file: File | undefined) => {
    if (!file) return
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Please choose a PDF file.')
      return
    }
    void runExtraction(file)
  }

  return (
    <div className="flex flex-col items-stretch gap-2 sm:items-end">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0])
          e.target.value = '' // allow re-selecting the same file
        }}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="btn-primary w-full sm:w-auto"
      >
        {busy ? (
          <>
            <Spinner size={18} /> {status ?? 'Extracting…'}
          </>
        ) : (
          <>
            <UploadIcon width={18} height={18} /> Upload PDF
          </>
        )}
      </button>

      {busy && status && (
        <p className="max-w-sm text-xs font-medium text-slate-500">
          Large cookbooks take several minutes — keep this tab open and your screen awake until
          it finishes.
        </p>
      )}

      {error && (
        <div className="flex w-full max-w-sm items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
          <AlertIcon width={18} height={18} className="mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="font-medium leading-snug">{error}</p>
            {lastFile.current && (
              <button
                onClick={() => lastFile.current && runExtraction(lastFile.current)}
                disabled={busy}
                className="mt-1.5 inline-flex items-center gap-1.5 font-semibold text-red-800 underline-offset-2 hover:underline"
              >
                <ResetIcon width={14} height={14} /> Retry
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
