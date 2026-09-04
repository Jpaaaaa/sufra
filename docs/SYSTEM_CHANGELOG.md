# System changelog

User-visible changes by version. Newest first.

## [0.1.35] — 2026-08-31

### Added

- POS session sheet: English / Arabic / Kurdish (Sorani); same persisted language as login and dashboard
- Desktop Orders workbench: hall chips instead of square gallery, table map fills the pane, compact takeaway/delivery new-order button
- Orders table map: color legend swatches; occupied tables show wait time, item count, and total

### Fixed

- Desktop header: taller bar, centered logo, language and support on one row
- Zoom in/out now scales the POS floor and other px layouts (CSS `zoom`, not root `fontSize` only)
- Zooming out no longer leaves an empty band under the POS floor (`#root` inverse size + zoom)
- POS meal cards shrink and pack tighter when zooming out
- Orders table tiles no longer stretch to fill the row, so zoom in/out changes card size
- Desktop zoom no longer adds a page scrollbar (shell height matches waiter POS: `100dvh / scale`)
- Home system status: live API mode/version, LAN IP, configured printer, and real device/user
- Home billboard default slide: BAZAR ONE hero artwork

## [0.1.34] — 2026-08-27

### Added

- Waiter Point of Sale (`#/pos`): landscape touch floor and table ordering, separate confirm and kitchen print, table discount sheet, offer details and new groups, edit confirmed table orders

### Fixed

- Desktop header logo no longer overflows the top bar
- POS cart list, square item grid, compact top bar zoom/refresh

## [0.1.28] — 2026-08-09

### Fixed

- Pickup (takeaway) customer receipts now include customer name and phone
- Delivery and pickup kitchen tickets show customer details more clearly

### Changed

- Customer block on pickup/delivery receipts: bold header bar, double outline, larger name/phone/address for thermal readability

## [0.1.24] — 2026-08-08

### Added

- Restaurant print branding: upload a logo (auto-converted to black & white) for customer receipts
- Settings tab renamed to «هوية الطباعة» with receipt preview

### Fixed

- Kitchen ticket: order-note box no longer overlaps the title; clearer table highlight and meta fields
- Customer receipt: clearer info layout; multi-order invoices show all order numbers joined with `+`
- Dine-in customer receipt: table number uses display number (`table.number`), not database id

### Changed

- Customer receipts merge saved restaurant name / thank-you / phone / logo from print branding settings

## [0.1.23] — 2026-08-05

### Fixed

- Tablet/LAN clients: opening a table or adding an item no longer crashes with a white screen (`crypto.randomUUID` unavailable on plain HTTP)
- Notification panel: restored hall order checks (correct `/orders/dine-in/hall/:id` path; removed 404 spam)

## [0.1.22] — 2026-08-05

### Fixed

- Dine-in hall view crash on older databases: `order_items.options_json` is preserved across schema rebuilds and re-added if missing

### Added

- Admin users page: view and change each employee login code (including admin), with show/hide controls

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
