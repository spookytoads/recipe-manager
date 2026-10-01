import { useEffect, useRef, useState } from 'react'
import { formatClock } from '../../lib/util'
import { load, save } from '../../data/storage'
import { PauseIcon, PlayIcon, ResetIcon } from '../ui/icons'

/**
 * A step timer that survives leaving the app. Instead of decrementing a counter
 * (which iOS freezes the moment the app is backgrounded), it stores an absolute
 * finish time. On return — even after the PWA was fully closed — it recomputes
 * the remaining time from the clock, so it shows the right value or fires its
 * alarm immediately if it finished while you were away.
 */

interface TimerSnapshot {
  endsAt: number | null // epoch ms the timer will finish, when running
  remaining: number // seconds left while paused / not started
  done: boolean
}

// One shared AudioContext, created/resumed on a tap so iOS lets it make sound.
let audioCtx: AudioContext | null = null
function getCtx(): AudioContext | null {
  try {
    if (!audioCtx) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!Ctx) return null
      audioCtx = new Ctx()
    }
    if (audioCtx.state === 'suspended') void audioCtx.resume()
    return audioCtx
  } catch {
    return null
  }
}

/** Play a short rising beep sequence via the Web Audio API — no audio asset needed. */
function playAlert() {
  const ctx = getCtx()
  if (!ctx) return
  try {
    const now = ctx.currentTime
    ;[0, 0.3, 0.6, 0.9].forEach((offset, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.setValueAtTime(i < 3 ? 880 : 1175, now + offset)
      gain.gain.setValueAtTime(0.0001, now + offset)
      gain.gain.exponentialRampToValueAtTime(0.35, now + offset + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.26)
      osc.start(now + offset)
      osc.stop(now + offset + 0.3)
    })
  } catch {
    /* Audio not available — the visual "Done" state still fires. */
  }
}

/** Buzz the phone (Android only — iOS Safari ignores the Vibration API). */
function vibrate() {
  try {
    navigator.vibrate?.([250, 120, 250, 120, 400])
  } catch {
    /* unsupported */
  }
}

/** Post a system notification if the user has granted permission. */
function notify(key: string, body: string) {
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Timer done', { body, tag: `recipe-timer-${key}` })
    }
  } catch {
    /* Notifications unavailable (e.g. iOS without home-screen install). */
  }
}

/** Ask for notification permission once, on a user gesture. */
function requestNotify() {
  try {
    if ('Notification' in window && Notification.permission === 'default') {
      void Notification.requestPermission()
    }
  } catch {
    /* ignore */
  }
}

const RADIUS = 34
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function Timer({
  seconds,
  storageKey,
  label,
}: {
  seconds: number
  storageKey: string
  label?: string
}) {
  const KEY = `recipe-manager:timer:${storageKey}`

  const [endsAt, setEndsAt] = useState<number | null>(null)
  const [paused, setPaused] = useState(seconds) // seconds remaining while not running
  const [done, setDone] = useState(false)
  const [, setTick] = useState(0) // forces a re-render each second while running
  const alarmedRef = useRef(false)

  // Restore any saved timer for this step on mount.
  useEffect(() => {
    const saved = load<TimerSnapshot | null>(KEY, null)
    if (!saved) return
    if (saved.done) {
      setDone(true)
    } else if (saved.endsAt != null) {
      if (Date.now() >= saved.endsAt) setDone(true) // finished while we were away
      else setEndsAt(saved.endsAt)
    } else {
      setPaused(saved.remaining)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [KEY])

  const running = endsAt != null && !done
  const remaining = done
    ? 0
    : endsAt != null
      ? Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))
      : paused

  // Persist whenever the meaningful state changes (not every display tick).
  useEffect(() => {
    save<TimerSnapshot>(KEY, { endsAt: done ? null : endsAt, remaining: paused, done })
  }, [KEY, endsAt, paused, done])

  // While running, re-check the clock a few times a second so the display stays
  // accurate and completion is caught promptly.
  useEffect(() => {
    if (!running || endsAt == null) return
    const id = window.setInterval(() => {
      if (Date.now() >= endsAt) setDone(true)
      else setTick((t) => t + 1)
    }, 250)
    return () => window.clearInterval(id)
  }, [running, endsAt])

  // Recompute the instant the app comes back to the foreground.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      if (endsAt != null && !done && Date.now() >= endsAt) setDone(true)
      else setTick((t) => t + 1)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [endsAt, done])

  // Fire the alarm exactly once when the timer completes (including when it
  // finished while the app was closed and we discover it on return).
  useEffect(() => {
    if (done && !alarmedRef.current) {
      alarmedRef.current = true
      playAlert()
      vibrate()
      notify(storageKey, label ? `${label} — step timer finished.` : 'Your step timer finished.')
    }
    if (!done) alarmedRef.current = false
  }, [done, storageKey, label])

  const startFrom = (secs: number) => {
    getCtx() // unlock audio on this tap so the alarm can sound later
    requestNotify()
    alarmedRef.current = false
    setDone(false)
    setPaused(secs)
    setEndsAt(Date.now() + secs * 1000)
  }

  const toggle = () => {
    if (done) return startFrom(seconds)
    if (running && endsAt != null) {
      // pause: freeze the remaining seconds
      setPaused(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)))
      setEndsAt(null)
    } else {
      startFrom(paused)
    }
  }

  const reset = () => {
    setEndsAt(null)
    setDone(false)
    setPaused(seconds)
    alarmedRef.current = false
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
            className="transition-[stroke-dashoffset] duration-500 ease-linear"
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
              <PlayIcon width={16} height={16} />{' '}
              {done ? 'Restart' : remaining < seconds ? 'Resume' : 'Start Timer'}
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
