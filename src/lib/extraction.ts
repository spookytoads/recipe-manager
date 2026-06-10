import type { Category, Ingredient, Nutrition, Recipe, Step } from '../types'
import { CATEGORIES, NUTRITION_FIELDS } from '../types'
import { uid } from './util'

// Google Gemini — free tier reads PDFs (up to 1000 pages) and returns JSON.
// gemini-2.5-flash is the current stable free-tier model (10 req/min, 250/day).
const GEMINI_MODEL = 'gemini-2.5-flash'
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

// We split long PDFs into sections of this size so a single request's JSON
// output stays under the token ceiling. If a section's output is still too big
// (a dense cookbook page can hold several recipes), the section is automatically
// re-split into smaller page ranges and retried — so nothing is silently lost.
const CHUNK_PAGES = 8

// Output ceiling per request. gemini-2.5-flash allows up to ~65k output tokens;
// we use a generous budget so normal sections never truncate.
const MAX_TOKENS = 60000

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

const SYSTEM_PROMPT =
  'You are a recipe extraction assistant. The input (a PDF or pasted text) may contain ONE recipe or MANY recipes (e.g. a cookbook or a multi-page collection). Extract EVERY distinct recipe you find. Return ONLY a valid JSON object with no markdown and no explanation, of the form { "recipes": [ ... ] }, where each element of the array matches this exact structure: { title, cuisine, protein[], servings, servingSize, cookTime, prepTime, ingredients: [{ id, name, quantity, unit, category, altQuantity, altUnit }], steps: [{ id, order, instruction, timerSeconds }], tags[], nutrition: { calories, protein, carbs, fat, fiber, sugar, sodium } }. If the input contains a single recipe, return an array with exactly one element. Keep recipes separate — never merge ingredients or steps from different recipes. Preserve each ingredient\'s unit exactly as written (g, cups, tbsp, tsp, oz, etc.). IMPORTANT: when an ingredient lists TWO measurements (e.g. "200 g (1 cup)" or "2 tbsp (30 g)"), put the first as quantity+unit and the SECOND as altQuantity+altUnit — capture both exactly as printed; never convert or compute a second measurement yourself, and omit altQuantity/altUnit when the recipe only gives one measurement. For protein, identify all primary proteins present. For ingredient category, classify as one of: Produce, Proteins, Dairy, Pantry, Spices, Beverages, Other. For servingSize, copy the recipe\'s stated serving description (e.g. "1 cup (240g)") if given, else omit it. CRITICAL: include the "nutrition" object ONLY if the recipe explicitly prints nutrition facts — NEVER estimate, calculate, or invent nutrition values. If no nutrition information is printed, omit the nutrition field entirely. Nutrition is PER SERVING: calories in kcal; protein, carbs, fat, fiber, sugar in grams; sodium in milligrams.'

export class RecipeExtractionError extends Error {}

export interface ExtractionResult {
  recipes: Recipe[]
  /** Total number of pages in the PDF (1 for pasted text). */
  totalPages: number
  /** How many individual pages couldn't be read even after splitting + retries. */
  failedPages: number
}

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

/** Coerce a nutrition object, keeping only positive numeric fields. Returns undefined if empty. */
function asNutrition(raw: unknown): Nutrition | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const n = raw as Record<string, unknown>
  // Accept a couple of common aliases the model might emit.
  const aliased: Record<string, unknown> = {
    ...n,
    calories: n.calories ?? n.kcal ?? n.cal,
    carbs: n.carbs ?? n.carbohydrates ?? n.carbohydrate,
  }
  const result: Nutrition = {}
  let any = false
  for (const { key } of NUTRITION_FIELDS) {
    const v = asNumber(aliased[key], NaN)
    if (isFinite(v) && v > 0) {
      result[key] = Math.round(v * 10) / 10
      any = true
    }
  }
  return any ? result : undefined
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
    const altQuantity = asNumber(i.altQuantity, NaN)
    const altUnit = String(i.altUnit ?? '').trim()
    const hasAlt = isFinite(altQuantity) && altQuantity > 0 && !!altUnit
    return {
      id: typeof i.id === 'string' && i.id ? i.id : uid('ing'),
      name: String(i.name ?? '').trim() || 'Unnamed ingredient',
      quantity: asNumber(i.quantity, 1),
      unit: String(i.unit ?? '').trim(),
      category: asCategory(i.category),
      ...(hasAlt ? { altQuantity, altUnit } : {}),
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
    throw new RecipeExtractionError("Couldn't find any recipe content.")
  }

  const servingSize = String(r.servingSize ?? '').trim()
  const nutrition = asNutrition(r.nutrition)

  return {
    id: uid('recipe'),
    title: String(r.title ?? '').trim() || 'Untitled Recipe',
    cuisine: String(r.cuisine ?? '').trim() || 'Other',
    protein,
    servings: Math.max(1, Math.round(asNumber(r.servings, 4))),
    ...(servingSize ? { servingSize } : {}),
    cookTime: String(r.cookTime ?? '').trim() || '—',
    prepTime: String(r.prepTime ?? '').trim() || '—',
    ingredients,
    steps: steps.sort((a, b) => a.order - b.order),
    tags,
    ...(nutrition ? { nutrition } : {}),
    sourceFile,
  }
}

