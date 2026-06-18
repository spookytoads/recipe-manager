import { useCallback, useEffect, useRef, useState } from 'react'
import { formatClock } from '../../lib/util'
import { PauseIcon, PlayIcon, ResetIcon } from '../ui/icons'

/** Play a short beep sequence via the Web Audio API — no audio asset needed. */
function playAlert() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    const now = ctx.currentTime
    ;[0, 0.32, 0.64].forEach((offset) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.setValueAtTime(880, now + offset)
      gain.gain.setValueAtTime(0.0001, now + offset)
      gain.gain.exponentialRampToValueAtTime(0.3, now + offset + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.28)
      osc.start(now + offset)
      osc.stop(now + offset + 0.3)
    })
    setTimeout(() => ctx.close(), 1200)
  } catch {
    /* Audio not available — the visual "Done" state still fires. */
  }
}

const RADIUS = 34
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function Timer({ seconds }: { seconds: number }) {
  const [remaining, setRemaining] = useState(seconds)
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)
  const intervalRef = useRef<number | null>(null)

  const stopInterval = useCallback(() => {
    if (intervalRef.current != null) {
      window.clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!running) return
    intervalRef.current = window.setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          stopInterval()
          setRunning(false)
          setDone(true)
          playAlert()
          return 0
        }
        return r - 1
      })
    }, 1000)
    return stopInterval
  }, [running, stopInterval])

  // Reset when the underlying step changes its duration.
  useEffect(() => {
    setRemaining(seconds)
    setRunning(false)
    setDone(false)
  }, [seconds])

  const toggle = () => {
    if (done) {
      setRemaining(seconds)
      setDone(false)
      setRunning(true)
      return
    }
    setRunning((r) => !r)
  }

  const reset = () => {
    stopInterval()
    setRunning(false)
    setDone(false)
    setRemaining(seconds)
  }

  const progress = seconds > 0 ? remaining / seconds : 0
  const offset = CIRCUMFERENCE * (1 - progress)

  return (
    <div className="mt-3 flex items-center gap-3 rounded-xl border border-royal/10 bg-royal/5 p-3">
      <div className="relative h-[84px] w-[84px] shrink-0">
        <svg width="84" height="84" viewBox="0 0 84 84" className="-rotate-90">
          <circle cx="42" cy="42" r={RADIUS} fill="none" stroke="#E5E2F2" strokeWidth="6" />
          <circle
            cx="42"
            cy="42"
            r={RADIUS}
            fill="none"
            stroke={done ? '#2C20D4' : '#FF5E33'}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={done ? 0 : offset}
            className="transition-[stroke-dashoffset] duration-1000 ease-linear"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className={`text-sm font-bold tabular-nums ${done ? 'text-royal' : 'text-royal-soft'}`}
          >
            {done ? 'Done!' : formatClock(remaining)}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <button onClick={toggle} className="btn-primary py-2">
          {running ? (
            <>
              <PauseIcon width={16} height={16} /> Pause
            </>
          ) : (
            <>
              <PlayIcon width={16} height={16} /> {done ? 'Restart' : remaining < seconds ? 'Resume' : 'Start Timer'}
            </>
          )}
        </button>
        <button onClick={reset} className="btn-ghost py-1.5 text-xs">
          <ResetIcon width={14} height={14} /> Reset
        </button>
      </div>
    </div>
  )
}
