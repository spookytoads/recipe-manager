import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { PROTEIN_FILTERS, type ProteinFilter, type Recipe } from '../../types'
import { matchesProtein, proteinLabel } from '../../lib/util'
import { recipeColor } from '../../lib/colors'
import { Thumbnail } from '../repository/Thumbnail'
import { ChefIcon, ClockIcon, CloseIcon, DiceIcon } from '../ui/icons'

const ROLL_MS = 1300

// Cube rotation (deg) that brings each face toward the viewer.
const FACE_ROT: Record<number, { x: number; y: number }> = {
  1: { x: 0, y: 0 },
  2: { x: -90, y: 0 },
  3: { x: 0, y: -90 },
  4: { x: 0, y: 90 },
  5: { x: 90, y: 0 },
  6: { x: 0, y: 180 },
}

// Which of the 9 grid cells (1–9, row-major) hold a pip for each face value.
const PIPS: Record<number, number[]> = {
  1: [5],
  2: [1, 9],
  3: [1, 5, 9],
  4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9],
  6: [1, 4, 7, 3, 6, 9],
}

// How the six faces are positioned on the cube.
const FACE_PLACEMENT: Record<number, string> = {
  1: 'translateZ(36px)',
  2: 'rotateX(90deg) translateZ(36px)',
  3: 'rotateY(90deg) translateZ(36px)',
  4: 'rotateY(-90deg) translateZ(36px)',
  5: 'rotateX(-90deg) translateZ(36px)',
  6: 'rotateY(180deg) translateZ(36px)',
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function DieFace({ value }: { value: number }) {
  const on = PIPS[value]
  return (
    <div className="dice-face" style={{ transform: FACE_PLACEMENT[value] }}>
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className={on.includes(i + 1) ? 'on' : ''} />
      ))}
    </div>
  )
}

