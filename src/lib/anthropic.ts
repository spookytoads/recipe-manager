import type { Category, Ingredient, Recipe, Step } from '../types'
import { CATEGORIES } from '../types'
import { uid } from './util'

const API_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-sonnet-4-20250514'

// The Anthropic API accepts at most 100 pages per request. We split larger
// PDFs into sections of this size so arbitrarily long cookbooks work, and so a
// single request's output isn't truncated by the token ceiling. Kept small
// because dense cookbooks run ~1 recipe per page — 10 pages ≈ 10 recipes per
// request, which stays comfortably under the output-token budget below.
const CHUNK_PAGES = 10

// Output ceiling per request. 10 recipes' worth of JSON is well under this.
const MAX_TOKENS = 24000

const SYSTEM_PROMPT =
  'You are a recipe extraction assistant. A PDF may contain ONE recipe or MANY recipes (e.g. a cookbook or a multi-page collection). Extract EVERY distinct recipe you find. Return ONLY a valid JSON object with no markdown and no explanation, of the form { "recipes": [ ... ] }, where each element of the array matches this exact structure: { title, cuisine, protein[], servings, cookTime, prepTime, ingredients: [{ id, name, quantity, unit, category }], steps: [{ id, order, instruction, timerSeconds }], tags[] }. If the document contains a single recipe, return an array with exactly one element. Keep recipes separate — never merge ingredients or steps from different recipes. For protein, identify all primary proteins present. For ingredient category, classify as one of: Produce, Proteins, Dairy, Pantry, Spices, Beverages, Other.'

export class RecipeExtractionError extends Error {}

/** Encode raw bytes as a base64 string (without any data: URL prefix). */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const slice = 0x8000 // process in 32KB blocks to avoid call-stack limits
  for (let i = 0; i < bytes.length; i += slice) {
    binary += String.fromCharCode(...bytes.subarray(i, i + slice))
  }
  return btoa(binary)
}

/** Pull the outermost JSON value (object or array) out of a string, ignoring stray prose. */
function extractJson(text: string): string {
  const trimmed = text.trim()
  const candidates = [trimmed.indexOf('{'), trimmed.indexOf('[')].filter((i) => i !== -1)
  const start = candidates.length ? Math.min(...candidates) : -1
  const end = Math.max(trimmed.lastIndexOf('}'), trimmed.lastIndexOf(']'))
  if (start === -1 || end === -1 || end <= start) {
    throw new RecipeExtractionError('The model did not return JSON.')
  }
  return trimmed.slice(start, end + 1)
}

/** Normalize the parsed JSON into a list of recipe-shaped objects, however the model wrapped them. */
function toRecipeList(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) return parsed
  if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>
    if (Array.isArray(obj.recipes)) return obj.recipes
    // Model returned a single bare recipe object — wrap it.
    return [parsed]
  }
  return []
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = parseFloat(value)
    if (isFinite(parsed)) return parsed
  }
  return fallback
}

function asCategory(value: unknown): Category {
  const s = String(value ?? '').trim()
  const match = CATEGORIES.find((c) => c.toLowerCase() === s.toLowerCase())
  return match ?? 'Other'
}

/** Coerce arbitrary parsed JSON into a well-formed Recipe with stable ids. */
function normalizeRecipe(raw: unknown, sourceFile: string): Recipe {
  if (typeof raw !== 'object' || raw === null) {
    throw new RecipeExtractionError('Extracted recipe was not an object.')
  }
  const r = raw as Record<string, unknown>

  const ingredientsRaw = Array.isArray(r.ingredients) ? r.ingredients : []
  const ingredients: Ingredient[] = ingredientsRaw.map((item) => {
    const i = (item ?? {}) as Record<string, unknown>
    return {
      id: typeof i.id === 'string' && i.id ? i.id : uid('ing'),
      name: String(i.name ?? '').trim() || 'Unnamed ingredient',
      quantity: asNumber(i.quantity, 1),
      unit: String(i.unit ?? '').trim(),
      category: asCategory(i.category),
    }
  })

  const stepsRaw = Array.isArray(r.steps) ? r.steps : []
  const steps: Step[] = stepsRaw.map((item, idx) => {
    const s = (item ?? {}) as Record<string, unknown>
    const timer = asNumber(s.timerSeconds, 0)
    return {
      id: typeof s.id === 'string' && s.id ? s.id : uid('step'),
      order: asNumber(s.order, idx + 1),
      instruction: String(s.instruction ?? '').trim(),
      ...(timer > 0 ? { timerSeconds: timer } : {}),
    }
  })

  const protein = Array.isArray(r.protein)
    ? r.protein.map((p) => String(p).toLowerCase().trim()).filter(Boolean)
    : []
  const tags = Array.isArray(r.tags) ? r.tags.map((t) => String(t).trim()).filter(Boolean) : []

  if (!ingredients.length && !steps.length) {
    throw new RecipeExtractionError("Couldn't find any recipe content in that PDF.")
  }

  return {
    id: uid('recipe'),
    title: String(r.title ?? '').trim() || 'Untitled Recipe',
    cuisine: String(r.cuisine ?? '').trim() || 'Other',
    protein,
    servings: Math.max(1, Math.round(asNumber(r.servings, 4))),
    cookTime: String(r.cookTime ?? '').trim() || '—',
    prepTime: String(r.prepTime ?? '').trim() || '—',
    ingredients,
    steps: steps.sort((a, b) => a.order - b.order),
    tags,
    sourceFile,
  }
}

