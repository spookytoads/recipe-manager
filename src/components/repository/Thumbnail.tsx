import { ImageIcon } from '../ui/icons'

// Deterministic warm gradient per recipe so cards look distinct without images.
const GRADIENTS = [
  'from-herb-200 to-herb-400',
  'from-amber-200 to-orange-300',
  'from-rose-200 to-red-300',
  'from-sky-200 to-cyan-300',
  'from-lime-200 to-emerald-300',
  'from-violet-200 to-purple-300',
  'from-yellow-200 to-amber-300',
]

function hash(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

export function Thumbnail({
  seed,
  label,
  className = '',
}: {
  seed: string
  label?: string
  className?: string
}) {
  const gradient = GRADIENTS[hash(seed) % GRADIENTS.length]
  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden bg-gradient-to-br ${gradient} ${className}`}
    >
      <span className="text-5xl font-black text-white/80 drop-shadow-sm">
        {label ? label.charAt(0).toUpperCase() : <ImageIcon width={40} height={40} />}
      </span>
      <div className="absolute right-2 top-2 rounded-full bg-white/40 p-1.5 backdrop-blur-sm">
        <ImageIcon width={14} height={14} className="text-white" />
      </div>
    </div>
  )
}
