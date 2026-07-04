/**
 * Machine ID Service
 * Same algorithm as machine-id-tool/get-machine-id.ps1
 * Used to verify the app runs only on the licensed PC.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as crypto from 'crypto';

const execAsync = promisify(exec);

async function getMachineFingerprint(): Promise<string> {
  const parts: string[] = [];

  // Method 1: Motherboard UUID (most stable)
  try {
    const { stdout } = await execAsync(
      'powershell -Command "(Get-CimInstance Win32_ComputerSystemProduct).UUID"',
      { windowsHide: true }
    );
    const uuid = (stdout || '').trim();
    if (uuid) parts.push(uuid);
  } catch (_) {}

  // Method 2: CPU Processor ID
  try {
    const { stdout } = await execAsync(
      'powershell -Command "(Get-CimInstance Win32_Processor | Select-Object -First 1).ProcessorId"',
      { windowsHide: true }
    );
    const cpuId = (stdout || '').trim();
    if (cpuId) parts.push(cpuId);
  } catch (_) {}

  // Method 3: First disk serial
  try {
    const { stdout } = await execAsync(
      'powershell -Command "(Get-CimInstance Win32_DiskDrive | Select-Object -First 1).SerialNumber"',
      { windowsHide: true }
    );
    const diskSerial = (stdout || '').trim();
    if (diskSerial) parts.push(diskSerial);
  } catch (_) {}

  // Method 4: BIOS serial (fallback)
  if (parts.length < 2) {
    try {
      const { stdout } = await execAsync(
        'powershell -Command "(Get-CimInstance Win32_BIOS).SerialNumber"',
        { windowsHide: true }
      );
      const biosSerial = (stdout || '').trim();
      if (biosSerial) parts.push(biosSerial);
    } catch (_) {}
  }

  if (parts.length === 0) {
    throw new Error('Could not read hardware identifiers');
  }

  // Same algorithm as PowerShell
  const combined = parts.join('|').replace(/\s+/g, '');
  const hash = crypto.createHash('sha256').update(combined).digest('hex');
  return hash.substring(0, 8).toUpperCase();
}

export async function getCurrentMachineId(): Promise<string> {
  const id = await getMachineFingerprint();
  return `MACHINE-${id}`;
}