/** Send one base64 PDF (≤100 pages) to the API and return its recipes. */
async function extractFromBase64(base64: string, apiKey: string, sourceFile: string): Promise<Recipe[]> {
  let response: Response
  try {
    response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        // Required to call the API directly from a browser.
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: MODEL,
        // Generous ceiling so multi-recipe (cookbook) sections aren't truncated.
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: { type: 'base64', media_type: 'application/pdf', data: base64 },
              },
              {
                type: 'text',
                text: 'Extract every recipe in this PDF as JSON, following the system instructions exactly. Return { "recipes": [...] }.',
              },
            ],
          },
        ],
      }),
    })
  } catch {
    throw new RecipeExtractionError(
      'Network error contacting the Anthropic API. Check your connection and try again.'
    )
  }

  if (!response.ok) {
    let detail = ''
    try {
      const errBody = await response.json()
      detail = errBody?.error?.message ? `: ${errBody.error.message}` : ''
    } catch {
      /* ignore parse errors */
    }
    if (response.status === 401) {
      throw new RecipeExtractionError('API key was rejected (401). Double-check your key.')
    }
    if (response.status === 429) {
      throw new RecipeExtractionError('Rate limited (429). Wait a moment and retry.')
    }
    throw new RecipeExtractionError(`Anthropic API error (${response.status})${detail}`)
  }

  const data = await response.json()
  const text: string =
    data?.content?.map((block: { text?: string }) => block.text ?? '').join('') ?? ''

  if (!text.trim()) {
    throw new RecipeExtractionError('The model returned an empty response.')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(extractJson(text))
  } catch {
    throw new RecipeExtractionError("Couldn't parse the recipe JSON from the model's response.")
  }

  // Normalize each recipe, skipping any malformed/empty entries rather than
  // failing the whole batch on one bad recipe in a long document.
  const recipes: Recipe[] = []
  for (const item of toRecipeList(parsed)) {
    try {
      recipes.push(normalizeRecipe(item, sourceFile))
    } catch {
      /* skip this entry */
    }
  }
  return recipes
}

/** Split a PDF's bytes into base64-encoded sections of at most CHUNK_PAGES pages. */
async function splitPdfToBase64(buffer: ArrayBuffer): Promise<string[]> {
  // Lazy-load pdf-lib only when a PDF is actually uploaded, keeping it out of
  // the initial bundle (important for fast first load / offline shell).
  const { PDFDocument } = await import('pdf-lib')
  const src = await PDFDocument.load(buffer, { ignoreEncryption: true })
  const total = src.getPageCount()

  if (total <= CHUNK_PAGES) {
    return [bytesToBase64(new Uint8Array(buffer))]
  }

  const chunks: string[] = []
  for (let start = 0; start < total; start += CHUNK_PAGES) {
    const end = Math.min(start + CHUNK_PAGES, total)
    const sub = await PDFDocument.create()
    const indices = Array.from({ length: end - start }, (_, i) => start + i)
    const pages = await sub.copyPages(src, indices)
    pages.forEach((p) => sub.addPage(p))
    chunks.push(bytesToBase64(await sub.save()))
  }
  return chunks
}

/** Merge recipes from multiple sections, collapsing duplicates split across a boundary. */
function dedupeByTitle(recipes: Recipe[]): Recipe[] {
  const byKey = new Map<string, Recipe>()
  const score = (r: Recipe) => r.ingredients.length + r.steps.length
  for (const r of recipes) {
    const title = r.title.trim().toLowerCase()
    // Don't collapse generic/untitled recipes into one another.
    const key = title && title !== 'untitled recipe' ? title : r.id
    const existing = byKey.get(key)
    if (!existing || score(r) > score(existing)) byKey.set(key, r)
  }
  return [...byKey.values()]
}

export interface ExtractionResult {
  recipes: Recipe[]
  /** Total number of sections the PDF was split into. */
  sections: number
  /** How many sections failed to extract (e.g. truncated/garbled output). */
  failedSections: number
}

/**
 * Send a PDF to the Anthropic API and return every recipe found in it.
 * Long PDFs (more than {@link CHUNK_PAGES} pages, including ones over the API's
 * 100-page-per-request limit) are split into sections, extracted, and merged.
 * A single failing section is skipped rather than aborting the whole import, so
 * a 100-recipe cookbook doesn't fail because one page didn't parse.
 * `onProgress` receives human-readable status updates for multi-section files.
 * Throws RecipeExtractionError only when nothing could be extracted at all.
 */
export async function extractRecipesFromPdf(
  file: File,
  onProgress?: (message: string) => void
): Promise<ExtractionResult> {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new RecipeExtractionError(
      'No API key configured. Set VITE_ANTHROPIC_API_KEY in your environment.'
    )
  }

  const buffer = await file.arrayBuffer()

  let sections: string[]
  try {
    sections = await splitPdfToBase64(buffer)
  } catch {
    // If we can't parse the PDF structure (e.g. unusual encoding), fall back to
    // sending the whole file as a single request and let the API decide.
    sections = [bytesToBase64(new Uint8Array(buffer))]
  }

  const all: Recipe[] = []
  let failedSections = 0
  let lastError: unknown = null

  for (let i = 0; i < sections.length; i++) {
    if (sections.length > 1) {
      onProgress?.(`Reading section ${i + 1} of ${sections.length}…`)
    }
    try {
      const recipes = await extractFromBase64(sections[i], apiKey, file.name)
      all.push(...recipes)
    } catch (err) {
      // For a one-shot file, surface the real error (bad key, network, etc.).
      if (sections.length === 1) throw err
      lastError = err
      failedSections += 1
    }
  }

  const merged = dedupeByTitle(all)
  if (merged.length === 0) {
    // Nothing parsed — surface the underlying reason if we captured one.
    if (lastError instanceof RecipeExtractionError) throw lastError
    throw new RecipeExtractionError("Couldn't find any recipes in that PDF.")
  }
  return { recipes: merged, sections: sections.length, failedSections }
}
