import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
// NOTE: Must match LICENSE_SECRET_KEY used by the Electron app.
const KEY_HEX =
  process.env.LICENSE_SECRET_KEY ??
  '0000000000000000000000000000000000000000000000000000000000000000';
const KEY = Buffer.from(KEY_HEX, 'hex');

export interface LicenseData {
  product: 'Sufra POS';
  license_type: 'trial' | 'monthly' | 'yearly';
  assigned_serial: string;
  issued_at: string;   // YYYY-MM-DD
  expires_at: string;  // YYYY-MM-DD
}

export function encryptLicense(data: LicenseData): Buffer {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const payload = Buffer.from(JSON.stringify(data), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(payload), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]);
}

export function decryptLicense(encrypted: Buffer): LicenseData {
  const iv = encrypted.subarray(0, 12);
  const authTag = encrypted.subarray(12, 28);
  const ciphertext = encrypted.subarray(28);
  
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(authTag);
  
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8')) as LicenseData;
}
