import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { CookLogEntry, CookProgress, Recipe, ShoppingEntry } from '../types'
import { KEYS, load, save } from '../data/storage'
import { SEED_RECIPES } from '../data/seed'
import { uid } from '../lib/util'
import {
  fetchCloudState,
  isSupabaseConfigured,
  saveCloudState,
  supabase,
  type SyncState,
} from '../lib/supabase'

export type SyncStatus = 'off' | 'signed-out' | 'syncing' | 'synced' | 'error'

export interface CloudUser {
  id: string
  email: string
}

export type Section = 'repository' | 'shopping' | 'cook' | 'journal'

export interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
}

interface AppContextValue {
  // Navigation
  section: Section
  setSection: (s: Section) => void

  // Recipes
  recipes: Recipe[]
  addRecipe: (recipe: Recipe) => void
  importRecipes: (incoming: Recipe[]) => { added: number; updated: number }
  deleteRecipe: (id: string) => void

  // Shopping
  shopping: ShoppingEntry[]
  multiplier: number
  setMultiplier: (m: number) => void
  checkedKeys: string[]
  addRecipeToShopping: (recipe: Recipe) => void
  removeRecipeFromShopping: (recipeId: string) => void
  toggleChecked: (key: string) => void
  clearChecked: () => void
  clearAllShopping: () => void

  // Cook
  cookQueue: string[]
  activeCookId: string | null
  setActiveCookId: (id: string | null) => void
  startCooking: (recipe: Recipe) => void
  addToCookQueue: (recipe: Recipe) => void
  removeFromQueue: (id: string) => void
  getCookProgress: (recipeId: string) => CookProgress
  toggleCookIngredient: (recipeId: string, ingredientId: string) => void
  toggleCookStep: (recipeId: string, stepId: string) => void

  // Cooking journal
  cookLog: CookLogEntry[]
  addCookLog: (entry: Omit<CookLogEntry, 'id'>) => CookLogEntry
  updateCookLog: (id: string, patch: Partial<Omit<CookLogEntry, 'id'>>) => void
  deleteCookLog: (id: string) => void
  /** Merge journal entries from a backup file, skipping ids already present. */
  mergeCookLog: (entries: CookLogEntry[]) => void

  // Cloud sync
  cloudEnabled: boolean
  user: CloudUser | null
  syncStatus: SyncStatus
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<{ needsConfirmation: boolean }>
  signOut: () => Promise<void>

  // Toasts
  toasts: Toast[]
  pushToast: (message: string, type?: Toast['type']) => void
  dismissToast: (id: string) => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  // --- Recipes (seed on first load) ---
  const [recipes, setRecipes] = useState<Recipe[]>(() => {
    const seeded = load<boolean>(KEYS.seeded, false)
    const stored = load<Recipe[]>(KEYS.recipes, [])
    if (!seeded && stored.length === 0) {
      save(KEYS.recipes, SEED_RECIPES)
      save(KEYS.seeded, true)
      return SEED_RECIPES
    }
    return stored
  })

  const [section, setSection] = useState<Section>('repository')

  // --- Shopping ---
  const [shopping, setShopping] = useState<ShoppingEntry[]>(() =>
    load<ShoppingEntry[]>(KEYS.shopping, [])
  )
  const [checkedKeys, setCheckedKeys] = useState<string[]>(() =>
    load<string[]>(KEYS.checked, [])
  )
  const [multiplier, setMultiplierState] = useState<number>(() =>
    load<number>(KEYS.multiplier, 1)
  )

  // --- Cook ---
  const [cookQueue, setCookQueue] = useState<string[]>(() =>
    load<string[]>(KEYS.cookQueue, [])
  )
  const [activeCookId, setActiveCookId] = useState<string | null>(
    () => load<string[]>(KEYS.cookQueue, [])[0] ?? null
  )
  const [cookProgress, setCookProgress] = useState<Record<string, CookProgress>>(() =>
    load<Record<string, CookProgress>>(KEYS.cookProgress, {})
  )

  // --- Cooking journal ---
  const [cookLog, setCookLog] = useState<CookLogEntry[]>(() =>
    load<CookLogEntry[]>(KEYS.cookLog, [])
  )

