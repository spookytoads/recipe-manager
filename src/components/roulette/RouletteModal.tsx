import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { PROTEIN_FILTERS, type ProteinFilter, type Recipe } from '../../types'
import { matchesProtein, proteinLabel } from '../../lib/util'
import { recipeColor } from '../../lib/colors'
import { Thumbnail } from '../repository/Thumbnail'
import { ChefIcon, ClockIcon, CloseIcon, DiceIcon } from '../ui/icons'

const SPIN_MS = 4200
const MAX_SEGMENTS = 8
const SIZE = 280
const R = 130

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Pie-slice path, angles measured in degrees clockwise from 12 o'clock. */
function slicePath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const a0 = (startDeg * Math.PI) / 180
  const a1 = (endDeg * Math.PI) / 180
  const x0 = cx + r * Math.sin(a0)
  const y0 = cy - r * Math.cos(a0)
  const x1 = cx + r * Math.sin(a1)
  const y1 = cy - r * Math.cos(a1)
  const large = endDeg - startDeg > 180 ? 1 : 0
  return `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s
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
  const [spinning, setSpinning] = useState(false)
  const [rotation, setRotation] = useState(0)
  const [segments, setSegments] = useState<Recipe[]>([])
  const [results, setResults] = useState<Recipe[] | null>(null)
  const rotationRef = useRef(0)
  const spinTimer = useRef<number | null>(null)

  const pool = useMemo(
    () => recipes.filter((r) => matchesProtein(r, protein)),
    [recipes, protein]
  )

  // Keep the latest pool reachable from the one-shot auto-spin effect.
  const poolRef = useRef(pool)
  poolRef.current = pool

  // What's drawn on the wheel: the locked-in spin segments, or a preview of the pool.
  const wheelSegments = useMemo(
    () => (segments.length ? segments : shuffle(pool).slice(0, MAX_SEGMENTS)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [segments, protein, pool.length]
  )

  const runSpin = (currentPool: Recipe[]) => {
    if (currentPool.length === 0) return
    const shuffled = shuffle(currentPool)
    const winners = shuffled.slice(0, Math.min(3, currentPool.length))
    const segCount = Math.min(currentPool.length, MAX_SEGMENTS)
    const fill = shuffled
      .filter((r) => !winners.some((w) => w.id === r.id))
      .slice(0, Math.max(0, segCount - winners.length))
    const segs = shuffle([...winners, ...fill]).slice(0, segCount)
    const winnerIndex = Math.max(0, segs.findIndex((s) => s.id === winners[0].id))

    const segAngle = 360 / segs.length
    const center = winnerIndex * segAngle + segAngle / 2
    const jitter = (Math.random() - 0.5) * segAngle * 0.6
    // Land the winner's slice under the top pointer: final rotation ≡ -center (mod 360).
    const desiredMod = ((-center - jitter) % 360 + 360) % 360
    const currentMod = ((rotationRef.current % 360) + 360) % 360
    const forward = (desiredMod - currentMod + 360) % 360
    const next = rotationRef.current + 360 * 5 + forward
    rotationRef.current = next

    setSegments(segs)
    setResults(null)
    setSpinning(true)
    setRotation(next)

    if (spinTimer.current) window.clearTimeout(spinTimer.current)
    spinTimer.current = window.setTimeout(() => {
      setSpinning(false)
      setResults(winners)
    }, SPIN_MS + 80)
  }

  const spin = () => {
    if (spinning) return
    runSpin(pool)
  }

  const chooseProtein = (p: ProteinFilter) => {
    if (spinning) return
    setProtein(p)
    setResults(null)
    setSegments([])
  }

  // Auto-spin once when the modal opens, plus Escape-to-close and scroll lock.
  useEffect(() => {
    const t = window.setTimeout(() => runSpin(poolRef.current), 250)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.clearTimeout(t)
      if (spinTimer.current) window.clearTimeout(spinTimer.current)
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const segAngle = 360 / Math.max(1, wheelSegments.length)
  const canSpin = pool.length > 0

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
          <p className="mb-3 text-center text-sm text-slate-500">
            Three dinner ideas, picked at random. Filter by protein and spin again for more.
          </p>

          {/* Protein selector */}
          <div className="mb-5 flex flex-wrap justify-center gap-2">
            {PROTEIN_FILTERS.map((f) => {
              const active = protein === f
              return (
                <button
                  key={f}
                  onClick={() => chooseProtein(f)}
                  disabled={spinning}
                  className={`chip !min-h-0 !min-w-0 px-3 py-1.5 text-xs ${
                    active
                      ? 'border-herb-500 bg-herb-500 text-white shadow-sm'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-herb-300 hover:text-herb-700'
                  } ${spinning ? 'cursor-not-allowed opacity-60' : ''}`}
                >
                  {f}
                </button>
              )
            })}
          </div>

          {/* Wheel */}
          <div className="flex flex-col items-center">
            <div className="relative" style={{ width: SIZE, height: SIZE, maxWidth: '100%' }}>
              {/* Pointer */}
              <div className="absolute left-1/2 top-0 z-20 -translate-x-1/2 -translate-y-1">
                <svg width="32" height="32" viewBox="0 0 34 34" aria-hidden>
                  <path
                    d="M17 30 L6 8 a 12 6 0 0 1 22 0 Z"
                    fill="#1e293b"
                    stroke="#fff"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>

              <svg
                viewBox={`0 0 ${SIZE} ${SIZE}`}
                className="h-full w-full drop-shadow-md"
                style={{
                  transform: `rotate(${rotation}deg)`,
                  transition: spinning
                    ? `transform ${SPIN_MS}ms cubic-bezier(0.16, 1, 0.3, 1)`
                    : 'none',
                }}
              >
                <circle cx={SIZE / 2} cy={SIZE / 2} r={R + 6} fill="#fff" />
                {wheelSegments.length === 0 && (
                  <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="#e2e8f0" />
                )}
                {wheelSegments.map((seg, i) => {
                  const start = i * segAngle
                  const end = start + segAngle
                  const mid = start + segAngle / 2
                  const color = recipeColor(seg.title)
                  const flip = mid > 90 && mid < 270
                  const labelR = R * 0.34
                  const tx = SIZE / 2 + Math.sin((mid * Math.PI) / 180) * labelR
                  const ty = SIZE / 2 - Math.cos((mid * Math.PI) / 180) * labelR
                  return (
                    <g key={seg.id}>
                      <path
                        d={slicePath(SIZE / 2, SIZE / 2, R, start, end)}
                        fill={color.bg}
                        stroke="#fff"
                        strokeWidth="2"
                      />
                      <text
                        x={tx}
                        y={ty}
                        fill={color.text}
                        fontSize="10"
                        fontWeight="700"
                        textAnchor={flip ? 'end' : 'start'}
                        transform={`rotate(${flip ? mid + 180 : mid} ${tx} ${ty})`}
                        dominantBaseline="middle"
                      >
                        {truncate(seg.title, 16)}
                      </text>
                    </g>
                  )
                })}
              </svg>

              {/* Center hub — also a spin button */}
              <button
                onClick={spin}
                disabled={!canSpin || spinning}
                className="absolute left-1/2 top-1/2 z-10 flex h-[64px] w-[64px] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border-4 border-white bg-herb-500 text-white shadow-lg transition-transform hover:bg-herb-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Spin the wheel"
              >
                <DiceIcon width={20} height={20} />
                <span className="mt-0.5 text-[10px] font-extrabold uppercase tracking-wide">
                  {spinning ? '…' : 'Spin'}
                </span>
              </button>
            </div>

            <button
              onClick={spin}
              disabled={!canSpin || spinning}
              className="btn-primary mt-5 px-8"
            >
              <DiceIcon width={18} height={18} />
              {spinning ? 'Spinning…' : results ? 'Spin again' : 'Spin the wheel'}
            </button>

            {!canSpin && (
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
