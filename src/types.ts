export type Category =
  | 'Produce'
  | 'Proteins'
  | 'Dairy'
  | 'Pantry'
  | 'Spices'
  | 'Beverages'
  | 'Other'

export const CATEGORIES: Category[] = [
  'Produce',
  'Proteins',
  'Dairy',
  'Pantry',
  'Spices',
  'Beverages',
  'Other',
]

export interface Ingredient {
  id: string
  name: string
  quantity: number
  unit: string
  category: Category
  /** Optional recipe component this ingredient belongs to, e.g. "Sauce", "Marinade". */
  group?: string
  /** Optional second measurement the recipe lists, e.g. "200 g (1 cup)" → alt = 1 cup. */
  altQuantity?: number
  altUnit?: string
}

export interface Step {
  id: string
  order: number
  instruction: string
  timerSeconds?: number
}

/** Per-serving nutrition. All fields optional — only populated when the recipe states them. */
export interface Nutrition {
  /** kcal per serving */
  calories?: number
  /** grams per serving */
  protein?: number
  carbs?: number
  fat?: number
  fiber?: number
  sugar?: number
  /** milligrams per serving */
  sodium?: number
}

/** Ordered list of nutrition fields with display labels and units. */
export const NUTRITION_FIELDS: { key: keyof Nutrition; label: string; unit: string }[] = [
  { key: 'calories', label: 'Calories', unit: '' },
  { key: 'protein', label: 'Protein', unit: 'g' },
  { key: 'carbs', label: 'Carbs', unit: 'g' },
  { key: 'fat', label: 'Fat', unit: 'g' },
  { key: 'fiber', label: 'Fiber', unit: 'g' },
  { key: 'sugar', label: 'Sugar', unit: 'g' },
  { key: 'sodium', label: 'Sodium', unit: 'mg' },
]

export interface Recipe {
  id: string
  title: string
  cuisine: string
  protein: string[]
  servings: number
  /** Optional description of one serving, e.g. "1 cup (240g)". */
  servingSize?: string
  cookTime: string
  prepTime: string
  ingredients: Ingredient[]
  steps: Step[]
  tags: string[]
  /** Per-serving nutrition, only present when the recipe provides it. */
  nutrition?: Nutrition
  sourceFile: string
}

/** A single ingredient added to the shopping list, tagged with its source recipe. */
export interface ShoppingEntry {
  id: string
  name: string
  quantity: number
  unit: string
  category: Category
  altQuantity?: number
  altUnit?: string
  recipeId: string
  recipeTitle: string
}

/** Per-recipe cooking progress, persisted so you don't lose your place. */
export interface CookProgress {
  checkedIngredients: string[]
  completedSteps: string[]
}

/** A journal entry recording that you cooked a recipe, with an optional review. */
export interface CookLogEntry {
  id: string
  recipeId: string
  recipeTitle: string
  /** ISO calendar date, 'YYYY-MM-DD'. */
  dateCooked: string
  /** 1–5 stars, or 0 when unrated. */
  rating: number
  notes: string
}

export const PROTEIN_FILTERS = [
  'All',
  'Chicken',
  'Beef',
  'Pork',
  'Seafood',
  'Vegetarian',
] as const

export type ProteinFilter = (typeof PROTEIN_FILTERS)[number]
