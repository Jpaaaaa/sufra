const fs = require('fs');
const path = require('path');

// Minimal valid ICO file structure
// ICO file header: 6 bytes
// Icon directory entry: 16 bytes per entry
// Icon data: BMP format

// This creates a minimal valid 16x16 ICO file
// ICO file format:
// - Header (6 bytes): Reserved (2), Type (2), Count (2)
// - Directory (16 bytes per entry): Width, Height, Colors, Reserved, Planes (2), BitCount (2), Size (4), Offset (4)
// - Image data: BMP format

const buildDir = path.join(__dirname, 'build');
const iconPath = path.join(buildDir, 'icon.ico');

// Create build directory if it doesn't exist
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

// Minimal valid 16x16x32 ICO file (256 bytes total)
// This is a simple blue square icon
const icoFile = Buffer.alloc(256);

// ICO Header (6 bytes)
icoFile.writeUInt16LE(0, 0);      // Reserved (must be 0)
icoFile.writeUInt16LE(1, 2);     // Type (1 = ICO)
icoFile.writeUInt16LE(1, 4);     // Count (1 icon)

// Icon Directory Entry (16 bytes)
icoFile.writeUInt8(16, 6);       // Width (16 pixels)
icoFile.writeUInt8(16, 7);       // Height (16 pixels)
icoFile.writeUInt8(0, 8);        // Colors (0 = no palette, 32-bit)
icoFile.writeUInt8(0, 9);        // Reserved
icoFile.writeUInt16LE(1, 10);    // Planes
icoFile.writeUInt16LE(32, 12);   // BitCount (32-bit)
icoFile.writeUInt32LE(248, 14);  // Size (248 bytes for BMP data)
icoFile.writeUInt32LE(22, 18);   // Offset (22 bytes from start)

// BMP Header (40 bytes) - starts at offset 22
icoFile.writeUInt32LE(40, 22);   // BMP header size
icoFile.writeInt32LE(16, 26);    // Width
icoFile.writeInt32LE(32, 30);    // Height (16*2 for ICO format)
icoFile.writeUInt16LE(1, 34);    // Planes
icoFile.writeUInt16LE(32, 36);   // BitCount
icoFile.writeUInt32LE(0, 38);    // Compression (0 = none)
icoFile.writeUInt32LE(0, 42);    // ImageSize
icoFile.writeInt32LE(0, 46);     // XpixelsPerM
icoFile.writeInt32LE(0, 50);     // YpixelsPerM
icoFile.writeUInt32LE(0, 54);    // ColorsUsed
icoFile.writeUInt32LE(0, 58);    // ColorsImportant

// Simple blue pixel data (fill with blue color)
// Each pixel is 4 bytes (BGRA format)
for (let i = 62; i < 256; i += 4) {
  icoFile[i] = 255;     // Blue
  icoFile[i + 1] = 128; // Green
  icoFile[i + 2] = 0;   // Red
  icoFile[i + 3] = 255; // Alpha
}

// Write the ICO file
fs.writeFileSync(iconPath, icoFile);
console.log('✓ Created icon.ico at:', iconPath);
console.log('  Size:', fs.statSync(iconPath).size, 'bytes');

