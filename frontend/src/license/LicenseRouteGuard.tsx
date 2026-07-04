import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'

type GuardState = 'loading' | 'ok' | 'block'

export function LicenseRouteGuard() {
  const [state, setState] = useState<GuardState>('loading')

  useEffect(() => {
    const api = window.amaan
    if (!api?.licenseGetStatus) {
      setState('ok')
      return
    }
    void api.licenseGetStatus().then((r) => {
      const res = r as { enforced?: boolean; ok?: boolean }
      if (!res.enforced || res.ok) setState('ok')
      else setState('block')
    })
  }, [])

  if (state === 'loading') {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center gap-2 bg-slate-900 text-cyber-aqua"
        role="status"
        aria-live="polite"
      >
        <p className="text-lg font-semibold tracking-tight">Checking license…</p>
      </div>
    )
  }

  if (state === 'block') {
    return <Navigate to="/license" replace />
  }

  return <Outlet />
}
