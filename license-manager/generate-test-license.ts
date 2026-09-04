import * as fs from 'fs';
import * as path from 'path';
import { encryptLicense, LicenseData } from './encrypt';

/**
 * Generate a test license that expires in 5 minutes
 * Usage: npx ts-node generate-test-license.ts <usb_serial> <output_path>
 */

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]; // YYYY-MM-DD
}

async function main() {
  const [, , usbSerial, outputPathArg] = process.argv;

  if (!usbSerial || !outputPathArg) {
    console.log('Usage: npx ts-node generate-test-license.ts <usb_serial> <output_path>');
    console.log('Example: npx ts-node generate-test-license.ts B8F18F3A E:\\SUFRA_LICENSE\\license.bin');
    process.exit(1);
  }

  // Calculate dates - expires in 5 minutes
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes from now

  const data: LicenseData = {
    product: 'sufra pos',
    license_type: 'trial', // Use trial type for test
    assigned_serial: usbSerial.toUpperCase(),
    issued_at: now.toISOString(), // Store full timestamp for test licenses
    expires_at: expiresAt.toISOString(), // Store full timestamp for test licenses
  };

  console.log('\n Test License Details:');
  console.log('-------------------');
  console.log(`  Product:      ${data.product}`);
  console.log(`  Type:         ${data.license_type} (TEST - 5 minutes)`);
  console.log(`  USB Serial:   ${data.assigned_serial}`);
  console.log(`  Issued:       ${data.issued_at} ${now.toTimeString().split(' ')[0]}`);
  console.log(`  Expires:      ${data.expires_at} ${expiresAt.toTimeString().split(' ')[0]}`);
  console.log(`  Valid for:    5 minutes`);
  console.log('');

  const encrypted = encryptLicense(data);

  const outputPath = path.resolve(process.cwd(), outputPathArg);
  
  // Ensure directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, encrypted);
  
  console.log(`License file written to: ${outputPath}`);
  console.log(`   File size: ${encrypted.length} bytes`);
  console.log('\n⚠️  NOTE: This license expires TODAY, so it will be valid for the rest of today.');
  console.log('   The app checks dates (not times), so it will show 0 days remaining but still be valid.');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