/** Parse a model JSON response into normalized recipes, skipping malformed entries. */
function parseRecipes(text: string, sourceFile: string): Recipe[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(extractJson(text))
  } catch {
    throw new RecipeExtractionError("Couldn't parse the recipe JSON from the model's response.")
  }
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

function getApiKey(): string {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY
  if (!apiKey) {
    throw new RecipeExtractionError(
      'No API key configured. Set VITE_GEMINI_API_KEY (get a free key at aistudio.google.com).'
    )
  }
  return apiKey
}

/** Call Gemini with the given content parts and return its raw text response. */
async function callGemini(parts: unknown[], apiKey: string): Promise<string> {
  let response: Response
  try {
    response = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        generationConfig: {
          responseMimeType: 'application/json',
          maxOutputTokens: MAX_TOKENS,
          temperature: 0,
          // Disable "thinking" so it doesn't consume the output budget on extraction.
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    })
  } catch {
    throw new RecipeExtractionError(
      'Network error contacting the Gemini API. Check your connection and try again.'
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
    if (response.status === 400 && /api key not valid/i.test(detail)) {
      throw new RecipeExtractionError('API key was rejected. Double-check your Gemini key.')
    }
    if (response.status === 403) {
      throw new RecipeExtractionError('Access denied (403). Check that your Gemini key is valid and enabled.')
    }
    if (response.status === 429) {
      throw new RecipeExtractionError(
        'Rate limited (429) — the free tier allows a limited number of requests per minute/day. Wait a moment and retry.'
      )
    }
    throw new RecipeExtractionError(`Gemini API error (${response.status})${detail}`)
  }

  const data = await response.json()

  const blockReason = data?.promptFeedback?.blockReason
  if (blockReason) {
    throw new RecipeExtractionError(`The request was blocked by the API (${blockReason}).`)
  }

  const candidate = data?.candidates?.[0]
  const text: string =
    candidate?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? ''

  if (!text.trim()) {
    if (candidate?.finishReason === 'MAX_TOKENS') {
      throw new RecipeExtractionError(
        'The response was cut off — too many recipes in one section. Try a smaller PDF.'
      )
    }
    throw new RecipeExtractionError('The model returned an empty response.')
  }
  return text
}

/** Send one base64 PDF section to Gemini and return its recipes. */
async function extractFromBase64(base64: string, apiKey: string, sourceFile: string): Promise<Recipe[]> {
  const text = await callGemini(
    [
      { inline_data: { mime_type: 'application/pdf', data: base64 } },
      {
        text: 'Extract every recipe in this PDF as JSON, following the system instructions exactly. Return { "recipes": [...] }.',
      },
    ],
    apiKey
  )
  return parseRecipes(text, sourceFile)
}

/** Should a failure be retried as-is (transient), rather than re-split? */
function isTransient(err: unknown): boolean {
  return (
    err instanceof RecipeExtractionError &&
    /rate limited|network error|temporarily|overloaded|empty response/i.test(err.message)
  )
}

/** Call extraction with backoff retries for transient errors (rate limits, network). */
async function extractWithRetry(
  base64: string,
  apiKey: string,
  sourceFile: string,
  onProgress?: (message: string) => void
): Promise<Recipe[]> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await extractFromBase64(base64, apiKey, sourceFile)
    } catch (err) {
      if (isTransient(err) && attempt < 3) {
        const waitS = 8 * (attempt + 1)
        onProgress?.(`Rate limited — waiting ${waitS}s before retrying…`)
        await sleep(waitS * 1000)
        continue
      }
      throw err
    }
  }
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

