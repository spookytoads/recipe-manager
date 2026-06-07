import { useRef, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { extractRecipesFromPdf, RecipeExtractionError } from '../../lib/anthropic'
import { AlertIcon, ResetIcon, UploadIcon } from '../ui/icons'
import { Spinner } from '../ui/Spinner'

export function PdfUpload({
  onExtractingChange,
}: {
  onExtractingChange?: (extracting: boolean) => void
}) {
  const { addRecipe, pushToast } = useApp()
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
      const { recipes, failedSections } = await extractRecipesFromPdf(file, (msg) =>
        setStatus(msg)
      )
      // Add in reverse so the first recipe in the document ends up on top.
      for (const recipe of [...recipes].reverse()) addRecipe(recipe)

      let message =
        recipes.length === 1
          ? `"${recipes[0].title}" extracted and added to your library`
          : `Extracted ${recipes.length} recipes from ${file.name}`
      if (failedSections > 0) {
        message += ` — ${failedSections} section${failedSections > 1 ? 's' : ''} couldn't be read`
      }
      pushToast(message, failedSections > 0 ? 'info' : 'success')
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
        <p className="text-xs font-medium text-slate-500">
          Long PDF — splitting into sections. This can take a minute.
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