  // --- Cloud sync ---
  const [user, setUser] = useState<CloudUser | null>(null)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(
    isSupabaseConfigured ? 'signed-out' : 'off'
  )
  const hydratingRef = useRef(false)
  const saveTimer = useRef<number | null>(null)

  // --- Toasts ---
  const [toasts, setToasts] = useState<Toast[]>([])
  const toastTimers = useRef<Record<string, number>>({})

  // --- Persistence effects ---
  useEffect(() => save(KEYS.recipes, recipes), [recipes])
  useEffect(() => save(KEYS.shopping, shopping), [shopping])
  useEffect(() => save(KEYS.checked, checkedKeys), [checkedKeys])
  useEffect(() => save(KEYS.multiplier, multiplier), [multiplier])
  useEffect(() => save(KEYS.cookQueue, cookQueue), [cookQueue])
  useEffect(() => save(KEYS.cookProgress, cookProgress), [cookProgress])
  useEffect(() => save(KEYS.cookLog, cookLog), [cookLog])

  // --- Cloud sync ---
  // Keep a always-fresh snapshot so login can push the current local state up.
  const stateRef = useRef<SyncState>({
    recipes,
    shopping,
    checked: checkedKeys,
    multiplier,
    cookQueue,
    cookProgress,
    cookLog,
  })
  useEffect(() => {
    stateRef.current = {
      recipes,
      shopping,
      checked: checkedKeys,
      multiplier,
      cookQueue,
      cookProgress,
      cookLog,
    }
  })

  // Replace all local state with a state pulled from the cloud.
  const applyState = useCallback((s: SyncState) => {
    hydratingRef.current = true
    setRecipes(s.recipes ?? [])
    setShopping(s.shopping ?? [])
    setCheckedKeys(s.checked ?? [])
    setMultiplierState(s.multiplier ?? 1)
    setCookQueue(s.cookQueue ?? [])
    setActiveCookId((s.cookQueue ?? [])[0] ?? null)
    setCookProgress(s.cookProgress ?? {})
    setCookLog(s.cookLog ?? [])
    // Let the immediate post-hydrate save effect skip, then re-enable saving.
    window.setTimeout(() => {
      hydratingRef.current = false
    }, 0)
  }, [])

  const handleUser = useCallback(
    async (u: { id: string; email?: string | null } | null) => {
      if (!u) {
        setUser(null)
        setSyncStatus(isSupabaseConfigured ? 'signed-out' : 'off')
        return
      }
      setUser({ id: u.id, email: u.email ?? '' })
      setSyncStatus('syncing')
      try {
        const remote = await fetchCloudState(u.id)
        if (remote) {
          // This account has cloud data — adopt it.
          applyState(remote)
        } else {
          // First login for this account — seed the cloud from current local data.
          await saveCloudState(u.id, stateRef.current)
        }
        setSyncStatus('synced')
      } catch {
        setSyncStatus('error')
      }
    },
    [applyState]
  )

