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
}

export interface Step {
  id: string
  order: number
  instruction: string
  timerSeconds?: number
}

export interface Recipe {
  id: string
  title: string
  cuisine: string
  protein: string[]
  servings: number
  cookTime: string
  prepTime: string
  ingredients: Ingredient[]
  steps: Step[]
  tags: string[]
  sourceFile: string
}

/** A single ingredient added to the shopping list, tagged with its source recipe. */
export interface ShoppingEntry {
  id: string
  name: string
  quantity: number
  unit: string
  category: Category
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
