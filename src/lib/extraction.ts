import type { Category, Ingredient, Nutrition, Recipe, Step } from '../types'
import { CATEGORIES, NUTRITION_FIELDS } from '../types'
import { uid } from './util'

// Google Gemini — free tier reads PDFs (up to 1000 pages) and returns JSON.
// gemini-2.5-flash is the current stable free-tier model (10 req/min, 250/day).
const GEMINI_MODEL = 'gemini-2.5-flash'
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

// We still split long PDFs into sections of this size — not because of an input
// page limit (Gemini allows 1000), but so a single request's JSON output stays
// under the token ceiling. Dense cookbooks run ~1 recipe per page, so 10 pages
// ≈ 10 recipes per request.
const CHUNK_PAGES = 10

// Output ceiling per request. 10 recipes' worth of JSON is well under this.
const MAX_TOKENS = 24000

const SYSTEM_PROMPT =
  'You are a recipe extraction assistant. The input (a PDF or pasted text) may contain ONE recipe or MANY recipes (e.g. a cookbook or a multi-page collection). Extract EVERY distinct recipe you find. Return ONLY a valid JSON object with no markdown and no explanation, of the form { "recipes": [ ... ] }, where each element of the array matches this exact structure: { title, cuisine, protein[], servings, servingSize, cookTime, prepTime, ingredients: [{ id, name, quantity, unit, category, altQuantity, altUnit }], steps: [{ id, order, instruction, timerSeconds }], tags[], nutrition: { calories, protein, carbs, fat, fiber, sugar, sodium } }. If the input contains a single recipe, return an array with exactly one element. Keep recipes separate — never merge ingredients or steps from different recipes. Preserve each ingredient\'s unit exactly as written (g, cups, tbsp, tsp, oz, etc.). IMPORTANT: when an ingredient lists TWO measurements (e.g. "200 g (1 cup)" or "2 tbsp (30 g)"), put the first as quantity+unit and the SECOND as altQuantity+altUnit — capture both exactly as printed; never convert or compute a second measurement yourself, and omit altQuantity/altUnit when the recipe only gives one measurement. For protein, identify all primary proteins present. For ingredient category, classify as one of: Produce, Proteins, Dairy, Pantry, Spices, Beverages, Other. For servingSize, copy the recipe\'s stated serving description (e.g. "1 cup (240g)") if given, else omit it. CRITICAL: include the "nutrition" object ONLY if the recipe explicitly prints nutrition facts — NEVER estimate, calculate, or invent nutrition values. If no nutrition information is printed, omit the nutrition field entirely. Nutrition is PER SERVING: calories in kcal; protein, carbs, fat, fiber, sugar in grams; sodium in milligrams.'

export class RecipeExtractionError extends Error {}

export interface ExtractionResult {
  recipes: Recipe[]
  /** Total number of sections the PDF was split into. */
  sections: number
  /** How many sections failed to extract (e.g. truncated/garbled output). */
  failedSections: number
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

/**
 * Send a PDF to the Gemini API and return every recipe found in it.
 * Long PDFs are split into sections, extracted, and merged. A single failing
 * section is skipped rather than aborting the whole import, so a 100-recipe
 * cookbook doesn't fail because one page didn't parse.
 * `onProgress` receives human-readable status updates for multi-section files.
 * Throws RecipeExtractionError only when nothing could be extracted at all.
 */
export async function extractRecipesFromPdf(
  file: File,
  onProgress?: (message: string) => void
): Promise<ExtractionResult> {
  const apiKey = getApiKey()
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
  return { recipes, sections: 1, failedSections: 0 }
}
