const usb = require('escpos-usb');
const fs = require('fs');

console.log("========================================");
console.log("Testing escpos-usb detection...");
console.log("========================================");

console.log("\n[TEST] Checking USB path:");
const usbPathExists = fs.existsSync('/dev/bus/usb');
console.log(`  /dev/bus/usb exists: ${usbPathExists}`);

if (usbPathExists) {
  try {
    const usbDevices = fs.readdirSync('/dev/bus/usb');
    console.log(`  Found ${usbDevices.length} USB bus directories`);
  } catch (e) {
    console.error(`  Error reading USB directory: ${e.message}`);
  }
}

console.log("\n[TEST] escpos-usb module:");
console.log(`  Module loaded: ${typeof usb === 'object'}`);
console.log(`  findPrinter function: ${typeof usb.findPrinter === 'function'}`);

console.log("\n[TEST] Attempting to find printers...");
try {
  const printers = usb.findPrinter();
  
  console.log(`\n[RESULT] Type: ${Array.isArray(printers) ? 'array' : typeof printers}`);
  console.log(`[RESULT] Value:`, printers);
  
  if (Array.isArray(printers)) {
    console.log(`[RESULT] Found ${printers.length} printer(s)`);
    printers.forEach((device, idx) => {
      console.log(`\n  Device ${idx}:`);
      if (device.deviceDescriptor) {
        const vid = device.deviceDescriptor.idVendor?.toString(16).padStart(4, '0') || 'unknown';
        const pid = device.deviceDescriptor.idProduct?.toString(16).padStart(4, '0') || 'unknown';
        console.log(`    VID: 0x${vid}`);
        console.log(`    PID: 0x${pid}`);
      } else {
        console.log(`    (No deviceDescriptor)`);
      }
    });
  } else if (printers) {
    console.log(`[RESULT] Single device returned (not array)`);
    if (printers.deviceDescriptor) {
      const vid = printers.deviceDescriptor.idVendor?.toString(16).padStart(4, '0') || 'unknown';
      const pid = printers.deviceDescriptor.idProduct?.toString(16).padStart(4, '0') || 'unknown';
      console.log(`  VID: 0x${vid}`);
      console.log(`  PID: 0x${pid}`);
    }
  } else {
    console.log(`[RESULT] No printers found (null/undefined)`);
  }
  
  console.log("\n========================================");
  console.log("Test completed successfully");
  console.log("========================================");
} catch (err) {
  console.error("\n[ERROR] Exception during detection:");
  console.error(`  Message: ${err.message}`);
  console.error(`  Code: ${err.code || 'N/A'}`);
  console.error(`  Stack:\n${err.stack}`);
  console.log("\n========================================");
  console.log("Test failed");
  console.log("========================================");
  process.exit(1);
}

