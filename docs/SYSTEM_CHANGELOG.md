# System changelog

User-visible changes by version. Newest first.

## [0.1.21] — 2026-08-05

### Fixed

- Safe auto-upgrade from Sufra Lite **0.1.13** to current builds: installer no longer deletes the old app before the new copy finishes (prevents “app uninstalled” if setup is cancelled or fails after UAC)
- Legacy “Sufra Lite POS” folders are removed only after a successful install

## [0.1.20] — 2026-08-05

### Changed

- Professional redesign of kitchen tickets and customer receipts for thermal printers (58mm / 80mm)
- Kitchen ticket: no logo, no guests count, clearer order badge and items table
- Shared print tokens/primitives for consistent RTL layout, wrapping, and ESC/POS raster output

## [0.1.19] — 2026-08-03

### Added

- **Item options (modifiers)** on menu items: size groups (different prices), flavor groups (same base price), and paid extras
- POS options picker with live total, default selections, long-press quick-add, and edit-from-cart
- Kitchen receipts show option sub-lines under each item
- Copy item options from another item in catalog admin

## [0.1.18] — 2026-08-02

### Added

- **Local backup** (Electron hub): scheduled daily snapshots, manual backup, admin restore from Settings → Backup
- Backup excludes license and auto-update files so activation and updates keep working
- Documentation hub under `docs/` (features, technical spec, backup spec, maintenance guide)

### Changed

- Sidebar view controls: zoom out / zoom in / reload (UI scale via `fontSize`)
