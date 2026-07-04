const fs = require('fs');
const path = require('path');

function deleteFolderRecursive(dir) {
  if (!fs.existsSync(dir)) {
    return;
  }

  fs.readdirSync(dir).forEach((file) => {
    const curPath = path.join(dir, file);
    try {
      if (fs.lstatSync(curPath).isDirectory()) {
        deleteFolderRecursive(curPath);
      } else {
        fs.unlinkSync(curPath);
      }
    } catch (err) {
      // Ignore errors for locked files
      console.warn(`Warning: Could not delete ${curPath}:`, err.message);
    }
  });

  try {
    fs.rmdirSync(dir);
  } catch (err) {
    // Ignore errors if directory is not empty
    console.warn(`Warning: Could not remove directory ${dir}:`, err.message);
  }
}

const outDir = path.join(__dirname, 'out');
if (fs.existsSync(outDir)) {
  console.log('Cleaning out directory...');
  deleteFolderRecursive(outDir);
  console.log('Clean complete.');
} else {
  console.log('Out directory does not exist, skipping clean.');
}

