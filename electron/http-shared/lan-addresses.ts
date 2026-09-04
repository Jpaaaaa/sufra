/**
 * Physical LAN IPv4 addresses for hub settings (Wi-Fi / Ethernet).
 * Ignores Docker, Hyper-V, WSL, and other virtual adapters by name — not by host.
 */
import os from 'os';
import { LAN_API_PORT } from './lan-ports';

export type LanKind = 'wifi' | 'ethernet' | 'other';

export interface LanAddress {
  kind: LanKind;
  name: string;
  ipv4: string;
  url: string;
}

export interface LanAddressesResult {
  wifi: LanAddress | null;
  ethernet: LanAddress | null;
  other: LanAddress[];
}

function isIPv4(family: string | number): boolean {
  return String(family) === 'IPv4' || String(family) === '4';
}

function isApipa(ip: string): boolean {
  return ip.startsWith('169.254.');
}

function isPrivateLan(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return false;
  const [a, b] = parts;
  if (a === 192 && b === 168) return true;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

export function isVirtualAdapterName(name: string): boolean {
  const n = name.toLowerCase();
  if (/^local area connection\s*\*/.test(n)) return true;
  return (
    n.includes('vethernet') ||
    n.includes('hyper-v') ||
    n.includes('wsl') ||
    n.includes('docker') ||
    n.includes('com.docker') ||
    n.includes('vmware') ||
    n.includes('virtualbox') ||
    n.includes('vbox') ||
    n.includes('loopback') ||
    n.includes('bluetooth') ||
    n.includes('tap-windows') ||
    n.includes('vpn') ||
    n.includes('hosted network') ||
    n.includes('virtual') ||
    n.startsWith('veth') ||
    n.startsWith('br-') ||
    n === 'docker0'
  );
}

export function classifyAdapterName(name: string): LanKind {
  const n = name.toLowerCase();
  if (/wi-?fi|wlan|wireless/.test(n)) return 'wifi';
  if (/ethernet|^eth\d|^enp\d|^eno\d/.test(n) && !/wireless/.test(n)) {
    return 'ethernet';
  }
  return 'other';
}

function toAddress(kind: LanKind, name: string, ipv4: string): LanAddress {
  return {
    kind,
    name,
    ipv4,
    url: `http://${ipv4}:${LAN_API_PORT}`,
  };
}

export function listLanAddresses(): LanAddressesResult {
  const nets = os.networkInterfaces();
  const wifi: LanAddress[] = [];
  const ethernet: LanAddress[] = [];
  const other: LanAddress[] = [];

  for (const [name, addrs] of Object.entries(nets)) {
    if (!addrs || isVirtualAdapterName(name)) continue;
    for (const addr of addrs) {
      if (!isIPv4(addr.family) || addr.internal) continue;
      if (isApipa(addr.address) || !isPrivateLan(addr.address)) continue;
      const kind = classifyAdapterName(name);
      const item = toAddress(kind, name, addr.address);
      if (kind === 'wifi') wifi.push(item);
      else if (kind === 'ethernet') ethernet.push(item);
      else other.push(item);
    }
  }

  return {
    wifi: wifi[0] ?? null,
    ethernet: ethernet[0] ?? null,
    other,
  };
}