/**
 * Send a PDF to the Gemini API and return every recipe found in it.
 *
 * The PDF is processed as a queue of page ranges (CHUNK_PAGES at a time). If a
 * range's output is truncated or unparseable, it's automatically split in half
 * and the halves are retried — down to single pages — so a dense section never
 * silently drops all its recipes. Transient failures (rate limits, network) are
 * retried with backoff. Only genuinely unreadable single pages are reported as
 * failed. `onProgress` receives human-readable status updates.
 * Throws RecipeExtractionError only when nothing could be extracted at all.
 */
export async function extractRecipesFromPdf(
  file: File,
  onProgress?: (message: string) => void
): Promise<ExtractionResult> {
  const apiKey = getApiKey()
  const buffer = await file.arrayBuffer()

  // Lazy-load pdf-lib only when a PDF is actually uploaded.
  const { PDFDocument } = await import('pdf-lib')
  let loaded: import('pdf-lib').PDFDocument | null = null
  try {
    loaded = await PDFDocument.load(buffer, { ignoreEncryption: true })
  } catch {
    loaded = null
  }

  if (!loaded) {
    // Can't parse the PDF structure — send the whole file as one request.
    const recipes = await extractWithRetry(
      bytesToBase64(new Uint8Array(buffer)),
      apiKey,
      file.name,
      onProgress
    )
    const merged = dedupeByTitle(recipes)
    if (merged.length === 0) throw new RecipeExtractionError("Couldn't find any recipes in that PDF.")
    return { recipes: merged, totalPages: 1, failedPages: 0 }
  }

  const src = loaded
  const total = src.getPageCount()

  // Render a [start, end) page range to a base64 PDF.
  const renderRange = async (start: number, end: number): Promise<string> => {
    const sub = await PDFDocument.create()
    const indices = Array.from({ length: end - start }, (_, i) => start + i)
    const pages = await sub.copyPages(src, indices)
    pages.forEach((p) => sub.addPage(p))
    return bytesToBase64(await sub.save())
  }

  // Work queue of page ranges; ranges that fail get split and pushed back on.
  const queue: Array<[number, number]> = []
  for (let s = 0; s < total; s += CHUNK_PAGES) queue.push([s, Math.min(s + CHUNK_PAGES, total)])

  const all: Recipe[] = []
  let failedPages = 0
  let lastError: unknown = null
  let processed = 0

  while (queue.length) {
    const [start, end] = queue.shift()!
    processed += 1
    onProgress?.(
      total > CHUNK_PAGES ? `Reading pages ${start + 1}–${end} of ${total}…` : 'Reading recipe…'
    )
    try {
      const base64 = await renderRange(start, end)
      const recipes = await extractWithRetry(base64, apiKey, file.name, onProgress)
      all.push(...recipes)
    } catch (err) {
      lastError = err
      // A bad API key (etc.) won't improve by splitting — bail out.
      if (err instanceof RecipeExtractionError && /api key|access denied/i.test(err.message)) {
        throw err
      }
      if (end - start > 1) {
        // Truncated or garbled: split this range and retry the halves first.
        const mid = Math.floor((start + end) / 2)
        queue.unshift([mid, end])
        queue.unshift([start, mid])
      } else {
        // A single page we still couldn't read.
        failedPages += 1
      }
    }
    // Light pacing to stay under the free-tier per-minute request cap.
    if (queue.length) await sleep(700)
  }

  const merged = dedupeByTitle(all)
  if (merged.length === 0) {
    if (lastError instanceof RecipeExtractionError) throw lastError
    throw new RecipeExtractionError("Couldn't find any recipes in that PDF.")
  }
  return { recipes: merged, totalPages: total, failedPages }
}

/**
 * Parse pasted recipe text into structured recipes via Gemini (no PDF needed).
 * Powers the "paste & parse" path in the manual Add Recipe form.
 */
export async function extractRecipesFromText(rawText: string): Promise<ExtractionResult> {
  const apiKey = getApiKey()
  const trimmed = rawText.trim()
  if (!trimmed) {
    throw new RecipeExtractionError('Paste some recipe text first.')
  }
  const text = await callGemini(
    [
      {
        text: `Extract every recipe from the following text as JSON, following the system instructions exactly. Return { "recipes": [...] }.\n\n---\n${trimmed}`,
      },
    ],
    apiKey
  )
  const recipes = dedupeByTitle(parseRecipes(text, 'pasted-text'))
  if (recipes.length === 0) {
    throw new RecipeExtractionError("Couldn't find a recipe in that text.")
  }
  return { recipes, totalPages: 1, failedPages: 0 }
}
