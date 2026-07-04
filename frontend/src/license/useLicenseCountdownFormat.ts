import { useCallback, useEffect, useState } from 'react'
import type { LicenseCountdownDisplayFormat } from './format-license-countdown'

const STORAGE_KEY = 'amaan-license-countdown-display'

function readStored(): LicenseCountdownDisplayFormat {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'stopwatch' || v === 'days_minutes') return v
  } catch {
    /* ignore */
  }
  return 'days_minutes'
}

const CHANGE_EVENT = 'amaan-license-countdown-display-change'

export function useLicenseCountdownFormat(): [
  LicenseCountdownDisplayFormat,
  (format: LicenseCountdownDisplayFormat) => void,
] {
  const [format, setFormatState] = useState<LicenseCountdownDisplayFormat>(readStored)

  const setFormat = useCallback((f: LicenseCountdownDisplayFormat) => {
    try {
      localStorage.setItem(STORAGE_KEY, f)
    } catch {
      /* ignore */
    }
    setFormatState(f)
    window.dispatchEvent(new Event(CHANGE_EVENT))
  }, [])

  useEffect(() => {
    const sync = () => setFormatState(readStored)
    window.addEventListener('storage', sync)
    window.addEventListener(CHANGE_EVENT, sync)
    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener(CHANGE_EVENT, sync)
    }
  }, [])

  return [format, setFormat]
}
