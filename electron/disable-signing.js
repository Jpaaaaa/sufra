// Completely disable signing by monkey-patching electron-builder
process.env.CSC_IDENTITY_AUTO_DISCOVERY = 'false';
process.env.CSC_LINK = '';
process.env.CSC_KEY_PASSWORD = '';
process.env.WIN_CSC_LINK = '';
process.env.WIN_CSC_KEY_PASSWORD = '';

// Patch the signing module if it gets loaded
const Module = require('module');
const originalLoad = Module._load;

Module._load = function(request, parent) {
  const mod = originalLoad.apply(this, arguments);
  
  // Patch windowsCodeSign module
  if (request.includes('codeSign') && mod) {
    if (mod.sign) {
      mod.sign = async () => {
        console.log('[SIGNING] Signing disabled - skipping');
        return Promise.resolve();
      };
    }
    if (mod.doSign) {
      mod.doSign = async () => {
        console.log('[SIGNING] Signing disabled - skipping doSign');
        return Promise.resolve();
      };
    }
  }
  
  return mod;
};