  // Initialize auth: pick up an existing session and watch for changes.
  useEffect(() => {
    if (!supabase) return
    let active = true
    void supabase.auth.getSession().then(({ data }) => {
      if (active) void handleUser(data.session?.user ?? null)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      void handleUser(session?.user ?? null)
    })
    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [handleUser])

  // Push local changes up (debounced) whenever signed in.
  useEffect(() => {
    if (!supabase || !user || hydratingRef.current) return
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      setSyncStatus('syncing')
      saveCloudState(user.id, {
        recipes,
        shopping,
        checked: checkedKeys,
        multiplier,
        cookQueue,
        cookProgress,
        cookLog,
      })
        .then(() => setSyncStatus('synced'))
        .catch(() => setSyncStatus('error'))
    }, 1200)
  }, [user, recipes, shopping, checkedKeys, multiplier, cookQueue, cookProgress, cookLog])

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Cloud sync is not configured.')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }, [])

  const signUp = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Cloud sync is not configured.')
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
    return { needsConfirmation: !data.session }
  }, [])

  const signOut = useCallback(async () => {
    if (!supabase) return
    await supabase.auth.signOut()
  }, [])

  // --- Toast helpers ---
  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    const timer = toastTimers.current[id]
    if (timer) {
      window.clearTimeout(timer)
      delete toastTimers.current[id]
    }
  }, [])

  const pushToast = useCallback(
    (message: string, type: Toast['type'] = 'success') => {
      const id = uid('toast')
      setToasts((prev) => [...prev, { id, message, type }])
      toastTimers.current[id] = window.setTimeout(() => dismissToast(id), 3500)
    },
    [dismissToast]
  )

  // --- Recipe actions ---
  const addRecipe = useCallback((recipe: Recipe) => {
    setRecipes((prev) => [recipe, ...prev])
  }, [])

  // Import a batch: refresh recipes that already exist (matched by title, keeping
  // their id so journal/cook references survive) and add the genuinely new ones.
  const importRecipes = useCallback(
    (incoming: Recipe[]): { added: number; updated: number } => {
      const indexByTitle = new Map<string, number>()
      recipes.forEach((r, i) => indexByTitle.set(r.title.trim().toLowerCase(), i))
      const next = [...recipes]
      const fresh: Recipe[] = []
      let updated = 0
      for (const inc of incoming) {
        const key = inc.title.trim().toLowerCase()
        const idx = indexByTitle.get(key)
        if (idx != null) {
          next[idx] = { ...inc, id: next[idx].id }
          updated++
        } else {
          fresh.push(inc)
          indexByTitle.set(key, next.length + fresh.length - 1)
        }
      }
      setRecipes([...fresh.reverse(), ...next])
      return { added: fresh.length, updated }
    },
    [recipes]
  )

  const deleteRecipe = useCallback((id: string) => {
    setRecipes((prev) => prev.filter((r) => r.id !== id))
    setCookQueue((prev) => prev.filter((qid) => qid !== id))
    setActiveCookId((curr) => (curr === id ? null : curr))
  }, [])

  // --- Shopping actions ---
  const setMultiplier = useCallback((m: number) => setMultiplierState(m), [])

  const addRecipeToShopping = useCallback((recipe: Recipe) => {
    setShopping((prev) => {
      // Avoid duplicating the exact same recipe's ingredients if re-added.
      const withoutThisRecipe = prev.filter((e) => e.recipeId !== recipe.id)
      const entries: ShoppingEntry[] = recipe.ingredients.map((ing) => ({
        id: uid('shop'),
        name: ing.name,
        quantity: ing.quantity,
        unit: ing.unit,
        category: ing.category,
        ...(typeof ing.altQuantity === 'number' && ing.altUnit
          ? { altQuantity: ing.altQuantity, altUnit: ing.altUnit }
          : {}),
        recipeId: recipe.id,
        recipeTitle: recipe.title,
      }))
      return [...withoutThisRecipe, ...entries]
    })
  }, [])

  // Pull a single recipe's ingredients back out of the shopping list.
  const removeRecipeFromShopping = useCallback((recipeId: string) => {
    setShopping((prev) => prev.filter((e) => e.recipeId !== recipeId))
  }, [])

  const toggleChecked = useCallback((key: string) => {
    setCheckedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )
  }, [])

  const clearChecked = useCallback(() => {
    // Remove every shopping entry whose aggregated key is currently checked.
    setShopping((prev) =>
      prev.filter((e) => !checkedKeys.includes(aggregateKey(e.name, e.unit, e.category)))
    )
    setCheckedKeys([])
  }, [checkedKeys])

  const clearAllShopping = useCallback(() => {
    setShopping([])
    setCheckedKeys([])
  }, [])

  // --- Cook actions ---
  const startCooking = useCallback((recipe: Recipe) => {
    setCookQueue((prev) => (prev.includes(recipe.id) ? prev : [...prev, recipe.id]))
    setActiveCookId(recipe.id)
    setSection('cook')
  }, [])

  // Queue a recipe for cooking without navigating away (e.g. when it's added to
  // the shopping list). Becomes the active recipe only if nothing is selected yet.
  const addToCookQueue = useCallback((recipe: Recipe) => {
    setCookQueue((prev) => (prev.includes(recipe.id) ? prev : [...prev, recipe.id]))
    setActiveCookId((curr) => curr ?? recipe.id)
  }, [])

  const removeFromQueue = useCallback((id: string) => {
    setCookQueue((prev) => {
      const next = prev.filter((qid) => qid !== id)
      setActiveCookId((curr) => (curr === id ? next[0] ?? null : curr))
      return next
    })
  }, [])

  const getCookProgress = useCallback(
    (recipeId: string): CookProgress =>
      cookProgress[recipeId] ?? { checkedIngredients: [], completedSteps: [] },
    [cookProgress]
  )

  const toggleCookIngredient = useCallback((recipeId: string, ingredientId: string) => {
    setCookProgress((prev) => {
      const curr = prev[recipeId] ?? { checkedIngredients: [], completedSteps: [] }
      const checked = curr.checkedIngredients.includes(ingredientId)
        ? curr.checkedIngredients.filter((i) => i !== ingredientId)
        : [...curr.checkedIngredients, ingredientId]
      return { ...prev, [recipeId]: { ...curr, checkedIngredients: checked } }
    })
  }, [])

  const toggleCookStep = useCallback((recipeId: string, stepId: string) => {
    setCookProgress((prev) => {
      const curr = prev[recipeId] ?? { checkedIngredients: [], completedSteps: [] }
      const steps = curr.completedSteps.includes(stepId)
        ? curr.completedSteps.filter((s) => s !== stepId)
        : [...curr.completedSteps, stepId]
      return { ...prev, [recipeId]: { ...curr, completedSteps: steps } }
    })
  }, [])

  // --- Cooking journal actions ---
  const addCookLog = useCallback((entry: Omit<CookLogEntry, 'id'>): CookLogEntry => {
    const created: CookLogEntry = { ...entry, id: uid('log') }
    setCookLog((prev) => [created, ...prev])
    return created
  }, [])

  const updateCookLog = useCallback(
    (id: string, patch: Partial<Omit<CookLogEntry, 'id'>>) => {
      setCookLog((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)))
    },
    []
  )

  const deleteCookLog = useCallback((id: string) => {
    setCookLog((prev) => prev.filter((e) => e.id !== id))
  }, [])

  const mergeCookLog = useCallback((entries: CookLogEntry[]) => {
    setCookLog((prev) => {
      const ids = new Set(prev.map((e) => e.id))
      const fresh = entries.filter(
        (e) => e && typeof e.id === 'string' && e.id && !ids.has(e.id) && typeof e.recipeTitle === 'string'
      )
      return fresh.length ? [...fresh, ...prev] : prev
    })
  }, [])

  const value = useMemo<AppContextValue>(
    () => ({
      section,
      setSection,
      recipes,
      addRecipe,
      importRecipes,
      deleteRecipe,
      shopping,
      multiplier,
      setMultiplier,
      checkedKeys,
      addRecipeToShopping,
      removeRecipeFromShopping,
      toggleChecked,
      clearChecked,
      clearAllShopping,
      cookQueue,
      activeCookId,
      setActiveCookId,
      startCooking,
      addToCookQueue,
      removeFromQueue,
      getCookProgress,
      toggleCookIngredient,
      toggleCookStep,
      cookLog,
      addCookLog,
      updateCookLog,
      deleteCookLog,
      mergeCookLog,
      cloudEnabled: isSupabaseConfigured,
      user,
      syncStatus,
      signIn,
      signUp,
      signOut,
      toasts,
      pushToast,
      dismissToast,
    }),
    [
      section,
      recipes,
      addRecipe,
      importRecipes,
      deleteRecipe,
      shopping,
      multiplier,
      setMultiplier,
      checkedKeys,
      addRecipeToShopping,
      removeRecipeFromShopping,
      toggleChecked,
      clearChecked,
      clearAllShopping,
      cookQueue,
      activeCookId,
      startCooking,
      addToCookQueue,
      removeFromQueue,
      getCookProgress,
      toggleCookIngredient,
      toggleCookStep,
      cookLog,
      addCookLog,
      updateCookLog,
      deleteCookLog,
      mergeCookLog,
      user,
      syncStatus,
      signIn,
      signUp,
      signOut,
      toasts,
      pushToast,
      dismissToast,
    ]
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

/** Stable key used to aggregate identical ingredients across recipes. */
export function aggregateKey(name: string, unit: string, category: string): string {
  return `${name.trim().toLowerCase()}|${unit.trim().toLowerCase()}|${category}`
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within an AppProvider')
  return ctx
}
