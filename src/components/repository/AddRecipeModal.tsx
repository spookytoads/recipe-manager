import { useEffect, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { CATEGORIES, NUTRITION_FIELDS, type Category, type Nutrition, type Recipe } from '../../types'
import { extractRecipesFromText, RecipeExtractionError } from '../../lib/extraction'
import { uid } from '../../lib/util'
import { AlertIcon, CloseIcon, PlusIcon, TrashIcon } from '../ui/icons'
import { Spinner } from '../ui/Spinner'

interface IngRow {
  key: string
  name: string
  quantity: string
  unit: string
  altQuantity: string
  altUnit: string
  category: Category
}

interface StepRow {
  key: string
  instruction: string
  minutes: string
}

const emptyIng = (): IngRow => ({
  key: uid('row'),
  name: '',
  quantity: '',
  unit: '',
  altQuantity: '',
  altUnit: '',
  category: 'Other',
})
const emptyStep = (): StepRow => ({ key: uid('row'), instruction: '', minutes: '' })

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-herb-400 focus:ring-2 focus:ring-herb-100'

export function AddRecipeModal({ onClose }: { onClose: () => void }) {
  const { addRecipe, pushToast } = useApp()

  const [title, setTitle] = useState('')
  const [cuisine, setCuisine] = useState('')
  const [servings, setServings] = useState('4')
  const [servingSize, setServingSize] = useState('')
  const [prepTime, setPrepTime] = useState('')
  const [cookTime, setCookTime] = useState('')
  const [proteinInput, setProteinInput] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [macros, setMacros] = useState<Record<string, string>>({})
  const [ingredients, setIngredients] = useState<IngRow[]>([emptyIng()])
  const [steps, setSteps] = useState<StepRow[]>([emptyStep()])
  const [error, setError] = useState<string | null>(null)

  // Paste & parse
  const [pasteText, setPasteText] = useState('')
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const splitCsv = (s: string) =>
    s
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)

  const fillFromRecipe = (r: Recipe) => {
    setTitle(r.title === 'Untitled Recipe' ? '' : r.title)
    setCuisine(r.cuisine === 'Other' ? '' : r.cuisine)
    setServings(String(r.servings))
    setServingSize(r.servingSize ?? '')
    setPrepTime(r.prepTime === '—' ? '' : r.prepTime)
    setCookTime(r.cookTime === '—' ? '' : r.cookTime)
    setProteinInput(r.protein.join(', '))
    setTagsInput(r.tags.join(', '))
    const m: Record<string, string> = {}
    if (r.nutrition) {
      for (const { key } of NUTRITION_FIELDS) {
        const v = r.nutrition[key]
        if (typeof v === 'number') m[key] = String(v)
      }
    }
    setMacros(m)
    setIngredients(
      r.ingredients.length
        ? r.ingredients.map((i) => ({
            key: uid('row'),
            name: i.name,
            quantity: i.quantity ? String(i.quantity) : '',
            unit: i.unit,
            altQuantity: typeof i.altQuantity === 'number' ? String(i.altQuantity) : '',
            altUnit: i.altUnit ?? '',
            category: i.category,
          }))
        : [emptyIng()]
    )
    setSteps(
      r.steps.length
        ? r.steps.map((s) => ({
            key: uid('row'),
            instruction: s.instruction,
            minutes: s.timerSeconds ? String(Math.round(s.timerSeconds / 60)) : '',
          }))
        : [emptyStep()]
    )
  }

  const handleParse = async () => {
    setParseError(null)
    setParsing(true)
    try {
      const { recipes } = await extractRecipesFromText(pasteText)
      fillFromRecipe(recipes[0])
      setError(null)
      if (recipes.length > 1) {
        pushToast(`Found ${recipes.length} recipes — filled in the first. Save it, then parse the next.`, 'info')
      } else {
        pushToast('Parsed — review the fields below and save')
      }
    } catch (err) {
      setParseError(
        err instanceof RecipeExtractionError ? err.message : 'Something went wrong parsing that text.'
      )
    } finally {
      setParsing(false)
    }
  }

  const handleSave = () => {
    if (!title.trim()) {
      setError('Please give the recipe a title.')
      return
    }
    const nutrition: Nutrition = {}
    let anyMacro = false
    for (const { key } of NUTRITION_FIELDS) {
      const raw = macros[key]
      const v = Number(raw)
      if (raw?.trim() && isFinite(v) && v > 0) {
        nutrition[key] = v
        anyMacro = true
      }
    }

    const recipe: Recipe = {
      id: uid('recipe'),
      title: title.trim(),
      cuisine: cuisine.trim() || 'Other',
      protein: splitCsv(proteinInput.toLowerCase()),
      servings: Math.max(1, Math.round(Number(servings) || 4)),
      ...(servingSize.trim() ? { servingSize: servingSize.trim() } : {}),
      cookTime: cookTime.trim() || '—',
      prepTime: prepTime.trim() || '—',
      ingredients: ingredients
        .filter((i) => i.name.trim())
        .map((i) => {
          const altQ = Number(i.altQuantity)
          const hasAlt = i.altQuantity.trim() !== '' && isFinite(altQ) && altQ > 0 && i.altUnit.trim() !== ''
          return {
            id: uid('ing'),
            name: i.name.trim(),
            quantity: Number(i.quantity) || 0,
            unit: i.unit.trim(),
            category: i.category,
            ...(hasAlt ? { altQuantity: altQ, altUnit: i.altUnit.trim() } : {}),
          }
        }),
      steps: steps
        .filter((s) => s.instruction.trim())
        .map((s, idx) => {
          const mins = Number(s.minutes)
          return {
            id: uid('step'),
            order: idx + 1,
            instruction: s.instruction.trim(),
            ...(mins > 0 ? { timerSeconds: Math.round(mins * 60) } : {}),
          }
        }),
      tags: splitCsv(tagsInput),
      ...(anyMacro ? { nutrition } : {}),
      sourceFile: 'manual-entry',
    }
    addRecipe(recipe)
    pushToast(`"${recipe.title}" added to your library`)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex animate-fade-in items-end justify-center bg-slate-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Add a recipe"
    >
      <div
        className="flex max-h-[94vh] w-full max-w-2xl animate-slide-up flex-col overflow-hidden rounded-t-3xl bg-cream shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200/70 px-5 py-3.5">
          <h2 className="text-lg font-extrabold tracking-tight text-slate-800">Add a Recipe</h2>
          <button
            onClick={onClose}
            className="tap-target flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4 sm:px-6">
          {/* Paste & parse */}
          <section className="rounded-2xl border border-herb-200 bg-herb-50/60 p-4">
            <h3 className="text-sm font-bold text-herb-800">Paste a recipe & auto-fill</h3>
            <p className="mt-0.5 text-xs text-herb-700/80">
              Copy a recipe from anywhere, paste it here, and let AI fill in the fields below. Or
              skip this and type it in manually.
            </p>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              rows={4}
              placeholder="Paste the full recipe text here…"
              className={`${inputClass} mt-2.5 resize-y`}
            />
            {parseError && (
              <div className="mt-2 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                <AlertIcon width={16} height={16} className="mt-0.5 shrink-0" />
                <span>{parseError}</span>
              </div>
            )}
            <button
              onClick={handleParse}
              disabled={parsing || !pasteText.trim()}
              className="btn-primary mt-2.5"
            >
              {parsing ? (
                <>
                  <Spinner size={16} /> Parsing…
                </>
              ) : (
                'Parse with AI'
              )}
            </button>
          </section>

          {/* Basics */}
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="text-xs font-semibold text-slate-500">Title *</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Lemon Herb Chicken"
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-slate-500">Cuisine</span>
              <input value={cuisine} onChange={(e) => setCuisine(e.target.value)} placeholder="Italian" className={inputClass} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-slate-500">Servings</span>
              <input
                type="number"
                min={1}
                value={servings}
                onChange={(e) => setServings(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="text-xs font-semibold text-slate-500">Serving size (optional)</span>
              <input
                value={servingSize}
                onChange={(e) => setServingSize(e.target.value)}
                placeholder="e.g. 1 cup (240g) or 3 tacos"
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-slate-500">Prep time</span>
              <input value={prepTime} onChange={(e) => setPrepTime(e.target.value)} placeholder="15 min" className={inputClass} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-slate-500">Cook time</span>
              <input value={cookTime} onChange={(e) => setCookTime(e.target.value)} placeholder="30 min" className={inputClass} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-slate-500">Protein (comma-separated)</span>
              <input value={proteinInput} onChange={(e) => setProteinInput(e.target.value)} placeholder="chicken, beef" className={inputClass} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-slate-500">Tags (comma-separated)</span>
              <input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="dinner, quick" className={inputClass} />
            </label>
          </section>

          {/* Nutrition (optional, per serving) */}
          <section>
            <h3 className="mb-1 text-sm font-bold uppercase tracking-wide text-slate-500">
              Nutrition <span className="font-medium normal-case text-slate-400">· per serving, optional</span>
            </h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {NUTRITION_FIELDS.map(({ key, label, unit }) => (
                <label key={key} className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-slate-500">
                    {label}
                    {unit ? ` (${unit})` : ''}
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={macros[key] ?? ''}
                    onChange={(e) => setMacros((prev) => ({ ...prev, [key]: e.target.value }))}
                    className={`${inputClass} px-2.5 py-2 text-center`}
                  />
                </label>
              ))}
            </div>
          </section>

          {/* Ingredients */}
          <section>
            <h3 className="mb-1 text-sm font-bold uppercase tracking-wide text-slate-500">Ingredients</h3>
            <p className="mb-2 text-xs text-slate-400">
              Optional 2nd measurement (e.g. grams) goes in the last “+ qty / + unit” boxes.
            </p>
            <div className="space-y-2">
              {ingredients.map((row, idx) => (
                <div key={row.key} className="flex flex-wrap items-center gap-2">
                  <input
                    value={row.name}
                    onChange={(e) =>
                      setIngredients((prev) => prev.map((r) => (r.key === row.key ? { ...r, name: e.target.value } : r)))
                    }
                    placeholder="Ingredient"
                    className={`${inputClass} min-w-[130px] flex-1`}
                  />
                  <input
                    value={row.quantity}
                    onChange={(e) =>
                      setIngredients((prev) => prev.map((r) => (r.key === row.key ? { ...r, quantity: e.target.value } : r)))
                    }
                    placeholder="Qty"
                    className={`${inputClass} w-16 text-center`}
                  />
                  <input
                    value={row.unit}
                    onChange={(e) =>
                      setIngredients((prev) => prev.map((r) => (r.key === row.key ? { ...r, unit: e.target.value } : r)))
                    }
                    placeholder="Unit"
                    className={`${inputClass} w-20`}
                  />
                  <input
                    value={row.altQuantity}
                    onChange={(e) =>
                      setIngredients((prev) => prev.map((r) => (r.key === row.key ? { ...r, altQuantity: e.target.value } : r)))
                    }
                    placeholder="+ qty"
                    title="Optional second measurement amount"
                    className={`${inputClass} w-16 text-center`}
                  />
                  <input
                    value={row.altUnit}
                    onChange={(e) =>
                      setIngredients((prev) => prev.map((r) => (r.key === row.key ? { ...r, altUnit: e.target.value } : r)))
                    }
                    placeholder="+ unit"
                    title="Optional second measurement unit (e.g. g)"
                    className={`${inputClass} w-20`}
                  />
                  <select
                    value={row.category}
                    onChange={(e) =>
                      setIngredients((prev) =>
                        prev.map((r) => (r.key === row.key ? { ...r, category: e.target.value as Category } : r))
                      )
                    }
                    className={`${inputClass} w-28`}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => setIngredients((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== row.key) : prev))}
                    className="tap-target flex shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500"
                    aria-label={`Remove ingredient ${idx + 1}`}
                  >
                    <TrashIcon width={16} height={16} />
                  </button>
                </div>
              ))}
            </div>
            <button onClick={() => setIngredients((prev) => [...prev, emptyIng()])} className="btn-ghost mt-2 text-sm text-herb-700">
              <PlusIcon width={16} height={16} /> Add ingredient
            </button>
          </section>

          {/* Steps */}
          <section>
            <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">Steps</h3>
            <div className="space-y-2">
              {steps.map((row, idx) => (
                <div key={row.key} className="flex items-start gap-2">
                  <span className="mt-2.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-herb-500 text-sm font-bold text-white">
                    {idx + 1}
                  </span>
                  <textarea
                    value={row.instruction}
                    onChange={(e) =>
                      setSteps((prev) => prev.map((r) => (r.key === row.key ? { ...r, instruction: e.target.value } : r)))
                    }
                    placeholder="Describe this step…"
                    rows={2}
                    className={`${inputClass} flex-1 resize-y`}
                  />
                  <div className="flex shrink-0 items-center gap-1">
                    <input
                      value={row.minutes}
                      onChange={(e) =>
                        setSteps((prev) => prev.map((r) => (r.key === row.key ? { ...r, minutes: e.target.value } : r)))
                      }
                      placeholder="min"
                      title="Optional timer in minutes"
                      className={`${inputClass} mt-0.5 w-16 text-center`}
                    />
                    <button
                      onClick={() => setSteps((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== row.key) : prev))}
                      className="tap-target mt-0.5 flex items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500"
                      aria-label={`Remove step ${idx + 1}`}
                    >
                      <TrashIcon width={16} height={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setSteps((prev) => [...prev, emptyStep()])} className="btn-ghost mt-2 text-sm text-herb-700">
              <PlusIcon width={16} height={16} /> Add step
            </button>
          </section>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertIcon width={16} height={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-slate-200/70 bg-white p-4">
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button onClick={handleSave} className="btn-primary">
            Save Recipe
          </button>
        </div>
      </div>
    </div>
  )
}
