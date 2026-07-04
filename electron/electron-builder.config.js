module.exports = {
  appId: "com.sufra.lite.pos",
  productName: "Sufra POS",
  icon: "../icon.ico",
  forceCodeSigning: false,

  directories: {
    output: "release",
    buildResources: "build"
  },

  asar: true,

  files: [
    "dist/**/*",
    "node_modules/**/*",
    "package.json"
  ],
  
  // Use extraFiles for backend (outside asar for native modules)
  extraFiles: [
    {
      from: "../frontend/out",
      to: "frontend/out"
    },
    {
      from: "../backend/dist/core",
      to: "backend/dist/core"
    },
    {
      from: "../backend/node_modules",
      to: "backend/node_modules",
      filter: [
        "**/*",
        "!**/*.md",
        "!**/*.txt",
        "!**/test/**",
        "!**/tests/**",
        "!**/.bin/**"
      ]
    },
    {
      from: "../backend/package.json",
      to: "backend/package.json"
    }
  ],

  // Exclude backend source files and build scripts
  // Native modules (bcrypt, @thiagoelg/node-printer) require node_modules to be present
  // We only ship dist/ and node_modules/, not src/ or build scripts
  // Note: electron-builder automatically excludes common dev files, but we're explicit here

  extraResources: [
    {
      from: "./node",
      to: "node"
    },
    {
      from: "../icon.ico",
      to: "icon.ico"
    }
  ],

  win: {
    target: ["nsis"],
    icon: "../icon.ico",
    sign: null,
    signAndEditExecutable: false,
    forceCodeSigning: false,
    signingHashAlgorithms: []
  },
  
  npmRebuild: false,

  nsis: {
    oneClick: false,
    perMachine: true,
    allowToChangeInstallationDirectory: false,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    installerSidebar: "build/installerSidebar.bmp",
    installerHeader: "build/installerHeader.bmp",
    installerIcon: "build/icon.ico",
    uninstallerIcon: "build/icon.ico"
  },

  // Override afterPack to prevent signing attempts
  afterPack: async (context) => {
    // Do nothing - skip all signing
    console.log('[BUILD] Skipping code signing as requested');
    return Promise.resolve();
  },
  
  // Override afterSign to prevent signing attempts
  afterSign: async (context) => {
    // Do nothing - skip all signing
    console.log('[BUILD] Skipping code signing as requested');
    return Promise.resolve();
  }
};

