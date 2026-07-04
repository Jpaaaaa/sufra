import * as fs from 'fs';
import * as path from 'path';
import { decryptLicense } from './encrypt';

const licensePath = process.argv[2] || 'E:\\SUFRA_LICENSE\\license.bin';

console.log('Testing license file:', licensePath);

if (!fs.existsSync(licensePath)) {
  console.error('License file not found!');
  process.exit(1);
}

try {
  const encrypted = fs.readFileSync(licensePath);
  console.log('License file size:', encrypted.length, 'bytes');
  
  const license = decryptLicense(encrypted);
  
  console.log('\n✅ License decrypted successfully!');
  console.log('License details:');
  console.log('  Product:', license.product);
  console.log('  Type:', license.license_type);
  console.log('  USB Serial:', license.assigned_serial);
  console.log('  Issued:', license.issued_at);
  console.log('  Expires:', license.expires_at);
  
  // Normalize serial for comparison
  const normalizedSerial = license.assigned_serial.replace(/-/g, '').toUpperCase();
  console.log('  Normalized Serial:', normalizedSerial);
  
} catch (error: any) {
  console.error('❌ Failed to decrypt license:', error.message);
  process.exit(1);
}
