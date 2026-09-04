/**
 * Alternate electron-builder config (mirrors electron-builder.json).
 * Live backend: ncc bundle + minimal native runtime node_modules.
 */
const path = require('path');

module.exports = {
  appId: 'com.sufra.lite.pos',
  productName: 'sufra pos',
  icon: 'build/icon.ico',
  forceCodeSigning: false,

  directories: {
    output: 'release',
    buildResources: 'build',
  },

  asar: true,
  compression: 'normal',

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
    executableName: 'sufra-pos',
    icon: 'build/icon.ico',
    sign: null,
    signAndEditExecutable: false,
    forceCodeSigning: false,
    signingHashAlgorithms: [],
  },

  npmRebuild: false,

  nsis: {
    oneClick: false,
    perMachine: true,
    allowToChangeInstallationDirectory: false,
    allowElevation: true,
    runAfterFinish: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'sufra pos',
    include: 'build/installer.nsh',
    installerSidebar: 'build/installerSidebar.bmp',
    installerHeader: 'build/installerHeader.bmp',
    installerIcon: 'build/icon.ico',
    uninstallerIcon: 'build/icon.ico',
    uninstallDisplayName: 'sufra pos',
    artifactName: 'sufra pos Setup ${version}.${ext}',
    warningsAsErrors: false,
  },

  afterPack: require('./scripts/after-pack-win.js').default,

  afterSign: async () => {
    console.log('[BUILD] Skipping code signing as requested');
  },
};