export function RouletteModal({
  onClose,
  onPick,
}: {
  onClose: () => void
  /** Called when a result card is chosen — the parent opens the recipe detail. */
  onPick: (recipe: Recipe) => void
}) {
  const { recipes } = useApp()
  const [protein, setProtein] = useState<ProteinFilter>('All')
  const [rolling, setRolling] = useState(false)
  const [rot, setRot] = useState({ x: 0, y: 0 })
  const [results, setResults] = useState<Recipe[] | null>(null)
  const rotRef = useRef(rot)
  const rollTimer = useRef<number | null>(null)

  const pool = useMemo(
    () => recipes.filter((r) => matchesProtein(r, protein)),
    [recipes, protein]
  )

  const roll = () => {
    if (rolling || pool.length === 0) return

    // Tumble several full turns on both axes, landing flat on a random face.
    const face = 1 + Math.floor(Math.random() * 6)
    const base = FACE_ROT[face]
    const cur = rotRef.current
    const dx = ((base.x - cur.x) % 360 + 360) % 360
    const dy = ((base.y - cur.y) % 360 + 360) % 360
    const next = {
      x: cur.x + 360 * (4 + Math.floor(Math.random() * 3)) + dx,
      y: cur.y + 360 * (4 + Math.floor(Math.random() * 3)) + dy,
    }
    rotRef.current = next

    setResults(null)
    setRolling(true)
    setRot(next)

    if (rollTimer.current) window.clearTimeout(rollTimer.current)
    rollTimer.current = window.setTimeout(() => {
      setRolling(false)
      setResults(shuffle(pool).slice(0, Math.min(3, pool.length)))
    }, ROLL_MS + 60)
  }

  const chooseProtein = (p: ProteinFilter) => {
    if (rolling) return
    setProtein(p)
    setResults(null)
  }

  // Escape-to-close + scroll lock while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      if (rollTimer.current) window.clearTimeout(rollTimer.current)
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const canRoll = pool.length > 0

  return (
    <div
      className="fixed inset-0 z-50 flex animate-fade-in items-end justify-center bg-slate-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Weeknight Roulette"
    >
      <div
        className="flex max-h-[94vh] w-full max-w-lg animate-slide-up flex-col overflow-hidden rounded-t-3xl bg-cream shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200/70 bg-white px-5 py-3.5">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-herb-500 text-white">
              <DiceIcon width={18} height={18} />
            </span>
            <h2 className="text-lg font-extrabold tracking-tight text-slate-800">
              Weeknight Roulette
            </h2>
          </div>
          <button
            onClick={onClose}
            className="tap-target flex items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="mb-1 text-center text-sm font-semibold text-slate-700">
            1. Pick a protein
          </p>
          <div className="mb-5 flex flex-wrap justify-center gap-2">
            {PROTEIN_FILTERS.map((f) => {
              const active = protein === f
              return (
                <button
                  key={f}
                  onClick={() => chooseProtein(f)}
                  disabled={rolling}
                  className={`chip !min-h-0 !min-w-0 px-3 py-1.5 text-xs ${
                    active
                      ? 'border-herb-500 bg-herb-500 text-white shadow-sm'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-herb-300 hover:text-herb-700'
                  } ${rolling ? 'cursor-not-allowed opacity-60' : ''}`}
                >
                  {f}
                </button>
              )
            })}
          </div>

          <p className="mb-2 text-center text-sm font-semibold text-slate-700">
            2. Roll the dice
          </p>

          {/* Dice */}
          <div className="flex flex-col items-center">
            <button
              onClick={roll}
              disabled={!canRoll || rolling}
              className="relative cursor-pointer rounded-2xl p-2 transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="Roll the dice"
              title="Roll the dice"
            >
              <div className="dice-shadow" />
              <div className={`dice-scene ${rolling ? 'animate-dice-bounce' : ''}`}>
                <div className="dice-tilt">
                  <div
                    className="dice"
                    style={{
                      transform: `rotateX(${rot.x}deg) rotateY(${rot.y}deg)`,
                      transition: rolling
                        ? `transform ${ROLL_MS}ms cubic-bezier(0.2, 0.8, 0.3, 1)`
                        : 'none',
                    }}
                  >
                    {[1, 2, 3, 4, 5, 6].map((v) => (
                      <DieFace key={v} value={v} />
                    ))}
                  </div>
                </div>
              </div>
            </button>

            <button
              onClick={roll}
              disabled={!canRoll || rolling}
              className="btn-primary mt-3 px-8"
            >
              <DiceIcon width={18} height={18} />
              {rolling ? 'Rolling…' : results ? 'Roll again' : 'Roll the dice'}
            </button>

            {!canRoll && (
              <p className="mt-4 text-center text-sm text-slate-500">
                No {protein === 'All' ? '' : `${protein.toLowerCase()} `}recipes in your library yet.
              </p>
            )}
          </div>

          {/* Results */}
          {results && results.length > 0 && (
            <section className="mt-6">
              <h3 className="mb-3 text-center text-sm font-bold uppercase tracking-wide text-slate-500">
                Tonight's picks
              </h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {results.map((r, i) => {
                  const color = recipeColor(r.title)
                  return (
                    <button
                      key={r.id}
                      onClick={(e) => {
                        e.stopPropagation()
                        onPick(r)
                      }}
                      className="card animate-slide-up overflow-hidden text-left transition-transform hover:-translate-y-0.5 hover:shadow-md"
                      style={{ animationDelay: `${i * 110}ms`, animationFillMode: 'backwards' }}
                    >
                      <div className="relative">
                        <Thumbnail seed={r.id} label={r.title} className="h-20 w-full" />
                        <span
                          className="absolute left-0 top-0 h-full w-1.5"
                          style={{ backgroundColor: color.accent }}
                        />
                      </div>
                      <div className="p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-herb-600">
                          {r.cuisine}
                        </p>
                        <h4 className="mt-0.5 line-clamp-2 font-bold leading-snug text-slate-800">
                          {r.title}
                        </h4>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                          <span className="inline-flex items-center gap-1">
                            <ClockIcon width={13} height={13} /> {r.cookTime}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <ChefIcon width={13} height={13} /> {r.servings}
                          </span>
                          {typeof r.nutrition?.calories === 'number' && (
                            <span className="font-semibold text-slate-600">
                              {r.nutrition.calories} cal
                            </span>
                          )}
                        </div>
                        {r.protein.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {r.protein.map((p) => (
                              <span
                                key={p}
                                className="rounded-full bg-herb-100 px-2 py-0.5 text-[10px] font-semibold text-herb-700"
                              >
                                {proteinLabel(p)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
              <p className="mt-3 text-center text-xs text-slate-400">
                Tap a card for the full recipe.
              </p>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
