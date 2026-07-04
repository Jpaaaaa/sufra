import { execSync } from 'child_process'
import { createHash } from 'crypto'
import os from 'os'

function rawMachineFingerprint(): string {
  if (process.platform === 'win32') {
    try {
      const out = execSync('reg query "HKLM\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid', {
        encoding: 'utf-8',
        windowsHide: true,
      })
      const m = /MachineGuid\s+REG_SZ\s+(\S+)/i.exec(out)
      if (m?.[1]) return m[1].trim().toLowerCase()
    } catch {
      /* fall through */
    }
  }
  const nets = os.networkInterfaces()
  const macs: string[] = []
  for (const list of Object.values(nets)) {
    if (!list) continue
    for (const e of list) {
      if (!e.internal && e.mac && e.mac !== '00:00:00:00:00:00') macs.push(e.mac)
    }
  }
  macs.sort()
  return `${process.platform}:${os.hostname()}:${macs.join(',')}:${os.arch()}`
}

/** Stable id for licensing (matches Bazar / `amaan-platform` machine-id script). */
export function getMachineId(): string {
  const raw = rawMachineFingerprint()
  return createHash('sha256').update(raw, 'utf8').digest('hex').slice(0, 40)
}
