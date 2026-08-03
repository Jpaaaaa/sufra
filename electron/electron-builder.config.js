/**
 * Alternate electron-builder config (mirrors electron-builder.json).
 * Live backend: ncc bundle + minimal native runtime node_modules.
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
  compression: 'store',

  files: ['dist/**/*', '!dist/backend/**', 'package.json', 'build/**/*'],

  extraResources: [
    {
      from: '../frontend/dist',
      to: 'frontend/dist',
      filter: ['**/*'],
    },
    {
      from: 'backend/dist-bundle',
      to: 'backend/dist',
      filter: ['**/*'],
    },
    {
      from: 'backend/runtime-node_modules',
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
        '!**/*.ts',
        '!**/*.map',
        '!**/src/**',
      ],
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
