import * as fs from 'fs';
import * as path from 'path';
import { encryptLicense, LicenseData } from './encrypt';

function printUsage() {
  console.log(`
Usage: npx ts-node generate-license.ts <usb_serial> <license_type> <output_path>

Arguments:
  usb_serial    - The USB drive serial number (from device manager or diskpart)
  license_type  - "trial" (30 days), "monthly" (30 days), or "yearly" (365 days)
  output_path   - Where to save the license file (e.g., E:\\SUFRA_LICENSE\\license.bin)

Examples:
  npx ts-node generate-license.ts ABC123 trial ./license.bin
  npx ts-node generate-license.ts ABC123 monthly E:\\SUFRA_LICENSE\\license.bin
  npx ts-node generate-license.ts ABC123 yearly E:\\SUFRA_LICENSE\\license.bin
`);
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]; // YYYY-MM-DD
}

async function main() {
  const [, , usbSerial, licenseType, outputPathArg] = process.argv;

  if (!usbSerial || !licenseType || !outputPathArg) {
    printUsage();
    process.exit(1);
  }

  // Validate license type
  if (licenseType !== 'trial' && licenseType !== 'monthly' && licenseType !== 'yearly') {
    console.error('Error: license_type must be "trial", "monthly", or "yearly"');
    printUsage();
    process.exit(1);
  }

  // Calculate dates
  const now = new Date();
  const issuedAt = formatDate(now);
  
  const expiresAt = new Date(now);
  if (licenseType === 'trial') {
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days for trial
  } else if (licenseType === 'monthly') {
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days for monthly
  } else {
    expiresAt.setDate(expiresAt.getDate() + 365); // 365 days for yearly
  }

  const data: LicenseData = {
    product: 'sufra pos',
    license_type: licenseType,
    assigned_serial: usbSerial.toUpperCase(),
    issued_at: issuedAt,
    expires_at: formatDate(expiresAt),
  };

  console.log('\n License Details:');
  console.log('-------------------');
  console.log(`  Product:      ${data.product}`);
  console.log(`  Type:         ${data.license_type}`);
  console.log(`  USB Serial:   ${data.assigned_serial}`);
  console.log(`  Issued:       ${data.issued_at}`);
  console.log(`  Expires:      ${data.expires_at}`);
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
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
