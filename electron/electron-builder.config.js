/**
 * Alternate electron-builder config (mirrors electron-builder.json).
 * Live backend: electron/backend → packaged as resources/backend/
 */
module.exports = {
  appId: 'com.sufra.lite.pos',
  productName: 'Sufra Lite POS',
  icon: 'build/icon.ico',
  forceCodeSigning: false,

  directories: {
    output: 'release',
    buildResources: 'build',
  },

  asar: true,

  files: ['dist/**/*', 'package.json', 'build/**/*'],

  extraResources: [
    {
      from: '../frontend/dist',
      to: 'frontend/dist',
      filter: ['**/*'],
    },
    {
      from: 'backend/dist',
      to: 'backend/dist',
      filter: ['**/*'],
    },
    {
      from: 'backend/node_modules',
      to: 'backend/node_modules',
      filter: [
        '**/*',
        '!**/*.md',
        '!**/README*',
        '!**/CHANGELOG*',
        '!**/test/**',
        '!**/tests/**',
        '!**/__tests__/**',
        '!**/.github/**',
        '!**/docs/**',
      ],
    },
    {
      from: 'backend/package.json',
      to: 'backend/package.json',
    },
    {
      from: './node',
      to: 'node',
    },
    {
      from: 'build/icon.ico',
      to: 'icon.ico',
    },
  ],

  win: {
    target: ['nsis'],
    icon: 'build/icon.ico',
    sign: null,
    forceCodeSigning: false,
    signingHashAlgorithms: [],
  },

  npmRebuild: false,

  nsis: {
    oneClick: false,
    perMachine: true,
    allowToChangeInstallationDirectory: false,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    installerSidebar: 'build/installerSidebar.bmp',
    installerHeader: 'build/installerHeader.bmp',
    installerIcon: 'build/icon.ico',
    uninstallerIcon: 'build/icon.ico',
  },

  afterPack: async () => {
    console.log('[BUILD] Skipping code signing as requested');
  },

  afterSign: async () => {
    console.log('[BUILD] Skipping code signing as requested');
  },
};
