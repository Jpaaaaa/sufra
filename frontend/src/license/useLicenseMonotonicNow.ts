import { useEffect, useRef, useState } from 'react'

/**
 * When `anchorServerMs` is set, advances via `performance.now()` so local wall-clock
 * changes do not jump countdowns between IPC snapshots. Otherwise falls back to `Date.now()`.
 */
export function useLicenseMonotonicNow(anchorServerMs: number | undefined): number {
  const [tick, setTick] = useState(() => Date.now())
  const anchorRef = useRef<{ server: number; perf: number } | null>(null)

  useEffect(() => {
    if (
      typeof anchorServerMs === 'number' &&
      Number.isFinite(anchorServerMs) &&
      typeof performance !== 'undefined' &&
      typeof performance.now === 'function'
    ) {
      anchorRef.current = { server: anchorServerMs, perf: performance.now() }
      setTick(anchorServerMs)
    } else {
      anchorRef.current = null
      setTick(Date.now())
    }
  }, [anchorServerMs])

  useEffect(() => {
    const id = window.setInterval(() => {
      const a = anchorRef.current
      if (a) {
        setTick(a.server + (performance.now() - a.perf))
      } else {
        setTick(Date.now())
      }
    }, 1000)
    return () => window.clearInterval(id)
  }, [])

  return tick
}
