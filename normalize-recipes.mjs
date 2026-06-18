/**
 * Converts raw Gemini/agent-extracted recipe JSON into the app's EXACT import format,
 * matching "Stealth Health Original Cookbook - 106 recipes.json" (the proven-working file).
 *
 * Output shape: { app, source, recipes: [...] } where each recipe has:
 *   title, cuisine, protein[], servings, servingSize, cookTime,
 *   ingredients[{name,quantity,unit,altQuantity?,altUnit?,category}],
 *   steps[{order,instruction,timerSeconds?}], tags[], nutrition{}, sourceFile
 *
 * Usage: node normalize-recipes.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'fs'

// ── Protein (array of canonical lowercase values used by the app) ───────────────
function mapProteins(proteinType, title, tags) {
  const hay = `${proteinType || ''} ${title || ''} ${(tags || []).join(' ')}`.toLowerCase()
  // primary protein only (matches original which lists a single primary)
  if (/\b(turkey)\b/.test(hay)) return ['turkey']
  if (/\b(chicken)\b/.test(hay)) return ['chicken']
  if (/\b(beef|steak|brisket|sirloin|ribeye|ground beef)\b/.test(hay)) return ['beef']
  if (/\b(pork|bacon|ham|sausage|chorizo|carnitas)\b/.test(hay)) return ['pork']
  if (/\b(shrimp|salmon|fish|tuna|cod|tilapia|seafood|crab|scallop)\b/.test(hay)) return ['seafood']
  if (/\b(meatless|vegan|vegetarian|tofu|chickpea|lentil|bean)\b/.test(hay)) return ['vegetarian']
  return ['chicken'] // most Stealth Health recipes are chicken; safe default
}

// ── Cuisine (one of the 11 the original uses; default American) ─────────────────
function mapCuisine(title, tags) {
  const hay = `${title || ''} ${(tags || []).join(' ')}`.toLowerCase()
  if (/burrito|taco|queso|enchilada|quesadilla|fajita|chipotle|nacho|carnitas|pico|mexican|salsa/.test(hay)) return 'Mexican'
  if (/korean|gochujang|bulgogi|kimchi/.test(hay)) return 'Korean'
  if (/cajun|creole|jambalaya|gumbo/.test(hay)) return 'Cajun'
  if (/curry|tikka|masala|indian|naan|tandoori/.test(hay)) return 'Indian'
  if (/hawaiian|teriyaki|pineapple|spam|poke|kalua/.test(hay)) return 'Hawaiian'
  if (/pasta|alfredo|parmesan|parmigiano|marinara|lasagna|italian|pesto|gnocchi|risotto|bolognese|linguine|orzo/.test(hay)) return 'Italian'
  if (/fried rice|soy|sesame|peanut|ramen|noodle|stir.?fry|sriracha|hoisin|lo mein|pad thai|dumpling|asian/.test(hay)) return 'Fusion'
  if (/mac.?n.?cheese|mac and cheese|fried chicken|biscuit|cornbread|grits|ranch|southern/.test(hay)) return 'Southern'
  if (/french|au poivre|provencal/.test(hay)) return 'French'
  if (/chimichurri|argentin/.test(hay)) return 'Argentinian'
  return 'American'
}

// ── Ingredient grocery-aisle category (Proteins/Dairy/Produce/Spices/Pantry/Other)
function mapIngredientCategory(rawName) {
  const n = (rawName || '').toLowerCase()
  // Produce-style peppers must beat the "pepper"→Spices rule
  if (/bell pepper|poblano|jalape|serrano|chili pepper|red pepper flake|green pepper/.test(n)) {
    if (/flake|powder|ground/.test(n)) return 'Spices'
    return 'Produce'
  }
  // Oils are Pantry even when named after produce (avocado oil, olive oil, sesame oil)
  if (/\boil\b/.test(n)) return 'Pantry'
  // Powders/seasonings are Spices even when named after produce (garlic powder, onion powder)
  if (/powder|seasoning|\bspice|paprika|cumin|oregano|cajun|cinnamon|chili flake|cayenne|turmeric|coriander|nutmeg|bay leaf|thyme|rosemary|italian seasoning/.test(n)) return 'Spices'
  if (/\b(egg|eggs|egg white|milk|cheese|yogurt|cream|butter|parmesan|parmigiano|mozzarella|cheddar|cottage cheese|buttermilk|sour cream|ricotta|feta|queso fresco)\b/.test(n)) return 'Dairy'
  if (/chicken|beef|steak|pork|turkey|bacon|sausage|shrimp|salmon|fish|tuna|cod|tilapia|tofu|brisket|sirloin|ribeye|thigh|breast|ground|meatball|chorizo|ham|crab|scallop/.test(n)) return 'Proteins'
  if (/onion|garlic|tomato|lettuce|cilantro|lime|lemon|spinach|broccoli|carrot|mushroom|potato|avocado|guacamole|corn|pea|scallion|green onion|chive|ginger|cucumber|zucchini|cabbage|kale|basil|parsley|herb|pepper\b|jalape|poblano|fresh|sprout|celery|squash|asparagus|cauliflower|shallot|leek/.test(n)) return 'Produce'
  if (/salt|pepper/.test(n)) return 'Spices'
  if (/rice|pasta|noodle|flour|sugar|sauce|soy|sriracha|honey|vinegar|broth|stock|bean|tortilla|bread|bun|breadcrumb|corn flake|peanut butter|ketchup|mustard|mayo|syrup|cornstarch|nutritional yeast|enchilada|salsa|pico|water|wine|hot sauce|gochujang|sesame|oat|quinoa|orzo|stuffing|panko|crouton/.test(n)) return 'Pantry'
  return 'Other'
}

function normUnit(u) {
  if (!u) return ''
  return String(u).trim().toLowerCase()
}

function normalizeIngredient(ing) {
  const out = {
    name: (ing.name || '').trim(),
    quantity: typeof ing.quantity === 'number' ? ing.quantity : 1, // original never uses null
    unit: normUnit(ing.unit),
    category: mapIngredientCategory(ing.name),
  }
  // The raw extraction's "category" holds the recipe's component/section heading
  // (e.g. "Chicken/Marinade", "Peanut Sauce") — keep it as the display group.
  const group = (ing.category || '').trim()
  if (group) out.group = group
  // include alt measurement only when present (matches original)
  if (typeof ing.altQuantity === 'number') {
    out.altQuantity = ing.altQuantity
    out.altUnit = normUnit(ing.altUnit)
  }
  return out
}

function normalizeStep(step, idx) {
  const out = {
    order: idx + 1,
    instruction: (step.instruction || step.step || '').trim(),
  }
  if (typeof step.timerMinutes === 'number' && step.timerMinutes > 0) {
    out.timerSeconds = Math.round(step.timerMinutes * 60)
  }
  return out
}

// cookTime: estimate the dominant active cook time (string "N min"), skipping marinate/rest
function deriveCookTime(steps) {
  const isPassive = s => /marinate|marinad|brine|chill|refrigerate|overnight|rest |let sit|let it sit|soak/.test((s.instruction || '').toLowerCase())
  const active = steps.filter(s => typeof s.timerMinutes === 'number' && s.timerMinutes > 0 && !isPassive(s))
  const all = steps.filter(s => typeof s.timerMinutes === 'number' && s.timerMinutes > 0)
  const pool = active.length ? active : all
  if (!pool.length) return '20 min'
  const max = Math.max(...pool.map(s => s.timerMinutes))
  return `${max} min`
}

function normalizeTags(tags) {
  return (tags || [])
    .map(t => String(t).trim().toLowerCase().replace(/\s+/g, '-'))
    .filter(Boolean)
}

function normalizeRecipe(raw, sourceFile) {
  const title = (raw.title || 'Untitled').trim().replace(/\s+/g, ' ')
  const tags = normalizeTags(raw.tags)
  const n = raw.nutrition || {}
  const steps = raw.steps || []

  return {
    title,
    cuisine: mapCuisine(title, raw.tags || []),
    protein: mapProteins(raw.proteinType, title, raw.tags || []),
    servings: typeof raw.servings === 'number' ? raw.servings : 1,
    servingSize: raw.servingSize || '1 serving',
    cookTime: deriveCookTime(steps),
    ingredients: (raw.ingredients || []).map(normalizeIngredient),
    steps: steps.map(normalizeStep),
    tags,
    nutrition: {
      calories: typeof n.calories === 'number' ? n.calories : null,
      protein: typeof n.protein === 'number' ? n.protein : null,
      carbs: typeof n.carbs === 'number' ? n.carbs : null,
      fat: typeof n.fat === 'number' ? n.fat : null,
    },
    sourceFile,
  }
}

const FILES = [
  {
    inFile:  'Stealth Health Slow Cooker - extracted.json',
    outFile: 'Stealth Health Slow Cooker Cookbook - recipes.json',
    book:    'Stealth_Health_Slow_Cooker_Cookbook_(2026_Update).pdf',
  },
  {
    inFile:  'Stealth Health Meal Prep - extracted.json',
    outFile: 'Stealth Health Meal Prep Cookbook - recipes.json',
    book:    'Stealth_Health_Meal_Prep_Cookbook_(2026_Update).pdf',
  },
]

for (const f of FILES) {
  if (!existsSync(f.inFile)) {
    console.log(`Skipping ${f.inFile} (not found yet)`)
    continue
  }

  const raw = JSON.parse(readFileSync(f.inFile, 'utf8'))
  const recipes = raw.map(r => normalizeRecipe(r, f.book))
  const payload = { app: 'recipe-manager', source: 'extracted-by-claude', recipes }
  writeFileSync(f.outFile, JSON.stringify(payload, null, 2), 'utf8')

  const withNutrition = recipes.filter(r => r.nutrition.calories !== null).length
  const withTimers    = recipes.filter(r => r.steps.some(s => 'timerSeconds' in s)).length
  const cuisineCounts = {}
  recipes.forEach(r => cuisineCounts[r.cuisine] = (cuisineCounts[r.cuisine] || 0) + 1)

  console.log(`${f.outFile}:`)
  console.log(`  ${recipes.length} recipes`)
  console.log(`  ${withNutrition}/${recipes.length} with nutrition`)
  console.log(`  ${withTimers}/${recipes.length} with step timers`)
  console.log(`  cuisines: ${JSON.stringify(cuisineCounts)}`)
}
