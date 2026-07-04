// Patch electron-builder to skip signing completely
const originalRequire = require;
const Module = require('module');

// Intercept require calls to patch signing
const originalLoad = Module._load;
Module._load = function(request, parent) {
  if (request.includes('windowsCodeSign')) {
    const mod = originalLoad.apply(this, arguments);
    if (mod && mod.sign) {
      const originalSign = mod.sign;
      mod.sign = async function() {
        console.log('[PATCH] Skipping Windows code signing');
        return Promise.resolve();
      };
    }
    if (mod && mod.doSign) {
      const originalDoSign = mod.doSign;
      mod.doSign = async function() {
        console.log('[PATCH] Skipping Windows code signing (doSign)');
        return Promise.resolve();
      };
    }
    return mod;
  }
  return originalLoad.apply(this, arguments);
};

