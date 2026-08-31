# Sufra Lite POS — Features (living catalog)

> Reflects **shipped** behavior only. Planned work → [ROADMAP.md](./ROADMAP.md).

## Platform

- **Electron hub** (Windows) — SQLite, printing, license, updates, backup
- **LAN clients** — browser / PWA / Android connect to hub API (port 3333)
- Roles — admin, manager, cashier, waiter, kitchen, customer
- Language — English, Arabic, Kurdish (Sorani); login, header, and POS session sheet; persisted

## Modules

- Dashboard, **Orders** (desktop workbench: hall chips + table map; pickup/delivery lists), halls & tables
- Items, categories, shelves, offers, finance, reports
- **Item options** — per-item sizes, flavors, and paid extras (admin templates; POS picker with defaults and quick-add)
- Settings: printers, recipe print branding, shifts, server/LAN, users
- License & app updates (Electron hub)
- **Local backup** (Electron hub) — Settings → Backup

## Backup (Phase 2)

- Scheduled daily backup (default 02:00) + manual “Back up now”
- Backs up: `sufra.sqlite`, `recipe-print-branding.json`, `uploads/`
- **Does not** touch license or update files (see [ONBOARDING_AND_BACKUP.md](./ONBOARDING_AND_BACKUP.md))
- Restore: admin only, app restart

## Sidebar utilities

- Zoom out / zoom in (UI scale via CSS `zoom` on `#root` with inverse viewport size, persisted)
- Reload page
