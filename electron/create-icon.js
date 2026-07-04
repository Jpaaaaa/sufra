const fs = require('fs');
const path = require('path');

// Simple script to create a placeholder icon if missing
const iconPath = path.join(__dirname, 'build', 'icon.ico');
const buildDir = path.join(__dirname, 'build');

// Create build directory if it doesn't exist
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

// Check if icon exists
if (!fs.existsSync(iconPath)) {
  console.log('⚠️  Icon not found at:', iconPath);
  console.log('⚠️  Build will proceed without custom icon (Windows will use default)');
  console.log('💡 To add a custom icon, place icon.ico in electron/build/');
} else {
  console.log('✓ Icon found at:', iconPath);
}

