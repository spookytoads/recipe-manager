import { StarIcon } from '../ui/icons'

/**
 * Star rating. Interactive when `onChange` is provided (tap a star to set,
 * tap the same star again to clear), otherwise a read-only display.
 */
export function StarRating({
  value,
  onChange,
  size = 20,
}: {
  value: number
  onChange?: (next: number) => void
  size?: number
}) {
  const interactive = typeof onChange === 'function'

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= value
        const star_ = (
          <StarIcon
            width={size}
            height={size}
            className={filled ? 'text-amber-400' : 'text-slate-300'}
            fill={filled ? 'currentColor' : 'none'}
          />
        )
        if (!interactive) {
          return <span key={star}>{star_}</span>
        }
        return (
          <button
            key={star}
            type="button"
            onClick={() => onChange(value === star ? 0 : star)}
            className="tap-target flex items-center justify-center rounded-md p-1 transition-transform active:scale-90"
            aria-label={`${star} star${star > 1 ? 's' : ''}`}
            aria-pressed={filled}
          >
            {star_}
          </button>
        )
      })}
    </div>
  )
}
