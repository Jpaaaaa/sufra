/**
 * LAN printer discovery - scans local subnet for devices on port 9100.
 */
import * as net from 'net';
import * as os from 'os';

const PRINTER_PORT = 9100;
const PROBE_TIMEOUT_MS = 500;

/**
 * Get local IPv4 subnets (e.g. ["192.168.1", "10.0.0"])
 */
function getLocalSubnets(): string[] {
  const interfaces = os.networkInterfaces();
  const subnets = new Set<string>();

  for (const iface of Object.values(interfaces)) {
    if (!iface) continue;
    for (const addr of iface) {
      // Node 18+ returns family as number (4), older versions as string ('IPv4')
      const isIPv4 = String(addr.family) === 'IPv4' || String(addr.family) === '4';
      if (isIPv4 && !addr.internal) {
        const parts = addr.address.split('.');
        if (parts.length === 4) {
          subnets.add(parts.slice(0, 3).join('.'));
        }
      }
    }
  }

  return Array.from(subnets);
}

/**
 * Probe if a host accepts TCP connection on port 9100.
 */
function probePort(ip: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const timer = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, PROBE_TIMEOUT_MS);

    socket.on('connect', () => {
      clearTimeout(timer);
      socket.destroy();
      resolve(true);
    });

    socket.on('error', () => {
      clearTimeout(timer);
      resolve(false);
    });

    socket.connect(port, ip);
  });
}

/**
 * Scan local network for printers (devices with port 9100 open).
 * @returns Array of { ip, port } for discovered printers
 */
export async function scanForPrinters(): Promise<
  Array<{ ip: string; port: number }>
> {
  const subnets = getLocalSubnets();
  if (subnets.length === 0) {
    console.log('[PRINTER-SCAN] No local subnet found');
    return [];
  }

  console.log('[PRINTER-SCAN] Scanning subnets:', subnets.join(', '));

  const probes: Promise<{ ip: string; port: number } | null>[] = [];

  for (const subnet of subnets) {
    for (let host = 1; host <= 254; host++) {
      const ip = `${subnet}.${host}`;
      probes.push(
        probePort(ip, PRINTER_PORT).then((ok) =>
          ok ? { ip, port: PRINTER_PORT } : null,
        ),
      );
    }
  }

  const results = await Promise.all(probes);
  const printers = results.filter(
    (r): r is { ip: string; port: number } => r !== null,
  );

  // Sort by IP for consistent display
  printers.sort((a, b) => a.ip.localeCompare(b.ip));

  console.log(`[PRINTER-SCAN] Found ${printers.length} printer(s):`, printers);
  return printers;
}
